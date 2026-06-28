import type { DocsPageContent, DocsNavTree } from '../docs/types';
import type { ProcessosPageSlug } from '../docs/types';

export const processosNavPt: DocsNavTree = {
  sectionTitle: 'Processos',
  hubHref: '/processos',
  hubLabel: 'Start Here',
  items: [
    { href: '/processos/ciclos-automaticos', label: 'Ciclos Automáticos' },
    { href: '/processos/scripts-sequenciais', label: 'Scripts Sequenciais' },
    { href: '/processos/agendamentos', label: 'Agendamentos' },
  ],
  otherSection: {
    title: 'Support',
    hubHref: '/support',
    hubLabel: 'Start Here',
    items: [
      { href: '/support/arquitetura', label: 'Arquitetura' },
      { href: '/support/hidraulica', label: 'Hidráulica' },
      { href: '/support/regras', label: 'Regras e Motor' },
      { href: '/support/controle', label: 'Engenharia de Controle' },
      { href: '/support/sensores', label: 'Sensores e Níveis' },
    ],
  },
};

export const processosPagesPt: Record<ProcessosPageSlug, DocsPageContent> = {
  hub: {
    slug: 'hub',
    title: 'Processos — Start Here',
    subtitle: 'Execuções, schedules e ciclos — quando e como o HydroWave age',
    breadcrumb: 'Start Here',
    sections: [
      {
        id: 'what-is-process',
        title: 'O que é um “processo” no HydroWave',
        accent: 'brand',
        paragraphs: [
          'Usamos “processo” para três padrões distintos de execução automática. Saber qual está ativo evita confundir countdown de EC com timer de relé ou loop de dreno.',
        ],
        table: {
          headers: ['Tipo', 'Exemplo', 'Onde configurar'],
          rows: [
            { cells: ['Ciclo fechado', 'Auto EC / Auto pH', 'Automação → Controle Nutricional / pH'] },
            { cells: ['Script procedural', 'Dreno, recarga', 'Automação → Script Sequencial'] },
            { cells: ['Schedule temporal', 'Circulação 15 min / 2 h', 'Dispositivos → Schedule de relé'] },
          ],
        },
      },
      {
        id: 'priority-model',
        title: 'Modelo de prioridades (Schedule)',
        subtitle: 'Inspirado em grids tipo Nuravine — adaptado ao HydroWave',
        accent: 'wait',
        priorityStack: [
          {
            priority: 1,
            label: 'Tanque — Fill / Changeout / Drain',
            accent: 'brand',
            body: 'Recarga completa, troca de solução, dreno. Scripts sequenciais com level_1–level_4. Interrompem operação normal do tanque.',
            examples: [
              'FILL + DOSE — primeira carga com nutrientes',
              'CHANGEOUT 50% — troca parcial de solução',
              'WHILE level_4 != vazio — dreno automático',
            ],
          },
          {
            priority: 2,
            label: 'EC — Auto EC + add-back nutricional',
            accent: 'ec',
            body: 'Loop fechado: verificação periódica, dosagem proporcional, recirculação inline. ISA-88 em nutrient_dosages.',
            examples: [
              'SP 1333 µS/cm ± tolerância — banda morta',
              'Sequência nutrientes → WAITING 3s → RECIRC',
            ],
          },
          {
            priority: 3,
            label: 'pH — Auto pH domínio H',
            accent: 'ph',
            body: 'Pulsos adaptativos, K aprende pós-recirc. Bloqueado durante EC sequencial (G5) em produção.',
            examples: [
              'SP 6.0 ± tolerância 0.2',
              'DoseReal = A × |ErroH| / K',
            ],
          },
          {
            priority: 4,
            label: 'TIME — pulsos e circulação',
            accent: 'neutral',
            body: 'Regras SCHEDULE_* e time_interval: circulação, UC Roots a cada 72h, luz auxiliar — independente de PV.',
            examples: [
              'Circulação 15 min a cada 2 h',
              'TIME dosing — nutriente por cronômetro',
            ],
          },
        ],
      },
      {
        id: 'lifecycle',
        title: 'Ciclo de vida de uma execução',
        accent: 'ec',
        steps: [
          { title: 'Configuração', body: 'Operador salva parâmetros ou regra na UI → Supabase.' },
          { title: 'Sync', body: 'ESP32 recebe config no poll (~30 s) ou via comando imediato.' },
          { title: 'Avaliação', body: 'Condição satisfeita (sensor, timer ou erro EC/pH).' },
          { title: 'Atuação', body: 'Relé, bomba ou sequência de nutrientes.' },
          { title: 'Registro', body: 'nutrient_dosages / ph_dosages / rule_executions para auditoria.' },
        ],
      },
    ],
    cards: [
      { href: '/processos/ciclos-automaticos', title: 'Ciclos Automáticos', description: 'Máquinas de estado EC e pH, badges e poll de config', accent: 'ec' },
      { href: '/processos/scripts-sequenciais', title: 'Scripts Sequenciais', description: 'WHILE/IF, cooldown, rule_executions', accent: 'brand' },
      { href: '/processos/agendamentos', title: 'Agendamentos', description: 'SCHEDULE_*, timezone, trigger_type', accent: 'wait' },
      { href: '/processos/timeline-cultivo', title: 'Timeline de cultivo — preview', description: 'EC/pH por semana, P1–P4 e simulação (mock)', accent: 'warn' },
    ],
    next: { href: '/processos/ciclos-automaticos', label: 'Ciclos Automáticos' },
    help: {
      title: 'Precisa de mais ajuda?',
      body: 'Para suporte comercial ou treinamento em automação avançada, consulte nossos planos.',
      emailLabel: 'Email',
      email: 'suporte@hydrowave.com',
      plansLabel: 'Ver planos e serviços',
      plansHref: '/planos',
    },
  },

  'ciclos-automaticos': {
    slug: 'ciclos-automaticos',
    title: 'Ciclos Automáticos',
    subtitle: 'Auto EC e Auto pH — máquinas de estado e monitoramento na UI',
    breadcrumb: 'Ciclos Automáticos',
    sections: [
      {
        id: 'ec-states',
        title: 'Máquina de estados — Auto EC',
        accent: 'ec',
        stateFlow: ['IDLE', 'DOSING', 'WAITING', 'RECIRCULATING', 'IDLE'],
        bullets: [
          'IDLE: aguarda intervalo entre verificações; compara PV com SP ± tolerância.',
          'DOSING: bombas peristálticas sequenciais conforme plano nutricional.',
          'WAITING: pausa ~3 s entre nutrientes (mistura segura).',
          'RECIRCULATING: tempo_recirculacao antes de nova leitura.',
          'Serial: 🤖 === CONTROLE AUTOMÁTICO EC === → INICIANDO DOSAGEM SEQUENCIAL → RECIRC.',
        ],
      },
      {
        id: 'ph-states',
        title: 'Máquina de estados — Auto pH',
        accent: 'ph',
        stateFlow: ['PH_IDLE', 'PH_DOSING', 'PH_RECIRCULATING', 'PH_IDLE'],
        bullets: [
          'PH_DOSING: pulso ácido/base limitado por max_pulse_seconds.',
          'PH_RECIRCULATING: τ = u(t)/q; K atualizado ao final.',
          'Badge “Recirculando” permanece até fim do dead-time.',
          'Serial: CONTROLE AUTOMÁTICO pH → DOSAGEM pH → DESLIGADO → RECIRC → SEQUÊNCIA COMPLETA.',
          'MQTT: ph_operation dosing rem=Ns decrescente; depois recirculating rem=τ.',
        ],
      },
      {
        id: 'poll-vs-loop',
        title: 'Poll de config vs loop de controle',
        accent: 'wait',
        paragraphs: [
          'HydroSystemCore faz poll de ec_controller_config e ph_controller_config a cada ~30 s. Alterações de setpoint na UI podem levar até um ciclo de poll para aplicar.',
          'A avaliação de erro EC/pH roda no loop() principal do firmware — mais rápida que o poll, mas dependente de config já carregada.',
        ],
      },
      {
        id: 'ui-tutorial',
        title: 'Tutorial: seguir um ciclo completo na UI',
        accent: 'brand',
        steps: [
          { title: 'Ativar Auto EC', body: 'Automação → Salvar Parâmetros → Ativar. Observe ec_operation_state em Status do Controle.' },
          { title: 'Fora da banda morta', body: 'Badge muda para dosagem; nutrient_dosages recebe novo registro.' },
          { title: 'Recirculação', body: 'Countdown de recirculação; não interrompa com dosagem manual.' },
          { title: 'Auto pH', body: 'Após EC estabilizar, ative pH; verifique interlock G5 se EC ainda sequencia.' },
          { title: 'Badges na UI', body: 'Dosando / Recirculando / Próxima verificação — recirc tem prioridade sobre flash de relé.' },
          { title: 'Dashboard', body: 'Cards Auto EC/pH no Dashboard espelham os mesmos badges, mas só após carregar auto_enabled da config — paridade com Automação.' },
          { title: 'K em Supabase', body: 'Após recirc pH, confira k_acid/k_base atualizados no painel (PATCH post-recirc).' },
        ],
      },
    ],
    prev: { href: '/processos', label: 'Start Here' },
    next: { href: '/processos/scripts-sequenciais', label: 'Scripts Sequenciais' },
  },

  'scripts-sequenciais': {
    slug: 'scripts-sequenciais',
    title: 'Scripts Sequenciais',
    subtitle: 'Criação, limites e exemplos de execução procedural',
    breadcrumb: 'Scripts Sequenciais',
    sections: [
      {
        id: 'lifecycle',
        title: 'Ciclo de vida',
        accent: 'brand',
        paragraphs: [
          'O fluxo completo liga a UI procedural (Support → Regras) ao JSON persistido e à execução no ESP32. Consulte as capturas de tela em Support → Regras para ver o modal de criação e o painel com ID da regra.',
        ],
        image: {
          src: '/rulesid.png',
          alt: 'Regra dreno ativa no Motor de Decisão com ID e prioridade',
          caption:
            'Estado após persistir: regra visível no painel com ID único — ponto de partida para rastrear execuções em rule_executions.',
        },
        steps: [
          { title: 'Criar', body: 'SequentialScriptEditor ou template Dreno na UI.' },
          { title: 'Persistir', body: 'JSON em decision_rules.rule_json.script no Supabase.' },
          { title: 'Carregar', body: 'ESP32 DecisionEngine no sync (implementação em progresso).' },
          { title: 'Executar', body: 'Avalia instructions[] respeitando loop_interval_ms.' },
          { title: 'Registrar', body: 'rule_executions + execution_log para auditoria.' },
        ],
        callouts: [
          {
            variant: 'warning',
            title: 'Estado de implementação',
            body: 'Executor completo de scripts sequenciais no ESP32 está parcialmente implementado. Teste em bancada antes de processos críticos (dreno, recarga).',
          },
        ],
      },
      {
        id: 'criar-script',
        title: 'Criar script na UI',
        accent: 'wait',
        paragraphs: [
          'Antes de o JSON chegar ao Supabase, o operador percorre o fluxo procedural do modal Nova Regra — condições primeiro, ações depois.',
        ],
        image: {
          src: '/fluxoprocedural.png',
          alt: 'Fluxo procedural do modal Nova Regra com condição Nível 1 igual a Baixo',
          caption:
            'Passo 1 na prática: definir Condição Principal (ex.: Nível 1 = Baixo) antes de montar o LOOP de dreno ou recarga.',
        },
      },
      {
        id: 'limits',
        title: 'Limites de segurança',
        accent: 'warn',
        bullets: [
          'cooldown_ms — evita reentrada imediata após RETURN.',
          'max_executions_per_hour — proteção contra flapping de sensor.',
          'max_iterations — limite de voltas do WHILE (0 = infinito, use com cuidado).',
          'priority — reglas de tanque (dreno) devem ter prioridade sobre circulação TIME.',
        ],
      },
      {
        id: 'examples',
        title: 'Exemplos de processo',
        accent: 'wait',
        table: {
          headers: ['Processo', 'Padrão', 'Sensor chave'],
          rows: [
            { cells: ['Dreno', 'WHILE level_4 != vazio', 'level_4'] },
            { cells: ['Full recharge', 'WHILE level_1 != alto', 'level_1'] },
            { cells: ['Add-back', 'IF water_level == baixo → recarga', 'water_level'] },
            { cells: ['Circulação forçada', 'relay ON + DELAY + OFF', '—'] },
          ],
        },
      },
    ],
    prev: { href: '/processos/ciclos-automaticos', label: 'Ciclos Automáticos' },
    next: { href: '/processos/agendamentos', label: 'Agendamentos' },
  },

  agendamentos: {
    slug: 'agendamentos',
    title: 'Agendamentos',
    subtitle: 'Schedules de relé, timezone e trigger_type',
    breadcrumb: 'Agendamentos',
    sections: [
      {
        id: 'schedule-rules',
        title: 'Regras SCHEDULE_*',
        accent: 'brand',
        paragraphs: [
          'DeviceControlPanel cria regras com sensor time_interval: liga relé por duration, repete a cada interval_between_executions, opcional delay_before_execution.',
          'Nome típico: SCHEDULE_<relay_id>. Persistidas como decision_rules com trigger_type scheduled ou periodic.',
        ],
      },
      {
        id: 'timezone',
        title: 'Timezone',
        accent: 'wait',
        paragraphs: [
          'Configuração → fuso horário do dispositivo. Agendamentos circadianos e regras baseadas em hora local dependem desse valor.',
          'Mismatch entre timezone UI e ESP32 causa execuções defasadas — valide após alterar região.',
        ],
      },
      {
        id: 'trigger-types',
        title: 'trigger_type',
        accent: 'ec',
        table: {
          headers: ['Tipo', 'Comportamento'],
          rows: [
            { cells: ['periodic', 'Reavalia em loop_interval_ms fixo'] },
            { cells: ['on_change', 'Dispara quando sensor muda de estado'] },
            { cells: ['scheduled', 'Baseado em intervalo de tempo / cron lógico'] },
          ],
        },
      },
      {
        id: 'priority-4-time',
        title: 'Prioridade 4 — pulsos TIME vs recirc inline',
        accent: 'wait',
        paragraphs: [
          'Agendamentos TIME (circulação, UC Roots periódico) rodam em paralelo conceitual com P4, mas não devem competir com dreno P1.',
          'Defina priority baixa (20–40) em SCHEDULE_* e priority alta (80+) em scripts de tanque.',
        ],
        callouts: [
          {
            variant: 'tip',
            title: 'Não confundir',
            body: 'tempo_recirculacao do Auto EC/pH é dead-time pós-dose (homogeneização). Bomba de circulação 24/7 é regra TIME separada.',
          },
        ],
      },
      {
        id: 'comparison',
        title: 'Comparativo: qual mecanismo usar?',
        accent: 'ph',
        table: {
          headers: ['Necessidade', 'Mecanismo recomendado'],
          rows: [
            { cells: ['Manter EC no setpoint', 'Auto EC (ciclo fechado)'] },
            { cells: ['Corrigir pH', 'Auto pH (ciclo fechado)'] },
            { cells: ['Esvaziar tanque', 'Script sequencial WHILE'] },
            { cells: ['Mistura 15 min a cada 2 h', 'Schedule time_interval'] },
          ],
        },
      },
    ],
    prev: { href: '/processos/scripts-sequenciais', label: 'Scripts Sequenciais' },
    next: { href: '/support', label: 'Support — Start Here' },
  },
};
