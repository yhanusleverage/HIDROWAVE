'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import NavLink from '@/components/NavLink';
import { toast, type Toast } from 'react-hot-toast';
import { hwToast } from '@/lib/control-toast';
import BrandLoading from '@/components/BrandLoading';
import OperationStateBadges from '@/components/OperationStateBadges';
import OperationStateBanners from '@/components/OperationStateBanners';
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  LockClosedIcon,
  LockOpenIcon,
  PencilIcon,
  EyeIcon,
  XMarkIcon,
  ClipboardIcon,
  ClipboardDocumentCheckIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { formatSensorValue } from '@/lib/format-sensor-value';
import { formatInstructionType } from '@/lib/instruction-labels';
import { getDecisionRules, createDecisionRule, updateDecisionRule, deleteDecisionRule, DecisionRule } from '@/lib/automation';
import { useDevicesWithRealtime } from '@/hooks/useDevicesWithRealtime';
import { useAuth } from '@/contexts/AuthContext';
import { getESPNOWSlaves, ESPNowSlave } from '@/lib/esp-now-slaves';
import { supabase } from '@/lib/supabase';
import { subscribeRelayStateUpdates, type RelayMasterRow } from '@/lib/realtime/relay-states';
import {
  applySlaveRelayRow,
  mergeRelayStatesMap,
  RELAY_REST_FALLBACK_MS,
} from '@/lib/realtime/relay-apply';
import { useLastDosage } from '@/hooks/useLastDosage';
import { useEcOperationState } from '@/hooks/useEcOperationState';
import { useHydroEcReading } from '@/hooks/useHydroEcReading';
import { setVisibleInterval } from '@/lib/realtime/visible-interval';
import {
  isSlaveDeviceRow,
  patchSlaveFromDeviceStatus,
  SLAVES_METADATA_FALLBACK_MS,
} from '@/lib/realtime/slave-status';
import { subscribeDeviceStatusUpdates } from '@/lib/realtime/device-status';
import { subscribeRelayCommandUpdates } from '@/lib/realtime/relay-commands';
import { applyRelayCommandAck, type PendingRelayCommand } from '@/lib/relay-pending-commands';
import { sendSlaveRelayCommand } from '@/lib/slave-relay-command';
// Removido: import { getRelayStates } from '@/lib/automation'; // ❌ Não usar mais relay_states
import { getMasterLocalRelayNames, saveMasterLocalRelayName } from '@/lib/nutrition-plan';
import { formatFlowRate } from '@/lib/pump-calibration';
import { useRelayAllocation } from '@/hooks/useRelayAllocation';
import { DoserRelaySelect } from '@/components/DoserRelaySelect';
import { DoserRelayMapPanel } from '@/components/DoserRelayMapPanel';
import { serializeRegistryForDebug, validateEcNutrientsAssignment } from '@/lib/relay-allocation';
import {
  composeRelayControlDisabled,
  getManualPendingRelaySet,
  isEcCycleActive,
  resolveEcManualDoseButtonLock,
  resolveRelayNamingLock,
} from '@/lib/relay-naming-lock';
import { parseConfigApiError, sanitizeEcNumericFields } from '@/lib/controller-config-api';
import { InstrumentCard } from '@/components/ui/InstrumentCard';
import { MetricRow } from '@/components/ui/MetricRow';
import ControllerMetricsPanel from '@/components/ControllerMetricsPanel';

const SectionSkeleton = ({ className = 'h-32' }: { className?: string }) => (
  <div className={`animate-pulse rounded-lg bg-dark-surface border border-dark-border ${className}`} />
);

const CreateRuleModal = dynamic(() => import('@/components/CreateRuleModal'), {
  ssr: false,
  loading: () => null,
});

const RuleCard = dynamic(() => import('@/components/RuleCard'), {
  loading: () => <SectionSkeleton className="h-40" />,
});

const PhControllerPanel = dynamic(() => import('@/components/PhControllerPanel'), {
  loading: () => <SectionSkeleton className="h-48" />,
});

const WaterLevelSection = dynamic(
  () => import('@/components/WaterLevelSection').then((m) => m.WaterLevelSection),
  { loading: () => <SectionSkeleton className="h-48" /> }
);

const NutrientDosageDetail = dynamic(
  () => import('@/components/NutrientDosageDetail').then((m) => m.NutrientDosageDetail),
  { loading: () => <SectionSkeleton className="h-16" /> }
);

const EcDilutionSection = dynamic(
  () => import('@/components/EcDilutionSection').then((m) => m.EcDilutionSection),
  { loading: () => <SectionSkeleton className="h-40" /> }
);

/** Mínimo ml/L por nutriente na tabela nutricional (Auto EC). Para excluir um nutriente, remova a linha. */
const MIN_NUTRIENT_ML_PER_LITER = 0.1;

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

export default function AutomacaoPageClient() {
  const { userProfile } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null); // ✅ Regra sendo editada
  const [jsonPreviewRule, setJsonPreviewRule] = useState<AutomationRule | null>(null); // ✅ Regra para vista previa JSON
  const [showECConfigPreview, setShowECConfigPreview] = useState<boolean>(false); // ✅ Vista previa de EC Config
  const [copiedRuleId, setCopiedRuleId] = useState<string | null>(null); // ✅ rule_id copiado para feedback visual
  const [loading, setLoading] = useState(true);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('default_device');
  const { masters: availableMasters } = useDevicesWithRealtime(userProfile?.email);
  
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
  const [timerModes, setTimerModes] = useState<Map<string, 'timed_on' | 'timed_off'>>(new Map());
  const [showTimerInput, setShowTimerInput] = useState<string | null>(null);
  
  // ✅ NOVO: Estados para ciclos programados (relayKey -> { onDuration: number, offDuration: number, enabled: boolean })
  const [relayCycles, setRelayCycles] = useState<Map<string, { onDuration: number; offDuration: number; enabled: boolean }>>(new Map());
  const [showCycleInput, setShowCycleInput] = useState<string | null>(null); // relayKey que está mostrando input de ciclo
  
  // ✅ NOVO: Mapeamento Command ID → Relay Key (padrão indústria)
  const commandToRelayMap = useRef<Map<string | number, PendingRelayCommand>>(new Map());
  
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
  const [ecTolerance, setEcTolerance] = useState<number>(50); // Banda muerta µS/cm
  const [intervaloAutoEC, setIntervaloAutoEC] = useState<number>(300); // Intervalo entre verificações (segundos)
  const [tempoRecirculacao, setTempoRecirculacao] = useState<string>('00:02'); // Tempo de recirculação (formato HH:MM)
  const [tempoRecirculacaoHours, setTempoRecirculacaoHours] = useState<number>(0);
  const [tempoRecirculacaoMinutes, setTempoRecirculacaoMinutes] = useState<number>(2);
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

  /** BD/firmware: tempo_recirculacao em segundos → HH:MM para UI */
  const secondsToHHMM = (totalSec: number): string => {
    const sec = Math.max(0, Math.floor(totalSec));
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };
  
  // ✅ EC Controller - Status e Monitoramento
  const [ecError, setEcError] = useState<number>(0); // Erro atual (µS/cm)
  // ✅ REMOVIDO: Nutrientes hardcodeados - agora inicia vazio e carrega apenas do Supabase
  const [nutrientsState, setNutrientsState] = useState<Array<{name: string, relayNumber: number, mlPerLiter: number}>>([]);
  const [isLoadingNutrients, setIsLoadingNutrients] = useState<Record<number, boolean>>({});
  const [isNutrientModalOpen, setIsNutrientModalOpen] = useState<boolean>(false);
  const [editingNutrientIndex, setEditingNutrientIndex] = useState<number | null>(null);
  const [modalRelayNumber, setModalRelayNumber] = useState(0);
  
  // ✅ NOVO: Nomes de relés LOCAIS do Master
  const [localRelayNames, setLocalRelayNames] = useState<Map<number, string>>(new Map());
  const [availableRelays, setAvailableRelays] = useState<Array<{number: number, name: string}>>([]);
  const [doserRelayStates, setDoserRelayStates] = useState<boolean[]>([]);

  const loadDoserRelayStates = useCallback(async () => {
    if (!selectedDeviceId || selectedDeviceId === 'default_device') return;

    try {
      const { data, error } = await supabase
        .from('relay_master')
        .select('doser_relay_states')
        .eq('device_id', selectedDeviceId)
        .maybeSingle();

      if (error) {
        console.warn('[EC Controller] relay_master doser states:', error.message);
        return;
      }
      if (data?.doser_relay_states?.length) {
        setDoserRelayStates(data.doser_relay_states);
      }
    } catch (err) {
      console.warn('[EC Controller] Falha ao carregar doser_relay_states:', err);
    }
  }, [selectedDeviceId]);

  const ecDeviceActive = Boolean(
    selectedDeviceId && selectedDeviceId !== 'default_device'
  );

  const relayAllocation = useRelayAllocation(selectedDeviceId, {
    enabled: ecDeviceActive,
  });

  const ecRelayRegistry = useMemo(
    () =>
      relayAllocation.buildRegistry({
        ecConfig: {
          nutrients: nutrientsState.map((n) => ({
            name: n.name,
            relay: n.relayNumber,
            mlPerLiter: n.mlPerLiter,
            active: true,
          })),
        },
      }),
    [relayAllocation, nutrientsState]
  );

  useEffect(() => {
    if (!isNutrientModalOpen) return;
    if (editingNutrientIndex !== null) {
      setModalRelayNumber(nutrientsState[editingNutrientIndex]?.relayNumber ?? 0);
      return;
    }
    const selectable = relayAllocation.getSelectableRelays({
      field: 'ec_nutrient',
      currentValue: 0,
      nutrientIndex: nutrientsState.length,
    });
    setModalRelayNumber(selectable[0]?.number ?? 0);
  }, [
    isNutrientModalOpen,
    editingNutrientIndex,
    nutrientsState,
    relayAllocation,
    ecRelayRegistry,
  ]);

  const { ec: ecAtual, ph: phAtual, phRaw } = useHydroEcReading(
    selectedDeviceId,
    ecDeviceActive
  );

  useEffect(() => {
    if (ecAtual === null) {
      setEcError(0);
      return;
    }
    setEcError(ecSetpoint - ecAtual);
  }, [ecAtual, ecSetpoint]);

  const ecDoseThreshold = useMemo(
    () => ecSetpoint - ecTolerance,
    [ecSetpoint, ecTolerance]
  );

  const ecWithinDeadBand = useMemo(() => {
    if (ecAtual === null || isNaN(ecAtual)) return null;
    return ecAtual >= ecDoseThreshold;
  }, [ecAtual, ecDoseThreshold]);

  const {
    totalMl: lastDosageMl,
    sequenceId: lastDosageSequenceId,
  } = useLastDosage(selectedDeviceId, ecDeviceActive);

  const {
    isDosando: firmwareDosando,
    isAguardandoRecirculacao,
    operationRemainingSec: recirculacaoRestanteSec,
    nextCheckInSec: ecNextCheckInSec,
    isEcCheckPending,
    isDiluting,
  } = useEcOperationState(selectedDeviceId, ecDeviceActive, {
    intervalCeilingSec: intervaloAutoEC,
    autoEnabled,
  });

  const isDosandoRelayFallback = useMemo(() => {
    if (!autoEnabled || doserRelayStates.length === 0 || nutrientsState.length === 0) {
      return false;
    }
    return nutrientsState.some(
      (nut) => nut.relayNumber >= 0 && doserRelayStates[nut.relayNumber] === true
    );
  }, [autoEnabled, doserRelayStates, nutrientsState]);

  /** Firmware ec_operation_state; fallback relé se colunas ainda não migradas */
  const isDosando =
    autoEnabled && (firmwareDosando || isDosandoRelayFallback);

  const ecOperationSlice = useMemo(
    () => ({ isDosando, isAguardandoRecirculacao, isDiluting }),
    [isDosando, isAguardandoRecirculacao, isDiluting]
  );

  const manualPendingRelays = useMemo(
    () => getManualPendingRelaySet(relayAllocation.pendingCommands),
    [relayAllocation.pendingCommands]
  );

  const ecNamingGloballyLocked = isEcCycleActive(ecOperationSlice);

  const getEcRelayNamingLock = useCallback(
    (relayNumber: number) =>
      resolveRelayNamingLock({
        relayNumber,
        domain: 'ec',
        ec: ecOperationSlice,
        manualPendingRelays,
        ecManualDosingRelay: Boolean(isLoadingNutrients[relayNumber]),
      }),
    [ecOperationSlice, manualPendingRelays, isLoadingNutrients]
  );

  const ecGlobalNamingLock = useMemo(
    () =>
      ecNamingGloballyLocked
        ? resolveRelayNamingLock({
            relayNumber: 0,
            domain: 'ec',
            ec: ecOperationSlice,
          })
        : { locked: false as const, tooltip: '' },
    [ecNamingGloballyLocked, ecOperationSlice]
  );

  const modalRelayNamingLock = useMemo(() => {
    const baseRelay =
      editingNutrientIndex !== null
        ? nutrientsState[editingNutrientIndex]?.relayNumber ?? modalRelayNumber
        : modalRelayNumber;
    const currentLock = getEcRelayNamingLock(baseRelay);
    const targetLock = getEcRelayNamingLock(modalRelayNumber);
    if (currentLock.locked) return currentLock;
    if (targetLock.locked) return targetLock;
    return { locked: false as const, tooltip: '' };
  }, [editingNutrientIndex, nutrientsState, modalRelayNumber, getEcRelayNamingLock]);

  const addNutrientControl = useMemo(
    () => composeRelayControlDisabled(ecControllerLocked, ecGlobalNamingLock),
    [ecControllerLocked, ecGlobalNamingLock]
  );

  const modalNutrientControl = useMemo(
    () => composeRelayControlDisabled(ecControllerLocked, modalRelayNamingLock),
    [ecControllerLocked, modalRelayNamingLock]
  );

  const showEcNextCheck =
    autoEnabled &&
    !isDosando &&
    !isAguardandoRecirculacao &&
    (isEcCheckPending || ecNextCheckInSec > 0);

  const formatRecircCountdown = useCallback((totalSec: number) => {
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    if (minutes > 0) {
      return `${minutes}:${String(seconds).padStart(2, '0')}`;
    }
    return `${seconds}s`;
  }, []);

  useEffect(() => {
    if (availableMasters.length > 0 && selectedDeviceId === 'default_device') {
      setSelectedDeviceId(availableMasters[0].device_id || 'default_device');
    }
  }, [availableMasters, selectedDeviceId]);

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
      if (config.tolerance !== undefined && !isNaN(config.tolerance)) setEcTolerance(config.tolerance);
      if (config.intervalo_auto_ec !== undefined && !isNaN(config.intervalo_auto_ec)) setIntervaloAutoEC(config.intervalo_auto_ec);
      if (config.tempo_recirculacao !== undefined && config.tempo_recirculacao !== null) {
        // ✅ BD/firmware: tempo_recirculacao em SEGUNDOS (integer)
        const sec =
          typeof config.tempo_recirculacao === 'number'
            ? config.tempo_recirculacao
            : parseInt(String(config.tempo_recirculacao), 10);

        if (!isNaN(sec) && sec > 0) {
          const timeStr = secondsToHHMM(sec);
          setTempoRecirculacao(timeStr);
          const parts = timeStr.split(':');
          if (parts.length >= 2) {
            setTempoRecirculacaoHours(parseInt(parts[0], 10) || 0);
            setTempoRecirculacaoMinutes(parseInt(parts[1], 10) || 1);
          }
        } else {
          console.warn('⚠️ [EC Controller] tempo_recirculacao inválido ao carregar, usando default:', config.tempo_recirculacao);
          setTempoRecirculacao('00:02'); // Default: 2 minutos
          setTempoRecirculacaoHours(0);
          setTempoRecirculacaoMinutes(2);
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
    const activeNutrients = nutrientsState.filter(
      (n) => n.mlPerLiter >= MIN_NUTRIENT_ML_PER_LITER
    );
    const totalMlPerLiter = activeNutrients.reduce((sum, nut) => sum + nut.mlPerLiter, 0);
    
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
    
    // u(t) = (V / (k × q)) × e — e = SP − EC (só déficit, alinhado ao firmware)
    const error = Math.max(0, ecError);
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
    
    activeNutrients.forEach(nut => {
      if (nut.mlPerLiter >= MIN_NUTRIENT_ML_PER_LITER && totalMlPerLiter > 0) {
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
    if (!selectedDeviceId || selectedDeviceId === 'default_device') return false;

    const invalidNutrients = nutrientsState.filter(
      (n) => n.mlPerLiter < MIN_NUTRIENT_ML_PER_LITER
    );
    if (invalidNutrients.length > 0) {
      toast.error(
        `Cada nutriente deve ter pelo menos ${MIN_NUTRIENT_ML_PER_LITER} ml/L (ex.: ${invalidNutrients[0].name}). Para excluir um nutriente, remova a linha da tabela.`
      );
      return false;
    }

    if (nutrientsState.length === 0) {
      toast.error('Adicione pelo menos um nutriente na tabela nutricional');
      return false;
    }
    
    try {
      const activeNutrients = nutrientsState.filter(
        (n) => n.mlPerLiter >= MIN_NUTRIENT_ML_PER_LITER
      );

      const nutrientsJson = activeNutrients.map((nut) => ({
        name: nut.name,
        relay: nut.relayNumber,
        mlPerLiter: nut.mlPerLiter,
        active: true,
      }));
      
      const totalMl = activeNutrients.reduce((sum, nut) => sum + nut.mlPerLiter, 0);
      
      interface ECConfigPayload {
        device_id: string;
        base_dose: number;
        flow_rate: number;
        volume: number;
        total_ml: number;
        kp: number;
      ec_setpoint: number;
      tolerance: number;
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
        tolerance: ecTolerance,
        auto_enabled: overrideAutoEnabled !== undefined ? overrideAutoEnabled : autoEnabled,
        nutrients: nutrientsJson, // ✅ Se necesita para que ESP32 sepa qué relé usar
      };
      
      // Adicionar intervalo_auto_ec (requer coluna criada via script SQL)
      if (intervaloAutoEC !== undefined && intervaloAutoEC !== null) {
        payload.intervalo_auto_ec = Math.max(1, Math.floor(Number(intervaloAutoEC) || 300));
      }
      
      // ✅ ATUALIZADO: Converter tempo_recirculacao de HH:MM para SEGUNDOS (INTEGER)
      // ✅ IMPORTANTE: Enviar em SEGUNDOS, no milisegundos ni formato string
      let tempoRecirculacaoSegundos = 120; // Default: 120 segundos (2 minutos)
      
      if (tempoRecirculacao !== undefined && tempoRecirculacao !== null && tempoRecirculacao.trim() !== '') {
        // Validar formato HH:MM
        if (validateTimeFormat(tempoRecirculacao)) {
          // Converter HH:MM para SEGUNDOS (no milisegundos)
          const ms = timeToMilliseconds(tempoRecirculacao);
          if (ms > 0 && !isNaN(ms) && isFinite(ms)) {
            tempoRecirculacaoSegundos = Math.floor(ms / 1000); // ✅ Convertir a SEGUNDOS
            if (tempoRecirculacaoSegundos < 1) {
              tempoRecirculacaoSegundos = 120; // Mínimo fallback: 2 minutos
            }
          } else {
            console.warn('⚠️ [EC Controller] tempo_recirculacao resultou em valor inválido, usando default:', tempoRecirculacao, ms);
          }
        } else {
          console.warn('⚠️ [EC Controller] tempo_recirculacao não passou na validação regex, usando default:', tempoRecirculacao);
        }
      }
      
      // ✅ SEMPRE enviar tempo_recirculacao como INTEGER em SEGUNDOS (constraint requer > 0)
      payload.tempo_recirculacao = Math.max(1, tempoRecirculacaoSegundos);

      const relayCheck = validateEcNutrientsAssignment(
        nutrientsJson,
        relayAllocation.phConfig ?? undefined
      );
      if (!relayCheck.ok) {
        toast.error(relayCheck.error || 'Conflito de relés EC/pH');
        return false;
      }

      const sanitizedPayload = sanitizeEcNumericFields(
        payload as unknown as Record<string, unknown>
      ) as typeof payload;
      
      console.log('📤 [EC Controller] Payload optimizado:', JSON.stringify(sanitizedPayload, null, 2));
      
      const response = await fetch('/api/ec-controller/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitizedPayload),
      });
      
      if (!response.ok) {
        const parsed = await parseConfigApiError(response);
        console.error('❌ [EC Controller] Erro ao salvar:', {
          status: parsed.status,
          message: parsed.message,
          body: parsed.body,
          payload: sanitizedPayload,
          device_id: selectedDeviceId,
        });
        toast.error(`Erro ao salvar: ${parsed.message}`);
        return false;
      }
      
      const result = await response.json();
      console.log('✅ [EC Controller] Configuração salva com sucesso em ec_config_view:', result);
      void relayAllocation.refresh();
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
        hwToast.success('Configuração salva com sucesso!', 'AUTO EC');
      }
      return true;
    } catch (error) {
      console.error('❌ [EC Controller] Erro ao salvar config:', error);
      toast.error(`Erro: ${error instanceof Error ? error.message : 'Desconhecido'}`);
      return false;
    }
  }, [selectedDeviceId, nutrientsState, pumpFlowRate, totalVolume, baseDose, ecSetpoint, ecTolerance, intervaloAutoEC, tempoRecirculacao, autoEnabled, availableRelays, relayAllocation]);
  
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
    const activeNutrients = nutrientsState.filter(
      (n) => n.mlPerLiter >= MIN_NUTRIENT_ML_PER_LITER
    );
    const nutrientsJson = activeNutrients.map((nut) => ({
      name: nut.name,
      relay: nut.relayNumber,
      mlPerLiter: nut.mlPerLiter,
      active: true,
      relayName: availableRelays.find(r => r.number === nut.relayNumber)?.name || `Relay ${nut.relayNumber}`,
    }));
    
    const totalMl = activeNutrients.reduce((sum, nut) => sum + nut.mlPerLiter, 0);
    const kFactor = totalMl > 0 ? baseDose / totalMl : 0;
    
    interface ECConfigJSON {
      device_id: string;
      base_dose: number;
      flow_rate: number;
      volume: number;
      total_ml: number;
      kp: number;
      ec_setpoint: number;
      tolerance?: number;
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
      tolerance: ecTolerance,
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
      k_factor: kFactor > 0 ? kFactor.toFixed(3) : '—',
      equation: kFactor > 0
        ? `u(t) = (${totalVolume} / ${kFactor.toFixed(3)} × ${pumpFlowRate}) × e`
        : 'Configure nutrientes com ml/L > 0 para calcular k',
      tolerance_us_cm: ecTolerance,
      relay_allocation: serializeRegistryForDebug(
        relayAllocation.buildRegistry({
          ecConfig: {
            nutrients: nutrientsJson.map((n) => ({
              name: n.name,
              relay: n.relay,
              mlPerLiter: n.mlPerLiter,
              active: true,
            })),
          },
        })
      ),
      note: '✅ JSON optimizado: Sin distribution (se calcula en ESP32), tempo_recirculacao en SEGUNDOS',
    };
    
    return ecConfigJson;
  }, [selectedDeviceId, nutrientsState, pumpFlowRate, totalVolume, baseDose, ecSetpoint, ecTolerance, intervaloAutoEC, tempoRecirculacao, autoEnabled, availableRelays, relayAllocation]);
  
  // ✅ NOVO: Salvar mapeamento nutriente → relé
  const handleRelayChange = useCallback(async (nutrientIndex: number, newRelayNumber: number) => {
    const nutrient = nutrientsState[nutrientIndex];
    const currentRelay = nutrient?.relayNumber ?? newRelayNumber;
    const lockCurrent = getEcRelayNamingLock(currentRelay);
    const lockTarget = getEcRelayNamingLock(newRelayNumber);
    if (lockCurrent.locked || lockTarget.locked) {
      toast.error(lockTarget.locked ? lockTarget.tooltip : lockCurrent.tooltip);
      return;
    }

    const updatedNutrients = [...nutrientsState];
    updatedNutrients[nutrientIndex] = {
      ...updatedNutrients[nutrientIndex],
      relayNumber: newRelayNumber,
    };
    setNutrientsState(updatedNutrients);
    
    // Salvar nome do nutriente no relé escolhido
    if (selectedDeviceId && selectedDeviceId !== 'default_device') {
      const updatedNutrient = updatedNutrients[nutrientIndex];
      await saveMasterLocalRelayName(selectedDeviceId, newRelayNumber, updatedNutrient.name);
      
      // Atualizar nomes locais
      await loadLocalRelayNames();
      
      // Salvar automaticamente no Supabase
      await saveECControllerConfig();
    }
  }, [selectedDeviceId, nutrientsState, loadLocalRelayNames, saveECControllerConfig, getEcRelayNamingLock]);
  
  const totalMlPerLiter = useMemo(
    () => nutrientsState.reduce((sum, nut) => sum + nut.mlPerLiter, 0),
    [nutrientsState]
  );

  const canActivateAutoEc = useMemo(() => {
    const activeCount = nutrientsState.filter((n) => n.mlPerLiter >= MIN_NUTRIENT_ML_PER_LITER).length;
    return activeCount > 0 && totalMlPerLiter > 0;
  }, [nutrientsState, totalMlPerLiter]);

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

  // Sincronizar vazão após calibragem em /calibragem
  useEffect(() => {
    const onFlowRateUpdated = (e: Event) => {
      const detail = (e as CustomEvent<{ deviceId: string; flowRate: number }>).detail;
      if (detail?.deviceId === selectedDeviceId && detail.flowRate > 0) {
        setPumpFlowRate(detail.flowRate);
      }
    };
    window.addEventListener('flowRateUpdated', onFlowRateUpdated);
    return () => window.removeEventListener('flowRateUpdated', onFlowRateUpdated);
  }, [selectedDeviceId]);

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

  // Slaves online/offline — WSS device_status (instantáneo)
  useEffect(() => {
    if (!userProfile?.email) return;

    return subscribeDeviceStatusUpdates(userProfile.email, (event) => {
      const { row } = event;
      if (!isSlaveDeviceRow(row)) return;

      setEspnowSlaves((prev) => {
        const { slaves: patched, matched } = patchSlaveFromDeviceStatus(prev, row);
        if (!matched && event.type === 'insert') {
          loadESPNOWSlaves();
        }
        return matched ? patched : prev;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.email]);

  // Metadata slaves (nombres) — REST muy lento; estados y online van por WSS
  useEffect(() => {
    if (!selectedDeviceId || selectedDeviceId === 'default_device') return;

    return setVisibleInterval(() => {
      loadESPNOWSlaves();
    }, SLAVES_METADATA_FALLBACK_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeviceId, userProfile?.email]);

  const processCommandAck = useCallback(
    (commandId: number | string, status: string, action?: string, relayNumber?: number) => {
      applyRelayCommandAck(
        commandToRelayMap.current,
        commandId,
        status,
        {
          onCompleted: (relayKey, ackAction) => {
            if (ackAction === 'on' || ackAction === 'off') {
              setRelayStates((prev) => {
                const newMap = new Map(prev);
                newMap.set(relayKey, ackAction === 'on');
                return newMap;
              });
            }
          },
          onFailed: (relayKey, previousState, num) => {
            setRelayStates((prev) => {
              const newMap = new Map(prev);
              newMap.set(relayKey, previousState);
              return newMap;
            });
            const relayNum = num !== undefined ? String(num) : 'desconhecido';
            toast.error(`Comando falhou para relé ${relayNum}`);
          },
        },
        action,
        relayNumber
      );
    },
    []
  );

  // ACKs — WSS relay_commands (sin polling 5s); REST fallback solo si hay pendientes
  useEffect(() => {
    if (!selectedDeviceId || selectedDeviceId === 'default_device') return;

    const unsubscribe = subscribeRelayCommandUpdates(selectedDeviceId, (row) => {
      processCommandAck(row.id, (row.status || '').toLowerCase(), row.action ?? undefined, row.relay_number ?? undefined);
    });

    const clearFallback = setVisibleInterval(async () => {
      if (commandToRelayMap.current.size === 0) return;
      try {
        const response = await fetch(
          `/api/esp-now/command-acks?master_device_id=${selectedDeviceId}&limit=50`
        );
        if (!response.ok) return;
        const result = await response.json();
        const acks = result.acks || [];
        acks.forEach((ack: { command_id: number | string; status: string; action?: string; relay_number?: number }) => {
          processCommandAck(ack.command_id, ack.status, ack.action, ack.relay_number);
        });
      } catch (error) {
        console.error('Erro no fallback ACK REST:', error);
      }
    }, 60_000);

    return () => {
      unsubscribe();
      clearFallback();
    };
  }, [selectedDeviceId, processCommandAck]);

  // Realtime relay_slaves — aplica payload WS; REST fallback lento (timers + eventos perdidos)
  useEffect(() => {
    if (!selectedDeviceId || selectedDeviceId === 'default_device') return;

    updateRelayStatesOnly();
    loadDoserRelayStates();

    const unsubscribe = subscribeRelayStateUpdates(
      selectedDeviceId,
      (masterRow: RelayMasterRow) => {
        if (masterRow.doser_relay_states?.length) {
          setDoserRelayStates(masterRow.doser_relay_states);
        }
      },
      (slaveRow) => {
        setEspnowSlaves((prev) => {
          const { slaves: updated, matched } = applySlaveRelayRow(prev, slaveRow);
          if (!matched) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('[Realtime] relay_slaves sin match — recargando slaves', slaveRow);
            }
            loadESPNOWSlaves();
            return prev;
          }
          setRelayStates((r) => mergeRelayStatesMap(r, updated));
          return updated;
        });
      }
    );

    const clearFallback = setVisibleInterval(() => {
      updateRelayStatesOnly();
      loadDoserRelayStates();
    }, RELAY_REST_FALLBACK_MS);

    return () => {
      unsubscribe();
      clearFallback();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeviceId, updateRelayStatesOnly, loadDoserRelayStates]);

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
          hwToast.success('Regra atualizada e salva no banco de dados!', 'REGRA');
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
            hwToast.success('Regra criada e salva no banco de dados!', 'REGRA');
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
                <XMarkIcon className="w-6 h-6 text-red-400" />
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
                    <span className="text-aqua-400">{activeRules}</span> ativas / <span className="text-dark-textSecondary">{inactiveRules}</span> inativas
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
      
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
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
                    <BrandLoading message="Carregando dispositivos ESP-NOW..." size={40} />
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
                                {slave.status === 'offline' && (
                                  <p className="text-xs text-red-400/90 mb-3 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                                    Slave offline — aguarde reconexão para enviar comandos
                                  </p>
                                )}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  {slave.relays.map(relay => {
                                    const relayKey = `${slave.macAddress}-${relay.id}`;
                                    const realState = relay.state !== undefined ? relay.state : false;
                                    const isLoading = loadingRelays.get(relayKey) || false;
                                    const isRelayOn = isLoading
                                      ? (relayStates.get(relayKey) ?? realState)
                                      : realState;
                                    const isLocked = lockedSlaves.get(slave.macAddress) ?? false;
                                    const isSlaveOffline = slave.status === 'offline';
                                    const controlsDisabled = isLocked || isSlaveOffline;
                                    // ✅ Verificar se tem timer ativo
                                    const hasTimer = relay.has_timer || false;
                                    const remainingTime = relay.remaining_time || 0;
                                    
                                    return (
                                      <div
                                        key={relay.id}
                                        className={`bg-dark-card border rounded-lg p-3 ${
                                          controlsDisabled ? 'border-red-500/30 opacity-60' : 'border-dark-border'
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
                                        {isSlaveOffline && (
                                          <div className="mb-2 text-xs text-red-400 flex items-center space-x-1">
                                            <span className="w-2 h-2 rounded-full bg-red-400" />
                                            <span>Offline</span>
                                          </div>
                                        )}
                                        {isLocked && !isSlaveOffline && (
                                          <div className="mb-2 text-xs text-red-400 flex items-center space-x-1">
                                            <LockClosedIcon className="w-3 h-3" />
                                            <span>Bloqueado</span>
                                          </div>
                                        )}
                                        
                                        {/* 🎨 OBRA PRIMA: Switch Compacto Integrado con Timer y Ciclo */}
                                        <div className="relative">
                                          <div className="flex items-center gap-2">
                                            {/* Modo ativo (chip) */}
                                            {(relayCycles.get(relayKey)?.enabled || (hasTimer && remainingTime > 0)) && (
                                              <p className="text-[10px] text-aqua-400/90 mb-1 truncate">
                                                {relayCycles.get(relayKey)?.enabled
                                                  ? `Ciclo ${relayCycles.get(relayKey)!.onDuration}s/${relayCycles.get(relayKey)!.offDuration}s`
                                                  : `Timer ${remainingTime}s`}
                                              </p>
                                            )}

                                            {/* Switch Principal ON/OFF — sempre instantâneo */}
                                            <button
                                              onClick={async () => {
                                                const previousState = isRelayOn;
                                                const nextOn = !isRelayOn;
                                                setLoadingRelays(prev => new Map(prev).set(relayKey, true));
                                                setRelayStates(prev => new Map(prev).set(relayKey, nextOn));
                                                try {
                                                  const result = await sendSlaveRelayCommand({
                                                    master_device_id: selectedDeviceId!,
                                                    slave_mac_address: slave.macAddress,
                                                    slave_name: slave.name,
                                                    relay_number: relay.id,
                                                    mode: 'instant',
                                                    action: nextOn ? 'on' : 'off',
                                                    duration_seconds: 0,
                                                  });
                                                  if (result.success) {
                                                    if (result.command_id) {
                                                      commandToRelayMap.current.set(result.command_id, {
                                                        relayKey,
                                                        previousState,
                                                      });
                                                    }
                                                    if (!nextOn) {
                                                      setRelayCycles(prev => {
                                                        const next = new Map(prev);
                                                        const c = next.get(relayKey);
                                                        if (c) next.set(relayKey, { ...c, enabled: false });
                                                        return next;
                                                      });
                                                    }
                                                    toast.success(
                                                      nextOn
                                                        ? `${relay.name || `Relé ${relay.id + 1}`} ligado`
                                                        : `${relay.name || `Relé ${relay.id + 1}`} desligado`
                                                    );
                                                    setTimeout(() => updateRelayStatesOnly(), 2000);
                                                  } else {
                                                    setRelayStates(prev => new Map(prev).set(relayKey, previousState));
                                                    toast.error(`Erro: ${result.error}`);
                                                  }
                                                } catch {
                                                  setRelayStates(prev => new Map(prev).set(relayKey, previousState));
                                                  toast.error('Erro ao enviar comando');
                                                } finally {
                                                  setLoadingRelays(prev => {
                                                    const next = new Map(prev);
                                                    next.delete(relayKey);
                                                    return next;
                                                  });
                                                }
                                              }}
                                              disabled={isLoading || controlsDisabled}
                                              className={`
                                                relative flex-1 h-9 rounded-lg transition-all duration-300 ease-in-out
                                                ${controlsDisabled 
                                                  ? 'opacity-50 cursor-not-allowed' 
                                                  : 'cursor-pointer transform active:scale-95'
                                                }
                                                ${isRelayOn
                                                  ? 'bg-gradient-to-r from-aqua-500 via-aqua-400 to-primary-500 shadow-lg shadow-aqua-500/30'
                                                  : 'bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700'
                                                }
                                                ${!controlsDisabled && !isRelayOn && 'hover:from-gray-600 hover:via-gray-500 hover:to-gray-600'}
                                                ${!controlsDisabled && isRelayOn && 'hover:shadow-xl hover:shadow-aqua-500/40'}
                                              `}
                                              title={
                                                isSlaveOffline
                                                  ? 'Slave offline'
                                                  : isLocked
                                                    ? 'Controles bloqueados'
                                                    : isRelayOn
                                                      ? 'Clique para desligar'
                                                      : 'Clique para ligar'
                                              }
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
                                                  ${isRelayOn ? 'text-white' : 'text-dark-textSecondary'}
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
                                            {!controlsDisabled && (
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
                                                      : 'bg-dark-surface hover:bg-dark-border text-dark-textSecondary hover:text-aqua-400 border border-dark-border'
                                                  }
                                                  ${!controlsDisabled && 'cursor-pointer active:scale-95'}
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
                                                      : 'bg-dark-surface text-dark-textSecondary hover:text-aqua-400 border border-transparent'
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
                                                      : 'bg-dark-surface text-dark-textSecondary hover:text-aqua-400 border border-transparent'
                                                    }
                                                  `}
                                                >
                                                  🔄 Ciclo
                                                </button>
                                              </div>

                                              {/* Contenido Timer */}
                                              {showTimerInput === relayKey && (
                                                <div className="space-y-2">
                                                  <select
                                                    value={timerModes.get(relayKey) ?? 'timed_on'}
                                                    onChange={(e) => {
                                                      const mode = e.target.value as 'timed_on' | 'timed_off';
                                                      setTimerModes(prev => new Map(prev).set(relayKey, mode));
                                                    }}
                                                    className="w-full px-2 py-1.5 bg-dark-surface border border-dark-border rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-aqua-500"
                                                  >
                                                    <option value="timed_on">Ligar por X segundos</option>
                                                    <option value="timed_off">Desligar em X segundos</option>
                                                  </select>
                                                  <div className="flex items-center gap-2">
                                                    <input
                                                      type="number"
                                                      min="1"
                                                      max="3600"
                                                      value={relayTimers.get(relayKey) || 10}
                                                      onChange={(e) => {
                                                        const value = parseInt(e.target.value) || 10;
                                                        setRelayTimers(prev => new Map(prev).set(relayKey, value));
                                                      }}
                                                      placeholder="Segundos"
                                                      className="flex-1 px-2 py-1.5 bg-dark-surface border border-dark-border rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-aqua-500"
                                                      autoFocus
                                                    />
                                                    <span className="text-xs text-dark-textSecondary">s</span>
                                                  </div>
                                                  <p className="text-xs text-dark-textSecondary/80">
                                                    {(timerModes.get(relayKey) ?? 'timed_on') === 'timed_on'
                                                      ? 'Liga o relé e desliga automaticamente após X segundos'
                                                      : 'Mantém ligado e desliga após X segundos (relé deve estar ON)'}
                                                  </p>
                                                  <button
                                                    type="button"
                                                    disabled={isLoading || controlsDisabled}
                                                    onClick={async (e) => {
                                                      e.stopPropagation();
                                                      const secs = relayTimers.get(relayKey) || 10;
                                                      const mode = timerModes.get(relayKey) ?? 'timed_on';
                                                      setLoadingRelays(prev => new Map(prev).set(relayKey, true));
                                                      const result = await sendSlaveRelayCommand({
                                                        master_device_id: selectedDeviceId!,
                                                        slave_mac_address: slave.macAddress,
                                                        slave_name: slave.name,
                                                        relay_number: relay.id,
                                                        mode,
                                                        duration_seconds: secs,
                                                      });
                                                      setLoadingRelays(prev => {
                                                        const next = new Map(prev);
                                                        next.delete(relayKey);
                                                        return next;
                                                      });
                                                      if (result.success) {
                                                        if (mode === 'timed_on') {
                                                          setRelayStates(prev => new Map(prev).set(relayKey, true));
                                                        }
                                                        toast.success(
                                                          mode === 'timed_on'
                                                            ? `Timer: ligar ${secs}s`
                                                            : `Timer: desligar em ${secs}s`
                                                        );
                                                        setShowTimerInput(null);
                                                        setTimeout(() => updateRelayStatesOnly(), 2000);
                                                      } else {
                                                        toast.error(result.error ?? 'Erro ao ativar timer');
                                                      }
                                                    }}
                                                    className="w-full py-2 px-3 text-xs font-medium rounded bg-aqua-500/20 text-aqua-400 border border-aqua-500/40 hover:bg-aqua-500/30 disabled:opacity-50"
                                                  >
                                                    Ativar Timer
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setRelayTimers(prev => {
                                                        const next = new Map(prev);
                                                        next.delete(relayKey);
                                                        return next;
                                                      });
                                                      setShowTimerInput(null);
                                                    }}
                                                    className="w-full py-1.5 text-xs text-dark-textSecondary hover:text-red-400"
                                                  >
                                                    Fechar painel
                                                  </button>
                                                </div>
                                              )}

                                              {/* Contenido Ciclo */}
                                              {showCycleInput === relayKey && (
                                                <div className="space-y-3">
                                                  <div className="space-y-2">
                                                    <label className="text-xs text-dark-textSecondary">ON (segundos)</label>
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
                                                    <label className="text-xs text-dark-textSecondary">OFF (segundos)</label>
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
                                                  <div className="flex flex-col gap-2">
                                                    {relayCycles.get(relayKey)?.enabled ? (
                                                      <button
                                                        type="button"
                                                        disabled={isLoading || controlsDisabled}
                                                        onClick={async (e) => {
                                                          e.stopPropagation();
                                                          setLoadingRelays(prev => new Map(prev).set(relayKey, true));
                                                          const result = await sendSlaveRelayCommand({
                                                            master_device_id: selectedDeviceId!,
                                                            slave_mac_address: slave.macAddress,
                                                            slave_name: slave.name,
                                                            relay_number: relay.id,
                                                            mode: 'cycle_stop',
                                                            action: 'off',
                                                          });
                                                          setLoadingRelays(prev => {
                                                            const next = new Map(prev);
                                                            next.delete(relayKey);
                                                            return next;
                                                          });
                                                          if (result.success) {
                                                            setRelayCycles(prev => {
                                                              const next = new Map(prev);
                                                              const c = next.get(relayKey);
                                                              if (c) next.set(relayKey, { ...c, enabled: false });
                                                              return next;
                                                            });
                                                            toast.success('Ciclo parado');
                                                          } else {
                                                            toast.error(result.error ?? 'Erro ao parar ciclo');
                                                          }
                                                        }}
                                                        className="w-full py-2 px-3 text-xs font-medium rounded bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 disabled:opacity-50"
                                                      >
                                                        Parar Ciclo
                                                      </button>
                                                    ) : (
                                                      <button
                                                        type="button"
                                                        disabled={isLoading || controlsDisabled}
                                                        onClick={async (e) => {
                                                          e.stopPropagation();
                                                          const cycle = relayCycles.get(relayKey) ?? {
                                                            onDuration: 10,
                                                            offDuration: 10,
                                                            enabled: false,
                                                          };
                                                          setLoadingRelays(prev => new Map(prev).set(relayKey, true));
                                                          const result = await sendSlaveRelayCommand({
                                                            master_device_id: selectedDeviceId!,
                                                            slave_mac_address: slave.macAddress,
                                                            slave_name: slave.name,
                                                            relay_number: relay.id,
                                                            mode: 'cycle',
                                                            duration_seconds: cycle.onDuration,
                                                            cycle_off_seconds: cycle.offDuration,
                                                          });
                                                          setLoadingRelays(prev => {
                                                            const next = new Map(prev);
                                                            next.delete(relayKey);
                                                            return next;
                                                          });
                                                          if (result.success) {
                                                            setRelayCycles(prev =>
                                                              new Map(prev).set(relayKey, { ...cycle, enabled: true })
                                                            );
                                                            toast.success(
                                                              `Ciclo ON ${cycle.onDuration}s / OFF ${cycle.offDuration}s`
                                                            );
                                                            setShowCycleInput(null);
                                                            setTimeout(() => updateRelayStatesOnly(), 2000);
                                                          } else {
                                                            toast.error(result.error ?? 'Erro ao ativar ciclo');
                                                          }
                                                        }}
                                                        className="w-full py-2 px-3 text-xs font-medium rounded bg-aqua-500/20 text-aqua-400 border border-aqua-500/40 hover:bg-aqua-500/30 disabled:opacity-50"
                                                      >
                                                        Ativar Ciclo
                                                      </button>
                                                    )}
                                                    <button
                                                      type="button"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setRelayCycles(prev => {
                                                          const next = new Map(prev);
                                                          next.delete(relayKey);
                                                          return next;
                                                        });
                                                        setShowCycleInput(null);
                                                      }}
                                                      className="p-2 hover:bg-red-500/20 rounded text-red-400 transition-colors self-end"
                                                      title="Fechar painel"
                                                    >
                                                      <XMarkIcon className="w-4 h-4" />
                                                    </button>
                                                  </div>
                                                  <p className="text-xs text-dark-textSecondary/80">Ciclo: alterna ON/OFF automaticamente</p>
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
                <BrandLoading message="Carregando regras..." size={40} />
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
                  <p className="text-sm text-dark-textSecondary">
                    📋 Regras de Script Sequencial ({rules.filter(r => r.rule_json?.script?.instructions && r.enabled).length} ativas / {rules.filter(r => r.rule_json?.script?.instructions && !r.enabled).length} inativas)
                  </p>
                </div>

                {loading ? (
                  <div className="text-center py-8 text-dark-textSecondary">Carregando...</div>
                ) : rules.filter(r => r.rule_json?.script?.instructions).length === 0 ? (
                  <div className="text-center py-8 text-dark-textSecondary bg-dark-surface border border-dark-border rounded-lg">
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
                                <p className="text-xs text-dark-textSecondary mt-1">{script.description || script.rule_description}</p>
                              )}
                              <p className="text-xs text-dark-textSecondary/80 mt-1">
                                Sequential Script
                              </p>

                              {/* Preview das instruções - Linha circular do script */}
                              {script.rule_json?.script?.instructions && (
                                <div className="mt-2 text-xs text-dark-textSecondary space-y-1 font-mono">
                                  {script.rule_json.script.instructions.slice(0, 2).map((instr: ScriptInstruction, idx: number) => (
                                    <div key={idx} className="text-aqua-300">
                                      {idx + 1}. {formatInstructionType(instr.type)}
                                      {instr.condition && (
                                        <span className="ml-2 text-dark-textSecondary">
                                          {instr.condition.sensor} {instr.condition.operator} {instr.condition.value}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                  {script.rule_json.script.instructions.length > 2 && (
                                    <div className="text-dark-textSecondary/80 italic">
                                      ... e mais {script.rule_json.script.instructions.length - 2} instrução(ões)
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="mt-3 flex gap-2 flex-wrap items-center">
                                <span className="text-xs bg-aqua-500/15 text-aqua-300 px-2 py-1 rounded border border-aqua-500/40">
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
                                <XMarkIcon className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {rules.filter(r => r.rule_json?.script?.instructions && r.enabled).length === 0 && (
                        <div className="text-center py-6 text-dark-textSecondary/80 bg-dark-surface/30 border border-dark-border rounded-lg text-xs">
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
                                  <p className="text-xs text-dark-textSecondary mt-1">{script.description || script.rule_description}</p>
                                )}
                                <p className="text-xs text-dark-textSecondary/80 mt-1">
                                  Sequential Script
                                </p>

                                {/* Preview das instruções - Linha circular do script */}
                                {script.rule_json?.script?.instructions && (
                                  <div className="mt-2 text-xs text-dark-textSecondary space-y-1 font-mono">
                                  {script.rule_json.script.instructions.slice(0, 2).map((instr: ScriptInstruction, idx: number) => (
                                      <div key={idx} className="text-aqua-300">
                                        {idx + 1}. {formatInstructionType(instr.type)}
                                        {instr.condition && (
                                          <span className="ml-2 text-dark-textSecondary">
                                            {instr.condition.sensor} {instr.condition.operator} {instr.condition.value}
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                    {script.rule_json.script.instructions.length > 2 && (
                                      <div className="text-dark-textSecondary/80 italic">
                                        ... e mais {script.rule_json.script.instructions.length - 2} instrução(ões)
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div className="mt-3 flex gap-2 flex-wrap items-center">
                                  <span className="text-xs bg-aqua-500/15 text-aqua-300 px-2 py-1 rounded border border-aqua-500/40">
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
                                  <XMarkIcon className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      {rules.filter(r => r.rule_json?.script?.instructions && !r.enabled).length === 0 && (
                        <div className="text-center py-6 text-dark-textSecondary/80 bg-dark-surface/30 border border-dark-border rounded-lg text-xs">
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


        {selectedDeviceId && selectedDeviceId !== 'default_device' && (
          <div className="mb-6">
            <WaterLevelSection deviceId={selectedDeviceId} enabled={ecDeviceActive} />
          </div>
        )}

        {/* Box de Controle Nutricional Proporcional - Colapsável */}
        <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg overflow-hidden mb-6">
          {/* Header - Colapsável */}
          <div
            onClick={() => setExpandedNutritionalControl(!expandedNutritionalControl)}
            className="w-full p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-dark-surface transition-colors cursor-pointer"
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-1 min-w-0">
              <div className="flex items-center space-x-3 min-w-0">
                {expandedNutritionalControl ? (
                  <ChevronUpIcon className="w-5 h-5 text-aqua-400 shrink-0" />
                ) : (
                  <ChevronDownIcon className="w-5 h-5 text-dark-textSecondary shrink-0" />
                )}
                <h3 className="text-lg font-semibold text-dark-text flex items-center gap-2 min-w-0">
                  <ClipboardIcon className="w-5 h-5 text-aqua-400 shrink-0" aria-hidden />
                  <span className="truncate">Controle Nutricional Proporcional</span>
                </h3>
              </div>
              <OperationStateBadges
                variant="header"
                autoEnabled={autoEnabled}
                autoActiveLabel="Auto EC ativo"
                autoInactiveLabel="Auto EC inativo"
                isDosando={isDosando}
                isAguardandoRecirculacao={isAguardandoRecirculacao}
                operationRemainingSec={recirculacaoRestanteSec}
                showNextCheck={showEcNextCheck}
                nextCheckInSec={ecNextCheckInSec}
                nextCheckLabel="Próxima verificação EC"
                accent="emerald"
              />
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
                <p className="text-xs sm:text-sm text-dark-textSecondary mb-4">
                  Configure o sistema adaptativo proporcional para controle automático da condutividade elétrica.
                </p>

                <details className="mb-6 rounded-lg border border-aqua-500/30 bg-aqua-500/5 p-4 group">
                  <summary className="cursor-pointer text-sm font-semibold text-aqua-300 select-none list-none flex items-center gap-2">
                    <span className="group-open:rotate-90 transition-transform">▶</span>
                    ℹ️ Informação — como usar o Auto EC
                  </summary>
                  <div className="mt-3 space-y-2 text-xs sm:text-sm text-dark-textSecondary leading-relaxed">
                    <p><strong className="text-dark-text">1. Plano nutricional</strong> — Adicione nutrientes, associe cada um a um relé e defina ml/L (mín. {MIN_NUTRIENT_ML_PER_LITER}). Calibre a bomba em Calibragem.</p>
                    <p><strong className="text-dark-text">2. Parâmetros hidropônicos</strong> — Base de dose (EC da solução stock), setpoint desejado e <strong>banda morta</strong>. O firmware só dosifica se EC &lt; setpoint − banda (só por baixo do SP).</p>
                    <p><strong className="text-dark-text">3. Parâmetros de ciclo</strong> — Intervalo entre <em>verificações</em> de EC (não confundir com pausa entre nutrientes no firmware, ~3 s). Tempo de recirculação após cada dose.</p>
                    <p><strong className="text-dark-text">4. Salvar → Ativar</strong> — Salve os parâmetros, depois Ativar Auto EC. O ESP32 recebe a config via RPC <code className="text-aqua-400">activate_auto_ec</code>.</p>
                    <p className="text-dark-textSecondary/80">Guia completo: menu <NavLink href="/informacao" className="text-aqua-400 hover:underline">Informação</NavLink>.</p>
                  </div>
                </details>
                
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
                      disabled={addNutrientControl.disabled}
                      className={`flex items-center justify-center space-x-2 px-4 py-3 sm:py-2 bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white rounded-lg transition-all shadow-lg hover:shadow-aqua-500/50 text-sm sm:text-base w-full sm:w-auto ${
                        addNutrientControl.disabled ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      title={addNutrientControl.title || 'Adicionar nutriente'}
                    >
                      <span className="text-base sm:text-lg">+</span>
                      <span>Nutriente</span>
                    </button>
                  </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-dark-surface/60 border border-aqua-500/25 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-dark-textSecondary">Vazão calibrada (bomba peristáltica)</p>
                    <p className="text-xl font-semibold text-aqua-400 mt-1">{formatFlowRate(pumpFlowRate)}</p>
                    <p className="text-xs text-dark-textSecondary mt-1">
                      Usada para calcular tempo de dosagem na tabela abaixo
                    </p>
                  </div>
                  <NavLink
                    href="/calibragem"
                    className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg border border-aqua-500/40 text-aqua-400 hover:bg-aqua-500/10 transition-colors whitespace-nowrap"
                  >
                    Calibrar bombas →
                  </NavLink>
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
                  <DoserRelayMapPanel registry={ecRelayRegistry} />
                  <p className="mt-2 text-sm text-dark-textSecondary">
                    Cada nutriente deve ter no mínimo {MIN_NUTRIENT_ML_PER_LITER} ml/L. Para excluir um nutriente do Auto EC, remova a linha (botão X) — não use 0 ml/L.
                  </p>
                  <div className="overflow-x-auto mt-2">
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

                      const relayNamingLock = getEcRelayNamingLock(nutrient.relayNumber);
                      const relayControl = composeRelayControlDisabled(ecControllerLocked, relayNamingLock);
                      const editNutrientControl = composeRelayControlDisabled(
                        ecControllerLocked,
                        relayNamingLock
                      );
                      const manualDoseLock = resolveEcManualDoseButtonLock({
                        autoEnabled,
                        relayNumber: nutrient.relayNumber,
                        manualPendingRelays,
                        ecManualDosingRelay: Boolean(isLoadingNutrients[nutrient.relayNumber]),
                      });
                      const manualDoseControl = composeRelayControlDisabled(
                        ecControllerLocked,
                        manualDoseLock
                      );

                          const handleMlPerLiterChange = async (idx: number, value: number) => {
                        const updatedNutrients = [...nutrientsState];
                        updatedNutrients[idx] = { ...updatedNutrients[idx], mlPerLiter: value };
                        setNutrientsState(updatedNutrients);
                            await saveECControllerConfig();
                      };

                          const handleDoseNutrient = async (nut: { name: string; relayNumber: number; mlPerLiter: number }, idx: number) => {
                        const doseLock = resolveEcManualDoseButtonLock({
                          autoEnabled,
                          relayNumber: nut.relayNumber,
                          manualPendingRelays,
                          ecManualDosingRelay: Boolean(isLoadingNutrients[nut.relayNumber]),
                        });
                        if (doseLock.locked) {
                          toast.error(doseLock.tooltip);
                          return;
                        }

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
                            void relayAllocation.refresh();
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
                            <span title={relayControl.title || undefined}>
                              <DoserRelaySelect
                                registry={ecRelayRegistry}
                                context={{
                                  field: 'ec_nutrient',
                                  currentValue: nutrient.relayNumber,
                                  nutrientIndex: index,
                                }}
                                value={nutrient.relayNumber}
                                disabled={relayControl.disabled}
                                onChange={(relayNum) => handleRelayChange(index, relayNum)}
                                className="w-full p-1.5 bg-dark-surface border border-dark-border rounded-md text-dark-text focus:border-aqua-500 focus:outline-none disabled:opacity-50"
                              />
                            </span>
                          </td>
                          <td className="py-2 px-4">
                            <input
                              type="number"
                              min={MIN_NUTRIENT_ML_PER_LITER}
                              step={0.1}
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
                              disabled={manualDoseControl.disabled}
                              className={`px-3 py-1.5 bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white rounded transition-all shadow-lg hover:shadow-aqua-500/50 ${
                                manualDoseControl.disabled ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                              title={manualDoseControl.title || 'Dosificar'}
                            >
                              {isLoadingNutrients[nutrient.relayNumber] ? 'Dosificando...' : 'Dosificar'}
                            </button>
                                  <button
                                    onClick={() => {
                                      setEditingNutrientIndex(index);
                                      setIsNutrientModalOpen(true);
                                    }}
                                    disabled={editNutrientControl.disabled}
                                    className={`px-3 py-1.5 bg-dark-surface hover:bg-dark-border border border-dark-border text-dark-text rounded transition-all ${
                                      editNutrientControl.disabled ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                                    title={editNutrientControl.title || 'Editar'}
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
                                    <XMarkIcon className="w-4 h-4" />
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
                
                {/* Parâmetros hidropônicos */}
                <div className="mb-8">
                  <h3 className="text-base sm:text-lg font-bold text-dark-text mb-1">Parâmetros hidropônicos</h3>
                  <p className="text-xs text-dark-textSecondary mb-4">
                    Setpoint, banda morta e calibração da solução nutriente — fecham o loop de controle visível no status.
                  </p>
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
                      value={totalMlPerLiter.toFixed(1)}
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
                    <label htmlFor="ec-tolerance" className="block text-sm font-medium text-dark-textSecondary mb-1">
                      Tolerância / banda morta (µS/cm):
                    </label>
                    <input
                      id="ec-tolerance"
                      type="number"
                      min="1"
                      step="5"
                      value={isNaN(ecTolerance) ? '' : ecTolerance}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        setEcTolerance(isNaN(value) || value <= 0 ? 50 : value);
                      }}
                      disabled={ecControllerLocked}
                      className={`w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text focus:border-aqua-500 focus:outline-none ${
                        ecControllerLocked ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      placeholder="Ex: 50"
                    />
                    <small className="text-xs text-aqua-400 mt-1 block">
                      Sem dosagem se EC ≥ setpoint − {ecTolerance} µS/cm (banda só por baixo do SP)
                    </small>
                  </div>
                </div>
                </div>

                {/* Parâmetros de ciclo */}
                <div className="mb-8 pb-6 border-b border-dark-border">
                  <h3 className="text-base sm:text-lg font-bold text-dark-text mb-1">Parâmetros de ciclo</h3>
                  <p className="text-xs text-dark-textSecondary mb-4">
                    Quando o firmware verifica a EC e quanto tempo aguarda a recirculação antes da próxima decisão.
                  </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="intervalo-auto-ec" className="block text-sm font-medium text-dark-textSecondary mb-1">
                      Intervalo entre verificações de EC (segundos):
                    </label>
                    <input
                      id="intervalo-auto-ec"
                      type="number"
                      min="30"
                      max="86400"
                      step="30"
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
                    <small className="text-xs text-dark-textSecondary mt-1 block">
                      Periodicidade do ciclo automático (ex.: 300 = a cada 5 min). Distinto da pausa ~3 s entre nutrientes na mesma dose.
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
                    <small className="text-xs text-dark-textSecondary mt-2 block">
                      Formato: HH:MM (ex: 00:01 = 1 minuto, 01:30 = 1 hora e 30 minutos)
                    </small>
                  </div>
                </div>
                </div>
                
                {/* Controles e Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Status do EC Controller */}
                  <InstrumentCard accent="ec" title="📊 Status do Controle" ariaLive="polite">
                    <div className="space-y-2.5">
                      <OperationStateBanners
                        autoEnabled={autoEnabled}
                        isDosando={isDosando}
                        dosandoLabel="Dosando"
                        isAguardandoRecirculacao={isAguardandoRecirculacao}
                        operationRemainingSec={recirculacaoRestanteSec}
                        showNextCheck={
                          !isDosando &&
                          !isAguardandoRecirculacao &&
                          autoEnabled &&
                          ecNextCheckInSec > 0
                        }
                        nextCheckInSec={ecNextCheckInSec}
                        nextCheckLabel="Próxima verificação EC"
                        formatCountdown={formatRecircCountdown}
                      />
                      <MetricRow
                        label="Status:"
                        value={autoEnabled ? '✅ Ativado' : '❌ Desativado'}
                        variant={autoEnabled ? 'ok' : 'danger'}
                      />
                      <MetricRow
                        label="Setpoint:"
                        value={`${formatSensorValue(ecSetpoint, 0)} µS/cm`}
                        variant="setpoint"
                        domain="ec"
                      />
                      <MetricRow
                        label="Banda morta:"
                        value={`± ${formatSensorValue(ecTolerance, 0)} µS/cm`}
                      />
                      <MetricRow
                        label="Erro (SP − EC):"
                        value={
                          ecAtual !== null
                            ? `${formatSensorValue(Math.max(0, ecError), 1)} µS/cm`
                            : '-- µS/cm'
                        }
                        variant={ecWithinDeadBand === false ? 'alarm' : 'default'}
                      />
                      <MetricRow
                        label="Zona de controle:"
                        value={
                          ecWithinDeadBand === null
                            ? '--'
                            : ecWithinDeadBand
                              ? '✓ Sem dosagem (EC ≥ limite)'
                              : '⚡ Ajuste Kp (EC abaixo da banda)'
                        }
                        variant={
                          ecWithinDeadBand === true ? 'ok' : ecWithinDeadBand === false ? 'alarm' : 'default'
                        }
                      />
                      <MetricRow
                        label="Última dosagem:"
                        value={lastDosageMl != null ? `${lastDosageMl.toFixed(2)} ml` : '-- ml'}
                        variant="preview"
                        domain="ec"
                      />
                      <MetricRow
                        label="EC Atual:"
                        value={
                          ecAtual !== null
                            ? `${formatSensorValue(ecAtual, 1)} µS/cm`
                            : '-- µS/cm'
                        }
                        variant="live"
                      />
                    </div>
                    <NutrientDosageDetail
                      deviceId={selectedDeviceId}
                      sequenceId={lastDosageSequenceId}
                      enabled={ecDeviceActive}
                    />
                  </InstrumentCard>
                  
                  <InstrumentCard accent="ec" title="🧮 Equação de Controle Proporcional" tinted>
                    <div className="space-y-2.5 text-base">
                      <div className="font-mono text-emerald-400 mb-2 text-lg">u(t) = (V / k × q) × e</div>
                      <MetricRow label="V (Volume):" value={`${totalVolume} L`} />
                      <MetricRow
                        label="k (EC base / ml por L):"
                        value={
                          totalMlPerLiter > 0
                            ? (baseDose / totalMlPerLiter).toFixed(3)
                            : '—'
                        }
                      />
                      <MetricRow label="q (Taxa de vazão):" value={`${pumpFlowRate.toFixed(3)} ml/s`} />
                      <MetricRow
                        label="e (SP − EC):"
                        value={
                          ecAtual !== null
                            ? `${formatSensorValue(Math.max(0, ecError), 1)} µS/cm`
                            : '--'
                        }
                        variant={ecWithinDeadBand === false ? 'alarm' : 'default'}
                      />
                    </div>
                  </InstrumentCard>
                </div>

                {selectedDeviceId ? (
                  <div className="mb-6">
                    <ControllerMetricsPanel
                      deviceId={selectedDeviceId}
                      focus="ec"
                      hideTabs
                    />
                  </div>
                ) : null}
                
                {/* Botões de Controle */}
                <div className="flex flex-wrap gap-3 mb-4">
                  <button
                    onClick={async () => {
                      await saveECControllerConfig();
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
                      const newValue = !autoEnabled;
                      console.log('🔄 [EC Controller] Estado atual:', autoEnabled, '→ Novo valor:', newValue);
                      
                      try {
                        if (newValue) {
                          if (!canActivateAutoEc) {
                            toast.error(
                              'Configure pelo menos um nutriente com ml/L > 0 (total_ml > 0) antes de ativar o Auto EC'
                            );
                            return;
                          }
                          const saved = await saveECControllerConfig(true, true);
                          if (!saved) {
                            toast.error('Salve os parâmetros antes de ativar Auto EC');
                            return;
                          }
                          const { error: rpcError } = await supabase.rpc('activate_auto_ec', {
                            p_device_id: selectedDeviceId,
                          });
                          if (rpcError) {
                            console.error('❌ [EC Controller] RPC activate_auto_ec:', rpcError);
                            toast.error(`Erro ao ativar via RPC: ${rpcError.message}`);
                            return;
                          }
                        }

                        const { error } = await supabase
                          .from('ec_config_view')
                          .update({ 
                            auto_enabled: newValue,
                            updated_at: new Date().toISOString()
                          })
                          .eq('device_id', selectedDeviceId);
                        
                        if (error) {
                          console.error('❌ [EC Controller] Erro ao alterar Auto EC:', error);
                          toast.error(`Erro: ${error.message}`);
                          return;
                        }

                        if (!newValue) {
                          const { error: idleError } = await supabase
                            .from('relay_master')
                            .update({
                              ec_operation_state: 'idle',
                              ec_operation_remaining_sec: 0,
                              ec_next_check_in_sec: 0,
                            })
                            .eq('device_id', selectedDeviceId);

                          if (idleError) {
                            console.warn(
                              '⚠️ [EC Controller] Falha ao limpar ec_operation:',
                              idleError.message
                            );
                          }
                        }
                        
                        setAutoEnabled(newValue);
                        
                        justSavedRef.current = true;
                        if (savingTimeoutRef.current) {
                          clearTimeout(savingTimeoutRef.current);
                        }
                        savingTimeoutRef.current = setTimeout(() => {
                          justSavedRef.current = false;
                        }, 2000);
                        
                        if (newValue) {
                          hwToast.success('Auto EC ativado', 'AUTO EC');
                        } else {
                          hwToast.info('Auto EC desativado', 'AUTO EC');
                        }
                        console.log(`✅ [EC Controller] Auto EC ${newValue ? 'ativado' : 'desativado'} no Supabase`);
                        
                      } catch (err) {
                        console.error('❌ [EC Controller] Erro:', err);
                        toast.error(`Erro: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
                      }
                    }}
                    disabled={ecControllerLocked || (!autoEnabled && !canActivateAutoEc)}
                    className={`px-4 py-2 rounded-lg transition-all shadow-lg ${
                      autoEnabled
                        ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white'
                        : 'bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white'
                    } ${
                      ecControllerLocked || (!autoEnabled && !canActivateAutoEc) ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    title={
                      ecControllerLocked
                        ? 'Controles bloqueados'
                        : !autoEnabled && !canActivateAutoEc
                          ? 'Adicione nutrientes com ml/L > 0 antes de ativar'
                          : autoEnabled
                            ? 'Desativar Auto EC'
                            : 'Ativar Auto EC'
                    }
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
                    onClick={() => {
                      setBaseDose(0);
                      setEcSetpoint(0);
                      setEcTolerance(50);
                      setIntervaloAutoEC(300);
                      setTempoRecirculacao('00:02');
                      setTempoRecirculacaoHours(0);
                      setTempoRecirculacaoMinutes(2);
                      setAutoEnabled(false);
                      toast.success('Valores limpos');
                    }}
                    disabled={ecControllerLocked}
                    className={`px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all ${
                      ecControllerLocked ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    title={ecControllerLocked ? 'Controles bloqueados' : 'Limpar valores'}
                  >
                    <XMarkIcon className="w-4 h-4 inline mr-1" />
                    Limpar Valores
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
                            hwToast.warning('Reset emergencial executado — Auto EC desativado', 'AUTO EC');
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

        {selectedDeviceId && selectedDeviceId !== 'default_device' && (
          <EcDilutionSection
            deviceId={selectedDeviceId}
            ecActual={ecAtual}
            espnowSlaves={espnowSlaves}
            locked={ecControllerLocked}
            onToggleLock={() =>
              showLockUnlockToast(
                ecControllerLocked,
                'Diluição EC',
                () => setEcControllerLocked((prev) => !prev)
              )
            }
          />
        )}

        {selectedDeviceId && selectedDeviceId !== 'default_device' && (
          <PhControllerPanel
            deviceId={selectedDeviceId}
            currentPh={phAtual}
            currentPhRaw={phRaw}
            availableRelays={availableRelays}
            relayAllocation={relayAllocation}
          />
        )}

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
                  disabled={modalNutrientControl.disabled}
                  className="w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text focus:border-aqua-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Ex: Grow, Micro, pH-, etc."
                  title={modalNutrientControl.title || undefined}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-dark-textSecondary mb-1">
                  Relé (Master)
                </label>
                <span title={modalNutrientControl.title || undefined}>
                  <DoserRelaySelect
                    registry={ecRelayRegistry}
                    context={{
                      field: 'ec_nutrient',
                      currentValue: modalRelayNumber,
                      nutrientIndex: editingNutrientIndex ?? nutrientsState.length,
                    }}
                    value={modalRelayNumber}
                    onChange={setModalRelayNumber}
                    disabled={modalNutrientControl.disabled}
                    className="w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text focus:border-aqua-500 focus:outline-none disabled:opacity-50"
                  />
                </span>
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
                  if (modalNutrientControl.disabled) {
                    toast.error(modalNutrientControl.title || 'Não é possível alterar nutriente agora');
                    return;
                  }

                  const nameInput = document.getElementById('nutrientName') as HTMLInputElement;
                  const mlInput = document.getElementById('nutrientMlPerLiter') as HTMLInputElement;
                  
                  if (!nameInput?.value.trim()) {
                    toast.error('Nome do nutriente é obrigatório');
                    return;
                  }
                  
                  const newNutrient = {
                    name: nameInput.value.trim(),
                    relayNumber: modalRelayNumber,
                    mlPerLiter: parseFloat(mlInput.value) || 0,
                  };

                  const saveLock = getEcRelayNamingLock(newNutrient.relayNumber);
                  if (saveLock.locked) {
                    toast.error(saveLock.tooltip);
                    return;
                  }
                  
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
                disabled={modalNutrientControl.disabled}
                className="px-4 py-2 bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white rounded-lg transition-all shadow-lg hover:shadow-aqua-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                title={modalNutrientControl.title || undefined}
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
      </div>

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
                <pre className="text-xs text-dark-textSecondary font-mono whitespace-pre-wrap break-words overflow-x-auto">
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
                <p className="text-xs text-dark-textSecondary">
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
                <pre className="text-xs text-dark-textSecondary font-mono whitespace-pre-wrap break-words overflow-x-auto">
                  {JSON.stringify(getECConfigJson(), null, 2)}
                </pre>
              </div>
              
              {/* Informação adicional */}
              <div className="mt-4 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <p className="text-xs text-purple-300 mb-2">
                  💡 Este é o JSON completo que será enviado/salvo no Supabase (tabela ec_config_view)
                </p>
                <p className="text-xs text-dark-textSecondary mb-2">
                  Este formato é o mesmo que aparece no console.log quando a configuração é salva.
                </p>
                <div className="mt-3 space-y-1 text-xs text-dark-textSecondary">
                  <p><strong className="text-purple-300">device_id:</strong> ID do dispositivo Master</p>
                  <p><strong className="text-purple-300">base_dose:</strong> EC base em µS/cm</p>
                  <p><strong className="text-purple-300">flow_rate:</strong> Taxa de vazão da bomba (ml/s)</p>
                  <p><strong className="text-purple-300">volume:</strong> Volume total do reservatório (L)</p>
                  <p><strong className="text-purple-300">total_ml:</strong> Soma de ml/L de todos os nutrientes</p>
                  <p><strong className="text-purple-300">ec_setpoint:</strong> Setpoint desejado de EC (µS/cm)</p>
                  <p><strong className="text-purple-300">tolerance:</strong> Banda morta em µS/cm — needsAdjustment se (SP − EC) &gt; tolerance</p>
                  <p><strong className="text-purple-300">auto_enabled:</strong> Controle automático ativado?</p>
                  <p><strong className="text-purple-300">nutrients:</strong> Array de nutrientes com relés e ml/L</p>
                  <p><strong className="text-purple-300">intervalo_auto_ec:</strong> Intervalo entre verificações de EC (segundos)</p>
                  <p><strong className="text-purple-300">tempo_recirculacao:</strong> Tempo de recirculação em segundos (integer)</p>
                  <p className="mt-2 text-purple-300"><strong>_debug:</strong> Informação calculada adicional (preview)</p>
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

