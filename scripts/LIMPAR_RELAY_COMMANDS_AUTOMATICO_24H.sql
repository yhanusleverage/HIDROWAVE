-- LIMPEZA AUTOMATICA DE RELAY COMMANDS (24 HORAS)
-- Este script cria funcoes para limpar automaticamente os comandos de relay
-- Opcoes: 1) Limpar TODOS, 2) Limpar ANTIGOS, 3) Limpar FINALIZADOS

-- OPCAO 1: FUNCAO PARA LIMPAR TODOS OS COMANDOS
CREATE OR REPLACE FUNCTION public.cleanup_relay_commands_all()
RETURNS TABLE(
  tabela TEXT,
  registros_removidos BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  master_count BIGINT;
  slave_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO master_count FROM public.relay_commands_master;
  SELECT COUNT(*) INTO slave_count FROM public.relay_commands_slave;
  
  DELETE FROM public.relay_commands_master;
  DELETE FROM public.relay_commands_slave;
  
  RETURN QUERY
  SELECT 'relay_commands_master'::TEXT, master_count
  UNION ALL
  SELECT 'relay_commands_slave'::TEXT, slave_count;
  
  RAISE NOTICE 'Limpeza automatica executada: % registros master, % registros slave removidos', 
    master_count, slave_count;
END;
$$;

-- OPCAO 2: FUNCAO PARA LIMPAR APENAS COMANDOS ANTIGOS (Mais seguro)
CREATE OR REPLACE FUNCTION public.cleanup_relay_commands_old(
  days_old INTEGER DEFAULT 1
)
RETURNS TABLE(
  tabela TEXT,
  registros_removidos BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  master_count BIGINT;
  slave_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO master_count 
  FROM public.relay_commands_master
  WHERE created_at < NOW() - (days_old || ' days')::INTERVAL;
  
  SELECT COUNT(*) INTO slave_count 
  FROM public.relay_commands_slave
  WHERE created_at < NOW() - (days_old || ' days')::INTERVAL;
  
  DELETE FROM public.relay_commands_master
  WHERE created_at < NOW() - (days_old || ' days')::INTERVAL;
  
  DELETE FROM public.relay_commands_slave
  WHERE created_at < NOW() - (days_old || ' days')::INTERVAL;
  
  RETURN QUERY
  SELECT 'relay_commands_master'::TEXT, master_count
  UNION ALL
  SELECT 'relay_commands_slave'::TEXT, slave_count;
  
  RAISE NOTICE 'Limpeza automatica executada: % registros master, % registros slave removidos (mais antigos que % dias)', 
    master_count, slave_count, days_old;
END;
$$;

-- OPCAO 3: FUNCAO PARA LIMPAR APENAS COMANDOS FINALIZADOS (RECOMENDADO)
CREATE OR REPLACE FUNCTION public.cleanup_relay_commands_finished()
RETURNS TABLE(
  tabela TEXT,
  registros_removidos BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  master_count BIGINT;
  slave_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO master_count 
  FROM public.relay_commands_master
  WHERE status IN ('completed', 'failed', 'expired');
  
  SELECT COUNT(*) INTO slave_count 
  FROM public.relay_commands_slave
  WHERE status IN ('completed', 'failed', 'expired');
  
  DELETE FROM public.relay_commands_master
  WHERE status IN ('completed', 'failed', 'expired');
  
  DELETE FROM public.relay_commands_slave
  WHERE status IN ('completed', 'failed', 'expired');
  
  RETURN QUERY
  SELECT 'relay_commands_master'::TEXT, master_count
  UNION ALL
  SELECT 'relay_commands_slave'::TEXT, slave_count;
  
  RAISE NOTICE 'Limpeza automatica executada: % registros master, % registros slave removidos (apenas finalizados)', 
    master_count, slave_count;
END;
$$;

-- CONFIGURAR LIMPEZA AUTOMATICA (pg_cron)
-- NOTA: pg_cron pode nao estar disponivel no Supabase Free Tier
-- Alternativa: Use Supabase Edge Functions com cron jobs

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Agendar limpeza diaria (meia-noite UTC)
    -- Opcao recomendada: Limpar apenas comandos finalizados
    PERFORM cron.schedule(
      'cleanup-relay-commands-finished',
      '0 0 * * *',
      'SELECT public.cleanup_relay_commands_finished();'
    );
    
    RAISE NOTICE 'pg_cron configurado! Limpeza automatica agendada para meia-noite UTC diariamente.';
  ELSE
    RAISE NOTICE 'pg_cron nao esta disponivel. Use Supabase Edge Functions com cron jobs.';
    RAISE NOTICE 'Veja o arquivo: LIMPAR_RELAY_COMMANDS_EDGE_FUNCTION.md';
  END IF;
END $$;

-- VERIFICAR AGENDAMENTOS ATIVOS (se pg_cron estiver disponivel)
-- SELECT jobid, schedule, command, active
-- FROM cron.job
-- WHERE jobname LIKE '%cleanup-relay-commands%';

-- TESTAR FUNCOES MANUALMENTE (descomente para testar)
-- SELECT * FROM public.cleanup_relay_commands_finished();
-- SELECT * FROM public.cleanup_relay_commands_old(1);
-- SELECT * FROM public.cleanup_relay_commands_all();

-- REMOVER AGENDAMENTO (se necessario)
-- SELECT cron.unschedule('cleanup-relay-commands-finished');
