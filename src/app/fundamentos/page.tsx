'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { loadSettings } from '@/lib/settings';
import { getFundamentosTranslation } from '@/lib/translations/fundamentos';
import { BookOpenIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

export default function FundamentosPage() {
  const { userProfile } = useAuth();
  const [language, setLanguage] = useState<string>('pt-BR');
  const [loading, setLoading] = useState(true);
  const translations = getFundamentosTranslation(language);

  useEffect(() => {
    const loadLanguage = async () => {
      if (userProfile?.email) {
        try {
          const settings = await loadSettings(userProfile.email);
          setLanguage(settings.language || 'pt-BR');
        } catch (error) {
          console.error('Error loading settings:', error);
        }
      } else {
        // Fallback: intentar cargar desde localStorage
        if (typeof window !== 'undefined') {
          try {
            const savedSettings = localStorage.getItem('hydrowave_settings');
            if (savedSettings) {
              const parsed = JSON.parse(savedSettings);
              setLanguage(parsed.language || 'pt-BR');
            }
          } catch (error) {
            console.error('Error loading from localStorage:', error);
          }
        }
      }
      setLoading(false);
    };

    loadLanguage();
  }, [userProfile?.email]);

  // Función para determinar el color de la fila según la condición
  const getRowColor = (condition: { waterLevel: string; ec: string; ph: string }): string => {
    const { states } = translations;
    
    // Funciones auxiliares para verificar estados
    const isFalling = (val: string) => 
      val === states.falling || val === 'DESCENDO' || val === 'FALLING' || val === 'BAJANDO';
    const isStatic = (val: string) => 
      val === states.static || val === 'ESTÁTICO' || val === 'STATIC';
    const isRising = (val: string) => 
      val === states.rising || val === 'SUBINDO' || val === 'RISING' || val === 'SUBIENDO';
    
    // Verde: Condiciones perfectas o casi perfectas
    // 1. DESCENDO ESTÁTICO ESTÁTICO - Condições perfeitas
    if (isFalling(condition.waterLevel) && isStatic(condition.ec) && isStatic(condition.ph)) {
      return 'bg-green-900/30 border-green-700/50 hover:bg-green-900/40';
    }
    
    // 2. DESCENDO ESTÁTICO SUBINDO - Estado normal
    if (isFalling(condition.waterLevel) && isStatic(condition.ec) && isRising(condition.ph)) {
      return 'bg-green-900/30 border-green-700/50 hover:bg-green-900/40';
    }
    
    // 3. DESCENDO DESCENDO ESTÁTICO - Situação muito boa
    if (isFalling(condition.waterLevel) && isFalling(condition.ec) && isStatic(condition.ph)) {
      return 'bg-green-900/30 border-green-700/50 hover:bg-green-900/40';
    }
    
    // 4. DESCENDO DESCENDO SUBINDO - Quase perfeito
    if (isFalling(condition.waterLevel) && isFalling(condition.ec) && isRising(condition.ph)) {
      return 'bg-green-900/30 border-green-700/50 hover:bg-green-900/40';
    }
    
    // Amarillo: DESCENDO DESCENDO DESCENDO - Precisa troca de reservatório
    if (isFalling(condition.waterLevel) && isFalling(condition.ec) && isFalling(condition.ph)) {
      return 'bg-yellow-900/30 border-yellow-700/50 hover:bg-yellow-900/40';
    }
    
    // Rojo: Todas las demás condiciones
    return 'bg-red-900/20 border-red-700/30 hover:bg-red-900/30';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-dark-text">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      <header className="bg-dark-card border-b border-dark-border shadow-lg">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-3">
            <BookOpenIcon className="w-8 h-8 text-aqua-400" />
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-aqua-400 to-primary-400 bg-clip-text text-transparent">
                {translations.title}
              </h1>
              <p className="text-dark-textSecondary mt-1">{translations.subtitle}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Tabla de Condiciones */}
        <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg p-6 mb-6 overflow-x-auto">
          <div className="min-w-full">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-dark-surface border-b border-dark-border">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-dark-text border-r border-dark-border">
                    {translations.table.waterLevel}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-dark-text border-r border-dark-border">
                    {translations.table.ec}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-dark-text border-r border-dark-border">
                    {translations.table.ph}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-dark-text">
                    {translations.table.solution}
                  </th>
                </tr>
              </thead>
              <tbody>
                {translations.conditions.map((condition, index) => {
                  const rowColor = getRowColor(condition);
                  return (
                    <tr
                      key={index}
                      className={`border-b transition-colors ${rowColor}`}
                    >
                      <td className="px-4 py-3 text-sm text-dark-text border-r border-dark-border font-medium">
                        {condition.waterLevel}
                      </td>
                      <td className="px-4 py-3 text-sm text-dark-text border-r border-dark-border font-medium">
                        {condition.ec}
                      </td>
                      <td className="px-4 py-3 text-sm text-dark-text border-r border-dark-border font-medium">
                        {condition.ph}
                      </td>
                      <td className="px-4 py-3 text-sm text-dark-textSecondary">
                        {condition.solution}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notas Importantes */}
        <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <InformationCircleIcon className="w-6 h-6 text-yellow-400" />
            <h2 className="text-xl font-semibold text-dark-text">{translations.notes.title}</h2>
          </div>

          <div className="space-y-4">
            <div className="bg-dark-surface/50 rounded-lg p-4 border border-yellow-700/30">
              <h3 className="font-semibold text-yellow-400 mb-2">{translations.notes.note1.title}</h3>
              <p className="text-sm text-dark-textSecondary leading-relaxed">
                {translations.notes.note1.content}
              </p>
            </div>

            <div className="bg-dark-surface/50 rounded-lg p-4 border border-yellow-700/30">
              <h3 className="font-semibold text-yellow-400 mb-2">{translations.notes.note2.title}</h3>
              <p className="text-sm text-dark-textSecondary leading-relaxed">
                {translations.notes.note2.content}
              </p>
            </div>
          </div>
        </div>

        {/* Dicas Gerais */}
        <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <InformationCircleIcon className="w-6 h-6 text-yellow-400" />
            <h2 className="text-xl font-semibold text-dark-text">{translations.tips.title}</h2>
          </div>

          <ul className="space-y-2">
            {translations.tips.items.map((tip, index) => (
              <li key={index} className="flex items-start space-x-3">
                <span className="text-yellow-400 mt-1">•</span>
                <span className="text-sm text-dark-textSecondary flex-1">{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="bg-dark-surface border border-dark-border rounded-lg p-4 text-center">
          <p className="text-lg font-semibold text-dark-text">{translations.footer.text}</p>
        </div>
      </main>
    </div>
  );
}

