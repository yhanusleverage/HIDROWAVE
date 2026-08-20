# 05 — Definition of Done por capa

Ningún PR se considera Done si falla el DoD de su capa. Los indicadores P son **gates**, no vanity metrics.

## Gates globales (todo PR que toque runtime)

- [ ] No rompe contrato v1 ([02_CONTRATO](02_CONTRATO_DISPOSITIVO.md)) sin bump `v` + dual-read.
- [ ] Notas de bancada o test automatizado cuando afecta J1–J3.
- [ ] Si toca `HydroSystemCore.cpp` **y** `HydroControl.cpp`: justificación P6 en descripción del PR.

---

## Capa Firmware

| Gate | Criterio | P ligado |
|------|----------|----------|
| Compila | `pio run` (env Master) OK | — |
| Heap | Sin regresión grosera: `heap_free` min en soak ≥ baseline − 10% | P4 |
| Estabilidad | Smoke ≥ 30 min sin WDT/panic en cambio de lazo/comandos; preferible overnight si toca control | P3 |
| Control vs cloud | Cero `#include` MQTT/Supabase nuevos en `HydroControl` | P6 |
| Comando | Master: comando MQTT de prueba ACK &lt; 5 s en bancada | P1 |
| Mesh | Si toca ESP-NOW: 1 comando slave con ACK | P1 slave |
| Serial | Log de error actionable; no spam que oculte crash | P3 |

**Done firmware =** gates aplicables marcados + owner firmware en review.

---

## Capa Cloud (MQTT bridge + Supabase + API routes)

| Gate | Criterio | P ligado |
|------|----------|----------|
| Contrato | Payload válido schema v1; topic oficial | P1/P2 |
| Idempotencia | Comandos: dedup por `id`; telemetría: sin flood insert (throttle) | P2/P4 cloud |
| Latencia path | Publish comando tras INSERT sin timeout MQTT habitual | P1 |
| Schema SQL | Migración reversible o script verify; RLS no debilitado | P7 |
| Una verdad | No duplicar estado solo en memoria bridge sin persistir lo que la UI lee | P2 |
| Caso de uso | Nueva route mapeada a CommandRelay / GetFreshHydro / etc. | escopo |

**Done cloud =** verify SQL o test publish documentado + owner cloud.

---

## Capa Frontend (UI + `src/lib`)

| Gate | Criterio | P ligado |
|------|----------|----------|
| Dominio en `lib` | Reglas de negocio en SDK (`src/lib`), no solo en JSX | P5 |
| Frescura | Hydro PV usa `isHydroRowFresh` / merge live; no mostrar stale como vivo | P2 |
| Realtime | Un canal/fuente por entidad; evitar poll duplicado sin motivo | P2 |
| Comando UX | Feedback de pending → ACK/error; no “éxito” optimista eterno | P1 |
| Job | Cambio trazable a J1–J6; J7 solo si freeze levantado | escopo |
| i18n | Strings en flujos tocados (pt-BR mínimo del área) | — |

**Done UI =** flujo crítico verificado en browser + owner frontend.

---

## Matriz rápida PR → DoD mínimo

| Tipo de cambio | Firmware | Cloud | UI |
|----------------|----------|-------|-----|
| Solo copy marketing | — | — | freeze / skip feature |
| Relé / MQTT command | ✓ | ✓ | ✓ si UX |
| Telemetría / chart | ✓ si intervalo | ✓ bridge | ✓ freshness |
| Auto EC/pH | ✓ control | ✓ sync topics | ✓ estado |
| Grow-cycle / rules | ✓ si DE | ✓ APIs | ✓ |
| Refactor Core/Control | ✓ + nota F-fase | — | — |

---

## Cierre de sprint (Eng Manager)

1. ¿Algún P en rojo empeoró?
2. ¿HH respetaron budget [04](04_BACKLOG_JOBS_USUARIO.md)?
3. ¿Algún PR Done sin gate? → deuda explícita o revert.
