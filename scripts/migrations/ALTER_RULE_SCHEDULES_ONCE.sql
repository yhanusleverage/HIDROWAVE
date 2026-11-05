-- Día suelto: una fecha, una hora, y la cita se apaga después de disparar.
-- Ejecutar en el SQL editor de Supabase (idempotente).

ALTER TABLE public.rule_schedules
  ADD COLUMN IF NOT EXISTS on_date date;

ALTER TABLE public.rule_schedules
  DROP CONSTRAINT IF EXISTS rule_schedules_schedule_type_check;

ALTER TABLE public.rule_schedules
  ADD CONSTRAINT rule_schedules_schedule_type_check
  CHECK (schedule_type IN ('daily', 'weekly', 'grow_week', 'once'));

COMMENT ON COLUMN public.rule_schedules.on_date IS
  'Só schedule_type=once. Data civil na timezone da cita. Depois do disparo enabled fica false.';
