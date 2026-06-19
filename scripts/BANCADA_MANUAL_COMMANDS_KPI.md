# Bancada — KPI comandos manuales (Fase 3 master)

**Device:** `ESP32_HIDRO_269844` · **Handoff:** [`HANDOFF_RELAY_COMMANDS_MANUAL_14JUN2026.md`](../docs/HANDOFF_RELAY_COMMANDS_MANUAL_14JUN2026.md)

---

## Pre-requisitos

- [ ] Firmware actual flasheado (ACK en `relay_commands` — [`SupabaseClient.cpp`](../../ESP-HIDROWAVE-main/src/SupabaseClient.cpp))
- [ ] SQL stuck ejecutado: [`VERIFICAR_RELAY_COMMANDS_STUCK.sql`](VERIFICAR_RELAY_COMMANDS_STUCK.sql)
- [ ] Railway: env `MQTT_*` — [`RAILWAY_MQTT_ENV.md`](../docs/RAILWAY_MQTT_ENV.md)
- [ ] Auto EC/pH OFF si interfiere con relés de prueba

---

## KPI (objetivo handoff Fase 3)

| # | Acción | Esperado | OK |
|---|--------|----------|-----|
| 1–10 | Toggle manual master (UI o Dosificar) | `completed` &lt;2s con MQTT; &lt;60s solo HTTPS | |
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

---

## Limpieza post-test

```sql
-- Ver stuck
SELECT id, status, relay_number FROM relay_commands
WHERE device_id = 'ESP32_HIDRO_269844' AND status IN ('pending','sent','executing');
```

Marcar failed o ejecutar script stuck según handoff manual.
