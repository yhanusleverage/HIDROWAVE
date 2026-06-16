-- =====================================================
-- Alinear nutrient_dosages con prod (mismo patrón que ph_dosages)
-- Bridge + ESP insertan vía anon/service_role; RLS off evita 42501.
-- Ejecutar en Supabase SQL Editor si el bridge falla con RLS.
-- =====================================================

BEGIN;

ALTER TABLE public.nutrient_dosages DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.nutrient_dosages IS
  'Eventos de dosagem Auto EC. RLS desactivado (bridge MQTT + ESP HTTPS). UI lee con anon/authenticated.';

COMMIT;

-- Verificación:
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public' AND tablename = 'nutrient_dosages';
-- rowsecurity = false → badge UNRESTRICTED en Supabase UI
