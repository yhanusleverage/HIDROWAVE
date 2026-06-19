# Handoff — Modo dev: sin interlocks por sensores (17/jun/2026)

**Fecha:** 17/06/2026 · **Device ref:** `ESP32_HIDRO_269844`  
**Contexto:** bancada sin sondas EC/pH cableadas; bridge y ACL de métricas OK en Lightsail; ESP bloqueaba `ec_metric` por lecturas inválidas (EC=0).

**Estado (17/06 noche — actualizado):**
- Firmware `HIDRO_DEV_RELAX_SENSORS=1` — flasheado OK
- **Gate V3 cerrado** — `npm run verify:controller-metrics` OK (EC + pH)
- **Gate V4 cerrado** — `ph_controller_metrics` INSERT en journalctl; `u(t)=0.26ml`
- **Bridge Lightsail deploy cerrado** — `INSERT hydro_measurements` con `ph_raw` / `ph_display_clamped`
- **Realtime UI** — cards/charts dashboard actualizan por WSS tras INSERT hydro
- **Dosaje dev:** PV crudo EC/pH para control; `AdaptivePHController` clamp H + path lineal si pH fuera 0–14

**Relacionado:** [00_GUIA_DOSING_VS_METRICAS.md](handoffs/00_GUIA_DOSING_VS_METRICAS.md) · [ec/S02](handoffs/ec/S02_EC_CONTROLLER_METRICS.md) · [ec/S03 bridge](handoffs/ec/S03_BRIDGE_METRICS.md)

---

## Resumen ejecutivo

| Capa | Estado |
|------|--------|
| Firmware `ec_metric` / `ph_metric` | OK |
| Bridge `INSERT ec_controller_metrics` / `ph_controller_metrics` | OK |
| Bridge `INSERT hydro_measurements` (`ph_raw`, `tds`, `ec_raw`) | **OK** — 17/06 |
| Gate V3 + V4 (`verify:controller-metrics`) | **Cerrado** |
| Gate hydro raw (`verify:hydro-raw`) | Tras INSERT reciente en Supabase |
| Telemetría parcial (solo niveles o pH sin temp) | OK — whitelist + defaults legacy NOT NULL |
| Realtime dashboard pH/EC | OK — `ph_raw` en cards, `ph_display_clamped` en gráfico |
| Dosaje auto EC/pH en banco | PV crudo — EC=0 vs SP 555 dosifica; pH path lineal + `error_h` proxy |

---

## Verificación gates (local)

```bash
cd HIDROWAVE-main
npm run verify:controller-metrics   # V3 + V4
npm run verify:hydro-raw            # hydro_measurements ph_raw reciente
npm run verify:ph-dosages           # V2 eventos
npm run verify:nutrient-dosages     # V1 eventos
```

Resultado esperado `verify:hydro-raw` (post-bridge):

```
OK recent hydro rows: 5 rows
OK fresh insert: last row < 10 min ago
OK ph_raw populated: at least one row
E2E hydro raw OK
```

---

## Bridge — journalctl esperado (Lightsail)

```bash
sudo journalctl -u hidrowave-bridge -f
```

| Log | Significado |
|-----|-------------|
| `INSERT hydro_measurements … ph_raw=12.16 ph_disp=12.16 tds=0 ec_raw=0` | Pipeline hydro OK |
| `INSERT ph_controller_metrics … u(t)=0.26ml` | V4 OK |
| `INSERT ec_controller_metrics` | V3 OK |
| `Could not find the 'ec' column` | Bridge viejo — redeploy `index.js` |
| `null value in column "temperature"` | Bridge sin `applyLegacyHydroNotNullDefaults` — redeploy |

**Redeploy (si hace falta):**

```powershell
cd ESP-HIDROWAVE-main\infra\mqtt\bridge\scripts
.\deploy-lightsail.ps1
```

---

## Columnas `ph_raw` / Supabase

| Script | Uso |
|--------|-----|
| [`scripts/ADD_HYDRO_RAW_DISPLAY_COLUMNS.sql`](../scripts/ADD_HYDRO_RAW_DISPLAY_COLUMNS.sql) | Migración columnas |
| [`scripts/BACKFILL_HYDRO_PH_RAW.sql`](../scripts/BACKFILL_HYDRO_PH_RAW.sql) | Rellenar filas legacy |
| [`scripts/ALLOW_NULL_HYDRO_SENSOR_COLUMNS.sql`](../scripts/ALLOW_NULL_HYDRO_SENSOR_COLUMNS.sql) | Opcional — quitar NOT NULL en temp/ph/tds |
| [`scripts/VERIFICAR_HYDRO_RAW_COLUMNS.sql`](../scripts/VERIFICAR_HYDRO_RAW_COLUMNS.sql) | Verificación SQL |

Bridge: `pickHydroInsertRow` (whitelist sin `ec`) + `applyHydroRawColumns` + `applyLegacyHydroNotNullDefaults`.

---

## Cambios firmware (referencia)

| Archivo | Cambio |
|---------|--------|
| `include/Config.h` + `platformio.ini` | `HIDRO_DEV_RELAX_SENSORS=1` |
| `HydroControl.cpp` | PV crudo para control EC/pH; métricas siempre |
| `AdaptivePHController.cpp` | clamp H en dev; path lineal si pH fuera 0–14 |
| `MqttClient.cpp` | telemetría parcial — campos crudos si finitos |
| `HydroSystemCore.cpp` | skip `sendSensorDataToSupabase()` si MQTT conectado; banner `[DEV]` |

Producción futura: `HIDRO_DEV_RELAX_SENSORS=0` cuando sondas reales estén cableadas.

---

## Próximo paso (post-hydro OK)

1. **Fase 3 comandos** — env `MQTT_*` en Railway → [`HANDOFF_FASE3_COMANDOS_HIBRIDOS.md`](../../ESP-HIDROWAVE-main/docs/mqtt/HANDOFF_FASE3_COMANDOS_HIBRIDOS.md)
2. **Manual Dosificar E2E** — reflash ACK + [`VERIFICAR_RELAY_COMMANDS_STUCK.sql`](../scripts/VERIFICAR_RELAY_COMMANDS_STUCK.sql)
3. Con sondas reales: desactivar `HIDRO_DEV_RELAX_SENSORS` + validar QC 4–9 en UI prod
