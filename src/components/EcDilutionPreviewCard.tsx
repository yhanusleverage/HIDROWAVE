'use client';

import { MetricRow } from '@/components/ui/MetricRow';
import { HW_BG_SUBTLE, HW_TEXT } from '@/lib/design-tokens';
import {
  calcDrainVolumeL,
  calcRelativeExcess,
  calcReplaceFraction,
  calcSignedErrorUs,
  clampDilutionVolume,
  needsDilution,
} from '@/lib/ec-dilution';
import { formatSensorValue } from '@/lib/format-sensor-value';

export interface EcDilutionPreviewCardProps {
  ecSetpoint: number;
  tolerance: number;
  tankVolumeL: number;
  maxVolumeL: number;
  ecActual: number | null;
}

export function EcDilutionPreviewCard({
  ecSetpoint,
  tolerance,
  tankVolumeL,
  maxVolumeL,
  ecActual,
}: EcDilutionPreviewCardProps) {
  const overshoot =
    ecActual != null &&
    ecSetpoint > 0 &&
    needsDilution(ecSetpoint, ecActual, tolerance);

  const rawVolume =
    ecActual != null && ecSetpoint > 0
      ? calcDrainVolumeL(ecSetpoint, ecActual, tankVolumeL)
      : 0;

  const volumeL = clampDilutionVolume(rawVolume, maxVolumeL);
  const fraction =
    ecActual != null && ecSetpoint > 0
      ? calcReplaceFraction(ecSetpoint, ecActual)
      : 0;
  const signedError =
    ecActual != null && ecSetpoint > 0
      ? calcSignedErrorUs(ecSetpoint, ecActual)
      : null;
  const relativeExcess =
    ecActual != null && ecSetpoint > 0
      ? calcRelativeExcess(ecSetpoint, ecActual)
      : null;

  return (
    <div className={`rounded-lg border p-4 ${HW_BG_SUBTLE.wait}`}>
      <h4 className={`text-sm font-semibold mb-3 ${HW_TEXT.wait}`}>
        Pré-visualização (overshoot)
      </h4>

      <div className="space-y-2">
        <MetricRow
          label="Erro (SP − EC)"
          value={
            signedError != null
              ? `${formatSensorValue(signedError, 0)} µS/cm`
              : '--'
          }
          variant={signedError != null && signedError < 0 ? 'alarm' : 'default'}
        />
        <MetricRow
          label="Fração a substituir (1 − SP/EC)"
          value={fraction > 0 ? `${(fraction * 100).toFixed(1)} %` : '--'}
          variant="preview"
        />
        <MetricRow
          label="Excesso relativo (EC/SP − 1)"
          value={
            relativeExcess != null && relativeExcess > 0
              ? `${(relativeExcess * 100).toFixed(1)} %`
              : '--'
          }
        />
        <MetricRow
          label="Volume estimado (dreno + reposição)"
          value={volumeL > 0 ? `~${volumeL.toFixed(1)} L` : '--'}
          variant={overshoot ? 'preview' : 'default'}
        />
      </div>

      {overshoot && volumeL > 0 && (
        <p className="mt-3 text-xs text-cyan-300/90">
          Serão necessários ~{volumeL.toFixed(1)} L (dreno + reposição)
          {rawVolume > maxVolumeL && maxVolumeL > 0
            ? ` — limitado ao máximo de ${maxVolumeL} L`
            : ''}
          .
        </p>
      )}

      {ecActual != null && ecSetpoint > 0 && !overshoot && ecActual > ecSetpoint && (
        <p className="mt-3 text-xs text-dark-textSecondary">
          EC acima do setpoint, mas dentro da banda morta (±{tolerance} µS/cm).
        </p>
      )}
    </div>
  );
}
