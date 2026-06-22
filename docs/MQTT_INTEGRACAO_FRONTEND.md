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
| `relay_master.ec_operation_*` | Bridge recebe `hidrowave/{id}/ec_operation` → badges Dosando/Recirc en `/automacao` |
| `nutrient_dosages` | Bridge recebe `hidrowave/{id}/dose` → KPI Última dosagem ml |
| `relay_master.ph_operation_*` | Bridge recebe `hidrowave/{id}/ph_operation` → badges Auto pH en `/automacao` |
| `ph_dosages` | Bridge recebe `hidrowave/{id}/ph_dose` → detalle última dosagem pH |

O frontend **não** subscreve MQTT — lê Supabase Realtime como sempre (`useEcOperationState`, `useLastDosage`, `usePhOperationState`, `PhDosageDetail`).

**Estabilidad online:** poll REST 90s + umbral `last_seen` 5 min — ver [`HANDOFF_DEVICE_ONLINE_STABILITY.md`](HANDOFF_DEVICE_ONLINE_STABILITY.md).

## Supabase Realtime (WebSocket) — implementado

- **Arquitetura:** browser → Supabase WSS (não passa pelo Next.js/Railway).
- **Código:** `src/lib/realtime/device-status.ts`, `relay-states.ts`, `sensor-measurements.ts`
- **Activar en Supabase:** ejecutar `scripts/ENABLE_REALTIME_REPLICATION.sql`
- **Coste Railway:** sin cambio. Coste Supabase Realtime: ~$0 en MVP (1 user, 1 device).

| Página / componente | Tabla Realtime |
|---------------------|----------------|
| `/dispositivos` | `device_status` |
| `DeviceControlPanel` | `relay_master`, `relay_slaves` |
| `/dashboard` tarjetas | `hydro_measurements`, `environment_data` (histórico sigue REST) |
| `/automacao` Status EC | `relay_master` (`ec_operation_*`), `nutrient_dosages` |
| `/automacao` Auto pH | `relay_master` (`ph_operation_*`), `ph_dosages` |

## Melhorias opcionais (após bridge ativo)

1. Reduzir janela offline de 5 min para **2 min** se heartbeats forem confiáveis a cada 30 s.
2. **Não** adicionar `mqtt.js` no browser.

## Comandos de relé (fase 3)

Fluxo recomendado: UI → INSERT `relay_commands` (como hoje) → bridge publica em `hidrowave/{device_id}/command` → ESP executa.

Nenhuma mudança obrigatória na API Next.js na fase 1–2.

## Ferramentas de debug

MQTTX / MQTT Explorer — apenas para desenvolvedores, não para usuários finais. Ver `ESP-HIDROWAVE-main/docs/mqtt/08_FERRAMENTAS_MQTTX.md`.
