-- =====================================================
-- FIX: column reference "device_id" is ambiguous (42702)
-- =====================================================
-- Causa: RETURNS TABLE (... device_id ...) cria variável de saída
-- com o mesmo nome da coluna da tabela → WHERE device_id = ... falha.
-- Solução: qualificar com alias (ec.device_id / ph.device_id).
--
-- Executar no SQL Editor do Supabase (corrige EC + pH de uma vez).
-- =====================================================

-- ---------- activate_auto_ec ----------
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

-- ---------- activate_auto_ph (se ph_config_view existir) ----------
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

GRANT EXECUTE ON FUNCTION activate_auto_ph(TEXT) TO anon, authenticated, service_role;

-- Garantir coluna tolerance (ignorar se já existir)
ALTER TABLE public.ec_config_view
  ADD COLUMN IF NOT EXISTS tolerance DOUBLE PRECISION DEFAULT 50.0;

DO $$
BEGIN
  RAISE NOTICE '✅ RPC activate_auto_ec e activate_auto_ph corrigidos (device_id qualificado)';
END $$;
