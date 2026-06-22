# Bancada — KPI comandos manuales (Fase 3 master + slave ESP-NOW)

**Device:** `ESP32_HIDRO_269844` · **Handoff:** [`HANDOFF_RELAY_COMMANDS_MANUAL_14JUN2026.md`](../docs/HANDOFF_RELAY_COMMANDS_MANUAL_14JUN2026.md) · **Slaves:** [`MQTT_COMANDOS_RAPIDOS_SLAVES.md`](../docs/MQTT_COMANDOS_RAPIDOS_SLAVES.md)

---

## Pre-requisitos

- [ ] Firmware actual flasheado (ACK en `relay_commands` — [`SupabaseClient.cpp`](../../ESP-HIDROWAVE-main/src/SupabaseClient.cpp))
- [ ] SQL stuck ejecutado: [`VERIFICAR_RELAY_COMMANDS_STUCK.sql`](VERIFICAR_RELAY_COMMANDS_STUCK.sql)
- [ ] Railway: env `MQTT_*` — [`RAILWAY_MQTT_VARIABLES.template`](RAILWAY_MQTT_VARIABLES.template) + [`RAILWAY_MQTT_ENV.md`](../docs/RAILWAY_MQTT_ENV.md) · `npm run verify:mqtt-publish-env`
- [ ] Slave em `relay_slaves` — [`verify-slave-espnow-readiness.sql`](verify-slave-espnow-readiness.sql)
- [ ] Auto EC/pH OFF si interfiere con relés de prueba

---

## KPI (objetivo handoff Fase 3)

| # | Acción | Esperado | OK |
|---|--------|----------|-----|
| 1–10 | Toggle manual master (UI o Dosificar) | `completed` &lt;2s con MQTT; &lt;60s solo HTTPS | |
| 1–5 | Toggle slave ESP-NOW (painel ESP-NOW) | `completed` &lt;2s; serial `[CMD mqtt] slave` + ESP-NOW | |
| — | 0 comandos duplicados (mismo `id` MQTT) | Dedup NVS ESP | |
| — | Mapa relés sin «Manual pendente» perpetuo | WSS `relay_commands` | |
| — | Serial `[ACK] relay_commands id=… → completed` | Cada comando | |

---

## Por comando (debug)

```sql
SELECT id, relay_number, status, command_type, created_at, updated_at
FROM relay_commands
WHERE device_id = 'ESP32_HIDRO_269844'
ORDER BY created_at DESC
LIMIT 5;
```

Serial:

```
[CMD mqtt] id=… master R6 off …
✅ [ACK] relay_commands id=… → completed
```

Sin `[CMD mqtt]` → configurar `MQTT_*` en Railway o esperar poll HTTPS.

### Slave (ESP-NOW)

```sql
SELECT id, relay_number, target_device_id, status, updated_at
FROM relay_commands
WHERE device_id = 'ESP32_HIDRO_269844' AND target_device_id IS NOT NULL
ORDER BY created_at DESC LIMIT 5;
```

Serial:

```
[CMD mqtt] id=… slave R0 on … tgt=AA:BB:…
📡 [ESP-NOW] Comando para slave: AA:BB:…
✅ Slave encontrado: …
```

Teste VM: `npm run test:pub:slave-command` em `/opt/hidrowave-bridge` (ver `MQTT_COMANDOS_RAPIDOS_SLAVES.md`).

---

## Limpieza post-test

```sql
-- Ver stuck
SELECT id, status, relay_number FROM relay_commands
WHERE device_id = 'ESP32_HIDRO_269844' AND status IN ('pending','sent','executing');
```

Marcar failed o ejecutar script stuck según handoff manual.
