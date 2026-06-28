# Bancada — alinhamento canal ESP-NOW (G1)

**Data:** 27 jun 2026  
**Master:** `ESP32_HIDRO_1A575C` · **Slave:** `14:33:5C:38:BF:60`

## Pré-flash

- [ ] Flash master (`ESP-HIDROWAVE-main`) com `forceSlaveRelayMqttFullSync` + retry snapshot
- [ ] Flash slave (`ESPNOW-SLAVE-TASK-main`) com WDT MCD + `persistKnownMasterChannel`

## Boot slave (serial)

- [ ] `Canal carregado do cache: 11` (após 1º sync bem-sucedido; se ainda `1`, fazer 1 toggle com master online)
- [ ] `🔒 Boot: cache confiável canal 11` OU após discovery `🔒 Canal master bloqueado`
- [ ] **Sem** varredura `Fase 2: Varredura completa` durante 5 min
- [ ] **Sem** `task_wdt: loopTask` no slave

## Boot master (serial)

- [ ] WiFi STA conectado — anotar canal RF (esperado **11**)
- [ ] `Peer forçado ao canal Master 11` — **sem** alternância `3 → 11` repetida
- [ ] `[SLAVE-LINK] online=1`

## Teste 5 min (canal estável)

| Min | Master | Slave |
|-----|--------|-------|
| 0 | Anotar `esp_wifi_get_channel` | Anotar canal RF |
| 2 | — | Sem `Sem resposta` em scan |
| 5 | 0× `CONFLITO DE CANAL` | 0× reboot |

**Pass:** master e slave no **mesmo canal** durante 5 min, 0 WDT slave.

## Comando manual slave (opcional)

Após master online, no serial slave:

```
mcd_cache_show
```

Esperado: `channel: 11`, `success_rate` ≥ 50.
