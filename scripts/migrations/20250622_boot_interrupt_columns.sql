-- Migração opcional: alertas de interrupção de ciclo EC/pH após reboot
ALTER TABLE device_status ADD COLUMN IF NOT EXISTS last_boot_interrupted_at timestamptz;
ALTER TABLE device_status ADD COLUMN IF NOT EXISTS boot_policy text DEFAULT 'selective_nvs';
ALTER TABLE relay_master ADD COLUMN IF NOT EXISTS last_operation_interrupted boolean DEFAULT false;
