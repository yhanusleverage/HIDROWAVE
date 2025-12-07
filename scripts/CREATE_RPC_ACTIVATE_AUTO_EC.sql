-- =====================================================
-- Script para criar RPC que ativa Auto EC e envia config ao ESP32
-- =====================================================
-- 
-- Similar ao padrão get_and_lock_slave_commands
-- Este RPC lê da view ec_config_view e envia ao ESP32
-- 
-- FLUXO:
-- 1. Botão "Salvar Parâmetros" → Salva em ec_config_view
-- 2. Botão "Ativar Auto EC" → Chama este RPC
-- 3. RPC lê ec_config_view, ativa auto_enabled e retorna config
-- 4. ESP32 chama este RPC periodicamente para obter config atualizada
--
-- Data: 2025-01-12
-- =====================================================

-- Função RPC para ativar Auto EC e enviar configuração ao ESP32
-- Similar ao padrão get_and_lock_slave_commands com locking

-- ✅ REMOVER função antiga se existir (necessário para mudar tipo de retorno)
DROP FUNCTION IF EXISTS activate_auto_ec(TEXT);

-- ✅ CRIAR nova função COM distribution
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
  -- Buscar e bloquear configuração da view (FOR UPDATE SKIP LOCKED)
  -- Isso garante que apenas um ESP32 processe a config por vez
  SELECT * INTO config_record
  FROM public.ec_config_view
  WHERE device_id = p_device_id
  FOR UPDATE SKIP LOCKED;
  
  -- Se não encontrou, retornar erro
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Configuração EC não encontrada para device_id: %. Execute "Salvar Parâmetros" primeiro.', p_device_id;
  END IF;
  
  -- Atualizar auto_enabled para true na view
  UPDATE public.ec_config_view
  SET auto_enabled = true,
      updated_at = now()
  WHERE device_id = p_device_id;
  
  -- Retornar configuração completa
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
    true, -- auto_enabled sempre true após ativação
    config_record.intervalo_auto_ec,
    config_record.tempo_recirculacao,
    config_record.nutrients,
    config_record.distribution,
    config_record.created_at,
    now() as updated_at;
END;
$$;

-- Comentário na função
COMMENT ON FUNCTION activate_auto_ec(TEXT) IS 
  'Ativa Auto EC e retorna configuração completa para o ESP32. Similar ao padrão get_and_lock_slave_commands.';

-- Verificar criação
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'activate_auto_ec'
  ) THEN
    RAISE NOTICE '✅ Função RPC activate_auto_ec criada com sucesso';
  ELSE
    RAISE WARNING '❌ Falha ao criar função RPC activate_auto_ec';
  END IF;
END $$;
