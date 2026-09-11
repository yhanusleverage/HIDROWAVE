-- Fin de procedimiento ScriptRunner (Complete/Aborted).
-- Convive con relay_commands (ACK de relé); no los sustituye.

CREATE TABLE IF NOT EXISTS public.procedure_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  event_id text NOT NULL,
  rule_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('completed', 'aborted')),
  reason text,
  kind text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_procedure_events_device_created
  ON public.procedure_events (device_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_procedure_events_rule
  ON public.procedure_events (device_id, rule_id, created_at DESC);

ALTER TABLE public.procedure_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'procedure_events' AND policyname = 'procedure_events_select'
  ) THEN
    CREATE POLICY procedure_events_select ON public.procedure_events
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'procedure_events' AND policyname = 'procedure_events_insert'
  ) THEN
    CREATE POLICY procedure_events_insert ON public.procedure_events
      FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  -- Bridge service_role bypasses RLS; keep insert for authenticated optional clients.
END $$;

-- Realtime (opcional; ignorar si ya está)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.procedure_events;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
