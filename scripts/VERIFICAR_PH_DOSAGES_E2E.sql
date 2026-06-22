-- =====================================================
-- Verificación sendero Auto pH E2E (prod / staging)
-- Ejecutar DESPUÉS de ADD_PH_CONTROLLER_COLUMNS.sql y migraciones pH
-- =====================================================

-- 1. Tabla ph_dosages existe
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'OK' ELSE 'FALTA' END AS ph_dosages_table,
  COUNT(*) AS found
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'ph_dosages';

-- 2. Columnas ph_operation_* en relay_master
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'relay_master'
  AND column_name IN (
    'ph_operation_state',
    'ph_operation_remaining_sec',
    'ph_next_check_in_sec'
  )
ORDER BY column_name;

-- 3. Columnas ph_dosages
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ph_dosages'
ORDER BY ordinal_position;

-- 4. Realtime publication
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename = 'ph_dosages';

-- 5. Últimas dosagens pH por device (ajustar device_id)
-- pv_range_note: informativo; UI dev aceita qualquer pH finito
SELECT
  device_id,
  dosage_ml,
  ph_before,
  ph_after,
  ph_setpoint,
  direction,
  created_at,
  CASE
    WHEN ph_before IS NULL THEN 'sem_pv'
    WHEN ph_before < 4.0 OR ph_before > 9.0 THEN 'fora_faixa_hidro_4_9'
    ELSE 'ok'
  END AS pv_range_note
FROM public.ph_dosages
WHERE device_id = 'ESP32_HIDRO_269844'
ORDER BY created_at DESC
LIMIT 10;

-- 5b. (legado comentado)
-- SELECT device_id, sequence_id, direction, dosage_ml, ph_before, ph_setpoint, created_at
-- FROM public.ph_dosages
-- WHERE device_id = 'ESP32_HIDRO_269844'
-- ORDER BY created_at DESC
-- LIMIT 10;

-- 6. Estado operacional pH en relay_master (0 filas → ejecutar SEED_RELAY_MASTER_FROM_DEVICE_STATUS.sql)
SELECT device_id, ph_operation_state, ph_operation_remaining_sec, ph_next_check_in_sec
FROM public.relay_master
WHERE device_id = 'ESP32_HIDRO_269844';

-- 7. ph_config_view accesible
SELECT COUNT(*) AS ph_config_rows FROM public.ph_config_view LIMIT 1;
