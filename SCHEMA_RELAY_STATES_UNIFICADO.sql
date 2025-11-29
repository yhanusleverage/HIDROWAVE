-- =====================================================
-- TABLA UNIFICADA: relay_states
-- =====================================================
-- Esta tabla unifica TODOS los estados de relés:
-- - Relés locales (bombas peristálticas) del Master
-- - Relés de Slaves ESP-NOW
-- 
-- VENTAJAS:
-- - Una sola fuente de verdad para todos los relés
-- - Consultas más simples
-- - Sin duplicación de lógica
-- - Escalable para futuros tipos de relés
-- - Permite descubrimiento de slaves via Supabase

-- =====================================================
-- 1. CREAR TABLA relay_states
-- =====================================================

CREATE TABLE IF NOT EXISTS public.relay_states (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  
  -- Identificación del dispositivo
  device_id TEXT NOT NULL,  -- Master device_id o Slave device_id
  
  -- Tipo de relé
  relay_type TEXT NOT NULL CHECK (relay_type IN ('local', 'slave')),
  -- 'local' = Relé local del Master (bombas peristálticas, PCF8574)
  -- 'slave' = Relé de Slave ESP-NOW
  
  -- Para slaves ESP-NOW: información del Master
  master_device_id TEXT,  -- NULL si es relé local, Master ID si es slave
  master_mac_address TEXT,  -- ✅ NOVO: MAC address del Master (para consultas rápidas)
  
  -- Para slaves ESP-NOW: MAC address
  slave_mac_address TEXT,  -- NULL si es relé local, MAC si es slave
  
  -- ✅ NOVO: Email do usuário (para filtros e descoberta)
  user_email TEXT,
  
  -- Número do relé
  relay_number INTEGER NOT NULL CHECK (relay_number >= 0 AND relay_number <= 15),
  -- 0-15 para relés locales (PCF8574)
  -- 0-7 para slaves ESP-NOW
  
  -- Estado do relé
  state BOOLEAN NOT NULL DEFAULT false,
  has_timer BOOLEAN DEFAULT false,
  remaining_time INTEGER DEFAULT 0,
  
  -- Nome personalizado do relé
  relay_name TEXT,
  
  -- Metadatos
  last_update TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT fk_relay_states_device FOREIGN KEY (device_id) REFERENCES public.device_status(device_id),
  CONSTRAINT fk_relay_states_master FOREIGN KEY (master_device_id) REFERENCES public.device_status(device_id),
  CONSTRAINT fk_relay_states_user FOREIGN KEY (user_email) REFERENCES public.users(email),
  
  -- Unique constraint: un relé por device_id + relay_number
  CONSTRAINT uq_relay_states_device_relay UNIQUE (device_id, relay_number)
);

-- =====================================================
-- 2. ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_relay_states_device 
ON public.relay_states(device_id);

CREATE INDEX IF NOT EXISTS idx_relay_states_master 
ON public.relay_states(master_device_id) WHERE master_device_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_relay_states_master_mac 
ON public.relay_states(master_mac_address) WHERE master_mac_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_relay_states_slave_mac 
ON public.relay_states(slave_mac_address) WHERE slave_mac_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_relay_states_type 
ON public.relay_states(relay_type);

CREATE INDEX IF NOT EXISTS idx_relay_states_user_email 
ON public.relay_states(user_email) WHERE user_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_relay_states_master_slave 
ON public.relay_states(master_device_id, slave_mac_address) WHERE master_device_id IS NOT NULL AND slave_mac_address IS NOT NULL;

-- =====================================================
-- 3. COMENTÁRIOS
-- =====================================================

COMMENT ON TABLE public.relay_states IS 
'Tabela unificada para estados de todos os relés (locais e slaves ESP-NOW). Fonte única de verdade. Permite descoberta de slaves via Supabase.';

COMMENT ON COLUMN public.relay_states.relay_type IS 
'Tipo de relé: "local" (bombas peristálticas do Master) ou "slave" (relés de Slaves ESP-NOW)';

COMMENT ON COLUMN public.relay_states.device_id IS 
'Device ID do dispositivo que possui o relé. Para slaves, é o slave_device_id. Para locais, é o master_device_id.';

COMMENT ON COLUMN public.relay_states.master_device_id IS 
'Device ID do Master. NULL para relés locais, preenchido para slaves ESP-NOW.';

COMMENT ON COLUMN public.relay_states.master_mac_address IS 
'MAC address do Master. NULL para relés locais, preenchido para slaves ESP-NOW. Facilita consultas sem JOIN.';

COMMENT ON COLUMN public.relay_states.slave_mac_address IS 
'MAC address do Slave. NULL para relés locais, preenchido para slaves ESP-NOW.';

COMMENT ON COLUMN public.relay_states.user_email IS 
'Email do usuário proprietário. Permite filtros rápidos e descoberta de slaves por usuário.';

-- =====================================================
-- 4. TRIGGER: Atualizar updated_at automaticamente
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_relay_states_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_relay_states_updated_at ON public.relay_states;

CREATE TRIGGER trigger_relay_states_updated_at
BEFORE UPDATE ON public.relay_states
FOR EACH ROW
EXECUTE FUNCTION public.update_relay_states_updated_at();

-- =====================================================
-- 5. MIGRACIÓN: Mover dados de slave_relay_states
-- =====================================================

INSERT INTO public.relay_states (
  device_id,
  relay_type,
  master_device_id,
  master_mac_address,
  slave_mac_address,
  user_email,
  relay_number,
  state,
  has_timer,
  remaining_time,
  relay_name,
  last_update,
  updated_at
)
SELECT 
  srs.slave_device_id AS device_id,
  'slave' AS relay_type,
  srs.master_device_id,
  ds.mac_address AS master_mac_address,  -- ✅ Buscar MAC do Master
  srs.slave_mac_address,
  ds.user_email,  -- ✅ Buscar email do Master
  srs.relay_number,
  srs.state,
  srs.has_timer,
  srs.remaining_time,
  srs.relay_name,
  srs.last_update,
  srs.updated_at
FROM public.slave_relay_states srs
LEFT JOIN public.device_status ds ON srs.master_device_id = ds.device_id
ON CONFLICT (device_id, relay_number) DO UPDATE SET
  state = EXCLUDED.state,
  has_timer = EXCLUDED.has_timer,
  remaining_time = EXCLUDED.remaining_time,
  relay_name = EXCLUDED.relay_name,
  master_mac_address = EXCLUDED.master_mac_address,
  user_email = EXCLUDED.user_email,
  last_update = EXCLUDED.last_update,
  updated_at = EXCLUDED.updated_at;

-- =====================================================
-- 6. MIGRACIÓN: Mover dados de device_status.relay_states
-- =====================================================

INSERT INTO public.relay_states (
  device_id,
  relay_type,
  master_device_id,
  master_mac_address,
  slave_mac_address,
  user_email,
  relay_number,
  state,
  has_timer,
  remaining_time,
  relay_name,
  last_update,
  updated_at
)
SELECT 
  ds.device_id,
  'local' AS relay_type,
  NULL AS master_device_id,
  ds.mac_address AS master_mac_address,  -- ✅ MAC do próprio Master
  NULL AS slave_mac_address,
  ds.user_email,  -- ✅ Email do Master
  rn.relay_number,
  ds.relay_states[rn.relay_number + 1] AS state,  -- PostgreSQL arrays são 1-indexed
  false AS has_timer,
  0 AS remaining_time,
  COALESCE(rn.relay_name, 'Relé ' || rn.relay_number) AS relay_name,
  ds.updated_at AS last_update,
  ds.updated_at
FROM public.device_status ds
CROSS JOIN LATERAL (
  SELECT 
    generate_series(0, 15) AS relay_number,
    NULL::TEXT AS relay_name
) rn
LEFT JOIN public.relay_names rn2 
  ON ds.device_id = rn2.device_id 
  AND rn.relay_number = rn2.relay_number
WHERE ds.relay_states IS NOT NULL
  AND array_length(ds.relay_states, 1) >= rn.relay_number + 1
  AND ds.device_type = 'ESP32_HYDROPONIC'  -- Apenas Masters
ON CONFLICT (device_id, relay_number) DO UPDATE SET
  state = EXCLUDED.state,
  master_mac_address = EXCLUDED.master_mac_address,
  user_email = EXCLUDED.user_email,
  updated_at = EXCLUDED.updated_at;

-- =====================================================
-- 7. VIEW: relay_states_with_names
-- =====================================================
-- View para facilitar consultas com nomes de relés

CREATE OR REPLACE VIEW public.relay_states_with_names AS
SELECT 
  rs.*,
  COALESCE(rn.relay_name, rs.relay_name, 'Relé ' || rs.relay_number) AS display_name
FROM public.relay_states rs
LEFT JOIN public.relay_names rn 
  ON rs.device_id = rn.device_id 
  AND rs.relay_number = rn.relay_number;

-- =====================================================
-- 8. VIEW: slaves_discovery
-- =====================================================
-- ✅ NOVO: View para descoberta de slaves via Supabase
-- Permite descobrir slaves sem precisar acessar ESP32 diretamente

CREATE OR REPLACE VIEW public.slaves_discovery AS
SELECT DISTINCT
  rs.device_id AS slave_device_id,
  rs.slave_mac_address,
  ds.device_name AS slave_name,
  ds.device_type,
  rs.master_device_id,
  rs.master_mac_address,
  rs.user_email,
  ds.is_online,
  ds.last_seen,
  ds.mac_address AS slave_device_mac,
  COUNT(DISTINCT rs.relay_number) AS total_relays,
  COUNT(DISTINCT CASE WHEN rs.state = true THEN rs.relay_number END) AS active_relays,
  MAX(rs.last_update) AS last_relay_update
FROM public.relay_states rs
LEFT JOIN public.device_status ds ON rs.device_id = ds.device_id
WHERE rs.relay_type = 'slave'
  AND rs.slave_mac_address IS NOT NULL
GROUP BY 
  rs.device_id,
  rs.slave_mac_address,
  ds.device_name,
  ds.device_type,
  rs.master_device_id,
  rs.master_mac_address,
  rs.user_email,
  ds.is_online,
  ds.last_seen,
  ds.mac_address;

COMMENT ON VIEW public.slaves_discovery IS 
'View para descoberta de slaves ESP-NOW via Supabase. Agrupa informações de relay_states e device_status.';

-- =====================================================
-- 9. FUNÇÃO: Atualizar user_email automaticamente
-- =====================================================
-- ✅ NOVO: Trigger para atualizar user_email quando Master muda de usuário

CREATE OR REPLACE FUNCTION public.sync_relay_states_user_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o Master mudou de user_email, atualizar todos os relay_states relacionados
  IF OLD.user_email IS DISTINCT FROM NEW.user_email THEN
    UPDATE public.relay_states
    SET user_email = NEW.user_email
    WHERE master_device_id = NEW.device_id
      AND relay_type = 'slave';
    
    -- Atualizar também relés locais do Master
    UPDATE public.relay_states
    SET user_email = NEW.user_email
    WHERE device_id = NEW.device_id
      AND relay_type = 'local';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_relay_states_user_email ON public.device_status;

CREATE TRIGGER trigger_sync_relay_states_user_email
AFTER UPDATE OF user_email ON public.device_status
FOR EACH ROW
WHEN (OLD.user_email IS DISTINCT FROM NEW.user_email)
EXECUTE FUNCTION public.sync_relay_states_user_email();

-- =====================================================
-- 10. FUNÇÃO: Atualizar master_mac_address automaticamente
-- =====================================================
-- ✅ NOVO: Trigger para atualizar master_mac_address quando Master muda de MAC

CREATE OR REPLACE FUNCTION public.sync_relay_states_master_mac()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o Master mudou de mac_address, atualizar todos os relay_states relacionados
  IF OLD.mac_address IS DISTINCT FROM NEW.mac_address THEN
    UPDATE public.relay_states
    SET master_mac_address = NEW.mac_address
    WHERE master_device_id = NEW.device_id
      AND relay_type = 'slave';
    
    -- Atualizar também relés locais do Master
    UPDATE public.relay_states
    SET master_mac_address = NEW.mac_address
    WHERE device_id = NEW.device_id
      AND relay_type = 'local';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_relay_states_master_mac ON public.device_status;

CREATE TRIGGER trigger_sync_relay_states_master_mac
AFTER UPDATE OF mac_address ON public.device_status
FOR EACH ROW
WHEN (OLD.mac_address IS DISTINCT FROM NEW.mac_address)
EXECUTE FUNCTION public.sync_relay_states_master_mac();

-- =====================================================
-- FIM DO SCRIPT
-- =====================================================
-- 
-- NOTAS:
-- 1. Este script pode ser executado diretamente no Supabase SQL Editor
-- 2. A tabela slave_relay_states pode ser mantida por compatibilidade
-- 3. Após 30 dias, pode ser removida com: DROP TABLE IF EXISTS public.slave_relay_states;
-- 4. A view slaves_discovery permite descobrir slaves sem acessar ESP32 diretamente
-- 5. Triggers automáticos mantêm user_email e master_mac_address sincronizados
--
