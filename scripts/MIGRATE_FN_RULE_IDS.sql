-- Migrar rule_id das macros tipadas (legado → slug legível ≈ título)
-- Depois: Motor → Resync ↻ para empurrar MQTT ao Core.

UPDATE public.decision_rules
SET rule_id = 'fn_recirculacao_continua', updated_at = now()
WHERE rule_id = 'fn_circulation';

UPDATE public.decision_rules
SET rule_id = 'fn_enchimento_ate_alto', updated_at = now()
WHERE rule_id = 'fn_fill_valve';

UPDATE public.decision_rules
SET rule_id = 'fn_dreno_ate_vazio', updated_at = now()
WHERE rule_id = 'fn_drain_valve';

UPDATE public.decision_rules
SET rule_id = 'fn_recarga_ate_alto', updated_at = now()
WHERE rule_id = 'fn_recharge_pump';
