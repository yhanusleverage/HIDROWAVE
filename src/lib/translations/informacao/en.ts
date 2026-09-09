import type { InformacaoCopy } from './types';

export const informacaoEn: InformacaoCopy = {
  header: {
    title: 'Information',
    subtitle: 'HydroWave user manual — how to operate the system safely',
  },
  quickLinks: [
    {
      id: 'automacao',
      href: '/automacao',
      title: 'Automation',
      description: 'Auto EC, Auto pH, and rules',
    },
    {
      id: 'calibragem',
      href: '/calibragem',
      title: 'Calibration',
      description: 'Pumps, pH, and sensors',
    },
    {
      id: 'fundamentos',
      href: '/fundamentos',
      title: 'Fundamentals',
      description: 'Hydroponic growing theory',
    },
  ],
  technicalDocs: {
    title: 'Technical documentation',
    body: 'For hydraulics, rules, control engineering, and scheduled runs — advanced content beyond this operational manual.',
    supportCta: 'Support — Start Here',
    processosCta: 'Processes and schedules',
  },
  fluxo: {
    title: 'Recommended flow (first time)',
    steps: [
      {
        title: '1. Device online',
        body: 'HydroWave Core connected, sensors publishing EC/pH/level.',
      },
      {
        title: '2. Calibration',
        body: 'Peristaltic pump flow and sensors before trusting Auto EC/pH.',
      },
      {
        title: '3. Plan + parameters',
        body: 'Nutrient table, setpoint, tolerance, intervals — save and enable.',
      },
      {
        title: '4. Monitor status',
        body: 'Deadband, countdown, and last dose confirm the loop is closed.',
      },
    ],
  },
  faq: {
    title: 'Frequently asked questions',
    items: [
      {
        question: 'How do I connect my ESP32 device?',
        answer:
          'Configure Wi‑Fi in the ESP32 firmware and make sure it is on the same network as the server. Open Devices to confirm HydroWave Core shows online and is sending telemetry.',
      },
      {
        question: 'How do I use Auto EC (step by step)?',
        answerKind: 'autoEc',
        steps: [
          {
            text: 'In Automation, open nutritional control (unlock with password if prompted).',
          },
          {
            text: 'Nutrients — register each part of the plan (A, B, C…), pick the pump and the dose in ml per liter of tank water. Calibrate flow in ',
            link: { href: '/calibragem', label: 'Calibration' },
            textAfter: '.',
          },
          {
            text: 'EC target — enter the desired solution EC and the tolerance band. The system only adds nutrients when EC is below the target (outside the band, on the low side).',
          },
          {
            text: 'Pace — how often to measure EC, and how long to mix (recirculation) after each dose.',
          },
          {
            text: 'Save Parameters, then Enable Auto EC. The controller starts dosing on its own according to the plan.',
          },
          {
            text: 'Watch the status: in band, mixing, or dosing. If EC rises too high, configure drain and water refill (dilution) further down in the same panel.',
          },
        ],
      },
      {
        question: 'What is the tolerance band in Auto EC?',
        answer:
          'It is the “slack” around the desired EC so the system does not dose constantly. E.g. target 1500 µS/cm and tolerance 50 → no action between 1450 and 1550. Nutrients only enter when EC is below the target (outside the band, on the low side). The same idea applies to Auto pH.',
      },
      {
        question: 'Measurement interval vs pause between nutrients?',
        answer:
          'They are different. The interval (e.g. 5 minutes) is how often the system checks tank EC. The short pause between one nutrient and the next in the same dose is only for safe mixing — growers do not need to tune that.',
      },
      {
        question: 'Why can’t I enable Auto EC?',
        answer:
          'You need at least one nutrient with a valid dose (min. 0.1 ml/L). Remove empty rows or increase the dose. Save parameters before enabling.',
      },
      {
        question: 'How do I configure automation rules?',
        answer:
          'In Automation, create rules with conditions (e.g. pH < 5.5) and actions (e.g. activate a relay). Script-based rules use the instruction editor.',
      },
      {
        question: 'What if sensors are not sending data?',
        answer:
          'Check power, Wi‑Fi, and status under Devices. Recalibrate pH/TDS if readings are stable but incorrect.',
      },
    ],
  },
  guides: {
    title: 'Quick guides',
    items: [
      {
        title: 'Auto EC — control loop',
        body: 'Setpoint + tolerance define when to dose. Error = EC − setpoint. Status shows “Within tolerance” or “Adjustment needed”.',
      },
      {
        title: 'Sensor calibration',
        body: 'pH at two points; TDS/EC with standard solution. Repeat after changing probe or solution.',
      },
      {
        title: 'Troubleshooting',
        body: 'Device offline → Wi‑Fi/power. Auto EC won’t enable → nutrients and total_ml. Equation with invalid k → ml/L zeroed.',
      },
    ],
  },
  support: {
    title: 'Support',
    intro: 'Questions not covered here? Get in touch:',
    email: '📧 Email: suporte@hydrowave.com',
    chat: '💬 Chat: business hours',
    plansCta: 'View commercial plans and services →',
  },
};
