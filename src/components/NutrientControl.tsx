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
        toast.error('O tempo de dosagem deve ser maior que zero');
      return;
    }

    setIsLoading({ ...isLoading, [nutrient.relayNumber]: true });
    
    try {
      const success = await toggleRelay(nutrient.relayNumber, Math.ceil(timeNeeded));
      
      if (success) {
        toast.success(`Dosificando ${nutrient.name} por ${timeNeeded.toFixed(1)} segundos`);
      } else {
        toast.error(`Erro ao dosificar ${nutrient.name}`);
      }
    } catch (error) {
      toast.error(`Erro: ${error instanceof Error ? error.message : 'Desconhecido'}`);
    } finally {
      setTimeout(() => {
        setIsLoading({ ...isLoading, [nutrient.relayNumber]: false });
      }, 1000);
    }
  };

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-bold mb-4 text-dark-text">Tabela de Nutrição</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label htmlFor="pumpRate" className="block text-sm font-medium text-dark-textSecondary mb-1">
            Taxa de dosagem (ml/segundo):
          </label>
          <input
            id="pumpRate"
            type="number"
            min="0.1"
            step="0.1"
            value={pumpFlowRate}
            onChange={(e) => setPumpFlowRate(parseFloat(e.target.value))}
            className="w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text focus:border-aqua-500 focus:outline-none"
          />
        </div>
        
        <div>
          <label htmlFor="totalVolume" className="block text-sm font-medium text-dark-textSecondary mb-1">
            Volume do Reservatório (L):
          </label>
          <input
            id="totalVolume"
            type="number"
            min="1"
            step="1"
            value={totalVolume}
            onChange={(e) => setTotalVolume(parseInt(e.target.value, 10))}
            className="w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text focus:border-aqua-500 focus:outline-none"
          />
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-dark-surface">
            <tr>
              <th className="py-2 px-4 text-left text-sm font-medium text-dark-textSecondary">Nutriente</th>
              <th className="py-2 px-4 text-left text-sm font-medium text-dark-textSecondary">ml por Litro</th>
              <th className="py-2 px-4 text-left text-sm font-medium text-dark-textSecondary">Quantidade (ml)</th>
              <th className="py-2 px-4 text-left text-sm font-medium text-dark-textSecondary">Tempo (seg)</th>
              <th className="py-2 px-4 text-left text-sm font-medium text-dark-textSecondary">Ação</th>
            </tr>
          </thead>
          <tbody>
            {nutrientsState.map((nutrient, index) => (
              <tr key={index} className="border-b border-dark-border">
                <td className="py-2 px-4 text-dark-text">{nutrient.name}</td>
                <td className="py-2 px-4">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={nutrient.mlPerLiter}
                    onChange={(e) => handleMlPerLiterChange(index, parseFloat(e.target.value))}
                    className="w-full p-1.5 bg-dark-surface border border-dark-border rounded-md text-dark-text focus:border-aqua-500 focus:outline-none"
                  />
                </td>
                <td className="py-2 px-4 text-dark-text">{calculateQuantity(nutrient.mlPerLiter).toFixed(1)}</td>
                <td className="py-2 px-4 text-dark-text">{calculateTime(nutrient.mlPerLiter).toFixed(1)}</td>
                <td className="py-2 px-4">
                  <button
                    onClick={() => handleDoseNutrient(nutrient, index)}
                    disabled={isLoading[nutrient.relayNumber]}
                    className={`px-3 py-1.5 bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white rounded transition-all shadow-lg hover:shadow-aqua-500/50 ${
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