# S01 — Auto pH / ph_dosages E2E

**Fecha:** Jun 2026  
**Device:** `ESP32_HIDRO_269844`  
**Estado:** Pipeline OK en prod (paridad con nutrient_dosages)

---

## Flujo

```
ESP emitPhDoseEvent
  → MQTT hidrowave/{id}/ph_dose
  → bridge upsert ph_dosages
  → UI PhDosageDetail / PhAutoStatusCard

Backup (solo si MQTT falla):
  → ESP HTTPS POST ph_dosages
```

---

## Infra

| Componente | Ubicación |
|------------|-----------|
| Bridge | Lightsail `ubuntu@99.79.36.220` → `/opt/hidrowave-bridge` |
| Supabase | `bzqhhcmekhhnwzioppai.supabase.co` |
| Tablas | `ph_dosages`, `relay_master.ph_operation_*` |

### Logs bridge

```bash
sudo journalctl -u hidrowave-bridge -f
sudo systemctl restart hidrowave-bridge
```

Gate subscribe: log debe incluir `ph_operation` y `ph_dose` (ver [S07_BRIDGE_MQTT.md](S07_BRIDGE_MQTT.md)).

---

## SQL (orden)

1. [`ADD_PH_CONTROLLER_COLUMNS.sql`](../../../scripts/ADD_PH_CONTROLLER_COLUMNS.sql)
2. [`MIGRATE_PH_ADAPTIVE.sql`](../../../scripts/MIGRATE_PH_ADAPTIVE.sql)
3. [`MIGRATE_PH_CALIBRATION.sql`](../../../scripts/MIGRATE_PH_CALIBRATION.sql)
4. [`NUTRIENT_DOSAGES_DEDUP_INDEX.sql`](../../../scripts/NUTRIENT_DOSAGES_DEDUP_INDEX.sql) — §2 `idx_ph_dosages_dedup`
5. [`ENABLE_REALTIME_REPLICATION.sql`](../../../scripts/ENABLE_REALTIME_REPLICATION.sql)

Orden completo: [`RUN_PH_PROD_MIGRATIONS.md`](../../../scripts/RUN_PH_PROD_MIGRATIONS.md)

---

## Verificación

### Node (desde `HIDROWAVE-main/`)

```bash
npm run verify:ph-dosages
npm run verify:e2e-schema
```

### SQL

[`VERIFICAR_PH_DOSAGES_E2E.sql`](../../../scripts/VERIFICAR_PH_DOSAGES_E2E.sql)

---

## Logs esperados (OK)

**Bridge:**

```
[bridge] INSERT ph_dosages ESP32_HIDRO_269844 down 2.50ml seq=...
```

**Serial:**

```
[MQTT] ph_dose down 2.50 ml relé 3
[MQTT] ph_operation dosing rem=...s next=...s
```

---

## KPI bancada (S08)

| KPI | Criterio |
|-----|----------|
| Latencia badge | UI "Dosando" < 2 s tras inicio |
| Latencia ml | PhDosageDetail < 3 s tras OFF relé |
| Sin duplicados | 1 corrección = 1 fila (`idx_ph_dosages_dedup`) |
| Recirc | Badge ~`tempo_recirculacao` s |

Runbook: [`scripts/BANCADA_AUTO_PH_CHECKLIST.md`](../../../scripts/BANCADA_AUTO_PH_CHECKLIST.md)

---

## Relacionado

| Doc | Uso |
|-----|-----|
| [00_INDICE_SERIAL.md](00_INDICE_SERIAL.md) | Gates S01–S08 |
| [S01_NUTRIENT_DOSAGES_E2E.md](../ec/S01_NUTRIENT_DOSAGES_E2E.md) | Paridad EC |
| [HANDOFF_AUTO_PH_E2E.md](../../HANDOFF_AUTO_PH_E2E.md) | Resumen arquitectura |
