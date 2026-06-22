-- =====================================================
-- ec_controller_metrics — una fila por evaluación checkAutoEC
-- Preferir: RUN_CONTROLLER_METRICS_MIGRATIONS.sql (EC + pH + Realtime)
-- =====================================================

BEGIN;

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
  'Métricas de ciclo Auto EC (cada checkAutoEC con PV válido). Gráficos dashboard.';

ALTER TABLE public.ec_controller_metrics DISABLE ROW LEVEL SECURITY;

COMMIT;

-- Realtime: ejecutar DESPUÉS del COMMIT (tabla debe existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ec_controller_metrics'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ec_controller_metrics;
    RAISE NOTICE 'Realtime: ec_controller_metrics añadida';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Realtime: ec_controller_metrics ya estaba en publication';
END $$;
