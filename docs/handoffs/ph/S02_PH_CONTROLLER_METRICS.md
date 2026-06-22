# S02 — Auto pH / ph_controller_metrics (métricas de ciclo)

**Gate:** V4 · **Device:** `ESP32_HIDRO_269844` · **Estado:** SQL OK prod; filas pendientes post-flash

**Índice:** [00_GUIA_DOSING_VS_METRICAS.md](../00_GUIA_DOSING_VS_METRICAS.md) · [00_INDICE_SERIAL pH](00_INDICE_SERIAL.md)

---

## 1. Qué es / qué NO es

| Es | No es |
|----|-------|
| Una fila por cada `checkAutoPH` con pH finito válido | Una fila por pulso de ácido/base → [S01](S01_PH_DOSAGES_E2E.md) |
| Registra error_h, K, dose_ideal/real, flags | Última dosagem registrada en Automacao |
| Gráfico dashboard error_h + u(t) | Calibragem K (eso es ph_config PATCH) |

**Tabla:** `ph_controller_metrics` · **MQTT:** `hidrowave/{id}/ph_metric` (QoS 0)

---

## 2. Flujo

```
HydroControl::checkAutoPH (cada intervalo_auto_ph)
  → emitPhControllerMetric
  → MQTT ph_metric
  → bridge INSERT ph_controller_metrics
  → ControllerMetricsChart (poll 60s)

Backup:
  → insertPhControllerMetric HTTPS
```

Emite también cuando `adjustment_needed=true` pero no dosó (path none, plan invalid, etc.).

---

## 3. SQL (orden)

Mismo script que EC:

[`RUN_CONTROLLER_METRICS_MIGRATIONS.sql`](../../../scripts/RUN_CONTROLLER_METRICS_MIGRATIONS.sql)

Individual: [`CRIAR_TABELA_PH_CONTROLLER_METRICS.sql`](../../../scripts/CRIAR_TABELA_PH_CONTROLLER_METRICS.sql)

Verify: [`VERIFICAR_CONTROLLER_METRICS_E2E.sql`](../../../scripts/VERIFICAR_CONTROLLER_METRICS_E2E.sql)

---

## 4. Verify automatizado (Gate V4)

```bash
npm run verify:controller-metrics
```

Comparte verify con V3 (ambas tablas). Tras flash, comprobar filas pH:

```sql
SELECT ph_setpoint, ph_before, error_h, dose_real_ml, created_at
FROM ph_controller_metrics
WHERE device_id = 'ESP32_HIDRO_269844'
ORDER BY created_at DESC LIMIT 5;
```

---

## 5. Validación por capa

| Paso | Acción | Gate |
|------|--------|------|
| 1 | SQL (compartido V3/V4) | tablas existen |
| 2 | Flash firmware | topic `ph_metric` en boot |
| 3 | Bridge ACL `ph_metric` + handlers | [S03_BRIDGE_METRICS.md](../ec/S03_BRIDGE_METRICS.md) |
| 4 | Gate R2 regresión | `npm run test:pub:ph-dose` |
| 5 | Auto pH ON, pH finito 4–9 (prod) | `[MQTT] ph_metric` |
| 6 | Bridge INSERT | journalctl |
| 7 | Dashboard sección Auto pH | gráfico |

- [ ] Pasos 1–2
- [ ] Auto pH activo + sensor OK
- [ ] Filas en Supabase
- [ ] UI dashboard

---

## 6. Logs esperados

**Serial:**

```
[MQTT] ph_metric errH=1.234e-05 u(t)=2.50ml adj=1
```

**Bridge:**

```
[bridge] INSERT ph_controller_metrics ESP32_HIDRO_269844 u(t)=2.50ml
```

---

## 7. KPI cierre V4

| KPI | Criterio |
|-----|----------|
| Frecuencia | ~1 fila / `intervalo_auto_ph` |
| error_h coherente | Mismo orden magnitud que dominio H |
| adjustment_applied | true solo si inició `startPhAutoDosage` |
| UI | Puntos en gráfico pH 24h |

---

## 8. Troubleshooting

| Síntoma | Causa | Acción |
|---------|-------|--------|
| ph_dosages OK, metrics 0 | Sin ph_metric en firmware | Flash |
| `Lectura pH inválida` en serial | Sensor off | Hardware |
| 0 filas con auto ON | `ph_autoState != IDLE` bloquea check | Esperar fin ciclo |
| Filas metrics pero ph_dosages no | Solo evaluación sin dosar | Normal si error dentro tolerancia |
| K en metrics ≠ ph_config | metrics snapshot en tick | K aprendido va a ph_config post-recirc |

---

## 9. Código clave

| Pieza | Ruta |
|-------|------|
| Emisión | `HydroControl.cpp` `emitPhControllerMetric` |
| Handler | `HydroSystemCore.cpp` `handlePhMetricEvent` |
| MQTT | `MqttClient.cpp` `publishPhMetric` |
| Bridge | `bridge/index.js` `validatePhMetric` |
| UI | `controller-metrics.ts`, `ControllerMetricsChart.tsx` |

---

## 10. Relacionado

| Doc | Uso |
|-----|-----|
| [S01_PH_DOSAGES_E2E.md](S01_PH_DOSAGES_E2E.md) | Eventos (V2) |
| [S02_EC_CONTROLLER_METRICS.md](../ec/S02_EC_CONTROLLER_METRICS.md) | Paridad EC (V3) |
| [S03_BRIDGE_METRICS.md](../ec/S03_BRIDGE_METRICS.md) | Deploy bridge + ACL |
| [S05_FLUJO_CICLO_ADAPTATIVO.md](S05_FLUJO_CICLO_ADAPTATIVO.md) | Ciclo adaptativo pH |
| [00_GUIA_DOSING_VS_METRICAS.md](../00_GUIA_DOSING_VS_METRICAS.md) | Debug global |
