-- Verificar que migración + RPCs de relay_commands están desplegados en prod
-- Ejecutar en Supabase SQL Editor; cada fila debe devolver exists = true

SELECT 'column:lock_attempts' AS check_name,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'relay_commands'
           AND column_name = 'lock_attempts'
       ) AS ok;

SELECT 'column:priority' AS check_name,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'relay_commands'
           AND column_name = 'priority'
       ) AS ok;

SELECT 'column:current_state' AS check_name,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'relay_commands'
           AND column_name = 'current_state'
       ) AS ok;

SELECT 'column:updated_at' AS check_name,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'relay_commands'
           AND column_name = 'updated_at'
       ) AS ok;

SELECT 'rpc:get_and_lock_slave_commands' AS check_name,
       EXISTS (
         SELECT 1 FROM pg_proc p
         JOIN pg_namespace n ON p.pronamespace = n.oid
         WHERE n.nspname = 'public' AND p.proname = 'get_and_lock_slave_commands'
       ) AS ok;

SELECT 'rpc:get_and_lock_master_commands' AS check_name,
       EXISTS (
         SELECT 1 FROM pg_proc p
         JOIN pg_namespace n ON p.pronamespace = n.oid
         WHERE n.nspname = 'public' AND p.proname = 'get_and_lock_master_commands'
       ) AS ok;

SELECT 'rpc:complete_relay_command' AS check_name,
       EXISTS (
         SELECT 1 FROM pg_proc p
         JOIN pg_namespace n ON p.pronamespace = n.oid
         WHERE n.nspname = 'public' AND p.proname = 'complete_relay_command'
       ) AS ok;
