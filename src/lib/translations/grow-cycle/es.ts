import type { GrowCycleChromeTranslations } from './types';

export const growCycleChromeEs: GrowCycleChromeTranslations = {
  phaseLabels: {
    establishment: 'Establecimiento',
    vegetative: 'Vegetativo',
    flip: 'Transición',
    flower: 'Floración',
    flush: 'Flush',
  },
  phaseRibbon: {
    establishment: 'Est',
    vegetative: 'Veg',
    flip: 'Tra',
    flower: 'Flo',
    flush: 'Flu',
  },

  selectDeviceEmbedded: 'Seleccione un dispositivo en el encabezado',
  selectDevice: 'Seleccione un dispositivo',
  draftSaved: 'Plan guardado como borrador',
  selectCoreEmbedded: 'Seleccione un HydroWave Core en el encabezado',
  selectCore: 'Seleccione un HydroWave Core',
  startingCycleToast: 'Iniciando ciclo… (puede tardar unos segundos)',
  cycleStarted:
    'Ciclo iniciado S0 — FILL/CO/DRAIN ok; Circ vacío hasta Nuevo schedule',
  cycleStartedWarnings: ' ({n} avisos)',
  startCycleError: 'Error al iniciar el ciclo',
  networkError: 'Error de red al iniciar el ciclo',

  bannerPreviewEmbedded:
    'Preview — seleccione el Core en el encabezado; ejecute la migración SQL para persistencia',
  bannerPreview:
    'Preview — seleccione un dispositivo y ejecute la migración SQL para persistencia',
  bannerDemo:
    'Demo local — receta completa (FILL / CO / Circ). Arrastre la timeline en horizontal.',
  bannerActive:
    'Ciclo activo desde {date} · S{week} · schedules: pastillas live (diario / semanal) — Nuevo schedule en el panel',
  bannerF2:
    'F2 — Iniciar ciclo: FILL/CO/DRAIN de la receta; Circ solo al crear un schedule',
  bannerHoverHint:
    'Hover = resumen de la semana (Δ, ml, ajustes) · {n} semanas con historial',
  bannerHoverDemoSuffix: ' · modo demo',
  bannerHoverLiveSuffix: ' · datos live',

  processosLink: 'Procesos',
  timelineTitle: 'Timeline de cultivo',
  timelineSubtitle: '{name} — ISA-88 Recipe (F1–F2)',
  openInAutomacao: 'Abrir en Automación → Ciclo de Cultivo',
  badgeActive: 'CICLO ACTIVO',
  badgeDesigner: 'DESIGNER',

  cicloTitle: 'Ciclo de Cultivo',
  subtitleDemo: '{name} — receta S0…S{weeks} · demo',
  subtitleLiveEmpty: '{name} — receta S0…S{weeks} · live vacío',
  linkAutoEc: 'Auto EC',
  linkAutoPh: 'Auto pH',
  linkRules: 'Ver reglas publicadas',

  durationLabel: 'Duración del ciclo (semanas)',
  weeksRangeHint: 'S0 … S{weeks}',
  weekSimulated: 'Semana actual (simulada)',
  weekCycle: 'Semana actual (ciclo)',
  phaseCurrent: 'Fase actual:',
  deviceSelectLabel: 'HydroWave Core',
  noneDeviceOption: 'Ninguno — solo simulado',
  advanceSim: 'Avanzar simulación 1 semana',
  demoOn: 'Demo local ON',
  demoToggle: 'Alternar demo (dev)',
  demoBadge: 'Demo local',
  saving: 'Guardando…',
  saveDraft: 'Guardar borrador',
  starting: 'Iniciando…',
  startSelectCore: 'Iniciar ciclo (seleccione Core)',
  restartCycle: 'Reiniciar ciclo',
  startCycle: 'Iniciar ciclo',
  startHint: 'Iniciar = S0 + FILL/CO/DRAIN; sin Circ automático',
  selectCoreToStart:
    'Seleccione un HydroWave Core en el encabezado para iniciar el ciclo.',

  schedulesSectionTitle: 'Schedules',
  schedulesSectionSub:
    'Cronogramas del Core (diario / semanal / semana del ciclo) — dentro de Ciclo de Cultivo',
  schedulesSelectCore:
    'Seleccione un HydroWave Core en el encabezado para gestionar schedules.',

  chartPlayheadDemo: 'Playhead simulado (demo)',
  chartPlayheadLive: 'Playhead / semana actual',
  chartScrollHint: '← Arrastre / desplace en horizontal para ver más semanas →',
  chartLiveEmptySchedules:
    'Live: sin pastillas de schedule — use Nuevo schedule (todos los días + duración)',
  scheduleShortCirculation: 'Circ',
  scheduleLaneLabel: 'Agenda',
  scheduleRecurring: 'Recurrente en la semana',
  scheduleOneShot: 'Evento puntual',
  scheduleKindCirculation: 'Circulación',
  scheduleKindMaintenance: 'Mantenimiento',
  scheduleKindCustom: 'Agendamiento',

  hover: {
    weekTitle: 'Semana S{n}',
    thisWeek: 'esta semana',
    pastWeek: 'en esta semana',
    futureWeek: 'aún no empezó',
    target: 'Objetivo',
    initial: 'Inicial',
    final: 'Final',
    avgDailyDrop: 'Caída media/día',
    nutrientsMl: 'ml nutrientes',
    adjustments: 'Ajustes',
    phMl: 'ml pH+ / pH−',
    futureNote:
      'Semana futura — solo objetivo. Inicial / final / caída media cuando empiece la semana.',
    summaryWithData: 'Resumen {weekLabel} · tanque {L} L',
    summaryNoData: 'Sin datos aún {weekLabel} · tanque {L} L',
    perDay: '/día',
  },

  weekDetail: {
    invalidWeek: 'Semana inválida.',
    weekTitle: 'Semana S{n}',
    ecTarget: 'EC objetivo',
    phTarget: 'pH objetivo',
    tankVolumePlan: 'Volumen tanque (plan)',
    tankVolumeHint: 'Usado en la fórmula de dilución EC (V_tanque)',
    applyToDevice: 'Aplicar al device',
    sending: 'Enviando…',
    phaseLabel: 'Fase del ciclo',
    phaseRecipeHint:
      'Toque los botones para cambiar Veg → Transición → Floración → Flush. Guarde el plan para persistir.',
    phaseAria: 'Fase de la semana S{n}',
    phaseFlipGroupAria: 'Seleccionar fase del ciclo',
    autoEcOn: 'Auto EC ON',
    autoPhOn: 'Auto pH ON',
    measuredHistory: 'Medido (histórico)',
    ecAvg: 'EC avg',
    phAvg: 'pH avg',
    measuredHint: 'Snapshot {date}',
    eventsP1: 'Eventos P1 (tanque)',
    planSchedules: 'Agendamientos del plan',
    liveSchedules: 'Schedules live',
    newSchedule: 'Nuevo schedule',
    rule: 'Regla',
    selectRule: 'Seleccionar regla…',
    timeDaily: 'Hora (cada día)',
    durationMin: 'Duración (min)',
    dailyHint:
      'Tipo: daily — pastilla en todas las semanas; la duración se guarda en la regla (acciones timed)',
    cancel: 'Cancelar',
    creating: 'Creando…',
    createSchedule: 'Crear schedule',
    selectCoreLive: 'Seleccione un Core para ver y crear schedules live.',
    loadingSchedules: 'Cargando schedules…',
    emptyLive: 'Ningún schedule live aún (daily o S{week}).',
    everyDay: 'cada día',
    deleteSchedule: 'Eliminar schedule',
    enabled: 'ON',
    disabled: 'OFF',
    toastSelectCore: 'Seleccione un HydroWave Core en el encabezado',
    toastSelectRule: 'Seleccione una regla',
    toastNeedStartTime: 'Indique la hora de inicio',
    toastNeedDuration: 'Indique la duración (minutos)',
    toastCreateOk: 'Schedule diario creado ({min} min en la regla)',
    toastCreateOkNoDur: 'Schedule diario creado',
    toastCreateOkPartial:
      'Schedule creado, pero falló la duración en la regla: {error}',
    toastCreateFail: 'Error al crear schedule',
    toastDeleteConfirm: '¿Eliminar este schedule?',
    toastDeleteOk: '¡Schedule eliminado con éxito!',
    toastDeleteFail: 'Error al eliminar schedule',
    toastLoadFail: 'Error al cargar schedules',
    toastVolumeSynced: 'Volumen {L} L enviado a Auto EC',
    toastPhaseChanged: 'S{week} → {phase}',
  },

  simulation: {
    logTitle: 'Log de simulación',
    logSubtitle: 'Últimos eventos ficticios',
    logEmpty:
      'Haga clic en "Avanzar simulación 1 semana" para generar entradas.',
    rulesToggle: 'Reglas de simulación (P1–P4)',
    rules: {
      P1: {
        title: 'Tanque (prioridad 85–95)',
        body: 'Initial Fill, Changeout y Drain Full pausan la dosificación química (interlock simulado).',
      },
      P2: {
        title: 'Auto EC',
        body: 'Bucle continuo; setpoint leído de la barra EC de la semana. No dosifica durante fill.',
      },
      P3: {
        title: 'Auto pH',
        body: 'Paralelo a P2; setpoint de la barra pH. Mutex G5 en producción.',
      },
      P4: {
        title: 'TIME / SCHEDULE',
        body: 'Circulación y UC Roots independientes del tempo_recirculacao post-dose.',
      },
    },
  },
};
