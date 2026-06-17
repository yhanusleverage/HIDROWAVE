# S01 — Auto pH / ph_dosages (eventos)

**Gate:** V2 · **Device:** `ESP32_HIDRO_269844` · **Estado:** Pipeline OK en prod

**Índice:** [00_GUIA_DOSING_VS_METRICAS.md](../00_GUIA_DOSING_VS_METRICAS.md) · [00_INDICE_SERIAL pH](00_INDICE_SERIAL.md)

---

## 1. Qué es / qué NO es

| Es | No es |
|----|-------|
| Una fila por **corrección pH** cuando el relé ácido/base **apaga** | Métricas de cada `checkAutoPH` → [S02](S02_PH_CONTROLLER_METRICS.md) |
| Evento inmutable (`direction` up/down, ml, ph_before) | Preview u(t) live en UI (eso es cálculo local) |
| Última dosagem en PhDosageDetail | Gráfico error_h 24h |

**Tabla:** `ph_dosages` · **MQTT:** `hidrowave/{id}/ph_dose` (QoS 1)

---

## 2. Flujo

```
ESP emitPhDoseEvent (relé OFF)
  → MQTT hidrowave/{id}/ph_dose
  → bridge upsert ph_dosages
  → Realtime → PhDosageDetail / PhAutoStatusCard

Paralelo:
  → MQTT ph_operation → relay_master.ph_operation_*

Backup (MQTT falla):
  → ESP HTTPS POST ph_dosages
```

Sendero completo pH (calibragem, NVS, bancada): [00_INDICE_SERIAL.md](00_INDICE_SERIAL.md) S01–S08.

---

## 3. SQL (orden)

1. [`ADD_PH_CONTROLLER_COLUMNS.sql`](../../../scripts/ADD_PH_CONTROLLER_COLUMNS.sql)
2. [`MIGRATE_PH_ADAPTIVE.sql`](../../../scripts/MIGRATE_PH_ADAPTIVE.sql)
3. [`MIGRATE_PH_CALIBRATION.sql`](../../../scripts/MIGRATE_PH_CALIBRATION.sql)
4. [`NUTRIENT_DOSAGES_DEDUP_INDEX.sql`](../../../scripts/NUTRIENT_DOSAGES_DEDUP_INDEX.sql) — §2 `idx_ph_dosages_dedup`
5. [`ENABLE_REALTIME_REPLICATION.sql`](../../../scripts/ENABLE_REALTIME_REPLICATION.sql)

Orden completo: [`RUN_PH_PROD_MIGRATIONS.md`](../../../scripts/RUN_PH_PROD_MIGRATIONS.md)

---

## 4. Verify automatizado (Gate V2)

```bash
cd HIDROWAVE-main
npm run verify:ph-dosages
npm run verify:e2e-schema
```

Esperado: `E2E ph_dosages OK` + `ph_dosages table: accessible`

SQL: [`VERIFICAR_PH_DOSAGES_E2E.sql`](../../../scripts/VERIFICAR_PH_DOSAGES_E2E.sql)

---

## 5. Validación por capa

### SQL

- [ ] Tabla `ph_dosages` + `relay_master.ph_operation_*`
- [ ] `idx_ph_dosages_dedup`
- [ ] Realtime `ph_dosages`

### Firmware

- [ ] Boot: topic `ph_dose`
- [ ] Tras corrección: `[MQTT] ph_dose down 2.50 ml relé 3`
- [ ] pH inválido → no ciclo (`isValidPhReading`)
- [ ] K aprendido persiste post-recirc (PATCH ph_config, no en ph_dose)

### Bridge

- [ ] Subscribe: `ph_operation`, `ph_dose` (ver [S07_BRIDGE_MQTT.md](S07_BRIDGE_MQTT.md))
- [ ] Log: `[bridge] INSERT ph_dosages ...`

### UI

- [ ] PhDosageDetail — última fila
- [ ] Badges Dosando / Recirc
- [ ] `/calibragem` — K separado de última dosagem

---

## 6. Logs esperados

**Bridge:**

```
[bridge] INSERT ph_dosages ESP32_HIDRO_269844 down 2.50ml seq=251950
```

**Serial:**

```
[MQTT] ph_dose down 2.50 ml relé 3
[MQTT] ph_operation dosing rem=...s next=...s
⏳ [RECIRC] Aguardando 60 s ...
```

---

## 7. KPI cierre V2

| KPI | Criterio |
|-----|----------|
| Latencia badge | UI "Dosando" < 2 s |
| Latencia ml | PhDosageDetail < 3 s tras OFF |
| Sin duplicados | 1 corrección = 1 fila |
| Recirc | Badge ~`tempo_recirculacao` s |

Runbook: [`BANCADA_AUTO_PH_CHECKLIST.md`](../../../scripts/BANCADA_AUTO_PH_CHECKLIST.md) · [S08_BANCADA_KPI.md](S08_BANCADA_KPI.md)

---

## 8. Troubleshooting

| Síntoma | Causa | Acción |
|---------|-------|--------|
| Filas con `ph_before` basura (-8e27) | Sensor off en histórico | Arreglar hardware; no confundir con métricas |
| UI sin última dosagem | Realtime / sin filas | verify V2 |
| Bridge sin `ph_dose` subscribe | Bridge viejo | S07 redeploy |
| Dosagem 50 ml repetida | auto on + pH inválido legacy | Desactivar auto; flash interlock |
| Badge stuck dosing | heartbeat ph_operation | [S08](S08_BANCADA_KPI.md) + reset SQL |

---

## 9. Infra y código

| Componente | Ubicación |
|------------|-----------|
| Bridge | Lightsail `/opt/hidrowave-bridge` |
| Firmware | `HydroSystemCore.cpp` `handlePhDoseEvent` |
| UI | `PhDosageDetail.tsx`, `usePhOperationState.ts` |

---

## 10. Relacionado

| Doc | Uso |
|-----|-----|
| [S02_PH_CONTROLLER_METRICS.md](S02_PH_CONTROLLER_METRICS.md) | Métricas ciclo (V4) |
| [S01_NUTRIENT_DOSAGES_E2E.md](../ec/S01_NUTRIENT_DOSAGES_E2E.md) | Paridad EC eventos (V1) |
| [HANDOFF_AUTO_PH_E2E.md](../../HANDOFF_AUTO_PH_E2E.md) | Resumen arquitectura |
| [S07_BRIDGE_MQTT.md](S07_BRIDGE_MQTT.md) | Deploy bridge pH |
