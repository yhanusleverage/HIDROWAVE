# Bancada: historial Simple vs Full recharge

## Matriz

| Caso | Acción | Esperado en historial |
|------|--------|------------------------|
| Simple OK | Regla 1 relé ON timed | 1 fila OK · Nome · Ligou · hora |
| Simple fail | Atlas offline / ACK fail | Falha · Nome · … |
| Full recharge complete | Dreno→vazio + fill→cheio | 1 fila **Concluiu** (procedure_finished completed); ACKs de relé no son el éxito oficial |
| Full recharge abort | Timeout while / desligar regra a medias | **Falhou** / aborted — nunca “éxito total” |
| Nombres | Tipadas + custom | Nunca solo `RULE_<timestamp>`; tipadas i18n; custom `rule_name` |
| Config | Toggle enabled | Ativou / Desativou con fecha |
| Recirculação | Keepalive ON | Una línea Ligou con hora de **inicio**, sin ×N |

## Cómo validar MQTT (sin ESP)

```bash
cd ESP-HIDROWAVE-main/infra/mqtt/bridge
node scripts/test-publish-procedure-finished.js
```

Esperado: bridge INSERT `procedure_events` + fila en UI tras refresh.

## Serial Master

- Fin normal: `[SCRIPT] procedure_finished rule=… status=completed`
- Abort: `[SCRIPT] procedure_finished rule=… status=aborted reason=…`
- MQTT: `[MQTT] procedure_finished event=… rule=… status=…`

## FSM v2 (tras Fase 1)

Contrato: [PROCEDURE_FSM_V2.md](../engineering/PROCEDURE_FSM_V2.md).

| Caso | Esperado serial |
|------|-----------------|
| Upsert enabled | Armed, sin R dreno/fill |
| Start + alto | enter Drain |
| Complete | `procedure_finished completed` + chain fire recirc si configurado |
| Abort / timeout | `aborted` + OFF |
| Upsert overflow | FSM anterior preservada |
