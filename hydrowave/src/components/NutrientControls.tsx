import { useState, useEffect } from 'react';
import { NutrientConfig } from '@/types';

interface NutrientControlsProps {
  onDoseNutrient: (nutrient: string, relayNumber: number, seconds: number) => void;
}

export default function NutrientControls({ onDoseNutrient }: NutrientControlsProps) {
  const [totalVolume, setTotalVolume] = useState(10); // Volumen por defecto: 10 litros
  const [pumpFlowRate, setPumpFlowRate] = useState(1.0); // Tasa de flujo por defecto: 1 ml/segundo
  
  // Configuración de nutrientes
  const [nutrients, setNutrients] = useState<NutrientConfig[]>([
    { name: 'Grow', mlPerLiter: 2, relayNumber: 3 },
    { name: 'Micro', mlPerLiter: 2, relayNumber: 4 },
    { name: 'Bloom', mlPerLiter: 2, relayNumber: 5 },
    { name: 'CalMag', mlPerLiter: 1, relayNumber: 3 },
    { name: 'pH-', mlPerLiter: 0.5, relayNumber: 1 },
    { name: 'pH+', mlPerLiter: 0.5, relayNumber: 2 },
  ]);
  
  // Actualizar la configuración de un nutriente
  const updateNutrientConfig = (index: number, mlPerLiter: number) => {
    const updatedNutrients = [...nutrients];
    updatedNutrients[index] = {
      ...updatedNutrients[index],
      mlPerLiter
    };
    setNutrients(updatedNutrients);
  };
  
  // Calcular la cantidad total y el tiempo necesario para dosificar
  const calculateDosage = (mlPerLiter: number) => {
    const totalQuantity = mlPerLiter * totalVolume;
    const timeNeeded = totalQuantity / pumpFlowRate;
    
    return {
      quantity: totalQuantity.toFixed(1),
      time: timeNeeded.toFixed(1)
    };
  };
  
  // Dosificar un nutriente
  const handleDoseNutrient = (nutrient: NutrientConfig) => {
    const { time } = calculateDosage(nutrient.mlPerLiter);
    onDoseNutrient(nutrient.name, nutrient.relayNumber, parseFloat(time));
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">Control de Nutrientes</h2>
      
      <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Volumen del Reservatorio (L)
          </label>
          <input
            type="number"
            min="1"
            value={totalVolume}
            onChange={(e) => setTotalVolume(Number(e.target.value))}
            className="w-full p-2 border rounded"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tasa de Flujo (ml/segundo)
          </label>
          <div className="flex">
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={pumpFlowRate}
              onChange={(e) => setPumpFlowRate(Number(e.target.value))}
              className="w-full p-2 border rounded-l"
            />
            <button
              className="bg-blue-500 text-white px-4 rounded-r"
              onClick={() => alert('Calibrar bombas para medir la tasa de flujo real')}
            >
              Calibrar
            </button>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nutriente</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ml por Litro</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad (ml)</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tiempo (seg)</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acción</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {nutrients.map((nutrient, index) => {
              const { quantity, time } = calculateDosage(nutrient.mlPerLiter);
              
              return (
                <tr key={nutrient.name}>
                  <td className="px-4 py-2 whitespace-nowrap">{nutrient.name}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={nutrient.mlPerLiter}
                      onChange={(e) => updateNutrientConfig(index, Number(e.target.value))}
                      className="w-20 p-1 border rounded"
                    />
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">{quantity}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{time}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <button
                      onClick={() => handleDoseNutrient(nutrient)}
                      className="bg-green-500 text-white px-3 py-1 rounded text-sm"
                    >
                      Dosar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
} 