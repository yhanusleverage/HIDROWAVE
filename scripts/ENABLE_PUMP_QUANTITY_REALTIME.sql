-- =====================================================
-- Realtime: pump_quantity → WebSocket (aba Quantidade)
-- Ejecutar en Supabase SQL Editor si el badge no llega a "Ao vivo"
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pump_quantity'
  ) THEN
    RAISE NOTICE 'Omitido: public.pump_quantity no existe (correr ADD_PUMP_QUANTITY.sql antes)';
    RETURN;
  END IF;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pump_quantity;
    RAISE NOTICE 'Added pump_quantity to supabase_realtime';
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE 'Already in publication: pump_quantity';
  END;
END $$;

SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename = 'pump_quantity';
