-- Tolerancia EC E2E: coluna + RPC activate_auto_ec retorna tolerance
-- Executar após SPRINT_A_EC_TOLERANCE.sql (ou inclui ADD COLUMN)

ALTER TABLE public.ec_config_view
  ADD COLUMN IF NOT EXISTS tolerance DOUBLE PRECISION DEFAULT 50.0;

COMMENT ON COLUMN public.ec_config_view.tolerance IS
  'Banda muerta µS/cm — |setpoint - EC| deve exceder para dosar (default 50)';

DROP FUNCTION IF EXISTS activate_auto_ec(TEXT);

CREATE FUNCTION activate_auto_ec(p_device_id TEXT)
RETURNS TABLE (
  id BIGINT,
  device_id TEXT,
  base_dose DOUBLE PRECISION,
  flow_rate DOUBLE PRECISION,
  volume DOUBLE PRECISION,
  total_ml DOUBLE PRECISION,
  kp DOUBLE PRECISION,
  ec_setpoint DOUBLE PRECISION,
  tolerance DOUBLE PRECISION,
  auto_enabled BOOLEAN,
  intervalo_auto_ec INTEGER,
  tempo_recirculacao INTEGER,
  nutrients JSONB,
  distribution JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
  config_record RECORD;
BEGIN
  SELECT ec.* INTO config_record
  FROM public.ec_config_view AS ec
  WHERE ec.device_id = p_device_id
  FOR UPDATE OF ec SKIP LOCKED;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Configuração EC não encontrada para device_id: %. Execute "Salvar Parâmetros" primeiro.', p_device_id;
  END IF;

  UPDATE public.ec_config_view AS ec
  SET auto_enabled = true,
      updated_at = now()
  WHERE ec.device_id = p_device_id;

  RETURN QUERY
  SELECT
    config_record.id,
    config_record.device_id,
    config_record.base_dose,
    config_record.flow_rate,
    config_record.volume,
    config_record.total_ml,
    config_record.kp,
    config_record.ec_setpoint,
    COALESCE(config_record.tolerance, 50.0),
    true,
    config_record.intervalo_auto_ec,
    config_record.tempo_recirculacao,
    config_record.nutrients,
    config_record.distribution,
    config_record.created_at,
    now() AS updated_at;
END;
$$;

GRANT EXECUTE ON FUNCTION activate_auto_ec(TEXT) TO anon, authenticated, service_role;
