'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { hwToast } from '@/lib/control-toast';
import {
  mlPerPhUnitFromDose,
  withVolume,
  formatMlPerPhUnit,
  formatMlPerLiterPerPhUnit,
  mlPerLiterPerPhUnit,
} from '@/lib/ph-calibration';
import { InstrumentCard } from '@/components/ui/InstrumentCard';
import { HW_TEXT, HW_BG_SUBTLE } from '@/lib/design-tokens';
import { fetchEcControllerMetrics } from '@/lib/controller-metrics';
import {
  calculateDoseDurationSeconds,
  doseDurationSecondsForRelay,
  formatDoseDurationSeconds,
} from '@/lib/pump-calibration';
import { PlayIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '@/contexts/LanguageContext';

interface RelayOption {
  number: number;
  name: string;
}

interface PhCalibrationSectionProps {
  deviceId: string;
  relayOptions: RelayOption[];
  isOnline?: boolean;
  autoBlocked?: boolean;
}

type PumpSide = 'base' | 'acid';

function PumpCalibrationCard({
  side,
  title,
  relayNumber,
  relayName,
  volumeLiters,
  flowRate,
  mlPerPhUnitStored,
  onSave,
  saving,
  deviceId,
  isOnline,
  autoBlocked,
}: {
  side: PumpSide;
  title: string;
  relayNumber: number;
  relayName: string;
  volumeLiters: number;
  flowRate: number;
  mlPerPhUnitStored: number | null;
  onSave: (mlPerPhUnit: number, flow: number) => Promise<void>;
  saving: boolean;
  deviceId: string;
  isOnline: boolean;
  autoBlocked: boolean;
}) {
  const { t } = useLanguage();
  const g = t.calibragem.gains;
  const [phBefore, setPhBefore] = useState(6.0);
  const [phAfter, setPhAfter] = useState(side === 'base' ? 6.2 : 5.8);
  const [mlDosed, setMlDosed] = useState(1.0);
  const [testing, setTesting] = useState(false);

  const chemical = useMemo(() => {
    const raw = mlPerPhUnitFromDose(mlDosed, phBefore, phAfter);
    if (!raw) return null;
    return withVolume(raw, volumeLiters);
  }, [mlDosed, phBefore, phAfter, volumeLiters]);

  const handleSave = async () => {
    if (!chemical) {
      toast.error(g.toastNeedDelta);
      return;
    }
    await onSave(chemical.mlPerPhUnit, flowRate > 0 ? flowRate : 1);
  };

  const runMlTest = async () => {
    if (mlDosed <= 0) {
      toast.error(g.toastNeedMl);
      return;
    }
    if (!(flowRate > 0)) {
      toast.error(g.toastNeedFlow);
      return;
    }
    if (!isOnline) {
      toast.error(g.toastCoreOffline);
      return;
    }
    if (autoBlocked) {
      toast.error(g.toastDisableAuto);
      return;
    }
    const duration = calculateDoseDurationSeconds(mlDosed, flowRate);
    if (duration == null || duration <= 0) {
      toast.error(g.toastInvalidFlowMl);
      return;
    }
    const relaySeconds = doseDurationSecondsForRelay(duration);
    setTesting(true);
    try {
      const res = await fetch('/api/esp-now/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          master_device_id: deviceId,
          relay_number: relayNumber,
          action: 'on',
          duration_seconds: relaySeconds,
          mode: 'timed_on',
          created_by: 'calibragem_test',
          triggered_by: 'calibragem_test',
          command_type: 'manual',
          dosage_ml: mlDosed,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.error === 'string' ? err.error : g.toastTestFail);
      }
      toast.success(
        g.toastTestOk
          .replace('{ml}', String(mlDosed))
          .replace('{sec}', formatDoseDurationSeconds(duration))
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : g.toastTestError);
    } finally {
      setTesting(false);
    }
  };

  return (
    <InstrumentCard accent="ph" className="rounded-xl space-y-4">
      <div>
        <h3 className={`text-lg font-semibold ${HW_TEXT.ph}`}>{title}</h3>
        <p className="text-xs text-dark-textSecondary mt-1">
          {g.relayLine.replace('{n}', String(relayNumber)).replace('{name}', relayName)}
        </p>
        {mlPerPhUnitStored != null && mlPerPhUnitStored > 0 && (
          <p className="text-xs text-violet-400 mt-1">
            {g.storedGain.replace('{n}', formatMlPerPhUnit(mlPerPhUnitStored))}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-dark-textSecondary mb-1">{g.phBefore}</label>
          <input
            type="number"
            step="0.01"
            min="4"
            max="9"
            value={phBefore}
            onChange={(e) => setPhBefore(parseFloat(e.target.value) || 6)}
            className="w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-dark-textSecondary mb-1">{g.phAfter}</label>
          <input
            type="number"
            step="0.01"
            min="4"
            max="9"
            value={phAfter}
            onChange={(e) => setPhAfter(parseFloat(e.target.value) || 6)}
            className="w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-dark-textSecondary mb-1">{g.mlDosed}</label>
          <input
            type="number"
            step="0.1"
            min="0.1"
            value={mlDosed}
            onChange={(e) => setMlDosed(parseFloat(e.target.value) || 1)}
            className="w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text text-sm"
          />
        </div>
      </div>

      <div className="bg-dark-surface rounded-lg p-3 text-sm">
        <p className="text-xs text-dark-textSecondary uppercase tracking-wide mb-1">{g.chemResult}</p>
        {chemical ? (
          <>
            <p className="text-violet-400 font-semibold">
              {formatMlPerPhUnit(chemical.mlPerPhUnit)} ml/unid pH
            </p>
            <p className="text-dark-textSecondary text-xs mt-1">
              {formatMlPerLiterPerPhUnit(chemical.mlPerLiterPerPhUnit)} ml/L/unid pH{' '}
              {g.tankRef.replace('{n}', String(volumeLiters))}
            </p>
            <p className="text-xs text-dark-textSecondary mt-1">
              ΔpH = {chemical.deltaPh.toFixed(2)}
            </p>
          </>
        ) : (
          <p className="text-amber-400 text-xs">{g.deltaInvalid}</p>
        )}
      </div>

      <p className="text-xs text-dark-textSecondary">
        {g.howTo}{' '}
        {flowRate > 0
          ? g.flowCalibrated.replace('{n}', flowRate.toFixed(3))
          : g.flowNotCalibrated}
      </p>
      <button
        type="button"
        onClick={() => void runMlTest()}
        disabled={testing || !isOnline || autoBlocked || mlDosed <= 0 || !(flowRate > 0)}
        className="w-full py-2.5 rounded-lg text-sm font-medium border border-violet-500/50 bg-violet-500/15 text-violet-200 hover:bg-violet-500/25 disabled:opacity-40 flex items-center justify-center gap-2"
      >
        <PlayIcon className="w-4 h-4" />
        {testing ? g.sending : g.testMl.replace('{n}', String(mlDosed))}
      </button>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !chemical}
        className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {saving ? g.saving : side === 'base' ? g.saveGainBase : g.saveGainAcid}
      </button>
    </InstrumentCard>
  );
}

export function PhCalibrationSection({
  deviceId,
  relayOptions,
  isOnline = false,
  autoBlocked = false,
}: PhCalibrationSectionProps) {
  const { t } = useLanguage();
  const g = t.calibragem.gains;
  const [loading, setLoading] = useState(true);
  const [savingSide, setSavingSide] = useState<PumpSide | null>(null);
  const [savingVolume, setSavingVolume] = useState(false);
  const [volumeLiters, setVolumeLiters] = useState(100);
  const [savedVolumeLiters, setSavedVolumeLiters] = useState(100);
  const [relayPhUp, setRelayPhUp] = useState(1);
  const [relayPhDown, setRelayPhDown] = useState(0);
  const [flowRatePhUp, setFlowRatePhUp] = useState(1.0);
  const [flowRatePhDown, setFlowRatePhDown] = useState(1.0);
  const [mlPerPhUnitBase, setMlPerPhUnitBase] = useState<number | null>(2.0);
  const [mlPerPhUnitAcid, setMlPerPhUnitAcid] = useState<number | null>(2.0);
  const [kBase, setKBase] = useState<number | null>(null);
  const [kAcid, setKAcid] = useState<number | null>(null);
  const [ecFlowRate, setEcFlowRate] = useState<string | null>(null);
  const [ecBaseDose, setEcBaseDose] = useState<number | null>(null);
  const [ecTotalMl, setEcTotalMl] = useState<number | null>(null);
  const [ecKp, setEcKp] = useState<number | null>(null);
  const [ecAggressiveness, setEcAggressiveness] = useState<number | null>(null);
  const [ecKLive, setEcKLive] = useState<number | null>(null);
  const [phConfigRaw, setPhConfigRaw] = useState<Record<string, unknown>>({});
  const [ecVolumeLiters, setEcVolumeLiters] = useState<number | null>(null);

  const volumeDirty = volumeLiters !== savedVolumeLiters;

  const ecKRecipe =
    ecBaseDose != null && ecTotalMl != null && ecTotalMl > 0
      ? ecBaseDose / ecTotalMl
      : null;
  const ecKInUse = ecKLive;

  const loadAll = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    try {
      const [phRes, ecRes, ecMetrics] = await Promise.all([
        fetch(`/api/ph-controller/config?device_id=${encodeURIComponent(deviceId)}`),
        fetch(`/api/ec-controller/config?device_id=${encodeURIComponent(deviceId)}`),
        fetchEcControllerMetrics(deviceId, 24),
      ]);
      let ecVol: number | null = null;
      let vol = 100;
      if (ecRes.ok) {
        const ec = await ecRes.json();
        if (Number(ec.volume) > 0) {
          ecVol = Number(ec.volume);
          vol = ecVol;
        }
        if (Array.isArray(ec.nutrients)) {
          const parts = (ec.nutrients as Array<{ name?: string; flowRate?: number; flow_rate?: number }>)
            .map((n) => {
              const q = Number(n.flowRate ?? n.flow_rate);
              if (!(q > 0)) return null;
              const label = n.name?.trim() || 'bomba';
              return `${label} ${q.toFixed(3)}`;
            })
            .filter((s): s is string => Boolean(s));
          setEcFlowRate(parts.length > 0 ? parts.join(' · ') : null);
        } else {
          setEcFlowRate(null);
        }
        const base = Number(ec.base_dose);
        const total = Number(ec.total_ml);
        setEcBaseDose(Number.isFinite(base) && base > 0 ? base : null);
        setEcTotalMl(Number.isFinite(total) && total > 0 ? total : null);
        const kp = Number(ec.kp);
        setEcKp(Number.isFinite(kp) && kp > 0 ? kp : null);
        const a = Number(ec.aggressiveness);
        setEcAggressiveness(Number.isFinite(a) && a > 0 ? a : null);
        const kCfg = Number(ec.k_value);
        const lastMetricK = [...ecMetrics].reverse().find((r) => Number(r.k_value) > 0)?.k_value;
        const live =
          Number.isFinite(kCfg) && kCfg > 0
            ? kCfg
            : lastMetricK != null && Number(lastMetricK) > 0
              ? Number(lastMetricK)
              : null;
        setEcKLive(live);
      } else {
        setEcFlowRate(null);
        setEcBaseDose(null);
        setEcTotalMl(null);
        setEcKp(null);
        setEcAggressiveness(null);
        setEcKLive(null);
      }
      setEcVolumeLiters(ecVol);
      if (phRes.ok) {
        const ph = await phRes.json();
        setPhConfigRaw(ph);
        const loadedVol = Number(ph.volume) > 0 ? Number(ph.volume) : vol;
        setVolumeLiters(loadedVol);
        setSavedVolumeLiters(loadedVol);
        setRelayPhUp(Number(ph.relay_ph_up) ?? 1);
        setRelayPhDown(Number(ph.relay_ph_down) ?? 0);
        setFlowRatePhUp(Number(ph.flow_rate_ph_up) || 1);
        setFlowRatePhDown(Number(ph.flow_rate_ph_down) || 1);
        setMlPerPhUnitBase(
          ph.ml_per_ph_unit_base != null ? Number(ph.ml_per_ph_unit_base) : Number(ph.ml_per_ph_unit) || 2
        );
        setMlPerPhUnitAcid(
          ph.ml_per_ph_unit_acid != null ? Number(ph.ml_per_ph_unit_acid) : Number(ph.ml_per_ph_unit) || 2
        );
        setKBase(ph.k_base != null ? Number(ph.k_base) : null);
        setKAcid(ph.k_acid != null ? Number(ph.k_acid) : null);
      } else {
        setVolumeLiters(vol);
        setSavedVolumeLiters(vol);
      }
    } catch (e) {
      console.error(e);
      toast.error(g.toastLoadError);
    } finally {
      setLoading(false);
    }
  }, [deviceId, g.toastLoadError]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const relayUpName =
    relayOptions.find((r) => r.number === relayPhUp)?.name ?? `Relé ${relayPhUp}`;
  const relayDownName =
    relayOptions.find((r) => r.number === relayPhDown)?.name ?? `Relé ${relayPhDown}`;

  const saveVolumeLiters = async () => {
    if (!deviceId) return;
    if (!Number.isFinite(volumeLiters) || volumeLiters <= 0) {
      toast.error(g.toastVolumeInvalid);
      return;
    }
    setSavingVolume(true);
    try {
      const payload = {
        ...phConfigRaw,
        device_id: deviceId,
        volume: volumeLiters,
      };
      const res = await fetch('/api/ph-controller/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || g.toastVolumeSaveError);
      }
      setSavedVolumeLiters(volumeLiters);
      setPhConfigRaw((prev) => ({ ...prev, volume: volumeLiters }));
      hwToast.success(g.toastVolumeSaved.replace('{n}', String(volumeLiters)), 'CALIBRAGEM');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : g.toastVolumeSaveError);
    } finally {
      setSavingVolume(false);
    }
  };

  const savePump = async (side: PumpSide, mlPerPhUnit: number, flow: number) => {
    if (!deviceId) return;
    if (!Number.isFinite(volumeLiters) || volumeLiters <= 0) {
      toast.error(g.toastVolumeInvalid);
      return;
    }
    setSavingSide(side);
    try {
      const payload = {
        ...phConfigRaw,
        device_id: deviceId,
        volume: volumeLiters,
        flow_rate_ph_up: side === 'base' ? flow : flowRatePhUp,
        flow_rate_ph_down: side === 'acid' ? flow : flowRatePhDown,
        ml_per_ph_unit_base: side === 'base' ? mlPerPhUnit : (mlPerPhUnitBase ?? 2),
        ml_per_ph_unit_acid: side === 'acid' ? mlPerPhUnit : (mlPerPhUnitAcid ?? 2),
        reset_k_gains: true,
      };
      const res = await fetch('/api/ph-controller/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || g.toastSaveError);
      }
      if (side === 'base') {
        setMlPerPhUnitBase(mlPerPhUnit);
        setFlowRatePhUp(flow);
      } else {
        setMlPerPhUnitAcid(mlPerPhUnit);
        setFlowRatePhDown(flow);
      }
      setSavedVolumeLiters(volumeLiters);
      hwToast.success(
        g.toastGainSaved.replace('{side}', side === 'base' ? 'pH+' : 'pH−'),
        'CALIBRAGEM'
      );
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : g.toastSaveError);
    } finally {
      setSavingSide(null);
    }
  };

  if (loading) {
    return <p className="text-dark-textSecondary text-sm">{g.loading}</p>;
  }

  return (
    <div className="space-y-6">
      {/* Mapa de ganhos — EC (azul) vs pH (roxo) */}
      <section className={`rounded-xl border p-4 text-sm ${HW_BG_SUBTLE.ph}`}>
        <h3 className={`text-sm font-semibold mb-3 ${HW_TEXT.ph}`}>{g.mapTitle}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-dark-textSecondary border-b border-dark-border">
                <th className="text-left py-1.5 pr-3 font-medium">{g.colControl}</th>
                <th className="text-left py-1.5 pr-3 font-medium">{g.colParam}</th>
                <th className="text-left py-1.5 pr-3 font-medium">{g.colValue}</th>
                <th className="text-left py-1.5 font-medium">{g.colWhere}</th>
              </tr>
            </thead>
            <tbody className="text-dark-text">
              <tr className="border-b border-dark-border/60">
                <td className="py-2 pr-3 text-cyan-400 font-medium">Auto EC</td>
                <td className="py-2 pr-3">{g.paramPumpFlow}</td>
                <td className="py-2 pr-3 font-mono tabular-nums">
                  {ecFlowRate != null ? `${ecFlowRate} ml/s` : '—'}
                </td>
                <td className="py-2 text-dark-textSecondary">ec_config.nutrients[].flowRate</td>
              </tr>
              <tr className="border-b border-dark-border/60">
                <td className="py-2 pr-3 text-cyan-400 font-medium">Auto EC</td>
                <td className="py-2 pr-3">{g.paramTankVolume}</td>
                <td className="py-2 pr-3 font-mono tabular-nums">
                  {ecVolumeLiters != null ? `${ecVolumeLiters} L` : '—'}
                </td>
                <td className="py-2 text-dark-textSecondary">ec_config.volume</td>
              </tr>
              <tr className="border-b border-dark-border/60">
                <td className="py-2 pr-3 text-cyan-400 font-medium">Auto EC</td>
                <td className="py-2 pr-3">{g.paramKRecipe}</td>
                <td className="py-2 pr-3 font-mono tabular-nums">
                  {ecKRecipe != null ? (
                    <>
                      {ecKRecipe.toFixed(4)}
                      <span className="text-dark-textSecondary">
                        {' '}
                        &quot;{ecBaseDose}/{ecTotalMl}&quot;
                      </span>
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="py-2 text-dark-textSecondary">base_dose / total_ml</td>
              </tr>
              <tr className="border-b border-dark-border/60">
                <td className="py-2 pr-3 text-cyan-400 font-medium">Auto EC</td>
                <td className="py-2 pr-3">{g.paramKLive}</td>
                <td className="py-2 pr-3 font-mono tabular-nums">
                  {ecKInUse != null
                    ? `${ecKInUse.toFixed(4)} ${g.kAdaptiveSuffix}`
                    : '—'}
                </td>
                <td className="py-2 text-dark-textSecondary">ec_config.k_value (firmware)</td>
              </tr>
              <tr className="border-b border-dark-border/60">
                <td className="py-2 pr-3 text-cyan-400 font-medium">Auto EC</td>
                <td className="py-2 pr-3">{g.paramAKp}</td>
                <td className="py-2 pr-3 font-mono tabular-nums">
                  {ecAggressiveness != null ? ecAggressiveness.toFixed(2) : '—'} ·{' '}
                  {ecKp != null ? ecKp.toFixed(2) : '—'}
                </td>
                <td className="py-2 text-dark-textSecondary">aggressiveness · kp</td>
              </tr>
              <tr className="border-b border-dark-border/60">
                <td className="py-2 pr-3 text-violet-400 font-medium">Auto pH</td>
                <td className="py-2 pr-3">{g.paramCalVolume}</td>
                <td className="py-2 pr-3 font-mono tabular-nums">
                  {savedVolumeLiters > 0 ? `${savedVolumeLiters} L` : '—'}
                  {volumeDirty && (
                    <span className="text-amber-400 ml-1">
                      {g.unsavedVolume.replace('{n}', String(volumeLiters))}
                    </span>
                  )}
                </td>
                <td className="py-2 text-dark-textSecondary">ph_config.volume</td>
              </tr>
              <tr className="border-b border-dark-border/60">
                <td className="py-2 pr-3 text-violet-400 font-medium">pH+ (base)</td>
                <td className="py-2 pr-3">{g.paramMlPerUnit}</td>
                <td className="py-2 pr-3 font-mono tabular-nums">
                  {mlPerPhUnitBase != null
                    ? `${formatMlPerPhUnit(mlPerPhUnitBase)} · ${formatMlPerLiterPerPhUnit(
                        mlPerLiterPerPhUnit(mlPerPhUnitBase, savedVolumeLiters)
                      )}`
                    : '—'}
                </td>
                <td className="py-2 text-dark-textSecondary">ml_per_ph_unit_base</td>
              </tr>
              <tr className="border-b border-dark-border/60">
                <td className="py-2 pr-3 text-violet-400 font-medium">pH+ (base)</td>
                <td className="py-2 pr-3">{g.paramPumpFlowPh}</td>
                <td className="py-2 pr-3 font-mono tabular-nums">{flowRatePhUp.toFixed(3)} ml/s</td>
                <td className="py-2 text-dark-textSecondary">flow_rate_ph_up</td>
              </tr>
              <tr className="border-b border-dark-border/60">
                <td className="py-2 pr-3 text-violet-400 font-medium">pH− (ácido)</td>
                <td className="py-2 pr-3">{g.paramMlPerUnit}</td>
                <td className="py-2 pr-3 font-mono tabular-nums">
                  {mlPerPhUnitAcid != null
                    ? `${formatMlPerPhUnit(mlPerPhUnitAcid)} · ${formatMlPerLiterPerPhUnit(
                        mlPerLiterPerPhUnit(mlPerPhUnitAcid, savedVolumeLiters)
                      )}`
                    : '—'}
                </td>
                <td className="py-2 text-dark-textSecondary">ml_per_ph_unit_acid</td>
              </tr>
              <tr className="border-b border-dark-border/60">
                <td className="py-2 pr-3 text-violet-400 font-medium">pH− (ácido)</td>
                <td className="py-2 pr-3">{g.paramPumpFlowPh}</td>
                <td className="py-2 pr-3 font-mono tabular-nums">{flowRatePhDown.toFixed(3)} ml/s</td>
                <td className="py-2 text-dark-textSecondary">flow_rate_ph_down</td>
              </tr>
              <tr>
                <td className="py-2 pr-3 text-violet-400 font-medium">{g.adaptive}</td>
                <td className="py-2 pr-3">{g.paramKAdaptive}</td>
                <td className="py-2 pr-3 font-mono tabular-nums">
                  {kBase != null ? kBase.toExponential(2) : '—'} ·{' '}
                  {kAcid != null ? kAcid.toExponential(2) : '—'}
                </td>
                <td className="py-2 text-dark-textSecondary">k_base · k_acid (firmware)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-gradient-to-br from-violet-500/10 to-violet-600/5 border border-violet-500/30 rounded-xl p-5 text-sm text-dark-textSecondary space-y-4">
        <p>{g.intro}</p>
        <div className="max-w-xs">
          <label
            htmlFor="ph-cal-volume-liters"
            className="block text-xs font-medium text-dark-textSecondary mb-1"
          >
            {g.tankVolume}
          </label>
          <input
            id="ph-cal-volume-liters"
            type="number"
            min={0.1}
            step={0.1}
            value={Number.isFinite(volumeLiters) ? volumeLiters : ''}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              setVolumeLiters(Number.isFinite(value) && value > 0 ? value : 0);
            }}
            className="w-full p-2 bg-dark-surface border border-violet-500/30 rounded-md text-dark-text text-sm font-mono focus:ring-2 focus:ring-violet-500/40"
          />
          <p className="text-xs text-dark-textSecondary mt-1">
            {g.tankHint.replace('{n}', String(volumeLiters || '—'))}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              onClick={saveVolumeLiters}
              disabled={savingVolume || !volumeDirty || volumeLiters <= 0}
              className="text-xs px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {savingVolume ? g.saving : g.saveVolume}
            </button>
            {ecVolumeLiters != null && ecVolumeLiters > 0 && ecVolumeLiters !== volumeLiters && (
              <button
                type="button"
                onClick={() => setVolumeLiters(ecVolumeLiters)}
                className="text-xs px-3 py-2 border border-violet-500/40 text-violet-400 rounded-lg hover:bg-violet-500/10"
              >
                {g.useEcVolume.replace('{n}', String(ecVolumeLiters))}
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PumpCalibrationCard
          side="base"
          title={g.titleBase}
          relayNumber={relayPhUp}
          relayName={relayUpName}
          volumeLiters={volumeLiters}
          flowRate={flowRatePhUp}
          mlPerPhUnitStored={mlPerPhUnitBase}
          onSave={(ml, flowRate) => savePump('base', ml, flowRate)}
          saving={savingSide === 'base'}
          deviceId={deviceId}
          isOnline={isOnline}
          autoBlocked={autoBlocked}
        />
        <PumpCalibrationCard
          side="acid"
          title={g.titleAcid}
          relayNumber={relayPhDown}
          relayName={relayDownName}
          volumeLiters={volumeLiters}
          flowRate={flowRatePhDown}
          mlPerPhUnitStored={mlPerPhUnitAcid}
          onSave={(ml, flowRate) => savePump('acid', ml, flowRate)}
          saving={savingSide === 'acid'}
          deviceId={deviceId}
          isOnline={isOnline}
          autoBlocked={autoBlocked}
        />
      </div>
    </div>
  );
}
