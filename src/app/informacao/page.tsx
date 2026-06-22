'use client';

import React, { useState } from 'react';
import NavLink from '@/components/NavLink';
import BrandLogo from '@/components/BrandLogo';
import {
  QuestionMarkCircleIcon,
  BookOpenIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  LightBulbIcon,
  BeakerIcon,
  Cog6ToothIcon,
  AcademicCapIcon,
  QueueListIcon,
} from '@heroicons/react/24/outline';

interface FAQ {
  question: string;
  answer: React.ReactNode;
}

export default function InformacaoPage() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

  const faqs: FAQ[] = [
    {
      question: 'Como conectar meu dispositivo ESP32?',
      answer:
        'Configure o WiFi no firmware do ESP32 e garanta que ele esteja na mesma rede do servidor. Acesse Dispositivos para verificar se o master aparece online e enviando telemetria.',
    },
    {
      question: 'Como usar o Auto EC (passo a passo)?',
      answer: (
        <ol className="list-decimal list-inside space-y-2 mt-1">
          <li>
            <strong>Automação → Controle Nutricional Proporcional</strong> — desbloqueie com senha admin se necessário.
          </li>
          <li>
            <strong>Plano nutricional</strong> — adicione nutrientes, associe relés e ml/L. Calibre a bomba em{' '}
            <NavLink href="/calibragem" className="text-aqua-400 hover:underline">Calibragem</NavLink>.
          </li>
          <li>
            <strong>Parâmetros hidropônicos</strong> — base de dose (EC da solução stock), setpoint e{' '}
            <strong>tolerância (banda morta)</strong>. O ESP32 só dosifica se |EC − setpoint| &gt; tolerância.
          </li>
          <li>
            <strong>Parâmetros de ciclo</strong> — intervalo entre <em>verificações</em> de EC e tempo de recirculação após cada dose.
          </li>
          <li>
            <strong>Salvar Parâmetros</strong>, depois <strong>Ativar Auto EC</strong>. A config é enviada via RPC{' '}
            <code className="text-aqua-400">activate_auto_ec</code>.
          </li>
          <li>
            Acompanhe o <strong>Status do Controle</strong>: banda morta, countdown de verificação/recirculação e dosagem.
          </li>
        </ol>
      ),
    },
    {
      question: 'O que é a tolerância (banda morta) no Auto EC?',
      answer:
        'Evita dosagens desnecessárias quando a EC já está “perto o suficiente” do setpoint. Ex.: setpoint 1500 µS/cm e tolerância 50 → sem ação entre 1450 e 1550. Igual ao conceito de tolerância no Auto pH.',
    },
    {
      question: 'Intervalo entre verificações vs pausa entre nutrientes?',
      answer:
        'São coisas diferentes. O intervalo entre verificações (ex.: 300 s) é quanto tempo o firmware espera entre ciclos de leitura de EC. A pausa ~3 s entre nutrientes na mesma dose é interna ao firmware (mistura segura) e não aparece na UI.',
    },
    {
      question: 'Por que não consigo ativar o Auto EC?',
      answer:
        'É necessário pelo menos um nutriente com ml/L válido (total_ml > 0). Remova linhas vazias ou aumente ml/L. Salve os parâmetros antes de ativar.',
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
  ];

  const toggleFAQ = (index: number) => {
    setOpenFAQ(openFAQ === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-dark-bg">
      <header className="bg-dark-card border-b border-dark-border shadow-lg">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <BrandLogo variant="gradient" size={36} />
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-aqua-400 to-primary-400 bg-clip-text text-transparent">
                Informação
              </h1>
              <p className="text-dark-textSecondary mt-1">
                Manual de uso do HydroWave — como operar o sistema com segurança
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <NavLink
            href="/automacao"
            className="bg-dark-card border border-dark-border border-t-2 border-t-aqua-500 rounded-lg shadow-lg p-6 hover:shadow-aqua-500/20 hover:border-aqua-500/50 transition-all"
          >
            <Cog6ToothIcon className="w-8 h-8 text-aqua-400 mb-3" />
            <h3 className="text-lg font-semibold text-dark-text mb-2">Automação</h3>
            <p className="text-sm text-dark-textSecondary">Auto EC, Auto pH e regras</p>
          </NavLink>

          <NavLink
            href="/calibragem"
            className="bg-dark-card border border-dark-border border-t-2 border-t-aqua-500 rounded-lg shadow-lg p-6 hover:shadow-aqua-500/20 hover:border-aqua-500/50 transition-all"
          >
            <BeakerIcon className="w-8 h-8 text-yellow-400 mb-3" />
            <h3 className="text-lg font-semibold text-dark-text mb-2">Calibragem</h3>
            <p className="text-sm text-dark-textSecondary">Bombas, pH e sensores</p>
          </NavLink>

          <NavLink
            href="/fundamentos"
            className="bg-dark-card border border-dark-border border-t-2 border-t-aqua-500 rounded-lg shadow-lg p-6 hover:shadow-aqua-500/20 hover:border-aqua-500/50 transition-all"
          >
            <BookOpenIcon className="w-8 h-8 text-aqua-400 mb-3" />
            <h3 className="text-lg font-semibold text-dark-text mb-2">Fundamentos</h3>
            <p className="text-sm text-dark-textSecondary">Teoria de cultivo hidropônico</p>
          </NavLink>
        </div>

        <div className="bg-dark-card border border-dark-border border-l-4 border-l-violet-500 rounded-lg shadow-lg p-6 mb-8">
          <div className="flex items-start gap-4">
            <AcademicCapIcon className="w-8 h-8 text-violet-400 shrink-0" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-dark-text mb-2">Documentação técnica</h2>
              <p className="text-sm text-dark-textSecondary mb-4">
                Para hidráulica, regras, engenharia de controle e execuções agendadas — conteúdo
                avançado que não cabe neste manual operacional.
              </p>
              <div className="flex flex-wrap gap-3">
                <NavLink
                  href="/support"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/15 border border-violet-500/40 text-violet-300 text-sm font-medium hover:bg-violet-500/25 transition-colors"
                >
                  <AcademicCapIcon className="w-4 h-4" />
                  Support — Start Here
                </NavLink>
                <NavLink
                  href="/processos"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-sm font-medium hover:bg-cyan-500/25 transition-colors"
                >
                  <QueueListIcon className="w-4 h-4" />
                  Processos e schedules
                </NavLink>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <LightBulbIcon className="w-6 h-6 text-yellow-400" />
            <h2 className="text-xl font-semibold text-dark-text">Fluxo recomendado (primeira vez)</h2>
          </div>
          <div className="space-y-3 text-sm text-dark-textSecondary">
            <div className="border-l-4 border-aqua-500 pl-4 py-2">
              <h3 className="font-semibold text-dark-text mb-1">1. Dispositivo online</h3>
              <p>ESP32 master conectado, sensores publicando EC/pH/nível.</p>
            </div>
            <div className="border-l-4 border-primary-500 pl-4 py-2">
              <h3 className="font-semibold text-dark-text mb-1">2. Calibragem</h3>
              <p>Vazão das bombas peristálticas e sensores antes de confiar no Auto EC/pH.</p>
            </div>
            <div className="border-l-4 border-emerald-500 pl-4 py-2">
              <h3 className="font-semibold text-dark-text mb-1">3. Plano + parâmetros</h3>
              <p>Tabela nutricional, setpoint, tolerância, intervalos — salvar e ativar.</p>
            </div>
            <div className="border-l-4 border-violet-500 pl-4 py-2">
              <h3 className="font-semibold text-dark-text mb-1">4. Monitorar status</h3>
              <p>Banda morta, countdown e última dosagem confirmam que o loop está fechado.</p>
            </div>
          </div>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center space-x-3 mb-6">
            <QuestionMarkCircleIcon className="w-6 h-6 text-aqua-400" />
            <h2 className="text-xl font-semibold text-dark-text">Perguntas frequentes</h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="border border-dark-border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full px-4 py-4 text-left flex items-center justify-between hover:bg-dark-surface transition-colors"
                >
                  <span className="font-medium text-dark-text">{faq.question}</span>
                  <svg
                    className={`w-5 h-5 text-dark-textSecondary transition-transform shrink-0 ml-2 ${
                      openFAQ === index ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openFAQ === index && (
                  <div className="px-4 pb-4 text-dark-textSecondary text-sm">{faq.answer}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg p-6">
          <div className="flex items-center space-x-3 mb-6">
            <DocumentTextIcon className="w-6 h-6 text-aqua-400" />
            <h2 className="text-xl font-semibold text-dark-text">Guias rápidos</h2>
          </div>

          <div className="space-y-3">
            <div className="border-l-4 border-aqua-500 pl-4 py-2">
              <h3 className="font-semibold text-dark-text mb-1">Auto EC — loop de controle</h3>
              <p className="text-sm text-dark-textSecondary">
                Setpoint + tolerância definem quando dosar. Erro = EC − setpoint. Status mostra “Dentro da tolerância” ou “Ajuste necessário”.
              </p>
            </div>
            <div className="border-l-4 border-primary-500 pl-4 py-2">
              <h3 className="font-semibold text-dark-text mb-1">Calibração de sensores</h3>
              <p className="text-sm text-dark-textSecondary">
                pH em dois pontos; TDS/EC conforme solução padrão. Repita após trocar sonda ou solução.
              </p>
            </div>
            <div className="border-l-4 border-yellow-500 pl-4 py-2">
              <h3 className="font-semibold text-dark-text mb-1">Solução de problemas</h3>
              <p className="text-sm text-dark-textSecondary">
                Dispositivo offline → WiFi/alimentação. Auto EC não ativa → nutrientes e total_ml. Equação com k inválido → ml/L zerado.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-dark-surface border border-dark-border rounded-lg p-6">
          <div className="flex items-center space-x-3 mb-2">
            <ChatBubbleLeftRightIcon className="w-6 h-6 text-aqua-400" />
            <h3 className="text-lg font-semibold text-dark-text">Suporte</h3>
          </div>
          <p className="text-dark-textSecondary mb-4 text-sm">
            Dúvidas não cobertas aqui? Entre em contato:
          </p>
          <div className="space-y-2 text-sm text-dark-textSecondary">
            <p>📧 Email: suporte@hydrowave.com</p>
            <p>💬 Chat: horário comercial</p>
          </div>
          <NavLink
            href="/planos"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-aqua-400 hover:text-aqua-300 transition-colors"
          >
            Ver planos e serviços comerciais →
          </NavLink>
        </div>
      </div>
    </div>
  );
}
