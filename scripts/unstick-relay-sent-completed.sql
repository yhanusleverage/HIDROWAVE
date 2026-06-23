-- Desatascar comandos slave atascados en pending/sent/processing → completed
-- Ejecutar en Supabase SQL Editor (ajustar device_id si hace falta)

-- Vista previa:
-- SELECT id, relay_number, action, target_device_id, status, created_at
-- FROM relay_commands
-- WHERE device_id = 'ESP32_HIDRO_1A575C'
--   AND target_device_id IS NOT NULL AND target_device_id <> ''
--   AND status IN ('pending', 'sent', 'processing')
-- ORDER BY created_at DESC;

UPDATE relay_commands
SET status = 'completed',
    completed_at = NOW(),
    error_message = NULL
WHERE device_id = 'ESP32_HIDRO_1A575C'
  AND target_device_id IS NOT NULL
  AND target_device_id <> ''
  AND status IN ('sent', 'pending', 'processing')
  AND created_at < NOW() - INTERVAL '5 minutes';
