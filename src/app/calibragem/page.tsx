'use client';

import React, { useState, useEffect, useCallback } from 'react';
import NavLink from '@/components/NavLink';
import { toast } from 'react-hot-toast';
import { hwToast } from '@/lib/control-toast';
import {
  BeakerIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  ArrowPathIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/contexts/AuthContext';
import { getMasterLocalRelayNames } from '@/lib/nutrition-plan';
import { useDevicesWithRealtime } from '@/hooks/useDevicesWithRealtime';
import {
  calculateFlowRateMlPerSecond,
  calculateDoseDurationSeconds,
  doseDurationSecondsForRelay,
  formatDoseDurationSeconds,
  formatFlowRate,
  formatFlowRateMlPerMin,
  CALIBRATION_TEST_DURATIONS_SEC,
} from '@/lib/pump-calibration';
import { PhCalibrationSection } from '@/components/PhCalibrationSection';
import { useRelayAllocation } from '@/hooks/useRelayAllocation';
import { DoserRelaySelect } from '@/components/DoserRelaySelect';
import { DoserRelayMapPanel } from '@/components/DoserRelayMapPanel';

const STEPS = [
  {
    title: 'Prepare o circuito',
    body:
      'Instale a mangueira silicone correta no cabeçote da bomba. O líquido de calibragem (água ou nutriente diluído) deve estar na altura da bomba ou ligeiramente abaixo — evite sifão involuntário.',
  },
  {
    title: 'Faça o prime (purga de ar)',
    body:
      'Ligue a bomba manualmente até o líquido preencher toda a mangueira e sair na ponta de saída. Bolhas de ar reduzem a vazão real e invalidam a calibragem.',
  },
  {
    title: 'Colete uma amostra cronometrada',
    body:
      'Use proveta graduada ou balança (método gravimétrico: 1 ml ≈ 1 g para água). Deixe a bomba correr por um tempo fixo (30–60 s recomendado) e meça o volume coletado.',
  },
  {
    title: 'Calcule a vazão',
    body:
      'Divida o volume (ml) pelo tempo (s). Exemplo: 6 ml em 60 s → 0,100 ml/s (≈ 6 ml/min). Use a calculadora abaixo.',
  },
  {
    title: 'Salve e valide',
    body:
      'Aplique o valor no HydroWave. Faça um teste de dosagem curta (ex.: 5 ml) e confira na proveta se o volume real coincide.',
  },
];

export default function CalibragemPage() {
  const { userProfile } = useAuth();
  const { masters: devices } = useDevicesWithRealtime(userProfile?.email);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [flowRate, setFlowRate] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingRelay, setTestingRelay] = useState(false);

  const [measuredVolumeMl, setMeasuredVolumeMl] = useState<number>(10);
  const [measuredDurationSec, setMeasuredDurationSec] = useState<number>(60);
  const [testRelayNumber, setTestRelayNumber] = useState(0);
  const [testVolumeMl, setTestVolumeMl] = useState(5);
  const [relayOptions, setRelayOptions] = useState<Array<{ number: number; name: string }>>([]);
  const [activeTab, setActiveTab] = useState<'vazao' | 'ph'>('vazao');

  const calculatedRate = calculateFlowRateMlPerSecond(measuredVolumeMl, measuredDurationSec);

  const relayAllocation = useRelayAllocation(selectedDeviceId, {
    enabled: Boolean(selectedDeviceId),
    calibragemRelay: testingRelay ? testRelayNumber : null,
  });

  const calibragemRegistry = relayAllocation.buildRegistry({
    calibragemRelay: testingRelay ? testRelayNumber : null,
  });

  useEffect(() => {
    if (devices.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(devices[0].device_id);
    }
  }, [devices, selectedDeviceId]);

  const loadConfig = useCallback(async () => {
    if (!selectedDeviceId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/ec-controller/config?device_id=${encodeURIComponent(selectedDeviceId)}`
      );
      if (res.ok) {
        const config = await res.json();
        if (config.flow_rate !== undefined && !isNaN(config.flow_rate) && config.flow_rate > 0) {
          setFlowRate(config.flow_rate);
        }
      }
      const names = await getMasterLocalRelayNames(selectedDeviceId);
      const relays: Array<{ number: number; name: string }> = [];
      for (let i = 0; i <= 7; i++) {
        relays.push({ number: i, name: names.get(i) || `Relé ${i}` });
      }
      setRelayOptions(relays);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao carregar configuração');
    } finally {
      setLoading(false);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    if (selectedDeviceId) loadConfig();
  }, [selectedDeviceId, loadConfig]);

  const applyCalculatedRate = () => {
    if (calculatedRate === null) {
      toast.error('Informe volume e tempo válidos');
      return;
    }
    setFlowRate(Math.round(calculatedRate * 1000) / 1000);
    toast.success(`Vazão calculada: ${formatFlowRate(calculatedRate)}`);
  };

  const saveFlowRate = async () => {
    if (!selectedDeviceId || flowRate <= 0) {
      toast.error('Selecione um dispositivo e informe uma vazão válida');
      return;
    }
    setSaving(true);
    try {
      const getRes = await fetch(
        `/api/ec-controller/config?device_id=${encodeURIComponent(selectedDeviceId)}`
      );
      const existing = getRes.ok ? await getRes.json() : {};

      const res = await fetch('/api/ec-controller/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: selectedDeviceId,
          flow_rate: flowRate,
          base_dose: existing.base_dose,
          volume: existing.volume,
          total_ml: existing.total_ml,
          kp: existing.kp,
          ec_setpoint: existing.ec_setpoint,
          auto_enabled: existing.auto_enabled,
          intervalo_auto_ec: existing.intervalo_auto_ec,
          tempo_recirculacao: existing.tempo_recirculacao,
          nutrients: existing.nutrients,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao salvar');
      }

      hwToast.success('Vazão calibrada salva com sucesso', 'CALIBRAGEM');
      window.dispatchEvent(new CustomEvent('flowRateUpdated', { detail: { deviceId: selectedDeviceId, flowRate } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const runValidationDose = async () => {
    if (!selectedDeviceId || flowRate <= 0) return;
    const duration = calculateDoseDurationSeconds(testVolumeMl, flowRate);
    if (duration === null || duration <= 0) {
      toast.error('Volume ou vazão inválidos para teste');
      return;
    }
    const relaySeconds = doseDurationSecondsForRelay(duration);
    const durationLabel = formatDoseDurationSeconds(duration);
    setTestingRelay(true);
    try {
      const res = await fetch('/api/esp-now/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          master_device_id: selectedDeviceId,
          relay_number: testRelayNumber,
          action: 'on',
          duration_seconds: relaySeconds,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao enviar teste');
      }
      toast.success(
        `Teste enviado: ~${testVolumeMl} ml por ${durationLabel} s — meça na proveta`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro no teste');
    } finally {
      setTestingRelay(false);
    }
  };

  const selectedDevice = devices.find((d) => d.device_id === selectedDeviceId);

  return (
    <div className="min-h-screen bg-dark-bg">
      <header className="bg-dark-card border-b border-dark-border shadow-lg">
        <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-aqua-400 to-primary-400 bg-clip-text text-transparent flex items-center gap-2">
                <BeakerIcon className="w-7 h-7 text-aqua-400" />
                Calibragem
              </h1>
              <p className="text-dark-textSecondary mt-1 text-sm">
                Vazão das bombas (ml/s) e calibragem química pH+/pH−
              </p>
            </div>
            {devices.length > 0 && (
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="w-full sm:w-auto min-w-[200px] px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500"
              >
                {devices.map((d) => (
                  <option key={d.device_id} value={d.device_id}>
                    {d.device_name || d.device_id} {d.is_online ? '🟢' : '🔴'}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-8">
        <div className="flex gap-2 border-b border-dark-border pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('vazao')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === 'vazao'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/40 border-b-transparent -mb-px'
                : 'text-dark-textSecondary hover:text-cyan-400/80'
            }`}
          >
            Vazão EC / bombas
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ph')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === 'ph'
                ? 'bg-violet-500/10 text-violet-400 border border-violet-500/40 border-b-transparent -mb-px'
                : 'text-dark-textSecondary hover:text-violet-400/80'
            }`}
          >
            Calibragem química pH
          </button>
        </div>

        {activeTab === 'ph' ? (
          selectedDeviceId ? (
            <PhCalibrationSection deviceId={selectedDeviceId} relayOptions={relayOptions} />
          ) : (
            <p className="text-dark-textSecondary text-sm">Selecione um dispositivo.</p>
          )
        ) : (
          <>
        {/* Explicação */}
        <section className="bg-gradient-to-br from-cyan-500/10 to-sky-500/5 border border-cyan-500/30 rounded-xl p-5">
          <div className="flex gap-3">
            <InformationCircleIcon className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-dark-textSecondary space-y-2">
              <p>
                <strong className="text-dark-text">O que é a taxa de dosagem?</strong> É a vazão real
                da sua bomba peristáltica em <strong>mililitros por segundo (ml/s)</strong>. O HydroWave
                usa esse valor para converter &quot;dosar X ml&quot; em tempo de acionamento do relé.
              </p>
              <p>
                Bombas peristálticas variam com diâmetro da mangueira, desgaste, viscosidade do
                nutriente e altitude. Calibre após instalação, troca de mangueira ou quando notar
                desvio na dosagem.
              </p>
            </div>
          </div>
        </section>

        {/* Passos */}
        <section>
          <h2 className="text-lg font-semibold text-dark-text mb-4">Procedimento passo a passo</h2>
          <ol className="space-y-3">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="flex gap-4 bg-dark-card border border-dark-border rounded-lg p-4"
              >
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-medium text-dark-text">{step.title}</h3>
                  <p className="text-sm text-dark-textSecondary mt-1">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Calculadora */}
        <section className="bg-dark-card border border-dark-border border-t-2 border-t-cyan-500 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-cyan-400 mb-4">Calculadora de vazão</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-dark-textSecondary mb-1">
                Volume medido (ml)
              </label>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={measuredVolumeMl}
                onChange={(e) => setMeasuredVolumeMl(parseFloat(e.target.value) || 0)}
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text"
              />
            </div>
            <div>
              <label className="block text-sm text-dark-textSecondary mb-1">
                Tempo de coleta (segundos)
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={measuredDurationSec}
                onChange={(e) => setMeasuredDurationSec(parseInt(e.target.value, 10) || 0)}
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text"
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {CALIBRATION_TEST_DURATIONS_SEC.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setMeasuredDurationSec(sec)}
                    className={`text-xs px-2 py-1 rounded border ${
                      measuredDurationSec === sec
                        ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400'
                        : 'border-dark-border text-dark-textSecondary hover:border-cyan-500/50'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-dark-surface rounded-lg p-4 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-xs text-dark-textSecondary uppercase tracking-wide">Resultado</p>
              <p className="text-2xl font-bold text-cyan-400">
                {calculatedRate !== null ? formatFlowRate(calculatedRate) : '—'}
              </p>
              {calculatedRate !== null && (
                <p className="text-sm text-dark-textSecondary">
                  ≈ {formatFlowRateMlPerMin(calculatedRate)}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={applyCalculatedRate}
              disabled={calculatedRate === null}
              className="px-4 py-2 bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 rounded-lg hover:bg-cyan-500/30 disabled:opacity-40 text-sm font-medium"
            >
              Usar este valor
            </button>
          </div>

          <p className="text-xs text-dark-textSecondary">
            Fórmula: <code className="text-cyan-400">vazão (ml/s) = volume (ml) ÷ tempo (s)</code>
          </p>
        </section>

        {/* Valor final + salvar */}
        <section className="bg-dark-card border border-dark-border border-t-2 border-t-cyan-500 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-cyan-400 mb-4">Vazão calibrada do dispositivo</h2>
          {loading ? (
            <p className="text-dark-textSecondary text-sm">Carregando…</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="flowRate" className="block text-sm text-dark-textSecondary mb-1">
                    Taxa de dosagem (ml/segundo)
                  </label>
                  <input
                    id="flowRate"
                    type="number"
                    min={0.001}
                    step={0.0001}
                    value={flowRate}
                    onChange={(e) => setFlowRate(parseFloat(e.target.value) || 0)}
                    className="w-full p-3 bg-dark-surface border border-dark-border rounded-md text-dark-text text-lg font-mono"
                  />
                  <p className="text-xs text-dark-textSecondary mt-1">
                    Equivalente: {formatFlowRateMlPerMin(flowRate)}
                  </p>
                </div>
                <div className="flex flex-col justify-end">
                  <button
                    type="button"
                    onClick={saveFlowRate}
                    disabled={saving || flowRate <= 0}
                    className="w-full py-3 bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-600 hover:to-sky-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    ) : (
                      <CheckCircleIcon className="w-5 h-5" />
                    )}
                    Salvar calibragem
                  </button>
                  {selectedDevice && (
                    <p className="text-xs text-dark-textSecondary mt-2 text-center">
                      {selectedDevice.device_name || selectedDevice.device_id}
                    </p>
                  )}
                </div>
              </div>

              {/* Teste de validação */}
              <div className="border-t border-dark-border pt-4 mt-4">
                <h3 className="text-sm font-semibold text-dark-text mb-3">Validar com dosagem de teste</h3>
                <DoserRelayMapPanel registry={calibragemRegistry} />
                <p className="text-xs text-dark-textSecondary mb-3">
                  Envia um pulso curto ao relé escolhido. Meça o volume na proveta e compare com o
                  esperado. Repita o ajuste fino se necessário.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-dark-textSecondary mb-1">Relé (bomba)</label>
                    <DoserRelaySelect
                      registry={calibragemRegistry}
                      context={{ field: 'calibragem', currentValue: testRelayNumber }}
                      value={testRelayNumber}
                      onChange={setTestRelayNumber}
                      className="w-full p-2 bg-dark-surface border border-dark-border rounded-md text-sm text-dark-text"
                      emptyMessage="Nenhum relé livre para teste. Libere relés em /automacao."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-dark-textSecondary mb-1">Volume teste (ml)</label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={testVolumeMl}
                      onChange={(e) => setTestVolumeMl(parseFloat(e.target.value) || 5)}
                      className="w-full p-2 bg-dark-surface border border-dark-border rounded-md text-sm text-dark-text"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={runValidationDose}
                      disabled={testingRelay || !selectedDevice?.is_online}
                      className="w-full py-2 border border-cyan-500/40 text-cyan-400 rounded-lg hover:bg-cyan-500/10 disabled:opacity-40 text-sm flex items-center justify-center gap-2"
                    >
                      <PlayIcon className="w-4 h-4" />
                      {testingRelay ? 'Enviando…' : 'Dosar teste'}
                    </button>
                  </div>
                </div>
                {!selectedDevice?.is_online && (
                  <p className="text-xs text-amber-400 mt-2">Dispositivo offline — teste indisponível</p>
                )}
              </div>
            </>
          )}
        </section>

        {/* Quando recalibrar */}
        <section className="text-sm text-dark-textSecondary border border-dark-border rounded-xl p-5">
          <h2 className="font-semibold text-dark-text mb-2">Quando recalibrar?</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Primeira instalação ou troca de mangueira / cabeçote</li>
            <li>Troca de nutriente com viscosidade diferente</li>
            <li>Após mais de 4 h de operação contínua (deriva térmica)</li>
            <li>Desvio visível entre volume esperado e medido na proveta</li>
          </ul>
          <p className="mt-4">
            <NavLink href="/automacao" className="text-aqua-400 hover:underline">
              ← Voltar para Automação
            </NavLink>
            {' · '}
            A vazão calibrada é usada no controle de EC, nutrição e bombas pH (se calibradas na aba pH).
          </p>
        </section>
          </>
        )}
      </div>
    </div>
  );
}
