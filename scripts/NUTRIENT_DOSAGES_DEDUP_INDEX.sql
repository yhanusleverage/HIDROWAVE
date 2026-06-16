-- Dedup histórico + índice único para nutrient_dosages / ph_dosages.
-- Motivo: bridge MQTT já inseriu linhas; firmware HTTPS backup precisa do índice
-- para upsert/ignoreDuplicates sem erro 23505.
-- Executar no SQL Editor do Supabase (prod).

BEGIN;

-- ─── 0. Diagnóstico (opcional — correr sozinho antes do BEGIN se quiser preview) ───
-- SELECT device_id, sequence_id, nutrient_name, relay_number, COUNT(*) AS n
-- FROM public.nutrient_dosages
-- GROUP BY 1, 2, 3, 4
-- HAVING COUNT(*) > 1
-- ORDER BY n DESC;

-- ─── 1. nutrient_dosages: manter a linha mais antiga (menor id) por chave lógica ───
DELETE FROM public.nutrient_dosages AS a
USING public.nutrient_dosages AS b
WHERE a.device_id = b.device_id
  AND a.sequence_id = b.sequence_id
  AND a.nutrient_name = b.nutrient_name
  AND a.relay_number = b.relay_number
  AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_nutrient_dosages_dedup
  ON public.nutrient_dosages (device_id, sequence_id, nutrient_name, relay_number);

COMMENT ON INDEX public.idx_nutrient_dosages_dedup IS
  'Dedup: um nutriente por sequence_id/relé por device (MQTT bridge + HTTPS backup ESP).';

-- ─── 2. ph_dosages (se existir) ───
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ph_dosages'
  ) THEN
    DELETE FROM public.ph_dosages AS a
    USING public.ph_dosages AS b
    WHERE a.device_id = b.device_id
      AND a.sequence_id = b.sequence_id
      AND a.direction = b.direction
      AND a.relay_number = b.relay_number
      AND a.id > b.id;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_ph_dosages_dedup
      ON public.ph_dosages (device_id, sequence_id, direction, relay_number);
  END IF;
END $$;

COMMENT ON INDEX public.idx_ph_dosages_dedup IS
  'Dedup: uma direção pH por sequence_id/relé por device.';

COMMIT;

-- Verificação pós-migration:
-- SELECT COUNT(*) FROM nutrient_dosages WHERE device_id = 'ESP32_HIDRO_269844';
-- SELECT device_id, sequence_id, nutrient_name, relay_number, COUNT(*)
-- FROM nutrient_dosages GROUP BY 1,2,3,4 HAVING COUNT(*) > 1;
