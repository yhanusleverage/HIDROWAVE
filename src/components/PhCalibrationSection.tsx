'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  calculateFlowRateMlPerSecond,
  formatFlowRate,
  CALIBRATION_TEST_DURATIONS_SEC,
} from '@/lib/pump-calibration';
import {
  mlPerPhUnitFromDose,
  withVolume,
  formatMlPerPhUnit,
  formatMlPerLiterPerPhUnit,
} from '@/lib/ph-calibration';

interface RelayOption {
  number: number;
  name: string;
}

interface PhCalibrationSectionProps {
  deviceId: string;
  relayOptions: RelayOption[];
}

type PumpSide = 'base' | 'acid';

function PumpCalibrationCard({
  side,
  title,
  relayNumber,
  relayName,
  volumeLiters,
  flowRate,
  onFlowRateChange,
  mlPerPhUnitStored,
  onSave,
  saving,
}: {
  side: PumpSide;
  title: string;
  relayNumber: number;
  relayName: string;
  volumeLiters: number;
  flowRate: number;
  onFlowRateChange: (v: number) => void;
  mlPerPhUnitStored: number | null;
  onSave: (mlPerPhUnit: number, flow: number) => Promise<void>;
  saving: boolean;
}) {
  const [phBefore, setPhBefore] = useState(6.0);
  const [phAfter, setPhAfter] = useState(side === 'base' ? 6.2 : 5.8);
  const [mlDosed, setMlDosed] = useState(1.0);
  const [measuredVolumeMl, setMeasuredVolumeMl] = useState(10);
  const [measuredDurationSec, setMeasuredDurationSec] = useState(60);

  const chemical = useMemo(() => {
    const raw = mlPerPhUnitFromDose(mlDosed, phBefore, phAfter);
    if (!raw) return null;
    return withVolume(raw, volumeLiters);
  }, [mlDosed, phBefore, phAfter, volumeLiters]);

  const calculatedFlow = calculateFlowRateMlPerSecond(measuredVolumeMl, measuredDurationSec);

  const applyFlow = () => {
    if (calculatedFlow == null) {
      toast.error('Volume e tempo inválidos');
      return;
    }
    onFlowRateChange(Math.round(calculatedFlow * 1000) / 1000);
    toast.success(`Vazão: ${formatFlowRate(calculatedFlow)}`);
  };

  const handleSave = async () => {
    if (!chemical) {
      toast.error('Informe pH antes/depois e ml com ΔpH ≥ 0.05');
      return;
    }
    if (flowRate <= 0) {
      toast.error('Calibre a vazão (ml/s) antes de salvar');
      return;
    }
    await onSave(chemical.mlPerPhUnit, flowRate);
  };

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-5 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-dark-text">{title}</h3>
        <p className="text-xs text-dark-textSecondary mt-1">
          Relé {relayNumber}: {relayName}
        </p>
        {mlPerPhUnitStored != null && mlPerPhUnitStored > 0 && (
          <p className="text-xs text-violet-400 mt-1">
            Guardado: {formatMlPerPhUnit(mlPerPhUnitStored)} ml/unid pH
          </p>
        )}
      </div>

      <ol className="text-xs text-dark-textSecondary list-decimal list-inside space-y-1">
        <li>Prime da mangueira e recircule o tanque</li>
        <li>Meça pH antes, dose ml de teste, recircule e meça pH depois</li>
        <li>Calibre vazão (ml/s) com proveta cronometrada</li>
        <li>Salve — valores usados no Auto pH</li>
      </ol>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-dark-textSecondary mb-1">pH antes</label>
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
          <label className="block text-xs text-dark-textSecondary mb-1">pH depois</label>
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
          <label className="block text-xs text-dark-textSecondary mb-1">ml dosados</label>
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
        <p className="text-xs text-dark-textSecondary uppercase tracking-wide mb-1">Resultado químico</p>
        {chemical ? (
          <>
            <p className="text-aqua-400 font-semibold">
              {formatMlPerPhUnit(chemical.mlPerPhUnit)} ml/unid pH
            </p>
            <p className="text-dark-textSecondary text-xs mt-1">
              {formatMlPerLiterPerPhUnit(chemical.mlPerLiterPerPhUnit)} ml/L/unid pH
              {' '}(tanque {volumeLiters} L)
            </p>
            <p className="text-xs text-dark-textSecondary mt-1">
              ΔpH = {chemical.deltaPh.toFixed(2)}
            </p>
          </>
        ) : (
          <p className="text-amber-400 text-xs">ΔpH inválido — use medições distintas (mín. 0.05)</p>
        )}
      </div>

      <div className="border-t border-dark-border pt-4">
        <p className="text-sm font-medium text-dark-text mb-2">Vazão desta bomba (ml/s)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-dark-textSecondary mb-1">Volume medido (ml)</label>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={measuredVolumeMl}
              onChange={(e) => setMeasuredVolumeMl(parseFloat(e.target.value) || 0)}
              className="w-full p-2 bg-dark-surface border border-dark-border rounded-md text-sm text-dark-text"
            />
          </div>
          <div>
            <label className="block text-xs text-dark-textSecondary mb-1">Tempo (s)</label>
            <input
              type="number"
              min={1}
              value={measuredDurationSec}
              onChange={(e) => setMeasuredDurationSec(parseInt(e.target.value, 10) || 60)}
              className="w-full p-2 bg-dark-surface border border-dark-border rounded-md text-sm text-dark-text"
            />
            <div className="flex flex-wrap gap-1 mt-1">
              {CALIBRATION_TEST_DURATIONS_SEC.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setMeasuredDurationSec(sec)}
                  className="text-xs px-2 py-0.5 rounded border border-dark-border text-dark-textSecondary hover:border-aqua-500/50"
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <span className="text-aqua-400 font-mono text-sm">
            {calculatedFlow != null ? formatFlowRate(calculatedFlow) : '—'}
          </span>
          <button
            type="button"
            onClick={applyFlow}
            className="text-xs px-3 py-1.5 border border-aqua-500/40 text-aqua-400 rounded-lg hover:bg-aqua-500/10"
          >
            Usar vazão calculada
          </button>
        </div>
        <div>
          <label className="block text-xs text-dark-textSecondary mb-1">Vazão final (ml/s)</label>
          <input
            type="number"
            min={0.001}
            step={0.0001}
            value={flowRate}
            onChange={(e) => onFlowRateChange(parseFloat(e.target.value) || 0)}
            className="w-full p-2 bg-dark-surface border border-dark-border rounded-md text-sm font-mono text-dark-text"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !chemical}
        className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {saving ? 'Salvando…' : `Salvar calibragem ${side === 'base' ? 'pH+' : 'pH−'}`}
      </button>
    </div>
  );
}

export function PhCalibrationSection({ deviceId, relayOptions }: PhCalibrationSectionProps) {
  const [loading, setLoading] = useState(true);
  const [savingSide, setSavingSide] = useState<PumpSide | null>(null);
  const [volumeLiters, setVolumeLiters] = useState(100);
  const [relayPhUp, setRelayPhUp] = useState(1);
  const [relayPhDown, setRelayPhDown] = useState(0);
  const [flowRatePhUp, setFlowRatePhUp] = useState(1.0);
  const [flowRatePhDown, setFlowRatePhDown] = useState(1.0);
  const [mlPerPhUnitBase, setMlPerPhUnitBase] = useState<number | null>(2.0);
  const [mlPerPhUnitAcid, setMlPerPhUnitAcid] = useState<number | null>(2.0);
  const [phConfigRaw, setPhConfigRaw] = useState<Record<string, unknown>>({});

  const loadAll = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    try {
      const [phRes, ecRes] = await Promise.all([
        fetch(`/api/ph-controller/config?device_id=${encodeURIComponent(deviceId)}`),
        fetch(`/api/ec-controller/config?device_id=${encodeURIComponent(deviceId)}`),
      ]);
      let vol = 100;
      if (ecRes.ok) {
        const ec = await ecRes.json();
        if (Number(ec.volume) > 0) vol = Number(ec.volume);
      }
      if (phRes.ok) {
        const ph = await phRes.json();
        setPhConfigRaw(ph);
        setVolumeLiters(Number(ph.volume) > 0 ? Number(ph.volume) : vol);
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
      } else {
        setVolumeLiters(vol);
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao carregar config pH');
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const relayUpName =
    relayOptions.find((r) => r.number === relayPhUp)?.name ?? `Relé ${relayPhUp}`;
  const relayDownName =
    relayOptions.find((r) => r.number === relayPhDown)?.name ?? `Relé ${relayPhDown}`;

  const savePump = async (side: PumpSide, mlPerPhUnit: number, flow: number) => {
    if (!deviceId) return;
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
        throw new Error(err.error || 'Erro ao salvar');
      }
      if (side === 'base') {
        setMlPerPhUnitBase(mlPerPhUnit);
        setFlowRatePhUp(flow);
      } else {
        setMlPerPhUnitAcid(mlPerPhUnit);
        setFlowRatePhDown(flow);
      }
      toast.success(`Calibragem ${side === 'base' ? 'pH+' : 'pH−'} salva`);
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSavingSide(null);
    }
  };

  if (loading) {
    return <p className="text-dark-textSecondary text-sm">Carregando calibragem pH…</p>;
  }

  return (
    <div className="space-y-6">
      <section className="bg-gradient-to-br from-violet-500/10 to-primary-500/10 border border-violet-500/30 rounded-xl p-5 text-sm text-dark-textSecondary">
        <p>
          Calibre <strong className="text-dark-text">cada bomba separadamente</strong> em escala pH:
          pH antes/depois + ml dosados. O sistema calcula ml/unid pH e ml/L/unid pH (volume{' '}
          <strong className="text-dark-text">{volumeLiters} L</strong> do EC).
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PumpCalibrationCard
          side="base"
          title="Bomba pH+ (base)"
          relayNumber={relayPhUp}
          relayName={relayUpName}
          volumeLiters={volumeLiters}
          flowRate={flowRatePhUp}
          onFlowRateChange={setFlowRatePhUp}
          mlPerPhUnitStored={mlPerPhUnitBase}
          onSave={(ml, flow) => savePump('base', ml, flow)}
          saving={savingSide === 'base'}
        />
        <PumpCalibrationCard
          side="acid"
          title="Bomba pH− (ácido)"
          relayNumber={relayPhDown}
          relayName={relayDownName}
          volumeLiters={volumeLiters}
          flowRate={flowRatePhDown}
          onFlowRateChange={setFlowRatePhDown}
          mlPerPhUnitStored={mlPerPhUnitAcid}
          onSave={(ml, flow) => savePump('acid', ml, flow)}
          saving={savingSide === 'acid'}
        />
      </div>
    </div>
  );
}
