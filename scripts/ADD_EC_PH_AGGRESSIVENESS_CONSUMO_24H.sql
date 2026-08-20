-- =====================================================
-- Agresividad EC + Consumo 24 h (EC y pH)
-- Mismo camino HTTPS que auto_enabled:
--   GET /rest/v1/ec_config_view?device_id=eq.{id}&select=*
--   GET /rest/v1/ph_config_view?device_id=eq.{id}&select=*
-- Executar no SQL Editor do Supabase
-- =====================================================

BEGIN;

ALTER TABLE public.ec_config_view
  ADD COLUMN IF NOT EXISTS aggressiveness double precision DEFAULT 0.5;

ALTER TABLE public.ec_config_view
  ADD COLUMN IF NOT EXISTS consumo_24h boolean NOT NULL DEFAULT false;

ALTER TABLE public.ph_config_view
  ADD COLUMN IF NOT EXISTS consumo_24h boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ec_config_view_aggressiveness_check'
  ) THEN
    ALTER TABLE public.ec_config_view
      ADD CONSTRAINT ec_config_view_aggressiveness_check
      CHECK (aggressiveness >= 0.05 AND aggressiveness <= 1.0);
  END IF;
END $$;

UPDATE public.ec_config_view
SET aggressiveness = 0.5
WHERE aggressiveness IS NULL;

COMMENT ON COLUMN public.ec_config_view.aggressiveness IS
  'Tope de paso Auto EC (fracción 0.05–1.0). UI 5–100 %. UART HMI maxStepEc. No duplica kp.';

COMMENT ON COLUMN public.ec_config_view.consumo_24h IS
  'Capa Consumo EC 24 h sobre Auto EC (UART consumoDiario). Default OFF. No cambia intervalo_auto_ec.';

COMMENT ON COLUMN public.ph_config_view.consumo_24h IS
  'Capa Consumo pH 24 h sobre Auto pH (UART consumoPh24h). Default OFF. No cambia intervalo_auto_ph.';

COMMIT;
