-- =====================================================
-- Verificación sendero Última dosagem E2E (prod / staging)
-- Ejecutar DESPUÉS de CRIAR_TABELA_NUTRIENT_DOSAGES.sql
-- Device prod: ESP32_HIDRO_269844
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

-- 3. RLS (prod: rowsecurity = false, badge UNRESTRICTED)
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'nutrient_dosages';

SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'nutrient_dosages'
ORDER BY policyname;

-- 4. Realtime publication (requerido para UI useLastDosage en vivo)
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename = 'nutrient_dosages';

-- 5. Índice dedup (bridge upsert + ESP HTTPS 409)
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'nutrient_dosages'
  AND indexname = 'idx_nutrient_dosages_dedup';

-- 6. Últimas dosagens por device
SELECT device_id, sequence_id, nutrient_name, dosage_ml, relay_number, created_at
FROM public.nutrient_dosages
WHERE device_id = 'ESP32_HIDRO_269844'
ORDER BY created_at DESC
LIMIT 10;

-- 7. SUM último sequence_id (misma lógica que useLastDosage)
WITH latest AS (
  SELECT sequence_id
  FROM public.nutrient_dosages
  WHERE device_id = 'ESP32_HIDRO_269844'
  ORDER BY created_at DESC
  LIMIT 1
)
SELECT SUM(dosage_ml) AS total_ml, COUNT(*) AS nutrientes, l.sequence_id
FROM public.nutrient_dosages nd
JOIN latest l ON nd.sequence_id = l.sequence_id
WHERE nd.device_id = 'ESP32_HIDRO_269844'
GROUP BY l.sequence_id;

-- 8. Estado operacional EC en relay_master
SELECT device_id, ec_operation_state, ec_operation_remaining_sec, ec_next_check_in_sec
FROM public.relay_master
WHERE device_id = 'ESP32_HIDRO_269844';

-- Si falta índice dedup → NUTRIENT_DOSAGES_DEDUP_INDEX.sql
-- Si RLS bloquea bridge → FIX_NUTRIENT_DOSAGES_RLS.sql
-- Si falta Realtime → ENABLE_REALTIME_REPLICATION.sql
