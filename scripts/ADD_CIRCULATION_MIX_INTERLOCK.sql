-- Gate mezcla Auto EC/pH — telemetría / levels MQTT → device_status
ALTER TABLE device_status
  ADD COLUMN IF NOT EXISTS circulation_typed boolean,
  ADD COLUMN IF NOT EXISTS circulation_mix_ok boolean;

COMMENT ON COLUMN device_status.circulation_typed IS
  'Bomba de circulação tipada (NVS circ_slave_mac). Sem tipagem → Auto EC/pH pausado.';
COMMENT ON COLUMN device_status.circulation_mix_ok IS
  'Relé de circulação observado ON. false → interlock de mistura.';
