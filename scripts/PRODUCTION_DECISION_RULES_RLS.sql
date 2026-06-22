-- Paso 2: decision_rules + RPC + RLS (schema prod)
-- Ejecutar en Supabase SQL Editor después de PRODUCTION_VERIFY.sql

-- Tabla
CREATE TABLE IF NOT EXISTS public.decision_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  rule_id text NOT NULL CHECK (length(rule_id) >= 3),
  rule_name text NOT NULL,
  rule_description text,
  rule_json jsonb NOT NULL,
  enabled boolean DEFAULT true,
  priority integer DEFAULT 50 CHECK (priority >= 0 AND priority <= 100),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by text DEFAULT 'system'::text,
  CONSTRAINT decision_rules_pkey PRIMARY KEY (id),
  CONSTRAINT fk_decision_rules_device FOREIGN KEY (device_id) REFERENCES public.device_status(device_id)
);

CREATE INDEX IF NOT EXISTS idx_decision_rules_device_id ON public.decision_rules(device_id);
CREATE INDEX IF NOT EXISTS idx_decision_rules_enabled ON public.decision_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_decision_rules_priority ON public.decision_rules(priority DESC);
CREATE INDEX IF NOT EXISTS idx_decision_rules_rule_id ON public.decision_rules(rule_id);

-- RPC para ESP
DROP FUNCTION IF EXISTS get_active_decision_rules(text, integer);

CREATE OR REPLACE FUNCTION get_active_decision_rules(
  p_device_id text,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  device_id text,
  rule_id text,
  rule_name text,
  rule_description text,
  rule_json jsonb,
  enabled boolean,
  priority integer,
  created_at timestamptz,
  updated_at timestamptz,
  created_by text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dr.id, dr.device_id, dr.rule_id, dr.rule_name, dr.rule_description,
    dr.rule_json, dr.enabled, dr.priority, dr.created_at, dr.updated_at, dr.created_by
  FROM public.decision_rules dr
  WHERE dr.device_id = p_device_id AND dr.enabled = true
  ORDER BY dr.priority DESC, dr.created_at ASC
  LIMIT p_limit;
END;
$$;

-- RLS
ALTER TABLE public.decision_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS decision_rules_select ON public.decision_rules;
DROP POLICY IF EXISTS decision_rules_insert ON public.decision_rules;
DROP POLICY IF EXISTS decision_rules_update ON public.decision_rules;
DROP POLICY IF EXISTS decision_rules_delete ON public.decision_rules;

CREATE POLICY decision_rules_select ON public.decision_rules
  FOR SELECT TO authenticated
  USING (
    device_id IN (
      SELECT ds.device_id FROM public.device_status ds
      WHERE lower(ds.user_email) = lower(auth.jwt() ->> 'email')
    )
  );

CREATE POLICY decision_rules_insert ON public.decision_rules
  FOR INSERT TO authenticated
  WITH CHECK (
    device_id IN (
      SELECT ds.device_id FROM public.device_status ds
      WHERE lower(ds.user_email) = lower(auth.jwt() ->> 'email')
    )
  );

CREATE POLICY decision_rules_update ON public.decision_rules
  FOR UPDATE TO authenticated
  USING (
    device_id IN (
      SELECT ds.device_id FROM public.device_status ds
      WHERE lower(ds.user_email) = lower(auth.jwt() ->> 'email')
    )
  )
  WITH CHECK (
    device_id IN (
      SELECT ds.device_id FROM public.device_status ds
      WHERE lower(ds.user_email) = lower(auth.jwt() ->> 'email')
    )
  );

CREATE POLICY decision_rules_delete ON public.decision_rules
  FOR DELETE TO authenticated
  USING (
    device_id IN (
      SELECT ds.device_id FROM public.device_status ds
      WHERE lower(ds.user_email) = lower(auth.jwt() ->> 'email')
    )
  );
