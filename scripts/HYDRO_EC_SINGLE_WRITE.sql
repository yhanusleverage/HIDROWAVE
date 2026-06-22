-- hydro_measurements: un solo valor EC en escritura (µS/cm)
-- Ejecutar en Supabase SQL Editor después de ADD_HYDRO_EC_COLUMN.sql y deploy bridge ec-only.
--
-- Anula tds y ec_raw en INSERT cuando ec está presente (red de seguridad si bridge/firmware viejo).

BEGIN;

CREATE OR REPLACE FUNCTION public.hydro_measurements_ec_single_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.ec IS NOT NULL THEN
    NEW.tds := NULL;
    IF TG_OP = 'INSERT' THEN
      NEW.ec_raw := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.hydro_measurements_ec_single_write() IS
  'Fuerza inserts limpios: solo columna ec activa; tds/ec_raw null en filas nuevas.';

DROP TRIGGER IF EXISTS trg_hydro_ec_single_write ON public.hydro_measurements;

CREATE TRIGGER trg_hydro_ec_single_write
  BEFORE INSERT OR UPDATE ON public.hydro_measurements
  FOR EACH ROW
  EXECUTE FUNCTION public.hydro_measurements_ec_single_write();

COMMIT;

-- Verificar trigger
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid = 'public.hydro_measurements'::regclass
  AND tgname = 'trg_hydro_ec_single_write';

-- Filas recientes: ec poblado, tds/ec_raw null
SELECT device_id, created_at, ec, ec_raw, tds
FROM public.hydro_measurements
WHERE device_id = 'ESP32_HIDRO_269844'
ORDER BY created_at DESC
LIMIT 5;
