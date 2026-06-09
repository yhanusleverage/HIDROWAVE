-- =====================================================
-- Supabase Realtime — activar tablas para WebSocket
-- Ejecutar en Supabase SQL Editor (ignora si ya están añadidas)
-- =====================================================

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'device_status',
    'relay_master',
    'relay_slaves',
    'relay_commands',
    'hydro_measurements',
    'environment_data'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE 'Added % to supabase_realtime', t;
    EXCEPTION
      WHEN duplicate_object THEN
        RAISE NOTICE 'Already in publication: %', t;
    END;
  END LOOP;
END $$;

SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
