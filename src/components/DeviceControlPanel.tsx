'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { DeviceStatus } from '@/lib/automation';
import { resolveDeviceOnline } from '@/lib/realtime/device-status';
import { HW_TEXT } from '@/lib/design-tokens';
import { useAuth } from '@/contexts/AuthContext';
import { getDeviceAnalytics, DosageMetrics } from '@/lib/analytics';
import BrandLoading from '@/components/BrandLoading';
import toast from 'react-hot-toast';
import { HwModal } from '@/components/ui/HwModal';

interface DeviceControlPanelProps {
  device: DeviceStatus;
  isOpen: boolean;
  onClose: () => void;
}

export default function DeviceControlPanel({ device, isOpen, onClose }: DeviceControlPanelProps) {
  const { userProfile } = useAuth();
  const isOnline = resolveDeviceOnline(device);

  const [analytics, setAnalytics] = useState<DosageMetrics[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsDays, setAnalyticsDays] = useState(7);
  const [rebooting, setRebooting] = useState(false);

  const loadAnalytics = useCallback(async () => {
    if (!device.device_id) {
      return;
    }

    setLoadingAnalytics(true);
    try {
      const analyticsData = await getDeviceAnalytics(device.device_id, analyticsDays);
      setAnalytics(analyticsData.metrics);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Erro ao carregar analytics:', error);
      }
      setAnalytics([]);
    } finally {
      setLoadingAnalytics(false);
    }
  }, [device.device_id, analyticsDays]);

  useEffect(() => {
    if (isOpen && device.device_id) {
      loadAnalytics();
    }
  }, [isOpen, device.device_id, loadAnalytics]);

  const handleReboot = async () => {
    if (!device.device_id || !userProfile?.email) {
      toast.error('Dados do dispositivo ou usuário não disponíveis');
      return;
    }

    if (
      !confirm(
        `Tem certeza que deseja reiniciar o dispositivo "${device.device_name || device.device_id}"?\n\nO dispositivo será reiniciado e o contador de reinícios será incrementado.`
      )
    ) {
      return;
    }

    setRebooting(true);
    try {
      const response = await fetch('/api/device/reboot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: device.device_id,
          user_email: userProfile.email,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao reiniciar dispositivo');
      }

      const result = await response.json();
      toast.success(`✅ Comando de reinício enviado! (Total: ${result.reboot_count} reinícios)`);

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Erro ao reiniciar dispositivo:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao reiniciar dispositivo');
    } finally {
      setRebooting(false);
    }
  };

  return (
    <HwModal
      open={isOpen}
      onClose={onClose}
      title={device.device_name || device.device_id}
      size="full"
    >
      <p className="text-dark-textSecondary text-sm mb-4">
        {device.location || 'Localização não especificada'}
      </p>

      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
            <p className="text-sm text-dark-textSecondary mb-1">Status</p>
            <p className={`text-lg font-bold ${isOnline ? HW_TEXT.ok : HW_TEXT.danger}`}>
              {isOnline ? 'Online' : 'Offline'}
            </p>
          </div>
          <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
            <p className="text-sm text-dark-textSecondary mb-1">Última Conexão</p>
            <p className="text-lg font-bold text-dark-text">
              {device.last_seen ? new Date(device.last_seen).toLocaleString('pt-BR') : 'N/A'}
            </p>
          </div>
          <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
            <p className="text-sm text-dark-textSecondary mb-1">IP Address</p>
            <p className="text-lg font-bold text-dark-text font-mono">
              {device.ip_address || 'N/A'}
            </p>
          </div>
          <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
            <p className="text-sm text-dark-textSecondary mb-1">Firmware</p>
            <p className="text-lg font-bold text-dark-text">
              {device.firmware_version || 'N/A'}
            </p>
          </div>
        </div>

        {device.free_heap !== undefined && device.free_heap !== null && (
          <div className="bg-dark-card border border-dark-border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-dark-text mb-4 flex items-center gap-2">
              🔧 Debug de Memória
              {(() => {
                const totalHeap = 300000;
                const freeHeap = device.free_heap;
                const freePercent = (freeHeap / totalHeap) * 100;
                const isLowMemory = freePercent < 20;
                const isWarning = freePercent < 30;

                return (
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      isLowMemory
                        ? 'bg-red-500/20 text-red-400'
                        : isWarning
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-green-500/20 text-green-400'
                    }`}
                  >
                    {isLowMemory ? '⚠️ Crítico' : isWarning ? '⚠️ Atenção' : '✅ OK'}
                  </span>
                );
              })()}
            </h3>

            {(() => {
              const totalHeap = 300000;
              const freeHeap = device.free_heap;
              const usedHeap = totalHeap - freeHeap;
              const freePercent = (freeHeap / totalHeap) * 100;
              const isLowMemory = freePercent < 20;
              const isWarning = freePercent < 30;

              return (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-dark-textSecondary">Memória Livre</span>
                      <span
                        className={`text-lg font-bold ${
                          isLowMemory
                            ? 'text-red-400'
                            : isWarning
                              ? 'text-yellow-400'
                              : 'text-aqua-400'
                        }`}
                      >
                        {freePercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-dark-border rounded-full h-4 mb-2">
                      <div
                        className={`h-4 rounded-full transition-all ${
                          isLowMemory ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-aqua-500'
                        }`}
                        style={{ width: `${freePercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-dark-textSecondary">
                      <span>Livre: {freeHeap.toLocaleString()} bytes</span>
                      <span>Usada: {usedHeap.toLocaleString()} bytes</span>
                      <span>Total: {totalHeap.toLocaleString()} bytes</span>
                    </div>
                  </div>

                  {(isLowMemory || isWarning) && (
                    <div
                      className={`border rounded-lg p-4 ${
                        isLowMemory
                          ? 'bg-red-500/10 border-red-500/30'
                          : 'bg-yellow-500/10 border-yellow-500/30'
                      }`}
                    >
                      <h4
                        className={`font-semibold mb-2 ${
                          isLowMemory ? 'text-red-400' : 'text-yellow-400'
                        }`}
                      >
                        {isLowMemory ? '⚠️ Memória Crítica!' : '⚠️ Memória Baixa'}
                      </h4>
                      <ul className="space-y-2 text-sm text-dark-textSecondary">
                        <li className="flex items-start gap-2">
                          <span>•</span>
                          <span>Reduza o número de regras ativas</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span>•</span>
                          <span>Aumente o intervalo de avaliação das regras</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span>•</span>
                          <span>Limpe logs antigos do sistema</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span>•</span>
                          <span>Verifique vazamentos de memória no código</span>
                        </li>
                        {device.total_rules !== undefined && (
                          <li className="flex items-start gap-2">
                            <span>•</span>
                            <span>
                              Regras ativas:{' '}
                              <strong className="text-dark-text">{device.total_rules}</strong>
                            </span>
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    {device.uptime_seconds !== undefined && (
                      <div className="bg-dark-surface border border-dark-border rounded p-3">
                        <p className="text-dark-textSecondary mb-1">Uptime</p>
                        <p className="font-bold text-dark-text">
                          {Math.floor(device.uptime_seconds / 3600)}h{' '}
                          {Math.floor((device.uptime_seconds % 3600) / 60)}m
                        </p>
                      </div>
                    )}
                    {device.reboot_count !== undefined && device.reboot_count !== null && (
                      <div className="bg-dark-surface border border-dark-border rounded p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-dark-textSecondary">🔄 Reinícios</p>
                          <button
                            onClick={handleReboot}
                            disabled={rebooting || !isOnline}
                            className="p-1.5 hover:bg-dark-border rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Reiniciar dispositivo"
                          >
                            <ArrowPathIcon
                              className={`w-4 h-4 text-aqua-400 ${rebooting ? 'animate-spin' : ''}`}
                            />
                          </button>
                        </div>
                        <p
                          className={`font-bold ${
                            device.reboot_count === 0
                              ? 'text-green-400'
                              : device.reboot_count < 10
                                ? 'text-yellow-400'
                                : 'text-red-400'
                          }`}
                        >
                          {device.reboot_count.toLocaleString()}
                        </p>
                        <p className="text-xs text-dark-textSecondary mt-1">
                          {device.reboot_count === 0
                            ? 'Estável'
                            : device.reboot_count < 10
                              ? 'Atenção'
                              : 'Crítico'}
                        </p>
                      </div>
                    )}
                    {device.total_rules !== undefined && (
                      <div className="bg-dark-surface border border-dark-border rounded p-3">
                        <p className="text-dark-textSecondary mb-1">Regras Totais</p>
                        <p className="font-bold text-dark-text">{device.total_rules}</p>
                      </div>
                    )}
                    {device.total_evaluations !== undefined && (
                      <div className="bg-dark-surface border border-dark-border rounded p-3">
                        <p className="text-dark-textSecondary mb-1">Avaliações</p>
                        <p className="font-bold text-dark-text">
                          {device.total_evaluations.toLocaleString()}
                        </p>
                      </div>
                    )}
                    {device.last_evaluation && (
                      <div className="bg-dark-surface border border-dark-border rounded p-3">
                        <p className="text-dark-textSecondary mb-1">Última Avaliação</p>
                        <p className="font-bold text-dark-text text-xs">
                          {new Date(device.last_evaluation).toLocaleTimeString('pt-BR')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        <div className="mt-6 bg-dark-card border border-dark-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-dark-text">📊 Analytics de Dosagem</h3>
            <div className="flex items-center space-x-2">
              <select
                value={analyticsDays}
                onChange={(e) => setAnalyticsDays(parseInt(e.target.value))}
                className="px-3 py-1 bg-dark-surface border border-dark-border rounded text-dark-text text-sm focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
              >
                <option value={1}>Último dia</option>
                <option value={7}>Últimos 7 dias</option>
                <option value={30}>Últimos 30 dias</option>
                <option value={90}>Últimos 90 dias</option>
              </select>
              <button
                onClick={loadAnalytics}
                disabled={loadingAnalytics}
                className="px-3 py-1 bg-aqua-600 hover:bg-aqua-700 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loadingAnalytics ? '⏳' : '🔄'}
              </button>
            </div>
          </div>

          {loadingAnalytics ? (
            <BrandLoading message="Calculando métricas..." size={40} />
          ) : analytics.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-dark-textSecondary">
                Nenhuma dosagem registrada nos últimos {analyticsDays}{' '}
                {analyticsDays === 1 ? 'dia' : 'dias'}
              </p>
              <p className="text-dark-textSecondary/70 text-sm mt-2">
                Comandos de relé concluídos aparecerão aqui automaticamente
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {analytics.map((metric) => (
                <div
                  key={metric.relay_id}
                  className="bg-dark-surface border border-dark-border rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-dark-text">{metric.relay_name}</h4>
                    <span className="text-2xl font-bold text-aqua-400">
                      {metric.total_ml_dosed.toFixed(1)} ml
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-dark-textSecondary">Ativações</p>
                      <p className="font-medium text-dark-text">{metric.total_activations}</p>
                    </div>
                    <div>
                      <p className="text-dark-textSecondary">Tempo Total</p>
                      <p className="font-medium text-dark-text">
                        {Math.floor(metric.total_duration_seconds / 60)} min
                      </p>
                    </div>
                    <div>
                      <p className="text-dark-textSecondary">Última Ativação</p>
                      <p className="font-medium text-dark-text text-xs">
                        {metric.last_activation
                          ? new Date(metric.last_activation).toLocaleDateString('pt-BR')
                          : 'Nunca'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              <div className="bg-aqua-500/10 border border-aqua-500/30 rounded-lg p-4 mt-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-dark-text">Total Geral</p>
                  <p className="text-2xl font-bold text-aqua-400">
                    {analytics.reduce((sum, m) => sum + m.total_ml_dosed, 0).toFixed(1)} ml
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </HwModal>
  );
}
