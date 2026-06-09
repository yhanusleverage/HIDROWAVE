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
        toast.success(`${title} ${isActive ? 'desativado' : 'ativado'} por ${seconds} segundos`);
        
        // If we're turning on, auto-disable after the timeout
        if (!isActive) {
          setTimeout(() => {
            setIsActive(false);
          }, seconds * 1000);
        }
      } else {
        toast.error(`Erro ao controlar ${title}`);
      }
    } catch (error) {
      toast.error(`Erro: ${error instanceof Error ? error.message : 'Desconhecido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg p-4 hover:shadow-aqua-500/20 hover:border-aqua-500/50 transition-all">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-medium text-dark-text">{title}</h3>
        {icon && <div className="text-aqua-400">{icon}</div>}
      </div>
      
      {showTimer && (
        <div className="mb-3">
          <label htmlFor={`timer-${relayNumber}`} className="block text-sm text-dark-textSecondary mb-1">
            Tempo (segundos):
          </label>
          <input
            id={`timer-${relayNumber}`}
            type="number"
            min="1"
            max="3600"
            value={seconds}
            onChange={(e) => setSeconds(parseInt(e.target.value, 10))}
            className="w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text focus:border-aqua-500 focus:outline-none"
          />
        </div>
      )}
      
      <button
        onClick={handleToggle}
        disabled={isLoading}
        className={`w-full py-2 px-4 rounded-md font-medium transition-all ${
          isActive 
            ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg' 
            : 'bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white shadow-lg hover:shadow-aqua-500/50'
        } ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
      >
        {isLoading ? 'Processando...' : isActive ? 'Desativar' : 'Ativar'}
      </button>
    </div>
  );
} 