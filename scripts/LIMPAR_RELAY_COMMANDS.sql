-- =====================================================
-- LIMPAR REGISTROS DAS TABELAS relay_commands
-- =====================================================
-- 
-- Este script APAGA todos os registros das tabelas:
-- - relay_commands_master
-- - relay_commands_slave
--
-- ⚠️ ATENÇÃO: Esta operação é IRREVERSÍVEL!
-- As tabelas permanecem, mas todos os dados serão removidos.
--
-- =====================================================

BEGIN;

-- =====================================================
-- 1. VERIFICAR QUANTOS REGISTROS SERÃO REMOVIDOS
-- =====================================================

SELECT 
  'relay_commands_master' as tabela,
  COUNT(*) as registros_que_serao_removidos
FROM public.relay_commands_master

UNION ALL

SELECT 
  'relay_commands_slave' as tabela,
  COUNT(*) as registros_que_serao_removidos
FROM public.relay_commands_slave;

-- =====================================================
-- 2. LIMPAR relay_commands_master
-- =====================================================

DELETE FROM public.relay_commands_master;

-- =====================================================
-- 3. LIMPAR relay_commands_slave
-- =====================================================

DELETE FROM public.relay_commands_slave;

-- =====================================================
-- 4. VERIFICAR SE AS TABELAS ESTÃO VAZIAS
-- =====================================================

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

-- =====================================================
-- ✅ LIMPEZA CONCLUÍDA!
-- =====================================================
-- 
-- Todas as tabelas foram limpas.
-- As tabelas permanecem vazias e prontas para uso.
--
-- =====================================================




