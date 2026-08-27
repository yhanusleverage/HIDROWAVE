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

## 5. Orden (ejecución 27/08)

**Bancada 27/08:** GET HTTPS **não desahogou** (`maxAlloc=38900` vs 40960, `sslBusy=0`, mqtt=1). Poll config **não é canal**. Auto EC/pH config passa a **MQTT retained**. GET só fallback se MQTT config ainda não chegou nesta sessão.

Save web: **não enviar** coluna `flow_rate` (dropada). Vazão = `nutrients[].flowRate`.

### Fase B — MQTT config (código 27/08)

```text
UI POST /api/ec-controller/config
  → UPSERT ec_config_view (sem flow_rate)
  → publish retained hidrowave/{id}/ec/config
ESP subscribe → apply RAM
GET HTTPS só se MQTT estável mas config MQTT ainda não chegou
```

**ACL VM:** foto incompleta 27/08 + ACL objetivo y mapa: [ACL_MAPA_FUNCIONALIDADES_27AGO2026.md](../../../../ESP-HIDROWAVE-main/docs/mqtt/ACL_MAPA_FUNCIONALIDADES_27AGO2026.md)

Serial verde:

```text
[MQTT] subscribe ec/config QoS1
[MQTT] rx topic=hidrowave/.../ec/config
[EC CONFIG] apply via=mqtt auto=SIM
```

### O que ainda aperta TLS (próximos MQTT)

| Canal | Hoje | Migrar? |
|-------|--------|---------|
| Auto EC/pH config GET | skip maxAlloc | **MQTT agora** |
| device_status 60s | MQTT + last_seen 4 min | já fallback |
| decision_rules poll | HTTPS ~30s | sim, depois |
| PATCH K ganhos / doses se MQTT publish falha | pontual | manter HTTPS |
| Claim/registro | 1x boot | ficar HTTPS |

---

## 5. Orden (ejecución 25/08)

**Regla:** el GET HTTPS de Auto EC/pH tiene que **funcionar como principal** antes de bajarlo a fallback. Si MQTT se pone primero y el GET nunca se vio verde, el apagón del broker deja el ESP sordo otra vez.

### Fase A — ahora (aliviar TLS; GET sigue principal)

HTTPS que **ya debía ser fallback** y aún corría en paralelo:

| Canal | Cambio | Fallback |
|-------|--------|----------|
| `device_status` cada 60 s | `mqtt_health_only=1` | HTTPS solo si MQTT caído (120 s) + last_seen ≤4 min |
| PATCH `relay_master` en ese mismo ciclo | skip si MQTT comando estable 60 s | HTTPS en `syncAllRelayStates` / status si MQTT cae |

**No se borra** la tabla `device_status` ni el GET de config.

**Gate bancada (esta fase):**

```text
health=mqtt+https_fallback     ← boot
[SSL] skip relay_master HTTPS (MQTT command path OK)
[SYNC] EC config poll          ← GET de verdad, no skip
[EC CONFIG] auto_enabled: SIM  ← RAM = web
[SYNC] PH config poll           ← ≥15 s después, no pegado a EC
[PH CONFIG] auto_enabled: SIM
```

Rojo: `GET skip: maxAllocLow` en soak ≥20 min. Entonces no se pasa a Fase B.

### Fase B — después del gate (MQTT principal Auto EC/pH)

Mismo JSON que la view, retained:

`hidrowave/{device_id}/ec/config` y `.../ph/config`

GET HTTPS **queda**, ya probado, solo si MQTT caído >60 s.

---

## 5b. Hecho 25/08 (Fase A código)

- `secrets.ini` / `secrets.ini.example`: `mqtt_health_only=1`
- `Config.h` default `MQTT_HEALTH_ONLY=1`
- Loop: con MQTT OK el HTTPS de status pasa de 60 s → 4 min
- `sendDeviceStatusToSupabase`: no PATCH `relay_master` si `isMqttCommandPathStable()`

---

## 6. Comprobar cloud vs RAM

```sql
SELECT device_id, auto_enabled, updated_at
FROM ec_config_view
WHERE device_id = '<device>';
```

- `true` + serial NÃO + `GET skip: maxAllocLow` → ESP sordo.  
- `false` → el botón no grabó (validación nutrientes, error, `device_id` distinto).
