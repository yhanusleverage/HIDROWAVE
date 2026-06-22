-- =====================================================
-- RPC activate_auto_ph — espejo activate_auto_ec
-- =====================================================

DROP FUNCTION IF EXISTS activate_auto_ph(TEXT);

CREATE FUNCTION activate_auto_ph(p_device_id TEXT)
RETURNS TABLE (
  id BIGINT,
  device_id TEXT,
  ph_setpoint DOUBLE PRECISION,
  ph_tolerance DOUBLE PRECISION,
  flow_rate_ph_up DOUBLE PRECISION,
  flow_rate_ph_down DOUBLE PRECISION,
  volume DOUBLE PRECISION,
  ml_per_ph_unit DOUBLE PRECISION,
  relay_ph_up INTEGER,
  relay_ph_down INTEGER,
  auto_enabled BOOLEAN,
  intervalo_auto_ph INTEGER,
  tempo_recirculacao INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
  config_record RECORD;
BEGIN
  SELECT ph.* INTO config_record
  FROM public.ph_config_view AS ph
  WHERE ph.device_id = p_device_id
  FOR UPDATE OF ph SKIP LOCKED;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Configuração pH não encontrada para device_id: %. Execute "Salvar Parâmetros" primeiro.', p_device_id;
  END IF;

  UPDATE public.ph_config_view AS ph
  SET auto_enabled = true,
      updated_at = now()
  WHERE ph.device_id = p_device_id;

  RETURN QUERY
  SELECT
    config_record.id,
    config_record.device_id,
    config_record.ph_setpoint,
    config_record.ph_tolerance,
    config_record.flow_rate_ph_up,
    config_record.flow_rate_ph_down,
    config_record.volume,
    config_record.ml_per_ph_unit,
    config_record.relay_ph_up,
    config_record.relay_ph_down,
    true,
    config_record.intervalo_auto_ph,
    config_record.tempo_recirculacao,
    config_record.created_at,
    now() AS updated_at;
END;
$$;

COMMENT ON FUNCTION activate_auto_ph(TEXT) IS
  'Ativa Auto pH e retorna configuração completa para o ESP32.';

GRANT EXECUTE ON FUNCTION activate_auto_ph(TEXT) TO anon, authenticated, service_role;
