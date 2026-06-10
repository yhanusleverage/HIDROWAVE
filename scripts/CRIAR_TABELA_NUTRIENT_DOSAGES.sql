-- =====================================================
-- nutrient_dosages + ec_operation_state em relay_master
-- Registro de dosagens Auto EC (ISA-88 batch events)
-- =====================================================
-- Executar no SQL Editor do Supabase (prod)
-- =====================================================

BEGIN;

-- ─── 1. Tabela nutrient_dosages ───
CREATE TABLE IF NOT EXISTS public.nutrient_dosages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_id text NOT NULL,
  sequence_id text NOT NULL,
  nutrient_name text NOT NULL DEFAULT '',
  relay_number integer NOT NULL CHECK (relay_number >= 0 AND relay_number <= 15),
  dosage_ml numeric(10, 3) NOT NULL CHECK (dosage_ml >= 0),
  dosage_time_seconds numeric(10, 2) NOT NULL DEFAULT 0 CHECK (dosage_time_seconds >= 0),
  ec_before numeric(12, 2),
  ec_setpoint numeric(12, 2),
  source text NOT NULL DEFAULT 'auto_ec'
    CHECK (source IN ('auto_ec', 'manual', 'web')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nutrient_dosages_device_created
  ON public.nutrient_dosages (device_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nutrient_dosages_sequence
  ON public.nutrient_dosages (device_id, sequence_id);

COMMENT ON TABLE public.nutrient_dosages IS
  'Eventos de dosagem por nutriente (Auto EC). UI Status usa SUM(dosage_ml) do último sequence_id.';

-- FK opcional (ignora se device_status não existir ou FK já criada)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nutrient_dosages_device_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE public.nutrient_dosages
        ADD CONSTRAINT nutrient_dosages_device_id_fkey
        FOREIGN KEY (device_id) REFERENCES public.device_status(device_id)
        ON DELETE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
      WHEN others THEN
        RAISE NOTICE 'FK nutrient_dosages -> device_status ignorada: %', SQLERRM;
    END;
  END IF;
END $$;

-- ─── 2. Estado operacional EC em relay_master ───
ALTER TABLE public.relay_master
  ADD COLUMN IF NOT EXISTS ec_operation_state text NOT NULL DEFAULT 'idle'
    CHECK (ec_operation_state IN (
      'idle', 'dosing', 'waiting_nutrient', 'recirculating', 'ec_check_pending'
    ));

COMMENT ON COLUMN public.relay_master.ec_operation_state IS
  'Estado Auto EC: idle|dosing|recirculating|ec_check_pending (waiting_nutrient legado = dosing na UI)';

ALTER TABLE public.relay_master
  ADD COLUMN IF NOT EXISTS ec_operation_remaining_sec integer NOT NULL DEFAULT 0;

ALTER TABLE public.relay_master
  ADD COLUMN IF NOT EXISTS ec_next_check_in_sec integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.relay_master.ec_operation_remaining_sec IS
  'Segundos restantes do estado atual (recirc/waiting). Firmware atualiza a cada sync relay_master.';

COMMENT ON COLUMN public.relay_master.ec_next_check_in_sec IS
  'Segundos até próximo checkAutoEC (intervalo_auto_ec).';

-- ─── 3. RLS nutrient_dosages ───
ALTER TABLE public.nutrient_dosages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nutrient_dosages_select_own ON public.nutrient_dosages;
DROP POLICY IF EXISTS nutrient_dosages_insert_device ON public.nutrient_dosages;

CREATE POLICY nutrient_dosages_select_own ON public.nutrient_dosages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.device_status ds
      WHERE ds.device_id = nutrient_dosages.device_id
        AND lower(ds.user_email) = lower(auth.jwt() ->> 'email')
    )
  );

-- ESP32 usa anon key (mesmo padrão hydro_measurements)
CREATE POLICY nutrient_dosages_insert_device ON public.nutrient_dosages
  FOR INSERT TO anon, authenticated
  WITH CHECK (device_id IS NOT NULL AND length(trim(device_id)) > 0);

-- ─── 4. Realtime (opcional — executar se publication existir) ───
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.nutrient_dosages;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
WHEN others THEN
  RAISE NOTICE 'Realtime nutrient_dosages: %', SQLERRM;
END $$;

COMMIT;
