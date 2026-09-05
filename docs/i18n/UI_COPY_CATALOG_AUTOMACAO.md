# Catálogo UI — Automação

**Fecha:** 2026-09-04  
**Fuente:** inventarios de `CreateRuleModal`, `SequentialScriptEditor`, `RuleCard`, `AutomacaoPageClient`, `components/automacao/*`

## Resumen

| Área | Estado i18n | Notas |
|------|-------------|--------|
| Header / tabs procedures·ec·ph·rules·timeline | OK | `t.pages.*`, `t.automacao.tabs.*` |
| Tipagem / Atlas names / Procedure builder | OK | `t.automacao.procedures.*` |
| Tab Schedules | GAP | Hardcoded EN/PT |
| CreateRuleModal | OK (2a) | `t.automacao.ruleModal` / `common` / `instr` |
| SequentialScriptEditor | OK (2b) | `scriptEditor` + reusa `ruleModal`/`instr` |
| RuleCard | OK (2c) | `t.automacao.ruleCard` |
| AutomacaoPageClient (motor, Atlas, toasts) | OK parcial (2d) | Headers/toasts/listas; timer panel profundo pendiente |
| HydraulicRelaySetupPanel | Casi OK | 1 string hardcodeado conflicto de relé |
| ScheduleEditor | GAP | |

---

## Ya en i18n (no reabrir)

- `t.automacao.tabs.*`
- `t.automacao.procedures.*` (tipagem, water, builder, fixedFunctionKind, sequentialScriptKind)
- `t.automacao.fixedRules.*`
- `t.automacao.mixInterlock.*`
- `t.pages.automacao*`
- `t.common.active|inactive|online|offline|loading*|noActiveRule`

---

## CreateRuleModal — strings a migrar

Categorías: ver [TAXONOMY.md](./TAXONOMY.md). Keys detalladas: [PROPOSED_KEYS_RULE_MODAL.md](./PROPOSED_KEYS_RULE_MODAL.md).

| Cat | Texto (pt-BR) | Key propuesta |
|-----|---------------|---------------|
| page | Nova Regra - Motor de Decisão | `ruleModal.title.create` |
| page | Editar Regra - Motor de Decisão | `ruleModal.title.edit` |
| action | Salvar Regra | `ruleModal.action.save` |
| action | Cancelar | `common.cancel` (o `t.config.cancel`) |
| flow | Fluxo Procedural (de cima para baixo): | `ruleModal.flow.title` |
| flow | 1. Condições / 2. Ações / 3. Eventos / 4. Config | `ruleModal.flow.step1..4` |
| label | Nome da Função * | `ruleModal.label.functionName` |
| hint | Ex: Dreno Automático | `ruleModal.placeholder.functionName` |
| label | Descrição | `common.description` |
| hint | Descrição opcional | `common.placeholderDescription` |
| hint | Prefere passos guiados… Rule Builder | `ruleModal.hint.openProcedureBuilder` |
| section | Condição Principal | `ruleModal.section.mainCondition` |
| label | Quando: | `ruleModal.label.when` |
| action | + Adicionar Condição | `ruleModal.action.addCondition` |
| label | E (AND) / OU (OR) | `ruleModal.logic.and` / `.or` |
| action | Remover | `common.remove` |
| section | Passos do script | `ruleModal.section.scriptSteps` |
| hint | Ordem de execução no ESP32… | `ruleModal.hint.scriptOrder` |
| action | Mover para cima / baixo | `common.moveUp` / `moveDown` |
| section | Ações simples (opcional) | `ruleModal.section.simpleActions` |
| hint | Use apenas se a regra não tiver passos… | `ruleModal.hint.preferScript` |
| label | Então: | `ruleModal.label.then` |
| action | + Adicionar Ação | `ruleModal.action.addAction` |
| empty | Nenhum relé Atlas disponível | `ruleModal.empty.noAtlasRelays` |
| label | Ligar (ON) / Desligar (OFF) | `common.on` / `common.off` |
| section | Eventos Encadeados | `ruleModal.section.chainedEvents` |
| hint | Quando esta regra executar… | `ruleModal.hint.chainedEvents` |
| label | ID da Regra Alvo / Disparar Quando / Espera (ms) | `ruleModal.label.*` |
| label | Ao Ter Sucesso / Ao Ter Falha | `ruleModal.trigger.success` / `.failure` |
| action | Adicionar Evento | `ruleModal.action.addEvent` |
| section | Configurações do Loop | `ruleModal.section.loopConfig` |
| label | Intervalo… / Máximo de iterações… | `ruleModal.label.loopInterval` / `maxIterations` |
| section | Configurações Avançadas | `ruleModal.section.advanced` |
| label | Prioridade / Cooldown / Limite por Hora / Regra Ativa | `ruleModal.label.*` |
| hint | Default 50 / Tempo mínimo… / Máximo por hora | `ruleModal.hint.*` |
| error | Digite um nome… / Adicione condição… / ação… | `ruleModal.error.*` |
| toast | Regra criada/atualizada / Nenhum relé Atlas… | `ruleModal.toast.*` |
| flow | ↓ 2. Ações / ↓ 3. Eventos / ↓ 4. Config | `ruleModal.flow.arrowActions` etc. |

Instrucciones SWITCH (compartidas con SequentialScriptEditor): ver `instr.*` en PROPOSED_KEYS.

---

## SequentialScriptEditor / RuleCard

Reutilizar `ruleModal.*` + `common.*` donde el texto sea idéntico.

Extras propios:

| Cat | Texto | Key |
|-----|-------|-----|
| page | Nova Função / Editar Função | `scriptEditor.title.create` / `.edit` |
| action | Salvar Função / Salvando... | `scriptEditor.action.save` / `.saving` |
| section | INSTRUÇÕES (Ordem de Execução) | `scriptEditor.section.instructions` |
| toast | Função criada/atualizada / Erro ao salvar | `scriptEditor.toast.*` |
| action | Vista Previa JSON / Editar / Excluir | `common.jsonPreview` / `.edit` / `.delete` |
| status | Ativo / Inativo | `common.active` / `.inactive` (ya en `t.common`) |

---

## AutomacaoPageClient — gaps principales

| Cat | Patrón | Key propuesta |
|-----|--------|---------------|
| section | Acionamento manual rápido / Motor de Decisão | `page.manual.title` / `page.engine.title` |
| action | Nova Regra / Resync regras → Core | `page.engine.newRule` / `.resync` |
| section | Regras de Script Sequencial / Ativas / Inativas | `page.scripts.*` |
| empty | Nenhum script… / Nenhuma regra ativa | `page.scripts.empty*` |
| toast | Regra criada/excluída / resync / timer / relé | `page.toast.*` |
| flow | Confirmar Exclusão + senha admin | `page.delete.*` |
| status | Atlas offline / Bloqueado / Ciclo ON/OFF | `page.atlas.*` / `page.relay.*` |

---

## ScheduleEditor + tab

| Cat | Texto | Key |
|-----|-------|-----|
| nav | Schedules / Cronogramas | `tabs.schedules` / `schedulesSub` |
| section | Cronogramas / Criar Schedule | `schedule.title` / `.createTitle` |
| label | Diario / Semanal / Semana Cultivo / días | `schedule.type*` / `days.*` |
| empty | Nenhum schedule… | `schedule.empty` |
| error | Error creating schedule | `schedule.error.create` |

---

## Fuera de este catálogo (fases 3+)

`AutoEcControllerPanel`, `PhControllerPanel`, `EcDilutionSection`, calibragem, dispositivos, dashboard — inventario aparte.
