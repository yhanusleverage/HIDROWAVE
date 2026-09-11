# Contrato: Simple vs Procedure (Full recharge)

Estado: **activo** — Sep 2026  
Estándar de referencia: ISA-88 (Complete/Aborted) + ISA-101 (resultado, no spam de ACK).

## Dos clases

| Clase | Ejemplo | Éxito en historial |
|-------|---------|-------------------|
| **Simple** | 1 `relay_action` timed | ACK de ese relé (`rule_executed` → OK/Falha) |
| **Procedure** | Full recharge, dreno solo, fill solo | Evento `procedure_finished` Complete/Aborted |

**Full recharge** = en **una** regla: dreno hasta vacío + OFF + fill hasta alto/cheio + OFF.  
**No** encadenar dreno→fill como dos reglas (recrea OK parcial). Encadenamiento post-Complete (p. ej. → recirculación) = bloque `chain` en [PROCEDURE_FSM_V2.md](PROCEDURE_FSM_V2.md).

Tipagens: `fn_dreno_ate_vazio`, `fn_enchimento_ate_alto`, `fn_recarga_ate_alto`.

## Evolución ejecución (cutover)

La ejecución por `while`/ScriptRunner se sustituye por FSM de dominio (`schema_version: 2`).  
Contrato y fases: **[PROCEDURE_FSM_V2.md](PROCEDURE_FSM_V2.md)**.

## Estados de procedimiento (producto — legado / UI)

```
Idle → Running → Complete
              → Aborted
```

En v2 el ciclo incluye **Armed** (enabled sin actuar) y Start explícito; ver FSM v2.

| Estado | Significado UI |
|--------|----------------|
| Complete | Procedimiento terminó bien |
| Aborted | Timeout, abort, remove regra, clear |

## Capas (no mezclar)

| Capa | Topic / store | Significado de OK |
|------|---------------|-------------------|
| ACK relé | `rule_executed` → `relay_commands` | Ese acionamento confirmado (detalle) |
| Fin procedimiento | `procedure_finished` → `procedure_events` | Resultado oficial procedure |
| Config | `rule_config_events` / LS | Ativou / Desativou |

## MQTT `procedure_finished` v1

Topic: `hidrowave/{device_id}/procedure_finished`

| Campo | Tipo | Requerido |
|-------|------|-----------|
| v | 1 | sí |
| device_id | string | sí |
| ts | uint32 | sí |
| event_id | string | sí (dedup) |
| rule_id | string | sí |
| status | `completed` \| `aborted` | sí |
| reason | string | opcional (`end`, `while_timeout`, `abort`, `removed`) |
| kind | string | opcional (`procedure`, `full_recharge`, `drain_only`, …) |

## Clasificación en `rule_json`

```json
{
  "execution_class": "simple" | "procedure",
  "procedure_kind": "full_recharge" | "drain_only" | "fill_only" | "generic"
}
```

- Script con ≥1 `while` / `sensor_valve` / tipagem hidráulica de tanque → `procedure`.
- Un solo `relay_action` sin while → `simple`.
- v2: `schema_version: 2` + bloque `fsm` (sin while); ver PROCEDURE_FSM_V2.

## Historial UI

Lista principal:

1. Ativou / Desativou (config)
2. Procedure Complete / Aborted (nombre humano)
3. Actos simple OK/Falha (Ligou/Desligou)

No mostrar keepalive de recirculación como spam; no promocionar ACK intermedio de Full recharge como éxito total.

## Bancada

Ver `docs/debug/BENCH_PROCEDURE_HISTORY.md`.

## Archivos

- Firmware: `ScriptRunner`, `MqttClient`, `HydroSystemCore` → evoluciona a `TankProcedureFsm` (v2)
- Bridge: `infra/mqtt/bridge/index.js` (+ `scripts/test-publish-procedure-finished.js`)
- SQL: `HIDROWAVE-main/scripts/migrations/20260910_procedure_events.sql`
- UI: `rule-procedure-history.ts`, `RuleExecutionHistoryPanel.tsx`
- Bancada: `docs/debug/BENCH_PROCEDURE_HISTORY.md`
- Cutover: `docs/engineering/PROCEDURE_FSM_V2.md`

## Deploy checklist

1. Aplicar migración `20260910_procedure_events.sql` en Supabase.
2. Redeploy bridge MQTT (subscribe `procedure_finished`).
3. Flash Master con `RULE_EXECUTED_MIRROR_ENABLED`.
4. Validar con matriz en `BENCH_PROCEDURE_HISTORY.md`.
