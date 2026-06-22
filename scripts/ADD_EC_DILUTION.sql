-- =====================================================
-- Diluição EC modo A — ec_config_view + ec_dilution_events + relay_master
-- Executar no SQL Editor do Supabase (prod)
-- =====================================================

BEGIN;

-- ─── 1. ec_config_view — campos de diluição ───
ALTER TABLE public.ec_config_view
  ADD COLUMN IF NOT EXISTS dilution_auto_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.ec_config_view
  ADD COLUMN IF NOT EXISTS dilution_drain_relay integer DEFAULT -1;

ALTER TABLE public.ec_config_view
  ADD COLUMN IF NOT EXISTS dilution_fill_relay integer DEFAULT -1;

ALTER TABLE public.ec_config_view
  ADD COLUMN IF NOT EXISTS dilution_max_volume_l double precision NOT NULL DEFAULT 50
    CHECK (dilution_max_volume_l > 0);

ALTER TABLE public.ec_config_view
  ADD COLUMN IF NOT EXISTS flowmeter_pulses_per_liter double precision NOT NULL DEFAULT 450
    CHECK (flowmeter_pulses_per_liter > 0);

ALTER TABLE public.ec_config_view
  ADD COLUMN IF NOT EXISTS dilution_fill_flow_lps double precision NOT NULL DEFAULT 0.5
    CHECK (dilution_fill_flow_lps > 0);

COMMENT ON COLUMN public.ec_config_view.dilution_auto_enabled IS
  'Auto diluição EC (overshoot): dreno parcial + reposição quando EC > SP + tolerance.';

COMMENT ON COLUMN public.ec_config_view.dilution_drain_relay IS
  'Relé master (0–7) válvula de dreno na bifurcação recirc/dreno.';

COMMENT ON COLUMN public.ec_config_view.dilution_fill_relay IS
  'Relé master (0–7) entrada de reposição de água (EC≈0).';

COMMENT ON COLUMN public.ec_config_view.dilution_max_volume_l IS
  'Volume máximo por ciclo de diluição (L) — limite de segurança.';

COMMENT ON COLUMN public.ec_config_view.flowmeter_pulses_per_liter IS
  'Calibração fluxómetro na saída do dreno (pulsos/L). Ver ADD_EC_DILUTION.sql § calibração.';

COMMENT ON COLUMN public.ec_config_view.dilution_fill_flow_lps IS
  'Vazão estimada de reposição (L/s) para fase fill por tempo quando não há fluxómetro no fill.';

-- volume (L) em ec_config_view já existe — firmware usa como V_tanque

-- ─── 2. relay_master — progresso diluição ───
ALTER TABLE public.relay_master
  ADD COLUMN IF NOT EXISTS ec_dilution_target_l double precision;

ALTER TABLE public.relay_master
  ADD COLUMN IF NOT EXISTS ec_dilution_progress_l double precision;

COMMENT ON COLUMN public.relay_master.ec_dilution_target_l IS
  'Volume alvo (L) do ciclo diluting_* atual.';

COMMENT ON COLUMN public.relay_master.ec_dilution_progress_l IS
  'Volume medido (L) na fase de dreno — atualizado pelo firmware/bridge.';

-- Ampliar CHECK ec_operation_state (drop + recreate se existir)
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.relay_master'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%ec_operation_state%'
  LIMIT 1;

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.relay_master DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.relay_master
  ADD CONSTRAINT relay_master_ec_operation_state_check
  CHECK (ec_operation_state IN (
    'idle',
    'dosing',
    'waiting_nutrient',
    'recirculating',
    'ec_check_pending',
    'diluting_draining',
    'diluting_filling'
  ));

-- ─── 3. ec_dilution_events ───
CREATE TABLE IF NOT EXISTS public.ec_dilution_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_id text NOT NULL,
  sequence_id text NOT NULL,
  source text NOT NULL DEFAULT 'auto'
    CHECK (source IN ('auto', 'manual', 'web')),
  ec_before numeric(12, 2),
  ec_setpoint numeric(12, 2),
  volume_target_l numeric(10, 3) NOT NULL CHECK (volume_target_l >= 0),
  volume_measured_l numeric(10, 3) NOT NULL CHECK (volume_measured_l >= 0),
  drain_duration_s numeric(10, 2),
  fill_duration_s numeric(10, 2),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ec_dilution_events_device_created
  ON public.ec_dilution_events (device_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ec_dilution_events_sequence
  ON public.ec_dilution_events (device_id, sequence_id);

COMMENT ON TABLE public.ec_dilution_events IS
  'Eventos de diluição EC modo A (dreno + reposição). Bridge MQTT hidrowave/+/ec_dilution.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ec_dilution_events_device_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE public.ec_dilution_events
        ADD CONSTRAINT ec_dilution_events_device_id_fkey
        FOREIGN KEY (device_id) REFERENCES public.device_status(device_id)
        ON DELETE CASCADE;
    EXCEPTION
      WHEN others THEN
        RAISE NOTICE 'FK ec_dilution_events -> device_status ignorada: %', SQLERRM;
    END;
  END IF;
END $$;

ALTER TABLE public.ec_dilution_events DISABLE ROW LEVEL SECURITY;

-- Realtime (opcional — executar ENABLE_REALTIME_REPLICATION.sql se necessário)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'ec_dilution_events'
  ) THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.ec_dilution_events;
    EXCEPTION
      WHEN others THEN
        RAISE NOTICE 'Realtime ec_dilution_events: %', SQLERRM;
    END;
  END IF;
END $$;

COMMIT;

-- =====================================================
-- § Calibração banco hidráulico (modo A)
-- =====================================================
-- 1. Conectar fluxómetro YF-S201 na saída do dreno (GPIO26 default).
-- 2. Abrir só válvula de dreno; drenar volume conhecido (ex. 10 L medidos).
-- 3. Contar pulsos no serial [FLOWMETER] ou registrar evento.
-- 4. pulses_per_liter = pulsos_totais / litros_drenados.
-- 5. Ajustar dilution_drain_relay e dilution_fill_relay na UI Automação.
-- 6. Verificar dilution_fill_flow_lps medindo tempo para encher 1 L na reposição.
-- 7. dilution_max_volume_l ≤ 30% do volume do tanque em produção inicial.
-- Valores iniciais sugeridos: tank=100 L, ppl=450, max=30 L, tolerance=50 µS/cm.
