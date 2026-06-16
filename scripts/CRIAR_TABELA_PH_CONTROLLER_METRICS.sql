-- =====================================================
-- ph_controller_metrics — una fila por evaluación checkAutoPH
-- Preferir: RUN_CONTROLLER_METRICS_MIGRATIONS.sql (EC + pH + Realtime)
-- =====================================================

BEGIN;

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
  'Métricas de ciclo Auto pH (dominio H). Gráficos dashboard.';

ALTER TABLE public.ph_controller_metrics DISABLE ROW LEVEL SECURITY;

COMMIT;

-- Realtime: ejecutar DESPUÉS del COMMIT (tabla debe existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ph_controller_metrics'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ph_controller_metrics;
    RAISE NOTICE 'Realtime: ph_controller_metrics añadida';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Realtime: ph_controller_metrics ya estaba en publication';
END $$;
