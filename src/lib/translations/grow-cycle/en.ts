import type { GrowCycleChromeTranslations } from './types';

export const growCycleChromeEn: GrowCycleChromeTranslations = {
  phaseLabels: {
    establishment: 'Establishment',
    vegetative: 'Vegetative',
    flip: 'Transition',
    flower: 'Flowering',
    flush: 'Flush',
  },
  phaseRibbon: {
    establishment: 'Est',
    vegetative: 'Veg',
    flip: 'Trn',
    flower: 'Flo',
    flush: 'Flu',
  },

  selectDeviceEmbedded: 'Select a device in the header',
  selectDevice: 'Select a device',
  draftSaved: 'Plan saved as draft',
  selectCoreEmbedded: 'Select a HydroWave Core in the header',
  selectCore: 'Select a HydroWave Core',
  startingCycleToast: 'Starting cycle… (may take a few seconds)',
  cycleStarted:
    'Cycle started S0 — FILL/CO/DRAIN ok; Circ empty until New schedule',
  cycleStartedWarnings: ' ({n} warnings)',
  startCycleError: 'Failed to start cycle',
  networkError: 'Network error starting cycle',

  bannerPreviewEmbedded:
    'Preview — select the Core in the header; run SQL migration for persistence',
  bannerPreview:
    'Preview — select a device and run SQL migration for persistence',
  bannerDemo:
    'Local demo — full recipe (FILL / CO / Circ). Drag the timeline horizontally.',
  bannerActive:
    'Active cycle since {date} · S{week} · schedules: live chips (daily / weekly) — New schedule in the panel',
  bannerF2:
    'F2 — Start cycle: FILL/CO/DRAIN from recipe; Circ only when you create a schedule',
  bannerHoverHint:
    'Hover = week summary (Δ, ml, adjustments) · {n} weeks with history',
  bannerHoverDemoSuffix: ' · demo mode',
  bannerHoverLiveSuffix: ' · live data',

  processosLink: 'Processes',
  timelineTitle: 'Grow timeline',
  timelineSubtitle: '{name} — ISA-88 Recipe (F1–F2)',
  openInAutomacao: 'Open in Automation → Grow Cycle',
  badgeActive: 'ACTIVE CYCLE',
  badgeDesigner: 'DESIGNER',

  cicloTitle: 'Grow Cycle',
  subtitleDemo: '{name} — recipe S0…S{weeks} · demo',
  subtitleLiveEmpty: '{name} — recipe S0…S{weeks} · live empty',
  linkAutoEc: 'Auto EC',
  linkAutoPh: 'Auto pH',
  linkRules: 'View published rules',

  durationLabel: 'Cycle duration (weeks)',
  weeksRangeHint: 'S0 … S{weeks}',
  weekSimulated: 'Current week (simulated)',
  weekCycle: 'Current week (cycle)',
  phaseCurrent: 'Current phase:',
  deviceSelectLabel: 'HydroWave Core',
  noneDeviceOption: 'None — simulated only',
  advanceSim: 'Advance simulation 1 week',
  demoOn: 'Local demo ON',
  demoToggle: 'Toggle demo (dev)',
  demoBadge: 'Local demo',
  saving: 'Saving…',
  saveDraft: 'Save draft',
  starting: 'Starting…',
  startSelectCore: 'Start cycle (select Core)',
  restartCycle: 'Restart cycle',
  startCycle: 'Start cycle',
  startHint: 'Start = S0 + FILL/CO/DRAIN; no automatic Circ',
  selectCoreToStart:
    'Select a HydroWave Core in the header to start the cycle.',

  schedulesSectionTitle: 'Schedules',
  schedulesSectionSub:
    'Core schedules (daily / weekly / grow week) — embedded in Grow Cycle',
  schedulesSelectCore:
    'Select a HydroWave Core in the header to manage schedules.',

  chartPlayheadDemo: 'Simulated playhead (demo)',
  chartPlayheadLive: 'Playhead / current week',
  chartScrollHint: '← Drag / scroll horizontally to see more weeks →',
  chartLiveEmptySchedules:
    'Live: no schedule chips — use New schedule (every day + duration)',
  scheduleShortCirculation: 'Circ',
  scheduleLaneLabel: 'Sched.',
  scheduleRecurring: 'Recurring in the week',
  scheduleOneShot: 'One-time event',
  scheduleKindCirculation: 'Circulation',
  scheduleKindMaintenance: 'Maintenance',
  scheduleKindCustom: 'Schedule',

  hover: {
    weekTitle: 'Week S{n}',
    thisWeek: 'this week',
    pastWeek: 'this week (past)',
    futureWeek: 'not started yet',
    target: 'Target',
    initial: 'Initial',
    final: 'Final',
    avgDailyDrop: 'Avg daily drop',
    nutrientsMl: 'nutrient ml',
    adjustments: 'Adjustments',
    phMl: 'ml pH+ / pH−',
    futureNote:
      'Future week — target only. Initial / final / avg drop when the week starts.',
    summaryWithData: 'Summary {weekLabel} · tank {L} L',
    summaryNoData: 'No data yet {weekLabel} · tank {L} L',
    perDay: '/day',
  },

  weekDetail: {
    invalidWeek: 'Invalid week.',
    weekTitle: 'Week S{n}',
    ecTarget: 'EC target',
    phTarget: 'pH target',
    tankVolumePlan: 'Tank volume (plan)',
    tankVolumeHint: 'Used in the EC dilution formula (V_tanque)',
    applyToDevice: 'Apply to device',
    sending: 'Sending…',
    phaseLabel: 'Cycle phase',
    phaseRecipeHint:
      'Tap the buttons to switch Veg → Transition → Flowering → Flush. Save the plan to persist.',
    phaseAria: 'Phase for week S{n}',
    phaseFlipGroupAria: 'Select cycle phase',
    autoEcOn: 'Auto EC ON',
    autoPhOn: 'Auto pH ON',
    measuredHistory: 'Measured (history)',
    ecAvg: 'EC avg',
    phAvg: 'pH avg',
    measuredHint: 'Snapshot {date}',
    eventsP1: 'P1 events (tank)',
    planSchedules: 'Plan schedules',
    liveSchedules: 'Live schedules',
    newSchedule: 'New schedule',
    rule: 'Rule',
    selectRule: 'Select rule…',
    timeDaily: 'Time (every day)',
    durationMin: 'Duration (min)',
    dailyHint:
      'Type: daily — chip on every week; duration is written to the rule (timed actions)',
    cancel: 'Cancel',
    creating: 'Creating…',
    createSchedule: 'Create schedule',
    selectCoreLive: 'Select a Core to view and create live schedules.',
    loadingSchedules: 'Loading schedules…',
    emptyLive: 'No live schedule yet (daily or S{week}).',
    everyDay: 'every day',
    deleteSchedule: 'Delete schedule',
    enabled: 'ON',
    disabled: 'OFF',
    toastSelectCore: 'Select a HydroWave Core in the header',
    toastSelectRule: 'Select a rule',
    toastNeedStartTime: 'Enter a start time',
    toastNeedDuration: 'Enter duration (minutes)',
    toastCreateOk: 'Daily schedule created ({min} min on the rule)',
    toastCreateOkNoDur: 'Daily schedule created',
    toastCreateOkPartial:
      'Schedule created, but rule duration failed: {error}',
    toastCreateFail: 'Failed to create schedule',
    toastDeleteConfirm: 'Delete this schedule?',
    toastDeleteOk: 'Schedule removed successfully!',
    toastDeleteFail: 'Failed to remove schedule',
    toastLoadFail: 'Failed to load schedules',
    toastVolumeSynced: 'Volume {L} L sent to Auto EC',
    toastPhaseChanged: 'S{week} → {phase}',
  },

  simulation: {
    logTitle: 'Simulation log',
    logSubtitle: 'Latest fictional events',
    logEmpty:
      'Click "Advance simulation 1 week" to generate entries.',
    rulesToggle: 'Simulation rules (P1–P4)',
    rules: {
      P1: {
        title: 'Tank (priority 85–95)',
        body: 'Initial Fill, Changeout and Drain Full pause chemical dosing (simulated interlock).',
      },
      P2: {
        title: 'Auto EC',
        body: 'Continuous loop; setpoint read from the week EC bar. Does not dose during fill.',
      },
      P3: {
        title: 'Auto pH',
        body: 'Parallel to P2; setpoint from the pH bar. Mutex G5 in production.',
      },
      P4: {
        title: 'TIME / SCHEDULE',
        body: 'Circulation and UC Roots independent of tempo_recirculacao post-dose.',
      },
    },
  },
};
