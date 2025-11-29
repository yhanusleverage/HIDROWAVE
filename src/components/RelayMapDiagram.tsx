'use client';

import { useState } from 'react';
import { ESPNowSlave } from '@/lib/esp-now-slaves';

interface Relay {
  id: number;
  name: string;
  device: 'master' | 'slave';
  slaveMac?: string;
  state: 'on' | 'off';
  dependencies?: string[];
  conflicts?: string[];
}

interface RelayMapDiagramProps {
  masterRelays: Relay[];
  slaveRelays: ESPNowSlave[];
  onRelayClick?: (relay: Relay) => void;
}

export default function RelayMapDiagram({ 
  masterRelays, 
  slaveRelays, 
  onRelayClick 
}: RelayMapDiagramProps) {
  const [selectedRelay, setSelectedRelay] = useState<Relay | null>(null);

  const handleRelayClick = (relay: Relay) => {
    setSelectedRelay(relay);
    if (onRelayClick) {
      onRelayClick(relay);
    }
  };

  return (
    <div className="bg-dark-card rounded-lg p-6 border border-dark-border">
      <h3 className="text-xl font-bold mb-4 text-dark-text">🗺️ Mapa de Relays</h3>
      
      {/* Master Relays */}
      <div className="mb-6">
        <h4 className="text-lg font-semibold mb-3 text-dark-text">🏠 MASTER (Local)</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {masterRelays.map(relay => (
            <div
              key={relay.id}
              onClick={() => handleRelayClick(relay)}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                selectedRelay?.id === relay.id && selectedRelay?.device === 'master'
                  ? 'border-aqua-500 bg-aqua-500/10'
                  : 'border-dark-border hover:border-aqua-500/50'
              } ${
                relay.state === 'on'
                  ? 'bg-green-500/20'
                  : 'bg-dark-surface'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-dark-text">Relé {relay.id}</span>
                <span className={`w-3 h-3 rounded-full ${
                  relay.state === 'on' ? 'bg-green-500' : 'bg-gray-500'
                }`} />
              </div>
              <div className="text-sm text-dark-textSecondary">
                {relay.name}
              </div>
              {relay.dependencies && relay.dependencies.length > 0 && (
                <div className="mt-2 text-xs text-yellow-500">
                  ⚠️ Dependências: {relay.dependencies.join(', ')}
                </div>
              )}
              {relay.conflicts && relay.conflicts.length > 0 && (
                <div className="mt-1 text-xs text-red-500">
                  ⚠️ Conflitos: {relay.conflicts.join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Slave Relays */}
      {slaveRelays.map(slave => (
        <div key={slave.macAddress} className="mb-6">
          <h4 className="text-lg font-semibold mb-3 text-dark-text">
            🏭 SLAVE: {slave.name} ({slave.macAddress})
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {slave.relays.map(relay => {
              const relayObj: Relay = {
                id: relay.id,
                name: relay.name || `Relé ${relay.id + 1}`,
                device: 'slave',
                slaveMac: slave.macAddress,
                state: (relay as any).state ? 'on' : 'off',
              };
              
              return (
                <div
                  key={relay.id}
                  onClick={() => handleRelayClick(relayObj)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedRelay?.id === relay.id && selectedRelay?.slaveMac === slave.macAddress
                      ? 'border-aqua-500 bg-aqua-500/10'
                      : 'border-dark-border hover:border-aqua-500/50'
                  } ${
                    relayObj.state === 'on'
                      ? 'bg-green-500/20'
                      : 'bg-dark-surface'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-dark-text">Relé {relay.id}</span>
                    <span className={`w-3 h-3 rounded-full ${
                      relayObj.state === 'on' ? 'bg-green-500' : 'bg-gray-500'
                    }`} />
                  </div>
                  <div className="text-sm text-dark-textSecondary">
                    {relay.name || `Relé ${relay.id + 1}`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Detalhes do Relay Selecionado */}
      {selectedRelay && (
        <div className="mt-6 p-4 bg-dark-surface rounded-lg border border-dark-border">
          <h4 className="font-semibold mb-2 text-dark-text">
            Relé {selectedRelay.id}: {selectedRelay.name}
          </h4>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-dark-textSecondary">Estado:</span>
              <span className={`ml-2 ${
                selectedRelay.state === 'on' ? 'text-green-500' : 'text-gray-500'
              }`}>
                {selectedRelay.state.toUpperCase()}
              </span>
            </div>
            <div>
              <span className="text-dark-textSecondary">Dispositivo:</span>
              <span className="ml-2 text-dark-text">
                {selectedRelay.device === 'master' ? 'Master (Local)' : `Slave (${selectedRelay.slaveMac})`}
              </span>
            </div>
            {selectedRelay.dependencies && selectedRelay.dependencies.length > 0 && (
              <div>
                <span className="text-dark-textSecondary">Dependências:</span>
                <ul className="ml-4 list-disc">
                  {selectedRelay.dependencies.map((dep, i) => (
                    <li key={i} className="text-yellow-500">{dep}</li>
                  ))}
                </ul>
              </div>
            )}
            {selectedRelay.conflicts && selectedRelay.conflicts.length > 0 && (
              <div>
                <span className="text-dark-textSecondary">Conflitos:</span>
                <ul className="ml-4 list-disc">
                  {selectedRelay.conflicts.map((conf, i) => (
                    <li key={i} className="text-red-500">{conf}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

