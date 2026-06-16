-- Columnas para 4 sensores de nivel discretos (level_1..level_4) + water_level agregado.
-- Ejecutar en SQL Editor de Supabase (prod).

BEGIN;

ALTER TABLE public.hydro_measurements
  ADD COLUMN IF NOT EXISTS level_1 boolean,
  ADD COLUMN IF NOT EXISTS level_2 boolean,
  ADD COLUMN IF NOT EXISTS level_3 boolean,
  ADD COLUMN IF NOT EXISTS level_4 boolean,
  ADD COLUMN IF NOT EXISTS water_level text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hydro_measurements_water_level_check'
  ) THEN
    ALTER TABLE public.hydro_measurements
      ADD CONSTRAINT hydro_measurements_water_level_check
      CHECK (water_level IS NULL OR water_level IN ('vazio', 'baixo', 'medio', 'alto'));
  END IF;
END $$;

ALTER TABLE public.device_status
  ADD COLUMN IF NOT EXISTS level_1 boolean,
  ADD COLUMN IF NOT EXISTS level_2 boolean,
  ADD COLUMN IF NOT EXISTS level_3 boolean,
  ADD COLUMN IF NOT EXISTS level_4 boolean,
  ADD COLUMN IF NOT EXISTS water_level text,
  ADD COLUMN IF NOT EXISTS water_level_ok boolean;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'device_status_water_level_check'
  ) THEN
    ALTER TABLE public.device_status
      ADD CONSTRAINT device_status_water_level_check
      CHECK (water_level IS NULL OR water_level IN ('vazio', 'baixo', 'medio', 'alto'));
  END IF;
END $$;

COMMENT ON COLUMN public.hydro_measurements.level_1 IS 'Sonda superior (mojada=true)';
COMMENT ON COLUMN public.hydro_measurements.level_4 IS 'Sonda inferior (seca=vazio en tanque)';
COMMENT ON COLUMN public.device_status.water_level IS 'Ultimo agregado: vazio|baixo|medio|alto (MQTT telemetry)';

COMMIT;
