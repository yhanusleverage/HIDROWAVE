/** Ventana deslizante para gráficos del dashboard (orden: más reciente primero). */
export const CHART_HISTORY_LIMIT = 24;

/** Resync REST lento solo para corregir drift si Realtime pierde eventos. */
export const CHART_HISTORY_FALLBACK_MS = 5 * 60 * 1000;

type HistoryRow = {
  id?: number;
  created_at?: string;
  device_id?: string;
};

function isDuplicateLatest<T extends HistoryRow>(prev: T[], row: T): boolean {
  if (prev.length === 0) return false;
  const latest = prev[0];
  if (row.id != null && latest.id != null && row.id === latest.id) return true;
  if (row.created_at && latest.created_at && row.created_at === latest.created_at) return true;
  return false;
}

/**
 * Añade un punto nuevo al histórico (prepend) y recorta a `limit`.
 * Ignora filas de otro dispositivo y duplicados consecutivos.
 */
export function appendToHistoryDesc<T extends HistoryRow>(
  prev: T[],
  row: T,
  deviceId?: string,
  limit = CHART_HISTORY_LIMIT
): T[] {
  if (deviceId && row.device_id && row.device_id !== deviceId) return prev;
  if (!row.created_at) return prev;
  if (isDuplicateLatest(prev, row)) return prev;
  return [row, ...prev].slice(0, limit);
}
