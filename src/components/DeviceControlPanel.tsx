'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { DeviceStatus } from '@/lib/automation';
import { resolveDeviceOnline } from '@/lib/realtime/device-status';
import { HW_TEXT } from '@/lib/design-tokens';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toBcp47 } from '@/lib/locale';
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
  const { t, locale } = useLanguage();
  const p = t.dispositivos.panel;
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
      toast.error(p.toastRebootMissingData);
      return;
    }

    if (
      !confirm(
        p.rebootConfirm.replace('{name}', device.device_name || device.device_id)
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
        throw new Error(error.error || p.toastRebootError);
      }

      const result = await response.json();
      toast.success(
        p.toastRebootSuccess.replace(
          '{count}',
          String(result.reboot_count)
        )
      );

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Erro ao reiniciar dispositivo:', error);
      toast.error(error instanceof Error ? error.message : p.toastRebootError);
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
        {device.location || p.locationFallback}
      </p>

      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
            <p className="text-sm text-dark-textSecondary mb-1">{p.status}</p>
            <p className={`text-lg font-bold ${isOnline ? HW_TEXT.ok : HW_TEXT.danger}`}>
              {isOnline ? t.common.online : t.common.offline}
            </p>
          </div>
          <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
            <p className="text-sm text-dark-textSecondary mb-1">{p.lastConnection}</p>
            <p className="text-lg font-bold text-dark-text">
              {device.last_seen
                ? new Date(device.last_seen).toLocaleString(toBcp47(locale))
                : p.na}
            </p>
          </div>
          <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
            <p className="text-sm text-dark-textSecondary mb-1">{p.ipAddress}</p>
            <p className="text-lg font-bold text-dark-text font-mono">
              {device.ip_address || p.na}
            </p>
          </div>
          <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
            <p className="text-sm text-dark-textSecondary mb-1">{p.firmware}</p>
            <p className="text-lg font-bold text-dark-text">
              {device.firmware_version || p.na}
            </p>
          </div>
        </div>

        {device.free_heap !== undefined && device.free_heap !== null && (
          <div className="bg-dark-card border border-dark-border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-dark-text mb-4 flex items-center gap-2">
              {p.memoryDebugTitle}
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
                    {isLowMemory
                      ? p.memoryBadgeCritical
                      : isWarning
                        ? p.memoryBadgeWarning
                        : p.memoryBadgeOk}
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
              const loc = toBcp47(locale);

              return (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-dark-textSecondary">{p.freeMemoryLabel}</span>
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
                      <span>{p.freeBytes.replace('{n}', freeHeap.toLocaleString(loc))}</span>
                      <span>{p.usedBytes.replace('{n}', usedHeap.toLocaleString(loc))}</span>
                      <span>{p.totalBytes.replace('{n}', totalHeap.toLocaleString(loc))}</span>
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
                        {isLowMemory ? p.memoryCriticalTitle : p.memoryLowTitle}
                      </h4>
                      <ul className="space-y-2 text-sm text-dark-textSecondary">
                        <li className="flex items-start gap-2">
                          <span>•</span>
                          <span>{p.tipReduceRules}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span>•</span>
                          <span>{p.tipIncreaseInterval}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span>•</span>
                          <span>{p.tipClearLogs}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span>•</span>
                          <span>{p.tipCheckLeaks}</span>
                        </li>
                        {device.total_rules !== undefined && (
                          <li className="flex items-start gap-2">
                            <span>•</span>
                            <span>
                              {p.activeRules.replace('{n}', String(device.total_rules))}
                            </span>
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    {device.uptime_seconds !== undefined && (
                      <div className="bg-dark-surface border border-dark-border rounded p-3">
                        <p className="text-dark-textSecondary mb-1">{p.uptime}</p>
                        <p className="font-bold text-dark-text">
                          {p.uptimeFormat
                            .replace('{h}', String(Math.floor(device.uptime_seconds / 3600)))
                            .replace(
                              '{m}',
                              String(Math.floor((device.uptime_seconds % 3600) / 60))
                            )}
                        </p>
                      </div>
                    )}
                    {device.reboot_count !== undefined && device.reboot_count !== null && (
                      <div className="bg-dark-surface border border-dark-border rounded p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-dark-textSecondary">{t.dispositivos.reboots}</p>
                          <button
                            onClick={handleReboot}
                            disabled={rebooting || !isOnline}
                            className="p-1.5 hover:bg-dark-border rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={p.rebootTitle}
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
                          {device.reboot_count.toLocaleString(toBcp47(locale))}
                        </p>
                        <p className="text-xs text-dark-textSecondary mt-1">
                          {device.reboot_count === 0
                            ? p.rebootStable
                            : device.reboot_count < 10
                              ? p.rebootAttention
                              : p.rebootCritical}
                        </p>
                      </div>
                    )}
                    {device.total_rules !== undefined && (
                      <div className="bg-dark-surface border border-dark-border rounded p-3">
                        <p className="text-dark-textSecondary mb-1">{p.totalRules}</p>
                        <p className="font-bold text-dark-text">{device.total_rules}</p>
                      </div>
                    )}
                    {device.total_evaluations !== undefined && (
                      <div className="bg-dark-surface border border-dark-border rounded p-3">
                        <p className="text-dark-textSecondary mb-1">{p.evaluations}</p>
                        <p className="font-bold text-dark-text">
                          {device.total_evaluations.toLocaleString(toBcp47(locale))}
                        </p>
                      </div>
                    )}
                    {device.last_evaluation && (
                      <div className="bg-dark-surface border border-dark-border rounded p-3">
                        <p className="text-dark-textSecondary mb-1">{p.lastEvaluation}</p>
                        <p className="font-bold text-dark-text text-xs">
                          {new Date(device.last_evaluation).toLocaleTimeString(toBcp47(locale))}
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
            <h3 className="text-lg font-semibold text-dark-text">{p.analyticsTitle}</h3>
            <div className="flex items-center space-x-2">
              <select
                value={analyticsDays}
                onChange={(e) => setAnalyticsDays(parseInt(e.target.value))}
                className="px-3 py-1 bg-dark-surface border border-dark-border rounded text-dark-text text-sm focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
              >
                <option value={1}>{p.periodLastDay}</option>
                <option value={7}>{p.periodLast7Days}</option>
                <option value={30}>{p.periodLast30Days}</option>
                <option value={90}>{p.periodLast90Days}</option>
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
            <BrandLoading message={t.common.calculatingMetrics} size={40} />
          ) : analytics.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-dark-textSecondary">
                {p.noDosage
                  .replace('{n}', String(analyticsDays))
                  .replace('{unit}', analyticsDays === 1 ? p.dayUnit : p.daysUnit)}
              </p>
              <p className="text-dark-textSecondary/70 text-sm mt-2">
                {p.noDosageHint}
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
                      <p className="text-dark-textSecondary">{p.activations}</p>
                      <p className="font-medium text-dark-text">{metric.total_activations}</p>
                    </div>
                    <div>
                      <p className="text-dark-textSecondary">{p.totalTime}</p>
                      <p className="font-medium text-dark-text">
                        {Math.floor(metric.total_duration_seconds / 60)} {p.minutesUnit}
                      </p>
                    </div>
                    <div>
                      <p className="text-dark-textSecondary">{p.lastActivation}</p>
                      <p className="font-medium text-dark-text text-xs">
                        {metric.last_activation
                          ? new Date(metric.last_activation).toLocaleDateString(toBcp47(locale))
                          : p.never}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              <div className="bg-aqua-500/10 border border-aqua-500/30 rounded-lg p-4 mt-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-dark-text">{p.grandTotal}</p>
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
