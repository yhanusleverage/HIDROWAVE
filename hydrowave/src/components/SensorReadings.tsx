import { EnvironmentData, HydroData } from '@/types';

interface SensorReadingsProps {
  environmentData: EnvironmentData;
  hydroData: HydroData;
}

export default function SensorReadings({ environmentData, hydroData }: SensorReadingsProps) {
  // Calcular EC a partir de TDS si no está presente
  const ec = hydroData.ec || hydroData.tds * 2.0;
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">Lecturas de Sensores</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {/* Datos ambientales */}
        <div className="p-3 bg-blue-50 rounded-md">
          <p className="text-sm text-gray-500">Temperatura Ambiente</p>
          <p className="text-2xl font-bold">{environmentData.temperature.toFixed(1)}°C</p>
        </div>
        
        <div className="p-3 bg-blue-50 rounded-md">
          <p className="text-sm text-gray-500">Humedad</p>
          <p className="text-2xl font-bold">{environmentData.humidity.toFixed(1)}%</p>
        </div>
        
        {/* Datos hidropónicos */}
        <div className="p-3 bg-green-50 rounded-md">
          <p className="text-sm text-gray-500">Temperatura Agua</p>
          <p className="text-2xl font-bold">{hydroData.water_temperature.toFixed(1)}°C</p>
        </div>
        
        <div className="p-3 bg-green-50 rounded-md">
          <p className="text-sm text-gray-500">pH</p>
          <p className="text-2xl font-bold">{hydroData.ph.toFixed(2)}</p>
        </div>
        
        <div className="p-3 bg-green-50 rounded-md">
          <p className="text-sm text-gray-500">TDS</p>
          <p className="text-2xl font-bold">{hydroData.tds.toFixed(0)} ppm</p>
        </div>
        
        <div className="p-3 bg-green-50 rounded-md">
          <p className="text-sm text-gray-500">EC</p>
          <p className="text-2xl font-bold">{ec.toFixed(0)} µS/cm</p>
        </div>
        
        {/* Estado del nivel de agua */}
        <div className="p-3 bg-yellow-50 rounded-md col-span-2 md:col-span-3">
          <p className="text-sm text-gray-500">Nivel de Agua</p>
          <div className="flex items-center mt-1">
            <div className={`w-3 h-3 rounded-full mr-2 ${hydroData.water_level_ok ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <p className="text-lg font-medium">
              {hydroData.water_level_ok ? 'Nivel OK' : 'Nivel Bajo - ¡Rellenar!'}
            </p>
          </div>
        </div>
      </div>
      
      <div className="mt-4 text-sm text-gray-500">
        Última actualización: {new Date(hydroData.created_at || '').toLocaleString()}
      </div>
    </div>
  );
} 