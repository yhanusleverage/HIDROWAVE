-- =============================================================================
-- ADD level_interlock_mode — Normal (≠vazio) | Carrera (solo alto)
-- =============================================================================
-- Ejecutar en Supabase SQL Editor (idempotente).
-- Mirror de ESP-HIDROWAVE-main/scripts/ADD_LEVEL_INTERLOCK_MODE.sql
-- =============================================================================

ALTER TABLE public.device_status
  ADD COLUMN IF NOT EXISTS level_interlock_mode text DEFAULT 'normal';

COMMENT ON COLUMN public.device_status.level_interlock_mode IS
  'Modo interlock Auto EC/pH: normal (=≠vazio) | carrera (=solo alto 4/4)';

UPDATE public.device_status
SET level_interlock_mode = 'normal'
WHERE level_interlock_mode IS NULL
   OR level_interlock_mode NOT IN ('normal', 'carrera');
