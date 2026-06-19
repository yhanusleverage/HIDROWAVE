'use client';

import React, { useState, useEffect, useMemo } from 'react';
import SensorCard from '@/components/SensorCard';
import RelayControl from '@/components/RelayControl';
import HydroMonitoringChart from '@/components/HydroMonitoringChart';
import ControllerMetricsChart from '@/components/ControllerMetricsChart';
import CropCalendar from '@/components/CropCalendar';
import { EcAutoStatusCard } from '@/components/EcAutoStatusCard';
import { PhAutoStatusCard } from '@/components/PhAutoStatusCard';
import { toast } from 'react-hot-toast';
import { HydroMeasurement, EnvironmentMeasurement } from '@/lib/supabase';
import { subscribeSensorMeasurements } from '@/lib/realtime/sensor-measurements';
import {
  appendToHistoryDesc,
  CHART_HISTORY_FALLBACK_MS,
} from '@/lib/realtime/chart-history';
import { setVisibleInterval } from '@/lib/realtime/visible-interval';
import { getPollingInterval, loadSettings, saveSettings, type Settings } from '@/lib/settings';
import { formatSensorValue } from '@/lib/format-sensor-value';
import { resolvePh, resolvePhForDisplay, hasHydroSensorReading, mergeHydroMeasurements } from '@/lib/realtime/hydro-ph';
import { resolveEcForDisplay } from '@/lib/realtime/hydro-ec';
import { resolveTemperatureForDisplay } from '@/lib/realtime/hydro-sensor';
import { useAuth } from '@/contexts/AuthContext';
import { useDevicesWithRealtime } from '@/hooks/useDevicesWithRealtime';
import BrandLoading from '@/components/BrandLoading';
import QuemSomosTeaser from '@/components/QuemSomosTeaser';
import { 
  AdjustmentsHorizontalIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

export default function DashboardPage() {
  const { userProfile } = useAuth();
  const userEmail = userProfile?.email || '';
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const { devices } = useDevicesWithRealtime(userEmail || undefined);
  const [hydroData, setHydroData] = useState<HydroMeasurement | null>(null);
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

  const applyHydroRow = (data: unknown, prev: HydroMeasurement | null): HydroMeasurement | null => {
    const row = parseHydroRow(data);
    if (!row) return prev;
    return mergeHydroMeasurements(prev, row) as HydroMeasurement;
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
        obj.ec_raw !== undefined;
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

  // EC consistente para cards — usa resolveEcForDisplay (ignora sentinel 0)
  const calculateEC = (item: HydroMeasurement | null | undefined): number | null => {
    if (!item) return null;
    return resolveEcForDisplay(item);
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
        setHydroData((prev) => applyHydroRow(hydroJson, prev));
        console.log('✅ [DASHBOARD] Dados hidropônicos carregados');
        const snapshot = applyHydroRow(hydroJson, null);
        if (snapshot) {
          console.log('🔍 [DASHBOARD] EC:', snapshot.ec, 'TDS:', snapshot.tds);
          const ecValue = snapshot.ec ?? (snapshot.tds ? snapshot.tds * 2 : null);
          console.log('🔍 [DASHBOARD] EC calculado para card:', ecValue);
        }
      } else {
        console.warn(`⚠️ [DASHBOARD] Erro ao buscar hydro-data: ${hydroRes.status}`);
        setHydroData(null);
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
      const [hydroHistoryRes, envHistoryRes] = await Promise.all([
        fetch(`/api/hydro-data?device_id=${q}&history=true&limit=24`),
        fetch(`/api/environment-data?device_id=${q}&history=true&limit=24`),
      ]);

      if (hydroHistoryRes.ok) {
        const hydroHistoryData = await hydroHistoryRes.json();
        if (Array.isArray(hydroHistoryData)) {
          // ✅ Debug: Verificar datos de pH
          const phData = hydroHistoryData.map(item => ({ 
            ph: item.ph, 
            phType: typeof item.ph,
            phIsNull: item.ph === null,
            phIsUndefined: item.ph === undefined,
            created_at: item.created_at 
          }));
          const validPhCount = hydroHistoryData.filter(item => 
            item.ph !== null && item.ph !== undefined && !isNaN(Number(item.ph))
          ).length;
          console.log(`✅ [DASHBOARD] Histórico hidropônico: ${hydroHistoryData.length} registros`);
          console.log(`📊 [DASHBOARD] pH válidos: ${validPhCount}/${hydroHistoryData.length}`);
          if (validPhCount < hydroHistoryData.length) {
            console.warn('⚠️ [DASHBOARD] Alguns registros têm pH inválido:', phData.filter((_, i) => 
              hydroHistoryData[i].ph === null || 
              hydroHistoryData[i].ph === undefined || 
              isNaN(Number(hydroHistoryData[i].ph))
            ));
          }
          setHydroHistory(hydroHistoryData);
        } else {
          setHydroHistory([]);
        }
      } else {
        console.warn(`⚠️ [DASHBOARD] Erro ao buscar histórico hidropônico: ${hydroHistoryRes.status}`);
        setHydroHistory([]);
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
        setHydroData((prev) => applyHydroRow(parsed, prev));
        if (hasHydroSensorReading(parsed)) {
          setHydroHistory((prev) => appendToHistoryDesc(prev, parsed, deviceId));
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
    setHydroData(null);
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

  /** pH com QC 4.0–9.0 — alinhado com /automacao e handoff Auto pH. */
  const displayPh = useMemo(() => resolvePh(hydroData), [hydroData]);
  const displayTemp = useMemo(() => resolveTemperatureForDisplay(hydroData), [hydroData]);

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
        toast.success('Umbrales de EC salvos com sucesso!');
        setShowECConfig(false);
      } else {
        toast.error('Erro ao salvar configuração');
      }
    } catch (error) {
      console.error('❌ [DASHBOARD] Erro ao salvar umbrales de EC:', error);
      toast.error('Erro ao salvar configuração');
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
                Dashboard
              </h1>
              <p className="text-sm text-dark-textSecondary mt-1">
                Monitoramento em tempo real do seu sistema
              </p>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-xs sm:text-sm text-dark-textSecondary bg-dark-surface px-3 py-1.5 rounded-lg border border-dark-border">
                {new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR')}
              </div>
              <button 
                onClick={() => selectedDeviceId && fetchData(selectedDeviceId)}
                disabled={loadingSensors || loadingCharts}
                className="bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-all shadow-lg hover:shadow-aqua-500/50 text-sm font-medium flex items-center gap-2"
              >
                {(loadingSensors || loadingCharts) ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Atualizando...</span>
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    <span>Atualizar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Conteúdo Principal */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <QuemSomosTeaser />
        {error && (
          <div className="bg-red-900/30 border border-red-500 text-red-300 px-4 py-3 rounded mb-6" role="alert">
            <strong className="font-bold">Erro!</strong>
            <span className="block sm:inline"> {error}</span>
          </div>
        )}
        
        {/* ✅ Seção de Gráficos - acima dos valores atuais */}
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-4 text-dark-text flex items-center gap-2">
            <span className="text-2xl">📈</span>
            Gráficos de Monitoramento
            {loadingCharts && (
              <span className="text-xs text-dark-textSecondary ml-2">(Carregando...)</span>
            )}
          </h2>
          <div className="grid grid-cols-1 gap-6">
            {loadingCharts ? (
              <BrandLoading
                message="Carregando histórico hidropônico..."
                size={40}
                className="py-12 bg-dark-surface rounded-lg border border-dark-border"
              />
            ) : (
              <HydroMonitoringChart history={hydroHistory} />
            )}
            {selectedDeviceId ? (
              <ControllerMetricsChart deviceId={selectedDeviceId} />
            ) : null}
          </div>
        </section>

        {/* ✅ Seção de Sensores - Carga independiente */}
        <section className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-dark-text flex items-center gap-2">
                  <span className="text-2xl">📊</span>
                  Sensores
                </h2>
                {/* ✅ INDICADOR DE STATUS DOS DADOS */}
                <div className="flex items-center gap-2 text-xs">
                  {hydroData ? (
                    hasHydroSensorReading(hydroData) ? (
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded">
                        ✅ Hydro OK
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded">
                        ✅ Niveles (sem pH/EC/temp)
                      </span>
                    )
                  ) : (
                    <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded">
                      ⚠️ Sem Hydro
                    </span>
                  )}
                  {environmentData ? (
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded">
                      ✅ Env OK
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded">
                      ⚠️ Sem Env
                    </span>
                  )}
                </div>
              </div>
              {loadingSensors ? (
                <BrandLoading message="Carregando sensores..." className="py-12" />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Card Temperatura da Água con botón */}
                  <div className="relative">
                    <SensorCard 
                      title="Temperatura da Água" 
                      value={
                        displayTemp !== null
                          ? formatSensorValue(displayTemp, 1)
                          : '--'
                      } 
                      unit="°C"
                      status={
                        displayTemp !== null
                          ? (displayTemp < 18 || displayTemp > 26) 
                          ? 'warning' 
                            : 'normal'
                          : 'normal'
                      }
                    />
                    <button
                      onClick={() => setShowTempConfig(true)}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-dark-surface hover:bg-yellow-500/20 border border-yellow-500/30 hover:border-yellow-500/50 transition-colors"
                      title="Configurar umbrales de Temperatura"
                    >
                      <AdjustmentsHorizontalIcon className="h-4 w-4 text-yellow-400 hover:text-yellow-300" />
                    </button>
                  </div>
                  
                  {/* Card pH con botón */}
                  <div className="relative">
                    <SensorCard 
                      title="pH" 
                      domain="ph"
                      value={
                        displayPh !== null
                          ? formatSensorValue(displayPh, 2)
                          : '--'
                      }
                      status={displayPh !== null ? getPHStatus(displayPh) : 'normal'}
                    />
                    <button
                      onClick={() => setShowPHConfig(true)}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-dark-surface hover:bg-yellow-500/20 border border-yellow-500/30 hover:border-yellow-500/50 transition-colors"
                      title="Configurar umbrales de pH"
                    >
                      <AdjustmentsHorizontalIcon className="h-4 w-4 text-yellow-400 hover:text-yellow-300" />
                    </button>
                  </div>
                  
                  {/* Card EC con botón */}
                  <div className="relative">
                    <SensorCard 
                      title="EC" 
                      domain="ec"
                      value={
                        (() => {
                          // ✅ Usar función helper compartida para calcular EC
                          const ecValue = hydroData ? calculateEC(hydroData) : null;
                          return ecValue !== null ? formatSensorValue(ecValue, 0) : '--';
                        })()
                      } 
                      unit="µS/cm"
                      status={
                        (() => {
                          // ✅ Usar función helper compartida para calcular EC
                          const ecValue = hydroData ? calculateEC(hydroData) : null;
                          return ecValue !== null ? getECStatus(ecValue) : 'normal';
                        })()
                      }
                    />
                    <button
                      onClick={() => setShowECConfig(true)}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-dark-surface hover:bg-yellow-500/20 border border-yellow-500/30 hover:border-yellow-500/50 transition-colors"
                      title="Configurar umbrales de EC"
                    >
                      <AdjustmentsHorizontalIcon className="h-4 w-4 text-yellow-400 hover:text-yellow-300" />
                    </button>
                  </div>
                </div>
              )}
              
              {/* ✅ DEBUG: Mostrar dados brutos em desenvolvimento */}
              {process.env.NODE_ENV === 'development' && (
                <div className="mt-4 p-4 bg-dark-surface border border-dark-border rounded-lg">
                  <details className="text-xs">
                    <summary className="cursor-pointer text-dark-textSecondary hover:text-dark-text">
                      🔍 Debug: Dados Recebidos (Clique para expandir)
                    </summary>
                    <div className="mt-2 space-y-2">
                      <div>
                        <strong className="text-aqua-400">Hydro Data:</strong>
                        <pre className="mt-1 p-2 bg-dark-bg rounded text-dark-textSecondary overflow-auto">
                          {JSON.stringify(hydroData, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <strong className="text-aqua-400">Environment Data:</strong>
                        <pre className="mt-1 p-2 bg-dark-bg rounded text-dark-textSecondary overflow-auto">
                          {JSON.stringify(environmentData, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <strong className="text-aqua-400">Hydro History Count:</strong> {hydroHistory.length}
                      </div>
                      <div>
                        <strong className="text-aqua-400">Env History Count:</strong> {envHistory.length}
                      </div>
                    </div>
                  </details>
                </div>
              )}
            </section>

            {selectedDeviceId && (
              <>
                <EcAutoStatusCard deviceId={selectedDeviceId} />
                <PhAutoStatusCard deviceId={selectedDeviceId} />
              </>
            )}
            
            {/* Seção de Calendário de Cultivo */}
            <section className="mb-8">
              <CropCalendar
                deviceId={selectedDeviceId}
                userEmail={userEmail || ''}
              />
            </section>
      </main>

      {/* ✅ Modal de Configuração de Umbrales de EC */}
      {showECConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-dark-text flex items-center gap-2">
                <AdjustmentsHorizontalIcon className="h-6 w-6 text-aqua-400" />
                Configurar Umbrales de EC
              </h3>
              <button
                onClick={() => setShowECConfig(false)}
                className="p-1 rounded-lg hover:bg-dark-surface transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-dark-textSecondary" />
              </button>
            </div>

            <p className="text-sm text-dark-textSecondary mb-6">
              Configure os valores de EC (Electrical Conductivity) em µS/cm para determinar os status de alerta.
            </p>

            <div className="space-y-4">
              {/* Danger Range */}
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                <label className="block text-sm font-medium text-red-400 mb-2">
                  ⚠️ Perigo (Danger)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-dark-textSecondary mb-1">Mínimo (µS/cm)</label>
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
                    <label className="block text-xs text-dark-textSecondary mb-1">Máximo (µS/cm)</label>
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
                  Valores abaixo de {ecThresholds.dangerMin} ou acima de {ecThresholds.dangerMax} µS/cm
                </p>
              </div>

              {/* Warning Range */}
              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                <label className="block text-sm font-medium text-yellow-400 mb-2">
                  ⚠️ Aviso (Warning)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-dark-textSecondary mb-1">Mínimo (µS/cm)</label>
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
                    <label className="block text-xs text-dark-textSecondary mb-1">Máximo (µS/cm)</label>
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
                  Valores entre {ecThresholds.warningMin} e {ecThresholds.warningMax} µS/cm (fora da zona normal)
                </p>
              </div>

              {/* Normal Range Info */}
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                <label className="block text-sm font-medium text-green-400 mb-2">
                  ✅ Normal
                </label>
                <p className="text-xs text-green-300/70">
                  Valores entre {ecThresholds.warningMin} e {ecThresholds.warningMax} µS/cm (zona segura)
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowECConfig(false)}
                className="flex-1 px-4 py-2 bg-dark-surface hover:bg-dark-border border border-dark-border rounded-lg text-dark-text transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveECThresholds}
                disabled={savingECConfig}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all font-medium"
              >
                {savingECConfig ? 'Salvando...' : 'Salvar'}
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
                Configurar Umbrales de Temperatura
              </h3>
              <button
                onClick={() => setShowTempConfig(false)}
                className="p-1 rounded-lg hover:bg-dark-surface transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-dark-textSecondary" />
              </button>
            </div>
            <p className="text-sm text-dark-textSecondary mb-4">
              Configure os valores de temperatura da água em °C para determinar os status de alerta.
            </p>
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-300">
                ⚠️ Funcionalidade em desenvolvimento. Atualmente os umbrales são:
              </p>
              <ul className="mt-2 text-xs text-yellow-300/70 space-y-1">
                <li>• Normal: 18°C - 26°C</li>
                <li>• Aviso: Fora do range normal</li>
              </ul>
            </div>
            <button
              onClick={() => setShowTempConfig(false)}
              className="w-full px-4 py-2 bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white rounded-lg transition-all font-medium"
            >
              Fechar
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
                Configurar Umbrales de pH
              </h3>
              <button
                onClick={() => setShowPHConfig(false)}
                className="p-1 rounded-lg hover:bg-dark-surface transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-dark-textSecondary" />
              </button>
            </div>
            <p className="text-sm text-dark-textSecondary mb-4">
              Configure os valores de pH para determinar os status de alerta.
            </p>
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-300">
                ⚠️ Funcionalidade em desenvolvimento. Atualmente os umbrales são:
              </p>
              <ul className="mt-2 text-xs text-yellow-300/70 space-y-1">
                <li>• Normal: 5.8 - 6.8</li>
                <li>• Aviso: 5.5-5.8 ou 6.8-7.0</li>
                <li>• Perigo: &lt; 5.5 ou &gt; 7.0</li>
              </ul>
            </div>
            <button
              onClick={() => setShowPHConfig(false)}
              className="w-full px-4 py-2 bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white rounded-lg transition-all font-medium"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

    </div>
  );
} 