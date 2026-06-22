# Comandos MQTT rápidos — relés slaves ESP-NOW

**Objetivo:** latência &lt;2s na UI ao comandar relés de **slaves** via master ESP-NOW (vs poll HTTPS ~60s).

**Plano operacional:** ver handoff Fase 3 e [`RAILWAY_MQTT_ENV.md`](RAILWAY_MQTT_ENV.md).

---

## Fluxo

```
UI → INSERT relay_commands (target_device_id = MAC slave)
  → notifyDeviceRelayCommand → MQTT hidrowave/MASTER/command (JSON v1)
  → Master ESP subscribe → ESP-NOW → Slave
  → Master HTTPS markCommandSent/completed
```

O **bridge** (`bridge_internal`) **não** participa — só lê telemetria.

---

## Fase A — Infra MQTT

### Railway (frontend HIDROWAVE)

| Variable | Valor |
|----------|-------|
| `MQTT_HOST` | `99.79.36.220` (IP Lightsail, **não** `127.0.0.1`) |
| `MQTT_PORT` | `1883` |
| `MQTT_PUBLISH_USER` | `hidrowave` |
| `MQTT_PUBLISH_PASS` | password ACL |

Redeploy após gravar variáveis.

**Verificar:**

```bash
npm run verify:mqtt-publish-env
# ou em produção:
curl -s https://SUA-APP/api/health/mqtt-env | jq
```

Esperado: `"mqttPublishConfigured": true`.

### ACL Mosquitto (VM)

User `hidrowave` precisa de:

```
topic write hidrowave/+/command
```

Na VM:

```bash
sudo bash /tmp/patch-acl-hidrowave-publish.sh
# ou manual: sudo grep -A3 '^user hidrowave' /var/lib/mosquitto/acl
```

Script no repo: [`ESP-HIDROWAVE-main/infra/mqtt/mosquitto/patch-acl-hidrowave-publish.sh`](../../ESP-HIDROWAVE-main/infra/mqtt/mosquitto/patch-acl-hidrowave-publish.sh).

### Firewall Lightsail

Porta **1883** aberta para Railway e para o teu IP em dev.

---

## Fase B — Firmware master

- `ENABLE_MQTT=1` em `secrets.ini`
- Serial boot: subscribe `hidrowave/ESP32_HIDRO_XXXXXX/command`
- **`masterManager` não nullptr** — se aparecer `masterManager é nullptr`, ordem de init incorreta (ver `HydroSystemCore.cpp` ~976)
- Slaves no mesmo canal ESP-NOW; serial: discovery, peers trusted

---

## Fase C — Supabase / UI

1. Slave em `relay_slaves` com MAC `AA:BB:CC:DD:EE:FF`
2. UI painel ESP-NOW → `POST /api/esp-now/command`:
   - `master_device_id`: ex. `ESP32_HIDRO_269844`
   - `slave_mac_address`: MAC do slave
   - `relay_number`: 0–7
   - `action`: `on` / `off`

SQL `PRODUCTION_RELAY_COMMANDS_TARGET.sql` se `target_device_id` falhar.

---

## Fase D — Verificação E2E

### Logs Railway

```
[MQTT CMD] published id=… → hidrowave/ESP32_HIDRO_269844/command
```

### Serial master

```
[MQTT] rx command topic=hidrowave/ESP32_HIDRO_269844/command
[CMD mqtt] id=… slave R0 on … tgt=AA:BB:…
📡 [ESP-NOW] Comando para slave: AA:BB:…
✅ Slave encontrado: …
```

### Supabase

```sql
SELECT id, relay_number, target_device_id, status, updated_at
FROM relay_commands
WHERE device_id = 'ESP32_HIDRO_269844'
ORDER BY created_at DESC LIMIT 5;
```

Esperado: `pending` → `sent` → `completed` em **&lt;2s**.

### Teste manual na VM (sem UI)

```bash
cd /opt/hidrowave-bridge
MQTT_USER=hidrowave MQTT_PASS='***' \
TEST_SLAVE_MAC=AA:BB:CC:DD:EE:FF \
node scripts/test-publish-slave-command.js
```

---

## Fase E — Diagnóstico

| Sintoma | Causa provável | Ação |
|---------|----------------|------|
| Sem `[MQTT CMD] published` (Railway) | `MQTT_*` ausente | Fase A Railway |
| Publish OK, sem `[MQTT] rx` no ESP | ACL / firewall / WiFi | ACL `hidrowave` write; ESP online |
| RX OK, `masterManager nullptr` | Init order | Reflash + serial boot |
| RX OK, `Slave não encontrado` | MAC errado / slave offline | `relay_slaves`, ESP-NOW discovery |
| Só HTTPS ~60s | MQTT push não configurado | Configurar Railway env |

---

## O que NÃO acelera comandos slave

- Atualizar bridge `index.js` (só telemetria)
- `bridge_internal` `.env` na VM
- Throttle `TELEMETRY_THROTTLE_MS`

---

## Relacionado

- [`ESP-HIDROWAVE-main/docs/mqtt/HANDOFF_FASE3_COMANDOS_HIBRIDOS.md`](../../ESP-HIDROWAVE-main/docs/mqtt/HANDOFF_FASE3_COMANDOS_HIBRIDOS.md)
- [`scripts/BANCADA_MANUAL_COMMANDS_KPI.md`](../scripts/BANCADA_MANUAL_COMMANDS_KPI.md) — KPI master + slave
- [`scripts/verify-slave-espnow-readiness.sql`](../scripts/verify-slave-espnow-readiness.sql)
