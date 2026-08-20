'use client';

import React, { useCallback, useEffect, useState } from 'react';
import NavLink from '@/components/NavLink';
import { toast } from 'react-hot-toast';
import { hwToast } from '@/lib/control-toast';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';
import {
  calculateFlowRateMlPerSecond,
  calculateDoseDurationSeconds,
  doseDurationSecondsForRelay,
  formatDoseDurationSeconds,
  formatFlowRate,
  formatFlowRateMlPerMin,
  CALIBRATION_TEST_DURATIONS_SEC,
  parseNutrientFlowRate,
  roundFlowRateMlPerSec,
  upsertPumpFlowRate,
  nutrientRelayNumber,
} from '@/lib/pump-calibration';
import { PumpPrimeHoldControl } from '@/components/PumpPrimeHoldControl';
import { HW_TEXT } from '@/lib/design-tokens';

type PumpKind = 'ec' | 'ph_up' | 'ph_down';

type AvailablePump = {
  kind: PumpKind;
  name: string;
  relay: number;
  flowRate?: number;
};

type EcNutrientRow = {
  name?: string;
  relay?: number;
  relayNumber?: number;
  mlPerLiter?: number;
  ml_per_liter?: number;
  active?: boolean;
  flowRate?: number;
};

function parseNutrientsJson(raw: unknown): EcNutrientRow[] {
  if (Array.isArray(raw)) return raw as EcNutrientRow[];
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as EcNutrientRow[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function nutrientMlPerLiter(n: EcNutrientRow): number {
  const v = Number(n.mlPerLiter ?? n.ml_per_liter);
  return Number.isFinite(v) ? v : 0;
}

function isAssignedNutrient(n: EcNutrientRow): boolean {
  if (n.active === false) return false;
  const relay = nutrientRelayNumber(n);
  if (relay == null || relay > 7) return false;
  const named = Boolean(n.name && String(n.name).trim());
  return named || nutrientMlPerLiter(n) >= 0.1;
}

async function saveEcPumpFlow(
  deviceId: string,
  relay: number,
  flowRate: number,
  name: string
) {
  const getRes = await fetch(
    `/api/ec-controller/config?device_id=${encodeURIComponent(deviceId)}`
  );
  const existing = getRes.ok ? await getRes.json() : {};
  const current: EcNutrientRow[] = Array.isArray(existing.nutrients)
    ? existing.nutrients
    : [];
  const next = upsertPumpFlowRate(current, relay, flowRate, name);
  const res = await fetch('/api/ec-controller/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      device_id: deviceId,
      flow_rate: existing.flow_rate,
      base_dose: existing.base_dose,
      volume: existing.volume,
      total_ml: existing.total_ml,
      kp: existing.kp,
      ec_setpoint: existing.ec_setpoint,
      auto_enabled: existing.auto_enabled,
      intervalo_auto_ec: existing.intervalo_auto_ec,
      tempo_recirculacao: existing.tempo_recirculacao,
      aggressiveness: existing.aggressiveness,
      consumo_24h: existing.consumo_24h,
      nutrients: next,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err.error === 'string' ? err.error : 'Erro ao salvar');
  }
}

async function savePhPumpFlow(
  deviceId: string,
  kind: 'ph_up' | 'ph_down',
  flowRate: number
) {
  const getRes = await fetch(
    `/api/ph-controller/config?device_id=${encodeURIComponent(deviceId)}`
  );
  const existing = getRes.ok ? await getRes.json() : {};
  const res = await fetch('/api/ph-controller/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...existing,
      device_id: deviceId,
      flow_rate_ph_up: kind === 'ph_up' ? flowRate : existing.flow_rate_ph_up,
      flow_rate_ph_down: kind === 'ph_down' ? flowRate : existing.flow_rate_ph_down,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err.error === 'string' ? err.error : 'Erro ao salvar');
  }
}

function PumpAccordionRow({
  deviceId,
  pump,
  globalFlowRate,
  isOnline,
  autoBlocked,
  open,
  onToggle,
  onSaved,
}: {
  deviceId: string;
  pump: AvailablePump;
  globalFlowRate: number;
  isOnline: boolean;
  autoBlocked: boolean;
  open: boolean;
  onToggle: () => void;
  onSaved: (relay: number, kind: PumpKind, flowRate: number) => void;
}) {
  const stored = pump.flowRate;
  const isPh = pump.kind !== 'ec';
  const accent = isPh ? 'ph' : 'ec';
  const [measuredVolumeMl, setMeasuredVolumeMl] = useState(10);
  const [measuredDurationSec, setMeasuredDurationSec] = useState(60);
  const [flowRate, setFlowRate] = useState(stored ?? (globalFlowRate > 0 ? globalFlowRate : 1));
  const [testVolumeMl, setTestVolumeMl] = useState(5);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setFlowRate(stored ?? (globalFlowRate > 0 ? globalFlowRate : 1));
  }, [stored, globalFlowRate, pump.relay, pump.kind]);

  const calculatedRate = calculateFlowRateMlPerSecond(measuredVolumeMl, measuredDurationSec);
  const usingFallback = stored == null;
  const titleColor = isPh ? HW_TEXT.ph : HW_TEXT.ec;
  const borderAccent = isPh ? 'border-l-violet-500' : 'border-l-emerald-500';

  const applyCalculated = () => {
    if (calculatedRate == null) {
      toast.error('Informe volume e tempo válidos');
      return;
    }
    setFlowRate(roundFlowRateMlPerSec(calculatedRate));
    toast.success(`Vazão: ${formatFlowRate(calculatedRate)}`);
  };

  const save = async () => {
    if (flowRate <= 0) {
      toast.error('Informe uma vazão válida');
      return;
    }
    setSaving(true);
    try {
      const q = roundFlowRateMlPerSec(flowRate);
      if (pump.kind === 'ec') {
        await saveEcPumpFlow(deviceId, pump.relay, q, pump.name);
      } else {
        await savePhPumpFlow(deviceId, pump.kind, q);
      }
      onSaved(pump.relay, pump.kind, q);
      hwToast.success(`${pump.name}: ${formatFlowRate(q)}`, 'CALIBRAGEM');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    if (flowRate <= 0) return;
    const duration = calculateDoseDurationSeconds(testVolumeMl, flowRate);
    if (duration == null || duration <= 0) {
      toast.error('Volume ou vazão inválidos para teste');
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
          relay_number: pump.relay,
          action: 'on',
          duration_seconds: relaySeconds,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.error === 'string' ? err.error : 'Falha ao enviar teste');
      }
      toast.success(`Teste: ~${testVolumeMl} ml por ${formatDoseDurationSeconds(duration)} s`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro no teste');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className={`rounded-xl border border-dark-border border-l-4 ${borderAccent} overflow-hidden bg-dark-card`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-dark-surface/40"
      >
        <span>
          <span className={`block text-sm font-semibold ${titleColor}`}>{pump.name}</span>
          <span className="block text-xs text-dark-textSecondary mt-0.5">Relé {pump.relay}</span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-mono ${usingFallback ? 'text-amber-400' : titleColor}`}>
            {stored != null ? formatFlowRate(stored) : 'sem calib'}
          </span>
          {open ? (
            <ChevronUpIcon className="w-4 h-4 text-dark-textSecondary" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 text-dark-textSecondary" />
          )}
        </span>
      </button>

      {open ? (
        <div className="px-4 pb-4 border-t border-dark-border space-y-4 pt-3">
          <PumpPrimeHoldControl
            deviceId={deviceId}
            relayNumber={pump.relay}
            relayLabel={pump.name}
            isOnline={isOnline}
            autoBlocked={autoBlocked}
            accent={accent}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-dark-textSecondary mb-1">Volume (ml)</label>
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
                step={1}
                value={measuredDurationSec}
                onChange={(e) => setMeasuredDurationSec(parseInt(e.target.value, 10) || 0)}
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-md text-sm text-dark-text"
              />
              <div className="flex flex-wrap gap-1 mt-1">
                {CALIBRATION_TEST_DURATIONS_SEC.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setMeasuredDurationSec(sec)}
                    className={`text-xs px-2 py-0.5 rounded border ${
                      measuredDurationSec === sec
                        ? isPh
                          ? 'border-violet-500 bg-violet-500/20 text-violet-400'
                          : 'border-cyan-500 bg-cyan-500/20 text-cyan-400'
                        : 'border-dark-border text-dark-textSecondary'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 bg-dark-surface rounded-lg p-3">
            <div>
              <p className="text-xs text-dark-textSecondary">Resultado</p>
              <p className={`text-lg font-bold ${titleColor}`}>
                {calculatedRate != null ? formatFlowRate(calculatedRate) : '—'}
              </p>
            </div>
            <button
              type="button"
              onClick={applyCalculated}
              disabled={calculatedRate == null}
              className={`text-xs px-3 py-2 rounded-lg border disabled:opacity-40 ${
                isPh
                  ? 'bg-violet-500/20 border-violet-500/40 text-violet-400'
                  : 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
              }`}
            >
              Usar
            </button>
          </div>

          <div>
            <label className="block text-xs text-dark-textSecondary mb-1">Vazão (ml/s)</label>
            <input
              type="number"
              min={0.001}
              step={0.0001}
              value={flowRate}
              onChange={(e) => setFlowRate(parseFloat(e.target.value) || 0)}
              className="w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text font-mono"
            />
            <p className="text-xs text-dark-textSecondary mt-1">{formatFlowRateMlPerMin(flowRate)}</p>
          </div>

          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || flowRate <= 0}
            className={`w-full py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${
              isPh
                ? 'bg-violet-600 hover:bg-violet-700'
                : 'bg-gradient-to-r from-cyan-500 to-sky-600'
            }`}
          >
            {saving ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CheckCircleIcon className="w-4 h-4" />}
            Salvar vazão
          </button>

          <div className="border-t border-dark-border pt-3 grid grid-cols-[1fr_auto] gap-2 items-end">
            <div>
              <label className="block text-xs text-dark-textSecondary mb-1">Teste (ml)</label>
              <input
                type="number"
                min={1}
                step={1}
                value={testVolumeMl}
                onChange={(e) => setTestVolumeMl(parseFloat(e.target.value) || 5)}
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-md text-sm text-dark-text"
              />
            </div>
            <button
              type="button"
              onClick={() => void runTest()}
              disabled={testing || !isOnline || autoBlocked}
              className={`px-3 py-2 rounded-lg text-sm disabled:opacity-40 flex items-center gap-1 border ${
                isPh
                  ? 'border-violet-500/40 text-violet-400'
                  : 'border-cyan-500/40 text-cyan-400'
              }`}
            >
              <PlayIcon className="w-4 h-4" />
              {testing ? '…' : 'Dosar'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function EcPumpCalibrationSection({
  deviceId,
  isOnline,
  autoBlocked,
  relayOptions = [],
}: {
  deviceId: string;
  isOnline: boolean;
  autoBlocked: boolean;
  relayOptions?: Array<{ number: number; name: string }>;
}) {
  const [loading, setLoading] = useState(true);
  const [pumps, setPumps] = useState<AvailablePump[]>([]);
  const [globalFlowRate, setGlobalFlowRate] = useState(1);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ecRes, phRes] = await Promise.all([
        fetch(`/api/ec-controller/config?device_id=${encodeURIComponent(deviceId)}`),
        fetch(`/api/ph-controller/config?device_id=${encodeURIComponent(deviceId)}`),
      ]);
      if (!ecRes.ok) throw new Error('Erro ao carregar');
      const config = await ecRes.json();
      const ph = phRes.ok ? await phRes.json() : {};
      const rows = parseNutrientsJson(config.nutrients);
      const phUp = Number(ph.relay_ph_up);
      const phDown = Number(ph.relay_ph_down);
      const slots: AvailablePump[] = [];

      const nameOf = (relay: number, fallback: string) =>
        relayOptions.find((o) => o.number === relay)?.name || fallback;

      for (const n of rows) {
        if (!isAssignedNutrient(n)) continue;
        const relay = nutrientRelayNumber(n);
        if (relay == null || relay > 7) continue;
        slots.push({
          kind: 'ec',
          name: (n.name && String(n.name).trim()) || nameOf(relay, `Bomba ${relay + 1}`),
          relay,
          flowRate: parseNutrientFlowRate(n),
        });
      }

      if (Number.isInteger(phUp) && phUp >= 0 && phUp <= 7) {
        slots.push({
          kind: 'ph_up',
          name: nameOf(phUp, 'pH+ (base)'),
          relay: phUp,
          flowRate: Number(ph.flow_rate_ph_up) > 0 ? Number(ph.flow_rate_ph_up) : undefined,
        });
      }
      if (Number.isInteger(phDown) && phDown >= 0 && phDown <= 7 && phDown !== phUp) {
        slots.push({
          kind: 'ph_down',
          name: nameOf(phDown, 'pH− (ácido)'),
          relay: phDown,
          flowRate: Number(ph.flow_rate_ph_down) > 0 ? Number(ph.flow_rate_ph_down) : undefined,
        });
      }

      setPumps(slots);
      const g = Number(config.flow_rate);
      setGlobalFlowRate(Number.isFinite(g) && g > 0 ? g : 1);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao carregar bombas');
    } finally {
      setLoading(false);
    }
  }, [deviceId, relayOptions]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSaved = (relay: number, kind: PumpKind, flowRate: number) => {
    setPumps((prev) =>
      prev.map((p) => (p.relay === relay && p.kind === kind ? { ...p, flowRate } : p))
    );
    window.dispatchEvent(
      new CustomEvent('flowRateUpdated', { detail: { deviceId, flowRate, relay } })
    );
  };

  if (loading) {
    return <p className="text-dark-textSecondary text-sm">Carregando bombas…</p>;
  }

  if (pumps.length === 0) {
    return (
      <section className="bg-dark-card border border-dark-border rounded-xl p-5">
        <h2 className="text-lg font-semibold text-cyan-400 mb-2">Bombas disponíveis</h2>
        <p className="text-sm text-dark-textSecondary">
          Nenhuma bomba atribuída. Cadastre nutrientes ou pH+ / pH− em Automação.
        </p>
        <NavLink href="/automacao" className="inline-block mt-3 text-aqua-400 hover:underline text-sm">
          Ir para Automação →
        </NavLink>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-cyan-400">Bombas disponíveis</h2>
        <p className="text-sm text-dark-textSecondary mt-1">
          Toque para abrir. Cebar, medir e salvar a vazão. Ganhos químicos do pH ficam na aba Mapa
          de ganhos.
        </p>
      </div>
      {pumps.map((p) => {
        const key = `${p.kind}-${p.relay}`;
        return (
          <PumpAccordionRow
            key={key}
            deviceId={deviceId}
            pump={p}
            globalFlowRate={globalFlowRate}
            isOnline={isOnline}
            autoBlocked={autoBlocked}
            open={openKey === key}
            onToggle={() => setOpenKey((cur) => (cur === key ? null : key))}
            onSaved={onSaved}
          />
        );
      })}
    </section>
  );
}
