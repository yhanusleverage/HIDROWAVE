import React, { useState } from 'react';
import { toggleRelay } from '@/lib/supabase';
import toast from 'react-hot-toast';

type RelayControlProps = {
  title: string;
  relayNumber: number;
  active?: boolean;
  icon?: React.ReactNode;
  showTimer?: boolean;
};

export default function RelayControl({ 
  title, 
  relayNumber, 
  active = false, 
  icon, 
  showTimer = false 
}: RelayControlProps) {
  const [isActive, setIsActive] = useState(active);
  const [seconds, setSeconds] = useState(10);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      const success = await toggleRelay(relayNumber, seconds);
      if (success) {
        setIsActive(!isActive);
        toast.success(`${title} ${isActive ? 'desactivado' : 'activado'} por ${seconds} segundos`);
        
        // If we're turning on, auto-disable after the timeout
        if (!isActive) {
          setTimeout(() => {
            setIsActive(false);
          }, seconds * 1000);
        }
      } else {
        toast.error(`Error al controlar ${title}`);
      }
    } catch (error) {
      toast.error(`Error: ${error instanceof Error ? error.message : 'Desconocido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-medium text-gray-700">{title}</h3>
        {icon && <div className="text-gray-500">{icon}</div>}
      </div>
      
      {showTimer && (
        <div className="mb-3">
          <label htmlFor={`timer-${relayNumber}`} className="block text-sm text-gray-600 mb-1">
            Tiempo (segundos):
          </label>
          <input
            id={`timer-${relayNumber}`}
            type="number"
            min="1"
            max="3600"
            value={seconds}
            onChange={(e) => setSeconds(parseInt(e.target.value, 10))}
            className="w-full p-2 border border-gray-300 rounded-md"
          />
        </div>
      )}
      
      <button
        onClick={handleToggle}
        disabled={isLoading}
        className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
          isActive 
            ? 'bg-red-500 hover:bg-red-600 text-white' 
            : 'bg-green-500 hover:bg-green-600 text-white'
        } ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
      >
        {isLoading ? 'Procesando...' : isActive ? 'Desactivar' : 'Activar'}
      </button>
    </div>
  );
} 