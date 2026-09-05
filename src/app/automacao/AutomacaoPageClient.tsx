'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import NavLink from '@/components/NavLink';
import { toast, type Toast } from 'react-hot-toast';
import { hwToast } from '@/lib/control-toast';
import BrandLoading from '@/components/BrandLoading';
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
import { formatInstructionPreview } from '@/lib/instruction-labels';
import { getDecisionRules, createDecisionRule, updateDecisionRule, deleteDecisionRule, DecisionRule } from '@/lib/automation';
import {
  requestDecisionRuleMqttSync,
  requestDecisionRulesResync,
} from '@/lib/decision-rules-mqtt-client';
import {
  isFixedFunctionMacroRule,
  isMotorScriptStyleRule,
  resolveDecisionRuleDisplayName,
} from '@/lib/decision-rule-display-name';
import { RuleExecutionHistoryPanel } from '@/components/automacao/RuleExecutionHistoryPanel';
import { useDevicesWithRealtime } from '@/hooks/useDevicesWithRealtime';
import {
  getDeviceDisplayStatus,
  type DeviceDisplayStatus,
} from '@/lib/realtime/device-status';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toBcp47 } from '@/lib/locale';
import { getESPNOWSlaves, ESPNowSlave } from '@/lib/esp-now-slaves';
import { subscribeRelayStateUpdates } from '@/lib/realtime/relay-states';
import {
  applySlaveRelayRow,
  mergeRelayStatesMap,
  RELAY_REST_FALLBACK_MS,
} from '@/lib/realtime/relay-apply';
import { useHydroEcReading } from '@/hooks/useHydroEcReading';
import { useEcOperationState } from '@/hooks/useEcOperationState';
import { usePhOperationState } from '@/hooks/usePhOperationState';
import {
  buildManualSlaveRelayLockMap,
  isEcCycleActive,
  isPhCycleActive,
  manualSlaveRelayKey,
  type ManualSlaveRelayLock,
} from '@/lib/manual-slave-relay-lock';
import {
  normalizeHydraulicRolesJson,
  type HydraulicRolesMap,
} from '@/lib/hydraulic-relay-roles';
import { setVisibleInterval } from '@/lib/realtime/visible-interval';
import {
  isSlaveDeviceRow,
  patchSlaveFromDeviceStatus,
  refreshSlaveOnlineStatuses,
  SLAVES_METADATA_FALLBACK_MS,
  SLAVE_ONLINE_TICK_MS,
} from '@/lib/realtime/slave-status';
import { subscribeDeviceStatusUpdates } from '@/lib/realtime/device-status';
import { subscribeRelayCommandUpdates } from '@/lib/realtime/relay-commands';
import {
  applyRelayCommandAck,
  armPendingAckTimeout,
  clearPendingAckTimeout,
  commandAckId,
  settlePendingByRelayState,
  type PendingAckTimerMap,
  type PendingRelayCommand,
} from '@/lib/relay-pending-commands';
import { sendSlaveRelayCommand } from '@/lib/slave-relay-command';
import {
  formatSlaveAckTimeoutMessage,
  formatSlaveCommandFailedMessage,
  formatSlaveNoTrackingMessage,
} from '@/lib/slave-relay-user-messages';
import type { RelayCommandMode } from '@/lib/mqtt-relay-command-schema';
// Removido: import { getRelayStates } from '@/lib/automation'; // não usar mais relay_states
import { getMasterLocalRelayNames } from '@/lib/nutrition-plan';
import { useRelayAllocation } from '@/hooks/useRelayAllocation';
import { AutomacaoTabs, useAutomacaoTab } from '@/components/automacao/AutomacaoTabs';
import { ProceduresTabPanel } from '@/components/automacao/ProceduresTabPanel';
import ScheduleEditor from '@/components/automacao/ScheduleEditor';
import { showLockUnlockToast, validateAdminPassword } from '@/lib/automacao/admin-lock';

const SectionSkeleton = ({ className = 'h-32' }: { className?: string }) => (
  <div className={`animate-pulse rounded-lg bg-dark-surface border border-dark-border ${className}`} />
);

function atlasRelayLabel(id: number, name?: string | null): string {
  const trimmed = name?.trim();
  return trimmed || `Relé ${id}`;
}

const CreateRuleModal = dynamic(() => import('@/components/CreateRuleModal'), {
  ssr: false,
  loading: () => null,
});

const PhControllerPanel = dynamic(() => import('@/components/PhControllerPanel'), {
  loading: () => <SectionSkeleton className="h-48" />,
});

const AutoEcControllerPanel = dynamic(() => import('@/components/AutoEcControllerPanel'), {
  loading: () => <SectionSkeleton className="h-48" />,
});

const GrowCycleTimelinePanel = dynamic(
  () =>
    import('@/components/grow-cycle/GrowCycleTimelinePanel').then((m) => m.GrowCycleTimelinePanel),
  { loading: () => <SectionSkeleton className="h-64" /> }
);

interface Relay {
  id: number;
  name: string;
}

interface RuleCondition {
  sensor: string;
  operator: string;
  value: number | string;
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
  const { t, locale } = useLanguage();
  const ac = t.automacao.common;
  const ap = t.automacao.page;
  const rc = t.automacao.ruleCard;
  const [activeTab, setActiveTab] = useAutomacaoTab();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null); // ✅ Regra sendo editada
  const [jsonPreviewRule, setJsonPreviewRule] = useState<AutomationRule | null>(null); // ✅ Regra para vista previa JSON
  const [copiedRuleId, setCopiedRuleId] = useState<string | null>(null); // ✅ rule_id copiado para feedback visual
  const [loading, setLoading] = useState(true);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('default_device');
  const { masters: availableMasters } = useDevicesWithRealtime(userProfile?.email);
  
  const [relays, setRelays] = useState<Relay[]>([
    { id: 0, name: 'Relé 0' },
    { id: 1, name: 'Relé 1' },
    { id: 2, name: 'Relé 2' },
    { id: 3, name: 'Relé 3' },
    { id: 4, name: 'Relé 4' },
    { id: 5, name: 'Relé 5' },
    { id: 6, name: 'Relé 6' },
    { id: 7, name: 'Relé 7' },
  ]);

  const [rules, setRules] = useState<AutomationRule[]>([]);
  
  // ✅ NOVO: Timezone do usuário (carregado das configurações)
  const [userTimezone, setUserTimezone] = useState<string>('America/Sao_Paulo');
  
  // Estado para gerenciar relés ESP-NOW Slaves (nomes globais)
  const [espnowSlaves, setEspnowSlaves] = useState<ESPNowSlave[]>([]);
  const espnowSlavesRef = useRef(espnowSlaves);
  espnowSlavesRef.current = espnowSlaves;
  const [loadingSlaves, setLoadingSlaves] = useState(false);
  const [expandedSlaveRelayManager, setExpandedSlaveRelayManager] = useState<boolean>(false);
  const [expandedSlaves, setExpandedSlaves] = useState<Set<string>>(new Set());
  const [expandedRenameRelays, setExpandedRenameRelays] = useState<Set<string>>(new Set());
  
  // ✅ Estado para rastrear relés ligados/desligados (slave_mac-relay_id -> boolean)
  const [relayStates, setRelayStates] = useState<Map<string, boolean>>(new Map());
  const relayStatesRef = useRef(relayStates);
  relayStatesRef.current = relayStates;
  const [loadingRelays, setLoadingRelays] = useState<Map<string, boolean>>(new Map());
  
  // ✅ NOVO: Estados para renombrar relés (igual a DeviceControlPanel)
  const [tempRelayNames, setTempRelayNames] = useState<Map<string, string>>(new Map());
  const [savingRelayNames, setSavingRelayNames] = useState<Set<string>>(new Set());
  
  // ✅ NOVO: Estados para timers configurados por relé (relayKey -> duration_seconds)
  const [relayTimers, setRelayTimers] = useState<Map<string, number>>(new Map());
  const [timerModes, setTimerModes] = useState<Map<string, 'timed_on' | 'timed_off'>>(new Map());
  const [showTimerInput, setShowTimerInput] = useState<string | null>(null);
  const [timerSecondsLeft, setTimerSecondsLeft] = useState<Map<string, number>>(new Map());
  const [armedTimers, setArmedTimers] = useState<Map<string, number>>(new Map());
  
  // ✅ NOVO: Estados para ciclos programados (relayKey -> { onDuration: number, offDuration: number, enabled: boolean })
  const [relayCycles, setRelayCycles] = useState<
    Map<string, { onDuration: number; offDuration: number; enabled: boolean; phase: 'on' | 'off' }>
  >(new Map());
  const relayCyclesRef = useRef(relayCycles);
  relayCyclesRef.current = relayCycles;
  const [showCycleInput, setShowCycleInput] = useState<string | null>(null); // relayKey que está mostrando input de ciclo
  
  // ✅ NOVO: Mapeamento Command ID → Relay Key (padrão indústria)
  const commandToRelayMap = useRef<Map<string | number, PendingRelayCommand>>(new Map());
  const pendingAckTimersRef = useRef<PendingAckTimerMap>(new Map());
  
  // ✅ NOVO: Estado para rastrear si cada slave está bloqueado (MAC address -> boolean)
  const [lockedSlaves, setLockedSlaves] = useState<Map<string, boolean>>(new Map());
  const [hydraulicRoles, setHydraulicRoles] = useState<HydraulicRolesMap>({});
  const [decisionEngineLocked, setDecisionEngineLocked] = useState<boolean>(false);

  const [expandedDecisionEngine, setExpandedDecisionEngine] = useState<boolean>(true);

  const [availableRelays, setAvailableRelays] = useState<Array<{number: number, name: string}>>([]);

  const ecDeviceActive = Boolean(
    selectedDeviceId && selectedDeviceId !== 'default_device'
  );

  const relayAllocation = useRelayAllocation(selectedDeviceId, {
    enabled: ecDeviceActive,
  });

  const { ph: phAtual, phRaw } = useHydroEcReading(selectedDeviceId, ecDeviceActive);

  const ecOp = useEcOperationState(selectedDeviceId, ecDeviceActive, {
    autoEnabled: true,
    mirrorFirmware: true,
  });
  const phOp = usePhOperationState(selectedDeviceId, ecDeviceActive, {
    autoEnabled: true,
    mirrorFirmware: true,
  });

  const automationRelayLocks = useMemo(
    () =>
      buildManualSlaveRelayLockMap({
        rules,
        hydraulicRoles,
        ecCycleActive: isEcCycleActive(ecOp),
        phCycleActive: isPhCycleActive(phOp),
      }),
    [
      rules,
      hydraulicRoles,
      ecOp.isDosando,
      ecOp.isAguardandoRecirculacao,
      ecOp.isDiluting,
      phOp.isDosando,
      phOp.isAguardandoRecirculacao,
    ]
  );

  const automationLockTooltip = useCallback(
    (lock: ManualSlaveRelayLock): string => {
      if (lock.reason === 'auto_ec_cycle') return t.automacao.manualQuick.lockByAutoEc;
      if (lock.reason === 'auto_ph_cycle') return t.automacao.manualQuick.lockByAutoPh;
      return t.automacao.manualQuick.lockByRule.replace('{name}', lock.label);
    },
    [t]
  );

  const startLocalTimer = useCallback((relayKey: string, seconds: number) => {
    setTimerSecondsLeft((prev) => {
      const next = new Map(prev);
      if (seconds <= 0) {
        next.delete(relayKey);
      } else {
        next.set(relayKey, seconds);
      }
      return next;
    });
  }, []);

  const applyDeadlinesFromSlaves = useCallback((slaves: ESPNowSlave[]) => {
    setTimerSecondsLeft((prev) => {
      const next = new Map(prev);
      let changed = false;
      slaves.forEach((slave) => {
        slave.relays.forEach((relay) => {
          const key = `${slave.macAddress}-${relay.id}`;
          const rem = relay.has_timer ? (relay.remaining_time || 0) : 0;
          if (rem > 0) {
            const localRem = next.get(key) ?? 0;
            if (!next.has(key) || Math.abs(localRem - rem) > 2) {
              next.set(key, rem);
              changed = true;
            }
          } else {
            const pending = [...commandToRelayMap.current.values()].some((p) => p.relayKey === key);
            const cycling = relayCyclesRef.current.get(key)?.enabled;
            if (!pending && !cycling && next.has(key)) {
              next.delete(key);
              changed = true;
            }
          }
        });
      });
      return changed ? next : prev;
    });
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const cycleFlips: Array<{ key: string; on: boolean; phase: 'on' | 'off'; seconds: number }> = [];
      const expired: string[] = [];
      setTimerSecondsLeft((prev) => {
        if (prev.size === 0) return prev;
        const next = new Map<string, number>();
        prev.forEach((seconds, key) => {
          const left = seconds - 1;
          if (left > 0) {
            next.set(key, left);
            return;
          }
          const cycle = relayCyclesRef.current.get(key);
          if (cycle?.enabled) {
            const phase: 'on' | 'off' = cycle.phase === 'off' ? 'on' : 'off';
            const secs = phase === 'on' ? cycle.onDuration : cycle.offDuration;
            next.set(key, secs);
            cycleFlips.push({ key, on: phase === 'on', phase, seconds: secs });
          } else {
            expired.push(key);
          }
        });
        return next;
      });
      if (cycleFlips.length > 0) {
        setRelayCycles((prev) => {
          const copy = new Map(prev);
          cycleFlips.forEach(({ key, phase }) => {
            const c = copy.get(key);
            if (c) copy.set(key, { ...c, phase });
          });
          return copy;
        });
        setRelayStates((states) => {
          const copy = new Map(states);
          cycleFlips.forEach(({ key, on }) => copy.set(key, on));
          return copy;
        });
      }
      if (expired.length > 0) {
        setRelayStates((states) => {
          let dirty = false;
          const copy = new Map(states);
          expired.forEach((key) => {
            if (copy.get(key)) {
              copy.set(key, false);
              dirty = true;
            }
          });
          return dirty ? copy : states;
        });
      }
    }, 1000);
    return () => window.clearInterval(id);
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

      const labeled: Array<{ number: number; name: string }> = [];
      const localRelays: Relay[] = [];
      for (let i = 0; i <= 7; i++) {
        const name = names.get(i) || `Relé ${i}`;
        labeled.push({ number: i, name });
        localRelays.push({ id: i, name });
      }
      setAvailableRelays(labeled);
      setRelays(localRelays);
    } catch (error) {
      console.error('Erro ao carregar nomes de relés locais:', error);
    }
  }, [selectedDeviceId]);
  

  // Carregar regras do Supabase quando selectedDeviceId mudar
  useEffect(() => {
    if (selectedDeviceId && selectedDeviceId !== 'default_device') {
      loadRules();
      loadESPNOWSlaves();
      loadLocalRelayNames(); // ✅ NOVO: Carregar nomes de relés locais
      void (async () => {
        try {
          const res = await fetch(
            `/api/automation/hydraulic-roles?device_id=${encodeURIComponent(selectedDeviceId)}`
          );
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            setHydraulicRoles(
              normalizeHydraulicRolesJson(data.roles ?? data.hydraulic_roles_json)
            );
          } else {
            setHydraulicRoles({});
          }
        } catch {
          setHydraulicRoles({});
        }
      })();
    } else {
      setHydraulicRoles({});
    }
    // ✅ SOLUCIÓN DATA RACE: Remover funciones de las dependencias
    // Solo debe ejecutarse cuando cambia selectedDeviceId o userProfile?.email
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeviceId, userProfile?.email]);

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
      applyDeadlinesFromSlaves(updatedSlaves);
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

  // Reloj: offline por last_seen viejo sin esperar F5 ni UPDATE WS
  useEffect(() => {
    if (!selectedDeviceId || selectedDeviceId === 'default_device') return;
    return setVisibleInterval(() => {
      setEspnowSlaves((prev) => refreshSlaveOnlineStatuses(prev));
    }, SLAVE_ONLINE_TICK_MS);
  }, [selectedDeviceId]);

  const clearRelayLoading = useCallback((relayKey: string) => {
    setLoadingRelays((prev) => {
      const next = new Map(prev);
      next.delete(relayKey);
      return next;
    });
  }, []);

  const revertSlaveRelay = useCallback(
    (relayKey: string, previousState: boolean) => {
      setRelayStates((prev) => new Map(prev).set(relayKey, previousState));
      startLocalTimer(relayKey, 0);
      clearRelayLoading(relayKey);
    },
    [startLocalTimer, clearRelayLoading]
  );

  const clearTimerAssignment = useCallback((relayKey: string) => {
    setArmedTimers((prev) => {
      const next = new Map(prev);
      next.delete(relayKey);
      return next;
    });
    setRelayTimers((prev) => {
      const next = new Map(prev);
      next.delete(relayKey);
      return next;
    });
    setTimerModes((prev) => {
      const next = new Map(prev);
      next.delete(relayKey);
      return next;
    });
    startLocalTimer(relayKey, 0);
    setShowTimerInput(null);
  }, [startLocalTimer]);

  const registerPendingSlaveAck = useCallback(
    (commandId: string | number, pending: PendingRelayCommand) => {
      const id = commandAckId(commandId);
      commandToRelayMap.current.set(id, pending);
      armPendingAckTimeout(pendingAckTimersRef.current, id, () => {
        const still = commandToRelayMap.current.get(id);
        if (!still) return;
        commandToRelayMap.current.delete(id);
        const live = relayStatesRef.current.get(still.relayKey);
        if (still.desiredOn !== undefined && live === still.desiredOn) {
          clearRelayLoading(still.relayKey);
          if (still.successToast) toast.success(still.successToast);
          return;
        }
        revertSlaveRelay(still.relayKey, still.previousState);
        const slaveRow = still.slaveMac
          ? espnowSlavesRef.current.find((s) => s.macAddress === still.slaveMac)
          : undefined;
        toast.error(
          formatSlaveAckTimeoutMessage({
            slaveName: still.slaveName ?? slaveRow?.name,
            relayLabel: still.relayLabel,
            slaveOnline: slaveRow?.status === 'online' ? true : slaveRow?.status === 'offline' ? false : undefined,
            previousState: still.previousState,
          }),
          { duration: 6000 }
        );
      });
    },
    [revertSlaveRelay, clearRelayLoading]
  );

  /** Desarma el reloj y, si el Atlas ya cuenta, cancela el timer (ON/OFF sin duración). */
  const disarmSlaveTimer = useCallback(
    async (opts: {
      relayKey: string;
      slaveMac: string;
      slaveName: string;
      relayNumber: number;
      isRelayOn: boolean;
      remainingTime: number;
    }) => {
      const { relayKey, slaveMac, slaveName, relayNumber, isRelayOn, remainingTime } = opts;
      const wasRunning = remainingTime > 0;
      clearTimerAssignment(relayKey);

      if (wasRunning && selectedDeviceId && selectedDeviceId !== 'default_device') {
        setLoadingRelays((prev) => new Map(prev).set(relayKey, true));
        try {
          const result = await sendSlaveRelayCommand({
            master_device_id: selectedDeviceId,
            slave_mac_address: slaveMac,
            slave_name: slaveName,
            relay_number: relayNumber,
            mode: 'instant',
            action: isRelayOn ? 'on' : 'off',
            duration_seconds: 0,
          });
          if (result.success && result.command_id) {
            registerPendingSlaveAck(result.command_id, {
              relayKey,
              previousState: isRelayOn,
              desiredOn: isRelayOn,
              durationSeconds: 0,
              slaveMac: slaveMac,
              slaveName: slaveName,
            });
            toast.success(
              isRelayOn
                ? ap.timer.cancelledStayOn
                : ap.timer.cancelledConventional
            );
            return;
          }
          if (!result.success) {
            toast.error(result.error ?? ap.timer.cancelFail);
          }
        } catch {
          toast.error(ap.timer.cancelFail);
        } finally {
          clearRelayLoading(relayKey);
        }
        return;
      }

      toast.success(ap.timer.disarmed);
    },
    [clearTimerAssignment, selectedDeviceId, registerPendingSlaveAck, clearRelayLoading]
  );

  const processCommandAck = useCallback(
    (commandId: number | string, status: string, action?: string, relayNumber?: number) => {
      applyRelayCommandAck(
        commandToRelayMap.current,
        commandId,
        status,
        {
          onCompleted: (relayKey, ackAction, pending) => {
            clearPendingAckTimeout(pendingAckTimersRef.current, commandId);
            clearRelayLoading(relayKey);
            if (ackAction === 'on' || ackAction === 'off') {
              setRelayStates((prev) => {
                const newMap = new Map(prev);
                newMap.set(relayKey, ackAction === 'on');
                return newMap;
              });
              if (ackAction === 'on' && pending?.durationSeconds && pending.durationSeconds > 0) {
                startLocalTimer(relayKey, pending.durationSeconds);
              }
              if (ackAction === 'off') {
                startLocalTimer(relayKey, 0);
                setRelayCycles((prev) => {
                  const next = new Map(prev);
                  const c = next.get(relayKey);
                  if (c) next.set(relayKey, { ...c, enabled: false });
                  return next;
                });
              }
            }
            if (pending?.cycle === 'stop') {
              setRelayCycles((prev) => {
                const next = new Map(prev);
                const c = next.get(relayKey);
                if (c) next.set(relayKey, { ...c, enabled: false });
                return next;
              });
            } else if (pending?.cycle) {
              const cycle = pending.cycle;
              setRelayCycles((prev) =>
                new Map(prev).set(relayKey, {
                  onDuration: cycle.onDuration,
                  offDuration: cycle.offDuration,
                  enabled: true,
                  phase: 'on',
                })
              );
              setShowCycleInput(null);
            }
            if (pending?.successToast) {
              toast.success(pending.successToast);
            }
          },
          onFailed: (relayKey, previousState, num, pending) => {
            clearPendingAckTimeout(pendingAckTimersRef.current, commandId);
            revertSlaveRelay(relayKey, previousState);
            toast.error(
              formatSlaveCommandFailedMessage(
                {
                  slaveName: pending?.slaveName,
                  relayLabel: pending?.relayLabel,
                },
                num
              ),
              { duration: 5000 }
            );
          },
        },
        action,
        relayNumber
      );
    },
    [clearRelayLoading, revertSlaveRelay, startLocalTimer]
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

    const unsubscribe = subscribeRelayStateUpdates(
      selectedDeviceId,
      () => {},
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
          setRelayStates((r) => {
            const merged = mergeRelayStatesMap(r, updated);
            const settled = settlePendingByRelayState(
              commandToRelayMap.current,
              pendingAckTimersRef.current,
              merged
            );
            if (settled.length > 0) {
              queueMicrotask(() => {
                settled.forEach((pending) => {
                  clearRelayLoading(pending.relayKey);
                  if (pending.successToast) toast.success(pending.successToast);
                });
              });
            }
            if (commandToRelayMap.current.size === 0) return merged;
            const next = new Map(merged);
            commandToRelayMap.current.forEach((pending) => {
              if (pending.desiredOn !== undefined && merged.get(pending.relayKey) === pending.desiredOn) {
                return;
              }
              const optimistic = r.get(pending.relayKey);
              if (optimistic !== undefined) next.set(pending.relayKey, optimistic);
            });
            return next;
          });
          applyDeadlinesFromSlaves(updated);
          return updated;
        });
      }
    );

    const clearFallback = setVisibleInterval(() => {
      updateRelayStatesOnly();
    }, RELAY_REST_FALLBACK_MS);

    return () => {
      unsubscribe();
      clearFallback();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeviceId, updateRelayStatesOnly]);

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
      toast.error(ap.toast.loadRulesFail);
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
      applyDeadlinesFromSlaves(slaves);
      
      // ✅ NOVO: Inicializar nombres temporales de relés
      const newTempRelayNames = new Map<string, string>();
      slaves.forEach(slave => {
        slave.relays.forEach(relay => {
          const relayKey = `${slave.macAddress}-${relay.id}`;
          newTempRelayNames.set(relayKey, atlasRelayLabel(relay.id, relay.name));
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
      toast.error(ap.toast.loadAtlasFail);
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
      toast.error(ap.toast.nameEmpty);
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
        
        toast.success(ap.toast.relayNameSaved.replace('{name}', newName.trim()));
        console.log(`✅ Nome do relé ${relayId} do slave ${slaveMac} salvo: "${newName.trim()}"`);
        
        // Recarregar regras para refletir novos nomes
        await loadRules();
      } else {
        const error = await response.json();
        console.error('❌ Erro ao salvar nome do relé:', error);
        toast.error(
          ap.toast.relayNameSaveFail.replace('{error}', String(error.error || 'Erro desconhecido'))
        );
        // Reverter mudança local em caso de erro
        await loadESPNOWSlaves();
      }
    } catch (error) {
      console.error('❌ Erro ao salvar nome do relé:', error);
      toast.error(ap.toast.relayNameSaveError);
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

  const toggleRule = async (id: number | string) => {
    const rule = rules.find((r) => r.id === id || r.supabase_id === id);
    if (!rule) return;

    const nextEnabled = !rule.enabled;
    const dbId = rule.supabase_id || (typeof rule.id === 'string' ? rule.id : null);
    if (!dbId || typeof dbId === 'number') {
      toast.error(ap.toast.ruleUuidMissing);
      return;
    }

    setRules((prev) =>
      prev.map((r) => (r.id === id || r.supabase_id === id ? { ...r, enabled: nextEnabled } : r))
    );

    const ok = await updateDecisionRule(String(dbId), { enabled: nextEnabled });
    if (!ok) {
      setRules((prev) =>
        prev.map((r) =>
          r.id === id || r.supabase_id === id ? { ...r, enabled: !nextEnabled } : r
        )
      );
      toast.error(ap.toast.ruleUpdateDbFail);
      return;
    }

    if (selectedDeviceId && selectedDeviceId !== 'default_device' && rule.rule_id) {
      const sync = await requestDecisionRuleMqttSync({
        device_id: selectedDeviceId,
        rule_id: rule.rule_id,
        rule_name: rule.rule_name || rule.name,
        rule_description: rule.rule_description || rule.description,
        rule_json: rule.rule_json,
        enabled: nextEnabled,
        priority: rule.priority,
        op: nextEnabled ? 'upsert' : 'disable',
      });
      if (!sync.ok) {
        console.warn('[toggleRule] MQTT sync:', sync.error);
        toast.error(
          `Regra salva no banco, mas MQTT falhou: ${sync.error ?? 'erro'}. Use Resync ↻`
        );
      }
    }
  };

  const handleResyncRulesToDevice = async () => {
    if (!selectedDeviceId || selectedDeviceId === 'default_device') {
      toast.error(ap.toast.selectDevice);
      return;
    }
    const result = await requestDecisionRulesResync(selectedDeviceId);
    if (result.ok) {
      toast.success(ap.toast.resyncOk.replace('{n}', String(result.republished ?? 0)));
    } else {
      toast.error(result.error ?? ap.toast.resyncFail);
    }
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
  
  const handleSaveRule = async (newRule: NewRuleData): Promise<boolean> => {
    try {
      // ✅ Usar rule_id existente se estiver editando, senão criar novo
      // ✅ Garantir que rule_id tenha pelo menos 3 caracteres (requisito do Supabase)
      const baseRuleId = editingRule?.rule_id || editingRule?.id || `RULE_${Date.now()}`;
      const ruleId = typeof baseRuleId === 'string' && baseRuleId.length >= 3 
        ? baseRuleId 
        : `RULE_${Date.now()}`;
      
      // ✅ Se tiver script (instruções sequenciais), usar formato de SequentialScriptEditor
      let ruleJson: RuleJson;

      // Macro tipada: preservar rule_json original (condition + actions DE / while script)
      // Atenção: && / || — só avaliar editingRule.* se editingRule existir (criar = null)
      if (
        editingRule &&
        isFixedFunctionMacroRule(editingRule) &&
        (Boolean(newRule.preserve_rule_json) ||
          Boolean(newRule.rule_json) ||
          Boolean(
            editingRule.rule_json &&
              typeof editingRule.rule_json === 'object' &&
              Object.keys(editingRule.rule_json as object).length > 0
          ))
      ) {
        ruleJson = (newRule.rule_json ?? editingRule.rule_json) as RuleJson;
      } else if (newRule.script && newRule.script.instructions && newRule.script.instructions.length > 0) {
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
        toast.error(ap.toast.ruleJsonEmpty);
        console.error('❌ [VALIDATION ERROR] rule_json vazio:', ruleJson);
        return false;
      }
      
      // ✅ Validar campos obrigatórios antes de criar
      if (!selectedDeviceId || selectedDeviceId === 'default_device') {
        toast.error(ap.toast.selectDeviceCreate);
        console.error('❌ [VALIDATION ERROR] device_id inválido:', selectedDeviceId);
        return false;
      }
      
      const ruleName = typeof newRule.name === 'string' ? newRule.name.trim() : '';
      if (!ruleName || ruleName.length === 0) {
        toast.error(ap.toast.nameRequired);
        console.error('❌ [VALIDATION ERROR] rule_name vazio');
        return false;
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
          toast.error(ap.toast.ruleIdInvalidUpdate);
          console.error('❌ [UPDATE ERROR] editingRule:', editingRule);
          return false;
        }
        result = await updateDecisionRule(ruleIdToUpdate.toString(), decisionRule);
        if (result) {
          console.log('✅ [DECISION RULE] Regra atualizada no Supabase:', {
            id: editingRule.id,
            rule_id: decisionRule.rule_id,
            rule_name: decisionRule.rule_name,
            has_script: !!(ruleJson.script),
          });
          hwToast.success(ap.toast.ruleUpdated, 'REGRA');
        } else {
          toast.error(ap.toast.ruleUpdateFail);
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
            hwToast.success(ap.toast.ruleCreated, 'REGRA');
          } else {
            toast.error(ap.toast.ruleCreateDbFail);
          }
        } catch (error) {
          console.error('❌ [CREATE ERROR] Exceção capturada:', error);
          toast.error(error instanceof Error ? error.message : ap.toast.ruleCreateFail);
          return false;
        }
      }
      
      if (result) {
        const mqtt = await requestDecisionRuleMqttSync({
          device_id: decisionRule.device_id,
          rule_id: decisionRule.rule_id,
          rule_name: decisionRule.rule_name,
          rule_description: decisionRule.rule_description,
          rule_json: decisionRule.rule_json,
          enabled: decisionRule.enabled,
          priority: decisionRule.priority,
          op: decisionRule.enabled ? 'upsert' : 'disable',
        });
        if (!mqtt.ok) {
          console.warn('[handleSaveRule] MQTT sync:', mqtt.error);
        }
        await loadRules(); // Recarregar regras
        setEditingRule(null); // ✅ Resetar regra de edição após salvar
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error saving rule:', error);
      toast.error(ap.toast.ruleSaveFail);
      return false;
    }
  };

  const handleUpdateRelay = (id: number, name: string) => {
    setRelays(relays.map(relay => 
      relay.id === id ? { ...relay, name } : relay
    ));
    toast.success(ap.toast.relayRenamed.replace('{id}', String(id)).replace('{name}', name));
  };

  const handleEditRule = (rule: AutomationRule) => {
    // ✅ Abrir modal de edição com dados da regra
    setEditingRule(rule);
    setIsModalOpen(true);
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
        toast.error(ap.delete.passwordWrong, { id: 'password-error' });
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
                {ap.delete.title}
              </h3>
              <p className="text-sm text-dark-text mb-3">
                {ap.delete.body.replace('{name}', ruleName)}
              </p>
              <p className="text-xs text-yellow-400 mb-3">
                {ap.delete.adminHint}
              </p>
              
              {/* Input de senha */}
              <input
                type="password"
                autoFocus
                placeholder={ap.delete.passwordLabel}
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
                  {ap.delete.confirm}
                </button>
                <button
                  onClick={onCancel}
                  className="flex-1 px-3 py-2 bg-dark-surface hover:bg-dark-border text-dark-text text-sm font-medium rounded border border-dark-border transition-colors"
                >
                  {ac.cancel}
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
        toast.error(ap.toast.ruleNotFound);
        return;
      }

      // ✅ Mostrar toast de confirmación con contraseña
      const ruleName = rule.rule_name || rule.name || ap.toast.ruleNoName;
      const confirmed = await showDeleteConfirmation(id, ruleName);
      
      if (!confirmed) {
        return; // Usuario cancelou ou senha incorreta
      }

      // ✅ Usar supabase_id (UUID) se disponível, senão tentar id
      const ruleIdToDelete = rule.supabase_id || rule.id;
      if (!ruleIdToDelete) {
        toast.error(ap.toast.ruleIdMissingDelete);
        return;
      }

      // ✅ Verificar se é UUID válido (string) ou número
      if (typeof ruleIdToDelete === 'number') {
        toast.error(ap.toast.ruleIdInvalidDelete);
        console.error('❌ [DELETE ERROR] rule:', rule);
        return;
      }

      if (selectedDeviceId && selectedDeviceId !== 'default_device' && rule.rule_id) {
        await requestDecisionRuleMqttSync({
          device_id: selectedDeviceId,
          rule_id: rule.rule_id,
          enabled: false,
          op: 'delete',
        });
      }

      const result = await deleteDecisionRule(ruleIdToDelete.toString());
      if (result) {
        await loadRules(); // Recarregar regras do Supabase
        toast.success(ap.toast.ruleDeleted);
      } else {
        toast.error(ap.toast.ruleDeleteDbFail);
      }
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast.error(ap.toast.ruleDeleteFail);
    }
  };


  const motorRuleKindLabel = (rule: AutomationRule): string => {
    if (isFixedFunctionMacroRule(rule)) return t.automacao.procedures.fixedFunctionKind;
    if (isMotorScriptStyleRule(rule)) return t.automacao.procedures.sequentialScriptKind;
    return t.automacao.procedures.classicRuleKind;
  };

  const renderMotorRuleCard = (script: AutomationRule) => (
    <div
      key={script.supabase_id || script.rule_id || script.id}
      className="border border-dark-border rounded-lg p-4 bg-dark-surface/50 hover:bg-dark-surface transition-colors"
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <h4 className="font-semibold text-white truncate">
              {resolveDecisionRuleDisplayName(
                {
                  rule_id: script.rule_id,
                  rule_name: script.rule_name || script.name,
                  rule_json: script.rule_json,
                },
                t
              )}
            </h4>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                void toggleRule(script.id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  void toggleRule(script.id);
                }
              }}
              className={`px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0 cursor-pointer ${
                script.enabled
                  ? 'bg-aqua-500/20 text-aqua-400 border-aqua-500/30'
                  : 'bg-dark-surface text-dark-textSecondary border-dark-border'
              }`}
              title={script.enabled ? rc.toggleDisable : rc.toggleEnable}
            >
              {script.enabled ? (
                <span className="flex items-center">
                  <CheckCircleIcon className="w-3 h-3 mr-1 text-green-500" />
                  {t.common.active}
                </span>
              ) : (
                <span className="flex items-center">
                  <XCircleIcon className="w-3 h-3 mr-1 text-red-500" />
                  {t.common.inactive}
                </span>
              )}
            </span>
          </div>
          {(script.description || script.rule_description) && (
            <p className="text-xs text-dark-textSecondary mt-1">
              {script.description || script.rule_description}
            </p>
          )}
          <p className="text-xs text-dark-textSecondary/80 mt-1">{motorRuleKindLabel(script)}</p>

          {script.rule_json?.script?.instructions && (
            <div className="mt-2 text-xs text-dark-textSecondary space-y-1 font-mono">
              {script.rule_json.script.instructions.slice(0, 2).map((instr: ScriptInstruction, idx: number) => (
                <div key={idx} className="text-aqua-300">
                  {idx + 1}. {formatInstructionPreview(instr, t.automacao.instr)}
                </div>
              ))}
              {script.rule_json.script.instructions.length > 2 && (
                <div className="text-dark-textSecondary/80 italic">
                  {ap.scripts.moreInstr.replace(
                    '{n}',
                    String(script.rule_json.script.instructions.length - 2)
                  )}
                </div>
              )}
            </div>
          )}
          {!script.rule_json?.script?.instructions &&
            (script.condition || script.action) && (
              <div className="mt-2 text-xs text-aqua-300 space-y-1">
                {script.condition ? <div>1. {script.condition}</div> : null}
                {script.action ? <div>2. {script.action}</div> : null}
              </div>
            )}
          {isFixedFunctionMacroRule(script) &&
            !script.rule_json?.script?.instructions &&
            !script.condition &&
            (script.rule_description || script.description) && (
              <div className="mt-2 text-xs text-aqua-300">
                1. {script.rule_description || script.description}
              </div>
            )}

          <div className="mt-3 flex gap-2 flex-wrap items-center">
            <span className="text-xs bg-aqua-500/15 text-aqua-300 px-2 py-1 rounded border border-aqua-500/40">
              {ap.scripts.priority.replace('{n}', String(script.priority || 50))}
            </span>
            {script.rule_id && (
              <div className="flex items-center gap-1 bg-purple-500/20 border border-purple-500/40 rounded px-2 py-1 group">
                <span className="text-xs text-purple-300 font-mono">ID: {script.rule_id}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (script.rule_id) {
                      navigator.clipboard.writeText(script.rule_id);
                      setCopiedRuleId(script.rule_id);
                      toast.success(ap.scripts.ruleIdCopied.replace('{id}', script.rule_id));
                      setTimeout(() => setCopiedRuleId(null), 2000);
                    }
                  }}
                  className="p-0.5 hover:bg-purple-500/30 rounded transition-colors"
                  title={ap.scripts.copyRuleId}
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
            title={rc.jsonPreview}
          >
            <EyeIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => handleEditRule(script)}
            className="p-2 hover:bg-dark-surface rounded-lg transition-colors text-aqua-400 hover:text-aqua-300"
            title={ac.edit}
          >
            <PencilIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => handleDeleteRule(script.id)}
            className="p-2 hover:bg-dark-surface rounded-lg transition-colors text-red-400 hover:text-red-300"
            title={rc.deleteTitle}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );


  const activeRulesList = rules.filter((r) => r.enabled);
  const activeRules = activeRulesList.length;
  const inactiveRules = rules.length - activeRules;
  const activeFnCount = activeRulesList.filter((r) => isFixedFunctionMacroRule(r)).length;
  const activeScriptCount = activeRulesList.filter(
    (r) => isMotorScriptStyleRule(r) && !isFixedFunctionMacroRule(r)
  ).length;

  // Prioridade no motor: macros tipadas primeiro (verdade operacional), depois P desc
  const byPriorityDesc = (a: AutomationRule, b: AutomationRule) =>
    (b.priority || 50) - (a.priority || 50);
  const activeMacros = activeRulesList
    .filter((r) => isFixedFunctionMacroRule(r))
    .sort(byPriorityDesc);
  const activeOther = activeRulesList
    .filter((r) => !isFixedFunctionMacroRule(r))
    .sort(byPriorityDesc);
  const currentActiveRule = activeMacros[0] ?? activeOther[0] ?? null;
  const otherActiveCount = Math.max(0, activeRules - (currentActiveRule ? 1 : 0));
  const currentActiveDisplayName = currentActiveRule
    ? resolveDecisionRuleDisplayName(
        {
          rule_id: currentActiveRule.rule_id,
          rule_name: currentActiveRule.rule_name || currentActiveRule.name,
          rule_json: currentActiveRule.rule_json,
        },
        t
      )
    : null;

  // Motor: Core online + >=1 regra enabled (decision_engine_enabled nao e publicado pelo firmware)
  const selectedMaster = availableMasters.find((m) => m.device_id === selectedDeviceId);
  const masterDisplayStatus: DeviceDisplayStatus = selectedMaster
    ? getDeviceDisplayStatus(selectedMaster)
    : 'offline';
  const masterIsOnline = masterDisplayStatus !== 'offline';
  const decisionEngineActive = masterIsOnline && activeRules > 0;
  const engineStatusLabel = !masterIsOnline
    ? t.pages.automacaoEngineOffline
    : decisionEngineActive
      ? t.pages.automacaoEngineEvaluating
      : t.pages.automacaoEngineIdle;
  
  return (
    <div className="min-h-screen bg-dark-bg" data-testid="automacao-page">
      
      <header className="bg-dark-card border-b border-dark-border shadow-lg">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          {/* Primeira linha: Título e Seletor */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-aqua-400 to-primary-400 bg-clip-text text-transparent flex items-center gap-2">
                <ClipboardIcon className="w-8 h-8 text-aqua-400 shrink-0" aria-hidden />
                {t.pages.automacaoTitle}
              </h1>
              <p className="text-base sm:text-lg text-dark-textSecondary mt-1">{t.pages.automacaoSubtitle}</p>
            </div>
            {/* Seletor de Master */}
            {availableMasters.length > 0 && (
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="w-full sm:w-auto min-w-[200px] px-4 py-3 text-base sm:text-lg bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
              >
                {availableMasters.map(master => {
                  const st = getDeviceDisplayStatus(master);
                  return (
                    <option key={master.device_id} value={master.device_id || ''}>
                      {master.device_name || master.device_id}{' '}
                      {st === 'online' ? '🟢' : st === 'warning' ? '🟡' : '🔴'}
                    </option>
                  );
                })}
              </select>
            )}
          </div>
          
          {/* Segunda linha: Informações em tempo real */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-dark-border">
            {/* Prioridade no motor (macros tipadas > demais) */}
            <div className="bg-dark-surface/50 border border-aqua-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-sm text-aqua-400 font-semibold">📌 {t.pages.automacaoActiveRule}</span>
                {currentActiveRule && (
                  <span className="px-2 py-0.5 bg-aqua-500/20 text-aqua-400 text-sm rounded-full">
                    P{currentActiveRule.priority || 50}
                  </span>
                )}
                {otherActiveCount > 0 && (
                  <span className="text-xs text-dark-textSecondary">
                    {t.pages.automacaoMoreActive.replace('{n}', String(otherActiveCount))}
                  </span>
                )}
              </div>
              {currentActiveRule && currentActiveDisplayName ? (
                <>
                  <p
                    className="text-base font-medium text-dark-text truncate"
                    title={currentActiveDisplayName}
                  >
                    {currentActiveDisplayName}
                  </p>
                  {currentActiveRule.rule_id && (
                    <p
                      className="text-xs text-dark-textSecondary mt-0.5 truncate font-mono"
                      title={currentActiveRule.rule_id}
                    >
                      {t.pages.automacaoActiveRuleId.replace('{id}', currentActiveRule.rule_id)}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-dark-textSecondary italic">{t.common.noActiveRule}</p>
              )}
            </div>
            
            {/* Status do Motor de Decisão */}
            <div className="bg-dark-surface/50 border border-dark-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm text-dark-textSecondary font-semibold">🔧 {t.pages.automacaoDecisionEngine}</span>
                <span className={`w-2.5 h-2.5 rounded-full ${decisionEngineActive ? 'bg-green-500 animate-pulse' : masterIsOnline ? 'bg-amber-500' : 'bg-gray-500'}`}></span>
              </div>
              <p className={`text-base font-medium ${decisionEngineActive ? 'text-green-400' : masterIsOnline ? 'text-amber-400' : 'text-dark-textSecondary'}`}>
                {engineStatusLabel}
              </p>
              <p className="text-xs text-dark-textSecondary mt-0.5">
                {t.pages.automacaoActiveCount
                  .replace('{active}', String(activeRules))
                  .replace('{inactive}', String(inactiveRules))}
              </p>
            </div>
            
            {/* Estatísticas Rápidas */}
            <div className="bg-dark-surface/50 border border-dark-border rounded-lg p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-dark-textSecondary mb-1.5">📊 {t.pages.automacaoStats}</p>
                  <p className="text-base font-medium text-dark-text">
                    {t.pages.automacaoActiveCount
                      .replace('{active}', String(activeRules))
                      .replace('{inactive}', String(inactiveRules))}
                  </p>
                  <p className="text-xs text-dark-textSecondary mt-0.5 truncate">
                    {t.pages.automacaoStatsBreakdown
                      .replace('{fn}', String(activeFnCount))
                      .replace('{scripts}', String(activeScriptCount))}
                  </p>
                </div>
                {masterIsOnline && (
                  <div className="flex flex-col items-end shrink-0">
                    <span
                      className={`text-sm ${
                        masterDisplayStatus === 'warning' ? 'text-amber-400' : 'text-green-400'
                      }`}
                    >
                      {masterDisplayStatus === 'warning' ? '🟡' : '🟢'} {t.common.online}
                    </span>
                    {selectedMaster?.last_seen && (
                      <span className="text-sm text-dark-textSecondary">
                        {new Date(selectedMaster.last_seen).toLocaleTimeString(toBcp47(locale), { hour: '2-digit', minute: '2-digit' })}
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
        <AutomacaoTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === 'timeline' && (
          <GrowCycleTimelinePanel
            deviceId={selectedDeviceId}
            userEmail={userProfile?.email}
            embedded
          />
        )}

        {activeTab === 'procedures' && (
          <ProceduresTabPanel
            deviceId={selectedDeviceId}
            espnowSlaves={espnowSlaves}
            waterLevelEnabled={ecDeviceActive}
            onSlavesRefresh={loadESPNOWSlaves}
          />
        )}

        {activeTab === 'rules' && (
          <>
        {/* Box de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-dark-card border border-aqua-500/30 rounded-lg shadow-lg p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-dark-textSecondary mb-1">{ap.stats.activeRules}</p>
                <p className="text-2xl sm:text-3xl font-bold text-aqua-400">{activeRules}</p>
              </div>
              <CheckCircleIcon className="w-8 h-8 sm:w-12 sm:h-12 text-aqua-400/50 flex-shrink-0" />
            </div>
          </div>
          <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-dark-textSecondary mb-1">{ap.stats.inactiveRules}</p>
                <p className="text-2xl sm:text-3xl font-bold text-dark-textSecondary">{inactiveRules}</p>
              </div>
              <XCircleIcon className="w-8 h-8 sm:w-12 sm:h-12 text-dark-textSecondary/50 flex-shrink-0" />
            </div>
          </div>
        </div>

        {/* ⚡ TESTE RELAYS MANUALMENTE (ESP-NOW - CARGA) - EXISTENTE */}
        <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg overflow-hidden mb-6">
          <div className="p-4 border-b border-dark-border">
            <h2 className="text-base sm:text-lg font-semibold text-dark-text break-words">{ap.manual.title}</h2>
            <p className="text-xs sm:text-sm text-dark-textSecondary mt-1 break-words">{ap.manual.subtitle}</p>
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
                  {ap.atlas.manageNames}
                </h3>
              </div>
              <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0 ml-2">
                <span className="text-xs sm:text-sm text-dark-textSecondary hidden sm:inline">
                  {espnowSlaves.length}{' '}
                  {espnowSlaves.length === 1 ? ap.atlas.deviceCountOne : ap.atlas.deviceCountMany}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    loadESPNOWSlaves();
                  }}
                  className="px-2 sm:px-3 py-1.5 sm:py-1 bg-dark-card hover:bg-dark-border border border-dark-border rounded text-xs text-dark-text transition-colors"
                  title={ap.atlas.refresh}
                >
                  🔄
                </button>
              </div>
            </div>

            {expandedSlaveRelayManager && (
              <div className="p-4 border-t border-dark-border">
                {loadingSlaves ? (
                  <div className="text-center py-8">
                    <BrandLoading message={t.common.loadingAtlas} size={40} />
                  </div>
                ) : espnowSlaves.length === 0 ? (
                  <div className="text-center py-8 bg-dark-card border border-dark-border rounded-lg">
                    <p className="text-dark-textSecondary mb-2">{ap.atlas.empty}</p>
                    <p className="text-xs text-dark-textSecondary mb-4">
                      {ap.atlas.emptyHint}
                    </p>
                    <button
                      onClick={loadESPNOWSlaves}
                      className="px-4 py-2 bg-aqua-500/20 hover:bg-aqua-500/30 border border-aqua-500/30 rounded text-sm text-aqua-400 transition-colors"
                    >
                      {ap.atlas.retry}
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
                                    ap.atlas.controlsOfAtlas.replace('{name}', slave.name),
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
                                title={lockedSlaves.get(slave.macAddress) ? ap.atlas.unlockControls : ap.atlas.lockControls}
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
                                  {ap.atlas.quickControlTitle}
                                </h5>
                                {slave.status === 'offline' && (
                                  <p className="text-xs text-red-400/90 mb-3 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                                    {ap.atlas.offlineWait}
                                  </p>
                                )}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  {slave.relays.map(relay => {
                                    const relayKey = `${slave.macAddress}-${relay.id}`;
                                    const realState = relay.state !== undefined ? relay.state : false;
                                    const isLoading = loadingRelays.get(relayKey) || false;
                                    const isRelayOn = relayStates.has(relayKey)
                                      ? Boolean(relayStates.get(relayKey))
                                      : realState;
                                    const relayLabel = atlasRelayLabel(relay.id, relay.name);
                                    const isLocked = lockedSlaves.get(slave.macAddress) ?? false;
                                    const isSlaveOffline = slave.status === 'offline';
                                    const autoLock = automationRelayLocks.get(
                                      manualSlaveRelayKey(slave.macAddress, relay.id)
                                    );
                                    const controlsDisabled =
                                      isLocked || isSlaveOffline || Boolean(autoLock);
                                    // ✅ Verificar se tem timer ativo
                                    const remainingTime = timerSecondsLeft.get(relayKey) || 0;
                                    const timerArmed = armedTimers.has(relayKey);
                                    
                                    return (
                                      <div
                                        key={relay.id}
                                        className={`bg-dark-card border rounded-lg p-3 ${
                                          controlsDisabled ? 'border-red-500/30 opacity-60' : 'border-dark-border'
                                        }`}
                                        title={
                                          autoLock
                                            ? automationLockTooltip(autoLock)
                                            : isLocked
                                              ? ap.atlas.controlsLockedAdmin
                                              : isSlaveOffline
                                                ? ap.atlas.offline
                                                : undefined
                                        }
                                      >
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="flex-1 min-w-0">
                                            <h6 className="text-xs font-medium text-dark-text truncate" title={relayLabel}>
                                              {relayLabel}
                                            </h6>
                                            <p className="text-xs text-dark-textSecondary mt-0.5">
                                              {isRelayOn ? '🟢 ON' : '⚫ OFF'}
                                            </p>
                                            {/* ✅ Mostrar timer se estiver ativo */}
                                            {remainingTime > 0 ? (
                                              <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                                                <ClockIcon className="w-3 h-3" />
                                                {Math.floor(remainingTime / 60)}:{(remainingTime % 60).toString().padStart(2, '0')}
                                              </p>
                                            ) : timerArmed ? (
                                              <p className="text-xs text-yellow-400/90 mt-1 flex items-center gap-1">
                                                <ClockIcon className="w-3 h-3" />
                                                {ap.timer.armedSecs.replace('{n}', String(armedTimers.get(relayKey)))}
                                              </p>
                                            ) : null}
                                          </div>
                                          <span
                                            className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                              isRelayOn ? 'bg-aqua-500 animate-pulse' : 'bg-dark-border'
                                            }`}
                                            title={isRelayOn ? ap.atlas.relayOn : ap.atlas.relayOff}
                                          />
                                        </div>
                                        {isSlaveOffline && (
                                          <div className="mb-2 text-xs text-red-400 flex items-center space-x-1">
                                            <span className="w-2 h-2 rounded-full bg-red-400" />
                                            <span>{ap.atlas.offlineBadge}</span>
                                          </div>
                                        )}
                                        {autoLock && !isSlaveOffline && (
                                          <div className="mb-2 text-xs text-amber-300 flex items-center space-x-1">
                                            <LockClosedIcon className="w-3 h-3" />
                                            <span>{t.automacao.manualQuick.badge}</span>
                                            <span className="text-dark-textSecondary truncate">
                                              — {automationLockTooltip(autoLock)}
                                            </span>
                                          </div>
                                        )}
                                        {isLocked && !isSlaveOffline && !autoLock && (
                                          <div className="mb-2 text-xs text-red-400 flex items-center space-x-1">
                                            <LockClosedIcon className="w-3 h-3" />
                                            <span>{ap.atlas.lockedBadge}</span>
                                          </div>
                                        )}
                                        
                                        {/* 🎨 OBRA PRIMA: Switch Compacto Integrado con Timer y Ciclo */}
                                        <div className="relative">
                                          <div className="flex items-center gap-2">
                                            {/* Modo ativo (chip) */}
                                            {relayCycles.get(relayKey)?.enabled && (
                                              <p className="text-[10px] text-aqua-400/90 mb-1 truncate">
                                                {ap.timer.chipCycle
                                                  .replace('{phase}', relayCycles.get(relayKey)!.phase === 'off' ? 'OFF' : 'ON')
                                                  .replace('{on}', String(relayCycles.get(relayKey)!.onDuration))
                                                  .replace('{off}', String(relayCycles.get(relayKey)!.offDuration))}
                                              </p>
                                            )}

                                            {/* Switch Principal ON/OFF — sempre instantâneo */}
                                            <button
                                              onClick={async () => {
                                                const previousState = isRelayOn;
                                                const nextOn = !isRelayOn;
                                                const armedSecs = armedTimers.get(relayKey);
                                                const timerMode = timerModes.get(relayKey) ?? 'timed_on';
                                                let durationSeconds = 0;
                                                let mode: RelayCommandMode = 'instant';
                                                if (nextOn && armedSecs && armedSecs > 0) {
                                                  durationSeconds = armedSecs;
                                                  if (timerMode === 'timed_off' && previousState) {
                                                    mode = 'timed_off';
                                                  } else {
                                                    mode = timerMode === 'timed_off' ? 'timed_on' : timerMode;
                                                  }
                                                }
                                                setLoadingRelays(prev => new Map(prev).set(relayKey, true));
                                                setRelayStates(prev => new Map(prev).set(relayKey, nextOn));
                                                try {
                                                  const result = await sendSlaveRelayCommand({
                                                    master_device_id: selectedDeviceId!,
                                                    slave_mac_address: slave.macAddress,
                                                    slave_name: slave.name,
                                                    relay_number: relay.id,
                                                    mode,
                                                    action: nextOn ? 'on' : 'off',
                                                    duration_seconds: durationSeconds,
                                                  });
                                                  if (result.success && result.command_id) {
                                                    registerPendingSlaveAck(result.command_id, {
                                                      relayKey,
                                                      previousState,
                                                      desiredOn: nextOn,
                                                      durationSeconds,
                                                      slaveMac: slave.macAddress,
                                                      slaveName: slave.name,
                                                      relayLabel,
                                                      successToast: nextOn
                                                        ? durationSeconds > 0
                                                          ? mode === 'timed_off'
                                                            ? ap.timer.toastRelayOffIn
                                                                .replace('{name}', relayLabel)
                                                                .replace('{n}', String(durationSeconds))
                                                            : ap.timer.toastRelayOnTimed
                                                                .replace('{name}', relayLabel)
                                                                .replace('{n}', String(durationSeconds))
                                                          : ap.timer.toastRelayOn.replace('{name}', relayLabel)
                                                        : ap.timer.toastRelayOff.replace('{name}', relayLabel),
                                                    });
                                                    if (nextOn && durationSeconds > 0) {
                                                      startLocalTimer(relayKey, durationSeconds);
                                                      setArmedTimers((prev) => {
                                                        const next = new Map(prev);
                                                        next.delete(relayKey);
                                                        return next;
                                                      });
                                                    }
                                                  } else if (result.success) {
                                                    revertSlaveRelay(relayKey, previousState);
                                                    toast.error(
                                                      formatSlaveNoTrackingMessage({
                                                        slaveName: slave.name,
                                                        relayLabel,
                                                      }),
                                                      { duration: 5000 }
                                                    );
                                                  } else {
                                                    revertSlaveRelay(relayKey, previousState);
                                                    toast.error(ap.toast.commandFail.replace('{error}', String(result.error)));
                                                  }
                                                } catch {
                                                  revertSlaveRelay(relayKey, previousState);
                                                  toast.error(ap.toast.commandError);
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
                                                  ? ap.atlas.offline
                                                  : isLocked
                                                    ? ap.atlas.controlsLocked
                                                    : isRelayOn
                                                      ? ap.atlas.clickOff
                                                      : ap.atlas.clickOn
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
                                              {(timerArmed || remainingTime > 0) && (
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
                                                    : timerArmed || remainingTime > 0 || relayCycles.get(relayKey)?.enabled
                                                      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 hover:bg-yellow-500/30'
                                                      : 'bg-dark-surface hover:bg-dark-border text-dark-textSecondary hover:text-aqua-400 border border-dark-border'
                                                  }
                                                  ${!controlsDisabled && 'cursor-pointer active:scale-95'}
                                                `}
                                                title={
                                                  relayCycles.get(relayKey)?.enabled
                                                    ? ap.timer.titleCycle
                                                        .replace('{on}', String(relayCycles.get(relayKey)!.onDuration))
                                                        .replace('{off}', String(relayCycles.get(relayKey)!.offDuration))
                                                    : timerArmed
                                                      ? ap.timer.titleArmed.replace('{n}', String(armedTimers.get(relayKey)))
                                                      : remainingTime > 0
                                                        ? ap.timer.running
                                                        : ap.timer.conventional
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
                                                  {ap.timer.tabTimer}
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
                                                  {ap.timer.tabCycle}
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
                                                    <option value="timed_on">{ap.timer.modeTimedOn}</option>
                                                    <option value="timed_off">{ap.timer.modeTimedOff}</option>
                                                  </select>
                                                  <div className="flex items-center gap-2">
                                                    <input
                                                      type="number"
                                                      min="1"
                                                      max="86400"
                                                      value={relayTimers.get(relayKey) || 10}
                                                      onChange={(e) => {
                                                        const value = parseInt(e.target.value) || 10;
                                                        setRelayTimers(prev => new Map(prev).set(relayKey, value));
                                                      }}
                                                      placeholder={ap.timer.secondsPlaceholder}
                                                      className="flex-1 px-2 py-1.5 bg-dark-surface border border-dark-border rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-aqua-500"
                                                      autoFocus
                                                    />
                                                    <span className="text-xs text-dark-textSecondary">{ap.timer.max24hHint}</span>
                                                  </div>
                                                  <p className="text-xs text-dark-textSecondary/80">
                                                    {ap.timer.hint}
                                                  </p>
                                                  <button
                                                    type="button"
                                                    disabled={controlsDisabled}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      const secs = relayTimers.get(relayKey) || 10;
                                                      const mode = timerModes.get(relayKey) ?? 'timed_on';
                                                      if (mode === 'timed_off' && isRelayOn) {
                                                        void (async () => {
                                                          setLoadingRelays((prev) => new Map(prev).set(relayKey, true));
                                                          const result = await sendSlaveRelayCommand({
                                                            master_device_id: selectedDeviceId!,
                                                            slave_mac_address: slave.macAddress,
                                                            slave_name: slave.name,
                                                            relay_number: relay.id,
                                                            mode: 'timed_off',
                                                            action: 'on',
                                                            duration_seconds: secs,
                                                          });
                                                          if (result.success && result.command_id) {
                                                            registerPendingSlaveAck(result.command_id, {
                                                              relayKey,
                                                              previousState: isRelayOn,
                                                              desiredOn: true,
                                                              durationSeconds: secs,
                                                              slaveMac: slave.macAddress,
                                                              slaveName: slave.name,
                                                              relayLabel,
                                                              successToast: ap.timer.toastRelayOffIn
                                                                .replace('{name}', relayLabel)
                                                                .replace('{n}', String(secs)),
                                                            });
                                                            startLocalTimer(relayKey, secs);
                                                            setShowTimerInput(null);
                                                          } else {
                                                            clearRelayLoading(relayKey);
                                                            toast.error(
                                                              result.error ??
                                                                formatSlaveNoTrackingMessage({
                                                                  slaveName: slave.name,
                                                                  relayLabel,
                                                                }),
                                                              { duration: 5000 }
                                                            );
                                                          }
                                                        })();
                                                        return;
                                                      }
                                                      setArmedTimers(prev => new Map(prev).set(relayKey, secs));
                                                      setShowTimerInput(null);
                                                      toast.success(
                                                        mode === 'timed_off'
                                                          ? ap.timer.toastArmedOff.replace('{n}', String(secs))
                                                          : ap.timer.toastArmedOn.replace('{n}', String(secs))
                                                      );
                                                    }}
                                                    className="w-full py-2 px-3 text-xs font-medium rounded bg-aqua-500/20 text-aqua-400 border border-aqua-500/40 hover:bg-aqua-500/30 disabled:opacity-50"
                                                  >
                                                    {ap.timer.assign}
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      void disarmSlaveTimer({
                                                        relayKey,
                                                        slaveMac: slave.macAddress,
                                                        slaveName: slave.name,
                                                        relayNumber: relay.id,
                                                        isRelayOn,
                                                        remainingTime,
                                                      });
                                                    }}
                                                    className="w-full py-1.5 text-xs text-dark-textSecondary hover:text-red-400"
                                                  >
                                                    {ap.timer.disarm}
                                                  </button>
                                                </div>
                                              )}

                                              {/* Contenido Ciclo */}
                                              {showCycleInput === relayKey && (
                                                <div className="space-y-3">
                                                  <div className="space-y-2">
                                                    <label className="text-xs text-dark-textSecondary">{ap.timer.cycleOnLabel}</label>
                                                    <input
                                                      type="number"
                                                      min="1"
                                                      max="86400"
                                                      value={relayCycles.get(relayKey)?.onDuration || 10}
                                                      onChange={(e) => {
                                                        const value = parseInt(e.target.value) || 10;
                                                        setRelayCycles(prev => {
                                                          const next = new Map(prev);
                                                          const current = next.get(relayKey) || {
                                                            onDuration: 10,
                                                            offDuration: 10,
                                                            enabled: false,
                                                            phase: 'on' as const,
                                                          };
                                                          next.set(relayKey, { ...current, onDuration: value });
                                                          return next;
                                                        });
                                                      }}
                                                      className="w-full px-2 py-1.5 bg-dark-surface border border-dark-border rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-aqua-500"
                                                      placeholder="10"
                                                    />
                                                  </div>
                                                  <div className="space-y-2">
                                                    <label className="text-xs text-dark-textSecondary">{ap.timer.cycleOffLabel}</label>
                                                    <input
                                                      type="number"
                                                      min="1"
                                                      max="86400"
                                                      value={relayCycles.get(relayKey)?.offDuration || 10}
                                                      onChange={(e) => {
                                                        const value = parseInt(e.target.value) || 10;
                                                        setRelayCycles(prev => {
                                                          const next = new Map(prev);
                                                          const current = next.get(relayKey) || {
                                                            onDuration: 10,
                                                            offDuration: 10,
                                                            enabled: false,
                                                            phase: 'on' as const,
                                                          };
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
                                                            duration_seconds: 0,
                                                          });
                                                          if (result.success && result.command_id) {
                                                            registerPendingSlaveAck(result.command_id, {
                                                              relayKey,
                                                              previousState: isRelayOn,
                                                              desiredOn: false,
                                                              cycle: 'stop',
                                                              slaveMac: slave.macAddress,
                                                              slaveName: slave.name,
                                                              relayLabel,
                                                              successToast: ap.timer.cycleStopped,
                                                            });
                                                          } else {
                                                            clearRelayLoading(relayKey);
                                                            toast.error(
                                                              result.error ??
                                                                formatSlaveNoTrackingMessage({
                                                                  slaveName: slave.name,
                                                                  relayLabel,
                                                                }),
                                                              { duration: 5000 }
                                                            );
                                                          }
                                                        }}
                                                        className="w-full py-2 px-3 text-xs font-medium rounded bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 disabled:opacity-50"
                                                      >
                                                        {ap.timer.stopCycle}
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
                                                            phase: 'on' as const,
                                                          };
                                                          setLoadingRelays(prev => new Map(prev).set(relayKey, true));
                                                          const result = await sendSlaveRelayCommand({
                                                            master_device_id: selectedDeviceId!,
                                                            slave_mac_address: slave.macAddress,
                                                            slave_name: slave.name,
                                                            relay_number: relay.id,
                                                            mode: 'cycle',
                                                            action: 'on',
                                                            duration_seconds: cycle.onDuration,
                                                            cycle_off_seconds: cycle.offDuration,
                                                          });
                                                          if (result.success && result.command_id) {
                                                            registerPendingSlaveAck(result.command_id, {
                                                              relayKey,
                                                              previousState: isRelayOn,
                                                              desiredOn: true,
                                                              durationSeconds: cycle.onDuration,
                                                              slaveMac: slave.macAddress,
                                                              slaveName: slave.name,
                                                              relayLabel,
                                                              cycle: {
                                                                onDuration: cycle.onDuration,
                                                                offDuration: cycle.offDuration,
                                                              },
                                                              successToast: ap.timer.toastCycleStarted
                                                                .replace('{on}', String(cycle.onDuration))
                                                                .replace('{off}', String(cycle.offDuration)),
                                                            });
                                                          } else {
                                                            clearRelayLoading(relayKey);
                                                            toast.error(
                                                              result.error ??
                                                                formatSlaveNoTrackingMessage({
                                                                  slaveName: slave.name,
                                                                  relayLabel,
                                                                }),
                                                              { duration: 5000 }
                                                            );
                                                          }
                                                        }}
                                                        className="w-full py-2 px-3 text-xs font-medium rounded bg-aqua-500/20 text-aqua-400 border border-aqua-500/40 hover:bg-aqua-500/30 disabled:opacity-50"
                                                      >
                                                        {ap.timer.startCycle}
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
                                                      title={ap.atlas.closePanel}
                                                    >
                                                      <XMarkIcon className="w-4 h-4" />
                                                    </button>
                                                  </div>
                                                  <p className="text-xs text-dark-textSecondary/80">
                                                    {ap.timer.cycleHint}
                                                  </p>
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
                                          Relé {relay.id}:
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
                                            placeholder={`Relé ${relay.id}`}
                                          />
                                          <button
                                            onClick={() => {
                                              if (tempName.trim() && tempName.trim() !== originalName) {
                                                handleSaveRelayName(slave.macAddress, relay.id, tempName.trim());
                                              }
                                            }}
                                            disabled={isSaving || !tempName.trim() || tempName.trim() === originalName}
                                            className="px-3 py-2 bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all shadow-lg hover:shadow-aqua-500/50 text-xs font-medium flex items-center gap-1 flex-shrink-0"
                                            title={ap.atlas.saveNameHint}
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
                <h2 className="text-lg sm:text-xl font-bold text-dark-text">{ap.engine.title}</h2>
                <p className="text-xs sm:text-sm text-dark-textSecondary mt-1">{ap.engine.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* ✅ Candado para bloquear/desbloquear controles Decision Engine (com senha admin) */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  showLockUnlockToast(
                    decisionEngineLocked,
                    ap.engine.decisionEngineName,
                    () => setDecisionEngineLocked(prev => !prev)
                  );
                }}
                className={`p-1.5 rounded transition-colors ${
                  decisionEngineLocked
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                    : 'bg-aqua-500/20 text-aqua-400 hover:bg-aqua-500/30 border border-aqua-500/30'
                }`}
                title={decisionEngineLocked ? ap.engine.unlock : ap.engine.lock}
              >
                {decisionEngineLocked ? (
                  <LockClosedIcon className="w-4 h-4" />
                ) : (
                  <LockOpenIcon className="w-4 h-4" />
                )}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!decisionEngineLocked) void handleResyncRulesToDevice();
                }}
                disabled={decisionEngineLocked}
                className={`p-1.5 rounded transition-colors bg-dark-surface text-dark-textSecondary hover:text-aqua-400 border border-dark-border hover:border-aqua-500/40 ${
                  decisionEngineLocked ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                title={ap.engine.resync}
              >
                <ArrowPathIcon className="w-4 h-4" />
              </button>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  if (!decisionEngineLocked) {
                    setEditingRule(null);
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
                      setEditingRule(null);
                      setIsModalOpen(true);
                    }
                  }
                }}
                className={`bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white font-medium py-2 px-4 rounded-lg transition-all shadow-lg hover:shadow-aqua-500/50 text-sm sm:text-base flex-shrink-0 ml-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-aqua-500 focus:ring-offset-2 focus:ring-offset-dark-card ${
                  decisionEngineLocked ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                title={decisionEngineLocked ? ap.engine.newRuleLocked : ap.engine.newRule}
              >
                {ap.engine.newRule}
              </div>
            </div>
          </div>

          {expandedDecisionEngine && (
            <div className="p-4 sm:p-6 border-t border-dark-border">
              {selectedDeviceId && selectedDeviceId !== 'default_device' ? (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-sm text-dark-textSecondary">
                      {ap.scripts.header
                        .replace('{active}', String(rules.filter((r) => r.enabled).length))
                        .replace('{inactive}', String(rules.filter((r) => !r.enabled).length))}
                    </p>
                  </div>

                  {loading ? (
                    <div className="text-center py-8 text-dark-textSecondary">{t.common.loading}</div>
                  ) : rules.length === 0 ? (
                    <div className="text-center py-8 text-dark-textSecondary bg-dark-surface border border-dark-border rounded-lg">
                      {ap.scripts.empty}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-2">
                          <CheckCircleIcon className="w-4 h-4" />
                          {ap.scripts.activeCol.replace(
                            '{n}',
                            String(rules.filter((r) => r.enabled).length)
                          )}
                        </h3>
                        {[...rules]
                          .filter((r) => r.enabled)
                          .sort((a, b) => (b.priority || 50) - (a.priority || 50))
                          .map((script) => renderMotorRuleCard(script))}
                        {rules.filter((r) => r.enabled).length === 0 && (
                          <div className="text-center py-6 text-dark-textSecondary/80 bg-dark-surface/30 border border-dark-border rounded-lg text-xs">
                            {ap.scripts.noActiveInCol}
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
                          <XCircleIcon className="w-4 h-4" />
                          {ap.scripts.inactiveCol.replace(
                            '{n}',
                            String(rules.filter((r) => !r.enabled).length)
                          )}
                        </h3>
                        {[...rules]
                          .filter((r) => !r.enabled)
                          .sort((a, b) => (b.priority || 50) - (a.priority || 50))
                          .map((script) => renderMotorRuleCard(script))}
                        {rules.filter((r) => !r.enabled).length === 0 && (
                          <div className="text-center py-6 text-dark-textSecondary/80 bg-dark-surface/30 border border-dark-border rounded-lg text-xs">
                            {ap.scripts.noInactiveInCol}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-dark-textSecondary">
                  {ap.toast.selectDeviceCreate}
                </div>
              )}
            </div>
          )}
        </div>



        <RuleExecutionHistoryPanel deviceId={selectedDeviceId} />
          </>
        )}

        {activeTab === 'schedules' && (
          <ScheduleEditor deviceId={selectedDeviceId} />
        )}

        {activeTab === 'ec' && (
          <AutoEcControllerPanel deviceId={selectedDeviceId} espnowSlaves={espnowSlaves} />
        )}

        {activeTab === 'ph' && selectedDeviceId && selectedDeviceId !== 'default_device' && (
          <PhControllerPanel
            deviceId={selectedDeviceId}
            currentPh={phAtual}
            currentPhRaw={phRaw}
            availableRelays={availableRelays}
            relayAllocation={relayAllocation}
          />
        )}
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
              name: `${slave.name} - ${atlasRelayLabel(relay.id, relay.name)}`,
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
            <div className="flex items-center justify-between p-6 border-b border-dark-border">
              <h2 className="text-xl font-bold text-dark-text">
                {rc.jsonPreviewTitle.replace(
                  '{name}',
                  String(jsonPreviewRule.name || jsonPreviewRule.rule_name || '')
                )}
              </h2>
              <button
                onClick={() => setJsonPreviewRule(null)}
                className="p-2 hover:bg-dark-surface rounded-lg transition-colors text-dark-textSecondary hover:text-dark-text"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
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
              <div className="mt-4 p-4 bg-aqua-500/10 border border-aqua-500/30 rounded-lg">
                <p className="text-xs text-aqua-300 mb-2">{rc.jsonPreviewHint1}</p>
                <p className="text-xs text-dark-textSecondary">{rc.jsonPreviewHint2}</p>
              </div>
            </div>
            <div className="flex items-center justify-end p-6 border-t border-dark-border">
              <button
                onClick={() => setJsonPreviewRule(null)}
                className="px-4 py-2 bg-dark-surface hover:bg-dark-border text-dark-text border border-dark-border rounded-lg text-sm font-medium transition-colors"
              >
                {ac.close}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

