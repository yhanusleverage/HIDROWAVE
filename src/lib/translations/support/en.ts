import type { DocsPageContent, DocsNavTree } from '../docs/types';
import type { SupportPageSlug } from '../docs/types';

export const supportNavEn: DocsNavTree = {
  sectionTitle: 'Support',
  hubHref: '/support',
  hubLabel: 'Start Here',
  items: [
    { href: '/support/arquitetura', label: 'Architecture' },
    { href: '/support/hidraulica', label: 'Hydraulics' },
    { href: '/support/regras', label: 'Rules & Engine' },
    { href: '/support/controle', label: 'Control Engineering' },
    { href: '/support/sensores', label: 'Sensors & Levels' },
  ],
  otherSection: {
    title: 'Processes',
    hubHref: '/processos',
    hubLabel: 'Start Here',
    items: [
      { href: '/processos/ciclos-automaticos', label: 'Automatic Cycles' },
      { href: '/processos/scripts-sequenciais', label: 'Sequential Scripts' },
      { href: '/processos/agendamentos', label: 'Schedules' },
    ],
  },
};

export const supportPagesEn: Record<SupportPageSlug, DocsPageContent> = {
  hub: {
    slug: 'hub',
    title: 'Support — Start Here',
    subtitle: 'HydroWave technical documentation for integrators and advanced operators',
    breadcrumb: 'Start Here',
    sections: [
      {
        id: 'welcome',
        title: 'Welcome to technical documentation',
        accent: 'brand',
        paragraphs: [
          'This section complements the Information menu. While Information covers day-to-day operation (FAQ, calibration, first steps), Support explains engineering decisions: hydraulics, rule engine, level sensors, and EC/pH control loops.',
          'If you grow crops and only need the system running, start at Information. If you integrate hardware, write rules, or need to understand firmware behavior, you are in the right place.',
        ],
      },
      {
        id: 'layers',
        title: 'How a HydroWave system fits together',
        subtitle: 'Three layers, Nuravine-inspired model adapted to our stack',
        accent: 'brand',
        layers: [
          {
            title: '1. Edge — ESP32 master + ESP-NOW slaves',
            body: 'The master reads water sensors (pH, EC/TDS, level), runs Auto EC/pH via HydroControl, and sends commands to local relays or slaves (valves, peristaltic pumps, recirculation).',
            accent: 'wait',
          },
          {
            title: '2. Sensors and actuators',
            body: 'Adapted Nuravine-style sensors: pH/EC probe, XKR-25 level sensor (FULL/MEDIUM/LOW), environment (temp/humidity). Actuators: dosing pumps, 24V valves, recharge and drain relays.',
            accent: 'ec',
          },
          {
            title: '3. Cloud — Supabase + HydroWave UI',
            body: 'Realtime/MQTT telemetry, remote config (setpoints, nutrient plan, rules), dosing history (ISA-88), and automation panel. The UI translates grower intent into JSON consumed by the ESP32.',
            accent: 'ph',
          },
        ],
      },
      {
        id: 'vs-informacao',
        title: 'Support vs Information',
        accent: 'neutral',
        table: {
          headers: ['Topic', 'Information', 'Support'],
          rows: [
            { cells: ['Enable Auto EC', 'Operational step-by-step', 'u(t) equation, dead band, ISA-88'] },
            { cells: ['Rules', 'How to create a simple rule', 'WHILE/IF scripts, 4 levels, cooldown'] },
            { cells: ['Water level', 'Check sensor online', 'level_1–4 model vs physical sensor'] },
            { cells: ['Drain / recharge', '—', 'Hydraulic procedures and scripts'] },
          ],
        },
      },
      {
        id: 'learning-path',
        title: 'Recommended learning path',
        subtitle: 'From cloud stack to closed loop — suggested order for integrators',
        accent: 'brand',
        steps: [
          { title: '1. Architecture', body: 'Understand UI → Supabase → ESP32, relay_commands vs decision_rules before writing automation.' },
          { title: '2. Hydraulics', body: 'Model drain, full recharge and add-back with scripts and level sensors.' },
          { title: '3. Rules & Engine', body: 'Create sequential scripts with procedural flow (Conditions → Actions → Config).' },
          { title: '4. Control Engineering', body: 'Enable Auto EC/pH, interpret badges and u(t), K and inline recirculation equations.' },
          { title: '5. Processes', body: 'See when each mechanism runs: closed loops, scripts and TIME schedules.' },
        ],
      },
      {
        id: 'glossary',
        title: 'Quick control glossary',
        accent: 'neutral',
        table: {
          headers: ['Symbol', 'Meaning', 'Where to configure'],
          rows: [
            { cells: ['PV', 'Measured process variable (EC, pH)', 'Sensors / hydro_measurements'] },
            { cells: ['SP', 'Desired setpoint', 'Automation → EC / pH'] },
            { cells: ['u(t)', 'Calculated dose (ml)', 'Firmware ECController / AdaptivePH'] },
            { cells: ['τ', 'Pulse or recirculation time (s)', 'tempo_recirculacao, max_pulse_seconds'] },
            { cells: ['K', 'Learned tank gain (pH)', 'k_acid / k_base — learns post-recirc'] },
            { cells: ['A', 'Aggressiveness per cycle (0.05–1)', 'ph_config.aggressiveness'] },
            { cells: ['α', 'EMA learning speed for K', 'ph_config.gain_alpha'] },
          ],
        },
      },
    ],
    cards: [
      { href: '/support/arquitetura', title: 'Architecture', description: 'UI → Supabase → ESP32 flow, relay_commands vs decision_rules', accent: 'brand' },
      { href: '/support/hidraulica', title: 'Hydraulics', description: 'Drain, full recharge, add-back, inline recirculation', accent: 'wait' },
      { href: '/support/regras', title: 'Rules & Engine', description: 'Decision Engine, sequential scripts, execution parameters', accent: 'brand' },
      { href: '/support/controle', title: 'Control Engineering', description: 'Auto EC, pH H-domain, pulses and interlocks', accent: 'ec' },
      { href: '/support/sensores', title: 'Sensors & Levels', description: 'pH/EC/Temp transmitter + contactless level sensor (XKR-25), QC and mapping', accent: 'ph' },
      { href: '/processos', title: 'Processes', description: 'Cycles, schedules and executions — when each runs', accent: 'wait' },
    ],
    next: { href: '/support/arquitetura', label: 'Architecture' },
    help: {
      title: 'Need more help?',
      body: 'For commercial support, assisted installation, or technical training, see our plans.',
      emailLabel: 'Email',
      email: 'suporte@hydrowave.com',
      plansLabel: 'View plans and services',
      plansHref: '/planos',
    },
  },
  arquitetura: {
    slug: 'arquitetura',
    title: 'System Architecture',
    subtitle: 'How data and commands flow between cloud, API, and firmware',
    breadcrumb: 'Architecture',
    sections: [
      {
        id: 'overview',
        title: 'Overview',
        accent: 'brand',
        paragraphs: [
          'HydroWave separates three data paths: telemetry (sensors → Supabase → UI), configuration (UI → RPC/API → ESP32 NVS), and actuation (manual, Auto EC/pH, or Decision Engine → relays).',
          'HydroControl handles continuous control loops (EC/pH). DecisionEngine evaluates discrete rules (conditions → relay actions). Both coexist with mutex and interlocks documented in firmware.',
        ],
      },
      {
        id: 'data-flow',
        title: 'Data flow',
        accent: 'wait',
        steps: [
          { title: 'UI / Automation', body: 'Operator configures setpoints, nutrient plan, or rules. Next.js calls API routes that persist to Supabase.' },
          { title: 'Supabase', body: 'Tables: hydro_measurements, relay_master, ec_controller_config, ph_controller_config, decision_rules, relay_commands, nutrient_dosages, ph_dosages.' },
          { title: 'ESP32 — HydroSystemCore', body: 'Config poll (~30 s), sensor reads, operation_state sync, pending relay_commands processing.' },
          { title: 'HydroControl + DecisionEngine', body: 'EC/pH loops in main loop(); rules evaluated in dedicated task with cooldown and hourly limits.' },
        ],
      },
      {
        id: 'relay-vs-rules',
        title: 'relay_commands vs decision_rules',
        accent: 'warn',
        paragraphs: [
          'relay_commands: immediate or manual actions (Dose, relay toggle, batch up to 5 commands). High operational priority for human intervention.',
          'decision_rules: persistent automation. Composite rules (IF sensor THEN relay) or sequential scripts (WHILE/IF with loop_interval_ms). Respect cooldown and max_executions_per_hour.',
        ],
        callouts: [
          {
            variant: 'info',
            title: 'Two engines, one hardware',
            body: 'Auto EC/pH do not go through Decision Engine — they are state machines in HydroControl. Hydraulic rules (drain, circulation) use Decision Engine when enabled on ESP32.',
          },
        ],
      },
      {
        id: 'mqtt',
        title: 'MQTT and Realtime',
        accent: 'brand',
        paragraphs: [
          'The MQTT bridge publishes telemetry and operation_state (ec_operation_state, ph_operation_state) so the UI reflects Dosing / Recirculating badges without aggressive polling.',
          'Hybrid commands: HTTPS for persistent config, MQTT for low-latency events when the bridge is active.',
        ],
      },
    ],
    prev: { href: '/support', label: 'Start Here' },
    next: { href: '/support/hidraulica', label: 'Hydraulics' },
  },
  hidraulica: {
    slug: 'hidraulica',
    title: 'Hydraulics and Tank Processes',
    subtitle: 'Drain, full recharge, add-back and recirculation modeled as rules',
    breadcrumb: 'Hydraulics',
    sections: [
      {
        id: 'intro',
        title: 'Hydraulics as automation',
        accent: 'wait',
        paragraphs: [
          'In HydroWave, hydraulic processes (empty tank, fill, replace consumed volume) are not separate firmware modules — they are sequential scripts combining level sensors and valve/pump relays.',
          'This lets integrators adapt logic to physical layout (probe positions, motorized valves, recharge pump) without recompiling firmware.',
        ],
      },
      {
        id: 'drain',
        title: 'Automatic drain',
        accent: 'brand',
        paragraphs: ['Canonical procedure: keep outlet valve open until level reads empty, then close and exit script.'],
        code: `WHILE level_4 != "vazio" DO\n  outlet_valve_relay = ON\nEND WHILE\n\nIF level_4 == "vazio" THEN\n  outlet_valve_relay = OFF\n  RETURN\nEND IF`,
        steps: [
          { title: 'Map level_4', body: 'Configure lowest probe (or derived logical state) as level_4 = empty when tank drained.' },
          { title: 'Assign relay', body: 'Drain motorized valve on ESP-NOW slave or local relay (e.g. relay 5).' },
          { title: 'Set loop_interval_ms', body: 'Typically 1000–5000 ms between WHILE evaluations to avoid valve chatter.' },
        ],
      },
      {
        id: 'full-recharge',
        title: 'Full recharge',
        accent: 'ec',
        paragraphs: [
          'After drain or solution change, fill tank until level_1 = high (top probe). Clean water or prepared solution via Recharge relay.',
        ],
        code: `WHILE level_1 != "alto" DO\n  recharge_relay = ON\nEND WHILE\n\nIF level_1 == "alto" THEN\n  recharge_relay = OFF\n  RETURN\nEND IF`,
        callouts: [
          {
            variant: 'warning',
            title: 'Design pattern',
            body: 'Full recharge is documented as a script contract. Relay name exists in test firmware; validate GPIO/slave mapping on your installation before production use.',
          },
        ],
      },
      {
        id: 'add-back',
        title: 'Add-back (partial top-up)',
        accent: 'ph',
        paragraphs: [
          'When level drops from evapotranspiration/consumption but solution remains valid, add volume without changing nutrients. Combine: IF water_level == baixo → recharge ON until medio.',
          'Coordinate with Auto EC: after significant add-back, EC may drop — EC loop corrects on next check after tempo_recirculacao.',
        ],
      },
      {
        id: 'add-back-vs-full',
        title: 'Add-back vs Full Recharge',
        accent: 'ec',
        paragraphs: [
          'Choosing the right procedure avoids unnecessary nutrient changes or operating at wrong volume. Full recharge resets the tank; add-back only replaces what evaporated.',
        ],
        table: {
          headers: ['Criterion', 'Add-back', 'Full Recharge'],
          rows: [
            { cells: ['When to use', 'Low level, solution still valid', 'After drain or recipe change'] },
            { cells: ['Volume', 'Partial to medium/high', 'Until level_1 = high'] },
            { cells: ['EC/pH impact', 'Light dilution — Auto EC corrects', 'Requires FILL+DOSE or Auto EC after recirc'] },
            { cells: ['Mechanism', 'IF water_level + recharge relay', 'WHILE level_1 != high'] },
            { cells: ['Priority', 'P1 — tank script', 'P1 — after drain'] },
          ],
        },
      },
      {
        id: 'tank-tutorial',
        title: 'Tutorial: drain → recharge → Auto EC',
        accent: 'brand',
        steps: [
          { title: 'Drain', body: 'Run WHILE level_4 != empty script. Serial: valve ON until empty. priority ≥ 80 in Decision Engine.' },
          { title: 'Full recharge', body: 'WHILE level_1 != high with clean water or prepared solution pump.' },
          { title: 'Inline recirculation', body: 'Wait tempo_recirculacao (homogenization) before trusting EC/pH readings.' },
          { title: 'Enable Auto EC', body: 'Automation → Nutrient Control → auto_enabled. Watch ec_operation_state: dosing → recirculating → idle.' },
        ],
      },
      {
        id: 'inline-recirc',
        title: 'Inline recirculation vs tempo_recirculacao',
        accent: 'wait',
        paragraphs: [
          'Inline recirculation in automatic dosing context = dead-time after each pulse (tempo_recirculacao in seconds). Firmware waits for homogenization before re-measuring pH/EC.',
          'Continuous hydraulic recirculation (pump always on) is a separate relay rule or schedule — do not confuse with post-dose controller timer.',
          'In UI badges: “Waiting for recirculation” refers to controller dead-time (P2/P3), not TIME circulation pump (P4).',
        ],
      },
    ],
    prev: { href: '/support/arquitetura', label: 'Architecture' },
    next: { href: '/support/regras', label: 'Rules & Engine' },
  },
  regras: {
    slug: 'regras',
    title: 'Rules and Decision Engine',
    subtitle: 'Decision Engine, sequential scripts and rule creation',
    breadcrumb: 'Rules & Engine',
    sections: [
      {
        id: 'types',
        title: 'Rule types',
        accent: 'brand',
        bullets: [
          'Composite rule: conditions[] + actions[] — IF pH < 5.5 THEN relay ON.',
          'Sequential script (rule_type: sequential_script): instructions[] with WHILE, IF, relay_action, DELAY, RETURN.',
          'Schedule: time_interval sensor with interval_between_executions (see Processes → Schedules).',
        ],
      },
      {
        id: 'fluxo-procedural',
        title: 'Procedural flow in UI (top to bottom)',
        subtitle: 'How the New Rule modal organizes logic before it becomes JSON in Supabase',
        accent: 'brand',
        paragraphs: [
          'When creating a rule in the Decision Engine, the UI follows a fixed flow: conditions first (sensors and operators), then actions (relay ON/OFF), chained events (extra steps after the main condition), and finally advanced config (cooldown, priority, loop_interval_ms).',
          'In the example below, function “Automatic Drain” starts with Main Condition: Level 1 = Low — a typical trigger before a WHILE script empties the tank.',
        ],
        image: {
          src: '/fluxoprocedural.png',
          alt: 'New Rule modal showing Conditions, Actions, Chained Events and Advanced Config flow',
          caption:
            'Automation → + New Rule: procedural flow Conditions → Actions → Chained Events → Advanced Config. Example with Level 1 = Low.',
        },
        bullets: [
          'Conditions — level_1–level_4, water_level, TDS, temperature, humidity sensors.',
          'Actions — immediate relay_action when condition is met.',
          'Chained events — additional sequence (e.g. DELAY + second action).',
          'Advanced config — priority, cooldown, max_executions_per_hour, loop_interval_ms.',
        ],
      },
      {
        id: 'motor-decisao-painel',
        title: 'Decision Engine panel and rule ID',
        subtitle: 'Active sequential scripts list, priority and unique identifier',
        accent: 'ph',
        paragraphs: [
          'After saving, the rule appears in Automation → Decision Engine. Each card shows name, Active/Inactive badge, Sequential Script type, instruction preview (IF, LOOP WHILE) and metadata: Priority and ID (e.g. RULE_1700979324226).',
          'The ID is the key in decision_rules — use it for audit, rule_executions logs and support. The “drain” rule below shows LOOP while water_level != empty, aligned with hydraulic procedures in Hydraulics.',
        ],
        image: {
          src: '/rulesid.png',
          alt: 'Decision Engine panel with active drain rule, LOOP preview and ID RULE_1700979324226',
          caption:
            'Sequential Script Rules: active card with IF/LOOP preview, priority 69 and copyable ID. View, edit and delete buttons top right.',
        },
      },
      {
        id: 'instructions',
        title: 'Script instructions',
        accent: 'wait',
        table: {
          headers: ['Instruction', 'Function'],
          rows: [
            { cells: ['WHILE', 'Loop while condition true (e.g. drain)'] },
            { cells: ['IF / ELSE', 'Conditional branch'] },
            { cells: ['relay_action', 'ON/OFF on master or ESP-NOW slave relay'] },
            { cells: ['DELAY', 'Pause between steps (ms)'] },
            { cells: ['RETURN', 'End script execution this cycle'] },
          ],
        },
      },
      {
        id: 'params',
        title: 'Execution parameters',
        accent: 'ec',
        bullets: [
          'loop_interval_ms — interval between script re-evaluations.',
          'cooldown / cooldown_ms — minimum time between complete executions.',
          'max_executions_per_hour — safety limit against runaway loops.',
          'priority — relative order when multiple rules compete.',
          'max_iterations — 0 = unlimited (use carefully in WHILE).',
        ],
      },
      {
        id: 'priority-numeric',
        title: 'Numeric priority (0–100)',
        accent: 'warn',
        paragraphs: [
          'When multiple decision_rules compete, ESP32 orders by priority DESC (higher wins). Tank and safety should rank above TIME circulation.',
        ],
        table: {
          headers: ['Suggested range', 'Rule type', 'Example'],
          rows: [
            { cells: ['80–100', 'Tank / drain / recharge', 'WHILE drain script'] },
            { cells: ['50–79', 'Operational scripts', 'Add-back, forced mixing'] },
            { cells: ['20–49', 'Circulation / TIME', 'SCHEDULE circulation 15 min'] },
            { cells: ['0–19', 'Auxiliary / light', 'UV light, night aerator'] },
          ],
        },
        callouts: [
          {
            variant: 'info',
            title: 'Auto EC/pH',
            body: 'Closed EC/pH loops run in HydroControl — they do not use decision_rules priority. G5 interlock blocks pH during EC sequential dosing in production.',
          },
        ],
      },
      {
        id: 'four-levels',
        title: 'Level sensors in rules (4 levels)',
        accent: 'ph',
        paragraphs: [
          'In UI (CreateRuleModal), you can reference level_1 to level_4 and water_level (vazio, baixo, medio, alto). This models installations with up to four discrete probes or derived logical states.',
        ],
        callouts: [
          {
            variant: 'warning',
            title: 'Implementation status',
            body: 'Decision Engine on ESP32 is in development (~35% per Jun/2026 checkpoint). Scripts and JSON schema are the design contract; validate execution on device before critical production.',
          },
        ],
      },
      {
        id: 'ui',
        title: 'Where to configure in UI',
        accent: 'brand',
        steps: [
          { title: 'Automation → Rules', body: 'CreateRuleModal for composite rules with sensor conditions.' },
          { title: 'Sequential Script Editor', body: 'SequentialScriptEditor for WHILE/IF and loop parameters.' },
          { title: 'Save and enable', body: 'Rule persists in decision_rules; ESP32 loads on next poll/sync.' },
        ],
      },
    ],
    prev: { href: '/support/hidraulica', label: 'Hydraulics' },
    next: { href: '/support/controle', label: 'Control Engineering' },
  },
  controle: {
    slug: 'controle',
    title: 'Control Engineering',
    subtitle: 'Auto EC, pH H-domain, pulses and interlocks',
    breadcrumb: 'Control Engineering',
    sections: [
      {
        id: 'ec-loop',
        title: 'Auto EC loop',
        accent: 'ec',
        paragraphs: [
          'Process variable (PV): measured EC/TDS. Setpoint (SP): configured ec_setpoint. Error = PV − SP. Dosing only if |error| > tolerance (dead band).',
          'u(t) calculated via ECController with base dose, Kp and tank volume. Proportional distribution across nutrient plan (mlPerLiter).',
        ],
        stateFlow: ['IDLE', 'DOSING', 'WAITING', 'RECIRCULATING', 'IDLE'],
        bullets: [
          'Immutable events in nutrient_dosages (ISA-88).',
          'Operational state in ec_operation_state on relay_master.',
          '~3 s pause between nutrients in same sequence (firmware).',
          'k = base_dose/total_ml and Kp are static (Supabase config) — no online K_ec learning (future backlog).',
        ],
      },
      {
        id: 'ph-loop',
        title: 'Auto pH loop — H domain',
        accent: 'ph',
        paragraphs: [
          'Adaptive control linearizes process by converting pH to H = 10^(−pH). Error in ErroH = H − H_setpoint.',
          'Operator preview: u(t) = A × V × s × |e|. Firmware: DoseReal = A × |ErroH| / K. K (k_acid / k_base) learns after each recirculation.',
        ],
        code: `τ = u(t) / q     (pulse time limited by max_pulse_seconds)\nH = 10^(-pH)\nErroH = H - H_setpoint`,
        stateFlow: ['PH_IDLE', 'PH_DOSING', 'PH_RECIRCULATING', 'PH_IDLE'],
      },
      {
        id: 'k-vs-a-alpha',
        title: 'K, A and α — distinct roles',
        accent: 'ph',
        table: {
          headers: ['Parameter', 'Role in loop', 'Persistence'],
          rows: [
            { cells: ['K (k_acid / k_base)', 'Plant model — ml per unit of |ErroH|', 'NVS + PATCH Supabase post-recirc'] },
            { cells: ['A (aggressiveness)', 'Fraction of ideal correction per pulse: DoseReal = A × |ErroH|/K', 'ph_config — operator'] },
            { cells: ['α (gain_alpha)', 'EMA learning speed for K', 'ph_config — integrator'] },
          ],
        },
      },
      {
        id: 'k-gains-loop',
        title: 'Closed K loop (pH)',
        accent: 'brand',
        paragraphs: [
          'Each cycle: measure → dose with K+A → recirc τ → measure PV2 → updateGainAfterDose → saveToNVS → PATCH k_acid/k_base.',
          'ph_dosages (relay OFF) records history; learned K only persists to Supabase after complete recirculation — not on ph_dose event.',
        ],
        stateFlow: ['checkAutoPH', 'PH_DOSING', 'ph_dose', 'PH_RECIRCULATING', 'K learn', 'PH_IDLE'],
        bullets: [
          'Serial: 💾 [PH K] PATCH k_acid/k_base post-recirc after COMPLETE pH SEQUENCE.',
          'Commissioning: first 3 cycles limit A ≤ 0.3 even if operator sets A=1.0.',
          'minDeltaPh ≥ 0.03 avoids learning without observable pH movement.',
        ],
      },
      {
        id: 'pulses',
        title: 'Pulses and recirculation',
        accent: 'wait',
        bullets: [
          'max_pulse_seconds — max pulse duration per pH cycle.',
          'tempo_recirculacao — post-dose dead-time before new reading (homogenization).',
          'UI badges: Recirculating takes priority over momentary relay flash.',
        ],
      },
      {
        id: 'dashboard-badges',
        title: 'Dashboard vs Automation badges',
        accent: 'brand',
        paragraphs: [
          'Dashboard and Automation share the same hooks (usePhOperationState / useEcOperationState) and source: ph_operation_* and ec_operation_* columns in relay_master, updated by firmware via Realtime + 5 s poll.',
          'Dashboard only mirrors relay_master when auto_enabled=true in config. While config loads, badges show loading — avoids phantom recirculation from stale DB snapshots.',
          'Automation is the operational reference for enable/disable and parameters; Dashboard is a read-only mirror of the same state, aligned once config is ready.',
        ],
      },
      {
        id: 'interlocks',
        title: 'Interlocks and EC ↔ pH coordination',
        accent: 'warn',
        paragraphs: [
          'G5 (production): Auto pH blocked while EC sequential dosing active — avoids chemical corrections during nutrient mixing.',
          'water_level_ok: Auto EC/pH and certain rules require level above LOW/ERROR on XKR-25 sensor.',
        ],
        callouts: [
          {
            variant: 'tip',
            title: 'pH commissioning',
            body: 'Start with conservative A and high τ. After 3–5 stable cycles, K converges and pulses become more precise. See Calibration and Auto pH panel.',
          },
        ],
      },
    ],
    prev: { href: '/support/regras', label: 'Rules & Engine' },
    next: { href: '/support/sensores', label: 'Sensors & Levels' },
  },
  sensores: {
    slug: 'sensores',
    title: 'Sensors and Levels',
    subtitle: 'pH/EC/Temp transmitter + contactless level sensor (XKR-25) — QC and mapping',
    breadcrumb: 'Sensors & Levels',
    sections: [
      {
        id: 'overview',
        title: 'Sensors overview',
        accent: 'brand',
        paragraphs: [
          'Transmitters and probes enter the system through two paths: (1) analog/1-wire readings (pH, EC/TDS and temperature) and (2) digital readings from the contactless XKR-25 level sensor.',
          'In the current firmware, transmitter signals (when configured as 0–5 V analog) become `ph`, `tds` and `temperature` inside `hydro_measurements`; the XKR-25 becomes `water_level_ok` for interlocks and rules.',
          'This documentation focuses on “what it is”, “why it matters”, “where to configure” and “what to observe” in serial/MQTT — to avoid guesswork during installation.',
        ],
      },
      {
        id: 'transmitter-aliexpress',
        title: 'AliExpress transmitter (pH / EC / Temperature)',
        accent: 'ec',
        paragraphs: [
          'The documentation assumes the most common case: a 3-in-1 transmitter with 0–5 V analog output.',
          'Today the firmware reads: pH → `PH_PIN 35` and EC/TDS → `TDS_PIN 34`.',
          'For TDS/EC compensation, the firmware uses DS18B20 at `TEMP_PIN 4` (the transmitter module temperature does not replace this reading).',
        ],
        sensorCards: [
          {
            badge: 'TX',
            title: '3-in-1 module',
            accent: 'brand',
            intro: 'Use this card as a “wiring guide”: understand the channel, the ESP32 input, and what the UI publishes.',
            subsections: [
              {
                title: 'pH',
                body: 'Transmitter analog output → `PH_PIN 35` (ADC). Conversion uses a linear model calibrated by two points.',
                bullets: ['Calibration: pH 7 / pH 4 (default).', 'QC happens before the control loop.'],
              },
              {
                title: 'EC/TDS',
                body: 'Transmitter analog output → `TDS_PIN 34` (ADC). Firmware uses a median filter (30 samples) and temperature compensation.',
                bullets: ['Reliable reading before Auto EC.', 'Plausibility checks in the `hydro_measurements` pipeline.'],
              },
              {
                title: 'Temperature',
                body: 'Today, compensation uses DS18B20 at `TEMP_PIN 4`.',
                bullets: ['MQTT publishes `temperature` via DS18B20.', 'Transmitter temperature channel is a future alternative (not replacing today).'],
              },
            ],
          },
        ],
      },
      {
        id: 'transmitter-ph',
        title: 'pH channel (glass probe)',
        accent: 'ph',
        sensorCards: [
          {
            badge: 'pH',
            title: 'pH in analog voltage',
            accent: 'ph',
            subsections: [
              {
                title: 'What it is',
                body: 'A glass pH probe converts the solution pH into an electrical voltage. The firmware reads it at `PH_PIN 35` and converts to pH using a linear model.',
              },
              {
                title: 'Why it matters',
                body: 'Without calibration, slope/offset drift leads to unnecessary chemical corrections. Two-point calibration anchors the model to your solution and installation.',
                bullets: ['Default: pH 7 and pH 4.', 'QC is applied before control actions.'],
              },
              {
                title: 'Where to configure in the UI',
                steps: [
                  { title: 'Calibration → pH', body: 'Use 2 points (pH 7 and pH 4). Repeat after probe change or extreme solution updates.' },
                ],
              },
              {
                title: 'What to see in serial/MQTT',
                bullets: ['`hydro_measurements.ph` reflects the converted reading.', 'When Auto pH is active: UI badges and logs follow `ph_operation_state` (DOSING/RECIRCULATING).'],
              },
            ],
          },
        ],
      },
      {
        id: 'transmitter-ec',
        title: 'EC/TDS channel',
        accent: 'ec',
        sensorCards: [
          {
            badge: 'EC/TDS',
            title: 'EC via TDSReaderSerial',
            accent: 'ec',
            subsections: [
              {
                title: 'What it is',
                body: 'The firmware reads the transmitter output at `TDS_PIN 34` and uses `TDSReaderSerial` to reduce noise (median of samples) and apply temperature compensation from DS18B20.',
              },
              {
                title: 'Calibration',
                body: 'Adjust using a standard solution and keep the calibration factor consistent.',
                bullets: ['Recommended standard: 1413 µS/cm solution.', 'Goal: Auto EC PV matches real EC/TDS.'],
              },
              {
                title: 'Impact on Auto EC',
                body: 'The closed-loop Auto EC uses PV (EC/TDS) and setpoint `ec_setpoint` with a dead band. After dosing, the UI follows inline recirculation timing before reevaluating.',
              },
              {
                title: 'What to see in serial/MQTT',
                bullets: ['`hydro_measurements.tds` and/or derived EC.', 'When Auto EC is active: `ec_operation_state` toggles between dosing/recirculating.'],
              },
            ],
          },
        ],
      },
      {
        id: 'transmitter-temperature',
        title: 'Temperature (readings compensation)',
        accent: 'wait',
        callouts: [
          {
            variant: 'warning',
            title: 'Transmitter temperature',
            body: 'In the current firmware, TDS/EC compensation uses DS18B20 at `TEMP_PIN 4`. If your transmitter also provides °C, this channel does not yet replace DS18B20.',
          },
        ],
        sensorCards: [
          {
            badge: '°C',
            title: 'DS18B20 in solution',
            accent: 'wait',
            subsections: [
              {
                title: 'What it is',
                body: 'Solution temperature is read by DS18B20 at `TEMP_PIN 4` (OneWire) and used for TDS/EC calculations.',
              },
              {
                title: 'Where to mount',
                body: 'Install immersed and protected from bubbles and direct contact with electrical parts. Avoid turbulence that creates unstable readings.',
              },
              {
                title: 'What you see in MQTT',
                bullets: ['`hydro_measurements.temperature` is shown in the UI and logs.', 'Temperature affects plausibility and the PV used by Auto EC.'],
              },
            ],
          },
        ],
      },
      {
        id: 'level-contactless',
        title: 'Contactless level sensor (XKR-25)',
        accent: 'brand',
        sensorCards: [
          {
            badge: 'Level',
            title: 'XKR-25 capacitive (contactless)',
            accent: 'wait',
            subsections: [
              {
                title: 'Mounting',
                body: 'Fix the XKR-25 on the tank wall (outside mount is possible when applicable), keeping a safe distance from the liquid surface and avoiding trapped air pockets.',
              },
              {
                title: 'Wiring (NPN/PNP)',
                body: 'Firmware uses two digital inputs: `TANK_LOW_PIN 32` (NPN) and `TANK_HIGH_PIN 33` (PNP).',
                bullets: ['NPN detects when the input is HIGH (firmware convention).', 'PNP detects when the input is LOW (firmware convention).'],
              },
              {
                title: 'States',
                body: 'The firmware combines NPN/PNP and normalizes to FULL / MEDIUM / LOW / ERROR and publishes `water_level_ok`.',
                bullets: ['FULL and MEDIUM → `water_level_ok=true`.', 'LOW and ERROR → `water_level_ok=false` (interlocks).'],
              },
            ],
          },
        ],
      },
      {
        id: 'level-xkr25-logic',
        title: 'NPN/PNP logic → water_level_ok',
        accent: 'warn',
        paragraphs: [
          'This is the “real” mapping used by `LevelSensor` (XKR-25). The Decision Engine and rules depend on `water_level_ok` to allow/block actions.',
        ],
        table: {
          headers: ['NPN (TANK_LOW_PIN 32)', 'PNP (TANK_HIGH_PIN 33)', 'Resulting state'],
          rows: [
            { cells: ['LOW', 'any', 'FULL (water_level_ok = true)'] },
            { cells: ['HIGH', 'HIGH', 'MEDIUM (water_level_ok = true)'] },
            { cells: ['HIGH', 'LOW', 'LOW (water_level_ok = false)'] },
            { cells: ['inconsistent', 'inconsistent', 'ERROR (water_level_ok = false)'] },
          ],
        },
        callouts: [
          {
            variant: 'tip',
            title: 'Quick test',
            body: 'During installation, watch `water_level_ok` in MQTT/telemetry while you simulate levels before enabling interlocks.',
          },
        ],
      },
      {
        id: 'four-vs-one',
        title: 'level_1–level_4 vs single sensor',
        accent: 'ph',
        paragraphs: [
          'The Rules UI exposes four discrete levels for project flexibility (probes at different heights).',
          'The current firmware implements one LevelSensor (XKR-25) with FULL, MEDIUM, LOW and ERROR states and publishes water_level_ok boolean.',
        ],
        table: {
          headers: ['UI concept', 'Firmware today', 'Future install'],
          rows: [
            { cells: ['level_4 = empty', 'LOW / ERROR', 'Bottom probe'] },
            { cells: ['level_2 = medium', 'MEDIUM', 'Mid probe'] },
            { cells: ['level_1 = high', 'FULL', 'Top probe'] },
            { cells: ['water_level', 'Logical aggregate', 'Derived or Modbus'] },
          ],
        },
        callouts: [
          {
            variant: 'warning',
            title: 'Mapping required',
            body: 'Until four physical inputs are available, derive logical states from XKR-25 or configure rules using water_level and water_level_ok.',
          },
        ],
      },
      {
        id: 'calibration',
        title: 'Calibration and maintenance',
        accent: 'brand',
        steps: [
          { title: 'pH', body: 'Two points in Calibration; repeat after probe change or extreme solution updates.' },
          { title: 'EC/TDS', body: 'Calibrate using 1413 µS/cm standard (or equivalent) so u(t) and Auto EC stay consistent.' },
          { title: 'Pumps', body: 'Flow calibration (ml/s) per relay — prerequisite for reliable u(t).' },
          { title: 'Level', body: 'Verify physical sensor mounting; continuous ERROR indicates cable/range failure.' },
        ],
      },
    ],
    prev: { href: '/support/controle', label: 'Control Engineering' },
    next: { href: '/processos', label: 'Processes — Start Here' },
  },
};
