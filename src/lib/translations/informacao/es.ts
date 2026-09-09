import type { InformacaoCopy } from './types';

export const informacaoEs: InformacaoCopy = {
  header: {
    title: 'Información',
    subtitle: 'Manual de uso de HydroWave — cómo operar el sistema con seguridad',
  },
  quickLinks: [
    {
      id: 'automacao',
      href: '/automacao',
      title: 'Automatización',
      description: 'Auto EC, Auto pH y reglas',
    },
    {
      id: 'calibragem',
      href: '/calibragem',
      title: 'Calibración',
      description: 'Bombas, pH y sensores',
    },
    {
      id: 'fundamentos',
      href: '/fundamentos',
      title: 'Fundamentos',
      description: 'Teoría de cultivo hidropónico',
    },
  ],
  technicalDocs: {
    title: 'Documentación técnica',
    body: 'Para hidráulica, reglas, ingeniería de control y ejecuciones programadas — contenido avanzado que no cabe en este manual operativo.',
    supportCta: 'Support — Start Here',
    processosCta: 'Procesos y schedules',
  },
  fluxo: {
    title: 'Flujo recomendado (primera vez)',
    steps: [
      {
        title: '1. Dispositivo en línea',
        body: 'HydroWave Core conectado, sensores publicando EC/pH/nivel.',
      },
      {
        title: '2. Calibración',
        body: 'Caudal de bombas peristálticas y sensores antes de confiar en Auto EC/pH.',
      },
      {
        title: '3. Plan + parámetros',
        body: 'Tabla nutricional, setpoint, tolerancia, intervalos — guardar y activar.',
      },
      {
        title: '4. Monitorear estado',
        body: 'Banda muerta, countdown y última dosificación confirman que el loop está cerrado.',
      },
    ],
  },
  faq: {
    title: 'Preguntas frecuentes',
    items: [
      {
        question: '¿Cómo conecto mi dispositivo ESP32?',
        answer:
          'Configure el Wi‑Fi en el firmware del ESP32 y asegúrese de que esté en la misma red que el servidor. Abra Dispositivos para verificar que HydroWave Core aparece en línea y enviando telemetría.',
      },
      {
        question: '¿Cómo uso Auto EC (paso a paso)?',
        answerKind: 'autoEc',
        steps: [
          {
            text: 'En Automatización, abra el control nutricional (desbloquee con contraseña si lo pide).',
          },
          {
            text: 'Nutrientes — registre cada parte del plan (A, B, C…), elija la bomba y la dosis en ml por litro de agua del tanque. Calibre el caudal en ',
            link: { href: '/calibragem', label: 'Calibración' },
            textAfter: '.',
          },
          {
            text: 'Objetivo de EC — indique el EC deseado de la solución y la banda de tolerancia. El sistema solo añade nutrientes cuando el EC está por debajo del objetivo (fuera de la banda, por abajo).',
          },
          {
            text: 'Ritmo — cada cuánto medir el EC, y cuánto tiempo mezclar (recirculación) después de cada dosis.',
          },
          {
            text: 'Guardar Parámetros y luego Activar Auto EC. El controlador pasa a dosificar solo según el plan.',
          },
          {
            text: 'Siga el estado: si está en banda, mezclando o dosificando. Si el EC sube demasiado, configure drenaje y reposición de agua (dilución) más abajo en el mismo panel.',
          },
        ],
      },
      {
        question: '¿Qué es la banda de tolerancia en Auto EC?',
        answer:
          'Es el “margen” alrededor del EC deseado para no dosificar a cada rato. Ej.: objetivo 1500 µS/cm y tolerancia 50 → sin acción entre 1450 y 1550. Los nutrientes solo entran cuando el EC está por debajo del objetivo (fuera de la banda, por abajo). La misma idea vale en Auto pH.',
      },
      {
        question: '¿Intervalo de medición vs pausa entre nutrientes?',
        answer:
          'Son cosas distintas. El intervalo (ej.: 5 minutos) es cada cuánto el sistema mira el EC del tanque. La pausa corta entre un nutriente y otro en la misma dosis es solo para mezclar con seguridad — el cultivador no necesita ajustar eso.',
      },
      {
        question: '¿Por qué no puedo activar Auto EC?',
        answer:
          'Se necesita al menos un nutriente con dosis válida (mín. 0,1 ml/L). Elimine filas vacías o aumente la dosis. Guarde los parámetros antes de activar.',
      },
      {
        question: '¿Cómo configuro reglas de automatización?',
        answer:
          'En Automatización, cree reglas con condiciones (ej.: pH < 5.5) y acciones (ej.: activar relé). Las reglas con script usan el editor de instrucciones.',
      },
      {
        question: '¿Qué hago si los sensores no envían datos?',
        answer:
          'Verifique alimentación, Wi‑Fi y estado en Dispositivos. Recalibre pH/TDS si las lecturas están estables pero incorrectas.',
      },
    ],
  },
  guides: {
    title: 'Guías rápidas',
    items: [
      {
        title: 'Auto EC — loop de control',
        body: 'Setpoint + tolerancia definen cuándo dosificar. Error = EC − setpoint. El estado muestra “Dentro de la tolerancia” o “Ajuste necesario”.',
      },
      {
        title: 'Calibración de sensores',
        body: 'pH en dos puntos; TDS/EC según solución estándar. Repita tras cambiar sonda o solución.',
      },
      {
        title: 'Solución de problemas',
        body: 'Dispositivo offline → Wi‑Fi/alimentación. Auto EC no activa → nutrientes y total_ml. Ecuación con k inválido → ml/L en cero.',
      },
    ],
  },
  support: {
    title: 'Soporte',
    intro: '¿Dudas no cubiertas aquí? Contáctenos:',
    email: '📧 Email: suporte@hydrowave.com',
    chat: '💬 Chat: horario comercial',
    plansCta: 'Ver planes y servicios comerciales →',
  },
};
