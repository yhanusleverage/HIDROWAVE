-- =====================================================
-- DECISION RULES: TABELA E RPC PARA MOTOR DE DECISÃO
-- =====================================================
-- Este script cria a tabela decision_rules e a função RPC
-- para o ESP32 buscar regras ativas do Supabase.
-- =====================================================

-- =====================================================
-- ETAPA 1: CRIAR TABELA decision_rules (SE NÃO EXISTIR)
-- =====================================================

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

-- =====================================================
-- ETAPA 2: CRIAR ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_decision_rules_device_id ON public.decision_rules(device_id);
CREATE INDEX IF NOT EXISTS idx_decision_rules_enabled ON public.decision_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_decision_rules_priority ON public.decision_rules(priority DESC);
CREATE INDEX IF NOT EXISTS idx_decision_rules_rule_id ON public.decision_rules(rule_id);

-- =====================================================
-- ETAPA 3: CRIAR FUNÇÃO RPC get_active_decision_rules()
-- =====================================================
-- Esta função retorna todas as regras ativas para um device_id,
-- ordenadas por prioridade (maior primeiro).
-- =====================================================

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
    dr.id,
    dr.device_id,
    dr.rule_id,
    dr.rule_name,
    dr.rule_description,
    dr.rule_json,
    dr.enabled,
    dr.priority,
    dr.created_at,
    dr.updated_at,
    dr.created_by
  FROM public.decision_rules dr
  WHERE dr.device_id = p_device_id
    AND dr.enabled = true
  ORDER BY 
    dr.priority DESC,
    dr.created_at ASC
  LIMIT p_limit;
END;
$$;

-- =====================================================
-- ETAPA 4: COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================

COMMENT ON TABLE public.decision_rules IS 'Regras de automação do Motor de Decisão';
COMMENT ON COLUMN public.decision_rules.rule_json IS 'JSON com condições e ações da regra';
COMMENT ON COLUMN public.decision_rules.priority IS 'Prioridade da regra (0-100). Maior = mais importante';
COMMENT ON FUNCTION get_active_decision_rules(text, integer) IS 'Retorna regras ativas para um device_id, ordenadas por prioridade';

-- =====================================================
-- ETAPA 5: EXEMPLO DE ESTRUTURA rule_json
-- =====================================================
-- Estrutura esperada do campo rule_json:
-- {
--   "conditions": [
--     {
--       "sensor": "temperature",
--       "operator": ">",
--       "value": 25.0,
--       "logic": "AND"
--     }
--   ],
--   "actions": [
--     {
--       "relay_id": 0,
--       "relay_name": "Aquecedor",
--       "duration": 300,
--       "target_device_id": "ESP-NOW-SLAVE",
--       "slave_mac_address": "14:33:5C:38:BF:60"
--     }
--   ],
--   "delay_before_execution": 0,
--   "interval_between_executions": 5,
--   "priority": 50
-- }
-- =====================================================

-- =====================================================
-- ETAPA 6: POLÍTICAS RLS (Row Level Security)
-- =====================================================
-- Se RLS estiver habilitado, criar políticas aqui
-- =====================================================

-- Exemplo (descomentar se necessário):
-- ALTER TABLE public.decision_rules ENABLE ROW LEVEL SECURITY;
-- 
-- CREATE POLICY "Users can view their own decision rules"
--   ON public.decision_rules
--   FOR SELECT
--   USING (auth.uid()::text = (SELECT user_email FROM device_status WHERE device_id = decision_rules.device_id));
-- 
-- CREATE POLICY "Users can insert their own decision rules"
--   ON public.decision_rules
--   FOR INSERT
--   WITH CHECK (auth.uid()::text = (SELECT user_email FROM device_status WHERE device_id = decision_rules.device_id));
-- 
-- CREATE POLICY "Users can update their own decision rules"
--   ON public.decision_rules
--   FOR UPDATE
--   USING (auth.uid()::text = (SELECT user_email FROM device_status WHERE device_id = decision_rules.device_id));
-- 
-- CREATE POLICY "Users can delete their own decision rules"
--   ON public.decision_rules
--   FOR DELETE
--   USING (auth.uid()::text = (SELECT user_email FROM device_status WHERE device_id = decision_rules.device_id));

-- =====================================================
-- FIM DO SCRIPT
-- =====================================================




