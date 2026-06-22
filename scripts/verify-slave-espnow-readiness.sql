-- Verificar slaves ESP-NOW registados para comandos MQTT rápidos
-- Executar no Supabase SQL Editor antes do teste E2E slave

-- Slaves do master (ajustar master_device_id)
SELECT
  id,
  master_device_id,
  mac_address,
  slave_name,
  relay_count,
  is_active,
  last_seen_at,
  created_at
FROM relay_slaves
WHERE master_device_id = 'ESP32_HIDRO_269844'
ORDER BY created_at DESC;

-- Últimos comandos com target slave (MAC)
SELECT
  id,
  device_id,
  relay_number,
  target_device_id,
  action,
  status,
  command_type,
  created_at,
  updated_at,
  EXTRACT(EPOCH FROM (updated_at - created_at)) AS latency_s
FROM relay_commands
WHERE device_id = 'ESP32_HIDRO_269844'
  AND target_device_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- Comandos stuck (slave)
SELECT id, relay_number, target_device_id, status, updated_at
FROM relay_commands
WHERE device_id = 'ESP32_HIDRO_269844'
  AND target_device_id IS NOT NULL
  AND status IN ('pending', 'sent', 'executing')
ORDER BY created_at DESC;
