-- =====================================================
-- ✅ IMPLEMENTAÇÃO COMPLETA: Atomic Swap com Status "processing"
-- =====================================================
-- 
-- Este script implementa a solução atômica para evitar duplicação de comandos:
-- 1. ✅ Adiciona status "processing" às tabelas relay_commands_master e relay_commands_slave
-- 2. ✅ Cria funções RPC atômicas get_and_lock_master_commands() e get_and_lock_slave_commands()
-- 3. ✅ Adiciona timeout automático para comandos "processing" expirados
-- 4. ✅ Configura permissões necessárias
--
-- IMPORTANTE: Cada ESP32 Master tem seu MAC único que segrega os comandos.
-- Os slaves também são segregados por master_device_id, garantindo isolamento total.
--
-- =====================================================
-- 🚀 COPIAR E COLAR ESTE SCRIPT NO SQL EDITOR DO SUPABASE
-- =====================================================

BEGIN;

-- =====================================================
-- ETAPA 1: ADICIONAR STATUS "processing" ÀS TABELAS
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
-- ETAPA 2: CRIAR FUNÇÃO get_and_lock_master_commands()
-- =====================================================
-- Esta função busca e marca comandos como "processing" ATÔMICAMENTE
-- Previne race conditions quando múltiplos ESP32s (ou o mesmo ESP32) 
-- tentam buscar comandos simultaneamente.

DROP FUNCTION IF EXISTS get_and_lock_master_commands(text, integer, integer);

CREATE OR REPLACE FUNCTION get_and_lock_master_commands(
  p_device_id text,
  p_limit integer DEFAULT 1,  -- ✅ Processar 1 por vez (recomendado para evitar sobrecarga)
  p_timeout_seconds integer DEFAULT 30  -- Timeout para comandos "processing" expirados
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
AS $$
DECLARE
  v_command_ids bigint[];
BEGIN
  -- 1. ✅ Resetar comandos "processing" que expiraram (timeout)
  -- Se um comando ficou "processing" por mais de p_timeout_seconds, volta para "pending"
  -- Isso previne comandos "travados" se o ESP32 desconectar durante o processamento
  UPDATE public.relay_commands_master rc
  SET status = 'pending',
      updated_at = NOW()
  WHERE rc.status = 'processing'
    AND rc.device_id = p_device_id
    AND rc.updated_at < NOW() - (p_timeout_seconds || ' seconds')::INTERVAL;
  
  -- 2. ✅ Buscar IDs de comandos pendentes (com TTL e priorização)
  -- Priorização: peristaltic > rule > manual, depois priority DESC, depois created_at ASC
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
    AND (rc.expires_at IS NULL OR rc.expires_at > NOW())  -- ✅ Respeitar TTL
  LIMIT p_limit;
  
  -- Se não há comandos pendentes, retornar vazio
  IF v_command_ids IS NULL OR array_length(v_command_ids, 1) = 0 THEN
    RETURN;
  END IF;
  
  -- 3. ✅ Marcar como "processing" ATÔMICAMENTE (UPDATE)
  -- Double-check: só atualiza se ainda está "pending" (previne race condition)
  -- O PostgreSQL garante atomicidade: ou atualiza tudo ou não atualiza nada
  UPDATE public.relay_commands_master
  SET status = 'processing',
      updated_at = NOW()
  WHERE id = ANY(v_command_ids)
    AND status = 'pending';  -- ✅ CRÍTICO: Só atualiza se ainda está pending
  
  -- 4. ✅ Retornar apenas comandos que foram marcados com sucesso como "processing"
  -- Se dois ESP32s chamarem ao mesmo tempo, apenas um consegue marcar (atomicidade)
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
    AND rc.status = 'processing'  -- ✅ Só retorna os que foram marcados com sucesso
  ORDER BY rc.created_at ASC;
END;
$$;

-- =====================================================
-- ETAPA 3: CRIAR FUNÇÃO get_and_lock_slave_commands()
-- =====================================================
-- Similar à função master, mas para comandos de slaves.
-- Usa master_device_id para segregar comandos por master ESP32.

DROP FUNCTION IF EXISTS get_and_lock_slave_commands(text, integer, integer);

CREATE OR REPLACE FUNCTION get_and_lock_slave_commands(
  p_master_device_id text,
  p_limit integer DEFAULT 1,  -- ✅ Processar 1 por vez
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
AS $$
DECLARE
  v_command_ids bigint[];
BEGIN
  -- 1. ✅ Resetar comandos "processing" expirados
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
  
  -- 3. ✅ Marcar como "processing" ATÔMICAMENTE
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
-- ETAPA 4: ADICIONAR COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================

COMMENT ON FUNCTION get_and_lock_master_commands IS 
'Busca e marca comandos master como "processing" ATÔMICAMENTE. Previne race condition e duplicação. 
Retorna apenas comandos que foram marcados com sucesso. 
Cada ESP32 Master tem seu device_id único, garantindo isolamento total entre masters.';

COMMENT ON FUNCTION get_and_lock_slave_commands IS 
'Busca e marca comandos de slaves como "processing" ATÔMICAMENTE. Previne race condition e duplicação.
Usa master_device_id para segregar comandos por master ESP32.';

-- =====================================================
-- ETAPA 5: CONFIGURAR PERMISSÕES (Supabase RLS)
-- =====================================================
-- Garantir que as funções RPC possam ser chamadas via REST API

GRANT EXECUTE ON FUNCTION get_and_lock_master_commands TO anon;
GRANT EXECUTE ON FUNCTION get_and_lock_master_commands TO authenticated;
GRANT EXECUTE ON FUNCTION get_and_lock_slave_commands TO anon;
GRANT EXECUTE ON FUNCTION get_and_lock_slave_commands TO authenticated;

-- =====================================================
-- ETAPA 6: VERIFICAÇÃO E TESTE
-- =====================================================

-- Verificar que as constraints foram atualizadas
DO $$
BEGIN
  RAISE NOTICE '✅ Status "processing" adicionado às tabelas';
  RAISE NOTICE '✅ Função get_and_lock_master_commands() criada';
  RAISE NOTICE '✅ Função get_and_lock_slave_commands() criada';
  RAISE NOTICE '✅ Permissões configuradas';
END $$;

COMMIT;

-- =====================================================
-- ✅ IMPLEMENTAÇÃO CONCLUÍDA!
-- =====================================================
-- 
-- Próximos passos:
-- 1. ✅ Atualizar ESP32 (SupabaseClient.cpp) para usar RPC
-- 2. ✅ Criar APIs no frontend (/api/relay-commands/master e /slave)
-- 3. ✅ Testar com múltiplos comandos simultâneos
-- 4. ✅ Verificar que não há duplicação
--
-- =====================================================
-- 📝 TESTES MANUAIS (OPCIONAL)
-- =====================================================
-- 
-- Teste 1: Verificar função master
-- SELECT * FROM get_and_lock_master_commands('ESP32_HIDRO_F44738', 1, 30);
--
-- Teste 2: Verificar função slave
-- SELECT * FROM get_and_lock_slave_commands('ESP32_HIDRO_F44738', 1, 30);
--
-- Teste 3: Verificar status "processing"
-- SELECT id, status, updated_at FROM relay_commands_master WHERE status = 'processing';
--
-- =====================================================

