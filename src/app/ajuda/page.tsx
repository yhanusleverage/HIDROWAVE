'use client';

import React, { useState } from 'react';
import {
  QuestionMarkCircleIcon,
  BookOpenIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  LightBulbIcon,
} from '@heroicons/react/24/outline';

interface FAQ {
  question: string;
  answer: string;
}

export default function AjudaPage() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

  const faqs: FAQ[] = [
    {
      question: 'Como conectar meu dispositivo ESP32?',
      answer: 'Para conectar seu ESP32, você precisa configurar o WiFi no código do dispositivo e garantir que ele esteja na mesma rede que o servidor. Depois, acesse a página de Dispositivos para verificar a conexão.',
    },
    {
      question: 'Como configurar regras de automação?',
      answer: 'Acesse a página de Automação e clique em "Nova Regra". Defina a condição (ex: pH < 5.5) e a ação a ser executada (ex: Ativar dosagem de pH+).',
    },
    {
      question: 'O que fazer se os sensores não estão enviando dados?',
      answer: 'Verifique a conexão do dispositivo na página de Dispositivos. Se estiver offline, verifique a alimentação e a conexão WiFi do ESP32.',
    },
    {
      question: 'Como ajustar a dosagem de nutrientes?',
      answer: 'No Dashboard, vá até a seção "Tabla de Nutrición" e ajuste os valores de ml por litro para cada nutriente. O sistema calculará automaticamente o tempo de dosagem.',
    },
    {
      question: 'Posso usar o sistema em múltiplos reservatórios?',
      answer: 'Sim, você pode adicionar múltiplos dispositivos na página de Dispositivos. Cada dispositivo pode ser configurado para um reservatório diferente.',
    },
  ];

  const toggleFAQ = (index: number) => {
    setOpenFAQ(openFAQ === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-dark-bg">
      <header className="bg-dark-card border-b border-dark-border shadow-lg">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-aqua-400 to-primary-400 bg-clip-text text-transparent">❓ Ajuda</h1>
          <p className="text-dark-textSecondary mt-1">Encontre respostas para suas dúvidas</p>
        </div>
      </header>
      
      <main className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Cards de Acesso Rápido */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg p-6 hover:shadow-aqua-500/20 hover:border-aqua-500/50 transition-all cursor-pointer">
            <BookOpenIcon className="w-8 h-8 text-aqua-400 mb-3" />
            <h3 className="text-lg font-semibold text-dark-text mb-2">Documentação</h3>
            <p className="text-sm text-dark-textSecondary">Acesse o manual completo do sistema</p>
          </div>
          
          <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg p-6 hover:shadow-aqua-500/20 hover:border-aqua-500/50 transition-all cursor-pointer">
            <LightBulbIcon className="w-8 h-8 text-yellow-400 mb-3" />
            <h3 className="text-lg font-semibold text-dark-text mb-2">Dicas e Truques</h3>
            <p className="text-sm text-dark-textSecondary">Aprenda a otimizar seu cultivo</p>
          </div>
          
          <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg p-6 hover:shadow-aqua-500/20 hover:border-aqua-500/50 transition-all cursor-pointer">
            <ChatBubbleLeftRightIcon className="w-8 h-8 text-aqua-400 mb-3" />
            <h3 className="text-lg font-semibold text-dark-text mb-2">Suporte</h3>
            <p className="text-sm text-dark-textSecondary">Entre em contato com nossa equipe</p>
          </div>
        </div>

        {/* Perguntas Frequentes */}
        <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center space-x-3 mb-6">
            <QuestionMarkCircleIcon className="w-6 h-6 text-aqua-400" />
            <h2 className="text-xl font-semibold text-dark-text">Perguntas Frequentes</h2>
          </div>
          
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="border border-dark-border rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full px-4 py-4 text-left flex items-center justify-between hover:bg-dark-surface transition-colors"
                >
                  <span className="font-medium text-dark-text">{faq.question}</span>
                  <svg
                    className={`w-5 h-5 text-dark-textSecondary transition-transform ${
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
                  <div className="px-4 pb-4 text-dark-textSecondary text-sm">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Guias Rápidos */}
        <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg p-6">
          <div className="flex items-center space-x-3 mb-6">
            <DocumentTextIcon className="w-6 h-6 text-aqua-400" />
            <h2 className="text-xl font-semibold text-dark-text">Guias Rápidos</h2>
          </div>
          
          <div className="space-y-3">
            <div className="border-l-4 border-aqua-500 pl-4 py-2">
              <h3 className="font-semibold text-dark-text mb-1">Primeiros Passos</h3>
              <p className="text-sm text-dark-textSecondary">
                Configure seu sistema pela primeira vez seguindo nosso guia passo a passo.
              </p>
            </div>
            
            <div className="border-l-4 border-primary-500 pl-4 py-2">
              <h3 className="font-semibold text-dark-text mb-1">Calibração de Sensores</h3>
              <p className="text-sm text-dark-textSecondary">
                Aprenda como calibrar corretamente os sensores de pH e TDS para leituras precisas.
              </p>
            </div>
            
            <div className="border-l-4 border-yellow-500 pl-4 py-2">
              <h3 className="font-semibold text-dark-text mb-1">Solução de Problemas</h3>
              <p className="text-sm text-dark-textSecondary">
                Resolva problemas comuns relacionados à conexão e funcionamento dos dispositivos.
              </p>
            </div>
          </div>
        </div>

        {/* Informações de Contato */}
        <div className="mt-8 bg-dark-surface border border-dark-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-dark-text mb-2">Precisa de mais ajuda?</h3>
          <p className="text-dark-textSecondary mb-4">
            Nossa equipe de suporte está pronta para ajudar você. Entre em contato através dos canais abaixo:
          </p>
          <div className="space-y-2 text-sm text-dark-textSecondary">
            <p>📧 Email: suporte@hydrowave.com</p>
            <p>💬 Chat: Disponível no horário comercial</p>
            <p>📞 Telefone: (00) 0000-0000</p>
          </div>
        </div>
      </main>
    </div>
  );
}

