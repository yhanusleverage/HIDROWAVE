'use client';

import React from 'react';
import { PlusIcon, XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { Instruction } from '../SequentialScriptEditor';
import { ESPNowSlave } from '@/lib/esp-now-slaves';
import RelayActionEditor from './RelayActionEditor';
import WhileInstructionEditor from './WhileInstructionEditor';

interface IfInstructionEditorProps {
  instruction: Instruction;
  onChange: (updated: Instruction) => void;
  espnowSlaves: ESPNowSlave[];
}

const SENSORS = [
  { value: 'water_level', label: 'Nível de Água' },
  { value: 'temperature', label: 'Temperatura (°C)' },
  { value: 'temp_water', label: 'Temp. Água (°C)' },
  { value: 'temp_env', label: 'Temp. Ambiente (°C)' },
  { value: 'humidity', label: 'Umidade (%)' },
];

const OPERATORS = [
  { value: '==', label: 'Igual (==)' },
  { value: '!=', label: 'Diferente (!=)' },
  { value: '<', label: 'Menor (<)' },
  { value: '>', label: 'Maior (>)' },
  { value: '<=', label: 'Menor ou Igual (<=)' },
  { value: '>=', label: 'Maior ou Igual (>=)' },
];

export default function IfInstructionEditor({
  instruction,
  onChange,
  espnowSlaves,
}: IfInstructionEditorProps) {
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

  const updateCondition = (field: string, value: string) => {
    onChange({
      ...instruction,
      condition: {
        ...instruction.condition!,
        [field]: value,
      },
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
    const newInstr: Instruction = {
      type,
      relay_number: type === 'relay_action' ? 0 : undefined,
      action: type === 'relay_action' ? 'on' : undefined,
      duration_ms: type === 'switch' ? 1000 : undefined,
      condition: (type === 'while' || type === 'if') ? {
        sensor: 'water_level',
        operator: '!=',
        value: 'vazio',
      } : undefined,
      body: type === 'while' ? [] : undefined,
      then: type === 'if' ? [] : undefined,
      else: type === 'if' ? [] : undefined,
    };
    updateThen([...(instruction.then || []), newInstr]);
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
    const newInstr: Instruction = {
      type,
      relay_number: type === 'relay_action' ? 0 : undefined,
      action: type === 'relay_action' ? 'on' : undefined,
      duration_ms: type === 'switch' ? 1000 : undefined,
      condition: (type === 'while' || type === 'if') ? {
        sensor: 'water_level',
        operator: '!=',
        value: 'vazio',
      } : undefined,
      body: type === 'while' ? [] : undefined,
      then: type === 'if' ? [] : undefined,
      else: type === 'if' ? [] : undefined,
    };
    updateElse([...(instruction.else || []), newInstr]);
  };

  const removeElseInstruction = (index: number) => {
    updateElse((instruction.else || []).filter((_, i) => i !== index));
  };

  const updateElseInstruction = (index: number, updated: Instruction) => {
    const newElse = [...(instruction.else || [])];
    newElse[index] = updated;
    updateElse(newElse);
  };

  const currentSensor = instruction.condition?.sensor || 'water_level';
  const isLevelSensor = currentSensor === 'water_level';

  return (
    <div className="space-y-3">
      {/* Condição */}
      <div className="border border-dark-border rounded-lg p-3 bg-dark-surface/30">
        <label className="block text-xs text-gray-400 mb-2">Condição (Se)</label>
        <div className="grid grid-cols-3 gap-2">
          <select
            value={instruction.condition?.sensor || 'water_level'}
            onChange={(e) => updateCondition('sensor', e.target.value)}
            className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-aqua-500"
          >
            {SENSORS.map((sensor) => (
              <option key={sensor.value} value={sensor.value}>
                {sensor.label}
              </option>
            ))}
          </select>
          <select
            value={instruction.condition?.operator || '=='}
            onChange={(e) => updateCondition('operator', e.target.value)}
            className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-aqua-500"
          >
            {OPERATORS.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
          {isLevelSensor ? (
            <select
              value={instruction.condition?.value || 'vazio'}
              onChange={(e) => updateCondition('value', e.target.value)}
              className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-aqua-500"
            >
              <option value="vazio">Vazio</option>
              <option value="baixo">Baixo</option>
              <option value="medio">Médio</option>
              <option value="alto">Alto</option>
            </select>
          ) : (
          <input
              type="number"
              step="0.1"
            value={instruction.condition?.value || ''}
            onChange={(e) => updateCondition('value', e.target.value)}
              placeholder={
                currentSensor === 'humidity' 
                  ? 'Valor (%)' 
                  : currentSensor === 'temperature' || currentSensor === 'temp_water' || currentSensor === 'temp_env'
                  ? 'Valor (°C)'
                  : 'Valor'
              }
            className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-500"
          />
          )}
        </div>
      </div>

      {/* THEN */}
      <div>
        <label className="block text-xs text-gray-400 mb-2">THEN (se verdadeiro):</label>
        <div className="space-y-2 ml-4 border-l-2 border-green-500/30 pl-3">
          {(instruction.then || []).map((thenInstr, idx) => (
            <div
              key={idx}
              className="border border-dark-border rounded-lg p-2 bg-dark-surface/50"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-green-400 font-mono">
                  {thenInstr.type.toUpperCase()}
                </span>
                <button
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
                />
              )}

              {thenInstr.type === 'switch' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">Switch (Trocar Estado)</label>
                    
                    {/* Seleção de Modo: Ciclo ou Timer */}
                    <div className="mb-3">
                      <label className="block text-xs text-gray-400 mb-1">Modo</label>
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
                        <option value="timer">Timer (Duração fixa)</option>
                        <option value="cycle">Ciclo (Toggle automático ON/OFF)</option>
                      </select>
                    </div>

                    {/* Configuração de Timer */}
                    {thenInstr.switch_mode === 'timer' && (
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Duração (ms)</label>
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
                        <p className="text-xs text-gray-500 mt-1">Tempo que o switch ficará ativo</p>
                      </div>
                    )}

                    {/* Configuração de Ciclo - Compacto */}
                    {thenInstr.switch_mode === 'cycle' && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2 items-end">
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">ON ⏰</label>
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
                            <label className="block text-xs text-gray-400 mb-1">OFF ⏰</label>
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
                          <label className="block text-xs text-gray-400 mb-1">Ciclos: <span className="text-aqua-400">0 = Perpétuo</span></label>
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
                />
              )}

              {thenInstr.type === 'if' && (
                <IfInstructionEditor
                  instruction={thenInstr}
                  onChange={(updated) => updateThenInstruction(idx, updated)}
                  espnowSlaves={espnowSlaves}
                />
              )}

              {thenInstr.type === 'return' && (
                <div className="text-xs text-gray-400 italic">Retorna do loop</div>
              )}
            </div>
          ))}

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => addThenInstruction('while')}
              className="px-2 py-1 bg-dark-surface hover:bg-dark-border border border-dark-border rounded text-xs text-white transition-colors flex items-center gap-1"
            >
              <PlusIcon className="w-3 h-3" />
              LOOP
            </button>
            <button
              onClick={() => addThenInstruction('if')}
              className="px-2 py-1 bg-dark-surface hover:bg-dark-border border border-dark-border rounded text-xs text-white transition-colors flex items-center gap-1"
            >
              <PlusIcon className="w-3 h-3" />
              Se
            </button>
            <button
              onClick={() => addThenInstruction('relay_action')}
              className="px-2 py-1 bg-dark-surface hover:bg-dark-border border border-dark-border rounded text-xs text-white transition-colors flex items-center gap-1"
            >
              <PlusIcon className="w-3 h-3" />
              Relé
            </button>
            <button
              onClick={() => addThenInstruction('switch')}
              className="px-2 py-1 bg-dark-surface hover:bg-dark-border border border-dark-border rounded text-xs text-white transition-colors flex items-center gap-1"
            >
              <PlusIcon className="w-3 h-3" />
              SWITCH
            </button>
            <button
              onClick={() => addThenInstruction('return')}
              className="px-2 py-1 bg-dark-surface hover:bg-dark-border border border-dark-border rounded text-xs text-white transition-colors flex items-center gap-1"
            >
              <PlusIcon className="w-3 h-3" />
              RETURN
            </button>
          </div>
        </div>
      </div>

      {/* Senão (opcional) */}
      <div>
        <label className="block text-xs text-gray-400 mb-2">
          Senão (se falso) <span className="text-gray-500">(opcional)</span>:
        </label>
        <div className="space-y-2 ml-4 border-l-2 border-orange-500/30 pl-3">
          {(instruction.else || []).map((elseInstr, idx) => (
            <div
              key={idx}
              className="border border-dark-border rounded-lg p-2 bg-dark-surface/50"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-orange-400 font-mono">
                  {elseInstr.type.toUpperCase()}
                </span>
                <button
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
                />
              )}

              {elseInstr.type === 'switch' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">Switch (Trocar Estado)</label>
                    
                    {/* Seleção de Modo: Ciclo ou Timer */}
                    <div className="mb-3">
                      <label className="block text-xs text-gray-400 mb-1">Modo</label>
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
                        <option value="timer">Timer (Duração fixa)</option>
                        <option value="cycle">Ciclo (Toggle automático ON/OFF)</option>
                      </select>
                    </div>

                    {/* Configuração de Timer */}
                    {elseInstr.switch_mode === 'timer' && (
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Duração (ms)</label>
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
                        <p className="text-xs text-gray-500 mt-1">Tempo que o switch ficará ativo</p>
                      </div>
                    )}

                    {/* Configuração de Ciclo - Compacto */}
                    {elseInstr.switch_mode === 'cycle' && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2 items-end">
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">ON ⏰</label>
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
                            <label className="block text-xs text-gray-400 mb-1">OFF ⏰</label>
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
                          <label className="block text-xs text-gray-400 mb-1">Ciclos: <span className="text-aqua-400">0 = Perpétuo</span></label>
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
                />
              )}

              {elseInstr.type === 'if' && (
                <IfInstructionEditor
                  instruction={elseInstr}
                  onChange={(updated) => updateElseInstruction(idx, updated)}
                  espnowSlaves={espnowSlaves}
                />
              )}

              {elseInstr.type === 'return' && (
                <div className="text-xs text-gray-400 italic">Retorna do loop</div>
              )}
            </div>
          ))}

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => addElseInstruction('while')}
              className="px-2 py-1 bg-dark-surface hover:bg-dark-border border border-dark-border rounded text-xs text-white transition-colors flex items-center gap-1"
            >
              <PlusIcon className="w-3 h-3" />
              LOOP
            </button>
            <button
              onClick={() => addElseInstruction('if')}
              className="px-2 py-1 bg-dark-surface hover:bg-dark-border border border-dark-border rounded text-xs text-white transition-colors flex items-center gap-1"
            >
              <PlusIcon className="w-3 h-3" />
              Se
            </button>
            <button
              onClick={() => addElseInstruction('relay_action')}
              className="px-2 py-1 bg-dark-surface hover:bg-dark-border border border-dark-border rounded text-xs text-white transition-colors flex items-center gap-1"
            >
              <PlusIcon className="w-3 h-3" />
              Relé
            </button>
            <button
              onClick={() => addElseInstruction('switch')}
              className="px-2 py-1 bg-dark-surface hover:bg-dark-border border border-dark-border rounded text-xs text-white transition-colors flex items-center gap-1"
            >
              <PlusIcon className="w-3 h-3" />
              SWITCH
            </button>
            <button
              onClick={() => addElseInstruction('return')}
              className="px-2 py-1 bg-dark-surface hover:bg-dark-border border border-dark-border rounded text-xs text-white transition-colors flex items-center gap-1"
            >
              <PlusIcon className="w-3 h-3" />
              RETURN
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
