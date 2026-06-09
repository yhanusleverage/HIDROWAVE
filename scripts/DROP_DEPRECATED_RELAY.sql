-- =====================================================
-- Remover objetos DEPRECATED (schema antigo / migração)
-- Rodar no Supabase SQL Editor — seguro: IF EXISTS
-- =====================================================
-- MANTER (schema prod atual):
--   relay_commands, relay_master, relay_slaves
--   device_status.relay_states (coluna ARRAY — não é a tabela relay_states)
-- =====================================================

BEGIN;

-- Views de descoberta antigas
DROP VIEW IF EXISTS public.slaves_discovery CASCADE;

-- Tabela unificada antiga (substituída por relay_master + relay_slaves)
DROP TABLE IF EXISTS public.relay_states CASCADE;

-- Filas segregadas antigas (substituídas por relay_commands simples)
DROP TABLE IF EXISTS public.relay_commands_slave CASCADE;
DROP TABLE IF EXISTS public.relay_commands_master CASCADE;

-- Automacao avançada (só dropar se não for usar decision engine)
-- DROP TABLE IF EXISTS public.decision_rules CASCADE;

COMMIT;

-- Verificar o que ficou
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
