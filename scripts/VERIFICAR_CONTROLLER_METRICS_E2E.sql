-- =====================================================
-- Verificación métricas de ciclo EC/pH (prod / staging)
-- Ejecutar DESPUÉS de CRIAR_TABELA_*_CONTROLLER_METRICS.sql
-- =====================================================

-- 1. Tablas existen
SELECT
  CASE WHEN COUNT(*) = 1 THEN 'OK' ELSE 'FALTA' END AS ec_controller_metrics_table,
  COUNT(*) AS found
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'ec_controller_metrics';

SELECT
  CASE WHEN COUNT(*) = 1 THEN 'OK' ELSE 'FALTA' END AS ph_controller_metrics_table,
  COUNT(*) AS found
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'ph_controller_metrics';

-- 2. Realtime publication
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('ec_controller_metrics', 'ph_controller_metrics')
ORDER BY tablename;

-- 3. RLS desactivado
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('ec_controller_metrics', 'ph_controller_metrics');

-- 4. Últimas métricas EC
SELECT device_id, ec_setpoint, ec_actual, ec_error, dosage_ml,
       adjustment_needed, adjustment_applied, created_at
FROM public.ec_controller_metrics
WHERE device_id = 'ESP32_HIDRO_269844'
ORDER BY created_at DESC
LIMIT 10;

-- 5. Últimas métricas pH
SELECT device_id, ph_setpoint, ph_before, error_h, direction,
       dose_real_ml, adjustment_needed, adjustment_applied, created_at
FROM public.ph_controller_metrics
WHERE device_id = 'ESP32_HIDRO_269844'
ORDER BY created_at DESC
LIMIT 10;
