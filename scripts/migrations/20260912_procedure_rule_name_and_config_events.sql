-- Historial: rule_name en procedure_events + tabla rule_config_events
-- Si hay deadlock: ejecutar CADA bloque por separado (uno, Run, siguiente).
-- Cerrar otras pestañas SQL / Table Editor de estas tablas antes.

-- ========== 1) Columna rule_name ==========
ALTER TABLE public.procedure_events
  ADD COLUMN IF NOT EXISTS rule_name text;

-- ========== 2) Tabla config events ==========
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

-- ========== 3) RLS (sin DO $$ — menos lock) ==========
ALTER TABLE public.rule_config_events ENABLE ROW LEVEL SECURITY;

-- Si ya existen, ignorar el error "already exists" y seguir
CREATE POLICY rule_config_events_select ON public.rule_config_events
  FOR SELECT TO authenticated USING (true);

CREATE POLICY rule_config_events_insert ON public.rule_config_events
  FOR INSERT TO authenticated WITH CHECK (true);

-- ========== 4) Realtime ==========
-- Preferible: scripts/migrations/20260912_realtime_procedure_tables.sql
-- (procedure_events + rule_config_events + decision_rules, idempotente).
-- Si falla por deadlock aquí, corre ese script aparte.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.rule_config_events;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- ========== 5) Backfill nombres viejos ==========
UPDATE public.procedure_events pe
SET rule_name = dr.rule_name
FROM public.decision_rules dr
WHERE pe.device_id = dr.device_id
  AND pe.rule_id = dr.rule_id
  AND (pe.rule_name IS NULL OR pe.rule_name = '')
  AND dr.rule_name IS NOT NULL
  AND length(trim(dr.rule_name)) > 0;
