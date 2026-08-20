-- Tipagem semântica de relés hidráulicos P1 (circulação, válvulas, recarga)
ALTER TABLE public.relay_master
  ADD COLUMN IF NOT EXISTS hydraulic_roles_json jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.relay_master.hydraulic_roles_json IS
  'Mapa rol→atuador: circulation_pump, fill_valve, drain_valve, recharge_pump → {target, slaveMac, relayIndex}';
