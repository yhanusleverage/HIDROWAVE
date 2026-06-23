-- Migración unificada prod: columnas faltantes en relay_commands
-- Ejecutar ANTES de PRODUCTION_RPC_GET_AND_LOCK_* y PRODUCTION_RPC_COMPLETE_RELAY_COMMAND

ALTER TABLE public.relay_commands
  ADD COLUMN IF NOT EXISTS lock_attempts smallint NOT NULL DEFAULT 0;

ALTER TABLE public.relay_commands
  ADD COLUMN IF NOT EXISTS priority integer DEFAULT 50;

ALTER TABLE public.relay_commands
  ADD COLUMN IF NOT EXISTS current_state boolean;

ALTER TABLE public.relay_commands
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

COMMENT ON COLUMN public.relay_commands.lock_attempts IS
  'Veces que un comando sent expiró sin ACK; >=1 en timeout → failed';

COMMENT ON COLUMN public.relay_commands.current_state IS
  'Estado ON/OFF del relé al completar el comando (ACK master)';
