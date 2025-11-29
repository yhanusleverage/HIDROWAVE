-- LIMPAR RELAY COMMANDS - EXECUCAO IMEDIATA
-- Este script APAGA todos os registros das tabelas:
-- - relay_commands_master
-- - relay_commands_slave
-- ATENCAO: Esta operacao e IRREVERSIVEL!

BEGIN;

-- Verificar quantos registros serao removidos
DO $$
DECLARE
  master_count BIGINT;
  slave_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO master_count FROM public.relay_commands_master;
  SELECT COUNT(*) INTO slave_count FROM public.relay_commands_slave;
  
  RAISE NOTICE 'Registros que serao removidos:';
  RAISE NOTICE 'relay_commands_master: %', master_count;
  RAISE NOTICE 'relay_commands_slave: %', slave_count;
END $$;

-- Limpar relay_commands_master
DELETE FROM public.relay_commands_master;

-- Limpar relay_commands_slave
DELETE FROM public.relay_commands_slave;

-- Verificar se as tabelas estao vazias
SELECT 
  'relay_commands_master' as tabela,
  COUNT(*) as registros_restantes
FROM public.relay_commands_master

UNION ALL

SELECT 
  'relay_commands_slave' as tabela,
  COUNT(*) as registros_restantes
FROM public.relay_commands_slave;

COMMIT;
