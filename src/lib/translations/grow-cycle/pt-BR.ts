import type { GrowCycleChromeTranslations } from './types';

export const growCycleChromePt: GrowCycleChromeTranslations = {
  phaseLabels: {
    establishment: 'Estabelecimento',
    vegetative: 'Vegetativo',
    flip: 'Transição',
    flower: 'Floração',
    flush: 'Flush',
  },
  phaseRibbon: {
    establishment: 'Est',
    vegetative: 'Veg',
    flip: 'Tra',
    flower: 'Flo',
    flush: 'Flu',
  },

  selectDeviceEmbedded: 'Selecione um dispositivo no cabeçalho',
  selectDevice: 'Selecione um dispositivo',
  draftSaved: 'Plano guardado como rascunho',
  selectCoreEmbedded: 'Selecione um HydroWave Core no cabeçalho',
  selectCore: 'Selecione um HydroWave Core',
  startingCycleToast: 'A iniciar ciclo… (pode demorar uns segundos)',
  cycleStarted:
    'Ciclo iniciado S0 — FILL/CO/DRAIN ok; Circ vazio até Novo schedule',
  cycleStartedWarnings: ' ({n} avisos)',
  startCycleError: 'Erro ao iniciar ciclo',
  networkError: 'Erro de rede ao iniciar ciclo',

  bannerPreviewEmbedded:
    'Preview — selecione o Core no cabeçalho; execute migration SQL para persistência',
  bannerPreview:
    'Preview — selecione dispositivo e execute migration SQL para persistência',
  bannerDemo:
    'Demo local — receita completa (FILL / CO / Circ). Arraste a timeline na horizontal.',
  bannerActive:
    'Ciclo activo desde {date} · S{week} · schedules: pastilhas live (todo dia / semana) — Novo schedule no painel',
  bannerF2:
    'F2 — Iniciar ciclo: FILL/CO/DRAIN da receita; Circ só quando criar schedule',
  bannerHoverHint:
    'Hover = resumo da semana (Δ, ml, ajustes) · {n} semanas com histórico',
  bannerHoverDemoSuffix: ' · modo demo',
  bannerHoverLiveSuffix: ' · dados live',

  processosLink: 'Processos',
  timelineTitle: 'Timeline de cultivo',
  timelineSubtitle: '{name} — ISA-88 Recipe (F1–F2)',
  openInAutomacao: 'Abrir em Automação → Ciclo de Cultivo',
  badgeActive: 'CICLO ACTIVO',
  badgeDesigner: 'DESIGNER',

  cicloTitle: 'Ciclo de Cultivo',
  subtitleDemo: '{name} — receita S0…S{weeks} · demo',
  subtitleLiveEmpty: '{name} — receita S0…S{weeks} · live vazio',
  linkAutoEc: 'Auto EC',
  linkAutoPh: 'Auto pH',
  linkRules: 'Ver regras publicadas',

  durationLabel: 'Duração do ciclo (semanas)',
  weeksRangeHint: 'S0 … S{weeks}',
  weekSimulated: 'Semana actual (simulada)',
  weekCycle: 'Semana actual (ciclo)',
  phaseCurrent: 'Fase actual:',
  deviceSelectLabel: 'HydroWave Core',
  noneDeviceOption: 'Nenhum — só simulado',
  advanceSim: 'Avançar simulação 1 semana',
  demoOn: 'Demo local ON',
  demoToggle: 'Alternar demo (dev)',
  demoBadge: 'Demo local',
  saving: 'Guardando…',
  saveDraft: 'Guardar rascunho',
  starting: 'A iniciar…',
  startSelectCore: 'Iniciar ciclo (selecione Core)',
  restartCycle: 'Reiniciar ciclo',
  startCycle: 'Iniciar ciclo',
  startHint: 'Iniciar = S0 + FILL/CO/DRAIN; sem Circ automático',
  selectCoreToStart:
    'Selecione um HydroWave Core no cabeçalho para iniciar o ciclo.',

  schedulesSectionTitle: 'Schedules',
  schedulesSectionSub:
    'Cronogramas do Core (diário / semanal / semana do ciclo) — embutidos no Ciclo de Cultivo',
  schedulesSelectCore:
    'Selecione um HydroWave Core no cabeçalho para gerir schedules.',

  chartPlayheadDemo: 'Playhead simulado (demo)',
  chartPlayheadLive: 'Playhead / semana actual',
  chartScrollHint: '← Arraste / role na horizontal para ver mais semanas →',
  chartLiveEmptySchedules:
    'Live: sem pastilhas de schedule — use Novo schedule (todo dia + duração)',
  scheduleShortCirculation: 'Circ',
  scheduleLaneLabel: 'Agend.',
  scheduleRecurring: 'Recorrente na semana',
  scheduleOneShot: 'Evento pontual',
  scheduleKindCirculation: 'Circulação',
  scheduleKindMaintenance: 'Manutenção',
  scheduleKindCustom: 'Agendamento',

  hover: {
    weekTitle: 'Semana S{n}',
    thisWeek: 'esta semana',
    pastWeek: 'nesta semana',
    futureWeek: 'ainda não começou',
    target: 'Alvo',
    initial: 'Inicial',
    final: 'Final',
    avgDailyDrop: 'Queda média/dia',
    nutrientsMl: 'ml nutrientes',
    adjustments: 'Ajustes',
    phMl: 'ml pH+ / pH−',
    futureNote:
      'Semana futura — só alvo. Inicial / final / queda média quando a semana começar.',
    summaryWithData: 'Resumo {weekLabel} · tanque {L} L',
    summaryNoData: 'Sem dados ainda {weekLabel} · tanque {L} L',
    perDay: '/dia',
  },

  weekDetail: {
    invalidWeek: 'Semana inválida.',
    weekTitle: 'Semana S{n}',
    ecTarget: 'EC alvo',
    phTarget: 'pH alvo',
    tankVolumePlan: 'Volume tanque (plan)',
    tankVolumeHint: 'Usado na fórmula de diluição EC (V_tanque)',
    applyToDevice: 'Aplicar ao device',
    sending: 'Enviando…',
    phaseLabel: 'Fase do ciclo',
    phaseRecipeHint:
      'Toque nos botões para mudar Veg → Transição → Floração → Flush. Guarde o plano para persistir.',
    phaseAria: 'Fase da semana S{n}',
    phaseFlipGroupAria: 'Selecionar fase do ciclo',
    autoEcOn: 'Auto EC ON',
    autoPhOn: 'Auto pH ON',
    measuredHistory: 'Medido (histórico)',
    ecAvg: 'EC avg',
    phAvg: 'pH avg',
    measuredHint: 'Snapshot {date}',
    eventsP1: 'Eventos P1 (tanque)',
    planSchedules: 'Agendamentos do plano',
    liveSchedules: 'Schedules live',
    newSchedule: 'Novo schedule',
    rule: 'Regra',
    selectRule: 'Selecionar regra…',
    timeDaily: 'Hora (todo dia)',
    durationMin: 'Duração (min)',
    dailyHint:
      'Tipo: daily — pastilha em todas as semanas; duração grava-se na regra (ações timed)',
    cancel: 'Cancelar',
    creating: 'A criar…',
    createSchedule: 'Criar schedule',
    selectCoreLive: 'Selecione um Core para ver e criar schedules live.',
    loadingSchedules: 'A carregar schedules…',
    emptyLive: 'Nenhum schedule live ainda (daily ou S{week}).',
    everyDay: 'todo dia',
    deleteSchedule: 'Eliminar schedule',
    enabled: 'ON',
    disabled: 'OFF',
    toastSelectCore: 'Selecione um HydroWave Core no cabeçalho',
    toastSelectRule: 'Selecione uma regra',
    toastNeedStartTime: 'Informe o horário de início',
    toastNeedDuration: 'Informe a duração (minutos)',
    toastCreateOk: 'Schedule diário criado ({min} min na regra)',
    toastCreateOkNoDur: 'Schedule diário criado',
    toastCreateOkPartial:
      'Schedule criado, mas duração na regra falhou: {error}',
    toastCreateFail: 'Erro ao criar schedule',
    toastDeleteConfirm: 'Eliminar este schedule?',
    toastDeleteOk: 'Schedule removido com sucesso!',
    toastDeleteFail: 'Erro ao remover schedule',
    toastLoadFail: 'Erro ao carregar schedules',
    toastVolumeSynced: 'Volume {L} L enviado ao Auto EC',
    toastPhaseChanged: 'S{week} → {phase}',
  },

  simulation: {
    logTitle: 'Log de simulação',
    logSubtitle: 'Últimos eventos fictícios',
    logEmpty:
      'Clique em "Avançar simulação 1 semana" para gerar entradas.',
    rulesToggle: 'Regras de simulação (P1–P4)',
    rules: {
      P1: {
        title: 'Tanque (prioridade 85–95)',
        body: 'Initial Fill, Changeout e Drain Full pausam dosagem química (interlock simulado).',
      },
      P2: {
        title: 'Auto EC',
        body: 'Bucle continuo; setpoint lido da barra EC da semana. Não dosifica durante fill.',
      },
      P3: {
        title: 'Auto pH',
        body: 'Paralelo a P2; setpoint da barra pH. Mutex G5 em produção.',
      },
      P4: {
        title: 'TIME / SCHEDULE',
        body: 'Circulação e UC Roots independentes do tempo_recirculacao post-dose.',
      },
    },
  },
};
