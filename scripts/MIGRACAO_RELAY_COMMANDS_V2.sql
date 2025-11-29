-- =====================================================
-- MIGRAÇÃO: relay_commands → relay_commands_master + relay_commands_slave
-- =====================================================
-- 
-- Esta migração cria novas tabelas com suporte a:
-- - Arrays de relés (múltiplos relés por comando)
-- - Segregação Master/Slave
-- - TTL (Time To Live) para evitar acumulação
-- - Padrões de Message Queue da indústria
--
-- =====================================================

-- =====================================================
-- 1. CRIAR TABELA: relay_commands_master
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

-- =====================================================
-- 2. CRIAR TABELA: relay_commands_slave
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

-- =====================================================
-- 3. FUNÇÃO: get_pending_master_commands
-- =====================================================

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

-- =====================================================
-- 4. FUNÇÃO: get_pending_slave_commands
-- =====================================================

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

-- =====================================================
-- 5. FUNÇÃO: cleanup_expired_commands (TTL + Old)
-- =====================================================

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

-- =====================================================
-- 6. TRIGGER: Auto-expirar comandos (opcional)
-- =====================================================

-- Criar função para marcar comandos expirados
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
-- 7. COMENTÁRIOS
-- =====================================================

COMMENT ON TABLE public.relay_commands_master IS 
'Comandos para relés locais do Master (HydroControl). Suporta arrays de relés.';

COMMENT ON TABLE public.relay_commands_slave IS 
'Comandos para relés de ESP-NOW Slaves. Suporta arrays de relés.';

COMMENT ON FUNCTION get_pending_master_commands IS 
'Busca comandos pendentes do Master com priorização e TTL check.';

COMMENT ON FUNCTION get_pending_slave_commands IS 
'Busca comandos pendentes para Slaves com priorização e TTL check.';

COMMENT ON FUNCTION cleanup_expired_commands IS 
'Remove comandos expirados (TTL) e antigos (completed/failed). Executar periodicamente.';




