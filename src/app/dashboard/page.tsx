'use client';

import React, { useState, useEffect, useMemo } from 'react';
import SensorCard from '@/components/SensorCard';
import RelayControl from '@/components/RelayControl';
import SensorChart from '@/components/SensorChart';
import CropCalendar, { CropTask } from '@/components/CropCalendar';
import { Toaster, toast } from 'react-hot-toast';
import { HydroMeasurement, EnvironmentMeasurement } from '@/lib/supabase';
import { getPollingInterval, loadSettings, saveSettings, type Settings } from '@/lib/settings';
import { useAuth } from '@/contexts/AuthContext';
import { getUserDevices, DeviceStatus } from '@/lib/automation';
import { useCropAlarms } from '@/hooks/useCropAlarms';
import { 
  AdjustmentsHorizontalIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

export default function DashboardPage() {
  const { userProfile } = useAuth();
  const userEmail = userProfile?.email || '';
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [devices, setDevices] = useState<DeviceStatus[]>([]);
  const [hydroData, setHydroData] = useState<HydroMeasurement | null>(null);
  const [environmentData, setEnvironmentData] = useState<EnvironmentMeasurement | null>(null);
  const [hydroHistory, setHydroHistory] = useState<HydroMeasurement[]>([]);
  const [envHistory, setEnvHistory] = useState<EnvironmentMeasurement[]>([]);
  
  // ✅ Estados de loading separados para carga progresiva
  const [loadingSensors, setLoadingSensors] = useState(true);
  const [loadingCharts, setLoadingCharts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estado para tarefas do calendário
  const [calendarTasks, setCalendarTasks] = useState<CropTask[]>([]);
  
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
  const [showAmbientConfig, setShowAmbientConfig] = useState(false);

  // ✅ Hook para verificar alarmes do calendário
  const { alarms, acknowledgeAlarm } = useCropAlarms({
    deviceId: selectedDeviceId,
    userEmail: userEmail || '',
    enabled: !!selectedDeviceId && !!userEmail,
    checkInterval: 60000, // Verificar a cada 60 segundos
  });

  // ✅ Carregar dispositivos do usuário e selecionar o primeiro
  useEffect(() => {
    const loadUserDevices = async () => {
      if (!userEmail) {
        return;
      }

      try {
        const userDevices = await getUserDevices(userEmail);
        setDevices(userDevices);
        
        // Selecionar o primeiro dispositivo disponível
        if (userDevices.length > 0 && !selectedDeviceId) {
          const firstDevice = userDevices[0];
          setSelectedDeviceId(firstDevice.device_id);
          console.log('✅ [DASHBOARD] Dispositivo selecionado:', firstDevice.device_id);
        }
      } catch (error) {
        console.error('❌ [DASHBOARD] Erro ao carregar dispositivos:', error);
      }
    };

    loadUserDevices();
  }, [userEmail, selectedDeviceId]);

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

  // ✅ Función para validar datos hidropónicos
  const validateHydroData = (data: unknown): HydroMeasurement | null => {
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      const hasValidData = obj.temperature !== undefined || 
                          obj.ph !== undefined || 
                          obj.tds !== undefined ||
                          obj.ec !== undefined; // ✅ También validar EC
      if (hasValidData) {
        return data as HydroMeasurement;
      }
    }
    return null;
  };

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

  // ✅ Función helper para calcular EC de forma consistente
  // Tipado correctamente para evitar errores en Vercel (sin tipos 'any')
  // DEBE estar definida ANTES de nutrientsChartData para evitar errores de inicialización
  const calculateEC = (item: HydroMeasurement | null | undefined): number | null => {
    // ✅ Validar que el item existe
    if (!item) return null;
    
    // ✅ Prioridad 1: Usar EC si está disponible (incluyendo 0 como valor válido)
    // En Supabase, EC puede venir directamente o ser calculado de TDS
    if (item.ec !== null && item.ec !== undefined && !isNaN(Number(item.ec))) {
      return Number(item.ec);
    }
    
    // ✅ Prioridad 2: Calcular de TDS: EC = TDS * 2
    // TDS siempre existe en HydroMeasurement (es obligatorio)
    if (item.tds !== null && item.tds !== undefined && !isNaN(Number(item.tds))) {
      return Number(item.tds) * 2;
    }
    
    return null;
  };

  // ✅ Cargar datos críticos primero (sensores) - carga paralela
  const fetchSensorData = async () => {
    console.log('🔄 [DASHBOARD] ========== CARGANDO SENSORES (PARALELO) ==========');
    setLoadingSensors(true);
    try {
      // ✅ Carga paralela de ambos sensores
      const [hydroRes, envRes] = await Promise.all([
        fetch('/api/hydro-data'),
        fetch('/api/environment-data')
      ]);

      // Procesar datos hidropónicos
      if (hydroRes.ok) {
        const hydroData = await hydroRes.json();
        const validated = validateHydroData(hydroData);
        setHydroData(validated);
        console.log('✅ [DASHBOARD] Dados hidropônicos carregados');
        // ✅ Debug: Verificar valores de EC y TDS
        console.log('🔍 [DASHBOARD] EC:', validated?.ec, 'TDS:', validated?.tds);
        if (validated) {
          const ecValue = validated.ec ?? (validated.tds ? validated.tds * 2 : null);
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
  const fetchHistoryData = async () => {
    console.log('🔄 [DASHBOARD] ========== CARGANDO HISTÓRICO (PARALELO) ==========');
    setLoadingCharts(true);
    try {
      // ✅ Carga paralela de ambos históricos
      const [hydroHistoryRes, envHistoryRes] = await Promise.all([
        fetch('/api/hydro-data?history=true&limit=24'),
        fetch('/api/environment-data?history=true&limit=24')
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

  // ✅ Función principal que carga todo de forma optimizada
  const fetchData = async () => {
    // Cargar sensores primero (crítico)
    await fetchSensorData();
    // Luego cargar histórico (menos crítico)
    fetchHistoryData(); // Sin await para no bloquear
  };

  useEffect(() => {
    // ✅ Carga inicial: sensores primero, luego histórico
    fetchData();
    
    // ✅ Carregar intervalo de polling das configurações
    let pollingInterval = 30000; // Padrão: 30 segundos
    
    try {
      pollingInterval = getPollingInterval();
    } catch (error) {
      console.warn('Erro ao carregar intervalo de polling, usando padrão (30s):', error);
    }
    
    console.log(`🔄 [DASHBOARD] Configurando polling a cada ${pollingInterval / 1000} segundos`);
    
    // ✅ Polling optimizado: solo actualizar sensores (más frecuente)
    // El histórico se actualiza menos frecuentemente
    const sensorInterval = setInterval(fetchSensorData, pollingInterval);
    const historyInterval = setInterval(fetchHistoryData, pollingInterval * 2); // Histórico cada 2x el intervalo
    
    // ✅ Ouvir mudanças nas configurações para recarregar página (aplicar novo intervalo)
    const handleSettingsUpdate = () => {
      console.log('🔄 [DASHBOARD] Configurações atualizadas! Recarregando página para aplicar novo intervalo...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('settingsUpdated', handleSettingsUpdate);
    }
    
    return () => {
      clearInterval(sensorInterval);
      clearInterval(historyInterval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('settingsUpdated', handleSettingsUpdate);
      }
    };
  }, []);

  // ✅ Usar useMemo para nutrientsChartData para asegurar que calculateEC esté disponible
  const nutrientsChartData = useMemo(() => {
    return {
      labels: hydroHistory.map(item => {
        const date = new Date(item.created_at || '');
        return date.toLocaleTimeString();
      }),
      datasets: [
        {
          label: 'pH',
          data: hydroHistory.map(item => {
            // ✅ Filtrar valores nulos/undefined y asegurar que sea un número válido
            const phValue = item.ph;
            if (phValue === null || phValue === undefined || isNaN(Number(phValue))) {
              return null; // Chart.js manejará null correctamente
            }
            return Number(phValue);
          }),
          borderColor: 'rgb(255, 205, 86)',
          backgroundColor: 'rgba(255, 205, 86, 0.5)',
          tension: 0.3,
          yAxisID: 'y',
          spanGaps: true, // ✅ Conectar puntos aunque haya gaps
        },
        {
          label: 'EC (µS/cm)',
          data: hydroHistory.map(item => {
            // ✅ Usar función helper compartida para calcular EC
            const ecValue = calculateEC(item);
            return ecValue;
          }),
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.5)',
          tension: 0.3,
          yAxisID: 'y1',
          spanGaps: true,
        },
        {
          label: 'Temperatura da Água (°C)',
          data: hydroHistory.map(item => {
            const tempValue = item.temperature;
            if (tempValue === null || tempValue === undefined || isNaN(Number(tempValue))) {
              return null;
            }
            return Number(tempValue);
          }),
          borderColor: 'rgb(53, 162, 235)',
          backgroundColor: 'rgba(53, 162, 235, 0.3)',
          tension: 0.3,
          yAxisID: 'y2',
          spanGaps: true,
        },
      ],
    };
  }, [hydroHistory]);

  const nutrientsChartOptions = {
    scales: {
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'pH',
        },
        min: 4,
        max: 10, // ✅ Aumentado de 8 a 10 para mostrar valores de pH más altos (hasta 9.5+)
        // ✅ Asegurar que el eje Y muestre valores de pH correctamente
        ticks: {
          stepSize: 0.5,
        },
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'EC (µS/cm)',
        },
        grid: {
          drawOnChartArea: false,
        },
      },
      y2: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Temperatura (°C)',
        },
        min: 15,
        max: 35,
        grid: {
          drawOnChartArea: false,
        },
        // ✅ Posicionar este eje después del eje y (pH)
        afterFit: (scale: { left: number }) => {
          // Ajustar posición para que no se superponga
          scale.left = 60;
        },
      },
    },
    // ✅ Opciones adicionales para mejorar la visualización
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
  };

  // Function to determine pH status
  const getPHStatus = (ph: number): 'normal' | 'warning' | 'danger' => {
    if (ph < 5.5 || ph > 7.0) return 'danger';
    if (ph < 5.8 || ph > 6.8) return 'warning';
    return 'normal';
  };

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
      <Toaster position="top-right" />
      
      {/* Header do Dashboard */}
      <div className="bg-dark-card border-b border-dark-border shadow-lg sticky top-0 z-30">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-aqua-400 to-primary-400 bg-clip-text text-transparent">
                🌱 HydroWave Dashboard
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
                onClick={fetchData}
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
        {error && (
          <div className="bg-red-900/30 border border-red-500 text-red-300 px-4 py-3 rounded mb-6" role="alert">
            <strong className="font-bold">Erro!</strong>
            <span className="block sm:inline"> {error}</span>
          </div>
        )}
        
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
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded">
                      ✅ Hydro OK
                    </span>
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
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-aqua-500/30 border-t-aqua-500 mx-auto"></div>
                  <p className="mt-4 text-sm text-dark-textSecondary">Carregando sensores...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* ✅ Card combinado compacto: Temperatura Ambiente + Humedad Relativa */}
                  <div className="relative bg-dark-card border border-dark-border rounded-lg shadow-lg p-4 hover:shadow-aqua-500/20 hover:border-aqua-500/50 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-medium text-dark-text">Ambiente</h3>
                    </div>
                    <button
                      onClick={() => setShowAmbientConfig(true)}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-dark-surface hover:bg-yellow-500/20 border border-yellow-500/30 hover:border-yellow-500/50 transition-colors"
                      title="Configurar umbrales de Ambiente"
                    >
                      <AdjustmentsHorizontalIcon className="h-4 w-4 text-yellow-400 hover:text-yellow-300" />
                    </button>
                    
                    {/* Valores en línea compacta */}
                    <div className="space-y-2">
                      {/* Temperatura */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-dark-textSecondary">Temp:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold text-dark-text">
                            {environmentData?.temperature !== undefined && environmentData.temperature !== null
                              ? environmentData.temperature.toFixed(1)
                              : '--'}
                            <span className="ml-1 text-sm text-dark-textSecondary">°C</span>
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                            environmentData?.temperature !== undefined && environmentData.temperature !== null
                              ? (environmentData.temperature < 15 || environmentData.temperature > 30)
                              ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                              : 'bg-aqua-500/20 text-aqua-400 border border-aqua-500/30'
                              : 'bg-aqua-500/20 text-aqua-400 border border-aqua-500/30'
                          }`}>
                            {environmentData?.temperature !== undefined && environmentData.temperature !== null
                              ? (environmentData.temperature < 15 || environmentData.temperature > 30) ? 'Aviso' : 'Normal'
                              : 'Normal'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Humedad */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-dark-textSecondary">Humedad:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold text-dark-text">
                            {environmentData?.humidity !== undefined && environmentData.humidity !== null
                              ? environmentData.humidity.toFixed(0)
                              : '--'}
                            <span className="ml-1 text-sm text-dark-textSecondary">%</span>
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                            environmentData?.humidity !== undefined && environmentData.humidity !== null
                              ? (environmentData.humidity < 30 || environmentData.humidity > 80)
                              ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                              : 'bg-aqua-500/20 text-aqua-400 border border-aqua-500/30'
                              : 'bg-aqua-500/20 text-aqua-400 border border-aqua-500/30'
                          }`}>
                            {environmentData?.humidity !== undefined && environmentData.humidity !== null
                              ? (environmentData.humidity < 30 || environmentData.humidity > 80) ? 'Aviso' : 'Normal'
                              : 'Normal'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Card Temperatura da Água con botón */}
                  <div className="relative">
                    <SensorCard 
                      title="Temperatura da Água" 
                      value={
                        hydroData?.temperature !== undefined && hydroData.temperature !== null
                          ? hydroData.temperature.toFixed(1)
                          : '--'
                      } 
                      unit="°C"
                      status={
                        hydroData?.temperature !== undefined && hydroData.temperature !== null
                          ? (hydroData.temperature < 18 || hydroData.temperature > 26) 
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
                      value={
                        hydroData?.ph !== undefined && hydroData.ph !== null
                          ? hydroData.ph.toFixed(2)
                          : '--'
                      }
                      status={hydroData?.ph !== undefined && hydroData.ph !== null ? getPHStatus(hydroData.ph) : 'normal'}
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
                      value={
                        (() => {
                          // ✅ Usar función helper compartida para calcular EC
                          const ecValue = hydroData ? calculateEC(hydroData) : null;
                          return ecValue !== null ? ecValue.toFixed(0) : '--';
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
            
            {/* ✅ Seção de Gráficos - Carga independiente */}
            <section className="mb-8">
              <h2 className="text-xl font-bold mb-4 text-dark-text flex items-center gap-2">
                <span className="text-2xl">📈</span>
                Gráficos de Monitoramento
                {loadingCharts && (
                  <span className="text-xs text-dark-textSecondary ml-2">(Carregando...)</span>
                )}
              </h2>
              {loadingCharts ? (
                <div className="text-center py-12 bg-dark-surface rounded-lg border border-dark-border">
                  <div className="animate-spin rounded-full h-10 w-10 border-4 border-aqua-500/30 border-t-aqua-500 mx-auto"></div>
                  <p className="mt-4 text-sm text-dark-textSecondary">Carregando histórico para gráficos...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  <SensorChart 
                    title="pH e EC" 
                    data={nutrientsChartData} 
                    options={nutrientsChartOptions} 
                  />
                </div>
              )}
            </section>
            
            {/* Seção de Calendário de Cultivo */}
            <section className="mb-8">
              <CropCalendar
                tasks={calendarTasks}
                deviceId={selectedDeviceId}
                userEmail={userEmail || ''}
                onTaskAdd={(task) => {
                  setCalendarTasks([...calendarTasks, task]);
                }}
                onTaskComplete={(taskId) => {
                  setCalendarTasks(calendarTasks.map(task =>
                    task.id === taskId ? { ...task, completed: true } : task
                  ));
                }}
                onTaskDelete={(taskId) => {
                  setCalendarTasks(calendarTasks.filter(task => task.id !== taskId));
                }}
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

      {/* ✅ Modal de Configuração de Ambiente */}
      {showAmbientConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-dark-text flex items-center gap-2">
                <AdjustmentsHorizontalIcon className="h-6 w-6 text-aqua-400" />
                Configurar Umbrales de Ambiente
              </h3>
              <button
                onClick={() => setShowAmbientConfig(false)}
                className="p-1 rounded-lg hover:bg-dark-surface transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-dark-textSecondary" />
              </button>
            </div>
            <p className="text-sm text-dark-textSecondary mb-4">
              Configure os valores de temperatura ambiente e humidade relativa para determinar os status de alerta.
            </p>
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-300">
                ⚠️ Funcionalidade em desenvolvimento. Atualmente os umbrales são:
              </p>
              <ul className="mt-2 text-xs text-yellow-300/70 space-y-1">
                <li>• Temperatura Normal: 15°C - 30°C</li>
                <li>• Humidade Normal: 30% - 80%</li>
                <li>• Aviso: Fora dos ranges normais</li>
              </ul>
            </div>
            <button
              onClick={() => setShowAmbientConfig(false)}
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