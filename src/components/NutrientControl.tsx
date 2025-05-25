import React, { useState, useEffect } from 'react';
import { toggleRelay } from '@/lib/supabase';
import toast from 'react-hot-toast';

type Nutrient = {
  name: string;
  relayNumber: number;
  mlPerLiter: number;
};

type NutrientControlProps = {
  nutrients: Nutrient[];
};

export default function NutrientControl({ nutrients }: NutrientControlProps) {
  const [pumpFlowRate, setPumpFlowRate] = useState<number>(1.0);
  const [totalVolume, setTotalVolume] = useState<number>(10);
  const [nutrientsState, setNutrientsState] = useState<Nutrient[]>(nutrients);
  const [isLoading, setIsLoading] = useState<Record<number, boolean>>({});

  useEffect(() => {
    // Initialize with the provided nutrients
    setNutrientsState(nutrients);
  }, [nutrients]);

  const handleMlPerLiterChange = (index: number, value: number) => {
    const updatedNutrients = [...nutrientsState];
    updatedNutrients[index] = { ...updatedNutrients[index], mlPerLiter: value };
    setNutrientsState(updatedNutrients);
  };

  const calculateQuantity = (mlPerLiter: number): number => {
    return mlPerLiter * totalVolume;
  };

  const calculateTime = (mlPerLiter: number): number => {
    return calculateQuantity(mlPerLiter) / pumpFlowRate;
  };

  const handleDoseNutrient = async (nutrient: Nutrient, index: number) => {
    const timeNeeded = calculateTime(nutrient.mlPerLiter);
    if (timeNeeded <= 0) {
      toast.error('El tiempo de dosificación debe ser mayor que cero');
      return;
    }

    setIsLoading({ ...isLoading, [nutrient.relayNumber]: true });
    
    try {
      const success = await toggleRelay(nutrient.relayNumber, Math.ceil(timeNeeded));
      
      if (success) {
        toast.success(`Dosificando ${nutrient.name} por ${timeNeeded.toFixed(1)} segundos`);
      } else {
        toast.error(`Error al dosificar ${nutrient.name}`);
      }
    } catch (error) {
      toast.error(`Error: ${error instanceof Error ? error.message : 'Desconocido'}`);
    } finally {
      setTimeout(() => {
        setIsLoading({ ...isLoading, [nutrient.relayNumber]: false });
      }, 1000);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold mb-4">Tabla de Nutrición</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label htmlFor="pumpRate" className="block text-sm font-medium text-gray-700 mb-1">
            Tasa de dosificación (ml/segundo):
          </label>
          <input
            id="pumpRate"
            type="number"
            min="0.1"
            step="0.1"
            value={pumpFlowRate}
            onChange={(e) => setPumpFlowRate(parseFloat(e.target.value))}
            className="w-full p-2 border border-gray-300 rounded-md"
          />
        </div>
        
        <div>
          <label htmlFor="totalVolume" className="block text-sm font-medium text-gray-700 mb-1">
            Volumen del Reservorio (L):
          </label>
          <input
            id="totalVolume"
            type="number"
            min="1"
            step="1"
            value={totalVolume}
            onChange={(e) => setTotalVolume(parseInt(e.target.value, 10))}
            className="w-full p-2 border border-gray-300 rounded-md"
          />
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-2 px-4 text-left text-sm font-medium text-gray-600">Nutriente</th>
              <th className="py-2 px-4 text-left text-sm font-medium text-gray-600">ml por Litro</th>
              <th className="py-2 px-4 text-left text-sm font-medium text-gray-600">Cantidad (ml)</th>
              <th className="py-2 px-4 text-left text-sm font-medium text-gray-600">Tiempo (seg)</th>
              <th className="py-2 px-4 text-left text-sm font-medium text-gray-600">Acción</th>
            </tr>
          </thead>
          <tbody>
            {nutrientsState.map((nutrient, index) => (
              <tr key={index} className="border-b border-gray-200">
                <td className="py-2 px-4">{nutrient.name}</td>
                <td className="py-2 px-4">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={nutrient.mlPerLiter}
                    onChange={(e) => handleMlPerLiterChange(index, parseFloat(e.target.value))}
                    className="w-full p-1.5 border border-gray-300 rounded-md"
                  />
                </td>
                <td className="py-2 px-4">{calculateQuantity(nutrient.mlPerLiter).toFixed(1)}</td>
                <td className="py-2 px-4">{calculateTime(nutrient.mlPerLiter).toFixed(1)}</td>
                <td className="py-2 px-4">
                  <button
                    onClick={() => handleDoseNutrient(nutrient, index)}
                    disabled={isLoading[nutrient.relayNumber]}
                    className={`px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors ${
                      isLoading[nutrient.relayNumber] ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {isLoading[nutrient.relayNumber] ? 'Dosificando...' : 'Dosificar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 