-- Verificar columnas ph_raw / ph_display_clamped / ec y últimas filas
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'hydro_measurements'
  AND column_name IN ('ph_raw', 'ph_display_clamped', 'ec', 'ec_raw', 'tds', 'temperature_raw')
ORDER BY column_name;

SELECT device_id, created_at, ph_raw, ph_display_clamped, ph, ec, ec_raw, tds, temperature, temperature_raw, water_level_ok
FROM public.hydro_measurements
WHERE device_id = 'ESP32_HIDRO_269844'
ORDER BY created_at DESC
LIMIT 5;
