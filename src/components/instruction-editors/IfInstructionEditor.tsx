'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { PlusIcon, XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { Instruction } from '../SequentialScriptEditor';
import { ESPNowSlave } from '@/lib/esp-now-slaves';
import type { MasterRelayOption } from '@/lib/master-relay-options';
import RelayActionEditor from './RelayActionEditor';
import ConditionFields from './ConditionFields';
import { createNestedInstruction } from '@/lib/instruction-factory';
import {
  formatInstructionType,
  SWITCH_LABEL,
  SWITCH_MODE_CYCLE,
  SWITCH_MODE_TIMER,
  CONDITION_SENSORS,
} from '@/lib/instruction-labels';

const WhileInstructionEditor = dynamic(() => import('./WhileInstructionEditor'), { ssr: false });

interface IfInstructionEditorProps {
  instruction: Instruction;
  onChange: (updated: Instruction) => void;
  espnowSlaves: ESPNowSlave[];
  masterRelays: MasterRelayOption[];
}

const SCRIPT_SENSORS = CONDITION_SENSORS.filter(
  (s) => s.value !== 'ph' && s.value !== 'ec'
);

export default function IfInstructionEditor({
  instruction,
  onChange,
  espnowSlaves,
  masterRelays,
}: IfInstructionEditorProps) {
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

  const updateThen = (newThen: Instruction[]) => {
    onChange({
      ...instruction,
      then: newThen,
    });
  };

  const updateElse = (newElse: Instruction[]) => {
    onChange({
      ...instruction,
      else: newElse,
    });
  };

  const addThenInstruction = (type: Instruction['type']) => {
    updateThen([...(instruction.then || []), createNestedInstruction(type)]);
  };

  const removeThenInstruction = (index: number) => {
    updateThen((instruction.then || []).filter((_, i) => i !== index));
  };

  const updateThenInstruction = (index: number, updated: Instruction) => {
    const newThen = [...(instruction.then || [])];
    newThen[index] = updated;
    updateThen(newThen);
  };

  const addElseInstruction = (type: Instruction['type']) => {
    updateElse([...(instruction.else || []), createNestedInstruction(type)]);
  };

  const removeElseInstruction = (index: number) => {
    updateElse((instruction.else || []).filter((_, i) => i !== index));
  };

  const updateElseInstruction = (index: number, updated: Instruction) => {
    const newElse = [...(instruction.else || [])];
    newElse[index] = updated;
    updateElse(newElse);
  };

  const currentCondition = instruction.condition ?? {
    sensor: 'water_level',
    operator: '!=',
    value: 'vazio',
  };

  return (
    <div className="space-y-3">
      <ConditionFields
        label="Condição (Se)"
        condition={currentCondition}
        onChange={(condition) =>
          updateCondition({
            sensor: condition.sensor,
            operator: condition.operator,
            value: String(condition.value),
          })
        }
        sensors={SCRIPT_SENSORS}
      />

      {/* THEN */}
      <div>
        <label className="block text-xs text-dark-textSecondary mb-2">Então (se verdadeiro):</label>
        <div className="space-y-2 ml-4 border-l-2 border-green-500/30 pl-3">
          {(instruction.then || []).map((thenInstr, idx) => (
            <div
              key={thenInstr.id ?? idx}
              className="border border-dark-border rounded-lg p-2 bg-dark-surface/50"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-green-400 font-mono">
                  {formatInstructionType(thenInstr.type)}
                </span>
                <button
                  type="button"
                  onClick={() => removeThenInstruction(idx)}
                  className="p-1 hover:bg-dark-surface rounded"
                >
                  <XMarkIcon className="w-3 h-3 text-red-400" />
                </button>
              </div>

              {thenInstr.type === 'relay_action' && (
                <RelayActionEditor
                  instruction={thenInstr}
                  onChange={(updated) => updateThenInstruction(idx, updated)}
                  espnowSlaves={espnowSlaves}
                  masterRelays={masterRelays}
                />
              )}

              {thenInstr.type === 'switch' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-dark-textSecondary mb-2">{SWITCH_LABEL}</label>
                    
                    {/* Seleção de Modo: Ciclo ou Timer */}
                    <div className="mb-3">
                      <label className="block text-xs text-dark-textSecondary mb-1">Modo</label>
                      <select
                        value={thenInstr.switch_mode || 'timer'}
                        onChange={(e) => {
                          const updated = { ...thenInstr, switch_mode: e.target.value as 'cycle' | 'timer' };
                          if (e.target.value === 'cycle') {
                            updated.cycle_on_ms = updated.cycle_on_ms || 5000;
                            updated.cycle_off_ms = updated.cycle_off_ms || 5000;
                            updated.cycle_count = updated.cycle_count || 1;
                          } else {
                            updated.duration_ms = updated.duration_ms || 1000;
                          }
                          updateThenInstruction(idx, updated);
                        }}
                        className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-aqua-500"
                      >
                        <option value="timer">{SWITCH_MODE_TIMER}</option>
                        <option value="cycle">{SWITCH_MODE_CYCLE}</option>
                      </select>
                    </div>

                    {/* Configuração de Timer */}
                    {thenInstr.switch_mode === 'timer' && (
                      <div>
                        <label className="block text-xs text-dark-textSecondary mb-1">Duração (ms)</label>
                        <input
                          type="number"
                          min="0"
                          value={thenInstr.duration_ms || 1000}
                          onChange={(e) => {
                            updateThenInstruction(idx, {
                              ...thenInstr,
                              duration_ms: parseInt(e.target.value) || 1000,
                            });
                          }}
                          className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-aqua-500"
                          placeholder="1000"
                        />
                        <p className="text-xs text-dark-textSecondary/80 mt-1">Tempo que o switch ficará ativo</p>
                      </div>
                    )}

                    {/* Configuração de Ciclo - Compacto */}
                    {thenInstr.switch_mode === 'cycle' && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2 items-end">
                          <div>
                            <label className="block text-xs text-dark-textSecondary mb-1">ON ⏰</label>
                            <input
                              type="text"
                              value={thenInstr.cycle_on_time || msToTime(thenInstr.cycle_on_ms || 5000)}
                              onChange={(e) => {
                                const value = e.target.value;
                                // Permitir edición libre, pero convertir cuando tenga formato válido
                                if (/^\d{2}:\d{2}:\d{2}$/.test(value)) {
                                  const ms = timeToMs(value);
                                  updateThenInstruction(idx, {
                                    ...thenInstr,
                                    cycle_on_ms: ms,
                                    cycle_on_time: value,
                                  });
                                } else {
                                  // Guardar el valor temporal mientras el usuario escribe
                                  updateThenInstruction(idx, {
                                    ...thenInstr,
                                    cycle_on_time: value,
                                  });
                                }
                              }}
                              onBlur={(e) => {
                                // Al perder el foco, si no es válido, restaurar el valor por defecto
                                const value = e.target.value;
                                if (!/^\d{2}:\d{2}:\d{2}$/.test(value)) {
                                  const defaultTime = msToTime(thenInstr.cycle_on_ms || 5000);
                                  updateThenInstruction(idx, {
                                    ...thenInstr,
                                    cycle_on_time: defaultTime,
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
                            <label className="block text-xs text-dark-textSecondary mb-1">OFF ⏰</label>
                            <input
                              type="text"
                              value={thenInstr.cycle_off_time || msToTime(thenInstr.cycle_off_ms || 5000)}
                              onChange={(e) => {
                                const value = e.target.value;
                                // Permitir edición libre, pero convertir cuando tenga formato válido
                                if (/^\d{2}:\d{2}:\d{2}$/.test(value)) {
                                  const ms = timeToMs(value);
                                  updateThenInstruction(idx, {
                                    ...thenInstr,
                                    cycle_off_ms: ms,
                                    cycle_off_time: value,
                                  });
                                } else {
                                  // Guardar el valor temporal mientras el usuario escribe
                                  updateThenInstruction(idx, {
                                    ...thenInstr,
                                    cycle_off_time: value,
                                  });
                                }
                              }}
                              onBlur={(e) => {
                                // Al perder el foco, si no es válido, restaurar el valor por defecto
                                const value = e.target.value;
                                if (!/^\d{2}:\d{2}:\d{2}$/.test(value)) {
                                  const defaultTime = msToTime(thenInstr.cycle_off_ms || 5000);
                                  updateThenInstruction(idx, {
                                    ...thenInstr,
                                    cycle_off_time: defaultTime,
                                  });
                                }
                              }}
                              placeholder="00:00:05"
                              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-aqua-500 font-mono text-center"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-dark-textSecondary mb-1">Ciclos: <span className="text-aqua-400">0 = Perpétuo</span></label>
                          <input
                            type="number"
                            min="0"
                            value={thenInstr.cycle_count ?? 0}
                            onChange={(e) => {
                              updateThenInstruction(idx, {
                                ...thenInstr,
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

              {thenInstr.type === 'while' && (
                <WhileInstructionEditor
                  instruction={thenInstr}
                  onChange={(updated) => updateThenInstruction(idx, updated)}
                  espnowSlaves={espnowSlaves}
                  masterRelays={masterRelays}
                />
              )}

              {thenInstr.type === 'if' && (
                <IfInstructionEditor
                  instruction={thenInstr}
                  onChange={(updated) => updateThenInstruction(idx, updated)}
                  espnowSlaves={espnowSlaves}
                  masterRelays={masterRelays}
                />
              )}

              {thenInstr.type === 'return' && (
                <div className="text-xs text-dark-textSecondary italic">Retornar do loop</div>
              )}
            </div>
          ))}

          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => addThenInstruction('while')}
              className="px-2 py-1 bg-dark-surface hover:bg-dark-border border border-dark-border rounded text-xs text-white transition-colors flex items-center gap-1"
            >
              <PlusIcon className="w-3 h-3" />
              {formatInstructionType('while')}
            </button>
            <button
              type="button"
              onClick={() => addThenInstruction('if')}
              className="px-2 py-1 bg-dark-surface hover:bg-dark-border border border-dark-border rounded text-xs text-white transition-colors flex items-center gap-1"
            >
              <PlusIcon className="w-3 h-3" />
              Se
            </button>
            <button
              type="button"
              onClick={() => addThenInstruction('relay_action')}
              className="px-2 py-1 bg-dark-surface hover:bg-dark-border border border-dark-border rounded text-xs text-white transition-colors flex items-center gap-1"
            >
              <PlusIcon className="w-3 h-3" />
              {formatInstructionType('relay_action')}
            </button>
            <button
              type="button"
              onClick={() => addThenInstruction('switch')}
              className="px-2 py-1 bg-dark-surface hover:bg-dark-border border border-dark-border rounded text-xs text-white transition-colors flex items-center gap-1"
            >
              <PlusIcon className="w-3 h-3" />
              {formatInstructionType('switch')}
            </button>
            <button
              type="button"
              onClick={() => addThenInstruction('return')}
              className="px-2 py-1 bg-dark-surface hover:bg-dark-border border border-dark-border rounded text-xs text-white transition-colors flex items-center gap-1"
            >
              <PlusIcon className="w-3 h-3" />
              Retornar
            </button>
          </div>
        </div>
      </div>

      {/* Senão (opcional) */}
      <div>
        <label className="block text-xs text-dark-textSecondary mb-2">
          Senão (se falso) <span className="text-dark-textSecondary/80">(opcional)</span>:
        </label>
        <div className="space-y-2 ml-4 border-l-2 border-orange-500/30 pl-3">
          {(instruction.else || []).map((elseInstr, idx) => (
            <div
              key={elseInstr.id ?? idx}
              className="border border-dark-border rounded-lg p-2 bg-dark-surface/50"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-orange-400 font-mono">
                  {formatInstructionType(elseInstr.type)}
                </span>
                <button
                  type="button"
                  onClick={() => removeElseInstruction(idx)}
                  className="p-1 hover:bg-dark-surface rounded"
                >
                  <XMarkIcon className="w-3 h-3 text-red-400" />
                </button>
              </div>

              {elseInstr.type === 'relay_action' && (
                <RelayActionEditor
                  instruction={elseInstr}
                  onChange={(updated) => updateElseInstruction(idx, updated)}
                  espnowSlaves={espnowSlaves}
                  masterRelays={masterRelays}
                />
              )}

              {elseInstr.type === 'switch' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-dark-textSecondary mb-2">{SWITCH_LABEL}</label>
                    
                    {/* Seleção de Modo: Ciclo ou Timer */}
                    <div className="mb-3">
                      <label className="block text-xs text-dark-textSecondary mb-1">Modo</label>
                      <select
                        value={elseInstr.switch_mode || 'timer'}
                        onChange={(e) => {
                          const updated = { ...elseInstr, switch_mode: e.target.value as 'cycle' | 'timer' };
                          if (e.target.value === 'cycle') {
                            updated.cycle_on_ms = updated.cycle_on_ms || 5000;
                            updated.cycle_off_ms = updated.cycle_off_ms || 5000;
                            updated.cycle_count = updated.cycle_count || 1;
                          } else {
                            updated.duration_ms = updated.duration_ms || 1000;
                          }
                          updateElseInstruction(idx, updated);
                        }}
                        className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-aqua-500"
                      >
                        <option value="timer">{SWITCH_MODE_TIMER}</option>
                        <option value="cycle">{SWITCH_MODE_CYCLE}</option>
                      </select>
                    </div>

                    {/* Configuração de Timer */}
                    {elseInstr.switch_mode === 'timer' && (
                      <div>
                        <label className="block text-xs text-dark-textSecondary mb-1">Duração (ms)</label>
                        <input
                          type="number"
                          min="0"
                          value={elseInstr.duration_ms || 1000}
                          onChange={(e) => {
                            updateElseInstruction(idx, {
                              ...elseInstr,
                              duration_ms: parseInt(e.target.value) || 1000,
                            });
                          }}
                          className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-aqua-500"
                          placeholder="1000"
                        />
                        <p className="text-xs text-dark-textSecondary/80 mt-1">Tempo que o switch ficará ativo</p>
                      </div>
                    )}

                    {/* Configuração de Ciclo - Compacto */}
                    {elseInstr.switch_mode === 'cycle' && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2 items-end">
                          <div>
                            <label className="block text-xs text-dark-textSecondary mb-1">ON ⏰</label>
                            <input
                              type="text"
                              value={elseInstr.cycle_on_time || msToTime(elseInstr.cycle_on_ms || 5000)}
                              onChange={(e) => {
                                const value = e.target.value;
                                // Permitir edición libre, pero convertir cuando tenga formato válido
                                if (/^\d{2}:\d{2}:\d{2}$/.test(value)) {
                                  const ms = timeToMs(value);
                                  updateElseInstruction(idx, {
                                    ...elseInstr,
                                    cycle_on_ms: ms,
                                    cycle_on_time: value,
                                  });
                                } else {
                                  // Guardar el valor temporal mientras el usuario escribe
                                  updateElseInstruction(idx, {
                                    ...elseInstr,
                                    cycle_on_time: value,
                                  });
                                }
                              }}
                              onBlur={(e) => {
                                // Al perder el foco, si no es válido, restaurar el valor por defecto
                                const value = e.target.value;
                                if (!/^\d{2}:\d{2}:\d{2}$/.test(value)) {
                                  const defaultTime = msToTime(elseInstr.cycle_on_ms || 5000);
                                  updateElseInstruction(idx, {
                                    ...elseInstr,
                                    cycle_on_time: defaultTime,
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
                            <label className="block text-xs text-dark-textSecondary mb-1">OFF ⏰</label>
                            <input
                              type="text"
                              value={elseInstr.cycle_off_time || msToTime(elseInstr.cycle_off_ms || 5000)}
                              onChange={(e) => {
                                const value = e.target.value;
                                // Permitir edición libre, pero convertir cuando tenga formato válido
                                if (/^\d{2}:\d{2}:\d{2}$/.test(value)) {
                                  const ms = timeToMs(value);
                                  updateElseInstruction(idx, {
                                    ...elseInstr,
                                    cycle_off_ms: ms,
                                    cycle_off_time: value,
                                  });
                                } else {
                                  // Guardar el valor temporal mientras el usuario escribe
                                  updateElseInstruction(idx, {
                                    ...elseInstr,
                                    cycle_off_time: value,
                                  });
                                }
                              }}
                              onBlur={(e) => {
                                // Al perder el foco, si no es válido, restaurar el valor por defecto
                                const value = e.target.value;
                                if (!/^\d{2}:\d{2}:\d{2}$/.test(value)) {
                                  const defaultTime = msToTime(elseInstr.cycle_off_ms || 5000);
                                  updateElseInstruction(idx, {
                                    ...elseInstr,
                                    cycle_off_time: defaultTime,
                                  });
                                }
                              }}
                              placeholder="00:00:05"
                              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-aqua-500 font-mono text-center"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-dark-textSecondary mb-1">Ciclos: <span className="text-aqua-400">0 = Perpétuo</span></label>
                          <input
                            type="number"
                            min="0"
                            value={elseInstr.cycle_count ?? 0}
                            onChange={(e) => {
                              updateElseInstruction(idx, {
                                ...elseInstr,
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

              {elseInstr.type === 'while' && (
                <WhileInstructionEditor
                  instruction={elseInstr}
                  onChange={(updated) => updateElseInstruction(idx, updated)}
                  espnowSlaves={espnowSlaves}
                  masterRelays={masterRelays}
                />
              )}

              {elseInstr.type === 'if' && (
                <IfInstructionEditor
                  instruction={elseInstr}
                  onChange={(updated) => updateElseInstruction(idx, updated)}
                  espnowSlaves={espnowSlaves}
                  masterRelays={masterRelays}
                />
              )}

              {elseInstr.type === 'return' && (
                <div className="text-xs text-dark-textSecondary italic">Retornar do loop</div>
              )}
            </div>
          ))}

          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => addElseInstruction('while')}
              className="px-2 py-1 bg-dark-surface hover:bg-dark-border border border-dark-border rounded text-xs text-white transition-colors flex items-center gap-1"
            >
              <PlusIcon className="w-3 h-3" />
              {formatInstructionType('while')}
            </button>
            <button
              type="button"
              onClick={() => addElseInstruction('if')}
              className="px-2 py-1 bg-dark-surface hover:bg-dark-border border border-dark-border rounded text-xs text-white transition-colors flex items-center gap-1"
            >
              <PlusIcon className="w-3 h-3" />
              Se
            </button>
            <button
              type="button"
              onClick={() => addElseInstruction('relay_action')}
              className="px-2 py-1 bg-dark-surface hover:bg-dark-border border border-dark-border rounded text-xs text-white transition-colors flex items-center gap-1"
            >
              <PlusIcon className="w-3 h-3" />
              {formatInstructionType('relay_action')}
            </button>
            <button
              type="button"
              onClick={() => addElseInstruction('switch')}
              className="px-2 py-1 bg-dark-surface hover:bg-dark-border border border-dark-border rounded text-xs text-white transition-colors flex items-center gap-1"
            >
              <PlusIcon className="w-3 h-3" />
              {formatInstructionType('switch')}
            </button>
            <button
              type="button"
              onClick={() => addElseInstruction('return')}
              className="px-2 py-1 bg-dark-surface hover:bg-dark-border border border-dark-border rounded text-xs text-white transition-colors flex items-center gap-1"
            >
              <PlusIcon className="w-3 h-3" />
              Retornar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
