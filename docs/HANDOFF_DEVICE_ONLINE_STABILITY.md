# Handoff — Estabilidad online/offline (device_status)

**Fecha:** jun/2026  
**Síntoma resuelto:** dispositivo pasa a rojo/offline tras minutos en cualquier página; F5 lo corrige; el ESP sigue online.

**Relacionado:** [`MQTT_INTEGRACAO_FRONTEND.md`](MQTT_INTEGRACAO_FRONTEND.md), [`PRODUCTION_ROADMAP.md`](PRODUCTION_ROADMAP.md)

---

## 1. Qué pasaba

| Observación | Causa |
|-------------|--------|
| Online al cargar | REST inicial trae `last_seen` fresco |
| Offline tras ~2–5 min | Estado React envejecido + tick local; Realtime WSS puede dejar de emitir |
| Bridge `is_online=false` | Stale checker 120s sin heartbeat procesado en bridge |
| F5 corrige | `getUserDevices()` vuelve a leer Supabase |

---

## 2. Fixes implementados (repo)

| Capa | Archivo | Cambio |
|------|---------|--------|
| UI regla online | [`src/lib/realtime/device-status.ts`](../src/lib/realtime/device-status.ts) | `last_seen` fresco prevalece sobre `is_online=false` stale; umbral **5 min** |
| Hook global | [`src/hooks/useDevicesWithRealtime.ts`](../src/hooks/useDevicesWithRealtime.ts) | Poll REST silencioso cada **90s**; reconexión WSS en `TIMED_OUT` / `CHANNEL_ERROR` |
| Bridge | [`ESP-HIDROWAVE-main/infra/mqtt/bridge/index.js`](../../ESP-HIDROWAVE-main/infra/mqtt/bridge/index.js) | Heartbeat throttled aún actualiza `lastHeartbeatAtByDevice` (evita falso stale) |

---

## 3. Regla `resolveDeviceOnline` (única fuente UI)

```
1. Si last_seen < 5 min → ONLINE (aunque is_online=false del bridge)
2. Si is_online=false y last_seen viejo → OFFLINE
3. Sin last_seen → OFFLINE
```

---

## 4. Checklist deploy

- [ ] Deploy frontend HIDROWAVE (Railway/local) con hooks nuevos
- [ ] Redeploy bridge Lightsail si aún no tiene fix heartbeat throttle
- [ ] Abrir `/dispositivos` o `/automacao` — dejar 10+ min sin F5
- [ ] Device debe permanecer online si ESP envía status/heartbeat

### Validación manual

1. Cargar `/automacao` — master verde
2. Esperar 10 min sin recargar
3. Master sigue verde (o warning si latencia > 1 min, no offline)
4. Consola: `[Realtime] device_status SUBSCRIBED` sin errores persistentes

---

## 5. Troubleshooting

| Síntoma | Acción |
|---------|--------|
| Sigue offline a los 5 min | Verificar `last_seen` en Supabase SQL — ¿ESP actualiza cada 60s? |
| Offline inmediato tras bridge restart | Normal hasta próximo heartbeat; debe recuperar < 90s (poll REST) |
| Realtime CHANNEL_ERROR | Ejecutar `ENABLE_REALTIME_REPLICATION.sql` (`device_status`) |
| Solo HTTPS, sin MQTT | Asegurar `sendDeviceStatusToSupabase` cada 60s en firmware |

```sql
SELECT device_id, is_online, last_seen,
       NOW() - last_seen::timestamptz AS age
FROM device_status
WHERE device_id = 'ESP32_HIDRO_269844';
```

---

## 6. Pendiente opcional (nivel 3)

- Aumentar `HEARTBEAT_STALE_MS` en bridge a 300000 (5 min) para alinear con UI
- RLS `device_status` ([`PRODUCTION_ROADMAP.md`](PRODUCTION_ROADMAP.md))
- Métricas: contador reconexiones WSS en UI

---

**Próximo paso:** cerrar [`HANDOFF_AUTO_PH_E2E.md`](HANDOFF_AUTO_PH_E2E.md) en bancada.
