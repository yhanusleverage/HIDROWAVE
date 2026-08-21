-- Fix: permitir lectura service_role + SELECT policies claras
-- (si el client no bypasea RLS, verify/bridge SELECT no ve filas)
-- Executar no SQL Editor do Supabase

BEGIN;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pump_quantity TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pump_quantity_resets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pump_quantity_ledger TO service_role;

DROP POLICY IF EXISTS pump_quantity_service_all ON public.pump_quantity;
CREATE POLICY pump_quantity_service_all ON public.pump_quantity
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS pump_quantity_resets_service_all ON public.pump_quantity_resets;
CREATE POLICY pump_quantity_resets_service_all ON public.pump_quantity_resets
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS pump_quantity_ledger_service_all ON public.pump_quantity_ledger;
CREATE POLICY pump_quantity_ledger_service_all ON public.pump_quantity_ledger
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
