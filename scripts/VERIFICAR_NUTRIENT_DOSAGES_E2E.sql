-- =====================================================
-- Verificación sendero Última dosagem E2E (prod / staging)
-- Ejecutar DESPUÉS de CRIAR_TABELA_NUTRIENT_DOSAGES.sql
-- =====================================================

-- 1. Tabla nutrient_dosages existe
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'OK' ELSE 'FALTA' END AS nutrient_dosages_table,
  COUNT(*) AS found
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'nutrient_dosages';

-- 2. Columnas ec_operation_* en relay_master
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'relay_master'
  AND column_name IN (
    'ec_operation_state',
    'ec_operation_remaining_sec',
    'ec_next_check_in_sec'
  )
ORDER BY column_name;

-- 3. RLS activo + políticas
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'nutrient_dosages';

SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'nutrient_dosages'
ORDER BY policyname;

-- 4. Realtime publication
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename = 'nutrient_dosages';

-- 5. Últimas dosagens por device (ajustar device_id)
-- SELECT device_id, sequence_id, nutrient_name, dosage_ml, created_at
-- FROM public.nutrient_dosages
-- WHERE device_id = 'ESP32_HIDRO_269844'
-- ORDER BY created_at DESC
-- LIMIT 10;

-- 6. SUM último sequence_id (misma lógica que useLastDosage)
-- WITH latest AS (
--   SELECT sequence_id
--   FROM public.nutrient_dosages
--   WHERE device_id = 'ESP32_HIDRO_269844'
--   ORDER BY created_at DESC
--   LIMIT 1
-- )
-- SELECT SUM(dosage_ml) AS total_ml, COUNT(*) AS nutrientes
-- FROM public.nutrient_dosages nd
-- JOIN latest l ON nd.sequence_id = l.sequence_id
-- WHERE nd.device_id = 'ESP32_HIDRO_269844';

-- 7. Estado operacional EC en relay_master
-- SELECT device_id, ec_operation_state, ec_operation_remaining_sec, ec_next_check_in_sec
-- FROM public.relay_master
-- WHERE device_id = 'ESP32_HIDRO_269844';
