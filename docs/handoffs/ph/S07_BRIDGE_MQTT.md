# S07 — Bridge MQTT Lightsail (pH)

**Prerequisito:** [S06](S06_CALIBRATION_UI.md) calibragem OK  
**Duración estimada:** 20–30 min  
**Siguiente:** [S08_BANCADA_KPI.md](S08_BANCADA_KPI.md)

---

## Ejecutar

### Acceso SSH

**Opción A:** Lightsail → **Connect using SSH** (navegador).

**Opción B:** PowerShell con clave `.pem`:

```powershell
ssh -i "C:\Users\THANUS\Documents\Projects\LightsailDefaultKey-ca-central-1.pem" ubuntu@99.79.36.220
```

O script automatizado: [`deploy-lightsail.ps1`](../../../../ESP-HIDROWAVE-main/infra/mqtt/bridge/scripts/deploy-lightsail.ps1)

### 1. Actualizar bridge

Desde PC:

```powershell
.\ESP-HIDROWAVE-main\infra\mqtt\bridge\scripts\deploy-lightsail.ps1
```

Manual (equivalente):

```powershell
scp -i "C:\Users\THANUS\Documents\Projects\LightsailDefaultKey-ca-central-1.pem" `
  "ESP-HIDROWAVE-main\infra\mqtt\bridge\index.js" `
  ubuntu@99.79.36.220:/tmp/hidrowave-index.js

scp -i "C:\Users\THANUS\Documents\Projects\LightsailDefaultKey-ca-central-1.pem" `
  "ESP-HIDROWAVE-main\infra\mqtt\bridge\scripts\test-publish-ph-dose.js" `
  ubuntu@99.79.36.220:/tmp/test-publish-ph-dose.js
```

En servidor:

```bash
sudo cp /tmp/hidrowave-index.js /opt/hidrowave-bridge/index.js
sudo mkdir -p /opt/hidrowave-bridge/scripts
sudo cp /tmp/test-publish-ph-dose.js /opt/hidrowave-bridge/scripts/
sudo systemctl restart hidrowave-bridge
sudo journalctl -u hidrowave-bridge -n 30 --no-pager
```

**Gate subscribe (bridge actualizado):**

```
Subscribed ... ph_operation, hidrowave/+/ph_dose | ... ph_operation 2000ms ...
```

**Bridge desactualizado (síntoma Auto pH roto):** log solo muestra `ec_operation` y `dose` — sin `ph_operation` ni `ph_dose`.

**relay_master vacío (0 filas en SQL):** el bridge PATCH no actualiza nada. Ejecutar [`scripts/SEED_RELAY_MASTER_FROM_DEVICE_STATUS.sql`](../../../scripts/SEED_RELAY_MASTER_FROM_DEVICE_STATUS.sql). Tras deploy reciente, el bridge también intenta seed automático desde `device_status`.

### 2. ACL Mosquitto

```bash
sudo nano /var/lib/mosquitto/acl
```

Bajo `user bridge_internal`:

```text
topic read hidrowave/+/ph_operation
topic read hidrowave/+/ph_dose
```

```bash
sudo systemctl restart mosquitto
sudo systemctl restart hidrowave-bridge
```

Referencia: [`ESP-HIDROWAVE-main/infra/mqtt/mosquitto/acl.example`](../../../../ESP-HIDROWAVE-main/infra/mqtt/mosquitto/acl.example)

### 3. Test sin ESP

```bash
cd /opt/hidrowave-bridge
sudo chmod 755 /opt/hidrowave-bridge/scripts
sudo -u hidrowave TEST_DEVICE_ID=ESP32_HIDRO_269844 npm run test:pub:ph-dose
```

Si `MODULE_NOT_FOUND` en scripts: el directorio `scripts/` puede estar `700` — aplicar `chmod 755` arriba.

---

## Verificar (gate)

```sql
SELECT ph_operation_state, ph_operation_remaining_sec
FROM relay_master WHERE device_id = 'ESP32_HIDRO_269844';

SELECT * FROM ph_dosages
WHERE device_id = 'ESP32_HIDRO_269844'
ORDER BY created_at DESC LIMIT 3;
```

Esperado: fila test en `ph_dosages` + `ph_operation_*` actualizado.

Tras test manual: [`scripts/reset-ph-operation.sql`](../../../scripts/reset-ph-operation.sql)

Runbook legacy: [`ESP-HIDROWAVE-main/scripts/DEPLOY_BRIDGE_PH_LIGHTSAIL.md`](../../../../ESP-HIDROWAVE-main/scripts/DEPLOY_BRIDGE_PH_LIGHTSAIL.md)

---

## Si falla

| Síntoma | Acción |
|---------|--------|
| Permission denied SSH | Usar consola web o `.pem` correcto |
| Bridge no INSERT | ACL faltante; journalctl bridge |
| Test OK pero ESP no | Firmware sin MQTT o credenciales |

---

## Siguiente

[S08 — Bancada KPI](S08_BANCADA_KPI.md)
