# Decision Engine — Procedimentos (Fase 0 → F3)

**Data:** jul 2026  
**Relacionado:** [S01_GROW_CYCLE_RULES_17JUN2026.md](./S01_GROW_CYCLE_RULES_17JUN2026.md), [GROW_CYCLE_TIMELINE_IMPLEMENTATION.md](./GROW_CYCLE_TIMELINE_IMPLEMENTATION.md)  
**Preview UI:** `/automacao/procedimento` (F1 — guardar Supabase; execución ESP32 requiere firmware + bancada)  
**Handoff consolidado:** [S02_DECISION_ENGINE_F0_F1_HANDOFF.md](./S02_DECISION_ENGINE_F0_F1_HANDOFF.md)

---

## 1. Objetivo

Modelo **procedural secuencial** para regras P1–P4: triggers (quando), steps (o quê, em ordem), linked (depois de sucesso/falha), alinhado a padrões industriais e controles grow comerciais (Aurora/Nuravine).

### Três níveis (ISA-88)

| Nível | HIDROWAVE | Exemplo |
|-------|-----------|---------|
| **Recipe** | Timeline S0–Sn | Plano 12 semanas |
| **Procedure** | `RuleProcedure` | `INITIAL_FILL` |
| **Phase / Step** | `ProcedureStep` | Sensor Valve, Set Relay, Wait |

### Estándares de referência

| Estándar | Aplicação |
|----------|-----------|
| **ISA-88** | Recipe → Procedure → Phase |
| **IEC 61131-3 SFC** | Step + transição por sensor ou timeout |
| **ISA-95** | UI → Supabase → ESP32 (integração leve) |
| **De facto Aurora** | Timer, Sensor Valve, Linked Action |

---

## 2. Modelo canónico `RuleProcedure`

```typescript
interface RuleProcedure {
  id: string;              // ex. INITIAL_FILL
  name: string;
  description?: string;
  priority: number;        // P1: 85–95, P4: 20–40
  layer: 'P1' | 'P2' | 'P3' | 'P4' | 'general';
  enabled: boolean;
  triggers: ProcedureTrigger[];
  steps: ProcedureStep[];
  chain?: ProcedureChainLink[];
  safety?: ProcedureSafety[];
}

type ProcedureTrigger =
  | { type: 'time_window'; start: string; end: string; timezone?: string }
  | { type: 'interval'; everyMs: number }
  | { type: 'cycle_week'; weekIndex: number }
  | { type: 'manual' };

type ProcedureStep =
  | { type: 'sensor_valve'; id: string; actuator: ActuatorRef; sensor: SensorCondition; valveStart: 'open' | 'closed'; valveFinish: 'open' | 'closed'; maxDurationMs: number }
  | { type: 'set_relay'; id: string; actuator: ActuatorRef; state: 'on' | 'off'; durationSeconds?: number }
  | { type: 'wait'; id: string; durationMs: number; label?: string }
  | { type: 'hold_chemical'; id: string; enabled: boolean }
  | { type: 'invoke_rule'; id: string; targetRuleId: string; on: 'success' | 'failure'; delayMs?: number };

interface ActuatorRef {
  target: 'master' | 'slave';
  relayIndex: number;
  slaveMac?: string;
  label?: string;
}
```

Implementação TypeScript: `src/lib/rule-procedure/types.ts`

---

## 3. Master vs Slave (actuadores)

| Origem | Campo | Protocolo |
|--------|-------|-----------|
| Relé na placa **master** | `target: 'master'`, `relayIndex: 0–7` | GPIO local |
| Relé em **slave ESP-NOW** | `target: 'slave'`, `slaveMac`, `relayIndex` | ESP-NOW |
| Sensores (nível, pH, EC) | Sempre lidos pelo **master** | I2C/ADC |

O Rule Builder F0 exige seleção explícita master **ou** slave por passo — ver fix em `RelayActionEditor`.

---

## 4. Compilação → `decision_rules.rule_json`

F0 gera JSON compatível com S01 §4 (scripts WHILE + relay_action) via `compileProcedureToRuleJson()`:

- `sensor_valve` → `while` + condição sensor + `relay_action`
- `set_relay` → `relay_action`
- `wait` → `delay` (quando suportado) ou comentário em script
- `invoke_rule` → `chained_events[]`

**Gap firmware:** ESP32 DecisionEngine atual **não executa** scripts completos — ver F3.

---

## 5. Roadmap

| Fase | Entrega | Estado jul/2026 |
|------|---------|-----------------|
| **F0** | Doc + timeline mock + Rule Builder preview + export JSON | ✅ |
| **F1** | Guardar `RuleProcedure` en `decision_rules` | ✅ UI + `save-procedure.ts` |
| **F2** | Publicar timeline → reglas P1 compiladas | ⚠️ `publish-from-timeline.ts` sin UI |
| **F3** | `ScriptRunner` firmware + sync LittleFS | ⚠️ código en repo; bancada pendiente |

---

## 6. Plantilla Initial Fill (demo F0)

| Step | Tipo | Descrição |
|------|------|-----------|
| Trigger | `time_window` | 08:00–09:00 |
| 1 | `sensor_valve` | Nivel > 20%, válvula fill, max 10 min |
| 2 | `set_relay` | Bomba circulação ON (slave) |
| 3 | `wait` | Mix delay 5 min |

Template: `src/lib/rule-procedure/templates/initial-fill-demo.ts`

---

## 7. Arquivos (F0–F1)

| Path | Descrição |
|------|-----------|
| `src/lib/rule-procedure/types.ts` | Tipos canónicos |
| `src/lib/rule-procedure/validate-procedure.ts` | Validação pura |
| `src/lib/rule-procedure/compile-procedure.ts` | → rule_json |
| `src/lib/rule-procedure/save-procedure.ts` | Guardar Supabase |
| `src/lib/rule-procedure/publish-from-timeline.ts` | Timeline → procedures |
| `src/lib/rule-procedure/templates/initial-fill-demo.ts` | Demo Aurora |
| `src/components/rule-procedure/*` | UI editors + preview |
| `src/app/automacao/procedimento/*` | Rule Builder F1 |
| `ESP-HIDROWAVE-main/src/ScriptRunner.cpp` | Runtime firmware (F3) |

---

## 8. Checklist bancada (pós-F3)

- [ ] Initial Fill dispara na janela 08:00–09:00
- [ ] Sensor Valve para em nível ou timeout
- [ ] hold P1 pausa Auto EC/pH durante script
- [ ] Slave ESP-NOW recebe relay ON via master
- [ ] Export F0 JSON == JSON executado após sync
