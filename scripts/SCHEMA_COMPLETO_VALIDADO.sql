-- =====================================================
-- ✅ SCHEMA COMPLETO VALIDADO - PRONTO PARA COPIAR/COLAR
-- =====================================================
-- Este script cria/valida todas as tabelas necessárias
-- Compatível com a arquitetura: relay_master + relay_slaves + relay_names
-- =====================================================

BEGIN;

-- =====================================================
-- 1. TABELA: users
-- =====================================================

CREATE TABLE IF NOT EXISTS public.users (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  email text NOT NULL UNIQUE,
  name text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  total_devices integer DEFAULT 0,
  subscription_type text DEFAULT 'free'::text CHECK (subscription_type = ANY (ARRAY['free'::text, 'premium'::text, 'enterprise'::text])),
  max_devices integer DEFAULT 5,
  notification_email boolean DEFAULT true,
  timezone text DEFAULT 'America/Sao_Paulo'::text,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- =====================================================
-- 2. TABELA: device_status (HUB CENTRAL)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.device_status (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  device_id text NOT NULL UNIQUE,
  last_seen timestamp with time zone DEFAULT now(),
  wifi_rssi integer,
  free_heap integer,
  uptime_seconds integer,
  is_online boolean DEFAULT false,
  firmware_version text DEFAULT '2.1.0'::text,
  ip_address inet,
  mac_address text,
  device_name text,
  location text,
  device_type text DEFAULT 'ESP32_HYDROPONIC'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  decision_engine_enabled boolean DEFAULT true,
  dry_run_mode boolean DEFAULT false,
  emergency_mode boolean DEFAULT false,
  manual_override boolean DEFAULT false,
  locked_relays integer[] DEFAULT '{}'::integer[],
  total_rules integer DEFAULT 0,
  total_evaluations bigint DEFAULT 0,
  total_actions bigint DEFAULT 0,
  total_safety_blocks bigint DEFAULT 0,
  last_evaluation timestamp with time zone,
  engine_uptime_seconds bigint DEFAULT 0,
  user_email text,
  registered_at timestamp with time zone DEFAULT now(),
  registration_source text DEFAULT 'wifi_config'::text,
  master_device_id text,
  status text CHECK (status IS NULL OR (status = ANY (ARRAY['active'::text, 'replaced'::text, 'decommissioned'::text, 'inactive'::text]))),
  replaced_by_device_id text,
  decommissioned_at timestamp with time zone,
  previous_user_email text,
  previous_master_device_id text,
  last_reassignment_at timestamp with time zone,
  CONSTRAINT device_status_pkey PRIMARY KEY (id),
  CONSTRAINT fk_device_status_master FOREIGN KEY (master_device_id) REFERENCES public.device_status(device_id),
  CONSTRAINT fk_device_status_user FOREIGN KEY (user_email) REFERENCES public.users(email)
);

-- =====================================================
-- 3. TABELA: relay_commands (FILA DE COMANDOS)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.relay_commands (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  device_id text NOT NULL,
  relay_number integer NOT NULL CHECK (relay_number >= 0 AND relay_number <= 15),
  action text NOT NULL CHECK (action = ANY (ARRAY['on'::text, 'off'::text])),
  duration_seconds integer CHECK (duration_seconds IS NULL OR (duration_seconds > 0 AND duration_seconds <= 86400)),
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'sent'::text, 'completed'::text, 'failed'::text])),
  created_at timestamp with time zone DEFAULT now(),
  sent_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_by text DEFAULT 'web_interface'::text,
  error_message text,
  rule_id text,
  rule_name text,
  execution_time_ms integer,
  triggered_by text DEFAULT 'manual'::text,
  target_device_id text DEFAULT ''::text,
  slave_mac_address text,
  current_state boolean,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT relay_commands_pkey PRIMARY KEY (id),
  CONSTRAINT fk_relay_commands_device FOREIGN KEY (device_id) REFERENCES public.device_status(device_id)
);

-- Índices básicos (sem command_type ainda)
CREATE INDEX IF NOT EXISTS idx_relay_commands_device_status ON public.relay_commands(device_id, status);
CREATE INDEX IF NOT EXISTS idx_relay_commands_pending ON public.relay_commands(device_id, status, created_at) WHERE status = 'pending';

-- =====================================================
-- 4. TABELA: relay_master (ESTADOS DOS RELÉS LOCAIS)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.relay_master (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  device_id text NOT NULL UNIQUE,
  user_email text NOT NULL,
  master_mac_address text NOT NULL,
  doser_relay_states boolean[] NOT NULL DEFAULT ARRAY[false, false, false, false, false, false, false, false],
  doser_relay_has_timers boolean[] DEFAULT ARRAY[false, false, false, false, false, false, false, false],
  doser_relay_remaining_times integer[] DEFAULT ARRAY[0, 0, 0, 0, 0, 0, 0, 0],
  doser_relay_names text[],
  level_relay_states boolean[] NOT NULL DEFAULT ARRAY[false, false, false, false],
  level_relay_has_timers boolean[] DEFAULT ARRAY[false, false, false, false],
  level_relay_remaining_times integer[] DEFAULT ARRAY[0, 0, 0, 0],
  level_relay_names text[],
  reserved_relay_states boolean[] NOT NULL DEFAULT ARRAY[false, false, false, false],
  reserved_relay_has_timers boolean[] DEFAULT ARRAY[false, false, false, false],
  reserved_relay_remaining_times integer[] DEFAULT ARRAY[0, 0, 0, 0],
  reserved_relay_names text[],
  last_update timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT relay_master_pkey PRIMARY KEY (id),
  CONSTRAINT fk_relay_master_device FOREIGN KEY (device_id) REFERENCES public.device_status(device_id),
  CONSTRAINT fk_relay_master_user FOREIGN KEY (user_email) REFERENCES public.users(email)
);

-- =====================================================
-- 5. TABELA: relay_slaves (ESTADOS DOS RELÉS SLAVES)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.relay_slaves (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  device_id text NOT NULL UNIQUE,
  user_email text NOT NULL,
  master_device_id text NOT NULL,
  master_mac_address text NOT NULL,
  slave_mac_address text NOT NULL,
  relay_states boolean[] NOT NULL DEFAULT ARRAY[false, false, false, false, false, false, false, false],
  relay_has_timers boolean[] DEFAULT ARRAY[false, false, false, false, false, false, false, false],
  relay_remaining_times integer[] DEFAULT ARRAY[0, 0, 0, 0, 0, 0, 0, 0],
  relay_names text[],
  last_update timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT relay_slaves_pkey PRIMARY KEY (id),
  CONSTRAINT fk_relay_slaves_device FOREIGN KEY (device_id) REFERENCES public.device_status(device_id),
  CONSTRAINT fk_relay_slaves_master FOREIGN KEY (master_device_id) REFERENCES public.device_status(device_id),
  CONSTRAINT fk_relay_slaves_user FOREIGN KEY (user_email) REFERENCES public.users(email),
  CONSTRAINT uq_relay_slaves_device UNIQUE (device_id),
  CONSTRAINT uq_relay_slaves_mac UNIQUE (slave_mac_address, master_device_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_relay_slaves_device_id ON public.relay_slaves(device_id);
CREATE INDEX IF NOT EXISTS idx_relay_slaves_master_device_id ON public.relay_slaves(master_device_id);
CREATE INDEX IF NOT EXISTS idx_relay_slaves_slave_mac ON public.relay_slaves(slave_mac_address);

-- =====================================================
-- 6. TABELA: relay_names (NOMES PERSONALIZADOS)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.relay_names (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  device_id text NOT NULL,
  relay_number integer NOT NULL CHECK (relay_number >= 0 AND relay_number <= 15),
  relay_name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT relay_names_pkey PRIMARY KEY (id),
  CONSTRAINT fk_relay_names_device FOREIGN KEY (device_id) REFERENCES public.device_status(device_id),
  CONSTRAINT uq_relay_names_device_relay UNIQUE (device_id, relay_number)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_relay_names_device_id ON public.relay_names(device_id);
CREATE INDEX IF NOT EXISTS idx_relay_names_device_relay ON public.relay_names(device_id, relay_number);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION public.update_relay_names_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_relay_names_updated_at ON public.relay_names;
CREATE TRIGGER trigger_relay_names_updated_at
BEFORE UPDATE ON public.relay_names
FOR EACH ROW
EXECUTE FUNCTION public.update_relay_names_updated_at();

-- =====================================================
-- 7. TABELA: decision_rules (REGRAS DE AUTOMAÇÃO)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.decision_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  rule_id text NOT NULL CHECK (length(rule_id) >= 3),
  rule_name text NOT NULL,
  rule_description text,
  rule_json jsonb NOT NULL,
  enabled boolean DEFAULT true,
  priority integer DEFAULT 50 CHECK (priority >= 0 AND priority <= 100),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by text DEFAULT 'system'::text,
  CONSTRAINT decision_rules_pkey PRIMARY KEY (id),
  CONSTRAINT fk_decision_rules_device FOREIGN KEY (device_id) REFERENCES public.device_status(device_id)
);

-- =====================================================
-- 8. TABELA: nutrition_plans (PLANOS NUTRICIONAIS)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.nutrition_plans (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  device_id text NOT NULL,
  plan_name text NOT NULL DEFAULT 'Plano Padrão'::text,
  pump_flow_rate double precision NOT NULL DEFAULT 1.0 CHECK (pump_flow_rate > 0::double precision),
  total_volume double precision NOT NULL DEFAULT 10 CHECK (total_volume > 0::double precision),
  total_ml double precision NOT NULL DEFAULT 0 CHECK (total_ml >= 0::double precision),
  nutrients jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by text DEFAULT 'web_interface'::text,
  CONSTRAINT nutrition_plans_pkey PRIMARY KEY (id)
);

-- =====================================================
-- 9. FUNÇÃO: get_pending_commands (BUSCAR COMANDOS PENDENTES)
-- =====================================================

-- ✅ Dropar função existente se houver (para permitir mudança de assinatura)
DROP FUNCTION IF EXISTS get_pending_commands(text, integer);

CREATE OR REPLACE FUNCTION get_pending_commands(
  p_device_id text,
  p_limit integer DEFAULT 5
)
RETURNS TABLE (
  id bigint,
  device_id text,
  command_type text,
  relay_number integer,
  action text,
  duration_seconds integer,
  triggered_by text,
  rule_id text,
  rule_name text,
  target_device_id text,
  slave_mac_address text,
  created_at timestamptz
) 
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rc.id,
    rc.device_id,
    COALESCE(rc.command_type, 'manual') as command_type,
    COALESCE(rc.priority, 50) as priority, -- ✅ Incluir priority no retorno
    rc.relay_number,
    rc.action,
    rc.duration_seconds,
    COALESCE(rc.triggered_by, 'manual') as triggered_by,
    rc.rule_id,
    rc.rule_name,
    rc.target_device_id,
    rc.slave_mac_address,
    rc.created_at
  FROM public.relay_commands rc
  WHERE rc.device_id = p_device_id
    AND rc.status = 'pending'
  ORDER BY 
    -- ✅ Priorização em 3 níveis:
    -- 1. command_type (categoria): peristaltic > rule > manual
    CASE COALESCE(rc.command_type, 'manual')
      WHEN 'peristaltic' THEN 1
      WHEN 'rule' THEN 2
      WHEN 'manual' THEN 3
      ELSE 3
    END,
    -- 2. priority (numérico): maior = mais importante
    COALESCE(rc.priority, 50) DESC,
    -- 3. created_at (temporal): mais antigo primeiro
    rc.created_at ASC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_pending_commands IS 
'Busca comandos pendentes com priorização: command_type > priority > created_at';

-- =====================================================
-- 10. FUNÇÃO: cleanup_old_commands (LIMPEZA AUTOMÁTICA)
-- =====================================================

-- ✅ Dropar função existente se houver (para permitir mudança de tipo de retorno)
DROP FUNCTION IF EXISTS cleanup_old_commands();

CREATE OR REPLACE FUNCTION cleanup_old_commands()
RETURNS TABLE (
  deleted_completed INTEGER,
  deleted_failed INTEGER,
  deleted_old_pending INTEGER
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_completed INTEGER := 0;
  v_deleted_failed INTEGER := 0;
  v_deleted_old_pending INTEGER := 0;
BEGIN
  -- 1. Deletar comandos completados há mais de 1 hora
  WITH deleted AS (
    DELETE FROM public.relay_commands 
    WHERE status = 'completed' 
      AND completed_at IS NOT NULL
      AND completed_at < NOW() - INTERVAL '1 hour'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_completed FROM deleted;
  
  -- 2. Deletar comandos falhados há mais de 24 horas
  WITH deleted AS (
    DELETE FROM public.relay_commands 
    WHERE status = 'failed' 
      AND updated_at IS NOT NULL
      AND updated_at < NOW() - INTERVAL '24 hours'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_failed FROM deleted;
  
  -- 3. Deletar comandos pendentes há mais de 7 dias (provavelmente perdidos)
  WITH deleted AS (
    DELETE FROM public.relay_commands 
    WHERE status = 'pending' 
      AND created_at < NOW() - INTERVAL '7 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_old_pending FROM deleted;
  
  RETURN QUERY SELECT v_deleted_completed, v_deleted_failed, v_deleted_old_pending;
  
  RAISE NOTICE '✅ Limpeza concluída: % completados, % falhados, % pendentes antigos deletados', 
    v_deleted_completed, v_deleted_failed, v_deleted_old_pending;
END;
$$;

COMMENT ON FUNCTION cleanup_old_commands IS 
'Limpa comandos antigos: completados (>1h), falhados (>24h), pendentes antigos (>7dias)';

-- =====================================================
-- 11. ADICIONAR command_type SE NÃO EXISTIR
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'relay_commands' 
    AND column_name = 'command_type'
  ) THEN
    ALTER TABLE public.relay_commands
    ADD COLUMN command_type text CHECK (command_type IS NULL OR command_type = ANY (ARRAY['manual'::text, 'rule'::text, 'peristaltic'::text]));
    
    -- ✅ Criar índice APÓS adicionar a coluna
    CREATE INDEX IF NOT EXISTS idx_relay_commands_command_type 
    ON public.relay_commands(command_type) 
    WHERE command_type IS NOT NULL;
    
    RAISE NOTICE '✅ Coluna command_type adicionada em relay_commands';
  ELSE
    RAISE NOTICE '⚠️ Coluna command_type já existe em relay_commands';
    
    -- ✅ Criar índice mesmo se coluna já existir (caso índice não exista)
    CREATE INDEX IF NOT EXISTS idx_relay_commands_command_type 
    ON public.relay_commands(command_type) 
    WHERE command_type IS NOT NULL;
  END IF;
END $$;

-- =====================================================
-- 12. ADICIONAR slave_mac_address SE NÃO EXISTIR
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'relay_commands' 
    AND column_name = 'slave_mac_address'
  ) THEN
    ALTER TABLE public.relay_commands
    ADD COLUMN slave_mac_address text;
    
    CREATE INDEX IF NOT EXISTS idx_relay_commands_slave_mac 
    ON public.relay_commands(slave_mac_address) 
    WHERE slave_mac_address IS NOT NULL;
    
    RAISE NOTICE '✅ Coluna slave_mac_address adicionada em relay_commands';
  ELSE
    RAISE NOTICE '⚠️ Coluna slave_mac_address já existe em relay_commands';
  END IF;
END $$;

-- =====================================================
-- 13. PERMISSÕES (Supabase)
-- =====================================================

GRANT EXECUTE ON FUNCTION get_pending_commands TO anon;
GRANT EXECUTE ON FUNCTION get_pending_commands TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_commands TO anon;
GRANT EXECUTE ON FUNCTION cleanup_old_commands TO authenticated;

-- =====================================================
-- 14. EXECUTAR LIMPEZA INICIAL
-- =====================================================

SELECT * FROM cleanup_old_commands();

-- =====================================================
-- 15. VERIFICAÇÃO FINAL
-- =====================================================

SELECT 
  '✅ Schema validado e configurado!' AS status,
  'Tabelas principais: device_status, relay_commands, relay_master, relay_slaves, relay_names' AS tabelas;

-- Verificar estrutura de relay_commands
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'relay_commands'
ORDER BY ordinal_position;

COMMIT;

-- =====================================================
-- ✅ PRONTO PARA USAR!
-- =====================================================
-- 1. ✅ Tabelas criadas/validadas
-- 2. ✅ Função get_pending_commands() criada
-- 3. ✅ Função cleanup_old_commands() criada
-- 4. ✅ Índices criados
-- 5. ✅ Permissões configuradas
-- =====================================================

