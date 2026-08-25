-- Ganho EC aprendido (espelho de k_acid/k_base no pH).
-- Firmware PATCH pós-recirc; UI só lê.

ALTER TABLE public.ec_config_view
  ADD COLUMN IF NOT EXISTS k_value DOUBLE PRECISION;

COMMENT ON COLUMN public.ec_config_view.k_value IS
  'Ganho k da malha Auto EC (unidades da lei u = V·e/(k·q)). Semilla = base_dose/total_ml; aprende pós-recirc.';
