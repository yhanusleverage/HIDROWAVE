-- Opcional: columna para routing ESP-NOW slave (no es tabla nueva)
-- El firmware lee target_device_id (MAC del slave) al pollear relay_commands.
-- Ejecutar ANTES de comandos a slaves si la columna no existe.

ALTER TABLE public.relay_commands
  ADD COLUMN IF NOT EXISTS target_device_id text DEFAULT ''::text;

COMMENT ON COLUMN public.relay_commands.target_device_id IS
  'Destino del comando: vacío = relé local master; MAC o nombre = slave ESP-NOW';
