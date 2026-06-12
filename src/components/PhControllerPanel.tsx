'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  LockClosedIcon,
  LockOpenIcon,
} from '@heroicons/react/24/outline';
import { supabase } from '@/lib/supabase';
import { usePhOperationState } from '@/hooks/usePhOperationState';
import { formatFlowRate } from '@/lib/pump-calibration';

interface RelayOption {
  number: number;
  name: string;
}

interface PhControllerPanelProps {
  deviceId: string;
  currentPh: number | null;
  availableRelays: RelayOption[];
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
        toast.success(isLocked ? `✅ ${sectionName} desbloqueado` : `🔒 ${sectionName} bloqueado`);
      } else {
        toast.error('Senha incorreta!', { id: 'ph-password-error' });
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
  availableRelays,
}: PhControllerPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [locked, setLocked] = useState(true);
  const justSavedRef = useRef(false);

  const [phSetpoint, setPhSetpoint] = useState(6.0);
  const [phTolerance, setPhTolerance] = useState(0.2);
  const [flowRatePhUp, setFlowRatePhUp] = useState(1.0);
  const [flowRatePhDown, setFlowRatePhDown] = useState(1.0);
  const [volume, setVolume] = useState(100);
  const [mlPerPhUnit, setMlPerPhUnit] = useState(2.0);
  const [relayPhUp, setRelayPhUp] = useState(1);
  const [relayPhDown, setRelayPhDown] = useState(0);
  const [intervaloAutoPh, setIntervaloAutoPh] = useState(300);
  const [tempoRecirculacao, setTempoRecirculacao] = useState(60);
  const [autoEnabled, setAutoEnabled] = useState(false);

  const phOp = usePhOperationState(deviceId, Boolean(deviceId), {
    intervalCeilingSec: intervaloAutoPh,
    autoEnabled,
  });

  const loadConfig = useCallback(async () => {
    if (!deviceId || justSavedRef.current) return;
    try {
      const res = await fetch(`/api/ph-controller/config?device_id=${encodeURIComponent(deviceId)}`);
      if (!res.ok) return;
      const data = await res.json();
      setPhSetpoint(Number(data.ph_setpoint) || 6.0);
      setPhTolerance(Number(data.ph_tolerance) || 0.2);
      setFlowRatePhUp(Number(data.flow_rate_ph_up) || 1.0);
      setFlowRatePhDown(Number(data.flow_rate_ph_down) || 1.0);
      setVolume(Number(data.volume) || 100);
      setMlPerPhUnit(Number(data.ml_per_ph_unit) || 2.0);
      setRelayPhUp(Number(data.relay_ph_up) ?? 1);
      setRelayPhDown(Number(data.relay_ph_down) ?? 0);
      setIntervaloAutoPh(Number(data.intervalo_auto_ph) || 300);
      setTempoRecirculacao(Number(data.tempo_recirculacao) || 60);
      setAutoEnabled(Boolean(data.auto_enabled));
    } catch (err) {
      console.error('[PH Controller] load error', err);
    }
  }, [deviceId]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const saveConfig = useCallback(async (silent = false) => {
    if (!deviceId) return false;
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
          ml_per_ph_unit: mlPerPhUnit,
          relay_ph_up: relayPhUp,
          relay_ph_down: relayPhDown,
          intervalo_auto_ph: intervaloAutoPh,
          tempo_recirculacao: tempoRecirculacao,
          auto_enabled: autoEnabled,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao salvar');
      }
      justSavedRef.current = true;
      setTimeout(() => { justSavedRef.current = false; }, 2000);
      if (!silent) toast.success('Parâmetros pH salvos');
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar pH');
      return false;
    }
  }, [
    deviceId, phSetpoint, phTolerance, flowRatePhUp, flowRatePhDown,
    volume, mlPerPhUnit, relayPhUp, relayPhDown, intervaloAutoPh,
    tempoRecirculacao, autoEnabled,
  ]);

  const toggleAutoPh = async () => {
    if (!deviceId) return;
    const next = !autoEnabled;
    if (next) {
      const saved = await saveConfig(true);
      if (!saved) return;
      const { error } = await supabase.rpc('activate_auto_ph', { p_device_id: deviceId });
      if (error) {
        toast.error(`Erro ao ativar Auto pH: ${error.message}`);
        return;
      }
      setAutoEnabled(true);
      toast.success('Auto pH ativado');
    } else {
      const { error } = await supabase
        .from('ph_config_view')
        .update({ auto_enabled: false, updated_at: new Date().toISOString() })
        .eq('device_id', deviceId);
      if (error) {
        toast.error(`Erro ao desativar: ${error.message}`);
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
      toast.success('Auto pH desativado');
    }
  };

  const phError =
    currentPh != null ? phSetpoint - currentPh : null;

  const disabled = locked;

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg overflow-hidden mb-6">
      <div
        onClick={() => setExpanded(!expanded)}
        className="w-full p-6 flex items-center justify-between hover:bg-dark-surface transition-colors cursor-pointer"
      >
        <div className="flex items-center space-x-3">
          {expanded ? (
            <ChevronUpIcon className="w-5 h-5 text-violet-400" />
          ) : (
            <ChevronDownIcon className="w-5 h-5 text-dark-textSecondary" />
          )}
          <h3 className="text-lg font-semibold text-dark-text">
            🧪 Controle Automático de pH
          </h3>
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
            Controle proporcional bidirecional (pH+ / pH-) com setpoint e tolerância.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
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
              <label className="block text-sm text-dark-textSecondary mb-1">pH atual</label>
              <div className="p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text">
                {currentPh != null ? currentPh.toFixed(2) : '—'}
                {phError != null && (
                  <span className="ml-2 text-xs text-dark-textSecondary">
                    (erro {phError > 0 ? '+' : ''}{phError.toFixed(2)})
                  </span>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm text-dark-textSecondary mb-1">Relé pH+</label>
              <select
                value={relayPhUp}
                disabled={disabled}
                onChange={(e) => setRelayPhUp(parseInt(e.target.value, 10))}
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text disabled:opacity-50"
              >
                {availableRelays.map((r) => (
                  <option key={r.number} value={r.number}>{r.number}: {r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-dark-textSecondary mb-1">Relé pH-</label>
              <select
                value={relayPhDown}
                disabled={disabled}
                onChange={(e) => setRelayPhDown(parseInt(e.target.value, 10))}
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text disabled:opacity-50"
              >
                {availableRelays.map((r) => (
                  <option key={r.number} value={r.number}>{r.number}: {r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-dark-textSecondary mb-1">ml/unidade pH</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={mlPerPhUnit}
                disabled={disabled}
                onChange={(e) => setMlPerPhUnit(parseFloat(e.target.value) || 2)}
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm text-dark-textSecondary mb-1">Vazão pH+</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={flowRatePhUp}
                disabled={disabled}
                onChange={(e) => setFlowRatePhUp(parseFloat(e.target.value) || 1)}
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text disabled:opacity-50"
              />
              <span className="text-xs text-dark-textSecondary">{formatFlowRate(flowRatePhUp)}</span>
            </div>
            <div>
              <label className="block text-sm text-dark-textSecondary mb-1">Vazão pH-</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={flowRatePhDown}
                disabled={disabled}
                onChange={(e) => setFlowRatePhDown(parseFloat(e.target.value) || 1)}
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text disabled:opacity-50"
              />
              <span className="text-xs text-dark-textSecondary">{formatFlowRate(flowRatePhDown)}</span>
            </div>
            <div>
              <Link href="/calibragem" className="text-sm text-violet-400 hover:underline">
                Calibrar bombas → /calibragem
              </Link>
            </div>
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

          <div className="mb-6 p-4 bg-dark-surface border border-dark-border rounded-lg" aria-live="polite">
            <h4 className="text-sm font-semibold text-dark-text mb-2">Status</h4>
            {autoEnabled ? (
              <div className="space-y-1 text-sm text-dark-textSecondary">
                {phOp.isDosando && (
                  <p className="text-violet-400 animate-pulse">Dosando pH… ({phOp.operationRemainingSec}s)</p>
                )}
                {phOp.isAguardandoRecirculacao && (
                  <p>Recirculando… ({phOp.operationRemainingSec}s)</p>
                )}
                {phOp.isPhCheckPending && phOp.nextCheckInSec > 0 && (
                  <p>Próxima verificação em {phOp.nextCheckInSec}s</p>
                )}
                {phOp.state === 'idle' && !phOp.isDosando && phOp.nextCheckInSec <= 0 && (
                  <p>Aguardando próximo ciclo</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-dark-textSecondary">Auto pH desativado</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              disabled={disabled}
              onClick={() => saveConfig()}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg disabled:opacity-50"
            >
              Salvar Parâmetros
            </button>
            <button
              disabled={disabled}
              onClick={toggleAutoPh}
              className={`px-4 py-2 rounded-lg text-white disabled:opacity-50 ${
                autoEnabled ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {autoEnabled ? 'Desativar Auto pH' : 'Ativar Auto pH'}
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
                toast.error('🚨 Reset emergencial pH');
              }}
              className="px-4 py-2 bg-red-800 hover:bg-red-900 text-white rounded-lg disabled:opacity-50"
            >
              🚨 RESET EMERGENCIAL
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
