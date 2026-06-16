-- =====================================================
-- Supabase Realtime — activar tablas para WebSocket
-- Solo añade tablas que EXISTEN (evita error 42P01)
-- Métricas: ejecutar RUN_CONTROLLER_METRICS_MIGRATIONS.sql antes
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
    'environment_data',
    'nutrient_dosages',
    'ph_dosages',
    'ec_controller_metrics',
    'ph_controller_metrics'
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
    END;
  END LOOP;
END $$;

SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
