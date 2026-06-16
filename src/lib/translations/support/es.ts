import type { DocsPageContent, DocsNavTree } from '../docs/types';
import type { SupportPageSlug } from '../docs/types';

export const supportNavEs: DocsNavTree = {
  sectionTitle: 'Support',
  hubHref: '/support',
  hubLabel: 'Start Here',
  items: [
    { href: '/support/arquitetura', label: 'Arquitectura' },
    { href: '/support/hidraulica', label: 'Hidráulica' },
    { href: '/support/regras', label: 'Reglas y Motor' },
    { href: '/support/controle', label: 'Ingeniería de Control' },
    { href: '/support/sensores', label: 'Sensores y Niveles' },
  ],
  otherSection: {
    title: 'Procesos',
    hubHref: '/processos',
    hubLabel: 'Start Here',
    items: [
      { href: '/processos/ciclos-automaticos', label: 'Ciclos Automáticos' },
      { href: '/processos/scripts-sequenciais', label: 'Scripts Secuenciales' },
      { href: '/processos/agendamentos', label: 'Agendamientos' },
    ],
  },
};

export const supportPagesEs: Record<SupportPageSlug, DocsPageContent> = {
  hub: {
    slug: 'hub',
    title: 'Support — Start Here',
    subtitle: 'Documentación técnica de HydroWave para integradores y operadores avanzados',
    breadcrumb: 'Start Here',
    sections: [
      {
        id: 'welcome',
        title: 'Bienvenido a la documentación técnica',
        accent: 'brand',
        paragraphs: [
          'Esta sección complementa el menú Información. Mientras Información cubre operación diaria (FAQ, calibración, primeros pasos), Support explica decisiones de ingeniería: hidráulica, motor de reglas, sensores de nivel y bucles EC/pH.',
          'Si cultivas y solo necesitas que el sistema funcione, empieza en Información. Si integras hardware, escribes reglas o necesitas entender el firmware, estás en el lugar correcto.',
        ],
      },
      {
        id: 'layers',
        title: 'Cómo encaja un sistema HydroWave',
        subtitle: 'Tres capas, modelo inspirado en Nuravine adaptado a nuestro stack',
        accent: 'brand',
        layers: [
          {
            title: '1. Edge — ESP32 master + slaves ESP-NOW',
            body: 'El master lee sensores de agua (pH, EC/TDS, nivel), ejecuta Auto EC/pH vía HydroControl y envía comandos a relés locales o slaves (válvulas, bombas peristálticas, recirculación).',
            accent: 'wait',
          },
          {
            title: '2. Sensores y actuadores',
            body: 'Sensores estilo Nuravine adaptados: sonda pH/EC, sensor de nivel XKR-25 (LLENO/MEDIO/BAJO), ambiente (temp/humedad). Actuadores: bombas dosificadoras, válvulas 24V, relés de recarga y drenaje.',
            accent: 'ec',
          },
          {
            title: '3. Cloud — Supabase + UI HydroWave',
            body: 'Telemetría Realtime/MQTT, config remota (setpoints, plan nutricional, reglas), historial de dosificaciones (ISA-88) y panel de automatización.',
            accent: 'ph',
          },
        ],
      },
      {
        id: 'vs-informacao',
        title: 'Support vs Información',
        accent: 'neutral',
        table: {
          headers: ['Tema', 'Información', 'Support'],
          rows: [
            { cells: ['Activar Auto EC', 'Paso a paso operacional', 'Ecuación u(t), banda muerta, ISA-88'] },
            { cells: ['Reglas', 'Crear regla simple', 'Scripts WHILE/IF, 4 niveles, cooldown'] },
            { cells: ['Nivel de agua', 'Verificar sensor online', 'Modelo level_1–4 vs sensor físico'] },
            { cells: ['Drenaje / recarga', '—', 'Procedimientos hidráulicos y scripts'] },
          ],
        },
      },
      {
        id: 'learning-path',
        title: 'Ruta de aprendizaje recomendada',
        subtitle: 'Del stack cloud al bucle cerrado — orden sugerido para integradores',
        accent: 'brand',
        steps: [
          { title: '1. Arquitectura', body: 'Entienda UI → Supabase → ESP32, relay_commands vs decision_rules antes de escribir automatización.' },
          { title: '2. Hidráulica', body: 'Modele drenaje, recarga completa y add-back con scripts y sensores de nivel.' },
          { title: '3. Reglas y Motor', body: 'Cree scripts secuenciales con flujo procedural (Condiciones → Acciones → Config).' },
          { title: '4. Ingeniería de Control', body: 'Active Auto EC/pH, interprete badges y ecuaciones u(t), K y recirculación inline.' },
          { title: '5. Procesos', body: 'Vea cuándo corre cada mecanismo: bucles cerrados, scripts y agendamientos TIME.' },
        ],
      },
      {
        id: 'glossary',
        title: 'Glosario rápido de control',
        accent: 'neutral',
        table: {
          headers: ['Símbolo', 'Significado', 'Dónde configurar'],
          rows: [
            { cells: ['PV', 'Variable de proceso medida (EC, pH)', 'Sensores / hydro_measurements'] },
            { cells: ['SP', 'Setpoint deseado', 'Automatización → EC / pH'] },
            { cells: ['u(t)', 'Dosificación calculada (ml)', 'Firmware ECController / AdaptivePH'] },
            { cells: ['τ', 'Tiempo de pulso o recirculación (s)', 'tempo_recirculacao, max_pulse_seconds'] },
            { cells: ['K', 'Ganancia aprendida del tanque (pH)', 'k_acid / k_base — aprende post-recirc'] },
            { cells: ['A', 'Agresividad por ciclo (0.05–1)', 'ph_config.aggressiveness'] },
            { cells: ['α', 'Velocidad EMA del aprendizaje de K', 'ph_config.gain_alpha'] },
          ],
        },
      },
    ],
    cards: [
      { href: '/support/arquitetura', title: 'Arquitectura', description: 'Flujo UI → Supabase → ESP32, relay_commands vs decision_rules', accent: 'brand' },
      { href: '/support/hidraulica', title: 'Hidráulica', description: 'Drenaje, recarga completa, add-back, recirculación inline', accent: 'wait' },
      { href: '/support/regras', title: 'Reglas y Motor', description: 'Decision Engine, scripts secuenciales, parámetros de ejecución', accent: 'brand' },
      { href: '/support/controle', title: 'Ingeniería de Control', description: 'Auto EC, dominio H del pH, pulsos e interlocks', accent: 'ec' },
      { href: '/support/sensores', title: 'Sensores y Niveles', description: 'Transmisor pH/EC/T° + sensor de nivel sin contacto (XKR-25), QC y mapeo', accent: 'ph' },
      { href: '/processos', title: 'Procesos', description: 'Ciclos, schedules y ejecuciones', accent: 'wait' },
    ],
    next: { href: '/support/arquitetura', label: 'Arquitectura' },
    help: {
      title: '¿Necesitas más ayuda?',
      body: 'Para soporte comercial, instalación asistida o capacitación técnica, consulta nuestros planes.',
      emailLabel: 'Email',
      email: 'suporte@hydrowave.com',
      plansLabel: 'Ver planes y servicios',
      plansHref: '/planos',
    },
  },
  arquitetura: {
    slug: 'arquitetura',
    title: 'Arquitectura del Sistema',
    subtitle: 'Flujo de datos y comandos entre cloud, API y firmware',
    breadcrumb: 'Arquitectura',
    sections: [
      {
        id: 'overview',
        title: 'Visión general',
        accent: 'brand',
        paragraphs: [
          'HydroWave separa tres caminos: telemetría (sensores → Supabase → UI), configuración (UI → RPC/API → NVS ESP32) y actuación (manual, Auto EC/pH o Decision Engine → relés).',
          'HydroControl concentra bucles EC/pH. DecisionEngine evalúa reglas discretas. Ambos coexisten con mutex e interlocks.',
        ],
      },
      {
        id: 'data-flow',
        title: 'Flujo de datos',
        accent: 'wait',
        steps: [
          { title: 'UI / Automatización', body: 'Operador configura setpoints, plan nutricional o reglas.' },
          { title: 'Supabase', body: 'Tablas: hydro_measurements, relay_master, ec/ph_controller_config, decision_rules, relay_commands, dosages.' },
          { title: 'ESP32 — HydroSystemCore', body: 'Poll de config (~30 s), lectura de sensores, sync operation_state.' },
          { title: 'HydroControl + DecisionEngine', body: 'Bucles EC/pH en loop(); reglas con cooldown y límites horarios.' },
        ],
      },
      {
        id: 'relay-vs-rules',
        title: 'relay_commands vs decision_rules',
        accent: 'warn',
        paragraphs: [
          'relay_commands: acciones inmediatas o manuales. Alta prioridad operacional.',
          'decision_rules: automatización persistente con cooldown y max_executions_per_hour.',
        ],
        callouts: [
          {
            variant: 'info',
            title: 'Dos motores, un hardware',
            body: 'Auto EC/pH no pasan por Decision Engine. Reglas hidráulicas usan Decision Engine cuando está habilitado.',
          },
        ],
      },
      {
        id: 'mqtt',
        title: 'MQTT y Realtime',
        accent: 'brand',
        paragraphs: [
          'El bridge MQTT publica telemetría y operation_state para badges Dosificando / Recirculando.',
          'Comandos híbridos: HTTPS para config persistente, MQTT para baja latencia.',
        ],
      },
    ],
    prev: { href: '/support', label: 'Start Here' },
    next: { href: '/support/hidraulica', label: 'Hidráulica' },
  },
  hidraulica: {
    slug: 'hidraulica',
    title: 'Hidráulica y Procesos de Tanque',
    subtitle: 'Drenaje, recarga completa, add-back y recirculación como reglas',
    breadcrumb: 'Hidráulica',
    sections: [
      {
        id: 'intro',
        title: 'Hidráulica como automatización',
        accent: 'wait',
        paragraphs: [
          'Procesos hidráulicos son scripts secuenciales que combinan sensores de nivel y relés de válvula/bomba.',
          'Permite adaptar lógica al layout físico sin recompilar firmware.',
        ],
      },
      {
        id: 'drain',
        title: 'Drenaje automático',
        accent: 'brand',
        paragraphs: ['Mantener válvula de salida abierta mientras el nivel no indique vacío.'],
        code: `WHILE level_4 != "vazio" DO\n  relé_válvula = ON\nEND WHILE\n\nIF level_4 == "vazio" THEN\n  relé_válvula = OFF\n  RETURN\nEND IF`,
        steps: [
          { title: 'Mapear level_4', body: 'Sonda más baja = vacío cuando el tanque se vació.' },
          { title: 'Asociar relé', body: 'Válvula motorizada en slave ESP-NOW o relé local.' },
          { title: 'loop_interval_ms', body: '1000–5000 ms entre evaluaciones del WHILE.' },
        ],
      },
      {
        id: 'full-recharge',
        title: 'Recarga completa',
        accent: 'ec',
        paragraphs: ['Llenar hasta level_1 = alto tras drenaje o cambio de solución.'],
        code: `WHILE level_1 != "alto" DO\n  relé_recarga = ON\nEND WHILE`,
        callouts: [
          {
            variant: 'warning',
            title: 'Patrón de diseño',
            body: 'Recarga completa documentada como contrato de script. Validar mapeo GPIO/slave antes de producción.',
          },
        ],
      },
      {
        id: 'add-back',
        title: 'Add-back (reposición parcial)',
        accent: 'ph',
        paragraphs: [
          'IF water_level == baixo → recarga ON hasta medio. Coordinar con Auto EC tras add-back significativo.',
        ],
      },
      {
        id: 'add-back-vs-full',
        title: 'Add-back vs Recarga completa',
        accent: 'ec',
        paragraphs: [
          'Elegir el procedimiento correcto evita cambiar nutriente innecesariamente u operar con volumen erróneo. Recarga completa resetea el tanque; add-back repone solo lo evaporado.',
        ],
        table: {
          headers: ['Criterio', 'Add-back', 'Recarga completa'],
          rows: [
            { cells: ['Cuándo usar', 'Nivel bajo, solución aún válida', 'Tras drenaje o cambio de receta'] },
            { cells: ['Volumen', 'Parcial hasta medio/alto', 'Hasta level_1 = alto'] },
            { cells: ['Impacto EC/pH', 'Dilución leve — Auto EC corrige', 'Requiere FILL+DOSE o Auto EC tras recirc'] },
            { cells: ['Mecanismo', 'IF water_level + relé recarga', 'WHILE level_1 != alto'] },
            { cells: ['Prioridad', 'P1 — script tanque', 'P1 — tras drenaje'] },
          ],
        },
      },
      {
        id: 'tank-tutorial',
        title: 'Tutorial: drenaje → recarga → Auto EC',
        accent: 'brand',
        steps: [
          { title: 'Drenaje', body: 'Ejecute script WHILE level_4 != vacío. Serial: válvula ON hasta vacío. priority ≥ 80 en Motor de Decisión.' },
          { title: 'Recarga completa', body: 'WHILE level_1 != alto con bomba de agua limpia o solución preparada.' },
          { title: 'Recirculación inline', body: 'Espere tempo_recirculacao (homogeneización) antes de confiar en lecturas EC/pH.' },
          { title: 'Activar Auto EC', body: 'Automatización → Control Nutricional → auto_enabled. Observe ec_operation_state: dosing → recirculating → idle.' },
        ],
      },
      {
        id: 'inline-recirc',
        title: 'Recirculación inline vs tempo_recirculacao',
        accent: 'wait',
        paragraphs: [
          'Recirculación inline en dosificación automática = dead-time tras cada pulso (tempo_recirculacao en segundos). El firmware espera homogeneización antes de re-medir pH/EC.',
          'Recirculación hidráulica continua (bomba siempre ON) es regla de relé o schedule separada — no confundir con el timer post-dosis del controlador.',
          'En badges UI: “Aguardando recirculación” se refiere al dead-time del controlador (P2/P3), no a la bomba de circulación TIME (P4).',
        ],
      },
    ],
    prev: { href: '/support/arquitetura', label: 'Arquitectura' },
    next: { href: '/support/regras', label: 'Reglas y Motor' },
  },
  regras: {
    slug: 'regras',
    title: 'Reglas y Motor de Decisión',
    subtitle: 'Decision Engine, scripts secuenciales y creación de reglas',
    breadcrumb: 'Reglas y Motor',
    sections: [
      {
        id: 'types',
        title: 'Tipos de regla',
        accent: 'brand',
        bullets: [
          'Regla compuesta: conditions[] + actions[].',
          'Script secuencial: WHILE, IF, relay_action, DELAY, RETURN.',
          'Schedule: sensor time_interval.',
        ],
      },
      {
        id: 'fluxo-procedural',
        title: 'Flujo procedural en la UI (de arriba a abajo)',
        subtitle: 'Cómo el modal Nueva Regla organiza la lógica antes del JSON en Supabase',
        accent: 'brand',
        paragraphs: [
          'Al crear una regla en el Motor de Decisión, la UI sigue: condiciones → acciones → eventos encadenados → config avanzada.',
          'Ejemplo: función “Drenaje Automático” con Condición Principal Nivel 1 = Bajo.',
        ],
        image: {
          src: '/fluxoprocedural.png',
          alt: 'Modal Nueva Regla con flujo Condiciones, Acciones, Eventos Encadenados y Config Avanzada',
          caption:
            'Automatización → + Nueva Regla: flujo Condiciones → Acciones → Eventos Encadenados → Config Avanzada.',
        },
        bullets: [
          'Condiciones — level_1–level_4, water_level, TDS, temperatura.',
          'Acciones — relay_action cuando se cumple la condición.',
          'Eventos encadenados — secuencia adicional.',
          'Config avanzada — prioridad, cooldown, loop_interval_ms.',
        ],
      },
      {
        id: 'motor-decisao-painel',
        title: 'Panel Motor de Decisión e ID de regla',
        subtitle: 'Lista de scripts activos, prioridad e identificador único',
        accent: 'ph',
        paragraphs: [
          'Tras guardar, la regla aparece en Automatización → Motor de Decisión con preview IF/LOOP, prioridad e ID (ej. RULE_1700979324226).',
          'La regla “dreno” muestra LOOP mientras water_level != vacío.',
        ],
        image: {
          src: '/rulesid.png',
          alt: 'Panel Motor de Decisión con regla dreno activa e ID RULE_1700979324226',
          caption:
            'Reglas de Script Secuencial: card activo con preview, prioridad 69 e ID copiable.',
        },
      },
      {
        id: 'instructions',
        title: 'Instrucciones del script',
        accent: 'wait',
        table: {
          headers: ['Instrucción', 'Función'],
          rows: [
            { cells: ['WHILE', 'Bucle mientras condición verdadera'] },
            { cells: ['IF / ELSE', 'Ramificación condicional'] },
            { cells: ['relay_action', 'ON/OFF en relé master o slave'] },
            { cells: ['DELAY', 'Pausa entre pasos (ms)'] },
            { cells: ['RETURN', 'Termina ejecución del script'] },
          ],
        },
      },
      {
        id: 'params',
        title: 'Parámetros de ejecución',
        accent: 'ec',
        bullets: [
          'loop_interval_ms, cooldown_ms, max_executions_per_hour, priority, max_iterations.',
        ],
      },
      {
        id: 'priority-numeric',
        title: 'Prioridad numérica (0–100)',
        accent: 'warn',
        paragraphs: [
          'Cuando varias decision_rules compiten, el ESP32 ordena por priority DESC (mayor gana). Tanque y seguridad deben quedar por encima de circulación TIME.',
        ],
        table: {
          headers: ['Rango sugerido', 'Tipo de regla', 'Ejemplo'],
          rows: [
            { cells: ['80–100', 'Tanque / drenaje / recarga', 'Script WHILE drenaje'] },
            { cells: ['50–79', 'Scripts operacionales', 'Add-back, mezcla forzada'] },
            { cells: ['20–49', 'Circulación / TIME', 'SCHEDULE circulación 15 min'] },
            { cells: ['0–19', 'Auxiliar / luz', 'Luz UV, aireador nocturno'] },
          ],
        },
        callouts: [
          {
            variant: 'info',
            title: 'Auto EC/pH',
            body: 'Bucles cerrados EC/pH corren en HydroControl — no usan priority de decision_rules. Interlock G5 bloquea pH durante EC secuencial en producción.',
          },
        ],
      },
      {
        id: 'four-levels',
        title: 'Sensores de nivel (4 niveles)',
        accent: 'ph',
        paragraphs: ['UI expone level_1 a level_4 y water_level (vazio, baixo, medio, alto).'],
        callouts: [
          {
            variant: 'warning',
            title: 'Estado de implementación',
            body: 'Decision Engine en ESP32 ~35% (checkpoint jun/2026). Validar en dispositivo antes de producción crítica.',
          },
        ],
      },
      {
        id: 'ui',
        title: 'Configuración en UI',
        accent: 'brand',
        steps: [
          { title: 'Automatización → Reglas', body: 'CreateRuleModal para reglas compuestas.' },
          { title: 'Editor Script Secuencial', body: 'WHILE/IF y parámetros de loop.' },
          { title: 'Guardar y habilitar', body: 'Persiste en decision_rules.' },
        ],
      },
    ],
    prev: { href: '/support/hidraulica', label: 'Hidráulica' },
    next: { href: '/support/controle', label: 'Ingeniería de Control' },
  },
  controle: {
    slug: 'controle',
    title: 'Ingeniería de Control',
    subtitle: 'Auto EC, dominio H del pH, pulsos e interlocks',
    breadcrumb: 'Ingeniería de Control',
    sections: [
      {
        id: 'ec-loop',
        title: 'Bucle Auto EC',
        accent: 'ec',
        paragraphs: [
          'PV: EC medida. SP: ec_setpoint. Dosificación si |error| > tolerancia. u(t) vía ECController.',
        ],
        stateFlow: ['IDLE', 'DOSING', 'WAITING', 'RECIRCULATING', 'IDLE'],
        bullets: [
          'Eventos en nutrient_dosages (ISA-88). Estado en ec_operation_state.',
          'k = base_dose/total_ml y Kp son estáticos (config Supabase) — sin aprendizaje online de K_ec (backlog futuro).',
        ],
      },
      {
        id: 'ph-loop',
        title: 'Bucle Auto pH — dominio H',
        accent: 'ph',
        paragraphs: [
          'H = 10^(−pH). u(t) = A × V × s × |e|. K aprende post-recirculación.',
        ],
        code: `τ = u(t) / q\nH = 10^(-pH)\nErroH = H - H_setpoint`,
        stateFlow: ['PH_IDLE', 'PH_DOSING', 'PH_RECIRCULATING', 'PH_IDLE'],
      },
      {
        id: 'k-vs-a-alpha',
        title: 'K, A y α — roles distintos',
        accent: 'ph',
        table: {
          headers: ['Parámetro', 'Rol en el bucle', 'Persistencia'],
          rows: [
            { cells: ['K (k_acid / k_base)', 'Modelo de planta — ml por unidad de |ErroH|', 'NVS + PATCH Supabase post-recirc'] },
            { cells: ['A (aggressiveness)', 'Fracción de corrección ideal por pulso: DoseReal = A × |ErroH|/K', 'ph_config — operador'] },
            { cells: ['α (gain_alpha)', 'Velocidad EMA del aprendizaje de K', 'ph_config — integrador'] },
          ],
        },
      },
      {
        id: 'k-gains-loop',
        title: 'Bucle cerrado de K (pH)',
        accent: 'brand',
        paragraphs: [
          'Cada ciclo: medir → dosar con K+A → recirc τ → medir PV2 → updateGainAfterDose → saveToNVS → PATCH k_acid/k_base.',
          'ph_dosages (relé OFF) registra historial; K aprendido solo persiste en Supabase tras recirculación completa — no en evento ph_dose.',
        ],
        stateFlow: ['checkAutoPH', 'PH_DOSING', 'ph_dose', 'PH_RECIRCULATING', 'K learn', 'PH_IDLE'],
        bullets: [
          'Serial: 💾 [PH K] PATCH k_acid/k_base post-recirc tras SECUENCIA pH COMPLETA.',
          'Commissioning: primeros 3 ciclos limitan A ≤ 0.3 aunque operador defina A=1.0.',
          'minDeltaPh ≥ 0.03 evita aprendizaje sin movimiento observable del pH.',
        ],
      },
      {
        id: 'pulses',
        title: 'Pulsos y recirculación',
        accent: 'wait',
        bullets: ['max_pulse_seconds, tempo_recirculacao, badges Recirculando prioritarios.'],
      },
      {
        id: 'dashboard-badges',
        title: 'Badges Dashboard vs Automatización',
        accent: 'brand',
        paragraphs: [
          'Dashboard y Automatización usan los mismos hooks y relay_master (ph_operation_* / ec_operation_*) vía Realtime + poll 5 s.',
          'El Dashboard solo refleja relay_master cuando auto_enabled=true en config. Mientras carga, badges en loading — evita recirculación fantasma.',
          'Automatización es la referencia operativa; Dashboard es espejo read-only alineado tras cargar la config.',
        ],
      },
      {
        id: 'interlocks',
        title: 'Interlocks EC ↔ pH',
        accent: 'warn',
        paragraphs: ['G5: pH bloqueado durante EC secuencial. water_level_ok requerido.'],
        callouts: [
          { variant: 'tip', title: 'Commissioning pH', body: 'A conservador, τ alto. K converge tras 3–5 ciclos.' },
        ],
      },
    ],
    prev: { href: '/support/regras', label: 'Reglas y Motor' },
    next: { href: '/support/sensores', label: 'Sensores y Niveles' },
  },
  sensores: {
    slug: 'sensores',
    title: 'Sensores y Niveles',
    subtitle: 'Transmisor pH/EC/T° + sensor de nivel sin contacto (XKR-25) — QC y mapeo',
    breadcrumb: 'Sensores y Niveles',
    sections: [
      {
        id: 'overview',
        title: 'Visión general de los sensores',
        accent: 'brand',
        paragraphs: [
          'Los transmisores y sondas entran al sistema por dos caminos: (1) lecturas analógicas/1-wire (pH, EC/TDS y temperatura) y (2) lecturas digitales del sensor de nivel XKR-25 (sin contacto).',
          'En el firmware actual, las señales del transmisor (cuando se configura como 0–5 V analógico) se convierten en `ph`, `tds` y `temperature` dentro de `hydro_measurements`; el XKR-25 se normaliza a `water_level_ok` para interlocks y reglas.',
          'Esta documentación se centra en “qué es”, “por qué importa”, “dónde configurarlo” y “qué observar” en serial/MQTT para cerrar el circuito sin suposiciones.',
        ],
      },
      {
        id: 'transmitter-aliexpress',
        title: 'Transmisor AliExpress (pH / EC / Temperatura)',
        accent: 'ec',
        paragraphs: [
          'La documentación asume el caso más común: un transmisor 3-en-1 con salida analógica 0–5 V.',
          'Hoy el firmware lee: pH → `PH_PIN 35` y EC/TDS → `TDS_PIN 34`.',
          'Para compensación de TDS/EC, el firmware usa DS18B20 en `TEMP_PIN 4` (la temperatura del módulo del transmisor no reemplaza esta lectura).',
        ],
        sensorCards: [
          {
            badge: 'TX',
            title: 'Módulo 3-en-1',
            accent: 'brand',
            intro: 'Usa este card como “guía de cableado”: entiende el canal, la entrada del ESP32 y lo que la UI publica.',
            subsections: [
              {
                title: 'pH',
                body: 'Salida analógica del transmisor → `PH_PIN 35` (ADC). La conversión usa un modelo lineal calibrado por dos puntos.',
                bullets: ['Calibración: pH 7 / pH 4 (por defecto).', 'QC ocurre antes del loop de control.'],
              },
              {
                title: 'EC/TDS',
                body: 'Salida analógica del transmisor → `TDS_PIN 34` (ADC). Firmware usa mediana (30 muestras) y compensación por temperatura.',
                bullets: ['Lectura confiable antes de Auto EC.', 'Chequeos de plausibilidad en el pipeline de `hydro_measurements`.'],
              },
              {
                title: 'Temperatura',
                body: 'Hoy, la compensación usa DS18B20 en `TEMP_PIN 4`.',
                bullets: ['MQTT publica `temperature` vía DS18B20.', 'El canal de temperatura del transmisor es alternativa futura (no reemplaza hoy).'],
              },
            ],
          },
        ],
      },
      {
        id: 'transmitter-ph',
        title: 'Canal pH (sonda de vidrio)',
        accent: 'ph',
        sensorCards: [
          {
            badge: 'pH',
            title: 'pH en tensión analógica',
            accent: 'ph',
            subsections: [
              {
                title: 'Qué es',
                body: 'La sonda de pH de vidrio convierte el pH del líquido en una tensión eléctrica. El firmware lee esa tensión en `PH_PIN 35` y la convierte a pH con un modelo lineal.',
              },
              {
                title: 'Por qué importa',
                body: 'Sin calibración, slope/offset deriva y termina en correcciones químicas innecesarias. Con dos puntos, anclas el modelo a tu líquido e instalación.',
                bullets: ['por defecto: pH 7 y pH 4.', 'QC se aplica antes de acciones del control.'],
              },
              {
                title: 'Dónde configurarlo en la UI',
                steps: [
                  { title: 'Calibración → pH', body: 'Usa 2 puntos (pH 7 y pH 4). Repetir tras cambio de sonda o solución.' },
                ],
              },
              {
                title: 'Qué ver en serial/MQTT',
                bullets: ['`hydro_measurements.ph` refleja la lectura convertida.', 'Cuando Auto pH está activo: badges y logs siguen `ph_operation_state` (DOSING/RECIRCULATING).'],
              },
            ],
          },
        ],
      },
      {
        id: 'transmitter-ec',
        title: 'Canal EC/TDS',
        accent: 'ec',
        sensorCards: [
          {
            badge: 'EC/TDS',
            title: 'EC vía TDSReaderSerial',
            accent: 'ec',
            subsections: [
              {
                title: 'Qué es',
                body: 'El firmware lee la salida del transmisor en `TDS_PIN 34` y usa `TDSReaderSerial` para reducir ruido (mediana de muestras) y compensar con temperatura del DS18B20.',
              },
              {
                title: 'Calibración',
                body: 'Ajusta con una solución patrón y mantén consistente el factor de calibración.',
                bullets: ['Patrón recomendado: solución 1413 µS/cm.', 'Objetivo: PV del Auto EC represente EC/TDS real.'],
              },
              {
                title: 'Impacto en Auto EC',
                body: 'El bucle cerrado Auto EC usa PV (EC/TDS) y setpoint `ec_setpoint` con banda muerta. Tras dosificar, la UI sigue el timing de recirculación inline antes de reevaluar.',
              },
              {
                title: 'Qué ver en serial/MQTT',
                bullets: ['`hydro_measurements.tds` y/o EC derivada.', 'Cuando Auto EC está activo: `ec_operation_state` alterna entre dosing/recirculación.'],
              },
            ],
          },
        ],
      },
      {
        id: 'transmitter-temperature',
        title: 'Temperatura (compensación de lecturas)',
        accent: 'wait',
        callouts: [
          {
            variant: 'warning',
            title: 'Temperatura del transmisor',
            body: 'En el firmware actual, la compensación de TDS/EC usa DS18B20 en `TEMP_PIN 4`. Si tu transmisor también entrega °C, este canal aún no reemplaza DS18B20.',
          },
        ],
        sensorCards: [
          {
            badge: '°C',
            title: 'DS18B20 en la solución',
            accent: 'wait',
            subsections: [
              {
                title: 'Qué es',
                body: 'La temperatura del líquido se obtiene con DS18B20 en `TEMP_PIN 4` (OneWire) y se usa para los cálculos de TDS/EC.',
              },
              {
                title: 'Dónde montarlo',
                body: 'Instálalo sumergido y protegido contra burbujas y contacto con partes eléctricas. Evita turbulencia que genera lecturas inestables.',
              },
              {
                title: 'Qué ves en MQTT',
                bullets: ['`hydro_measurements.temperature` aparece en la UI y en logs.', 'La temperatura afecta plausibilidad y el PV usado por Auto EC.'],
              },
            ],
          },
        ],
      },
      {
        id: 'level-contactless',
        title: 'Sensor de nivel sin contacto (XKR-25)',
        accent: 'brand',
        sensorCards: [
          {
            badge: 'Nivel',
            title: 'XKR-25 capacitivo (sin contacto)',
            accent: 'wait',
            subsections: [
              {
                title: 'Montaje',
                body: 'Fija el XKR-25 en la pared del tanque (lado externo cuando aplique), manteniendo distancia segura a la superficie del líquido y evitando bolsillos de aire.',
              },
              {
                title: 'Cableado (NPN/PNP)',
                body: 'El firmware usa dos entradas digitales: `TANK_LOW_PIN 32` (NPN) y `TANK_HIGH_PIN 33` (PNP).',
                bullets: ['NPN detecta cuando la entrada está en HIGH (convención del firmware).', 'PNP detecta cuando la entrada está en LOW (convención del firmware).'],
              },
              {
                title: 'Estados',
                body: 'El firmware combina NPN/PNP y normaliza a CHEIO / MÉDIO / BAIXO / ERRO y publica `water_level_ok`.',
                bullets: ['CHEIO y MÉDIO → `water_level_ok=true`.', 'BAIXO y ERRO → `water_level_ok=false` (interlocks).'],
              },
            ],
          },
        ],
      },
      {
        id: 'level-xkr25-logic',
        title: 'Lógica NPN/PNP → water_level_ok',
        accent: 'warn',
        paragraphs: [
          'Este es el mapeo “real” usado por `LevelSensor` (XKR-25). El Decision Engine y reglas dependen de `water_level_ok` para permitir o bloquear acciones.',
        ],
        table: {
          headers: ['NPN (TANK_LOW_PIN 32)', 'PNP (TANK_HIGH_PIN 33)', 'Estado resultante'],
          rows: [
            { cells: ['LOW', 'cualquiera', 'CHEIO (water_level_ok = true)'] },
            { cells: ['HIGH', 'HIGH', 'MÉDIO (water_level_ok = true)'] },
            { cells: ['HIGH', 'LOW', 'BAIXO (water_level_ok = false)'] },
            { cells: ['inconsistente', 'inconsistente', 'ERRO (water_level_ok = false)'] },
          ],
        },
        callouts: [
          {
            variant: 'tip',
            title: 'Prueba rápida',
            body: 'Durante la instalación, observa `water_level_ok` en MQTT/telemetría mientras simulas niveles (CHEIO/MÉDIO/BAIXO) antes de confiar en interlocks.',
          },
        ],
      },
      {
        id: 'four-vs-one',
        title: 'level_1–level_4 vs sensor único',
        accent: 'ph',
        paragraphs: [
          'La UI de reglas expone cuatro niveles discretos para flexibilidad de proyecto (sondas a distintas alturas).',
          'El firmware actual implementa un LevelSensor (XKR-25) con estados CHEIO, MÉDIO, BAIXO y ERRO, publicando water_level_ok booleano.',
        ],
        table: {
          headers: ['Concepto UI', 'Firmware hoy', 'Instalación futura'],
          rows: [
            { cells: ['level_4 = vacío', 'BAIXO / ERRO', 'Sonda inferior'] },
            { cells: ['level_2 = medio', 'MÉDIO', 'Sonda intermedia'] },
            { cells: ['level_1 = alto', 'CHEIO', 'Sonda superior'] },
            { cells: ['water_level', 'Agregado lógico', 'Derivado o Modbus'] },
          ],
        },
        callouts: [
          {
            variant: 'warning',
            title: 'Mapeo necesario',
            body: 'Hasta que existan cuatro entradas físicas disponibles, deriva estados lógicos desde el XKR-25 o configura reglas usando water_level y water_level_ok.',
          },
        ],
      },
      {
        id: 'calibration',
        title: 'Calibración y mantenimiento',
        accent: 'brand',
        steps: [
          { title: 'pH', body: 'Dos puntos en Calibragem; repetir tras cambio de sonda o solución.' },
          { title: 'EC/TDS', body: 'Calibra con solución 1413 µS/cm (o equivalente) para que u(t) y Auto EC sean coherentes.' },
          { title: 'Bombas', body: 'Calibración de caudal (ml/s) por relé — requisito previo para u(t) confiable.' },
          { title: 'Nivel', body: 'Verificar el montaje físico del sensor; ERRO continuo indica fallo de cable/rango.' },
        ],
      },
    ],
    prev: { href: '/support/controle', label: 'Ingeniería de Control' },
    next: { href: '/processos', label: 'Procesos — Start Here' },
  },
};
