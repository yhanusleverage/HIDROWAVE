'use client';

import React from 'react';
import { Instruction } from '../SequentialScriptEditor';
import { ESPNowSlave } from '@/lib/esp-now-slaves';

interface RelayActionEditorProps {
  instruction: Instruction;
  onChange: (updated: Instruction) => void;
  espnowSlaves: ESPNowSlave[];
}

export default function RelayActionEditor({
  instruction,
  onChange,
  espnowSlaves,
}: RelayActionEditorProps) {
  const updateField = (field: string, value: any) => {
    onChange({
      ...instruction,
      [field]: value,
    });
  };

  // Gerar opções de relés (APENAS slaves)
  const relayOptions: Array<{ value: string; label: string; isSlave: boolean; slaveMac?: string }> = [];

  // Relés Slaves (somente)
  espnowSlaves.forEach((slave) => {
    slave.relays.forEach((relay) => {
      relayOptions.push({
        value: `slave_${slave.macAddress}_${relay.id}`,
        label: `${slave.name || slave.device_id || 'ESP-SLAVE'}: ${relay.id} - ${relay.name || `Relé ${relay.id}`}`,
        isSlave: true,
        slaveMac: slave.macAddress,
      });
    });
  });

  // Se não há relayOptions (nenhum slave), usar valor padrão
  const currentRelayValue = instruction.target === 'slave' && instruction.slave_mac
    ? `slave_${instruction.slave_mac}_${instruction.relay_number}`
    : relayOptions.length > 0 
      ? relayOptions[0].value 
      : '';

  const handleRelayChange = (value: string) => {
    const [type, ...parts] = value.split('_');
    if (type === 'slave') {
      const [mac, relayNum] = parts;
      updateField('target', 'slave');
      updateField('slave_mac', mac);
      updateField('relay_number', parseInt(relayNum));
    } else {
      updateField('target', 'master');
      updateField('slave_mac', undefined);
      updateField('relay_number', parseInt(parts[0]));
    }
  };

  return (
    <div className="space-y-3">
      {/* Layout horizontal compacto - Modelo da primeira imagem */}
      <div className="flex items-center space-x-2">
        {/* Seleção de Relé */}
        <select
          value={currentRelayValue}
          onChange={(e) => handleRelayChange(e.target.value)}
          className="flex-1 p-2 bg-dark-surface border border-dark-border rounded text-dark-text text-sm focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
        >
          {relayOptions.length === 0 ? (
            <option value="">Nenhum relay slave disponível</option>
          ) : (
            relayOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))
          )}
        </select>

        {/* Ação */}
        <select
          value={instruction.action || 'on'}
          onChange={(e) => updateField('action', e.target.value)}
          className="w-32 p-2 bg-dark-surface border border-dark-border rounded text-dark-text text-sm focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
        >
          <option value="on">Ligar (ON)</option>
          <option value="off">Desligar (OFF)</option>
        </select>
      </div>

      {/* Duração (opcional) - Abaixo do layout horizontal */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">
          Duração (segundos) <span className="text-gray-500">(opcional)</span>
        </label>
        <input
          type="number"
          min="0"
          value={instruction.duration_seconds || ''}
          onChange={(e) =>
            updateField('duration_seconds', e.target.value ? parseInt(e.target.value) : undefined)
          }
          placeholder="Ex: 59"
          className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-aqua-500"
        />
      </div>
    </div>
  );
}
