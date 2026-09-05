'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { HydroMeasurement, EnvironmentMeasurement } from '@/lib/supabase';
import { subscribeSensorMeasurements } from '@/lib/realtime/sensor-measurements';
import {
  appendToHistoryDesc,
  CHART_HISTORY_FALLBACK_MS,
  HYDRO_CHART_RAW_LIMIT,
} from '@/lib/realtime/chart-history';
import { setVisibleInterval } from '@/lib/realtime/visible-interval';
import { getPollingInterval, loadSettings, saveSettings, type Settings } from '@/lib/settings';
import { hasHydroSensorReading } from '@/lib/realtime/hydro-ph';
import {
  emptyHydroLiveState,
  mergeHydroLiveState,
  resolveLiveEcForDisplay,
  resolveLivePhForDisplay,
  resolveLiveTemperatureForDisplay,
  type HydroLiveState,
} from '@/lib/realtime/hydro-freshness';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toBcp47 } from '@/lib/locale';
import { useDevicesWithRealtime } from '@/hooks/useDevicesWithRealtime';
import QuemSomosTeaser from '@/components/QuemSomosTeaser';
import { DashboardChartsSection } from '@/components/dashboard/DashboardChartsSection';
import { DashboardSensorsSection } from '@/components/dashboard/DashboardSensorsSection';
import {
  DashboardAutoControlSection,
  DashboardCropSection,
} from '@/components/dashboard/DashboardAutoControlSection';
import { 
  AdjustmentsHorizontalIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

export default function DashboardPage() {
  const { userProfile } = useAuth();
  const { t, locale } = useLanguage();
  const d = t.dashboard;
  const userEmail = userProfile?.email || '';
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const { devices } = useDevicesWithRealtime(userEmail || undefined);
  const [hydroLive, setHydroLive] = useState<HydroLiveState>(emptyHydroLiveState());
  const hydroData = hydroLive.row;
  const hydroSensorUpdatedAt = hydroLive.sensorUpdatedAt;
  const [environmentData, setEnvironmentData] = useState<EnvironmentMeasurement | null>(null);
  const [hydroHistory, setHydroHistory] = useState<HydroMeasurement[]>([]);
  const [envHistory, setEnvHistory] = useState<EnvironmentMeasurement[]>([]);
  
  // ✅ Estados de loading separados para carga progresiva
  const [loadingSensors, setLoadingSensors] = useState(true);
  const [loadingCharts, setLoadingCharts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // ✅ Estados para configuração de umbrales de EC
  const [ecThresholds, setEcThresholds] = useState({
    dangerMin: 250,
    dangerMax: 750,
    warningMin: 400,
    warningMax: 600,
  });
  const [showECConfig, setShowECConfig] = useState(false);
  const [savingECConfig, setSavingECConfig] = useState(false);
  
  // ✅ Estados para configuração de umbrales de otros sensores
  const [showTempConfig, setShowTempConfig] = useState(false);
  const [showPHConfig, setShowPHConfig] = useState(false);

  useEffect(() => {
    if (devices.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(devices[0].device_id);
      console.log('✅ [DASHBOARD] Dispositivo selecionado:', devices[0].device_id);
    }
  }, [devices, selectedDeviceId]);

  // ✅ Carregar umbrales de EC das configurações
  useEffect(() => {
    const loadECThresholds = async () => {
      if (!userEmail) return;
      
      try {
        const settings = await loadSettings(userEmail);
        if (settings.ecThresholds) {
          setEcThresholds(settings.ecThresholds);
          console.log('✅ [DASHBOARD] Umbrales de EC carregados:', settings.ecThresholds);
        }
      } catch (error) {
        console.warn('⚠️ [DASHBOARD] Erro ao carregar umbrales de EC, usando padrão:', error);
      }
    };

    loadECThresholds();
  }, [userEmail]);

  const applyHydroRow = (data: unknown, prev: HydroLiveState): HydroLiveState => {
    const row = parseHydroRow(data);
    if (!row) return prev;
    return mergeHydroLiveState(prev, row);
  };

  const parseHydroRow = (data: unknown): HydroMeasurement | null => {
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      const hasAny =
        obj.water_level_ok !== undefined ||
        obj.level_1 !== undefined ||
        obj.ph_raw !== undefined ||
        obj.temperature !== undefined ||
        obj.ph !== undefined ||
        obj.tds !== undefined ||
        obj.ec !== undefined ||
        obj.ec_raw !== undefined ||
        obj.levels_simulated !== undefined;
      if (hasAny) {
        return data as HydroMeasurement;
      }
    }
    return null;
  };

  // Mantido por compat — alias de parseHydroRow
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const validateHydroData = (data: unknown): HydroMeasurement | null => parseHydroRow(data);

  // ✅ Función para validar datos ambientales
  const validateEnvData = (data: unknown): EnvironmentMeasurement | null => {
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      const hasValidData = obj.temperature !== undefined || obj.humidity !== undefined;
      if (hasValidData) {
        return data as EnvironmentMeasurement;
      }
    }
    return null;
  };

  // ✅ Cargar datos críticos primero (sensores) - carga paralela
  const fetchSensorData = async (deviceId: string) => {
    if (!deviceId) return;
    console.log('🔄 [DASHBOARD] Cargando sensores para', deviceId);
    setLoadingSensors(true);
    try {
      const q = encodeURIComponent(deviceId);
      const [hydroRes, envRes] = await Promise.all([
        fetch(`/api/hydro-data?device_id=${q}`),
        fetch(`/api/environment-data?device_id=${q}`),
      ]);

      // Procesar datos hidropónicos
      if (hydroRes.ok) {
        const hydroJson = await hydroRes.json();
        setHydroLive((prev) => applyHydroRow(hydroJson, prev));
        console.log('✅ [DASHBOARD] Dados hidropônicos carregados');
        const snapshot = applyHydroRow(hydroJson, emptyHydroLiveState());
        if (snapshot.row) {
          const ecValue = resolveLiveEcForDisplay(snapshot.row, snapshot.sensorUpdatedAt);
          console.log('🔍 [DASHBOARD] EC para card:', ecValue);
        }
      } else {
        console.warn(`⚠️ [DASHBOARD] Erro ao buscar hydro-data: ${hydroRes.status}`);
        setHydroLive(emptyHydroLiveState());
      }

      // Procesar datos ambientales
      if (envRes.ok) {
        const envData = await envRes.json();
        const validated = validateEnvData(envData);
        setEnvironmentData(validated);
        console.log('✅ [DASHBOARD] Dados ambientais carregados');
      } else {
        console.warn(`⚠️ [DASHBOARD] Erro ao buscar environment-data: ${envRes.status}`);
        setEnvironmentData(null);
      }

      setError(null);
    } catch (err) {
      console.error('❌ [DASHBOARD] Erro ao buscar sensores:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(`Erro ao carregar sensores: ${errorMessage}`);
    } finally {
      setLoadingSensors(false);
    }
  };

  // ✅ Cargar datos históricos después (gráficos) - carga paralela
  const fetchHistoryData = async (deviceId: string) => {
    if (!deviceId) return;
    console.log('🔄 [DASHBOARD] Cargando histórico para', deviceId);
    setLoadingCharts(true);
    try {
      const q = encodeURIComponent(deviceId);
      const hydroHistoryRes = await fetch(
        `/api/hydro-rollup?device_id=${q}&granularity=hour&hours=24`
      );
      const envHistoryRes = await fetch(
        `/api/environment-data?device_id=${q}&history=true&limit=24`
      );

      if (hydroHistoryRes.ok) {
        const hydroPayload = await hydroHistoryRes.json();
        let hydroHistoryData: HydroMeasurement[] = [];

        if (Array.isArray(hydroPayload.rows)) {
          if (hydroPayload.granularity === 'hour') {
            hydroHistoryData = hydroPayload.rows.map(
              (row: {
                bucket_start: string;
                ec_avg?: number;
                ph_avg?: number;
                temp_avg?: number;
              }) => ({
                ec: row.ec_avg ?? undefined,
                ph: row.ph_avg ?? undefined,
                temperature: row.temp_avg ?? undefined,
                created_at: row.bucket_start,
                water_level_ok: true,
              })
            ) as HydroMeasurement[];
          } else {
            hydroHistoryData = hydroPayload.rows as HydroMeasurement[];
          }
        }

        const validPhCount = hydroHistoryData.filter(
          (item) => item.ph !== null && item.ph !== undefined && !isNaN(Number(item.ph))
        ).length;
        console.log(
          `✅ [DASHBOARD] Histórico hidropônico (${hydroPayload.granularity ?? 'unknown'}): ${hydroHistoryData.length} registros`
        );
        console.log(`📊 [DASHBOARD] pH válidos: ${validPhCount}/${hydroHistoryData.length}`);

        if (hydroHistoryData.length > 0) {
          setHydroHistory(hydroHistoryData);
        } else {
          console.warn('⚠️ [DASHBOARD] Histórico hidropônico vazio — mantendo buffer Realtime se existir');
        }
      } else {
        console.warn(`⚠️ [DASHBOARD] Erro ao buscar histórico hidropônico: ${hydroHistoryRes.status}`);
      }

      if (envHistoryRes.ok) {
        const envHistoryData = await envHistoryRes.json();
        if (Array.isArray(envHistoryData)) {
          setEnvHistory(envHistoryData);
          console.log(`✅ [DASHBOARD] Histórico ambiental: ${envHistoryData.length} registros`);
        } else {
          setEnvHistory([]);
        }
      } else {
        console.warn(`⚠️ [DASHBOARD] Erro ao buscar histórico ambiental: ${envHistoryRes.status}`);
        setEnvHistory([]);
      }
    } catch (err) {
      console.error('❌ [DASHBOARD] Erro ao buscar histórico:', err);
    } finally {
      setLoadingCharts(false);
    }
  };

  const fetchData = async (deviceId: string) => {
    await fetchSensorData(deviceId);
    fetchHistoryData(deviceId);
  };

  // Realtime sensores — tarjetas + gráficos (ventana deslizante); REST solo carga inicial + fallback lento
  useEffect(() => {
    if (!userEmail) return;

    const deviceId = selectedDeviceId || undefined;

    return subscribeSensorMeasurements(deviceId, {
      onHydro: (row) => {
        const parsed = parseHydroRow(row);
        if (!parsed) return;
        setHydroLive((prev) => applyHydroRow(parsed, prev));
        if (hasHydroSensorReading(parsed)) {
          setHydroHistory((prev) => appendToHistoryDesc(prev, parsed, deviceId, HYDRO_CHART_RAW_LIMIT));
        }
      },
      onEnvironment: (row) => {
        const validated = validateEnvData(row);
        if (validated) {
          setEnvironmentData(validated);
          setEnvHistory((prev) => appendToHistoryDesc(prev, validated, deviceId));
        }
      },
    });
  }, [userEmail, selectedDeviceId]);

  // Recarga REST al cambiar dispositivo (primer paint del gráfico)
  useEffect(() => {
    if (!selectedDeviceId) return;
    setHydroLive(emptyHydroLiveState());
    setEnvironmentData(null);
    setHydroHistory([]);
    setEnvHistory([]);
    fetchSensorData(selectedDeviceId);
    fetchHistoryData(selectedDeviceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeviceId]);

  useEffect(() => {
    if (!userEmail || !selectedDeviceId) return;

    const fallbackMs = Math.max(getPollingInterval(), 60000);

    const clearSensorFallback = setVisibleInterval(
      () => fetchSensorData(selectedDeviceId),
      fallbackMs
    );
    const clearHistoryFallback = setVisibleInterval(
      () => fetchHistoryData(selectedDeviceId),
      CHART_HISTORY_FALLBACK_MS
    );

    const handleSettingsUpdate = () => {
      setTimeout(() => window.location.reload(), 1000);
    };

    window.addEventListener('settingsUpdated', handleSettingsUpdate);

    return () => {
      clearSensorFallback();
      clearHistoryFallback();
      window.removeEventListener('settingsUpdated', handleSettingsUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail, selectedDeviceId]);

  // Function to determine pH status
  const getPHStatus = (ph: number): 'normal' | 'warning' | 'danger' => {
    if (ph < 5.5 || ph > 7.0) return 'danger';
    if (ph < 5.8 || ph > 6.8) return 'warning';
    return 'normal';
  };

  const displayPh = useMemo(
    () => resolveLivePhForDisplay(hydroData, hydroSensorUpdatedAt),
    [hydroData, hydroSensorUpdatedAt]
  );
  const displayTemp = useMemo(
    () => resolveLiveTemperatureForDisplay(hydroData, hydroSensorUpdatedAt),
    [hydroData, hydroSensorUpdatedAt]
  );
  const displayEc = useMemo(
    () => resolveLiveEcForDisplay(hydroData, hydroSensorUpdatedAt),
    [hydroData, hydroSensorUpdatedAt]
  );

  // Function to determine EC status usando umbrales configurables
  const getECStatus = (ec: number): 'normal' | 'warning' | 'danger' => {
    if (ec < ecThresholds.dangerMin || ec > ecThresholds.dangerMax) return 'danger';
    if (ec < ecThresholds.warningMin || ec > ecThresholds.warningMax) return 'warning';
    return 'normal';
  };

  // ✅ Função para salvar configuração de umbrales de EC
  const handleSaveECThresholds = async () => {
    if (!userEmail) return;
    
    setSavingECConfig(true);
    try {
      const currentSettings = await loadSettings(userEmail);
      const updatedSettings: Settings = {
        ...currentSettings,
        ecThresholds,
      };
      
      const saved = await saveSettings(updatedSettings, userEmail);
      if (saved) {
        toast.success(d.toastEcSaved);
        setShowECConfig(false);
      } else {
        toast.error(d.toastSaveError);
      }
    } catch (error) {
      console.error('❌ [DASHBOARD] Erro ao salvar umbrales de EC:', error);
      toast.error(d.toastSaveError);
    } finally {
      setSavingECConfig(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg">
      
      {/* Header do Dashboard */}
      <div className="bg-dark-card border-b border-dark-border shadow-lg sticky top-0 z-30">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-aqua-400 to-primary-400 bg-clip-text text-transparent">
                {t.pages.dashboardTitle}
              </h1>
              <p className="text-sm text-dark-textSecondary mt-1">
                {t.pages.dashboardSubtitle}
              </p>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-xs sm:text-sm text-dark-textSecondary bg-dark-surface px-3 py-1.5 rounded-lg border border-dark-border">
                {new Date().toLocaleDateString(toBcp47(locale))}{' '}
                {new Date().toLocaleTimeString(toBcp47(locale))}
              </div>
              <button 
                onClick={() => selectedDeviceId && fetchData(selectedDeviceId)}
                disabled={loadingSensors || loadingCharts}
                className="bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-all shadow-lg hover:shadow-aqua-500/50 text-sm font-medium flex items-center gap-2"
              >
                {(loadingSensors || loadingCharts) ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>{t.common.updating}</span>
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    <span>{t.common.refresh}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Conteúdo Principal */}
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <QuemSomosTeaser />
        {error && (
          <div className="bg-red-900/30 border border-red-500 text-red-300 px-4 py-3 rounded mb-6" role="alert">
            <strong className="font-bold">{t.common.error}</strong>
            <span className="block sm:inline"> {error}</span>
          </div>
        )}
        
        <DashboardChartsSection
          loadingCharts={loadingCharts}
          hydroHistory={hydroHistory}
          selectedDeviceId={selectedDeviceId}
        />

        <DashboardSensorsSection
          loadingSensors={loadingSensors}
          hydroData={hydroData}
          environmentData={environmentData}
          displayTemp={displayTemp}
          displayPh={displayPh}
          displayEc={displayEc}
          sensorUpdatedAt={hydroSensorUpdatedAt}
          getECStatus={getECStatus}
          getPHStatus={getPHStatus}
          onOpenEcConfig={() => setShowECConfig(true)}
          onOpenTempConfig={() => setShowTempConfig(true)}
          onOpenPhConfig={() => setShowPHConfig(true)}
        />

        <DashboardAutoControlSection selectedDeviceId={selectedDeviceId} />

        <DashboardCropSection selectedDeviceId={selectedDeviceId} userEmail={userEmail || ''} />
      </div>

      {/* ✅ Modal de Configuração de Umbrales de EC */}
      {showECConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-dark-text flex items-center gap-2">
                <AdjustmentsHorizontalIcon className="h-6 w-6 text-aqua-400" />
                {d.ecConfigTitle}
              </h3>
              <button
                onClick={() => setShowECConfig(false)}
                className="p-1 rounded-lg hover:bg-dark-surface transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-dark-textSecondary" />
              </button>
            </div>

            <p className="text-sm text-dark-textSecondary mb-6">
              {d.ecConfigHint}
            </p>

            <div className="space-y-4">
              {/* Danger Range */}
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                <label className="block text-sm font-medium text-red-400 mb-2">
                  {d.dangerLabel}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-dark-textSecondary mb-1">{d.minUs}</label>
                    <input
                      type="number"
                      value={ecThresholds.dangerMin}
                      onChange={(e) => setEcThresholds({ ...ecThresholds, dangerMin: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text focus:outline-none focus:border-aqua-500"
                      min="0"
                      step="10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-dark-textSecondary mb-1">{d.maxUs}</label>
                    <input
                      type="number"
                      value={ecThresholds.dangerMax}
                      onChange={(e) => setEcThresholds({ ...ecThresholds, dangerMax: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text focus:outline-none focus:border-aqua-500"
                      min="0"
                      step="10"
                    />
                  </div>
                </div>
                <p className="text-xs text-red-300/70 mt-2">
                  {d.dangerRange
                    .replace('{min}', String(ecThresholds.dangerMin))
                    .replace('{max}', String(ecThresholds.dangerMax))}
                </p>
              </div>

              {/* Warning Range */}
              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                <label className="block text-sm font-medium text-yellow-400 mb-2">
                  {d.warningLabel}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-dark-textSecondary mb-1">{d.minUs}</label>
                    <input
                      type="number"
                      value={ecThresholds.warningMin}
                      onChange={(e) => setEcThresholds({ ...ecThresholds, warningMin: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text focus:outline-none focus:border-aqua-500"
                      min="0"
                      step="10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-dark-textSecondary mb-1">{d.maxUs}</label>
                    <input
                      type="number"
                      value={ecThresholds.warningMax}
                      onChange={(e) => setEcThresholds({ ...ecThresholds, warningMax: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text focus:outline-none focus:border-aqua-500"
                      min="0"
                      step="10"
                    />
                  </div>
                </div>
                <p className="text-xs text-yellow-300/70 mt-2">
                  {d.warningRange
                    .replace('{min}', String(ecThresholds.warningMin))
                    .replace('{max}', String(ecThresholds.warningMax))}
                </p>
              </div>

              {/* Normal Range Info */}
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                <label className="block text-sm font-medium text-green-400 mb-2">
                  {d.normalLabel}
                </label>
                <p className="text-xs text-green-300/70">
                  {d.normalRange
                    .replace('{min}', String(ecThresholds.warningMin))
                    .replace('{max}', String(ecThresholds.warningMax))}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowECConfig(false)}
                className="flex-1 px-4 py-2 bg-dark-surface hover:bg-dark-border border border-dark-border rounded-lg text-dark-text transition-colors"
              >
                {t.common.cancel}
              </button>
              <button
                onClick={handleSaveECThresholds}
                disabled={savingECConfig}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all font-medium"
              >
                {savingECConfig ? t.common.saving : t.common.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Modal de Configuração de Temperatura da Água */}
      {showTempConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-dark-text flex items-center gap-2">
                <AdjustmentsHorizontalIcon className="h-6 w-6 text-aqua-400" />
                {d.tempConfigTitle}
              </h3>
              <button
                onClick={() => setShowTempConfig(false)}
                className="p-1 rounded-lg hover:bg-dark-surface transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-dark-textSecondary" />
              </button>
            </div>
            <p className="text-sm text-dark-textSecondary mb-4">
              {d.tempConfigHint}
            </p>
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-300">
                {d.tempDevNote}
              </p>
              <ul className="mt-2 text-xs text-yellow-300/70 space-y-1">
                <li>{d.tempNormal}</li>
                <li>{d.tempWarning}</li>
              </ul>
            </div>
            <button
              onClick={() => setShowTempConfig(false)}
              className="w-full px-4 py-2 bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white rounded-lg transition-all font-medium"
            >
              {t.common.close}
            </button>
          </div>
        </div>
      )}

      {/* ✅ Modal de Configuração de pH */}
      {showPHConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-dark-text flex items-center gap-2">
                <AdjustmentsHorizontalIcon className="h-6 w-6 text-aqua-400" />
                {d.phConfigTitle}
              </h3>
              <button
                onClick={() => setShowPHConfig(false)}
                className="p-1 rounded-lg hover:bg-dark-surface transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-dark-textSecondary" />
              </button>
            </div>
            <p className="text-sm text-dark-textSecondary mb-4">
              {d.phConfigHint}
            </p>
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-300">
                {d.phDevNote}
              </p>
              <ul className="mt-2 text-xs text-yellow-300/70 space-y-1">
                <li>{d.phNormal}</li>
                <li>{d.phWarning}</li>
                <li>{d.phDanger}</li>
              </ul>
            </div>
            <button
              onClick={() => setShowPHConfig(false)}
              className="w-full px-4 py-2 bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white rounded-lg transition-all font-medium"
            >
              {t.common.close}
            </button>
          </div>
        </div>
      )}

    </div>
  );
} 