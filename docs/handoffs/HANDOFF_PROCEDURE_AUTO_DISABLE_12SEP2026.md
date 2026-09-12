# Handoff — Procedure finished · auto-disable · retained MQTT

**Fecha:** 2026-09-12  
**Estado:** ✅ **ÉXITO validado en banco** (E2E OK). Optimizaciones de robustez y UX aún recomendadas.  
**Ámbito:** `HIDROWAVE-main` + `ESP-HIDROWAVE-main` (Core + bridge Lightsail)

---

## 0. Resultado (validación)

**Funcionó óptimo en prueba real:** procedimiento completa → historial Sucesso → auto-disable DB/MQTT/UI → regla inactiva / Desativou.

Criterio §8 cumplido en el escenario de banco. El flujo es **usable en producción de laboratorio**.

Aun así **sigue siendo necesario optimizar** (no es deuda bloqueante del happy path):

| Prioridad | Optimización | Por qué |
|-----------|--------------|---------|
| Alta | Remodelar retained de Ativar (`upsert enabled=1` eterno) | Causa raíz de la carrera post-reconnect |
| Alta | Reducir/eliminar reconnect MQTT tras `procedure_finished` | Menos carrera = menos defensa ad-hoc |
| Media | Un solo dueño del auto-disable (bridge); UI/firmware solo defensa | Menos publishes duplicados |
| Media | Confirmar Realtime + `rule_config_events` estables; quitar Desativou sintético | Historial más limpio |
| Baja | UX historial (activity log industrial) | Misma data, mejor lectura operativa |
| Baja | Partir `AutomacaoPageClient` | Mantenibilidad |

---

## 1. Qué estábamos resolviendo

Tras un procedimiento de tanque (`procedure_finished` → `completed`):

1. Bridge escribe `procedure_events`, pone `decision_rules.enabled=false`, publica MQTT `op=disable` retained.
2. UI muestra **Sucesso** y mueve la regla a inactivas / **Desativou**.

**Bug (mitigado):** el ESP a menudo **reconectaba MQTT** justo después del finish y reaplicaba el **retained** viejo `rules/RULE_…` = `upsert enabled=1`. Mitigaciones: disable retained ×3, MQTT disable desde UI, firmware local disable + anti-retain en ventana post-reconnect.

Bench: `ESP32_HIDRO_1A575C`, slave `14:33:5C:38:BF:60`. Reglas de prueba: partial fill, DRENO, `fn_recirculacao_continua` (nunca auto-disable).

---

## 2. Flujo canónico (hoy)

```
Ativar (UI)
  → DB enabled=true
  → MQTT rules/{id} upsert enabled=1 (retained) + procedure/cmd start
  → Core Armed → Running → Complete
  → MQTT procedure_finished (no retain)
  → Bridge:
       INSERT procedure_events (+ rule_name)
       UPDATE decision_rules enabled=false   (skip si rule_id empieza por fn_)
       INSERT rule_config_events disabled    (warn si tabla/RLS falla)
       MQTT op=disable retained ×3 (0 / 0.8s / ~3s)
  → UI Realtime procedure_events:
       badge Sucesso
       notifyProcedureFinishedUi → enabled=false + MQTT disable extra
       Desativou sintético si falta rule_config_events
```

---

## 3. Cambios hechos (esta sesión)

| Capa | Qué |
|------|-----|
| **Bridge** `/opt/hidrowave-bridge` | Si DB ya está `enabled=false`, **igual** publica disable retained (antes hacía early-return). Burst ×3. |
| **Frontend** `AutomacaoPageClient` | Al `completed`, `requestDecisionRuleMqttSync(op:disable)`. Realtime `decision_rules` UPDATE. |
| **Historial** `RuleExecutionHistoryPanel` | Sucesso/Abortado; nombres; hide ACK relé si hay procedure_events; Desativou sintético; UI activity-log. |
| **Firmware** `HydroSystemCore` | Post-complete: `enabled=false` local + cooldown anti-retain solo en ventana ~5s post-reconnect. `procedure/cmd start\|rearm` limpia cooldown. |
| **SQL** | `20260912_procedure_rule_name_and_config_events.sql` + `20260912_realtime_procedure_tables.sql` |

---

## 4. Realtime

**Sí hace falta** para UX en vivo. Script: `scripts/migrations/20260912_realtime_procedure_tables.sql`.

| Tabla | Evento | Para qué |
|-------|--------|----------|
| `procedure_events` | INSERT | Historial + auto-disable UI |
| `rule_config_events` | INSERT | Desativou real |
| `decision_rules` | UPDATE | Ativas/Inativas |
| `relay_commands` | INSERT | ACK relé |

---

## 5. Ops

- **Lightsail:** `ubuntu@15.175.109.90`, key `LightsailDefaultKey-ca-central-1.pem`
- **Bridge:** `/opt/hidrowave-bridge`, `systemctl restart hidrowave-bridge`
- **Env crítico:** `SUPABASE_SERVICE_ROLE_KEY` (role `service_role`), `MQTT_PUBLISH_USER` / `MQTT_PUBLISH_PASS`

---

## 6. Archivos clave

- Bridge: `infra/mqtt/bridge/index.js`
- Firmware: `src/HydroSystemCore.cpp` / `include/HydroSystemCore.h`
- UI: `AutomacaoPageClient.tsx`, `RuleExecutionHistoryPanel.tsx`, `rule-procedure-history.ts`
- Migraciones: `scripts/migrations/20260912_*.sql`

---

## 7. Criterio de “listo” (cumplido en banco)

- [x] Completar procedimiento → UI Sucesso + regla inactiva + Desativou  
- [x] Happy path estable en prueba  
- [ ] Optimizaciones de retained / reconnect (recomendadas, no bloquean demo)  
- [ ] `fn_*` nunca auto-desactivan (comportamiento a vigilar en regresión)  
- [ ] Re-Ativar manual con MQTT estable (regresión tras flash anti-retain)
