# Paradigma: Plan · Instancia · Regla · Schedule

## Las 4 cajas

| Caja | Qué guarda | Qué no guarda |
|------|------------|---------------|
| **Plan** | Semanas, fases (Veg→Tra→Flora→Flush), EC/pH objetivo, FILL/CO/DRAIN | ml ni hora de reloj |
| **Instancia** | Ciclo empezó, semana actual | Dosis |
| **Regla** | **Qué** hacer (relé timed **o** `dosage_ml`) | “los lunes a las 8” |
| **Schedule** | **Cuándo** disparar la regla | 20 ml |

## Motor de reglas — Relé

En el editor `RelayActionEditor` (pasos planos, **sin** puzzle Se/LOOP):

1. **Dosificação (ml)** — solo bombas Core con `flowRate` calibrado (nutrientes EC / pH±). El usuario pone ml; se calcula `duration_seconds` para el firmware.
2. **Relé (segundos)** — lista unificada **Core + Atlas**; ON/OFF + duración opcional.

Las **ações simples** del modal usan la **misma lista** Core+Atlas que el script.

FILL/CO/DRAIN tipados y el constructor de procedimiento (`/automacao/procedimento`) siguen generando `while` internamente — la UI padrão ya no edita bloques anidados.

En **Nova Regra**, la sección de pasos usa el **builder** (`sensor_valve` / `set_relay` / `wait` / `hold_chemical`) vía `RuleModalProcedureBuilder` → `compileProcedureToPayload` al guardar.

## Registro de bombas (Calibragem como origen)

Contrato y fases sin romper Auto EC/pH:
`docs/engineering/DOSING_PUMP_REGISTRY_MODEL.md`

- **6 peristálticas** (relés 0–5) en listas de dosificación ml.
- Caudal se lee hoy desde `ec_config_view` / `ph_config_view` vía `dosing-pump-registry`.

## Bacillus (ejemplo)

1. Calibrar bomba (Calibragem → flowRate).
2. Regla script: `+ Relé` → modo Dosificação → 20 ml.
3. Schedule `weekly` → esa regla.

## Archivos clave

- `src/components/rule-procedure/RuleModalProcedureBuilder.tsx`
- `src/components/instruction-editors/RelayActionEditor.tsx`
- `src/lib/dosing-pump-options.ts`
- `src/lib/actuator-relay-options.ts`
- `src/lib/pump-calibration.ts` (`calculateDoseDurationSeconds`)
- `src/lib/rule-procedure/compile-procedure.ts`

## Debug riego vs Auto EC

Template auditable: `docs/debug/debug_irrigate_v1.template.json`  
Guía: `docs/debug/DEBUG_IRRIGATE_VS_AUTOEC.md`
