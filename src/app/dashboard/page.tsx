'use client';

import React, { useState, useEffect } from 'react';
import SensorCard from '@/components/SensorCard';
import RelayControl from '@/components/RelayControl';
import SensorChart from '@/components/SensorChart';
import NutrientControl from '@/components/NutrientControl';
import { Toaster } from 'react-hot-toast';
import { HydroMeasurement, EnvironmentMeasurement } from '@/lib/supabase';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      // Fetch latest hydro data
      const hydroRes = await fetch('/api/hydro-data');
      const hydroData = await hydroRes.json();
      setHydroData(hydroData);

      // Fetch latest environment data
      const envRes = await fetch('/api/environment-data');
      const envData = await envRes.json();
      setEnvironmentData(envData);

      // Fetch historical data
      const hydroHistoryRes = await fetch('/api/hydro-data?history=true&limit=24');
      const hydroHistoryData = await hydroHistoryRes.json();
      setHydroHistory(hydroHistoryData);

      const envHistoryRes = await fetch('/api/environment-data?history=true&limit=24');
      const envHistoryData = await envHistoryRes.json();
      setEnvHistory(envHistoryData);

      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Error al cargar datos. Verifica tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Set up polling
    const interval = setInterval(fetchData, 30000); // Poll every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Prepare chart data
  const temperatureChartData = {
    labels: hydroHistory.map(item => {
      const date = new Date(item.created_at || '');
      return date.toLocaleTimeString();
    }),
    datasets: [
      {
        label: 'Temperatura del Agua',
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
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" />
      
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">🌱 HydroWave Dashboard</h1>
          
          <div className="flex items-center space-x-4">
            <span className="text-gray-600">
              {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
            </span>
            <button 
              onClick={fetchData} 
              className="bg-blue-500 text-white px-3 py-1.5 rounded hover:bg-blue-600 transition-colors"
            >
              Actualizar
            </button>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6" role="alert">
            <strong className="font-bold">Error!</strong>
            <span className="block sm:inline"> {error}</span>
          </div>
        )}
        
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando datos...</p>
          </div>
        ) : (
          <>
            <section className="mb-8">
              <h2 className="text-xl font-bold mb-4 text-gray-800">Sensores</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <SensorCard 
                  title="Temperatura del Agua" 
                  value={hydroData?.temperature?.toFixed(1) || '--'} 
                  unit="°C"
                  icon={<BeakerIcon className="h-6 w-6" />}
                  status={hydroData?.temperature && 
                    (hydroData.temperature < 18 || hydroData.temperature > 26) 
                      ? 'warning' 
                      : 'normal'
                  }
                />
                
                <SensorCard 
                  title="pH" 
                  value={hydroData?.ph?.toFixed(2) || '--'}
                  icon={<BeakerIcon className="h-6 w-6" />}
                  status={hydroData?.ph ? getPHStatus(hydroData.ph) : 'normal'}
                />
                
                <SensorCard 
                  title="TDS" 
                  value={hydroData?.tds?.toFixed(0) || '--'} 
                  unit="ppm"
                  icon={<BeakerIcon className="h-6 w-6" />}
                  status={hydroData?.tds ? getTDSStatus(hydroData.tds) : 'normal'}
                />
                
                <SensorCard 
                  title="Temperatura Ambiente" 
                  value={environmentData?.temperature?.toFixed(1) || '--'} 
                  unit="°C"
                  icon={<WrenchIcon className="h-6 w-6" />}
                  status={environmentData?.temperature && 
                    (environmentData.temperature < 15 || environmentData.temperature > 30) 
                      ? 'warning' 
                      : 'normal'
                  }
                />
              </div>
            </section>
            
            <section className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SensorChart title="Temperatura" data={temperatureChartData} />
              <SensorChart 
                title="pH y TDS" 
                data={nutrientsChartData} 
                options={nutrientsChartOptions} 
              />
            </section>
            
            <section className="mb-8">
              <h2 className="text-xl font-bold mb-4 text-gray-800">Controles</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <RelayControl 
                  title="Bomba Principal" 
                  relayNumber={5} 
                  icon={<Cog6ToothIcon className="h-6 w-6" />}
                  showTimer={true}
                />
                
                <RelayControl 
                  title="Aireador" 
                  relayNumber={7} 
                  icon={<Cog6ToothIcon className="h-6 w-6" />}
                  showTimer={true}
                />
                
                <RelayControl 
                  title="Luz UV" 
                  relayNumber={6} 
                  icon={<LightBulbIcon className="h-6 w-6" />}
                  showTimer={true}
                />
                
                <RelayControl 
                  title="Calentador" 
                  relayNumber={0} 
                  active={hydroData?.temperature 
                    ? hydroData.temperature < 20 
                    : false
                  }
                  icon={<Cog6ToothIcon className="h-6 w-6" />}
                  showTimer={false}
                />
              </div>
            </section>
            
            <section className="mb-8">
              <NutrientControl nutrients={nutrients} />
            </section>
          </>
        )}
      </main>
      
      <footer className="bg-white shadow-md mt-auto py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500">
          <p>HydroWave Control System &copy; {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
} 