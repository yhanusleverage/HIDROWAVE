/** Sincroniza volume do tanque (ec_config_view.volume) a partir do plano de cultivo. */

export async function syncEcTankVolumeFromWeek(
  deviceId: string,
  volumeLiters: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = deviceId?.trim();
  if (!id) return { ok: false, error: 'device_id ausente' };
  if (!Number.isFinite(volumeLiters) || volumeLiters <= 0) {
    return { ok: false, error: 'volume inválido' };
  }

  try {
    const res = await fetch('/api/ec-controller/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: id, volume: volumeLiters }),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: data.error ?? `HTTP ${res.status}` };
    }

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Erro de rede',
    };
  }
}
