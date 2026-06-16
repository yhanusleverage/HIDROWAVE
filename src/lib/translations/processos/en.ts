import type { DocsPageContent, DocsNavTree } from '../docs/types';
import type { ProcessosPageSlug } from '../docs/types';

export const processosNavEn: DocsNavTree = {
  sectionTitle: 'Processes',
  hubHref: '/processos',
  hubLabel: 'Start Here',
  items: [
    { href: '/processos/ciclos-automaticos', label: 'Automatic Cycles' },
    { href: '/processos/scripts-sequenciais', label: 'Sequential Scripts' },
    { href: '/processos/agendamentos', label: 'Schedules' },
  ],
  otherSection: {
    title: 'Support',
    hubHref: '/support',
    hubLabel: 'Start Here',
    items: [
      { href: '/support/arquitetura', label: 'Architecture' },
      { href: '/support/hidraulica', label: 'Hydraulics' },
      { href: '/support/regras', label: 'Rules & Engine' },
      { href: '/support/controle', label: 'Control Engineering' },
      { href: '/support/sensores', label: 'Sensors & Levels' },
    ],
  },
};

export const processosPagesEn: Record<ProcessosPageSlug, DocsPageContent> = {
  hub: {
    slug: 'hub',
    title: 'Processes — Start Here',
    subtitle: 'Executions, schedules and cycles — when and how HydroWave acts',
    breadcrumb: 'Start Here',
    sections: [
      {
        id: 'what-is-process',
        title: 'What is a “process” in HydroWave',
        accent: 'brand',
        paragraphs: ['Three distinct automatic execution patterns. Knowing which is active avoids confusing EC countdown with relay timer or drain loop.'],
        table: {
          headers: ['Type', 'Example', 'Configure at'],
          rows: [
            { cells: ['Closed loop', 'Auto EC / Auto pH', 'Automation → Nutrient / pH control'] },
            { cells: ['Procedural script', 'Drain, recharge', 'Automation → Sequential Script'] },
            { cells: ['Time schedule', 'Circulation 15 min / 2 h', 'Devices → Relay schedule'] },
          ],
        },
      },
      {
        id: 'priority-model',
        title: 'Priority model (Schedule)',
        subtitle: 'Nuravine-style grid adapted to HydroWave',
        accent: 'wait',
        priorityStack: [
          {
            priority: 1,
            label: 'Tank — Fill / Changeout / Drain',
            accent: 'brand',
            body: 'Full recharge, solution change, drain. Sequential scripts with level_1–level_4. Interrupt normal tank operation.',
            examples: [
              'FILL + DOSE — first load with nutrients',
              'CHANGEOUT 50% — partial solution change',
              'WHILE level_4 != empty — automatic drain',
            ],
          },
          {
            priority: 2,
            label: 'EC — Auto EC + nutritional add-back',
            accent: 'ec',
            body: 'Closed loop: periodic check, proportional dosing, inline recirculation. ISA-88 in nutrient_dosages.',
            examples: [
              'SP 1333 µS/cm ± tolerance — dead band',
              'Nutrient sequence → WAITING 3s → RECIRC',
            ],
          },
          {
            priority: 3,
            label: 'pH — Auto pH H domain',
            accent: 'ph',
            body: 'Adaptive pulses, K learns post-recirc. Blocked during EC sequential dosing (G5) in production.',
            examples: [
              'SP 6.0 ± tolerance 0.2',
              'DoseReal = A × |ErroH| / K',
            ],
          },
          {
            priority: 4,
            label: 'TIME — pulses and circulation',
            accent: 'neutral',
            body: 'SCHEDULE_* rules and time_interval: circulation, UC Roots every 72h, aux light — independent of PV.',
            examples: [
              'Circulation 15 min every 2 h',
              'TIME dosing — nutrient on timer',
            ],
          },
        ],
      },
      {
        id: 'lifecycle',
        title: 'Execution lifecycle',
        accent: 'ec',
        steps: [
          { title: 'Configuration', body: 'Operator saves parameters or rule in UI → Supabase.' },
          { title: 'Sync', body: 'ESP32 receives config on poll (~30 s) or immediate command.' },
          { title: 'Evaluation', body: 'Condition met (sensor, timer, or EC/pH error).' },
          { title: 'Actuation', body: 'Relay, pump, or nutrient sequence.' },
          { title: 'Logging', body: 'nutrient_dosages / ph_dosages / rule_executions for audit.' },
        ],
      },
    ],
    cards: [
      { href: '/processos/ciclos-automaticos', title: 'Automatic Cycles', description: 'EC and pH state machines, badges and config poll', accent: 'ec' },
      { href: '/processos/scripts-sequenciais', title: 'Sequential Scripts', description: 'WHILE/IF, cooldown, rule_executions', accent: 'brand' },
      { href: '/processos/agendamentos', title: 'Schedules', description: 'SCHEDULE_*, timezone, trigger_type', accent: 'wait' },
    ],
    next: { href: '/processos/ciclos-automaticos', label: 'Automatic Cycles' },
    help: {
      title: 'Need more help?',
      body: 'For commercial support or advanced automation training, see our plans.',
      emailLabel: 'Email',
      email: 'suporte@hydrowave.com',
      plansLabel: 'View plans and services',
      plansHref: '/planos',
    },
  },
  'ciclos-automaticos': {
    slug: 'ciclos-automaticos',
    title: 'Automatic Cycles',
    subtitle: 'Auto EC and Auto pH — state machines and UI monitoring',
    breadcrumb: 'Automatic Cycles',
    sections: [
      {
        id: 'ec-states',
        title: 'State machine — Auto EC',
        accent: 'ec',
        stateFlow: ['IDLE', 'DOSING', 'WAITING', 'RECIRCULATING', 'IDLE'],
        bullets: [
          'IDLE: waits between checks; compares PV with SP ± tolerance.',
          'DOSING: sequential peristaltic pumps per nutrient plan.',
          'WAITING: ~3 s pause between nutrients.',
          'RECIRCULATING: tempo_recirculacao before new reading.',
          'Serial: 🤖 === AUTOMATIC EC CONTROL === → STARTING SEQUENTIAL DOSING → RECIRC.',
        ],
      },
      {
        id: 'ph-states',
        title: 'State machine — Auto pH',
        accent: 'ph',
        stateFlow: ['PH_IDLE', 'PH_DOSING', 'PH_RECIRCULATING', 'PH_IDLE'],
        bullets: [
          'PH_DOSING: acid/base pulse limited by max_pulse_seconds.',
          'PH_RECIRCULATING: τ = u(t)/q; K updated at end.',
          'Recirculating badge persists until dead-time ends.',
          'Serial: AUTOMATIC pH CONTROL → pH DOSING → OFF → RECIRC → SEQUENCE COMPLETE.',
          'MQTT: ph_operation dosing rem=Ns decreasing; then recirculating rem=τ.',
        ],
      },
      {
        id: 'poll-vs-loop',
        title: 'Config poll vs control loop',
        accent: 'wait',
        paragraphs: [
          'HydroSystemCore polls ec/ph_controller_config every ~30 s. UI setpoint changes may take one poll cycle to apply.',
          'EC/pH error evaluation runs in firmware loop() — faster than poll but depends on loaded config.',
        ],
      },
      {
        id: 'ui-tutorial',
        title: 'Tutorial: follow a full cycle in UI',
        accent: 'brand',
        steps: [
          { title: 'Enable Auto EC', body: 'Automation → Save → Activate. Watch ec_operation_state in Control Status.' },
          { title: 'Outside dead band', body: 'Badge changes to dosing; nutrient_dosages gets new record.' },
          { title: 'Recirculation', body: 'Recirc countdown; do not interrupt with manual dose.' },
          { title: 'Auto pH', body: 'After EC stabilizes, enable pH; check G5 interlock if EC still sequencing.' },
          { title: 'UI badges', body: 'Dosing / Recirculating / Next check — recirc takes priority over relay flash.' },
          { title: 'Dashboard', body: 'Auto EC/pH cards on Dashboard mirror the same badges, but only after auto_enabled loads from config — parity with Automation.' },
          { title: 'K in Supabase', body: 'After pH recirc, verify k_acid/k_base updated in panel (PATCH post-recirc).' },
        ],
      },
    ],
    prev: { href: '/processos', label: 'Start Here' },
    next: { href: '/processos/scripts-sequenciais', label: 'Sequential Scripts' },
  },
  'scripts-sequenciais': {
    slug: 'scripts-sequenciais',
    title: 'Sequential Scripts',
    subtitle: 'Creation, limits and procedural execution examples',
    breadcrumb: 'Sequential Scripts',
    sections: [
      {
        id: 'lifecycle',
        title: 'Lifecycle',
        accent: 'brand',
        paragraphs: [
          'The full flow links procedural UI (Support → Rules) to persisted JSON and ESP32 execution. See screenshots in Support → Rules for the creation modal and rule ID panel.',
        ],
        image: {
          src: '/rulesid.png',
          alt: 'Active drain rule in Decision Engine with ID and priority',
          caption:
            'After persist: rule visible in panel with unique ID — starting point to trace executions in rule_executions.',
        },
        steps: [
          { title: 'Create', body: 'SequentialScriptEditor or Drain template in UI.' },
          { title: 'Persist', body: 'JSON in decision_rules.rule_json.script in Supabase.' },
          { title: 'Load', body: 'ESP32 DecisionEngine on sync (implementation in progress).' },
          { title: 'Execute', body: 'Evaluates instructions[] respecting loop_interval_ms.' },
          { title: 'Log', body: 'rule_executions + execution_log for audit.' },
        ],
        callouts: [
          {
            variant: 'warning',
            title: 'Implementation status',
            body: 'Full sequential script executor on ESP32 is partially implemented. Bench test before critical processes (drain, recharge).',
          },
        ],
      },
      {
        id: 'criar-script',
        title: 'Create script in UI',
        accent: 'wait',
        paragraphs: [
          'Before JSON reaches Supabase, the operator follows the New Rule modal procedural flow — conditions first, actions second.',
        ],
        image: {
          src: '/fluxoprocedural.png',
          alt: 'New Rule modal procedural flow with Level 1 equals Low condition',
          caption:
            'Step 1 in practice: define Main Condition (e.g. Level 1 = Low) before building drain or recharge LOOP.',
        },
      },
      {
        id: 'limits',
        title: 'Safety limits',
        accent: 'warn',
        bullets: [
          'cooldown_ms — prevents immediate re-entry after RETURN.',
          'max_executions_per_hour — protection against sensor flapping.',
          'max_iterations — WHILE loop limit (0 = infinite, use carefully).',
          'priority — tank rules (drain) should outrank TIME circulation.',
        ],
      },
      {
        id: 'examples',
        title: 'Process examples',
        accent: 'wait',
        table: {
          headers: ['Process', 'Pattern', 'Key sensor'],
          rows: [
            { cells: ['Drain', 'WHILE level_4 != empty', 'level_4'] },
            { cells: ['Full recharge', 'WHILE level_1 != high', 'level_1'] },
            { cells: ['Add-back', 'IF water_level == low → recharge', 'water_level'] },
            { cells: ['Forced circulation', 'relay ON + DELAY + OFF', '—'] },
          ],
        },
      },
    ],
    prev: { href: '/processos/ciclos-automaticos', label: 'Automatic Cycles' },
    next: { href: '/processos/agendamentos', label: 'Schedules' },
  },
  agendamentos: {
    slug: 'agendamentos',
    title: 'Schedules',
    subtitle: 'Relay schedules, timezone and trigger_type',
    breadcrumb: 'Schedules',
    sections: [
      {
        id: 'schedule-rules',
        title: 'SCHEDULE_* rules',
        accent: 'brand',
        paragraphs: [
          'DeviceControlPanel creates rules with time_interval sensor: relay ON for duration, repeats every interval_between_executions, optional delay_before_execution.',
          'Typical name: SCHEDULE_<relay_id>. Stored as decision_rules with trigger_type scheduled or periodic.',
        ],
      },
      {
        id: 'timezone',
        title: 'Timezone',
        accent: 'wait',
        paragraphs: [
          'Settings → device timezone. Circadian schedules and local-time rules depend on this value.',
          'Mismatch between UI and ESP32 timezone causes offset executions — validate after region change.',
        ],
      },
      {
        id: 'trigger-types',
        title: 'trigger_type',
        accent: 'ec',
        table: {
          headers: ['Type', 'Behavior'],
          rows: [
            { cells: ['periodic', 'Re-evaluates at fixed loop_interval_ms'] },
            { cells: ['on_change', 'Fires when sensor changes state'] },
            { cells: ['scheduled', 'Based on time interval / logical cron'] },
          ],
        },
      },
      {
        id: 'priority-4-time',
        title: 'Priority 4 — TIME pulses vs inline recirc',
        accent: 'wait',
        paragraphs: [
          'TIME schedules (circulation, periodic UC Roots) run conceptually in parallel with P4, but must not compete with P1 drain.',
          'Set low priority (20–40) on SCHEDULE_* and high priority (80+) on tank scripts.',
        ],
        callouts: [
          {
            variant: 'tip',
            title: 'Do not confuse',
            body: 'tempo_recirculacao from Auto EC/pH is post-dose dead-time (homogenization). 24/7 circulation pump is a separate TIME rule.',
          },
        ],
      },
      {
        id: 'comparison',
        title: 'Comparison: which mechanism to use?',
        accent: 'ph',
        table: {
          headers: ['Need', 'Recommended mechanism'],
          rows: [
            { cells: ['Keep EC at setpoint', 'Auto EC (closed loop)'] },
            { cells: ['Correct pH', 'Auto pH (closed loop)'] },
            { cells: ['Empty tank', 'Sequential WHILE script'] },
            { cells: ['Mix 15 min every 2 h', 'Schedule time_interval'] },
          ],
        },
      },
    ],
    prev: { href: '/processos/scripts-sequenciais', label: 'Sequential Scripts' },
    next: { href: '/support', label: 'Support — Start Here' },
  },
};
