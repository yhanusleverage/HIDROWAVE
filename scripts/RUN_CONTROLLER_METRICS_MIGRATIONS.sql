-- =====================================================
-- Migración métricas de ciclo EC/pH — ORDEN OBLIGATORIO
-- Ejecutar TODO este archivo en SQL Editor (prod)
-- NO ejecutar ENABLE_REALTIME antes de crear las tablas
-- =====================================================

BEGIN;

-- ─── 1. ec_controller_metrics ───
CREATE TABLE IF NOT EXISTS public.ec_controller_metrics (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_id text NOT NULL,
  ec_setpoint numeric(12, 2) NOT NULL,
  ec_actual numeric(12, 2) NOT NULL,
  ec_error numeric(12, 2) NOT NULL,
  k_value numeric(12, 6),
  dosage_ml numeric(10, 3) NOT NULL DEFAULT 0,
  dosage_time_seconds numeric(10, 2) NOT NULL DEFAULT 0,
  base_dose numeric(12, 2),
  flow_rate numeric(10, 4),
  volume numeric(10, 2),
  total_ml numeric(10, 3),
  kp numeric(10, 4),
  auto_enabled boolean NOT NULL DEFAULT true,
  adjustment_needed boolean NOT NULL DEFAULT false,
  adjustment_applied boolean NOT NULL DEFAULT false,
  sequence_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ec_controller_metrics_device_created
  ON public.ec_controller_metrics (device_id, created_at DESC);

COMMENT ON TABLE public.ec_controller_metrics IS
  'Métricas de ciclo Auto EC (cada checkAutoEC con PV válido). NO confundir con nutrient_dosages.';

ALTER TABLE public.ec_controller_metrics DISABLE ROW LEVEL SECURITY;

-- ─── 2. ph_controller_metrics ───
CREATE TABLE IF NOT EXISTS public.ph_controller_metrics (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_id text NOT NULL,
  ph_setpoint numeric(6, 3) NOT NULL,
  ph_before numeric(8, 3) NOT NULL,
  error_h double precision,
  direction text CHECK (direction IS NULL OR direction IN ('up', 'down')),
  k_acid double precision,
  k_base double precision,
  k_used double precision,
  dose_ideal_ml numeric(10, 3) NOT NULL DEFAULT 0,
  dose_real_ml numeric(10, 3) NOT NULL DEFAULT 0,
  dosage_time_seconds numeric(10, 2) NOT NULL DEFAULT 0,
  aggressiveness numeric(6, 3),
  auto_enabled boolean NOT NULL DEFAULT true,
  adjustment_needed boolean NOT NULL DEFAULT false,
  adjustment_applied boolean NOT NULL DEFAULT false,
  sequence_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ph_controller_metrics_device_created
  ON public.ph_controller_metrics (device_id, created_at DESC);

COMMENT ON TABLE public.ph_controller_metrics IS
  'Métricas de ciclo Auto pH (cada checkAutoPH con PV válido). NO confundir con ph_dosages.';

ALTER TABLE public.ph_controller_metrics DISABLE ROW LEVEL SECURITY;

COMMIT;

-- ─── 3. Realtime (solo si las tablas existen) ───
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['ec_controller_metrics', 'ph_controller_metrics'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        RAISE NOTICE 'Realtime OK: %', t;
      EXCEPTION
        WHEN duplicate_object THEN
          RAISE NOTICE 'Realtime ya tenía: %', t;
      END;
    ELSE
      RAISE WARNING 'Tabla % no existe — omitiendo Realtime', t;
    END IF;
  END LOOP;
END $$;

-- Verificación rápida
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('ec_controller_metrics', 'ph_controller_metrics');
