-- =====================================================
-- MIGRAÇÃO COMPLETA: relay_commands → relay_commands_master + relay_commands_slave
-- =====================================================
-- 
-- Este script:
-- 1. Cria as novas tabelas (relay_commands_master e relay_commands_slave)
-- 2. Migra dados existentes da tabela antiga
-- 3. Remove a tabela antiga relay_commands
-- 4. Cria funções SQL otimizadas
-- 5. Cria índices para performance
--
-- ⚠️ ATENÇÃO: Execute este script com cuidado!
-- Recomendado: Fazer backup antes de executar
--
-- =====================================================

BEGIN;

-- =====================================================
-- PASSO 1: CRIAR TABELA relay_commands_master
-- =====================================================

CREATE TABLE IF NOT EXISTS public.relay_commands_master (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  device_id text NOT NULL,
  user_email text NOT NULL,
  master_mac_address text NOT NULL,
  
  -- ✅ ARRAY de relés (permite múltiplos relés por comando)
  relay_numbers integer[] NOT NULL CHECK (array_length(relay_numbers, 1) > 0),
  actions text[] NOT NULL CHECK (
    array_length(actions, 1) = array_length(relay_numbers, 1) AND
    array_length(actions, 1) > 0
  ),
  duration_seconds integer[] DEFAULT ARRAY[]::integer[],
  
  command_type text DEFAULT 'manual' CHECK (command_type IN ('manual', 'rule', 'peristaltic')),
  priority integer DEFAULT 50 CHECK (priority >= 0 AND priority <= 100),
  
  triggered_by text DEFAULT 'manual',
  rule_id text,
  rule_name text,
  
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed', 'failed', 'expired')),
  
  -- ✅ TTL: Comando expira após X segundos (evita acumulação)
  expires_at timestamp with time zone,
  
  created_at timestamp with time zone DEFAULT now(),
  sent_at timestamp with time zone,
  completed_at timestamp with time zone,
  failed_at timestamp with time zone,
  
  error_message text,
  execution_time_ms integer,
  created_by text DEFAULT 'web_interface'::text,
  
  CONSTRAINT relay_commands_master_pkey PRIMARY KEY (id),
  CONSTRAINT fk_relay_commands_master_device FOREIGN KEY (device_id) REFERENCES public.device_status(device_id),
  CONSTRAINT fk_relay_commands_master_user FOREIGN KEY (user_email) REFERENCES public.users(email)
);

-- ✅ Índices para performance
CREATE INDEX IF NOT EXISTS idx_relay_commands_master_device_status 
  ON public.relay_commands_master(device_id, status) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_relay_commands_master_expires 
  ON public.relay_commands_master(expires_at) 
  WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_relay_commands_master_priority 
  ON public.relay_commands_master(priority DESC, created_at ASC) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_relay_commands_master_user 
  ON public.relay_commands_master(user_email, created_at DESC);

-- =====================================================
-- PASSO 2: CRIAR TABELA relay_commands_slave
-- =====================================================

CREATE TABLE IF NOT EXISTS public.relay_commands_slave (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  master_device_id text NOT NULL,
  user_email text NOT NULL,
  master_mac_address text NOT NULL,
  
  slave_device_id text NOT NULL,
  slave_mac_address text NOT NULL,
  
  -- ✅ ARRAY de relés (permite múltiplos relés por comando)
  relay_numbers integer[] NOT NULL CHECK (array_length(relay_numbers, 1) > 0),
  actions text[] NOT NULL CHECK (
    array_length(actions, 1) = array_length(relay_numbers, 1) AND
    array_length(actions, 1) > 0
  ),
  duration_seconds integer[] DEFAULT ARRAY[]::integer[],
  
  command_type text DEFAULT 'manual' CHECK (command_type IN ('manual', 'rule', 'peristaltic')),
  priority integer DEFAULT 50 CHECK (priority >= 0 AND priority <= 100),
  
  triggered_by text DEFAULT 'manual',
  rule_id text,
  rule_name text,
  
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed', 'failed', 'expired')),
  
  -- ✅ TTL: Comando expira após X segundos
  expires_at timestamp with time zone,
  
  created_at timestamp with time zone DEFAULT now(),
  sent_at timestamp with time zone,
  completed_at timestamp with time zone,
  failed_at timestamp with time zone,
  
  error_message text,
  execution_time_ms integer,
  created_by text DEFAULT 'web_interface'::text,
  
  CONSTRAINT relay_commands_slave_pkey PRIMARY KEY (id),
  CONSTRAINT fk_relay_commands_slave_master FOREIGN KEY (master_device_id) REFERENCES public.device_status(device_id),
  CONSTRAINT fk_relay_commands_slave_slave FOREIGN KEY (slave_device_id) REFERENCES public.device_status(device_id),
  CONSTRAINT fk_relay_commands_slave_user FOREIGN KEY (user_email) REFERENCES public.users(email)
);

-- ✅ Índices para performance
CREATE INDEX IF NOT EXISTS idx_relay_commands_slave_master_status 
  ON public.relay_commands_slave(master_device_id, status) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_relay_commands_slave_slave_status 
  ON public.relay_commands_slave(slave_device_id, status) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_relay_commands_slave_expires 
  ON public.relay_commands_slave(expires_at) 
  WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_relay_commands_slave_priority 
  ON public.relay_commands_slave(priority DESC, created_at ASC) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_relay_commands_slave_user 
  ON public.relay_commands_slave(user_email, created_at DESC);

-- =====================================================
-- PASSO 3: MIGRAR DADOS EXISTENTES (se houver)
-- =====================================================

-- Migrar comandos MASTER (slave_mac_address IS NULL ou vazio)
INSERT INTO public.relay_commands_master (
  device_id,
  user_email,
  master_mac_address,
  relay_numbers,
  actions,
  duration_seconds,
  command_type,
  priority,
  triggered_by,
  rule_id,
  rule_name,
  status,
  created_at,
  sent_at,
  completed_at,
  error_message,
  execution_time_ms,
  created_by
)
SELECT 
  rc.device_id,
  COALESCE(ds.user_email, 'system@migration.local') as user_email,
  COALESCE(ds.mac_address, '') as master_mac_address,
  ARRAY[rc.relay_number] as relay_numbers,  -- ✅ Converter para array
  ARRAY[rc.action] as actions,              -- ✅ Converter para array
  CASE 
    WHEN rc.duration_seconds IS NOT NULL THEN ARRAY[rc.duration_seconds]
    ELSE ARRAY[]::integer[]
  END as duration_seconds,
  COALESCE(rc.command_type, 'manual') as command_type,
  COALESCE(rc.priority, 50) as priority,
  COALESCE(rc.triggered_by, 'manual') as triggered_by,
  rc.rule_id,
  rc.rule_name,
  rc.status,
  rc.created_at,
  rc.sent_at,
  rc.completed_at,
  rc.error_message,
  rc.execution_time_ms,
  COALESCE(rc.created_by, 'web_interface') as created_by
FROM public.relay_commands rc
LEFT JOIN public.device_status ds ON rc.device_id = ds.device_id
WHERE (rc.slave_mac_address IS NULL OR rc.slave_mac_address = '' OR rc.slave_mac_address = 'null')
  AND rc.status IN ('pending', 'sent', 'completed', 'failed')
ON CONFLICT DO NOTHING;

-- Migrar comandos SLAVE (slave_mac_address IS NOT NULL)
-- ✅ CORREÇÃO: Gerar slave_device_id correto e verificar se existe em device_status
INSERT INTO public.relay_commands_slave (
  master_device_id,
  user_email,
  master_mac_address,
  slave_device_id,
  slave_mac_address,
  relay_numbers,
  actions,
  duration_seconds,
  command_type,
  priority,
  triggered_by,
  rule_id,
  rule_name,
  status,
  created_at,
  sent_at,
  completed_at,
  error_message,
  execution_time_ms,
  created_by
)
SELECT 
  rc.device_id as master_device_id,
  COALESCE(ds.user_email, 'system@migration.local') as user_email,
  COALESCE(ds.mac_address, '') as master_mac_address,
  -- ✅ CORREÇÃO: Gerar device_id do MAC address (formato padrão)
  'ESP32_SLAVE_' || REPLACE(rc.slave_mac_address, ':', '_') as slave_device_id,
  rc.slave_mac_address,
  ARRAY[rc.relay_number] as relay_numbers,  -- ✅ Converter para array
  ARRAY[rc.action] as actions,              -- ✅ Converter para array
  CASE 
    WHEN rc.duration_seconds IS NOT NULL THEN ARRAY[rc.duration_seconds]
    ELSE ARRAY[]::integer[]
  END as duration_seconds,
  COALESCE(rc.command_type, 'manual') as command_type,
  COALESCE(rc.priority, 50) as priority,
  COALESCE(rc.triggered_by, 'manual') as triggered_by,
  rc.rule_id,
  rc.rule_name,
  rc.status,
  rc.created_at,
  rc.sent_at,
  rc.completed_at,
  rc.error_message,
  rc.execution_time_ms,
  COALESCE(rc.created_by, 'web_interface') as created_by
FROM public.relay_commands rc
LEFT JOIN public.device_status ds ON rc.device_id = ds.device_id
WHERE rc.slave_mac_address IS NOT NULL 
  AND rc.slave_mac_address != '' 
  AND rc.slave_mac_address != 'null'
  AND rc.status IN ('pending', 'sent', 'completed', 'failed')
  -- ✅ CORREÇÃO: Verificar se o slave_device_id gerado existe em device_status
  AND EXISTS (
    SELECT 1 FROM public.device_status 
    WHERE device_id = 'ESP32_SLAVE_' || REPLACE(rc.slave_mac_address, ':', '_')
  )
ON CONFLICT DO NOTHING;

-- =====================================================
-- PASSO 4: CRIAR FUNÇÕES SQL
-- =====================================================

-- Função: get_pending_master_commands
DROP FUNCTION IF EXISTS get_pending_master_commands(text, integer);

CREATE OR REPLACE FUNCTION get_pending_master_commands(
  p_device_id text,
  p_limit integer DEFAULT 5
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
STABLE
AS $$
BEGIN
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
  WHERE rc.device_id = p_device_id
    AND rc.status = 'pending'
    AND (rc.expires_at IS NULL OR rc.expires_at > NOW())  -- ✅ TTL check
  ORDER BY 
    CASE COALESCE(rc.command_type, 'manual')
      WHEN 'peristaltic' THEN 1
      WHEN 'rule' THEN 2
      WHEN 'manual' THEN 3
    END,
    COALESCE(rc.priority, 50) DESC,
    rc.created_at ASC
  LIMIT p_limit;
END;
$$;

-- Função: get_pending_slave_commands
DROP FUNCTION IF EXISTS get_pending_slave_commands(text, integer);

CREATE OR REPLACE FUNCTION get_pending_slave_commands(
  p_master_device_id text,
  p_limit integer DEFAULT 5
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
STABLE
AS $$
BEGIN
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
  WHERE rc.master_device_id = p_master_device_id
    AND rc.status = 'pending'
    AND (rc.expires_at IS NULL OR rc.expires_at > NOW())  -- ✅ TTL check
  ORDER BY 
    CASE COALESCE(rc.command_type, 'manual')
      WHEN 'peristaltic' THEN 1
      WHEN 'rule' THEN 2
      WHEN 'manual' THEN 3
    END,
    COALESCE(rc.priority, 50) DESC,
    rc.created_at ASC
  LIMIT p_limit;
END;
$$;

-- Função: cleanup_expired_commands
DROP FUNCTION IF EXISTS cleanup_expired_commands();

CREATE OR REPLACE FUNCTION cleanup_expired_commands()
RETURNS TABLE (
  deleted_expired_master INTEGER,
  deleted_expired_slave INTEGER,
  deleted_completed_master INTEGER,
  deleted_completed_slave INTEGER,
  deleted_failed_master INTEGER,
  deleted_failed_slave INTEGER
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_expired_master INTEGER := 0;
  v_deleted_expired_slave INTEGER := 0;
  v_deleted_completed_master INTEGER := 0;
  v_deleted_completed_slave INTEGER := 0;
  v_deleted_failed_master INTEGER := 0;
  v_deleted_failed_slave INTEGER := 0;
BEGIN
  -- 1. Deletar comandos MASTER expirados (TTL)
  WITH deleted AS (
    DELETE FROM public.relay_commands_master 
    WHERE status = 'pending' 
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_expired_master FROM deleted;
  
  -- 2. Deletar comandos SLAVE expirados (TTL)
  WITH deleted AS (
    DELETE FROM public.relay_commands_slave 
    WHERE status = 'pending' 
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_expired_slave FROM deleted;
  
  -- 3. Deletar MASTER completados há mais de 1 hora
  WITH deleted AS (
    DELETE FROM public.relay_commands_master 
    WHERE status = 'completed' 
      AND completed_at < NOW() - INTERVAL '1 hour'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_completed_master FROM deleted;
  
  -- 4. Deletar SLAVE completados há mais de 1 hora
  WITH deleted AS (
    DELETE FROM public.relay_commands_slave 
    WHERE status = 'completed' 
      AND completed_at < NOW() - INTERVAL '1 hour'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_completed_slave FROM deleted;
  
  -- 5. Deletar MASTER falhados há mais de 24 horas
  WITH deleted AS (
    DELETE FROM public.relay_commands_master 
    WHERE status = 'failed' 
      AND failed_at < NOW() - INTERVAL '24 hours'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_failed_master FROM deleted;
  
  -- 6. Deletar SLAVE falhados há mais de 24 horas
  WITH deleted AS (
    DELETE FROM public.relay_commands_slave 
    WHERE status = 'failed' 
      AND failed_at < NOW() - INTERVAL '24 hours'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_failed_slave FROM deleted;
  
  RETURN QUERY SELECT 
    v_deleted_expired_master,
    v_deleted_expired_slave,
    v_deleted_completed_master,
    v_deleted_completed_slave,
    v_deleted_failed_master,
    v_deleted_failed_slave;
END;
$$;

-- Função: mark_expired_commands (marca como expired)
CREATE OR REPLACE FUNCTION mark_expired_commands()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Marcar MASTER expirados
  UPDATE public.relay_commands_master
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();
  
  -- Marcar SLAVE expirados
  UPDATE public.relay_commands_slave
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();
END;
$$;

-- =====================================================
-- PASSO 5: COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================

COMMENT ON TABLE public.relay_commands_master IS 
'Comandos para relés locais do Master (HydroControl). Suporta arrays de relés. Baseado em padrões Message Queue (RabbitMQ, AWS SQS).';

COMMENT ON TABLE public.relay_commands_slave IS 
'Comandos para relés de ESP-NOW Slaves. Suporta arrays de relés. Baseado em padrões Message Queue (RabbitMQ, AWS SQS).';

COMMENT ON FUNCTION get_pending_master_commands IS 
'Busca comandos pendentes do Master com priorização e TTL check. Retorna arrays de relés.';

COMMENT ON FUNCTION get_pending_slave_commands IS 
'Busca comandos pendentes para Slaves com priorização e TTL check. Retorna arrays de relés.';

COMMENT ON FUNCTION cleanup_expired_commands IS 
'Remove comandos expirados (TTL) e antigos (completed/failed). Executar periodicamente (ex: a cada hora).';

COMMENT ON FUNCTION mark_expired_commands IS 
'Marca comandos expirados como "expired". Executar periodicamente (ex: a cada 5 minutos).';

-- =====================================================
-- PASSO 6: REMOVER TABELA ANTIGA (CUIDADO!)
-- =====================================================

-- ⚠️ ATENÇÃO: Descomente apenas após verificar que a migração foi bem-sucedida!
-- ⚠️ Recomendado: Fazer backup antes de remover

-- Verificar se há dados nas novas tabelas antes de remover a antiga
DO $$
DECLARE
  v_master_count INTEGER;
  v_slave_count INTEGER;
  v_old_count INTEGER;
  v_old_slave_count INTEGER;
  v_migrated_slave_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_master_count FROM public.relay_commands_master;
  SELECT COUNT(*) INTO v_slave_count FROM public.relay_commands_slave;
  SELECT COUNT(*) INTO v_old_count FROM public.relay_commands;
  SELECT COUNT(*) INTO v_old_slave_count 
    FROM public.relay_commands 
    WHERE slave_mac_address IS NOT NULL 
      AND slave_mac_address != '' 
      AND slave_mac_address != 'null';
  
  RAISE NOTICE '✅ Migração concluída:';
  RAISE NOTICE '   - Comandos Master migrados: %', v_master_count;
  RAISE NOTICE '   - Comandos Slave migrados: %', v_slave_count;
  RAISE NOTICE '   - Comandos Slave na tabela antiga: %', v_old_slave_count;
  RAISE NOTICE '   - Comandos na tabela antiga (total): %', v_old_count;
  
  IF v_old_slave_count > v_slave_count THEN
    RAISE NOTICE '⚠️ ATENÇÃO: Alguns comandos Slave não foram migrados!';
    RAISE NOTICE '   Possível causa: slave_device_id não existe em device_status';
    RAISE NOTICE '   Verifique os comandos com:';
    RAISE NOTICE '   SELECT * FROM relay_commands WHERE slave_mac_address IS NOT NULL;';
  END IF;
  
  -- ⚠️ DESCOMENTE A LINHA ABAIXO APENAS APÓS VERIFICAR QUE TUDO ESTÁ OK!
  -- DROP TABLE IF EXISTS public.relay_commands CASCADE;
  
  RAISE NOTICE '⚠️ Tabela relay_commands ainda existe (comentada por segurança)';
  RAISE NOTICE '   Para remover, descomente: DROP TABLE IF EXISTS public.relay_commands CASCADE;';
END $$;

COMMIT;

-- =====================================================
-- ✅ MIGRAÇÃO CONCLUÍDA!
-- =====================================================
-- 
-- Próximos passos:
-- 1. Verificar se os dados foram migrados corretamente
-- 2. Testar as funções get_pending_*_commands
-- 3. Descomentar DROP TABLE relay_commands se tudo estiver OK
-- 4. Atualizar código frontend e ESP32 para usar novas tabelas
--
-- =====================================================

