-- =====================================================
-- Colunas ph_operation_* em relay_master + ph_dosages
-- =====================================================

ALTER TABLE public.relay_master
  ADD COLUMN IF NOT EXISTS ph_operation_state text NOT NULL DEFAULT 'idle'
    CHECK (ph_operation_state IN (
      'idle', 'dosing', 'recirculating', 'ph_check_pending'
    ));

ALTER TABLE public.relay_master
  ADD COLUMN IF NOT EXISTS ph_operation_remaining_sec integer NOT NULL DEFAULT 0;

ALTER TABLE public.relay_master
  ADD COLUMN IF NOT EXISTS ph_next_check_in_sec integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.relay_master.ph_operation_state IS
  'Estado operacional Auto pH publicado pelo firmware.';

CREATE TABLE IF NOT EXISTS public.ph_dosages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_id TEXT NOT NULL,
  sequence_id TEXT,
  direction TEXT CHECK (direction IN ('up', 'down')),
  relay_number INTEGER,
  dosage_ml DOUBLE PRECISION DEFAULT 0,
  dosage_time_seconds DOUBLE PRECISION DEFAULT 0,
  ph_before DOUBLE PRECISION,
  ph_setpoint DOUBLE PRECISION,
  source TEXT DEFAULT 'auto_ph',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ph_dosages_device_created
  ON public.ph_dosages(device_id, created_at DESC);

ALTER TABLE public.ph_dosages DISABLE ROW LEVEL SECURITY;
