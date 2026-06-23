# Railway — variables MQTT para Fase 3 comandos

**Objetivo:** que la UI en Railway publique a `hidrowave/{device_id}/command` tras cada INSERT en `relay_commands`, reduciendo latencia vs poll HTTPS (~60s).

**Código:** [`src/lib/mqtt-command-publish.ts`](../src/lib/mqtt-command-publish.ts) — si faltan credenciales, skip silencioso (ESP usa poll HTTPS).

---

## Variables en Railway Dashboard

Servicio **HIDROWAVE frontend** → Variables:

| Variable | Ejemplo | Notas |
|----------|---------|-------|
| `MQTT_HOST` | `99.79.36.220` | IP/host del broker Mosquitto (Lightsail) |
| `MQTT_PORT` | `1883` | Default 1883 |
| `MQTT_PUBLISH_USER` | `hidrowave` | Usuario con ACL **write** en `hidrowave/+/command` |
| `MQTT_PUBLISH_PASS` | `***` | Password del usuario publish |

Alternativa (fallback en código): `MQTT_USER` / `MQTT_PASS` si no defines `MQTT_PUBLISH_*`.

**No** commitear passwords — solo en Railway o `.env.local` local.

---

## Desarrollo local (`.env.local`)

```env
MQTT_HOST=99.79.36.220
MQTT_PORT=1883
MQTT_PUBLISH_USER=hidrowave
MQTT_PUBLISH_PASS=tu_password
```

Reiniciar `npm run dev` tras añadir variables.

---

## Verificación E2E

**Health check (sem expor password):**

```
GET /api/health/mqtt-env
```

Local: `npm run verify:mqtt-publish-env`

### Master local

1. Toggle relé em `/automacao` (master local).
2. **Logs Railway** (deploy logs / runtime):
   ```
   [MQTT CMD] published id=… type=manual pri=10 → hidrowave/ESP32_HIDRO_1A575C/command
   ```
3. **Serial ESP32:**
   ```
   [MQTT] rx command topic=hidrowave/ESP32_HIDRO_1A575C/command
   [CMD mqtt] id=… slave R… via=mqtt
   [MQTT] command_ack id=… relay=… state=…
   ✅ [ACK] relay_commands id=… → completed
   ```
4. Supabase: fila `relay_commands` pasa `pending` → `completed` en &lt;2s.

Si no hay `[MQTT CMD] published` → revisar env vars. Si hay publish pero no `[CMD mqtt]` → ACL Mosquitto o firewall `:1883`.

### Slave ESP-NOW

1. Toggle relé slave no painel ESP-NOW.
2. Logs Railway: `[MQTT CMD] published …` com `target_device_id` no payload.
3. Serial master: `[CMD mqtt] … slave …` + `📡 [ESP-NOW] Comando para slave`.
4. Guia completa: [`MQTT_COMANDOS_RAPIDOS_SLAVES.md`](MQTT_COMANDOS_RAPIDOS_SLAVES.md).

---

## ACL Mosquitto (Lightsail)

El usuario publish debe poder escribir en:

```
topic write hidrowave/+/command
```

(o por device: `topic write hidrowave/ESP32_HIDRO_XXXXXX/#` — suficiente para un master)

**Verificado en VM (2026-06):** user `hidrowave` com `write hidrowave/+/command` — publish para qualquer master permitido.

Ver [`ESP-HIDROWAVE-main/docs/mqtt/HANDOFF_FASE3_COMANDOS_HIBRIDOS.md`](../../ESP-HIDROWAVE-main/docs/mqtt/HANDOFF_FASE3_COMANDOS_HIBRIDOS.md) §5.

Patch na VM: `sudo bash patch-acl-hidrowave-publish.sh` (em `ESP-HIDROWAVE-main/infra/mqtt/mosquitto/`).

---

## Relacionado

- [`HANDOFF_RELAY_COMMANDS_MANUAL_14JUN2026.md`](HANDOFF_RELAY_COMMANDS_MANUAL_14JUN2026.md) — ciclo manual Dosificar
- [`scripts/BANCADA_MANUAL_COMMANDS_KPI.md`](../scripts/BANCADA_MANUAL_COMMANDS_KPI.md) — KPI 10 comandos
- [`MQTT_COMANDOS_RAPIDOS_SLAVES.md`](MQTT_COMANDOS_RAPIDOS_SLAVES.md) — slaves ESP-NOW
