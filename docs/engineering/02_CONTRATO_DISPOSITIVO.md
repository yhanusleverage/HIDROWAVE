# 02 — Contrato dispositivo (congelado v1)

**Estado: CONGELADO** — cambios breaking requieren bump `v` y plan de migración dual-read.

Fuente de verdad detallada (payloads):  
[`ESP-HIDROWAVE-main/docs/mqtt/04_MODELAGEM_TOPICOS_PAYLOADS.md`](../../../ESP-HIDROWAVE-main/docs/mqtt/04_MODELAGEM_TOPICOS_PAYLOADS.md)

Schema TypeScript comandos:  
[`HIDROWAVE-main/src/lib/mqtt-relay-command-schema.ts`](../../src/lib/mqtt-relay-command-schema.ts)

Parser firmware: `ESP-HIDROWAVE-main/src/MqttCommandParser.cpp`

---

## 1. Principio de verdad

| Dato | Canal primario | Canal fallback | UI consume |
|------|----------------|----------------|------------|
| Comando relé urgente | MQTT `.../command` QoS1 | HTTPS poll `relay_commands` | Insert Supabase → publish MQTT |
| ACK comando | MQTT `.../command_ack` | HTTPS complete | `complete_relay_command` / estado fila |
| Telemetría hydro | MQTT `.../telemetry` → bridge | HTTPS `sendHydroData` | Supabase Realtime `hydro_measurements` |
| Online / heartbeat | MQTT `.../heartbeat` + `.../status` LWT | HTTPS last_seen | `device_status` |
| Estado operacional EC/pH | MQTT `.../ec_operation`, `.../ph_operation` | HTTPS sync | `relay_master.*` |
| Dosagens | MQTT `.../dose`, `.../ph_dose` | HTTPS | `nutrient_dosages` / `ph_dosages` |

**Regla:** no inventar un segundo “estado vivo” solo en React. La UI lee Supabase (bridge ya normalizó).

---

## 2. Namespace MQTT (inmutable v1)

```
hidrowave/{device_id}/{recurso}
```

`device_id` = `ESP32_HIDRO_[0-9A-F]{6}` (regex compartido frontend/bridge/firmware).

### Tópicos oficiales v1

| Recurso | Dirección | Uso |
|---------|-----------|-----|
| `heartbeat` | ESP → | heap, rssi, uptime |
| `telemetry` | ESP → | ph, tds/ec, temps, nivel |
| `status` | ESP → | LWT + online retain |
| `relay/state` | ESP → | cambio relé |
| `command` | → ESP | relé / modos |
| `command_ack` | ESP → | id + resultado |
| `ec_operation` | ESP → | FSM Auto EC |
| `dose` | ESP → | nutriente |
| `ph_operation` | ESP → | FSM Auto pH |
| `ph_dose` | ESP → | ácido/base |

Prohibido: tópicos sin `device_id`, wildcards en publish ESP, retain en telemetría alta frecuencia.

---

## 3. Envelope JSON v1 (obligatorio)

```json
{
  "v": 1,
  "device_id": "ESP32_HIDRO_XXXXXX",
  "ts": 1716490000
}
```

- `ts`: Unix **segundos** UTC.
- Números JSON number (no strings).
- Sensor inválido: omitir clave o `null` — no `-999` sin documentar.

### Comando relé (resumen)

Campos canónicos en `MqttRelayCommandMessageV1`:

`id`, `cmd: "relay"`, `relay_index`, `action`, `duration_s`, `mode?`, `cycle_off_s?`, `source`, `command_type`, `priority`, `triggered_by`, `target_device_id?`, `slave_mac_address?`

Modos: `instant` | `timed_on` | `timed_off` | `cycle` | `cycle_stop`.

---

## 4. Casos de uso (API mental — preferir esto a endpoints por pantalla)

| Caso de uso | Entrada | Salida | Owner |
|-------------|---------|--------|-------|
| **CommandRelay** | user/rule → INSERT `relay_commands` → MQTT | ACK + estado relé | Cloud + Firmware |
| **GetFreshHydro** | device_id | última hydro fresca / stripped PV | Frontend `hydro-freshness` |
| **PublishGrowPlan** | plan → API grow-cycle | instancias / rules en device | Frontend + DecisionEngine |
| **SyncEcOperation** | FSM firmware | `relay_master.ec_operation_*` | Firmware + bridge |
| **SyncPhOperation** | FSM firmware | `relay_master.ph_operation_*` | Firmware + bridge |

Nuevas pantallas **no** crean tablas/tópicos; reusan estos casos.

---

## 5. Proceso de cambio de contrato

1. Propuesta en PR con diff de `04_MODELAGEM` + schema TS + parser C++.
2. Dual-read: bridge acepta v1 y v2 ≥ 1 release.
3. Bump `MQTT_CMD_SCHEMA_VERSION` / campo `v`.
4. Checklist bancada: command, ack, telemetry, heartbeat, ec_operation, ph_operation.
5. Actualizar este doc + DoD cloud.

**Sin bump `v`:** solo campos opcionales backward-compatible.

---

## 6. Owners del contrato

| Artefacto | Repo | Owner |
|-----------|------|-------|
| Modelagem tópicos | ESP-HIDROWAVE `docs/mqtt/04_*` | Cloud + Firmware |
| Schema TS | HIDROWAVE `mqtt-relay-command-schema.ts` | Frontend |
| Parser C++ | ESP `MqttCommandParser.*` | Firmware |
| Bridge | `infra/mqtt` (si aplica) | Cloud |
