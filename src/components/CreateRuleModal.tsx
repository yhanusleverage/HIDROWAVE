'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { XMarkIcon, ChevronDownIcon, ChevronUpIcon, ArrowUpIcon, ArrowDownIcon, PlusIcon, Cog6ToothIcon, PaperClipIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import {
  formatInstructionType,
  getConditionSensors,
  isLevelSensor,
  normalizeCondition,
} from '@/lib/instruction-labels';
import NavLink from '@/components/NavLink';
import { InstructionAddButtons } from './instruction-editors/InstructionAddButtons';
import { BlockAutoProcedureToggle } from './instruction-editors/BlockAutoProcedureToggle';
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
import { DEFAULT_MASTER_RELAYS, type MasterRelayOption } from '@/lib/master-relay-options';
import ConditionFields from './instruction-editors/ConditionFields';
import { createNestedInstruction, ensureInstructionIds } from '@/lib/instruction-factory';
import { isFixedFunctionMacroRule } from '@/lib/decision-rule-display-name';
import { resolveDecisionRuleDisplayName } from '@/lib/decision-rule-display-name';
import { useLanguage } from '@/contexts/LanguageContext';
import { hwToast } from '@/lib/control-toast';

/** Flecha vertical entre bloques del flujo procedural (Condiciones → Ações → …). */
function ProceduralFlowArrow({ label }: { label: string }) {
  return (
    <div
      className="flex flex-col items-center gap-0.5 py-1 select-none"
      aria-hidden="true"
    >
      <div className="h-3 w-px bg-gradient-to-b from-transparent via-aqua-500/50 to-aqua-400/80" />
      <ArrowDownIcon className="w-6 h-6 text-aqua-400" />
      <span className="text-[10px] font-semibold uppercase tracking-wide text-aqua-400/90">
        {label}
      </span>
    </div>
  );
}

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
  value: number | string;
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
      value: number | string;
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
  onSave: (rule: RuleData) => void | Promise<boolean | void>;
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
  const { t } = useLanguage();
  const ac = t.automacao.common;
  const rm = t.automacao.ruleModal;
  const instrT = t.automacao.instr;
  const relayLabel = (relay: { id: number; name?: string }, slave?: { name?: string; device_id?: string }) => {
    const name = relay.name || ac.relayFallback.replace('{id}', String(relay.id));
    if (!slave) return name;
    return `${slave.name || slave.device_id || 'HydroWave Atlas'}: ${relay.id} - ${name}`;
  };
  const masterRelays = useMemo<MasterRelayOption[]>(() => {
    const fromRelays = relays
      .filter((r) => r.device !== 'slave')
      .map((r) => ({ number: r.id, name: r.name }));
    return fromRelays.length > 0 ? fromRelays : DEFAULT_MASTER_RELAYS;
  }, [relays]);
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
  const modalInitKeyRef = useRef<string | null>(null);
  const prevOpenRef = useRef(false);
  const [availableRules, setAvailableRules] = useState<Array<{ rule_id: string; rule_name: string }>>([]);
  const [loadingAvailableRules, setLoadingAvailableRules] = useState(false);

  const sensors = getConditionSensors(instrT);

  const addCondition = () => {
    setConditions((prev) => [
      ...prev,
      { sensor: 'water_level', operator: '!=', value: 'vazio', logic: 'AND' },
    ]);
  };

  const removeCondition = (index: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, field: keyof Condition, value: string | number) => {
    setConditions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const updateConditionRow = (
    index: number,
    condition: { sensor: string; operator: string; value: string | number }
  ) => {
    setConditions((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        sensor: condition.sensor,
        operator: condition.operator,
        value: condition.value,
      };
      return updated;
    });
  };

  const addAction = () => {
    // ✅ Verificar se há relay slaves disponíveis
    const relayOptions: Array<{ value: string; label: string; slaveMac: string; relayId: number }> = [];
    
    espnowSlaves.forEach((slave) => {
      slave.relays.forEach((relay) => {
        relayOptions.push({
          value: `slave_${slave.macAddress}_${relay.id}`,
          label: relayLabel(relay, slave),
          slaveMac: slave.macAddress,
          relayId: relay.id,
        });
      });
    });

    if (relayOptions.length === 0) {
      toast.error(rm.toast.noAtlasRelays);
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

  // Carregar / resetar formulário só ao abrir o modal ou trocar de regra (evita apagar edição em re-renders)
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = isOpen;

    if (!isOpen) {
      modalInitKeyRef.current = null;
      return;
    }

    const initKey = editingRule
      ? String(editingRule.rule_id || editingRule.supabase_id || editingRule.id || 'edit')
      : 'new';

    const justOpened = !wasOpen;
    const ruleChanged =
      modalInitKeyRef.current !== null && modalInitKeyRef.current !== initKey;

    if (!justOpened && !ruleChanged) {
      return;
    }

    modalInitKeyRef.current = initKey;

    setExpandedConditions(true);
    setExpandedActions(true);
    setExpandedChainedEvents(false);
    setExpandedAdvanced(false);
    setExpandedChainedEventsSequential(false);

    if (editingRule) {
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
          setInstructions(ensureInstructionIds(ruleJson.script.instructions as Instruction[]));
        } else {
          setInstructions([]);
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
        setConditions(editingRule.conditions.map((c) => {
          const normalized = normalizeCondition(c);
          const isLevel = isLevelSensor(normalized.sensor);
          return {
            sensor: normalized.sensor,
            operator: normalized.operator,
            value: isLevel ? String(normalized.value) : normalized.value,
            logic: c.logic,
          };
        }));
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
      return;
    }

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
  }, [isOpen, editingRule?.rule_id, editingRule?.supabase_id, editingRule?.id]);

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
  }, [isOpen, deviceId, userProfile?.email, t]);

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
      toast.error(rm.error.nameRequired);
      return;
    }

    const isTypedMacro =
      !!editingRule &&
      isFixedFunctionMacroRule({
        rule_id: editingRule.rule_id as string | undefined,
        rule_json: editingRule.rule_json,
      });

    // Macros da tipagem já têm condition/actions no rule_json (formato DE) — não exigir UI de condições.
    if (!isTypedMacro) {
      if (instructions.length === 0 && conditions.length === 0) {
        toast.error(rm.error.needConditionOrInstr);
        return;
      }
      if (instructions.length === 0 && actions.length === 0) {
        toast.error(rm.error.needActionOrInstr);
        return;
      }
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
      conditions: instructions.length > 0 ? [] : conditions.map((c) => {
        const norm = normalizeCondition(c);
        return {
          sensor: norm.sensor,
          operator: norm.operator,
          value: norm.value,
          logic: c.logic,
        };
      }),
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
      // Preservar JSON tipado (condition singular + relay_on) ao ativar/editar no Motor
      ...(isTypedMacro && editingRule?.rule_json
        ? { preserve_rule_json: true as const, rule_json: editingRule.rule_json }
        : {}),
    };

    const ok = await Promise.resolve(onSave(rule));
    if (ok === false) return;

    // Toast de sucesso vem do parent (após DB); aqui só fecha se salvou
    setRuleName('');
    setDescription('');
    setPriority(50);
    setEnabled(true);
    setConditions([{ sensor: 'ph', operator: '<', value: 5.5, logic: 'AND' }]);
    setActions([]);
    setChainedEvents([]);
    setCooldown(60);
    setMaxExecutionsPerHour(10);
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
      title={editingRule ? rm.title.edit : rm.title.create}
      size="xl"
      footer={
        <div className="flex justify-end gap-3">
          <HwButton variant="secondary" onClick={onClose}>
            {ac.cancel}
          </HwButton>
          <HwButton onClick={handleSave}>{rm.action.save}</HwButton>
        </div>
      }
    >
        <div className="space-y-4">
          {/* Fluxo Procedural - Descrição */}
          <div className="bg-aqua-500/10 border border-aqua-500/30 rounded-lg p-3 mb-4">
            <p className="text-sm text-aqua-300 font-medium mb-1 text-center">{rm.flow.title}</p>
            <p className="text-sm text-dark-textSecondary leading-relaxed text-center flex flex-col sm:flex-row sm:flex-wrap items-center justify-center gap-1 sm:gap-0">
              <span className="text-aqua-400 font-semibold">{rm.flow.step1}</span>
              <span className="hidden sm:inline text-dark-textSecondary/60 mx-1.5">↓</span>
              <span className="sm:hidden text-aqua-400/70" aria-hidden>↓</span>
              <span className="text-purple-400 font-semibold">{rm.flow.step2}</span>
              <span className="hidden sm:inline text-dark-textSecondary/60 mx-1.5">↓</span>
              <span className="sm:hidden text-aqua-400/70" aria-hidden>↓</span>
              <span className="text-yellow-400 font-semibold">{rm.flow.step3}</span>
              <span className="hidden sm:inline text-dark-textSecondary/60 mx-1.5">↓</span>
              <span className="sm:hidden text-aqua-400/70" aria-hidden>↓</span>
              <span className="text-dark-textSecondary font-semibold">{rm.flow.step4}</span>
            </p>
          </div>

          {/* Nome e Descrição */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-textSecondary mb-2">
                {rm.label.functionName}
              </label>
              <input
                type="text"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                placeholder={rm.placeholder.functionName}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-textSecondary mb-2">
                {ac.description}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                rows={2}
                placeholder={ac.placeholderDescription}
              />
            </div>
          </div>

          <p className="text-xs text-dark-textSecondary rounded-lg border border-dark-border bg-dark-surface/50 px-3 py-2">
            {rm.hint.openProcedureBuilder}{' '}
            <NavLink href="/automacao/procedimento" className="text-aqua-400 hover:underline">
              {rm.hint.openProcedureBuilderLink}
            </NavLink>
          </p>

          {/* 🔍 CONDIÇÃO PRINCIPAL - Menu Colapsável */}
          <div className="bg-dark-surface border border-dark-border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedConditions(!expandedConditions)}
              className="w-full p-4 flex items-center justify-between hover:bg-dark-card transition-colors"
            >
              <div className="flex items-center space-x-3">
                {expandedConditions ? (
                  <ChevronUpIcon className="w-5 h-5 text-aqua-400" />
                ) : (
                  <ChevronDownIcon className="w-5 h-5 text-dark-textSecondary" />
                )}
                <h3 className="text-lg font-semibold text-dark-text">{rm.section.mainCondition}</h3>
              </div>
            </button>

            {expandedConditions && (
              <div className="p-4 border-t border-dark-border space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-dark-textSecondary">{rm.label.when}</p>
                  <button
                    type="button"
                    onClick={addCondition}
                    className="px-3 py-1.5 bg-aqua-500/20 text-aqua-400 border border-aqua-500/30 rounded text-sm hover:bg-aqua-500/30 transition-colors"
                  >
                    {rm.action.addCondition}
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
                            <option value="AND">{rm.logic.and}</option>
                            <option value="OR">{rm.logic.or}</option>
                          </select>
                        </div>
                      )}
                      <ConditionFields
                        condition={{
                          sensor: condition.sensor,
                          operator: condition.operator,
                          value: condition.value,
                        }}
                        onChange={(updated) => updateConditionRow(index, updated)}
                        sensors={sensors}
                      />
                      {conditions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCondition(index)}
                          className="px-3 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-sm hover:bg-red-500/30 transition-colors"
                        >
                          {ac.remove}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <ProceduralFlowArrow label={rm.flow.arrowActions} />

          {/* Passos do script — sempre visível (não esconder em Ações) */}
          <div className="bg-dark-surface border border-dark-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-dark-border">
              <h3 className="text-lg font-semibold text-dark-text">{rm.section.scriptSteps}</h3>
              <p className="text-xs text-dark-textSecondary mt-1">
                {rm.hint.scriptOrder}
              </p>
            </div>
            <div className="p-4 space-y-4">
              <BlockAutoProcedureToggle
                instructions={instructions}
                onChange={setInstructions}
              />
              <InstructionAddButtons onAdd={addInstruction} />

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
            </div>
          </div>

          <ProceduralFlowArrow label={rm.flow.arrowSimpleActions} />

          {/* Ações simples (relés slave) — opcional se não usar script */}
          <div className="bg-dark-surface border border-dark-border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedActions(!expandedActions)}
              className="w-full p-4 flex items-center justify-between hover:bg-dark-card transition-colors"
            >
              <div className="flex items-center space-x-3">
                {expandedActions ? (
                  <ChevronUpIcon className="w-5 h-5 text-aqua-400" />
                ) : (
                  <ChevronDownIcon className="w-5 h-5 text-dark-textSecondary" />
                )}
                <h3 className="text-lg font-semibold text-dark-text">{rm.section.simpleActions}</h3>
              </div>
            </button>

            {expandedActions && (
              <div className="p-4 border-t border-dark-border space-y-4">
                <p className="text-xs text-dark-textSecondary">
                  {rm.hint.preferScript}
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-dark-textSecondary">{rm.label.then}</p>
                  <button
                    type="button"
                    onClick={addAction}
                    className="px-3 py-1.5 bg-primary-500/20 text-primary-400 border border-primary-500/30 rounded text-sm hover:bg-primary-500/30 transition-colors"
                  >
                    {rm.action.addAction}
                  </button>
                </div>
                <div className="space-y-3">
                  {actions.map((action, index) => {
                    const relayOptions: Array<{ value: string; label: string; slaveMac: string; relayId: number }> = [];

                    espnowSlaves.forEach((slave) => {
                      slave.relays.forEach((relay) => {
                        relayOptions.push({
                          value: `slave_${slave.macAddress}_${relay.id}`,
                          label: relayLabel(relay, slave),
                          slaveMac: slave.macAddress,
                          relayId: relay.id,
                        });
                      });
                    });

                    const currentRelayValue = action.relayName && action.relayName.includes(':')
                      ? relayOptions.find(opt => opt.label === action.relayName)?.value || (relayOptions.length > 0 ? relayOptions[0].value : '')
                      : relayOptions.length > 0 ? relayOptions[0].value : '';

                    const handleRelayChange = (value: string) => {
                      const [type, ...parts] = value.split('_');
                      if (type === 'slave') {
                        const [, relayNum] = parts;
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
                              <option value="">{rm.empty.noAtlasRelays}</option>
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
                            <option value="on">{ac.on}</option>
                            <option value="off">{ac.off}</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => removeAction(index)}
                            className="px-3 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-sm hover:bg-red-500/30 transition-colors"
                          >
                            {ac.remove}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <ProceduralFlowArrow label={rm.flow.arrowEvents} />

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
                  <span className="text-sm font-medium text-dark-text">{rm.section.chainedEvents}</span>
                </div>
              </button>

              {expandedChainedEventsSequential && (
                <div className="p-4 border-t border-dark-border space-y-4 bg-dark-surface/30">
                  <p className="text-xs text-dark-textSecondary mb-3">
                    {rm.hint.chainedEvents}
                  </p>

                  <div className="space-y-3">
                    {chainedEventsSequential.map((event, idx) => (
                      <div
                        key={idx}
                        className="border border-dark-border rounded-lg p-3 bg-dark-card"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs text-purple-400 font-mono">
                            {rm.label.eventN.replace('{n}', String(idx + 1))}
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
                              {rm.label.targetRuleId}
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
                              {rm.label.triggerWhen}
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
                    {rm.action.addEvent}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Configurações do Loop (de Nova Função) */}
          <div className="border-t border-dark-border pt-4">
            <label className="block text-sm font-medium text-dark-text mb-2">
              {rm.section.loopConfig}
            </label>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-dark-textSecondary">{rm.label.loopInterval}</label>
                <input
                  type="number"
                  value={loopInterval}
                  onChange={(e) => setLoopInterval(parseInt(e.target.value) || 5000)}
                  className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:outline-none focus:ring-2 focus:ring-aqua-500"
                />
              </div>
              <div>
                <label className="text-xs text-dark-textSecondary">{rm.label.maxIterations} <span className="text-aqua-400">{instrT.cyclesPerpetual}</span></label>
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

          <ProceduralFlowArrow label={rm.flow.arrowConfig} />

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
                <span className="text-sm font-medium text-dark-text">{rm.section.advanced}</span>
              </div>
            </button>

            {expandedAdvanced && (
              <div className="p-4 border-t border-dark-border space-y-4 bg-dark-surface/30">
                {/* Prioridade */}
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-2">
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
                  <p className="text-xs text-dark-textSecondary mt-1">
                    {rm.hint.priority}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-textSecondary mb-2">
                    {rm.label.cooldown}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={cooldown}
                    onChange={(e) => setCooldown(parseInt(e.target.value))}
                    className="w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                  />
                  <p className="text-xs text-dark-textSecondary mt-1">
                    {rm.hint.cooldown}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-textSecondary mb-2">
                    {rm.label.maxPerHour}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={maxExecutionsPerHour}
                    onChange={(e) => setMaxExecutionsPerHour(parseInt(e.target.value))}
                    className="w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                  />
                  <p className="text-xs text-dark-textSecondary mt-1">
                    {rm.hint.maxPerHour}
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
                    {rm.label.enabled}
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
    </HwModal>
  );
}
