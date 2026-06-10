-- Sprint A: banda muerta configurable para control EC (µS/cm)
ALTER TABLE public.ec_config_view
  ADD COLUMN IF NOT EXISTS tolerance DOUBLE PRECISION DEFAULT 50.0;

COMMENT ON COLUMN public.ec_config_view.tolerance IS
  'Deadband µS/cm — |SP-PV| debe superar esto para dosar (default 50, alineado firmware)';
