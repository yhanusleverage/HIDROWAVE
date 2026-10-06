/** Bomba 1 = relé 0. El nombre de la solución no es el rol pH+ / pH-. */

export function pumpNumberLabel(relay: number): string {
  return `Bomba ${relay + 1}`;
}

function fold(value: string): string {
  return value.trim().toLowerCase().replace(/−/g, '-');
}

/** Nombre que el usuario escribió en la tarjeta. Relé N, Bomba N y pH+/pH- no cuentan. */
export function isSolutionName(name: string | null | undefined, relay: number): boolean {
  const raw = (name ?? '').trim();
  if (!raw) return false;
  const key = fold(raw);
  if (
    key === 'ph+' ||
    key === 'ph-' ||
    key === 'ph+ (base)' ||
    key === 'ph- (acido)' ||
    key === 'ph- (ácido)'
  ) {
    return false;
  }
  if (key === `rele ${relay}` || key === `relé ${relay}` || key === `relay ${relay}`) {
    return false;
  }
  if (key === pumpNumberLabel(relay).toLowerCase() || key === `pump ${relay + 1}`) {
    return false;
  }
  return true;
}

export function nutrientNameFromPump(relay: number, storedName?: string | null): string {
  if (isSolutionName(storedName, relay)) return (storedName ?? '').trim();
  return pumpNumberLabel(relay);
}

export function cardTitle(
  kind: 'ec' | 'ph_up' | 'ph_down',
  relay: number,
  raw?: string | null
): string {
  if (kind === 'ph_up') return 'pH+';
  if (kind === 'ph_down') return 'pH-';
  return nutrientNameFromPump(relay, raw);
}
