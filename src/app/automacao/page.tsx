'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Toaster, toast, type Toast } from 'react-hot-toast';
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  LockClosedIcon,
  LockOpenIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  XMarkIcon,
  ClipboardIcon,
  ClipboardDocumentCheckIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import CreateRuleModal from '@/components/CreateRuleModal';
import RuleCard from '@/components/RuleCard';
import { getDecisionRules, createDecisionRule, updateDecisionRule, deleteDecisionRule, DecisionRule, getUserDevices, DeviceStatus } from '@/lib/automation';
import { useAuth } from '@/contexts/AuthContext';
import { getESPNOWSlaves, ESPNowSlave } from '@/lib/esp-now-slaves';
import { supabase } from '@/lib/supabase';
// Removido: import { getRelayStates } from '@/lib/automation'; // ❌ Não usar mais relay_states
import { getMasterLocalRelayNames, saveMasterLocalRelayName } from '@/lib/nutrition-plan';

interface Relay {
  id: number;
  name: string;
}

interface RuleCondition {
  sensor: string;
  operator: string;
  value: number;
  logic?: 'AND' | 'OR';
}

interface RuleAction {
  relay_ids?: number[];
  relay_names?: string[];
  relay_id?: number;
  relay_name?: string;
  duration?: number;
  target_device_id?: string;
  slave_mac_address?: string;
  [key: string]: unknown;
}

interface ScriptInstruction {
  type: string;
  condition?: {
    sensor: string;
    operator: string;
    value: number;
  };
  [key: string]: unknown;
}

interface RuleJson {
  conditions?: RuleCondition[];
  actions?: RuleAction[];
  script?: {
    instructions: ScriptInstruction[];
    max_iterations?: number;
    chained_events?: unknown;
    cooldown?: number;
    max_executions_per_hour?: number;
  };
  circadian_cycle?: {
    enabled: boolean;
    on_duration_ms: number;
    off_duration_ms: number;
    total_cycle_ms: number;
    start_time?: string;
    timezone?: string;
  };
  delay_before_execution?: number;
  interval_between_executions?: number;
  priority?: number;
  [key: string]: unknown;
}

export interface AutomationRule {
  id: number | string; // ✅ Pode ser número (temporário) ou UUID string (do Supabase)
  name: string;
  description: string;
  condition: string;
  action: string;
  enabled: boolean;
  conditions?: RuleCondition[];
  actions?: RuleAction[];
  rule_json?: RuleJson; // ✅ Para scripts sequenciais
  rule_name?: string; // ✅ Nome original do Supabase
  rule_description?: string; // ✅ Descrição original do Supabase
  priority?: number; // ✅ Prioridade da regra
  supabase_id?: string; // ✅ UUID real do Supabase (para updates/deletes)
  rule_id?: string; // ✅ rule_id text do Supabase
  device_id?: string;
  created_by?: string;
  [key: string]: unknown; // ✅ Index signature para compatibilidad
}

// ✅ Funções helper para converter entre formato de tempo (HH:MM:SS) e milissegundos
// Nota: Estas funciones están definidas pero no se usan actualmente
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const timeToMilliseconds = (timeStr: string): number => {
  const parts = timeStr.split(':');
  if (parts.length !== 3) return 60000; // Default: 1 minuto em ms
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  const seconds = parseInt(parts[2], 10) || 0;
  return (hours * 3600 + minutes * 60 + seconds) * 1000;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const millisecondsToTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const validateTimeFormat = (timeStr: string): boolean => {
  const regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
  return regex.test(timeStr);
};

export default function AutomacaoPage() {
  const { userProfile } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null); // ✅ Regra sendo editada
  const [jsonPreviewRule, setJsonPreviewRule] = useState<AutomationRule | null>(null); // ✅ Regra para vista previa JSON
  const [showECConfigPreview, setShowECConfigPreview] = useState<boolean>(false); // ✅ Vista previa de EC Config
  const [copiedRuleId, setCopiedRuleId] = useState<string | null>(null); // ✅ rule_id copiado para feedback visual
  const [loading, setLoading] = useState(true);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('default_device');
  const [availableMasters, setAvailableMasters] = useState<DeviceStatus[]>([]);
  
  const [relays, setRelays] = useState<Relay[]>([
    { id: 0, name: 'Aquecedor' },
    { id: 1, name: 'pH+' },
    { id: 2, name: 'Grow' },
    { id: 3, name: 'Micro' },
    { id: 4, name: 'Bloom' },
    { id: 5, name: 'Bomba Principal' },
    { id: 6, name: 'Luz UV' },
    { id: 7, name: 'Aerador' },
  ]);

  const [rules, setRules] = useState<AutomationRule[]>([]);
  
  // ✅ NOVO: Timezone do usuário (carregado das configurações)
  const [userTimezone, setUserTimezone] = useState<string>('America/Sao_Paulo');
  
  // Estado para gerenciar relés ESP-NOW Slaves (nomes globais)
  const [espnowSlaves, setEspnowSlaves] = useState<ESPNowSlave[]>([]);
  const [loadingSlaves, setLoadingSlaves] = useState(false);
  const [expandedSlaveRelayManager, setExpandedSlaveRelayManager] = useState<boolean>(false);
  const [expandedSlaves, setExpandedSlaves] = useState<Set<string>>(new Set());
  const [expandedRenameRelays, setExpandedRenameRelays] = useState<Set<string>>(new Set());
  
  // ✅ Estado para rastrear relés ligados/desligados (slave_mac-relay_id -> boolean)
  const [relayStates, setRelayStates] = useState<Map<string, boolean>>(new Map());
  const [loadingRelays, setLoadingRelays] = useState<Map<string, boolean>>(new Map());
  
  // ✅ NOVO: Estados para renombrar relés (igual a DeviceControlPanel)
  const [tempRelayNames, setTempRelayNames] = useState<Map<string, string>>(new Map());
  const [savingRelayNames, setSavingRelayNames] = useState<Set<string>>(new Set());
  
  // ✅ NOVO: Estados para timers configurados por relé (relayKey -> duration_seconds)
  const [relayTimers, setRelayTimers] = useState<Map<string, number>>(new Map());
  const [showTimerInput, setShowTimerInput] = useState<string | null>(null); // relayKey que está mostrando input
  
  // ✅ NOVO: Estados para ciclos programados (relayKey -> { onDuration: number, offDuration: number, enabled: boolean })
  const [relayCycles, setRelayCycles] = useState<Map<string, { onDuration: number; offDuration: number; enabled: boolean }>>(new Map());
  const [showCycleInput, setShowCycleInput] = useState<string | null>(null); // relayKey que está mostrando input de ciclo
  
  // ✅ NOVO: Mapeamento Command ID → Relay Key (padrão indústria)
  const commandToRelayMap = useRef<Map<string | number, string>>(new Map());
  
  // ✅ NOVO: Estado para rastrear si cada slave está bloqueado (MAC address -> boolean)
  const [lockedSlaves, setLockedSlaves] = useState<Map<string, boolean>>(new Map());
  const [ecControllerLocked, setEcControllerLocked] = useState<boolean>(false);
  const [decisionEngineLocked, setDecisionEngineLocked] = useState<boolean>(false);
  
  // Estado para Controle Nutricional Proporcional
  const [expandedNutritionalControl, setExpandedNutritionalControl] = useState<boolean>(true);
  const [expandedDecisionEngine, setExpandedDecisionEngine] = useState<boolean>(true);
  const [pumpFlowRate, setPumpFlowRate] = useState<number>(1.0);
  const [totalVolume, setTotalVolume] = useState<number>(10);
  
  // ✅ EC Controller - Parâmetros Básicos
  const [baseDose, setBaseDose] = useState<number>(1525.0); // EC base em µS/cm
  const [ecSetpoint, setEcSetpoint] = useState<number>(1500.0); // EC Setpoint em µS/cm
  const [intervaloAutoEC, setIntervaloAutoEC] = useState<number>(300); // Intervalo entre verificações (segundos)
  const [tempoRecirculacao, setTempoRecirculacao] = useState<string>('00:01'); // Tempo de recirculação (formato HH:MM)
  const [tempoRecirculacaoHours, setTempoRecirculacaoHours] = useState<number>(0);
  const [tempoRecirculacaoMinutes, setTempoRecirculacaoMinutes] = useState<number>(1);
  const [autoEnabled, setAutoEnabled] = useState<boolean>(false); // Controle automático ativado
  
  // ✅ REF para prevenir recarga automática después de guardar (previene data race)
  const justSavedRef = useRef<boolean>(false);
  const savingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // ✅ Funções helper para converter entre formato de tempo (HH:MM) e milissegundos
  const timeToMilliseconds = (timeStr: string): number => {
    const parts = timeStr.split(':');
    if (parts.length < 2) return 60000; // Default: 1 minuto em ms
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    return (hours * 3600 + minutes * 60) * 1000;
  };
  
  const millisecondsToTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };
  
  const validateTimeFormat = (timeStr: string): boolean => {
    const regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return regex.test(timeStr);
  };
  
  // ✅ EC Controller - Status e Monitoramento
  const [ecError, setEcError] = useState<number>(0); // Erro atual (µS/cm)
  const [lastDosage, setLastDosage] = useState<number>(0); // Última dosagem (ml)
  const [ecAtual, setEcAtual] = useState<number>(0); // EC atual do sensor
  // ✅ REMOVIDO: Nutrientes hardcodeados - agora inicia vazio e carrega apenas do Supabase
  const [nutrientsState, setNutrientsState] = useState<Array<{name: string, relayNumber: number, mlPerLiter: number}>>([]);
  const [isLoadingNutrients, setIsLoadingNutrients] = useState<Record<number, boolean>>({});
  const [isNutrientModalOpen, setIsNutrientModalOpen] = useState<boolean>(false);
  const [editingNutrientIndex, setEditingNutrientIndex] = useState<number | null>(null);
  
  // ✅ NOVO: Nomes de relés LOCAIS do Master
  const [localRelayNames, setLocalRelayNames] = useState<Map<number, string>>(new Map());
  const [availableRelays, setAvailableRelays] = useState<Array<{number: number, name: string}>>([]);
  

  // Carregar Masters disponíveis e selecionar o primeiro automaticamente
  useEffect(() => {
    loadMasters();
  }, [userProfile?.email]);

  // ✅ NOVO: Carregar nomes de relés LOCAIS do Master
  const loadLocalRelayNames = useCallback(async () => {
    if (!selectedDeviceId || selectedDeviceId === 'default_device') return;
    
    try {
      const names = await getMasterLocalRelayNames(selectedDeviceId);
      setLocalRelayNames(names);
      
      // ✅ PCF1: Criar lista de relés disponíveis (0-6) - 7 relays para peristálticos
      // ✅ PCF2: Será usado para sensores de nível (não incluído aqui)
      const relays: Array<{number: number, name: string}> = [];
      for (let i = 0; i <= 7; i++) {
        const name = names.get(i) || `Relé ${i}`;
        relays.push({ number: i, name });
      }
      setAvailableRelays(relays);
    } catch (error) {
      console.error('Erro ao carregar nomes de relés locais:', error);
    }
  }, [selectedDeviceId]);
  
  // ✅ NOVO: Carregar configuração do EC Controller do Supabase
  const loadECControllerConfig = useCallback(async () => {
    if (!selectedDeviceId || selectedDeviceId === 'default_device') return;
    
    // ✅ PREVENIR DATA RACE: No recargar si acabamos de guardar (dentro de 2 segundos)
    if (justSavedRef.current) {
      console.log('⏸️ [EC Controller] Recarga bloqueada: acabamos de guardar, usando estado local');
      return;
    }
    
    try {
      const response = await fetch(`/api/ec-controller/config?device_id=${encodeURIComponent(selectedDeviceId)}`);
      if (!response.ok) {
        console.error('Erro ao carregar config EC Controller:', response.statusText);
        return;
      }
      
      const config = await response.json();
      
      interface NutrientFromConfig {
        name?: string;
        relay?: number;
        relayNumber?: number;
        mlPerLiter?: number;
      }
      
      // Carregar nutrientes do array JSONB
      if (config.nutrients && Array.isArray(config.nutrients) && config.nutrients.length > 0) {
        const nutrients = config.nutrients.map((nut: NutrientFromConfig) => ({
          name: nut.name || '',
          relayNumber: nut.relay || nut.relayNumber || 0,
          mlPerLiter: nut.mlPerLiter || 0,
        }));
        setNutrientsState(nutrients);
      } else {
        // Iniciar vazio se não houver nutrientes
        setNutrientsState([]);
      }
      
      // Carregar pumpFlowRate e totalVolume
      if (config.flow_rate !== undefined && !isNaN(config.flow_rate)) setPumpFlowRate(config.flow_rate);
      if (config.volume !== undefined && !isNaN(config.volume)) setTotalVolume(config.volume);
      
      // ✅ Carregar parâmetros do EC Controller
      if (config.base_dose !== undefined && !isNaN(config.base_dose)) setBaseDose(config.base_dose);
      if (config.ec_setpoint !== undefined && !isNaN(config.ec_setpoint)) setEcSetpoint(config.ec_setpoint);
      if (config.intervalo_auto_ec !== undefined && !isNaN(config.intervalo_auto_ec)) setIntervaloAutoEC(config.intervalo_auto_ec);
      if (config.tempo_recirculacao !== undefined && config.tempo_recirculacao !== null) {
        // ✅ ATUALIZADO: tempo_recirculacao agora é INTEGER (milisegundos) na BD
        // Converter milisegundos para formato HH:MM para exibição no frontend
        const ms = typeof config.tempo_recirculacao === 'number' 
          ? config.tempo_recirculacao 
          : parseInt(String(config.tempo_recirculacao), 10);
        
        if (!isNaN(ms) && ms > 0) {
          const timeStr = millisecondsToTime(ms);
          setTempoRecirculacao(timeStr);
          // Atualizar também os campos separados
          const parts = timeStr.split(':');
          if (parts.length >= 2) {
            setTempoRecirculacaoHours(parseInt(parts[0], 10) || 0);
            setTempoRecirculacaoMinutes(parseInt(parts[1], 10) || 1);
          }
        } else {
          console.warn('⚠️ [EC Controller] tempo_recirculacao inválido ao carregar, usando default:', config.tempo_recirculacao);
          setTempoRecirculacao('00:01'); // Default: 1 minuto
          setTempoRecirculacaoHours(0);
          setTempoRecirculacaoMinutes(1);
        }
      }
      // ✅ SOLUCIÓN DATA RACE: Solo actualizar auto_enabled si NO acabamos de guardar
      if (config.auto_enabled !== undefined && !justSavedRef.current) {
        setAutoEnabled(config.auto_enabled);
      }
    } catch (error) {
      console.error('Erro ao carregar config EC Controller:', error);
    }
  }, [selectedDeviceId]);
  
  // ✅ Sincronizar tempoRecirculacao com campos separados (horas e minutos)
  useEffect(() => {
    const formatted = `${String(tempoRecirculacaoHours).padStart(2, '0')}:${String(tempoRecirculacaoMinutes).padStart(2, '0')}`;
    if (formatted !== tempoRecirculacao) {
      setTempoRecirculacao(formatted);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tempoRecirculacaoHours, tempoRecirculacaoMinutes]);
  
  // ✅ Função para calcular distribuição proporcional de nutrientes
  // Similar ao Hydro-Controller-main: calcula como u(t) será distribuído entre nutrientes
  // Fórmulas:
  // - k = baseDose / totalMlPerLiter
  // - u(t) = (V / (k × q)) × e
  // - proporção = mlPerLiter / totalMlPerLiter
  // - utNutriente = totalUt × proporção
  // - tempoDosagem = utNutriente / flowRate
  const calculateDistribution = useCallback(() => {
    // Calcular total_ml (soma de todos os mlPerLiter)
    const totalMlPerLiter = nutrientsState.reduce((sum, nut) => sum + nut.mlPerLiter, 0);
    
    // Validar que temos dados suficientes
    if (totalMlPerLiter <= 0 || baseDose <= 0 || pumpFlowRate <= 0 || totalVolume <= 0) {
      console.warn('⚠️ [EC Controller] Dados insuficientes para calcular distribution:', {
        totalMlPerLiter,
        baseDose,
        pumpFlowRate,
        totalVolume
      });
      return null;
    }
    
    // Calcular k = baseDose / totalMlPerLiter
    const k = baseDose / totalMlPerLiter;
    
    // Calcular u(t) = (V / (k × q)) × e
    // Usar erro absoluto para garantir dosagem positiva
    const error = Math.abs(ecError);
    const totalUt = (totalVolume / (k * pumpFlowRate)) * error;
    
    // Se u(t) é muito pequeno ou zero, retornar null
    if (totalUt <= 0.001) {
      console.warn('⚠️ [EC Controller] u(t) muito pequeno ou zero:', totalUt);
      return null;
    }
    
    interface NutrientDistribution {
      name: string;
      relayNumber: number;
      mlPerLiter: number;
      proporcao: number;
      utNutriente: number;
      tempoDosagem: number;
      relay?: number; // Para compatibilidad
      dosage?: number; // Dosagem em ml
      duration?: number; // Duração em segundos
    }
    
    // Calcular distribuição proporcional para cada nutriente
    const distribution: NutrientDistribution[] = [];
    
    nutrientsState.forEach(nut => {
      if (nut.mlPerLiter > 0 && totalMlPerLiter > 0) {
        // Calcular proporção
        const proporcao = nut.mlPerLiter / totalMlPerLiter;
        
        // Calcular u(t) para este nutriente
        const utNutriente = totalUt * proporcao;
        
        // Calcular tempo de dosagem (segundos)
        const tempoDosagem = utNutriente / pumpFlowRate;
        
        // Agregar à distribuição (formato compatível com Hydro-Controller)
        // Hydro-Controller executeWebDosage() espera APENAS: name, relay, dosage, duration
        distribution.push({
          name: nut.name,
          relayNumber: nut.relayNumber,
          mlPerLiter: nut.mlPerLiter,
          proporcao,
          utNutriente,
          tempoDosagem,
          relay: nut.relayNumber,             // ✅ Número do relé (Hydro-Controller converte para índice: relay - 1)
          dosage: parseFloat(utNutriente.toFixed(2)),  // ✅ Dosagem em ml
          duration: parseFloat(tempoDosagem.toFixed(2)) // ✅ Duração em segundos (Hydro-Controller converte para ms: duration * 1000)
        });
      }
    });
    
    // Retornar estrutura completa (todos os valores com 2 casas decimais)
    return {
      totalUt: parseFloat(totalUt.toFixed(2)),  // ✅ 2 casas decimais
      intervalo: intervaloAutoEC || 5,
      distribution: distribution
    };
  }, [nutrientsState, baseDose, pumpFlowRate, totalVolume, ecError, intervaloAutoEC]);
  
  // ✅ NOVA ARQUITETURA: Salvar configuração do EC Controller em ec_config_view
  // Similar ao padrão relay_slaves/relay_commands_slave
  // Este botão apenas salva na view table, não ativa o Auto EC
  // Para ativar, use o botão "Ativar Auto EC" que chama RPC activate_auto_ec
  const saveECControllerConfig = useCallback(async (silent: boolean = false, overrideAutoEnabled?: boolean) => {
    if (!selectedDeviceId || selectedDeviceId === 'default_device') return;
    
    try {
      // Converter array de nutrientes para formato JSONB
      const nutrientsJson = nutrientsState.map(nut => ({
        name: nut.name,
        relay: nut.relayNumber,
        mlPerLiter: nut.mlPerLiter,
        active: true,
      }));
      
      // Calcular total_ml (soma de todos os mlPerLiter)
      const totalMl = nutrientsState.reduce((sum, nut) => sum + nut.mlPerLiter, 0);
      
      interface ECConfigPayload {
        device_id: string;
        base_dose: number;
        flow_rate: number;
        volume: number;
        total_ml: number;
        kp: number;
        ec_setpoint: number;
        auto_enabled: boolean;
        nutrients: Array<{ name: string; relay: number; mlPerLiter: number }>;
        intervalo_auto_ec?: number;
        tempo_recirculacao?: number;
        [key: string]: unknown;
      }
      
      // ✅ JSON OPTIMIZADO: Solo los 9 parámetros básicos + nutrients[] (sin distribution)
      // Construir payload optimizado com apenas os campos essenciais
      // ✅ CORRIGIDO: Usar overrideAutoEnabled se fornecido, senão usar autoEnabled do estado
      const payload: ECConfigPayload = {
        device_id: selectedDeviceId,
        base_dose: baseDose,
        flow_rate: pumpFlowRate,
        volume: totalVolume,
        total_ml: totalMl,
        kp: 1.0, // ✅ Ganho proporcional (default: 1.0)
        ec_setpoint: ecSetpoint,
        auto_enabled: overrideAutoEnabled !== undefined ? overrideAutoEnabled : autoEnabled,
        nutrients: nutrientsJson, // ✅ Se necesita para que ESP32 sepa qué relé usar
      };
      
      // Adicionar intervalo_auto_ec (requer coluna criada via script SQL)
      if (intervaloAutoEC !== undefined && intervaloAutoEC !== null) {
        payload.intervalo_auto_ec = intervaloAutoEC;
      }
      
      // ✅ ATUALIZADO: Converter tempo_recirculacao de HH:MM para SEGUNDOS (INTEGER)
      // ✅ IMPORTANTE: Enviar em SEGUNDOS, no milisegundos ni formato string
      let tempoRecirculacaoSegundos = 60; // Default: 60 segundos (1 minuto)
      
      if (tempoRecirculacao !== undefined && tempoRecirculacao !== null && tempoRecirculacao.trim() !== '') {
        // Validar formato HH:MM
        if (validateTimeFormat(tempoRecirculacao)) {
          // Converter HH:MM para SEGUNDOS (no milisegundos)
          const ms = timeToMilliseconds(tempoRecirculacao);
          if (ms > 0 && !isNaN(ms) && isFinite(ms)) {
            tempoRecirculacaoSegundos = Math.floor(ms / 1000); // ✅ Convertir a SEGUNDOS
            if (tempoRecirculacaoSegundos < 1) {
              tempoRecirculacaoSegundos = 60; // Mínimo 1 segundo
            }
          } else {
            console.warn('⚠️ [EC Controller] tempo_recirculacao resultou em valor inválido, usando default:', tempoRecirculacao, ms);
          }
        } else {
          console.warn('⚠️ [EC Controller] tempo_recirculacao não passou na validação regex, usando default:', tempoRecirculacao);
        }
      }
      
      // ✅ SEMPRE enviar tempo_recirculacao como INTEGER em SEGUNDOS (constraint requer > 0)
      payload.tempo_recirculacao = tempoRecirculacaoSegundos;
      
      // ❌ ELIMINADO: distribution - Se calcula en tiempo real en el ESP32
      // El ESP32 calcula distribution localmente con valores actuales del sensor
      
      // 🔍 DEBUG: Verificar tipo e valor de tempo_recirculacao
      console.log('🔍 [EC Controller] tempo_recirculacao validado:', {
        original: tempoRecirculacao,
        converted_seconds: tempoRecirculacaoSegundos,
        type: typeof tempoRecirculacaoSegundos,
        isInteger: Number.isInteger(tempoRecirculacaoSegundos),
        isPositive: tempoRecirculacaoSegundos > 0
      });
      
      // 🔍 DEBUG: Log detalhado do que está sendo salvo (JSON optimizado)
      console.log('🔧 [EC Controller] Salvando configuração optimizada no Supabase:', {
        device_id: selectedDeviceId,
        base_dose: baseDose,
        flow_rate: pumpFlowRate,
        volume: totalVolume,
        total_ml: totalMl,
        kp: 1.0,
        ec_setpoint: ecSetpoint,
        auto_enabled: autoEnabled,
        intervalo_auto_ec: intervaloAutoEC,
        tempo_recirculacao: tempoRecirculacaoSegundos,
        nutrients_count: nutrientsJson.length,
        nutrients: nutrientsJson.map(n => ({
          name: n.name,
          relay: n.relay,
          mlPerLiter: n.mlPerLiter,
          mapped_to_master_relay: `Relay ${n.relay} (${availableRelays.find(r => r.number === n.relay)?.name || 'Sem nome'})`
        })),
        note: '✅ JSON optimizado: Sin distribution (se calcula en ESP32), tempo_recirculacao en SEGUNDOS'
      });
      
      console.log('📤 [EC Controller] Payload optimizado:', JSON.stringify(payload, null, 2));
      
      const response = await fetch('/api/ec-controller/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        let errorMessage = 'Erro desconhecido';
        let errorDetails: Record<string, unknown> = {};
        
        try {
          const errorData = await response.json();
          errorDetails = errorData;
          errorMessage = errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
        } catch (e) {
          // Se não conseguir parsear JSON, tentar texto
          try {
            const errorText = await response.text();
            errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
          } catch (e2) {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
        }
        
        console.error('❌ [EC Controller] Erro ao salvar:', {
          status: response.status,
          statusText: response.statusText,
          error: errorDetails,
          payload: payload,
          device_id: selectedDeviceId
        });
        
        toast.error(`Erro ao salvar: ${errorMessage}`);
        return false;
      }
      
      const result = await response.json();
      console.log('✅ [EC Controller] Configuração salva com sucesso em ec_config_view:', result);
      console.log('📤 [EC Controller] Dados salvos na view table (prontos para RPC activate_auto_ec):', {
        table: 'ec_config_view',
        device_id: selectedDeviceId,
        nutrients_available: nutrientsJson.length,
        next_step: 'Pressione "Ativar Auto EC" para enviar ao ESP32 via RPC'
      });
      
      // ✅ SOLUCIÓN DATA RACE: Marcar que acabamos de guardar para prevenir recarga inmediata
      justSavedRef.current = true;
      
      // Limpar timeout anterior si existe
      if (savingTimeoutRef.current) {
        clearTimeout(savingTimeoutRef.current);
      }
      
      // Desactivar flag después de 2 segundos (tiempo suficiente para que el guardado se complete en Supabase)
      savingTimeoutRef.current = setTimeout(() => {
        justSavedRef.current = false;
        console.log('✅ [EC Controller] Flag de guardado desactivado, recargas permitidas nuevamente');
      }, 2000);
      
      // Só mostrar toast se não estiver em modo silencioso
      if (!silent) {
        toast.success('Configuração salva com sucesso!');
      }
      return true;
    } catch (error) {
      console.error('❌ [EC Controller] Erro ao salvar config:', error);
      toast.error(`Erro: ${error instanceof Error ? error.message : 'Desconhecido'}`);
      return false;
    }
  }, [selectedDeviceId, nutrientsState, pumpFlowRate, totalVolume, baseDose, ecSetpoint, intervaloAutoEC, tempoRecirculacao, autoEnabled, availableRelays]);
  
  // ✅ Cleanup: Limpiar timeout al desmontar componente
  useEffect(() => {
    return () => {
      if (savingTimeoutRef.current) {
        clearTimeout(savingTimeoutRef.current);
      }
    };
  }, []);
  
  // ✅ Função para construir JSON optimizado de EC Config (para vista previa)
  const getECConfigJson = useCallback(() => {
    // Converter array de nutrientes para formato JSONB
    const nutrientsJson = nutrientsState.map(nut => ({
      name: nut.name,
      relay: nut.relayNumber,
      mlPerLiter: nut.mlPerLiter,
      active: true,
      relayName: availableRelays.find(r => r.number === nut.relayNumber)?.name || `Relay ${nut.relayNumber}`,
    }));
    
    // Calcular total_ml (soma de todos os mlPerLiter)
    const totalMl = nutrientsState.reduce((sum, nut) => sum + nut.mlPerLiter, 0);
    
    interface ECConfigJSON {
      device_id: string;
      base_dose: number;
      flow_rate: number;
      volume: number;
      total_ml: number;
      kp: number;
      ec_setpoint: number;
      auto_enabled: boolean;
      nutrients: Array<{ name: string; relay: number; mlPerLiter: number }>;
      intervalo_auto_ec?: number;
      tempo_recirculacao?: number;
      _debug?: unknown;
      [key: string]: unknown;
    }
    
    // ✅ JSON OPTIMIZADO: Solo los 9 parámetros básicos + nutrients[] (sin distribution)
    const ecConfigJson: ECConfigJSON = {
      device_id: selectedDeviceId,
      base_dose: baseDose,
      flow_rate: pumpFlowRate,
      volume: totalVolume,
      total_ml: totalMl,
      kp: 1.0, // ✅ Ganho proporcional (default: 1.0)
      ec_setpoint: ecSetpoint,
      auto_enabled: autoEnabled,
      nutrients: nutrientsJson,
    };
    
    // Adicionar intervalo_auto_ec
    if (intervaloAutoEC !== undefined && intervaloAutoEC !== null) {
      ecConfigJson.intervalo_auto_ec = intervaloAutoEC;
    }
    
    // ✅ ATUALIZADO: tempo_recirculacao en SEGUNDOS (INTEGER)
    if (tempoRecirculacao !== undefined && tempoRecirculacao !== null && tempoRecirculacao.trim() !== '') {
      if (validateTimeFormat(tempoRecirculacao)) {
        const ms = timeToMilliseconds(tempoRecirculacao);
        ecConfigJson.tempo_recirculacao = Math.floor(ms / 1000); // ✅ SEGUNDOS
      } else {
        ecConfigJson.tempo_recirculacao = 60; // Default: 60 segundos
      }
    } else {
      ecConfigJson.tempo_recirculacao = 60; // Default: 60 segundos
    }
    
    // ❌ ELIMINADO: distribution - Se calcula en tiempo real en el ESP32
    // ❌ ELIMINADO: tempo_recirculacao_ms - Redundante
    
    // Informações calculadas adicionais para debug
    ecConfigJson._debug = {
      total_volume_liters: totalVolume,
      pump_flow_rate_ml_per_sec: pumpFlowRate,
      base_dose_us_per_cm: baseDose,
      total_ml_per_liter: totalMl,
      nutrients_count: nutrientsJson.length,
      k_factor: totalMl > 0 ? (baseDose / totalMl).toFixed(3) : '0.000',
      equation: `u(t) = (${totalVolume} / ${(baseDose / totalMl).toFixed(3)} × ${pumpFlowRate}) × e`,
      note: '✅ JSON optimizado: Sin distribution (se calcula en ESP32), tempo_recirculacao en SEGUNDOS',
    };
    
    return ecConfigJson;
  }, [selectedDeviceId, nutrientsState, pumpFlowRate, totalVolume, baseDose, ecSetpoint, intervaloAutoEC, tempoRecirculacao, autoEnabled, availableRelays]);
  
  // ✅ NOVO: Salvar mapeamento nutriente → relé
  const handleRelayChange = useCallback(async (nutrientIndex: number, newRelayNumber: number) => {
    const updatedNutrients = [...nutrientsState];
    updatedNutrients[nutrientIndex] = {
      ...updatedNutrients[nutrientIndex],
      relayNumber: newRelayNumber,
    };
    setNutrientsState(updatedNutrients);
    
    // Salvar nome do nutriente no relé escolhido
    if (selectedDeviceId && selectedDeviceId !== 'default_device') {
      const nutrient = updatedNutrients[nutrientIndex];
      await saveMasterLocalRelayName(selectedDeviceId, newRelayNumber, nutrient.name);
      
      // Atualizar nomes locais
      await loadLocalRelayNames();
      
      // Salvar automaticamente no Supabase
      await saveECControllerConfig();
    }
  }, [selectedDeviceId, nutrientsState, loadLocalRelayNames, saveECControllerConfig]);
  
  // ✅ NOVO: Função para obter EC atual desde Supabase (hydro_measurements)
  const fetchCurrentEC = useCallback(async () => {
    if (!selectedDeviceId || selectedDeviceId === 'default_device') {
      setEcAtual(0);
      return;
    }
    
    try {
      // Usar diretamente a tabela hydro_measurements (vista hydromensures não existe)
      const { data, error } = await supabase
        .from('hydro_measurements')
        .select('tds, device_id, created_at')
        .eq('device_id', selectedDeviceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(); // Usar maybeSingle() em vez de single() para evitar erro se não houver dados
      
      if (error) {
        console.warn('⚠️ [EC Controller] Erro ao buscar TDS:', error);
        // Não resetar para 0 em caso de erro, manter último valor válido
        return;
      }
      
      if (data && data.tds !== null && data.tds !== undefined) {
        // Converter TDS (ppm) para EC (µS/cm)
        // ✅ Fator de conversão correto: EC = TDS * 2
        const ecValue = data.tds * 2;
        setEcAtual(ecValue);
        
        console.log('✅ [EC Controller] EC atualizado:', {
          tds: data.tds,
          ec: ecValue.toFixed(1),
          setpoint: ecSetpoint,
          error: (ecValue - ecSetpoint).toFixed(1)
        });
      } else {
        console.warn('⚠️ [EC Controller] Nenhum dado TDS encontrado para device:', selectedDeviceId);
        // Não resetar para 0, manter último valor válido
      }
      // ✅ O erro será recalculado automaticamente pelo useEffect quando ecAtual mudar
    } catch (err) {
      console.error('❌ [EC Controller] Erro ao buscar EC atual:', err);
      // Não resetar para 0 em caso de erro, manter último valor válido
    }
  }, [selectedDeviceId, ecSetpoint]);
  
  // ✅ SEMPRE recalcular o erro quando ecAtual ou ecSetpoint mudarem
  // Isso garante que o erro seja atualizado mesmo quando não há novos dados do sensor
  useEffect(() => {
    const error = ecAtual - ecSetpoint;
    setEcError(error);
    console.log('📊 [EC Controller] Erro recalculado:', {
      ecAtual: ecAtual.toFixed(1),
      ecSetpoint: ecSetpoint.toFixed(1),
      error: error.toFixed(1)
    });
  }, [ecAtual, ecSetpoint]);

  // Carregar regras do Supabase quando selectedDeviceId mudar
  useEffect(() => {
    if (selectedDeviceId && selectedDeviceId !== 'default_device') {
      loadRules();
      loadESPNOWSlaves();
      loadLocalRelayNames(); // ✅ NOVO: Carregar nomes de relés locais
      loadECControllerConfig(); // ✅ NOVO: Carregar config EC Controller
    }
    // ✅ SOLUCIÓN DATA RACE: Remover funciones de las dependencias
    // Solo debe ejecutarse cuando cambia selectedDeviceId o userProfile?.email
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeviceId, userProfile?.email]);
  
  // ✅ NOVO: Atualizar EC atual periodicamente (a cada 10 segundos)
  useEffect(() => {
    if (!selectedDeviceId || selectedDeviceId === 'default_device') return;
    
    // Carregar imediatamente
    fetchCurrentEC();
    
    // Atualizar a cada 10 segundos
    const interval = setInterval(() => {
      fetchCurrentEC();
    }, 10000); // 10 segundos
    
    return () => clearInterval(interval);
  }, [selectedDeviceId, fetchCurrentEC]);

  // ✅ Auto-expandir seção e slave quando há apenas 1 slave
  useEffect(() => {
    if (espnowSlaves.length === 1 && !expandedSlaveRelayManager) {
      setExpandedSlaveRelayManager(true);
      setExpandedSlaves(new Set([espnowSlaves[0].macAddress]));
    }
  }, [espnowSlaves, expandedSlaveRelayManager]);

  // ✅ OTIMIZADO: Função para atualizar apenas os estados dos relés (sem recarregar tudo)
  // Busca apenas relay_states do Supabase (muito mais leve que getESPNOWSlaves)
  const updateRelayStatesOnly = useCallback(async () => {
    if (!selectedDeviceId || selectedDeviceId === 'default_device' || espnowSlaves.length === 0) {
      return;
    }
    
    try {
      // ✅ OTIMIZADO: Buscar apenas estados dos relés usando relay_slaves
      // Usar device_ids dos slaves já carregados
      const deviceIds = espnowSlaves.map(s => s.device_id).filter(Boolean) as string[];
      if (deviceIds.length === 0) return;
      
      // ✅ Buscar estados usando relay_slaves (não relay_states)
      const { getSlaveRelayStates } = await import('@/lib/relay-slaves-api');
      const relayStatesMap = await getSlaveRelayStates(selectedDeviceId, deviceIds);
      
      interface RelayState {
        device_id: string;
        relay_number: number;
        state: boolean;
        has_timer: boolean;
        remaining_time: number;
      }
      
      // Converter Map para array
      const relayStatesArray: RelayState[] = [];
      relayStatesMap.forEach((states) => {
        relayStatesArray.push(...states);
      });
      
      // ✅ Criar mapa device_id -> relay_number -> {state, has_timer, remaining_time}
      const deviceRelayStatesMap = new Map<string, Map<number, { state: boolean; has_timer: boolean; remaining_time: number }>>();
      relayStatesArray.forEach(rs => {
        if (!deviceRelayStatesMap.has(rs.device_id)) {
          deviceRelayStatesMap.set(rs.device_id, new Map());
        }
        deviceRelayStatesMap.get(rs.device_id)!.set(rs.relay_number, {
          state: rs.state,
          has_timer: rs.has_timer || false,
          remaining_time: rs.remaining_time || 0,
        });
      });
      
      // Sincronizar estados reais dos relés do Supabase com estados locais
      const newRelayStates = new Map<string, boolean>();
      // ✅ Atualizar espnowSlaves com has_timer e remaining_time
      const updatedSlaves = espnowSlaves.map(slave => {
        if (!slave.device_id) return slave;
        
        const slaveRelayStates = deviceRelayStatesMap.get(slave.device_id);
        
        const updatedRelays = slave.relays.map(relay => {
          const relayData = slaveRelayStates?.get(relay.id);
          
          if (relayData) {
            return {
              ...relay,
              state: relayData.state,
              has_timer: relayData.has_timer,
              remaining_time: relayData.remaining_time,
            };
          }
          return relay;
        });
        
        return {
          ...slave,
          relays: updatedRelays,
        };
      });
      
      // ✅ VITAL: Usar updatedSlaves (dados atualizados) em vez de espnowSlaves para evitar loop infinito
      // Processar estados ANTES de atualizar espnowSlaves para evitar dependência circular
      updatedSlaves.forEach(slave => {
        if (!slave.device_id) return;
        
        const slaveRelayStates = deviceRelayStatesMap.get(slave.device_id);
        
        slave.relays.forEach(relay => {
          const relayKey = `${slave.macAddress}-${relay.id}`;
          // Buscar estado real do Supabase
          const realState = slaveRelayStates?.get(relay.id)?.state;
          
          if (realState !== undefined) {
            newRelayStates.set(relayKey, realState);
          }
        });
      });
      
      // Atualizar estados apenas se houver mudanças
      setRelayStates(prev => {
        let hasChanges = false;
        newRelayStates.forEach((newState, key) => {
          if (prev.get(key) !== newState) {
            hasChanges = true;
          }
        });
        
        return hasChanges ? newRelayStates : prev;
      });
      
      // ✅ Atualizar estado dos slaves com timer info DEPOIS de processar estados (evita loop)
      setEspnowSlaves(updatedSlaves);
    } catch (error) {
      console.error('Erro ao atualizar estados dos relés:', error);
    }
  }, [selectedDeviceId]); // ✅ CORRIGIDO: Removido espnowSlaves das dependências para evitar loop infinito

  // ✅ Atualizar estados dos slaves periodicamente (a cada 30 segundos)
  useEffect(() => {
    if (!selectedDeviceId || selectedDeviceId === 'default_device') return;
    
    const interval = setInterval(() => {
      loadESPNOWSlaves();
    }, 30000); // A cada 30 segundos
    
    return () => clearInterval(interval);
  }, [selectedDeviceId, userProfile?.email]);

  // ✅ NOVO: Verificar ACKs de comandos pendentes (padrão indústria)
  useEffect(() => {
    if (!selectedDeviceId || selectedDeviceId === 'default_device') return;
    if (commandToRelayMap.current.size === 0) return; // Só verificar se há comandos pendentes
    
    const interval = setInterval(async () => {
      try {
        // Buscar ACKs dos comandos pendentes
        const response = await fetch(
          `/api/esp-now/command-acks?master_device_id=${selectedDeviceId}&limit=100`
        );
        
        if (response.ok) {
          const result = await response.json();
          const acks = result.acks || [];
          
          interface CommandAck {
            command_id: number | string;
            status: string;
            action: 'on' | 'off';
            relay_number?: number;
          }
          
          // Atualizar estados baseado em ACKs
          acks.forEach((ack: CommandAck) => {
            const commandIdKey = ack.command_id;
            const relayKey = commandToRelayMap.current.get(commandIdKey);
            if (relayKey && ack.status === 'completed') {
              // Comando foi completado, atualizar estado
              setRelayStates(prev => {
                const newMap = new Map(prev);
                newMap.set(relayKey, ack.action === 'on');
                return newMap;
              });
              
              // Remover do mapa após processar
              commandToRelayMap.current.delete(commandIdKey);
            } else if (relayKey && ack.status === 'failed') {
              // Comando falhou, manter estado anterior ou desligar
              const relayNum = ack.relay_number !== undefined ? String(ack.relay_number) : 'desconhecido';
              toast.error(`Comando falhou para relé ${relayNum}`);
              commandToRelayMap.current.delete(commandIdKey);
            }
          });
        }
      } catch (error) {
        console.error('Erro ao verificar ACKs:', error);
      }
    }, 5000); // Verificar ACKs a cada 5 segundos
    
    return () => clearInterval(interval);
  }, [selectedDeviceId]);

  // ✅ NOVO: Polling periódico para sincronizar estados dos relés do Supabase
  useEffect(() => {
    if (!selectedDeviceId || selectedDeviceId === 'default_device') return;
    
    // Atualizar estados imediatamente ao montar
    updateRelayStatesOnly();
    
    // Polling a cada 10 segundos para sincronizar estados reais do Supabase
    const interval = setInterval(() => {
      updateRelayStatesOnly();
    }, 10000); // 10 segundos
    
    return () => clearInterval(interval);
  }, [selectedDeviceId, updateRelayStatesOnly]);

  const loadMasters = async () => {
    if (!userProfile?.email) return;
    
    try {
      const userDevices = await getUserDevices(userProfile.email);
      // ✅ Filtrar apenas Masters (device_type exato: "ESP32_HYDROPONIC")
      const masters = userDevices.filter(d => {
        const deviceType = d.device_type?.toLowerCase() || '';
        return (
          deviceType === 'esp32_hydroponic' ||
          deviceType.includes('hydroponic') ||
          deviceType.includes('master')
        );
      });
      
      console.log(`✅ Masters encontrados: ${masters.length}`, masters.map(m => ({ 
        device_id: m.device_id, 
        device_type: m.device_type,
        device_name: m.device_name 
      })));
      
      setAvailableMasters(masters);
      
      // Se houver Masters e selectedDeviceId ainda for 'default_device', selecionar o primeiro
      if (masters.length > 0 && selectedDeviceId === 'default_device') {
        setSelectedDeviceId(masters[0].device_id || 'default_device');
      }
    } catch (error) {
      console.error('Erro ao carregar Masters:', error);
      toast.error('Erro ao carregar dispositivos Master');
    }
  };

  const loadRules = async () => {
    setLoading(true);
    try {
      const decisionRules = await getDecisionRules(selectedDeviceId);
      
      // Converter DecisionRule para AutomationRule
      const convertedRules: AutomationRule[] = decisionRules.map((rule) => {
        // ✅ Preservar rule_json completo para scripts sequenciais
        const ruleJson = rule.rule_json as RuleJson; // Type assertion para acessar script
        const hasScript = ruleJson?.script?.instructions;
        const hasConditions = ruleJson?.conditions && Array.isArray(ruleJson.conditions) && ruleJson.conditions.length > 0;
        const hasActions = ruleJson?.actions && Array.isArray(ruleJson.actions) && ruleJson.actions.length > 0;
        
        return {
          id: rule.id || rule.rule_id || Date.now(), // ✅ Usar UUID se disponível, senão rule_id ou timestamp
          name: rule.rule_name,
          description: rule.rule_description || '',
          condition: hasConditions 
            ? (ruleJson.conditions || []).map((c: RuleCondition) => 
                `${c.sensor} ${c.operator} ${c.value}`
              ).join(' e ')
            : hasScript ? 'Sequential Script' : '',
          action: hasActions
            ? (ruleJson.actions || []).map((a: RuleAction) => 
                `${(a.relay_names && a.relay_names.length > 0 ? a.relay_names : ['Relé']).join(', ')} por ${a.duration || 0}s`
              ).join(', ')
            : hasScript ? `${(ruleJson.script?.instructions || []).length} instrução(ões)` : '',
          enabled: rule.enabled,
          conditions: hasConditions ? ruleJson.conditions : [],
          actions: hasActions ? ruleJson.actions : [],
          // ✅ Preservar campos originais para scripts e UUID do Supabase
          rule_json: ruleJson,
          rule_name: rule.rule_name,
          rule_description: rule.rule_description,
          priority: rule.priority,
          supabase_id: rule.id, // ✅ UUID real do Supabase (para updates/deletes)
          rule_id: rule.rule_id, // ✅ rule_id text do Supabase
        };
      });

      setRules(convertedRules);
    } catch (error) {
      console.error('Error loading rules:', error);
      toast.error('Erro ao carregar regras');
    } finally {
      setLoading(false);
    }
  };

  const loadESPNOWSlaves = async () => {
    if (!selectedDeviceId || !userProfile?.email) {
      console.warn('⚠️ Não é possível carregar slaves: selectedDeviceId ou userProfile.email ausente');
      return;
    }
    
    console.log('🔍 Carregando slaves ESP-NOW...', {
      masterDeviceId: selectedDeviceId,
      userEmail: userProfile.email
    });
    
    setLoadingSlaves(true);
    try {
      const slaves = await getESPNOWSlaves(selectedDeviceId, userProfile.email);
      console.log(`✅ ${slaves.length} slave(s) encontrado(s):`, slaves.map(s => ({
        name: s.name,
        mac: s.macAddress,
        status: s.status,
        relays: s.relays.length
      })));
      setEspnowSlaves(slaves);
      
      // ✅ NOVO: Inicializar nombres temporales de relés
      const newTempRelayNames = new Map<string, string>();
      slaves.forEach(slave => {
        slave.relays.forEach(relay => {
          const relayKey = `${slave.macAddress}-${relay.id}`;
          newTempRelayNames.set(relayKey, relay.name || `Relé ${relay.id + 1}`);
        });
      });
      setTempRelayNames(newTempRelayNames);
      
      // ✅ NOVO: Sincronizar estados reais dos relés com estados locais
      const newRelayStates = new Map<string, boolean>();
      slaves.forEach(slave => {
        slave.relays.forEach(relay => {
          const relayKey = `${slave.macAddress}-${relay.id}`;
          // Usar estado real do Master se disponível
          const realState = relay.state;
          if (realState !== undefined) {
            newRelayStates.set(relayKey, realState);
          }
        });
      });
      setRelayStates(newRelayStates);
      
      if (slaves.length === 0) {
        console.warn('⚠️ Nenhum slave encontrado. Verifique:');
        console.warn('  1. Master está online e acessível?');
        console.warn('  2. Slaves estão registrados no Supabase?');
        console.warn('  3. Slaves têm user_email correto?');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar slaves ESP-NOW:', error);
      toast.error('Erro ao carregar dispositivos ESP-NOW');
    } finally {
      setLoadingSlaves(false);
    }
  };

  // ✅ Función mejorada para guardar nombres de relés (igual a DeviceControlPanel)
  const handleSaveRelayName = async (
    slaveMac: string,
    relayId: number,
    newName: string
  ) => {
    const key = `${slaveMac}-${relayId}`;
    
    if (!newName || newName.trim().length === 0) {
      toast.error('Nome não pode estar vazio');
      return;
    }

    setSavingRelayNames(prev => new Set(prev).add(key));

    // Buscar slave para obter nome e device_id
    const slave = espnowSlaves.find(s => s.macAddress === slaveMac);
    const slaveName = slave?.name || '';
    const slaveDeviceId = slave?.device_id;

    try {
      const response = await fetch('/api/esp-now/slave-relay-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          master_device_id: selectedDeviceId,
          slave_mac_address: slaveMac,
          slave_name: slaveName,
          relay_id: relayId,
          relay_name: newName.trim(),
          device_id: slaveDeviceId,
        }),
      });

      if (response.ok) {
        // Atualizar estado local após salvar com sucesso
        setEspnowSlaves(prev => prev.map(s => {
          if (s.macAddress === slaveMac) {
            return {
              ...s,
              relays: s.relays.map(relay =>
                relay.id === relayId ? { ...relay, name: newName.trim() } : relay
              ),
            };
          }
          return s;
        }));
        
        // Remover do estado temporário
        setTempRelayNames(prev => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
        
        toast.success(`Nome do relé salvo: "${newName.trim()}"`);
        console.log(`✅ Nome do relé ${relayId} do slave ${slaveMac} salvo: "${newName.trim()}"`);
        
        // Recarregar regras para refletir novos nomes
        await loadRules();
      } else {
        const error = await response.json();
        console.error('❌ Erro ao salvar nome do relé:', error);
        toast.error(`Erro ao salvar: ${error.error || 'Erro desconhecido'}`);
        // Reverter mudança local em caso de erro
        await loadESPNOWSlaves();
      }
    } catch (error) {
      console.error('❌ Erro ao salvar nome do relé:', error);
      toast.error('Erro ao salvar nome do relé');
      // Reverter mudança local em caso de erro
      await loadESPNOWSlaves();
    } finally {
      setSavingRelayNames(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  // ✅ Mantener función antigua para compatibilidad (deprecated)
  const handleUpdateSlaveRelayName = handleSaveRelayName;

  const toggleSlave = (macAddress: string) => {
    setExpandedSlaves(prev => {
      const newSet = new Set(prev);
      if (newSet.has(macAddress)) {
        newSet.delete(macAddress);
      } else {
        newSet.add(macAddress);
      }
      return newSet;
    });
  };

  const toggleRule = (id: number | string) => {
    setRules(rules.map(rule => 
      rule.id === id ? { ...rule, enabled: !rule.enabled } : rule
    ));
  };

  interface NewRuleData {
    name?: string;
    description?: string;
    enabled?: boolean;
    priority?: number;
    conditions?: RuleCondition[];
    actions?: Array<{
      relayIds?: number[];
      relayId?: number;
      relayNames?: string[];
      relayName?: string;
      duration?: number;
      target_device_id?: string;
      slave_mac_address?: string;
    }>;
    script?: {
      instructions: ScriptInstruction[] | unknown[];
      max_iterations?: number;
      chained_events?: unknown;
      cooldown?: number;
      max_executions_per_hour?: number;
    };
    chainedEvents?: unknown[];
    cooldown?: number;
    maxExecutionsPerHour?: number;
    circadian_cycle?: {
      enabled: boolean;
      on_duration_ms: number;
      off_duration_ms: number;
      total_cycle_ms: number;
      start_time?: string;
      timezone?: string;
    };
    [key: string]: unknown;
  }
  
  const handleSaveRule = async (newRule: NewRuleData) => {
    try {
      // ✅ Usar rule_id existente se estiver editando, senão criar novo
      // ✅ Garantir que rule_id tenha pelo menos 3 caracteres (requisito do Supabase)
      const baseRuleId = editingRule?.rule_id || editingRule?.id || `RULE_${Date.now()}`;
      const ruleId = typeof baseRuleId === 'string' && baseRuleId.length >= 3 
        ? baseRuleId 
        : `RULE_${Date.now()}`;
      
      // ✅ Se tiver script (instruções sequenciais), usar formato de SequentialScriptEditor
      let ruleJson: RuleJson;
      
      if (newRule.script && newRule.script.instructions && newRule.script.instructions.length > 0) {
        // ✅ Formato de Sequential Script (Nova Função)
        ruleJson = {
          script: {
            instructions: newRule.script.instructions as ScriptInstruction[],
            max_iterations: newRule.script.max_iterations || 0,
            chained_events: newRule.script.chained_events || (newRule.chainedEvents && newRule.chainedEvents.length > 0 ? newRule.chainedEvents : undefined),
            cooldown: newRule.script.cooldown || newRule.cooldown || 60,
            max_executions_per_hour: newRule.script.max_executions_per_hour || newRule.maxExecutionsPerHour || 10,
          },
        };
      } else {
        // ✅ Formato tradicional (Nova Regra)
        ruleJson = {
          conditions: newRule.conditions || [],
          actions: (newRule.actions && Array.isArray(newRule.actions) && newRule.actions.length > 0)
            ? newRule.actions.map((a) => ({
                relay_ids: (a.relayIds || (a.relayId !== undefined ? [a.relayId] : [])).filter((id): id is number => id !== undefined && typeof id === 'number'),
                relay_names: (a.relayNames || (a.relayName ? [a.relayName] : [])).filter((name): name is string => name !== undefined && typeof name === 'string'),
                duration: a.duration || 0,
                target_device_id: a.target_device_id || undefined,
                slave_mac_address: a.slave_mac_address || undefined,
              }))
            : [],
          ...(newRule.circadian_cycle ? {
            circadian_cycle: {
              ...newRule.circadian_cycle,
              timezone: userTimezone,  // ✅ Usar timezone do usuário
            }
          } : {}),
          delay_before_execution: 0,
          interval_between_executions: 5,
          priority: (typeof newRule.priority === 'number' ? newRule.priority : 50), // ✅ Usar priority da regra
        };
      }
      
      // ✅ Validar que rule_json não está vazio
      if (!ruleJson || (Object.keys(ruleJson).length === 0 && !ruleJson.script)) {
        toast.error('Erro: rule_json não pode estar vazio. Adicione condições/ações ou instruções sequenciais.');
        console.error('❌ [VALIDATION ERROR] rule_json vazio:', ruleJson);
        return;
      }
      
      // ✅ Validar campos obrigatórios antes de criar
      if (!selectedDeviceId || selectedDeviceId === 'default_device') {
        toast.error('Erro: Selecione um dispositivo antes de criar a regra.');
        console.error('❌ [VALIDATION ERROR] device_id inválido:', selectedDeviceId);
        return;
      }
      
      const ruleName = typeof newRule.name === 'string' ? newRule.name.trim() : '';
      if (!ruleName || ruleName.length === 0) {
        toast.error('Erro: Nome da regra é obrigatório.');
        console.error('❌ [VALIDATION ERROR] rule_name vazio');
        return;
      }

      const ruleDescription = typeof newRule.description === 'string' ? newRule.description.trim() : '';
      const rulePriority = typeof newRule.priority === 'number' ? Math.max(0, Math.min(100, newRule.priority)) : 50;
      const ruleEnabled = typeof newRule.enabled === 'boolean' ? newRule.enabled : true;
      
      // ✅ Asegurar que ruleJson tenga la estructura correcta para DecisionRule
      const validatedRuleJson: DecisionRule['rule_json'] = {
        conditions: ruleJson.conditions || [],
        actions: (ruleJson.actions || []).map(action => {
          const relayIds = action.relay_ids ?? [];
          const relayNames = action.relay_names ?? [];
          return {
            relay_ids: Array.isArray(relayIds) ? relayIds : [],
            relay_names: Array.isArray(relayNames) ? relayNames : [],
            duration: action.duration ?? 0,
            target_device_id: action.target_device_id,
            slave_mac_address: action.slave_mac_address,
          };
        }),
        ...(ruleJson.script ? { script: ruleJson.script } : {}),
        ...(ruleJson.circadian_cycle ? { circadian_cycle: ruleJson.circadian_cycle } : {}),
        delay_before_execution: ruleJson.delay_before_execution,
        interval_between_executions: ruleJson.interval_between_executions,
        priority: ruleJson.priority,
      };

      const decisionRule: DecisionRule = {
        device_id: selectedDeviceId,
        rule_id: ruleId,
        rule_name: ruleName,
        rule_description: ruleDescription || undefined,
        rule_json: validatedRuleJson,
        enabled: ruleEnabled,
        priority: rulePriority,
        created_by: userProfile?.email || 'system',
      };

      // ✅ Console log para verificar empaquetado (igual que SequentialScriptEditor)
      console.log('📦 [DECISION RULE] Empaquetando regra para Supabase:', {
        device_id: decisionRule.device_id,
        rule_id: decisionRule.rule_id,
        rule_name: decisionRule.rule_name,
        enabled: decisionRule.enabled,
        priority: decisionRule.priority,
        created_by: decisionRule.created_by,
        rule_json: JSON.stringify(ruleJson, null, 2),
      });

      // ✅ Se estiver editando, usar updateDecisionRule, senão createDecisionRule
      let result;
      if (editingRule) {
        // ✅ Atualizar regra existente - usar supabase_id (UUID) se disponível
        const ruleIdToUpdate = editingRule.supabase_id || editingRule.id;
        if (!ruleIdToUpdate || typeof ruleIdToUpdate === 'number') {
          toast.error('Erro: ID da regra inválido para atualização. UUID não encontrado.');
          console.error('❌ [UPDATE ERROR] editingRule:', editingRule);
          return;
        }
        result = await updateDecisionRule(ruleIdToUpdate.toString(), decisionRule);
        if (result) {
          console.log('✅ [DECISION RULE] Regra atualizada no Supabase:', {
            id: editingRule.id,
            rule_id: decisionRule.rule_id,
            rule_name: decisionRule.rule_name,
            has_script: !!(ruleJson.script),
          });
          toast.success('Regra atualizada e salva no banco de dados!');
        } else {
          toast.error('Erro ao atualizar regra no banco de dados');
        }
      } else {
        // ✅ Criar nova regra
        try {
          result = await createDecisionRule(decisionRule);
          if (result) {
            console.log('✅ [DECISION RULE] Regra criada no Supabase:', {
              rule_id: decisionRule.rule_id,
              rule_name: decisionRule.rule_name,
              has_script: !!(ruleJson.script),
            });
            toast.success('Regra criada e salva no banco de dados!');
          } else {
            toast.error('Erro ao salvar regra no banco de dados. Verifique o console para mais detalhes.');
          }
        } catch (error) {
          console.error('❌ [CREATE ERROR] Exceção capturada:', error);
          toast.error(error instanceof Error ? error.message : 'Erro ao criar regra. Verifique o console para mais detalhes.');
          return;
        }
      }
      
      if (result) {
        await loadRules(); // Recarregar regras
        setEditingRule(null); // ✅ Resetar regra de edição após salvar
      }
    } catch (error) {
      console.error('Error saving rule:', error);
      toast.error('Erro ao salvar regra');
    }
  };

  const handleUpdateRelay = (id: number, name: string) => {
    setRelays(relays.map(relay => 
      relay.id === id ? { ...relay, name } : relay
    ));
    toast.success(`Relé ${id} renomeado para "${name}"`);
  };

  const handleEditRule = (rule: AutomationRule) => {
    // ✅ Abrir modal de edição com dados da regra
    setEditingRule(rule);
    setIsModalOpen(true);
  };

  // ✅ Função para validar contraseña de administrador
  // ✅ Usada para bloquear/desbloquear: EC Controller, Slave Relay Manager, Decision Engine
  // ✅ Todos os 3 toasts de bloqueio usam a mesma senha: "admin"
  const validateAdminPassword = (password: string): boolean => {
    const adminPassword = 'admin';  // ✅ Contraseña única para todos os bloqueios
    return password === adminPassword;
  };

  // ✅ Função helper para mostrar toast de bloqueio/desbloqueio (reutilizável)
  const showLockUnlockToast = (
    isLocked: boolean,
    sectionName: string,
    onConfirm: () => void
  ) => {
    let passwordInputRef: HTMLInputElement | null = null;
    
    toast.custom((t) => {
      const handleConfirm = () => {
        const password = passwordInputRef?.value || '';
        
        if (password && validateAdminPassword(password)) {
          onConfirm();
          toast.dismiss(t.id);
          toast.success(isLocked ? `✅ ${sectionName} desbloqueado` : `🔒 ${sectionName} bloqueado`);
        } else {
          toast.error('Senha incorreta!', { id: 'password-error' });
          if (passwordInputRef) {
            passwordInputRef.value = '';
            passwordInputRef.focus();
          }
        }
      };
      
      return (
        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-dark-card border border-dark-border shadow-lg rounded-lg pointer-events-auto flex flex-col p-4`}>
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <LockClosedIcon className="h-6 w-6 text-yellow-400" />
            </div>
            <div className="ml-3 w-full">
              <h3 className="text-sm font-medium text-dark-text mb-2">
                🔒 {isLocked ? 'Desbloquear' : 'Bloquear'} {sectionName}
              </h3>
              <p className="text-xs text-dark-textSecondary mb-3">
                Esta ação requer senha de administrador para proteger a configuração.
              </p>
              <input
                ref={(el) => { 
                  passwordInputRef = el;
                  if (el) {
                    setTimeout(() => el.focus(), 100);
                  }
                }}
                type="password"
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text focus:border-aqua-500 focus:outline-none mb-3"
                placeholder="Digite a senha de administrador"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirm();
                  }
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleConfirm}
                  className="flex-1 px-3 py-2 bg-aqua-500 hover:bg-aqua-600 text-white rounded-md text-sm font-medium transition-colors"
                >
                  Confirmar
                </button>
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="flex-1 px-3 py-2 bg-dark-surface hover:bg-dark-border border border-dark-border text-dark-text rounded-md text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }, {
      duration: Infinity,
    });
  };

  // ✅ Componente de confirmación con contraseña (usando React state)
  const DeleteConfirmationToast = ({ 
    t, 
    ruleName, 
    onConfirm, 
    onCancel 
  }: { 
    t: Toast; 
    ruleName: string; 
    onConfirm: (password: string) => void; 
    onCancel: () => void;
  }) => {
    const [password, setPassword] = React.useState('');
    
    const handleConfirm = () => {
      if (password && validateAdminPassword(password)) {
        onConfirm(password);
      } else {
        toast.error('Senha incorreta!', { id: 'password-error' });
      }
    };

    return (
      <div
        className={`${
          t.visible ? 'animate-enter' : 'animate-leave'
        } max-w-md w-full bg-dark-card border-2 border-red-500/40 shadow-lg rounded-lg pointer-events-auto flex flex-col`}
      >
        <div className="p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <TrashIcon className="w-6 h-6 text-red-400" />
              </div>
            </div>
            <div className="ml-3 w-0 flex-1">
              <h3 className="text-sm font-semibold text-red-400 mb-1">
                ⚠️ Confirmar Exclusão
              </h3>
              <p className="text-sm text-dark-text mb-3">
                Tem certeza que deseja excluir a regra <span className="font-semibold text-aqua-400">&quot;{ruleName}&quot;</span>?
              </p>
              <p className="text-xs text-yellow-400 mb-3">
                🔒 Esta ação requer senha de administrador
              </p>
              
              {/* Input de senha */}
              <input
                type="password"
                autoFocus
                placeholder="Digite a senha de administrador"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && password) {
                    handleConfirm();
                  } else if (e.key === 'Escape') {
                    onCancel();
                  }
                }}
                className="w-full px-3 py-2 mb-3 bg-dark-surface border border-dark-border rounded text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
              
              {/* Botões */}
              <div className="flex gap-2">
                <button
                  onClick={handleConfirm}
                  className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded transition-colors"
                >
                  Confirmar
                </button>
                <button
                  onClick={onCancel}
                  className="flex-1 px-3 py-2 bg-dark-surface hover:bg-dark-border text-dark-text text-sm font-medium rounded border border-dark-border transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
            <div className="ml-4 flex-shrink-0 flex">
              <button
                onClick={onCancel}
                className="inline-flex text-dark-textSecondary hover:text-dark-text"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ✅ Función para mostrar toast de confirmación con contraseña
  const showDeleteConfirmation = (id: number | string, ruleName: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const toastId = toast.custom(
        (t) => (
          <DeleteConfirmationToast
            t={t}
            ruleName={ruleName}
            onConfirm={(password) => {
              toast.dismiss(t.id);
              resolve(true);
            }}
            onCancel={() => {
              toast.dismiss(t.id);
              resolve(false);
            }}
          />
        ),
        {
          duration: Infinity, // Toast permanece até ser fechado
          position: 'top-center',
        }
      );
    });
  };

  const handleDeleteRule = async (id: number | string) => {
    try {
      // Encontrar a regra e obter o ID do Supabase (UUID)
      const rule = rules.find(r => r.id === id || r.supabase_id === id);
      if (!rule) {
        toast.error('Regra não encontrada');
        return;
      }

      // ✅ Mostrar toast de confirmación con contraseña
      const ruleName = rule.rule_name || rule.name || 'Regra sem nome';
      const confirmed = await showDeleteConfirmation(id, ruleName);
      
      if (!confirmed) {
        return; // Usuario cancelou ou senha incorreta
      }

      // ✅ Usar supabase_id (UUID) se disponível, senão tentar id
      const ruleIdToDelete = rule.supabase_id || rule.id;
      if (!ruleIdToDelete) {
        toast.error('Erro: ID da regra não encontrado para exclusão');
        return;
      }

      // ✅ Verificar se é UUID válido (string) ou número
      if (typeof ruleIdToDelete === 'number') {
        toast.error('Erro: ID da regra inválido. UUID não encontrado.');
        console.error('❌ [DELETE ERROR] rule:', rule);
        return;
      }

      const result = await deleteDecisionRule(ruleIdToDelete.toString());
      if (result) {
        await loadRules(); // Recarregar regras do Supabase
        toast.success('Regra excluída com sucesso!');
      } else {
        toast.error('Erro ao excluir regra no banco de dados');
      }
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast.error('Erro ao excluir regra');
    }
  };

  const activeRules = rules.filter(r => r.enabled).length;
  const inactiveRules = rules.filter(r => !r.enabled).length;
  
  // ✅ Regra vigente (maior prioridade entre as ativas)
  const activeRulesList = rules.filter(r => r.enabled);
  const currentActiveRule = activeRulesList.length > 0 
    ? activeRulesList.sort((a, b) => (b.priority || 50) - (a.priority || 50))[0]
    : null;
  
  // ✅ Status do motor de decisão (verificar se há regras ativas e dispositivo online)
  const selectedMaster = availableMasters.find(m => m.device_id === selectedDeviceId);
  const decisionEngineActive = selectedMaster?.decision_engine_enabled && activeRules > 0;
  
  return (
    <div className="min-h-screen bg-dark-bg" data-testid="automacao-page">
      <Toaster position="top-right" />
      
      <header className="bg-dark-card border-b border-dark-border shadow-lg">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          {/* Primeira linha: Título e Seletor */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-aqua-400 to-primary-400 bg-clip-text text-transparent">⚙️ Automação</h1>
              <p className="text-sm sm:text-base text-dark-textSecondary mt-1">Configure regras automáticas para seu sistema</p>
            </div>
            {/* Seletor de Master */}
            {availableMasters.length > 0 && (
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="w-full sm:w-auto min-w-[200px] px-4 py-2.5 text-sm sm:text-base bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
              >
                {availableMasters.map(master => (
                  <option key={master.device_id} value={master.device_id || ''}>
                    {master.device_name || master.device_id} {master.is_online ? '🟢' : '🔴'}
                  </option>
                ))}
              </select>
            )}
          </div>
          
          {/* Segunda linha: Informações em tempo real */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-dark-border">
            {/* Regra Vigente */}
            <div className="bg-dark-surface/50 border border-aqua-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-aqua-400 font-semibold">📌 Regra Vigente</span>
                {currentActiveRule && (
                  <span className="px-2 py-0.5 bg-aqua-500/20 text-aqua-400 text-xs rounded-full">
                    P{currentActiveRule.priority || 50}
                  </span>
                )}
              </div>
              {currentActiveRule ? (
                <p className="text-sm font-medium text-dark-text truncate" title={currentActiveRule.rule_name || currentActiveRule.name}>
                  {currentActiveRule.rule_name || currentActiveRule.name}
                </p>
              ) : (
                <p className="text-xs text-dark-textSecondary italic">Nenhuma regra ativa</p>
              )}
            </div>
            
            {/* Status do Motor de Decisão */}
            <div className="bg-dark-surface/50 border border-dark-border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-dark-textSecondary font-semibold">🔧 Motor de Decisão</span>
                <span className={`w-2 h-2 rounded-full ${decisionEngineActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></span>
              </div>
              <p className={`text-sm font-medium ${decisionEngineActive ? 'text-green-400' : 'text-dark-textSecondary'}`}>
                {decisionEngineActive ? 'Ativo' : selectedMaster?.is_online ? 'Inativo' : 'Offline'}
              </p>
            </div>
            
            {/* Estatísticas Rápidas */}
            <div className="bg-dark-surface/50 border border-dark-border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-dark-textSecondary mb-1">📊 Estatísticas</p>
                  <p className="text-sm font-medium text-dark-text">
                    <span className="text-aqua-400">{activeRules}</span> ativas / <span className="text-gray-400">{inactiveRules}</span> inativas
                  </p>
                </div>
                {selectedMaster?.is_online && (
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-green-400">🟢 Online</span>
                    {selectedMaster.last_seen && (
                      <span className="text-xs text-dark-textSecondary">
                        {new Date(selectedMaster.last_seen).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Box de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-dark-card border border-aqua-500/30 rounded-lg shadow-lg p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-dark-textSecondary mb-1">Regras Ativas</p>
                <p className="text-2xl sm:text-3xl font-bold text-aqua-400">{activeRules}</p>
              </div>
              <CheckCircleIcon className="w-8 h-8 sm:w-12 sm:h-12 text-aqua-400/50 flex-shrink-0" />
            </div>
          </div>
          <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-dark-textSecondary mb-1">Regras Desativadas</p>
                <p className="text-2xl sm:text-3xl font-bold text-dark-textSecondary">{inactiveRules}</p>
              </div>
              <XCircleIcon className="w-8 h-8 sm:w-12 sm:h-12 text-dark-textSecondary/50 flex-shrink-0" />
            </div>
          </div>
        </div>

        {/* ⚡ TESTE RELAYS MANUALMENTE (ESP-NOW - CARGA) - EXISTENTE */}
        <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg overflow-hidden mb-6">
          <div className="p-4 border-b border-dark-border">
            <h2 className="text-base sm:text-lg font-semibold text-dark-text break-words">⚡ Teste Relays Manualmente (ESP-NOW - Carga)</h2>
            <p className="text-xs sm:text-sm text-dark-textSecondary mt-1 break-words">Controle manual dos relays para testes</p>
          </div>
          
          {/* Gerenciador de Nomes dos Relés ESP-NOW Slaves - Colapsável */}
          <div className="bg-dark-surface border border-dark-border rounded-lg overflow-hidden m-2 sm:m-4">
            <div
              onClick={() => setExpandedSlaveRelayManager(!expandedSlaveRelayManager)}
              className="w-full p-3 sm:p-4 flex items-center justify-between hover:bg-dark-card transition-colors cursor-pointer"
            >
              <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                {expandedSlaveRelayManager ? (
                  <ChevronUpIcon className="w-4 h-4 sm:w-5 sm:h-5 text-aqua-400 flex-shrink-0" />
                ) : (
                  <ChevronDownIcon className="w-4 h-4 sm:w-5 sm:h-5 text-dark-textSecondary flex-shrink-0" />
                )}
                <h3 className="text-sm sm:text-md font-semibold text-dark-text truncate">
                  📡 Gerenciar Nomes dos Relés ESP-NOW Slaves
                </h3>
              </div>
              <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0 ml-2">
                <span className="text-xs sm:text-sm text-dark-textSecondary hidden sm:inline">
                  {espnowSlaves.length} {espnowSlaves.length === 1 ? 'dispositivo' : 'dispositivos'}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    loadESPNOWSlaves();
                  }}
                  className="px-2 sm:px-3 py-1.5 sm:py-1 bg-dark-card hover:bg-dark-border border border-dark-border rounded text-xs text-dark-text transition-colors"
                  title="Atualizar lista de slaves"
                >
                  🔄
                </button>
              </div>
            </div>

            {expandedSlaveRelayManager && (
              <div className="p-4 border-t border-dark-border">
                {loadingSlaves ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-aqua-500 mx-auto"></div>
                    <p className="text-dark-textSecondary mt-4">Carregando dispositivos ESP-NOW...</p>
                  </div>
                ) : espnowSlaves.length === 0 ? (
                  <div className="text-center py-8 bg-dark-card border border-dark-border rounded-lg">
                    <p className="text-dark-textSecondary mb-2">Nenhum dispositivo ESP-NOW encontrado</p>
                    <p className="text-xs text-dark-textSecondary mb-4">
                      Os dispositivos ESP-NOW serão descobertos automaticamente pelo ESP32 Master
                      <br />
                      e registrados no Supabase quando conectados.
                    </p>
                    <button
                      onClick={loadESPNOWSlaves}
                      className="px-4 py-2 bg-aqua-500/20 hover:bg-aqua-500/30 border border-aqua-500/30 rounded text-sm text-aqua-400 transition-colors"
                    >
                      🔄 Tentar Novamente
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {espnowSlaves.map(slave => {
                      const isExpanded = expandedSlaves.has(slave.macAddress);
                      return (
                        <div
                          key={slave.macAddress}
                          className="bg-dark-card border border-dark-border rounded-lg overflow-hidden w-full max-w-full"
                        >
                          {/* Header do Slave - Colapsável */}
                          <div
                            onClick={() => toggleSlave(slave.macAddress)}
                            className="w-full p-3 flex items-center justify-between hover:bg-dark-surface transition-colors cursor-pointer"
                          >
                            <div className="flex items-center space-x-3">
                              {isExpanded ? (
                                <ChevronUpIcon className="w-4 h-4 text-aqua-400" />
                              ) : (
                                <ChevronDownIcon className="w-4 h-4 text-dark-textSecondary" />
                              )}
                              <div className="text-left">
                                <h4 className="font-semibold text-dark-text">{slave.name}</h4>
                                <p className="text-xs text-dark-textSecondary">{slave.macAddress}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span
                                className={`px-2 py-1 rounded text-xs ${
                                  slave.status === 'online'
                                    ? 'bg-aqua-500/20 text-aqua-400 border border-aqua-500/30'
                                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                }`}
                              >
                                {slave.status === 'online' ? 'Online' : 'Offline'}
                              </span>
                              {/* ✅ Candado para bloquear/desbloquear controles (com senha admin) */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const isLocked = lockedSlaves.get(slave.macAddress) ?? false;
                                  showLockUnlockToast(
                                    isLocked,
                                    `Controles do Slave ${slave.name}`,
                                    () => {
                                  setLockedSlaves(prev => {
                                    const next = new Map(prev);
                                        const currentLocked = next.get(slave.macAddress) ?? false;
                                        next.set(slave.macAddress, !currentLocked);
                                    return next;
                                  });
                                    }
                                  );
                                }}
                                className={`p-1.5 rounded transition-colors ${
                                  lockedSlaves.get(slave.macAddress)
                                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                                    : 'bg-aqua-500/20 text-aqua-400 hover:bg-aqua-500/30 border border-aqua-500/30'
                                }`}
                                title={lockedSlaves.get(slave.macAddress) ? 'Desbloquear controles (requer senha admin)' : 'Bloquear controles (requer senha admin)'}
                              >
                                {lockedSlaves.get(slave.macAddress) ? (
                                  <LockClosedIcon className="w-4 h-4" />
                                ) : (
                                  <LockOpenIcon className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Conteúdo Expandido - Relés do Slave */}
                          {isExpanded && (
                            <div className="p-4 border-t border-dark-border space-y-4">
                              {/* ✅ NOVO: Painel de Controle Manual Rápido */}
                              <div className="bg-aqua-500/10 border border-aqua-500/30 rounded-lg p-4 mb-4 w-full max-w-full overflow-x-hidden">
                                <h5 className="text-sm font-semibold text-aqua-400 mb-3 flex items-center">
                                  ⚡ Controle Manual Rápido
                                </h5>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  {slave.relays.map(relay => {
                                    const relayKey = `${slave.macAddress}-${relay.id}`;
                                    const realState = relay.state !== undefined ? relay.state : false;
                                    const isRelayOn = relayStates.get(relayKey) ?? realState;
                                    const isLoading = loadingRelays.get(relayKey) || false;
                                    const isLocked = lockedSlaves.get(slave.macAddress) ?? false;
                                    // ✅ Verificar se tem timer ativo
                                    const hasTimer = relay.has_timer || false;
                                    const remainingTime = relay.remaining_time || 0;
                                    
                                    return (
                                      <div
                                        key={relay.id}
                                        className={`bg-dark-card border rounded-lg p-3 ${
                                          isLocked ? 'border-red-500/30 opacity-60' : 'border-dark-border'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="flex-1 min-w-0">
                                            <h6 className="text-xs font-medium text-dark-text truncate" title={relay.name || `Relé ${relay.id + 1}`}>
                                              {relay.name || `Relé ${relay.id + 1}`}
                                            </h6>
                                            <p className="text-xs text-dark-textSecondary mt-0.5">
                                              {realState ? '🟢 ON' : '⚫ OFF'}
                                            </p>
                                            {/* ✅ Mostrar timer se estiver ativo */}
                                            {hasTimer && remainingTime > 0 && (
                                              <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                                                <ClockIcon className="w-3 h-3" />
                                                {Math.floor(remainingTime / 60)}:{(remainingTime % 60).toString().padStart(2, '0')}
                                              </p>
                                            )}
                                          </div>
                                          <span
                                            className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                              isRelayOn ? 'bg-aqua-500 animate-pulse' : 'bg-dark-border'
                                            }`}
                                            title={isRelayOn ? 'Ligado' : 'Desligado'}
                                          />
                                        </div>
                                        {isLocked && (
                                          <div className="mb-2 text-xs text-red-400 flex items-center space-x-1">
                                            <LockClosedIcon className="w-3 h-3" />
                                            <span>Bloqueado</span>
                                          </div>
                                        )}
                                        
                                        {/* 🎨 OBRA PRIMA: Switch Compacto Integrado con Timer y Ciclo */}
                                        <div className="relative">
                                          <div className="flex items-center gap-2">
                                            {/* Switch Principal ON/OFF */}
                                            <button
                                              onClick={async () => {
                                                if (isRelayOn) {
                                                  // OFF
                                                  setLoadingRelays(prev => new Map(prev).set(relayKey, true));
                                                  try {
                                                    const response = await fetch('/api/esp-now/command', {
                                                      method: 'POST',
                                                      headers: { 'Content-Type': 'application/json' },
                                                      body: JSON.stringify({
                                                        master_device_id: selectedDeviceId,
                                                        slave_mac_address: slave.macAddress,
                                                        slave_name: slave.name,
                                                        relay_number: relay.id,
                                                        action: 'off',
                                                        duration_seconds: 0,
                                                        triggered_by: 'manual',
                                                        command_type: 'manual',
                                                      }),
                                                    });

                                                    if (response.ok) {
                                                      const result = await response.json();
                                                      if (result.command_id) {
                                                        commandToRelayMap.current.set(result.command_id, relayKey);
                                                      }
                                                      setRelayStates(prev => new Map(prev).set(relayKey, false));
                                                      toast.success(`${relay.name || `Relé ${relay.id + 1}`} desligado`);
                                                      setTimeout(() => {
                                                        updateRelayStatesOnly();
                                                      }, 2000);
                                                    } else {
                                                      const error = await response.json();
                                                      toast.error(`Erro: ${error.error}`);
                                                    }
                                                  } catch (error) {
                                                    toast.error('Erro ao enviar comando');
                                                  } finally {
                                                    setLoadingRelays(prev => {
                                                      const next = new Map(prev);
                                                      next.delete(relayKey);
                                                      return next;
                                                    });
                                                  }
                                                } else {
                                                  // ON
                                                  const timerDuration = relayTimers.get(relayKey) || 0;
                                                  setLoadingRelays(prev => new Map(prev).set(relayKey, true));
                                                  try {
                                                    const response = await fetch('/api/esp-now/command', {
                                                      method: 'POST',
                                                      headers: { 'Content-Type': 'application/json' },
                                                      body: JSON.stringify({
                                                        master_device_id: selectedDeviceId,
                                                        slave_mac_address: slave.macAddress,
                                                        slave_name: slave.name,
                                                        relay_number: relay.id,
                                                        action: 'on',
                                                        duration_seconds: timerDuration,
                                                        triggered_by: 'manual',
                                                        command_type: 'manual',
                                                      }),
                                                    });

                                                    if (response.ok) {
                                                      const result = await response.json();
                                                      if (result.command_id) {
                                                        commandToRelayMap.current.set(result.command_id, relayKey);
                                                      }
                                                      setRelayStates(prev => new Map(prev).set(relayKey, true));
                                                      toast.success(`${relay.name || `Relé ${relay.id + 1}`} ligado${timerDuration > 0 ? ` (${timerDuration}s)` : ''}`);
                                                      setTimeout(() => {
                                                        updateRelayStatesOnly();
                                                      }, 2000);
                                                    } else {
                                                      const error = await response.json();
                                                      toast.error(`Erro: ${error.error}`);
                                                    }
                                                  } catch (error) {
                                                    toast.error('Erro ao enviar comando');
                                                  } finally {
                                                    setLoadingRelays(prev => {
                                                      const next = new Map(prev);
                                                      next.delete(relayKey);
                                                      return next;
                                                    });
                                                  }
                                                }
                                              }}
                                              disabled={isLoading || isLocked}
                                              className={`
                                                relative flex-1 h-9 rounded-lg transition-all duration-300 ease-in-out
                                                ${isLocked 
                                                  ? 'opacity-50 cursor-not-allowed' 
                                                  : 'cursor-pointer transform active:scale-95'
                                                }
                                                ${isRelayOn
                                                  ? 'bg-gradient-to-r from-aqua-500 via-aqua-400 to-primary-500 shadow-lg shadow-aqua-500/30'
                                                  : 'bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700'
                                                }
                                                ${!isLocked && !isRelayOn && 'hover:from-gray-600 hover:via-gray-500 hover:to-gray-600'}
                                                ${!isLocked && isRelayOn && 'hover:shadow-xl hover:shadow-aqua-500/40'}
                                              `}
                                              title={isLocked ? 'Controles bloqueados' : isRelayOn ? 'Clique para desligar' : 'Clique para ligar'}
                                            >
                                              {/* Indicador interno del switch */}
                                              <div className={`                                                absolute top-1 w-7 h-7 rounded-md bg-white/90 shadow-lg
                                                transition-all duration-300 ease-in-out
                                                ${isRelayOn ? 'right-1' : 'left-1'}
                                                flex items-center justify-center
                                              `}>
                                                {isLoading ? (
                                                  <div className="w-3 h-3 border-2 border-aqua-500 border-t-transparent rounded-full animate-spin" />
                                                ) : isRelayOn ? (
                                                  <div className="w-2 h-2 rounded-full bg-aqua-500 animate-pulse" />
                                                ) : (
                                                  <div className="w-2 h-2 rounded-full bg-gray-400" />
                                                )}
                                              </div>
                                              
                                              {/* Texto del estado */}
                                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <span className={`
                                                  text-xs font-bold transition-colors duration-300
                                                  ${isRelayOn ? 'text-white' : 'text-gray-300'}
                                                `}>
                                                  {isRelayOn ? 'ON' : 'OFF'}
                                                </span>
                                              </div>
                                              
                                              {/* Indicador de timer activo */}
                                              {relayTimers.get(relayKey) && !isRelayOn && (
                                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                                                  <ClockIcon className="w-2.5 h-2.5 text-white" />
                                                </div>
                                              )}
                                            </button>

                                            {/* Botón compacto de configuración (Timer/Ciclo) */}
                                            {!isLocked && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const isTimerOpen = showTimerInput === relayKey;
                                                  const isCycleOpen = showCycleInput === relayKey;
                                                  if (isTimerOpen || isCycleOpen) {
                                                    setShowTimerInput(null);
                                                    setShowCycleInput(null);
                                                  } else {
                                                    setShowTimerInput(relayKey);
                                                  }
                                                }}
                                                className={`
                                                  p-2 rounded-lg transition-all duration-200
                                                  ${showTimerInput === relayKey || showCycleInput === relayKey
                                                    ? 'bg-aqua-500/20 text-aqua-400 border-2 border-aqua-500/40'
                                                    : relayTimers.get(relayKey) || relayCycles.get(relayKey)?.enabled
                                                      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 hover:bg-yellow-500/30'
                                                      : 'bg-dark-surface hover:bg-dark-border text-gray-400 hover:text-aqua-400 border border-dark-border'
                                                  }
                                                  ${!isLocked && 'cursor-pointer active:scale-95'}
                                                `}
                                                title={
                                                  relayCycles.get(relayKey)?.enabled
                                                    ? `Ciclo: ON ${relayCycles.get(relayKey)!.onDuration}s / OFF ${relayCycles.get(relayKey)!.offDuration}s`
                                                    : relayTimers.get(relayKey)
                                                      ? `Timer: ${relayTimers.get(relayKey)}s`
                                                      : 'Configurar Timer/Ciclo'
                                                }
                                              >
                                                {relayCycles.get(relayKey)?.enabled ? (
                                                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                                ) : (
                                                  <ClockIcon className="w-4 h-4" />
                                                )}
                                              </button>
                                            )}
                                          </div>

                                          {/* Panel desplegable de configuración Timer/Ciclo */}
                                          {(showTimerInput === relayKey || showCycleInput === relayKey) && (
                                            <div className="absolute z-50 mt-2 w-full bg-dark-card border border-aqua-500/40 rounded-lg p-3 shadow-xl">
                                              {/* Tabs Timer/Ciclo */}
                                              <div className="flex gap-1 mb-3 border-b border-dark-border pb-2">
                                                <button
                                                  onClick={() => {
                                                    setShowTimerInput(relayKey);
                                                    setShowCycleInput(null);
                                                  }}
                                                  className={`
                                                    flex-1 py-1.5 px-2 text-xs font-medium rounded transition-all
                                                    ${showTimerInput === relayKey
                                                      ? 'bg-aqua-500/20 text-aqua-400 border border-aqua-500/40'
                                                      : 'bg-dark-surface text-gray-400 hover:text-aqua-400 border border-transparent'
                                                    }
                                                  `}
                                                >
                                                  ⏱️ Timer
                                                </button>
                                                <button
                                                  onClick={() => {
                                                    setShowCycleInput(relayKey);
                                                    setShowTimerInput(null);
                                                  }}
                                                  className={`
                                                    flex-1 py-1.5 px-2 text-xs font-medium rounded transition-all
                                                    ${showCycleInput === relayKey
                                                      ? 'bg-aqua-500/20 text-aqua-400 border border-aqua-500/40'
                                                      : 'bg-dark-surface text-gray-400 hover:text-aqua-400 border border-transparent'
                                                    }
                                                  `}
                                                >
                                                  🔄 Ciclo
                                                </button>
                                              </div>

                                              {/* Contenido Timer */}
                                              {showTimerInput === relayKey && (
                                                <div className="space-y-2">
                                                  <div className="flex items-center gap-2">
                                                    <input
                                                      type="number"
                                                      min="0"
                                                      max="3600"
                                                      value={relayTimers.get(relayKey) || 0}
                                                      onChange={(e) => {
                                                        const value = parseInt(e.target.value) || 0;
                                                        setRelayTimers(prev => {
                                                          const next = new Map(prev);
                                                          if (value > 0) {
                                                            next.set(relayKey, value);
                                                          } else {
                                                            next.delete(relayKey);
                                                          }
                                                          return next;
                                                        });
                                                      }}
                                                      placeholder="Segundos"
                                                      className="flex-1 px-2 py-1.5 bg-dark-surface border border-dark-border rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-aqua-500"
                                                      autoFocus
                                                    />
                                                    <span className="text-xs text-gray-400">s</span>
                                                    <button
                                                      onClick={() => {
                                                        setRelayTimers(prev => {
                                                          const next = new Map(prev);
                                                          next.delete(relayKey);
                                                          return next;
                                                        });
                                                      }}
                                                      className="p-1.5 hover:bg-red-500/20 rounded text-red-400 transition-colors"
                                                      title="Remover timer"
                                                    >
                                                      <XMarkIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                  </div>
                                                  <p className="text-xs text-gray-500">Timer: desliga após X segundos</p>
                                                </div>
                                              )}

                                              {/* Contenido Ciclo */}
                                              {showCycleInput === relayKey && (
                                                <div className="space-y-3">
                                                  <div className="space-y-2">
                                                    <label className="text-xs text-gray-400">ON (segundos)</label>
                                                    <input
                                                      type="number"
                                                      min="1"
                                                      max="3600"
                                                      value={relayCycles.get(relayKey)?.onDuration || 10}
                                                      onChange={(e) => {
                                                        const value = parseInt(e.target.value) || 10;
                                                        setRelayCycles(prev => {
                                                          const next = new Map(prev);
                                                          const current = next.get(relayKey) || { onDuration: 10, offDuration: 10, enabled: false };
                                                          next.set(relayKey, { ...current, onDuration: value });
                                                          return next;
                                                        });
                                                      }}
                                                      className="w-full px-2 py-1.5 bg-dark-surface border border-dark-border rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-aqua-500"
                                                      placeholder="10"
                                                    />
                                                  </div>
                                                  <div className="space-y-2">
                                                    <label className="text-xs text-gray-400">OFF (segundos)</label>
                                                    <input
                                                      type="number"
                                                      min="1"
                                                      max="3600"
                                                      value={relayCycles.get(relayKey)?.offDuration || 10}
                                                      onChange={(e) => {
                                                        const value = parseInt(e.target.value) || 10;
                                                        setRelayCycles(prev => {
                                                          const next = new Map(prev);
                                                          const current = next.get(relayKey) || { onDuration: 10, offDuration: 10, enabled: false };
                                                          next.set(relayKey, { ...current, offDuration: value });
                                                          return next;
                                                        });
                                                      }}
                                                      className="w-full px-2 py-1.5 bg-dark-surface border border-dark-border rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-aqua-500"
                                                      placeholder="10"
                                                    />
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                    <button
                                                      onClick={() => {
                                                        const cycle = relayCycles.get(relayKey);
                                                        setRelayCycles(prev => {
                                                          const next = new Map(prev);
                                                          if (cycle) {
                                                            next.set(relayKey, { ...cycle, enabled: !cycle.enabled });
                                                          } else {
                                                            next.set(relayKey, { onDuration: 10, offDuration: 10, enabled: true });
                                                          }
                                                          return next;
                                                        });
                                                        toast.success(cycle?.enabled ? 'Ciclo desativado' : 'Ciclo ativado');
                                                      }}
                                                      className={`
                                                        flex-1 py-2 px-3 text-xs font-medium rounded transition-all
                                                        ${relayCycles.get(relayKey)?.enabled
                                                          ? 'bg-green-500/20 text-green-400 border border-green-500/40 hover:bg-green-500/30'
                                                          : 'bg-aqua-500/20 text-aqua-400 border border-aqua-500/40 hover:bg-aqua-500/30'
                                                        }
                                                      `}
                                                    >
                                                      {relayCycles.get(relayKey)?.enabled ? '🟢 Ativo' : '▶️ Ativar Ciclo'}
                                                    </button>
                                                    <button
                                                      onClick={() => {
                                                        setRelayCycles(prev => {
                                                          const next = new Map(prev);
                                                          next.delete(relayKey);
                                                          return next;
                                                        });
                                                        setShowCycleInput(null);
                                                      }}
                                                      className="p-2 hover:bg-red-500/20 rounded text-red-400 transition-colors"
                                                      title="Remover ciclo"
                                                    >
                                                      <XMarkIcon className="w-4 h-4" />
                                                    </button>
                                                  </div>
                                                  <p className="text-xs text-gray-500">Ciclo: alterna ON/OFF automaticamente</p>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* ✅ Gerenciamento de Nomes - Melhorado igual a DeviceControlPanel - COLAPSÁVEL */}
                              <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
                                <button
                                  onClick={() => {
                                    const isExpanded = expandedRenameRelays.has(slave.macAddress);
                                    setExpandedRenameRelays(prev => {
                                      const next = new Set(prev);
                                      if (isExpanded) {
                                        next.delete(slave.macAddress);
                                      } else {
                                        next.add(slave.macAddress);
                                      }
                                      return next;
                                    });
                                  }}
                                  className="w-full flex items-center justify-between text-left mb-2 hover:opacity-80 transition-opacity"
                                >
                                  <h5 className="text-sm font-semibold text-dark-text flex items-center gap-2">
                                    ✏️ Nomear Relés
                                  </h5>
                                  {expandedRenameRelays.has(slave.macAddress) ? (
                                    <ChevronUpIcon className="w-4 h-4 text-aqua-400 flex-shrink-0" />
                                  ) : (
                                    <ChevronDownIcon className="w-4 h-4 text-dark-textSecondary flex-shrink-0" />
                                  )}
                                </button>
                                {expandedRenameRelays.has(slave.macAddress) && (
                                  <>
                                    <p className="text-xs text-dark-textSecondary mb-4">
                                      Nomeie os relés deste dispositivo. Os nomes serão usados globalmente em todas as regras de automação.
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {slave.relays.map(relay => {
                                    const relayKey = `${slave.macAddress}-${relay.id}`;
                                    const tempName = tempRelayNames.get(relayKey) ?? relay.name;
                                    const isSaving = savingRelayNames.has(relayKey);
                                    const originalName = relay.name;
                                    
                                    return (
                                      <div key={relay.id} className="flex items-center space-x-2">
                                        <label className="text-sm text-dark-textSecondary w-20 flex-shrink-0">
                                          Relé {relay.id + 1}:
                                        </label>
                                        <div className="flex-1 flex items-center space-x-2">
                                          <input
                                            type="text"
                                            value={tempName}
                                            onChange={e => {
                                              const newName = e.target.value;
                                              setTempRelayNames(prev => {
                                                const next = new Map(prev);
                                                next.set(relayKey, newName);
                                                return next;
                                              });
                                            }}
                                            onKeyDown={e => {
                                              if (e.key === 'Enter') {
                                                e.currentTarget.blur();
                                                if (tempName.trim() && tempName.trim() !== originalName) {
                                                  handleSaveRelayName(slave.macAddress, relay.id, tempName.trim());
                                                }
                                              }
                                            }}
                                            disabled={isSaving}
                                            className="flex-1 p-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text text-sm focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                            placeholder={`Relé ${relay.id + 1}`}
                                          />
                                          <button
                                            onClick={() => {
                                              if (tempName.trim() && tempName.trim() !== originalName) {
                                                handleSaveRelayName(slave.macAddress, relay.id, tempName.trim());
                                              }
                                            }}
                                            disabled={isSaving || !tempName.trim() || tempName.trim() === originalName}
                                            className="px-3 py-2 bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all shadow-lg hover:shadow-aqua-500/50 text-xs font-medium flex items-center gap-1 flex-shrink-0"
                                            title="Pressione Enter ou clique em Salvar para confirmar"
                                          >
                                            {isSaving ? (
                                              <>
                                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                                <span>Salvando...</span>
                                              </>
                                            ) : (
                                              <>
                                                <span>💾</span>
                                                <span>Salvar</span>
                                              </>
                                            )}
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 🧠 MOTOR DE DECISÃO - Menu Colapsável */}
        <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg overflow-hidden mb-6">
          <div
            onClick={() => setExpandedDecisionEngine(!expandedDecisionEngine)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setExpandedDecisionEngine(!expandedDecisionEngine);
              }
            }}
            role="button"
            tabIndex={0}
            className="w-full p-4 sm:p-6 flex items-center justify-between hover:bg-dark-surface/50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {expandedDecisionEngine ? (
                <ChevronUpIcon className="w-5 h-5 text-aqua-400 flex-shrink-0" />
              ) : (
                <ChevronDownIcon className="w-5 h-5 text-dark-textSecondary flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-lg sm:text-xl font-bold text-dark-text">🧠 Motor de Decisão</h2>
                <p className="text-xs sm:text-sm text-dark-textSecondary mt-1">Configure regras automáticas com Regras script Sequenciais</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* ✅ Candado para bloquear/desbloquear controles Decision Engine (com senha admin) */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  showLockUnlockToast(
                    decisionEngineLocked,
                    'Decision Engine',
                    () => setDecisionEngineLocked(prev => !prev)
                  );
                }}
                className={`p-1.5 rounded transition-colors ${
                  decisionEngineLocked
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                    : 'bg-aqua-500/20 text-aqua-400 hover:bg-aqua-500/30 border border-aqua-500/30'
                }`}
                title={decisionEngineLocked ? 'Desbloquear controles (requer senha admin)' : 'Bloquear controles (requer senha admin)'}
              >
                {decisionEngineLocked ? (
                  <LockClosedIcon className="w-4 h-4" />
                ) : (
                  <LockOpenIcon className="w-4 h-4" />
                )}
              </button>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  if (!decisionEngineLocked) {
                    setIsModalOpen(true);
                  }
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!decisionEngineLocked) {
                      setIsModalOpen(true);
                    }
                  }
                }}
                className={`bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white font-medium py-2 px-4 rounded-lg transition-all shadow-lg hover:shadow-aqua-500/50 text-sm sm:text-base flex-shrink-0 ml-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-aqua-500 focus:ring-offset-2 focus:ring-offset-dark-card ${
                  decisionEngineLocked ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                title={decisionEngineLocked ? 'Controles bloqueados' : 'Criar nova regra'}
              >
                ➕ Nova Regra
              </div>
            </div>
          </div>

          {expandedDecisionEngine && (
            <div className="p-4 sm:p-6 border-t border-dark-border">

            {/* Lista de Regras Ativas */}
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-aqua-500 mx-auto"></div>
                <p className="text-dark-textSecondary mt-4">Carregando regras...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rules
                  .filter(r => !r.rule_json?.script?.instructions) // ✅ Solo mostrar regras tradicionales (sin script)
                  .map((rule) => (
                    <RuleCard
                      key={rule.id}
                      rule={rule}
                      onToggle={toggleRule}
                      onEdit={handleEditRule}
                      onDelete={handleDeleteRule}
                    />
                  ))}
              </div>
            )}

            {/* ✅ Regras de Script Sequencial - Separadas por status */}
            {selectedDeviceId && selectedDeviceId !== 'default_device' && (
              <div className="mt-4 pt-4 border-t border-dark-border">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm text-gray-400">
                    📋 Regras de Script Sequencial ({rules.filter(r => r.rule_json?.script?.instructions && r.enabled).length} ativas / {rules.filter(r => r.rule_json?.script?.instructions && !r.enabled).length} inativas)
                  </p>
                </div>

                {loading ? (
                  <div className="text-center py-8 text-gray-400">Carregando...</div>
                ) : rules.filter(r => r.rule_json?.script?.instructions).length === 0 ? (
                  <div className="text-center py-8 text-gray-400 bg-dark-surface border border-dark-border rounded-lg">
                    Nenhum script sequencial ativo. Crie uma regra com instruções sequenciais.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Coluna Esquerda - Regras Ativas */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-2">
                        <CheckCircleIcon className="w-4 h-4" />
                        Ativas ({rules.filter(r => r.rule_json?.script?.instructions && r.enabled).length})
                      </h3>
                      {rules
                        .filter(r => r.rule_json?.script?.instructions && r.enabled)
                        .map((script) => (
                        <div
                          key={script.id}
                          className="border border-dark-border rounded-lg p-4 bg-dark-surface/50 hover:bg-dark-surface transition-colors"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <h4 className="font-semibold text-white truncate">{script.name || script.rule_name}</h4>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0 ${
                                  script.enabled
                                    ? 'bg-aqua-500/20 text-aqua-400 border-aqua-500/30'
                                    : 'bg-dark-surface text-dark-textSecondary border-dark-border'
                                }`}>
                                  {script.enabled ? (
                                    <span className="flex items-center">
                                      <CheckCircleIcon className="w-3 h-3 mr-1 text-green-500" />
                                      Ativo
                                    </span>
                                  ) : (
                                    <span className="flex items-center">
                                      <XCircleIcon className="w-3 h-3 mr-1 text-red-500" />
                                      Inativo
                                    </span>
                                  )}
                                </span>
                              </div>
                              {script.description && (
                                <p className="text-xs text-gray-400 mt-1">{script.description || script.rule_description}</p>
                              )}
                              <p className="text-xs text-gray-500 mt-1">
                                Sequential Script
                              </p>

                              {/* Preview das instruções - Linha circular do script */}
                              {script.rule_json?.script?.instructions && (
                                <div className="mt-2 text-xs text-gray-400 space-y-1 font-mono">
                                  {script.rule_json.script.instructions.slice(0, 2).map((instr: ScriptInstruction, idx: number) => (
                                    <div key={idx} className="text-aqua-300">
                                      {idx + 1}. {instr.type.toUpperCase()}
                                      {instr.condition && (
                                        <span className="ml-2 text-gray-400">
                                          {instr.condition.sensor} {instr.condition.operator} {instr.condition.value}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                  {script.rule_json.script.instructions.length > 2 && (
                                    <div className="text-gray-500 italic">
                                      ... e mais {script.rule_json.script.instructions.length - 2} instrução(ões)
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="mt-3 flex gap-2 flex-wrap items-center">
                                <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded border border-blue-500/30">
                                  Prioridade: {script.priority || 50}
                                </span>
                                {/* ✅ rule_id - Fácil de copiar */}
                                {script.rule_id && (
                                  <div className="flex items-center gap-1 bg-purple-500/20 border border-purple-500/40 rounded px-2 py-1 group">
                                    <span className="text-xs text-purple-300 font-mono">
                                      ID: {script.rule_id}
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (script.rule_id) {
                                          navigator.clipboard.writeText(script.rule_id);
                                          setCopiedRuleId(script.rule_id);
                                          toast.success(`rule_id copiado: ${script.rule_id}`);
                                          setTimeout(() => setCopiedRuleId(null), 2000);
                                        }
                                      }}
                                      className="p-0.5 hover:bg-purple-500/30 rounded transition-colors"
                                      title="Copiar rule_id"
                                    >
                                      {copiedRuleId === script.rule_id ? (
                                        <ClipboardDocumentCheckIcon className="w-3.5 h-3.5 text-green-400" />
                                      ) : (
                                        <ClipboardIcon className="w-3.5 h-3.5 text-purple-300 group-hover:text-purple-200" />
                                      )}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2 flex-shrink-0 ml-2">
                              <button
                                onClick={() => setJsonPreviewRule(script)}
                                className="p-2 hover:bg-dark-surface rounded-lg transition-colors text-purple-400 hover:text-purple-300"
                                title="Vista Previa JSON"
                              >
                                <EyeIcon className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleEditRule(script)}
                                className="p-2 hover:bg-dark-surface rounded-lg transition-colors text-aqua-400 hover:text-aqua-300"
                                title="Editar"
                              >
                                <PencilIcon className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleDeleteRule(script.id)}
                                className="p-2 hover:bg-dark-surface rounded-lg transition-colors text-red-400 hover:text-red-300"
                                title="Excluir"
                              >
                                <TrashIcon className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {rules.filter(r => r.rule_json?.script?.instructions && r.enabled).length === 0 && (
                        <div className="text-center py-6 text-gray-500 bg-dark-surface/30 border border-dark-border rounded-lg text-xs">
                          Nenhuma regra ativa
                        </div>
                      )}
                    </div>

                    {/* Coluna Direita - Regras Inativas */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
                        <XCircleIcon className="w-4 h-4" />
                        Inativas ({rules.filter(r => r.rule_json?.script?.instructions && !r.enabled).length})
                      </h3>
                      {rules
                        .filter(r => r.rule_json?.script?.instructions && !r.enabled)
                        .map((script) => (
                          <div
                            key={script.id}
                            className="border border-dark-border rounded-lg p-4 bg-dark-surface/50 hover:bg-dark-surface transition-colors"
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2 mb-1">
                                  <h4 className="font-semibold text-white truncate">{script.name || script.rule_name}</h4>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0 ${
                                    script.enabled
                                      ? 'bg-aqua-500/20 text-aqua-400 border-aqua-500/30'
                                      : 'bg-dark-surface text-dark-textSecondary border-dark-border'
                                  }`}>
                                    {script.enabled ? (
                                      <span className="flex items-center">
                                        <CheckCircleIcon className="w-3 h-3 mr-1 text-green-500" />
                                        Ativo
                                      </span>
                                    ) : (
                                      <span className="flex items-center">
                                        <XCircleIcon className="w-3 h-3 mr-1 text-red-500" />
                                        Inativo
                                      </span>
                                    )}
                                  </span>
                                </div>
                                {script.description && (
                                  <p className="text-xs text-gray-400 mt-1">{script.description || script.rule_description}</p>
                                )}
                                <p className="text-xs text-gray-500 mt-1">
                                  Sequential Script
                                </p>

                                {/* Preview das instruções - Linha circular do script */}
                                {script.rule_json?.script?.instructions && (
                                  <div className="mt-2 text-xs text-gray-400 space-y-1 font-mono">
                                  {script.rule_json.script.instructions.slice(0, 2).map((instr: ScriptInstruction, idx: number) => (
                                      <div key={idx} className="text-aqua-300">
                                        {idx + 1}. {instr.type.toUpperCase()}
                                        {instr.condition && (
                                          <span className="ml-2 text-gray-400">
                                            {instr.condition.sensor} {instr.condition.operator} {instr.condition.value}
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                    {script.rule_json.script.instructions.length > 2 && (
                                      <div className="text-gray-500 italic">
                                        ... e mais {script.rule_json.script.instructions.length - 2} instrução(ões)
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div className="mt-3 flex gap-2 flex-wrap items-center">
                                  <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded border border-blue-500/30">
                                    Prioridade: {script.priority || 50}
                                  </span>
                                  {/* ✅ rule_id - Fácil de copiar */}
                                  {script.rule_id && (
                                    <div className="flex items-center gap-1 bg-purple-500/20 border border-purple-500/40 rounded px-2 py-1 group">
                                      <span className="text-xs text-purple-300 font-mono">
                                        ID: {script.rule_id}
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (script.rule_id) {
                                            navigator.clipboard.writeText(script.rule_id);
                                            setCopiedRuleId(script.rule_id);
                                            toast.success(`rule_id copiado: ${script.rule_id}`);
                                            setTimeout(() => setCopiedRuleId(null), 2000);
                                          }
                                        }}
                                        className="p-0.5 hover:bg-purple-500/30 rounded transition-colors"
                                        title="Copiar rule_id"
                                      >
                                        {copiedRuleId === script.rule_id ? (
                                          <ClipboardDocumentCheckIcon className="w-3.5 h-3.5 text-green-400" />
                                        ) : (
                                          <ClipboardIcon className="w-3.5 h-3.5 text-purple-300 group-hover:text-purple-200" />
                                        )}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2 flex-shrink-0 ml-2">
                                <button
                                  onClick={() => setJsonPreviewRule(script)}
                                  className="p-2 hover:bg-dark-surface rounded-lg transition-colors text-purple-400 hover:text-purple-300"
                                  title="Vista Previa JSON"
                                >
                                  <EyeIcon className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => handleEditRule(script)}
                                  className="p-2 hover:bg-dark-surface rounded-lg transition-colors text-aqua-400 hover:text-aqua-300"
                                  title="Editar"
                                >
                                  <PencilIcon className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteRule(script.id)}
                                  className="p-2 hover:bg-dark-surface rounded-lg transition-colors text-red-400 hover:text-red-300"
                                  title="Excluir"
                                >
                                  <TrashIcon className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      {rules.filter(r => r.rule_json?.script?.instructions && !r.enabled).length === 0 && (
                        <div className="text-center py-6 text-gray-500 bg-dark-surface/30 border border-dark-border rounded-lg text-xs">
                          Nenhuma regra inativa
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            </div>
          )}
        </div>


        {/* Box de Controle Nutricional Proporcional - Colapsável */}
        <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg overflow-hidden mb-6">
          {/* Header - Colapsável */}
          <div
            onClick={() => setExpandedNutritionalControl(!expandedNutritionalControl)}
            className="w-full p-6 flex items-center justify-between hover:bg-dark-surface transition-colors cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              {expandedNutritionalControl ? (
                <ChevronUpIcon className="w-5 h-5 text-aqua-400" />
              ) : (
                <ChevronDownIcon className="w-5 h-5 text-dark-textSecondary" />
              )}
              <h3 className="text-lg font-semibold text-dark-text">
                📋 Controle Nutricional Proporcional
              </h3>
            </div>
            {/* ✅ Candado para bloquear/desbloquear controles EC (com senha admin) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                showLockUnlockToast(
                  ecControllerLocked,
                  'Controles EC',
                  () => setEcControllerLocked(prev => !prev)
                );
              }}
              className={`p-1.5 rounded transition-colors ${
                ecControllerLocked
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                  : 'bg-aqua-500/20 text-aqua-400 hover:bg-aqua-500/30 border border-aqua-500/30'
              }`}
              title={ecControllerLocked ? 'Desbloquear controles (requer senha admin)' : 'Bloquear controles (requer senha admin)'}
            >
              {ecControllerLocked ? (
                <LockClosedIcon className="w-4 h-4" />
              ) : (
                <LockOpenIcon className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Conteúdo Expandido - Configuração EC Controller + Tabela de Nutrição */}
          {expandedNutritionalControl && (
            <div className="p-4 sm:p-6 border-t border-dark-border">
              
              {/* ===== SEÇÃO: CONFIGURAÇÃO EC CONTROLLER ===== */}
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-dark-text mb-3 sm:mb-4">🎯 Controle Automático de EC</h2>
                <p className="text-xs sm:text-sm text-dark-textSecondary mb-4 sm:mb-6">
                  Configure o sistema adaptativo proporcional para controle automático da condutividade elétrica.
                </p>
                
                {/* ===== TABELA DE NUTRIÇÃO (PRIMEIRO) ===== */}
                <div className="mb-6 sm:mb-8 pb-6 sm:pb-8 border-b border-dark-border">
                  {/* Header com título e botão + Nutriente */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4">
                    <h3 className="text-base sm:text-lg font-bold text-dark-text">Tabela de Nutrição</h3>
                    <button
                      onClick={() => {
                        setEditingNutrientIndex(null);
                        setIsNutrientModalOpen(true);
                      }}
                      disabled={ecControllerLocked}
                      className={`flex items-center justify-center space-x-2 px-4 py-3 sm:py-2 bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white rounded-lg transition-all shadow-lg hover:shadow-aqua-500/50 text-sm sm:text-base w-full sm:w-auto ${
                        ecControllerLocked ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      title={ecControllerLocked ? 'Controles bloqueados' : 'Adicionar nutriente'}
                    >
                      <span className="text-base sm:text-lg">+</span>
                      <span>Nutriente</span>
                    </button>
                  </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label htmlFor="pumpRate" className="block text-sm font-medium text-dark-textSecondary mb-1">
                    Taxa de dosagem (ml/segundo):
                  </label>
                  <input
                    id="pumpRate"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={isNaN(pumpFlowRate) ? '' : pumpFlowRate}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      setPumpFlowRate(isNaN(value) ? 1.0 : value);
                    }}
                    disabled={ecControllerLocked}
                    className={`w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text focus:border-aqua-500 focus:outline-none ${
                      ecControllerLocked ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  />
                </div>
                
                <div>
                  <label htmlFor="totalVolume" className="block text-sm font-medium text-dark-textSecondary mb-1">
                    Volume do Reservatório (L):
                  </label>
                  <input
                    id="totalVolume"
                    type="number"
                    min="1"
                    step="1"
                    value={isNaN(totalVolume) ? '' : totalVolume}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      setTotalVolume(isNaN(value) ? 10 : value);
                    }}
                    disabled={ecControllerLocked}
                    className={`w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text focus:border-aqua-500 focus:outline-none ${
                      ecControllerLocked ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  />
                </div>
              </div>
              
                  {/* ===== TABELA DE NUTRIENTES ===== */}
                  <div className="overflow-x-auto mt-6">
                <table className="w-full">
                  <thead className="bg-dark-surface">
                    <tr>
                      <th className="py-2 px-4 text-left text-sm font-medium text-dark-textSecondary">Nutriente</th>
                      <th className="py-2 px-4 text-left text-sm font-medium text-dark-textSecondary">Relé</th>
                      <th className="py-2 px-4 text-left text-sm font-medium text-dark-textSecondary">ml por Litro</th>
                      <th className="py-2 px-4 text-left text-sm font-medium text-dark-textSecondary">Quantidade (ml)</th>
                      <th className="py-2 px-4 text-left text-sm font-medium text-dark-textSecondary">Tempo (seg)</th>
                      <th className="py-2 px-4 text-left text-sm font-medium text-dark-textSecondary">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nutrientsState.map((nutrient, index) => {
                      const calculateQuantity = (mlPerLiter: number): number => {
                        return mlPerLiter * totalVolume;
                      };

                      const calculateTime = (mlPerLiter: number): number => {
                        return calculateQuantity(mlPerLiter) / pumpFlowRate;
                      };

                          const handleMlPerLiterChange = async (idx: number, value: number) => {
                        const updatedNutrients = [...nutrientsState];
                        updatedNutrients[idx] = { ...updatedNutrients[idx], mlPerLiter: value };
                        setNutrientsState(updatedNutrients);
                            await saveECControllerConfig();
                      };

                          const handleDoseNutrient = async (nut: { name: string; relayNumber: number; mlPerLiter: number }, idx: number) => {
                        let timeNeeded = 0;
                        if (nut.mlPerLiter > 0) {
                          timeNeeded = calculateTime(nut.mlPerLiter);
                          if (timeNeeded <= 0) {
                            toast.error('O tempo de dosagem deve ser maior que zero');
                            return;
                          }
                        } else {
                          timeNeeded = 10;
                        }

                        setIsLoadingNutrients({ ...isLoadingNutrients, [nut.relayNumber]: true });
                        
                        try {
                          const response = await fetch('/api/esp-now/command', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              master_device_id: selectedDeviceId,
                                  slave_mac_address: null,
                              relay_number: nut.relayNumber,
                              action: 'on',
                              duration_seconds: Math.ceil(timeNeeded),
                              triggered_by: 'manual',
                                  command_type: 'manual',
                              rule_name: nut.mlPerLiter > 0 ? `Dosagem: ${nut.name}` : `Ativação: ${nut.name}`,
                            }),
                          });
                          
                          if (response.ok) {
                            if (nut.mlPerLiter > 0) {
                              toast.success(`Dosificando ${nut.name} por ${timeNeeded.toFixed(1)} segundos`);
                            } else {
                              toast.success(`${nut.name} ativado por ${timeNeeded} segundos`);
                            }
                          } else {
                            const error = await response.json();
                            toast.error(`Erro ao acionar ${nut.name}: ${error.error || 'Erro desconhecido'}`);
                          }
                        } catch (error) {
                          toast.error(`Erro: ${error instanceof Error ? error.message : 'Desconhecido'}`);
                        } finally {
                          setTimeout(() => {
                            setIsLoadingNutrients({ ...isLoadingNutrients, [nut.relayNumber]: false });
                          }, 1000);
                        }
                      };

                      return (
                        <tr key={index} className="border-b border-dark-border">
                          <td className="py-2 px-4 text-dark-text">{nutrient.name}</td>
                          <td className="py-2 px-4">
                            <select
                              value={nutrient.relayNumber}
                              onChange={(e) => handleRelayChange(index, parseInt(e.target.value))}
                              className="w-full p-1.5 bg-dark-surface border border-dark-border rounded-md text-dark-text focus:border-aqua-500 focus:outline-none"
                            >
                              {availableRelays.map((relay) => (
                                <option key={relay.number} value={relay.number}>
                                  {relay.number}: {relay.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-4">
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={nutrient.mlPerLiter}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value);
                                handleMlPerLiterChange(index, isNaN(value) ? 0 : value);
                              }}
                              disabled={ecControllerLocked}
                              className={`w-full p-1.5 bg-dark-surface border border-dark-border rounded-md text-dark-text focus:border-aqua-500 focus:outline-none ${
                                ecControllerLocked ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                            />
                          </td>
                          <td className="py-2 px-4 text-dark-text">{calculateQuantity(nutrient.mlPerLiter).toFixed(1)}</td>
                          <td className="py-2 px-4 text-dark-text">{calculateTime(nutrient.mlPerLiter).toFixed(1)}</td>
                          <td className="py-2 px-4">
                                <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleDoseNutrient(nutrient, index)}
                              disabled={isLoadingNutrients[nutrient.relayNumber] || ecControllerLocked}
                              className={`px-3 py-1.5 bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white rounded transition-all shadow-lg hover:shadow-aqua-500/50 ${
                                isLoadingNutrients[nutrient.relayNumber] || ecControllerLocked ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                              title={ecControllerLocked ? 'Controles bloqueados' : isLoadingNutrients[nutrient.relayNumber] ? 'Dosificando...' : 'Dosificar'}
                            >
                              {isLoadingNutrients[nutrient.relayNumber] ? 'Dosificando...' : 'Dosificar'}
                            </button>
                                  <button
                                    onClick={() => {
                                      setEditingNutrientIndex(index);
                                      setIsNutrientModalOpen(true);
                                    }}
                                    disabled={ecControllerLocked}
                                    className={`px-3 py-1.5 bg-dark-surface hover:bg-dark-border border border-dark-border text-dark-text rounded transition-all ${
                                      ecControllerLocked ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                                    title={ecControllerLocked ? 'Controles bloqueados' : 'Editar'}
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={() => {
                                      const updated = nutrientsState.filter((_, i) => i !== index);
                                      setNutrientsState(updated);
                                      saveECControllerConfig();
                                    }}
                                    disabled={ecControllerLocked}
                                    className={`px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded transition-all ${
                                      ecControllerLocked ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                                    title={ecControllerLocked ? 'Controles bloqueados' : 'Remover'}
                                  >
                                    🗑️
                                  </button>
                                </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                  </div>
                </div>
                
                {/* Parâmetros Básicos do EC Controller */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label htmlFor="base-dose" className="block text-sm font-medium text-dark-textSecondary mb-1">
                      Base de dose (EC µS/cm):
                    </label>
                    <input
                      id="base-dose"
                      type="number"
                      min="0"
                      step="1"
                      value={isNaN(baseDose) ? '' : baseDose}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        setBaseDose(isNaN(value) ? 0 : value);
                      }}
                      disabled={ecControllerLocked}
                      className={`w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text focus:border-aqua-500 focus:outline-none ${
                        ecControllerLocked ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      placeholder="Ex: 1525"
                    />
                    <small className="text-xs text-red-400 mt-1 block">
                      EC total concentrada para um litro de solução
                    </small>
                  </div>
                  
                  <div>
                    <label htmlFor="total-ml" className="block text-sm font-medium text-dark-textSecondary mb-1">
                      Soma ml por Litro (concentração):
                    </label>
                    <input
                      id="total-ml"
                      type="number"
                      min="0"
                      step="0.1"
                      value={nutrientsState.reduce((sum, nut) => sum + nut.mlPerLiter, 0).toFixed(1)}
                      readOnly
                      className="w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text focus:border-aqua-500 focus:outline-none opacity-75"
                    />
                    <small className="text-xs text-green-400 mt-1 block">
                      Calculado automaticamente pela soma dos ml/L do plano nutricional
                    </small>
                  </div>
                  
                  <div>
                    <label htmlFor="ec-setpoint" className="block text-sm font-medium text-dark-textSecondary mb-1">
                      EC Setpoint (µS/cm):
                    </label>
                    <input
                      id="ec-setpoint"
                      type="number"
                      min="0"
                      step="10"
                      value={isNaN(ecSetpoint) ? '' : ecSetpoint}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        setEcSetpoint(isNaN(value) ? 0 : value);
                      }}
                      disabled={ecControllerLocked}
                      className={`w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text focus:border-aqua-500 focus:outline-none ${
                        ecControllerLocked ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      placeholder="Ex: 1500"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="intervalo-auto-ec" className="block text-sm font-medium text-dark-textSecondary mb-1">
                      Intervalo entre doses (segundos):
                    </label>
                    <input
                      id="intervalo-auto-ec"
                      type="number"
                      min="1"
                      max="60"
                      step="1"
                      value={isNaN(intervaloAutoEC) ? '' : intervaloAutoEC}
                      onChange={(e) => {
                        const value = parseInt(e.target.value, 10);
                        setIntervaloAutoEC(isNaN(value) ? 300 : value);
                      }}
                      disabled={ecControllerLocked}
                      className={`w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text focus:border-aqua-500 focus:outline-none ${
                        ecControllerLocked ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      placeholder="Ex: 300"
                    />
                    <small className="text-xs text-orange-400 mt-1 block">
                      ⚠️ Tempo de espera entre nutrientes para evitar precipitações químicas
                    </small>
                  </div>
                  
                  <div>
                    <label htmlFor="tempo-recirculacao" className="block text-sm font-medium text-dark-textSecondary mb-1">
                      Tempo de recirculação:
                    </label>
                    <div className="flex items-center gap-2">
                      {/* Input de Horas */}
                      <div className="flex-1">
                        <input
                          id="tempo-recirculacao-hours"
                          type="number"
                          min="0"
                          max="23"
                          step="1"
                          value={tempoRecirculacaoHours}
                          disabled={ecControllerLocked}
                          onChange={(e) => {
                            const value = parseInt(e.target.value, 10);
                            if (!isNaN(value) && value >= 0 && value <= 23) {
                              setTempoRecirculacaoHours(value);
                            } else if (e.target.value === '') {
                              setTempoRecirculacaoHours(0);
                            }
                          }}
                          onBlur={(e) => {
                            if (e.target.value === '' || isNaN(parseInt(e.target.value, 10))) {
                              setTempoRecirculacaoHours(0);
                            }
                          }}
                          className={`w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text focus:border-aqua-500 focus:outline-none text-center font-semibold ${
                            ecControllerLocked ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          placeholder="00"
                        />
                        <small className="text-xs text-dark-textSecondary text-center block mt-1">Horas</small>
                      </div>
                      
                      {/* Separador */}
                      <span className="text-2xl font-bold text-dark-textSecondary pt-6">:</span>
                      
                      {/* Input de Minutos */}
                      <div className="flex-1">
                        <input
                          id="tempo-recirculacao-minutes"
                          type="number"
                          min="0"
                          max="59"
                          step="1"
                          value={tempoRecirculacaoMinutes}
                          disabled={ecControllerLocked}
                          onChange={(e) => {
                            const value = parseInt(e.target.value, 10);
                            if (!isNaN(value) && value >= 0 && value <= 59) {
                              setTempoRecirculacaoMinutes(value);
                            } else if (e.target.value === '') {
                              setTempoRecirculacaoMinutes(0);
                            }
                          }}
                          onBlur={(e) => {
                            if (e.target.value === '' || isNaN(parseInt(e.target.value, 10))) {
                              setTempoRecirculacaoMinutes(1);
                            }
                          }}
                          className={`w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text focus:border-aqua-500 focus:outline-none text-center font-semibold ${
                            ecControllerLocked ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          placeholder="01"
                        />
                        <small className="text-xs text-dark-textSecondary text-center block mt-1">Minutos</small>
                      </div>
                    </div>
                    <small className="text-xs text-gray-400 mt-2 block">
                      Formato: HH:MM (ex: 00:01 = 1 minuto, 01:30 = 1 hora e 30 minutos)
                    </small>
                  </div>
                </div>
                
                {/* Controles e Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Status do EC Controller */}
                  <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
                    <h3 className="text-base font-semibold text-dark-text mb-3">📊 Status do Controle</h3>
                    <div className="space-y-2.5">
                      <div className="flex justify-between">
                        <span className="text-base text-dark-textSecondary">Status:</span>
                        <span className={`text-base font-medium ${autoEnabled ? 'text-green-400' : 'text-red-400'}`}>
                          {autoEnabled ? '✅ Ativado' : '❌ Desativado'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-base text-dark-textSecondary">Erro atual:</span>
                        <span className="text-base font-medium text-dark-text">{Math.abs(ecError).toFixed(1)} µS/cm</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-base text-dark-textSecondary">Última dosagem:</span>
                        <span className="text-base font-medium text-dark-text">{lastDosage.toFixed(2)} ml</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-base text-dark-textSecondary">EC Atual:</span>
                        <span className="text-base font-medium text-dark-text">{ecAtual.toFixed(1)} µS/cm</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Equação de Controle */}
                  <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
                    <h3 className="text-base font-semibold text-dark-text mb-3">🧮 Equação de Controle Proporcional</h3>
                    <div className="space-y-2.5 text-base">
                      <div className="font-mono text-aqua-400 mb-2 text-lg">u(t) = (V / k × q) × e</div>
                      <div className="flex justify-between">
                        <span className="text-dark-textSecondary">V (Volume):</span>
                        <span className="text-dark-text font-medium">{totalVolume} L</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-dark-textSecondary">k (EC base / ml por L):</span>
                        <span className="text-dark-text font-medium">
                          {nutrientsState.reduce((sum, nut) => sum + nut.mlPerLiter, 0) > 0 
                            ? (baseDose / nutrientsState.reduce((sum, nut) => sum + nut.mlPerLiter, 0)).toFixed(3)
                            : '0.000'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-dark-textSecondary">q (Taxa de vazão):</span>
                        <span className="text-dark-text font-medium">{pumpFlowRate.toFixed(3)} ml/s</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-dark-textSecondary">e (Erro EC):</span>
                        <span className="text-dark-text font-medium">{Math.abs(ecError).toFixed(1)} µS/cm</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Botões de Controle */}
                <div className="flex flex-wrap gap-3 mb-4">
                  <button
                    onClick={async () => {
                      await saveECControllerConfig();
                      toast.success('Parâmetros salvos com sucesso!');
                    }}
                    disabled={ecControllerLocked}
                    className={`px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-lg transition-all shadow-lg hover:shadow-green-500/50 ${
                      ecControllerLocked ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    title={ecControllerLocked ? 'Controles bloqueados' : 'Salvar parâmetros'}
                  >
                    💾 Salvar Parâmetros
                  </button>
                  <button
                    onClick={async () => {
                      if (autoEnabled) {
                        // ✅ CORRIGIDO: Desativar - passar auto_enabled = false explicitamente
                        try {
                          // ✅ Passar auto_enabled = false explicitamente para evitar problemas de closure
                          const saved = await saveECControllerConfig(false, false);
                          
                          if (saved) {
                            // ✅ Confirmado: auto_enabled = false em Supabase
                            setAutoEnabled(false);  // Atualizar estado local APENAS após sucesso
                            // ✅ SOLUCIÓN DATA RACE: Marcar que acabamos de guardar para prevenir recarga
                            justSavedRef.current = true;
                            if (savingTimeoutRef.current) {
                              clearTimeout(savingTimeoutRef.current);
                            }
                            savingTimeoutRef.current = setTimeout(() => {
                              justSavedRef.current = false;
                            }, 2000);
                            toast.success('✅ Auto EC desativado');
                            console.log('✅ [EC Controller] Auto EC desativado no Supabase');
                          } else {
                            // ❌ Erro: não atualizar estado local
                            toast.error('❌ Erro ao desativar Auto EC no Supabase');
                            console.error('❌ [EC Controller] Falha ao desativar Auto EC');
                          }
                        } catch (err) {
                          // ❌ Erro: não atualizar estado local
                          console.error('❌ [EC Controller] Erro ao desativar Auto EC:', err);
                          toast.error(`Erro: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
                        }
                      } else {
                        // ✅ NOVA ARQUITETURA: Ativar via RPC activate_auto_ec
                        try {
                          const { data, error } = await supabase.rpc('activate_auto_ec', {
                            p_device_id: selectedDeviceId
                          });
                          
                          if (error) {
                            console.error('❌ [EC Controller] Erro ao ativar Auto EC:', error);
                            toast.error(`Erro ao ativar: ${error.message || 'Erro desconhecido'}`);
                            return;
                          }
                          
                          if (data && data.length > 0) {
                            const config = data[0];
                            // Atualizar estado local com a config retornada
                            setAutoEnabled(true);
                            // ✅ SOLUCIÓN DATA RACE: Marcar que acabamos de activar para prevenir recarga
                            justSavedRef.current = true;
                            if (savingTimeoutRef.current) {
                              clearTimeout(savingTimeoutRef.current);
                            }
                            savingTimeoutRef.current = setTimeout(() => {
                              justSavedRef.current = false;
                            }, 2000);
                            toast.success('✅ Auto EC ativado! Configuração enviada ao ESP32.');
                            console.log('✅ [EC Controller] Auto EC ativado via RPC:', config);
                          } else {
                            toast.error('Configuração não encontrada. Salve os parâmetros primeiro.');
                          }
                        } catch (err) {
                          console.error('❌ [EC Controller] Erro ao chamar RPC activate_auto_ec:', err);
                          toast.error(`Erro: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
                        }
                      }
                    }}
                    disabled={ecControllerLocked}
                    className={`px-4 py-2 rounded-lg transition-all shadow-lg ${
                      autoEnabled
                        ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white'
                        : 'bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white'
                    } ${
                      ecControllerLocked ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    title={ecControllerLocked ? 'Controles bloqueados' : autoEnabled ? 'Desativar Auto EC' : 'Ativar Auto EC'}
                  >
                    {autoEnabled ? '⏹️ Desativar Auto EC' : '🤖 Ativar Auto EC'}
                  </button>
                  <button
                    onClick={() => {
                      setShowECConfigPreview(true);
                    }}
                    disabled={ecControllerLocked}
                    className={`px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-lg transition-all shadow-lg hover:shadow-purple-500/50 ${
                      ecControllerLocked ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    title={ecControllerLocked ? 'Controles bloqueados' : 'Ver preview da configuração'}
                  >
                    🔍 Debug Vista Previa
                  </button>
                  <button
                    onClick={async () => {
                      // ✅ Limpar valores locais
                      setBaseDose(0);
                      setEcSetpoint(0);
                      setIntervaloAutoEC(300);
                      setTempoRecirculacao('00:01');
                      setTempoRecirculacaoHours(0);
                      setTempoRecirculacaoMinutes(1);
                      setAutoEnabled(false);
                      
                      // ✅ Salvar no Supabase
                      const { error } = await supabase
                        .from('ec_config_view')
                        .update({ 
                          base_dose: 0,
                          ec_setpoint: 0,
                          intervalo_auto_ec: 300,
                          tempo_recirculacao: 60,
                          auto_enabled: false,
                          updated_at: new Date().toISOString()
                        })
                        .eq('device_id', selectedDeviceId);
                      
                      if (error) {
                        console.error('❌ Erro ao limpar valores no Supabase:', error);
                        toast.error('Erro ao salvar no banco de dados');
                      } else {
                        // ✅ Prevenir recarga sobrescrevendo valores
                        justSavedRef.current = true;
                        setTimeout(() => { justSavedRef.current = false; }, 2000);
                        toast.success('✅ Valores limpos e salvos');
                      }
                    }}
                    disabled={ecControllerLocked}
                    className={`px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all ${
                      ecControllerLocked ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    title={ecControllerLocked ? 'Controles bloqueados' : 'Limpar valores'}
                  >
                    🗑️ Limpar Valores
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm('🚨 ATENÇÃO: Isso irá parar TODOS os processos e resetar o sistema. Continuar?')) {
                        try {
                          // ✅ CRÍTICO: Actualizar auto_enabled = false en Supabase
                        setAutoEnabled(false);
                          
                          // Actualizar en Supabase para que ESP32 pare inmediatamente
                          const { error } = await supabase
                            .from('ec_config_view')
                            .update({ 
                              auto_enabled: false,
                              updated_at: new Date().toISOString()
                            })
                            .eq('device_id', selectedDeviceId);
                          
                          if (error) {
                            console.error('❌ [EC Controller] Erro ao desativar Auto EC no Supabase:', error);
                            toast.error(`Erro ao desativar: ${error.message}`);
                          } else {
                            // ✅ SOLUCIÓN DATA RACE: Marcar que acabamos de guardar para prevenir recarga
                            justSavedRef.current = true;
                            if (savingTimeoutRef.current) {
                              clearTimeout(savingTimeoutRef.current);
                            }
                            savingTimeoutRef.current = setTimeout(() => {
                              justSavedRef.current = false;
                            }, 2000);
                            console.log('✅ [EC Controller] Auto EC desativado no Supabase (Reset Emergencial)');
                            toast.error('🚨 Reset emergencial executado - Auto EC desativado');
                          }
                        } catch (err) {
                          console.error('❌ [EC Controller] Erro crítico no Reset Emergencial:', err);
                          toast.error('Erro ao executar reset emergencial');
                        }
                      }
                    }}
                    className="px-4 py-2 bg-red-800 hover:bg-red-900 text-white rounded-lg transition-all font-bold"
                  >
                    🚨 RESET EMERGENCIAL
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

      {/* Modal Adicionar/Editar Nutriente */}
      {isNutrientModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-card border border-dark-border rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-dark-text mb-4">
              {editingNutrientIndex !== null ? 'Editar Nutriente' : 'Adicionar Nutriente'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-textSecondary mb-1">
                  Nome do Nutriente
                </label>
                <input
                  type="text"
                  id="nutrientName"
                  defaultValue={editingNutrientIndex !== null ? nutrientsState[editingNutrientIndex]?.name : ''}
                  className="w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text focus:border-aqua-500 focus:outline-none"
                  placeholder="Ex: Grow, Micro, pH-, etc."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-dark-textSecondary mb-1">
                  Relé (Master)
                </label>
                <select
                  id="nutrientRelay"
                  defaultValue={editingNutrientIndex !== null ? nutrientsState[editingNutrientIndex]?.relayNumber : availableRelays[0]?.number || 0}
                  className="w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text focus:border-aqua-500 focus:outline-none"
                >
                  {availableRelays.map((relay) => (
                    <option key={relay.number} value={relay.number}>
                      {relay.number}: {relay.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-dark-textSecondary mb-1">
                  ml por Litro
                </label>
                <input
                  type="number"
                  id="nutrientMlPerLiter"
                  min="0"
                  step="0.1"
                  defaultValue={editingNutrientIndex !== null ? nutrientsState[editingNutrientIndex]?.mlPerLiter : 0}
                  className="w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text focus:border-aqua-500 focus:outline-none"
                  placeholder="0.0"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setIsNutrientModalOpen(false);
                  setEditingNutrientIndex(null);
                }}
                className="px-4 py-2 bg-dark-surface hover:bg-dark-border border border-dark-border text-dark-text rounded-lg transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const nameInput = document.getElementById('nutrientName') as HTMLInputElement;
                  const relayInput = document.getElementById('nutrientRelay') as HTMLSelectElement;
                  const mlInput = document.getElementById('nutrientMlPerLiter') as HTMLInputElement;
                  
                  if (!nameInput?.value.trim()) {
                    toast.error('Nome do nutriente é obrigatório');
                    return;
                  }
                  
                  const newNutrient = {
                    name: nameInput.value.trim(),
                    relayNumber: parseInt(relayInput.value, 10),
                    mlPerLiter: parseFloat(mlInput.value) || 0,
                  };
                  
                  if (editingNutrientIndex !== null) {
                    // Editar nutriente existente
                    const updated = [...nutrientsState];
                    updated[editingNutrientIndex] = newNutrient;
                    setNutrientsState(updated);
                  } else {
                    // Adicionar novo nutriente
                    setNutrientsState([...nutrientsState, newNutrient]);
                  }
                  
                  // Salvar nome do nutriente no relé escolhido
                  if (selectedDeviceId && selectedDeviceId !== 'default_device') {
                    await saveMasterLocalRelayName(selectedDeviceId, newNutrient.relayNumber, newNutrient.name);
                    await loadLocalRelayNames();
                  }
                  
                  setIsNutrientModalOpen(false);
                  setEditingNutrientIndex(null);
                  
                  // Toast de confirmação antes de salvar
                  if (editingNutrientIndex !== null) {
                    toast.success(`Nutriente "${newNutrient.name}" editado! Salvando no Supabase...`);
                  } else {
                    toast.success(`Nutriente "${newNutrient.name}" adicionado! Salvando no Supabase...`);
                  }
                  
                  // Salvar automaticamente no Supabase (modo silencioso para evitar toast duplicado)
                  const saved = await saveECControllerConfig(true);
                  
                  if (saved) {
                    if (editingNutrientIndex !== null) {
                      toast.success(`✅ Nutriente "${newNutrient.name}" salvo no Supabase!`);
                    } else {
                      toast.success(`✅ Nutriente "${newNutrient.name}" salvo no Supabase!`);
                    }
                  }
                }}
                className="px-4 py-2 bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white rounded-lg transition-all shadow-lg hover:shadow-aqua-500/50"
              >
                {editingNutrientIndex !== null ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}

        <div className="mt-8 bg-dark-surface border border-dark-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-dark-text mb-2 flex items-center">
            <ClockIcon className="w-5 h-5 mr-2 text-aqua-400" />
            Histórico de Execuções
          </h3>
          <p className="text-dark-textSecondary">
            As regras automáticas executadas aparecerão aqui. Nenhuma execução registrada ainda.
          </p>
        </div>
      </main>

      <CreateRuleModal
        isOpen={isModalOpen}
        deviceId={selectedDeviceId}
        onClose={() => {
          setIsModalOpen(false);
          setEditingRule(null); // ✅ Resetar regra de edição ao fechar
        }}
        editingRule={editingRule}
        onSave={handleSaveRule}
        relays={[
          // ✅ Mapear relays Master automaticamente
          ...availableRelays.map(r => ({ 
            id: r.number, 
            name: r.name,
            device: 'master' as const
          })),
          // ✅ Mapear relays Slaves automaticamente
          ...espnowSlaves.flatMap(slave => 
            slave.relays.map(relay => ({
              id: relay.id + 1000, // Offset para não conflitar com master (0-6 = PCF1)
              name: `${slave.name} - ${relay.name || `Relé ${relay.id + 1}`}`,
              device: 'slave' as const,
              slaveMac: slave.macAddress
            }))
          )
        ]}
        onUpdateRelay={handleUpdateRelay}
      />

      {/* Modal de Vista Previa JSON */}
      {jsonPreviewRule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-dark-border">
              <h2 className="text-xl font-bold text-dark-text">
                📦 Vista Previa JSON - {jsonPreviewRule.name || jsonPreviewRule.rule_name}
              </h2>
              <button
                onClick={() => setJsonPreviewRule(null)}
                className="p-2 hover:bg-dark-surface rounded-lg transition-colors text-dark-textSecondary hover:text-dark-text"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Content - JSON formateado */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
                <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-words overflow-x-auto">
                  {JSON.stringify({
                    device_id: selectedDeviceId,
                    rule_id: jsonPreviewRule.rule_id || `RULE_${jsonPreviewRule.id}`,
                    rule_name: jsonPreviewRule.rule_name || jsonPreviewRule.name,
                    rule_description: jsonPreviewRule.rule_description || jsonPreviewRule.description,
                    rule_json: jsonPreviewRule.rule_json || {
                      conditions: jsonPreviewRule.conditions || [],
                      actions: jsonPreviewRule.actions || [],
                    },
                    enabled: jsonPreviewRule.enabled,
                    priority: jsonPreviewRule.priority || 50,
                    created_by: userProfile?.email || 'system',
                  }, null, 2)}
                </pre>
              </div>
              
              {/* Informação adicional */}
              <div className="mt-4 p-4 bg-aqua-500/10 border border-aqua-500/30 rounded-lg">
                <p className="text-xs text-aqua-300 mb-2">
                  💡 Este é o JSON completo que será enviado/salvo no Supabase (tabela decision_rules)
                </p>
                <p className="text-xs text-gray-400">
                  Este formato é o mesmo que aparece no console.log quando a regra é criada.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end p-6 border-t border-dark-border">
              <button
                onClick={() => setJsonPreviewRule(null)}
                className="px-4 py-2 bg-dark-surface hover:bg-dark-border text-dark-text border border-dark-border rounded-lg text-sm font-medium transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Vista Previa JSON - EC Config */}
      {showECConfigPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-dark-border">
              <h2 className="text-xl font-bold text-dark-text">
                🔍 Debug Vista Previa - EC Controller Config
              </h2>
              <button
                onClick={() => setShowECConfigPreview(false)}
                className="p-2 hover:bg-dark-surface rounded-lg transition-colors text-dark-textSecondary hover:text-dark-text"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Content - JSON formateado */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
                <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-words overflow-x-auto">
                  {JSON.stringify(getECConfigJson(), null, 2)}
                </pre>
              </div>
              
              {/* Informação adicional */}
              <div className="mt-4 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <p className="text-xs text-purple-300 mb-2">
                  💡 Este é o JSON completo que será enviado/salvo no Supabase (tabela ec_config_view)
                </p>
                <p className="text-xs text-gray-400 mb-2">
                  Este formato é o mesmo que aparece no console.log quando a configuração é salva.
                </p>
                <div className="mt-3 space-y-1 text-xs text-gray-400">
                  <p><strong className="text-purple-300">device_id:</strong> ID do dispositivo Master</p>
                  <p><strong className="text-purple-300">base_dose:</strong> EC base em µS/cm</p>
                  <p><strong className="text-purple-300">flow_rate:</strong> Taxa de vazão da bomba (ml/s)</p>
                  <p><strong className="text-purple-300">volume:</strong> Volume total do reservatório (L)</p>
                  <p><strong className="text-purple-300">total_ml:</strong> Soma de ml/L de todos os nutrientes</p>
                  <p><strong className="text-purple-300">ec_setpoint:</strong> Setpoint desejado de EC (µS/cm)</p>
                  <p><strong className="text-purple-300">auto_enabled:</strong> Controle automático ativado?</p>
                  <p><strong className="text-purple-300">nutrients:</strong> Array de nutrientes com relés e ml/L</p>
                  <p><strong className="text-purple-300">intervalo_auto_ec:</strong> Intervalo entre verificações (segundos)</p>
                  <p><strong className="text-purple-300">tempo_recirculacao:</strong> Tempo de recirculação em milisegundos (ex: 60000 = 1 minuto). No JSON de debug também mostra formato HH:MM:SS</p>
                  <p className="mt-2 text-purple-300"><strong>_debug:</strong> Informações calculadas adicionais para debug</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-dark-border">
              <button
                onClick={() => {
                  const jsonStr = JSON.stringify(getECConfigJson(), null, 2);
                  navigator.clipboard.writeText(jsonStr);
                  toast.success('JSON copiado para a área de transferência!');
                }}
                className="px-4 py-2 bg-dark-surface hover:bg-dark-border text-dark-text border border-dark-border rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <ClipboardIcon className="w-4 h-4" />
                Copiar JSON
              </button>
              <button
                onClick={() => setShowECConfigPreview(false)}
                className="px-4 py-2 bg-dark-surface hover:bg-dark-border text-dark-text border border-dark-border rounded-lg text-sm font-medium transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

