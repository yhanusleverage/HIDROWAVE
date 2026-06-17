-- Permite INSERT parcial en hydro_measurements (solo niveles, o pH sin temperatura en dev)
-- Ejecutar en Supabase SQL Editor (opcional si el bridge usa applyLegacyHydroNotNullDefaults)

BEGIN;

ALTER TABLE public.hydro_measurements
  ALTER COLUMN temperature DROP NOT NULL,
  ALTER COLUMN ph DROP NOT NULL,
  ALTER COLUMN tds DROP NOT NULL;

COMMIT;

SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'hydro_measurements'
  AND column_name IN ('temperature', 'ph', 'tds', 'water_level_ok')
ORDER BY column_name;
