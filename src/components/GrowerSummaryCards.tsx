'use client';

import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from '@heroicons/react/24/outline';
import NavLink from '@/components/NavLink';
import { InstrumentCard } from '@/components/ui/InstrumentCard';
import { MetricRow } from '@/components/ui/MetricRow';
import { useEc24hSnapshot, usePh24hSnapshot } from '@/hooks/useGrower24hSummary';
import { formatSensorValue } from '@/lib/format-sensor-value';
import { HW_TEXT } from '@/lib/design-tokens';
import {
  formatAgoPt,
  formatMl,
  interpretEcDelta,
  interpretPhDelta,
  type GrowerTrend,
} from '@/lib/grower-24h-summary';

function trendClass(trend: GrowerTrend): string {
  if (trend === 'down') return 'text-amber-400';
  if (trend === 'up') return 'text-cyan-400';
  if (trend === 'stable') return 'text-emerald-400';
  return 'text-dark-textSecondary';
}

function TrendGlyph({ trend }: { trend: GrowerTrend }) {
  const cls = `h-6 w-6 ${trendClass(trend)}`;
  if (trend === 'down') return <ArrowDownIcon className={cls} aria-hidden />;
  if (trend === 'up') return <ArrowUpIcon className={cls} aria-hidden />;
  return <MinusIcon className={cls} aria-hidden />;
}

function formatHistoryHint(historyMs: number, hasFullWindow: boolean): string {
  if (hasFullWindow) return 'Últimas 24 h (janela móvel).';
  const hours = Math.max(0, Math.floor(historyMs / (60 * 60 * 1000)));
  if (hours <= 0) return 'Sem histórico ainda — o diário completa após 24 h de Auto ligado.';
  return `Histórico de ${hours} h — ainda não há 24 h para a seta.`;
}

export type EcGrowerSummaryCardProps = {
  deviceId: string;
  consumo24h: boolean;
  ecNow: number | null;
  setpoint: number;
  tolerance: number;
  estimatedDoseMl: number | null;
  lastDoseMl: number | null;
  lastDoseAt: string | null;
  autoEnabled: boolean;
  showNextCheck: boolean;
  nextCheckInSec: number;
  formatCountdown: (sec: number) => string;
};

export function EcGrowerSummaryCard({
  deviceId,
  consumo24h,
  ecNow,
  setpoint,
  tolerance,
  estimatedDoseMl,
  lastDoseMl,
  lastDoseAt,
  autoEnabled,
  showNextCheck,
  nextCheckInSec,
  formatCountdown,
}: EcGrowerSummaryCardProps) {
  const { data, loading } = useEc24hSnapshot(deviceId, consumo24h);
  const gap = ecNow != null ? setpoint - ecNow : null;
  const inBand = gap != null && Math.abs(gap) <= tolerance;

  if (!consumo24h) {
    const gapLabel =
      gap == null
        ? '--'
        : inBand
          ? 'No alvo'
          : gap > 0
            ? `Faltam ${formatSensorValue(gap, 0)} µS`
            : `EC acima do alvo (${formatSensorValue(Math.abs(gap), 0)} µS)`;

    return (
      <InstrumentCard accent="ec" title="Ajuste agora" tinted>
        <div className="space-y-2.5 text-base">
          <MetricRow
            label="Distância do alvo:"
            value={gapLabel}
            variant={inBand ? 'ok' : gap != null && gap > 0 ? 'alarm' : 'default'}
            domain="ec"
          />
          <MetricRow
            label="Próxima dose estimada:"
            value={
              inBand || estimatedDoseMl == null || estimatedDoseMl <= 0
                ? 'Sem dose'
                : `${formatMl(estimatedDoseMl, 2)} ml`
            }
            variant="preview"
            domain="ec"
          />
          <MetricRow
            label="Última dose:"
            value={
              lastDoseMl != null
                ? `${formatMl(lastDoseMl, 2)} ml${lastDoseAt ? ` · ${formatAgoPt(lastDoseAt)}` : ''}`
                : '-- ml'
            }
          />
          <MetricRow
            label="Próxima verificação:"
            value={
              autoEnabled && showNextCheck && nextCheckInSec > 0
                ? formatCountdown(nextCheckInSec)
                : autoEnabled
                  ? '—'
                  : 'Auto EC desligado'
            }
          />
        </div>
      </InstrumentCard>
    );
  }

  const reading = interpretEcDelta(
    ecNow,
    data?.thenValue ?? null,
    tolerance,
    Boolean(data?.hasFullWindow)
  );
  const absDelta = reading.delta != null ? Math.abs(reading.delta) : null;
  const verb =
    reading.trend === 'down'
      ? 'caiu'
      : reading.trend === 'up'
        ? 'subiu'
        : reading.trend === 'stable'
          ? 'estável'
          : '';

  return (
    <InstrumentCard accent="ec" title="Resumo 24 h" tinted ariaLive="polite">
      {loading && !data ? (
        <p className="text-sm text-dark-textSecondary">Carregando consumo…</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-dark-textSecondary">EC agora</p>
              <p className={`text-xl font-semibold tabular-nums ${HW_TEXT.ec}`}>
                {ecNow != null ? `${formatSensorValue(ecNow, 0)} µS` : '--'}
              </p>
              {data?.thenValue != null && (
                <p className="mt-0.5 text-xs text-dark-textSecondary">
                  Há ~24 h: {formatSensorValue(data.thenValue, 0)} µS
                </p>
              )}
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-1">
                <TrendGlyph trend={reading.trend} />
                <span className={`text-lg font-semibold tabular-nums ${trendClass(reading.trend)}`}>
                  {absDelta != null && verb && verb !== 'estável'
                    ? `${verb} ${formatSensorValue(absDelta, 0)} µS`
                    : reading.trend === 'stable'
                      ? 'estável'
                      : '—'}
                </span>
              </div>
              <p className="mt-1 max-w-[14rem] text-xs text-dark-textSecondary">{reading.label}</p>
            </div>
          </div>

          <div className="space-y-2.5 text-base">
            <MetricRow
              label="Nutrientes 24 h:"
              value={`${formatMl(data?.totalMl ?? 0, 1)} ml · ${data?.doseCount ?? 0} doses`}
            />
            {(data?.byNutrient ?? []).slice(0, 6).map((item) => (
              <MetricRow key={item.name} label={item.name} value={`${formatMl(item.ml, 1)} ml`} />
            ))}
            {data?.minValue != null && data.maxValue != null && (
              <MetricRow
                label="Mín / máx 24 h:"
                value={`${formatSensorValue(data.minValue, 0)} / ${formatSensorValue(data.maxValue, 0)} µS`}
              />
            )}
          </div>
          <p className="text-xs text-dark-textSecondary">
            {formatHistoryHint(data?.historyMs ?? 0, Boolean(data?.hasFullWindow))}
          </p>
        </div>
      )}
    </InstrumentCard>
  );
}

export type PhGrowerSummaryCardProps = {
  deviceId: string;
  consumo24h: boolean;
  phNow: number | null;
  setpoint: number;
  tolerance: number;
  estimatedDoseMl: number | null;
  lastDoseMl: number | null;
  lastDoseAt: string | null;
  directionLabel: string;
  autoEnabled: boolean;
  showNextCheck: boolean;
  nextCheckInSec: number;
  formatCountdown: (sec: number) => string;
  calibBaseLine?: string;
  calibAcidLine?: string;
};

export function PhGrowerSummaryCard({
  deviceId,
  consumo24h,
  phNow,
  setpoint,
  tolerance,
  estimatedDoseMl,
  lastDoseMl,
  lastDoseAt,
  directionLabel,
  autoEnabled,
  showNextCheck,
  nextCheckInSec,
  formatCountdown,
  calibBaseLine,
  calibAcidLine,
}: PhGrowerSummaryCardProps) {
  const { data, loading } = usePh24hSnapshot(deviceId, consumo24h);
  const gap = phNow != null ? phNow - setpoint : null;
  const inBand = gap != null && Math.abs(gap) <= tolerance;

  const calibFooter =
    calibBaseLine || calibAcidLine ? (
      <div className="mt-4 space-y-1 border-t border-dark-border pt-3 text-xs text-dark-textSecondary">
        {calibBaseLine ? <p className="leading-relaxed">{calibBaseLine}</p> : null}
        {calibAcidLine ? <p className="leading-relaxed">{calibAcidLine}</p> : null}
        <NavLink href="/calibragem" className={`${HW_TEXT.ph} inline-block hover:underline`}>
          Editar calibragem →
        </NavLink>
      </div>
    ) : null;

  if (!consumo24h) {
    const gapLabel =
      gap == null
        ? '--'
        : inBand
          ? 'No alvo'
          : gap > 0
            ? `${formatSensorValue(gap, 2)} acima do alvo`
            : `${formatSensorValue(Math.abs(gap), 2)} abaixo do alvo`;

    return (
      <InstrumentCard accent="ph" title="Ajuste agora" tinted>
        <div className="space-y-2.5 text-base">
          <MetricRow
            label="Distância do alvo:"
            value={gapLabel}
            variant={inBand ? 'ok' : gap != null ? 'alarm' : 'default'}
          />
          <MetricRow
            label="Próxima dose estimada:"
            value={
              inBand || estimatedDoseMl == null || estimatedDoseMl <= 0
                ? 'Sem dose'
                : `${formatMl(estimatedDoseMl, 2)} ml · ${directionLabel}`
            }
            variant="preview"
          />
          <MetricRow
            label="Última dose:"
            value={
              lastDoseMl != null
                ? `${formatMl(lastDoseMl, 2)} ml${lastDoseAt ? ` · ${formatAgoPt(lastDoseAt)}` : ''}`
                : '-- ml'
            }
          />
          <MetricRow
            label="Próxima verificação:"
            value={
              autoEnabled && showNextCheck && nextCheckInSec > 0
                ? formatCountdown(nextCheckInSec)
                : autoEnabled
                  ? '—'
                  : 'Auto pH desligado'
            }
          />
        </div>
        {calibFooter}
      </InstrumentCard>
    );
  }

  const reading = interpretPhDelta(
    phNow,
    data?.thenValue ?? null,
    tolerance,
    Boolean(data?.hasFullWindow)
  );
  const absDelta = reading.delta != null ? Math.abs(reading.delta) : null;
  const verb =
    reading.trend === 'down'
      ? 'desceu'
      : reading.trend === 'up'
        ? 'subiu'
        : reading.trend === 'stable'
          ? 'estável'
          : '';

  return (
    <InstrumentCard accent="ph" title="Resumo 24 h" tinted ariaLive="polite">
      {loading && !data ? (
        <p className="text-sm text-dark-textSecondary">Carregando consumo…</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-dark-textSecondary">pH agora</p>
              <p className={`text-xl font-semibold tabular-nums ${HW_TEXT.ph}`}>
                {phNow != null ? formatSensorValue(phNow, 2) : '--'}
              </p>
              {data?.thenValue != null && (
                <p className="mt-0.5 text-xs text-dark-textSecondary">
                  Há ~24 h: {formatSensorValue(data.thenValue, 2)}
                </p>
              )}
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-1">
                <TrendGlyph trend={reading.trend} />
                <span className={`text-lg font-semibold tabular-nums ${trendClass(reading.trend)}`}>
                  {absDelta != null && verb && verb !== 'estável'
                    ? `${verb} ${formatSensorValue(absDelta, 2)}`
                    : reading.trend === 'stable'
                      ? 'estável'
                      : '—'}
                </span>
              </div>
              <p className="mt-1 max-w-[14rem] text-xs text-dark-textSecondary">{reading.label}</p>
            </div>
          </div>

          <div className="space-y-2.5 text-base">
            <MetricRow label="pH+ (base) 24 h:" value={`${formatMl(data?.mlUp ?? 0, 1)} ml`} />
            <MetricRow label="pH− (ácido) 24 h:" value={`${formatMl(data?.mlDown ?? 0, 1)} ml`} />
            <MetricRow
              label="Correções 24 h:"
              value={`${data?.doseCount ?? 0} · total ${formatMl(data?.totalMl ?? 0, 1)} ml`}
            />
            {data?.minValue != null && data.maxValue != null && (
              <MetricRow
                label="Mín / máx 24 h:"
                value={`${formatSensorValue(data.minValue, 2)} / ${formatSensorValue(data.maxValue, 2)}`}
              />
            )}
          </div>
          <p className="text-xs text-dark-textSecondary">
            {formatHistoryHint(data?.historyMs ?? 0, Boolean(data?.hasFullWindow))}
          </p>
        </div>
      )}
      {calibFooter}
    </InstrumentCard>
  );
}
