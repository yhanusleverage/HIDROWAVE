-- Paso 0: Verificación schema prod (ejecutar en Supabase SQL Editor)

-- 1. Columnas reales de relay_commands
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'relay_commands'
ORDER BY ordinal_position;

-- 2. Últimos comandos y transiciones de estado
SELECT id, device_id, relay_number, action, duration_seconds,
       status, created_at, sent_at, completed_at, error_message
FROM public.relay_commands
ORDER BY created_at DESC
LIMIT 15;

-- 3. ¿Existe decision_rules?
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'decision_rules'
) AS decision_rules_exists;

-- 4. Tablas en Realtime
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
