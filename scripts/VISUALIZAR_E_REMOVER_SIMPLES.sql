-- =====================================================
-- VISUALIZAR DADOS E REMOVER TABELA ANTIGA (SIMPLES)
-- =====================================================
-- 
-- Este script:
-- 1. Mostra contagem de registros
-- 2. Mostra últimos comandos Master e Slave
-- 3. Remove a tabela antiga relay_commands
--
-- ⚠️ ATENÇÃO: Este script REMOVE a tabela relay_commands!
--
-- =====================================================

-- =====================================================
-- 1. CONTAR REGISTROS - relay_commands_master
-- =====================================================

SELECT 
  'relay_commands_master' as tabela,
  COUNT(*) as total_registros,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE status = 'sent') as sent,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM public.relay_commands_master;

-- =====================================================
-- 2. CONTAR REGISTROS - relay_commands_slave
-- =====================================================

SELECT 
  'relay_commands_slave' as tabela,
  COUNT(*) as total_registros,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE status = 'sent') as sent,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM public.relay_commands_slave;

-- =====================================================
-- 3. VERIFICAR SE TABELA ANTIGA EXISTE
-- =====================================================

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'relay_commands'
    ) THEN '⚠️ relay_commands (ANTIGA) - EXISTE'
    ELSE '✅ relay_commands (ANTIGA) - JÁ FOI REMOVIDA'
  END as status;

-- =====================================================
-- 4. ÚLTIMOS 10 COMANDOS MASTER
-- =====================================================

SELECT 
  'MASTER' as tipo,
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
-- 5. ÚLTIMOS 10 COMANDOS SLAVE
-- =====================================================

SELECT 
  'SLAVE' as tipo,
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
-- 6. REMOVER TABELA ANTIGA
-- =====================================================

DROP TABLE IF EXISTS public.relay_commands CASCADE;

-- =====================================================
-- 7. REMOVER FUNÇÕES ANTIGAS
-- =====================================================

DROP FUNCTION IF EXISTS get_pending_commands(text, integer);
DROP FUNCTION IF EXISTS cleanup_old_commands();

-- =====================================================
-- ✅ CONCLUÍDO!
-- =====================================================
-- 
-- Verifique os resultados acima.
-- Se tudo estiver OK, descomente a linha DROP TABLE.
--
-- =====================================================

