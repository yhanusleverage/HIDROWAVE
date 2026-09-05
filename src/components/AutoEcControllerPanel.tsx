'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import NavLink from '@/components/NavLink';
import { toast } from 'react-hot-toast';
import { hwToast } from '@/lib/control-toast';
import OperationStateBadges from '@/components/OperationStateBadges';
import OperationStateBanners from '@/components/OperationStateBanners';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  LockClosedIcon,
  LockOpenIcon,
  XMarkIcon,
  ClipboardIcon,
} from '@heroicons/react/24/outline';
import { formatSensorValue } from '@/lib/format-sensor-value';
import { ESPNowSlave } from '@/lib/esp-now-slaves';
import { supabase } from '@/lib/supabase';
import { subscribeRelayStateUpdates } from '@/lib/realtime/relay-states';
import { subscribeAutoEnabled } from '@/lib/realtime/auto-controller';
import type { RealtimeChannelStatus } from '@/lib/realtime/channel';
import { RELAY_REST_FALLBACK_MS } from '@/lib/realtime/relay-apply';
import { useLastDosage } from '@/hooks/useLastDosage';
import { useEcOperationState } from '@/hooks/useEcOperationState';
import { useHydroEcReading } from '@/hooks/useHydroEcReading';
import { setVisibleInterval } from '@/lib/realtime/visible-interval';
import { getMasterLocalRelayNames, saveMasterLocalRelayName } from '@/lib/nutrition-plan';
import {
  formatFlowRate,
  mergeNutrientFlowRates,
  type NutrientFlowRow,
} from '@/lib/pump-calibration';
import { useRelayAllocation } from '@/hooks/useRelayAllocation';
import { DoserRelaySelect } from '@/components/DoserRelaySelect';
import { DoserRelayMapPanel } from '@/components/DoserRelayMapPanel';
import { getSelectableRelays, getRelayBusyClaim, serializeRegistryForDebug, validateEcNutrientsAssignment } from '@/lib/relay-allocation';
import {
  composeRelayControlDisabled,
  getManualPendingRelaySet,
  isEcCycleActive,
  resolveEcManualDoseButtonLock,
  resolveRelayNamingLock,
} from '@/lib/relay-naming-lock';
import {
  parseConfigApiError,
  sanitizeEcNumericFields,
  stripEcWritableConfig,
} from '@/lib/controller-config-api';
import { InstrumentCard } from '@/components/ui/InstrumentCard';
import { MetricRow } from '@/components/ui/MetricRow';
import ControllerMetricsPanel from '@/components/ControllerMetricsPanel';
import { EcGrowerSummaryCard } from '@/components/GrowerSummaryCards';
import { showLockUnlockToast } from '@/lib/automacao/admin-lock';
import { useLanguage } from '@/contexts/LanguageContext';

const NutrientDosageDetail = dynamic(
  () => import('@/components/NutrientDosageDetail').then((m) => m.NutrientDosageDetail),
  { loading: () => <div className="h-16 animate-pulse rounded-lg bg-dark-surface" /> }
);

const EcMalhaFechadaConfig = dynamic(
  () => import('@/components/EcMalhaFechadaConfig').then((m) => m.EcMalhaFechadaConfig),
  { loading: () => <div className="h-32 animate-pulse rounded-lg bg-dark-surface" /> }
);

/** Mínimo ml/L por nutriente na tabela nutricional (Auto EC). Para excluir um nutriente, remova a linha. */
const MIN_NUTRIENT_ML_PER_LITER = 0.1;

function nutrientFlowRateMlPerSec(n: { flowRate?: number }): number {
  const q = Number(n.flowRate);
  return Number.isFinite(q) && q > 0 ? q : 0;
}

export interface AutoEcControllerPanelProps {
  deviceId: string;
  espnowSlaves: ESPNowSlave[];
}

export default function AutoEcControllerPanel({ deviceId, espnowSlaves }: AutoEcControllerPanelProps) {
  const { t } = useLanguage();
  const ec = t.automacao.ec;
  const [ecControllerLocked, setEcControllerLocked] = useState<boolean>(false);
  const [expandedEcInfo, setExpandedEcInfo] = useState(false);
  const [showECConfigPreview, setShowECConfigPreview] = useState<boolean>(false);
  const [totalVolume, setTotalVolume] = useState<number>(10);
  const [baseDose, setBaseDose] = useState<number>(1525.0);
  const [ecSetpoint, setEcSetpoint] = useState<number>(1500.0);
  const [ecTolerance, setEcTolerance] = useState<number>(50);
  const [intervaloAutoEC, setIntervaloAutoEC] = useState<number>(300);
  const [tempoRecirculacao, setTempoRecirculacao] = useState<string>('00:02');
  const [tempoRecirculacaoHours, setTempoRecirculacaoHours] = useState<number>(0);
  const [tempoRecirculacaoMinutes, setTempoRecirculacaoMinutes] = useState<number>(2);
  const [autoEnabled, setAutoEnabled] = useState<boolean>(false);
  const [autoTogglePending, setAutoTogglePending] = useState(false);
  const [autoRtStatus, setAutoRtStatus] = useState<RealtimeChannelStatus | 'connecting'>(
    'connecting'
  );
  const [aggressiveness, setAggressiveness] = useState<number>(0.5);
  const [consumo24h, setConsumo24h] = useState<boolean>(false);
  /** HMI: ml por pulso / Gap pulsos (s) */
  const [pulseMl, setPulseMl] = useState<number>(2.0);
  const [pulseGapSec, setPulseGapSec] = useState<number>(2.0);
  const justSavedRef = useRef<boolean>(false);
  const savingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [configSyncTick, setConfigSyncTick] = useState(0);
  const [savedConfigSnapshot, setSavedConfigSnapshot] = useState<string | null>(null);
  const markConfigSynced = useCallback(() => {
    setConfigSyncTick((n) => n + 1);
  }, []);

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
  const [nutrientsState, setNutrientsState] = useState<Array<{
    name: string;
    relayNumber: number;
    mlPerLiter: number;
    flowRate?: number;
  }>>([]);
  const [isLoadingNutrients, setIsLoadingNutrients] = useState<Record<number, boolean>>({});
  const [doseEndsAt, setDoseEndsAt] = useState<Record<number, number>>({});
  const [, setDoseClock] = useState(0);
  const [isNutrientModalOpen, setIsNutrientModalOpen] = useState<boolean>(false);
  const [editingNutrientIndex, setEditingNutrientIndex] = useState<number | null>(null);
  const [modalRelayNumber, setModalRelayNumber] = useState(0);

  const ecFormSnapshot = useMemo(
    () =>
      JSON.stringify({
        totalVolume,
        baseDose,
        ecSetpoint,
        ecTolerance,
        intervaloAutoEC,
        tempoRecirculacaoHours,
        tempoRecirculacaoMinutes,
        aggressiveness,
        consumo24h,
        pulseMl,
        pulseGapSec,
        nutrients: nutrientsState.map((n) => ({
          name: n.name,
          relayNumber: n.relayNumber,
          mlPerLiter: n.mlPerLiter,
          flowRate: Number(n.flowRate) > 0 ? n.flowRate : 0,
        })),
      }),
    [
      totalVolume,
      baseDose,
      ecSetpoint,
      ecTolerance,
      intervaloAutoEC,
      tempoRecirculacaoHours,
      tempoRecirculacaoMinutes,
      aggressiveness,
      consumo24h,
      pulseMl,
      pulseGapSec,
      nutrientsState,
    ]
  );
  const ecConfigDirty = savedConfigSnapshot !== null && savedConfigSnapshot !== ecFormSnapshot;
  
  // ✅ NOVO: Nomes de relés LOCAIS do Master
  const [localRelayNames, setLocalRelayNames] = useState<Map<number, string>>(new Map());
  const [availableRelays, setAvailableRelays] = useState<Array<{number: number, name: string}>>([]);
  const [doserRelayStates, setDoserRelayStates] = useState<boolean[]>([]);

  const loadDoserRelayStates = useCallback(async () => {
    if (!deviceId || deviceId === 'default_device') return;

    try {
      const { data, error } = await supabase
        .from('relay_master')
        .select('doser_relay_states')
        .eq('device_id', deviceId)
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
  }, [deviceId]);

  const ecDeviceActive = Boolean(deviceId && deviceId !== 'default_device');

  const relayAllocation = useRelayAllocation(deviceId, {
    enabled: ecDeviceActive,
  });
  const { buildRegistry } = relayAllocation;

  const ecRelayRegistry = useMemo(
    () =>
      buildRegistry({
        ecConfig: {
          nutrients: nutrientsState.map((n) => ({
            name: n.name,
            relay: n.relayNumber,
            mlPerLiter: n.mlPerLiter,
            active: true,
          })),
        },
      }),
    [buildRegistry, nutrientsState]
  );

  /** Solo inicializa al abrir modal / cambiar modo editar — no pisa la elección del usuario. */
  const nutrientModalInitKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isNutrientModalOpen) {
      nutrientModalInitKeyRef.current = null;
      return;
    }
    const initKey =
      editingNutrientIndex !== null ? `edit:${editingNutrientIndex}` : 'new';
    if (nutrientModalInitKeyRef.current === initKey) {
      return;
    }
    nutrientModalInitKeyRef.current = initKey;

    if (editingNutrientIndex !== null) {
      setModalRelayNumber(
        nutrientsState[editingNutrientIndex]?.relayNumber ?? 0
      );
      return;
    }
    // Nutriente nuevo: sin valor actual (−1) para no forzar relé 0 como “seleccionable”.
    const selectable = getSelectableRelays(ecRelayRegistry, {
      field: 'ec_nutrient',
      currentValue: -1,
      nutrientIndex: nutrientsState.length,
    });
    setModalRelayNumber(selectable[0]?.number ?? 0);
  }, [
    isNutrientModalOpen,
    editingNutrientIndex,
    nutrientsState,
    ecRelayRegistry,
  ]);
  const { ec: ecAtual } = useHydroEcReading(deviceId, ecDeviceActive);

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
    completedAt: lastDosageCompletedAt,
  } = useLastDosage(deviceId, ecDeviceActive);

  const {
    isDosando: firmwareDosando,
    isAguardandoRecirculacao,
    operationRemainingSec: recirculacaoRestanteSec,
    nextCheckInSec: ecNextCheckInSec,
    isEcCheckPending,
    isDiluting,
    isDraining,
    isReplacing,
  } = useEcOperationState(deviceId, ecDeviceActive, {
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

  const loadLocalRelayNames = useCallback(async () => {
    if (!deviceId || deviceId === 'default_device') return;
    
    try {
      const names = await getMasterLocalRelayNames(deviceId);
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
  }, [deviceId]);
  
  // ✅ NOVO: Carregar configuração do EC Controller do Supabase
  const loadECControllerConfig = useCallback(async () => {
    if (!deviceId || deviceId === 'default_device') return;
    
    // ✅ PREVENIR DATA RACE: No recargar si acabamos de guardar (dentro de 2 segundos)
    if (justSavedRef.current) {
      console.log('⏸️ [EC Controller] Recarga bloqueada: acabamos de guardar, usando estado local');
      return;
    }
    
    try {
      const response = await fetch(`/api/ec-controller/config?device_id=${encodeURIComponent(deviceId)}`);
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
        flowRate?: number;
        flow_rate?: number;
      }
      
      // Carregar nutrientes do array JSONB
      if (config.nutrients && Array.isArray(config.nutrients) && config.nutrients.length > 0) {
        const nutrients = config.nutrients.map((nut: NutrientFromConfig) => {
          const q = Number(nut.flowRate ?? nut.flow_rate);
          return {
            name: nut.name || '',
            relayNumber: nut.relay || nut.relayNumber || 0,
            mlPerLiter: nut.mlPerLiter || 0,
            ...(Number.isFinite(q) && q > 0 ? { flowRate: q } : {}),
          };
        });
        setNutrientsState(nutrients);
      } else {
        // Iniciar vazio se não houver nutrientes
        setNutrientsState([]);
      }
      
      if (config.volume !== undefined && !isNaN(config.volume)) setTotalVolume(config.volume);
      
      // ✅ Carregar parâmetros do EC Controller
      if (config.base_dose !== undefined && !isNaN(config.base_dose)) setBaseDose(config.base_dose);
      if (
        config.ec_setpoint !== undefined &&
        !isNaN(config.ec_setpoint) &&
        config.ec_setpoint > 0
      ) {
        setEcSetpoint(config.ec_setpoint);
      }
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
      if (config.aggressiveness !== undefined && !isNaN(Number(config.aggressiveness))) {
        const a = Number(config.aggressiveness);
        setAggressiveness(Math.min(1, Math.max(0.05, a)));
      }
      if (config.pulse_ml !== undefined && !isNaN(Number(config.pulse_ml))) {
        const p = Number(config.pulse_ml);
        setPulseMl(Math.min(50, Math.max(0.05, p)));
      }
      if (config.pulse_gap_sec !== undefined && !isNaN(Number(config.pulse_gap_sec))) {
        const g = Number(config.pulse_gap_sec);
        setPulseGapSec(Math.min(120, Math.max(0, g)));
      }
      if (typeof config.consumo_24h === 'boolean') {
        setConsumo24h(config.consumo_24h);
      }
      markConfigSynced();
    } catch (error) {
      console.error('Erro ao carregar config EC Controller:', error);
    }
  }, [deviceId, markConfigSynced]);
  
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
  // - u(t) = (V / k) × e
  // - proporção = mlPerLiter / totalMlPerLiter
  // - utNutriente = totalUt × proporção
  // - tempoDosagem = utNutriente / flowRate_i (Calibragem)
  const calculateDistribution = useCallback(() => {
    const activeNutrients = nutrientsState.filter(
      (n) => n.mlPerLiter >= MIN_NUTRIENT_ML_PER_LITER
    );
    const totalMlPerLiter = activeNutrients.reduce((sum, nut) => sum + nut.mlPerLiter, 0);
    
    if (totalMlPerLiter <= 0 || baseDose <= 0 || totalVolume <= 0) {
      console.warn('⚠️ [EC Controller] Dados insuficientes para calcular distribution:', {
        totalMlPerLiter,
        baseDose,
        totalVolume
      });
      return null;
    }
    
    // Calcular k = baseDose / totalMlPerLiter
    const k = baseDose / totalMlPerLiter;
    
    // u(t) = (V / k) × e × A — e = SP − EC (só déficit, alinhado ao firmware)
    const error = Math.max(0, ecError);
    const totalUt = (totalVolume / k) * error * aggressiveness;
    
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
        
        const q = nutrientFlowRateMlPerSec(nut);
        const tempoDosagem = q > 0 ? utNutriente / q : 0;
        
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
  }, [nutrientsState, baseDose, totalVolume, ecError, intervaloAutoEC, aggressiveness]);

  const estimatedDoseMl = useMemo(
    () => calculateDistribution()?.totalUt ?? null,
    [calculateDistribution]
  );
  
  // ✅ NOVA ARQUITETURA: Salvar configuração do EC Controller em ec_config_view
  // Similar ao padrão relay_slaves/relay_commands_slave
  // Este botão apenas salva na view table, não ativa o Auto EC
  // Para ativar, use o botão "Ativar Auto EC" que chama RPC activate_auto_ec
  const saveECControllerConfig = useCallback(async (silent: boolean = false, overrideAutoEnabled?: boolean) => {
    if (!deviceId || deviceId === 'default_device') return false;

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
      toast.error(ec.toastNoNutrients);
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
        ...(nut.flowRate && nut.flowRate > 0 ? { flowRate: nut.flowRate } : {}),
      }));

      let existingNutrients: Array<Record<string, unknown>> = [];
      try {
        const prevRes = await fetch(
          `/api/ec-controller/config?device_id=${encodeURIComponent(deviceId)}`
        );
        if (prevRes.ok) {
          const prev = await prevRes.json();
          if (Array.isArray(prev.nutrients)) existingNutrients = prev.nutrients;
        }
      } catch {
        /* merge best-effort */
      }
      const nutrientsMerged = mergeNutrientFlowRates(existingNutrients, nutrientsJson);
      const missingFlow = nutrientsMerged.filter(
        (n) =>
          (Number(n.mlPerLiter) || 0) >= MIN_NUTRIENT_ML_PER_LITER &&
          !(Number(n.flowRate) > 0)
      );
      if (missingFlow.length > 0) {
        toast.error(
          `Ainda falta calibrar a bomba de: ${missingFlow.map((n) => n.name || 'nutriente').join(', ')}. Sem isso o Auto EC não dosifica.`
        );
      }
      
      const totalMl = activeNutrients.reduce((sum, nut) => sum + nut.mlPerLiter, 0);
      
      interface ECConfigPayload {
        device_id: string;
        base_dose: number;
        volume: number;
        total_ml: number;
        kp: number;
      ec_setpoint: number;
      tolerance: number;
      auto_enabled: boolean;
        nutrients: NutrientFlowRow[];
        intervalo_auto_ec?: number;
        tempo_recirculacao?: number;
        [key: string]: unknown;
      }
      
      // ✅ JSON OPTIMIZADO: Solo los 9 parámetros básicos + nutrients[] (sin distribution)
      // Construir payload optimizado com apenas os campos essenciais
      // ✅ CORRIGIDO: Usar overrideAutoEnabled se fornecido, senão usar autoEnabled do estado
      const payload: ECConfigPayload = {
        device_id: deviceId,
        base_dose: baseDose,
        volume: totalVolume,
        total_ml: totalMl,
        kp: 1.0, // ✅ Ganho proporcional (default: 1.0)
        ec_setpoint: ecSetpoint,
        tolerance: ecTolerance,
        auto_enabled: overrideAutoEnabled !== undefined ? overrideAutoEnabled : autoEnabled,
        aggressiveness,
        consumo_24h: consumo24h,
        pulse_ml: pulseMl,
        pulse_gap_sec: pulseGapSec,
        nutrients: nutrientsMerged,
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
        toast.error(relayCheck.error || ec.toastConflict);
        return false;
      }

      const writable = sanitizeEcNumericFields(
        stripEcWritableConfig(payload as unknown as Record<string, unknown>)
      );
      const postBody = { device_id: deviceId, ...writable };

      console.log('📤 [EC Controller] Payload optimizado:', JSON.stringify(postBody, null, 2));

      const response = await fetch('/api/ec-controller/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postBody),
      });
      
      if (!response.ok) {
        const parsed = await parseConfigApiError(response);
        console.error('❌ [EC Controller] Erro ao salvar:', {
          status: parsed.status,
          message: parsed.message,
          body: parsed.body,
          payload: postBody,
          device_id: deviceId,
        });
        toast.error(`Erro ao salvar: ${parsed.message}`);
        return false;
      }
      
      const result = await response.json();
      console.log('✅ [EC Controller] Configuração salva com sucesso em ec_config_view:', result);
      void relayAllocation.refresh();
      console.log('📤 [EC Controller] Dados salvos na view table (prontos para RPC activate_auto_ec):', {
        table: 'ec_config_view',
        device_id: deviceId,
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
      markConfigSynced();
      if (!silent) {
        hwToast.success(ec.toastSaved, 'AUTO EC');
      }
      return true;
    } catch (error) {
      console.error('❌ [EC Controller] Erro ao salvar config:', error);
      toast.error(`Erro: ${error instanceof Error ? error.message : 'Desconhecido'}`);
      return false;
    }
  }, [deviceId, nutrientsState, totalVolume, baseDose, ecSetpoint, ecTolerance, intervaloAutoEC, tempoRecirculacao, autoEnabled, aggressiveness, consumo24h, pulseMl, pulseGapSec, availableRelays, relayAllocation, markConfigSynced, ec]);
  
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
      ...(nut.flowRate && nut.flowRate > 0 ? { flowRate: nut.flowRate } : {}),
    }));
    
    const totalMl = activeNutrients.reduce((sum, nut) => sum + nut.mlPerLiter, 0);
    const kFactor = totalMl > 0 ? baseDose / totalMl : 0;
    
    interface ECConfigJSON {
      device_id: string;
      base_dose: number;
      volume: number;
      total_ml: number;
      kp: number;
      ec_setpoint: number;
      tolerance?: number;
      auto_enabled: boolean;
      nutrients: NutrientFlowRow[];
      intervalo_auto_ec?: number;
      tempo_recirculacao?: number;
      _debug?: unknown;
      [key: string]: unknown;
    }
    
    // ✅ JSON OPTIMIZADO: Solo los 9 parámetros básicos + nutrients[] (sin distribution)
    const ecConfigJson: ECConfigJSON = {
      device_id: deviceId,
      base_dose: baseDose,
      volume: totalVolume,
      total_ml: totalMl,
      kp: 1.0, // ✅ Ganho proporcional (default: 1.0)
      ec_setpoint: ecSetpoint,
      tolerance: ecTolerance,
      auto_enabled: autoEnabled,
      aggressiveness,
      consumo_24h: consumo24h,
      pulse_ml: pulseMl,
      pulse_gap_sec: pulseGapSec,
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
      base_dose_us_per_cm: baseDose,
      total_ml_per_liter: totalMl,
      nutrients_count: nutrientsJson.length,
      k_factor: kFactor > 0 ? kFactor.toFixed(3) : '—',
      equation: kFactor > 0
        ? `u(t) = (${totalVolume} / ${kFactor.toFixed(3)}) × e`
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
  }, [deviceId, nutrientsState, totalVolume, baseDose, ecSetpoint, ecTolerance, intervaloAutoEC, tempoRecirculacao, autoEnabled, aggressiveness, consumo24h, pulseMl, pulseGapSec, availableRelays, relayAllocation]);
  
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
    if (deviceId && deviceId !== 'default_device') {
      const updatedNutrient = updatedNutrients[nutrientIndex];
      await saveMasterLocalRelayName(deviceId, newRelayNumber, updatedNutrient.name);
      
      // Atualizar nomes locais
      await loadLocalRelayNames();
      
      // Salvar automaticamente no Supabase
      await saveECControllerConfig();
    }
  }, [deviceId, nutrientsState, loadLocalRelayNames, saveECControllerConfig, getEcRelayNamingLock]);

  const totalMlPerLiter = useMemo(
    () => nutrientsState.reduce((sum, nut) => sum + nut.mlPerLiter, 0),
    [nutrientsState]
  );

  const canActivateAutoEc = useMemo(() => {
    const activeCount = nutrientsState.filter((n) => n.mlPerLiter >= MIN_NUTRIENT_ML_PER_LITER).length;
    return activeCount > 0 && totalMlPerLiter > 0;
  }, [nutrientsState, totalMlPerLiter]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      setDoseClock((t) => t + 1);
      setDoseEndsAt((prev) => {
        const keys = Object.keys(prev);
        if (keys.length === 0) return prev;
        const next = { ...prev };
        let changed = false;
        keys.forEach((k) => {
          const relay = Number(k);
          if (next[relay] <= now) {
            delete next[relay];
            changed = true;
            setIsLoadingNutrients((loading) => {
              if (!loading[relay]) return loading;
              const copy = { ...loading };
              delete copy[relay];
              return copy;
            });
          }
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setSavedConfigSnapshot(null);
    setConfigSyncTick(0);
    if (deviceId && deviceId !== 'default_device') {
      loadLocalRelayNames();
      loadECControllerConfig();
      loadDoserRelayStates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  useEffect(() => {
    if (configSyncTick === 0) return;
    setSavedConfigSnapshot(ecFormSnapshot);
    // Capture only on load/save ticks — not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configSyncTick]);

  useEffect(() => {
    const onFlowRateUpdated = (e: Event) => {
      const detail = (
        e as CustomEvent<{ deviceId: string; flowRate: number; relay?: number }>
      ).detail;
      if (detail?.deviceId !== deviceId || !(detail.flowRate > 0)) return;
      const relay = detail.relay;
      if (typeof relay === 'number') {
        setNutrientsState((prev) =>
          prev.map((n) =>
            n.relayNumber === relay ? { ...n, flowRate: detail.flowRate } : n
          )
        );
      }
    };
    window.addEventListener('flowRateUpdated', onFlowRateUpdated);
    return () => window.removeEventListener('flowRateUpdated', onFlowRateUpdated);
  }, [deviceId]);

  useEffect(() => {
    if (!deviceId || deviceId === 'default_device') return;

    loadDoserRelayStates();

    const unsubscribe = subscribeRelayStateUpdates(
      deviceId,
      (masterRow) => {
        if (masterRow.doser_relay_states?.length) {
          setDoserRelayStates(masterRow.doser_relay_states);
        }
      },
      () => {}
    );

    const clearFallback = setVisibleInterval(() => {
      loadDoserRelayStates();
    }, RELAY_REST_FALLBACK_MS);

    return () => {
      unsubscribe();
      clearFallback();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, loadDoserRelayStates]);

  useEffect(() => {
    if (!deviceId || deviceId === 'default_device') return;
    setAutoRtStatus('connecting');
    return subscribeAutoEnabled(
      deviceId,
      'ec_config_view',
      (enabled) => {
        if (justSavedRef.current || autoTogglePending) return;
        setAutoEnabled(enabled);
      },
      (status) => setAutoRtStatus(status)
    );
  }, [deviceId, autoTogglePending]);

  const toggleAutoEc = async () => {
    const newValue = !autoEnabled;
    const previous = autoEnabled;

    if (newValue && !canActivateAutoEc) {
      toast.error(ec.toastNoNutrients);
      return;
    }

    setAutoEnabled(newValue);
    setAutoTogglePending(true);
    justSavedRef.current = true;
    if (savingTimeoutRef.current) clearTimeout(savingTimeoutRef.current);

    try {
      if (newValue) {
        const saved = await saveECControllerConfig(true, true);
        if (!saved) {
          setAutoEnabled(previous);
          toast.error(ec.toastSaveBeforeActivate);
          return;
        }
        const { error: rpcError } = await supabase.rpc('activate_auto_ec', {
          p_device_id: deviceId,
        });
        if (rpcError) {
          setAutoEnabled(previous);
          toast.error(`Erro ao ativar via RPC: ${rpcError.message}`);
          return;
        }
      }

      const { error } = await supabase
        .from('ec_config_view')
        .update({
          auto_enabled: newValue,
          updated_at: new Date().toISOString(),
        })
        .eq('device_id', deviceId);

      if (error) {
        setAutoEnabled(previous);
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
          .eq('device_id', deviceId);
        if (idleError) {
          console.warn('⚠️ [EC Controller] Falha ao limpar ec_operation:', idleError.message);
        }
      }

      const mqttPush = await fetch('/api/ec-controller/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, auto_enabled: newValue }),
      });
      if (!mqttPush.ok) {
        const parsed = await parseConfigApiError(mqttPush);
        console.warn('[EC Controller] Postgres OK, MQTT config falhou:', parsed.message);
      }

      savingTimeoutRef.current = setTimeout(() => {
        justSavedRef.current = false;
      }, 2000);

      if (newValue) hwToast.success(ec.toastActivated, 'AUTO EC');
      else hwToast.info(ec.toastDeactivated, 'AUTO EC');
    } catch (err) {
      setAutoEnabled(previous);
      toast.error(`Erro: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    } finally {
      setAutoTogglePending(false);
    }
  };

  if (!deviceId || deviceId === 'default_device') {
    return (
      <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg p-6 mb-6 text-dark-textSecondary text-sm">
        {ec.selectDevice}
      </div>
    );
  }

  return (
    <>
      <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg overflow-hidden mb-6">
        <div className="w-full p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-dark-border">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-dark-text">{ec.title}</h3>
            <OperationStateBadges
              variant="header"
              autoEnabled={autoEnabled}
              autoActiveLabel={ec.autoActive}
              autoInactiveLabel={ec.autoInactive}
              isDosando={isDosando || isDraining}
              dosandoLabel={isDraining ? ec.draining : ec.dosing}
              isReplacing={isReplacing}
              replacingLabel={ec.replacing}
              isAguardandoRecirculacao={isAguardandoRecirculacao}
              operationRemainingSec={recirculacaoRestanteSec}
              showNextCheck={showEcNextCheck}
              nextCheckInSec={ecNextCheckInSec}
              nextCheckLabel={ec.nextCheck}
              accent="emerald"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              showLockUnlockToast(ecControllerLocked, ec.lockSection, () =>
                setEcControllerLocked((prev) => !prev)
              );
            }}
            className={`p-1.5 rounded transition-colors ${
              ecControllerLocked
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                : 'bg-aqua-500/20 text-aqua-400 hover:bg-aqua-500/30 border border-aqua-500/30'
            }`}
            title={ecControllerLocked ? ec.unlock : ec.lock}
          >
            {ecControllerLocked ? (
              <LockClosedIcon className="w-4 h-4" />
            ) : (
              <LockOpenIcon className="w-4 h-4" />
            )}
          </button>
        </div>
        <div className="p-4 sm:p-6">
                        {/* ===== SEÇÃO: CONFIGURAÇÃO EC CONTROLLER ===== */}
                        <div>
                          <h2 className="text-lg sm:text-xl font-bold text-dark-text mb-3 sm:mb-4">🎯 {ec.titleLong}</h2>
                          <p className="text-xs sm:text-sm text-dark-textSecondary mb-4">
                            {ec.subtitle}
                          </p>
          
                          <div className="mb-6 rounded-lg border border-aqua-500/30 bg-aqua-500/5 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setExpandedEcInfo((open) => !open)}
                              className="w-full p-4 flex items-center gap-2 text-left text-sm font-semibold text-aqua-300 hover:bg-aqua-500/10 transition-colors"
                            >
                              {expandedEcInfo ? (
                                <ChevronUpIcon className="w-4 h-4 shrink-0" />
                              ) : (
                                <ChevronDownIcon className="w-4 h-4 shrink-0" />
                              )}
                              {ec.helpTitle}
                            </button>
                            {expandedEcInfo && (
                            <div className="px-4 pb-4 space-y-2 text-xs sm:text-sm text-dark-textSecondary leading-relaxed border-t border-aqua-500/20">
                              <p>{ec.help1.replace('{min}', String(MIN_NUTRIENT_ML_PER_LITER))}</p>
                              <p>{ec.help2}</p>
                              <p>{ec.help3}</p>
                              <p>{ec.help4}</p>
                              <p>{ec.help5}</p>
                              <p className="text-dark-textSecondary/80">
                                {ec.helpGuidePrefix}
                                <NavLink href="/informacao" className="text-aqua-400 hover:underline">
                                  {ec.helpGuideLink}
                                </NavLink>
                                .
                              </p>
                            </div>
                            )}
                          </div>

                          {deviceId ? (
                            <div className="mb-6">
                              <ControllerMetricsPanel
                                deviceId={deviceId}
                                focus="ec"
                                hideTabs
                              />
                            </div>
                          ) : null}

                          {/* Status / Ajuste agora — abaixo do chart, acima da config Auto EC */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            {/* Status do EC Controller */}
                            <InstrumentCard accent="ec" title={`📊 ${ec.statusCard}`} ariaLive="polite">
                              <div className="space-y-2.5">
                                <OperationStateBanners
                                  autoEnabled={autoEnabled}
                                  isDosando={isDosando}
                                  dosandoLabel={ec.dosing}
                                  isAguardandoRecirculacao={isAguardandoRecirculacao}
                                  operationRemainingSec={recirculacaoRestanteSec}
                                  showNextCheck={
                                    !isDosando &&
                                    !isAguardandoRecirculacao &&
                                    autoEnabled &&
                                    ecNextCheckInSec > 0
                                  }
                                  nextCheckInSec={ecNextCheckInSec}
                                  nextCheckLabel={ec.nextCheck}
                                  formatCountdown={formatRecircCountdown}
                                />
                                <MetricRow
                                  label={ec.statusLabel}
                                  value={autoEnabled ? ec.statusOn : ec.statusOff}
                                  variant={autoEnabled ? 'ok' : 'danger'}
                                />
                                <MetricRow
                                  label={ec.setpoint}
                                  value={
                                    ecSetpoint > 0
                                      ? `${formatSensorValue(ecSetpoint, 0)} µS/cm`
                                      : '--'
                                  }
                                  variant="setpoint"
                                  domain="ec"
                                />
                                <MetricRow
                                  label={ec.deadband}
                                  value={`± ${formatSensorValue(ecTolerance, 0)} µS/cm`}
                                />
                                <MetricRow
                                  label={ec.errorSpEc}
                                  value={
                                    ecAtual !== null
                                      ? `${formatSensorValue(Math.max(0, ecError), 1)} µS/cm`
                                      : '-- µS/cm'
                                  }
                                  variant={ecWithinDeadBand === false ? 'alarm' : 'default'}
                                />
                                <MetricRow
                                  label={ec.controlZone}
                                  value={
                                    ecWithinDeadBand === null
                                      ? '--'
                                      : ecWithinDeadBand
                                        ? ec.noDoseAbove
                                        : ec.adjustKp
                                  }
                                  variant={
                                    ecWithinDeadBand === true ? 'ok' : ecWithinDeadBand === false ? 'alarm' : 'default'
                                  }
                                />
                                <MetricRow
                                  label={ec.lastDose}
                                  value={lastDosageMl != null ? `${lastDosageMl.toFixed(2)} ml` : '-- ml'}
                                  variant="preview"
                                  domain="ec"
                                />
                                <MetricRow
                                  label={ec.ecActual}
                                  value={
                                    ecAtual !== null
                                      ? `${formatSensorValue(ecAtual, 1)} µS/cm`
                                      : '-- µS/cm'
                                  }
                                  variant="live"
                                />
                              </div>
                              <NutrientDosageDetail
                                deviceId={deviceId}
                                sequenceId={lastDosageSequenceId}
                                enabled={ecDeviceActive}
                              />
                            </InstrumentCard>
                            
                            <EcGrowerSummaryCard
                              deviceId={deviceId}
                              consumo24h={consumo24h}
                              ecNow={ecAtual}
                              setpoint={ecSetpoint}
                              tolerance={ecTolerance}
                              estimatedDoseMl={estimatedDoseMl}
                              lastDoseMl={lastDosageMl}
                              lastDoseAt={lastDosageCompletedAt}
                              autoEnabled={autoEnabled}
                              showNextCheck={showEcNextCheck}
                              nextCheckInSec={ecNextCheckInSec}
                              formatCountdown={formatRecircCountdown}
                            />
                          </div>
                          
                          {/* ===== TABELA DE NUTRIÇÃO (PRIMEIRO) ===== */}
                          <div className="mb-6 sm:mb-8 pb-6 sm:pb-8 border-b border-dark-border">
                            {/* Header com título e botão + Nutriente */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4">
                              <h3 className="text-base sm:text-lg font-bold text-dark-text">{ec.nutritionTable}</h3>
                              <button
                                onClick={() => {
                                  setEditingNutrientIndex(null);
                                  setIsNutrientModalOpen(true);
                                }}
                                disabled={addNutrientControl.disabled}
                                className={`flex items-center justify-center space-x-2 px-4 py-3 sm:py-2 bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white rounded-lg transition-all shadow-lg hover:shadow-aqua-500/50 text-sm sm:text-base w-full sm:w-auto ${
                                  addNutrientControl.disabled ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                                title={addNutrientControl.title || ec.addNutrient}
                              >
                                <span className="text-base sm:text-lg">+</span>
                                <span>{ec.nutrient}</span>
                              </button>
                            </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                          <div className="bg-dark-surface/60 border border-aqua-500/25 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-dark-text">
                                Quanto cada bomba dosifica
                              </p>
                              <p className="text-xs text-dark-textSecondary mt-1">
                                Cada bomba precisa saber quanto líquido solta por segundo. Isso se mede em
                                Calibragem. Sem calibrar, essa bomba não dosifica o nutriente.
                              </p>
                            </div>
                            <NavLink
                              href="/calibragem"
                              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg border border-aqua-500/40 text-aqua-400 hover:bg-aqua-500/10 transition-colors whitespace-nowrap"
                            >
                              {ec.calibratePumps}
                            </NavLink>
                          </div>
          
                          <div>
                            <label htmlFor="totalVolume" className="block text-sm font-medium text-dark-textSecondary mb-1">
                              {ec.tankVolume}
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
                                <th className="py-2 px-4 text-left text-sm font-medium text-dark-textSecondary">{ec.nutrient}</th>
                                <th className="py-2 px-4 text-left text-sm font-medium text-dark-textSecondary">{ec.colRelay}</th>
                                <th className="py-2 px-4 text-left text-sm font-medium text-dark-textSecondary">{ec.colMlPerL}</th>
                                <th className="py-2 px-4 text-left text-sm font-medium text-dark-textSecondary">{ec.colQuantity}</th>
                                <th className="py-2 px-4 text-left text-sm font-medium text-dark-textSecondary">{ec.colFlow}</th>
                                <th className="py-2 px-4 text-left text-sm font-medium text-dark-textSecondary">{ec.colTime}</th>
                                <th className="py-2 px-4 text-left text-sm font-medium text-dark-textSecondary">{ec.colAction}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {nutrientsState.map((nutrient, index) => {
                                const calculateQuantity = (mlPerLiter: number): number => {
                                  return mlPerLiter * totalVolume;
                                };
          
                                const calculateTime = (mlPerLiter: number): number => {
                                  const q = nutrientFlowRateMlPerSec(nutrient);
                                  if (q <= 0) return 0;
                                  return calculateQuantity(mlPerLiter) / q;
                                };
          
                                const relayNamingLock = getEcRelayNamingLock(nutrient.relayNumber);
                                const relayControl = composeRelayControlDisabled(ecControllerLocked, relayNamingLock);
                                const editNutrientControl = composeRelayControlDisabled(
                                  ecControllerLocked,
                                  relayNamingLock
                                );
                                const ownDose =
                                  Boolean(isLoadingNutrients[nutrient.relayNumber]) ||
                                  (doseEndsAt[nutrient.relayNumber] || 0) > Date.now();
                                const busyClaim = ownDose
                                  ? undefined
                                  : getRelayBusyClaim(
                                      relayAllocation.registry,
                                      nutrient.relayNumber
                                    );
                                const hardwareOn =
                                  !ownDose && doserRelayStates[nutrient.relayNumber] === true;
                                const manualDoseLock = resolveEcManualDoseButtonLock({
                                  autoEnabled,
                                  relayNumber: nutrient.relayNumber,
                                  manualPendingRelays,
                                  ecManualDosingRelay: Boolean(isLoadingNutrients[nutrient.relayNumber]),
                                  relayHardwareOn: hardwareOn,
                                  busyLabel: busyClaim?.label ?? null,
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
                                  const ownDose =
                                    Boolean(isLoadingNutrients[nut.relayNumber]) ||
                                    (doseEndsAt[nut.relayNumber] || 0) > Date.now();
                                  const doseLock = resolveEcManualDoseButtonLock({
                                    autoEnabled,
                                    relayNumber: nut.relayNumber,
                                    manualPendingRelays,
                                    ecManualDosingRelay: Boolean(isLoadingNutrients[nut.relayNumber]),
                                    relayHardwareOn:
                                      !ownDose && doserRelayStates[nut.relayNumber] === true,
                                    busyLabel: ownDose
                                      ? null
                                      : getRelayBusyClaim(
                                          relayAllocation.registry,
                                          nut.relayNumber
                                        )?.label ?? null,
                                  });
                                  if (doseLock.locked) {
                                    toast.error(doseLock.tooltip);
                                    return;
                                  }
          
                                  let timeNeeded = 0;
                                  if (nut.mlPerLiter > 0) {
                                    timeNeeded = calculateTime(nut.mlPerLiter);
                                    if (timeNeeded <= 0) {
                                      toast.error(
                                        'Esta bomba ainda não está calibrada. Vá em Calibragem e meça quanto líquido ela solta por segundo.'
                                      );
                                      return;
                                    }
                                  } else {
                                    timeNeeded = 10;
                                  }
          
                                  setIsLoadingNutrients({ ...isLoadingNutrients, [nut.relayNumber]: true });
                                  setDoseEndsAt((prev) => ({
                                    ...prev,
                                    [nut.relayNumber]: Date.now() + Math.ceil(timeNeeded) * 1000,
                                  }));
                                  
                                  try {
                                    const doseMl =
                                      nut.mlPerLiter > 0 ? calculateQuantity(nut.mlPerLiter) : 0;
                                    const response = await fetch('/api/esp-now/command', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        master_device_id: deviceId,
                                            slave_mac_address: null,
                                        relay_number: nut.relayNumber,
                                        action: 'on',
                                        duration_seconds: Math.ceil(timeNeeded),
                                        mode: 'timed_on',
                                        triggered_by: 'manual',
                                        created_by: 'manual',
                                            command_type: 'manual',
                                        rule_name: nut.mlPerLiter > 0 ? `Dosagem: ${nut.name}` : `Ativação: ${nut.name}`,
                                        ...(doseMl > 0 ? { dosage_ml: doseMl } : {}),
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
                                      setDoseEndsAt((prev) => {
                                        const next = { ...prev };
                                        delete next[nut.relayNumber];
                                        return next;
                                      });
                                      setIsLoadingNutrients((prev) => {
                                        const next = { ...prev };
                                        delete next[nut.relayNumber];
                                        return next;
                                      });
                                      toast.error(`Erro ao acionar ${nut.name}: ${error.error || 'Erro desconhecido'}`);
                                    }
                                  } catch (error) {
                                    setDoseEndsAt((prev) => {
                                      const next = { ...prev };
                                      delete next[nut.relayNumber];
                                      return next;
                                    });
                                    setIsLoadingNutrients((prev) => {
                                      const next = { ...prev };
                                      delete next[nut.relayNumber];
                                      return next;
                                    });
                                    toast.error(`Erro: ${error instanceof Error ? error.message : 'Desconhecido'}`);
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
                                    <td className="py-2 px-4 text-dark-text">
                                      {nutrientFlowRateMlPerSec(nutrient) > 0
                                        ? formatFlowRate(nutrientFlowRateMlPerSec(nutrient))
                                        : '—'}
                                    </td>
                                    <td className="py-2 px-4 text-dark-text">{calculateTime(nutrient.mlPerLiter).toFixed(1)}</td>
                                    <td className="py-2 px-4">
                                          <div className="flex items-center space-x-2">
                                      <button
                                        onClick={() => handleDoseNutrient(nutrient, index)}
                                        disabled={manualDoseControl.disabled}
                                        className={`px-3 py-1.5 rounded transition-all shadow-lg ${
                                          manualDoseLock.reason === 'relay_busy' ||
                                          manualDoseLock.reason === 'manual_pending'
                                            ? 'bg-amber-600/80 text-white cursor-not-allowed'
                                            : 'bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white hover:shadow-aqua-500/50'
                                        } ${
                                          manualDoseControl.disabled ? 'opacity-50 cursor-not-allowed' : ''
                                        }`}
                                        title={manualDoseControl.title || ec.dose}
                                      >
                                        {(() => {
                                          const left = Math.max(
                                            0,
                                            Math.ceil(
                                              ((doseEndsAt[nutrient.relayNumber] || 0) - Date.now()) /
                                                1000
                                            )
                                          );
                                          if (left > 0) return `ON ${left}s`;
                                          if (isLoadingNutrients[nutrient.relayNumber]) return ec.dosingBusy;
                                          if (manualDoseControl.disabled) return ec.locked;
                                          return ec.dose;
                                        })()}
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
                            <h3 className="text-base sm:text-lg font-bold text-dark-text mb-1">{ec.hydroParams}</h3>
                            <p className="text-xs text-dark-textSecondary mb-4">
                              {ec.hydroParamsHint}
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
                                {ec.sumMlPerL}
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
                                {ec.ecSetpoint}
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
                                {ec.toleranceDeadband}
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
                                {ec.noDoseIfAbove.replace('{n}', String(ecTolerance))}
                              </small>
                            </div>

                            <div>
                              <label htmlFor="ec-pulse-ml" className="block text-sm font-medium text-dark-textSecondary mb-1">
                                {ec.pulseMl}
                              </label>
                              <input
                                id="ec-pulse-ml"
                                type="number"
                                min="0.05"
                                max="50"
                                step="0.1"
                                value={isNaN(pulseMl) ? '' : pulseMl}
                                onChange={(e) => {
                                  const value = parseFloat(e.target.value);
                                  setPulseMl(isNaN(value) || value <= 0 ? 2 : Math.min(50, Math.max(0.05, value)));
                                }}
                                disabled={ecControllerLocked}
                                className={`w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text focus:border-aqua-500 focus:outline-none ${
                                  ecControllerLocked ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                                placeholder="Ex: 2"
                              />
                              <small className="text-xs text-dark-textSecondary mt-1 block">
                                ON ≈ {pulseMl.toFixed(2)} ml ÷ caudal; último pulso = resto (sem arredondar)
                              </small>
                            </div>

                            <div>
                              <label htmlFor="ec-pulse-gap" className="block text-sm font-medium text-dark-textSecondary mb-1">
                                Gap pulsos (s):
                              </label>
                              <input
                                id="ec-pulse-gap"
                                type="number"
                                min="0"
                                max="120"
                                step="0.5"
                                value={isNaN(pulseGapSec) ? '' : pulseGapSec}
                                onChange={(e) => {
                                  const value = parseFloat(e.target.value);
                                  setPulseGapSec(isNaN(value) || value < 0 ? 2 : Math.min(120, Math.max(0, value)));
                                }}
                                disabled={ecControllerLocked}
                                className={`w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text focus:border-aqua-500 focus:outline-none ${
                                  ecControllerLocked ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                                placeholder="Ex: 3"
                              />
                              <small className="text-xs text-dark-textSecondary mt-1 block">
                                Descanso entre pulsos do mesmo nutriente. Homogeneização = tempo de recirculação após a sequência.
                              </small>
                            </div>
                          </div>
                          </div>
          
                          {/* Parâmetros de ciclo */}
                          <div className="mb-8 pb-6 border-b border-dark-border">
                            <h3 className="text-base sm:text-lg font-bold text-dark-text mb-1">{ec.cycleParams}</h3>
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
          
                          {deviceId && deviceId !== 'default_device' && (
                            <EcMalhaFechadaConfig
                              deviceId={deviceId}
                              ecActual={ecAtual}
                              ecSetpoint={ecSetpoint}
                              tolerance={ecTolerance}
                              tankVolumeL={totalVolume}
                              espnowSlaves={espnowSlaves}
                              locked={ecControllerLocked}
                              autoEnabled={autoEnabled}
                            />
                          )}

                          <div className="mb-4 rounded-lg border border-aqua-500/30 bg-aqua-500/5 p-4">
                            <p className="text-sm font-medium text-dark-text mb-3">
                              {ec.aggressiveness24h}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm text-dark-textSecondary mb-1">
                                  {ec.aggressivenessEc.replace(
                                    '{pct}',
                                    String(Math.round(aggressiveness * 100))
                                  )}
                                </label>
                                <input
                                  type="range"
                                  min={5}
                                  max={100}
                                  step={10}
                                  value={Math.round(aggressiveness * 100)}
                                  disabled={ecControllerLocked}
                                  onChange={(e) => {
                                    const pct = parseInt(e.target.value, 10) || 50;
                                    setAggressiveness(Math.min(1, Math.max(0.05, pct / 100)));
                                  }}
                                  className="w-full accent-aqua-500 disabled:opacity-50"
                                />
                                <span className="text-xs text-dark-textSecondary">
                                  Tope de passo do Auto EC (5–100 %). Não substitui Kp.
                                </span>
                              </div>
                              <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="mt-1 accent-aqua-500 disabled:opacity-50"
                                  checked={consumo24h}
                                  disabled={ecControllerLocked}
                                  onChange={(e) => setConsumo24h(e.target.checked)}
                                />
                                <span>
                                  <span className="block text-sm text-dark-text">Consumo EC 24 h</span>
                                  <span className="block text-xs text-dark-textSecondary">
                                    Liga o diário de 24 h no resumo (seta de EC e ml dosados). Também é a
                                    camada do firmware. Default OFF. Não muda o intervalo.
                                  </span>
                                </span>
                              </label>
                            </div>
                          </div>
                          
                          {/* Botões de Controle */}
                          <div className="flex flex-wrap gap-3 mb-4">
                            <button
                              onClick={async () => {
                                if (!ecConfigDirty) return;
                                await saveECControllerConfig();
                              }}
                              disabled={ecControllerLocked || !ecConfigDirty}
                              className={`px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg transition-all ${
                                ecControllerLocked || !ecConfigDirty
                                  ? 'opacity-50 cursor-not-allowed'
                                  : 'hover:from-green-600 hover:to-emerald-600 shadow-lg hover:shadow-green-500/50'
                              }`}
                              title={
                                ecControllerLocked
                                  ? 'Controles bloqueados'
                                  : ecConfigDirty
                                    ? 'Salvar parâmetros'
                                    : 'Nada a salvar — já está gravado'
                              }
                            >
                              {ec.saveParams}
                            </button>
                            <button
                              onClick={() => void toggleAutoEc()}
                              disabled={
                                ecControllerLocked ||
                                autoTogglePending ||
                                (!autoEnabled && !canActivateAutoEc)
                              }
                              className={`px-4 py-2 rounded-lg transition-all shadow-lg ${
                                autoEnabled
                                  ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white'
                                  : 'bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white'
                              } ${
                                ecControllerLocked ||
                                autoTogglePending ||
                                (!autoEnabled && !canActivateAutoEc)
                                  ? 'opacity-50 cursor-not-allowed'
                                  : ''
                              }`}
                              title={
                                ecControllerLocked
                                  ? 'Controles bloqueados'
                                  : !autoEnabled && !canActivateAutoEc
                                    ? 'Adicione nutrientes com ml/L > 0 antes de ativar'
                                    : autoEnabled
                                      ? ec.deactivate
                                      : ec.activate
                              }
                            >
                              {autoTogglePending
                                ? '…'
                                : autoEnabled
                                  ? ec.deactivate
                                  : ec.activate}
                              {autoRtStatus === 'SUBSCRIBED' && !autoTogglePending ? (
                                <span className="ml-1.5 text-[10px] opacity-80">{ec.live}</span>
                              ) : null}
                            </button>
                            <button
                              onClick={() => {
                                setShowECConfigPreview(true);
                              }}
                              disabled={ecControllerLocked}
                              className={`px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-lg transition-all shadow-lg hover:shadow-purple-500/50 ${
                                ecControllerLocked ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                              title={ecControllerLocked ? 'Controles bloqueados' : ec.debugPreviewTitle}
                            >
                              {ec.debugButton}
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
                                setAggressiveness(0.5);
                                setConsumo24h(false);
                                setPulseMl(2.0);
                                setPulseGapSec(2.0);
                                toast.success('Valores limpos');
                              }}
                              disabled={ecControllerLocked}
                              className={`px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all ${
                                ecControllerLocked ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                              title={ecControllerLocked ? 'Controles bloqueados' : ec.clearValues}
                            >
                              <XMarkIcon className="w-4 h-4 inline mr-1" />
                              {ec.clearValues}
                            </button>
                          </div>
                        </div>
        </div>
      </div>

      {isNutrientModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-card border border-dark-border rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-dark-text mb-4">
              {editingNutrientIndex !== null ? ec.editNutrient : ec.addNutrient}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-textSecondary mb-1">
                  {ec.nutrientName}
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
                  {ec.relayMaster}
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
                  {ec.colMlPerL}
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

                  const projected =
                    editingNutrientIndex !== null
                      ? nutrientsState.map((n, i) =>
                          i === editingNutrientIndex ? newNutrient : n
                        )
                      : [...nutrientsState, newNutrient];

                  const relayCheck = validateEcNutrientsAssignment(
                    projected.map((n) => ({
                      name: n.name,
                      relay: n.relayNumber,
                      mlPerLiter: n.mlPerLiter,
                      active: true,
                    })),
                    relayAllocation.phConfig ?? undefined
                  );
                  if (!relayCheck.ok) {
                    toast.error(relayCheck.error || 'Relé já está em uso');
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
                  if (deviceId && deviceId !== 'default_device') {
                    await saveMasterLocalRelayName(deviceId, newNutrient.relayNumber, newNutrient.name);
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
                {editingNutrientIndex !== null ? t.automacao.common.save : ec.addNutrient}
              </button>
            </div>
          </div>
        </div>
      )}

      {showECConfigPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-dark-border">
              <h2 className="text-xl font-bold text-dark-text">
                {ec.debugTitle}
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
                  {ec.debugIntro}
                </p>
                <p className="text-xs text-dark-textSecondary mb-2">
                  {ec.debugConsoleNote}
                </p>
                <div className="mt-3 space-y-1 text-xs text-dark-textSecondary">
                  {ec.debugLegend.split('\n').map((line) => {
                    const idx = line.indexOf(':');
                    if (idx < 0) return <p key={line}>{line}</p>;
                    const key = line.slice(0, idx);
                    const rest = line.slice(idx + 1);
                    return (
                      <p key={key} className={key === '_debug' ? 'mt-2 text-purple-300' : undefined}>
                        <strong className="text-purple-300">{key}:</strong>
                        {rest}
                      </p>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-dark-border">
              <button
                onClick={() => {
                  const jsonStr = JSON.stringify(getECConfigJson(), null, 2);
                  navigator.clipboard.writeText(jsonStr);
                  toast.success(t.automacao.common.toastJsonCopied);
                }}
                className="px-4 py-2 bg-dark-surface hover:bg-dark-border text-dark-text border border-dark-border rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <ClipboardIcon className="w-4 h-4" />
                {t.automacao.common.copyJson}
              </button>
              <button
                onClick={() => setShowECConfigPreview(false)}
                className="px-4 py-2 bg-dark-surface hover:bg-dark-border text-dark-text border border-dark-border rounded-lg text-sm font-medium transition-colors"
              >
                {t.automacao.common.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
