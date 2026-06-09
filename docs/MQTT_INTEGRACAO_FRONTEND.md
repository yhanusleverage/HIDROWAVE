# MQTT e o frontend HIDROWAVE

O dashboard **não** usa MQTT. Esta nota existe para alinhar a equipe de frontend com o firmware e o bridge.

## Documentação completa (firmware + infra)

Repositório ESP: `ESP-HIDROWAVE-main/docs/mqtt/README.md`

## O que o frontend continua fazendo

- Leitura/escrita via Supabase (`device_status`, `relay_commands`, `hydro_measurements`, etc.)
- Cálculo de online em `src/app/dispositivos/page.tsx`: `last_seen` dentro de **5 minutos** → online

## O que muda indiretamente com MQTT

| Campo | Como melhora |
|-------|----------------|
| `device_status.last_seen` | Bridge atualiza ao receber `heartbeat` MQTT (mais frequente que só HTTPS 60 s) |
| `is_online` | Pode refletir LWT mais rápido após bridge processar `.../status` |

## Melhorias opcionais (após bridge ativo)

1. Reduzir janela offline de 5 min para **2 min** se heartbeats forem confiáveis a cada 30 s.
2. Supabase Realtime em `device_status` para UI sem polling pesado.
3. **Não** adicionar `mqtt.js` no browser.

## Comandos de relé (fase 3)

Fluxo recomendado: UI → INSERT `relay_commands` (como hoje) → bridge publica em `hidrowave/{device_id}/command` → ESP executa.

Nenhuma mudança obrigatória na API Next.js na fase 1–2.

## Ferramentas de debug

MQTTX / MQTT Explorer — apenas para desenvolvedores, não para usuários finais. Ver `ESP-HIDROWAVE-main/docs/mqtt/08_FERRAMENTAS_MQTTX.md`.
