-- Backfill ph_raw / ph_display_clamped desde columna ph legacy
-- Ejecutar una vez tras ADD_HYDRO_RAW_DISPLAY_COLUMNS.sql

BEGIN;

UPDATE public.hydro_measurements
SET
  ph_raw = ph,
  ph_display_clamped = ROUND(
    LEAST(GREATEST(ph::numeric, 0), 14)::numeric,
    3
  ),
  ph = ROUND(LEAST(GREATEST(ph::numeric, 0), 14)::numeric, 3)
WHERE ph_raw IS NULL
  AND ph IS NOT NULL;

COMMIT;

-- Verificar
SELECT device_id, created_at, ph_raw, ph_display_clamped, ph, tds, ec_raw
FROM public.hydro_measurements
WHERE device_id = 'ESP32_HIDRO_269844'
ORDER BY created_at DESC
LIMIT 5;
