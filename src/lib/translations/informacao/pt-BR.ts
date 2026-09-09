import type { InformacaoCopy } from './types';

export const informacaoPt: InformacaoCopy = {
  header: {
    title: 'Informação',
    subtitle: 'Manual de uso do HydroWave — como operar o sistema com segurança',
  },
  quickLinks: [
    {
      id: 'automacao',
      href: '/automacao',
      title: 'Automação',
      description: 'Auto EC, Auto pH e regras',
    },
    {
      id: 'calibragem',
      href: '/calibragem',
      title: 'Calibragem',
      description: 'Bombas, pH e sensores',
    },
    {
      id: 'fundamentos',
      href: '/fundamentos',
      title: 'Fundamentos',
      description: 'Teoria de cultivo hidropônico',
    },
  ],
  technicalDocs: {
    title: 'Documentação técnica',
    body: 'Para hidráulica, regras, engenharia de controle e execuções agendadas — conteúdo avançado que não cabe neste manual operacional.',
    supportCta: 'Support — Start Here',
    processosCta: 'Processos e schedules',
  },
  fluxo: {
    title: 'Fluxo recomendado (primeira vez)',
    steps: [
      {
        title: '1. Dispositivo online',
        body: 'HydroWave Core conectado, sensores publicando EC/pH/nível.',
      },
      {
        title: '2. Calibragem',
        body: 'Vazão das bombas peristálticas e sensores antes de confiar no Auto EC/pH.',
      },
      {
        title: '3. Plano + parâmetros',
        body: 'Tabela nutricional, setpoint, tolerância, intervalos — salvar e ativar.',
      },
      {
        title: '4. Monitorar status',
        body: 'Banda morta, countdown e última dosagem confirmam que o loop está fechado.',
      },
    ],
  },
  faq: {
    title: 'Perguntas frequentes',
    items: [
      {
        question: 'Como conectar meu dispositivo ESP32?',
        answer:
          'Configure o WiFi no firmware do ESP32 e garanta que ele esteja na mesma rede do servidor. Acesse Dispositivos para verificar se o HydroWave Core aparece online e enviando telemetria.',
      },
      {
        question: 'Como usar o Auto EC (passo a passo)?',
        answerKind: 'autoEc',
        steps: [
          {
            text: 'Em Automação, abra o controle nutricional (desbloqueie com senha se pedir).',
          },
          {
            text: 'Nutrientes — cadastre cada parte do plano (A, B, C…), escolha a bomba e a dose em ml por litro de água do tanque. Calibre a vazão em ',
            link: { href: '/calibragem', label: 'Calibragem' },
            textAfter: '.',
          },
          {
            text: 'Alvo de EC — informe o EC desejado da solução e a faixa de tolerância. O sistema só acrescenta nutrientes quando o EC está abaixo do alvo (fora da faixa, por baixo).',
          },
          {
            text: 'Ritmo — de quanto em quanto tempo medir o EC, e quanto tempo misturar (recirculação) depois de cada dose.',
          },
          {
            text: 'Salvar Parâmetros e depois Ativar Auto EC. O controlador passa a dosar sozinho conforme o plano.',
          },
          {
            text: 'Acompanhe o status: se está na faixa, misturando ou dosando. Se o EC subir demais, configure dreno e reposição de água (diluição) abaixo no mesmo painel.',
          },
        ],
      },
      {
        question: 'O que é a faixa de tolerância no Auto EC?',
        answer:
          'É a “folga” em torno do EC desejado para não dosar a toda hora. Ex.: alvo 1500 µS/cm e tolerância 50 → sem ação entre 1450 e 1550. Nutrientes só entram quando o EC está abaixo do alvo (fora da faixa, por baixo). O mesmo tipo de ideia vale no Auto pH.',
      },
      {
        question: 'Intervalo de medição vs pausa entre nutrientes?',
        answer:
          'São coisas diferentes. O intervalo (ex.: 5 minutos) é de quanto em quanto tempo o sistema olha o EC do tanque. A pausa curta entre um nutriente e outro na mesma dose é só para misturar com segurança — o cultivador não precisa ajustar isso.',
      },
      {
        question: 'Por que não consigo ativar o Auto EC?',
        answer:
          'É preciso pelo menos um nutriente com dose válida (mín. 0,1 ml/L). Remova linhas vazias ou aumente a dose. Salve os parâmetros antes de ativar.',
      },
      {
        question: 'Como configurar regras de automação?',
        answer:
          'Em Automação, crie regras com condições (ex.: pH < 5.5) e ações (ex.: ativar relé). Regras com script usam o editor de instruções.',
      },
      {
        question: 'O que fazer se os sensores não enviam dados?',
        answer:
          'Verifique alimentação, WiFi e status em Dispositivos. Recalibre pH/TDS se as leituras estiverem estáveis mas incorretas.',
      },
    ],
  },
  guides: {
    title: 'Guias rápidos',
    items: [
      {
        title: 'Auto EC — loop de controle',
        body: 'Setpoint + tolerância definem quando dosar. Erro = EC − setpoint. Status mostra “Dentro da tolerância” ou “Ajuste necessário”.',
      },
      {
        title: 'Calibração de sensores',
        body: 'pH em dois pontos; TDS/EC conforme solução padrão. Repita após trocar sonda ou solução.',
      },
      {
        title: 'Solução de problemas',
        body: 'Dispositivo offline → WiFi/alimentação. Auto EC não ativa → nutrientes e total_ml. Equação com k inválido → ml/L zerado.',
      },
    ],
  },
  support: {
    title: 'Suporte',
    intro: 'Dúvidas não cobertas aqui? Entre em contato:',
    email: '📧 Email: suporte@hydrowave.com',
    chat: '💬 Chat: horário comercial',
    plansCta: 'Ver planos e serviços comerciais →',
  },
};
