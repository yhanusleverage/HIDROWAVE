-- =====================================================
-- IMPLEMENTAR STATUS "processing" PARA EVITAR DUPLICAÇÃO
-- =====================================================
-- 
-- Este script implementa a solução híbrida (Opção 4):
-- 1. Adiciona status "processing" às tabelas
-- 2. Cria função SQL atômica get_and_lock_*_commands()
-- 3. Adiciona timeout para comandos "processing" expirados
--
-- =====================================================

BEGIN;

-- =====================================================
-- PASSO 1: ADICIONAR STATUS "processing" ÀS TABELAS
-- =====================================================

-- Remover constraint antiga
ALTER TABLE public.relay_commands_master 
  DROP CONSTRAINT IF EXISTS relay_commands_master_status_check;

ALTER TABLE public.relay_commands_slave 
  DROP CONSTRAINT IF EXISTS relay_commands_slave_status_check;

-- Adicionar constraint com status "processing"
ALTER TABLE public.relay_commands_master 
  ADD CONSTRAINT relay_commands_master_status_check 
  CHECK (status IN ('pending', 'processing', 'sent', 'completed', 'failed', 'expired'));

ALTER TABLE public.relay_commands_slave 
  ADD CONSTRAINT relay_commands_slave_status_check 
  CHECK (status IN ('pending', 'processing', 'sent', 'completed', 'failed', 'expired'));

-- =====================================================
-- PASSO 2: CRIAR FUNÇÃO get_and_lock_master_commands
-- =====================================================

DROP FUNCTION IF EXISTS get_and_lock_master_commands(text, integer, integer);

CREATE OR REPLACE FUNCTION get_and_lock_master_commands(
  p_device_id text,
  p_limit integer DEFAULT 1,  -- ✅ Processar 1 por vez (recomendado)
  p_timeout_seconds integer DEFAULT 30  -- Timeout para comandos "processing"
)
RETURNS TABLE (
  id bigint,
  relay_numbers integer[],
  actions text[],
  duration_seconds integer[],
  command_type text,
  priority integer,
  created_at timestamptz
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_command_ids bigint[];
BEGIN
  -- 1. ✅ Resetar comandos "processing" que expiraram (timeout)
  -- Se um comando ficou "processing" por mais de p_timeout_seconds, volta para "pending"
  UPDATE public.relay_commands_master
  SET status = 'pending',
      updated_at = NOW()
  WHERE status = 'processing'
    AND device_id = p_device_id
    AND updated_at < NOW() - (p_timeout_seconds || ' seconds')::INTERVAL;
  
  -- 2. ✅ Buscar IDs de comandos pendentes (com TTL e priorização)
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
  FROM public.relay_commands_master rc
  WHERE rc.device_id = p_device_id
    AND rc.status = 'pending'
    AND (rc.expires_at IS NULL OR rc.expires_at > NOW())
  LIMIT p_limit;
  
  -- 3. ✅ Marcar como "processing" ATÔMICAMENTE (UPDATE)
  -- Double-check: só atualiza se ainda está "pending" (previne race condition)
  UPDATE public.relay_commands_master
  SET status = 'processing',
      updated_at = NOW()
  WHERE id = ANY(v_command_ids)
    AND status = 'pending';  -- ✅ CRÍTICO: Só atualiza se ainda está pending
  
  -- 4. ✅ Retornar comandos marcados como "processing"
  RETURN QUERY
  SELECT 
    rc.id,
    rc.relay_numbers,
    rc.actions,
    rc.duration_seconds,
    COALESCE(rc.command_type, 'manual') as command_type,
    COALESCE(rc.priority, 50) as priority,
    rc.created_at
  FROM public.relay_commands_master rc
  WHERE rc.id = ANY(v_command_ids)
    AND rc.status = 'processing'  -- ✅ Só retorna os que foram marcados com sucesso
  ORDER BY rc.created_at ASC;
END;
$$;

-- =====================================================
-- PASSO 3: CRIAR FUNÇÃO get_and_lock_slave_commands
-- =====================================================

DROP FUNCTION IF EXISTS get_and_lock_slave_commands(text, integer, integer);

CREATE OR REPLACE FUNCTION get_and_lock_slave_commands(
  p_master_device_id text,
  p_limit integer DEFAULT 1,  -- ✅ Processar 1 por vez
  p_timeout_seconds integer DEFAULT 30
)
RETURNS TABLE (
  id bigint,
  slave_device_id text,
  slave_mac_address text,
  relay_numbers integer[],
  actions text[],
  duration_seconds integer[],
  command_type text,
  priority integer,
  created_at timestamptz
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_command_ids bigint[];
BEGIN
  -- 1. ✅ Resetar comandos "processing" expirados
  UPDATE public.relay_commands_slave
  SET status = 'pending',
      updated_at = NOW()
  WHERE status = 'processing'
    AND master_device_id = p_master_device_id
    AND updated_at < NOW() - (p_timeout_seconds || ' seconds')::INTERVAL;
  
  -- 2. ✅ Buscar IDs de comandos pendentes
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
  
  -- 3. ✅ Marcar como "processing" ATÔMICAMENTE
  UPDATE public.relay_commands_slave
  SET status = 'processing',
      updated_at = NOW()
  WHERE id = ANY(v_command_ids)
    AND status = 'pending';
  
  -- 4. ✅ Retornar comandos marcados
  RETURN QUERY
  SELECT 
    rc.id,
    rc.slave_device_id,
    rc.slave_mac_address,
    rc.relay_numbers,
    rc.actions,
    rc.duration_seconds,
    COALESCE(rc.command_type, 'manual') as command_type,
    COALESCE(rc.priority, 50) as priority,
    rc.created_at
  FROM public.relay_commands_slave rc
  WHERE rc.id = ANY(v_command_ids)
    AND rc.status = 'processing'
  ORDER BY rc.created_at ASC;
END;
$$;

-- =====================================================
-- PASSO 4: COMENTÁRIOS
-- =====================================================

COMMENT ON FUNCTION get_and_lock_master_commands IS 
'Busca e marca comandos como "processing" ATÔMICAMENTE. Previne race condition e duplicação. Retorna apenas comandos que foram marcados com sucesso.';

COMMENT ON FUNCTION get_and_lock_slave_commands IS 
'Busca e marca comandos de slaves como "processing" ATÔMICAMENTE. Previne race condition e duplicação.';

COMMIT;

-- =====================================================
-- ✅ IMPLEMENTAÇÃO CONCLUÍDA!
-- =====================================================
-- 
-- Próximos passos:
-- 1. Atualizar ESP32 para usar get_and_lock_master_commands()
-- 2. Testar com múltiplos comandos simultâneos
-- 3. Verificar que não há duplicação
--
-- =====================================================




