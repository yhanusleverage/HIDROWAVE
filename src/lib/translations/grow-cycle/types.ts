/** Chrome UI strings for GrowCycleTimelinePanel (not WeekDetail deep content). */

export interface GrowCycleChromeTranslations {
  phaseLabels: {
    establishment: string;
    vegetative: string;
    flip: string;
    flower: string;
    flush: string;
  };
  /** Short 3-char style ribbon labels (canopy). */
  phaseRibbon: {
    establishment: string;
    vegetative: string;
    flip: string;
    flower: string;
    flush: string;
  };

  /** Toasts / errors */
  selectDeviceEmbedded: string;
  selectDevice: string;
  draftSaved: string;
  selectCoreEmbedded: string;
  selectCore: string;
  startingCycleToast: string;
  /** Base success toast; append cycleStartedWarnings when needed. */
  cycleStarted: string;
  /** Suffix: ` ({n} avisos)` — use {n}. */
  cycleStartedWarnings: string;
  startCycleError: string;
  networkError: string;

  /** Top banner */
  bannerPreviewEmbedded: string;
  bannerPreview: string;
  bannerDemo: string;
  /** Active cycle: use {date} and {week}. */
  bannerActive: string;
  bannerF2: string;
  /** Hover hint: use {n} for weeks with history. */
  bannerHoverHint: string;
  bannerHoverDemoSuffix: string;
  bannerHoverLiveSuffix: string;

  /** Standalone header */
  processosLink: string;
  timelineTitle: string;
  /** Subtitle: use {name}. */
  timelineSubtitle: string;
  openInAutomacao: string;
  badgeActive: string;
  badgeDesigner: string;

  /** Embedded header */
  cicloTitle: string;
  /** Demo subtitle: use {name} and {weeks}. */
  subtitleDemo: string;
  /** Live-empty subtitle: use {name} and {weeks}. */
  subtitleLiveEmpty: string;
  linkAutoEc: string;
  linkAutoPh: string;
  linkRules: string;

  /** Controls */
  durationLabel: string;
  /** Range hint under duration slider: use {weeks}. */
  weeksRangeHint: string;
  weekSimulated: string;
  weekCycle: string;
  phaseCurrent: string;
  /** Device select label — keep product name. */
  deviceSelectLabel: string;
  noneDeviceOption: string;
  advanceSim: string;
  demoOn: string;
  demoToggle: string;
  demoBadge: string;
  saving: string;
  saveDraft: string;
  starting: string;
  startSelectCore: string;
  restartCycle: string;
  startCycle: string;
  startHint: string;
  selectCoreToStart: string;

  /** Schedules editor embutido no Ciclo de Cultivo */
  schedulesSectionTitle: string;
  schedulesSectionSub: string;
  schedulesSelectCore: string;

  /** Chart footer / legend */
  chartPlayheadDemo: string;
  chartPlayheadLive: string;
  chartScrollHint: string;
  chartLiveEmptySchedules: string;
  /** Compact chip for circulation schedules */
  scheduleShortCirculation: string;
  scheduleLaneLabel: string;
  scheduleRecurring: string;
  scheduleOneShot: string;
  scheduleKindCirculation: string;
  scheduleKindMaintenance: string;
  scheduleKindCustom: string;

  hover: {
    /** Semana S{n} */
    weekTitle: string;
    thisWeek: string;
    pastWeek: string;
    futureWeek: string;
    target: string;
    initial: string;
    final: string;
    avgDailyDrop: string;
    nutrientsMl: string;
    adjustments: string;
    phMl: string;
    futureNote: string;
    /** Resumo {weekLabel} · tanque {L} L */
    summaryWithData: string;
    /** Sem dados ainda {weekLabel} · tanque {L} L */
    summaryNoData: string;
    perDay: string;
  };

  weekDetail: {
    invalidWeek: string;
    /** Semana S{n} */
    weekTitle: string;
    ecTarget: string;
    phTarget: string;
    tankVolumePlan: string;
    tankVolumeHint: string;
    applyToDevice: string;
    sending: string;
    phaseLabel: string;
    phaseRecipeHint: string;
    /** Fase da semana S{n} */
    phaseAria: string;
    phaseFlipGroupAria: string;
    autoEcOn: string;
    autoPhOn: string;
    measuredHistory: string;
    ecAvg: string;
    phAvg: string;
    /** Snapshot {date} */
    measuredHint: string;
    eventsP1: string;
    planSchedules: string;
    liveSchedules: string;
    newSchedule: string;
    rule: string;
    selectRule: string;
    timeDaily: string;
    durationMin: string;
    dailyHint: string;
    cancel: string;
    creating: string;
    createSchedule: string;
    selectCoreLive: string;
    loadingSchedules: string;
    /** with {week} */
    emptyLive: string;
    everyDay: string;
    deleteSchedule: string;
    enabled: string;
    disabled: string;
    toastSelectCore: string;
    toastSelectRule: string;
    toastNeedStartTime: string;
    toastNeedDuration: string;
    /** with {min} */
    toastCreateOk: string;
    toastCreateOkNoDur: string;
    /** with {error} */
    toastCreateOkPartial: string;
    toastCreateFail: string;
    toastDeleteConfirm: string;
    toastDeleteOk: string;
    toastDeleteFail: string;
    toastLoadFail: string;
    /** Volume {L} L enviado ao Auto EC */
    toastVolumeSynced: string;
    /** S{week} → {phase} */
    toastPhaseChanged: string;
  };

  simulation: {
    logTitle: string;
    logSubtitle: string;
    logEmpty: string;
    rulesToggle: string;
    rules: {
      P1: { title: string; body: string };
      P2: { title: string; body: string };
      P3: { title: string; body: string };
      P4: { title: string; body: string };
    };
  };
}
