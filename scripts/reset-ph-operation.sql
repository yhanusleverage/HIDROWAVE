-- Reset estado operacional pH huérfano tras tests MQTT o desactivación manual
-- Ajustar device_id antes de ejecutar

UPDATE public.relay_master
SET
  ph_operation_state = 'idle',
  ph_operation_remaining_sec = 0,
  ph_next_check_in_sec = 0
WHERE device_id = 'ESP32_HIDRO_269844';

SELECT device_id, ph_operation_state, ph_operation_remaining_sec, ph_next_check_in_sec
FROM public.relay_master
WHERE device_id = 'ESP32_HIDRO_269844';
