-- =====================================================
-- Reset ec_operation huérfano (tests MQTT manuais)
-- Executar no SQL Editor Supabase após mosquitto_pub de teste
-- =====================================================

UPDATE public.relay_master
SET
  ec_operation_state = 'idle',
  ec_operation_remaining_sec = 0,
  ec_next_check_in_sec = 0
WHERE device_id = 'ESP32_HIDRO_269844';

SELECT device_id, ec_operation_state, ec_operation_remaining_sec, ec_next_check_in_sec
FROM public.relay_master
WHERE device_id = 'ESP32_HIDRO_269844';
