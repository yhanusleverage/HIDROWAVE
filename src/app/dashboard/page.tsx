'use client';

import React, { useState, useEffect } from 'react';
import SensorCard from '@/components/SensorCard';
import RelayControl from '@/components/RelayControl';
import SensorChart from '@/components/SensorChart';
import NutrientControl from '@/components/NutrientControl';
import CropCalendar, { CropTask } from '@/components/CropCalendar';
import { Toaster } from 'react-hot-toast';
import { HydroMeasurement, EnvironmentMeasurement } from '@/lib/supabase';
import { getPollingInterval } from '@/lib/settings';
import { 
  BeakerIcon, 
  Cog6ToothIcon, 
  LightBulbIcon, 
  WrenchIcon 
} from '@heroicons/react/24/outline';

export default function DashboardPage() {
  const [hydroData, setHydroData] = useState<HydroMeasurement | null>(null);
  const [environmentData, setEnvironmentData] = useState<EnvironmentMeasurement | null>(null);
  const [hydroHistory, setHydroHistory] = useState<HydroMeasurement[]>([]);
  const [envHistory, setEnvHistory] = useState<EnvironmentMeasurement[]>([]);
  
  // ✅ Estados de loading separados para carga progresiva
  const [loadingSensors, setLoadingSensors] = useState(true);
  const [loadingCharts, setLoadingCharts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estado para tarefas do calendário
  const [calendarTasks, setCalendarTasks] = useState<CropTask[]>([
    // Exemplos de tarefas
    {
      id: '1',
      date: new Date(),
      type: 'dosagem',
      title: 'Dosagem Semanal - Grow + Micro',
      description: 'Aplicar nutrientes base para fase vegetativa',
      completed: false,
      priority: 'high',
      nutrients: ['Grow', 'Micro'],
      duration: 30,
    },
    {
      id: '2',
      date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 dias
      type: 'monitoramento',
      title: 'Verificação de pH e EC',
      description: 'Monitorar níveis e ajustar se necessário',
      completed: false,
      priority: 'medium',
      duration: 15,
    },
    {
      id: '3',
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
      type: 'manutencao',
      title: 'Limpeza do Sistema',
      description: 'Limpar reservatórios e trocar filtros',
      completed: false,
      priority: 'high',
      duration: 60,
    },
    {
      id: '4',
      date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 dias
      type: 'dosagem',
      title: 'Dosagem - Bloom',
      description: 'Iniciar fase de floração',
      completed: false,
      priority: 'high',
      nutrients: ['Bloom', 'CalMag'],
      duration: 30,
    },
  ]);

  // ✅ Función para validar datos hidropónicos
  const validateHydroData = (data: any): HydroMeasurement | null => {
    if (data && typeof data === 'object') {
      const hasValidData = data.temperature !== undefined || 
                          data.ph !== undefined || 
                          data.tds !== undefined;
      if (hasValidData) {
        return data;
      }
    }
    return null;
  };

  // ✅ Función para validar datos ambientales
  const validateEnvData = (data: any): EnvironmentMeasurement | null => {
    if (data && typeof data === 'object') {
      const hasValidData = data.temperature !== undefined || data.humidity !== undefined;
      if (hasValidData) {
        return data;
      }
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
          setHydroHistory(hydroHistoryData);
          console.log(`✅ [DASHBOARD] Histórico hidropônico: ${hydroHistoryData.length} registros`);
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

  // Prepare chart data
  const temperatureChartData = {
    labels: hydroHistory.map(item => {
      const date = new Date(item.created_at || '');
      return date.toLocaleTimeString();
    }),
        datasets: [
      {
        label: 'Temperatura da Água',
        data: hydroHistory.map(item => item.temperature),
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
        tension: 0.3,
      },
      {
        label: 'Temperatura Ambiente',
        data: envHistory.map(item => item.temperature),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        tension: 0.3,
      },
    ],
  };

  const nutrientsChartData = {
    labels: hydroHistory.map(item => {
      const date = new Date(item.created_at || '');
      return date.toLocaleTimeString();
    }),
    datasets: [
      {
        label: 'pH',
        data: hydroHistory.map(item => item.ph),
        borderColor: 'rgb(255, 205, 86)',
        backgroundColor: 'rgba(255, 205, 86, 0.5)',
        tension: 0.3,
        yAxisID: 'y',
      },
      {
        label: 'TDS (ppm)',
        data: hydroHistory.map(item => item.tds),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        tension: 0.3,
        yAxisID: 'y1',
      },
    ],
  };

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
        min: 5,
        max: 8,
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'TDS (ppm)',
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  };

  // Define nutrient presets
  const nutrients = [
    { name: 'Grow', relayNumber: 2, mlPerLiter: 2 },
    { name: 'Micro', relayNumber: 3, mlPerLiter: 2 },
    { name: 'Bloom', relayNumber: 4, mlPerLiter: 2 },
    { name: 'CalMag', relayNumber: 5, mlPerLiter: 1 },
    { name: 'pH-', relayNumber: 0, mlPerLiter: 0.5 },
    { name: 'pH+', relayNumber: 1, mlPerLiter: 0.5 },
  ];

  // Function to determine pH status
  const getPHStatus = (ph: number): 'normal' | 'warning' | 'danger' => {
    if (ph < 5.5 || ph > 7.0) return 'danger';
    if (ph < 5.8 || ph > 6.8) return 'warning';
    return 'normal';
  };

  // Function to determine TDS status
  const getTDSStatus = (tds: number): 'normal' | 'warning' | 'danger' => {
    if (tds < 500 || tds > 1500) return 'danger';
    if (tds < 800 || tds > 1200) return 'warning';
    return 'normal';
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
                  <SensorCard 
                    title="Temperatura da Água" 
                    value={
                      hydroData?.temperature !== undefined && hydroData.temperature !== null
                        ? hydroData.temperature.toFixed(1)
                        : '--'
                    } 
                    unit="°C"
                    icon={<BeakerIcon className="h-6 w-6" />}
                    status={
                      hydroData?.temperature !== undefined && hydroData.temperature !== null
                        ? (hydroData.temperature < 18 || hydroData.temperature > 26) 
                        ? 'warning' 
                          : 'normal'
                        : 'normal'
                    }
                  />
                  
                  <SensorCard 
                    title="pH" 
                    value={
                      hydroData?.ph !== undefined && hydroData.ph !== null
                        ? hydroData.ph.toFixed(2)
                        : '--'
                    }
                    icon={<BeakerIcon className="h-6 w-6" />}
                    status={hydroData?.ph !== undefined && hydroData.ph !== null ? getPHStatus(hydroData.ph) : 'normal'}
                  />
                  
                  <SensorCard 
                    title="TDS" 
                    value={
                      hydroData?.tds !== undefined && hydroData.tds !== null
                        ? hydroData.tds.toFixed(0)
                        : '--'
                    } 
                    unit="ppm"
                    icon={<BeakerIcon className="h-6 w-6" />}
                    status={hydroData?.tds !== undefined && hydroData.tds !== null ? getTDSStatus(hydroData.tds) : 'normal'}
                  />
                  
                  <SensorCard 
                    title="Temperatura Ambiente" 
                    value={
                      environmentData?.temperature !== undefined && environmentData.temperature !== null
                        ? environmentData.temperature.toFixed(1)
                        : '--'
                    } 
                    unit="°C"
                    icon={<WrenchIcon className="h-6 w-6" />}
                    status={
                      environmentData?.temperature !== undefined && environmentData.temperature !== null
                        ? (environmentData.temperature < 15 || environmentData.temperature > 30) 
                        ? 'warning' 
                          : 'normal'
                        : 'normal'
                    }
                  />
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <SensorChart title="Temperatura" data={temperatureChartData} />
                  <SensorChart 
                    title="pH e TDS" 
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
    </div>
  );
} 