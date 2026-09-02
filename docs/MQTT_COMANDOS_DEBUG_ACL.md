# Comandos MQTT (relés / cebar) — debug e ACL

**Regra de bancada (2026):** ~**95%** dos problemas de comandos (cebar, relé manual, slave ESP-NOW) são **ACL Mosquitto** ou **credenciais MQTT** — não firmware, não slave offline, não bridge caído.

**Bridge caído** afeta telemetria/ACK em Supabase; **não publica** comandos. Os comandos são publicados pela UI ([`mqtt-command-publish.ts`](../src/lib/mqtt-command-publish.ts)) com user `hidrowave`.

---

## Fluxo E2E

```
UI (Calibragem / Automação)
  → POST /api/esp-now/command
  → INSERT relay_commands (Supabase)
  → MQTT publish hidrowave/{device_id}/command  (user: hidrowave)
  → ESP subscribe (user: mqtt_{device_id})
  → RelayCoordinator → relé local 0–7 (Master) ou ESP-NOW (slave)
  → MQTT command_ack → bridge → relay_commands completed
```

Firmware: `COMMAND_POLL_HTTPS_DISABLED=1` → **sem fallback HTTPS**; o comando tem de chegar por MQTT.

---

## Dois usuários MQTT (não confundir)

| User | Password | Função |
|------|----------|--------|
| `hidrowave` | `.env.local` / Railway → `MQTT_PUBLISH_PASS` | **Publicar** comandos (`write hidrowave/+/command`) |
| `mqtt_ESP32_HIDRO_XXXXXX` | `secrets.ini` → `mqtt_pass` | **ESP** subscribe command + publish telemetria |
| `bridge_internal` | `/opt/hidrowave-bridge/.env` → `MQTT_PASS` | Bridge escuta telemetria (não publica command) |

A password de exemplo `Fox8gqya!` no `.env.example` do bridge **não** é a do user `hidrowave`.

---

## Sintoma → causa (~95% ACL/creds)

| Sintoma | Camada | Causa provável |
|---------|--------|----------------|
| `[MQTT CMD] published` no Next.js, serial **sem** `[MQTT] rx topic` | Broker → ESP | ACL `read` ESP ou **typo em `write hidrowave/+/command`** |
| `not authorised` em `mosquitto_pub -u hidrowave` | Auth | Password errada ou user inexistente em `/var/lib/mosquitto/passwd` |
| `not authorised` em `mosquitto_sub -u bridge_internal` | Auth | Password do `.env` do bridge (não a do hidrowave) |
| POST 200, **sem** `[MQTT CMD] published` | PC | `MQTT_HOST` / `MQTT_PUBLISH_*` ausentes em `.env.local` |
| `[MQTT] rx topic` + `[CMD mqtt]`, bomba parada | Hardware | Relé errado (0–7), fiação, PCF8574 |
| Slave offline | ESP-NOW | **Irrelevante** para cebar / bombas locais do Master |

---

## Caso real — typo ACL (ago 2026)

**Sintoma:** cebar publicava (`id=1350/1351`), ESP com `mqtt=1`, zero `[CMD mqtt]`.

**Causa:** ACL do user `hidrowave`:

```diff
- topic write hidrowa_ve/+/command
+ topic write hidrowave/+/command
```

Um caractere (`v`) bloqueou **todos** os comandos de relé. EC/pH config continuavam (linhas `hidrowave/+/ec/config` corretas).

**Fix:** corrigir ACL + `sudo systemctl restart mosquitto`.

**Checklist typo:** procurar `hidrowa_ve`, `hidrowve`, `hidro_wave` em `/var/lib/mosquitto/acl`.

---

## Checklist debug (ordem fixa)

### 1. PC — web

```bash
npm run verify:mqtt-publish-env
```

Cebar → terminal `npm run dev`:

```
[MQTT CMD] published id=… → hidrowave/ESP32_HIDRO_XXXXXX/command
POST /api/esp-now/command 200
```

Se não há `published` → env vars PC.

### 2. VM — IP

```bash
curl -4 ifconfig.me   # deve = MQTT_HOST (ex. 15.175.109.90)
```

### 3. VM — ACL hidrowave (publish)

```bash
sudo grep -A5 '^user hidrowave' /var/lib/mosquitto/acl
```

Obrigatório:

```
topic write hidrowave/+/command
```

Verificar **typo**: `hidrowave` (não `hidrowa_ve`, etc.).

### 4. VM — ACL ESP (subscribe)

```bash
sudo grep -A5 'ESP32_HIDRO_1A575C' /var/lib/mosquitto/acl
```

Obrigatório:

```
user mqtt_ESP32_HIDRO_1A575C
topic read hidrowave/ESP32_HIDRO_1A575C/command
```

### 5. VM — broker recebe? (sub **antes** de cebar)

```bash
grep MQTT_USER /opt/hidrowave-bridge/.env
grep MQTT_PASS /opt/hidrowave-bridge/.env

mosquitto_sub -h 127.0.0.1 -p 1883 -u bridge_internal -P 'PASS_DO_ENV' \
  -t 'hidrowave/ESP32_HIDRO_1A575C/command' -v
```

Cebar na UI → deve aparecer JSON. Se não → ACL write `hidrowave` ou credencial publish.

### 6. VM — publish manual (password de `.env.local`)

```bash
PASS='MQTT_PUBLISH_PASS_do_env_local'
DEVICE_ID=ESP32_HIDRO_1A575C
ID=$(date +%s)
mosquitto_pub -h 127.0.0.1 -p 1883 -u hidrowave -P "$PASS" \
  -t "hidrowave/${DEVICE_ID}/command" -q 1 \
  -m '{"v":1,"id":'"${ID}"',"cmd":"relay","device_id":"'"${DEVICE_ID}"'","relay_index":0,"action":"on","duration_s":3,"mode":"instant","source":"web","command_type":"manual","priority":10,"triggered_by":"test"}'
```

Sem erro + serial com `[MQTT] rx topic` → OK.

### 7. Serial ESP — sucesso

```
[MQTT] rx topic=hidrowave/ESP32_HIDRO_1A575C/command len=…
[CMD mqtt] supabase_id=… master R? on …
🏠 [MASTER] Processando comando local
🏠 [LOCAL] Comando para relés locais via RelayCoordinator
```

Boot:

```
[MQTT] subscribe command QoS1 hidrowave/ESP32_HIDRO_1A575C/command
```

---

## O que NÃO é o problema (armadilhas)

| Não culpar | Por quê |
|------------|---------|
| Slave ESP-NOW offline | Cebar = relés **locais** Master (0–7) |
| Bridge `journalctl` antigo (outra VM/IP) | Histórico; filtrar `--since today` |
| Auto EC/pH desligado | Cebar exige Auto **off** (correto) |
| `WebServerTask nullptr` | Normal em MASTER; comandos vão por MQTT |
| Poll HTTPS `relay_commands` | Desativado no firmware (`COMMAND_POLL_HTTPS_DISABLED=1`) |

---

## Fix ACL idempotente

```bash
sudo bash ESP-HIDROWAVE-main/infra/mqtt/mosquitto/patch-acl-hidrowave-publish.sh
sudo systemctl restart mosquitto
sudo grep -A4 '^user hidrowave' /var/lib/mosquitto/acl
```

---

## Relacionado

- [RAILWAY_MQTT_ENV.md](RAILWAY_MQTT_ENV.md)
- [MQTT_COMANDOS_RAPIDOS_SLAVES.md](MQTT_COMANDOS_RAPIDOS_SLAVES.md)
- [HANDOFF_RELAY_COMMANDS_MANUAL_14JUN2026.md](HANDOFF_RELAY_COMMANDS_MANUAL_14JUN2026.md)
- ESP: [ACL_MAPA_FUNCIONALIDADES_27AGO2026.md](../../ESP-HIDROWAVE-main/docs/mqtt/ACL_MAPA_FUNCIONALIDADES_27AGO2026.md)
- ESP: [HANDOFF_FASE3_COMANDOS_HIBRIDOS.md](../../ESP-HIDROWAVE-main/docs/mqtt/HANDOFF_FASE3_COMANDOS_HIBRIDOS.md)
