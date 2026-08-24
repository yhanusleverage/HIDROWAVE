-- Realtime: ec_config_view + ph_config_view (botões Auto EC / Auto pH sem F5)
-- Executar no Supabase SQL Editor se o badge "ao vivo" não aparecer.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY['ec_config_view', 'ph_config_view'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      RAISE NOTICE 'Omitido (no existe): %', t;
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
  AND tablename IN ('ec_config_view', 'ph_config_view');
