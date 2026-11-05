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

-- Tiempo real en la pestaña de ciclo. Si la tabla ya está publicada, no hace nada.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['rule_schedules', 'grow_cycle_plans', 'grow_cycle_instances', 'grow_cycle_weekly_stats']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
