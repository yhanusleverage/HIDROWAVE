-- =====================================================
-- Script para atualizar RPC activate_auto_ec para JSON Optimizado
-- =====================================================
-- 
-- ✅ ATUALIZAÇÕES:
-- 1. RPC NÃO retorna mais `distribution` (se calcula en tiempo real en ESP32)
-- 2. RPC retorna solo los 9 parámetros básicos + nutrients[]
-- 3. Actualiza comentarios de la tabla para reflejar cambios
--
-- Data: 2025-01-12
-- =====================================================

-- ✅ PASSO 1: Atualizar função RPC (remover distribution do retorno)
DROP FUNCTION IF EXISTS activate_auto_ec(TEXT);

-- ✅ CRIAR nova função SEM distribution (JSON optimizado)
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
  WHERE ec_config_view.device_id = p_device_id
  FOR UPDATE SKIP LOCKED;
  
  -- Se não encontrou, retornar erro
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Configuração EC não encontrada para device_id: %. Execute "Salvar Parâmetros" primeiro.', p_device_id;
  END IF;
  
  -- Atualizar auto_enabled para true na view
  UPDATE public.ec_config_view
  SET auto_enabled = true,
      updated_at = now()
  WHERE ec_config_view.device_id = p_device_id;
  
  -- ✅ Retornar configuração optimizada (SEM distribution)
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
    -- ❌ NÃO retornar distribution (se calcula en tiempo real en ESP32)
    config_record.created_at,
    now() as updated_at;
END;
$$;

-- Comentário na função
COMMENT ON FUNCTION activate_auto_ec(TEXT) IS 
  'Ativa Auto EC e retorna configuração optimizada para o ESP32 (9 parámetros básicos + nutrients[]). Distribution se calcula en tiempo real en el ESP32. Similar ao padrão get_and_lock_slave_commands.';

-- ✅ PASSO 2: Atualizar comentários da tabela
COMMENT ON COLUMN public.ec_config_view.distribution IS 
  '❌ DEPRECADO: Distribution ya no se usa. Se calcula en tiempo real en el ESP32 con valores actuales del sensor. Este campo se mantiene por compatibilidad pero no se retorna en el RPC.';

COMMENT ON COLUMN public.ec_config_view.nutrients IS 
  'Array JSONB de nutrientes. Cada nutriente contiene: name (text), relay (integer), mlPerLiter (double precision), active (boolean). Se envía al ESP32 para que sepa qué relé usar, pero NO se guarda en NVS.';

COMMENT ON COLUMN public.ec_config_view.kp IS 
  'Ganho proporcional do controlador (default: 1.0). Parâmetro crítico para cálculo de dosagem.';

COMMENT ON COLUMN public.ec_config_view.tempo_recirculacao IS 
  'Tempo de recirculação em SEGUNDOS (INTEGER). Exemplo: 60 = 1 minuto, 4500 = 75 minutos. Valor mínimo: 1 segundo. ✅ IMPORTANTE: Enviar como INTEGER, no string ni milisegundos.';

-- ✅ PASSO 3: Verificar que la columna kp existe (si no, crearla)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ec_config_view'
    AND column_name = 'kp'
  ) THEN
    ALTER TABLE public.ec_config_view 
    ADD COLUMN kp DOUBLE PRECISION DEFAULT 1.0;
    
    RAISE NOTICE '✅ Coluna kp adicionada à ec_config_view';
  ELSE
    RAISE NOTICE '✅ Coluna kp já existe em ec_config_view';
  END IF;
END $$;

-- ✅ PASSO 4: Verificar criação da função
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'activate_auto_ec'
    AND pg_get_function_arguments(oid) LIKE '%p_device_id TEXT%'
  ) THEN
    RAISE NOTICE '✅ Função RPC activate_auto_ec atualizada com sucesso (JSON optimizado)';
  ELSE
    RAISE WARNING '❌ Falha ao atualizar função RPC activate_auto_ec';
  END IF;
END $$;

-- ✅ PASSO 5: Verificar que tempo_recirculacao es INTEGER (no TEXT)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ec_config_view'
    AND column_name = 'tempo_recirculacao'
    AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '✅ Coluna tempo_recirculacao está correta (INTEGER)';
  ELSE
    RAISE WARNING '⚠️ Coluna tempo_recirculacao não é INTEGER. Execute MIGRAR_TEMPO_RECIRCULACAO_PARA_SEGUNDOS.sql primeiro.';
  END IF;
END $$;

-- =====================================================
-- RESUMO DAS MUDANÇAS:
-- =====================================================
-- ✅ RPC activate_auto_ec NÃO retorna mais distribution
-- ✅ RPC retorna solo: 9 parámetros básicos + nutrients[]
-- ✅ Comentarios actualizados para reflejar JSON optimizado
-- ✅ Verificación de que kp existe (se não, se crea)
-- ✅ Verificación de que tempo_recirculacao es INTEGER
-- =====================================================
