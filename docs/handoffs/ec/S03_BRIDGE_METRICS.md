# S03 — Bridge MQTT métricas (ec_metric / ph_metric)

**Prerequisito:** SQL métricas OK (`verify:controller-metrics` → accessible)  
**No tocar:** handlers `dose` / `ph_dose` (V1/V2 cerrados en prod)

**Índice:** [00_GUIA_DOSING_VS_METRICAS.md](../00_GUIA_DOSING_VS_METRICAS.md) · [S02 EC](S02_EC_CONTROLLER_METRICS.md) · [S02 pH](../ph/S02_PH_CONTROLLER_METRICS.md)

---

## 1. Qué cambia (solo aditivo)

| Componente | Antes | Después |
|------------|-------|---------|
| `index.js` TOPICS | ya incluía `ec_metric`, `ph_metric` | igual |
| `index.js` handlers | **faltaban** — mensajes ignorados | `handleEcMetric` + `handlePhMetric` + INSERT |
| ACL Mosquitto | solo `dose` / `ph_dose` | + `read ec_metric`, `read ph_metric` |
| ESP ACL | `write hidrowave/{id}/#` | **sin cambio** |

---

## 2. Deploy Lightsail (orden seguro)

### Desde PC (PowerShell)

```powershell
cd ESP-HIDROWAVE-main\infra\mqtt\bridge\scripts
.\deploy-lightsail.ps1 -PemPath "C:\Users\THANUS\Documents\Projects\LightsailDefaultKey-ca-central-1.pem"
```

El script copia `index.js`, tests, ejecuta `patch-acl-dose-topics.sh` + `patch-acl-metric-topics.sh` y reinicia `hidrowave-bridge`.

### Manual (equivalente)

```bash
# ACL (idempotente)
sudo bash /opt/hidrowave-bridge/../mosquitto/patch-acl-metric-topics.sh
grep ec_metric /var/lib/mosquitto/acl

# Bridge
sudo cp index.js /opt/hidrowave-bridge/index.js
sudo systemctl restart hidrowave-bridge
sudo journalctl -u hidrowave-bridge -n 20 --no-pager
```

**Gate subscribe esperado:**

```
Subscribed ... dose, ph_dose, ec_metric, ph_metric ...
```

---

## 3. Gates regresión (NO saltar)

Ejecutar **después** del deploy, en `/opt/hidrowave-bridge` (con `.env`):

```bash
# R1 — EC eventos intactos
TEST_DEVICE_ID=ESP32_HIDRO_269844 npm run test:pub:ec-dose
# journalctl: INSERT nutrient_dosages

# R2 — pH eventos intactos
TEST_DEVICE_ID=ESP32_HIDRO_269844 npm run test:pub:ph-dose
# journalctl: INSERT ph_dosages

# V3 — EC métricas
TEST_DEVICE_ID=ESP32_HIDRO_269844 npm run test:pub:ec-metric
# journalctl: INSERT ec_controller_metrics

# V4 — pH métricas
TEST_DEVICE_ID=ESP32_HIDRO_269844 npm run test:pub:ph-metric
# journalctl: INSERT ph_controller_metrics
```

Desde frontend repo:

```bash
cd HIDROWAVE-main
npm run verify:nutrient-dosages   # R1
npm run verify:ph-dosages         # R2
npm run verify:controller-metrics # V3/V4 — filas > 0 tras tests
```

Si R1/R2 fallan → rollback `index.js` anterior; ACL métricas no afecta dosing.

---

## 4. Flash ESP (datos reales, post-bridge)

1. Serial boot debe listar `ec_metric=` y `ph_metric=` en línea de topics.
2. Auto EC/pH ON + sensores válidos.
3. Serial: `[MQTT] ec_metric err=... u(t)=...ml`
4. Dashboard → gráfico métricas (sin demo).

---

## 5. Troubleshooting bridge

| Síntoma | Causa | Acción |
|---------|-------|--------|
| Subscribe sí, 0 INSERT métricas | Bridge viejo sin handlers | Redeploy `index.js` actual |
| `Rejected ec_metric` | Payload inválido | Comparar con `MqttClient.cpp` |
| Publish OK, bridge silencioso | ACL sin read | `patch-acl-metric-topics.sh` |
| dose/ph_dose dejan de insertar | Regresión bridge | Rollback; revisar diff solo aditivo |

---

## 6. Archivos

| Archivo | Rol |
|---------|-----|
| [`infra/mqtt/bridge/index.js`](../../../../ESP-HIDROWAVE-main/infra/mqtt/bridge/index.js) | Handlers + INSERT |
| [`infra/mqtt/mosquitto/patch-acl-metric-topics.sh`](../../../../ESP-HIDROWAVE-main/infra/mqtt/mosquitto/patch-acl-metric-topics.sh) | ACL idempotente |
| [`infra/mqtt/bridge/scripts/deploy-lightsail.ps1`](../../../../ESP-HIDROWAVE-main/infra/mqtt/bridge/scripts/deploy-lightsail.ps1) | Deploy one-shot |
| [`infra/mqtt/bridge/scripts/test-publish-ec-metric.js`](../../../../ESP-HIDROWAVE-main/infra/mqtt/bridge/scripts/test-publish-ec-metric.js) | Gate V3 |
| [`infra/mqtt/bridge/scripts/test-publish-ph-metric.js`](../../../../ESP-HIDROWAVE-main/infra/mqtt/bridge/scripts/test-publish-ph-metric.js) | Gate V4 |
