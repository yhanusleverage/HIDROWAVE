-- Ejecutar AHORA en Supabase (schema prod confirmado)
-- Idempotente: seguro re-ejecutar

-- ── A) Verificación rápida ──
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'relay_commands'
ORDER BY ordinal_position;

SELECT tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' ORDER BY tablename;

SELECT policyname FROM pg_policies WHERE tablename = 'decision_rules';

SELECT proname FROM pg_proc WHERE proname = 'get_active_decision_rules';

-- ── B) RLS + RPC decision_rules (si policies vacías arriba) ──
-- Copiar/pegar PRODUCTION_DECISION_RULES_RLS.sql completo, o ejecutar ese archivo.

-- ── C) Realtime (si relay_commands no aparece en publicación) ──
-- Copiar/pegar ENABLE_REALTIME_REPLICATION.sql completo.
