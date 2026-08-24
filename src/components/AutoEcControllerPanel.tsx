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
import { getSelectableRelays, serializeRegistryForDebug, validateEcNutrientsAssignment } from '@/lib/relay-allocation';
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
import { showLockUnlockToast } from '@/lib/automacao/admin-lock';

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

export interface AutoEcControllerPanelProps {
  deviceId: string;
  espnowSlaves: ESPNowSlave[];
}

export default function AutoEcControllerPanel({ deviceId, espnowSlaves }: AutoEcControllerPanelProps) {
  const [ecControllerLocked, setEcControllerLocked] = useState<boolean>(false);
  const [expandedEcInfo, setExpandedEcInfo] = useState(false);
  const [showECConfigPreview, setShowECConfigPreview] = useState<boolean>(false);
  const [pumpFlowRate, setPumpFlowRate] = useState<number>(1.0);
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
  const [isNutrientModalOpen, setIsNutrientModalOpen] = useState<boolean>(false);
  const [editingNutrientIndex, setEditingNutrientIndex] = useState<number | null>(null);
  const [modalRelayNumber, setModalRelayNumber] = useState(0);
  
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
      
      // Carregar pumpFlowRate e totalVolume
      if (config.flow_rate !== undefined && !isNaN(config.flow_rate)) setPumpFlowRate(config.flow_rate);
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
    } catch (error) {
      console.error('Erro ao carregar config EC Controller:', error);
    }
  }, [deviceId]);
  
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
        
        // Calcular tempo de dosagem (segundos) — vazão desta bomba, senão global
        const q =
          nut.flowRate && nut.flowRate > 0 ? nut.flowRate : pumpFlowRate;
        const tempoDosagem = utNutriente / q;
        
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
        flow_rate: pumpFlowRate,
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
      if (!silent) {
        hwToast.success('Configuração salva com sucesso!', 'AUTO EC');
      }
      return true;
    } catch (error) {
      console.error('❌ [EC Controller] Erro ao salvar config:', error);
      toast.error(`Erro: ${error instanceof Error ? error.message : 'Desconhecido'}`);
      return false;
    }
  }, [deviceId, nutrientsState, pumpFlowRate, totalVolume, baseDose, ecSetpoint, ecTolerance, intervaloAutoEC, tempoRecirculacao, autoEnabled, aggressiveness, consumo24h, pulseMl, pulseGapSec, availableRelays, relayAllocation]);
  
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
      flow_rate: number;
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
      flow_rate: pumpFlowRate,
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
  }, [deviceId, nutrientsState, pumpFlowRate, totalVolume, baseDose, ecSetpoint, ecTolerance, intervaloAutoEC, tempoRecirculacao, autoEnabled, aggressiveness, consumo24h, pulseMl, pulseGapSec, availableRelays, relayAllocation]);
  
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
    if (deviceId && deviceId !== 'default_device') {
      loadLocalRelayNames();
      loadECControllerConfig();
      loadDoserRelayStates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  useEffect(() => {
    const onFlowRateUpdated = (e: Event) => {
      const detail = (e as CustomEvent<{ deviceId: string; flowRate: number }>).detail;
      if (detail?.deviceId === deviceId && detail.flowRate > 0) {
        setPumpFlowRate(detail.flowRate);
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
      toast.error(
        'Configure pelo menos um nutriente com ml/L > 0 (total_ml > 0) antes de ativar o Auto EC'
      );
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
          toast.error('Salve os parâmetros antes de ativar Auto EC');
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

      savingTimeoutRef.current = setTimeout(() => {
        justSavedRef.current = false;
      }, 2000);

      if (newValue) hwToast.success('Auto EC ativado', 'AUTO EC');
      else hwToast.info('Auto EC desativado', 'AUTO EC');
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
        Selecione um dispositivo Master para configurar o Auto EC.
      </div>
    );
  }

  return (
    <>
      <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg overflow-hidden mb-6">
        <div className="w-full p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-dark-border">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-dark-text">Auto EC</h3>
            <OperationStateBadges
              variant="header"
              autoEnabled={autoEnabled}
              autoActiveLabel="Auto EC ativo"
              autoInactiveLabel="Auto EC inativo"
              isDosando={isDosando || isDraining}
              dosandoLabel={isDraining ? 'Drenando' : 'Dosando'}
              isReplacing={isReplacing}
              replacingLabel="Reponendo"
              isAguardandoRecirculacao={isAguardandoRecirculacao}
              operationRemainingSec={recirculacaoRestanteSec}
              showNextCheck={showEcNextCheck}
              nextCheckInSec={ecNextCheckInSec}
              nextCheckLabel="Próxima verificação EC"
              accent="emerald"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              showLockUnlockToast(ecControllerLocked, 'Controles EC', () =>
                setEcControllerLocked((prev) => !prev)
              );
            }}
            className={`p-1.5 rounded transition-colors ${
              ecControllerLocked
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                : 'bg-aqua-500/20 text-aqua-400 hover:bg-aqua-500/30 border border-aqua-500/30'
            }`}
            title={
              ecControllerLocked
                ? 'Desbloquear controles (requer senha admin)'
                : 'Bloquear controles (requer senha admin)'
            }
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
                          <h2 className="text-lg sm:text-xl font-bold text-dark-text mb-3 sm:mb-4">🎯 Controle Automático de EC</h2>
                          <p className="text-xs sm:text-sm text-dark-textSecondary mb-4">
                            Configure o sistema adaptativo proporcional para controle automático da condutividade elétrica.
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
                              Informação — como usar o Auto EC
                            </button>
                            {expandedEcInfo && (
                            <div className="px-4 pb-4 space-y-2 text-xs sm:text-sm text-dark-textSecondary leading-relaxed border-t border-aqua-500/20">
                              <p><strong className="text-dark-text">1. Nutrientes</strong> — Cadastre cada parte do plano (A, B, C…), escolha a bomba (relé) e a dose em ml por litro de água do tanque (mín. {MIN_NUTRIENT_ML_PER_LITER}). Calibre a vazão da bomba em Calibragem.</p>
                              <p><strong className="text-dark-text">2. Alvo de EC</strong> — Informe o EC desejado da solução e a faixa de tolerância. O sistema só acrescenta nutrientes quando o EC está abaixo do alvo (fora da faixa, por baixo).</p>
                              <p><strong className="text-dark-text">3. Ritmo</strong> — De quanto em quanto tempo medir o EC, e quanto tempo misturar (recirculação) depois de cada dose.</p>
                              <p><strong className="text-dark-text">4. Salvar e ligar</strong> — Salve os parâmetros e depois Ative o Auto EC. O controlador passa a dosar sozinho conforme o plano.</p>
                              <p><strong className="text-dark-text">5. EC alto demais</strong> — Se o EC passar do alvo + faixa, o sistema dilui sozinho (drena um pouco e repõe água). Configure dreno e reposição abaixo; use o volume do reservatório como referência.</p>
                              <p className="text-dark-textSecondary/80">Guia completo: menu <NavLink href="/informacao" className="text-aqua-400 hover:underline">Informação</NavLink>.</p>
                            </div>
                            )}
                          </div>
                          
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

                            <div>
                              <label htmlFor="ec-pulse-ml" className="block text-sm font-medium text-dark-textSecondary mb-1">
                                ml por pulso:
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
                                  value={
                                    ecSetpoint > 0
                                      ? `${formatSensorValue(ecSetpoint, 0)} µS/cm`
                                      : '--'
                                  }
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
                                deviceId={deviceId}
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
          
                          {deviceId ? (
                            <div className="mb-6">
                              <ControllerMetricsPanel
                                deviceId={deviceId}
                                focus="ec"
                                hideTabs
                              />
                            </div>
                          ) : null}
          
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
                              Agressividade e Consumo 24 h
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm text-dark-textSecondary mb-1">
                                  Agressividade EC ({Math.round(aggressiveness * 100)} %)
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
                                    Camada sobre o Auto EC. Não muda o intervalo. Default OFF.
                                    Só tem efeito com Auto EC ligado (o Core lê isto no mesmo GET de auto_enabled).
                                  </span>
                                </span>
                              </label>
                            </div>
                          </div>
                          
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
                                      ? 'Desativar Auto EC'
                                      : 'Ativar Auto EC'
                              }
                            >
                              {autoTogglePending
                                ? '…'
                                : autoEnabled
                                  ? '⏹️ Desativar Auto EC'
                                  : '🤖 Ativar Auto EC'}
                              {autoRtStatus === 'SUBSCRIBED' && !autoTogglePending ? (
                                <span className="ml-1.5 text-[10px] opacity-80">ao vivo</span>
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
                              title={ecControllerLocked ? 'Controles bloqueados' : 'Limpar valores'}
                            >
                              <XMarkIcon className="w-4 h-4 inline mr-1" />
                              Limpar Valores
                            </button>
                          </div>
                        </div>
        </div>
      </div>

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
                {editingNutrientIndex !== null ? 'Salvar' : 'Adicionar'}
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
                  <p><strong className="text-purple-300">aggressiveness:</strong> Tope de passo Auto EC (0.05–1.0)</p>
                  <p><strong className="text-purple-300">consumo_24h:</strong> Camada Consumo EC 24 h</p>
                  <p><strong className="text-purple-300">pulse_ml:</strong> ml por pulso (HMI pulseMl)</p>
                  <p><strong className="text-purple-300">pulse_gap_sec:</strong> Gap pulsos em segundos (HMI pulseGapSec)</p>
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
    </>
  );
}
