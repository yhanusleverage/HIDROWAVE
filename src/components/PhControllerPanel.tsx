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
  capFirmwarePreviewDose,
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
import { InstrumentCard } from '@/components/ui/InstrumentCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { MetricRow } from '@/components/ui/MetricRow';
import { HW_TEXT } from '@/lib/design-tokens';
import ControllerMetricsPanel from '@/components/ControllerMetricsPanel';

export interface RelayAllocationBridge {
  buildRegistry: (
    overrides?: Parameters<typeof buildRegistryFromConfigs>[0]
  ) => RelayAllocationRegistry;
  pendingCommands?: PendingCommandSlice[];
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
  const [expanded, setExpanded] = useState(true);
  const [equationHExpanded, setEquationHExpanded] = useState(false);
  const [showPhConfigPreview, setShowPhConfigPreview] = useState(false);
  const [locked, setLocked] = useState(() => process.env.NODE_ENV !== 'development');
  const justSavedRef = useRef(false);

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
  const [lastDosageMl, setLastDosageMl] = useState<number | null>(null);
  const [lastDosageAt, setLastDosageAt] = useState<string | null>(null);
  const [savedVolume, setSavedVolume] = useState(100);
  const [ecVolumeLiters, setEcVolumeLiters] = useState<number | null>(null);
  const [savingVolume, setSavingVolume] = useState(false);
  const [phConfigRaw, setPhConfigRaw] = useState<Record<string, unknown>>({});

  const [aggressiveness, setAggressiveness] = useState(0.5);
  const [maxDoseMlPerCycle, setMaxDoseMlPerCycle] = useState(50);
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
        const ecFlow = Number(ecData.flow_rate);
        if (Number.isFinite(ecFlow) && ecFlow > 0) {
          setFlowRatePhUp(ecFlow);
          setFlowRatePhDown(ecFlow);
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
      const maxDose = Number(data.max_dose_ml_per_cycle);
      setMaxDoseMlPerCycle(Number.isFinite(maxDose) && maxDose > 0 ? maxDose : 50);
      setKAcid(data.k_acid != null ? Number(data.k_acid) : null);
      setKBase(data.k_base != null ? Number(data.k_base) : null);
    } catch (err) {
      console.error('[PH Controller] load error', err);
    }
  }, [deviceId]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

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
      hwToast.error(phRelayCheck.error || 'Conflito de relés pH/EC', 'AUTO PH');
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
        }),
      });
      if (!res.ok) {
        const parsed = await parseConfigApiError(res);
        throw new Error(parsed.message);
      }
      justSavedRef.current = true;
      setTimeout(() => { justSavedRef.current = false; }, 2000);
      if (!silent) hwToast.success('Parâmetros pH salvos', 'AUTO PH');
      return true;
    } catch (err) {
      hwToast.error(err instanceof Error ? err.message : 'Erro ao salvar pH', 'AUTO PH');
      return false;
    }
  }, [
    deviceId, phSetpoint, phTolerance, flowRatePhUp, flowRatePhDown, volume,
    mlPerPhUnitAcid, mlPerPhUnitBase, relayPhUp, relayPhDown, intervaloAutoPh,
    tempoRecirculacao, autoEnabled, aggressiveness, ecNutrientsForRelayCheck,
  ]);

  const saveVolumeOnly = useCallback(async () => {
    if (!deviceId || !Number.isFinite(volume) || volume <= 0) {
      hwToast.error('Informe um volume válido (L > 0)', 'AUTO PH');
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
  }, [deviceId, volume, phConfigRaw, loadConfig]);

  const toggleAutoPh = async () => {
    if (!deviceId) return;
    if (!autoEnabled) {
      const saved = await saveConfig(true);
      if (!saved) return;
      const { error } = await supabase.rpc('activate_auto_ph', { p_device_id: deviceId });
      if (error) {
        hwToast.error(`Erro ao ativar Auto pH: ${error.message}`, 'AUTO PH');
        return;
      }
      setAutoEnabled(true);
      hwToast.success('Auto pH ativado', 'AUTO PH');
    } else {
      const { error } = await supabase
        .from('ph_config_view')
        .update({ auto_enabled: false, updated_at: new Date().toISOString() })
        .eq('device_id', deviceId);
      if (error) {
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
      setAutoEnabled(false);
      hwToast.info('Auto pH desativado', 'AUTO PH');
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
    if (Math.abs(displayPh - phSetpoint) <= phTolerance) return 'Neutro';
    return displayPh < phSetpoint ? 'pH+ (base)' : 'pH− (ácido)';
  }, [displayPh, phSetpoint, phTolerance]);

  const phWithinTolerance = useMemo(() => {
    if (displayPh === null) return null;
    return Math.abs(displayPh - phSetpoint) <= phTolerance;
  }, [displayPh, phSetpoint, phTolerance]);

  const calibBaseLine = formatPhCalibrationLine(
    'pH+ (base)',
    mlPerPhUnitBase,
    volume,
    flowRatePhUp
  );
  const calibAcidLine = formatPhCalibrationLine(
    'pH− (ácido)',
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

  const previewFirmwareMl = useMemo(
    () => capFirmwarePreviewDose(previewFirmwareUncappedMl, maxDoseMlPerCycle),
    [previewFirmwareUncappedMl, maxDoseMlPerCycle]
  );

  const firmwareDoseCapped = useMemo(
    () =>
      previewFirmwareUncappedMl != null &&
      previewFirmwareMl != null &&
      previewFirmwareUncappedMl > previewFirmwareMl + 0.01,
    [previewFirmwareUncappedMl, previewFirmwareMl]
  );

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
              <span className="truncate">Controle Automático de pH</span>
            </h3>
          </div>
          <OperationStateBadges
            variant="header"
            autoEnabled={autoEnabled}
            autoActiveLabel="Auto pH ativo"
            autoInactiveLabel="Auto pH inativo"
            isDosando={phOp.isDosando}
            dosandoLabel={
              phOp.isDosando && phOp.operationRemainingSec > 0
                ? `Dosando pH (${phOp.operationRemainingSec}s)`
                : 'Dosando pH'
            }
            isAguardandoRecirculacao={phOp.isAguardandoRecirculacao}
            operationRemainingSec={phOp.operationRemainingSec}
            showNextCheck={showNextCheck}
            nextCheckInSec={phOp.nextCheckInSec}
            nextCheckLabel="Próxima verificação pH"
            accent="violet"
          />
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            showLockUnlockToast(locked, 'Controles pH', () => setLocked((p) => !p));
          }}
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
            Calibre ácido e base em{' '}
            <NavLink href="/calibragem" className="text-violet-400 hover:underline">/calibragem</NavLink>
            ; aqui regula setpoint, tolerância e agressividade A.
          </p>

          {pvDebugNote != null && (
            <p className="text-xs text-dark-textSecondary mb-4 rounded-md border border-dark-border bg-dark-surface/50 px-3 py-2 font-mono tabular-nums">
              PV bruto (debug): {pvDebugNote}
            </p>
          )}

          {displayPh === null && stalePhFromDosage != null && (
            <p className="text-xs text-dark-textSecondary mb-4 rounded-md border border-dark-border bg-dark-surface px-3 py-2">
              Última leitura (dosagem):{' '}
              <span className="font-medium text-dark-text tabular-nums">
                pH {formatSensorValue(stalePhFromDosage, 2)}
              </span>
              <span className="ml-2 text-amber-400/90">(desatualizada)</span>
            </p>
          )}

          <SectionHeader title="Objetivo" accent="ph" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm text-dark-textSecondary mb-1">Setpoint pH</label>
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
              <label className="block text-sm text-dark-textSecondary mb-1">Tolerância (±)</label>
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
                Agressividade A ({aggressiveness.toFixed(2)})
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
          </div>

          <SectionHeader title="Actuação" accent="ph" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm text-dark-textSecondary mb-1">Relé pH+</label>
              <span title={phUpRelayControl.title || undefined}>
                <DoserRelaySelect
                  registry={relayRegistry}
                  context={{ field: 'ph_up', currentValue: relayPhUp }}
                  value={relayPhUp}
                  disabled={phUpRelayControl.disabled}
                  onChange={setRelayPhUp}
                />
              </span>
            </div>
            <div>
              <label className="block text-sm text-dark-textSecondary mb-1">Relé pH−</label>
              <span title={phDownRelayControl.title || undefined}>
                <DoserRelaySelect
                  registry={relayRegistry}
                  context={{ field: 'ph_down', currentValue: relayPhDown }}
                  value={relayPhDown}
                  disabled={phDownRelayControl.disabled}
                  onChange={setRelayPhDown}
                />
              </span>
            </div>
            <div>
              <label className="block text-sm text-dark-textSecondary mb-1">Recirculação (s)</label>
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

          <SectionHeader title="Cadência" accent="ph" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm text-dark-textSecondary mb-1">Intervalo verificação (s)</label>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <InstrumentCard accent="ph" title="📊 Status do Controle" ariaLive="polite">
              <div className="space-y-2.5">
                <OperationStateBanners
                  autoEnabled={autoEnabled}
                  isDosando={phOp.isDosando}
                  dosandoLabel="Dosando pH"
                  isAguardandoRecirculacao={phOp.isAguardandoRecirculacao}
                  operationRemainingSec={phOp.operationRemainingSec}
                  showNextCheck={showNextCheck}
                  nextCheckInSec={phOp.nextCheckInSec}
                  nextCheckLabel="Próxima verificação pH"
                  formatCountdown={formatCountdown}
                />
                <MetricRow
                  label="Status:"
                  value={autoEnabled ? '✅ Ativado' : '❌ Desativado'}
                  variant={autoEnabled ? 'ok' : 'danger'}
                />
                <MetricRow
                  label="Setpoint:"
                  value={`pH ${formatSensorValue(phSetpoint, 1)}`}
                  variant="setpoint"
                />
                <MetricRow
                  label="Banda morta:"
                  value={`± ${formatSensorValue(phTolerance, 2)}`}
                />
                <MetricRow
                  label="Erro (|pH − SP|):"
                  value={phError !== null ? formatSensorValue(phError, 2) : '--'}
                  variant={phWithinTolerance === false ? 'alarm' : 'default'}
                />
                <MetricRow
                  label="Zona de controle:"
                  value={
                    phWithinTolerance === null
                      ? '--'
                      : phWithinTolerance
                        ? '✓ Sem dosagem (dentro da banda)'
                        : `⚡ Ajuste A (${phDirection})`
                  }
                  variant={
                    phWithinTolerance === true ? 'ok' : phWithinTolerance === false ? 'alarm' : 'default'
                  }
                />
                <MetricRow
                  label="Última dosagem registrada:"
                  value={
                    lastDosageMl != null
                      ? `${lastDosageMl.toFixed(2)} ml${
                          lastDosageAt
                            ? ` · ${new Date(lastDosageAt).toLocaleString('pt-BR')}`
                            : ''
                        }`
                      : '-- ml'
                  }
                  variant="preview"
                  hint="Histórico ph_dosages — não muda ao editar V"
                />
                <MetricRow
                  label="pH Atual:"
                  value={
                    displayPh !== null
                      ? Math.abs(displayPh) < 0.01 || Math.abs(displayPh) >= 1000
                        ? displayPh.toExponential(3)
                        : formatSensorValue(displayPh, 2)
                      : '--'
                  }
                  variant="live"
                />
                <MetricRow label="Direção:" value={phDirection} />
              </div>
              <PhDosageDetail
                deviceId={deviceId}
                enabled={autoEnabled}
                variant="footer"
                onLastMlChange={setLastDosageMl}
              />
            </InstrumentCard>

            <InstrumentCard accent="brand" title="🧮 Equação de Controle Proporcional" tinted>
              <div className="font-mono text-aqua-400 mb-2 text-lg break-words">
                {PH_OPERATOR_EQUATION_SYMBOL}
              </div>
              <div className="font-mono text-aqua-400/80 text-sm mb-3">
                {PH_PULSE_EQUATION_SYMBOL}
              </div>
              <p className="text-xs text-dark-textSecondary mb-3 leading-relaxed">
                Modelo inverso adaptativo em domínio pH. O operador ajusta apenas A; K é aprendido no
                detalhe H⁺ colapsável.
              </p>
              <div className="space-y-2.5 text-base">
                <div className="space-y-2 pb-2 border-b border-dark-border">
                  <label className="block text-sm text-dark-textSecondary">V (Volume, L)</label>
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
                      {savingVolume ? 'Salvando…' : 'Salvar volume'}
                    </button>
                    {ecVolumeLiters != null && ecVolumeLiters > 0 && ecVolumeLiters !== volume && (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => setVolume(ecVolumeLiters)}
                        className="px-3 py-1.5 text-xs rounded-lg text-dark-textSecondary border border-dark-border hover:bg-dark-surface disabled:opacity-50"
                      >
                        Usar volume EC ({ecVolumeLiters} L)
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-dark-textSecondary leading-relaxed">
                    Fonte: ph_config.volume (salvo {savedVolume} L). Alterar V atualiza s_L; u(t) estável se K
                    aprendido estiver correto.
                  </p>
                </div>
                <MetricRow
                  label="s_L (ml/L / unid pH):"
                  value={activeSL != null && activeSL > 0 ? activeSL.toFixed(3) : '--'}
                  hint={
                    activeKResult != null
                      ? activeKResult.source === 'learned'
                        ? 'via k aprendido'
                        : 'calibragem (seed)'
                      : undefined
                  }
                />
                <MetricRow label="q (Taxa de vazão):" value={`${activeFlowRate.toFixed(3)} ml/s`} />
                <MetricRow
                  label="e (|pH − SP|):"
                  value={phError !== null ? formatSensorValue(phError, 2) : '--'}
                  variant={phWithinTolerance === false ? 'alarm' : 'default'}
                />
                <MetricRow label="A (Agressividade):" value={aggressiveness.toFixed(2)} />
                <MetricRow
                  label="Próxima dose estimada (preview):"
                  value={
                    previewDoseMl != null ? `${previewDoseMl.toFixed(2)} ml` : '-- ml'
                  }
                  variant="preview"
                  className="border-t border-dark-border pt-2"
                  hint="Live u(t) = A × |e| × activeS — independente do histórico"
                />
                <MetricRow
                  label="τ estimado (preview):"
                  value={
                    previewPulseSec != null ? `${previewPulseSec.toFixed(2)} s` : '-- s'
                  }
                />
              </div>

              <button
                type="button"
                onClick={() => setEquationHExpanded((v) => !v)}
                className={`mt-4 w-full flex items-center justify-between text-sm hover:opacity-90 border-t border-dark-border pt-3 ${HW_TEXT.ph}`}
              >
                <span>Domínio interno (H⁺)</span>
                {equationHExpanded ? (
                  <ChevronUpIcon className="w-4 h-4" />
                ) : (
                  <ChevronDownIcon className="w-4 h-4" />
                )}
              </button>

              {equationHExpanded && (
                <div className="mt-3 space-y-2.5 text-base border border-dark-border rounded-lg p-3 bg-dark-card/50">
                  <div className="font-mono text-aqua-400 text-sm">{PH_FIRMWARE_EQUATION_SYMBOL}</div>
                  <p className="text-xs text-dark-textSecondary leading-relaxed">
                    Domínio firmware (AdaptivePHController). Pode divergir do preview pH em erros grandes.
                    Valores acima do teto são limitados pelo ESP32 antes de dosar.
                  </p>
                  <div className="flex justify-between border-t border-dark-border pt-2">
                    <span className="text-dark-textSecondary">ErroH (erro H⁺):</span>
                    <span className="text-dark-text font-medium font-mono tabular-nums">
                      {errorHAbs != null ? errorHAbs.toExponential(3) : '--'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-dark-textSecondary">K (ganho H⁺):</span>
                    <span className="text-dark-text font-medium font-mono tabular-nums">
                      {activeKResult != null ? activeKResult.k.toExponential(3) : '--'}
                      {activeKResult?.source === 'learned' && (
                        <span className="ml-2 text-xs text-violet-400/90 font-sans">(aprendido)</span>
                      )}
                      {activeKResult?.source === 'seed' && (
                        <span className="ml-2 text-xs text-dark-textSecondary font-sans">(seed)</span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-dark-textSecondary">Dose firmware (teto):</span>
                    <span className="text-dark-text font-medium tabular-nums">
                      {previewFirmwareMl != null
                        ? `${previewFirmwareMl.toFixed(2)} ml`
                        : '-- ml'}
                      <span className="ml-1 text-xs text-dark-textSecondary font-sans">
                        (max {maxDoseMlPerCycle} ml/ciclo)
                      </span>
                    </span>
                  </div>
                  {firmwareDoseCapped && previewFirmwareUncappedMl != null && (
                    <div className="flex justify-between text-xs">
                      <span className="text-dark-textSecondary">Sem teto (só fórmula):</span>
                      <span className="text-amber-400/90 font-mono tabular-nums">
                        {previewFirmwareUncappedMl.toFixed(2)} ml
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div className="mt-4 pt-3 border-t border-dark-border space-y-2 text-xs text-dark-textSecondary">
                <p className="leading-relaxed">{calibBaseLine}</p>
                <p className="leading-relaxed">{calibAcidLine}</p>
                <NavLink href="/calibragem" className={`${HW_TEXT.ph} hover:underline inline-block`}>
                  Editar calibragem →
                </NavLink>
              </div>
            </InstrumentCard>
          </div>

          {deviceId ? (
            <div className="mb-6">
              <ControllerMetricsPanel deviceId={deviceId} focus="ph" hideTabs />
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3 mb-4">
            <button
              disabled={disabled}
              onClick={() => saveConfig()}
              className={`px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-lg transition-all shadow-lg hover:shadow-green-500/50 ${
                disabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              💾 Salvar Parâmetros
            </button>
            <button
              disabled={disabled}
              onClick={toggleAutoPh}
              className={`px-4 py-2 rounded-lg text-white transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                autoEnabled
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600'
                  : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 hover:shadow-green-500/50'
              }`}
            >
              {autoEnabled ? '⏹️ Desativar Auto pH' : '🤖 Ativar Auto pH'}
            </button>
            <button
              disabled={disabled}
              onClick={() => setShowPhConfigPreview(true)}
              className={`px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-lg transition-all shadow-lg hover:shadow-purple-500/50 ${
                disabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title={disabled ? 'Controles bloqueados' : 'Ver preview da configuração pH'}
            >
              🔍 Debug Vista Previa
            </button>
            <button
              disabled={disabled}
              onClick={async () => {
                setAutoEnabled(false);
                await supabase.from('ph_config_view').update({ auto_enabled: false }).eq('device_id', deviceId);
                await supabase.from('relay_master').update({
                  ph_operation_state: 'idle',
                  ph_operation_remaining_sec: 0,
                  ph_next_check_in_sec: 0,
                }).eq('device_id', deviceId);
                hwToast.warning('Reset emergencial pH executado', 'AUTO PH');
              }}
              className={`px-4 py-2 bg-red-800 hover:bg-red-900 text-white rounded-lg transition-all ${
                disabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              🚨 RESET EMERGENCIAL
            </button>
          </div>
        </div>
      )}

      {showPhConfigPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-dark-border">
              <h2 className="text-xl font-bold text-dark-text">
                🔍 Debug Vista Previa - pH Controller Config
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
                  💡 JSON enviado/salvo em ph_config_view + preview de estado MQTT (_debug)
                </p>
                <div className="mt-3 space-y-1 text-xs text-dark-textSecondary">
                  <p><strong className="text-violet-300">ph_setpoint / ph_tolerance:</strong> SP e banda morta (domínio pH)</p>
                  <p><strong className="text-violet-300">s (ml/unid pH):</strong> Sensibilidade da calibragem; u = A × |e| × s</p>
                  <p><strong className="text-violet-300">intervalo_auto_ph:</strong> Intervalo entre verificações (s)</p>
                  <p><strong className="text-violet-300">aggressiveness:</strong> A na equação u(t) = A × |e_H| / k</p>
                  <p className="mt-2 text-violet-300"><strong>_debug:</strong> PV, erro, u(t) previsto, ph_operation_* em tempo real</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-6 border-t border-dark-border">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(phConfigJson, null, 2));
                  toast.success('JSON copiado para a área de transferência!');
                }}
                className="px-4 py-2 bg-dark-surface hover:bg-dark-border text-dark-text border border-dark-border rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <ClipboardIcon className="w-4 h-4" />
                Copiar JSON
              </button>
              <button
                type="button"
                onClick={() => setShowPhConfigPreview(false)}
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
