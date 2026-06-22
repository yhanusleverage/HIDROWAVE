'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  LockClosedIcon,
  LockOpenIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline';
import { DoserRelaySelect } from '@/components/DoserRelaySelect';
import { EcDilutionPreviewCard } from '@/components/EcDilutionPreviewCard';
import OperationStateBadges from '@/components/OperationStateBadges';
import { useEcDilutionConfig } from '@/hooks/useEcDilutionConfig';
import { useEcDilutionState } from '@/hooks/useEcDilutionState';
import { useLastEcDilution } from '@/hooks/useLastEcDilution';
import { hwToast } from '@/lib/control-toast';
import {
  calcDrainVolumeL,
  clampDilutionVolume,
  needsDilution,
} from '@/lib/ec-dilution';
import { parseConfigApiError } from '@/lib/controller-config-api';
import {
  buildRegistryFromConfigs,
  formatRelayConflictMessage,
  type RelayAllocationRegistry,
  type EcNutrientRelaySlice,
} from '@/lib/relay-allocation';
import { HW_TEXT } from '@/lib/design-tokens';

export interface RelayAllocationBridge {
  buildRegistry: (
    overrides?: Parameters<typeof buildRegistryFromConfigs>[0]
  ) => RelayAllocationRegistry;
}

interface EcDilutionSectionProps {
  deviceId: string;
  ecActual: number | null;
  relayAllocation: RelayAllocationBridge;
  nutrients: EcNutrientRelaySlice[];
  locked?: boolean;
  onToggleLock?: () => void;
}

function formatCountdown(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }
  return `${seconds}s`;
}

export function EcDilutionSection({
  deviceId,
  ecActual,
  relayAllocation,
  nutrients,
  locked = false,
  onToggleLock,
}: EcDilutionSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [manualVolume, setManualVolume] = useState<string>('');
  const [confirmManual, setConfirmManual] = useState(false);
  const [starting, setStarting] = useState(false);

  const config = useEcDilutionConfig(deviceId, Boolean(deviceId?.trim()));
  const dilutionState = useEcDilutionState(deviceId, Boolean(deviceId?.trim()), {
    dilutionAutoEnabled: config.dilution_auto_enabled,
    mirrorFirmware: config.dilution_auto_enabled,
  });
  const lastDilution = useLastEcDilution(deviceId, Boolean(deviceId?.trim()));

  const registry = useMemo(
    () =>
      relayAllocation.buildRegistry({
        ecConfig: {
          nutrients,
          dilution_drain_relay: config.dilution_drain_relay,
          dilution_fill_relay: config.dilution_fill_relay,
        },
      }),
    [
      relayAllocation,
      nutrients,
      config.dilution_drain_relay,
      config.dilution_fill_relay,
    ]
  );

  const suggestedVolume = useMemo(() => {
    if (ecActual == null || config.ec_setpoint <= 0) return 0;
    const raw = calcDrainVolumeL(config.ec_setpoint, ecActual, config.volume);
    return clampDilutionVolume(raw, config.dilution_max_volume_l);
  }, [ecActual, config.ec_setpoint, config.volume, config.dilution_max_volume_l]);

  useEffect(() => {
    if (suggestedVolume > 0 && !manualVolume) {
      setManualVolume(suggestedVolume.toFixed(1));
    }
  }, [suggestedVolume, manualVolume]);

  const handleSaveConfig = useCallback(async () => {
    const drainMsg = formatRelayConflictMessage(registry, config.dilution_drain_relay, {
      field: 'ec_dilution_drain',
      currentValue: config.dilution_drain_relay,
    });
    if (drainMsg) {
      toast.error(drainMsg);
      return;
    }
    const fillMsg = formatRelayConflictMessage(registry, config.dilution_fill_relay, {
      field: 'ec_dilution_fill',
      currentValue: config.dilution_fill_relay,
    });
    if (fillMsg) {
      toast.error(fillMsg);
      return;
    }
    if (config.dilution_drain_relay < 0 || config.dilution_fill_relay < 0) {
      toast.error('Configure os relés de dreno e reposição');
      return;
    }
    if (config.dilution_drain_relay === config.dilution_fill_relay) {
      toast.error('Relés de dreno e reposição devem ser diferentes');
      return;
    }

    const result = await config.save({
      dilution_drain_relay: config.dilution_drain_relay,
      dilution_fill_relay: config.dilution_fill_relay,
      dilution_max_volume_l: config.dilution_max_volume_l,
      flowmeter_pulses_per_liter: config.flowmeter_pulses_per_liter,
      dilution_fill_flow_lps: config.dilution_fill_flow_lps,
      dilution_auto_enabled: config.dilution_auto_enabled,
    });

    if (!result.ok) {
      toast.error(result.error || 'Erro ao salvar diluição');
      return;
    }
    hwToast.success('Configuração de diluição salva', 'DILUIÇÃO EC');
  }, [config, registry]);

  const handleToggleAuto = useCallback(async () => {
    const next = !config.dilution_auto_enabled;
    const result = await config.save({ dilution_auto_enabled: next });
    if (!result.ok) {
      toast.error(result.error || 'Erro ao alterar auto diluição');
      return;
    }
    hwToast.info(
      next ? 'Auto diluição ativada' : 'Auto diluição desativada',
      'DILUIÇÃO EC'
    );
  }, [config]);

  const handleStartManual = useCallback(async () => {
    const vol = parseFloat(manualVolume.replace(',', '.'));
    if (!Number.isFinite(vol) || vol < 0.1) {
      toast.error('Volume inválido (mín. 0,1 L)');
      return;
    }
    if (vol > config.dilution_max_volume_l) {
      toast.error(`Volume excede o máximo (${config.dilution_max_volume_l} L)`);
      return;
    }
    if (config.dilution_drain_relay < 0 || config.dilution_fill_relay < 0) {
      toast.error('Configure e salve os relés antes de iniciar');
      return;
    }
    if (dilutionState.isDiluting) {
      toast.error('Diluição já em andamento');
      return;
    }

    setStarting(true);
    try {
      const res = await fetch('/api/ec-controller/dilution-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId,
          volume_l: vol,
        }),
      });
      if (!res.ok) {
        const parsed = await parseConfigApiError(res);
        toast.error(parsed.message);
        return;
      }
      hwToast.success(`Diluição manual iniciada (~${vol.toFixed(1)} L)`, 'DILUIÇÃO EC');
      setConfirmManual(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao iniciar diluição');
    } finally {
      setStarting(false);
    }
  }, [manualVolume, config, dilutionState.isDiluting, deviceId]);

  const controlsDisabled = locked || config.isSaving;

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg overflow-hidden mb-6">
      <div
        onClick={() => setExpanded((v) => !v)}
        className="w-full p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-dark-surface transition-colors cursor-pointer"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-1 min-w-0">
          <div className="flex items-center space-x-3 min-w-0">
            {expanded ? (
              <ChevronUpIcon className="w-5 h-5 text-cyan-400 shrink-0" />
            ) : (
              <ChevronDownIcon className="w-5 h-5 text-dark-textSecondary shrink-0" />
            )}
            <h3 className="text-lg font-semibold text-dark-text flex items-center gap-2 min-w-0">
              <BeakerIcon className={`w-5 h-5 shrink-0 ${HW_TEXT.wait}`} aria-hidden />
              <span className="truncate">Diluição EC (overshoot)</span>
            </h3>
          </div>
          <OperationStateBadges
            variant="header"
            autoEnabled={config.dilution_auto_enabled}
            autoActiveLabel="Auto diluição ativo"
            autoInactiveLabel="Auto diluição inativo"
            isLoading={config.isLoading}
            isDosando={dilutionState.isDraining}
            dosandoLabel="Drenando"
            isReplacing={dilutionState.isFilling}
            replacingLabel="Reponendo"
            isAguardandoRecirculacao={
              dilutionState.state === 'recirculating' &&
              dilutionState.operationRemainingSec > 0
            }
            operationRemainingSec={dilutionState.operationRemainingSec}
            accent="emerald"
          />
        </div>
        {onToggleLock && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleLock();
            }}
            className={`p-1.5 rounded transition-colors ${
              locked
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                : 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30'
            }`}
            title={locked ? 'Desbloquear diluição' : 'Bloquear diluição'}
          >
            {locked ? (
              <LockClosedIcon className="w-4 h-4" />
            ) : (
              <LockOpenIcon className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {expanded && (
        <div className="p-4 sm:p-6 border-t border-dark-border space-y-6">
          <p className="text-xs sm:text-sm text-dark-textSecondary">
            Modo A: dreno parcial medido por fluxómetro na saída do dreno + reposição de água.
            Ativa quando EC &gt; setpoint + banda morta. Independente do Auto EC de nutrientes.
          </p>

          <EcDilutionPreviewCard
            ecSetpoint={config.ec_setpoint}
            tolerance={config.tolerance}
            tankVolumeL={config.volume}
            maxVolumeL={config.dilution_max_volume_l}
            ecActual={ecActual}
          />

          {dilutionState.isDiluting && dilutionState.targetL > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-cyan-300">
                <span>
                  {dilutionState.isDraining ? 'Drenando' : 'Reponendo'}
                </span>
                <span>
                  {dilutionState.progressL.toFixed(1)} / {dilutionState.targetL.toFixed(1)} L
                </span>
              </div>
              <div className="h-2 rounded-full bg-dark-surface overflow-hidden">
                <div
                  className="h-full bg-cyan-500 transition-all duration-500"
                  style={{ width: `${Math.round(dilutionState.progressRatio * 100)}%` }}
                />
              </div>
              {dilutionState.operationRemainingSec > 0 && (
                <p className="text-xs text-dark-textSecondary">
                  Tempo restante estimado: {formatCountdown(dilutionState.operationRemainingSec)}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-textSecondary mb-1">
                Relé dreno
              </label>
              <DoserRelaySelect
                registry={registry}
                context={{
                  field: 'ec_dilution_drain',
                  currentValue: config.dilution_drain_relay,
                }}
                value={config.dilution_drain_relay}
                onChange={(v) => config.updateLocal({ dilution_drain_relay: v })}
                disabled={controlsDisabled}
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-textSecondary mb-1">
                Relé reposição (água)
              </label>
              <DoserRelaySelect
                registry={registry}
                context={{
                  field: 'ec_dilution_fill',
                  currentValue: config.dilution_fill_relay,
                }}
                value={config.dilution_fill_relay}
                onChange={(v) => config.updateLocal({ dilution_fill_relay: v })}
                disabled={controlsDisabled}
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-textSecondary mb-1">
                Volume máximo por ciclo (L)
              </label>
              <input
                type="number"
                min={0.1}
                step={0.5}
                value={config.dilution_max_volume_l}
                onChange={(e) =>
                  config.updateLocal({
                    dilution_max_volume_l: parseFloat(e.target.value) || 0,
                  })
                }
                disabled={controlsDisabled}
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-textSecondary mb-1">
                Pulsos/L (fluxómetro dreno)
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={config.flowmeter_pulses_per_liter}
                onChange={(e) =>
                  config.updateLocal({
                    flowmeter_pulses_per_liter: parseFloat(e.target.value) || 450,
                  })
                }
                disabled={controlsDisabled}
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-textSecondary mb-1">
                Vazão reposição (L/s)
              </label>
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={config.dilution_fill_flow_lps}
                onChange={(e) =>
                  config.updateLocal({
                    dilution_fill_flow_lps: parseFloat(e.target.value) || 0.5,
                  })
                }
                disabled={controlsDisabled}
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleSaveConfig()}
              disabled={controlsDisabled}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg disabled:opacity-50"
            >
              {config.isSaving ? 'Salvando…' : 'Salvar diluição'}
            </button>
            <button
              type="button"
              onClick={() => void handleToggleAuto()}
              disabled={controlsDisabled}
              className={`px-4 py-2 rounded-lg text-white disabled:opacity-50 ${
                config.dilution_auto_enabled
                  ? 'bg-amber-700 hover:bg-amber-800'
                  : 'bg-cyan-700 hover:bg-cyan-800'
              }`}
            >
              {config.dilution_auto_enabled ? 'Desativar auto diluição' : 'Ativar auto diluição'}
            </button>
          </div>

          <div className="border-t border-dark-border pt-4">
            <h4 className="text-sm font-semibold text-dark-text mb-3">Diluição manual</h4>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
              <div className="flex-1 w-full">
                <label className="block text-sm font-medium text-dark-textSecondary mb-1">
                  Volume (L)
                </label>
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={manualVolume}
                  onChange={(e) => setManualVolume(e.target.value)}
                  disabled={controlsDisabled || dilutionState.isDiluting}
                  className="w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text"
                />
              </div>
              {!confirmManual ? (
                <button
                  type="button"
                  onClick={() => setConfirmManual(true)}
                  disabled={
                    controlsDisabled ||
                    dilutionState.isDiluting ||
                    !manualVolume
                  }
                  className="px-4 py-2 bg-cyan-800 hover:bg-cyan-900 text-white rounded-lg disabled:opacity-50 whitespace-nowrap"
                >
                  Iniciar diluição
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleStartManual()}
                    disabled={starting}
                    className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg disabled:opacity-50"
                  >
                    {starting ? 'Enviando…' : 'Confirmar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmManual(false)}
                    className="px-4 py-2 bg-dark-surface border border-dark-border rounded-lg"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
            {ecActual != null &&
              config.ec_setpoint > 0 &&
              needsDilution(config.ec_setpoint, ecActual, config.tolerance) && (
                <p className="mt-2 text-xs text-cyan-300/80">
                  Overshoot detectado — volume sugerido pré-preenchido.
                </p>
              )}
          </div>

          {lastDilution.available && lastDilution.volumeMeasuredL != null && (
            <p className="text-xs text-dark-textSecondary">
              Última diluição: {lastDilution.volumeMeasuredL.toFixed(1)} L (
              {lastDilution.source || 'auto'}) —{' '}
              {lastDilution.completedAt
                ? new Date(lastDilution.completedAt).toLocaleString('pt-BR')
                : '--'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
