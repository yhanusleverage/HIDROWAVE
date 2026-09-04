# Keys propuestas — `automacao.ruleModal` (+ common / instr)

Añadir a [`types.ts`](../../src/lib/translations/app/types.ts) en la **fase de migración 2a** (aún no implementado en runtime).

Prefijo en uso: `t.automacao.*`

```ts
// Pseudotipo (referencia de diseño)

automacao: {
  // ... tabs, procedures, fixedRules, mixInterlock (existentes)

  common: {
    cancel: string;
    save: string;
    saving: string;
    remove: string;
    edit: string;
    delete: string;
    close: string;
    closePanel: string;
    retry: string;
    new: string;
    moveUp: string;
    moveDown: string;
    description: string;
    placeholderDescription: string;
    on: string;          // Ligar (ON)
    off: string;         // Desligar (OFF)
    active: string;      // o reusar t.common.active
    inactive: string;
    online: string;
    offline: string;
    locked: string;
    jsonPreview: string;
    jsonPreviewTitle: string; // con {name}
    jsonPreviewHint: string;
    relayFallback: string;    // Relé {id}
  };

  instr: {
    switchLabel: string;
    switchMode: string;
    modeTimer: string;
    modeCycle: string;
    durationMs: string;
    switchDurationHint: string;
    cycleOn: string;
    cycleOff: string;
    cyclesPerpetual: string;
    returnFromLoop: string;
  };

  ruleModal: {
    title: { create: string; edit: string };
    action: {
      save: string;
      addCondition: string;
      addAction: string;
      addEvent: string;
    };
    flow: {
      title: string;
      step1: string;
      step2: string;
      step3: string;
      step4: string;
      arrowActions: string;
      arrowSimpleActions: string;
      arrowEvents: string;
      arrowConfig: string;
    };
    label: {
      functionName: string;
      when: string;
      then: string;
      targetRuleId: string;
      triggerWhen: string;
      delayMs: string;
      loopInterval: string;
      maxIterations: string;
      priority: string;
      cooldown: string;
      maxPerHour: string;
      enabled: string;
      eventN: string; // Evento {n}
    };
    placeholder: { functionName: string };
    hint: {
      openProcedureBuilder: string;
      openProcedureBuilderLink: string;
      scriptOrder: string;
      preferScript: string;
      chainedEvents: string;
      priority: string;
      cooldown: string;
      maxPerHour: string;
    };
    section: {
      mainCondition: string;
      scriptSteps: string;
      simpleActions: string;
      chainedEvents: string;
      loopConfig: string;
      advanced: string;
    };
    logic: { and: string; or: string };
    trigger: { success: string; failure: string };
    empty: { noAtlasRelays: string };
    error: {
      nameRequired: string;
      needConditionOrInstr: string;
      needActionOrInstr: string;
    };
    toast: {
      savedCreate: string;
      savedUpdate: string;
      noAtlasRelays: string;
    };
  };

  scriptEditor: {
    title: { create: string; edit: string };
    action: { save: string; saving: string };
    section: { instructions: string };
    error: { nameRequired: string; needInstruction: string };
    toast: {
      loadError: string;
      savedCreate: string;
      savedUpdate: string;
      saveError: string;
    };
  };

  ruleCard: {
    toggleEnable: string;
    toggleDisable: string;
    deleteTitle: string;
  };

  page: {
    manual: { title: string; subtitle: string; quickControl: string };
    engine: {
      title: string;
      subtitle: string;
      newRule: string;
      newRuleLocked: string;
      resync: string;
    };
    scripts: {
      header: string; // con {active} {inactive}
      empty: string;
      noActive: string;
      activeCol: string;
      inactiveCol: string;
      moreInstr: string; // ... e mais {n}
      priority: string;  // Prioridade: {n}
    };
    atlas: {
      manageNames: string;
      deviceCount: string;
      refresh: string;
      empty: string;
      emptyHint: string;
      offlineHint: string;
    };
    timer: {
      modeOn: string;
      modeOff: string;
      seconds: string;
      hint: string;
      assign: string;
      disarm: string;
    };
    delete: {
      title: string;
      body: string;
      passwordLabel: string;
      confirm: string;
    };
    toast: {
      // patrones documentados en catálogo; keys concretas en PR 2d
      resyncOk: string;
      resyncFail: string;
      ruleCreated: string;
      ruleDeleted: string;
      relayRenamed: string;
    };
  };

  schedule: {
    title: string;
    subtitle: string;
    createTitle: string;
    selectRule: string;
    typeDaily: string;
    typeWeekly: string;
    typeGrowWeek: string;
    timeStart: string;
    timeEnd: string;
    daysOfWeek: string;
    growWeek: string;
    empty: string;
    emptyHint: string;
    weekLabel: string; // Semana {n}
    lastTriggered: string;
    confirmDelete: string;
    errorCreate: string;
    days: {
      sun: string; mon: string; tue: string; wed: string;
      thu: string; fri: string; sat: string;
    };
  };

  tabs: {
    // existentes + 
    schedules: string;
    schedulesSub: string;
  };
}
```

## Notas de implementación

1. Preferir `t.common.active` existente frente a duplicar en `automacao.common` cuando el significado es idéntico.
2. `instruction-labels.ts` (`SWITCH_LABEL`, modos) → mover valores a `instr.*` y dejar el módulo como thin wrapper o deprecar.
3. Placeholders con interpolación: usar función helper `format(t.xxx, { n: 3 })` o template strings documentados `{n}` / `{name}`.
