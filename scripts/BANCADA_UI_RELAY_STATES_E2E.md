# UI / Supabase — paridade relay_states (G2 + E2E Railway)

## 1. SQL (Supabase Editor)

```sql
SELECT device_id, relay_states, last_update
FROM relay_slaves
WHERE device_id = 'ESP32_SLAVE_14_33_5C_38_BF_60';

SELECT id, relay_number, status, target_device_id, created_at, completed_at
FROM relay_commands
WHERE target_device_id = '14:33:5C:38:BF:60'
ORDER BY id DESC
LIMIT 10;
```

## 2. Script local / CI

```bash
cd HIDROWAVE-main
# .env.local com SUPABASE_URL + SERVICE_ROLE ou anon
npm run verify:slave-relay-states
```

Exit 0 = pelo menos 1 relé ON **ou** link stale >5min (aguardando sync).  
Exit 2 = link fresco mas **todos OFF** → UI incorrecta (só link-only).

## 3. UI Realtime

1. Reload página Automacao / DeviceControlPanel
2. DevTools → Network → WebSocket Supabase `relay_slaves`
3. Após master `[SYNC-MQTT] full relay_states`, payload WS deve trazer `relay_states[]` actualizado
4. Toggles slave: spinner → estado confirma em **<2s** (Railway MQTT + ACK directo)

## 4. Railway E2E (1 toggle)

1. `GET /api/health/mqtt-env` → `mqttPublishConfigured: true`
2. Toggle relé slave na UI
3. Logs Railway: `[MQTT CMD] published id=…`
4. Master: `[CMD mqtt]` → `[RELAY-ACK]` → `[CMD ACK-DIRECT]`
5. Bridge: `command_ack` + `PATCH relay_slaves` (com estados)
6. UI reflecte hardware

## 5. Nomes personalizados (`relay_names`)

1. UI: renomear relé slave → **Salvar** → toast sucesso
2. SQL:

```sql
SELECT device_id, relay_names, relay_states, last_update
FROM relay_slaves
WHERE slave_mac_address ILIKE '%14:33:5C:38:BF:60%';
```

3. Toggle ON/OFF do mesmo relé → `relay_names` **não deve mudar** (master não envia nomes no sync)
4. Aguardar ~60s (ALL_RELAYS sync) → verificar SQL outra vez
5. F5 na UI → nome custom visível
6. Script bridge:

```bash
cd ESP-HIDROWAVE-main/infra/mqtt/bridge
SLAVE_MAC=14:33:5C:38:BF:60 node scripts/check-relay-slave-row.js
```

Ver também: [`BANCADA_ESP_NOW_CHANNEL_CHECKLIST.md`](BANCADA_ESP_NOW_CHANNEL_CHECKLIST.md)
