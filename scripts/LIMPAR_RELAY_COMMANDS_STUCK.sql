-- =====================================================
-- relay_commands — limpeza de comandos stuck (preview + UPDATE)
-- Device: ESP32_HIDRO_269844
-- =====================================================

-- PREVIEW — todos pending/sent activos
SELECT id, relay_number, status, action, created_at, sent_at,
       NOW() - created_at AS age
FROM relay_commands
WHERE device_id = 'ESP32_HIDRO_269844'
  AND status IN ('pending', 'sent')
ORDER BY created_at;

-- LIMPEZA — TODOS pending/sent (descomentar após preview)
-- UPDATE relay_commands
-- SET status = 'failed',
--     error_message = 'stuck pending/sent — limpeza manual Jun/2026',
--     completed_at = NOW()
-- WHERE device_id = 'ESP32_HIDRO_269844'
--   AND status IN ('pending', 'sent');

-- Ou só id=100 (último stuck conhecido):
-- UPDATE relay_commands
-- SET status = 'failed',
--     error_message = 'stuck sent — limpeza manual',
--     completed_at = NOW()
-- WHERE device_id = 'ESP32_HIDRO_269844'
--   AND id = 100
--   AND status IN ('pending', 'sent');

-- Terminal (recomendado):
--   node scripts/cleanup-relay-stuck.js --all
--   node scripts/cleanup-relay-stuck.js --all --dry-run

-- Verificar após limpeza (deve retornar 0 linhas)
SELECT id, relay_number, status
FROM relay_commands
WHERE device_id = 'ESP32_HIDRO_269844'
  AND status IN ('pending', 'sent');
