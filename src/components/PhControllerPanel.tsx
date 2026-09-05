'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import NavLink from '@/components/NavLink';
import toast from 'react-hot-toast';
import { hwToast } from '@/lib/control-toast';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  LockClosedIcon,
  LockOpenIcon,
  BeakerIcon,
  XMarkIcon,
  ClipboardIcon,
} from '@heroicons/react/24/outline';
import { supabase } from '@/lib/supabase';
import { usePhOperationState } from '@/hooks/usePhOperationState';
import { formatSensorValue } from '@/lib/format-sensor-value';
import { PhDosageDetail } from '@/components/PhDosageDetail';
import OperationStateBadges from '@/components/OperationStateBadges';
import OperationStateBanners from '@/components/OperationStateBanners';
import { formatPhCalibrationLine } from '@/lib/ph-calibration';
import {
  phErrorAbs,
  phErrorH,
  resolveCorrectionDirection,
  resolveActiveK,
  previewPhDoseOperatorMl,
  previewPhDoseFirmwareMl,
  mlPerPhUnitFromK,
  resolveActiveSL,
  PH_OPERATOR_EQUATION_SYMBOL,
  PH_PULSE_EQUATION_SYMBOL,
  PH_FIRMWARE_EQUATION_SYMBOL,
  resolvePhDoseBlockReason,
  formatPhDoseBlockMessage,
} from '@/lib/ph-control-display';
import { subscribePhDosageInserts } from '@/lib/realtime/ph-dosages';
import { subscribeRelayStateUpdates } from '@/lib/realtime/relay-states';
import { subscribeAutoEnabled } from '@/lib/realtime/auto-controller';
import type { RealtimeChannelStatus } from '@/lib/realtime/channel';
import { DoserRelaySelect } from '@/components/DoserRelaySelect';
import {
  buildRegistryFromConfigs,
  serializeRegistryForDebug,
  validatePhRelayAssignment,
  type EcNutrientRelaySlice,
  type RelayAllocationRegistry,
} from '@/lib/relay-allocation';
import { parseConfigApiError } from '@/lib/controller-config-api';
import {
  composeRelayControlDisabled,
  getManualPendingRelaySet,
  resolveRelayNamingLock,
  type PendingCommandSlice,
} from '@/lib/relay-naming-lock';
import { saveMasterLocalRelayName } from '@/lib/nutrition-plan';
import { InstrumentCard } from '@/components/ui/InstrumentCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { MetricRow } from '@/components/ui/MetricRow';
import ControllerMetricsPanel from '@/components/ControllerMetricsPanel';
import { PhGrowerSummaryCard } from '@/components/GrowerSummaryCards';
import { useLanguage } from '@/contexts/LanguageContext';
import { toBcp47 } from '@/lib/locale';

export interface RelayAllocationBridge {
  buildRegistry: (
    overrides?: Parameters<typeof buildRegistryFromConfigs>[0]
  ) => RelayAllocationRegistry;
  pendingCommands?: PendingCommandSlice[];
  refresh?: () => Promise<void> | void;
  phConfig?: { relay_ph_up?: number | null; relay_ph_down?: number | null } | null;
}

interface PhControllerPanelProps {
  deviceId: string;
  currentPh: number | null;
  /** Valor bruto do sensor (pode ser lixo); se omitido usa currentPh */
  currentPhRaw?: number | null;
  /** @deprecated use relayAllocation — fallback se não passado */
  availableRelays?: Array<{ number: number; name: string }>;
  relayAllocation?: RelayAllocationBridge;
}

function validateAdminPassword(password: string): boolean {
  return password === 'admin';
}

function showLockUnlockToast(
  isLocked: boolean,
  sectionName: string,
  onConfirm: () => void
) {
  let passwordInputRef: HTMLInputElement | null = null;

  toast.custom((t) => {
    const handleConfirm = () => {
      const password = passwordInputRef?.value || '';
      if (password && validateAdminPassword(password)) {
        onConfirm();
        toast.dismiss(t.id);
        hwToast.success(isLocked ? `${sectionName} desbloqueado` : `${sectionName} bloqueado`, 'SISTEMA');
      } else {
        hwToast.error('Senha incorreta!', 'ALERTA', { id: 'ph-password-error' });
        if (passwordInputRef) {
          passwordInputRef.value = '';
          passwordInputRef.focus();
        }
      }
    };

    return (
      <div className="max-w-md w-full bg-dark-card border border-dark-border shadow-lg rounded-lg p-4">
        <h3 className="text-sm font-medium text-dark-text mb-2">
          🔒 {isLocked ? 'Desbloquear' : 'Bloquear'} {sectionName}
        </h3>
        <input
          ref={(el) => {
            passwordInputRef = el;
            if (el) setTimeout(() => el.focus(), 100);
          }}
          type="password"
          className="w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text mb-3"
          placeholder="Senha de administrador"
          onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
        />
        <div className="flex gap-2">
          <button onClick={handleConfirm} className="flex-1 px-3 py-2 bg-aqua-500 text-white rounded-md text-sm">
            Confirmar
          </button>
          <button onClick={() => toast.dismiss(t.id)} className="flex-1 px-3 py-2 bg-dark-surface border border-dark-border rounded-md text-sm">
            Cancelar
          </button>
        </div>
      </div>
    );
  }, { duration: Infinity });
}

export default function PhControllerPanel({
  deviceId,
  currentPh,
  currentPhRaw,
  availableRelays = [],
  relayAllocation,
}: PhControllerPanelProps) {
  const { t, locale } = useLanguage();
  const ph = t.automacao.ph;
  const [expanded, setExpanded] = useState(true);
  const [showPhConfigPreview, setShowPhConfigPreview] = useState(false);
  const [locked, setLocked] = useState(() => process.env.NODE_ENV !== 'development');
  const justSavedRef = useRef(false);
  const [configSyncTick, setConfigSyncTick] = useState(0);
  const [savedConfigSnapshot, setSavedConfigSnapshot] = useState<string | null>(null);
  const markConfigSynced = useCallback(() => {
    setConfigSyncTick((n) => n + 1);
  }, []);

  const [phSetpoint, setPhSetpoint] = useState(6.0);
  const [phTolerance, setPhTolerance] = useState(0.2);
  const [flowRatePhUp, setFlowRatePhUp] = useState(1.0);
  const [flowRatePhDown, setFlowRatePhDown] = useState(1.0);
  const [volume, setVolume] = useState(100);
  const [mlPerPhUnitAcid, setMlPerPhUnitAcid] = useState(2.0);
  const [mlPerPhUnitBase, setMlPerPhUnitBase] = useState(2.0);
  const [relayPhUp, setRelayPhUp] = useState(1);
  const [relayPhDown, setRelayPhDown] = useState(0);
  const [intervaloAutoPh, setIntervaloAutoPh] = useState(300);
  const [tempoRecirculacao, setTempoRecirculacao] = useState(60);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoTogglePending, setAutoTogglePending] = useState(false);
  const [autoRtStatus, setAutoRtStatus] = useState<RealtimeChannelStatus | 'connecting'>(
    'connecting'
  );
  const justToggledRef = useRef(false);
  const justToggledTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lastDosageMl, setLastDosageMl] = useState<number | null>(null);
  const [lastDosageAt, setLastDosageAt] = useState<string | null>(null);
  const [savedVolume, setSavedVolume] = useState(100);
  const [ecVolumeLiters, setEcVolumeLiters] = useState<number | null>(null);
  const [savingVolume, setSavingVolume] = useState(false);
  const [phConfigRaw, setPhConfigRaw] = useState<Record<string, unknown>>({});

  const [aggressiveness, setAggressiveness] = useState(0.5);
  const [consumo24h, setConsumo24h] = useState(false);
  const [pulseMl, setPulseMl] = useState(2.0);
  const [pulseGapSec, setPulseGapSec] = useState(2.0);

  const phFormSnapshot = useMemo(
    () =>
      JSON.stringify({
        phSetpoint,
        phTolerance,
        volume,
        mlPerPhUnitAcid,
        mlPerPhUnitBase,
        relayPhUp,
        relayPhDown,
        intervaloAutoPh,
        tempoRecirculacao,
        aggressiveness,
        consumo24h,
        pulseMl,
        pulseGapSec,
      }),
    [
      phSetpoint,
      phTolerance,
      volume,
      mlPerPhUnitAcid,
      mlPerPhUnitBase,
      relayPhUp,
      relayPhDown,
      intervaloAutoPh,
      tempoRecirculacao,
      aggressiveness,
      consumo24h,
      pulseMl,
      pulseGapSec,
    ]
  );
  const phConfigDirty = savedConfigSnapshot !== null && savedConfigSnapshot !== phFormSnapshot;

  const [kAcid, setKAcid] = useState<number | null>(null);
  const [kBase, setKBase] = useState<number | null>(null);
  const [stalePhFromDosage, setStalePhFromDosage] = useState<number | null>(null);
  const [ecNutrientsForRelayCheck, setEcNutrientsForRelayCheck] = useState<
    EcNutrientRelaySlice[]
  >([]);
  const [doserRelayStates, setDoserRelayStates] = useState<boolean[]>([]);

  const phOp = usePhOperationState(deviceId, Boolean(deviceId), {
    intervalCeilingSec: intervaloAutoPh,
    autoEnabled,
    relayFallback: {
      relayPhUp,
      relayPhDown,
      doserRelayStates,
    },
  });

  const manualPendingRelays = useMemo(
    () => getManualPendingRelaySet(relayAllocation?.pendingCommands),
    [relayAllocation?.pendingCommands]
  );

  const phOperationSlice = useMemo(
    () => ({
      isDosando: phOp.isDosando,
      isAguardandoRecirculacao: phOp.isAguardandoRecirculacao,
    }),
    [phOp.isDosando, phOp.isAguardandoRecirculacao]
  );

  const phUpRelayControl = useMemo(
    () =>
      composeRelayControlDisabled(
        locked,
        resolveRelayNamingLock({
          relayNumber: relayPhUp,
          domain: 'ph',
          ph: phOperationSlice,
          manualPendingRelays,
        })
      ),
    [locked, relayPhUp, phOperationSlice, manualPendingRelays]
  );

  const phDownRelayControl = useMemo(
    () =>
      composeRelayControlDisabled(
        locked,
        resolveRelayNamingLock({
          relayNumber: relayPhDown,
          domain: 'ph',
          ph: phOperationSlice,
          manualPendingRelays,
        })
      ),
    [locked, relayPhDown, phOperationSlice, manualPendingRelays]
  );

  const loadConfig = useCallback(async () => {
    if (!deviceId || justSavedRef.current) return;
    try {
      const [phRes, ecRes] = await Promise.all([
        fetch(`/api/ph-controller/config?device_id=${encodeURIComponent(deviceId)}`),
        fetch(`/api/ec-controller/config?device_id=${encodeURIComponent(deviceId)}`),
      ]);
      if (!phRes.ok) return;
      const data = await phRes.json();
      setPhConfigRaw(data);

      let ecVol: number | null = null;
      if (ecRes.ok) {
        const ecData = await ecRes.json();
        const parsedEcVol = Number(ecData.volume);
        if (Number.isFinite(parsedEcVol) && parsedEcVol > 0) {
          ecVol = parsedEcVol;
        }
        if (Array.isArray(ecData.nutrients)) {
          setEcNutrientsForRelayCheck(ecData.nutrients as EcNutrientRelaySlice[]);
        }
      }
      setEcVolumeLiters(ecVol);

      const phVol = Number(data.volume);
      const syncedVolume =
        Number.isFinite(phVol) && phVol > 0
          ? phVol
          : ecVol != null && ecVol > 0
            ? ecVol
            : 100;
      setVolume(syncedVolume);
      setSavedVolume(syncedVolume);
      setPhSetpoint(Number(data.ph_setpoint) || 6.0);
      setPhTolerance(Number(data.ph_tolerance) || 0.2);
      setFlowRatePhUp(Number(data.flow_rate_ph_up) || 1.0);
      setFlowRatePhDown(Number(data.flow_rate_ph_down) || 1.0);
      setMlPerPhUnitAcid(
        data.ml_per_ph_unit_acid != null
          ? Number(data.ml_per_ph_unit_acid)
          : Number(data.ml_per_ph_unit) || 2.0
      );
      setMlPerPhUnitBase(
        data.ml_per_ph_unit_base != null
          ? Number(data.ml_per_ph_unit_base)
          : Number(data.ml_per_ph_unit) || 2.0
      );
      setRelayPhUp(Number(data.relay_ph_up) ?? 1);
      setRelayPhDown(Number(data.relay_ph_down) ?? 0);
      setIntervaloAutoPh(Number(data.intervalo_auto_ph) || 300);
      setTempoRecirculacao(Number(data.tempo_recirculacao) || 60);
      setAutoEnabled(Boolean(data.auto_enabled));
      setAggressiveness(Number(data.aggressiveness) || 0.5);
      setConsumo24h(Boolean(data.consumo_24h));
      {
        const p = Number(data.pulse_ml);
        setPulseMl(Number.isFinite(p) && p > 0 ? Math.min(50, Math.max(0.05, p)) : 2.0);
      }
      {
        const g = Number(data.pulse_gap_sec);
        setPulseGapSec(Number.isFinite(g) && g >= 0 ? Math.min(120, Math.max(0, g)) : 2.0);
      }
      setKAcid(data.k_acid != null ? Number(data.k_acid) : null);
      setKBase(data.k_base != null ? Number(data.k_base) : null);
      markConfigSynced();
    } catch (err) {
      console.error('[PH Controller] load error', err);
    }
  }, [deviceId, markConfigSynced]);

  useEffect(() => {
    setSavedConfigSnapshot(null);
    setConfigSyncTick(0);
  }, [deviceId]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (configSyncTick === 0) return;
    setSavedConfigSnapshot(phFormSnapshot);
    // Capture only on load/save ticks — not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configSyncTick]);

  useEffect(() => {
    if (!deviceId || !autoEnabled) return;
    const id = setInterval(loadConfig, 30000);
    return () => clearInterval(id);
  }, [deviceId, autoEnabled, loadConfig]);

  useEffect(() => {
    if (!deviceId?.trim()) return;

    const applyDoserStates = (row: { doser_relay_states?: boolean[] }) => {
      if (row.doser_relay_states?.length) {
        setDoserRelayStates(row.doser_relay_states);
      }
    };

    void supabase
      .from('relay_master')
      .select('doser_relay_states')
      .eq('device_id', deviceId.trim())
      .maybeSingle()
      .then(({ data }) => {
        if (data) applyDoserStates(data);
      });

    return subscribeRelayStateUpdates(deviceId.trim(), applyDoserStates, () => {});
  }, [deviceId]);

  useEffect(() => {
    if (!deviceId?.trim()) return;
    setAutoRtStatus('connecting');
    return subscribeAutoEnabled(
      deviceId.trim(),
      'ph_config_view',
      (enabled) => {
        if (justToggledRef.current || autoTogglePending) return;
        setAutoEnabled(enabled);
      },
      (status) => setAutoRtStatus(status)
    );
  }, [deviceId, autoTogglePending]);

  useEffect(() => {
    return () => {
      if (justToggledTimeoutRef.current) clearTimeout(justToggledTimeoutRef.current);
    };
  }, []);

  const fetchLastDosage = useCallback(async () => {
    if (!deviceId) return;
    try {
      const { data, error } = await supabase
        .from('ph_dosages')
        .select('dosage_ml, ph_before, created_at')
        .eq('device_id', deviceId.trim())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setLastDosageMl(Number(data.dosage_ml) || 0);
        setLastDosageAt(data.created_at ?? null);
        const before = Number(data.ph_before);
        if (Number.isFinite(before)) {
          setStalePhFromDosage(before);
        }
      } else {
        setLastDosageMl(null);
        setLastDosageAt(null);
        setStalePhFromDosage(null);
      }
    } catch {
      setLastDosageMl(null);
      setLastDosageAt(null);
      setStalePhFromDosage(null);
    }
  }, [deviceId]);

  useEffect(() => {
    fetchLastDosage();
    if (!deviceId) return;

    const pollId = setInterval(fetchLastDosage, 30_000);
    const unsubDosage =
      autoEnabled && deviceId
        ? subscribePhDosageInserts(deviceId, (row) => {
            setLastDosageMl(Number(row.dosage_ml) || 0);
            setLastDosageAt(row.created_at ?? null);
            const before = Number(row.ph_before);
            if (Number.isFinite(before)) setStalePhFromDosage(before);
          })
        : () => {};

    return () => {
      clearInterval(pollId);
      unsubDosage();
    };
  }, [deviceId, autoEnabled, fetchLastDosage]);

  const saveConfig = useCallback(async (silent = false) => {
    if (!deviceId) return false;

    const phRelayCheck = validatePhRelayAssignment(
      relayPhUp,
      relayPhDown,
      ecNutrientsForRelayCheck
    );
    if (!phRelayCheck.ok) {
      hwToast.error(phRelayCheck.error || ph.toastConflict, 'AUTO PH');
      return false;
    }

    try {
      const res = await fetch('/api/ph-controller/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId,
          ph_setpoint: phSetpoint,
          ph_tolerance: phTolerance,
          volume,
          ml_per_ph_unit_acid: mlPerPhUnitAcid,
          ml_per_ph_unit_base: mlPerPhUnitBase,
          relay_ph_up: relayPhUp,
          relay_ph_down: relayPhDown,
          intervalo_auto_ph: intervaloAutoPh,
          tempo_recirculacao: tempoRecirculacao,
          auto_enabled: autoEnabled,
          aggressiveness,
          consumo_24h: consumo24h,
          pulse_ml: pulseMl,
          pulse_gap_sec: pulseGapSec,
        }),
      });
      if (!res.ok) {
        const parsed = await parseConfigApiError(res);
        throw new Error(parsed.message);
      }
      justSavedRef.current = true;
      setTimeout(() => { justSavedRef.current = false; }, 2000);
      if (deviceId && deviceId !== 'default_device') {
        await saveMasterLocalRelayName(deviceId, relayPhUp, 'pH+');
        await saveMasterLocalRelayName(deviceId, relayPhDown, 'pH-');
        await relayAllocation?.refresh?.();
      }
      markConfigSynced();
      if (!silent) hwToast.success(ph.toastSaved, 'AUTO PH');
      return true;
    } catch (err) {
      hwToast.error(err instanceof Error ? err.message : ph.toastSaveError, 'AUTO PH');
      return false;
    }
  }, [
    deviceId, phSetpoint, phTolerance, flowRatePhUp, flowRatePhDown, volume,
    mlPerPhUnitAcid, mlPerPhUnitBase, relayPhUp, relayPhDown, intervaloAutoPh,
    tempoRecirculacao, autoEnabled, aggressiveness, consumo24h, pulseMl, pulseGapSec, ecNutrientsForRelayCheck,
    relayAllocation, markConfigSynced, ph,
  ]);

  const saveVolumeOnly = useCallback(async () => {
    if (!deviceId || !Number.isFinite(volume) || volume <= 0) {
      hwToast.error(ph.toastVolumeInvalid, 'AUTO PH');
      return;
    }
    setSavingVolume(true);
    try {
      const res = await fetch('/api/ph-controller/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...phConfigRaw,
          device_id: deviceId,
          volume,
        }),
      });
      if (!res.ok) {
        const parsed = await parseConfigApiError(res);
        throw new Error(parsed.message);
      }
      setSavedVolume(volume);
      hwToast.success('Volume pH salvo (ph_config)', 'AUTO PH');
      await loadConfig();
    } catch (err) {
      hwToast.error(err instanceof Error ? err.message : 'Erro ao salvar volume', 'AUTO PH');
    } finally {
      setSavingVolume(false);
    }
  }, [deviceId, volume, phConfigRaw, loadConfig, ph]);

  const toggleAutoPh = async () => {
    if (!deviceId) return;
    const previous = autoEnabled;
    const newValue = !autoEnabled;

    setAutoEnabled(newValue);
    setAutoTogglePending(true);
    justToggledRef.current = true;
    if (justToggledTimeoutRef.current) clearTimeout(justToggledTimeoutRef.current);

    try {
      if (newValue) {
        const saved = await saveConfig(true);
        if (!saved) {
          setAutoEnabled(previous);
          return;
        }
        const { error } = await supabase.rpc('activate_auto_ph', { p_device_id: deviceId });
        if (error) {
          setAutoEnabled(previous);
          hwToast.error(`Erro ao ativar Auto pH: ${error.message}`, 'AUTO PH');
          return;
        }
        hwToast.success(ph.toastActivated, 'AUTO PH');
      } else {
        const { error } = await supabase
          .from('ph_config_view')
          .update({ auto_enabled: false, updated_at: new Date().toISOString() })
          .eq('device_id', deviceId);
        if (error) {
          setAutoEnabled(previous);
          hwToast.error(`Erro ao desativar: ${error.message}`, 'AUTO PH');
          return;
        }
        await supabase
          .from('relay_master')
          .update({
            ph_operation_state: 'idle',
            ph_operation_remaining_sec: 0,
            ph_next_check_in_sec: 0,
          })
          .eq('device_id', deviceId);
        hwToast.info(ph.toastDeactivated, 'AUTO PH');
      }

      const mqttPush = await fetch('/api/ph-controller/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, auto_enabled: newValue }),
      });
      if (!mqttPush.ok) {
        const parsed = await parseConfigApiError(mqttPush);
        console.warn('[PH] Postgres OK, MQTT config falhou:', parsed.message);
      }

      justToggledTimeoutRef.current = setTimeout(() => {
        justToggledRef.current = false;
      }, 2000);
    } catch (err) {
      setAutoEnabled(previous);
      hwToast.error(err instanceof Error ? err.message : 'Erro ao alterar Auto pH', 'AUTO PH');
    } finally {
      setAutoTogglePending(false);
    }
  };

  const pvRaw = useMemo(() => {
    const raw = currentPhRaw ?? currentPh;
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }, [currentPhRaw, currentPh]);

  const displayPh = useMemo(() => {
    if (currentPh != null && Number.isFinite(currentPh)) return currentPh;
    if (pvRaw != null) return pvRaw;
    if (stalePhFromDosage != null && Number.isFinite(stalePhFromDosage)) {
      return stalePhFromDosage;
    }
    return null;
  }, [currentPh, pvRaw, stalePhFromDosage]);

  const pvDebugNote = useMemo(() => {
    if (displayPh == null) return null;
    if (Math.abs(displayPh) < 1e-3 || displayPh < 0 || displayPh > 14) {
      return Number(displayPh).toExponential(3);
    }
    return null;
  }, [displayPh]);

  const phError = displayPh != null ? phErrorAbs(phSetpoint, displayPh) : null;

  const correctionDirection = useMemo(() => {
    if (displayPh === null) return 'none' as const;
    return resolveCorrectionDirection(phSetpoint, displayPh, phTolerance);
  }, [displayPh, phSetpoint, phTolerance]);

  const phDirection = useMemo(() => {
    if (displayPh === null) return '--';
    if (Math.abs(displayPh - phSetpoint) <= phTolerance) return ph.directionNeutral;
    return displayPh < phSetpoint ? ph.directionBase : ph.directionAcid;
  }, [displayPh, phSetpoint, phTolerance, ph.directionNeutral, ph.directionBase, ph.directionAcid]);

  const phWithinTolerance = useMemo(() => {
    if (displayPh === null) return null;
    return Math.abs(displayPh - phSetpoint) <= phTolerance;
  }, [displayPh, phSetpoint, phTolerance]);

  const calibBaseLine = formatPhCalibrationLine(
    ph.directionBase,
    mlPerPhUnitBase,
    volume,
    flowRatePhUp
  );
  const calibAcidLine = formatPhCalibrationLine(
    ph.directionAcid,
    mlPerPhUnitAcid,
    volume,
    flowRatePhDown
  );

  const formatCountdown = (totalSec: number): string => {
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    if (minutes > 0) return `${minutes}:${String(seconds).padStart(2, '0')}`;
    return `${seconds}s`;
  };

  const showNextCheck =
    autoEnabled &&
    !phOp.isDosando &&
    !phOp.isAguardandoRecirculacao &&
    phOp.nextCheckInSec > 0;

  const activeFlowRate = useMemo(() => {
    if (correctionDirection === 'base') return flowRatePhUp;
    if (correctionDirection === 'acid') return flowRatePhDown;
    return flowRatePhUp;
  }, [correctionDirection, flowRatePhUp, flowRatePhDown]);

  const activeKResult = useMemo(() => {
    if (displayPh === null) return null;
    const kDirection =
      correctionDirection !== 'none'
        ? correctionDirection
        : displayPh < phSetpoint
          ? 'base'
          : 'acid';
    return resolveActiveK({
      direction: kDirection,
      kAcid,
      kBase,
      phSetpoint,
      mlPerPhUnit: kDirection === 'base' ? mlPerPhUnitBase : mlPerPhUnitAcid,
    });
  }, [
    displayPh,
    correctionDirection,
    kAcid,
    kBase,
    phSetpoint,
    mlPerPhUnitBase,
    mlPerPhUnitAcid,
  ]);

  const errorHAbs = useMemo(() => {
    if (displayPh === null) return null;
    return Math.abs(phErrorH(phSetpoint, displayPh));
  }, [displayPh, phSetpoint]);

  const activeMlPerPhUnit = useMemo(() => {
    const dir =
      correctionDirection !== 'none'
        ? correctionDirection
        : displayPh != null && displayPh < phSetpoint
          ? 'base'
          : 'acid';
    return dir === 'base' ? mlPerPhUnitBase : mlPerPhUnitAcid;
  }, [correctionDirection, displayPh, phSetpoint, mlPerPhUnitBase, mlPerPhUnitAcid]);

  const activeS = useMemo(() => {
    if (activeKResult == null) return activeMlPerPhUnit;
    const fromK = mlPerPhUnitFromK(phSetpoint, activeKResult.k);
    return fromK ?? activeMlPerPhUnit;
  }, [activeKResult, phSetpoint, activeMlPerPhUnit]);

  const activeSL = useMemo(
    () => resolveActiveSL(activeS, volume),
    [activeS, volume]
  );

  const previewDoseMl = useMemo(() => {
    if (displayPh === null || activeS == null || activeS <= 0) return null;
    return previewPhDoseOperatorMl(
      phSetpoint,
      displayPh,
      aggressiveness,
      activeS,
      phTolerance
    );
  }, [displayPh, phSetpoint, aggressiveness, activeS, phTolerance]);

  const previewFirmwareUncappedMl = useMemo(() => {
    if (displayPh === null || activeKResult == null) return null;
    return previewPhDoseFirmwareMl(
      phSetpoint,
      displayPh,
      aggressiveness,
      activeKResult.k
    );
  }, [displayPh, phSetpoint, aggressiveness, activeKResult]);

  const previewFirmwareMl = previewFirmwareUncappedMl;

  const previewPulseSec = useMemo(() => {
    if (previewDoseMl == null || activeFlowRate <= 0) return null;
    return previewDoseMl / activeFlowRate;
  }, [previewDoseMl, activeFlowRate]);

  const firmwareDoseBlockReason = useMemo(
    () =>
      resolvePhDoseBlockReason({
        autoEnabled,
        displayPh,
        phSetpoint,
        phTolerance,
      }),
    [autoEnabled, displayPh, phSetpoint, phTolerance]
  );

  const firmwareDoseBlockMessage = formatPhDoseBlockMessage(firmwareDoseBlockReason);

  const relayRegistry = useMemo(() => {
    const phSlice = { relay_ph_up: relayPhUp, relay_ph_down: relayPhDown };
    if (relayAllocation) {
      return relayAllocation.buildRegistry({ phConfig: phSlice });
    }
    const names = new Map<number, string>();
    for (const r of availableRelays) {
      names.set(r.number, r.name);
    }
    return buildRegistryFromConfigs({ phConfig: phSlice, relayNames: names });
  }, [relayAllocation, relayPhUp, relayPhDown, availableRelays]);

  const isStandardPhRelayName = useCallback((name: string | undefined | null) => {
    const n = (name || '').trim();
    return (
      n === 'pH+' ||
      n === 'pH-' ||
      n === 'pH+ (base)' ||
      n === 'pH- (ácido)' ||
      n === 'pH− (ácido)' ||
      n === 'pH−'
    );
  }, []);

  const autoNamePhRelay = useCallback(
    async (nextRelay: number, prevRelay: number, label: 'pH+' | 'pH-') => {
      if (!deviceId || deviceId === 'default_device') return;
      await saveMasterLocalRelayName(deviceId, nextRelay, label);
      if (prevRelay !== nextRelay) {
        const prevName = relayRegistry.names.get(prevRelay);
        if (isStandardPhRelayName(prevName)) {
          await saveMasterLocalRelayName(deviceId, prevRelay, '');
        }
      }
      await relayAllocation?.refresh?.();
    },
    [deviceId, relayRegistry.names, isStandardPhRelayName, relayAllocation]
  );

  const handleRelayPhUpChange = useCallback(
    (next: number) => {
      const prev = relayPhUp;
      setRelayPhUp(next);
      void autoNamePhRelay(next, prev, 'pH+');
    },
    [relayPhUp, autoNamePhRelay]
  );

  const handleRelayPhDownChange = useCallback(
    (next: number) => {
      const prev = relayPhDown;
      setRelayPhDown(next);
      void autoNamePhRelay(next, prev, 'pH-');
    },
    [relayPhDown, autoNamePhRelay]
  );

  const phConfigJson = useMemo(
    () => ({
      device_id: deviceId,
      ph_setpoint: phSetpoint,
      ph_tolerance: phTolerance,
      flow_rate_ph_up: flowRatePhUp,
      flow_rate_ph_down: flowRatePhDown,
      volume,
      ml_per_ph_unit_acid: mlPerPhUnitAcid,
      ml_per_ph_unit_base: mlPerPhUnitBase,
      relay_ph_up: relayPhUp,
      relay_ph_down: relayPhDown,
      intervalo_auto_ph: intervaloAutoPh,
      tempo_recirculacao: tempoRecirculacao,
      auto_enabled: autoEnabled,
      aggressiveness,
      consumo_24h: consumo24h,
      pulse_ml: pulseMl,
      pulse_gap_sec: pulseGapSec,
      k_acid: kAcid,
      k_base: kBase,
      _debug: {
        pv_ph: displayPh,
        pv_ph_raw: pvRaw,
        error_ph_abs: phError,
        error_h_abs: errorHAbs,
        correction_direction: correctionDirection,
        ph_direction_label: phDirection,
        k_active: activeKResult?.k ?? null,
        k_source: activeKResult?.source ?? null,
        u_preview_ml: previewDoseMl,
        u_preview_firmware_h_ml: previewFirmwareMl,
        s_total_ml_per_ph_unit: activeS,
        s_L_ml_per_L_per_ph: activeSL,
        tau_preview_sec: previewPulseSec,
        flow_rate_active_ml_s: activeFlowRate,
        volume_liters: volume,
        firmware_dose_block_reason: firmwareDoseBlockReason,
        firmware_dose_block_message: firmwareDoseBlockMessage,
        equation_operator: PH_OPERATOR_EQUATION_SYMBOL,
        equation_pulse: PH_PULSE_EQUATION_SYMBOL,
        equation_firmware: PH_FIRMWARE_EQUATION_SYMBOL,
        ph_operation_state: phOp.state,
        ph_operation_remaining_sec: phOp.operationRemainingSec,
        ph_next_check_in_sec: phOp.nextCheckInSec,
        is_dosando: phOp.isDosando,
        is_recirculating: phOp.isAguardandoRecirculacao,
        last_dosage_ml: lastDosageMl,
        calib_base: calibBaseLine,
        calib_acid: calibAcidLine,
        relay_allocation: {
          ph_up: serializeRegistryForDebug(relayRegistry, {
            field: 'ph_up',
            currentValue: relayPhUp,
          }),
          ph_down: serializeRegistryForDebug(relayRegistry, {
            field: 'ph_down',
            currentValue: relayPhDown,
          }),
        },
        note: 'JSON enviado a ph_config_view; _debug = preview UI + estado MQTT relay_master',
      },
    }),
    [
      deviceId,
      phSetpoint,
      phTolerance,
      flowRatePhUp,
      flowRatePhDown,
      volume,
      mlPerPhUnitAcid,
      mlPerPhUnitBase,
      relayPhUp,
      relayPhDown,
      intervaloAutoPh,
      tempoRecirculacao,
      autoEnabled,
      aggressiveness,
      consumo24h,
      pulseMl,
      pulseGapSec,
      kAcid,
      kBase,
      displayPh,
      pvRaw,
      phError,
      errorHAbs,
      correctionDirection,
      phDirection,
      activeKResult,
      previewDoseMl,
      previewFirmwareMl,
      activeS,
      activeSL,
      previewPulseSec,
      activeFlowRate,
      firmwareDoseBlockReason,
      firmwareDoseBlockMessage,
      phOp,
      lastDosageMl,
      calibBaseLine,
      calibAcidLine,
      relayRegistry,
      relayPhUp,
      relayPhDown,
    ]
  );

  const disabled = locked;

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg overflow-hidden mb-6">
      <div
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-dark-surface transition-colors cursor-pointer"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-1 min-w-0">
          <div className="flex items-center space-x-3 min-w-0">
            {expanded ? (
              <ChevronUpIcon className="w-5 h-5 text-violet-400 shrink-0" />
            ) : (
              <ChevronDownIcon className="w-5 h-5 text-dark-textSecondary shrink-0" />
            )}
            <h3 className="text-lg font-semibold text-dark-text flex items-center gap-2 min-w-0">
              <BeakerIcon className="w-5 h-5 text-violet-400 shrink-0" aria-hidden />
              <span className="truncate">{ph.title}</span>
            </h3>
          </div>
          <OperationStateBadges
            variant="header"
            autoEnabled={autoEnabled}
            autoActiveLabel={ph.autoActive}
            autoInactiveLabel={ph.autoInactive}
            isDosando={phOp.isDosando}
            dosandoLabel={
              phOp.isDosando && phOp.operationRemainingSec > 0
                ? ph.dosingTimed.replace('{n}', String(phOp.operationRemainingSec))
                : ph.dosing
            }
            isAguardandoRecirculacao={phOp.isAguardandoRecirculacao}
            operationRemainingSec={phOp.operationRemainingSec}
            showNextCheck={showNextCheck}
            nextCheckInSec={phOp.nextCheckInSec}
            nextCheckLabel={ph.nextCheck}
            accent="violet"
          />
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            showLockUnlockToast(locked, ph.lockSection, () => setLocked((p) => !p));
          }}
          title={locked ? ph.unlock : ph.lock}
          className={`p-1.5 rounded transition-colors ${
            locked
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
          }`}
        >
          {locked ? <LockClosedIcon className="w-4 h-4" /> : <LockOpenIcon className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="p-4 sm:p-6 border-t border-dark-border">
          <p className="text-xs sm:text-sm text-dark-textSecondary mb-4">
            {ph.calibIntroBefore}
            <NavLink href="/calibragem" className="text-violet-400 hover:underline">/calibragem</NavLink>
            {ph.calibIntroAfter}
          </p>

          {pvDebugNote != null && (
            <p className="text-xs text-dark-textSecondary mb-4 rounded-md border border-dark-border bg-dark-surface/50 px-3 py-2 font-mono tabular-nums">
              {ph.pvDebug} {pvDebugNote}
            </p>
          )}

          {displayPh === null && stalePhFromDosage != null && (
            <p className="text-xs text-dark-textSecondary mb-4 rounded-md border border-dark-border bg-dark-surface px-3 py-2">
              {ph.lastReading}{' '}
              <span className="font-medium text-dark-text tabular-nums">
                pH {formatSensorValue(stalePhFromDosage, 2)}
              </span>
              <span className="ml-2 text-amber-400/90">{ph.lastReadingStale}</span>
            </p>
          )}

          {deviceId ? (
            <div className="mb-6">
              <ControllerMetricsPanel deviceId={deviceId} focus="ph" hideTabs />
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <InstrumentCard accent="ph" title={`📊 ${ph.statusCard}`} ariaLive="polite">
              <div className="space-y-2.5">
                <OperationStateBanners
                  autoEnabled={autoEnabled}
                  isDosando={phOp.isDosando}
                  dosandoLabel={ph.dosing}
                  isAguardandoRecirculacao={phOp.isAguardandoRecirculacao}
                  operationRemainingSec={phOp.operationRemainingSec}
                  showNextCheck={showNextCheck}
                  nextCheckInSec={phOp.nextCheckInSec}
                  nextCheckLabel={ph.nextCheck}
                  formatCountdown={formatCountdown}
                />
                <MetricRow
                  label={ph.statusLabel}
                  value={autoEnabled ? ph.statusOn : ph.statusOff}
                  variant={autoEnabled ? 'ok' : 'danger'}
                />
                <MetricRow
                  label={ph.setpoint}
                  value={`pH ${formatSensorValue(phSetpoint, 1)}`}
                  variant="setpoint"
                />
                <MetricRow
                  label={ph.deadband}
                  value={`± ${formatSensorValue(phTolerance, 2)}`}
                />
                <MetricRow
                  label={ph.errorAbs}
                  value={phError !== null ? formatSensorValue(phError, 2) : '--'}
                  variant={phWithinTolerance === false ? 'alarm' : 'default'}
                />
                <MetricRow
                  label={ph.controlZone}
                  value={
                    phWithinTolerance === null
                      ? '--'
                      : phWithinTolerance
                        ? ph.noDoseInBand
                        : ph.adjustA.replace('{direction}', phDirection)
                  }
                  variant={
                    phWithinTolerance === true ? 'ok' : phWithinTolerance === false ? 'alarm' : 'default'
                  }
                />
                <MetricRow
                  label={ph.lastDose}
                  value={
                    lastDosageMl != null
                      ? `${lastDosageMl.toFixed(2)} ml${
                          lastDosageAt
                            ? ` · ${new Date(lastDosageAt).toLocaleString(toBcp47(locale))}`
                            : ''
                        }`
                      : '-- ml'
                  }
                  variant="preview"
                  hint={ph.lastDoseHint}
                />
                <MetricRow
                  label={ph.phActual}
                  value={
                    displayPh !== null
                      ? Math.abs(displayPh) < 0.01 || Math.abs(displayPh) >= 1000
                        ? displayPh.toExponential(3)
                        : formatSensorValue(displayPh, 2)
                      : '--'
                  }
                  variant="live"
                />
                <MetricRow label={ph.direction} value={phDirection} />
              </div>
              <PhDosageDetail
                deviceId={deviceId}
                enabled={autoEnabled}
                variant="footer"
                onLastMlChange={setLastDosageMl}
              />
            </InstrumentCard>

            <PhGrowerSummaryCard
              deviceId={deviceId}
              consumo24h={consumo24h}
              phNow={displayPh}
              setpoint={phSetpoint}
              tolerance={phTolerance}
              estimatedDoseMl={previewDoseMl}
              lastDoseMl={lastDosageMl}
              lastDoseAt={lastDosageAt}
              directionLabel={phDirection}
              autoEnabled={autoEnabled}
              showNextCheck={showNextCheck}
              nextCheckInSec={phOp.nextCheckInSec}
              formatCountdown={formatCountdown}
              calibBaseLine={calibBaseLine}
              calibAcidLine={calibAcidLine}
            />
          </div>

          <SectionHeader title={ph.objective} accent="ph" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm text-dark-textSecondary mb-1">{ph.setpointPh}</label>
              <input
                type="number"
                step="0.1"
                min="4"
                max="9"
                value={phSetpoint}
                disabled={disabled}
                onChange={(e) => setPhSetpoint(parseFloat(e.target.value) || 6)}
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm text-dark-textSecondary mb-1">{ph.tolerance}</label>
              <input
                type="number"
                step="0.05"
                min="0.05"
                max="1"
                value={phTolerance}
                disabled={disabled}
                onChange={(e) => setPhTolerance(parseFloat(e.target.value) || 0.2)}
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm text-dark-textSecondary mb-1">
                {ph.aggressivenessA.replace('{n}', aggressiveness.toFixed(2))}
              </label>
              <input
                type="range"
                min="0.2"
                max="1"
                step="0.05"
                value={aggressiveness}
                disabled={disabled}
                onChange={(e) => setAggressiveness(parseFloat(e.target.value))}
                className="w-full accent-violet-500 disabled:opacity-50"
              />
              <span className="text-xs text-dark-textSecondary">0.2 conservador — 1.0 agressivo</span>
            </div>
            <label className="flex items-start gap-3 sm:col-span-2 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 accent-violet-500 disabled:opacity-50"
                checked={consumo24h}
                disabled={disabled}
                onChange={(e) => setConsumo24h(e.target.checked)}
              />
              <span>
                <span className="block text-sm text-dark-text">Consumo pH 24 h</span>
                <span className="block text-xs text-dark-textSecondary">
                  Liga o diário de 24 h no resumo (seta de pH e ml pH+/pH−). Também é a
                  camada do firmware. Default OFF. Não muda o intervalo.
                </span>
              </span>
            </label>
            <div>
              <label className="block text-sm text-dark-textSecondary mb-1">{ph.pulseMl}</label>
              <input
                type="number"
                min="0.05"
                max="50"
                step="0.1"
                value={pulseMl}
                disabled={disabled}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setPulseMl(Number.isFinite(v) && v > 0 ? Math.min(50, Math.max(0.05, v)) : 2);
                }}
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text disabled:opacity-50"
              />
              <span className="text-xs text-dark-textSecondary">
                Último pulso = resto. ON ≈ ml ÷ caudal da bomba activa.
              </span>
            </div>
            <div>
              <label className="block text-sm text-dark-textSecondary mb-1">Gap pulsos (s)</label>
              <input
                type="number"
                min="0"
                max="120"
                step="0.5"
                value={pulseGapSec}
                disabled={disabled}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setPulseGapSec(Number.isFinite(v) && v >= 0 ? Math.min(120, Math.max(0, v)) : 2);
                }}
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text disabled:opacity-50"
              />
              <span className="text-xs text-dark-textSecondary">
                Descanso entre pulsos. Recirc = tempo_recirculacao após a dose.
              </span>
            </div>
          </div>

          <SectionHeader title={ph.actuation} accent="ph" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-sm text-dark-textSecondary mb-1">{ph.volumeL}</label>
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={volume}
                  disabled={disabled}
                  onChange={(e) => setVolume(parseFloat(e.target.value) || 0)}
                  className="w-24 p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={disabled || savingVolume || volume === savedVolume}
                  onClick={() => void saveVolumeOnly()}
                  className="px-3 py-1.5 text-xs rounded-lg bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 disabled:opacity-50"
                >
                  {savingVolume ? ph.saving : ph.saveVolume}
                </button>
                {ecVolumeLiters != null && ecVolumeLiters > 0 && ecVolumeLiters !== volume && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setVolume(ecVolumeLiters)}
                    className="px-3 py-1.5 text-xs rounded-lg text-dark-textSecondary border border-dark-border hover:bg-dark-surface disabled:opacity-50"
                  >
                    {ph.useEcVolume.replace('{n}', String(ecVolumeLiters))}
                  </button>
                )}
              </div>
              <p className="text-xs text-dark-textSecondary mt-1">
                Tanque salvo: {savedVolume} L. Precisa estar certo para a dose bater com o volume real.
              </p>
            </div>
            <div>
              <label className="block text-sm text-dark-textSecondary mb-1">{ph.relayPhUp}</label>
              <span title={phUpRelayControl.title || undefined}>
                <DoserRelaySelect
                  registry={relayRegistry}
                  context={{ field: 'ph_up', currentValue: relayPhUp }}
                  value={relayPhUp}
                  disabled={phUpRelayControl.disabled}
                  onChange={handleRelayPhUpChange}
                />
              </span>
            </div>
            <div>
              <label className="block text-sm text-dark-textSecondary mb-1">{ph.relayPhDown}</label>
              <span title={phDownRelayControl.title || undefined}>
                <DoserRelaySelect
                  registry={relayRegistry}
                  context={{ field: 'ph_down', currentValue: relayPhDown }}
                  value={relayPhDown}
                  disabled={phDownRelayControl.disabled}
                  onChange={handleRelayPhDownChange}
                />
              </span>
            </div>
            <div>
              <label className="block text-sm text-dark-textSecondary mb-1">{ph.recirculationSec}</label>
              <input
                type="number"
                min="1"
                value={tempoRecirculacao}
                disabled={disabled}
                onChange={(e) => setTempoRecirculacao(parseInt(e.target.value, 10) || 60)}
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text disabled:opacity-50"
              />
            </div>
          </div>

          <SectionHeader title={ph.cadence} accent="ph" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm text-dark-textSecondary mb-1">{ph.intervalSec}</label>
              <input
                type="number"
                min="60"
                value={intervaloAutoPh}
                disabled={disabled}
                onChange={(e) => setIntervaloAutoPh(parseInt(e.target.value, 10) || 300)}
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mb-4">
            <button
              disabled={disabled || !phConfigDirty}
              onClick={() => {
                if (!phConfigDirty) return;
                saveConfig();
              }}
              className={`px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg transition-all ${
                disabled || !phConfigDirty
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:from-green-600 hover:to-emerald-600 shadow-lg hover:shadow-green-500/50'
              }`}
              title={
                disabled
                  ? 'Controles bloqueados'
                  : phConfigDirty
                    ? 'Salvar parâmetros'
                    : 'Nada a salvar — já está gravado'
              }
            >
              {ph.saveParams}
            </button>
            <button
              disabled={disabled || autoTogglePending}
              onClick={() => void toggleAutoPh()}
              className={`px-4 py-2 rounded-lg text-white transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                autoEnabled
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600'
                  : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 hover:shadow-green-500/50'
              }`}
            >
              {autoTogglePending
                ? '…'
                : autoEnabled
                  ? ph.deactivate
                  : ph.activate}
              {autoRtStatus === 'SUBSCRIBED' && !autoTogglePending ? (
                <span className="ml-1.5 text-[10px] opacity-80">{ph.live}</span>
              ) : null}
            </button>
            <button
              disabled={disabled}
              onClick={() => setShowPhConfigPreview(true)}
              className={`px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-lg transition-all shadow-lg hover:shadow-purple-500/50 ${
                disabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title={disabled ? 'Controles bloqueados' : ph.debugPreviewTitle}
            >
              {ph.debugButton}
            </button>
          </div>
        </div>
      )}

      {showPhConfigPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-dark-border">
              <h2 className="text-xl font-bold text-dark-text">
                {ph.debugTitle}
              </h2>
              <button
                type="button"
                onClick={() => setShowPhConfigPreview(false)}
                className="p-2 hover:bg-dark-surface rounded-lg transition-colors text-dark-textSecondary hover:text-dark-text"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
                <pre className="text-xs text-dark-textSecondary font-mono whitespace-pre-wrap break-words overflow-x-auto">
                  {JSON.stringify(phConfigJson, null, 2)}
                </pre>
              </div>

              <div className="mt-4 p-4 bg-violet-500/10 border border-violet-500/30 rounded-lg">
                <p className="text-xs text-violet-300 mb-2">
                  {ph.debugIntro}
                </p>
                <div className="mt-3 space-y-1 text-xs text-dark-textSecondary">
                  {ph.debugLegend.split('\n').map((line) => {
                    const idx = line.indexOf(':');
                    if (idx < 0) return <p key={line}>{line}</p>;
                    const key = line.slice(0, idx);
                    const rest = line.slice(idx + 1);
                    return (
                      <p key={key} className={key === '_debug' ? 'mt-2 text-violet-300' : undefined}>
                        <strong className="text-violet-300">{key}:</strong>
                        {rest}
                      </p>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-6 border-t border-dark-border">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(phConfigJson, null, 2));
                  toast.success(t.automacao.common.toastJsonCopied);
                }}
                className="px-4 py-2 bg-dark-surface hover:bg-dark-border text-dark-text border border-dark-border rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <ClipboardIcon className="w-4 h-4" />
                {t.automacao.common.copyJson}
              </button>
              <button
                type="button"
                onClick={() => setShowPhConfigPreview(false)}
                className="px-4 py-2 bg-dark-surface hover:bg-dark-border text-dark-text border border-dark-border rounded-lg text-sm font-medium transition-colors"
              >
                {t.automacao.common.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
