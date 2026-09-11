'use client';

import React, { useMemo } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Instruction } from '../SequentialScriptEditor';
import { ESPNowSlave } from '@/lib/esp-now-slaves';
import {
  DEFAULT_MASTER_RELAYS,
  type MasterRelayOption,
  instructionToActuatorKey,
  masterRelayKey,
  parseActuatorKey,
} from '@/lib/master-relay-options';
import { buildActuatorRelayOptions, splitActuatorOptionsByKind } from '@/lib/actuator-relay-options';
import type { DosingPumpOption } from '@/lib/dosing-pump-options';
import {
  calculateDoseDurationSeconds,
  doseDurationSecondsForRelay,
  formatDoseDurationSeconds,
} from '@/lib/pump-calibration';
import { useLanguage } from '@/contexts/LanguageContext';
import NavLink from '@/components/NavLink';

export type RelayActuatorMode = 'timed' | 'dose_ml';

interface RelayActionEditorProps {
  instruction: Instruction;
  onChange: (updated: Instruction) => void;
  espnowSlaves: ESPNowSlave[];
  masterRelays?: MasterRelayOption[];
  /** Bombas Core com vazão calibrada (modo dosificação ml). */
  dosingPumps?: DosingPumpOption[];
  onDelete?: () => void;
}

function resolveMode(instruction: Instruction): RelayActuatorMode {
  if (instruction.dosage_ml != null && instruction.dosage_ml > 0) return 'dose_ml';
  return 'timed';
}

export default function RelayActionEditor({
  instruction,
  onChange,
  espnowSlaves,
  masterRelays = DEFAULT_MASTER_RELAYS,
  dosingPumps = [],
  onDelete,
}: RelayActionEditorProps) {
  const { t } = useLanguage();
  const instrT = t.automacao.instr;
  const p = t.automacao.procedures;
  const mode = resolveMode(instruction);

  const timedOptions = useMemo(
    () => buildActuatorRelayOptions(masterRelays, espnowSlaves),
    [masterRelays, espnowSlaves]
  );
  const timedGroups = useMemo(() => splitActuatorOptionsByKind(timedOptions), [timedOptions]);

  const doseOptions = useMemo(() => dosingPumps, [dosingPumps]);

  const relayOptions = mode === 'dose_ml' ? doseOptions : timedOptions;

  const currentRelayValue = useMemo(() => {
    const key = instructionToActuatorKey(instruction);
    if (key && relayOptions.some((o) => o.value === key)) return key;
    if (instruction.target === 'master' && instruction.relay_number != null) {
      const mk = masterRelayKey(instruction.relay_number);
      if (relayOptions.some((o) => o.value === mk)) return mk;
    }
    return relayOptions[0]?.value ?? '';
  }, [instruction, relayOptions]);

  const selectedDosePump = useMemo(() => {
    if (mode !== 'dose_ml') return null;
    return doseOptions.find((o) => o.value === currentRelayValue) ?? null;
  }, [mode, doseOptions, currentRelayValue]);

  const previewDurationSec = useMemo(() => {
    if (!selectedDosePump || !(instruction.dosage_ml && instruction.dosage_ml > 0)) {
      return null;
    }
    return calculateDoseDurationSeconds(instruction.dosage_ml, selectedDosePump.flowRate);
  }, [selectedDosePump, instruction.dosage_ml]);

  const setMode = (next: RelayActuatorMode) => {
    if (next === mode) return;
    if (next === 'timed') {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { dosage_ml: _drop, ...rest } = instruction;
      onChange({
        ...rest,
        action: instruction.action || 'on',
        dosage_ml: undefined,
      } as Instruction);
      return;
    }
    // dose_ml: só master + ON + primeira bomba calibrada
    const first = doseOptions[0];
    onChange({
      ...instruction,
      target: 'master',
      slave_mac: undefined,
      relay_number: first?.relayNumber ?? instruction.relay_number ?? 0,
      action: 'on',
      dosage_ml: instruction.dosage_ml && instruction.dosage_ml > 0 ? instruction.dosage_ml : 20,
      duration_seconds: first
        ? doseDurationSecondsForRelay(
            calculateDoseDurationSeconds(
              instruction.dosage_ml && instruction.dosage_ml > 0 ? instruction.dosage_ml : 20,
              first.flowRate
            ) ?? 1
          )
        : instruction.duration_seconds,
    });
  };

  const applyDoseMl = (ml: number, pump: DosingPumpOption | null) => {
    const flow = pump?.flowRate;
    const raw = flow && ml > 0 ? calculateDoseDurationSeconds(ml, flow) : null;
    onChange({
      ...instruction,
      target: 'master',
      slave_mac: undefined,
      relay_number: pump?.relayNumber ?? instruction.relay_number,
      action: 'on',
      dosage_ml: ml > 0 ? ml : undefined,
      duration_seconds: raw != null ? doseDurationSecondsForRelay(raw) : 0,
    });
  };

  const handleRelayChange = (value: string) => {
    if (mode === 'dose_ml') {
      const pump = doseOptions.find((o) => o.value === value) ?? null;
      const ml = instruction.dosage_ml && instruction.dosage_ml > 0 ? instruction.dosage_ml : 20;
      applyDoseMl(ml, pump);
      return;
    }

    const parsed = parseActuatorKey(value);
    if (!parsed) return;

    if (parsed.target === 'slave') {
      onChange({
        ...instruction,
        target: 'slave',
        slave_mac: parsed.slaveMac ?? '',
        relay_number: parsed.relayIndex,
        dosage_ml: undefined,
      });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { slave_mac, ...restInstruction } = instruction as unknown as Record<string, unknown>;
    onChange({
      ...restInstruction,
      target: 'master',
      relay_number: parsed.relayIndex,
      dosage_ml: undefined,
    } as Instruction);
  };

  const updateDuration = (seconds: number) => {
    onChange({
      ...instruction,
      duration_seconds: seconds,
      dosage_ml: undefined,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode('dose_ml')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
            mode === 'dose_ml'
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-dark-surface text-dark-textSecondary border-dark-border hover:text-dark-text'
          }`}
        >
          {instrT.modeDoseMl}
        </button>
        <button
          type="button"
          onClick={() => setMode('timed')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
            mode === 'timed'
              ? 'bg-aqua-500/20 text-aqua-300 border-aqua-500/40'
              : 'bg-dark-surface text-dark-textSecondary border-dark-border hover:text-dark-text'
          }`}
        >
          {instrT.modeRelayTimed}
        </button>
      </div>
      <p className="text-[11px] text-dark-textSecondary leading-relaxed">
        {mode === 'dose_ml' ? instrT.modeDoseMlHint : instrT.modeRelayTimedHint}
      </p>

      <div className="flex items-center space-x-2">
        <select
          value={currentRelayValue}
          onChange={(e) => handleRelayChange(e.target.value)}
          className="flex-1 p-2 bg-dark-surface border border-dark-border rounded text-dark-text text-sm focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
        >
          {relayOptions.length === 0 ? (
            <option value="">
              {mode === 'dose_ml' ? instrT.emptyDosingPumps : instrT.emptyRelays}
            </option>
          ) : mode === 'dose_ml' ? (
            relayOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))
          ) : (
            <>
              {timedGroups.core.length > 0 && (
                <optgroup label={p.optgroupCoreRelays}>
                  {timedGroups.core.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              )}
              {timedGroups.atlas.length > 0 && (
                <optgroup label={p.optgroupAtlasRelays}>
                  {timedGroups.atlas.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              )}
            </>
          )}
        </select>

        {mode === 'timed' && (
          <select
            value={instruction.action || 'on'}
            onChange={(e) =>
              onChange({ ...instruction, action: e.target.value as 'on' | 'off' })
            }
            className="w-32 p-2 bg-dark-surface border border-dark-border rounded text-dark-text text-sm focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
          >
            <option value="on">{instrT.actionOn}</option>
            <option value="off">{instrT.actionOff}</option>
          </select>
        )}
      </div>

      {mode === 'dose_ml' ? (
        <div className="space-y-2">
          {doseOptions.length === 0 ? (
            <p className="text-xs text-amber-300/90 border border-amber-500/30 bg-amber-500/10 rounded-lg px-3 py-2">
              {instrT.calibrateDosingHint}{' '}
              <NavLink href="/calibragem" className="text-aqua-400 hover:underline">
                Calibragem
              </NavLink>
            </p>
          ) : (
            <>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-dark-textSecondary mb-1">
                    {instrT.doseMlLabel}
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={instruction.dosage_ml ?? ''}
                    onChange={(e) => {
                      const ml = e.target.value ? parseFloat(e.target.value) : 0;
                      applyDoseMl(Number.isFinite(ml) ? ml : 0, selectedDosePump);
                    }}
                    placeholder="Ex: 20"
                    className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-aqua-500"
                  />
                </div>
                {onDelete && (
                  <button
                    type="button"
                    onClick={onDelete}
                    className="p-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors flex-shrink-0"
                    title={instrT.deleteAction}
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                )}
              </div>
              {previewDurationSec != null && (
                <p className="text-[11px] text-dark-textSecondary">
                  {instrT.doseMlPreview
                    .replace('{sec}', formatDoseDurationSeconds(previewDurationSec))
                    .replace(
                      '{cmd}',
                      String(doseDurationSecondsForRelay(previewDurationSec))
                    )}
                </p>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="flex items-end space-x-2">
          <div className="flex-1">
            <label className="block text-xs text-dark-textSecondary mb-1">
              {instrT.durationSecOptional}
            </label>
            <input
              type="number"
              min="0"
              value={instruction.duration_seconds || ''}
              onChange={(e) =>
                updateDuration(e.target.value ? parseInt(e.target.value, 10) : 0)
              }
              placeholder="Ex: 59"
              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-aqua-500"
            />
          </div>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors flex-shrink-0"
              title={instrT.deleteAction}
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
