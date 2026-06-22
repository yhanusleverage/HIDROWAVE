'use client';

import React, { useState, useEffect } from 'react';
import { XMarkIcon, ChevronDownIcon, ChevronUpIcon, ArrowUpIcon, ArrowDownIcon, PlusIcon, Cog6ToothIcon, PaperClipIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { hwToast } from '@/lib/control-toast';
import {
  formatInstructionType,
  SWITCH_LABEL,
  SWITCH_MODE_CYCLE,
  SWITCH_MODE_TIMER,
} from '@/lib/instruction-labels';
import WhileInstructionEditor from './instruction-editors/WhileInstructionEditor';
import IfInstructionEditor from './instruction-editors/IfInstructionEditor';
import RelayActionEditor from './instruction-editors/RelayActionEditor';
import { Instruction } from './SequentialScriptEditor';
import { getESPNOWSlaves, ESPNowSlave } from '@/lib/esp-now-slaves';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import TargetRuleIdField from '@/components/TargetRuleIdField';
import { HwModal } from '@/components/ui/HwModal';
import { HwButton } from '@/components/ui/HwButton';
interface Relay {
  id: number;
  name: string;
  device?: 'master' | 'slave';
  slaveMac?: string;
}

interface Condition {
  sensor: string;
  operator: string;
  value: number | string;
  logic?: 'AND' | 'OR';
}

interface Action {
  relayId: number;
  relayName: string;
  action: 'on' | 'off';
}

interface ChainedEvent {
  targetRuleId: string;
  triggerType: 'on_execute' | 'on_success' | 'on_failure';
  delay?: number;
}

interface ChainedEventSequential {
  target_rule_id: string;
  trigger_on: 'success' | 'failure';
  delay_ms: number;
}

interface RuleCondition {
  sensor: string;
  operator: string;
  value: number; // ✅ Solo number para compatibilidad con NewRuleData
  logic?: 'AND' | 'OR';
}

interface RuleData {
  name: string;
  description?: string;
  conditions?: RuleCondition[]; // ✅ Usar RuleCondition en lugar de Condition
  actions?: Action[];
  enabled?: boolean;
  priority?: number;
  script?: {
    instructions: Instruction[];
    max_iterations?: number;
    chained_events?: ChainedEventSequential[];
    cooldown?: number;
    max_executions_per_hour?: number;
  };
  chainedEvents?: ChainedEvent[] | ChainedEventSequential[];
  [key: string]: unknown;
}

interface AutomationRule {
  id: number | string;
  name: string;
  description: string;
  condition: string;
  action: string;
  enabled: boolean;
  conditions?: Array<{
    sensor: string;
    operator: string;
    value: number | string;
    logic?: 'AND' | 'OR';
  }>;
  actions?: Array<{
    relayId?: number;
    relayName?: string;
    relay_ids?: number[];
    relay_names?: string[];
    action?: 'on' | 'off';
    duration?: number;
    [key: string]: unknown;
  }>;
  rule_json?: {
    conditions?: Array<{
      sensor: string;
      operator: string;
      value: number;
      logic?: 'AND' | 'OR';
    }>;
    actions?: Array<{
      relay_ids?: number[];
      relay_names?: string[];
      duration?: number;
      [key: string]: unknown;
    }>;
    script?: {
      instructions: Array<{
        type: string;
        [key: string]: unknown;
      }>;
      max_iterations?: number;
      chained_events?: unknown;
      cooldown?: number;
      max_executions_per_hour?: number;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface CreateRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rule: RuleData) => void;
  relays: Relay[];
  onUpdateRelay: (id: number, name: string) => void;
  deviceId?: string;
  editingRule: AutomationRule | null; // ✅ Regra existente para edição (puede ser null)
}

export default function CreateRuleModal({
  isOpen,
  onClose,
  onSave,
  relays,
  onUpdateRelay,
  deviceId = '',
  editingRule,
}: CreateRuleModalProps) {
  const { userProfile } = useAuth();
  const [ruleName, setRuleName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<number>(50);
  const [enabled, setEnabled] = useState(true);
  
  // ✅ Menus colapsáveis
  const [expandedConditions, setExpandedConditions] = useState(true);
  const [expandedActions, setExpandedActions] = useState(true);
  const [expandedChainedEvents, setExpandedChainedEvents] = useState(false);
  const [expandedAdvanced, setExpandedAdvanced] = useState(false);
  
  const [conditions, setConditions] = useState<Condition[]>([
    { sensor: 'temperature', operator: '>', value: 25.0, logic: 'AND' },
  ]);

  // Cuando se cambia el sensor a un nivel, ajustar el valor
  const handleSensorChange = (index: number, sensorValue: string) => {
    const updated = [...conditions];
    if (sensorValue.startsWith('level_') || sensorValue === 'water_level') {
      updated[index] = { ...updated[index], sensor: sensorValue, operator: '==', value: 'medio' };
    } else {
      updated[index] = { ...updated[index], sensor: sensorValue, value: 0 };
    }
    setConditions(updated);
  };
  const [actions, setActions] = useState<Action[]>([]);
  const [chainedEvents, setChainedEvents] = useState<ChainedEvent[]>([]);
  const [cooldown, setCooldown] = useState(60);
  const [maxExecutionsPerHour, setMaxExecutionsPerHour] = useState(10);
  // ✅ Funcionalidades de Nova Função (Sequential Script) - COMPLETO
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [loopInterval, setLoopInterval] = useState(5000);
  const [maxIterations, setMaxIterations] = useState(0);
  const [espnowSlaves, setEspnowSlaves] = useState<ESPNowSlave[]>([]);
  const [chainedEventsSequential, setChainedEventsSequential] = useState<ChainedEventSequential[]>([]);
  const [expandedChainedEventsSequential, setExpandedChainedEventsSequential] = useState(false);
  const [availableRules, setAvailableRules] = useState<Array<{ rule_id: string; rule_name: string }>>([]);
  const [loadingAvailableRules, setLoadingAvailableRules] = useState(false);

  const sensors = [
    { value: 'level_1', label: 'Nível 1' },
    { value: 'level_2', label: 'Nível 2' },
    { value: 'level_3', label: 'Nível 3' },
    { value: 'level_4', label: 'Nível 4' },
    { value: 'water_level', label: 'Nível de Água' },
    { value: 'temperature', label: 'Temperatura da Água (°C)' },
    { value: 'humidity', label: 'Umidade (%)' },
    { value: 'ph', label: 'pH' },
    { value: 'ec', label: 'EC (µS/cm)' },
  ];

  const waterLevelOptions = [
    { value: 'vazio', label: 'Vazio' },
    { value: 'baixo', label: 'Baixo' },
    { value: 'medio', label: 'Médio' },
    { value: 'alto', label: 'Alto' },
  ];

  const operators = [
    { value: '<', label: 'Menor que (<)' },
    { value: '>', label: 'Maior que (>)' },
    { value: '<=', label: 'Menor ou igual (≤)' },
    { value: '>=', label: 'Maior ou igual (≥)' },
    { value: '==', label: 'Igual a (=)' },
    { value: '!=', label: 'Diferente de (≠)' },
  ];

  const addCondition = () => {
    setConditions([...conditions, { sensor: 'temperature', operator: '>', value: 0, logic: 'AND' }]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, field: keyof Condition, value: string | number) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], [field]: value };
    setConditions(updated);
  };

  const addAction = () => {
    // ✅ Verificar se há relay slaves disponíveis
    const relayOptions: Array<{ value: string; label: string; slaveMac: string; relayId: number }> = [];
    
    espnowSlaves.forEach((slave) => {
      slave.relays.forEach((relay) => {
        relayOptions.push({
          value: `slave_${slave.macAddress}_${relay.id}`,
          label: `${slave.name || slave.device_id || 'ESP-SLAVE'}: ${relay.id} - ${relay.name || `Relé ${relay.id}`}`,
          slaveMac: slave.macAddress,
          relayId: relay.id,
        });
      });
    });

    if (relayOptions.length === 0) {
      toast.error('Nenhum relé slave disponível. Carregue os slaves primeiro.');
      return;
    }

    const firstOption = relayOptions[0];
    setActions([
      ...actions,
      { relayId: firstOption.relayId, relayName: firstOption.label, action: 'on' },
    ]);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const updateAction = (index: number, field: keyof Action, value: string | number) => {
    const updated = [...actions];
    if (field === 'relayId') {
      const relayId = typeof value === 'number' ? value : parseInt(String(value), 10) || 0;
      const relay = relays.find(r => r.id === relayId);
      updated[index] = { ...updated[index], relayId, relayName: relay?.name || '' };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setActions(updated);
  };

  const addChainedEvent = () => {
    setChainedEvents([...chainedEvents, {
      targetRuleId: '',
      triggerType: 'on_success',
      delay: 0,
    }]);
  };

  const removeChainedEvent = (index: number) => {
    setChainedEvents(chainedEvents.filter((_, i) => i !== index));
  };

  const updateChainedEvent = (index: number, field: keyof ChainedEvent, value: string | number) => {
    const updated = [...chainedEvents];
    updated[index] = { ...updated[index], [field]: value };
    setChainedEvents(updated);
  };

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

  // ✅ Carregar dados da regra quando estiver editando
  useEffect(() => {
    if (editingRule && isOpen) {
      // Carregar dados básicos
      setRuleName(String(editingRule.rule_name || editingRule.name || ''));
      setDescription(String(editingRule.rule_description || editingRule.description || ''));
      setPriority(typeof editingRule.priority === 'number' ? editingRule.priority : 50);
      setEnabled(editingRule.enabled !== undefined ? editingRule.enabled : true);
      
      // Carregar rule_json se existir (Sequential Script)
      if (editingRule.rule_json) {
        const ruleJson = editingRule.rule_json;
        
        // Carregar instruções sequenciais
        if (ruleJson.script?.instructions && Array.isArray(ruleJson.script.instructions)) {
          setInstructions(ruleJson.script.instructions as Instruction[]);
        }
        
        // Carregar configurações de loop
        if (typeof ruleJson.script?.max_iterations === 'number') {
          setMaxIterations(ruleJson.script.max_iterations);
        }

        if (ruleJson.script?.chained_events && Array.isArray(ruleJson.script.chained_events)) {
          setChainedEventsSequential(ruleJson.script.chained_events as ChainedEventSequential[]);
        }
      }
      
      // Carregar condições e ações tradicionais (se não for Sequential Script)
      if (editingRule.conditions && Array.isArray(editingRule.conditions)) {
        setConditions(editingRule.conditions.map(c => ({
          sensor: String(c.sensor || ''),
          operator: String(c.operator || ''),
          value: typeof c.value === 'number' ? c.value : (typeof c.value === 'string' ? parseFloat(c.value) || 0 : 0),
          logic: c.logic,
        })));
      }
      if (editingRule.actions && Array.isArray(editingRule.actions)) {
        setActions(editingRule.actions.map(a => ({
          relayId: typeof a.relayId === 'number' ? a.relayId : (typeof a.relay_ids?.[0] === 'number' ? a.relay_ids[0] : 0),
          relayName: String(a.relayName || a.relay_names?.[0] || ''),
          action: (a.action || 'on') as 'on' | 'off',
        })));
      }
      
      // Carregar eventos encadeados tradicionais
      if (editingRule.chained_events && Array.isArray(editingRule.chained_events)) {
        setChainedEvents(editingRule.chained_events as ChainedEvent[]);
      }
      
      // Carregar configurações avançadas
      if (typeof editingRule.cooldown === 'number') {
        setCooldown(editingRule.cooldown);
      }
      if (typeof editingRule.max_executions_per_hour === 'number') {
        setMaxExecutionsPerHour(editingRule.max_executions_per_hour);
      }
    } else if (!editingRule && isOpen) {
      // Resetar campos quando não está editando (nova regra)
      setRuleName('');
      setDescription('');
      setPriority(50);
      setEnabled(true);
      setConditions([{ sensor: 'temperature', operator: '>', value: 25.0, logic: 'AND' }]);
      setActions([]);
      setChainedEvents([]);
      setInstructions([]);
      setLoopInterval(5000);
      setMaxIterations(0);
      setChainedEventsSequential([]);
      setCooldown(60);
      setMaxExecutionsPerHour(10);
    }
  }, [editingRule, isOpen]);

  // ✅ Funções para Instruções Sequenciais (de Nova Função)
  useEffect(() => {
    if (isOpen && deviceId && userProfile?.email) {
      loadSlaves();
    }
  }, [isOpen, deviceId, userProfile?.email]);

  useEffect(() => {
    const loadAvailableRules = async () => {
      if (!isOpen || !deviceId || !userProfile?.email) {
        setAvailableRules([]);
        return;
      }

      setLoadingAvailableRules(true);
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
        setAvailableRules([]);
      } finally {
        setLoadingAvailableRules(false);
      }
    };

    loadAvailableRules();
  }, [isOpen, deviceId, userProfile?.email]);

  const loadSlaves = async () => {
    if (!deviceId || !userProfile?.email) {
      return;
    }
    try {
      const slaves = await getESPNOWSlaves(deviceId, userProfile.email);
      setEspnowSlaves(slaves);
    } catch (error) {
      console.error('Erro ao carregar slaves:', error);
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

  const handleSave = () => {
    if (!ruleName.trim()) {
      toast.error('Digite um nome para a regra');
      return;
    }
    // Validações: pode usar condições/ações OU instruções sequenciais
    if (instructions.length === 0 && conditions.length === 0) {
      toast.error('Adicione pelo menos uma condição ou uma instrução sequencial');
      return;
    }
    if (instructions.length === 0 && actions.length === 0) {
      toast.error('Adicione pelo menos uma ação ou uma instrução sequencial');
      return;
    }

    const rule = {
      // ✅ Incluir ID da regra se estiver editando
      ...(editingRule && {
        id: editingRule.id,
        supabase_id: editingRule.supabase_id,
        rule_id: editingRule.rule_id,
      }),
      name: ruleName,
      description: description || ruleName,
      // ✅ Converter conditions para RuleCondition[] (value debe ser number)
      conditions: instructions.length > 0 ? [] : conditions.map(c => ({
        sensor: c.sensor,
        operator: c.operator,
        value: typeof c.value === 'string' ? parseFloat(c.value) || 0 : c.value,
        logic: c.logic,
      })),
      // ✅ Converter actions para el formato esperado
      actions: instructions.length > 0 ? [] : actions.map(a => ({
        relayId: a.relayId,
        relayName: a.relayName,
        action: a.action,
        duration: a.action === 'on' ? 60 : 0, // Default duration
      })),
      chainedEvents: chainedEventsSequential.length > 0 ? chainedEventsSequential : chainedEvents, // Usar formato sequencial se houver
      enabled,
      priority,
      cooldown,
      maxExecutionsPerHour,
      // ✅ Funcionalidades de Nova Função
      script: instructions.length > 0 ? {
        instructions,
        loop_interval_ms: loopInterval,
        max_iterations: maxIterations,
        chained_events: chainedEventsSequential.length > 0 ? chainedEventsSequential : undefined,
        cooldown,
        max_executions_per_hour: maxExecutionsPerHour,
      } : undefined,
    };

    onSave(rule);
    hwToast.success(editingRule ? 'Regra atualizada com sucesso!' : 'Regra criada com sucesso!', 'REGRA');
    
    // Reset form
    setRuleName('');
    setDescription('');
    setPriority(50);
    setEnabled(true);
    setConditions([{ sensor: 'ph', operator: '<', value: 5.5, logic: 'AND' }]);
    setActions([]);
    setChainedEvents([]);
    setCooldown(60);
    setMaxExecutionsPerHour(10);
    // ✅ Reset funcionalidades de Nova Função
    setInstructions([]);
    setLoopInterval(5000);
    setMaxIterations(0);
    setChainedEventsSequential([]);
    onClose();
  };

  return (
    <HwModal
      open={isOpen}
      onClose={onClose}
      title={editingRule ? 'Editar Regra - Motor de Decisão' : 'Nova Regra - Motor de Decisão'}
      size="xl"
      footer={
        <div className="flex justify-end gap-3">
          <HwButton variant="secondary" onClick={onClose}>
            Cancelar
          </HwButton>
          <HwButton onClick={handleSave}>Salvar Regra</HwButton>
        </div>
      }
    >
        <div className="space-y-4">
          {/* Fluxo Procedural - Descrição */}
          <div className="bg-aqua-500/10 border border-aqua-500/30 rounded-lg p-3 mb-4">
            <p className="text-sm text-aqua-300 font-medium mb-1 text-center">📋 Fluxo Procedural (de cima para baixo):</p>
            <p className="text-sm text-dark-textSecondary leading-relaxed text-center">
              <span className="text-aqua-400 font-semibold">1. Condições</span> → 
              <span className="text-purple-400 font-semibold"> 2. Ações</span> → 
              <span className="text-yellow-400 font-semibold"> 3. Eventos Encadeados</span> → 
              <span className="text-dark-textSecondary font-semibold"> 4. Config Avançada</span>
            </p>
          </div>

          {/* Nome e Descrição */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-textSecondary mb-2">
                Nome da Função *
              </label>
              <input
                type="text"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                placeholder="Ex: Dreno Automático"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-textSecondary mb-2">
                Descrição
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                rows={2}
                placeholder="Descrição opcional"
              />
            </div>
          </div>

          {/* 🔍 CONDIÇÃO PRINCIPAL - Menu Colapsável */}
          <div className="bg-dark-surface border border-dark-border rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedConditions(!expandedConditions)}
              className="w-full p-4 flex items-center justify-between hover:bg-dark-card transition-colors"
            >
              <div className="flex items-center space-x-3">
                {expandedConditions ? (
                  <ChevronUpIcon className="w-5 h-5 text-aqua-400" />
                ) : (
                  <ChevronDownIcon className="w-5 h-5 text-dark-textSecondary" />
                )}
                <h3 className="text-lg font-semibold text-dark-text">🔍 Condição Principal</h3>
              </div>
            </button>

            {expandedConditions && (
              <div className="p-4 border-t border-dark-border space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-dark-textSecondary">Quando:</p>
                  <button
                    onClick={addCondition}
                    className="px-3 py-1.5 bg-aqua-500/20 text-aqua-400 border border-aqua-500/30 rounded text-sm hover:bg-aqua-500/30 transition-colors"
                  >
                    + Adicionar Condição
                  </button>
                </div>
                <div className="space-y-3">
                  {conditions.map((condition, index) => (
                    <div key={index} className="bg-dark-card p-4 rounded-lg border border-dark-border space-y-3">
                      {index > 0 && (
                        <div className="flex items-center">
                          <select
                            value={condition.logic || 'AND'}
                            onChange={(e) => updateCondition(index, 'logic', e.target.value)}
                            className="px-3 py-1.5 bg-dark-surface border border-dark-border rounded text-dark-text text-sm focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                          >
                            <option value="AND">E (AND)</option>
                            <option value="OR">OU (OR)</option>
                          </select>
                        </div>
                      )}
                      <div className="flex items-center space-x-2">
                        <select
                          value={condition.sensor}
                          onChange={(e) => handleSensorChange(index, e.target.value)}
                          className="flex-1 p-2 bg-dark-surface border border-dark-border rounded text-dark-text text-sm focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                        >
                          {sensors.map((sensor) => (
                            <option key={sensor.value} value={sensor.value}>
                              {sensor.label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={condition.operator}
                          onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                          className="w-40 p-2 bg-dark-surface border border-dark-border rounded text-dark-text text-sm focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                        >
                          {operators.map((op) => (
                            <option key={op.value} value={op.value}>
                              {op.label}
                            </option>
                          ))}
                        </select>
                        {(condition.sensor.startsWith('level_') || condition.sensor === 'water_level') ? (
                          <select
                            value={condition.value as string}
                            onChange={(e) => updateCondition(index, 'value', e.target.value)}
                            className="w-40 p-2 bg-dark-surface border border-dark-border rounded text-dark-text text-sm focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                          >
                            {waterLevelOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                        <input
                          type="number"
                          step="0.1"
                            value={condition.value as number}
                            onChange={(e) => updateCondition(index, 'value', parseFloat(e.target.value) || 0)}
                          className="w-32 p-2 bg-dark-surface border border-dark-border rounded text-dark-text text-sm focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                          placeholder="Valor"
                        />
                        )}
                        {conditions.length > 1 && (
                          <button
                            onClick={() => removeCondition(index)}
                            className="px-3 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-sm hover:bg-red-500/30 transition-colors"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ⚡ AÇÕES - Menu Colapsável */}
          <div className="bg-dark-surface border border-dark-border rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedActions(!expandedActions)}
              className="w-full p-4 flex items-center justify-between hover:bg-dark-card transition-colors"
            >
              <div className="flex items-center space-x-3">
                {expandedActions ? (
                  <ChevronUpIcon className="w-5 h-5 text-aqua-400" />
                ) : (
                  <ChevronDownIcon className="w-5 h-5 text-dark-textSecondary" />
                )}
                <h3 className="text-lg font-semibold text-dark-text">⚡ Ações</h3>
              </div>
            </button>

            {expandedActions && (
              <div className="p-4 border-t border-dark-border space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-dark-textSecondary">Então:</p>
                  <button
                    onClick={addAction}
                    className="px-3 py-1.5 bg-primary-500/20 text-primary-400 border border-primary-500/30 rounded text-sm hover:bg-primary-500/30 transition-colors"
                  >
                    + Adicionar Ação
                  </button>
                </div>
                <div className="space-y-3">
                  {actions.map((action, index) => {
                    // ✅ Gerar opções de relés (APENAS slaves)
                    const relayOptions: Array<{ value: string; label: string; slaveMac: string; relayId: number }> = [];
                    
                    espnowSlaves.forEach((slave) => {
                      slave.relays.forEach((relay) => {
                        relayOptions.push({
                          value: `slave_${slave.macAddress}_${relay.id}`,
                          label: `${slave.name || slave.device_id || 'ESP-SLAVE'}: ${relay.id} - ${relay.name || `Relé ${relay.id}`}`,
                          slaveMac: slave.macAddress,
                          relayId: relay.id,
                        });
                      });
                    });

                    // Valor atual do relay (formato: slave_MAC_relayId)
                    const currentRelayValue = action.relayName && action.relayName.includes(':')
                      ? relayOptions.find(opt => opt.label === action.relayName)?.value || (relayOptions.length > 0 ? relayOptions[0].value : '')
                      : relayOptions.length > 0 ? relayOptions[0].value : '';

                    const handleRelayChange = (value: string) => {
                      const [type, ...parts] = value.split('_');
                      if (type === 'slave') {
                        const [mac, relayNum] = parts;
                        const selectedOption = relayOptions.find(opt => opt.value === value);
                        if (selectedOption) {
                          updateAction(index, 'relayId', parseInt(relayNum));
                          updateAction(index, 'relayName', selectedOption.label);
                        }
                      }
                    };

                    return (
                      <div key={index} className="bg-dark-card p-4 rounded-lg border border-dark-border space-y-3">
                        <div className="flex items-center space-x-2">
                          <select
                            value={currentRelayValue}
                            onChange={(e) => handleRelayChange(e.target.value)}
                            className="flex-1 p-2 bg-dark-surface border border-dark-border rounded text-dark-text text-sm focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                          >
                            {relayOptions.length === 0 ? (
                              <option value="">Nenhum relé slave disponível</option>
                            ) : (
                              relayOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))
                            )}
                          </select>
                          <select
                            value={action.action}
                            onChange={(e) => updateAction(index, 'action', e.target.value)}
                            className="w-32 p-2 bg-dark-surface border border-dark-border rounded text-dark-text text-sm focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                          >
                            <option value="on">Ligar (ON)</option>
                            <option value="off">Desligar (OFF)</option>
                          </select>
                          <button
                            onClick={() => removeAction(index)}
                            className="px-3 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-sm hover:bg-red-500/30 transition-colors"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 📝 INSTRUÇÕES (Ordem de Execução) - dentro de Ações */}
                <div className="border-t border-dark-border pt-4 mt-4">
                  <label className="block text-sm font-medium text-dark-text mb-3">
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
                      {index + 1}. {formatInstructionType(instr.type)}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => moveInstruction(index, 'up')}
                        disabled={index === 0}
                        className="p-1 hover:bg-dark-surface rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Mover para cima"
                      >
                        <ArrowUpIcon className="w-4 h-4 text-dark-textSecondary" />
                      </button>
                      <button
                        onClick={() => moveInstruction(index, 'down')}
                        disabled={index === instructions.length - 1}
                        className="p-1 hover:bg-dark-surface rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Mover para baixo"
                      >
                        <ArrowDownIcon className="w-4 h-4 text-dark-textSecondary" />
                      </button>
                      <button
                        onClick={() => removeInstruction(index)}
                        className="p-1 hover:bg-dark-surface rounded"
                        title="Remover"
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
                        <label className="block text-xs text-dark-textSecondary mb-2">{SWITCH_LABEL}</label>
                        
                        {/* Seleção de Modo: Ciclo ou Timer */}
                        <div className="mb-3">
                          <label className="block text-xs text-dark-textSecondary mb-1">Modo</label>
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
                            <option value="timer">{SWITCH_MODE_TIMER}</option>
                            <option value="cycle">{SWITCH_MODE_CYCLE}</option>
                          </select>
                        </div>

                        {/* Configuração de Timer */}
                        {instr.switch_mode === 'timer' && (
                          <div>
                            <label className="block text-xs text-dark-textSecondary mb-1">Duração (ms)</label>
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
                            <p className="text-xs text-dark-textSecondary/80 mt-1">Tempo que o switch ficará ativo</p>
                          </div>
                        )}

                        {/* Configuração de Ciclo - Compacto */}
                        {instr.switch_mode === 'cycle' && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-3 gap-2 items-end">
                              <div>
                                <label className="block text-xs text-dark-textSecondary mb-1">ON ⏰</label>
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
                                <label className="block text-xs text-dark-textSecondary mb-1">OFF ⏰</label>
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
                              <label className="block text-xs text-dark-textSecondary mb-1">Ciclos: <span className="text-aqua-400">0 = Perpétuo</span></label>
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
                    <div className="text-sm text-dark-textSecondary italic">Retornar do loop</div>
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
              </div>
            )}
          </div>

          {/* Eventos Encadeados - Colapsável (de Nova Função) */}
          <div className="border-t border-dark-border pt-4">
            <div className="border border-dark-border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedChainedEventsSequential(!expandedChainedEventsSequential)}
                className="w-full p-4 flex items-center justify-between hover:bg-dark-surface/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {expandedChainedEventsSequential ? (
                    <ChevronUpIcon className="w-5 h-5 text-aqua-400" />
                  ) : (
                    <ChevronDownIcon className="w-5 h-5 text-dark-textSecondary" />
                  )}
                  <PaperClipIcon className="w-5 h-5 text-purple-400" />
                  <span className="text-sm font-medium text-dark-text">Eventos Encadeados</span>
                </div>
              </button>

              {expandedChainedEventsSequential && (
                <div className="p-4 border-t border-dark-border space-y-4 bg-dark-surface/30">
                  <p className="text-xs text-dark-textSecondary mb-3">
                    Quando esta regra executar, disparar outras regras:
                  </p>

                  <div className="space-y-3">
                    {chainedEventsSequential.map((event, idx) => (
                      <div
                        key={idx}
                        className="border border-dark-border rounded-lg p-3 bg-dark-card"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs text-purple-400 font-mono">
                            Evento {idx + 1}
                          </span>
                          <button
                            onClick={() =>
                              setChainedEventsSequential(chainedEventsSequential.filter((_, i) => i !== idx))
                            }
                            className="p-1 hover:bg-dark-surface rounded"
                          >
                            <XMarkIcon className="w-3 h-3 text-red-400" />
                          </button>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <label className="block text-xs text-dark-textSecondary mb-1">
                              ID da Regra Alvo
                            </label>
                            <TargetRuleIdField
                              value={event.target_rule_id}
                              onChange={(nextValue) => {
                                const updated = [...chainedEventsSequential];
                                updated[idx].target_rule_id = nextValue;
                                setChainedEventsSequential(updated);
                              }}
                              availableRules={availableRules}
                              excludeRuleId={
                                typeof editingRule?.rule_id === 'string' ? editingRule.rule_id : null
                              }
                              loading={loadingAvailableRules}
                              fieldId={`modal-chained-event-${idx}`}
                              inputClassName="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-aqua-500"
                              hintClassName="text-xs text-dark-textSecondary mt-1"
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-dark-textSecondary mb-1">
                              Disparar Quando
                            </label>
                            <select
                              value={event.trigger_on}
                              onChange={(e) => {
                                const updated = [...chainedEventsSequential];
                                updated[idx].trigger_on = e.target.value as 'success' | 'failure';
                                setChainedEventsSequential(updated);
                              }}
                              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-aqua-500"
                            >
                              <option value="success">Ao Ter Sucesso</option>
                              <option value="failure">Ao Ter Falha</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs text-dark-textSecondary mb-1">
                              Espera (ms)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={event.delay_ms}
                              onChange={(e) => {
                                const updated = [...chainedEventsSequential];
                                updated[idx].delay_ms = parseInt(e.target.value) || 0;
                                setChainedEventsSequential(updated);
                              }}
                              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-aqua-500"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() =>
                      setChainedEventsSequential([
                        ...chainedEventsSequential,
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

          {/* Configurações do Loop (de Nova Função) */}
          <div className="border-t border-dark-border pt-4">
            <label className="block text-sm font-medium text-dark-text mb-2">
              Configurações do Loop
            </label>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-dark-textSecondary">Intervalo entre execuções (ms)</label>
                <input
                  type="number"
                  value={loopInterval}
                  onChange={(e) => setLoopInterval(parseInt(e.target.value) || 5000)}
                  className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:outline-none focus:ring-2 focus:ring-aqua-500"
                />
              </div>
              <div>
                <label className="text-xs text-dark-textSecondary">Máximo de iterações: <span className="text-aqua-400">0 = Perpétuo</span></label>
                <input
                  type="number"
                  min="0"
                  value={maxIterations}
                  onChange={(e) => setMaxIterations(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:outline-none focus:ring-2 focus:ring-aqua-500"
                />
              </div>
            </div>
          </div>


          {/* Configurações Avançadas - Colapsável (de Nova Função) */}
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
                <span className="text-sm font-medium text-dark-text">Configurações Avançadas</span>
              </div>
            </button>

            {expandedAdvanced && (
              <div className="p-4 border-t border-dark-border space-y-4 bg-dark-surface/30">
                {/* Prioridade */}
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-2">
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
                    <span className="text-xs text-dark-textSecondary">0</span>
                    <span className="text-sm font-semibold text-aqua-400">{priority}</span>
                    <span className="text-xs text-dark-textSecondary">100</span>
                  </div>
                  <p className="text-xs text-dark-textSecondary mt-1">
                    Valor + mais importante. Default 50.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-textSecondary mb-2">
                    Cooldown (segundos)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={cooldown}
                    onChange={(e) => setCooldown(parseInt(e.target.value))}
                    className="w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                  />
                  <p className="text-xs text-dark-textSecondary mt-1">
                    Tempo mínimo entre execuções da mesma regra.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-textSecondary mb-2">
                    Limite por Hora
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={maxExecutionsPerHour}
                    onChange={(e) => setMaxExecutionsPerHour(parseInt(e.target.value))}
                    className="w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                  />
                  <p className="text-xs text-dark-textSecondary mt-1">
                    Número máximo de execuções por hora.
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
                  <label htmlFor="enabled" className="text-sm font-medium text-dark-text cursor-pointer">
                    Regra Ativa
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
    </HwModal>
  );
}
