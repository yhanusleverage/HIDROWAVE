-- =====================================================
-- RULE SCHEDULES: cronograma diário/semanal/cultivo
-- Executar no Supabase SQL Editor (idempotente).
-- =====================================================

CREATE TABLE IF NOT EXISTS public.rule_schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  rule_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  schedule_type text NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'grow_week')),
  time_start time NOT NULL,
  time_end time,
  days_of_week int[] CHECK (
    days_of_week IS NULL
    OR (
      cardinality(days_of_week) BETWEEN 1 AND 7
      AND days_of_week <@ ARRAY[0, 1, 2, 3, 4, 5, 6]
    )
  ),
  grow_week_index int CHECK (grow_week_index IS NULL OR grow_week_index >= 0),
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  last_triggered_at timestamptz,
  created_by text DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rule_schedules_pkey PRIMARY KEY (id),
  CONSTRAINT fk_rule_schedules_device FOREIGN KEY (device_id)
    REFERENCES public.device_status(device_id)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_rule_schedules_device ON public.rule_schedules(device_id);
CREATE INDEX IF NOT EXISTS idx_rule_schedules_enabled ON public.rule_schedules(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_rule_schedules_rule ON public.rule_schedules(rule_id);

-- RLS
ALTER TABLE public.rule_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rule_schedules_select ON public.rule_schedules;
CREATE POLICY rule_schedules_select ON public.rule_schedules
  FOR SELECT USING (true);

DROP POLICY IF EXISTS rule_schedules_insert ON public.rule_schedules;
CREATE POLICY rule_schedules_insert ON public.rule_schedules
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS rule_schedules_update ON public.rule_schedules;
CREATE POLICY rule_schedules_update ON public.rule_schedules
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS rule_schedules_delete ON public.rule_schedules;
CREATE POLICY rule_schedules_delete ON public.rule_schedules
  FOR DELETE USING (true);

-- Realtime (opcional)
-- ALTER PUBLICATION supabase_realtime ADD TABLE rule_schedules;

COMMENT ON TABLE public.rule_schedules IS 'Cronograma diário/semanal/cultivo para decision_rules — avaliado pelo Bridge Node (scheduler cron 60s).';
COMMENT ON COLUMN public.rule_schedules.schedule_type IS 'daily = todos os dias; weekly = dias específicos; grow_week = semana do ciclo de cultivo.';
COMMENT ON COLUMN public.rule_schedules.days_of_week IS '0=dom 1=seg 2=ter 3=qua 4=qui 5=sex 6=sab. NULL = todos os dias.';
COMMENT ON COLUMN public.rule_schedules.grow_week_index IS 'Índice da semana no plano de cultivo (0-based). Só usado quando schedule_type=grow_week.';
