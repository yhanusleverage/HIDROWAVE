-- FUNCAO 1: Limpar TODOS os comandos
CREATE OR REPLACE FUNCTION public.cleanup_relay_commands_all()
RETURNS TABLE(tabela TEXT, registros_removidos BIGINT) 
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
END;
$$;

-- FUNCAO 2: Limpar comandos ANTIGOS (mais de X dias)
CREATE OR REPLACE FUNCTION public.cleanup_relay_commands_old(days_old INTEGER DEFAULT 1)
RETURNS TABLE(tabela TEXT, registros_removidos BIGINT) 
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
END;
$$;

-- FUNCAO 3: Limpar apenas comandos FINALIZADOS (RECOMENDADO)
CREATE OR REPLACE FUNCTION public.cleanup_relay_commands_finished()
RETURNS TABLE(tabela TEXT, registros_removidos BIGINT) 
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
END;
$$;

-- EXECUTAR LIMPEZA MANUAL (descomente a linha desejada)
-- SELECT * FROM public.cleanup_relay_commands_finished();
-- SELECT * FROM public.cleanup_relay_commands_old(1);
-- SELECT * FROM public.cleanup_relay_commands_all();




