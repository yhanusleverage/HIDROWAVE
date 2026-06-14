-- =====================================================
-- Controlador Adaptativo pH — colunas em ph_config_view
-- =====================================================

ALTER TABLE public.ph_config_view
  ADD COLUMN IF NOT EXISTS aggressiveness DOUBLE PRECISION DEFAULT 0.5
    CHECK (aggressiveness >= 0.05 AND aggressiveness <= 1.0);

ALTER TABLE public.ph_config_view
  ADD COLUMN IF NOT EXISTS gain_alpha DOUBLE PRECISION DEFAULT 0.2
    CHECK (gain_alpha >= 0.05 AND gain_alpha <= 0.5);

ALTER TABLE public.ph_config_view
  ADD COLUMN IF NOT EXISTS k_acid DOUBLE PRECISION;

ALTER TABLE public.ph_config_view
  ADD COLUMN IF NOT EXISTS k_base DOUBLE PRECISION;

ALTER TABLE public.ph_config_view
  ADD COLUMN IF NOT EXISTS max_dose_ml_per_cycle DOUBLE PRECISION DEFAULT 50
    CHECK (max_dose_ml_per_cycle > 0);

ALTER TABLE public.ph_config_view
  ADD COLUMN IF NOT EXISTS max_pulse_seconds INTEGER DEFAULT 120
    CHECK (max_pulse_seconds > 0);

ALTER TABLE public.ph_config_view
  ADD COLUMN IF NOT EXISTS max_consecutive_corrections INTEGER DEFAULT 5
    CHECK (max_consecutive_corrections > 0);

ALTER TABLE public.ph_config_view
  ADD COLUMN IF NOT EXISTS reset_k_gains BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.ph_config_view.aggressiveness IS
  'Knob operador A (0.05–1.0): DoseReal = A × |ErroH|/K';

COMMENT ON COLUMN public.ph_config_view.k_acid IS
  'Ganho aprendido Kacid (µH/ml) — telemetria firmware, read-only na UI';

COMMENT ON COLUMN public.ph_config_view.k_base IS
  'Ganho aprendido Kbase (µH/ml) — telemetria firmware, read-only na UI';

COMMENT ON TABLE public.ph_config_view IS
  'Configuração Auto pH adaptativo. Poll firmware: GET ph_config_view (read-only). Ativar: RPC activate_auto_ph.';
