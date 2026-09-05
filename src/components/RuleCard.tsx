'use client';

import React, { useState } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  PencilIcon,
  EyeIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

import type { AutomationRule } from '@/app/automacao/AutomacaoPageClient';
import { HW_ACCENT_TOP, HW_BADGE } from '@/lib/design-tokens';
import { useLanguage } from '@/contexts/LanguageContext';
import { resolveDecisionRuleDisplayName } from '@/lib/decision-rule-display-name';

interface RuleCardProps {
  rule: AutomationRule;
  onToggle: (id: number | string) => void;
  onEdit: (rule: AutomationRule) => void;
  onDelete: (id: number | string) => void;
}

export default function RuleCard({ rule, onToggle, onEdit, onDelete }: RuleCardProps) {
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const { t } = useLanguage();
  const ac = t.automacao.common;
  const rc = t.automacao.ruleCard;
  const displayName = resolveDecisionRuleDisplayName(
    {
      rule_id: rule.rule_id,
      rule_name: rule.rule_name || rule.name,
      rule_json: rule.rule_json,
    },
    t
  );
  
  // ✅ Construir objeto completo como se envía al Supabase
  const getFullRuleJson = () => {
    return {
      device_id: rule.device_id || '',
      rule_id: rule.rule_id || `RULE_${rule.id}`,
      rule_name: rule.rule_name || rule.name,
      rule_description: rule.rule_description || rule.description,
      rule_json: rule.rule_json || {
        conditions: rule.conditions || [],
        actions: rule.actions || [],
      },
      enabled: rule.enabled,
      priority: rule.priority || 50,
      created_by: rule.created_by || 'system',
    };
  };

  const previewName = rule.name || rule.rule_name || '';

  return (
    <div
      className={`bg-dark-card border rounded-lg transition-all duration-300 shadow-md hover:shadow-lg border-t-2 ${
        rule.enabled ? `${HW_ACCENT_TOP.brand} border-aqua-500/30` : `${HW_ACCENT_TOP.neutral} border-dark-border`
      }`}
    >
      {/* Header - Clickeable para abrir modal de edição */}
      <div
        className="p-4 cursor-pointer hover:bg-dark-surface/50 transition-colors"
        onClick={() => onEdit(rule)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="text-base font-semibold text-dark-text truncate">{displayName}</h3>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(rule.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      onToggle(rule.id);
                    }
                  }}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0 cursor-pointer ${
                    rule.enabled ? HW_BADGE.brand : HW_BADGE.neutral
                  }`}
                  title={rule.enabled ? rc.toggleDisable : rc.toggleEnable}
                >
                  {rule.enabled ? (
                    <span className="flex items-center">
                      <CheckCircleIcon className="w-3 h-3 mr-1 text-green-500" />
                      {t.common.active}
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <XCircleIcon className="w-3 h-3 mr-1 text-red-500" />
                      {t.common.inactive}
                    </span>
                  )}
                </span>
              </div>
              <p className="text-sm text-dark-textSecondary truncate">{rule.description}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowJsonPreview(true);
              }}
              className="p-2 hover:bg-dark-surface rounded-lg transition-colors text-purple-400 hover:text-purple-300"
              title={rc.jsonPreview}
            >
              <EyeIcon className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(rule);
              }}
              className="p-2 hover:bg-dark-surface rounded-lg transition-colors text-aqua-400 hover:text-aqua-300"
              title={ac.edit}
            >
              <PencilIcon className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                // ✅ A confirmação com senha de administrador será feita em handleDeleteRule
                onDelete(rule.id);
              }}
              className="p-2 hover:bg-dark-surface rounded-lg transition-colors text-red-400 hover:text-red-300"
              title={rc.deleteTitle}
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Vista Previa JSON */}
      {showJsonPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-dark-border">
              <h2 className="text-xl font-bold text-dark-text">
                {rc.jsonPreviewTitle.replace('{name}', previewName)}
              </h2>
              <button
                onClick={() => setShowJsonPreview(false)}
                className="p-2 hover:bg-dark-surface rounded-lg transition-colors text-dark-textSecondary hover:text-dark-text"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Content - JSON formateado */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
                <pre className="text-xs text-dark-textSecondary font-mono whitespace-pre-wrap break-words overflow-x-auto">
                  {JSON.stringify(getFullRuleJson(), null, 2)}
                </pre>
              </div>
              
              {/* Información adicional */}
              <div className="mt-4 p-4 bg-aqua-500/10 border border-aqua-500/30 rounded-lg">
                <p className="text-xs text-aqua-300 mb-2">
                  {rc.jsonPreviewHint1}
                </p>
                <p className="text-xs text-dark-textSecondary">
                  {rc.jsonPreviewHint2}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end p-6 border-t border-dark-border">
              <button
                onClick={() => setShowJsonPreview(false)}
                className="px-4 py-2 bg-dark-surface hover:bg-dark-border text-dark-text border border-dark-border rounded-lg text-sm font-medium transition-colors"
              >
                {ac.close}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
