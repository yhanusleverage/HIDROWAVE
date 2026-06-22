-- Seed relay_master desde device_status (cuando bridge PATCH no encuentra fila)
-- Ejecutar DESPUÉS de ADD_PH_CONTROLLER_COLUMNS.sql si aplica
-- Ajustar device_id antes de ejecutar

-- 1. Diagnóstico
SELECT device_id, user_email, mac_address, is_online
FROM public.device_status
WHERE device_id = 'ESP32_HIDRO_269844';

SELECT device_id, ph_operation_state, ec_operation_state, last_update
FROM public.relay_master
WHERE device_id = 'ESP32_HIDRO_269844';

-- 2. Crear fila si device_status existe y relay_master no
INSERT INTO public.relay_master (
  device_id,
  user_email,
  master_mac_address
)
SELECT
  ds.device_id,
  ds.user_email,
  COALESCE(ds.mac_address, 'unknown')
FROM public.device_status ds
WHERE ds.device_id = 'ESP32_HIDRO_269844'
ON CONFLICT (device_id) DO NOTHING;

-- 3. Confirmar estado pH operacional
SELECT
  device_id,
  ph_operation_state,
  ph_operation_remaining_sec,
  ph_next_check_in_sec,
  ec_operation_state,
  last_update
FROM public.relay_master
WHERE device_id = 'ESP32_HIDRO_269844';
