'use client';

import React, { useState } from 'react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

interface AutomationRule {
  id: number;
  name: string;
  description: string;
  condition: string;
  action: string;
  enabled: boolean;
  conditions?: any[];
  actions?: any[];
}

interface RuleCardProps {
  rule: AutomationRule;
  onToggle: (id: number) => void;
  onEdit: (rule: AutomationRule) => void;
  onDelete: (id: number) => void;
}

export default function RuleCard({ rule, onToggle, onEdit, onDelete }: RuleCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={`bg-dark-card border border-dark-border rounded-lg transition-all duration-300 ${
        isExpanded ? 'shadow-lg' : 'shadow-md hover:shadow-lg'
      } ${rule.enabled ? 'border-aqua-500/30' : 'border-dark-border'}`}
    >
      {/* Header - Sempre visível (resumido) */}
      <div
        className="p-4 cursor-pointer hover:bg-dark-surface/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <div className="flex-shrink-0">
              {isExpanded ? (
                <ChevronUpIcon className="w-5 h-5 text-aqua-400" />
              ) : (
                <ChevronDownIcon className="w-5 h-5 text-dark-textSecondary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="text-base font-semibold text-dark-text truncate">{rule.name}</h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0 ${
                    rule.enabled
                      ? 'bg-aqua-500/20 text-aqua-400 border-aqua-500/30'
                      : 'bg-dark-surface text-dark-textSecondary border-dark-border'
                  }`}
                >
                  {rule.enabled ? (
                    <span className="flex items-center">
                      <CheckCircleIcon className="w-3 h-3 mr-1" />
                      Ativo
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <XCircleIcon className="w-3 h-3 mr-1" />
                      Inativo
                    </span>
                  )}
                </span>
              </div>
              <p className="text-sm text-dark-textSecondary truncate">{rule.description}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo Expandido */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-dark-border pt-4 space-y-4">
          {/* Descrição completa */}
          <div>
            <p className="text-sm text-dark-textSecondary">{rule.description}</p>
          </div>

          {/* Condições e Ações */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-primary-900/30 border border-primary-500/30 p-3 rounded-lg">
              <p className="text-sm font-medium text-primary-400 mb-2">Condição:</p>
              <p className="text-sm text-primary-300">{rule.condition}</p>
              {rule.conditions && rule.conditions.length > 0 && (
                <div className="mt-2 space-y-1">
                  {rule.conditions.map((cond, idx) => (
                    <div key={idx} className="text-xs text-primary-300/80">
                      • {cond.sensor} {cond.operator} {cond.value}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="bg-aqua-900/30 border border-aqua-500/30 p-3 rounded-lg">
              <p className="text-sm font-medium text-aqua-400 mb-2">Ação:</p>
              <p className="text-sm text-aqua-300">{rule.action}</p>
              {rule.actions && rule.actions.length > 0 && (
                <div className="mt-2 space-y-1">
                  {rule.actions.map((act, idx) => (
                    <div key={idx} className="text-xs text-aqua-300/80">
                      • {act.relayName} por {act.duration}s
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Ajustes Finos */}
          <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
            <h4 className="text-sm font-semibold text-dark-text mb-3">Ajustes Finos</h4>
            <div className="space-y-3">
              {/* Aqui você pode adicionar campos para ajustes finos */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-dark-textSecondary mb-1">
                    Delay antes de executar (seg)
                  </label>
                  <input
                    type="number"
                    min="0"
                    defaultValue="0"
                    className="w-full p-2 bg-dark-card border border-dark-border rounded text-dark-text text-sm focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-dark-textSecondary mb-1">
                    Intervalo entre execuções (min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    defaultValue="5"
                    className="w-full p-2 bg-dark-card border border-dark-border rounded text-dark-text text-sm focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-dark-textSecondary mb-1">
                  Prioridade
                </label>
                <select className="w-full p-2 bg-dark-card border border-dark-border rounded text-dark-text text-sm focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none">
                  <option value="low">Baixa</option>
                  <option value="medium" selected>Média</option>
                  <option value="high">Alta</option>
                </select>
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-dark-border">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle(rule.id);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                rule.enabled
                  ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg'
                  : 'bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white shadow-lg hover:shadow-aqua-500/50'
              }`}
            >
              {rule.enabled ? 'Desativar' : 'Ativar'}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(rule);
              }}
              className="px-4 py-2 bg-dark-surface hover:bg-dark-border text-dark-text border border-dark-border rounded-lg text-sm font-medium transition-colors flex items-center space-x-1"
            >
              <PencilIcon className="w-4 h-4" />
              <span>Editar</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Tem certeza que deseja excluir esta regra?')) {
                  onDelete(rule.id);
                }
              }}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1"
            >
              <TrashIcon className="w-4 h-4" />
              <span>Excluir</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

