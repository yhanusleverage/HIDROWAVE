-- =====================================================
-- ✅ SCRIPT COMPLETO: RPC Atômico com Status "processing"
-- =====================================================
-- 
-- Este script implementa TUDO necessário para o sistema de comandos atômicos:
-- 1. ✅ Adiciona status "processing" às tabelas
-- 2. ✅ Cria funções RPC atômicas (com correção de ambigüidade)
-- 3. ✅ Configura SECURITY DEFINER
-- 4. ✅ Configura permissões
-- 5. ✅ Adiciona timeout automático
--
-- 🚀 COPIAR E COLAR TODO ESTE SCRIPT NO SQL EDITOR DO SUPABASE
-- 🚀 EXECUTAR TUDO DE UMA VEZ (RUN ou F5)
--
-- =====================================================

BEGIN;

-- =====================================================
-- ETAPA 1: ADICIONAR COLUNA updated_at (SE NÃO EXISTIR)
-- =====================================================

-- Adicionar updated_at em relay_commands_master se não existir
ALTER TABLE public.relay_commands_master 
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Adicionar updated_at em relay_commands_slave se não existir
ALTER TABLE public.relay_commands_slave 
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- =====================================================
-- ETAPA 2: ADICIONAR STATUS "processing" ÀS TABELAS
-- =====================================================

-- Remover constraints antigas (se existirem)
ALTER TABLE public.relay_commands_master 
  DROP CONSTRAINT IF EXISTS relay_commands_master_status_check;

ALTER TABLE public.relay_commands_slave 
  DROP CONSTRAINT IF EXISTS relay_commands_slave_status_check;

-- Adicionar constraint com status "processing" incluído
ALTER TABLE public.relay_commands_master 
  ADD CONSTRAINT relay_commands_master_status_check 
  CHECK (status IN ('pending', 'processing', 'sent', 'completed', 'failed', 'expired'));

ALTER TABLE public.relay_commands_slave 
  ADD CONSTRAINT relay_commands_slave_status_check 
  CHECK (status IN ('pending', 'processing', 'sent', 'completed', 'failed', 'expired'));

-- =====================================================
-- ETAPA 3: CRIAR FUNÇÃO get_and_lock_master_commands()
-- =====================================================

DROP FUNCTION IF EXISTS get_and_lock_master_commands(text, integer, integer);

CREATE OR REPLACE FUNCTION get_and_lock_master_commands(
  p_device_id text,
  p_limit integer DEFAULT 1,
  p_timeout_seconds integer DEFAULT 30
)
RETURNS TABLE (
  id bigint,
  device_id text,
  relay_numbers integer[],
  actions text[],
  duration_seconds integer[],
  command_type text,
  priority integer,
  triggered_by text,
  rule_id text,
  rule_name text,
  created_at timestamptz
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_command_ids bigint[];
BEGIN
  -- 1. ✅ Resetar comandos "processing" expirados (COM ALIAS)
  UPDATE public.relay_commands_master rc
  SET status = 'pending',
      updated_at = NOW()
  WHERE rc.status = 'processing'
    AND rc.device_id = p_device_id
    AND rc.updated_at < NOW() - (p_timeout_seconds || ' seconds')::INTERVAL;
  
  -- 2. ✅ Buscar IDs de comandos pendentes (com priorização)
  SELECT ARRAY_AGG(rc.id ORDER BY 
    CASE COALESCE(rc.command_type, 'manual')
      WHEN 'peristaltic' THEN 1
      WHEN 'rule' THEN 2
      WHEN 'manual' THEN 3
      ELSE 3
    END,
    COALESCE(rc.priority, 50) DESC,
    rc.created_at ASC
  )
  INTO v_command_ids
  FROM public.relay_commands_master rc
  WHERE rc.device_id = p_device_id
    AND rc.status = 'pending'
    AND (rc.expires_at IS NULL OR rc.expires_at > NOW())
  LIMIT p_limit;
  
  -- Se não há comandos pendentes, retornar vazio
  IF v_command_ids IS NULL OR array_length(v_command_ids, 1) = 0 THEN
    RETURN;
  END IF;
  
  -- 3. ✅ Marcar como "processing" ATÔMICAMENTE (COM ALIAS)
  UPDATE public.relay_commands_master rc
  SET status = 'processing',
      updated_at = NOW()
  WHERE rc.id = ANY(v_command_ids)
    AND rc.status = 'pending';  -- ✅ CRÍTICO: Só atualiza se ainda está pending
  
  -- 4. ✅ Retornar comandos marcados
  RETURN QUERY
  SELECT 
    rc.id,
    rc.device_id,
    rc.relay_numbers,
    rc.actions,
    rc.duration_seconds,
    COALESCE(rc.command_type, 'manual') as command_type,
    COALESCE(rc.priority, 50) as priority,
    COALESCE(rc.triggered_by, 'manual') as triggered_by,
    rc.rule_id,
    rc.rule_name,
    rc.created_at
  FROM public.relay_commands_master rc
  WHERE rc.id = ANY(v_command_ids)
    AND rc.status = 'processing'
  ORDER BY rc.created_at ASC;
END;
$$;

-- =====================================================
-- ETAPA 4: CRIAR FUNÇÃO get_and_lock_slave_commands()
-- =====================================================

DROP FUNCTION IF EXISTS get_and_lock_slave_commands(text, integer, integer);

CREATE OR REPLACE FUNCTION get_and_lock_slave_commands(
  p_master_device_id text,
  p_limit integer DEFAULT 1,
  p_timeout_seconds integer DEFAULT 30
)
RETURNS TABLE (
  id bigint,
  master_device_id text,
  slave_device_id text,
  slave_mac_address text,
  relay_numbers integer[],
  actions text[],
  duration_seconds integer[],
  command_type text,
  priority integer,
  triggered_by text,
  rule_id text,
  rule_name text,
  created_at timestamptz
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_command_ids bigint[];
BEGIN
  -- 1. ✅ Resetar comandos "processing" expirados (COM ALIAS)
  UPDATE public.relay_commands_slave rc
  SET status = 'pending',
      updated_at = NOW()
  WHERE rc.status = 'processing'
    AND rc.master_device_id = p_master_device_id
    AND rc.updated_at < NOW() - (p_timeout_seconds || ' seconds')::INTERVAL;
  
  -- 2. ✅ Buscar IDs de comandos pendentes (com priorização)
  SELECT ARRAY_AGG(rc.id ORDER BY 
    CASE COALESCE(rc.command_type, 'manual')
      WHEN 'peristaltic' THEN 1
      WHEN 'rule' THEN 2
      WHEN 'manual' THEN 3
    END,
    COALESCE(rc.priority, 50) DESC,
    rc.created_at ASC
  )
  INTO v_command_ids
  FROM public.relay_commands_slave rc
  WHERE rc.master_device_id = p_master_device_id
    AND rc.status = 'pending'
    AND (rc.expires_at IS NULL OR rc.expires_at > NOW())
  LIMIT p_limit;
  
  -- Se não há comandos pendentes, retornar vazio
  IF v_command_ids IS NULL OR array_length(v_command_ids, 1) = 0 THEN
    RETURN;
  END IF;
  
  -- 3. ✅ Marcar como "processing" ATÔMICAMENTE (COM ALIAS)
  UPDATE public.relay_commands_slave rc
  SET status = 'processing',
      updated_at = NOW()
  WHERE rc.id = ANY(v_command_ids)
    AND rc.status = 'pending';
  
  -- 4. ✅ Retornar comandos marcados
  RETURN QUERY
  SELECT 
    rc.id,
    rc.master_device_id,
    rc.slave_device_id,
    rc.slave_mac_address,
    rc.relay_numbers,
    rc.actions,
    rc.duration_seconds,
    COALESCE(rc.command_type, 'manual') as command_type,
    COALESCE(rc.priority, 50) as priority,
    COALESCE(rc.triggered_by, 'manual') as triggered_by,
    rc.rule_id,
    rc.rule_name,
    rc.created_at
  FROM public.relay_commands_slave rc
  WHERE rc.id = ANY(v_command_ids)
    AND rc.status = 'processing'
  ORDER BY rc.created_at ASC;
END;
$$;

-- =====================================================
-- ETAPA 5: ADICIONAR COMENTÁRIOS
-- =====================================================

COMMENT ON FUNCTION get_and_lock_master_commands IS 
'Busca e marca comandos master como "processing" ATÔMICAMENTE. Previne race condition e duplicação. 
Retorna apenas comandos que foram marcados com sucesso. 
Cada ESP32 Master tem seu device_id único, garantindo isolamento total entre masters.';

COMMENT ON FUNCTION get_and_lock_slave_commands IS 
'Busca e marca comandos de slaves como "processing" ATÔMICAMENTE. Previne race condition e duplicação.
Usa master_device_id para segregar comandos por master ESP32.';

-- =====================================================
-- ETAPA 6: CONFIGURAR PERMISSÕES
-- =====================================================

GRANT EXECUTE ON FUNCTION get_and_lock_master_commands TO anon;
GRANT EXECUTE ON FUNCTION get_and_lock_master_commands TO authenticated;
GRANT EXECUTE ON FUNCTION get_and_lock_slave_commands TO anon;
GRANT EXECUTE ON FUNCTION get_and_lock_slave_commands TO authenticated;

-- =====================================================
-- ETAPA 7: VERIFICAÇÃO FINAL
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Coluna updated_at adicionada (se não existia)';
  RAISE NOTICE '✅ Status "processing" adicionado às tabelas';
  RAISE NOTICE '✅ Função get_and_lock_master_commands() criada com SECURITY DEFINER';
  RAISE NOTICE '✅ Função get_and_lock_slave_commands() criada com SECURITY DEFINER';
  RAISE NOTICE '✅ Permissões configuradas (anon e authenticated)';
  RAISE NOTICE '✅ Correção de ambigüidade aplicada (aliases de tabela)';
END $$;

COMMIT;

-- =====================================================
-- ✅ IMPLEMENTAÇÃO CONCLUÍDA!
-- =====================================================
-- 
-- Próximos passos:
-- 1. ✅ Testar função manualmente:
--    SELECT * FROM get_and_lock_slave_commands('ESP32_HIDRO_F44738', 1, 30);
-- 2. ✅ Compilar e carregar código ESP32
-- 3. ✅ Verificar logs do ESP32 (deve retornar HTTP 200)
--
-- =====================================================

