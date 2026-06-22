-- hydro_measurements: PV crudo (ph_raw) + clamp para gráficos (ph_display_clamped)
-- Ejecutar en Supabase SQL Editor antes del deploy bridge Realtime-first.

BEGIN;

ALTER TABLE public.hydro_measurements
  ADD COLUMN IF NOT EXISTS ph_raw double precision,
  ADD COLUMN IF NOT EXISTS ph_display_clamped numeric(8, 3),
  ADD COLUMN IF NOT EXISTS ec_raw double precision,
  ADD COLUMN IF NOT EXISTS temperature_raw double precision;

COMMENT ON COLUMN public.hydro_measurements.ph_raw IS
  'PV pH crudo del firmware/RS485 (sin clamp). Cards UI leen esta columna.';
COMMENT ON COLUMN public.hydro_measurements.ph_display_clamped IS
  'pH clamp 0–14 para gráficos. Columna ph legacy puede mirrorar este valor.';
COMMENT ON COLUMN public.hydro_measurements.ec_raw IS
  'EC µS/cm crudo (derivado de tds×2 o payload ec). UI: resolveEcForDisplay usa ec_raw ?? tds×2.';
COMMENT ON COLUMN public.hydro_measurements.temperature_raw IS
  'Temperatura agua cruda °C.';

COMMIT;
