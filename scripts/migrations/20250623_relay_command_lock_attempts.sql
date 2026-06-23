-- Contador de reintentos RPC (sent timeout → 1 retry → failed)
-- Ejecutar en Supabase SQL Editor antes de PRODUCTION_RPC_GET_AND_LOCK_*.sql

ALTER TABLE public.relay_commands
  ADD COLUMN IF NOT EXISTS lock_attempts smallint NOT NULL DEFAULT 0;

-- Prioridad usada por get_and_lock (si aún no existe en prod)
ALTER TABLE public.relay_commands
  ADD COLUMN IF NOT EXISTS priority integer DEFAULT 50;

COMMENT ON COLUMN public.relay_commands.lock_attempts IS
  'Veces que un comando sent expiró sin ACK; >=1 en timeout → failed';

ALTER TABLE public.relay_commands
  ADD COLUMN IF NOT EXISTS current_state boolean;

ALTER TABLE public.relay_commands
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
