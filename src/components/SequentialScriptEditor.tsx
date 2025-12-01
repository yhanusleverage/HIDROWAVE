'use client';

import React, { useState, useEffect } from 'react';
import { XMarkIcon, ArrowUpIcon, ArrowDownIcon, TrashIcon, PlusIcon, ChevronDownIcon, ChevronUpIcon, Cog6ToothIcon, PaperClipIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import WhileInstructionEditor from './instruction-editors/WhileInstructionEditor';
import IfInstructionEditor from './instruction-editors/IfInstructionEditor';
import RelayActionEditor from './instruction-editors/RelayActionEditor';
import { getESPNOWSlaves, ESPNowSlave } from '@/lib/esp-now-slaves';
import { useAuth } from '@/contexts/AuthContext';

export interface Instruction {
  type: 'while' | 'if' | 'relay_action' | 'switch' | 'return' | 'break' | 'continue' | 'delay';
  condition?: {
    sensor: string;
    operator: string;
    value: string;
  };
  body?: Instruction[];
  then?: Instruction[];
  else?: Instruction[];
  relay_number?: number;
  action?: 'on' | 'off' | 'toggle';
  target?: 'master' | 'slave';
  slave_mac?: string;
  duration_seconds?: number;
  duration_ms?: number;
  delay_ms?: number;
  max_iterations?: number;
  // Switch mode
  switch_mode?: 'cycle' | 'timer';
  cycle_on_ms?: number;
  cycle_off_ms?: number;
  cycle_count?: number;
  cycle_on_time?: string; // Valor temporal para edición
  cycle_off_time?: string; // Valor temporal para edición
}

interface ChainedEvent {
  target_rule_id: string;
  trigger_on: 'success' | 'failure';
  delay_ms: number;
}

interface SequentialScriptEditorProps {
  scriptId: string | null;
  deviceId: string;
  onClose: () => void;
}

export default function SequentialScriptEditor({
  scriptId,
  deviceId,
  onClose,
}: SequentialScriptEditorProps) {
  const { userProfile } = useAuth();
  const [ruleName, setRuleName] = useState('');
  const [ruleDescription, setRuleDescription] = useState('');
  const [priority, setPriority] = useState(50);
  const [enabled, setEnabled] = useState(true);
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [loopInterval, setLoopInterval] = useState(5000);
  const [maxIterations, setMaxIterations] = useState(0);
  const [loading, setLoading] = useState(false);
  const [espnowSlaves, setEspnowSlaves] = useState<ESPNowSlave[]>([]);
  const [expandedAdvanced, setExpandedAdvanced] = useState(false);
  const [chainedEvents, setChainedEvents] = useState<ChainedEvent[]>([]);
  const [expandedChainedEvents, setExpandedChainedEvents] = useState(false);
  const [availableRules, setAvailableRules] = useState<Array<{ rule_id: string; rule_name: string }>>([]);
  const [currentRuleId, setCurrentRuleId] = useState<string | null>(null);

  // ✅ Carregar regras disponíveis para eventos encadeados
  useEffect(() => {
    const loadAvailableRules = async () => {
      if (!deviceId || !userProfile?.email) return;
      
      try {
        const { data, error } = await supabase
          .from('decision_rules')
          .select('rule_id, rule_name')
          .eq('device_id', deviceId)
          .eq('created_by', userProfile.email)
          .order('rule_name', { ascending: true });

        if (error) throw error;
        setAvailableRules(data || []);
      } catch (error) {
        console.error('Erro ao carregar regras disponíveis:', error);
      }
    };

    loadAvailableRules();
  }, [deviceId, userProfile?.email]);

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
  // ✅ Funcionalidades de Nova Regra
  const [cooldown, setCooldown] = useState(60);
  const [maxExecutionsPerHour, setMaxExecutionsPerHour] = useState(10);

  useEffect(() => {
    if (scriptId) {
      loadScript(scriptId);
    }
    if (deviceId && userProfile?.email) {
    loadSlaves();
    }
  }, [scriptId, deviceId, userProfile?.email]);

  const loadSlaves = async () => {
    if (!deviceId || !userProfile?.email) {
      console.warn('⚠️ Não é possível carregar slaves: deviceId ou userProfile.email ausente');
      return;
    }
    try {
      const slaves = await getESPNOWSlaves(deviceId, userProfile.email);
      setEspnowSlaves(slaves);
    } catch (error) {
      console.error('Erro ao carregar slaves:', error);
    }
  };

  const loadScript = async (id: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('decision_rules')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setRuleName(data.rule_name);
        setRuleDescription(data.rule_description || '');
        setPriority(data.priority);
        setEnabled(data.enabled !== false);
        setCurrentRuleId(data.rule_id); // ✅ Guardar rule_id atual
        if (data.rule_json?.script) {
          setInstructions(data.rule_json.script.instructions || []);
          setLoopInterval(data.rule_json.script.loop_interval_ms || 5000);
          setMaxIterations(data.rule_json.script.max_iterations || 0);
          if (data.rule_json.script.chained_events) {
            setChainedEvents(data.rule_json.script.chained_events || []);
          }
          // ✅ Carregar funcionalidades de Nova Regra
          setCooldown(data.rule_json.script.cooldown || 60);
          setMaxExecutionsPerHour(data.rule_json.script.max_executions_per_hour || 10);
        }
      }
    } catch (error: any) {
      console.error('Erro ao carregar script:', error);
      toast.error('Erro ao carregar função');
    } finally {
      setLoading(false);
    }
  };

  const addInstruction = (type: Instruction['type']) => {
    const newInstr: Instruction = {
      type,
      condition:
        type === 'while' || type === 'if'
          ? { sensor: 'water_level', operator: '!=', value: 'vazio' }
          : undefined,
      body: type === 'while' ? [] : undefined,
      then: type === 'if' ? [] : undefined,
      relay_number: type === 'relay_action' ? 5 : undefined,
      action: type === 'relay_action' ? 'on' : undefined,
      duration_ms: type === 'switch' ? 1000 : undefined,
    };
    setInstructions([...instructions, newInstr]);
  };

  const removeInstruction = (index: number) => {
    setInstructions(instructions.filter((_, i) => i !== index));
  };

  const moveInstruction = (index: number, direction: 'up' | 'down') => {
    const newInstrs = [...instructions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < newInstrs.length) {
      [newInstrs[index], newInstrs[targetIndex]] = [newInstrs[targetIndex], newInstrs[index]];
      setInstructions(newInstrs);
    }
  };

  const updateInstruction = (index: number, updated: Instruction) => {
    const newInstrs = [...instructions];
    newInstrs[index] = updated;
    setInstructions(newInstrs);
  };

  const handleSave = async () => {
    if (!ruleName.trim()) {
      toast.error('Nome da função é obrigatório');
      return;
    }

    if (instructions.length === 0) {
      toast.error('Adicione pelo menos uma instrução');
      return;
    }

    try {
      setLoading(true);
      const ruleJson = {
        script: {
          instructions,
          loop_interval_ms: loopInterval,
          max_iterations: maxIterations,
          chained_events: chainedEvents.length > 0 ? chainedEvents : undefined,
          // ✅ Funcionalidades de Nova Regra
          cooldown,
          max_executions_per_hour: maxExecutionsPerHour,
        },
      };

      const ruleData = {
        device_id: deviceId,
        rule_id: scriptId || `RULE_${Date.now()}`,
        rule_name: ruleName,
        rule_description: ruleDescription,
        rule_json: ruleJson,
        enabled,
        priority,
        created_by: userProfile?.email || 'system',
      };

      // ✅ Console log para verificar empaquetado
      console.log('📦 [DECISION RULE] Empaquetando regra para Supabase:', {
        device_id: ruleData.device_id,
        rule_id: ruleData.rule_id,
        rule_name: ruleData.rule_name,
        enabled: ruleData.enabled,
        priority: ruleData.priority,
        created_by: ruleData.created_by,
        rule_json: JSON.stringify(ruleJson, null, 2),
      });

      if (scriptId) {
        const { error } = await supabase
          .from('decision_rules')
          .update(ruleData)
          .eq('id', scriptId)
          .eq('created_by', userProfile?.email || '');

        if (error) throw error;
        
        // ✅ Console log para verificar atualização
        console.log('✅ [DECISION RULE] Regra atualizada no Supabase:', {
          id: scriptId,
          rule_id: ruleData.rule_id,
          rule_name: ruleData.rule_name
        });
        
        toast.success('Função atualizada com sucesso');
      } else {
        const { data: insertedData, error } = await supabase
          .from('decision_rules')
          .insert(ruleData)
          .select()
          .single();

        if (error) throw error;
        
        // ✅ Console log para verificar criação
        console.log('✅ [DECISION RULE] Regra criada no Supabase:', {
          id: insertedData.id,
          rule_id: insertedData.rule_id,
          rule_name: insertedData.rule_name,
          created_at: insertedData.created_at,
          created_by: insertedData.created_by
        });
        
        toast.success('Função criada com sucesso');
      }

      onClose();
    } catch (error: any) {
      console.error('Erro ao salvar script:', error);
      toast.error(error.message || 'Erro ao salvar função');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[600px] bg-dark-card border-l border-dark-border shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-dark-border">
        <h2 className="text-xl font-semibold text-white">
          {scriptId ? '✏️ Editar Função' : '➕ Nova Função'}
        </h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-dark-surface rounded-lg transition-colors"
        >
          <XMarkIcon className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Fluxo Procedural - Descrição */}
        <div className="bg-aqua-500/10 border border-aqua-500/30 rounded-lg p-3 mb-4">
          <p className="text-xs text-aqua-300 font-medium mb-1">📋 Fluxo Procedural (de cima para baixo):</p>
          <p className="text-xs text-gray-400 leading-relaxed">
            <span className="text-aqua-400 font-semibold">1. Condições</span> → 
            <span className="text-purple-400 font-semibold"> 2. Ações</span> → 
            <span className="text-yellow-400 font-semibold"> 3. Eventos Encadeados</span> → 
            <span className="text-gray-300 font-semibold"> 4. Config Avançada</span>
          </p>
        </div>

        {/* Nome */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Nome da Função
          </label>
          <input
            type="text"
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            placeholder="Ex: Dreno Automático"
            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-aqua-500"
          />
        </div>

        {/* Descrição */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Descrição</label>
          <textarea
            value={ruleDescription}
            onChange={(e) => setRuleDescription(e.target.value)}
            placeholder="Descrição opcional"
            rows={2}
            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-aqua-500 resize-none"
          />
        </div>

        {/* Configurações Avançadas - Colapsável */}
        <div className="border border-dark-border rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setExpandedAdvanced(!expandedAdvanced)}
            className="w-full p-4 flex items-center justify-between hover:bg-dark-surface/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              {expandedAdvanced ? (
                <ChevronUpIcon className="w-5 h-5 text-aqua-400" />
              ) : (
                <ChevronDownIcon className="w-5 h-5 text-gray-400" />
              )}
              <Cog6ToothIcon className="w-5 h-5 text-aqua-400" />
              <span className="text-sm font-medium text-white">Configurações Avançadas</span>
            </div>
          </button>

          {expandedAdvanced && (
            <div className="p-4 border-t border-dark-border space-y-4 bg-dark-surface/30">
              {/* Prioridade */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Prioridade (0-100)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={priority}
                  onChange={(e) => setPriority(parseInt(e.target.value))}
                  className="w-full h-2 bg-dark-border rounded-lg appearance-none cursor-pointer accent-aqua-500"
                />
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-gray-400">0</span>
                  <span className="text-sm font-semibold text-aqua-400">{priority}</span>
                  <span className="text-xs text-gray-400">100</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Valor + mais importante. Default 50.
                </p>
              </div>

              {/* Regra Ativa */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="w-5 h-5 rounded border-dark-border bg-dark-surface text-aqua-500 focus:ring-2 focus:ring-aqua-500 cursor-pointer"
                />
                <label htmlFor="enabled" className="text-sm font-medium text-white cursor-pointer">
                  Regra Ativa
                </label>
              </div>

              {/* Cooldown */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Cooldown (segundos)
                </label>
                <input
                  type="number"
                  min="0"
                  value={cooldown}
                  onChange={(e) => setCooldown(parseInt(e.target.value) || 60)}
                  className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-aqua-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Tempo mínimo entre execuções da mesma regra.
                </p>
              </div>

              {/* Limite por Hora */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Limite por Hora
                </label>
                <input
                  type="number"
                  min="1"
                  value={maxExecutionsPerHour}
                  onChange={(e) => setMaxExecutionsPerHour(parseInt(e.target.value) || 10)}
                  className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-aqua-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Número máximo de execuções por hora.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Instruções */}
        <div className="border-t border-dark-border pt-4">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            📝 INSTRUÇÕES (Ordem de Execução)
          </label>

          <div className="space-y-3">
            {instructions.map((instr, index) => (
              <div
                key={index}
                className="border border-dark-border rounded-lg p-3 bg-dark-surface/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm font-semibold text-aqua-400">
                    {index + 1}. {instr.type === 'while' ? 'LOOP' : instr.type === 'if' ? 'Se' : instr.type === 'relay_action' ? 'Relé' : instr.type === 'switch' ? 'Switch' : instr.type.toUpperCase()}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => moveInstruction(index, 'up')}
                      disabled={index === 0}
                      className="p-1 hover:bg-dark-surface rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Mover para cima"
                    >
                      <ArrowUpIcon className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={() => moveInstruction(index, 'down')}
                      disabled={index === instructions.length - 1}
                      className="p-1 hover:bg-dark-surface rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Mover para baixo"
                    >
                      <ArrowDownIcon className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={() => removeInstruction(index)}
                      className="p-1 hover:bg-dark-surface rounded"
                      title="Remover"
                    >
                      <TrashIcon className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>

                {/* Renderizar editor específico */}
                {instr.type === 'while' && (
                  <WhileInstructionEditor
                    instruction={instr}
                    onChange={(updated) => updateInstruction(index, updated)}
                    espnowSlaves={espnowSlaves}
                  />
                )}

                {instr.type === 'if' && (
                  <IfInstructionEditor
                    instruction={instr}
                    onChange={(updated) => updateInstruction(index, updated)}
                    espnowSlaves={espnowSlaves}
                  />
                )}

                {instr.type === 'relay_action' && (
                  <RelayActionEditor
                    instruction={instr}
                    onChange={(updated) => updateInstruction(index, updated)}
                    espnowSlaves={espnowSlaves}
                  />
                )}

                {instr.type === 'switch' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-2">Switch (Trocar Estado)</label>
                      
                      {/* Seleção de Modo: Ciclo ou Timer */}
                      <div className="mb-3">
                        <label className="block text-xs text-gray-400 mb-1">Modo</label>
                        <select
                          value={instr.switch_mode || 'timer'}
                          onChange={(e) => {
                            const updated = { ...instr, switch_mode: e.target.value as 'cycle' | 'timer' };
                            if (e.target.value === 'cycle') {
                              updated.cycle_on_ms = updated.cycle_on_ms || 5000;
                              updated.cycle_off_ms = updated.cycle_off_ms || 5000;
                              updated.cycle_count = updated.cycle_count || 1;
                            } else {
                              updated.duration_ms = updated.duration_ms || 1000;
                            }
                            updateInstruction(index, updated);
                          }}
                          className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-aqua-500"
                        >
                          <option value="timer">Timer (Duração fixa)</option>
                          <option value="cycle">Ciclo (Toggle automático ON/OFF)</option>
                        </select>
                      </div>

                      {/* Configuração de Timer */}
                      {instr.switch_mode === 'timer' && (
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Duração (ms)</label>
                          <input
                            type="number"
                            min="0"
                            value={instr.duration_ms || 1000}
                            onChange={(e) => {
                              updateInstruction(index, {
                                ...instr,
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
                      {instr.switch_mode === 'cycle' && (
                        <div className="space-y-2">
                          <div className="grid grid-cols-3 gap-2 items-end">
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">ON ⏰</label>
                              <input
                                type="text"
                                value={instr.cycle_on_time || msToTime(instr.cycle_on_ms || 5000)}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  // Permitir edición libre, pero convertir cuando tenga formato válido
                                  if (/^\d{2}:\d{2}:\d{2}$/.test(value)) {
                                    const ms = timeToMs(value);
                                    updateInstruction(index, {
                                      ...instr,
                                      cycle_on_ms: ms,
                                      cycle_on_time: value,
                                    });
                                  } else {
                                    // Guardar el valor temporal mientras el usuario escribe
                                    updateInstruction(index, {
                                      ...instr,
                                      cycle_on_time: value,
                                    });
                                  }
                                }}
                                onBlur={(e) => {
                                  // Al perder el foco, si no es válido, restaurar el valor por defecto
                                  const value = e.target.value;
                                  if (!/^\d{2}:\d{2}:\d{2}$/.test(value)) {
                                    const defaultTime = msToTime(instr.cycle_on_ms || 5000);
                                    updateInstruction(index, {
                                      ...instr,
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
                                value={instr.cycle_off_time || msToTime(instr.cycle_off_ms || 5000)}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  // Permitir edición libre, pero convertir cuando tenga formato válido
                                  if (/^\d{2}:\d{2}:\d{2}$/.test(value)) {
                                    const ms = timeToMs(value);
                                    updateInstruction(index, {
                                      ...instr,
                                      cycle_off_ms: ms,
                                      cycle_off_time: value,
                                    });
                                  } else {
                                    // Guardar el valor temporal mientras el usuario escribe
                                    updateInstruction(index, {
                                      ...instr,
                                      cycle_off_time: value,
                                    });
                                  }
                                }}
                                onBlur={(e) => {
                                  // Al perder el foco, si no es válido, restaurar el valor por defecto
                                  const value = e.target.value;
                                  if (!/^\d{2}:\d{2}:\d{2}$/.test(value)) {
                                    const defaultTime = msToTime(instr.cycle_off_ms || 5000);
                                    updateInstruction(index, {
                                      ...instr,
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
                              value={instr.cycle_count ?? 0}
                              onChange={(e) => {
                                updateInstruction(index, {
                                  ...instr,
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

                {instr.type === 'return' && (
                  <div className="text-sm text-gray-400 italic">Retorna do loop</div>
                )}
              </div>
            ))}
          </div>

          {/* Botões para adicionar instruções */}
          <div className="mt-4 p-3 border border-dark-border rounded-lg bg-aqua-500/10">
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => addInstruction('while')}
                className="px-3 py-2 bg-dark-surface hover:bg-dark-border border border-dark-border rounded-lg text-sm text-white transition-colors flex items-center gap-2"
              >
                <PlusIcon className="w-4 h-4" />
                LOOP
              </button>
              <button
                onClick={() => addInstruction('if')}
                className="px-3 py-2 bg-dark-surface hover:bg-dark-border border border-dark-border rounded-lg text-sm text-white transition-colors flex items-center gap-2"
              >
                <PlusIcon className="w-4 h-4" />
                Se
              </button>
              <button
                onClick={() => addInstruction('relay_action')}
                className="px-3 py-2 bg-dark-surface hover:bg-dark-border border border-dark-border rounded-lg text-sm text-white transition-colors flex items-center gap-2"
              >
                <PlusIcon className="w-4 h-4" />
                Relé
              </button>
                <button
                  onClick={() => addInstruction('switch')}
                  className="px-3 py-2 bg-dark-surface hover:bg-dark-border border border-dark-border rounded-lg text-sm text-white transition-colors flex items-center gap-2"
                >
                  <PlusIcon className="w-4 h-4" />
                  SWITCH
                </button>
            </div>
          </div>
        </div>

        {/* Eventos Encadeados - Colapsável */}
        <div className="border-t border-dark-border pt-4">
          <div className="border border-dark-border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedChainedEvents(!expandedChainedEvents)}
              className="w-full p-4 flex items-center justify-between hover:bg-dark-surface/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {expandedChainedEvents ? (
                  <ChevronUpIcon className="w-5 h-5 text-aqua-400" />
                ) : (
                  <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                )}
                <PaperClipIcon className="w-5 h-5 text-purple-400" />
                <span className="text-sm font-medium text-white">Eventos Encadeados</span>
              </div>
            </button>

            {expandedChainedEvents && (
              <div className="p-4 border-t border-dark-border space-y-4 bg-dark-surface/30">
                <p className="text-xs text-gray-400 mb-3">
                  Quando esta regra executar, disparar outras regras:
                </p>

                <div className="space-y-3">
                  {chainedEvents.map((event, idx) => (
                    <div
                      key={idx}
                      className="border border-dark-border rounded-lg p-3 bg-dark-surface/50"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs text-purple-400 font-mono">
                          Evento {idx + 1}
                        </span>
                        <button
                          onClick={() =>
                            setChainedEvents(chainedEvents.filter((_, i) => i !== idx))
                          }
                          className="p-1 hover:bg-dark-surface rounded"
                        >
                          <TrashIcon className="w-3 h-3 text-red-400" />
                        </button>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">
                            Regra Alvo (rule_id)
                          </label>
                          {availableRules.length > 0 ? (
                            <select
                              value={event.target_rule_id}
                              onChange={(e) => {
                                const updated = [...chainedEvents];
                                updated[idx].target_rule_id = e.target.value;
                                setChainedEvents(updated);
                              }}
                              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-aqua-500"
                            >
                              <option value="">Selecione uma regra...</option>
                              {availableRules
                                .filter(rule => rule.rule_id !== currentRuleId) // ✅ Excluir a própria regra
                                .map((rule) => (
                                  <option key={rule.rule_id} value={rule.rule_id}>
                                    {rule.rule_name} ({rule.rule_id})
                                  </option>
                                ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={event.target_rule_id}
                              onChange={(e) => {
                                const updated = [...chainedEvents];
                                updated[idx].target_rule_id = e.target.value;
                                setChainedEvents(updated);
                              }}
                              placeholder="Ex: RULE_001"
                              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-500"
                            />
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            ✅ Use o rule_id de outra regra para encadear eventos
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs text-gray-400 mb-1">
                            Disparar Quando
                          </label>
                          <select
                            value={event.trigger_on}
                            onChange={(e) => {
                              const updated = [...chainedEvents];
                              updated[idx].trigger_on = e.target.value as 'success' | 'failure';
                              setChainedEvents(updated);
                            }}
                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-aqua-500"
                          >
                            <option value="success">Ao Ter Sucesso</option>
                            <option value="failure">Ao Ter Falha</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs text-gray-400 mb-1">
                            Delay (ms)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={event.delay_ms}
                            onChange={(e) => {
                              const updated = [...chainedEvents];
                              updated[idx].delay_ms = parseInt(e.target.value) || 0;
                              setChainedEvents(updated);
                            }}
                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-aqua-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() =>
                    setChainedEvents([
                      ...chainedEvents,
                      { target_rule_id: '', trigger_on: 'success', delay_ms: 0 },
                    ])
                  }
                  className="w-full px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg text-sm text-purple-400 transition-colors flex items-center justify-center gap-2"
                >
                  <PlusIcon className="w-4 h-4" />
                  Adicionar Evento
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Configurações do Loop */}
        <div className="border-t border-dark-border pt-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Configurações do Loop
          </label>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-400">Intervalo entre execuções (ms)</label>
              <input
                type="number"
                value={loopInterval}
                onChange={(e) => setLoopInterval(parseInt(e.target.value) || 5000)}
                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-aqua-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Máximo de iterações: <span className="text-aqua-400">0 = Perpétuo</span></label>
              <input
                type="number"
                min="0"
                value={maxIterations}
                onChange={(e) => setMaxIterations(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-aqua-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-dark-border flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 bg-dark-surface hover:bg-dark-border border border-dark-border rounded-lg text-white transition-colors"
        >
          ❌ Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex-1 px-4 py-2 bg-aqua-600 hover:bg-aqua-700 rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? 'Salvando...' : '💾 Salvar Função'}
        </button>
      </div>
    </div>
  );
}
