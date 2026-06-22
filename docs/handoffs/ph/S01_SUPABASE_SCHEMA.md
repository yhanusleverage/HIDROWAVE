# S01 — Supabase schema Auto pH

**Prerequisito:** acceso SQL Editor prod/staging  
**Duración estimada:** 15–30 min  
**Siguiente:** [S02_FIRMWARE_NVS_BOOT.md](S02_FIRMWARE_NVS_BOOT.md)

---

## Ejecutar

Ejecutar **un script por vez** en Supabase SQL Editor:

| # | Script |
|---|--------|
| 1 | [`scripts/CREATE_PH_CONFIG_VIEW.sql`](../../../scripts/CREATE_PH_CONFIG_VIEW.sql) (si la view no existe) |
| 2 | [`scripts/ADD_PH_CONTROLLER_COLUMNS.sql`](../../../scripts/ADD_PH_CONTROLLER_COLUMNS.sql) |
| 3 | [`scripts/MIGRATE_PH_ADAPTIVE.sql`](../../../scripts/MIGRATE_PH_ADAPTIVE.sql) |
| 4 | [`scripts/MIGRATE_PH_CALIBRATION.sql`](../../../scripts/MIGRATE_PH_CALIBRATION.sql) |
| 5 | [`scripts/CREATE_RPC_ACTIVATE_AUTO_PH.sql`](../../../scripts/CREATE_RPC_ACTIVATE_AUTO_PH.sql) |
| 6 | [`scripts/ENABLE_REALTIME_REPLICATION.sql`](../../../scripts/ENABLE_REALTIME_REPLICATION.sql) (incluye `ph_dosages`) |

Detalle orden: [`scripts/RUN_PH_PROD_MIGRATIONS.md`](../../../scripts/RUN_PH_PROD_MIGRATIONS.md)

---

## Verificar (gate)

```bash
cd HIDROWAVE-main
node scripts/verify-e2e-schema.js
```

Esperado: `SCHEMA OK` con filas `ph_config_view`, `ph_operation_*`, `ph_dosages`.

SQL adicional: [`scripts/VERIFICAR_PH_DOSAGES_E2E.sql`](../../../scripts/VERIFICAR_PH_DOSAGES_E2E.sql)

Test INSERT opcional:

```sql
INSERT INTO ph_dosages (device_id, sequence_id, direction, relay_number, dosage_ml, dosage_time_seconds, ph_before, ph_setpoint, source)
VALUES ('ESP32_HIDRO_269844', 'test-ph-001', 'up', 1, 2.5, 3.0, 5.8, 6.0, 'auto_ph');
```

---

## Si falla

| Síntoma | Acción |
|---------|--------|
| Columna ya existe | Normal con `IF NOT EXISTS` — continuar |
| `ph_config_view` missing | Ejecutar paso 1 primero |
| verify-e2e FAIL | Revisar qué check falló; no pasar a S02 |

---

## Siguiente

[S02 — Firmware NVS boot](S02_FIRMWARE_NVS_BOOT.md)
