import type { DocsPageContent, DocsNavTree, SupportPageSlug } from '../docs/types';

export const supportNavPt: DocsNavTree = {
  sectionTitle: 'Support',
  hubHref: '/support',
  hubLabel: 'Start Here',
  items: [
    { href: '/support/arquitetura', label: 'Arquitetura' },
    { href: '/support/hidraulica', label: 'Hidráulica' },
    { href: '/support/regras', label: 'Regras e Motor' },
    { href: '/support/controle', label: 'Engenharia de Controle' },
    { href: '/support/sensores', label: 'Sensores e Níveis' },
  ],
  otherSection: {
    title: 'Processos',
    hubHref: '/processos',
    hubLabel: 'Start Here',
    items: [
      { href: '/processos/ciclos-automaticos', label: 'Ciclos Automáticos' },
      { href: '/processos/scripts-sequenciais', label: 'Scripts Sequenciais' },
      { href: '/processos/agendamentos', label: 'Agendamentos' },
    ],
  },
};

export const supportPagesPt: Record<SupportPageSlug, DocsPageContent> = {
  hub: {
    slug: 'hub',
    title: 'Support — Start Here',
    subtitle: 'Documentação técnica do HydroWave para integradores e operadores avançados',
    breadcrumb: 'Start Here',
    sections: [
      {
        id: 'welcome',
        title: 'Bem-vindo à documentação técnica',
        accent: 'brand',
        paragraphs: [
          'Esta seção complementa o menu Informação. Enquanto Informação cobre operação do dia a dia (FAQ, calibragem, primeiros passos), Support explica decisões de engenharia: hidráulica, motor de regras, sensores de nível e loops de controle EC/pH.',
          'Se você cultiva e só precisa fazer o sistema funcionar, comece em Informação. Se integra hardware, escreve regras ou precisa entender por que o firmware se comporta de certa forma, você está no lugar certo.',
        ],
      },
      {
        id: 'layers',
        title: 'Como um sistema HydroWave se encaixa',
        subtitle: 'Três camadas, inspirado no modelo Nuravine adaptado ao nosso stack',
        accent: 'brand',
        layers: [
          {
            title: '1. Edge — ESP32 master + slaves ESP-NOW',
            body: 'O master lê sensores de água (pH, EC/TDS, nível), executa Auto EC/pH via HydroControl e envia comandos a relés locais ou slaves (válvulas, bombas peristálticas, recirculação).',
            accent: 'wait',
          },
          {
            title: '2. Sensores e atuadores',
            body: 'Sensores Nuravine-style adaptados: sonda pH/EC, sensor de nível XKR-25 (CHEIO/MÉDIO/BAIXO), ambiente (temp/umidade). Atuadores: bombas doseadoras, válvulas 24V, relés de recarga e dreno.',
            accent: 'ec',
          },
          {
            title: '3. Cloud — Supabase + UI HydroWave',
            body: 'Telemetria Realtime/MQTT, configuração remota (setpoints, plano nutricional, regras), histórico de dosagens (ISA-88) e painel de automação. A UI traduz intenção do cultivador em JSON que o ESP32 consome.',
            accent: 'ph',
          },
        ],
      },
      {
        id: 'vs-informacao',
        title: 'Support vs Informação',
        accent: 'neutral',
        table: {
          headers: ['Tópico', 'Informação', 'Support'],
          rows: [
            { cells: ['Ativar Auto EC', 'Passo a passo operacional', 'Equação u(t), banda morta, ISA-88'] },
            { cells: ['Regras', 'Como criar uma regra simples', 'Scripts WHILE/IF, 4 níveis, cooldown'] },
            { cells: ['Nível de água', 'Verificar se sensor online', 'Modelo level_1–4 vs sensor físico'] },
            { cells: ['Dreno / recarga', '—', 'Procedimentos hidráulicos e scripts'] },
          ],
        },
      },
      {
        id: 'learning-path',
        title: 'Rota de aprendizagem recomendada',
        subtitle: 'Do stack cloud ao loop fechado — ordem sugerida para integradores',
        accent: 'brand',
        steps: [
          { title: '1. Arquitetura', body: 'Entenda UI → Supabase → ESP32, relay_commands vs decision_rules antes de escrever automação.' },
          { title: '2. Hidráulica', body: 'Modele dreno, recarga completa e add-back com scripts e sensores de nível.' },
          { title: '3. Regras e Motor', body: 'Crie scripts sequenciais com fluxo procedural (Condições → Ações → Config).' },
          { title: '4. Engenharia de Controle', body: 'Ative Auto EC/pH, interprete badges e equações u(t), K e recirculação inline.' },
          { title: '5. Processos', body: 'Veja quando cada mecanismo roda: ciclos fechados, scripts e agendamentos TIME.' },
        ],
      },
      {
        id: 'glossary',
        title: 'Glossário rápido de controle',
        accent: 'neutral',
        table: {
          headers: ['Símbolo', 'Significado', 'Onde configurar'],
          rows: [
            { cells: ['PV', 'Variável de processo medida (EC, pH)', 'Sensores / hydro_measurements'] },
            { cells: ['SP', 'Setpoint desejado', 'Automação → EC / pH'] },
            { cells: ['u(t)', 'Dosagem calculada (ml)', 'Firmware ECController / AdaptivePH'] },
            { cells: ['τ', 'Tempo de pulso ou recirculação (s)', 'tempo_recirculacao, max_pulse_seconds'] },
            { cells: ['K', 'Ganho aprendido do tanque (pH)', 'k_acid / k_base — aprende pós-recirc'] },
            { cells: ['A', 'Agressividade por ciclo (0.05–1)', 'ph_config.aggressiveness'] },
            { cells: ['α', 'Velocidade EMA do aprendizado de K', 'ph_config.gain_alpha'] },
          ],
        },
      },
    ],
    cards: [
      { href: '/support/arquitetura', title: 'Arquitetura', description: 'Fluxo UI → Supabase → ESP32, relay_commands vs decision_rules', accent: 'brand' },
      { href: '/support/hidraulica', title: 'Hidráulica', description: 'Dreno, recarga completa, add-back, recirculação inline', accent: 'wait' },
      { href: '/support/regras', title: 'Regras e Motor', description: 'Decision Engine, scripts sequenciais, parâmetros de execução', accent: 'brand' },
      { href: '/support/controle', title: 'Engenharia de Controle', description: 'Auto EC, domínio H do pH, pulsos e interlocks', accent: 'ec' },
      { href: '/support/sensores', title: 'Sensores e Níveis', description: 'Transmissor pH/EC/T° + nível sem contato (XKR-25), QC e mapeamento', accent: 'ph' },
      { href: '/processos', title: 'Processos', description: 'Ciclos, schedules e execuções — quando cada coisa roda', accent: 'wait' },
    ],
    next: { href: '/support/arquitetura', label: 'Arquitetura' },
    help: {
      title: 'Precisa de mais ajuda?',
      body: 'Para suporte comercial, instalação assistida ou treinamento técnico, consulte nossos planos.',
      emailLabel: 'Email',
      email: 'suporte@hydrowave.com',
      plansLabel: 'Ver planos e serviços',
      plansHref: '/planos',
    },
  },

  arquitetura: {
    slug: 'arquitetura',
    title: 'Arquitetura do Sistema',
    subtitle: 'Como dados e comandos fluem entre cloud, API e firmware',
    breadcrumb: 'Arquitetura',
    sections: [
      {
        id: 'overview',
        title: 'Visão geral',
        accent: 'brand',
        paragraphs: [
          'O HydroWave separa três caminhos de dados: telemetria (sensores → Supabase → UI), configuração (UI → RPC/API → NVS do ESP32) e atuação (manual, Auto EC/pH ou Decision Engine → relés).',
          'HydroControl concentra loops de controle contínuo (EC/pH). DecisionEngine avalia regras discretas (condições → ações de relé). Ambos coexistem com mutex e interlocks documentados no firmware.',
        ],
      },
      {
        id: 'data-flow',
        title: 'Fluxo de dados',
        accent: 'wait',
        steps: [
          { title: 'UI / Automação', body: 'Operador configura setpoints, plano nutricional ou regras. Next.js chama API routes que persistem em Supabase.' },
          { title: 'Supabase', body: 'Tabelas: hydro_measurements, relay_master, ec_controller_config, ph_controller_config, decision_rules, relay_commands, nutrient_dosages, ph_dosages.' },
          { title: 'ESP32 — HydroSystemCore', body: 'Poll de config (~30 s), leitura de sensores, sync de operation_state, processamento de relay_commands pendentes.' },
          { title: 'HydroControl + DecisionEngine', body: 'Loops EC/pH no loop() principal; regras avaliadas em task dedicada com cooldown e limites horários.' },
        ],
      },
      {
        id: 'relay-vs-rules',
        title: 'relay_commands vs decision_rules',
        accent: 'warn',
        paragraphs: [
          'relay_commands: ações imediatas ou manuais (Dosificar, toggle de relé, batch de até 5 comandos). Prioridade operacional alta para intervenção humana.',
          'decision_rules: automação persistente. Reglas compostas (IF sensor THEN relé) ou scripts sequenciais (WHILE/IF com loop_interval_ms). Respeitam cooldown e max_executions_per_hour.',
        ],
        callouts: [
          {
            variant: 'info',
            title: 'Dois motores, um hardware',
            body: 'Auto EC/pH não passam pelo Decision Engine — são máquinas de estado em HydroControl. Regras hidráulicas (dreno, circulação) usam Decision Engine quando habilitadas no ESP32.',
          },
        ],
      },
      {
        id: 'mqtt',
        title: 'MQTT e Realtime',
        accent: 'brand',
        paragraphs: [
          'O bridge MQTT publica telemetria e operation_state (ec_operation_state, ph_operation_state) para a UI refletir badges “Dosando” / “Recirculando” sem polling agressivo.',
          'Comandos híbridos: HTTPS para config persistente, MQTT para eventos de baixa latência quando o bridge está ativo.',
        ],
      },
    ],
    prev: { href: '/support', label: 'Start Here' },
    next: { href: '/support/hidraulica', label: 'Hidráulica' },
  },

  hidraulica: {
    slug: 'hidraulica',
    title: 'Hidráulica e Processos de Tanque',
    subtitle: 'Dreno, recarga completa, add-back e recirculação modelados como regras',
    breadcrumb: 'Hidráulica',
    sections: [
      {
        id: 'intro',
        title: 'Hidráulica como automação',
        accent: 'wait',
        paragraphs: [
          'No HydroWave, processos hidráulicos (esvaziar tanque, encher, repor volume consumido) não são módulos separados no firmware — são scripts sequenciais que combinam sensores de nível e relés de válvula/bomba.',
          'Isso permite que integradores adaptem a lógica ao layout físico (posição das sondas, válvulas motorizadas, bomba de recarga) sem recompilar firmware.',
        ],
      },
      {
        id: 'drain',
        title: 'Dreno automático (Drain)',
        accent: 'brand',
        paragraphs: [
          'Procedimento canônico: manter válvula de saída aberta enquanto o nível não indicar “vazio”, depois fechar e encerrar o script.',
        ],
        code: `WHILE level_4 != "vazio" DO
  relé_válvula_saída = ON
END WHILE

IF level_4 == "vazio" THEN
  relé_válvula_saída = OFF
  RETURN
END IF`,
        steps: [
          { title: 'Mapear level_4', body: 'Configure a sonda mais baixa (ou estado lógico derivado) como level_4 = vazio quando o tanque esvaziou.' },
          { title: 'Associar relé', body: 'Válvula motorizada de dreno no slave ESP-NOW ou relé local (ex.: relé 5).' },
          { title: 'Definir loop_interval_ms', body: 'Tipicamente 1000–5000 ms entre avaliações do WHILE para evitar chatter da válvula.' },
        ],
      },
      {
        id: 'full-recharge',
        title: 'Recarga completa (Full Recharge)',
        accent: 'ec',
        paragraphs: [
          'Após dreno ou troca de solução, encher o tanque até level_1 = alto (sonda superior). Bomba de água limpa ou solução preparada via relé “Recarga água”.',
        ],
        code: `WHILE level_1 != "alto" DO
  relé_recarga = ON
END WHILE

IF level_1 == "alto" THEN
  relé_recarga = OFF
  RETURN
END IF`,
        callouts: [
          {
            variant: 'warning',
            title: 'Padrão de design',
            body: 'Full recharge está documentado como contrato de script. O nome de relé existe no firmware de teste; valide mapeamento de GPIO/slave na sua instalação antes de confiar em produção.',
          },
        ],
      },
      {
        id: 'add-back',
        title: 'Add-back (reposição parcial)',
        accent: 'ph',
        paragraphs: [
          'Quando o nível cai por evapotranspiração/consumo mas a solução ainda é válida, repor volume sem trocar nutrientes. Combine: IF water_level == baixo → recarga ON até medio.',
          'Coordene com Auto EC: após add-back significativo, EC pode cair — o loop EC corrige na próxima verificação após tempo_recirculacao.',
        ],
      },
      {
        id: 'add-back-vs-full',
        title: 'Add-back vs Full Recharge',
        accent: 'ec',
        paragraphs: [
          'Escolha o procedimento certo evita trocar nutriente desnecessariamente ou operar com volume errado. Full recharge reseta o tanque; add-back repõe só o que evaporou.',
        ],
        table: {
          headers: ['Critério', 'Add-back', 'Full Recharge'],
          rows: [
            { cells: ['Quando usar', 'Nível baixo, solução ainda válida', 'Após dreno ou troca de receita'] },
            { cells: ['Volume', 'Parcial até médio/alto', 'Até level_1 = alto'] },
            { cells: ['Impacto EC/pH', 'Diluição leve — Auto EC corrige', 'Requer FILL+DOSE ou Auto EC após recirc'] },
            { cells: ['Mecanismo', 'IF water_level + relay recarga', 'WHILE level_1 != alto'] },
            { cells: ['Prioridade', 'P1 — script tanque', 'P1 — após dreno'] },
          ],
        },
      },
      {
        id: 'tank-tutorial',
        title: 'Tutorial: dreno → recarga → Auto EC',
        accent: 'brand',
        steps: [
          { title: 'Dreno', body: 'Execute script WHILE level_4 != vazio. Serial: válvula ON até vazio. priority ≥ 80 no Motor de Decisão.' },
          { title: 'Full recharge', body: 'WHILE level_1 != alto com bomba de água limpa ou solução preparada.' },
          { title: 'Recirculação inline', body: 'Aguarde tempo_recirculacao (homogeneização) antes de confiar em leituras EC/pH.' },
          { title: 'Ativar Auto EC', body: 'Automação → Controle Nutricional → auto_enabled. Observe ec_operation_state: dosing → recirculating → idle.' },
        ],
      },
      {
        id: 'inline-recirc',
        title: 'Recirculação inline vs tempo_recirculacao',
        accent: 'wait',
        paragraphs: [
          '“Recirculação inline” no contexto de dosagem automática = período de dead-time após cada pulso (tempo_recirculacao em segundos). O firmware aguarda homogeneização antes de re-medir pH/EC.',
          'Recirculação hidráulica contínua (bomba sempre ligada) é uma regra de relé separada ou schedule — não confundir com o timer pós-dose do controlador.',
          'Na UI de badges: “Aguardando recirculação” refere-se ao dead-time do controlador (P2/P3), não à bomba de circulação TIME (P4).',
        ],
      },
    ],
    prev: { href: '/support/arquitetura', label: 'Arquitetura' },
    next: { href: '/support/regras', label: 'Regras e Motor' },
  },

  regras: {
    slug: 'regras',
    title: 'Regras e Motor de Decisão',
    subtitle: 'Decision Engine, scripts sequenciais e criação de regras',
    breadcrumb: 'Regras e Motor',
    sections: [
      {
        id: 'types',
        title: 'Tipos de regra',
        accent: 'brand',
        bullets: [
          'Regra composta: conditions[] + actions[] — IF pH < 5.5 THEN relé ON.',
          'Script sequencial (rule_type: sequential_script): instructions[] com WHILE, IF, relay_action, DELAY, RETURN.',
          'Schedule: sensor time_interval com interval_between_executions (ver Processos → Agendamentos).',
        ],
      },
      {
        id: 'fluxo-procedural',
        title: 'Fluxo procedural na UI (de cima para baixo)',
        subtitle: 'Como o modal Nova Regra organiza a lógica antes de virar JSON no Supabase',
        accent: 'brand',
        paragraphs: [
          'Ao criar uma regra no Motor de Decisão, a UI segue um fluxo fixo: primeiro você define condições (sensores e operadores), depois ações (relés ON/OFF), em seguida eventos encadeados (passos extras após a condição principal) e por fim config avançada (cooldown, prioridade, loop_interval_ms).',
          'No exemplo abaixo, a função “Dreno Automático” começa com Condição Principal: Nível 1 = Baixo — típico gatilho para iniciar reposição ou dreno parcial antes do script WHILE esvaziar o tanque.',
        ],
        image: {
          src: '/fluxoprocedural.png',
          alt: 'Modal Nova Regra do Motor de Decisão mostrando fluxo Condições, Ações, Eventos Encadeados e Config Avançada',
          caption:
            'Automação → + Nova Regra: fluxo procedural Condições → Ações → Eventos Encadeados → Config Avançada. Exemplo com Nível 1 = Baixo.',
        },
        bullets: [
          'Condições — sensores level_1–level_4, water_level, TDS, temperatura, umidade.',
          'Ações — relay_action imediato quando condição satisfeita.',
          'Eventos encadeados — sequência adicional (ex.: DELAY + segunda ação).',
          'Config avançada — prioridade, cooldown, max_executions_per_hour, loop_interval_ms.',
        ],
      },
      {
        id: 'motor-decisao-painel',
        title: 'Painel Motor de Decisão e ID da regra',
        subtitle: 'Lista de scripts sequenciais ativos, prioridade e identificador único',
        accent: 'ph',
        paragraphs: [
          'Após salvar, a regra aparece em Automação → Motor de Decisão. Cada card mostra nome, badge Ativo/Inativo, tipo Sequential Script, preview das instruções (IF, LOOP WHILE) e metadados: Prioridade e ID (ex.: RULE_1700979324226).',
          'O ID é a chave em decision_rules — use-o para auditoria, logs rule_executions e suporte. A regra “dreno” abaixo ilustra LOOP enquanto water_level != vazio, alinhado ao procedimento hidráulico documentado em Hidráulica.',
        ],
        image: {
          src: '/rulesid.png',
          alt: 'Painel Motor de Decisão com regra dreno ativa, preview LOOP water_level e ID RULE_1700979324226',
          caption:
            'Regras de Script Sequencial: card ativo com preview IF/LOOP, prioridade 69 e ID copiável. Botões ver, editar e excluir no canto superior direito.',
        },
      },
      {
        id: 'instructions',
        title: 'Instruções do script',
        accent: 'wait',
        table: {
          headers: ['Instrução', 'Função'],
          rows: [
            { cells: ['WHILE', 'Loop enquanto condição verdadeira (ex.: dreno)'] },
            { cells: ['IF / ELSE', 'Ramificação condicional'] },
            { cells: ['relay_action', 'ON/OFF em relé master ou slave ESP-NOW'] },
            { cells: ['DELAY', 'Pausa entre passos (ms)'] },
            { cells: ['RETURN', 'Encerra execução do script neste ciclo'] },
          ],
        },
      },
      {
        id: 'params',
        title: 'Parâmetros de execução',
        accent: 'ec',
        bullets: [
          'loop_interval_ms — intervalo entre reavaliações do script.',
          'cooldown / cooldown_ms — tempo mínimo entre execuções completas.',
          'max_executions_per_hour — limite de segurança contra loops runaway.',
          'priority — ordem relativa quando múltiplas regras competem.',
          'max_iterations — 0 = ilimitado (cuidado em WHILE).',
        ],
      },
      {
        id: 'priority-numeric',
        title: 'Prioridade numérica (0–100)',
        accent: 'warn',
        paragraphs: [
          'Quando várias decision_rules competem, o ESP32 ordena por priority DESC (maior vence). Tanque e segurança devem ficar acima de circulação TIME.',
        ],
        table: {
          headers: ['Faixa sugerida', 'Tipo de regra', 'Exemplo'],
          rows: [
            { cells: ['80–100', 'Tanque / dreno / recarga', 'Script WHILE dreno'] },
            { cells: ['50–79', 'Scripts operacionais', 'Add-back, mistura forçada'] },
            { cells: ['20–49', 'Circulação / TIME', 'SCHEDULE circulação 15 min'] },
            { cells: ['0–19', 'Auxiliar / luz', 'Luz UV, aerador noturno'] },
          ],
        },
        callouts: [
          {
            variant: 'info',
            title: 'Auto EC/pH',
            body: 'Loops fechados EC/pH rodam em HydroControl — não usam priority de decision_rules. Interlock G5 bloqueia pH durante EC sequencial em produção.',
          },
        ],
      },
      {
        id: 'four-levels',
        title: 'Sensores de nível nas regras (4 níveis)',
        accent: 'ph',
        paragraphs: [
          'Na UI (CreateRuleModal), você pode referenciar level_1 a level_4 e water_level (vazio, baixo, medio, alto). Isso modela instalações com até quatro sondas discretas ou estados lógicos derivados.',
        ],
        callouts: [
          {
            variant: 'warning',
            title: 'Estado de implementação',
            body: 'O Decision Engine no ESP32 está em desenvolvimento (~35% no checkpoint jun/2026). Scripts e schema JSON são o contrato de design; valide execução no dispositivo antes de produção crítica.',
          },
        ],
      },
      {
        id: 'ui',
        title: 'Onde configurar na UI',
        accent: 'brand',
        steps: [
          { title: 'Automação → Regras', body: 'CreateRuleModal para regras compostas com condições de sensor.' },
          { title: 'Editor de Script Sequencial', body: 'SequentialScriptEditor para WHILE/IF e parâmetros de loop.' },
          { title: 'Salvar e habilitar', body: 'Regra persiste em decision_rules; ESP32 carrega no próximo poll/sync.' },
        ],
      },
    ],
    prev: { href: '/support/hidraulica', label: 'Hidráulica' },
    next: { href: '/support/controle', label: 'Engenharia de Controle' },
  },

  controle: {
    slug: 'controle',
    title: 'Engenharia de Controle',
    subtitle: 'Auto EC, domínio H do pH, pulsos e interlocks',
    breadcrumb: 'Engenharia de Controle',
    sections: [
      {
        id: 'ec-loop',
        title: 'Loop Auto EC',
        accent: 'ec',
        paragraphs: [
          'Variável de processo (PV): EC/TDS medida. Setpoint (SP): ec_setpoint configurado. Erro = PV − SP. Dosagem só ocorre se |erro| > tolerância (banda morta).',
          'u(t) calculado via ECController com base dose, Kp e volume do tanque. Distribuição proporcional entre nutrientes do plano (mlPerLiter).',
        ],
        stateFlow: ['IDLE', 'DOSING', 'WAITING', 'RECIRCULATING', 'IDLE'],
        bullets: [
          'Eventos imutáveis em nutrient_dosages (ISA-88).',
          'Estado operacional em ec_operation_state no relay_master.',
          'Pausa ~3 s entre nutrientes na mesma sequência (firmware).',
          'k = base_dose/total_ml e Kp são estáticos (config Supabase) — sem aprendizado online de K_ec (backlog futuro).',
        ],
      },
      {
        id: 'ph-loop',
        title: 'Loop Auto pH — domínio H',
        accent: 'ph',
        paragraphs: [
          'Controle adaptativo lineariza o processo convertendo pH para H = 10^(−pH). Erro em ErroH = H − H_setpoint.',
          'Preview operador: u(t) = A × V × s × |e|. Firmware: DoseReal = A × |ErroH| / K. K (k_acid / k_base) aprende após cada recirculação.',
        ],
        code: `τ = u(t) / q     (tempo de pulso limitado por max_pulse_seconds)
H = 10^(-pH)
ErroH = H - H_setpoint`,
        stateFlow: ['PH_IDLE', 'PH_DOSING', 'PH_RECIRCULATING', 'PH_IDLE'],
      },
      {
        id: 'k-vs-a-alpha',
        title: 'K, A e α — papéis distintos',
        accent: 'ph',
        table: {
          headers: ['Parâmetro', 'Papel no lazo', 'Persistência'],
          rows: [
            { cells: ['K (k_acid / k_base)', 'Modelo da planta — ml por unidade de |ErroH|', 'NVS + PATCH Supabase pós-recirc'] },
            { cells: ['A (aggressiveness)', 'Fração da correção ideal por pulso: DoseReal = A × |ErroH|/K', 'ph_config — operador'] },
            { cells: ['α (gain_alpha)', 'Velocidade EMA do aprendizado de K', 'ph_config — integrador'] },
          ],
        },
      },
      {
        id: 'k-gains-loop',
        title: 'Lazo fechado de K (pH)',
        accent: 'brand',
        paragraphs: [
          'Cada ciclo: medir → dosar com K+A → recirc τ → medir PV2 → updateGainAfterDose → saveToNVS → PATCH k_acid/k_base.',
          'ph_dosages (relay OFF) registra histórico; K aprendido só persiste em Supabase após recirculação completa — não no evento ph_dose.',
        ],
        stateFlow: ['checkAutoPH', 'PH_DOSING', 'ph_dose', 'PH_RECIRCULATING', 'K learn', 'PH_IDLE'],
        bullets: [
          'Serial: 💾 [PH K] PATCH k_acid/k_base post-recirc após SEQUÊNCIA pH COMPLETA.',
          'Commissioning: primeiros 3 ciclos limitam A ≤ 0.3 mesmo se operador definir A=1.0.',
          'minDeltaPh ≥ 0.03 evita aprendizado sem movimento observável do pH.',
        ],
      },
      {
        id: 'pulses',
        title: 'Pulsos e recirculação',
        accent: 'wait',
        bullets: [
          'max_pulse_seconds — teto de duração do pulso por ciclo pH.',
          'tempo_recirculacao — dead-time pós-dose antes de nova leitura (homogeneização).',
          'Badges UI: “Recirculando” tem prioridade sobre flash momentâneo de relé.',
        ],
      },
      {
        id: 'dashboard-badges',
        title: 'Badges no Dashboard vs Automação',
        accent: 'brand',
        paragraphs: [
          'Dashboard e Automação usam o mesmo hook (usePhOperationState / useEcOperationState) e a mesma fonte: colunas ph_operation_* e ec_operation_* em relay_master, atualizadas pelo firmware via Realtime + poll a cada 5 s.',
          'O Dashboard só espelha relay_master quando auto_enabled=true na config (ph_controller_config / ec_controller_config). Enquanto a config carrega, os badges ficam em loading — evita mostrar recirculação fantasma de snapshots antigos no banco.',
          'Automação é a referência operacional para ativar/desativar e ajustar parâmetros; o Dashboard é um espelho read-only do mesmo estado, alinhado após a config estar pronta.',
        ],
      },
      {
        id: 'interlocks',
        title: 'Interlocks e coordenação EC ↔ pH',
        accent: 'warn',
        paragraphs: [
          'G5 (produção): Auto pH bloqueado enquanto dosagem EC secuencial está ativa — evita correções químicas durante mistura de nutrientes.',
          'water_level_ok: Auto EC/pH e certas regras exigem nível acima de BAJO/ERRO no sensor XKR-25.',
        ],
        callouts: [
          {
            variant: 'tip',
            title: 'Commissioning pH',
            body: 'Comece com A conservador e τ alto. Após 3–5 ciclos estáveis, K converge e pulsos ficam mais precisos. Detalhes em Calibragem e no painel Auto pH.',
          },
        ],
      },
    ],
    prev: { href: '/support/regras', label: 'Regras e Motor' },
    next: { href: '/support/sensores', label: 'Sensores e Níveis' },
  },

  sensores: {
    slug: 'sensores',
    title: 'Sensores e Níveis',
    subtitle: 'Transmissor pH/EC/T° + sensor de nível sem contato (XKR-25) — QC e mapeamento',
    breadcrumb: 'Sensores e Níveis',
    sections: [
      {
        id: 'overview',
        title: 'Visão geral dos sensores',
        accent: 'brand',
        paragraphs: [
          'Transmissores e sondas entram no sistema por dois caminhos: (1) leitura analógica/1-wire (pH, EC/TDS e temperatura) e (2) leitura digital do sensor de nível XKR-25 (sem contato).',
          'No firmware atual, os sinais do transmissor (quando configurado como 0–5 V analógico) viram `ph`, `tds` e `temperature` em `hydro_measurements`; o XKR-25 vira `water_level_ok` para interlocks e regras.',
          'A documentação abaixo foca em “o que é”, “por que importa”, “onde configurar” e “o que ver” em serial/MQTT — para que o instalador feche o circuito sem suposições.',
        ],
      },
      {
        id: 'transmitter-aliexpress',
        title: 'Transmissor AliExpress (pH / EC / Temperatura)',
        accent: 'ec',
        paragraphs: [
          'A documentação assume o caso mais comum: um transmissor 3-em-1 com saída analógica 0–5 V.',
          'Hoje o firmware lê: pH → `PH_PIN 35` e EC/TDS → `TDS_PIN 34`.',
          'Para compensação do TDS/EC, o firmware usa a temperatura do DS18B20 no `TEMP_PIN 4` (a temperatura do módulo do transmissor não substitui esta leitura).',
        ],
        sensorCards: [
          {
            badge: 'TX',
            title: 'Módulo 3-em-1',
            accent: 'brand',
            intro: 'Use este card como “guia de fio”: entenda o canal, a entrada ESP32 e o que o sistema publica na UI.',
            subsections: [
              {
                title: 'pH',
                body: 'Saída analógica do transmissor → `PH_PIN 35` (ADC). A conversão usa modelo linear calibrado por dois pontos.',
                bullets: ['Calibração: pH 7 / pH 4 (padrão).', 'QC ocorre antes do loop de controle.'],
              },
              {
                title: 'EC/TDS',
                body: 'Saída analógica do transmissor → `TDS_PIN 34` (ADC). O firmware usa mediana (30 amostras) e compensação por temperatura.',
                bullets: ['Leitura confiável antes do Auto EC.', 'Plausibilidade no pipeline de `hydro_measurements`.'],
              },
              {
                title: 'Temperatura',
                body: 'Hoje, a compensação usa DS18B20 em `TEMP_PIN 4` (OneWire).',
                bullets: ['O MQTT publica `temperature` via DS18B20.', 'O canal de temperatura do transmissor é alternativa futura (não substitui hoje).'],
              },
            ],
          },
        ],
      },
      {
        id: 'transmitter-ph',
        title: 'Canal pH (sonda de vidro)',
        accent: 'ph',
        sensorCards: [
          {
            badge: 'pH',
            title: 'pH em tensão analógica',
            accent: 'ph',
            subsections: [
              {
                title: 'O que é',
                body: 'A sonda de pH de vidro converte o pH do líquido em uma tensão elétrica. O firmware lê a tensão no `PH_PIN 35` e converte para pH com um modelo linear.',
              },
              {
                title: 'Por que importa',
                body: 'Sem calibração, slope/offset mudam com o tempo e o “erro” vira correção química desnecessária. Com dois pontos, você reancora o modelo para o seu líquido e instalação.',
                bullets: ['padrão: pH 7 e pH 4.', 'o loop usa QC antes de agir.'],
              },
              {
                title: 'Onde configurar na UI',
                steps: [
                  { title: 'Automação / Calibragem → pH', body: 'Use 2 pontos (pH 7 e pH 4). Repetir após troca de sonda ou solução.' },
                ],
              },
              {
                title: 'O que ver no serial/MQTT',
                bullets: ['`hydro_measurements.ph` reflete a leitura convertida.', 'Quando Auto pH estiver ativo: badges e logs seguem `ph_operation_state` (DOSING/RECIRCULATING).'],
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
            title: 'EC via TDSReaderSerial',
            accent: 'ec',
            subsections: [
              {
                title: 'O que é',
                body: 'O firmware lê a saída do transmissor no `TDS_PIN 34` e usa `TDSReaderSerial` para reduzir ruído (mediana de amostras) e aplicar compensação com a temperatura do DS18B20.',
              },
              {
                title: 'Calibração',
                body: 'Faça o ajuste com solução padrão e deixe o fator de calibração consistente.',
                bullets: ['Padrão recomendado: solução 1413 µS/cm.', 'O objetivo é que o PV do Auto EC represente EC/TDS real.'],
              },
              {
                title: 'Impacto no Auto EC',
                body: 'O loop fechado Auto EC usa PV (EC/TDS) e setpoint `ec_setpoint` com banda morta. Após dosagem, a UI acompanha o timing de recirculação inline antes de reavaliar.',
              },
              {
                title: 'O que ver no serial/MQTT',
                bullets: ['`hydro_measurements.tds` e/ou EC derivada.', 'Quando Auto EC estiver ativo: `ec_operation_state` muda entre dosing/recirculating.'],
              },
            ],
          },
        ],
      },
      {
        id: 'transmitter-temperature',
        title: 'Temperatura (compensação de leituras)',
        accent: 'wait',
        callouts: [
          {
            variant: 'warning',
            title: 'Temperatura do transmissor',
            body: 'No firmware atual, a compensação de TDS/EC usa DS18B20 em `TEMP_PIN 4`. Se o seu transmissor também fornece °C, este canal ainda não substitui a leitura do DS18B20.',
          },
        ],
        sensorCards: [
          {
            badge: '°C',
            title: 'DS18B20 na solução',
            accent: 'wait',
            subsections: [
              {
                title: 'O que é',
                body: 'A temperatura do líquido é lida por DS18B20 em `TEMP_PIN 4` (OneWire) e usada no cálculo do TDS/EC.',
              },
              {
                title: 'Onde montar',
                body: 'Instale imerso e protegido contra bolhas e contato direto com superfícies elétricas. Evite turbulência que gere leituras instáveis.',
              },
              {
                title: 'O que ver no MQTT',
                bullets: ['`hydro_measurements.temperature` aparece na UI e logs.', 'A temperatura atual afeta a plausibilidade e o PV usado pelo Auto EC.'],
              },
            ],
          },
        ],
      },
      {
        id: 'level-contactless',
        title: 'Sensor de nível sem contato (XKR-25)',
        accent: 'brand',
        sensorCards: [
          {
            badge: 'Nível',
            title: 'XKR-25 capacitivo (sem contato)',
            accent: 'wait',
            subsections: [
              {
                title: 'Montagem',
                body: 'Fixe o XKR-25 na parede do tanque (lado externo quando aplicável) mantendo distância segura da superfície do líquido e evitando bolsões de ar.',
              },
              {
                title: 'Cableado (NPN/PNP)',
                body: 'O firmware usa dois pinos digitais: `TANK_LOW_PIN 32` (NPN) e `TANK_HIGH_PIN 33` (PNP).',
                bullets: ['NPN detecta quando a entrada está em HIGH (padrão do firmware).', 'PNP detecta quando a entrada está em LOW (padrão do firmware).'],
              },
              {
                title: 'Estados',
                body: 'O firmware combina NPN/PNP e normaliza para CHEIO / MÉDIO / BAIXO / ERRO e publica `water_level_ok`.',
                bullets: ['CHEIO e MÉDIO → `water_level_ok=true`.', 'BAIXO e ERRO → `water_level_ok=false` (interlocks).'],
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
          'Este é o mapeamento “de verdade” usado pelo `LevelSensor` (XKR-25). O Decision Engine e regras dependem do booleano `water_level_ok` para liberar/segurar ações.',
        ],
        table: {
          headers: ['NPN (TANK_LOW_PIN 32)', 'PNP (TANK_HIGH_PIN 33)', 'Estado resultante'],
          rows: [
            { cells: ['LOW', 'qualquer', 'CHEIO (water_level_ok = true)'] },
            { cells: ['HIGH', 'HIGH', 'MÉDIO (water_level_ok = true)'] },
            { cells: ['HIGH', 'LOW', 'BAIXO (water_level_ok = false)'] },
            { cells: ['inconsistente', 'inconsistente', 'ERRO (water_level_ok = false)'] },
          ],
        },
        callouts: [
          {
            variant: 'tip',
            title: 'Teste rápido',
            body: 'Ao instalar, veja `water_level_ok` no MQTT/telemetria enquanto você simula níveis (CHEIO/MÉDIO/BAIXO) antes de confiar em interlocks.',
          },
        ],
      },
      {
        id: 'four-vs-one',
        title: 'level_1–level_4 vs sensor único',
        accent: 'ph',
        paragraphs: [
          'A UI de regras expõe quatro níveis discretos para flexibilidade de projeto (sondas em alturas diferentes).',
          'O firmware atual implementa um LevelSensor (XKR-25) com estados CHEIO, MÉDIO, BAIXO e ERRO, publicando water_level_ok booleano.',
        ],
        table: {
          headers: ['Conceito UI', 'Firmware hoje', 'Instalação futura'],
          rows: [
            { cells: ['level_4 = vazio', 'BAIXO / ERRO', 'Sonda inferior'] },
            { cells: ['level_2 = medio', 'MÉDIO', 'Sonda intermediária'] },
            { cells: ['level_1 = alto', 'CHEIO', 'Sonda superior'] },
            { cells: ['water_level', 'Agregado lógico', 'Derivado ou Modbus'] },
          ],
        },
        callouts: [
          {
            variant: 'warning',
            title: 'Mapeamento necessário',
            body: 'Até quatro entradas físicas estarem disponíveis, derive estados lógicos a partir do XKR-25 ou configure regras usando water_level e water_level_ok.',
          },
        ],
      },
      {
        id: 'calibration',
        title: 'Calibração e manutenção',
        accent: 'brand',
        steps: [
          { title: 'pH', body: 'Dois pontos em Calibragem; repetir após troca de sonda ou solução muito ácida/básica.' },
          { title: 'EC/TDS', body: 'Calibre com solução padrão 1413 µS/cm (ou ajuste equivalente) para tornar u(t) e Auto EC coerentes.' },
          { title: 'Bombas', body: 'Calibragem de vazão (ml/s) por relé — prerequisite para u(t) confiável.' },
          { title: 'Nível', body: 'Verificar posicionamento físico do sensor; ERRO contínuo indica falha de cabo/faixa fora de escala.' },
        ],
      },
    ],
    prev: { href: '/support/controle', label: 'Engenharia de Controle' },
    next: { href: '/processos', label: 'Processos — Start Here' },
  },
};
