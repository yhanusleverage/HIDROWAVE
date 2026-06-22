'use client';

import React from 'react';

export interface TargetRuleOption {
  rule_id: string;
  rule_name: string;
}

interface TargetRuleIdFieldProps {
  value: string;
  onChange: (value: string) => void;
  availableRules: TargetRuleOption[];
  excludeRuleId?: string | null;
  loading?: boolean;
  placeholder?: string;
  fieldId?: string;
  inputClassName?: string;
  hintClassName?: string;
}

export default function TargetRuleIdField({
  value,
  onChange,
  availableRules,
  excludeRuleId,
  loading = false,
  placeholder = 'Ex: RULE_001',
  fieldId = 'target-rule',
  inputClassName = 'w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-aqua-500',
  hintClassName = 'text-xs text-dark-textSecondary/80 mt-1',
}: TargetRuleIdFieldProps) {
  const filteredRules = availableRules.filter((rule) => rule.rule_id !== excludeRuleId);
  const customValue =
    value && !filteredRules.some((rule) => rule.rule_id === value) ? value : null;

  if (loading) {
    return (
      <select disabled className={`${inputClassName} opacity-70 cursor-wait`}>
        <option>Carregando regras...</option>
      </select>
    );
  }

  if (filteredRules.length > 0) {
    return (
      <>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClassName}
        >
          <option value="">Selecione uma regra...</option>
          {customValue && (
            <option value={customValue}>{customValue} (personalizado)</option>
          )}
          {filteredRules.map((rule) => (
            <option key={rule.rule_id} value={rule.rule_id}>
              {rule.rule_name} ({rule.rule_id})
            </option>
          ))}
        </select>
        <p className={hintClassName}>
          Escolha na lista ou crie novas regras para encadear
        </p>
      </>
    );
  }

  return (
    <>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        list={`${fieldId}-suggestions`}
        className={`${inputClassName} placeholder-gray-500`}
      />
      <datalist id={`${fieldId}-suggestions`}>
        {availableRules.map((rule) => (
          <option key={rule.rule_id} value={rule.rule_id}>
            {rule.rule_name}
          </option>
        ))}
      </datalist>
      <p className={hintClassName}>
        Nenhuma outra regra disponível. Digite o rule_id manualmente (ex: RULE_001)
      </p>
    </>
  );
}
