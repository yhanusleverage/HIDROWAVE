-- =====================================================
-- Verificación paso a paso (Supabase SQL Editor)
-- Orden: 1) aplicar RPC → 2) preview → 3) test RPC
-- =====================================================

-- PASO 0: Pending actuales (solo lectura)
SELECT id, relay_number, status, action, duration_seconds, created_at, target_device_id
FROM relay_commands
WHERE device_id = 'ESP32_HIDRO_269844'
  AND status IN ('pending', 'sent')
ORDER BY created_at ASC;

-- PASO 1: Aplicar PRODUCTION_RPC_GET_AND_LOCK_MASTER.sql (archivo completo) antes de continuar

-- PASO 2: Test RPC — devuelve filas y las marca sent (¡como haría el ESP!)
SELECT * FROM get_and_lock_master_commands('ESP32_HIDRO_269844', 5, 30);

-- PASO 3: Confirmar transición o limpieza
SELECT id, relay_number, status, sent_at, completed_at, error_message
FROM relay_commands
WHERE device_id = 'ESP32_HIDRO_269844'
  AND (id IN (97, 98, 99) OR status IN ('pending', 'sent'))
ORDER BY id;

-- PASO 4 (si stuck en sent): ejecutar LIMPAR_RELAY_COMMANDS_STUCK.sql opção A
