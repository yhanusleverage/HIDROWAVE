# Auto EC/pH — transporte de config (HTTPS poll vs MQTT)

**Fecha:** 25/ago/2026  
**Índice EC:** [00_INDICE_SERIAL.md](00_INDICE_SERIAL.md)  
**Relacionado:** [ph/S04_FLUJO_POLL_CONFIG.md](../ph/S04_FLUJO_POLL_CONFIG.md) · relés MQTT ya en caliente (`MQTT_COMMAND_BRIDGE_ONLY`)

---

## 1. Problema (bancada)

El botón **Ativar Auto EC** **sí** escribe `ec_config_view.auto_enabled = true` (PATCH/upsert + RPC `activate_auto_ec` solo lectura).

El ESP **no** escribe ese bit. Solo lo **lee** con GET HTTPS a `ec_config_view` / `ph_config_view`.

En serial (uptime ~4100 s):

```text
[SYNC] EC config poll
[EC CONFIG] GET skip: maxAllocLow heap=132696 maxAlloc=40948
[SYNC] PH config poll
[PH CONFIG] GET skip: maxAllocLow heap=132696 maxAlloc=40948
```

Umbral TLS (`HydroSystemCore.h`):

- `MIN_HEAP_FOR_HTTPS` = 80000 (heap total ~132 kB → pasa)
- `MIN_CONTIGUOUS_FOR_HTTPS` = **40960**
- `maxAlloc` observado = **40948** → faltan **12 bytes** → **no abre TLS**

La web puede estar ON y el serial `auto_enabled: NÃO`: cloud OK, RAM del master vieja.

`GET skip` ocurre **antes** de parsear `nutrients[].flowRate`. El array por bomba agranda el JSON *cuando* el GET sale; no es la causa directa de *esta* línea.

---

## 2. Ciclo de vida actual de `auto_enabled`

```text
UI toggle
  → upsert/PATCH ec_config_view.auto_enabled     ← nace true/false
  → RPC activate_auto_ec (SELECT; no debe forzar true)
ESP cada 30 s (o 60 s si MQTT comando estable)
  → GET /rest/v1/ec_config_view?device_id=eq.{id}&select=*
  → hydroControl.setAutoECEnabled(...)          ← RAM
```

Dos copias: view (web) vs RAM firmware (malha).

---

## 3. ¿Poll EC y pH en el mismo segundo? — **sí, hoy**

**No está desfasado.** Código actual (`HydroSystemCore.cpp` loop):

- `lastECConfigCheck = 0` y `lastPHConfigCheck = 0` (mismo origen).
- `ecPollMs == phPollMs` (30 s, o `CONFIG_POLL_INTERVAL_MQTT_OK_MS` = 60 s si MQTT OK).
- En el **mismo** `loop()`, si ambos timers vencen, corre `checkECConfigFromSupabase()` y **en seguida** `checkPHConfigFromSupabase()`.
- Si el GET se salta (`maxAllocLow`), ambos hacen `lastX = now - pollMs + 5000` → **reintentan juntos a los 5 s**.

El serial de bancada lo confirma: `[SYNC] EC config poll` y `[SYNC] PH config poll` consecutivos, los dos `GET skip`.

**Desahogo P0 (firmware):** no lanzar los dos GET en el mismo segundo.

**Hecho 25/08** (`HydroSystemCore.cpp` + `CONFIG_POLL_PH_STAGGER_MS` = 15 s en `Config.h`):

- `lastPHConfigCheck` arranca en 15 s → primer pH ~15 s después del primer EC.
- Un solo GET por `loop()`. Si EC y pH vencen juntos, corre EC y empuja pH `+stagger`.
- Serial esperado: `[SYNC] EC config poll` y `[SYNC] PH config poll` **no** consecutivos.

---

## 4. Plan (dos palancas, no excluyentes)

Fuente de verdad **sigue** siendo `ec_config_view` / `ph_config_view`. MQTT no sustituye Postgres.

### P0 — Desahogar HTTPS (rápido)

1. `select=` corto (no `*`) — **hecho** 25/08 (`EC_CONFIG_POLL_SELECT` / `PH_CONFIG_POLL_SELECT` en `Config.h`; `SupabaseClient.cpp`). Incluye `nutrients` (flowRate) y dilución. No baja `id`/`created_at`/`distribution`.
2. **No poll EC y pH en el mismo segundo** — **hecho** 25/08 (`CONFIG_POLL_PH_STAGGER_MS`).
3. Receta grande solo al salvar, no cada poll.
4. Umbral TLS o reboot si `maxAlloc` está a ~12 B del corte.

Objetivo: que `auto_enabled` vuelva a copiarse a RAM sin puente nuevo.

### P1 — MQTT, **mismo JSON** que la view (diseño)

No hace falta un schema MQTT distinto. El body del POST/PATCH (incl. `nutrients[].flowRate`) se puede **publicar retained** tras el UPDATE.

```text
1. UPDATE/UPSERT view
2. publish retained hidrowave/{id}/ec/config   ← mismo objeto, no array PostgREST
3. ESP subscribe → RAM
4. GET HTTPS solo si MQTT caído >60 s
```

Topic **aparte** de relés (`command` ≠ `ec/config`). Relés ya van por MQTT.

“100% MQTT” **no**: web/RLS/histórico siguen HTTP. Patrón = el de relés (`MQTT_COMMAND_BRIDGE_ONLY`).

---

## 5. Orden

1. P0 para dejar de mentir web ON / serial NÃO.  
2. P1 cuando el ON/OFF deba ser instantáneo (espejo del puente de relés).

---

## 6. Comprobar cloud vs RAM

```sql
SELECT device_id, auto_enabled, updated_at
FROM ec_config_view
WHERE device_id = '<device>';
```

- `true` + serial NÃO + `GET skip: maxAllocLow` → ESP sordo.  
- `false` → el botón no grabó (validación nutrientes, error, `device_id` distinto).
