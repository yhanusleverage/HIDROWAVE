# Handoff — Schedule = Ativar real (parity)

**Fecha:** 2026-09-12  
**Estado:** código en repo; **requiere deploy bridge** a Lightsail

## Contrato

| Tipo | Disparo |
|------|---------|
| Procedure | DB `enabled=true` + MQTT upsert retained + 400ms + `procedure/cmd start` |
| Simple | `relay_commands` + MQTT `command` (igual que antes) |
| `fn_recirculacao*` | **Nunca** (tipagem/Motor) |

Reloj: Bridge Lightsail + `timezone` de la fila. No Railway.

## Archivos

- `ESP-HIDROWAVE-main/infra/mqtt/bridge/schedule-evaluator.js`
- `ESP-HIDROWAVE-main/infra/mqtt/bridge/schedule-mqtt-publish.js` (nuevo)
- UI/API: `ScheduleEditor`, `WeekDetailPanel`, `schedules/route.ts`, `sync-grow-schedules.ts`

## Deploy (sin tumbar de más)

Subir **ambos** `.js` a `/opt/hidrowave-bridge/` y:

```bash
sudo systemctl restart hidrowave-bridge
systemctl is-active hidrowave-bridge
journalctl -u hidrowave-bridge -n 50 --no-pager
```

Si el servicio no arranca: revertir solo `schedule-evaluator.js` al backup anterior; el resto del bridge (telemetry) no depende del nuevo módulo hasta el `import`.

## Verificación

1. Schedule procedure 1–2 min → serial `procedure/cmd start` → Sucesso  
2. Simple relay → ON  
3. Intentar fn en UI → 400  
4. Circ no se pausa  
