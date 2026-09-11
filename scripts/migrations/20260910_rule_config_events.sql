-- Auditoría: activar / desactivar reglas (UI Automação).
-- Opcional: sin esta tabla el frontend usa localStorage (no rompe).

CREATE TABLE IF NOT EXISTS public.rule_config_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  rule_id text NOT NULL,
  rule_name text,
  event_type text NOT NULL CHECK (event_type IN ('enabled', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);

CREATE INDEX IF NOT EXISTS idx_rule_config_events_device_created
  ON public.rule_config_events (device_id, created_at DESC);

ALTER TABLE public.rule_config_events ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para el rol authenticated (ajustar en prod si hace falta)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'rule_config_events' AND policyname = 'rule_config_events_select'
  ) THEN
    CREATE POLICY rule_config_events_select ON public.rule_config_events
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'rule_config_events' AND policyname = 'rule_config_events_insert'
  ) THEN
    CREATE POLICY rule_config_events_insert ON public.rule_config_events
      FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
