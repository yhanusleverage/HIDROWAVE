-- =====================================================
-- SCRIPT COMPLETO: relay_master + relay_slaves (ARRAYS)
-- =====================================================
-- Segregação em alto nível:
-- - PCF8574 #1: Relés dosadores (0-7) - Bombas peristálticas
-- - PCF8574 #2: Relés de nível (8-11) - 4 levers modul para captação de nível
-- - Relés reservados (12-15) - Para uso futuro
-- =====================================================
-- COPIAR E COLAR ESTE SCRIPT NO SQL EDITOR DO SUPABASE
-- =====================================================

-- =====================================================
-- 1. TABELA relay_master (Relés Locais do Master)
-- =====================================================
-- Estrutura: 1 linha por master device
-- Arrays segregados por função (alto nível)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.relay_master (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_id TEXT NOT NULL UNIQUE,
  user_email TEXT NOT NULL,
  master_mac_address TEXT NOT NULL,
  
  -- ✅ PCF8574 #1: RELÉS DOSADORES (0-7) - Bombas peristálticas
  doser_relay_states BOOLEAN[] NOT NULL DEFAULT ARRAY[false, false, false, false, false, false, false, false],
  doser_relay_has_timers BOOLEAN[] DEFAULT ARRAY[false, false, false, false, false, false, false, false],
  doser_relay_remaining_times INTEGER[] DEFAULT ARRAY[0, 0, 0, 0, 0, 0, 0, 0],
  doser_relay_names TEXT[],
  
  -- ✅ PCF8574 #2: RELÉS DE NÍVEL (8-11) - 4 levers modul para captação de nível
  level_relay_states BOOLEAN[] NOT NULL DEFAULT ARRAY[false, false, false, false],
  level_relay_has_timers BOOLEAN[] DEFAULT ARRAY[false, false, false, false],
  level_relay_remaining_times INTEGER[] DEFAULT ARRAY[0, 0, 0, 0],
  level_relay_names TEXT[],
  
  -- ✅ RELÉS RESERVADOS (12-15) - Para uso futuro
  reserved_relay_states BOOLEAN[] NOT NULL DEFAULT ARRAY[false, false, false, false],
  reserved_relay_has_timers BOOLEAN[] DEFAULT ARRAY[false, false, false, false],
  reserved_relay_remaining_times INTEGER[] DEFAULT ARRAY[0, 0, 0, 0],
  reserved_relay_names TEXT[],
  
  last_update TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fk_relay_master_device FOREIGN KEY (device_id) REFERENCES public.device_status(device_id),
  CONSTRAINT fk_relay_master_user FOREIGN KEY (user_email) REFERENCES public.users(email)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_relay_master_device_id ON public.relay_master(device_id);
CREATE INDEX IF NOT EXISTS idx_relay_master_user_email ON public.relay_master(user_email);
CREATE INDEX IF NOT EXISTS idx_relay_master_mac ON public.relay_master(master_mac_address);

-- =====================================================
-- 2. TABELA relay_slaves (Relés dos Slaves)
-- =====================================================
-- Estrutura: 1 linha por slave device
-- Arrays: relay_states, relay_timers, relay_remaining_times, relay_names
-- =====================================================

CREATE TABLE IF NOT EXISTS public.relay_slaves (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_id TEXT NOT NULL UNIQUE,
  user_email TEXT NOT NULL,
  master_device_id TEXT NOT NULL,
  master_mac_address TEXT NOT NULL,
  slave_mac_address TEXT NOT NULL,
  
  -- ✅ Arrays para estados dos relés (8 relés)
  relay_states BOOLEAN[] NOT NULL DEFAULT ARRAY[false, false, false, false, false, false, false, false],
  relay_has_timers BOOLEAN[] DEFAULT ARRAY[false, false, false, false, false, false, false, false],
  relay_remaining_times INTEGER[] DEFAULT ARRAY[0, 0, 0, 0, 0, 0, 0, 0],
  relay_names TEXT[],
  
  last_update TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fk_relay_slaves_device FOREIGN KEY (device_id) REFERENCES public.device_status(device_id),
  CONSTRAINT fk_relay_slaves_master FOREIGN KEY (master_device_id) REFERENCES public.device_status(device_id),
  CONSTRAINT fk_relay_slaves_user FOREIGN KEY (user_email) REFERENCES public.users(email),
  CONSTRAINT uq_relay_slaves_device UNIQUE (device_id),
  CONSTRAINT uq_relay_slaves_mac UNIQUE (slave_mac_address, master_device_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_relay_slaves_device_id ON public.relay_slaves(device_id);
CREATE INDEX IF NOT EXISTS idx_relay_slaves_user_email ON public.relay_slaves(user_email);
CREATE INDEX IF NOT EXISTS idx_relay_slaves_master_device_id ON public.relay_slaves(master_device_id);
CREATE INDEX IF NOT EXISTS idx_relay_slaves_master_mac ON public.relay_slaves(master_mac_address);
CREATE INDEX IF NOT EXISTS idx_relay_slaves_slave_mac ON public.relay_slaves(slave_mac_address);

-- =====================================================
-- 3. TRIGGERS para updated_at automático
-- =====================================================

-- Trigger para relay_master
CREATE OR REPLACE FUNCTION update_relay_master_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_relay_master_updated_at ON public.relay_master;
CREATE TRIGGER trigger_relay_master_updated_at
  BEFORE UPDATE ON public.relay_master
  FOR EACH ROW
  EXECUTE FUNCTION update_relay_master_updated_at();

-- Trigger para relay_slaves
CREATE OR REPLACE FUNCTION update_relay_slaves_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_relay_slaves_updated_at ON public.relay_slaves;
CREATE TRIGGER trigger_relay_slaves_updated_at
  BEFORE UPDATE ON public.relay_slaves
  FOR EACH ROW
  EXECUTE FUNCTION update_relay_slaves_updated_at();

-- =====================================================
-- 4. TRIGGERS para sincronizar user_email e MAC
-- =====================================================

-- Trigger para relay_master
CREATE OR REPLACE FUNCTION sync_relay_master_from_device_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_email IS NULL OR NEW.master_mac_address IS NULL THEN
    SELECT 
      COALESCE(NEW.user_email, ds.user_email),
      COALESCE(NEW.master_mac_address, ds.mac_address)
    INTO NEW.user_email, NEW.master_mac_address
    FROM public.device_status ds
    WHERE ds.device_id = NEW.device_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_relay_master ON public.relay_master;
CREATE TRIGGER trigger_sync_relay_master
  BEFORE INSERT OR UPDATE ON public.relay_master
  FOR EACH ROW
  EXECUTE FUNCTION sync_relay_master_from_device_status();

-- Trigger para relay_slaves
CREATE OR REPLACE FUNCTION sync_relay_slaves_from_device_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_email IS NULL THEN
    SELECT ds.user_email
    INTO NEW.user_email
    FROM public.device_status ds
    WHERE ds.device_id = NEW.device_id;
  END IF;
  
  IF NEW.master_mac_address IS NULL AND NEW.master_device_id IS NOT NULL THEN
    SELECT ds.mac_address
    INTO NEW.master_mac_address
    FROM public.device_status ds
    WHERE ds.device_id = NEW.master_device_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_relay_slaves ON public.relay_slaves;
CREATE TRIGGER trigger_sync_relay_slaves
  BEFORE INSERT OR UPDATE ON public.relay_slaves
  FOR EACH ROW
  EXECUTE FUNCTION sync_relay_slaves_from_device_status();

-- =====================================================
-- 5. VIEWS para facilitar consultas (Alto Nível)
-- =====================================================

-- View: Apenas relés dosadores (PCF8574 #1)
CREATE OR REPLACE VIEW public.relay_master_dosers AS
SELECT 
  device_id,
  user_email,
  master_mac_address,
  doser_relay_states,
  doser_relay_has_timers,
  doser_relay_remaining_times,
  doser_relay_names,
  last_update,
  updated_at
FROM public.relay_master;

-- View: Apenas relés de nível (PCF8574 #2)
CREATE OR REPLACE VIEW public.relay_master_levels AS
SELECT 
  device_id,
  user_email,
  master_mac_address,
  level_relay_states,
  level_relay_has_timers,
  level_relay_remaining_times,
  level_relay_names,
  last_update,
  updated_at
FROM public.relay_master;

-- View: Todos os relés (com tipo)
CREATE OR REPLACE VIEW public.relay_master_all AS
SELECT 
  device_id,
  user_email,
  master_mac_address,
  doser_relay_states,
  level_relay_states,
  reserved_relay_states,
  last_update,
  updated_at
FROM public.relay_master;

-- =====================================================
-- 6. MIGRAÇÃO: relay_states → relay_master + relay_slaves
-- =====================================================

-- 6.1. Migrar relés locais (dosadores + níveis + reservados) para relay_master
INSERT INTO public.relay_master (
  device_id,
  user_email,
  master_mac_address,
  doser_relay_states,
  doser_relay_has_timers,
  doser_relay_remaining_times,
  doser_relay_names,
  level_relay_states,
  level_relay_has_timers,
  level_relay_remaining_times,
  level_relay_names,
  reserved_relay_states,
  reserved_relay_has_timers,
  reserved_relay_remaining_times,
  reserved_relay_names,
  last_update,
  updated_at
)
SELECT 
  rs.device_id,
  COALESCE(rs.user_email, ds.user_email) AS user_email,
  COALESCE(rs.master_mac_address, ds.mac_address) AS master_mac_address,
  
  -- ✅ PCF8574 #1: Dosadores (0-7)
  ARRAY[
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 0 THEN rs.state END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 1 THEN rs.state END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 2 THEN rs.state END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 3 THEN rs.state END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 4 THEN rs.state END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 5 THEN rs.state END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 6 THEN rs.state END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 7 THEN rs.state END), false)
  ] AS doser_relay_states,
  
  ARRAY[
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 0 THEN rs.has_timer END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 1 THEN rs.has_timer END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 2 THEN rs.has_timer END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 3 THEN rs.has_timer END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 4 THEN rs.has_timer END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 5 THEN rs.has_timer END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 6 THEN rs.has_timer END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 7 THEN rs.has_timer END), false)
  ] AS doser_relay_has_timers,
  
  ARRAY[
    MAX(CASE WHEN rs.relay_number = 0 THEN rs.remaining_time ELSE 0 END),
    MAX(CASE WHEN rs.relay_number = 1 THEN rs.remaining_time ELSE 0 END),
    MAX(CASE WHEN rs.relay_number = 2 THEN rs.remaining_time ELSE 0 END),
    MAX(CASE WHEN rs.relay_number = 3 THEN rs.remaining_time ELSE 0 END),
    MAX(CASE WHEN rs.relay_number = 4 THEN rs.remaining_time ELSE 0 END),
    MAX(CASE WHEN rs.relay_number = 5 THEN rs.remaining_time ELSE 0 END),
    MAX(CASE WHEN rs.relay_number = 6 THEN rs.remaining_time ELSE 0 END),
    MAX(CASE WHEN rs.relay_number = 7 THEN rs.remaining_time ELSE 0 END)
  ] AS doser_relay_remaining_times,
  
  ARRAY[
    MAX(CASE WHEN rs.relay_number = 0 THEN rs.relay_name END),
    MAX(CASE WHEN rs.relay_number = 1 THEN rs.relay_name END),
    MAX(CASE WHEN rs.relay_number = 2 THEN rs.relay_name END),
    MAX(CASE WHEN rs.relay_number = 3 THEN rs.relay_name END),
    MAX(CASE WHEN rs.relay_number = 4 THEN rs.relay_name END),
    MAX(CASE WHEN rs.relay_number = 5 THEN rs.relay_name END),
    MAX(CASE WHEN rs.relay_number = 6 THEN rs.relay_name END),
    MAX(CASE WHEN rs.relay_number = 7 THEN rs.relay_name END)
  ] AS doser_relay_names,
  
  -- ✅ PCF8574 #2: Níveis (8-11)
  ARRAY[
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 8 THEN rs.state END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 9 THEN rs.state END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 10 THEN rs.state END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 11 THEN rs.state END), false)
  ] AS level_relay_states,
  
  ARRAY[
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 8 THEN rs.has_timer END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 9 THEN rs.has_timer END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 10 THEN rs.has_timer END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 11 THEN rs.has_timer END), false)
  ] AS level_relay_has_timers,
  
  ARRAY[
    MAX(CASE WHEN rs.relay_number = 8 THEN rs.remaining_time ELSE 0 END),
    MAX(CASE WHEN rs.relay_number = 9 THEN rs.remaining_time ELSE 0 END),
    MAX(CASE WHEN rs.relay_number = 10 THEN rs.remaining_time ELSE 0 END),
    MAX(CASE WHEN rs.relay_number = 11 THEN rs.remaining_time ELSE 0 END)
  ] AS level_relay_remaining_times,
  
  ARRAY[
    MAX(CASE WHEN rs.relay_number = 8 THEN rs.relay_name END),
    MAX(CASE WHEN rs.relay_number = 9 THEN rs.relay_name END),
    MAX(CASE WHEN rs.relay_number = 10 THEN rs.relay_name END),
    MAX(CASE WHEN rs.relay_number = 11 THEN rs.relay_name END)
  ] AS level_relay_names,
  
  -- ✅ Reservados (12-15)
  ARRAY[
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 12 THEN rs.state END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 13 THEN rs.state END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 14 THEN rs.state END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 15 THEN rs.state END), false)
  ] AS reserved_relay_states,
  
  ARRAY[
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 12 THEN rs.has_timer END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 13 THEN rs.has_timer END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 14 THEN rs.has_timer END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 15 THEN rs.has_timer END), false)
  ] AS reserved_relay_has_timers,
  
  ARRAY[
    MAX(CASE WHEN rs.relay_number = 12 THEN rs.remaining_time ELSE 0 END),
    MAX(CASE WHEN rs.relay_number = 13 THEN rs.remaining_time ELSE 0 END),
    MAX(CASE WHEN rs.relay_number = 14 THEN rs.remaining_time ELSE 0 END),
    MAX(CASE WHEN rs.relay_number = 15 THEN rs.remaining_time ELSE 0 END)
  ] AS reserved_relay_remaining_times,
  
  ARRAY[
    MAX(CASE WHEN rs.relay_number = 12 THEN rs.relay_name END),
    MAX(CASE WHEN rs.relay_number = 13 THEN rs.relay_name END),
    MAX(CASE WHEN rs.relay_number = 14 THEN rs.relay_name END),
    MAX(CASE WHEN rs.relay_number = 15 THEN rs.relay_name END)
  ] AS reserved_relay_names,
  
  MAX(rs.last_update) AS last_update,
  MAX(rs.updated_at) AS updated_at

FROM public.relay_states rs
LEFT JOIN public.device_status ds ON rs.device_id = ds.device_id
WHERE rs.relay_type = 'local'
GROUP BY rs.device_id, COALESCE(rs.user_email, ds.user_email), COALESCE(rs.master_mac_address, ds.mac_address)
ON CONFLICT (device_id) DO UPDATE SET
  user_email = EXCLUDED.user_email,
  master_mac_address = EXCLUDED.master_mac_address,
  doser_relay_states = EXCLUDED.doser_relay_states,
  doser_relay_has_timers = EXCLUDED.doser_relay_has_timers,
  doser_relay_remaining_times = EXCLUDED.doser_relay_remaining_times,
  doser_relay_names = EXCLUDED.doser_relay_names,
  level_relay_states = EXCLUDED.level_relay_states,
  level_relay_has_timers = EXCLUDED.level_relay_has_timers,
  level_relay_remaining_times = EXCLUDED.level_relay_remaining_times,
  level_relay_names = EXCLUDED.level_relay_names,
  reserved_relay_states = EXCLUDED.reserved_relay_states,
  reserved_relay_has_timers = EXCLUDED.reserved_relay_has_timers,
  reserved_relay_remaining_times = EXCLUDED.reserved_relay_remaining_times,
  reserved_relay_names = EXCLUDED.reserved_relay_names,
  updated_at = NOW();

-- 6.2. Migrar relés de slaves para relay_slaves
INSERT INTO public.relay_slaves (
  device_id,
  user_email,
  master_device_id,
  master_mac_address,
  slave_mac_address,
  relay_states,
  relay_has_timers,
  relay_remaining_times,
  relay_names,
  last_update,
  updated_at
)
SELECT 
  rs.device_id,
  COALESCE(rs.user_email, ds.user_email) AS user_email,
  rs.master_device_id,
  COALESCE(rs.master_mac_address, master_ds.mac_address) AS master_mac_address,
  COALESCE(rs.slave_mac_address, ds.mac_address) AS slave_mac_address,
  
  ARRAY[
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 0 THEN rs.state END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 1 THEN rs.state END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 2 THEN rs.state END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 3 THEN rs.state END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 4 THEN rs.state END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 5 THEN rs.state END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 6 THEN rs.state END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 7 THEN rs.state END), false)
  ] AS relay_states,
  
  ARRAY[
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 0 THEN rs.has_timer END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 1 THEN rs.has_timer END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 2 THEN rs.has_timer END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 3 THEN rs.has_timer END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 4 THEN rs.has_timer END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 5 THEN rs.has_timer END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 6 THEN rs.has_timer END), false),
    COALESCE(BOOL_OR(CASE WHEN rs.relay_number = 7 THEN rs.has_timer END), false)
  ] AS relay_has_timers,
  
  ARRAY[
    MAX(CASE WHEN rs.relay_number = 0 THEN rs.remaining_time ELSE 0 END),
    MAX(CASE WHEN rs.relay_number = 1 THEN rs.remaining_time ELSE 0 END),
    MAX(CASE WHEN rs.relay_number = 2 THEN rs.remaining_time ELSE 0 END),
    MAX(CASE WHEN rs.relay_number = 3 THEN rs.remaining_time ELSE 0 END),
    MAX(CASE WHEN rs.relay_number = 4 THEN rs.remaining_time ELSE 0 END),
    MAX(CASE WHEN rs.relay_number = 5 THEN rs.remaining_time ELSE 0 END),
    MAX(CASE WHEN rs.relay_number = 6 THEN rs.remaining_time ELSE 0 END),
    MAX(CASE WHEN rs.relay_number = 7 THEN rs.remaining_time ELSE 0 END)
  ] AS relay_remaining_times,
  
  ARRAY[
    MAX(CASE WHEN rs.relay_number = 0 THEN rs.relay_name END),
    MAX(CASE WHEN rs.relay_number = 1 THEN rs.relay_name END),
    MAX(CASE WHEN rs.relay_number = 2 THEN rs.relay_name END),
    MAX(CASE WHEN rs.relay_number = 3 THEN rs.relay_name END),
    MAX(CASE WHEN rs.relay_number = 4 THEN rs.relay_name END),
    MAX(CASE WHEN rs.relay_number = 5 THEN rs.relay_name END),
    MAX(CASE WHEN rs.relay_number = 6 THEN rs.relay_name END),
    MAX(CASE WHEN rs.relay_number = 7 THEN rs.relay_name END)
  ] AS relay_names,
  
  MAX(rs.last_update) AS last_update,
  MAX(rs.updated_at) AS updated_at

FROM public.relay_states rs
LEFT JOIN public.device_status ds ON rs.device_id = ds.device_id
LEFT JOIN public.device_status master_ds ON rs.master_device_id = master_ds.device_id
WHERE rs.relay_type = 'slave'
GROUP BY 
  rs.device_id,
  COALESCE(rs.user_email, ds.user_email),
  rs.master_device_id,
  COALESCE(rs.master_mac_address, master_ds.mac_address),
  COALESCE(rs.slave_mac_address, ds.mac_address)
ON CONFLICT (device_id) DO UPDATE SET
  user_email = EXCLUDED.user_email,
  master_device_id = EXCLUDED.master_device_id,
  master_mac_address = EXCLUDED.master_mac_address,
  slave_mac_address = EXCLUDED.slave_mac_address,
  relay_states = EXCLUDED.relay_states,
  relay_has_timers = EXCLUDED.relay_has_timers,
  relay_remaining_times = EXCLUDED.relay_remaining_times,
  relay_names = EXCLUDED.relay_names,
  updated_at = NOW();

-- =====================================================
-- 7. COMENTÁRIOS (Documentação)
-- =====================================================

COMMENT ON TABLE public.relay_master IS 'Estados dos relés locais do Master segregados por função (alto nível) - Arrays';
COMMENT ON TABLE public.relay_slaves IS 'Estados dos relés dos Slaves (1 linha por device, 8 relés) - Arrays';

COMMENT ON COLUMN public.relay_master.device_id IS 'ID do dispositivo Master (ESP32_HIDRO_XXXXX)';
COMMENT ON COLUMN public.relay_master.doser_relay_states IS 'PCF8574 #1 - Array de 8 booleanos: Relés dosadores (0-7) - Bombas peristálticas';
COMMENT ON COLUMN public.relay_master.level_relay_states IS 'PCF8574 #2 - Array de 4 booleanos: Relés de nível (8-11) - 4 levers modul para captação de nível';
COMMENT ON COLUMN public.relay_master.reserved_relay_states IS 'Array de 4 booleanos: Relés reservados (12-15) - Para uso futuro';

COMMENT ON COLUMN public.relay_slaves.device_id IS 'ID do dispositivo Slave (ESP32_SLAVE_XX_XX_XX_XX_XX_XX)';
COMMENT ON COLUMN public.relay_slaves.relay_states IS 'Array de 8 booleanos: Estados dos relés do slave (0-7)';

-- =====================================================
-- 8. EXEMPLOS DE USO
-- =====================================================

-- Toggle Relé Dosador 2 (PCF8574 #1):
-- UPDATE relay_master
-- SET doser_relay_states[3] = true,  -- Array é 1-indexed, relé 2 = índice 3
--     doser_relay_has_timers[3] = false,
--     doser_relay_remaining_times[3] = 0,
--     updated_at = NOW()
-- WHERE device_id = 'ESP32_HIDRO_XXXXX';

-- Toggle Relé de Nível 8 (PCF8574 #2):
-- UPDATE relay_master
-- SET level_relay_states[1] = true,  -- Array é 1-indexed, relé 8 = índice 1
--     level_relay_has_timers[1] = false,
--     level_relay_remaining_times[1] = 0,
--     updated_at = NOW()
-- WHERE device_id = 'ESP32_HIDRO_XXXXX';

-- Consultar apenas relés dosadores:
-- SELECT * FROM relay_master_dosers WHERE device_id = 'ESP32_HIDRO_XXXXX';

-- Consultar apenas relés de nível:
-- SELECT * FROM relay_master_levels WHERE device_id = 'ESP32_HIDRO_XXXXX';

-- =====================================================
-- FIM DO SCRIPT
-- =====================================================

