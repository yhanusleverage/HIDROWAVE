# S01 — Auto EC / nutrient_dosages (eventos)

**Gate:** V1 · **Device:** `ESP32_HIDRO_269844` · **Estado:** Pipeline OK en prod

**Índice:** [00_GUIA_DOSING_VS_METRICAS.md](../00_GUIA_DOSING_VS_METRICAS.md) · [00_INDICE_SERIAL EC](00_INDICE_SERIAL.md)

---

## 1. Qué es / qué NO es

| Es | No es |
|----|-------|
| Una fila por **nutriente** cuando el relé peristáltico **termina** (OFF) | Métricas de cada `checkAutoEC` → ver [S02](S02_EC_CONTROLLER_METRICS.md) |
| Evento inmutable ISA-88 (CO) | Simulación React ni inferencia desde `relay_commands` |
| SUM(ml) del último `sequence_id` en UI | Gráfico histórico error EC vs tiempo |

**Tabla:** `nutrient_dosages` · **MQTT:** `hidrowave/{id}/dose` (QoS 1)

---

## 2. Flujo

```
ESP emitNutrientDoseEvent (relé OFF)
  → MQTT hidrowave/{id}/dose
  → bridge upsert nutrient_dosages
  → Realtime → useLastDosage (SUM último sequence_id)

Paralelo estado máquina:
  → MQTT ec_operation → relay_master.ec_operation_*

Backup (solo si MQTT falla):
  → ESP HTTPS POST nutrient_dosages
```

---

## 3. SQL (orden)

1. [`CRIAR_TABELA_NUTRIENT_DOSAGES.sql`](../../../scripts/CRIAR_TABELA_NUTRIENT_DOSAGES.sql)
2. [`NUTRIENT_DOSAGES_DEDUP_INDEX.sql`](../../../scripts/NUTRIENT_DOSAGES_DEDUP_INDEX.sql)
3. [`FIX_NUTRIENT_DOSAGES_RLS.sql`](../../../scripts/FIX_NUTRIENT_DOSAGES_RLS.sql) — si bridge falla RLS
4. [`ENABLE_REALTIME_REPLICATION.sql`](../../../scripts/ENABLE_REALTIME_REPLICATION.sql)

---

## 4. Verify automatizado (Gate V1)

```bash
cd HIDROWAVE-main
npm run verify:nutrient-dosages
```

Esperado: `E2E nutrient_dosages OK`

SQL manual: [`VERIFICAR_NUTRIENT_DOSAGES_E2E.sql`](../../../scripts/VERIFICAR_NUTRIENT_DOSAGES_E2E.sql) secciones 6–8

---

## 5. Validación por capa

### SQL

- [ ] Tabla `nutrient_dosages` existe
- [ ] `idx_nutrient_dosages_dedup` activo
- [ ] `nutrient_dosages` en `supabase_realtime`
- [ ] Columnas `relay_master.ec_operation_*` presentes

### Firmware

- [ ] Boot lista topic `dose`
- [ ] Tras ciclo: `[MQTT] dose 23 0.93 ml relé 5`
- [ ] Interlock: EC=0 → no dosagem
- [ ] Tras secuencia: `SEQUÊNCIA COMPLETA` + recirc

### Bridge (Lightsail)

- [ ] Subscribe incluye `dose`
- [ ] Log: `[bridge] INSERT nutrient_dosages ...`

### UI (`/automacao`)

- [ ] Última dosagem: SUM ml (no `--`)
- [ ] Badges: Dosando → Recirc → idle
- [ ] Detalhe da última dosagem: filas por nutriente

---

## 6. Logs esperados

**Bridge:**

```
[bridge] INSERT nutrient_dosages ESP32_HIDRO_269844 CAGE 0.93ml seq=116020
```

**Serial (MQTT OK):**

```
[MQTT] dose CAGE 0.93 ml relé 7
[MQTT] ec_operation dosing rem=...s next=...s
```

**Serial (fallback HTTPS, broker caído):**

```
💾 [DOSAGEM] INSERT nutrient_dosages (HTTPS fallback): ...
```

---

## 7. KPI cierre V1

| KPI | Criterio |
|-----|----------|
| 1 nutriente = 1 fila | dedup por `sequence_id` + nutriente |
| SUM UI ≈ serial u(t) | \|Δ\| < 0.05 ml |
| Latencia UI | < 3 s tras OFF relé |
| Badge recirc | ~`tempo_recirculacao` s |

Checklist soak: [`BANCADA_EC_REMAINDER_CHECKLIST.md`](../../../scripts/BANCADA_EC_REMAINDER_CHECKLIST.md)

---

## 8. Troubleshooting

| Síntoma | Causa probable | Acción |
|---------|----------------|--------|
| UI siempre `-- ml` | SQL / Realtime / sin filas | V1 verify + Realtime script |
| Duplicados mismo nutriente | dedup ausente | `NUTRIENT_DOSAGES_DEDUP_INDEX.sql` |
| Badge recirc stuck | firmware viejo | Flash + columnas `ec_operation_*` |
| Dosagem con EC=0 | interlock off | Flash + desactivar auto sin sensor |
| `[MQTT] dose` OK, UI no | Realtime | `ENABLE_REALTIME_REPLICATION.sql` |
| Solo HTTPS, nunca MQTT | broker caído | `systemctl status hidrowave-bridge` |

---

## 9. Infra y código

| Componente | Ubicación |
|------------|-----------|
| Bridge | Lightsail `ubuntu@99.79.36.220` → `/opt/hidrowave-bridge` |
| Firmware dose | `ESP-HIDROWAVE-main/src/HydroSystemCore.cpp` `handleNutrientDoseEvent` |
| Bridge insert | `ESP-HIDROWAVE-main/infra/mqtt/bridge/index.js` `insertDose` |
| UI | `src/hooks/useLastDosage.ts`, `NutrientDosageDetail.tsx` |

```bash
sudo journalctl -u hidrowave-bridge -f
```

---

## 10. Relacionado

| Doc | Uso |
|-----|-----|
| [S02_EC_CONTROLLER_METRICS.md](S02_EC_CONTROLLER_METRICS.md) | Métricas ciclo EC (V3) — **no confundir** |
| [S01_PH_DOSAGES_E2E.md](../ph/S01_PH_DOSAGES_E2E.md) | Paridad pH eventos (V2) |
| [HANDOFF_ULTIMA_DOSAGEM_E2E.md](../../HANDOFF_ULTIMA_DOSAGEM_E2E.md) | Evidencia bancada 16/jun |
