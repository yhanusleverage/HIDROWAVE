-- =====================================================
-- VISUALIZAR DADOS E REMOVER TABELA ANTIGA
-- =====================================================
-- 
-- Este script:
-- 1. Mostra dados das novas tabelas (relay_commands_master e relay_commands_slave)
-- 2. Remove a tabela antiga relay_commands
--
-- ⚠️ ATENÇÃO: Este script REMOVE a tabela relay_commands!
-- Certifique-se de que a migração foi bem-sucedida antes de executar.
--
-- =====================================================

BEGIN;

-- =====================================================
-- PASSO 1: VISUALIZAR DADOS DAS NOVAS TABELAS
-- =====================================================

DO $$
DECLARE
  v_master_count INTEGER;
  v_slave_count INTEGER;
  v_old_count INTEGER;
BEGIN
  -- Contar registros
  SELECT COUNT(*) INTO v_master_count FROM public.relay_commands_master;
  SELECT COUNT(*) INTO v_slave_count FROM public.relay_commands_slave;
  SELECT COUNT(*) INTO v_old_count FROM public.relay_commands;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '📊 RESUMO DAS TABELAS';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ relay_commands_master: % registros', v_master_count;
  RAISE NOTICE '✅ relay_commands_slave: % registros', v_slave_count;
  RAISE NOTICE '⚠️  relay_commands (antiga): % registros', v_old_count;
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- PASSO 2: MOSTRAR ÚLTIMOS COMANDOS MASTER
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '📋 ÚLTIMOS 10 COMANDOS MASTER:';
END $$;

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
-- PASSO 3: MOSTRAR ÚLTIMOS COMANDOS SLAVE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '📋 ÚLTIMOS 10 COMANDOS SLAVE:';
END $$;

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
-- PASSO 4: ESTATÍSTICAS DETALHADAS
-- =====================================================

DO $$
DECLARE
  v_master_pending INTEGER;
  v_master_sent INTEGER;
  v_master_completed INTEGER;
  v_master_failed INTEGER;
  v_slave_pending INTEGER;
  v_slave_sent INTEGER;
  v_slave_completed INTEGER;
  v_slave_failed INTEGER;
BEGIN
  -- Estatísticas Master
  SELECT COUNT(*) INTO v_master_pending FROM public.relay_commands_master WHERE status = 'pending';
  SELECT COUNT(*) INTO v_master_sent FROM public.relay_commands_master WHERE status = 'sent';
  SELECT COUNT(*) INTO v_master_completed FROM public.relay_commands_master WHERE status = 'completed';
  SELECT COUNT(*) INTO v_master_failed FROM public.relay_commands_master WHERE status = 'failed';
  
  -- Estatísticas Slave
  SELECT COUNT(*) INTO v_slave_pending FROM public.relay_commands_slave WHERE status = 'pending';
  SELECT COUNT(*) INTO v_slave_sent FROM public.relay_commands_slave WHERE status = 'sent';
  SELECT COUNT(*) INTO v_slave_completed FROM public.relay_commands_slave WHERE status = 'completed';
  SELECT COUNT(*) INTO v_slave_failed FROM public.relay_commands_slave WHERE status = 'failed';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '📊 ESTATÍSTICAS POR STATUS';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MASTER:';
  RAISE NOTICE '   - Pending: %', v_master_pending;
  RAISE NOTICE '   - Sent: %', v_master_sent;
  RAISE NOTICE '   - Completed: %', v_master_completed;
  RAISE NOTICE '   - Failed: %', v_master_failed;
  RAISE NOTICE '';
  RAISE NOTICE 'SLAVE:';
  RAISE NOTICE '   - Pending: %', v_slave_pending;
  RAISE NOTICE '   - Sent: %', v_slave_sent;
  RAISE NOTICE '   - Completed: %', v_slave_completed;
  RAISE NOTICE '   - Failed: %', v_slave_failed;
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- PASSO 5: REMOVER TABELA ANTIGA
-- =====================================================

-- ⚠️ ATENÇÃO: Esta operação é IRREVERSÍVEL!
-- Certifique-se de que:
-- 1. Os dados foram migrados corretamente
-- 2. As novas tabelas estão funcionando
-- 3. Você fez backup se necessário

DO $$
DECLARE
  v_table_exists BOOLEAN;
BEGIN
  -- Verificar se a tabela existe
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'relay_commands'
  ) INTO v_table_exists;
  
  IF v_table_exists THEN
    RAISE NOTICE '🗑️  Removendo tabela relay_commands...';
    
    -- Remover a tabela antiga
    DROP TABLE IF EXISTS public.relay_commands CASCADE;
    
    RAISE NOTICE '✅ Tabela relay_commands removida com sucesso!';
  ELSE
    RAISE NOTICE 'ℹ️  Tabela relay_commands não existe (já foi removida)';
  END IF;
END $$;

-- =====================================================
-- PASSO 6: VERIFICAR FUNÇÕES ANTIGAS
-- =====================================================

-- Remover função antiga get_pending_commands se existir
DROP FUNCTION IF EXISTS get_pending_commands(text, integer);

-- Remover função antiga cleanup_old_commands se existir
DROP FUNCTION IF EXISTS cleanup_old_commands();

DO $$
BEGIN
  RAISE NOTICE '✅ Funções antigas removidas (se existiam)';
END $$;

COMMIT;

-- =====================================================
-- ✅ SCRIPT CONCLUÍDO!
-- =====================================================
-- 
-- Verifique os resultados acima para confirmar que:
-- 1. Os dados foram migrados corretamente
-- 2. A tabela antiga foi removida
-- 3. As novas tabelas estão funcionando
--
-- =====================================================

