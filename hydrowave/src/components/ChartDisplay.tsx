'use client';

import { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import supabase from '@/lib/supabase';

// Registrar los componentes necesarios de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function ChartDisplay() {
  const [chartData, setChartData] = useState<ChartData<'line'> | null>(null);
  const [chartType, setChartType] = useState<'temperature' | 'ph' | 'tds'>('temperature');
  const [timeRange, setTimeRange] = useState<'hour' | 'day' | 'week'>('day');
  
  // Función para obtener los datos del gráfico
  const fetchChartData = async () => {
    try {
      // Calcular el rango de tiempo
      const now = new Date();
      let fromDate = new Date();
      
      switch (timeRange) {
        case 'hour':
          fromDate.setHours(now.getHours() - 1);
          break;
        case 'day':
          fromDate.setDate(now.getDate() - 1);
          break;
        case 'week':
          fromDate.setDate(now.getDate() - 7);
          break;
      }
      
      // Realizar la consulta a Supabase
      const { data, error } = await supabase
        .from('hydro_measurements')
        .select('created_at, water_temperature, ph, tds')
        .gte('created_at', fromDate.toISOString())
        .order('created_at');
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        // Formatear los datos para el gráfico
        const labels = data.map(item => {
          const date = new Date(item.created_at);
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        });
        
        let datasets = [];
        let chartTitle = '';
        
        switch (chartType) {
          case 'temperature':
            datasets = [
              {
                label: 'Temperatura del Agua (°C)',
                data: data.map(item => item.water_temperature),
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.5)',
              }
            ];
            chartTitle = 'Temperatura del Agua';
            break;
          case 'ph':
            datasets = [
              {
                label: 'pH',
                data: data.map(item => item.ph),
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.5)',
              }
            ];
            chartTitle = 'Nivel de pH';
            break;
          case 'tds':
            datasets = [
              {
                label: 'TDS (ppm)',
                data: data.map(item => item.tds),
                borderColor: 'rgb(53, 162, 235)',
                backgroundColor: 'rgba(53, 162, 235, 0.5)',
              }
            ];
            chartTitle = 'Sólidos Disueltos Totales (TDS)';
            break;
        }
        
        setChartData({
          labels,
          datasets
        });
      }
    } catch (err) {
      console.error('Error al obtener datos para el gráfico:', err);
    }
  };
  
  // Cargar datos al montar el componente y cuando cambien los filtros
  useEffect(() => {
    fetchChartData();
  }, [chartType, timeRange]);
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Gráfico de Datos</h2>
        
        <div className="flex space-x-2">
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value as any)}
            className="p-1 border rounded text-sm"
          >
            <option value="temperature">Temperatura</option>
            <option value="ph">pH</option>
            <option value="tds">TDS</option>
          </select>
          
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="p-1 border rounded text-sm"
          >
            <option value="hour">Última Hora</option>
            <option value="day">Último Día</option>
            <option value="week">Última Semana</option>
          </select>
        </div>
      </div>
      
      <div className="h-64">
        {chartData ? (
          <Line
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  beginAtZero: false,
                },
              },
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            Cargando datos...
          </div>
        )}
      </div>
    </div>
  );
} 