import type { QuemSomosCopy } from './types';

export const quemSomosEn: QuemSomosCopy = {
  hero: {
    eyebrow: 'Who we are',
    title: 'Master the',
    titleHighlight: 'elements of hydroponics',
    subtitle:
      'pH, EC, temperature, level, and flow are quiet forces that decide your harvest. HydroWave was built to put each of them in your hands — with the clarity of someone who needs to harvest tomorrow, not after a PhD.',
  },
  mission: {
    title: 'Our mission, in one sentence',
    body:
      'Control the nuances of the variables that govern hydroponics — nutrient strength (EC), acidity (pH), temperature, volume, and time — and deliver them to you as working tools, not laboratory puzzles.',
    aside:
      'We think of hydroponics as a system of elements: electronics that sense, hydraulics that move, chemistry that balances, nutrition that feeds, environment that monitors, telemetry that reveals, and connectivity that ties it all together.',
  },
  manifesto: {
    eyebrow: 'Philosophy',
    lead: 'Efficiency is not doing more.',
    subtitle: 'It is achieving the best result with the least necessary.',
    paragraphs: [
      'When every action happens at the right moment, every resource finds its purpose. Balance replaces excess, precision eliminates waste, and performance becomes a natural consequence.',
      'Control is born from understanding. Simplicity is born from order. Excellence is born from harmony among all the parts.',
      'Because every system reaches its greatest potential when nothing is wasted and everything has a reason to exist.',
    ],
  },
  elements: [
    {
      id: 'electronics',
      element: 'Electronics',
      title: 'The Nerve of the System',
      subtitle: 'Controller · sensors · pumps · relays',
      technicalDetail: 'Tank controller · sensors · dosing pumps · switches',
      plain:
        'We build the hardware that measures, decides, and acts at the reservoir — so you do not have to stare at the tank all day.',
      tagline: 'Every pulse, every reading, every relay — precision in the field.',
      href: '/dispositivos',
      ctaLabel: 'View devices',
      accent: 'warn',
    },
    {
      id: 'hydraulics',
      element: 'Hydraulics',
      title: 'Command of the Waters',
      subtitle: 'Level · recirculation · nutrient solution',
      technicalDetail: 'Level sensing · recirculation timing · tank volume',
      plain:
        'We monitor what goes in, what goes out, and what the plant consumes — because hydroponics is liquid balance, not luck.',
      tagline: 'Volume, flow, and mix under control.',
      href: '/dispositivos',
      ctaLabel: 'View devices',
      accent: 'wait',
    },
    {
      id: 'chemistry',
      element: 'Chemistry',
      title: 'Acid-Base Balance',
      subtitle: 'Auto pH · calibration · deadband',
      technicalDetail: 'Auto pH · tolerance band · dose limit per cycle',
      plain:
        'Small acidity shifts change everything. The system corrects within the tolerance you set — clear, predictable, safe.',
      tagline: 'Stable pH is a predictable harvest.',
      href: '/automacao',
      ctaLabel: 'Configure Auto pH',
      accent: 'ph',
    },
    {
      id: 'nutrition',
      element: 'Nutrition',
      title: 'Solution Strength',
      subtitle: 'Auto EC · nutrient plan · proportional dose',
      technicalDetail: 'EC target · deadband · each nutrient dosed in the right order',
      plain:
        'EC is the nutrient strength of your crop. We calculate the right dose, respect the deadband, and act only when it makes sense.',
      tagline: 'Nutrients measured — neither shortage nor excess.',
      href: '/automacao',
      ctaLabel: 'Configure Auto EC',
      accent: 'ec',
    },
    {
      id: 'environment',
      element: 'Environment',
      title: 'Solution Climate',
      subtitle: 'Water temperature · alerts · trends',
      technicalDetail:
        'Water temperature sensor · panel history · alerts in the range you define',
      plain:
        'Temperature changes oxygenation and nutrient uptake. We track the water and alert when it leaves the ideal range — without promising climate control that does not exist yet.',
      tagline: 'Monitor before correcting in the dark.',
      href: '/dashboard',
      ctaLabel: 'View temperature',
      accent: 'ok',
    },
    {
      id: 'telemetry',
      element: 'Telemetry',
      title: 'Real-Time Vision',
      subtitle: 'Dashboard · charts · cycle status',
      technicalDetail: 'Live updates · pH/EC/temp chart · sensor cards',
      plain:
        'Everything that happens in the field reaches your panel: pH, EC, temperature, and cycle status — in one place.',
      tagline: 'Decide with data, not guesswork.',
      href: '/dashboard',
      ctaLabel: 'Open dashboard',
      accent: 'brand',
    },
    {
      id: 'connectivity',
      element: 'Connectivity',
      title: 'Field-to-Cloud Bridge',
      subtitle: 'Wi‑Fi · cloud · phone alerts',
      technicalDetail: 'Wi‑Fi · cloud · continuous reading · alert if the device drops offline',
      plain:
        'The equipment talks to the cloud in real time. You know it is online before a problem turns into a loss.',
      tagline: 'The tank is never left alone.',
      href: '/informacao',
      ctaLabel: 'User manual',
      accent: 'brand',
    },
  ],
  socialProof: [
    {
      title: 'Validated pilot',
      description:
        'Closed-loop Auto EC, real-time telemetry, and assisted calibration — bench-tested before it reaches the greenhouse.',
      highlight: 'From sensor to confirmed dose',
      href: '/informacao',
      ctaLabel: 'See recommended flow',
      accent: 'ok',
    },
    {
      title: 'Commercial operation',
      description:
        'Pro and Enterprise plans for production greenhouses: extended history, priority alerts, and dedicated support.',
      highlight: 'Scales with your operation',
      href: '/planos',
      ctaLabel: 'View plans',
      accent: 'brand',
    },
    {
      title: 'Transparency',
      description:
        'Deadband, dose limit per cycle, and calibration before you trust automation — no surprises in the tank.',
      highlight: 'Automation with clear limits',
      href: '/fundamentos',
      ctaLabel: 'Growing fundamentals',
      accent: 'ph',
    },
  ],
  beforeAfter: [
    {
      without: 'Measure pH by hand and correct by feel',
      with: 'Auto pH with tolerance and dose limit per cycle',
    },
    {
      without: 'EC drifting between tank visits',
      with: 'Proportional Auto EC, dashboard chart, and daily EC consumption',
    },
    {
      without: 'Not knowing if the equipment is online',
      with: 'Device status + real-time alerts',
    },
    {
      without: 'Dosing nutrients without knowing if the pump is calibrated',
      with: 'Pump calibration and validation before enabling automation',
    },
  ],
  productLine: {
    title: 'The HydroWave line',
    subtitle: 'Three boxes. One system. Clear names for the field.',
    modules: [
      {
        name: 'HydroWave Core',
        role: 'Central controller',
        body: 'The brain of the tank. Sensors, rules, and network in one box.',
        accent: 'brand',
      },
      {
        name: 'HydroWave Atlas',
        role: 'Relays and valves',
        body: 'Carries the field load. Valves, pumps, and relays under command.',
        accent: 'wait',
      },
      {
        name: 'HydroWave Pulse',
        role: 'pH/EC dosing module',
        body: 'The nutrient pulse. pH and EC in the right proportion.',
        accent: 'ec',
      },
    ],
  },
  journey: [
    {
      step: '01',
      layer: 'Field',
      detail:
        'pH, EC, and level sensors. Calibrated peristaltic pumps. Relays mapped by function.',
    },
    {
      step: '02',
      layer: 'Controller',
      detail:
        'Firmware that reads, compares to setpoint, respects tolerance, and doses with cycle logic.',
    },
    {
      step: '03',
      layer: 'Cloud',
      detail: 'Secure telemetry, history, and remote commands — your greenhouse connected to the world.',
    },
    {
      step: '04',
      layer: 'You',
      detail:
        'Intuitive dashboard, Auto EC, Auto pH, calibration, and rules — high-level control, plain language.',
    },
  ],
  promises: [
    'No unnecessary jargon: we explain what matters for your harvest.',
    'Automation that respects limits — deadband, intervals, and calibration before you trust it.',
    'From pilot kit to commercial operation: we scale with you, not against you.',
    'Built by people who live real hydroponics, not just marketing slides.',
  ],
  cta: {
    title: 'Your greenhouse deserves high-level control',
    subtitle:
      'The instruments are ready. Start with the dashboard or talk to us about commercial operation.',
  },
  teaser: {
    title: 'Meet Core · Atlas · Pulse',
    subtitle:
      'Efficiency is not doing more — it is the best result with the least necessary. See the HydroWave line and the elements of cultivation.',
    cta: 'Who we are',
  },
  ui: {
    howItWorks: 'How it works',
    promisesTitle: 'What we promise — no fine print',
    trustTitle: 'Why growers trust us',
    trustSubtitle: 'Tested product, plans to scale, and automation with clear limits.',
    beforeAfterTitle: 'Before and after',
    beforeAfterSubtitle:
      'What changes when the variables of hydroponics finally have an instrument.',
    withoutHw: 'Without HydroWave',
    withHw: 'With HydroWave',
    elementsTitle: 'The elements of control',
    elementsSubtitle:
      'Each variable mapped to a real product domain — from the tank sensor to the chart on your phone.',
    journeyTitle: 'From silicon to your fingertip',
    journeySubtitle: 'The complete bridge — from the tank sensor to the chart on your phone.',
    ctaDashboard: 'Go to the Dashboard',
    ctaPlans: 'View commercial plans',
    ctaManual: 'User manual →',
    footer: 'HydroWave — nothing wasted, everything with purpose.',
  },
};
