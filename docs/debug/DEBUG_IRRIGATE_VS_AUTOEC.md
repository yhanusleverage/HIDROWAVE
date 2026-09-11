# Debug rápido: regar vs Auto EC

Schema: **`debug_irrigate_v1`**  
Template: [`debug_irrigate_v1.template.json`](./debug_irrigate_v1.template.json)

## Cómo usarlo

1. Copia el template.
2. Rellena lo que puedas (mínimo: `device_id` + `fn_rules[].rule_json` **o** el JSON de Auto EC).
3. Pégalo en el chat → auditoría cruzada en minutos.

### De dónde sacar cada bloque

| Bloque | UI / origen |
|--------|-------------|
| `hydraulic_roles` | Automação → tipagem hidráulica (FILL/CO/DRAIN) |
| `fn_rules` | Automação → Vista previa JSON de `fn_*` |
| `irrigation_schedules` | Schedules ligados a esas reglas |
| `plan_snapshot` | Grow cycle (semana / próximo FILL\|CO\|DRAIN) |
| `auto_ec` | Auto EC → Debug Vista Previa (`getECConfigJson` + `_debug`) |

## Checklist de auditoría

1. **Tipagem ↔ fn_\*** — mismo `slave_mac` + `relay_index` que en `rule_json`.
2. **Schedule ↔ regla** — el `rule_id` del schedule existe y `enabled` cuadra.
3. **CO tipada ≠ Auto EC** — `fn_recirculacao_continua` no es `tempo_recirculacao` (eso es post-dosis química).
4. **Dilución Auto EC ≠ FILL/DRAIN tipados** — `dilution_fill_relay` / `dilution_drain_relay` son otra vía.
5. **Plan** — próximo `tank_event` apunta a la regla esperada (`INITIAL_FILL` / changeout / drain).
6. **Interlock** — con FILL/DRAIN en curso, Auto EC no debería dosificar (block_auto / nivel).

## Ejemplo mínimo para pegar

Si solo tienes la regla de riego y el preview Auto EC:

```json
{
  "schema": "debug_irrigate_v1",
  "device_id": "…",
  "fn_rules": [{ "rule_id": "fn_enchimento_ate_alto", "enabled": true, "rule_json": { } }],
  "auto_ec": {
    "auto_enabled": true,
    "ec_setpoint": 1400,
    "tempo_recirculacao": 60,
    "dilution": { "dilution_auto_enabled": false }
  },
  "_audit": { "expected": "Encher até alto sem Auto EC dosear no meio" }
}
```

## Relación con el paradigma

Ver `docs/i18n/RULES_DOSE_ML_PARADIGM.md` — Plan · Instancia · Regla · Schedule.  
Este debug junta **Regla + Schedule + Auto EC** en un solo JSON para cruzar conflictos.
