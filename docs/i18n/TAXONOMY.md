# Taxonomía de textos de interfaz

Cada string de UI se clasifica en **una** categoría semántica. Eso guía keys y revisiones de producto.

| Categoría | Código | Qué es | Ejemplo |
|-----------|--------|--------|---------|
| Navegación | `nav` | Menú, tabs de ruta | Automação, Schedules |
| Página | `page` | Título / subtítulo de pantalla o modal | Nova Regra - Motor de Decisão |
| Sección | `section` | Bloque / card header | Condição Principal |
| Acción | `action` | Botón / CTA / link de acción | Salvar Regra, Remover |
| Label | `label` | Etiqueta de campo | Prioridade (0-100) |
| Hint | `hint` | Ayuda corta bajo un campo | Default 50 |
| Status | `status` | Badge / estado | Ativo, Offline |
| Toast | `toast` | Feedback temporal | Regra criada com sucesso |
| Error | `error` | Validación / fallo | Digite um nome para a regra |
| Empty | `empty` | Estado vacío | Nenhum Atlas encontrado |
| Flow | `flow` | Pasos de flujo procedural | ↓ 2. Ações |

## Dominios de archivo (dónde viven las keys)

```
t.sidebar.*
t.common.*
t.pages.*
t.config.*
t.onboarding.*
t.modules.*
t.automacao.tabs.*
t.automacao.procedures.*      # tipagem / water / builder (ya rico)
t.automacao.fixedRules.*
t.automacao.mixInterlock.*
t.automacao.common.*          # NUEVO (propuesto) — Cancelar, Remover, Ativo…
t.automacao.ruleModal.*       # NUEVO — CreateRuleModal
t.automacao.scriptEditor.*    # NUEVO — SequentialScriptEditor (reusa mucho de ruleModal)
t.automacao.ruleCard.*        # NUEVO
t.automacao.page.*            # NUEVO — AutomacaoPageClient motor/manual
t.automacao.schedule.*        # NUEVO — ScheduleEditor
t.automacao.instr.*           # NUEVO — SWITCH / modos instrucción
```

Dominios futuros (fases posteriores): `calibragem.*`, `dispositivos.*`, `dashboard.*`, paneles EC/pH hardcodeados, etc.
