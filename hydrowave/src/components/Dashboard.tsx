'use client';

import { useState, useEffect } from 'react';
import supabase from '@/lib/supabase';
import { DashboardData } from '@/types';
import SensorReadings from './SensorReadings';
import RelayControls from './RelayControls';
import NutrientControls from './NutrientControls';
import ChartDisplay from './ChartDisplay';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Función para obtener los datos más recientes de Supabase
  const fetchLatestData = async () => {
    try {
      setLoading(true);
      
      // Obtener los datos ambientales más recientes
      const { data: environmentData, error: environmentError } = await supabase
        .from('environment_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (environmentError) throw environmentError;

      // Obtener los datos hidropónicos más recientes
      const { data: hydroData, error: hydroError } = await supabase
        .from('hydro_measurements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (hydroError) throw hydroError;

      // Obtener los estados de los relés
      const { data: relaysData, error: relaysError } = await supabase
        .from('relay_states')
        .select('*')
        .order('id');
      
      if (relaysError) throw relaysError;

      // Actualizar los datos del dashboard
      setDashboardData({
        environment: environmentData,
        hydro: hydroData,
        relays: relaysData || []
      });

      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Error al cargar los datos. Por favor, intente de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Función para controlar un relé
  const toggleRelay = async (relayId: number, seconds: number = 0) => {
    try {
      // Llamar a la API para cambiar el estado del relé
      const response = await fetch('/api/relay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ relay: relayId, seconds }),
      });

      if (!response.ok) {
        throw new Error('Error al controlar el relé');
      }

      // Actualizar los datos después de cambiar el estado del relé
      fetchLatestData();
    } catch (err) {
      console.error('Error toggling relay:', err);
      setError('Error al controlar el relé. Por favor, intente de nuevo.');
    }
  };

  // Cargar datos al montar el componente y cada 5 segundos
  useEffect(() => {
    fetchLatestData();
    
    const interval = setInterval(() => {
      fetchLatestData();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading && !dashboardData) {
    return <div className="text-center p-8">Cargando datos del sistema...</div>;
  }

  if (error) {
    return (
      <div className="text-center p-8 text-red-600">
        <p>{error}</p>
        <button 
          onClick={fetchLatestData}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">🌱 Control Hidropónico</h1>
      
      {dashboardData && (
        <>
          <SensorReadings 
            environmentData={dashboardData.environment} 
            hydroData={dashboardData.hydro} 
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <ChartDisplay />
            
            <div>
              <RelayControls 
                relays={dashboardData.relays} 
                onToggleRelay={toggleRelay} 
              />
              
              <NutrientControls 
                onDoseNutrient={(nutrient, relayNumber, seconds) => 
                  toggleRelay(relayNumber, seconds)
                } 
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
} 