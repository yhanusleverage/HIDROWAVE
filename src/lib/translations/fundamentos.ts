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
  notes: {
    title: string;
    note1: {
      title: string;
      content: string;
    };
    note2: {
      title: string;
      content: string;
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
    subtitle: 'Soluções para Mudanças em Nível de Água, EC e pH',
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
        solution: 'Causa usual disso é quando o meio foi enxaguado em um pH mais baixo do que você requer. A outra possibilidade é que muito CO₂ foi bombeado na água. Veja Nota 1. Troque seu reservatório e observe o volume de ar bombeado, além de verificar sua fonte de ar.',
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
        solution: 'Como acima, mas esteja ciente do efeito de chuva ácida mencionado na nota 1. Troca de reservatório, além de aumento na EC.',
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
        solution: 'pH caindo junto com EC caindo, mas sem queda no nível de água sugere uma troca de reservatório. Também pode ser um efeito de chuva ácida conforme nota 1. Dependendo de outros sintomas, reduzir EC após troca de reservatório.',
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
        solution: 'Troca de reservatório além de uma mudança na EC. Reduza a EC se estiver acima de 1,4, aumente a EC se estiver abaixo de 1,0.',
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
        solution: 'Planta está bebendo mais do que comendo, reduza a EC. Além disso, troca de reservatório devido a possível problema de chuva ácida.',
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
        solution: 'Troca de reservatório. Possível problema de chuva ácida, mas a planta ainda está comendo e bebendo. Aumente a EC no novo reservatório.',
      },
    ],
    notes: {
      title: 'Notas Importantes',
      note1: {
        title: 'Nota 1 - Efeito de Chuva Ácida',
        content: 'Quando muito CO₂ é bombeado na água ou quando há uma fonte de ar contaminada, pode ocorrer um efeito de "chuva ácida" que causa queda no pH. Verifique o volume de ar bombeado e a qualidade da fonte de ar. Considere trocar o reservatório se o problema persistir.',
      },
      note2: {
        title: 'Nota 2 - Lixiviação de Nutrientes',
        content: 'Quando a EC está subindo enquanto o nível de água permanece estático, isso indica que a planta está liberando nutrientes de volta para a solução. Isso geralmente significa que a concentração de nutrientes está muito alta e a planta não consegue absorvê-los adequadamente. Aumentar a EC pode parecer contraproducente, mas pode ajudar a reequilibrar a solução.',
      },
    },
    tips: {
      title: 'Dicas Gerais',
      items: [
        'Monitore regularmente os níveis de água, EC e pH',
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
    subtitle: 'Solutions for Changes in Water Level, EC and pH',
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
        solution: 'The usual cause for this is when the medium was flushed at a lower pH than you require. The other possibility is that too much CO₂ was pumped into the water. See Note 1. Change your reservoir and observe the volume of air pumped, in addition to checking your air source.',
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
        solution: 'As above, but be aware of the acid rain effect mentioned in note 1. Reservoir change, in addition to increasing EC.',
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
        solution: 'pH falling along with EC falling, but without a drop in water level suggests a reservoir change. It can also be an acid rain effect as per note 1. Depending on other symptoms, reduce EC after reservoir change.',
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
        solution: 'Reservoir change in addition to an EC change. Reduce EC if it is above 1.4, increase EC if it is below 1.0.',
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
        solution: 'Plant is drinking more than eating, reduce the EC. Also, reservoir change due to possible acid rain problem.',
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
        solution: 'Reservoir change. Possible acid rain problem, but the plant is still eating and drinking. Increase the EC in the new reservoir.',
      },
    ],
    notes: {
      title: 'Important Notes',
      note1: {
        title: 'Note 1 - Acid Rain Effect',
        content: 'When too much CO₂ is pumped into the water or when there is a contaminated air source, an "acid rain" effect can occur, causing a drop in pH. Check the volume of air pumped and the quality of the air source. Consider changing the reservoir if the problem persists.',
      },
      note2: {
        title: 'Note 2 - Nutrient Leaching',
        content: 'When the EC is rising while the water level remains static, this indicates that the plant is releasing nutrients back into the solution. This generally means that the nutrient concentration is too high and the plant cannot absorb them adequately. Increasing the EC may seem counterproductive, but it can help rebalance the solution.',
      },
    },
    tips: {
      title: 'General Tips',
      items: [
        'Regularly monitor water, EC, and pH levels',
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
    subtitle: 'Soluciones para Cambios en Nivel de Agua, EC y pH',
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
        solution: 'La causa usual de esto es cuando el medio se enjuagó a un pH más bajo del que requiere. La otra posibilidad es que se bombeó demasiado CO₂ en el agua. Ver Nota 1. Cambie su reservorio y observe el volumen de aire bombeado, además de verificar su fuente de aire.',
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
        solution: 'Como arriba, pero esté consciente del efecto de lluvia ácida mencionado en la nota 1. Cambio de reservorio, además de aumentar la EC.',
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
        solution: 'pH bajando junto con EC bajando, pero sin caída en el nivel de agua sugiere un cambio de reservorio. También puede ser un efecto de lluvia ácida según la nota 1. Dependiendo de otros síntomas, reducir EC después del cambio de reservorio.',
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
        solution: 'Cambio de reservorio además de un cambio en la EC. Reduzca la EC si está por encima de 1,4, aumente la EC si está por debajo de 1,0.',
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
        solution: 'La planta está bebiendo más de lo que está comiendo, reduzca la EC. Además, cambio de reservorio debido a posible problema de lluvia ácida.',
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
        solution: 'Cambio de reservorio. Posible problema de lluvia ácida, pero la planta todavía está comiendo y bebiendo. Aumente la EC en el nuevo reservorio.',
      },
    ],
    notes: {
      title: 'Notas Importantes',
      note1: {
        title: 'Nota 1 - Efecto de Lluvia Ácida',
        content: 'Cuando se bombea demasiado CO₂ en el agua o cuando hay una fuente de aire contaminada, puede ocurrir un efecto de "lluvia ácida" que causa una caída en el pH. Verifique el volumen de aire bombeado y la calidad de la fuente de aire. Considere cambiar el reservorio si el problema persiste.',
      },
      note2: {
        title: 'Nota 2 - Lixiviación de Nutrientes',
        content: 'Cuando la EC está subiendo mientras el nivel de agua permanece estático, esto indica que la planta está liberando nutrientes de vuelta a la solución. Esto generalmente significa que la concentración de nutrientes es demasiado alta y la planta no puede absorberlos adecuadamente. Aumentar la EC puede parecer contraproducente, pero puede ayudar a reequilibrar la solución.',
      },
    },
    tips: {
      title: 'Consejos Generales',
      items: [
        'Monitoree regularmente los niveles de agua, EC y pH',
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

