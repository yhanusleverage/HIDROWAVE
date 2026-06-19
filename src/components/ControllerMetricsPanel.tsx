'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { InstrumentCard } from '@/components/ui/InstrumentCard';
import { MetricRow } from '@/components/ui/MetricRow';
import { formatSensorValue } from '@/lib/format-sensor-value';
import {
  fetchEcControllerMetrics,
  fetchPhControllerMetrics,
  type EcControllerMetricRow,
  type PhControllerMetricRow,
} from '@/lib/controller-metrics';
import {
  buildEcMetricsChartData,
  buildEcMetricsChartOptions,
  buildMockEcMetrics,
  buildMockPhMetrics,
  buildPhMetricsChartData,
  buildPhMetricsChartOptions,
  summarizeEcMetrics,
  summarizePhMetrics,
} from '@/lib/controller-metrics-chart';
import {
  appendMetricRow,
  subscribeControllerMetrics,
} from '@/lib/realtime/controller-metrics';
import { setVisibleInterval } from '@/lib/realtime/visible-interval';
import { hydroCrosshairPlugin } from '@/lib/hydro-chart';

import { HYDRO_EC_FALLBACK_MS } from '@/lib/realtime/hydro-ec';

const METRICS_FALLBACK_MS = HYDRO_EC_FALLBACK_MS;

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  hydroCrosshairPlugin
);

const CHART_HEIGHT = 260;

type MetricsFocus = 'ec' | 'ph' | 'both';

export type ControllerMetricsPanelProps = {
  deviceId: string;
  className?: string;
  /** Fija EC o pH (Automacao); omitir tabs si hideTabs */
  focus?: MetricsFocus;
  hideTabs?: boolean;
};

function KpiChip({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'neutral' | 'ok' | 'warn' | 'muted';
}) {
  const toneClass =
    tone === 'ok'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
      : tone === 'warn'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
        : tone === 'muted'
          ? 'border-dark-border bg-dark-bg/40 text-dark-textSecondary'
          : 'border-dark-border bg-dark-bg/30 text-dark-text';

  return (
    <div className={`rounded-md border px-2.5 py-1.5 text-xs ${toneClass}`}>
      <span className="block text-[10px] uppercase tracking-wide opacity-70">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

export default function ControllerMetricsPanel({
  deviceId,
  className = '',
  focus = 'both',
  hideTabs = false,
}: ControllerMetricsPanelProps) {
  const [tab, setTab] = useState<MetricsFocus>(focus === 'both' ? 'both' : focus);
  const [ecRows, setEcRows] = useState<EcControllerMetricRow[]>([]);
  const [phRows, setPhRows] = useState<PhControllerMetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(false);
  const isDev = process.env.NODE_ENV === 'development';

  useEffect(() => {
    if (focus !== 'both') setTab(focus);
  }, [focus]);

  useEffect(() => {
    if (!deviceId || preview) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function load() {
      const [ec, ph] = await Promise.all([
        fetchEcControllerMetrics(deviceId),
        fetchPhControllerMetrics(deviceId),
      ]);
      if (!cancelled) {
        setEcRows(ec);
        setPhRows(ph);
        setLoading(false);
      }
    }

    setLoading(true);
    load();

    const unsubscribe = subscribeControllerMetrics(deviceId, {
      onEc: (row) => {
        setEcRows((prev) => appendMetricRow(prev, row));
        setLoading(false);
      },
      onPh: (row) => {
        setPhRows((prev) => appendMetricRow(prev, row));
        setLoading(false);
      },
      onSubscribed: () => {
        if (!cancelled) load();
      },
    });

    const clearFallback = setVisibleInterval(() => {
      if (!cancelled) load();
    }, METRICS_FALLBACK_MS);

    return () => {
      cancelled = true;
      unsubscribe();
      clearFallback();
    };
  }, [deviceId, preview]);

  const displayEc = useMemo(
    () => (preview ? buildMockEcMetrics(deviceId) : ecRows),
    [preview, deviceId, ecRows]
  );
  const displayPh = useMemo(
    () => (preview ? buildMockPhMetrics(deviceId) : phRows),
    [preview, deviceId, phRows]
  );

  const ecSummary = useMemo(() => summarizeEcMetrics(displayEc), [displayEc]);
  const phSummary = useMemo(() => summarizePhMetrics(displayPh), [displayPh]);

  const ecChart = useMemo(() => buildEcMetricsChartData(displayEc), [displayEc]);
  const ecOptions = useMemo(() => buildEcMetricsChartOptions(displayEc), [displayEc]);
  const phChart = useMemo(() => buildPhMetricsChartData(displayPh), [displayPh]);
  const phOptions = useMemo(() => buildPhMetricsChartOptions(displayPh), [displayPh]);

  const showEc = tab === 'ec' || tab === 'both';
  const showPh = tab === 'ph' || tab === 'both';
  const hasData = displayEc.length > 0 || displayPh.length > 0;
  const showTabs = !hideTabs && focus === 'both';

  return (
    <InstrumentCard
      accent="brand"
      className={className}
      title={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>Métricas de ciclo Auto EC / pH</span>
          <div className="flex flex-wrap items-center gap-2">
            {preview && (
              <span className="text-xs font-normal rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-300">
                Demo local
              </span>
            )}
            <span className="text-xs font-normal text-dark-textSecondary">últimas 24 h</span>
          </div>
        </div>
      }
    >
      {showTabs && (
        <div className="mb-3 flex flex-wrap gap-2">
          {(['both', 'ec', 'ph'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                tab === key
                  ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/40'
                  : 'bg-dark-bg/50 text-dark-textSecondary border border-dark-border hover:text-dark-text'
              }`}
            >
              {key === 'both' ? 'EC + pH' : key === 'ec' ? 'Auto EC' : 'Auto pH'}
            </button>
          ))}
        </div>
      )}

      {loading && !hasData && !preview ? (
        <p className="py-10 text-center text-xs text-dark-textSecondary">Carregando métricas…</p>
      ) : !hasData ? (
        <div className="space-y-4 py-6 text-center">
          <p className="text-sm text-dark-textSecondary">
            Sem métricas ainda — cada tick de <code className="text-xs">checkAutoEC</code> /{' '}
            <code className="text-xs">checkAutoPH</code> gera uma linha (com ou sem dosagem).
          </p>
          <p className="text-xs text-dark-textSecondary">
            Gate V3/V4: SQL OK → flash firmware → bridge <code className="text-xs">ec_metric</code> /{' '}
            <code className="text-xs">ph_metric</code> → Auto ON com sensor válido.
          </p>
          {isDev && (
            <button
              type="button"
              onClick={() => setPreview(true)}
              className="rounded-lg border border-brand-primary/40 bg-brand-primary/10 px-4 py-2 text-sm text-brand-primary hover:bg-brand-primary/20"
            >
              Ver gráfico demo (dev)
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {showEc && displayEc.length > 0 && (
            <section>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400/90">
                  Auto EC — controle
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <KpiChip
                    label="Ticks 24h"
                    value={ecSummary.tickCount}
                  />
                  <KpiChip
                    label="Erro atual"
                    value={
                      ecSummary.lastError != null
                        ? `${formatSensorValue(ecSummary.lastError, 0)} µS/cm`
                        : '--'
                    }
                    tone={ecSummary.lastError != null && ecSummary.lastError > 50 ? 'warn' : 'ok'}
                  />
                  <KpiChip
                    label="u(t) último"
                    value={
                      ecSummary.lastUt != null ? `${formatSensorValue(ecSummary.lastUt, 2)} ml` : '--'
                    }
                  />
                  <KpiChip
                    label="Dosagens"
                    value={`${ecSummary.appliedCount} / ${ecSummary.neededCount} needed`}
                    tone={ecSummary.appliedCount > 0 ? 'ok' : 'muted'}
                  />
                </div>
              </div>
              <div style={{ height: CHART_HEIGHT }} className="relative w-full">
                <Line data={ecChart} options={ecOptions} />
              </div>
              {ecSummary.lastAt && (
                <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                  <MetricRow
                    label="Último tick:"
                    value={new Date(ecSummary.lastAt).toLocaleString('pt-BR')}
                  />
                  <MetricRow
                    label="EC / SP:"
                    value={
                      ecSummary.lastActual != null && ecSummary.lastSetpoint != null
                        ? `${formatSensorValue(ecSummary.lastActual, 0)} / ${formatSensorValue(ecSummary.lastSetpoint, 0)} µS/cm`
                        : '--'
                    }
                    domain="ec"
                    variant="live"
                  />
                </div>
              )}
            </section>
          )}

          {showPh && displayPh.length > 0 && (
            <section>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-400/90">
                  Auto pH — domínio H
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <KpiChip label="Ticks 24h" value={phSummary.tickCount} />
                  <KpiChip
                    label="error_h"
                    value={
                      phSummary.lastErrorH != null
                        ? phSummary.lastErrorH.toExponential(2)
                        : '--'
                    }
                  />
                  <KpiChip
                    label="u(t) último"
                    value={
                      phSummary.lastUt != null ? `${formatSensorValue(phSummary.lastUt, 2)} ml` : '--'
                    }
                  />
                  <KpiChip
                    label="Dosagens"
                    value={`${phSummary.appliedCount} / ${phSummary.neededCount} needed`}
                    tone={phSummary.appliedCount > 0 ? 'ok' : 'muted'}
                  />
                </div>
              </div>
              <div style={{ height: CHART_HEIGHT }} className="relative w-full">
                <Line data={phChart} options={phOptions} />
              </div>
              {phSummary.lastAt && (
                <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                  <MetricRow
                    label="Último tick:"
                    value={new Date(phSummary.lastAt).toLocaleString('pt-BR')}
                  />
                  <MetricRow
                    label="pH / SP:"
                    value={
                      phSummary.lastPh != null && phSummary.lastSetpoint != null
                        ? `${formatSensorValue(phSummary.lastPh, 2)} / ${formatSensorValue(phSummary.lastSetpoint, 2)}`
                        : '--'
                    }
                    domain="ph"
                    variant="live"
                  />
                </div>
              )}
            </section>
          )}

          {isDev && (
            <div className="flex flex-wrap gap-2 border-t border-dark-border pt-3">
              {preview ? (
                <button
                  type="button"
                  onClick={() => setPreview(false)}
                  className="text-xs text-dark-textSecondary underline hover:text-dark-text"
                >
                  Sair do demo — voltar a dados reais
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setPreview(true)}
                  className="text-xs text-dark-textSecondary underline hover:text-dark-text"
                >
                  Alternar demo (dev)
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </InstrumentCard>
  );
}
