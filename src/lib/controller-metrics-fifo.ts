export const METRICS_LIMIT = 120;
export const METRICS_WINDOW_MS = 24 * 60 * 60 * 1000;
export const METRICS_MAX_ROWS = METRICS_LIMIT;

type MetricRowBase = { id?: number; created_at?: string };

/** Orden cronológico ascendente (más antiguo → más nuevo). */
export function sortMetricsByTime<T extends MetricRowBase>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
    if (Number.isNaN(ta)) return -1;
    if (Number.isNaN(tb)) return 1;
    return ta - tb;
  });
}

/** Ventana 24h + FIFO: conserva solo los últimos METRICS_MAX_ROWS puntos. */
export function trimMetricsRows<T extends MetricRowBase>(rows: T[]): T[] {
  const cutoff = Date.now() - METRICS_WINDOW_MS;
  const sorted = sortMetricsByTime(rows);
  const filtered = sorted.filter((r) => {
    if (!r.created_at) return true;
    const t = new Date(r.created_at).getTime();
    return !Number.isNaN(t) && t >= cutoff;
  });
  return filtered.slice(-METRICS_MAX_ROWS);
}

/** Añade fila nueva; dedup solo por id; descarta la más antigua si supera el límite. */
export function appendMetricRow<T extends MetricRowBase>(prev: T[], row: T): T[] {
  if (row.id != null && prev.some((r) => r.id === row.id)) return prev;
  return trimMetricsRows([...prev, row]);
}
