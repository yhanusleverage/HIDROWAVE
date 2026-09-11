# Procedure FSM v2 — Cutover (contrato)

Estado: **Fase 1 firmware lista** — Sep 2026 (compila; Armed + procedure/cmd)  
Complementa: [PROCEDURE_SIMPLE_VS_FULL_RECHARGE.md](PROCEDURE_SIMPLE_VS_FULL_RECHARGE.md)  
Estándares: ISA-88 (Complete/Aborted) · ISA-101 (resultado, no spam ACK)

## Objetivo

Cutover **100%** de procedures de tanque: salir del intérprete genérico `while` / ScriptRunner anidado y pasar a **FSMs de dominio** con ciclo de vida explícito y payload MQTT delgado.

| Clase | Ejecuta en | Éxito oficial |
|-------|------------|---------------|
| **Simple** | DecisionEngine `actions` | `rule_executed` |
| **Procedure** | TankProcedure FSM v2 | `procedure_finished` |

**No Dual permanente:** device v2 ignora `script.instructions` con `while` si llegara por error.  
Reglas Simple (p. ej. recirculación) **no** son FSM; solo pueden ser **destino** de un chain.

---

## Ciclo de vida (todas las procedures)

```
Idle → Armed → Running → Complete
                      → Aborted
Complete|Aborted → Armed (rearm)
Armed|Running → Idle (disable; Running ⇒ force OFF actuadores)
```

| Estado | Significado | Relés de tanque |
|--------|-------------|-----------------|
| Idle | Disabled / no cargada | OFF |
| Armed | Enabled, lista; **no** actúa | OFF |
| Running | Start manual, MQTT o schedule | Según subestado |
| Complete | Éxito terminal | OFF |
| Aborted | Timeout / abort / disable en Running | OFF |

### Arranque (B + schedule)

- **Guardar / enable** → `Armed` (cero relés).
- **Start** → `Running`: UI, o MQTT `procedure/cmd` `{op:start}`, o **borde de entrada** a `time_window` si Armed+enabled.
- **Abort** → `Aborted` + OFF.
- **Rearm** → vuelve a `Armed` tras Complete/Aborted.

---

## FSMs de tanque

### full_recharge

`Armed → Drain → Fill → Complete | Aborted`

### drain_only

`Armed → Drain → Complete | Aborted`

### fill_only

`Armed → Fill → Complete | Aborted`

### Subestados Drain / Fill

| Subestado | Guard (mientras ON) | Entrada | Salida OK | Salida fail |
|-----------|---------------------|---------|-----------|-------------|
| Drain | `water_level != vazio` | Relé dreno ON | OFF → Fill o Complete | Timeout/abort → OFF → Aborted |
| Fill | `water_level != alto` | Relé fill ON | OFF → Complete | Timeout/abort → OFF → Aborted |

- Condición = guard del lazo (semántica “enquanto não for”), **sin** inversión oculta en compile.
- `hold_chemical: true` → gate Auto EC/pH activo en Running.
- Full recharge = **una** FSM. **Prohibido** montar dreno+fill como dos rules encadenadas.

Valores de nivel canónicos: `vazio` | `baixo` | `medio` | `alto` (aliases de UI se normalizan al compilar).

---

## Payload MQTT cutover (`schema_version: 2`)

Slim: **sin** `procedure_steps`, **sin** `while`, **sin** bodies anidados.

```json
{
  "schema_version": 2,
  "execution_class": "procedure",
  "procedure_kind": "full_recharge",
  "fsm": {
    "hold_chemical": true,
    "drain": {
      "relay": 1,
      "target": "slave",
      "slave_mac": "14:33:5C:38:BF:60",
      "until": "vazio",
      "timeout_s": 1800
    },
    "fill": {
      "relay": 2,
      "target": "slave",
      "slave_mac": "14:33:5C:38:BF:60",
      "until": "alto",
      "timeout_s": 1800
    }
  },
  "triggers": [
    { "type": "manual" },
    { "type": "time_window", "start": "08:00", "end": "12:00" }
  ],
  "chain": [
    {
      "on": "success",
      "target_rule_id": "fn_recirculacao_continua",
      "target_class": "simple",
      "delay_ms": 0,
      "action": "fire"
    }
  ]
}
```

| `procedure_kind` | Campos `fsm` requeridos |
|------------------|-------------------------|
| `full_recharge` | `drain` + `fill` |
| `drain_only` | `drain` |
| `fill_only` | `fill` |

`procedure_steps` permanece en Supabase para el builder UI; **no** se publica al Master.

---

## Topics

| Topic | Dirección | Uso |
|-------|-----------|-----|
| `hidrowave/{id}/rules/{rule_id}` | cloud→device | Upsert retained (payload v2 slim) |
| `hidrowave/{id}/rules/manifest` | cloud→device | Lista enabled/hash |
| `hidrowave/{id}/procedure/cmd` | cloud→device | `{v:1, rule_id, op: start\|abort\|rearm}` |
| `hidrowave/{id}/procedure_finished` | device→cloud | Complete/Aborted (v1 existente) |
| `hidrowave/{id}/procedure_state` | device→cloud | Opcional HMI: `{rule_id, state, sub, wl, ts}` |

### `procedure/cmd`

```json
{ "v": 1, "device_id": "ESP32_…", "rule_id": "RULE_…", "op": "start" }
```

Ops: `start` | `abort` | `rearm`. Ignorar si rule ausente / disabled / op ilegal para el estado actual (log `[PROC] cmd ignored …`).

### `procedure_finished` (sin cambio de contrato v1)

`status`: `completed` | `aborted`  
`reason`: `end` | `timeout` | `abort` | `removed` | `disable`  
`kind`: `full_recharge` | `drain_only` | `fill_only`

---

## Encadenamiento (concatenadas)

Solo **post-terminal** (tras Complete o Aborted del padre). Nunca a mitad de Drain/Fill.

| Campo | Valores | Significado |
|-------|---------|-------------|
| `on` | `success` \| `failure` | Complete vs Aborted |
| `target_class` | `simple` \| `procedure` | DecisionEngine vs otra FSM |
| `action` | `fire` \| `start` | Una corrida Simple / Start FSM destino |
| `delay_ms` | ≥ 0 | Espera tras terminal |

### Restricciones

1. Procedure→Procedure si destino ya `Running` → `[CHAIN] skip busy`.
2. No usar chain para armar Full recharge en dos rules.
3. Canónico: Full recharge Complete → `fire` `fn_recirculacao_continua`.
4. Fallo del eslabón **no** reescribe `procedure_finished` del padre.
5. Builder `invoke_rule` / `chain` → bloque `chain[]` v2 (no instrucciones script).

Orden: eslabones en array, secuenciales tras el delay de cada uno.

---

## Upsert / heap (contrato operativo)

1. Parse + validate OK → entonces swap FSM (nunca borrar Armed/Running antes de parse fail).
2. Overflow / refuse MQTT → script/FSM **anterior preservado**.
3. Payload v2 debe caber holgado en doc ≤ 16k (objetivo típico ≪ 4k tras slim).

---

## Qué desaparece al cerrar cutover

- Compile `sensor_valve` → `while` + body  
- Intérprete `while` anidado para procedures  
- `conditionSemantics` / inversión goal↔while  
- `chained_events` legacy sin runtime  

---

## Fases de entrega

| Fase | Entrega | Repo |
|------|---------|------|
| **0** | Este documento + índice | `HIDROWAVE-main` docs | hecho |
| **1** | `TankProcedureFsm` + cmd start/abort/rearm + schedule + infer while legado | `ESP-HIDROWAVE-main` | hecho (flash pendiente) |
| **1b** | Ejecutar `chain[]` post-terminal | firmware | pendiente |
| **2** | Compile emite `fsm`+`chain` v2; UI Armed/Start; slim MQTT | `HIDROWAVE-main` | pendiente |
| **3** | Retirar while; migración resync; bench completa | ambos | pendiente |

---

## Matriz de bancada (Fase 1+)

| # | Caso | Esperado |
|---|------|----------|
| 1 | Upsert full_recharge enabled | `Armed`, 0 relés tanque |
| 2 | `cmd start` con wl=alto | Drain R_dreno ON |
| 3 | wl→vazio | R_dreno OFF → Fill R_fill ON |
| 4 | wl→alto | R_fill OFF → `procedure_finished completed` |
| 5 | Timeout Drain | OFF → `aborted` reason=timeout |
| 6 | `cmd abort` en Fill | OFF → `aborted` |
| 7 | Sin Start tras save | Ningún R1/R2 de la rule |
| 8 | time_window edge + Armed | Start automático |
| 9 | Complete + chain fire recirc | R0 / recirculación según tipagem |
| 10 | JSON overflow upsert | FSM anterior intacta |
| 11 | drain_only / fill_only | Un solo subestado |
| 12 | Rearm + Start otra vez | Segunda corrida limpia |

Detalle historial UI: [BENCH_PROCEDURE_HISTORY.md](../debug/BENCH_PROCEDURE_HISTORY.md).

---

## Archivos previstos (implementación)

| Capa | Path |
|------|------|
| Doc | `docs/engineering/PROCEDURE_FSM_V2.md` (este) |
| FW | `TankProcedureFsm.*` · wiring `DecisionEngine` / `HydroSystemCore` / `MqttClient` |
| Bench cmd | `infra/mqtt/bridge/scripts/test-publish-procedure-cmd.js` |
| Cloud | `compile-procedure.ts` · `mqtt-rules-publish.ts` |
| UI | Motor: estado Armed/Running + Start/Abort |
| Bridge | subscribe `procedure/cmd` si el publish no es directo retained device |
