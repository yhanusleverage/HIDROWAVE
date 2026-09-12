-- Realtime para historial de procedimentos + auto-disable UI
-- Idempotente: safe si ya están en supabase_realtime.
-- Ejecutar en Supabase SQL Editor (un solo Run).

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'procedure_events',
    'rule_config_events',
    'decision_rules',
    'relay_commands'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      RAISE NOTICE 'Omitido (tabla no existe): %', t;
      CONTINUE;
    END IF;

    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE 'Added % to supabase_realtime', t;
    EXCEPTION
      WHEN duplicate_object THEN
        RAISE NOTICE 'Already in publication: %', t;
      WHEN undefined_object THEN
        RAISE NOTICE 'Publication supabase_realtime missing — skip %', t;
    END;
  END LOOP;
END $$;

-- Verificación
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN (
    'procedure_events',
    'rule_config_events',
    'decision_rules',
    'relay_commands'
  )
ORDER BY tablename;
