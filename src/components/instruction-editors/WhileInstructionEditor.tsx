'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { PlusIcon, XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { Instruction } from '../SequentialScriptEditor';
import { ESPNowSlave } from '@/lib/esp-now-slaves';
import type { MasterRelayOption } from '@/lib/master-relay-options';
import RelayActionEditor from './RelayActionEditor';
import ConditionFields from './ConditionFields';
import { createNestedInstruction } from '@/lib/instruction-factory';
import { formatInstructionType, getConditionSensors } from '@/lib/instruction-labels';
import { useLanguage } from '@/contexts/LanguageContext';

const IfInstructionEditor = dynamic(() => import('./IfInstructionEditor'), { ssr: false });

interface WhileInstructionEditorProps {
  instruction: Instruction;
  onChange: (updated: Instruction) => void;
  espnowSlaves: ESPNowSlave[];
  masterRelays: MasterRelayOption[];
}

export default function WhileInstructionEditor({
  instruction,
  onChange,
  espnowSlaves,
  masterRelays,
}: WhileInstructionEditorProps) {
  const { t } = useLanguage();
  const instrT = t.automacao.instr;
  const scriptSensors = useMemo(
    () =>
      getConditionSensors(instrT).filter(
        (s) => s.value !== 'ph' && s.value !== 'ec'
      ),
    [instrT]
  );

  // ✅ Funções auxiliares para conversão de tempo
  const msToTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const timeToMs = (time: string): number => {
    const [hours, minutes, seconds] = time.split(':').map(Number);
    return (hours * 3600 + minutes * 60 + seconds) * 1000;
  };

  const updateCondition = (condition: NonNullable<Instruction['condition']>) => {
    onChange({
      ...instruction,
      condition,
    });
  };

  const updateBody = (newBody: Instruction[]) => {
    onChange({
      ...instruction,
      body: newBody,
    });
  };

  const addBodyInstruction = (type: Instruction['type']) => {
    updateBody([...(instruction.body || []), createNestedInstruction(type)]);
  };

  const removeBodyInstruction = (index: number) => {
    updateBody((instruction.body || []).filter((_, i) => i !== index));
  };

  const updateBodyInstruction = (index: number, updated: Instruction) => {
    const newBody = [...(instruction.body || [])];
    newBody[index] = updated;
    updateBody(newBody);
  };

  const currentCondition = instruction.condition ?? {
    sensor: 'water_level',
    operator: '!=',
    value: 'vazio',
  };

  return (
    <div className="space-y-3">
      <ConditionFields
        label="LOOP"
        condition={currentCondition}
        onChange={(condition) =>
          updateCondition({
            sensor: condition.sensor,
            operator: condition.operator,
            value: String(condition.value),
          })
        }
        sensors={scriptSensors}
      />

      {/* Body (instruções dentro do WHILE) */}
      <div>
        <label className="block text-xs text-dark-textSecondary mb-2">
          {instrT.loopBody}:
        </label>
        <div className="space-y-2 ml-4 border-l-2 border-aqua-500/30 pl-3">
          {(instruction.body || []).map((bodyInstr, idx) => (
            <div
              key={bodyInstr.id ?? idx}
              className="border border-dark-border rounded-lg p-2 bg-dark-surface/50"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-purple-400 font-mono">
                  {formatInstructionType(bodyInstr.type, instrT)}
                </span>
                <button
                  type="button"
                  onClick={() => removeBodyInstruction(idx)}
                  className="p-1 hover:bg-dark-surface rounded"
                >
                  <XMarkIcon className="w-3 h-3 text-red-400" />
                </button>
              </div>

              {bodyInstr.type === 'relay_action' && (
                <RelayActionEditor
                  instruction={bodyInstr}
                  onChange={(updated) => updateBodyInstruction(idx, updated)}
                  espnowSlaves={espnowSlaves}
                  masterRelays={masterRelays}
                />
              )}

              {bodyInstr.type === 'switch' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-dark-textSecondary mb-2">{instrT.switchLabel}</label>
                    
                    {/* Seleção de Modo: Ciclo ou Timer */}
                    <div className="mb-3">
                      <label className="block text-xs text-dark-textSecondary mb-1">{instrT.switchMode}</label>
                      <select
                        value={bodyInstr.switch_mode || 'timer'}
                        onChange={(e) => {
                          const updated = { ...bodyInstr, switch_mode: e.target.value as 'cycle' | 'timer' };
                          if (e.target.value === 'cycle') {
                            updated.cycle_on_ms = updated.cycle_on_ms || 5000;
                            updated.cycle_off_ms = updated.cycle_off_ms || 5000;
                            updated.cycle_count = updated.cycle_count || 1;
                          } else {
                            updated.duration_ms = updated.duration_ms || 1000;
                          }
                          updateBodyInstruction(idx, updated);
                        }}
                        className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-aqua-500"
                      >
                        <option value="timer">{instrT.modeTimer}</option>
                        <option value="cycle">{instrT.modeCycle}</option>
                      </select>
                    </div>

                    {/* Configuração de Timer */}
                    {bodyInstr.switch_mode === 'timer' && (
                      <div>
                        <label className="block text-xs text-dark-textSecondary mb-1">{instrT.durationMs}</label>
                        <input
                          type="number"
                          min="0"
                          value={bodyInstr.duration_ms || 1000}
                          onChange={(e) => {
                            updateBodyInstruction(idx, {
                              ...bodyInstr,
                              duration_ms: parseInt(e.target.value) || 1000,
                            });
                          }}
                          className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-aqua-500"
                          placeholder="1000"
                        />
                        <p className="text-xs text-dark-textSecondary/80 mt-1">{instrT.relayDurationHint}</p>
                      </div>
                    )}

                    {/* Configuração de Ciclo - Compacto */}
                    {bodyInstr.switch_mode === 'cycle' && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2 items-end">
                          <div>
                            <label className="block text-xs text-dark-textSecondary mb-1">{instrT.cycleOn}</label>
                            <input
                              type="text"
                              pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}"
                              value={msToTime(bodyInstr.cycle_on_ms || 5000)}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (/^\d{2}:\d{2}:\d{2}$/.test(value)) {
                                  const ms = timeToMs(value);
                                  updateBodyInstruction(idx, {
                                    ...bodyInstr,
                                    cycle_on_ms: ms,
                                  });
                                }
                              }}
                              placeholder="00:00:05"
                              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-aqua-500 font-mono text-center"
                            />
                          </div>
                          <div className="flex items-center justify-center pb-1">
                            <ArrowPathIcon className="w-8 h-8 text-aqua-400 animate-spin-slow" />
                          </div>
                          <div>
                            <label className="block text-xs text-dark-textSecondary mb-1">{instrT.cycleOff}</label>
                            <input
                              type="text"
                              pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}"
                              value={msToTime(bodyInstr.cycle_off_ms || 5000)}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (/^\d{2}:\d{2}:\d{2}$/.test(value)) {
                                  const ms = timeToMs(value);
                                  updateBodyInstruction(idx, {
                                    ...bodyInstr,
                                    cycle_off_ms: ms,
                                  });
                                }
                              }}
                              placeholder="00:00:05"
                              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-aqua-500 font-mono text-center"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-dark-textSecondary mb-1">{instrT.cyclesLabel} <span className="text-aqua-400">{instrT.cyclesPerpetual}</span></label>
                          <input
                            type="number"
                            min="0"
                            value={bodyInstr.cycle_count ?? 0}
                            onChange={(e) => {
                              updateBodyInstruction(idx, {
                                ...bodyInstr,
                                cycle_count: parseInt(e.target.value) || 0,
                              });
                            }}
                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-aqua-500"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {bodyInstr.type === 'while' && (
                <WhileInstructionEditor
                  instruction={bodyInstr}
                  onChange={(updated) => updateBodyInstruction(idx, updated)}
                  espnowSlaves={espnowSlaves}
                  masterRelays={masterRelays}
                />
              )}

              {bodyInstr.type === 'if' && (
                <IfInstructionEditor
                  instruction={bodyInstr}
                  onChange={(updated) => updateBodyInstruction(idx, updated)}
                  espnowSlaves={espnowSlaves}
                  masterRelays={masterRelays}
                />
              )}

              {bodyInstr.type === 'return' && (
                <div className="text-xs text-dark-textSecondary italic">{instrT.returnFromLoop}</div>
              )}
            </div>
          ))}

          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => addBodyInstruction('while')}
              className="px-2 py-1 bg-dark-surface hover:bg-dark-border border border-dark-border rounded text-xs text-white transition-colors flex items-center gap-1"
            >
              <PlusIcon className="w-3 h-3" />
              {formatInstructionType('while', instrT)}
            </button>
            <button
              type="button"
              onClick={() => addBodyInstruction('if')}
              className="px-2 py-1 bg-dark-surface hover:bg-dark-border border border-dark-border rounded text-xs text-white transition-colors flex items-center gap-1"
            >
              <PlusIcon className="w-3 h-3" />
              {formatInstructionType('if', instrT)}
            </button>
            <button
              type="button"
              onClick={() => addBodyInstruction('relay_action')}
              className="px-2 py-1 bg-dark-surface hover:bg-dark-border border border-dark-border rounded text-xs text-white transition-colors flex items-center gap-1"
            >
              <PlusIcon className="w-3 h-3" />
              {formatInstructionType('relay_action', instrT)}
            </button>
            <button
              type="button"
              onClick={() => addBodyInstruction('switch')}
              className="px-2 py-1 bg-dark-surface hover:bg-dark-border border border-dark-border rounded text-xs text-white transition-colors flex items-center gap-1"
            >
              <PlusIcon className="w-3 h-3" />
              {formatInstructionType('switch', instrT)}
            </button>
            <button
              type="button"
              onClick={() => addBodyInstruction('return')}
              className="px-2 py-1 bg-dark-surface hover:bg-dark-border border border-dark-border rounded text-xs text-white transition-colors flex items-center gap-1"
            >
              <PlusIcon className="w-3 h-3" />
              {instrT.addReturn}
            </button>
          </div>
        </div>
      </div>

      {/* Espera entre iterações */}
      <div>
        <label className="block text-xs text-dark-textSecondary mb-1">
          Espera entre iterações (ms)
        </label>
        <input
          type="number"
          min="0"
          value={instruction.delay_ms || 1000}
          onChange={(e) =>
            onChange({
              ...instruction,
              delay_ms: parseInt(e.target.value) || 1000,
            })
          }
          className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-aqua-500"
        />
      </div>
    </div>
  );
}
