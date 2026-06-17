# Handoff — Modo dev: sin interlocks por sensores (17/jun/2026)

**Fecha:** 17/06/2026 · **Device ref:** `ESP32_HIDRO_269844`  
**Contexto:** bancada sin sondas EC/pH cableadas; bridge y ACL de métricas OK en Lightsail; ESP bloqueaba `ec_metric` por lecturas inválidas (EC=0).

**Estado (17/06 tarde):**
- Firmware `HIDRO_DEV_RELAX_SENSORS=1` — flasheado OK
- **Gate V3 cerrado** — `npm run verify:controller-metrics` OK (5 filas `err=555`)
- Bridge `INSERT ec_controller_metrics` confirmado en journalctl
- Fix telemetría parcial + `validatePhMetric` (`error_h` finito) en `index.js` — **deploy Lightsail pendiente**
- **Dosaje dev:** PV crudo EC/pH para control (sin `ecForControl=setpoint`); `AdaptivePHController` clamp H + path lineal si pH fuera 0–14

**Relacionado:** [00_GUIA_DOSING_VS_METRICAS.md](handoffs/00_GUIA_DOSING_VS_METRICAS.md) · [ec/S02](handoffs/ec/S02_EC_CONTROLLER_METRICS.md) · [ec/S03 bridge](handoffs/ec/S03_BRIDGE_METRICS.md)

---

## Resumen ejecutivo

| Capa | Estado |
|------|--------|
| Firmware `ec_metric` cada ~3s | OK — `[MQTT] ec_metric err=555 u(t)=0.00ml adj=0` |
| Bridge `INSERT ec_controller_metrics` | OK |
| Gate V3 (`verify:controller-metrics`) | **Cerrado** — 17/06/2026 |
| Telemetría parcial (solo niveles) | Fix en repo; deploy bridge pendiente |
| Gate V4 (`ph_controller_metrics`) | Tras flash + Auto pH ON: `errH` finito (no `inf`); bridge sanitiza `error_h` si aplica |
| Dosaje auto EC/pH en banco | PV crudo — EC=0 vs SP 555 dosifica; pH RS485 absurdo usa path lineal + `error_h` proxy |

---

## Verificación V3 (cerrada)

```bash
cd HIDROWAVE-main
npm run verify:controller-metrics
```

Resultado esperado (obtenido 17/06):

```
OK recent EC metrics: 5 rows (last 5)
  ... | err=555 | u(t)=0 ml
E2E controller metrics OK
```

---

## Telemetría parcial — fix bridge (deploy pendiente)

**Síntoma:** `Rejected telemetry: temperature/ph/tds must be numbers`  
**Causa:** firmware dev omite pH/TDS/temp inválidos; bridge exigía los 3 campos.  
**Fix:** `validateTelemetry` en [`infra/mqtt/bridge/index.js`](../ESP-HIDROWAVE-main/infra/mqtt/bridge/index.js) — acepta payload solo con `water_level_ok` + `level_1..4`; INSERT `hydro_measurements` solo si hay al menos un PV hidro; si no, `PATCH device_status` niveles + log `levels-only`.

**Deploy (una vez):**

```powershell
cd ESP-HIDROWAVE-main\infra\mqtt\bridge\scripts
.\deploy-lightsail.ps1
```

O manual:

```powershell
$Pem = "$env:USERPROFILE\Documents\Projects\LightsailDefaultKey-ca-central-1.pem"
scp -i $Pem ESP-HIDROWAVE-main\infra\mqtt\bridge\index.js ubuntu@99.79.36.220:/tmp/hidrowave-index.js
ssh -i $Pem ubuntu@99.79.36.220 "sudo cp /tmp/hidrowave-index.js /opt/hidrowave-bridge/index.js && sudo systemctl restart hidrowave-bridge"
```

**Post-deploy:** journalctl ya no debe mostrar `Rejected telemetry`; debe aparecer `telemetry ... levels-only` o `PATCH device_status ... water_level=`.

---

## Cambios firmware (referencia)

| Archivo | Cambio |
|---------|--------|
| `include/Config.h` + `platformio.ini` | `HIDRO_DEV_RELAX_SENSORS=1` |
| `HydroControl.cpp` | PV crudo para control EC/pH; métricas siempre; `emitPhControllerMetric` fallback `error_h` |
| `AdaptivePHController.cpp` | clamp H en dev; `selectPath`/`errorH` lineales si pH fuera 0–14 |
| `MqttClient.cpp` | telemetría parcial |
| `HydroSystemCore.cpp` | banner boot `[DEV]` |

Producción futura: `HIDRO_DEV_RELAX_SENSORS=0` cuando sondas reales estén cableadas.

---

## Próximo paso

1. Deploy bridge (telemetría parcial + `error_h`) — comando arriba; `deploy-lightsail.ps1` usa `$BridgeDir = Split-Path $PSScriptRoot -Parent`
2. Flash firmware con dosaje dev → activar **Auto EC** y **Auto pH** en frontend
3. Serial: `[MQTT] ec_metric ... adj=1`, `ph_metric errH=...` finito; bridge `INSERT nutrient_dosages` / `ph_controller_metrics`
4. `npm run verify:controller-metrics` — filas EC **y** pH
5. Con sondas reales: desactivar `HIDRO_DEV_RELAX_SENSORS`
