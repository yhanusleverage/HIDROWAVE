# MQTT bridge / broker — telemetría dilución

**12/jul/2026**

## ¿Falta algo en bridge / ACL?

**No para dilución live + evento.** Ya cubierto:

| Topic ESP → | Bridge | ACL `bridge_internal` |
|-------------|--------|------------------------|
| `hidrowave/+/ec_operation` | PATCH `relay_master` + `hydro_flow_readings` | `topic read` OK |
| `hidrowave/+/ec_dilution` | INSERT `ec_dilution_events` | `topic read` OK |
| `hidrowave/+/command` (UI→ESP) | Railway user `hidrowave` write | OK |

## Ops pendientes (no es código ACL)

1. Ejecutar `ADD_HYDRO_FLOW_READINGS.sql` en Supabase.
2. Redeploy bridge con el `index.js` actual (throttle progress + insert flow).
3. Flash firmware (fill→HIGH, recirc siempre).
4. Confirmar que el bloque ACL del **device_id** real permite `write` a `ec_operation` y `ec_dilution` (inyectado por `align-broker-production.sh`).

## No requerido ahora

- Nuevo topic MQTT.
- Cambio de ACL de bridge.
- Topic aparte para “aguardando nível alto”.
