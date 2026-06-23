-- Cortar bucle SSL: comandos atascados en pending/sent (ajustar device_id si hace falta)
-- Ejecutar en Supabase SQL Editor ANTES de probar firmware nuevo

UPDATE relay_commands
SET status = 'failed',
    completed_at = NOW(),
    error_message = COALESCE(error_message, '') || ' [manual cleanup — SSL loop]'
WHERE device_id = 'ESP32_HIDRO_1A575C'
  AND id BETWEEN 165 AND 199
  AND status IN ('pending', 'sent', 'processing');

-- Opcional: marcar como completed los que ya se ejecutaron en hardware (id conocido)
-- UPDATE relay_commands SET status = 'completed', completed_at = NOW(), error_message = NULL
-- WHERE device_id = 'ESP32_HIDRO_1A575C' AND id = 164 AND status != 'completed';

-- Verificar cola restante:
-- SELECT id, relay_number, action, status, lock_attempts, created_at, sent_at, completed_at
-- FROM relay_commands
-- WHERE device_id = 'ESP32_HIDRO_1A575C'
--   AND target_device_id IS NOT NULL AND target_device_id <> ''
--   AND status IN ('pending', 'sent')
-- ORDER BY created_at DESC
-- LIMIT 20;
