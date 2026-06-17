import type { DocsPageContent, DocsNavTree } from '../docs/types';
import type { ProcessosPageSlug } from '../docs/types';

export const processosNavEs: DocsNavTree = {
  sectionTitle: 'Procesos',
  hubHref: '/processos',
  hubLabel: 'Start Here',
  items: [
    { href: '/processos/ciclos-automaticos', label: 'Ciclos Automáticos' },
    { href: '/processos/scripts-sequenciais', label: 'Scripts Secuenciales' },
    { href: '/processos/agendamentos', label: 'Agendamientos' },
  ],
  otherSection: {
    title: 'Support',
    hubHref: '/support',
    hubLabel: 'Start Here',
    items: [
      { href: '/support/arquitetura', label: 'Arquitectura' },
      { href: '/support/hidraulica', label: 'Hidráulica' },
      { href: '/support/regras', label: 'Reglas y Motor' },
      { href: '/support/controle', label: 'Ingeniería de Control' },
      { href: '/support/sensores', label: 'Sensores y Niveles' },
    ],
  },
};

export const processosPagesEs: Record<ProcessosPageSlug, DocsPageContent> = {
  hub: {
    slug: 'hub',
    title: 'Procesos — Start Here',
    subtitle: 'Ejecuciones, schedules y ciclos — cuándo y cómo actúa HydroWave',
    breadcrumb: 'Start Here',
    sections: [
      {
        id: 'what-is-process',
        title: 'Qué es un “proceso” en HydroWave',
        accent: 'brand',
        paragraphs: ['Tres patrones de ejecución automática distintos.'],
        table: {
          headers: ['Tipo', 'Ejemplo', 'Dónde configurar'],
          rows: [
            { cells: ['Bucle cerrado', 'Auto EC / Auto pH', 'Automatización'] },
            { cells: ['Script procedural', 'Drenaje, recarga', 'Script Secuencial'] },
            { cells: ['Schedule temporal', 'Circulación 15 min / 2 h', 'Dispositivos → Schedule'] },
          ],
        },
      },
      {
        id: 'priority-model',
        title: 'Modelo de prioridades',
        subtitle: 'Grid estilo Nuravine adaptado a HydroWave',
        accent: 'wait',
        priorityStack: [
          {
            priority: 1,
            label: 'Tanque — Fill / Changeout / Drain',
            accent: 'brand',
            body: 'Recarga completa, cambio de solución, drenaje. Scripts secuenciales con level_1–level_4. Interrumpen operación normal del tanque.',
            examples: [
              'FILL + DOSE — primera carga con nutrientes',
              'CHANGEOUT 50% — cambio parcial de solución',
              'WHILE level_4 != vacío — drenaje automático',
            ],
          },
          {
            priority: 2,
            label: 'EC — Auto EC + add-back nutricional',
            accent: 'ec',
            body: 'Bucle cerrado: verificación periódica, dosificación proporcional, recirculación inline. ISA-88 en nutrient_dosages.',
            examples: [
              'SP 1333 µS/cm ± tolerancia — banda muerta',
              'Secuencia nutrientes → WAITING 3s → RECIRC',
            ],
          },
          {
            priority: 3,
            label: 'pH — Auto pH dominio H',
            accent: 'ph',
            body: 'Pulsos adaptativos, K aprende post-recirc. Bloqueado durante EC secuencial (G5) en producción.',
            examples: [
              'SP 6.0 ± tolerancia 0.2',
              'DoseReal = A × |ErroH| / K',
            ],
          },
          {
            priority: 4,
            label: 'TIME — pulsos y circulación',
            accent: 'neutral',
            body: 'Reglas SCHEDULE_* y time_interval: circulación, UC Roots cada 72h, luz auxiliar — independiente de PV.',
            examples: [
              'Circulación 15 min cada 2 h',
              'TIME dosing — nutriente por cronómetro',
            ],
          },
        ],
      },
      {
        id: 'lifecycle',
        title: 'Ciclo de vida de ejecución',
        accent: 'ec',
        steps: [
          { title: 'Configuración', body: 'UI → Supabase.' },
          { title: 'Sync', body: 'ESP32 poll ~30 s.' },
          { title: 'Evaluación', body: 'Sensor, timer o error EC/pH.' },
          { title: 'Actuación', body: 'Relé, bomba o nutrientes.' },
          { title: 'Registro', body: 'dosages / rule_executions.' },
        ],
      },
      {
        id: 'grow-cycle-handoff',
        title: 'Ciclo de cultivo completo (dev)',
        accent: 'wait',
        paragraphs: [
          'Para mapear reglas tipo Aurora (Initial Fill, Drain, Changeout, Schedule 12 semanas) al modelo P1–P4 de HydroWave, ver handoff técnico S01 (17/jun/2026) en docs/handoffs/processes/S01_GROW_CYCLE_RULES_17JUN2026.md.',
        ],
      },
    ],
    cards: [
      { href: '/processos/ciclos-automaticos', title: 'Ciclos Automáticos', description: 'Máquinas de estado EC y pH', accent: 'ec' },
      { href: '/processos/scripts-sequenciais', title: 'Scripts Secuenciales', description: 'WHILE/IF, cooldown', accent: 'brand' },
      { href: '/processos/agendamentos', title: 'Agendamientos', description: 'SCHEDULE_*, timezone', accent: 'wait' },
    ],
    next: { href: '/processos/ciclos-automaticos', label: 'Ciclos Automáticos' },
    help: {
      title: '¿Necesitas más ayuda?',
      body: 'Consulta nuestros planes para soporte comercial.',
      emailLabel: 'Email',
      email: 'suporte@hydrowave.com',
      plansLabel: 'Ver planes y servicios',
      plansHref: '/planos',
    },
  },
  'ciclos-automaticos': {
    slug: 'ciclos-automaticos',
    title: 'Ciclos Automáticos',
    subtitle: 'Auto EC y Auto pH — máquinas de estado',
    breadcrumb: 'Ciclos Automáticos',
    sections: [
      {
        id: 'ec-states',
        title: 'Máquina de estados — Auto EC',
        accent: 'ec',
        stateFlow: ['IDLE', 'DOSING', 'WAITING', 'RECIRCULATING', 'IDLE'],
        bullets: [
          'IDLE, DOSING, WAITING ~3 s, RECIRCULATING con tempo_recirculacao.',
          'Serial: 🤖 === CONTROLE AUTOMÁTICO EC === → INICIANDO DOSAGEM SEQUENCIAL → RECIRC.',
        ],
      },
      {
        id: 'ph-states',
        title: 'Máquina de estados — Auto pH',
        accent: 'ph',
        stateFlow: ['PH_IDLE', 'PH_DOSING', 'PH_RECIRCULATING', 'PH_IDLE'],
        bullets: [
          'Pulso limitado por max_pulse_seconds. K actualizado post-recirc.',
          'Serial: CONTROLE AUTOMÁTICO pH → DOSAGEM pH → DESLIGADO → RECIRC → SEQUÊNCIA COMPLETA.',
          'MQTT: ph_operation dosing rem=Ns decreciente; luego recirculating rem=τ.',
        ],
      },
      {
        id: 'poll-vs-loop',
        title: 'Poll vs bucle de control',
        accent: 'wait',
        paragraphs: ['Poll config ~30 s. Evaluación EC/pH en loop() principal.'],
      },
      {
        id: 'ui-tutorial',
        title: 'Tutorial: seguir un ciclo en UI',
        accent: 'brand',
        steps: [
          { title: 'Activar Auto EC', body: 'Automatización → Guardar → Activar.' },
          { title: 'Fuera de banda muerta', body: 'Badge dosificando.' },
          { title: 'Recirculación', body: 'No interrumpir con dosis manual.' },
          { title: 'Auto pH', body: 'Verificar interlock G5.' },
          { title: 'Badges en UI', body: 'Dosificando / Recirculando / Próxima verificación — recirc tiene prioridad sobre flash de relé.' },
          { title: 'Dashboard', body: 'Cards Auto EC/pH en Dashboard reflejan los mismos badges tras cargar auto_enabled — paridad con Automatización.' },
          { title: 'K en Supabase', body: 'Tras recirc pH, confirme k_acid/k_base actualizados en panel (PATCH post-recirc).' },
        ],
      },
    ],
    prev: { href: '/processos', label: 'Start Here' },
    next: { href: '/processos/scripts-sequenciais', label: 'Scripts Secuenciales' },
  },
  'scripts-sequenciais': {
    slug: 'scripts-sequenciais',
    title: 'Scripts Secuenciales',
    subtitle: 'Creación, límites y ejemplos',
    breadcrumb: 'Scripts Secuenciales',
    sections: [
      {
        id: 'lifecycle',
        title: 'Ciclo de vida',
        accent: 'brand',
        paragraphs: [
          'El flujo completo une la UI procedural (Support → Reglas) al JSON persistido. Ver capturas en Support → Reglas.',
        ],
        image: {
          src: '/rulesid.png',
          alt: 'Regla dreno activa en Motor de Decisión con ID y prioridad',
          caption: 'Tras persistir: regla visible con ID único para rastrear rule_executions.',
        },
        steps: [
          { title: 'Crear', body: 'SequentialScriptEditor.' },
          { title: 'Persistir', body: 'decision_rules en Supabase.' },
          { title: 'Ejecutar', body: 'instructions[] con loop_interval_ms.' },
          { title: 'Registrar', body: 'rule_executions.' },
        ],
        callouts: [
          {
            variant: 'warning',
            title: 'Estado de implementación',
            body: 'Executor en ESP32 parcialmente implementado. Probar en bancada.',
          },
        ],
      },
      {
        id: 'criar-script',
        title: 'Crear script en la UI',
        accent: 'wait',
        paragraphs: [
          'Antes del JSON en Supabase, el operador sigue el flujo procedural del modal Nueva Regla.',
        ],
        image: {
          src: '/fluxoprocedural.png',
          alt: 'Flujo procedural del modal Nueva Regla con Nivel 1 igual a Bajo',
          caption: 'Paso 1: definir Condición Principal (ej. Nivel 1 = Bajo) antes del LOOP de drenaje.',
        },
      },
      {
        id: 'limits',
        title: 'Límites de seguridad',
        accent: 'warn',
        bullets: ['cooldown_ms, max_executions_per_hour, max_iterations, priority.'],
      },
      {
        id: 'examples',
        title: 'Ejemplos',
        accent: 'wait',
        table: {
          headers: ['Proceso', 'Patrón', 'Sensor'],
          rows: [
            { cells: ['Drenaje', 'WHILE level_4 != vacío', 'level_4'] },
            { cells: ['Recarga', 'WHILE level_1 != alto', 'level_1'] },
            { cells: ['Add-back', 'IF water_level == bajo', 'water_level'] },
            { cells: ['Circulación', 'relay ON + DELAY + OFF', '—'] },
          ],
        },
      },
    ],
    prev: { href: '/processos/ciclos-automaticos', label: 'Ciclos Automáticos' },
    next: { href: '/processos/agendamentos', label: 'Agendamientos' },
  },
  agendamentos: {
    slug: 'agendamentos',
    title: 'Agendamientos',
    subtitle: 'Schedules, timezone y trigger_type',
    breadcrumb: 'Agendamientos',
    sections: [
      {
        id: 'schedule-rules',
        title: 'Reglas SCHEDULE_*',
        accent: 'brand',
        paragraphs: ['DeviceControlPanel con time_interval, duration, interval_between_executions.'],
      },
      {
        id: 'timezone',
        title: 'Timezone',
        accent: 'wait',
        paragraphs: ['Configuración → zona horaria. Validar tras cambio de región.'],
      },
      {
        id: 'trigger-types',
        title: 'trigger_type',
        accent: 'ec',
        table: {
          headers: ['Tipo', 'Comportamiento'],
          rows: [
            { cells: ['periodic', 'Reevalúa en loop_interval_ms'] },
            { cells: ['on_change', 'Al cambiar sensor'] },
            { cells: ['scheduled', 'Intervalo de tiempo'] },
          ],
        },
      },
      {
        id: 'priority-4-time',
        title: 'Prioridad 4 — pulsos TIME vs recirc inline',
        accent: 'wait',
        paragraphs: [
          'Agendamientos TIME (circulación, UC Roots periódico) corren en paralelo conceptual con P4, pero no deben competir con drenaje P1.',
          'Defina priority baja (20–40) en SCHEDULE_* y priority alta (80+) en scripts de tanque.',
        ],
        callouts: [
          {
            variant: 'tip',
            title: 'No confundir',
            body: 'tempo_recirculacao del Auto EC/pH es dead-time post-dosis (homogeneización). Bomba de circulación 24/7 es regla TIME separada.',
          },
        ],
      },
      {
        id: 'comparison',
        title: 'Comparativo',
        accent: 'ph',
        table: {
          headers: ['Necesidad', 'Mecanismo'],
          rows: [
            { cells: ['Mantener EC', 'Auto EC'] },
            { cells: ['Corregir pH', 'Auto pH'] },
            { cells: ['Vaciar tanque', 'Script WHILE'] },
            { cells: ['Mezcla periódica', 'Schedule time_interval'] },
          ],
        },
      },
    ],
    prev: { href: '/processos/scripts-sequenciais', label: 'Scripts Secuenciales' },
    next: { href: '/support', label: 'Support — Start Here' },
  },
};
