-- =====================================================
-- VISUALIZAR DADOS E REMOVER TABELA ANTIGA
-- =====================================================
-- 
-- Este script mostra os dados de cada tabela separadamente
-- e remove a tabela antiga relay_commands
--
-- =====================================================

-- =====================================================
-- 1. DADOS DA TABELA relay_commands_master
-- =====================================================

SELECT 
  '📊 RELAY_COMMANDS_MASTER' as info,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE status = 'sent') as sent,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM public.relay_commands_master;

-- Últimos 10 comandos Master
SELECT 
  id,
  device_id,
  user_email,
  relay_numbers,
  actions,
  command_type,
  priority,
  status,
  created_at
FROM public.relay_commands_master
ORDER BY created_at DESC
LIMIT 10;

-- =====================================================
-- 2. DADOS DA TABELA relay_commands_slave
-- =====================================================

SELECT 
  '📊 RELAY_COMMANDS_SLAVE' as info,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE status = 'sent') as sent,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM public.relay_commands_slave;

-- Últimos 10 comandos Slave
SELECT 
  id,
  master_device_id,
  slave_device_id,
  slave_mac_address,
  relay_numbers,
  actions,
  command_type,
  priority,
  status,
  created_at
FROM public.relay_commands_slave
ORDER BY created_at DESC
LIMIT 10;

-- =====================================================
-- 3. VERIFICAR SE TABELA ANTIGA relay_commands EXISTE
-- =====================================================

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'relay_commands'
    ) THEN '⚠️ RELAY_COMMANDS (ANTIGA) - EXISTE'
    ELSE '✅ RELAY_COMMANDS (ANTIGA) - JÁ FOI REMOVIDA'
  END as status;

-- =====================================================
-- 4. REMOVER TABELA ANTIGA relay_commands
-- =====================================================
-- ⚠️ DESCOMENTE A LINHA ABAIXO APENAS APÓS VERIFICAR OS DADOS ACIMA!

DROP TABLE IF EXISTS public.relay_commands CASCADE;

-- =====================================================
-- 5. REMOVER FUNÇÕES ANTIGAS (se existirem)
-- =====================================================

DROP FUNCTION IF EXISTS get_pending_commands(text, integer);
DROP FUNCTION IF EXISTS cleanup_old_commands();

-- =====================================================
-- ✅ CONCLUÍDO!
-- =====================================================

