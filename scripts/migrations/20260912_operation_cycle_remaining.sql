-- ETA global del ciclo Auto EC / Auto pH (dose + homogeneización).
-- Reloj de fase sigue en *_operation_remaining_sec.

ALTER TABLE public.relay_master
  ADD COLUMN IF NOT EXISTS ec_operation_cycle_remaining_sec integer NOT NULL DEFAULT 0;

ALTER TABLE public.relay_master
  ADD COLUMN IF NOT EXISTS ph_operation_cycle_remaining_sec integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.relay_master.ec_operation_cycle_remaining_sec IS
  'Segundos restantes del ciclo completo Auto EC (secuencia de dosis + tempo_recirculacao). 0 en idle/dilución.';

COMMENT ON COLUMN public.relay_master.ph_operation_cycle_remaining_sec IS
  'Segundos restantes del ciclo completo Auto pH (dosis + homogeneización). 0 en idle.';
