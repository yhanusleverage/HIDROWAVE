import type { QuemSomosCopy } from './types';

export const quemSomosEs: QuemSomosCopy = {
  hero: {
    eyebrow: 'Quiénes somos',
    title: 'Domina los',
    titleHighlight: 'elementos de la hidroponía',
    subtitle:
      'pH, EC, temperatura, nivel y flujo son fuerzas silenciosas que deciden tu cosecha. HydroWave nació para poner cada una en tus manos — con la claridad de quien necesita cosechar mañana, no después de un doctorado.',
  },
  mission: {
    title: 'Nuestra misión, en una frase',
    body:
      'Controlar los matices de las magnitudes que gobiernan la hidroponía — concentración nutritiva (EC), acidez (pH), temperatura, volumen y tiempo — y entregártelas como herramientas de trabajo, no como enigmas de laboratorio.',
    aside:
      'Pensamos la hidroponía como un sistema de elementos: electrónica que siente, hidráulica que mueve, química que equilibra, nutrición que alimenta, ambiente que monitorea, telemetría que revela y conectividad que lo une todo.',
  },
  manifesto: {
    eyebrow: 'Filosofía',
    lead: 'Eficiencia no es hacer más.',
    subtitle: 'Es lograr el mejor resultado con lo mínimo necesario.',
    paragraphs: [
      'Cuando cada acción ocurre en el momento justo, cada recurso encuentra su propósito. El equilibrio sustituye al exceso, la precisión elimina el desperdicio y el desempeño se vuelve una consecuencia natural.',
      'El control nace de la comprensión. La simplicidad nace del orden. La excelencia nace de la armonía entre todas las partes.',
      'Porque todo sistema alcanza su mayor potencial cuando nada se desperdicia y todo tiene una razón para existir.',
    ],
  },
  elements: [
    {
      id: 'electronics',
      element: 'Electrónica',
      title: 'El Nervio del Sistema',
      subtitle: 'Controlador · sensores · bombas · relés',
      technicalDetail: 'Controlador en el tanque · sensores · bombas de dosis · interruptores',
      plain:
        'Construimos el hardware que mide, decide y actúa en el reservorio — sin que tengas que mirar el tanque todo el día.',
      tagline: 'Cada pulso, cada lectura, cada relé — precisión en el campo.',
      href: '/dispositivos',
      ctaLabel: 'Ver dispositivos',
      accent: 'warn',
    },
    {
      id: 'hydraulics',
      element: 'Hidráulica',
      title: 'Dominio de las Aguas',
      subtitle: 'Nivel · recirculación · solución nutritiva',
      technicalDetail: 'Medición de nivel · tiempo de recirculación · volumen del tanque',
      plain:
        'Monitoreamos lo que entra, lo que sale y lo que la planta consume — porque la hidroponía es equilibrio líquido, no suerte.',
      tagline: 'Volumen, flujo y mezcla bajo control.',
      href: '/dispositivos',
      ctaLabel: 'Ver dispositivos',
      accent: 'wait',
    },
    {
      id: 'chemistry',
      element: 'Química',
      title: 'Equilibrio Ácido-Base',
      subtitle: 'Auto pH · calibración · banda muerta',
      technicalDetail: 'Auto pH · rango de tolerancia · límite de dosis por ciclo',
      plain:
        'Pequeñas variaciones de acidez lo cambian todo. El sistema corrige dentro de la tolerancia que defines — claro, predecible, seguro.',
      tagline: 'pH estable es cosecha predecible.',
      href: '/automacao',
      ctaLabel: 'Configurar Auto pH',
      accent: 'ph',
    },
    {
      id: 'nutrition',
      element: 'Nutrición',
      title: 'Fuerza de la Solución',
      subtitle: 'Auto EC · plan nutricional · dosis proporcional',
      technicalDetail: 'Meta de EC · banda muerta · dosis de cada nutriente en el orden correcto',
      plain:
        'EC es la fuerza nutritiva de tu cultivo. Calculamos la dosis justa, respetamos la banda muerta y solo actuamos cuando tiene sentido.',
      tagline: 'Nutrientes a medida — ni falta ni exceso.',
      href: '/automacao',
      ctaLabel: 'Configurar Auto EC',
      accent: 'ec',
    },
    {
      id: 'environment',
      element: 'Ambiente',
      title: 'Clima de la Solución',
      subtitle: 'Temperatura del agua · alertas · tendencias',
      technicalDetail:
        'Sensor de temperatura del agua · historial en el panel · alertas en el rango que defines',
      plain:
        'La temperatura cambia la oxigenación y la absorción de nutrientes. Seguimos el agua y avisamos cuando sale del rango ideal — sin prometer un control climático que aún no existe.',
      tagline: 'Monitorear antes de corregir a ciegas.',
      href: '/dashboard',
      ctaLabel: 'Ver temperatura',
      accent: 'ok',
    },
    {
      id: 'telemetry',
      element: 'Telemetría',
      title: 'Visión en Tiempo Real',
      subtitle: 'Dashboard · gráficos · estado de los ciclos',
      technicalDetail: 'Actualización en vivo · gráfico de pH/EC/temp · tarjetas de sensores',
      plain:
        'Todo lo que ocurre en el campo llega a tu panel: pH, EC, temperatura y estado de los ciclos — en un solo lugar.',
      tagline: 'Decisión con datos, no con intuición.',
      href: '/dashboard',
      ctaLabel: 'Abrir dashboard',
      accent: 'brand',
    },
    {
      id: 'connectivity',
      element: 'Conectividad',
      title: 'Puente Campo-Nube',
      subtitle: 'Wi‑Fi · nube · alertas en el celular',
      technicalDetail: 'Wi‑Fi · nube · lectura continua · aviso si el equipo se cae',
      plain:
        'El equipo habla con la nube en tiempo real. Sabes si está en línea antes de que un problema se convierta en pérdida.',
      tagline: 'El tanque nunca queda solo.',
      href: '/informacao',
      ctaLabel: 'Manual de uso',
      accent: 'brand',
    },
  ],
  socialProof: [
    {
      title: 'Piloto validado',
      description:
        'Auto EC en lazo cerrado, telemetría en tiempo real y calibración asistida — probado en banco antes de llegar al invernadero.',
      highlight: 'Del sensor a la dosis confirmada',
      href: '/informacao',
      ctaLabel: 'Ver flujo recomendado',
      accent: 'ok',
    },
    {
      title: 'Operación comercial',
      description:
        'Planes Pro y Enterprise para invernaderos en producción: historial ampliado, alertas prioritarias y soporte dedicado.',
      highlight: 'Escala con tu operación',
      href: '/planos',
      ctaLabel: 'Ver planes',
      accent: 'brand',
    },
    {
      title: 'Transparencia',
      description:
        'Banda muerta, límite de dosis por ciclo y calibración antes de confiar en lo automático — sin sorpresas en el tanque.',
      highlight: 'Automatización con límites claros',
      href: '/fundamentos',
      ctaLabel: 'Fundamentos de cultivo',
      accent: 'ph',
    },
  ],
  beforeAfter: [
    {
      without: 'Medir pH a mano y corregir a ojo',
      with: 'Auto pH con tolerancia y límite de dosis por ciclo',
    },
    {
      without: 'EC oscilando entre visitas al tanque',
      with: 'Auto EC proporcional, gráfico en el dashboard y consumo diario de EC',
    },
    {
      without: 'No saber si el equipo está en línea',
      with: 'Estado del dispositivo + alertas en tiempo real',
    },
    {
      without: 'Dosificar nutrientes sin saber si la bomba está calibrada',
      with: 'Calibración de bombas y validación antes de activar lo automático',
    },
  ],
  productLine: {
    title: 'La línea HydroWave',
    subtitle: 'Tres cajas. Un sistema. Nombres claros para el campo.',
    modules: [
      {
        name: 'HydroWave Core',
        role: 'Controlador central',
        body: 'El cerebro del tanque. Sensores, reglas y red en una caja.',
        accent: 'brand',
      },
      {
        name: 'HydroWave Atlas',
        role: 'Relés y válvulas',
        body: 'Sostiene la carga del campo. Válvulas, bombas y relés bajo comando.',
        accent: 'wait',
      },
      {
        name: 'HydroWave Pulse',
        role: 'Módulo dosificador pH/EC',
        body: 'El pulso del nutriente. pH y EC en la proporción correcta.',
        accent: 'ec',
      },
    ],
  },
  journey: [
    {
      step: '01',
      layer: 'Campo',
      detail:
        'Sensores de pH, EC y nivel. Bombas peristálticas calibradas. Relés mapeados por función.',
    },
    {
      step: '02',
      layer: 'Controlador',
      detail:
        'Firmware que lee, compara con el setpoint, respeta la tolerancia y dosifica con lógica de ciclo.',
    },
    {
      step: '03',
      layer: 'Nube',
      detail: 'Telemetría segura, historial y comandos remotos — tu invernadero conectado al mundo.',
    },
    {
      step: '04',
      layer: 'Tú',
      detail:
        'Dashboard intuitivo, Auto EC, Auto pH, calibración y reglas — control de alto nivel, lenguaje simple.',
    },
  ],
  promises: [
    'Sin jerga innecesaria: explicamos lo que importa para tu cosecha.',
    'Automatización que respeta límites — banda muerta, intervalos y calibración antes de confiar.',
    'Del kit piloto a la operación comercial: escalamos contigo, no contra ti.',
    'Hecho por quien vive la hidroponía de verdad, no solo diapositivas de marketing.',
  ],
  cta: {
    title: 'Tu invernadero merece control de alto nivel',
    subtitle:
      'Los instrumentos ya están listos. Empieza por el dashboard o háblanos sobre operación comercial.',
  },
  teaser: {
    title: 'Conoce Core · Atlas · Pulse',
    subtitle:
      'Eficiencia no es hacer más — es el mejor resultado con lo mínimo necesario. Mira la línea HydroWave y los elementos del cultivo.',
    cta: 'Quiénes somos',
  },
  ui: {
    howItWorks: 'Cómo funciona',
    promisesTitle: 'Lo que prometemos — sin letra pequeña',
    trustTitle: 'Por qué confían los cultivadores',
    trustSubtitle: 'Producto probado, planes para escalar y automatización con límites claros.',
    beforeAfterTitle: 'Antes y después',
    beforeAfterSubtitle:
      'Qué cambia cuando las magnitudes de la hidroponía pasan a tener instrumento.',
    withoutHw: 'Sin HydroWave',
    withHw: 'Con HydroWave',
    elementsTitle: 'Los elementos del control',
    elementsSubtitle:
      'Cada magnitud mapeada a un dominio real del producto — del sensor en el tanque al gráfico en el celular.',
    journeyTitle: 'Del silicio a tu dedo',
    journeySubtitle: 'El puente completo — del sensor en el tanque al gráfico en el celular.',
    ctaDashboard: 'Ir al Dashboard',
    ctaPlans: 'Ver planes comerciales',
    ctaManual: 'Manual de uso →',
    footer: 'HydroWave — nada desperdiciado, todo con propósito.',
  },
};
