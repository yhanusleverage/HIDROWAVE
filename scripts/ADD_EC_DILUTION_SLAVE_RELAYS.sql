-- Diluição EC modo A — relés em ESP-NOW slave (não master 0–7)
-- Executar no SQL Editor do Supabase após ADD_EC_DILUTION.sql

BEGIN;

ALTER TABLE public.ec_config_view
  ADD COLUMN IF NOT EXISTS dilution_drain_slave_mac text;

ALTER TABLE public.ec_config_view
  ADD COLUMN IF NOT EXISTS dilution_fill_slave_mac text;

COMMENT ON COLUMN public.ec_config_view.dilution_drain_relay IS
  'Índice do relé slave (0–7) válvula de dreno. Par com dilution_drain_slave_mac.';

COMMENT ON COLUMN public.ec_config_view.dilution_fill_relay IS
  'Índice do relé slave (0–7) reposição de água. Par com dilution_fill_slave_mac.';

COMMENT ON COLUMN public.ec_config_view.dilution_drain_slave_mac IS
  'MAC do slave ESP-NOW (ex. 14:33:5C:38:BF:60) — relé dreno diluição.';

COMMENT ON COLUMN public.ec_config_view.dilution_fill_slave_mac IS
  'MAC do slave ESP-NOW — relé reposição diluição.';

COMMIT;
