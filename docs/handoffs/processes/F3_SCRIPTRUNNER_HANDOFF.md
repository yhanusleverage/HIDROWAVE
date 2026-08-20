# F3 — ScriptRunner + cycle_week (handoff bancada)

**Data:** jul 2026  
**Firmware:** `ESP-HIDROWAVE-main`  
**Relacionado:** [DECISION_ENGINE_PROCEDURE_STANDARD.md](./DECISION_ENGINE_PROCEDURE_STANDARD.md)

---

## O que foi implementado

| Item | Ficheiro | Estado |
|------|----------|--------|
| `procedure_triggers` no `rule_json` | `compile-procedure.ts` | ✅ |
| Parser `cycle_week` | `ScriptRunner.cpp` | ✅ |
| Filtro semana no `tickAll` | `ScriptRunner.cpp` | ✅ |
| Interlock P1 (priority ≥ 80) | `ScriptRunner.cpp` + `TANK_SCRIPT_*` | ✅ já existia |
| API publicar plano P1+P4 | `/api/grow-cycle/publish` | ✅ |
| Setters `setCurrentGrowWeek(n)` | `ScriptRunner.h` | ✅ |

---

## Sincronizar semana de ciclo (pendente integração cloud)

O master precisa chamar antes do poll de regras:

```cpp
ScriptRunnerManager::instance().setCurrentGrowWeek(weekIndex);
```

**Fonte sugerida (próximo sprint):**

1. Coluna `current_week_index` em `grow_cycle_instances` (já existe)
2. RPC ou poll HTTPS `GET grow_cycle_instances?device_id=…&active=1`
3. Ou campo em `device_status.user_settings` JSON: `{ "grow_week": 3 }`

---

## Checklist bancada

- [ ] Flash firmware com `ScriptRunner.cpp` actualizado
- [ ] Publicar plano 12 semanas via Timeline UI
- [ ] Verificar `decision_rules` com `procedure_triggers` + `script.instructions`
- [ ] `setCurrentGrowWeek(0)` → Initial Fill dispara na janela 08:00–09:00
- [ ] `setCurrentGrowWeek(1)` → Changeout W01 activo; circulação P4 corre em paralelo
- [ ] Durante script P1 (priority 85+): Auto EC/pH em hold (G5)
- [ ] Slave ESP-NOW recebe `relay_action` com `target: slave`

---

## JSON exemplo (decision_rules.rule_json)

```json
{
  "priority": 90,
  "procedure_ref": { "id": "INITIAL_FILL", "layer": "P1" },
  "procedure_triggers": [
    { "type": "time_window", "start": "08:00", "end": "09:00", "timezone": "America/Sao_Paulo" },
    { "type": "cycle_week", "weekIndex": 0 }
  ],
  "script": {
    "instructions": [ ... ],
    "loop_interval_ms": 1000
  }
}
```

---

## Migration SQL obrigatória

Executar no Supabase antes de usar Timeline F1/F2:

`scripts/migrations/20250710_grow_cycle_and_rollups.sql`

Depois activar pg_cron (comentários no final do script).
