-- Vazão EC: só nutrients[].flowRate (Calibragem).
-- pH: sem max_*; só ph_tolerance.
-- Flashear ESP con firmware nuevo ANTES de correr este script.

ALTER TABLE public.ec_config_view
  DROP COLUMN IF EXISTS flow_rate;

ALTER TABLE public.ph_config_view
  DROP COLUMN IF EXISTS flow_rate;

ALTER TABLE public.ph_config_view
  DROP COLUMN IF EXISTS max_dose_ml_per_cycle;

ALTER TABLE public.ph_config_view
  DROP COLUMN IF EXISTS max_pulse_seconds;

ALTER TABLE public.ph_config_view
  DROP COLUMN IF EXISTS max_consecutive_corrections;

DROP FUNCTION IF EXISTS activate_auto_ec(TEXT);

CREATE OR REPLACE FUNCTION activate_auto_ec(p_device_id TEXT)
RETURNS TABLE (
  id BIGINT,
  device_id TEXT,
  base_dose DOUBLE PRECISION,
  volume DOUBLE PRECISION,
  total_ml DOUBLE PRECISION,
  kp DOUBLE PRECISION,
  ec_setpoint DOUBLE PRECISION,
  auto_enabled BOOLEAN,
  intervalo_auto_ec INTEGER,
  tempo_recirculacao INTEGER,
  nutrients JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ecv.id,
    ecv.device_id,
    ecv.base_dose,
    ecv.volume,
    ecv.total_ml,
    ecv.kp,
    ecv.ec_setpoint,
    ecv.auto_enabled,
    ecv.intervalo_auto_ec,
    ecv.tempo_recirculacao,
    ecv.nutrients,
    ecv.created_at,
    ecv.updated_at
  FROM public.ec_config_view ecv
  WHERE ecv.device_id = p_device_id;
END;
$$;

COMMENT ON FUNCTION activate_auto_ec(TEXT) IS
  'Lee Auto EC. Vazão por bomba en nutrients[].flowRate. pH sem max_*.';
