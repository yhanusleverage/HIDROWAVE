-- hydro_measurements: columna canónica ec (µS/cm)
-- Ejecutar en Supabase SQL Editor antes del deploy bridge que deja de escribir tds.
--
-- Nota: CREATE OR REPLACE VIEW no puede renombrar columnas (tds → ec).
-- Hay que DROP las vistas dependientes y recrearlas.

BEGIN;

ALTER TABLE public.hydro_measurements
  ADD COLUMN IF NOT EXISTS ec double precision;

COMMENT ON COLUMN public.hydro_measurements.ec IS
  'EC canónica µS/cm para UI, gráficos y Auto EC. Backfill: ec_raw ?? tds (µS/cm directo).';

-- Backfill (solo filas sin ec) — tds legacy = µS/cm directo
UPDATE public.hydro_measurements
SET ec = COALESCE(NULLIF(ec_raw, 0), NULLIF(tds, 0))
WHERE ec IS NULL;

-- Vistas: CREATE OR REPLACE no puede cambiar nombres de columnas (tds → ec en pos. 4)
DROP VIEW IF EXISTS public.device_full_status CASCADE;
DROP VIEW IF EXISTS public.latest_hydro_data CASCADE;

CREATE VIEW public.latest_hydro_data AS
SELECT DISTINCT ON (device_id)
  device_id,
  temperature AS water_temperature,
  ph,
  ec,
  tds,
  water_level_ok,
  created_at
FROM public.hydro_measurements
ORDER BY device_id, created_at DESC;

-- Recrear device_full_status (misma forma que supabase-complete-setup.sql + ec)
-- Nota: ds.* ya incluye water_level_ok (ADD_LEVEL_SENSORS_COLUMNS) — não repetir lhd.water_level_ok
CREATE VIEW public.device_full_status AS
SELECT
  ds.*,
  lsd.env_temperature,
  lsd.env_humidity,
  lhd.water_temperature,
  lhd.ph,
  lhd.ec,
  lhd.tds,
  (
    SELECT COUNT(*)
    FROM public.relay_commands rc
    WHERE rc.device_id = ds.device_id
      AND rc.status = 'pending'
  ) AS pending_commands
FROM public.device_status ds
LEFT JOIN public.latest_sensor_data lsd ON ds.device_id = lsd.device_id
LEFT JOIN public.latest_hydro_data lhd ON ds.device_id = lhd.device_id;

COMMIT;

-- Verificar
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'hydro_measurements'
  AND column_name IN ('ec', 'ec_raw', 'tds')
ORDER BY column_name;

SELECT device_id, created_at, ec, ec_raw, tds, ph_raw
FROM public.hydro_measurements
WHERE device_id = 'ESP32_HIDRO_269844'
ORDER BY created_at DESC
LIMIT 5;
