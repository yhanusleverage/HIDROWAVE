-- =====================================================
-- Calibragem química pH — seeds ácido/base separados
-- =====================================================

ALTER TABLE public.ph_config_view
  ADD COLUMN IF NOT EXISTS ml_per_ph_unit_acid DOUBLE PRECISION DEFAULT 2.0
    CHECK (ml_per_ph_unit_acid > 0);

ALTER TABLE public.ph_config_view
  ADD COLUMN IF NOT EXISTS ml_per_ph_unit_base DOUBLE PRECISION DEFAULT 2.0
    CHECK (ml_per_ph_unit_base > 0);

COMMENT ON COLUMN public.ph_config_view.ml_per_ph_unit_acid IS
  'ml para mover 1 unidade pH no tanque (bomba pH−/ácido) — calibragem em /calibragem';

COMMENT ON COLUMN public.ph_config_view.ml_per_ph_unit_base IS
  'ml para mover 1 unidade pH no tanque (bomba pH+/base) — calibragem em /calibragem';

-- Backfill a partir de ml_per_ph_unit legacy
UPDATE public.ph_config_view
SET
  ml_per_ph_unit_acid = COALESCE(ml_per_ph_unit_acid, ml_per_ph_unit, 2.0),
  ml_per_ph_unit_base = COALESCE(ml_per_ph_unit_base, ml_per_ph_unit, 2.0)
WHERE ml_per_ph_unit_acid IS NULL OR ml_per_ph_unit_base IS NULL;
