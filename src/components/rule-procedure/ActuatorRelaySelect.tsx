'use client';

import { useEffect, useMemo } from 'react';
import type { ActuatorRef } from '@/lib/rule-procedure/types';
import type { ActuatorRelayOption } from '@/lib/actuator-relay-options';
import { splitActuatorOptionsByKind } from '@/lib/actuator-relay-options';
import {
  actuatorRefToKey,
  parseActuatorKey,
} from '@/lib/master-relay-options';
import { useLanguage } from '@/contexts/LanguageContext';

interface ActuatorRelaySelectProps {
  /** Lista unificada (Core + Atlas); renderiza com optgroup. */
  options: ActuatorRelayOption[];
  value?: string;
  onChangeValue?: (value: string, option: ActuatorRelayOption) => void;
  /** Modo procedimento: atualiza ActuatorRef */
  actuator?: ActuatorRef;
  onChangeActuator?: (actuator: ActuatorRef) => void;
  className?: string;
  /** Sem label externo (ações simples inline) */
  hideLabel?: boolean;
  selectClassName?: string;
}

/**
 * Select com cabeçalhos: Core | Atlas.
 * Mesmo padrão em ações simples e no builder. MAC nunca na UI.
 */
export function ActuatorRelaySelect({
  options,
  value: valueProp,
  onChangeValue,
  actuator,
  onChangeActuator,
  className = '',
  hideLabel = false,
  selectClassName = '',
}: ActuatorRelaySelectProps) {
  const { t } = useLanguage();
  const p = t.automacao.procedures;
  const instrT = t.automacao.instr;

  const { core, atlas } = useMemo(() => splitActuatorOptionsByKind(options), [options]);

  const currentKey = actuator ? actuatorRefToKey(actuator) : valueProp ?? '';
  const value = options.some((o) => o.value === currentKey)
    ? currentKey
    : options[0]?.value ?? '';

  useEffect(() => {
    if (!onChangeActuator || !actuator) return;
    if (options.length === 0) return;
    if (options.some((o) => o.value === currentKey)) return;
    const first = options[0];
    onChangeActuator({
      target: first.kind,
      relayIndex: first.relayId,
      slaveMac: first.slaveMac,
      label: first.label,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, currentKey]);

  const handleChange = (raw: string) => {
    const opt = options.find((o) => o.value === raw);
    if (!opt) return;
    onChangeValue?.(raw, opt);
    if (onChangeActuator) {
      const parsed = parseActuatorKey(raw);
      if (!parsed) return;
      onChangeActuator({
        target: opt.kind,
        relayIndex: opt.relayId,
        slaveMac: opt.slaveMac,
        label: opt.label,
      });
    }
  };

  if (options.length === 0) {
    return (
      <p
        className={`text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 ${className}`}
      >
        {p.emptyActuatorLists}
      </p>
    );
  }

  const selectEl = (
    <select
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      className={
        selectClassName ||
        'mt-1 w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-aqua-500'
      }
    >
      {core.length > 0 && (
        <optgroup label={p.optgroupCoreRelays}>
          {core.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </optgroup>
      )}
      {atlas.length > 0 && (
        <optgroup label={p.optgroupAtlasRelays}>
          {atlas.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );

  if (hideLabel) {
    return <div className={className}>{selectEl}</div>;
  }

  return (
    <label className={`block text-xs ${className}`}>
      <span className="text-dark-textSecondary">{p.actuatorSelect}</span>
      {selectEl}
      {options.length === 0 && (
        <span className="sr-only">{instrT.emptyRelays}</span>
      )}
    </label>
  );
}
