'use client';

import React, { useState, useEffect } from 'react';
import { XMarkIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

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
  duration: number; // em segundos
}

interface ChainedEvent {
  targetRuleId: string;
  triggerType: 'on_execute' | 'on_success' | 'on_failure';
  delay?: number;
}

interface CreateRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rule: any) => void;
  relays: Relay[];
  onUpdateRelay: (id: number, name: string) => void;
}

export default function CreateRuleModal({
  isOpen,
  onClose,
  onSave,
  relays,
  onUpdateRelay,
}: CreateRuleModalProps) {
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

  // Cuando se cambia el sensor a water_level, ajustar el valor
  const handleSensorChange = (index: number, sensorValue: string) => {
    const updated = [...conditions];
    if (sensorValue === 'water_level') {
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

  const sensors = [
    { value: 'temperature', label: 'Temperatura da Água (°C)' },
    { value: 'humidity', label: 'Umidade (%)' },
    { value: 'water_level', label: 'Nível de Água' },
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

  const updateCondition = (index: number, field: keyof Condition, value: any) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], [field]: value };
    setConditions(updated);
  };

  const addAction = () => {
    if (relays.length === 0) {
      toast.error('Nenhum relé disponível. Carregue os relays primeiro.');
      return;
    }
    setActions([
      ...actions,
      { relayId: relays[0].id, relayName: relays[0].name, action: 'on', duration: 60 },
    ]);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const updateAction = (index: number, field: keyof Action, value: any) => {
    const updated = [...actions];
    if (field === 'relayId') {
      const relay = relays.find(r => r.id === value);
      updated[index] = { ...updated[index], relayId: value, relayName: relay?.name || '' };
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

  const updateChainedEvent = (index: number, field: keyof ChainedEvent, value: any) => {
    const updated = [...chainedEvents];
    updated[index] = { ...updated[index], [field]: value };
    setChainedEvents(updated);
  };

  const handleSave = () => {
    if (!ruleName.trim()) {
      toast.error('Digite um nome para a regra');
      return;
    }
    if (conditions.length === 0) {
      toast.error('Adicione pelo menos uma condição');
      return;
    }
    if (actions.length === 0) {
      toast.error('Adicione pelo menos uma ação');
      return;
    }

    const rule = {
      name: ruleName,
      description: description || ruleName,
      conditions,
      actions,
      chainedEvents,
      enabled,
      priority,
      cooldown,
      maxExecutionsPerHour,
    };

    onSave(rule);
    toast.success('Regra criada com sucesso!');
    
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
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-card border border-dark-border rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-border">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-aqua-400 to-primary-400 bg-clip-text text-transparent">
            ➕ Nova Regra - Motor de Decisão
          </h2>
          <button
            onClick={onClose}
            className="text-dark-textSecondary hover:text-dark-text transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Nome e Descrição */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-textSecondary mb-2">
                Nome da Regra *
              </label>
              <input
                type="text"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                placeholder="Ex: Chiller Desligado → Bomba Água Desligada"
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
                placeholder="Descreva o que esta regra faz..."
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
                        {condition.sensor !== 'water_level' && (
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
                        )}
                        {condition.sensor === 'water_level' ? (
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
                  {actions.map((action, index) => (
                    <div key={index} className="bg-dark-card p-4 rounded-lg border border-dark-border space-y-3">
                      <div className="flex items-center space-x-2">
                        <select
                          value={action.relayId}
                          onChange={(e) => updateAction(index, 'relayId', parseInt(e.target.value))}
                          className="flex-1 p-2 bg-dark-surface border border-dark-border rounded text-dark-text text-sm focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                        >
                          {relays.map((relay) => (
                            <option key={relay.id} value={relay.id}>
                              {relay.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={action.action}
                          onChange={(e) => updateAction(index, 'action', e.target.value)}
                          className="w-32 p-2 bg-dark-surface border border-dark-border rounded text-dark-text text-sm focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                        >
                          <option value="on">Ligar (ON)</option>
                          <option value="off">Desligar (OFF)</option>
                        </select>
                        <input
                          type="number"
                          min="0"
                          value={action.duration}
                          onChange={(e) => updateAction(index, 'duration', parseInt(e.target.value))}
                          className="w-32 p-2 bg-dark-surface border border-dark-border rounded text-dark-text text-sm focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                          placeholder="Duração (seg)"
                        />
                        <span className="text-sm text-dark-textSecondary">seg</span>
                        <button
                          onClick={() => removeAction(index)}
                          className="px-3 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-sm hover:bg-red-500/30 transition-colors"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 🔗 EVENTOS ENCADEADOS - Menu Colapsável */}
          <div className="bg-dark-surface border border-dark-border rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedChainedEvents(!expandedChainedEvents)}
              className="w-full p-4 flex items-center justify-between hover:bg-dark-card transition-colors"
            >
              <div className="flex items-center space-x-3">
                {expandedChainedEvents ? (
                  <ChevronUpIcon className="w-5 h-5 text-aqua-400" />
                ) : (
                  <ChevronDownIcon className="w-5 h-5 text-dark-textSecondary" />
                )}
                <h3 className="text-lg font-semibold text-dark-text">🔗 Eventos Encadeados</h3>
              </div>
            </button>

            {expandedChainedEvents && (
              <div className="p-4 border-t border-dark-border space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-dark-textSecondary">Quando esta regra executar, disparar:</p>
                  <button
                    onClick={addChainedEvent}
                    className="px-3 py-1.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded text-sm hover:bg-purple-500/30 transition-colors"
                  >
                    + Adicionar Evento
                  </button>
                </div>
                <div className="space-y-3">
                  {chainedEvents.map((event, index) => (
                    <div key={index} className="bg-dark-card p-4 rounded-lg border border-dark-border space-y-3">
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={event.targetRuleId}
                          onChange={(e) => updateChainedEvent(index, 'targetRuleId', e.target.value)}
                          className="flex-1 p-2 bg-dark-surface border border-dark-border rounded text-dark-text text-sm focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                          placeholder="ID da Regra Alvo"
                        />
                        <select
                          value={event.triggerType}
                          onChange={(e) => updateChainedEvent(index, 'triggerType', e.target.value)}
                          className="w-48 p-2 bg-dark-surface border border-dark-border rounded text-dark-text text-sm focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                        >
                          <option value="on_execute">Ao Executar</option>
                          <option value="on_success">Ao Ter Sucesso</option>
                          <option value="on_failure">Ao Falhar</option>
                        </select>
                        <input
                          type="number"
                          min="0"
                          value={event.delay || 0}
                          onChange={(e) => updateChainedEvent(index, 'delay', parseInt(e.target.value))}
                          className="w-32 p-2 bg-dark-surface border border-dark-border rounded text-dark-text text-sm focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                          placeholder="Delay (ms)"
                        />
                        <button
                          onClick={() => removeChainedEvent(index)}
                          className="px-3 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-sm hover:bg-red-500/30 transition-colors"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ⚙️ CONFIGURAÇÕES AVANÇADAS - Menu Colapsável */}
          <div className="bg-dark-surface border border-dark-border rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedAdvanced(!expandedAdvanced)}
              className="w-full p-4 flex items-center justify-between hover:bg-dark-card transition-colors"
            >
              <div className="flex items-center space-x-3">
                {expandedAdvanced ? (
                  <ChevronUpIcon className="w-5 h-5 text-aqua-400" />
                ) : (
                  <ChevronDownIcon className="w-5 h-5 text-dark-textSecondary" />
                )}
                <h3 className="text-lg font-semibold text-dark-text">⚙️ Configurações Avançadas</h3>
              </div>
            </button>

            {expandedAdvanced && (
              <div className="p-4 border-t border-dark-border space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-textSecondary mb-2">
                    Prioridade (0-100) *
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={priority}
                      onChange={(e) => setPriority(parseInt(e.target.value))}
                      className="flex-1 h-2 bg-dark-border rounded-lg appearance-none cursor-pointer accent-aqua-500"
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={priority}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setPriority(Math.max(0, Math.min(100, val)));
                      }}
                      className="w-20 p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text text-center focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                    />
                  </div>
                  <p className="text-xs text-dark-textSecondary mt-1">
                    Maior = mais importante. Default: 50.
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
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="w-4 h-4 text-aqua-500 bg-dark-surface border-dark-border rounded focus:ring-aqua-500"
                  />
                  <label className="text-sm text-dark-text">Regra Ativa</label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-4 p-6 border-t border-dark-border">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-dark-surface hover:bg-dark-border text-dark-text border border-dark-border rounded-lg font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-aqua-500/50"
          >
            Salvar Regra
          </button>
        </div>
      </div>
    </div>
  );
}
