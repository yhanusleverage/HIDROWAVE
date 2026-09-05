'use client';

import React, { useState, useEffect } from 'react';
import { XMarkIcon, ArrowUpIcon, ArrowDownIcon, PlusIcon, ChevronDownIcon, ChevronUpIcon, Cog6ToothIcon, PaperClipIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { formatInstructionType } from '@/lib/instruction-labels';
import { InstructionAddButtons } from './instruction-editors/InstructionAddButtons';
import { BlockAutoProcedureToggle } from './instruction-editors/BlockAutoProcedureToggle';
import WhileInstructionEditor from './instruction-editors/WhileInstructionEditor';
import IfInstructionEditor from './instruction-editors/IfInstructionEditor';
import RelayActionEditor from './instruction-editors/RelayActionEditor';
import { getESPNOWSlaves, ESPNowSlave } from '@/lib/esp-now-slaves';
import { useAuth } from '@/contexts/AuthContext';
import TargetRuleIdField from '@/components/TargetRuleIdField';
import { DEFAULT_MASTER_RELAYS } from '@/lib/master-relay-options';
import { createNestedInstruction, ensureInstructionIds, defaultProcedureInstructions } from '@/lib/instruction-factory';
import { resolveDecisionRuleDisplayName } from '@/lib/decision-rule-display-name';
import { useLanguage } from '@/contexts/LanguageContext';

export interface Instruction {
  id?: string;
  type:
    | 'while'
    | 'if'
    | 'relay_action'
    | 'switch'
    | 'return'
    | 'break'
    | 'continue'
    | 'delay'
    | 'block_auto'
    | 'unblock_auto';
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
  const { t } = useLanguage();
  const ac = t.automacao.common;
  const rm = t.automacao.ruleModal;
  const instrT = t.automacao.instr;
  const se = t.automacao.scriptEditor;
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
  const [loadingAvailableRules, setLoadingAvailableRules] = useState(false);
  const [currentRuleId, setCurrentRuleId] = useState<string | null>(null);
  const masterRelays = DEFAULT_MASTER_RELAYS;

  // ✅ Carregar regras disponíveis para eventos encadeados
  useEffect(() => {
    const loadAvailableRules = async () => {
      if (!deviceId || !userProfile?.email) return;

      setLoadingAvailableRules(true);
      try {
        const { data, error } = await supabase
          .from('decision_rules')
          .select('rule_id, rule_name, rule_json')
          .eq('device_id', deviceId)
          .order('rule_name', { ascending: true });

        if (error) throw error;
        setAvailableRules(
          (data || []).map((row) => ({
            rule_id: String(row.rule_id),
            rule_name: resolveDecisionRuleDisplayName(
              {
                rule_id: row.rule_id,
                rule_name: row.rule_name,
                rule_json: row.rule_json,
              },
              t
            ),
          }))
        );
      } catch (error) {
        console.error('Erro ao carregar regras disponíveis:', error);
        setAvailableRules([]);
      } finally {
        setLoadingAvailableRules(false);
      }
    };

    loadAvailableRules();
  }, [deviceId, userProfile?.email, t]);

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
    } else {
      setRuleName('');
      setRuleDescription('');
      setPriority(85);
      setEnabled(true);
      setInstructions(defaultProcedureInstructions());
      setLoopInterval(5000);
      setMaxIterations(0);
      setChainedEvents([]);
      setCooldown(60);
      setMaxExecutionsPerHour(10);
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
          setInstructions(ensureInstructionIds(data.rule_json.script.instructions || []));
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
    } catch (error) {
      console.error('Erro ao carregar script:', error);
      toast.error(se.toast.loadError);
    } finally {
      setLoading(false);
    }
  };

  const addInstruction = (type: Instruction['type']) => {
    const newInstr = createNestedInstruction(type);
    if (type === 'relay_action') {
      newInstr.relay_number = 5;
    }
    setInstructions((prev) => {
      if (type === 'block_auto') {
        const without = prev.filter((i) => i.type !== 'block_auto');
        return [newInstr, ...without];
      }
      return [...prev, newInstr];
    });
  };

  const removeInstruction = (index: number) => {
    setInstructions((prev) => prev.filter((_, i) => i !== index));
  };

  const moveInstruction = (index: number, direction: 'up' | 'down') => {
    setInstructions((prev) => {
      const newInstrs = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex >= 0 && targetIndex < newInstrs.length) {
        [newInstrs[index], newInstrs[targetIndex]] = [newInstrs[targetIndex], newInstrs[index]];
      }
      return newInstrs;
    });
  };

  const updateInstruction = (index: number, updated: Instruction) => {
    setInstructions((prev) => {
      const newInstrs = [...prev];
      newInstrs[index] = updated;
      return newInstrs;
    });
  };

  const handleSave = async () => {
    if (!ruleName.trim()) {
      toast.error(se.error.nameRequired);
      return;
    }

    if (instructions.length === 0) {
      toast.error(se.error.needInstruction);
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
        
        toast.success(se.toast.savedUpdate);
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
        
        toast.success(se.toast.savedCreate);
      }

      onClose();
    } catch (error) {
      console.error('Erro ao salvar script:', error);
      toast.error(error instanceof Error ? error.message : se.toast.saveError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[600px] bg-dark-card border-l border-dark-border shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-dark-border">
        <h2 className="text-xl font-semibold text-white">
          {scriptId ? se.title.edit : se.title.create}
        </h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-dark-surface rounded-lg transition-colors"
        >
          <XMarkIcon className="w-5 h-5 text-dark-textSecondary" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Fluxo Procedural - Descrição */}
        <div className="bg-aqua-500/10 border border-aqua-500/30 rounded-lg p-3 mb-4">
          <p className="text-xs text-aqua-300 font-medium mb-1">{rm.flow.title}</p>
          <p className="text-xs text-dark-textSecondary leading-relaxed">
            <span className="text-aqua-400 font-semibold">{rm.flow.step1}</span> → 
            <span className="text-purple-400 font-semibold"> {rm.flow.step2}</span> → 
            <span className="text-yellow-400 font-semibold"> {rm.flow.step3}</span> → 
            <span className="text-dark-textSecondary font-semibold"> {rm.flow.step4}</span>
          </p>
        </div>

        {/* Nome */}
        <div>
          <label className="block text-sm font-medium text-dark-textSecondary mb-1">
            {se.label.functionName}
          </label>
          <input
            type="text"
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            placeholder={rm.placeholder.functionName}
            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-aqua-500"
          />
        </div>

        {/* Descrição */}
        <div>
          <label className="block text-sm font-medium text-dark-textSecondary mb-1">{ac.description}</label>
          <textarea
            value={ruleDescription}
            onChange={(e) => setRuleDescription(e.target.value)}
            placeholder={ac.placeholderDescription}
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
                <ChevronDownIcon className="w-5 h-5 text-dark-textSecondary" />
              )}
              <Cog6ToothIcon className="w-5 h-5 text-aqua-400" />
              <span className="text-sm font-medium text-white">{rm.section.advanced}</span>
            </div>
          </button>

          {expandedAdvanced && (
            <div className="p-4 border-t border-dark-border space-y-4 bg-dark-surface/30">
              {/* Prioridade */}
              <div>
                <label className="block text-sm font-medium text-dark-textSecondary mb-2">
                  {rm.label.priority}
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
                  <span className="text-xs text-dark-textSecondary">0</span>
                  <span className="text-sm font-semibold text-aqua-400">{priority}</span>
                  <span className="text-xs text-dark-textSecondary">100</span>
                </div>
                <p className="text-xs text-dark-textSecondary/80 mt-1">
                  {rm.hint.priority}
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
                  {rm.label.enabled}
                </label>
              </div>

              {/* Cooldown */}
              <div>
                <label className="block text-sm font-medium text-dark-textSecondary mb-2">
                  {rm.label.cooldown}
                </label>
                <input
                  type="number"
                  min="0"
                  value={cooldown}
                  onChange={(e) => setCooldown(parseInt(e.target.value) || 60)}
                  className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-aqua-500"
                />
                <p className="text-xs text-dark-textSecondary/80 mt-1">
                  {rm.hint.cooldown}
                </p>
              </div>

              {/* Limite por Hora */}
              <div>
                <label className="block text-sm font-medium text-dark-textSecondary mb-2">
                  {rm.label.maxPerHour}
                </label>
                <input
                  type="number"
                  min="1"
                  value={maxExecutionsPerHour}
                  onChange={(e) => setMaxExecutionsPerHour(parseInt(e.target.value) || 10)}
                  className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-aqua-500"
                />
                <p className="text-xs text-dark-textSecondary/80 mt-1">
                  {rm.hint.maxPerHour}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Instruções */}
        <div className="border-t border-dark-border pt-4">
          <label className="block text-sm font-medium text-dark-textSecondary mb-3">
            {se.section.instructions}
          </label>

          <BlockAutoProcedureToggle
            instructions={instructions}
            onChange={setInstructions}
            className="mb-3"
          />

          <div className="space-y-3">
            {instructions.map((instr, index) => (
              <div
                key={instr.id ?? index}
                className={`border rounded-lg p-3 ${
                  instr.type === 'block_auto'
                    ? 'border-amber-500/30 bg-amber-500/5'
                    : 'border-dark-border bg-dark-surface/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm font-semibold text-aqua-400">
                      {index + 1}. {formatInstructionType(instr.type, instrT)}
                    </span>
                  <div className="flex gap-1">
                    {instr.type !== 'block_auto' && (
                      <>
                    <button
                      onClick={() => moveInstruction(index, 'up')}
                      disabled={index === 0 || instructions[index - 1]?.type === 'block_auto'}
                      className="p-1 hover:bg-dark-surface rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      title={ac.moveUp}
                    >
                      <ArrowUpIcon className="w-4 h-4 text-dark-textSecondary" />
                    </button>
                    <button
                      onClick={() => moveInstruction(index, 'down')}
                      disabled={index === instructions.length - 1}
                      className="p-1 hover:bg-dark-surface rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      title={ac.moveDown}
                    >
                      <ArrowDownIcon className="w-4 h-4 text-dark-textSecondary" />
                    </button>
                      </>
                    )}
                    <button
                      onClick={() => removeInstruction(index)}
                      className="p-1 hover:bg-dark-surface rounded"
                      title={ac.remove}
                    >
                      <XMarkIcon className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>

                {/* Renderizar editor específico */}
                {instr.type === 'while' && (
                  <WhileInstructionEditor
                    instruction={instr}
                    onChange={(updated) => updateInstruction(index, updated)}
                    espnowSlaves={espnowSlaves}
                    masterRelays={masterRelays}
                  />
                )}

                {instr.type === 'if' && (
                  <IfInstructionEditor
                    instruction={instr}
                    onChange={(updated) => updateInstruction(index, updated)}
                    espnowSlaves={espnowSlaves}
                    masterRelays={masterRelays}
                  />
                )}

                {instr.type === 'relay_action' && (
                  <RelayActionEditor
                    instruction={instr}
                    onChange={(updated) => updateInstruction(index, updated)}
                    espnowSlaves={espnowSlaves}
                    masterRelays={masterRelays}
                    onDelete={() => removeInstruction(index)}
                  />
                )}

                {instr.type === 'switch' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-dark-textSecondary mb-2">{instrT.switchLabel}</label>
                      
                      {/* Seleção de Modo: Ciclo ou Timer */}
                      <div className="mb-3">
                        <label className="block text-xs text-dark-textSecondary mb-1">{instrT.switchMode}</label>
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
                          <option value="timer">{instrT.modeTimer}</option>
                          <option value="cycle">{instrT.modeCycle}</option>
                        </select>
                      </div>

                      {/* Configuração de Timer */}
                      {instr.switch_mode === 'timer' && (
                        <div>
                          <label className="block text-xs text-dark-textSecondary mb-1">{instrT.durationMs}</label>
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
                          <p className="text-xs text-dark-textSecondary/80 mt-1">{instrT.switchDurationHint}</p>
                        </div>
                      )}

                      {/* Configuração de Ciclo - Compacto */}
                      {instr.switch_mode === 'cycle' && (
                        <div className="space-y-2">
                          <div className="grid grid-cols-3 gap-2 items-end">
                            <div>
                              <label className="block text-xs text-dark-textSecondary mb-1">{instrT.cycleOn}</label>
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
                              <label className="block text-xs text-dark-textSecondary mb-1">{instrT.cycleOff}</label>
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
                            <label className="block text-xs text-dark-textSecondary mb-1">{instrT.cyclesLabel} <span className="text-aqua-400">{instrT.cyclesPerpetual}</span></label>
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
                  <div className="text-sm text-dark-textSecondary italic">{instrT.returnFromLoop}</div>
                )}
                {instr.type === 'block_auto' && (
                  <div className="text-sm text-amber-200/90 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                    {instrT.blockAutoHelp}
                  </div>
                )}
                {instr.type === 'unblock_auto' && (
                  <div className="text-sm text-green-300/90 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">
                    {instrT.unblockAutoHelp}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Botões para adicionar instruções */}
          <div className="mt-4 p-3 border border-dark-border rounded-lg bg-aqua-500/10">
            <InstructionAddButtons onAdd={addInstruction} />
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
                  <ChevronDownIcon className="w-5 h-5 text-dark-textSecondary" />
                )}
                <PaperClipIcon className="w-5 h-5 text-purple-400" />
                <span className="text-sm font-medium text-white">{rm.section.chainedEvents}</span>
              </div>
            </button>

            {expandedChainedEvents && (
              <div className="p-4 border-t border-dark-border space-y-4 bg-dark-surface/30">
                <p className="text-xs text-dark-textSecondary mb-3">
                  {rm.hint.chainedEvents}
                </p>

                <div className="space-y-3">
                  {chainedEvents.map((event, idx) => (
                    <div
                      key={idx}
                      className="border border-dark-border rounded-lg p-3 bg-dark-surface/50"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs text-purple-400 font-mono">
                          {rm.label.eventN.replace('{n}', String(idx + 1))}
                        </span>
                        <button
                          onClick={() =>
                            setChainedEvents(chainedEvents.filter((_, i) => i !== idx))
                          }
                          className="p-1 hover:bg-dark-surface rounded"
                        >
                          <XMarkIcon className="w-3 h-3 text-red-400" />
                        </button>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <label className="block text-xs text-dark-textSecondary mb-1">
                            {rm.label.targetRuleId}
                          </label>
                          <TargetRuleIdField
                            value={event.target_rule_id}
                            onChange={(nextValue) => {
                              const updated = [...chainedEvents];
                              updated[idx].target_rule_id = nextValue;
                              setChainedEvents(updated);
                            }}
                            availableRules={availableRules}
                            excludeRuleId={currentRuleId}
                            loading={loadingAvailableRules}
                            fieldId={`chained-event-${idx}`}
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-dark-textSecondary mb-1">
                            {rm.label.triggerWhen}
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
                            <option value="success">{rm.trigger.success}</option>
                            <option value="failure">{rm.trigger.failure}</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs text-dark-textSecondary mb-1">
                            {rm.label.delayMs}
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
                  {rm.action.addEvent}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Configurações do Loop */}
        <div className="border-t border-dark-border pt-4">
          <label className="block text-sm font-medium text-dark-textSecondary mb-2">
            {rm.section.loopConfig}
          </label>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-dark-textSecondary">{rm.label.loopInterval}</label>
              <input
                type="number"
                value={loopInterval}
                onChange={(e) => setLoopInterval(parseInt(e.target.value) || 5000)}
                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-aqua-500"
              />
            </div>
            <div>
              <label className="text-xs text-dark-textSecondary">{rm.label.maxIterations} <span className="text-aqua-400">{instrT.cyclesPerpetual}</span></label>
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
          {ac.cancel}
        </button>
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex-1 px-4 py-2 bg-aqua-600 hover:bg-aqua-700 rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? se.action.saving : se.action.save}
        </button>
      </div>
    </div>
  );
}
