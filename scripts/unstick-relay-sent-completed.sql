-- Desatascar comandos (master doser + slave) atascados en pending/sent/processing
-- Ejecutar en Supabase SQL Editor (ajustar device_id si hace falta)

-- Vista previa:
-- SELECT id, relay_number, action, target_device_id, status, created_at, duration_seconds
-- FROM relay_commands
-- WHERE device_id = 'ESP32_HIDRO_1A575C'
--   AND status IN ('pending', 'sent', 'processing')
-- ORDER BY created_at DESC;

-- Master local (mapa dosificadores Core) + slave: sin filtrar target_device_id
UPDATE relay_commands
SET status = 'completed',
    completed_at = NOW(),
    error_message = 'unstick manual — ACK perdido'
WHERE device_id = 'ESP32_HIDRO_1A575C'
  AND status IN ('sent', 'pending', 'processing')
  AND created_at < NOW() - INTERVAL '2 minutes';
