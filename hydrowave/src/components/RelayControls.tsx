import { useState } from 'react';
import { RelayState } from '@/types';

interface RelayControlsProps {
  relays: RelayState[];
  onToggleRelay: (relayId: number, seconds: number) => void;
}

export default function RelayControls({ relays, onToggleRelay }: RelayControlsProps) {
  const [timerValues, setTimerValues] = useState<{ [key: number]: number }>({});
  
  const handleTimerChange = (relayId: number, value: string) => {
    setTimerValues({
      ...timerValues,
      [relayId]: parseInt(value) || 0
    });
  };
  
  const handleToggleWithTimer = (relayId: number) => {
    const seconds = timerValues[relayId] || 0;
    onToggleRelay(relayId, seconds);
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">Control de Relés</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {relays.map((relay) => (
          <div key={relay.id} className="border rounded-md p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium">{relay.name}</span>
              <span className={`h-3 w-3 rounded-full ${relay.state ? 'bg-green-500' : 'bg-gray-300'}`}></span>
            </div>
            
            <div className="flex items-center mb-2">
              <input
                type="number"
                min="0"
                value={timerValues[relay.id] || ''}
                onChange={(e) => handleTimerChange(relay.id, e.target.value)}
                className="w-full p-1 text-sm border rounded mr-2"
                placeholder="Seg."
              />
              <span className="text-xs text-gray-500">seg</span>
            </div>
            
            <button
              onClick={() => handleToggleWithTimer(relay.id)}
              className={`w-full py-1 px-2 rounded ${
                relay.state ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
              }`}
            >
              {relay.state ? 'Apagar' : 'Activar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
} 