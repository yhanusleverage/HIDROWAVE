# S02 — Auto EC / ec_controller_metrics (métricas de ciclo)

**Gate:** V3 · **Device:** `ESP32_HIDRO_269844` · **Estado:** SQL OK prod; filas pendientes post-flash

**Índice:** [00_GUIA_DOSING_VS_METRICAS.md](../00_GUIA_DOSING_VS_METRICAS.md) · [00_INDICE_SERIAL EC](00_INDICE_SERIAL.md)

---

## 1. Qué es / qué NO es

| Es | No es |
|----|-------|
| Una fila por cada `checkAutoEC` con PV EC válido | Una fila por nutriente dosado → [S01](S01_NUTRIENT_DOSAGES_E2E.md) |
| Registra SP, PV, error, u(t) calculado, flags `adjustment_*` | Evento cuando el relé apaga |
| Gráfico dashboard error + u(t) 24h | Última dosagem ml en `/automacao` |

**Tabla:** `ec_controller_metrics` · **MQTT:** `hidrowave/{id}/ec_metric` (QoS 0)

---

## 2. Flujo

```
HydroControl::checkAutoEC (cada intervalo_auto_ec)
  → emitEcControllerMetric
  → MQTT ec_metric (primario)
  → bridge INSERT ec_controller_metrics
  → dashboard ControllerMetricsChart (poll 60s)

Backup (broker caído):
  → SupabaseClient::insertEcControllerMetric (HTTPS)
```

**Nota:** Se emite aunque `adjustment_applied=false` (sin dosagem en ese tick).

---

## 3. SQL (orden)

**Un solo archivo recomendado:**

[`RUN_CONTROLLER_METRICS_MIGRATIONS.sql`](../../../scripts/RUN_CONTROLLER_METRICS_MIGRATIONS.sql)

(Crea `ec_controller_metrics` + `ph_controller_metrics` + Realtime seguro)

Alternativa individual: [`CRIAR_TABELA_EC_CONTROLLER_METRICS.sql`](../../../scripts/CRIAR_TABELA_EC_CONTROLLER_METRICS.sql)

Verificación: [`VERIFICAR_CONTROLLER_METRICS_E2E.sql`](../../../scripts/VERIFICAR_CONTROLLER_METRICS_E2E.sql)

**Error común:** ejecutar `ENABLE_REALTIME_REPLICATION.sql` **antes** de crear tablas → `42P01`. El script unificado evita esto.

---

## 4. Verify automatizado (Gate V3)

```bash
cd HIDROWAVE-main
npm run verify:controller-metrics
```

| Resultado | Significado |
|-----------|-------------|
| `accessible` + 0 rows | SQL OK; falta firmware/bridge/datos |
| `FALTA` | Ejecutar `RUN_CONTROLLER_METRICS_MIGRATIONS.sql` |
| Filas recientes | V3 cerrado |

---

## 5. Validación por capa (paso a paso)

| Paso | Acción | Gate |
|------|--------|------|
| 1 | SQL migración | 2 tablas en `information_schema` |
| 2 | `verify:controller-metrics` | accessible |
| 3 | Flash ESP firmware actual | boot: topic `ec_metric` en serial |
| 4 | Bridge deploy + ACL + handlers | [S03_BRIDGE_METRICS.md](S03_BRIDGE_METRICS.md) — `deploy-lightsail.ps1` |
| 5 | Gate R1 regresión | `npm run test:pub:ec-dose` (dose intacto) |
| 6 | Auto EC ON, EC ≥ 50 µS/cm | `[MQTT] ec_metric err=... u(t)=...` |
| 7 | Bridge journalctl | `INSERT ec_controller_metrics` |
| 8 | Dashboard | card con puntos 24h |

Checklist:

- [ ] Paso 1–2 SQL + verify
- [ ] Paso 3 flash
- [ ] Paso 4–5 bridge + regresión R1
- [ ] Paso 6–7 datos en Supabase
- [ ] Paso 8 UI dashboard

---

## 6. Logs esperados

**Serial:**

```
[MQTT] topics ... ec_metric=hidrowave/ESP32_HIDRO_269844/ec_metric ...
[MQTT] ec_metric err=200 u(t)=4.28ml adj=0
```

**Bridge:**

```
[bridge] INSERT ec_controller_metrics ESP32_HIDRO_269844 err=200 u(t)=4.28ml
```

**HTTPS fallback:**

```
💾 [EC METRIC] INSERT ec_controller_metrics err=200 u(t)=4.28 ml
```

---

## 7. KPI cierre V3

| KPI | Criterio |
|-----|----------|
| Frecuencia | ~1 fila / `intervalo_auto_ec` con auto ON |
| Campos | `ec_error`, `dosage_ml`, `adjustment_needed` coherentes con serial |
| Sin spam duplicado | 1 fila por tick (no upsert) |
| UI | Al menos 2 puntos en gráfico tras 2 ciclos |

---

## 8. Troubleshooting

| Síntoma | Causa | Acción |
|---------|-------|--------|
| 0 filas, `nutrient_dosages` OK | Firmware sin métricas o auto off | Flash + activar Auto EC |
| 0 filas, sin `[MQTT] ec_metric` | EC inválido (0 / desconectado) | Conectar sonda |
| Tabla no existe | SQL no ejecutado | `RUN_CONTROLLER_METRICS_MIGRATIONS.sql` |
| `Rejected ec_metric` | Payload JSON inválido | Ver serial + `validateEcMetric` bridge |
| Bridge sin topic | ACL / bridge viejo | [S03_BRIDGE_METRICS.md](S03_BRIDGE_METRICS.md) |
| Subscribe sí, sin INSERT | Handlers faltantes (bridge pre-jun/2026) | Redeploy `index.js` |
| Verify OK, UI vacía | 0 filas o poll | Esperar ciclos; revisar dashboard device_id |

**Diagnóstico rápido:** eventos OK + métricas 0 → casi siempre **flash firmware** o **auto_enabled=false**.

---

## 9. Código clave

| Pieza | Ruta |
|-------|------|
| Emisión | `ESP-HIDROWAVE-main/src/HydroControl.cpp` `emitEcControllerMetric` |
| Transporte | `ESP-HIDROWAVE-main/src/HydroSystemCore.cpp` `handleEcMetricEvent` |
| MQTT | `ESP-HIDROWAVE-main/src/MqttClient.cpp` `publishEcMetric` |
| Bridge | `ESP-HIDROWAVE-main/infra/mqtt/bridge/index.js` `validateEcMetric`, `insertEcMetric` |
| UI | `src/lib/controller-metrics.ts`, `ControllerMetricsChart.tsx` |

---

## 10. Relacionado

| Doc | Uso |
|-----|-----|
| [S01_NUTRIENT_DOSAGES_E2E.md](S01_NUTRIENT_DOSAGES_E2E.md) | Eventos dose (V1) |
| [S02_PH_CONTROLLER_METRICS.md](../ph/S02_PH_CONTROLLER_METRICS.md) | Paridad pH métricas (V4) |
| [S03_BRIDGE_METRICS.md](S03_BRIDGE_METRICS.md) | Deploy bridge + ACL métricas |
| [00_GUIA_DOSING_VS_METRICAS.md](../00_GUIA_DOSING_VS_METRICAS.md) | Matriz debug global |
