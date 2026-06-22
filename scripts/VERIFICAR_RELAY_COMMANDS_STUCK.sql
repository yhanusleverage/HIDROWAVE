-- =====================================================
-- relay_commands — diagnosticar comandos pending stuck
-- Schema prod: id, device_id, relay_number, action, duration_seconds,
--   status, created_at, sent_at, completed_at, created_by, error_message, target_device_id
-- Status prod: pending | sent | completed | failed (processing se RPC atômico aplicado)
-- =====================================================

-- 0) Colunas reais (opcional — confirmar schema)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'relay_commands'
ORDER BY ordinal_position;

-- 1) Comandos não terminais (UI mostra "Comando manual pendente")
SELECT
  id,
  device_id,
  relay_number,
  status,
  action,
  duration_seconds,
  created_by,
  created_at,
  sent_at,
  completed_at,
  error_message
FROM relay_commands
WHERE device_id = 'ESP32_HIDRO_269844'  -- ajustar device_id
  AND status IN ('pending', 'sent', 'processing')
ORDER BY created_at DESC
LIMIT 50;

-- 2) Duplicados pending no mesmo relé
SELECT
  relay_number,
  COUNT(*) AS pending_count,
  array_agg(id ORDER BY created_at DESC) AS command_ids
FROM relay_commands
WHERE device_id = 'ESP32_HIDRO_269844'
  AND status IN ('pending', 'sent', 'processing')
GROUP BY relay_number
HAVING COUNT(*) > 1;

-- 3) Comandos antigos (>5 min) ainda pending — candidatos a limpeza
SELECT id, relay_number, status, created_at,
       NOW() - created_at AS age
FROM relay_commands
WHERE device_id = 'ESP32_HIDRO_269844'
  AND status IN ('pending', 'sent', 'processing')
  AND created_at < NOW() - INTERVAL '5 minutes'
ORDER BY created_at;

-- 4) Ver LIMPAR_RELAY_COMMANDS_STUCK.sql para UPDATE seguro

-- 5) Estado pH em relay_master (badges dashboard)
SELECT
  device_id,
  ph_operation_state,
  ph_operation_remaining_sec,
  ph_next_check_in_sec
FROM relay_master
WHERE device_id = 'ESP32_HIDRO_269844';
