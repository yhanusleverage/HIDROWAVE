# Handoff — Ruido historial fn_recirc (sin pausar recirculação)

**Fecha:** 2026-09-12  
**Estado:** implementado (UI + firmware mínimo)

## Principio

`fn_recirculacao_continua` es el centro de la operación. **No** se pausa automáticamente durante TankProcedure. Si algo deja de funcionar tras flashear, sospechar primero este cambio de runtime preserve en upsert.

## Cambios

1. **UI** — oculta ACK de `fn_recirculacao_continua` / `fn_circulation` si cae ±12s de un `procedure_events`  
   - `HIDROWAVE-main/src/lib/rule-execution-history.ts` (`isFnCirculationRuleId`, `isNearProcedureFinished`)  
   - `HIDROWAVE-main/src/components/automacao/RuleExecutionHistoryPanel.tsx`

2. **Firmware** — `DecisionEngine::upsertRuleFromJson`: si re-upsert retained de fn_recirc ya `enabled`, preserva `last_execution` / contadores / `currently_active` (evita re-fire + ACK falso)  
   - `ESP-HIDROWAVE-main/src/DecisionEngine.cpp`

## NO hecho

- Hold/OFF circ al Running del tanque  
- Skip de evaluación de fn_recirc durante procedimientos  

## Verificación

- Partial fill → Sucesso + Desativou; sin OK recirculação pegado al fin  
- Circ sigue mezclando  
- UI: reload Next; firmware: flashear Core  
