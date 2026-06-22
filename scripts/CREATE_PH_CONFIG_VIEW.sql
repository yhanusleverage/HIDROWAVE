-- =====================================================
-- ph_config_view — configuração Auto pH (espejo ec_config_view)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ph_config_view (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  device_id TEXT NOT NULL UNIQUE,

  ph_setpoint DOUBLE PRECISION DEFAULT 6.0,
  ph_tolerance DOUBLE PRECISION DEFAULT 0.2,
  flow_rate_ph_up DOUBLE PRECISION DEFAULT 1.0,
  flow_rate_ph_down DOUBLE PRECISION DEFAULT 1.0,
  volume DOUBLE PRECISION DEFAULT 100,
  ml_per_ph_unit DOUBLE PRECISION DEFAULT 2.0,
  relay_ph_up INTEGER DEFAULT 1,
  relay_ph_down INTEGER DEFAULT 0,

  auto_enabled BOOLEAN DEFAULT false,
  intervalo_auto_ph INTEGER DEFAULT 300 CHECK (intervalo_auto_ph > 0),
  tempo_recirculacao INTEGER DEFAULT 60 CHECK (tempo_recirculacao > 0),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT DEFAULT 'web_interface',

  CONSTRAINT fk_ph_config_view_device FOREIGN KEY (device_id) REFERENCES device_status(device_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ph_config_view_device_id ON public.ph_config_view(device_id);

CREATE OR REPLACE FUNCTION update_ph_config_view_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ph_config_view_updated_at ON public.ph_config_view;
CREATE TRIGGER trigger_update_ph_config_view_updated_at
  BEFORE UPDATE ON public.ph_config_view
  FOR EACH ROW
  EXECUTE FUNCTION update_ph_config_view_updated_at();

ALTER TABLE public.ph_config_view DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.ph_config_view IS
  'Configuração Auto pH. Salvar via API /api/ph-controller/config; ativar via RPC activate_auto_ph.';
