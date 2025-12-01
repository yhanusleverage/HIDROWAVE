'use client';

import React from 'react';
import { PlusIcon, XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { Instruction } from '../SequentialScriptEditor';
import { ESPNowSlave } from '@/lib/esp-now-slaves';
import RelayActionEditor from './RelayActionEditor';
import IfInstructionEditor from './IfInstructionEditor';

interface WhileInstructionEditorProps {
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

const WATER_LEVEL_OPTIONS = [
  { value: 'vazio', label: 'Vazio' },
  { value: 'baixo', label: 'Baixo' },
  { value: 'medio', label: 'Médio' },
  { value: 'alto', label: 'Alto' },
];

const OPERATORS = [
  { value: '<', label: 'Menor que (<)' },
  { value: '>', label: 'Maior que (>)' },
  { value: '<=', label: 'Menor ou igual (≤)' },
  { value: '>=', label: 'Maior ou igual (≥)' },
  { value: '==', label: 'Igual a (=)' },
  { value: '!=', label: 'Diferente de (≠)' },
];

export default function WhileInstructionEditor({
  instruction,
  onChange,
  espnowSlaves,
}: WhileInstructionEditorProps) {
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

  const updateBody = (newBody: Instruction[]) => {
    onChange({
      ...instruction,
      body: newBody,
    });
  };

  const addBodyInstruction = (type: Instruction['type']) => {
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
    updateBody([...(instruction.body || []), newInstr]);
  };

  const removeBodyInstruction = (index: number) => {
    updateBody((instruction.body || []).filter((_, i) => i !== index));
  };

  const updateBodyInstruction = (index: number, updated: Instruction) => {
    const newBody = [...(instruction.body || [])];
    newBody[index] = updated;
    updateBody(newBody);
  };

  const isLevelSensor = instruction.condition?.sensor === 'water_level';
  const currentSensor = instruction.condition?.sensor || 'water_level';

  return (
    <div className="space-y-3">
      {/* Condição */}
      <div className="border border-dark-border rounded-lg p-3 bg-dark-surface/30">
        <label className="block text-xs text-gray-400 mb-2">Condição (LOOP)</label>
        <div className="grid grid-cols-3 gap-2">
          <select
            value={currentSensor}
            onChange={(e) => {
              const newSensor = e.target.value;
              // Se mudar para um nível, ajustar valor padrão
              if (newSensor === 'water_level') {
                updateCondition('sensor', newSensor);
                updateCondition('value', 'vazio');
                updateCondition('operator', '!=');
              } else {
                updateCondition('sensor', newSensor);
                updateCondition('value', '0');
              }
            }}
            className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-aqua-500"
          >
            {SENSORS.map((sensor) => (
              <option key={sensor.value} value={sensor.value}>
                {sensor.label}
              </option>
            ))}
          </select>
          <select
            value={instruction.condition?.operator || '!='}
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
              {WATER_LEVEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
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

      {/* Body (instruções dentro do WHILE) */}
      <div>
        <label className="block text-xs text-gray-400 mb-2">
          Instruções dentro do LOOP:
        </label>
        <div className="space-y-2 ml-4 border-l-2 border-aqua-500/30 pl-3">
          {(instruction.body || []).map((bodyInstr, idx) => (
            <div
              key={idx}
              className="border border-dark-border rounded-lg p-2 bg-dark-surface/50"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-purple-400 font-mono">
                  {bodyInstr.type.toUpperCase()}
                </span>
                <button
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
                />
              )}

              {bodyInstr.type === 'switch' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">Switch (Trocar Estado)</label>
                    
                    {/* Seleção de Modo: Ciclo ou Timer */}
                    <div className="mb-3">
                      <label className="block text-xs text-gray-400 mb-1">Modo</label>
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
                        <option value="timer">Timer (Duração fixa)</option>
                        <option value="cycle">Ciclo (Toggle automático ON/OFF)</option>
                      </select>
                    </div>

                    {/* Configuração de Timer */}
                    {bodyInstr.switch_mode === 'timer' && (
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Duração (ms)</label>
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
                        <p className="text-xs text-gray-500 mt-1">Tempo que o relé ficará no estado alternado</p>
                      </div>
                    )}

                    {/* Configuração de Ciclo - Compacto */}
                    {bodyInstr.switch_mode === 'cycle' && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2 items-end">
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">ON ⏰</label>
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
                            <label className="block text-xs text-gray-400 mb-1">OFF ⏰</label>
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
                          <label className="block text-xs text-gray-400 mb-1">Ciclos: <span className="text-aqua-400">0 = Perpétuo</span></label>
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
                />
              )}

              {bodyInstr.type === 'if' && (
                <IfInstructionEditor
                  instruction={bodyInstr}
                  onChange={(updated) => updateBodyInstruction(idx, updated)}
                  espnowSlaves={espnowSlaves}
                />
              )}

              {bodyInstr.type === 'return' && (
                <div className="text-xs text-gray-400 italic">Retorna do loop</div>
              )}
            </div>
          ))}

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => addBodyInstruction('while')}
              className="px-2 py-1 bg-dark-surface hover:bg-dark-border border border-dark-border rounded text-xs text-white transition-colors flex items-center gap-1"
            >
              <PlusIcon className="w-3 h-3" />
              LOOP
            </button>
            <button
              onClick={() => addBodyInstruction('if')}
              className="px-2 py-1 bg-dark-surface hover:bg-dark-border border border-dark-border rounded text-xs text-white transition-colors flex items-center gap-1"
            >
              <PlusIcon className="w-3 h-3" />
              Se
            </button>
            <button
              onClick={() => addBodyInstruction('relay_action')}
              className="px-2 py-1 bg-dark-surface hover:bg-dark-border border border-dark-border rounded text-xs text-white transition-colors flex items-center gap-1"
            >
              <PlusIcon className="w-3 h-3" />
              Relé
            </button>
            <button
              onClick={() => addBodyInstruction('switch')}
              className="px-2 py-1 bg-dark-surface hover:bg-dark-border border border-dark-border rounded text-xs text-white transition-colors flex items-center gap-1"
            >
              <PlusIcon className="w-3 h-3" />
              SWITCH
            </button>
            <button
              onClick={() => addBodyInstruction('return')}
              className="px-2 py-1 bg-dark-surface hover:bg-dark-border border border-dark-border rounded text-xs text-white transition-colors flex items-center gap-1"
            >
              <PlusIcon className="w-3 h-3" />
              RETURN
            </button>
          </div>
        </div>
      </div>

      {/* Delay entre iterações */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">
          Delay entre iterações (ms)
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
