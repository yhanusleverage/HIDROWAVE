-- Estado final del relé tras ACK (usado por complete_relay_command y PATCH firmware)
-- Ejecutar ANTES de PRODUCTION_RPC_COMPLETE_RELAY_COMMAND.sql si falla column "current_state"

ALTER TABLE public.relay_commands
  ADD COLUMN IF NOT EXISTS current_state boolean;

ALTER TABLE public.relay_commands
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

COMMENT ON COLUMN public.relay_commands.current_state IS
  'Estado ON/OFF del relé al completar el comando (ACK master)';
