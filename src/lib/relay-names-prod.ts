/**
 * Nomes de relés — schema prod (relay_master / relay_slaves, sem relay_names).
 */

export type MasterRelayNameRow = {
  doser_relay_names?: string[] | null;
  level_relay_names?: string[] | null;
  reserved_relay_names?: string[] | null;
};

/** relay_number 0–15 → mapa de nomes do master. */
export function masterRelayNamesToMap(row: MasterRelayNameRow): Record<number, string> {
  const map: Record<number, string> = {};
  const doser = row.doser_relay_names || [];
  const level = row.level_relay_names || [];
  const reserved = row.reserved_relay_names || [];

  doser.forEach((name, i) => {
    if (name && String(name).trim()) map[i] = String(name).trim();
  });
  level.forEach((name, i) => {
    if (name && String(name).trim()) map[i + 8] = String(name).trim();
  });
  reserved.forEach((name, i) => {
    if (name && String(name).trim()) map[i + 12] = String(name).trim();
  });

  return map;
}

export function slaveRelayNamesToMap(names?: string[] | null): Record<number, string> {
  const map: Record<number, string> = {};
  (names || []).forEach((name, i) => {
    if (name && String(name).trim()) map[i] = String(name).trim();
  });
  return map;
}

export function patchMasterRelayNameArrays(
  relayNumber: number,
  relayName: string,
  current: MasterRelayNameRow
): MasterRelayNameRow {
  const doser = [...(current.doser_relay_names || Array(8).fill(''))];
  const level = [...(current.level_relay_names || Array(4).fill(''))];
  const reserved = [...(current.reserved_relay_names || Array(4).fill(''))];

  while (doser.length < 8) doser.push('');
  while (level.length < 4) level.push('');
  while (reserved.length < 4) reserved.push('');

  if (relayNumber >= 0 && relayNumber <= 7) doser[relayNumber] = relayName;
  else if (relayNumber >= 8 && relayNumber <= 11) level[relayNumber - 8] = relayName;
  else if (relayNumber >= 12 && relayNumber <= 15) reserved[relayNumber - 12] = relayName;

  return {
    doser_relay_names: doser,
    level_relay_names: level,
    reserved_relay_names: reserved,
  };
}

export function patchSlaveRelayNamesArray(
  relayNumber: number,
  relayName: string,
  current?: string[] | null
): string[] {
  const names = [...(current || Array(8).fill(''))];
  while (names.length < 8) names.push('');
  if (relayNumber >= 0 && relayNumber < names.length) {
    names[relayNumber] = relayName;
  }
  return names;
}
