-- Flag explícito: niveles simulados en firmware (HIDRO_SIMULATE_WATER_LEVELS=1).
-- La UI no debe mostrar OK/alto como lectura real cuando levels_simulated=true.

BEGIN;

ALTER TABLE public.hydro_measurements
  ADD COLUMN IF NOT EXISTS levels_simulated boolean NOT NULL DEFAULT false;

ALTER TABLE public.device_status
  ADD COLUMN IF NOT EXISTS levels_simulated boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.hydro_measurements.levels_simulated IS
  'true cuando L1-L4/water_level_ok vienen de HIDRO_SIMULATE_WATER_LEVELS (dev)';
COMMENT ON COLUMN public.device_status.levels_simulated IS
  'Último flag de telemetría — niveles no medidos por hardware real';

COMMIT;

SELECT table_name, column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'levels_simulated'
ORDER BY table_name;
