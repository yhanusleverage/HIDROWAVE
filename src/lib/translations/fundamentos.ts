/**
 * Traducciones para la página de Fundamentos Hidropónicos
 */

export interface FundamentosTranslations {
  title: string;
  subtitle: string;
  table: {
    waterLevel: string;
    ec: string;
    ph: string;
    solution: string;
  };
  states: {
    static: string;
    rising: string;
    falling: string;
  };
  conditions: Array<{
    waterLevel: string;
    ec: string;
    ph: string;
    solution: string;
  }>;
  colorLegend: {
    title: string;
    green: string;
    yellow: string;
    red: string;
    ecFootnote: string;
  };
  notes: {
    title: string;
    note1: {
      title: string;
      intro?: string;
      sections?: Array<{ title: string; body: string }>;
      content: string;
    };
    note2: {
      title: string;
      content: string;
    };
    vpd: {
      title: string;
      intro: string;
      sections: Array<{ title: string; body: string }>;
    };
  };
  tips: {
    title: string;
    items: string[];
  };
  footer: {
    text: string;
  };
}

export const fundamentosTranslations: Record<string, FundamentosTranslations> = {
  'pt-BR': {
    title: 'Guia de Condições Hidropônicas',
    subtitle: 'Soluções para mudanças em nível de água, EC, pH — e complemento com VPD (ambiente)',
    table: {
      waterLevel: 'NÍVEL DE ÁGUA',
      ec: 'EC',
      ph: 'pH',
      solution: 'SOLUÇÃO',
    },
    states: {
      static: 'ESTÁTICO',
      rising: 'SUBINDO',
      falling: 'DESCENDO',
    },
    conditions: [
      {
        waterLevel: 'ESTÁTICO',
        ec: 'ESTÁTICO',
        ph: 'ESTÁTICO',
        solution: 'Planta não está se alimentando/bebendo, altere a EC, verifique os medidores. Geralmente, reduzir um pouco a EC deve fazer a planta voltar a se alimentar.',
      },
      {
        waterLevel: 'ESTÁTICO',
        ec: 'ESTÁTICO',
        ph: 'SUBINDO',
        solution: 'Tampões de pH provavelmente estão elevando o pH. Isso é normal. Ter um nível de água estático não é normal, então novamente, uma leve redução na EC ou uma troca de reservatório deve resolver isso.',
      },
      {
        waterLevel: 'ESTÁTICO',
        ec: 'ESTÁTICO',
        ph: 'DESCENDO',
        solution: 'Causa usual: enxágue prévio em pH baixo ou acidificação pela rizosfera (Nota 1). Troque o reservatório se o pH continuar a cair sem consumo aparente de água.',
      },
      {
        waterLevel: 'ESTÁTICO',
        ec: 'SUBINDO',
        ph: 'ESTÁTICO',
        solution: 'Planta está lixiviando nutrição, aumente a EC. Nota 2.',
      },
      {
        waterLevel: 'ESTÁTICO',
        ec: 'SUBINDO',
        ph: 'SUBINDO',
        solution: 'Planta lixiviando nutrição, aumente a EC. Um estado incomum. O pH subindo provavelmente é causado pelo que está lixiviando de volta. Se estes forem alcalinos, levará ao aumento do pH. Também pode ser tampões de pH.',
      },
      {
        waterLevel: 'ESTÁTICO',
        ec: 'SUBINDO',
        ph: 'DESCENDO',
        solution: 'Como acima, mas considere acidificação pela rizosfera (Nota 1). Troca de reservatório, além de aumento na EC.',
      },
      {
        waterLevel: 'ESTÁTICO',
        ec: 'DESCENDO',
        ph: 'ESTÁTICO',
        solution: 'Planta comendo mas não bebendo. Não é ideal. Reduza a EC ou troque o reservatório.',
      },
      {
        waterLevel: 'ESTÁTICO',
        ec: 'DESCENDO',
        ph: 'SUBINDO',
        solution: 'Como acima, mas o pH subindo é um sinal melhor. Reduza a EC levemente ou troque o reservatório.',
      },
      {
        waterLevel: 'ESTÁTICO',
        ec: 'DESCENDO',
        ph: 'DESCENDO',
        solution: 'pH caindo junto com EC caindo, mas sem queda no nível de água sugere troca de reservatório ou acidificação pela rizosfera (Nota 1). Dependendo de outros sintomas, reduzir EC após troca de reservatório.',
      },
      {
        waterLevel: 'DESCENDO',
        ec: 'ESTÁTICO',
        ph: 'ESTÁTICO',
        solution: 'Condições perfeitas. EC e pH estão no nível correto.',
      },
      {
        waterLevel: 'DESCENDO',
        ec: 'ESTÁTICO',
        ph: 'SUBINDO',
        solution: 'Estado normal que a maioria das pessoas encontra. Nada com que se preocupar, continue fazendo o que está fazendo, a menos que haja outros sintomas na planta.',
      },
      {
        waterLevel: 'DESCENDO',
        ec: 'ESTÁTICO',
        ph: 'DESCENDO',
        solution: 'Troca de reservatório além de ajuste na EC. Reduza a EC se estiver acima de 1,4; aumente se estiver abaixo de 1,0. Provável desequilíbrio químico: nutrição proporcional desbalanceada ou solução saturada por uso contínuo — troca de reservatório recomendada.',
      },
      {
        waterLevel: 'DESCENDO',
        ec: 'SUBINDO',
        ph: 'ESTÁTICO',
        solution: 'Planta está bebendo mais do que comendo, reduza a EC.',
      },
      {
        waterLevel: 'DESCENDO',
        ec: 'SUBINDO',
        ph: 'SUBINDO',
        solution: 'Planta está bebendo mais do que comendo, reduza a EC.',
      },
      {
        waterLevel: 'DESCENDO',
        ec: 'SUBINDO',
        ph: 'DESCENDO',
        solution: 'Planta está bebendo mais do que comendo, reduza a EC. Se o pH cair de forma persistente, troque o reservatório (Nota 1 — rizosfera).',
      },
      {
        waterLevel: 'DESCENDO',
        ec: 'DESCENDO',
        ph: 'ESTÁTICO',
        solution: 'Planta com fome, aumente a EC. Situação muito boa de estar. Tampões de nutrientes estão funcionando e a planta está tomando um equilíbrio de nutrientes.',
      },
      {
        waterLevel: 'DESCENDO',
        ec: 'DESCENDO',
        ph: 'SUBINDO',
        solution: 'Quase como acima, geralmente considerado quase perfeito, aumente a EC levemente.',
      },
      {
        waterLevel: 'DESCENDO',
        ec: 'DESCENDO',
        ph: 'DESCENDO',
        solution: 'Troca de reservatório. Queda de pH pode refletir atividade da rizosfera (Nota 1), mas a planta ainda está comendo e bebendo. Aumente a EC no novo reservatório.',
      },
    ],
    colorLegend: {
      title: 'Legenda de cores',
      green:
        'Normal ou excelente — a planta consome água (nível DESCENDO) e EC/pH estão estáveis ou num padrão saudável da fase.',
      yellow:
        'Atenção moderada — troca de reservatório, ajuste de EC ou investigar queda de pH / desequilíbrio químico provável.',
      red:
        'Investigar — combinação atípica de nível, EC e pH; revise nutrição, calibração, VPD (Nota 3) e sintomas visuais da planta.',
      ecFootnote:
        'Referências EC 1,0 e 1,4 assumem mS/cm em escala genérica — ajuste sempre aos valores-alvo da sua cultura, fase e medidor.',
    },
    notes: {
      title: 'Notas Importantes',
      note1: {
        title: 'Nota 1 — pH, rizosfera e correção química',
        intro:
          'Queda de pH com nível de água estável costuma refletir processos biológicos e químicos na zona radicular. Compreender o equilíbrio ácido-base — e as ferramentas simples para corrigi-lo — transforma leituras da tabela em ação consciente.',
        sections: [
          {
            title: 'Rizosfera e equilíbrio gasoso',
            body:
              'Junto às raízes existe uma zona viva — a rizosfera — onde planta, água e micro-organismos trocam gases e substâncias o tempo todo. A respiração radicular libera CO₂; dissolvido na solução, torna-a ligeiramente mais ácida, como um sopro contínuo e invisível.\n\nA forma como a planta come também move o pH: preferência por amônio puxa a solução para o ácido; preferência por nitrato puxa para o básico. Por isso o pH nunca é só “número do medidor” — é o retrato químico do que acontece na raiz.',
          },
          {
            title: 'Sistema carbonato — ferramenta simples e poderosa',
            body:
              'Imagine a água do reservatório como um equilíbrio delicado entre “mais ácida” e “mais básica”. Quando CO₂ da respiração das raízes — ou do ar em contacto com a solução — se dissolve, a água fica ligeiramente mais ácida. É o mesmo princípio de uma bebida gaseificada, mas contínuo e invisível.\n\nSoluções nutritivas de hidroponia são diluídas de propósito: a planta se alimenta bem, mas a água quase não tem colchão químico. Pequenas entradas de acidez (exsudatos radiculares, matéria orgânica, CO₂) deslocam o pH depressa. O medidor reage — não é falha do sensor, é a natureza frágil do meio.\n\nAqui entra o sistema carbonato, uma das ferramentas mais acessíveis e baratas do cultivador: carbonato ou bicarbonato de potássio. Não enchem o tanque “de sal” à toa — consomem acidez, podem libertar CO₂ (por vezes visível em bolhas finas) e devolvem potássio útil à nutrição.\n\nCompreender este ciclo — acidez que entra, base que negocia, gás que vai e volta — dá ao cultivador um controlo manual poderoso, com produtos comuns, sem depender só de equipamento caro. É química acessível: simples de entender, profunda no efeito, quando usada com paciência e doses pequenas.',
          },
          {
            title: 'Ácido fosfórico e carbonato de potássio — dois conceitos de correção',
            body:
              'Corrigir pH não é “jogar sal na água”. É restaurar um equilíbrio dinâmico entre água, íons, nutrientes e a biologia das raízes.\n\nO ácido fosfórico (pH−) encarna a ideia de entregar acidez — doar prótons à solução. A água torna-se mais ácida e, simultaneamente, o fósforo entra no ciclo nutritivo. Não é um aditivo neutro: altera a química viva do reservatório.\n\nO carbonato de potássio (pH+) encarna o caminho oposto: absorver acidez e devolver potássio, com liberação de CO₂ — o mesmo elemento presente na respiração radicular, aqui usado para empurrar o pH para cima de forma controlada.\n\nCompreender esses dois polos evita tratar pH+ e pH− como botões mágicos. Cada correção é uma conversa química: pequena, pausada, com tempo para a solução misturar e “respirar” antes de nova leitura. Soluções comerciais já diluídas existem justamente para tornar essa conversa mais suave e segura para as raízes.',
          },
        ],
        content: '',
      },
      note2: {
        title: 'Nota 2 — Lixiviação de nutrientes',
        content:
          'Quando o nível de água fica ESTÁTICO mas a EC sobe, a planta não está bebendo — está devolvendo nutrientes para a solução. É como um caldo concentrado demais: o organismo rejeita em vez de absorver. Reduza a EC ou troque o reservatório para recuperar o equilíbrio. Subir a EC só faz sentido se confirmar que a concentração estava baixa demais para a fase, não alta.',
      },
      vpd: {
        title: 'Nota 3 — VPD (déficit de pressão de vapor)',
        intro:
          'EC e pH descrevem a química da solução no reservatório. O VPD descreve o “clima de secagem” ao redor da folha — e explica por que a planta bebe mais ou menos, mesmo quando a tabela parece correta. Os dois olhares se complementam: solução + ambiente.',
        sections: [
          {
            title: 'O que é, em linguagem simples',
            body:
              'VPD mede o quanto o ar ainda “puxa” umidade das folhas. Ar quente e seco → VPD alto → a planta transpira forte e puxa mais água da raiz (nível DESCENDO acelerado). Ar frio e úmido → VPD baixo → transpiração fraca; a solução muda devagar e o nível pode parecer ESTÁTICO mesmo com metabolismo ativo.',
          },
          {
            title: 'Ligação com a tabela EC / pH / água',
            body:
              'DESCENDO + EC DESCENDO + pH estável costuma ser fome nutricional — e VPD moderado a alto favorece essa “sede”. DESCENDO + EC SUBINDO sugere beber mais que comer — comum com VPD elevado ou EC inicial baixa. ESTÁTICO + EC SUBINDO (Nota 2) pode aparecer com VPD baixo: pouca transpiração, acúmulo relativo de sais na solução.',
          },
          {
            title: 'Faixas orientativas (kPa)',
            body:
              'Valores de referência, não dogma: plântula/muda ~0,4–0,8 · vegetativo ~0,8–1,2 · flora ~1,0–1,6. Acima disso aumenta estresse hídrico; abaixo disso reduz transpiração e transporte de nutrientes. Ajuste temperatura, humidade relativa ou ventilação antes de forçar EC/pH.',
          },
          {
            title: 'Como usar no dia a dia',
            body:
              'Com temperatura e humidade do ambiente calcula-se o VPD (apps ou tabelas). Se a tabela está verde mas a planta murcha → olhe VPD alto. Se bebe pouco e EC sobe com nível ESTÁTICO → olhe VPD baixo + Nota 2. HIDROWAVE trata solução; o cultivador equilibra o ar — os dois juntos fecham o ciclo da planta.',
          },
        ],
      },
    },
    tips: {
      title: 'Dicas Gerais',
      items: [
        'Monitore regularmente nível de água, EC, pH e ambiente (temperatura + UR → VPD)',
        'Faça trocas de reservatório regularmente conforme necessário',
        'Ajuste a EC gradualmente - mudanças bruscas podem estressar as plantas',
        'Verifique a calibração dos medidores periodicamente',
        'Observe os sintomas visuais das plantas em conjunto com as leituras dos sensores',
      ],
    },
    footer: {
      text: 'Compilado experimentado de Hidroponia',
    },
  },
  'en-US': {
    title: 'Hydroponic Conditions Guide',
    subtitle: 'Solutions for water level, EC, pH changes — plus VPD (environment) context',
    table: {
      waterLevel: 'WATER LEVEL',
      ec: 'EC',
      ph: 'pH',
      solution: 'SOLUTION',
    },
    states: {
      static: 'STATIC',
      rising: 'RISING',
      falling: 'FALLING',
    },
    conditions: [
      {
        waterLevel: 'STATIC',
        ec: 'STATIC',
        ph: 'STATIC',
        solution: 'Plant is not feeding/drinking, change the EC, check the meters. Generally, slightly reducing the EC should make the plant start feeding again.',
      },
      {
        waterLevel: 'STATIC',
        ec: 'STATIC',
        ph: 'RISING',
        solution: 'pH buffers are probably raising the pH. This is normal. Having a static water level is not normal, so again, a slight reduction in EC or a reservoir change should solve this.',
      },
      {
        waterLevel: 'STATIC',
        ec: 'STATIC',
        ph: 'FALLING',
        solution: 'Usual cause: prior flush at low pH or rhizosphere acidification (Note 1). Change the reservoir if pH keeps falling without apparent water uptake.',
      },
      {
        waterLevel: 'STATIC',
        ec: 'RISING',
        ph: 'STATIC',
        solution: 'Plant is leaching nutrients, increase the EC. Note 2.',
      },
      {
        waterLevel: 'STATIC',
        ec: 'RISING',
        ph: 'RISING',
        solution: 'Plant is leaching nutrients, increase the EC. An unusual state. The rising pH is probably caused by what is leaching back. If these are alkaline, it will lead to an increase in pH. It can also be pH buffers.',
      },
      {
        waterLevel: 'STATIC',
        ec: 'RISING',
        ph: 'FALLING',
        solution: 'As above, but consider rhizosphere acidification (Note 1). Reservoir change, in addition to increasing EC.',
      },
      {
        waterLevel: 'STATIC',
        ec: 'FALLING',
        ph: 'STATIC',
        solution: 'Plant is eating but not drinking. Not ideal. Reduce the EC or change the reservoir.',
      },
      {
        waterLevel: 'STATIC',
        ec: 'FALLING',
        ph: 'RISING',
        solution: 'As above, but rising pH is a better sign. Slightly reduce the EC or change the reservoir.',
      },
      {
        waterLevel: 'STATIC',
        ec: 'FALLING',
        ph: 'FALLING',
        solution: 'pH falling along with EC falling, but without a drop in water level suggests a reservoir change or rhizosphere acidification (Note 1). Depending on other symptoms, reduce EC after reservoir change.',
      },
      {
        waterLevel: 'FALLING',
        ec: 'STATIC',
        ph: 'STATIC',
        solution: 'Perfect conditions. EC and pH are at the correct level.',
      },
      {
        waterLevel: 'FALLING',
        ec: 'STATIC',
        ph: 'RISING',
        solution: 'Normal state that most people find. Nothing to worry about, keep doing what you\'re doing, unless there are other symptoms in the plant.',
      },
      {
        waterLevel: 'FALLING',
        ec: 'STATIC',
        ph: 'FALLING',
        solution: 'Reservoir change plus EC adjustment. Reduce EC if above 1.4; increase if below 1.0. Likely chemical imbalance: unbalanced proportional nutrition or solution saturated from continuous use — reservoir change recommended.',
      },
      {
        waterLevel: 'FALLING',
        ec: 'RISING',
        ph: 'STATIC',
        solution: 'Plant is drinking more than eating, reduce the EC.',
      },
      {
        waterLevel: 'FALLING',
        ec: 'RISING',
        ph: 'RISING',
        solution: 'Plant is drinking more than eating, reduce the EC.',
      },
      {
        waterLevel: 'FALLING',
        ec: 'RISING',
        ph: 'FALLING',
        solution: 'Plant is drinking more than eating, reduce the EC. If pH keeps dropping, change the reservoir (Note 1 — rhizosphere).',
      },
      {
        waterLevel: 'FALLING',
        ec: 'FALLING',
        ph: 'STATIC',
        solution: 'Plant is hungry, increase the EC. Very good situation. Nutrient buffers are working and the plant is taking a balance of nutrients.',
      },
      {
        waterLevel: 'FALLING',
        ec: 'FALLING',
        ph: 'RISING',
        solution: 'Almost as above, generally considered almost perfect, slightly increase the EC.',
      },
      {
        waterLevel: 'FALLING',
        ec: 'FALLING',
        ph: 'FALLING',
        solution: 'Reservoir change. Falling pH may reflect rhizosphere activity (Note 1), but the plant is still eating and drinking. Increase the EC in the new reservoir.',
      },
    ],
    colorLegend: {
      title: 'Color legend',
      green:
        'Normal or excellent — the plant is using water (FALLING level) and EC/pH are stable or in a healthy pattern for the stage.',
      yellow:
        'Moderate attention — reservoir change, EC adjustment, or investigate falling pH / likely chemical imbalance.',
      red:
        'Investigate — atypical combination of level, EC, and pH; review nutrition, calibration, VPD (Note 3), and visible plant symptoms.',
      ecFootnote:
        'EC references 1.0 and 1.4 assume generic mS/cm scale — always adjust to your crop targets, stage, and meter.',
    },
    notes: {
      title: 'Important Notes',
      note1: {
        title: 'Note 1 — pH, rhizosphere, and chemical correction',
        intro:
          'Falling pH with a static water level usually reflects biological and chemical processes at the root zone. Understanding acid–base balance—and the simple tools to correct it—turns table readings into conscious action.',
        sections: [
          {
            title: 'Rhizosphere and gas exchange',
            body:
              'At the roots lies a living zone—the rhizosphere—where plant, water, and microbes exchange gases and substances all the time. Root respiration releases CO₂; dissolved in the solution, it makes the water slightly more acidic, like a continuous invisible breath.\n\nHow the plant feeds also moves pH: preference for ammonium pulls the solution toward acid; preference for nitrate pulls toward basic. So pH is never just a “meter number”—it is the chemical portrait of what happens at the root.',
          },
          {
            title: 'Carbonate system — simple, powerful tool',
            body:
              'Picture reservoir water as a delicate balance between “more acidic” and “more basic.” When CO₂ from root respiration—or from air in contact with the solution—dissolves, the water becomes slightly more acidic. Same idea as a carbonated drink, but continuous and invisible.\n\nHydroponic nutrient solutions are diluted on purpose: plants feed well, but the water has almost no chemical cushion. Small inputs of acidity (root exudates, organic matter, CO₂) shift pH quickly. The meter reacts—not a sensor fault, but the fragile nature of the medium.\n\nHere enters the carbonate system, one of the grower’s most accessible, low-cost tools: potassium carbonate or bicarbonate. They do not “fill the tank with salt” for no reason—they consume acidity, may release CO₂ (sometimes visible as fine bubbles), and return useful potassium to nutrition.\n\nUnderstanding this cycle—acidity entering, base negotiating, gas coming and going—gives the grower powerful manual control with common products, without relying only on expensive gear. Accessible chemistry: easy to grasp, deep in effect, when used with patience and small doses.',
          },
          {
            title: 'Phosphoric acid and potassium carbonate — two correction concepts',
            body:
              'Correcting pH is not “throwing salt in water.” It is restoring a dynamic balance among water, ions, nutrients, and root biology.\n\nPhosphoric acid (pH−) embodies delivering acidity—donating protons to the solution. The water becomes more acidic while phosphorus enters the nutrient cycle. It is not a neutral additive: it changes the living chemistry of the tank.\n\nPotassium carbonate (pH+) embodies the opposite path: absorbing acidity and returning potassium, with CO₂ release—the same element from root respiration, now used in a controlled way to push pH upward.\n\nUnderstanding these two poles avoids treating pH+ and pH− as magic buttons. Each correction is a chemical conversation: small, paused, with time for the solution to mix and “breathe” before the next reading. Commercial diluted solutions exist precisely to keep that conversation gentle and safe for roots.',
          },
        ],
        content: '',
      },
      note2: {
        title: 'Note 2 — Nutrient leaching',
        content:
          'When the water level stays STATIC but EC rises, the plant is not drinking—it is returning nutrients to the solution. Like a broth that is too concentrated: the organism rejects instead of absorbing. Lower EC or change the reservoir to restore balance. Raising EC only makes sense if you confirm concentration was too low for the stage, not too high.',
      },
      vpd: {
        title: 'Note 3 — VPD (vapor pressure deficit)',
        intro:
          'EC and pH describe solution chemistry in the reservoir. VPD describes the “drying climate” around the leaf—and explains why the plant drinks more or less even when the table looks correct. Both views complement each other: solution + environment.',
        sections: [
          {
            title: 'What it is, in plain language',
            body:
              'VPD measures how much the air still “pulls” moisture from leaves. Hot, dry air → high VPD → strong transpiration and more water uptake from roots (faster FALLING level). Cool, humid air → low VPD → weak transpiration; the solution changes slowly and the level may look STATIC even with active metabolism.',
          },
          {
            title: 'Link to the EC / pH / water table',
            body:
              'FALLING + EC FALLING + stable pH often means nutritional hunger—and moderate to high VPD favors that “thirst.” FALLING + EC RISING suggests drinking more than eating—common with high VPD or low initial EC. STATIC + EC RISING (Note 2) can appear with low VPD: little transpiration, relative salt buildup in the solution.',
          },
          {
            title: 'Guideline ranges (kPa)',
            body:
              'Reference values, not dogma: seedling/clone ~0.4–0.8 · vegetative ~0.8–1.2 · flower ~1.0–1.6. Above that increases water stress; below that reduces transpiration and nutrient transport. Adjust temperature, relative humidity, or airflow before forcing EC/pH changes.',
          },
          {
            title: 'Daily use',
            body:
              'With ambient temperature and humidity you calculate VPD (apps or charts). If the table is green but the plant wilts → check high VPD. If it drinks little and EC rises with STATIC level → check low VPD + Note 2. HIDROWAVE manages the solution; the grower balances the air—together they close the plant’s cycle.',
          },
        ],
      },
    },
    tips: {
      title: 'General Tips',
      items: [
        'Regularly monitor water level, EC, pH, and environment (temperature + RH → VPD)',
        'Change reservoirs regularly as needed',
        'Adjust EC gradually - sudden changes can stress plants',
        'Periodically check the calibration of meters',
        'Observe visual symptoms of plants in conjunction with sensor readings',
      ],
    },
    footer: {
      text: 'Compilado experimentado de Hidroponia',
    },
  },
  'es-ES': {
    title: 'Guía de Condiciones Hidropónicas',
    subtitle: 'Soluciones para cambios en nivel de agua, EC, pH — y complemento con VPD (ambiente)',
    table: {
      waterLevel: 'NIVEL DE AGUA',
      ec: 'EC',
      ph: 'pH',
      solution: 'SOLUCIÓN',
    },
    states: {
      static: 'ESTÁTICO',
      rising: 'SUBIENDO',
      falling: 'BAJANDO',
    },
    conditions: [
      {
        waterLevel: 'ESTÁTICO',
        ec: 'ESTÁTICO',
        ph: 'ESTÁTICO',
        solution: 'La planta no se está alimentando/bebiendo, cambie la EC, verifique los medidores. Generalmente, reducir un poco la EC debería hacer que la planta vuelva a alimentarse.',
      },
      {
        waterLevel: 'ESTÁTICO',
        ec: 'ESTÁTICO',
        ph: 'SUBIENDO',
        solution: 'Los tampones de pH probablemente están elevando el pH. Esto es normal. Tener un nivel de agua estático no es normal, así que nuevamente, una leve reducción en la EC o un cambio de reservorio debería resolver esto.',
      },
      {
        waterLevel: 'ESTÁTICO',
        ec: 'ESTÁTICO',
        ph: 'BAJANDO',
        solution: 'Causa habitual: enjuague previo a pH bajo o acidificación por rizosfera (Nota 1). Cambie el reservorio si el pH sigue bajando sin consumo aparente de agua.',
      },
      {
        waterLevel: 'ESTÁTICO',
        ec: 'SUBIENDO',
        ph: 'ESTÁTICO',
        solution: 'La planta está lixiviando nutrientes, aumente la EC. Nota 2.',
      },
      {
        waterLevel: 'ESTÁTICO',
        ec: 'SUBIENDO',
        ph: 'SUBIENDO',
        solution: 'La planta está lixiviando nutrientes, aumente la EC. Un estado inusual. El pH subiendo probablemente es causado por lo que se está lixiviando de vuelta. Si estos son alcalinos, llevará a un aumento del pH. También pueden ser tampones de pH.',
      },
      {
        waterLevel: 'ESTÁTICO',
        ec: 'SUBIENDO',
        ph: 'BAJANDO',
        solution: 'Como arriba, pero considere acidificación por rizosfera (Nota 1). Cambio de reservorio, además de aumentar la EC.',
      },
      {
        waterLevel: 'ESTÁTICO',
        ec: 'BAJANDO',
        ph: 'ESTÁTICO',
        solution: 'La planta está comiendo pero no bebiendo. No es ideal. Reduzca la EC o cambie el reservorio.',
      },
      {
        waterLevel: 'ESTÁTICO',
        ec: 'BAJANDO',
        ph: 'SUBIENDO',
        solution: 'Como arriba, pero el pH subiendo es una mejor señal. Reduzca la EC levemente o cambie el reservorio.',
      },
      {
        waterLevel: 'ESTÁTICO',
        ec: 'BAJANDO',
        ph: 'BAJANDO',
        solution: 'pH bajando junto con EC bajando, pero sin caída en el nivel de agua sugiere cambio de reservorio o acidificación por rizosfera (Nota 1). Dependiendo de otros síntomas, reducir EC después del cambio de reservorio.',
      },
      {
        waterLevel: 'BAJANDO',
        ec: 'ESTÁTICO',
        ph: 'ESTÁTICO',
        solution: 'Condiciones perfectas. EC y pH están en el nivel correcto.',
      },
      {
        waterLevel: 'BAJANDO',
        ec: 'ESTÁTICO',
        ph: 'SUBIENDO',
        solution: 'Estado normal que la mayoría de las personas encuentran. Nada de qué preocuparse, continúe haciendo lo que está haciendo, a menos que haya otros síntomas en la planta.',
      },
      {
        waterLevel: 'BAJANDO',
        ec: 'ESTÁTICO',
        ph: 'BAJANDO',
        solution: 'Cambio de reservorio además de ajuste de EC. Reduzca la EC si está por encima de 1,4; aumente si está por debajo de 1,0. Probable desequilibrio químico: nutrición proporcional desbalanceada o solución saturada por uso continuo — cambio de reservorio recomendado.',
      },
      {
        waterLevel: 'BAJANDO',
        ec: 'SUBIENDO',
        ph: 'ESTÁTICO',
        solution: 'La planta está bebiendo más de lo que está comiendo, reduzca la EC.',
      },
      {
        waterLevel: 'BAJANDO',
        ec: 'SUBIENDO',
        ph: 'SUBIENDO',
        solution: 'La planta está bebiendo más de lo que está comiendo, reduzca la EC.',
      },
      {
        waterLevel: 'BAJANDO',
        ec: 'SUBIENDO',
        ph: 'BAJANDO',
        solution: 'La planta está bebiendo más de lo que come, reduzca la EC. Si el pH baja de forma persistente, cambie el reservorio (Nota 1 — rizosfera).',
      },
      {
        waterLevel: 'BAJANDO',
        ec: 'BAJANDO',
        ph: 'ESTÁTICO',
        solution: 'La planta tiene hambre, aumente la EC. Situación muy buena. Los tampones de nutrientes están funcionando y la planta está tomando un equilibrio de nutrientes.',
      },
      {
        waterLevel: 'BAJANDO',
        ec: 'BAJANDO',
        ph: 'SUBIENDO',
        solution: 'Casi como arriba, generalmente considerado casi perfecto, aumente la EC levemente.',
      },
      {
        waterLevel: 'BAJANDO',
        ec: 'BAJANDO',
        ph: 'BAJANDO',
        solution: 'Cambio de reservorio. La caída de pH puede reflejar actividad de la rizosfera (Nota 1), pero la planta sigue comiendo y bebiendo. Aumente la EC en el nuevo reservorio.',
      },
    ],
    colorLegend: {
      title: 'Leyenda de colores',
      green:
        'Normal o excelente — la planta consume agua (nivel BAJANDO) y EC/pH estables o en un patrón saludable de la fase.',
      yellow:
        'Atención moderada — cambio de reservorio, ajuste de EC o investigar caída de pH / probable desequilibrio químico.',
      red:
        'Investigar — combinación atípica de nivel, EC y pH; revise nutrición, calibración, VPD (Nota 3) y síntomas visuales.',
      ecFootnote:
        'Las referencias EC 1,0 y 1,4 asumen mS/cm en escala genérica — ajuste siempre a los objetivos de su cultivo, fase y medidor.',
    },
    notes: {
      title: 'Notas Importantes',
      note1: {
        title: 'Nota 1 — pH, rizosfera y corrección química',
        intro:
          'La caída de pH con nivel de agua estático suele reflejar procesos biológicos y químicos en la zona radicular. Comprender el equilibrio ácido-base — y las herramientas simples para corregirlo — convierte las lecturas de la tabla en acción consciente.',
        sections: [
          {
            title: 'Rizosfera e intercambio gaseoso',
            body:
              'Junto a las raíces existe una zona viva — la rizosfera — donde planta, agua y micro-organismos intercambian gases y sustancias todo el tiempo. La respiración radicular libera CO₂; disuelto en la solución, la vuelve ligeramente más ácida, como un soplo continuo e invisible.\n\nLa forma en que la planta se alimenta también mueve el pH: preferencia por amonio tira hacia el ácido; preferencia por nitrato hacia lo básico. Por eso el pH nunca es solo “número del medidor” — es el retrato químico de lo que ocurre en la raíz.',
          },
          {
            title: 'Sistema carbonato — herramienta simple y poderosa',
            body:
              'Imagine el agua del reservorio como un equilibrio delicado entre “más ácida” y “más básica”. Cuando el CO₂ de la respiración radicular — o del aire en contacto con la solución — se disuelve, el agua se vuelve ligeramente más ácida. Es el mismo principio de una bebida gaseosa, pero continuo e invisible.\n\nLas soluciones nutritivas de hidroponía están diluidas a propósito: la planta se alimenta bien, pero el agua casi no tiene colchón químico. Pequeñas entradas de acidez (exudados radiculares, materia orgánica, CO₂) desplazan el pH con rapidez. El medidor reacciona — no es fallo del sensor, es la naturaleza frágil del medio.\n\nAquí entra el sistema carbonato, una de las herramientas más accesibles y baratas del cultivador: carbonato o bicarbonato de potasio. No llenan el tanque “de sal” sin motivo — consumen acidez, pueden liberar CO₂ (a veces visible en burbujas finas) y devuelven potasio útil a la nutrición.\n\nComprender este ciclo — acidez que entra, base que negocia, gas que va y vuelve — da al cultivador un control manual poderoso, con productos comunes, sin depender solo de equipos caros. Química accesible: simple de entender, profunda en efecto, cuando se usa con paciencia y dosis pequeñas.',
          },
          {
            title: 'Ácido fosfórico y carbonato de potasio — dos conceptos de corrección',
            body:
              'Corregir el pH no es “echar sal al agua”. Es restaurar un equilibrio dinámico entre agua, iones, nutrientes y la biología de las raíces.\n\nEl ácido fosfórico (pH−) encarna la idea de entregar acidez — donar protones a la solución. El agua se vuelve más ácida y, al mismo tiempo, el fósforo entra en el ciclo nutritivo. No es un aditivo neutro: altera la química viva del tanque.\n\nEl carbonato de potasio (pH+) encarna el camino opuesto: absorber acidez y devolver potasio, con liberación de CO₂ — el mismo elemento de la respiración radicular, aquí usado de forma controlada para empujar el pH hacia arriba.\n\nComprender estos dos polos evita tratar pH+ y pH− como botones mágicos. Cada corrección es una conversación química: pequeña, pausada, con tiempo para que la solución se mezcle y “respire” antes de una nueva lectura. Las soluciones comerciales diluidas existen justamente para hacer esa conversación más suave y segura para las raíces.',
          },
        ],
        content: '',
      },
      note2: {
        title: 'Nota 2 — Lixiviación de nutrientes',
        content:
          'Cuando el nivel de agua queda ESTÁTICO pero la EC sube, la planta no está bebiendo — está devolviendo nutrientes a la solución. Como un caldo demasiado concentrado: el organismo rechaza en lugar de absorber. Reduzca la EC o cambie el reservorio. Subir la EC solo tiene sentido si confirma que la concentración era demasiado baja para la fase, no alta.',
      },
      vpd: {
        title: 'Nota 3 — VPD (déficit de presión de vapor)',
        intro:
          'EC y pH describen la química de la solución en el reservorio. El VPD describe el “clima de secado” alrededor de la hoja — y explica por qué la planta bebe más o menos aunque la tabla parezca correcta. Ambas miradas se complementan: solución + ambiente.',
        sections: [
          {
            title: 'Qué es, en lenguaje simple',
            body:
              'El VPD mide cuánto el aire aún “tira” humedad de las hojas. Aire caliente y seco → VPD alto → transpiración fuerte y más consumo de agua (nivel BAJANDO acelerado). Aire frío y húmedo → VPD bajo → poca transpiración; la solución cambia lento y el nivel puede parecer ESTÁTICO con metabolismo activo.',
          },
          {
            title: 'Vínculo con la tabla EC / pH / agua',
            body:
              'BAJANDO + EC BAJANDO + pH estable suele ser hambre nutricional — y VPD moderado a alto favorece esa “sed”. BAJANDO + EC SUBIENDO sugiere beber más que comer — común con VPD elevado o EC inicial baja. ESTÁTICO + EC SUBIENDO (Nota 2) puede aparecer con VPD bajo: poca transpiración, acumulación relativa de sales.',
          },
          {
            title: 'Rangos orientativos (kPa)',
            body:
              'Valores de referencia, no dogma: plántula/esqueje ~0,4–0,8 · vegetativo ~0,8–1,2 · flor ~1,0–1,6. Por encima aumenta el estrés hídrico; por debajo reduce transpiración y transporte de nutrientes. Ajuste temperatura, humedad relativa o ventilación antes de forzar EC/pH.',
          },
          {
            title: 'Uso diario',
            body:
              'Con temperatura y humedad del ambiente se calcula el VPD (apps o tablas). Si la tabla está verde pero la planta se marchita → revise VPD alto. Si bebe poco y la EC sube con nivel ESTÁTICO → revise VPD bajo + Nota 2. HIDROWAVE cuida la solución; el cultivador equilibra el aire — juntos cierran el ciclo de la planta.',
          },
        ],
      },
    },
    tips: {
      title: 'Consejos Generales',
      items: [
        'Monitoree nivel de agua, EC, pH y ambiente (temperatura + HR → VPD)',
        'Haga cambios de reservorio regularmente según sea necesario',
        'Ajuste la EC gradualmente - cambios bruscos pueden estresar las plantas',
        'Verifique la calibración de los medidores periódicamente',
        'Observe los síntomas visuales de las plantas junto con las lecturas de los sensores',
      ],
    },
    footer: {
      text: 'Compilado experimentado de Hidroponia',
    },
  },
};

export function getFundamentosTranslation(language: string): FundamentosTranslations {
  return fundamentosTranslations[language] || fundamentosTranslations['pt-BR'];
}

