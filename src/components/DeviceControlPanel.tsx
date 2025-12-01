'use client';

import React, { useState, useEffect } from 'react';
import { XMarkIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { DeviceStatus } from '@/lib/automation';
import { useAuth } from '@/contexts/AuthContext';
import { getESPNOWSlaves, ESPNowSlave } from '@/lib/esp-now-slaves';
import { getDeviceAnalytics, DosageMetrics } from '@/lib/analytics';
import toast from 'react-hot-toast';

interface DeviceControlPanelProps {
  device: DeviceStatus;
  isOpen: boolean;
  onClose: () => void;
}

// Usar interface do esp-now-slaves.ts
type SlaveDevice = ESPNowSlave;

interface RelayConfig {
  id: number;
  name: string;
  enabled: boolean;
  schedule?: {
    intervalMinutes: number; // A cada X minutos
    durationMinutes: number;  // Por Y minutos
  };
}

export default function DeviceControlPanel({ device, isOpen, onClose }: DeviceControlPanelProps) {
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'status' | 'rules' | 'local' | 'slaves'>('status');
  
  // Estado para relés locais (PCF8574) - apenas botões de teste por enquanto
  const [localRelays, setLocalRelays] = useState([
    { id: 0, name: 'pH+', state: false },
    { id: 1, name: 'pH-', state: false },
    { id: 2, name: 'Grow', state: false },
    { id: 3, name: 'Micro', state: false },
    { id: 4, name: 'Bloom', state: false },
    { id: 5, name: 'Bomba Principal', state: false },
    { id: 6, name: 'Luz UV', state: false },
    { id: 7, name: 'Aerador', state: false },
    { id: 8, name: 'CalMag', state: false },
  ]);

  // Estado para slaves ESP-NOW (carregados do Supabase)
  const [slaves, setSlaves] = useState<SlaveDevice[]>([]);
  const [loadingSlaves, setLoadingSlaves] = useState(true);
  
  // ✅ NOVO: Estado para nomes temporários dos relés (antes de salvar)
  const [tempRelayNames, setTempRelayNames] = useState<Map<string, string>>(new Map());
  const [savingRelayNames, setSavingRelayNames] = useState<Set<string>>(new Set());

  // Estado para analytics
  const [analytics, setAnalytics] = useState<DosageMetrics[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsDays, setAnalyticsDays] = useState(7);
  

  // Estado para Plano Nutricional (copiado do dashboard)
  const [pumpFlowRate, setPumpFlowRate] = useState(1.0); // Taxa de dosagem (ml/segundo)
  const [totalVolume, setTotalVolume] = useState(10); // Volume do reservatório (L)
  const nutrients = [
    { name: 'pH-', relayNumber: 0, mlPerLiter: 0.5 },
    { name: 'pH+', relayNumber: 1, mlPerLiter: 0.5 },
    { name: 'Grow', relayNumber: 2, mlPerLiter: 2 },
    { name: 'Micro', relayNumber: 3, mlPerLiter: 2 },
    { name: 'Bloom', relayNumber: 4, mlPerLiter: 2 },
    { name: 'CalMag', relayNumber: 5, mlPerLiter: 1 },
    { name: 'Bomba Principal', relayNumber: 6, mlPerLiter: 0 },
    { name: 'Aerador', relayNumber: 7, mlPerLiter: 0 },
  ];
  const [nutrientsState, setNutrientsState] = useState(nutrients);
  const [isLoadingNutrients, setIsLoadingNutrients] = useState<Record<number, boolean>>({});

  // Estados para menus colapsáveis
  const [expandedSlaves, setExpandedSlaves] = useState<Set<string>>(new Set());
  const [expandedRelays, setExpandedRelays] = useState<Set<string>>(new Set());
  const [expandedNutritionalControl, setExpandedNutritionalControl] = useState<boolean>(true); // Inicia expandido
  
  // ✅ Estado para rastrear relés ligados/desligados (slave_mac-relay_id -> boolean)
  const [relayStates, setRelayStates] = useState<Map<string, boolean>>(new Map());
  const [loadingRelays, setLoadingRelays] = useState<Map<string, boolean>>(new Map());

  /**
   * Carrega slaves ESP-NOW do Supabase
   * 
   * Busca dispositivos do tipo ESP32_SLAVE do mesmo usuário
   * e converte para formato ESPNowSlave
   */
  const loadSlaves = async () => {
    if (!device.device_id || !userProfile?.email) {
      setLoadingSlaves(false);
      return;
    }

    console.log('🔄 [DeviceControlPanel] loadSlaves() chamado - buscando estados do Supabase...');
    
    setLoadingSlaves(true);
    try {
      const loadedSlaves = await getESPNOWSlaves(device.device_id, userProfile.email);
      
      console.log(`✅ [DeviceControlPanel] ${loadedSlaves.length} slave(s) carregado(s) do Supabase`);
      
      if (loadedSlaves.length === 0) {
        // Se não houver slaves no banco, mostrar mensagem
        console.log('Nenhum slave ESP-NOW encontrado para este dispositivo');
        toast('Nenhum slave ESP-NOW encontrado. Adicione slaves via ESP32 Master.', {
          icon: 'ℹ️',
          duration: 3000,
        });
      }
      
      // ✅ CRÍTICO: Inicializar relayStates com estados reais do Supabase
      const newRelayStates = new Map<string, boolean>();
      loadedSlaves.forEach(slave => {
        console.log(`   📡 Slave ${slave.name} (${slave.macAddress}):`, 
          slave.relays.map(r => `R${r.id}=${r.state ? 'ON' : 'OFF'}`).join(', '));
        
        slave.relays.forEach(relay => {
          const relayKey = `${slave.macAddress}-${relay.id}`;
          newRelayStates.set(relayKey, relay.state || false);
        });
      });
      
      console.log(`   📊 Estados dos relés inicializados:`, Array.from(newRelayStates.entries()).map(([k, v]) => `${k}=${v ? 'ON' : 'OFF'}`).join(', '));
      
      setRelayStates(newRelayStates); // ✅ Atualizar estados locais com dados do Supabase
      setSlaves(loadedSlaves);
    } catch (error) {
      console.error('Erro ao carregar slaves:', error);
      toast.error('Erro ao carregar slaves ESP-NOW');
    } finally {
      setLoadingSlaves(false);
    }
  };

  /**
   * Carrega analytics de dosagem
   * 
   * Calcula ml dosados baseado em histórico de comandos
   */
  const loadAnalytics = async () => {
    if (!device.device_id) {
      return;
    }

    setLoadingAnalytics(true);
    try {
      const analyticsData = await getDeviceAnalytics(device.device_id, analyticsDays);
      setAnalytics(analyticsData.metrics);
    } catch (error) {
      console.error('Erro ao carregar analytics:', error);
      toast.error('Erro ao carregar analytics');
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // Carregar slaves ESP-NOW do Supabase quando o componente montar ou device mudar
  useEffect(() => {
    if (isOpen && device.device_id && userProfile?.email) {
      loadSlaves();
      loadAnalytics();
    }
  }, [isOpen, device.device_id, userProfile?.email, analyticsDays]);

  // Toggle relé local (HydroControl - PCF8574)
  const toggleLocalRelay = async (relayId: number) => {
    const relay = localRelays.find(r => r.id === relayId);
    if (!relay) return;

    const newState = !relay.state;
    const action = newState ? 'on' : 'off';

    try {
      // ✅ NOVA API: Usar /api/relay-commands/master para relés locais
      const response = await fetch('/api/relay-commands/master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          master_device_id: device.device_id,
          user_email: userProfile?.email,
          master_mac_address: device.mac_address,
          relay_numbers: [relayId],      // ✅ ARRAY
          actions: [action],             // ✅ ARRAY
          duration_seconds: [0],          // ✅ ARRAY (0 = permanente)
          command_type: 'manual',
          priority: 10,
          expires_at: null,
          triggered_by: 'manual',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setLocalRelays(prev =>
          prev.map(r => (r.id === relayId ? { ...r, state: newState } : r))
        );
        console.log(`Relé local ${relay.name} (${relayId}) ${action === 'on' ? 'ligado' : 'desligado'}. Comando ID: ${data.command_id}`);
      } else {
        const error = await response.json();
        console.error('Erro ao controlar relé local:', error);
      }
    } catch (error) {
      console.error('Erro ao controlar relé local:', error);
    }
  };

  // Toggle slave expandido
  const toggleSlave = (macAddress: string) => {
    setExpandedSlaves(prev => {
      const newSet = new Set(prev);
      if (newSet.has(macAddress)) {
        newSet.delete(macAddress);
      } else {
        newSet.add(macAddress);
      }
      return newSet;
    });
  };

  // Toggle relé expandido (dentro do slave)
  const toggleRelay = (slaveMac: string, relayId: number) => {
    const key = `${slaveMac}-${relayId}`;
    setExpandedRelays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // Atualizar nome do relé do slave e salvar no Supabase
  // ✅ NOVO: Atualizar nome temporário (não salva ainda)
  const updateTempRelayName = (slaveMac: string, relayId: number, newName: string) => {
    const key = `${slaveMac}-${relayId}`;
    setTempRelayNames(prev => {
      const next = new Map(prev);
      next.set(key, newName);
      return next;
    });
  };

  // ✅ NOVO: Salvar nome do relé no Supabase
  const saveSlaveRelayName = async (slaveMac: string, relayId: number) => {
    const key = `${slaveMac}-${relayId}`;
    const newName = tempRelayNames.get(key);
    
    if (!newName || newName.trim().length === 0) {
      toast.error('Nome não pode estar vazio');
      return;
    }

    setSavingRelayNames(prev => new Set(prev).add(key));

    const slave = slaves.find(s => s.macAddress === slaveMac);
    const slaveName = slave?.name || '';
    const slaveDeviceId = slave?.device_id;

    try {
      const response = await fetch('/api/esp-now/slave-relay-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          master_device_id: device.device_id,
          slave_mac_address: slaveMac,
          slave_name: slaveName,
          relay_id: relayId,
          relay_name: newName.trim(),
          device_id: slaveDeviceId,
        }),
      });

      if (response.ok) {
        // Atualizar estado local após salvar com sucesso
        setSlaves(prev => prev.map(s => {
          if (s.macAddress === slaveMac) {
            return {
              ...s,
              relays: s.relays.map(relay =>
                relay.id === relayId ? { ...relay, name: newName.trim() } : relay
              ),
            };
          }
          return s;
        }));
        
        // Remover do estado temporário
        setTempRelayNames(prev => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
        
        toast.success(`Nome do relé salvo: "${newName.trim()}"`);
        console.log(`✅ Nome do relé ${relayId} do slave ${slaveMac} salvo: "${newName.trim()}"`);
      } else {
        const error = await response.json();
        console.error('❌ Erro ao salvar nome do relé:', error);
        toast.error(`Erro ao salvar: ${error.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('❌ Erro ao salvar nome do relé:', error);
      toast.error('Erro ao salvar nome do relé');
    } finally {
      setSavingRelayNames(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  // Atualizar schedule do relé e salvar como decision_rule
  const updateRelaySchedule = async (
    slaveMac: string,
    relayId: number,
    intervalMinutes: number,
    durationMinutes: number
  ) => {
    // Atualizar estado local primeiro
    setSlaves(prev =>
      prev.map(slave =>
        slave.macAddress === slaveMac
          ? {
              ...slave,
              relays: slave.relays.map(r =>
                r.id === relayId
                  ? {
                      ...r,
                      schedule: { intervalMinutes, durationMinutes },
                      enabled: true,
                    }
                  : r
              ),
            }
          : slave
      )
    );

    // Buscar nome do relé
    const slave = slaves.find(s => s.macAddress === slaveMac);
    const relay = slave?.relays.find(r => r.id === relayId);
    const relayName = relay?.name || `Relé ${relayId + 1}`;

    // Criar regra de automação temporal no Supabase
    try {
      const response = await fetch('/api/automation/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: device.device_id,
          rule_id: `SCHEDULE_${slaveMac.replace(/:/g, '_')}_${relayId}`,
          rule_name: `Automação: ${relayName} (${slaveMac})`,
          rule_description: `Liga a cada ${intervalMinutes} minutos por ${durationMinutes} minutos`,
          rule_json: {
            conditions: [
              {
                sensor: 'time_interval',
                operator: '==',
                value: intervalMinutes * 60, // Converter para segundos
              },
            ],
            actions: [
              {
                relay_id: relayId,
                relay_name: relayName,
                duration: durationMinutes * 60, // Converter para segundos
                target_device: slaveMac, // MAC do slave para ESP-NOW
              },
            ],
            interval_between_executions: intervalMinutes * 60,
            delay_before_execution: 0,
            priority: 50,
          },
          enabled: true,
          priority: 50,
          created_by: userProfile?.email || 'web_interface',
        }),
      });

      if (response.ok) {
        console.log(`Regra de automação criada para ${relayName} (${slaveMac})`);
      } else {
        const error = await response.json();
        console.error('Erro ao criar regra de automação:', error);
      }
    } catch (error) {
      console.error('Erro ao salvar schedule como regra:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-dark-card border border-dark-border rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-border sticky top-0 bg-dark-card z-10">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-aqua-400 to-primary-400 bg-clip-text text-transparent">
              {device.device_name || device.device_id}
            </h2>
            <p className="text-dark-textSecondary mt-1">
              {device.location || 'Localização não especificada'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-dark-textSecondary hover:text-dark-text transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-dark-border">
          {(['status', 'rules', 'local', 'slaves'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-aqua-500/20 text-aqua-400 border-b-2 border-aqua-500'
                  : 'text-dark-textSecondary hover:text-dark-text'
              }`}
            >
              {tab === 'status' && '📊 Status'}
              {tab === 'rules' && '⚙️ Regras'}
              {tab === 'local' && '🔌 Relés Locais'}
              {tab === 'slaves' && '📡 Slaves ESP-NOW'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* TAB 1: STATUS */}
          {activeTab === 'status' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
                  <p className="text-sm text-dark-textSecondary mb-1">Status</p>
                  <p className={`text-lg font-bold ${device.is_online ? 'text-aqua-400' : 'text-red-400'}`}>
                    {device.is_online ? 'Online' : 'Offline'}
                  </p>
                </div>
                <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
                  <p className="text-sm text-dark-textSecondary mb-1">Última Conexão</p>
                  <p className="text-lg font-bold text-dark-text">
                    {device.last_seen ? new Date(device.last_seen).toLocaleString('pt-BR') : 'N/A'}
                  </p>
                </div>
                <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
                  <p className="text-sm text-dark-textSecondary mb-1">IP Address</p>
                  <p className="text-lg font-bold text-dark-text font-mono">
                    {device.ip_address || 'N/A'}
                  </p>
                </div>
                <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
                  <p className="text-sm text-dark-textSecondary mb-1">Firmware</p>
                  <p className="text-lg font-bold text-dark-text">
                    {device.firmware_version || 'N/A'}
                  </p>
                </div>
              </div>

              {/* ✅ Debug de Memória - Seção Completa - Usando dados reais do banco de dados */}
              {device.free_heap !== undefined && device.free_heap !== null && (
                <div className="bg-dark-card border border-dark-border rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-dark-text mb-4 flex items-center gap-2">
                    🔧 Debug de Memória
                    {(() => {
                      // ✅ free_heap vem do banco de dados (device_status.free_heap)
                      const totalHeap = 300000; // ~300KB para ESP32 (estimativa padrão)
                      const freeHeap = device.free_heap; // ✅ Dado real do banco
                      const freePercent = (freeHeap / totalHeap) * 100;
                      const isLowMemory = freePercent < 20;
                      const isWarning = freePercent < 30;
                      
                      return (
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          isLowMemory ? 'bg-red-500/20 text-red-400' : 
                          isWarning ? 'bg-yellow-500/20 text-yellow-400' : 
                          'bg-green-500/20 text-green-400'
                        }`}>
                          {isLowMemory ? '⚠️ Crítico' : isWarning ? '⚠️ Atenção' : '✅ OK'}
                        </span>
                      );
                    })()}
                  </h3>
                  
                  {(() => {
                    // ✅ free_heap vem do banco de dados (device_status.free_heap)
                    const totalHeap = 300000; // ~300KB para ESP32 (estimativa padrão)
                    const freeHeap = device.free_heap; // ✅ Dado real do banco
                    const usedHeap = totalHeap - freeHeap;
                    const freePercent = (freeHeap / totalHeap) * 100;
                    const usedPercent = (usedHeap / totalHeap) * 100;
                    const isLowMemory = freePercent < 20;
                    const isWarning = freePercent < 30;
                    
                    return (
                      <div className="space-y-4">
                        {/* Barra de Progresso */}
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-dark-textSecondary">Memória Livre</span>
                            <span className={`text-lg font-bold ${
                              isLowMemory ? 'text-red-400' : isWarning ? 'text-yellow-400' : 'text-aqua-400'
                            }`}>
                              {freePercent.toFixed(1)}%
                            </span>
                          </div>
                          <div className="w-full bg-dark-border rounded-full h-4 mb-2">
                            <div
                              className={`h-4 rounded-full transition-all ${
                                isLowMemory ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-aqua-500'
                              }`}
                              style={{ width: `${freePercent}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-dark-textSecondary">
                            <span>Livre: {freeHeap.toLocaleString()} bytes</span>
                            <span>Usada: {usedHeap.toLocaleString()} bytes</span>
                            <span>Total: {totalHeap.toLocaleString()} bytes</span>
                          </div>
                        </div>

                        {/* Alertas e Recomendações */}
                        {(isLowMemory || isWarning) && (
                          <div className={`border rounded-lg p-4 ${
                            isLowMemory ? 'bg-red-500/10 border-red-500/30' : 'bg-yellow-500/10 border-yellow-500/30'
                          }`}>
                            <h4 className={`font-semibold mb-2 ${
                              isLowMemory ? 'text-red-400' : 'text-yellow-400'
                            }`}>
                              {isLowMemory ? '⚠️ Memória Crítica!' : '⚠️ Memória Baixa'}
                            </h4>
                            <ul className="space-y-2 text-sm text-dark-textSecondary">
                              <li className="flex items-start gap-2">
                                <span>•</span>
                                <span>Reduza o número de regras ativas</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span>•</span>
                                <span>Aumente o intervalo de avaliação das regras</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span>•</span>
                                <span>Limpe logs antigos do sistema</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span>•</span>
                                <span>Verifique vazamentos de memória no código</span>
                              </li>
                              {device.total_rules !== undefined && (
                                <li className="flex items-start gap-2">
                                  <span>•</span>
                                  <span>Regras ativas: <strong className="text-dark-text">{device.total_rules}</strong></span>
                                </li>
                              )}
                            </ul>
                          </div>
                        )}

                        {/* Informações Adicionais */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          {device.uptime_seconds !== undefined && (
                            <div className="bg-dark-surface border border-dark-border rounded p-3">
                              <p className="text-dark-textSecondary mb-1">Uptime</p>
                              <p className="font-bold text-dark-text">
                                {Math.floor(device.uptime_seconds / 3600)}h {Math.floor((device.uptime_seconds % 3600) / 60)}m
                              </p>
                            </div>
                          )}
                          {device.reboot_count !== undefined && device.reboot_count !== null && (
                            <div className="bg-dark-surface border border-dark-border rounded p-3">
                              <p className="text-dark-textSecondary mb-1">🔄 Reinícios</p>
                              <p className={`font-bold ${
                                device.reboot_count === 0 
                                  ? 'text-green-400' 
                                  : device.reboot_count < 10 
                                    ? 'text-yellow-400' 
                                    : 'text-red-400'
                              }`}>
                                {device.reboot_count.toLocaleString()}
                              </p>
                              <p className="text-xs text-dark-textSecondary mt-1">
                                {device.reboot_count === 0 
                                  ? 'Estável' 
                                  : device.reboot_count < 10 
                                    ? 'Atenção' 
                                    : 'Crítico'}
                              </p>
                            </div>
                          )}
                          {device.total_rules !== undefined && (
                            <div className="bg-dark-surface border border-dark-border rounded p-3">
                              <p className="text-dark-textSecondary mb-1">Regras Totais</p>
                              <p className="font-bold text-dark-text">{device.total_rules}</p>
                            </div>
                          )}
                          {device.total_evaluations !== undefined && (
                            <div className="bg-dark-surface border border-dark-border rounded p-3">
                              <p className="text-dark-textSecondary mb-1">Avaliações</p>
                              <p className="font-bold text-dark-text">{device.total_evaluations.toLocaleString()}</p>
                            </div>
                          )}
                          {device.last_evaluation && (
                            <div className="bg-dark-surface border border-dark-border rounded p-3">
                              <p className="text-dark-textSecondary mb-1">Última Avaliação</p>
                              <p className="font-bold text-dark-text text-xs">
                                {new Date(device.last_evaluation).toLocaleTimeString('pt-BR')}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Analytics de Dosagem */}
              <div className="mt-6 bg-dark-card border border-dark-border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-dark-text">
                    📊 Analytics de Dosagem
                  </h3>
                  <div className="flex items-center space-x-2">
                    <select
                      value={analyticsDays}
                      onChange={(e) => setAnalyticsDays(parseInt(e.target.value))}
                      className="px-3 py-1 bg-dark-surface border border-dark-border rounded text-dark-text text-sm focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                    >
                      <option value={1}>Último dia</option>
                      <option value={7}>Últimos 7 dias</option>
                      <option value={30}>Últimos 30 dias</option>
                      <option value={90}>Últimos 90 dias</option>
                    </select>
                    <button
                      onClick={loadAnalytics}
                      disabled={loadingAnalytics}
                      className="px-3 py-1 bg-aqua-600 hover:bg-aqua-700 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {loadingAnalytics ? '⏳' : '🔄'}
                    </button>
                  </div>
                </div>

                {loadingAnalytics ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-aqua-500 mx-auto"></div>
                    <p className="mt-4 text-dark-textSecondary">Calculando métricas...</p>
                  </div>
                ) : analytics.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-dark-textSecondary">
                      Nenhum dado de dosagem encontrado no período selecionado
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {analytics.map((metric) => (
                      <div
                        key={metric.relay_id}
                        className="bg-dark-surface border border-dark-border rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-dark-text">{metric.relay_name}</h4>
                          <span className="text-2xl font-bold text-aqua-400">
                            {metric.total_ml_dosed.toFixed(1)} ml
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-dark-textSecondary">Ativações</p>
                            <p className="font-medium text-dark-text">{metric.total_activations}</p>
                          </div>
                          <div>
                            <p className="text-dark-textSecondary">Tempo Total</p>
                            <p className="font-medium text-dark-text">
                              {Math.floor(metric.total_duration_seconds / 60)} min
                            </p>
                          </div>
                          <div>
                            <p className="text-dark-textSecondary">Última Ativação</p>
                            <p className="font-medium text-dark-text text-xs">
                              {metric.last_activation
                                ? new Date(metric.last_activation).toLocaleDateString('pt-BR')
                                : 'Nunca'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Total Geral */}
                    <div className="bg-aqua-500/10 border border-aqua-500/30 rounded-lg p-4 mt-4">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-dark-text">Total Geral</p>
                        <p className="text-2xl font-bold text-aqua-400">
                          {analytics.reduce((sum, m) => sum + m.total_ml_dosed, 0).toFixed(1)} ml
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: REGRAS */}
          {activeTab === 'rules' && (
            <div className="space-y-4">
              {/* Box de Regras de Automação */}
              <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-dark-text mb-4">
                  ⚙️ Regras de Automação
                </h3>
                <p className="text-dark-textSecondary">
                  Carregando regras do Decision Engine para {device.device_id}...
                </p>
                {/* TODO: Carregar regras do Supabase */}
              </div>

              {/* Box de Controle Nutricional Proporcional - Colapsável */}
              <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg overflow-hidden">
                {/* Header - Colapsável */}
                <button
                  onClick={() => setExpandedNutritionalControl(!expandedNutritionalControl)}
                  className="w-full p-6 flex items-center justify-between hover:bg-dark-surface transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    {expandedNutritionalControl ? (
                      <ChevronUpIcon className="w-5 h-5 text-aqua-400" />
                    ) : (
                      <ChevronDownIcon className="w-5 h-5 text-dark-textSecondary" />
                    )}
                    <h3 className="text-lg font-semibold text-dark-text">
                      📋 Controle Nutricional Proporcional
                    </h3>
                  </div>
                </button>

                {/* Conteúdo Expandido - Tabela de Nutrição */}
                {expandedNutritionalControl && (
                  <div className="p-6 border-t border-dark-border">
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
                          {nutrientsState.map((nutrient, index) => {
                            const calculateQuantity = (mlPerLiter: number): number => {
                              return mlPerLiter * totalVolume;
                            };

                            const calculateTime = (mlPerLiter: number): number => {
                              return calculateQuantity(mlPerLiter) / pumpFlowRate;
                            };

                            const handleMlPerLiterChange = (idx: number, value: number) => {
                              const updatedNutrients = [...nutrientsState];
                              updatedNutrients[idx] = { ...updatedNutrients[idx], mlPerLiter: value };
                              setNutrientsState(updatedNutrients);
                            };

                            const handleDoseNutrient = async (nut: typeof nutrients[0], idx: number) => {
                              // Para nutrientes com mlPerLiter > 0, calcular tempo baseado na dosagem
                              // Para relés sem dosagem (Bomba Principal, Aerador), usar tempo padrão de 10 segundos
                              let timeNeeded = 0;
                              if (nut.mlPerLiter > 0) {
                                timeNeeded = calculateTime(nut.mlPerLiter);
                                if (timeNeeded <= 0) {
                                  toast.error('O tempo de dosagem deve ser maior que zero');
                                  return;
                                }
                              } else {
                                // Relés sem dosagem (Bomba Principal, Aerador) - tempo padrão de 10 segundos
                                timeNeeded = 10;
                              }

                              setIsLoadingNutrients({ ...isLoadingNutrients, [nut.relayNumber]: true });
                              
                              try {
                                // ✅ NOVA API: Usar /api/relay-commands/master para relés locais
                                const response = await fetch('/api/relay-commands/master', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    master_device_id: device.device_id,
                                    user_email: userProfile?.email,
                                    master_mac_address: device.mac_address,
                                    relay_numbers: [nut.relayNumber],      // ✅ ARRAY
                                    actions: ['on'],                       // ✅ ARRAY
                                    duration_seconds: [Math.ceil(timeNeeded)], // ✅ ARRAY
                                    command_type: 'manual',
                                    priority: 20, // Prioridade maior para dosagem
                                    expires_at: null,
                                    triggered_by: 'manual',
                                    rule_name: nut.mlPerLiter > 0 ? `Dosagem: ${nut.name}` : `Ativação: ${nut.name}`,
                                  }),
                                });
                                
                                if (response.ok) {
                                  if (nut.mlPerLiter > 0) {
                                    toast.success(`Dosificando ${nut.name} por ${timeNeeded.toFixed(1)} segundos`);
                                  } else {
                                    toast.success(`${nut.name} ativado por ${timeNeeded} segundos`);
                                  }
                                } else {
                                  const error = await response.json();
                                  toast.error(`Erro ao acionar ${nut.name}: ${error.error || 'Erro desconhecido'}`);
                                }
                              } catch (error) {
                                toast.error(`Erro: ${error instanceof Error ? error.message : 'Desconhecido'}`);
                              } finally {
                                setTimeout(() => {
                                  setIsLoadingNutrients({ ...isLoadingNutrients, [nut.relayNumber]: false });
                                }, 1000);
                              }
                            };

                            return (
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
                                    disabled={isLoadingNutrients[nutrient.relayNumber]}
                                    className={`px-3 py-1.5 bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white rounded transition-all shadow-lg hover:shadow-aqua-500/50 ${
                                      isLoadingNutrients[nutrient.relayNumber] ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                                  >
                                    {isLoadingNutrients[nutrient.relayNumber] ? 'Dosificando...' : 'Dosificar'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Box de Comandos ESP-NOW Slaves */}
              <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-dark-text mb-2">
                      📡 Comandos ESP-NOW Slaves
                    </h3>
                    <p className="text-sm text-dark-textSecondary">
                      Configure relés remotos com automação hidropônica (ON a cada X minutos por Y minutos)
                    </p>
                  </div>
                  <button
                    onClick={loadSlaves}
                    disabled={loadingSlaves}
                    className="px-4 py-2 bg-aqua-600 hover:bg-aqua-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingSlaves ? 'Carregando...' : '🔄 Atualizar'}
                  </button>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {loadingSlaves ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-aqua-500 mx-auto"></div>
                      <p className="mt-4 text-dark-textSecondary">Carregando slaves ESP-NOW...</p>
                    </div>
                  ) : slaves.length === 0 ? (
                    <div className="text-center py-8 bg-dark-surface border border-dark-border rounded-lg">
                      <p className="text-dark-textSecondary mb-2">Nenhum slave ESP-NOW encontrado</p>
                      <p className="text-xs text-dark-textSecondary">
                        Os slaves serão descobertos automaticamente pelo ESP32 Master via ESP-NOW
                        <br />
                        e registrados no Supabase quando conectados.
                      </p>
                    </div>
                  ) : (
                    slaves.map(slave => {
                    const isExpanded = expandedSlaves.has(slave.macAddress);
                    return (
                      <div
                        key={slave.macAddress}
                        className="bg-dark-surface border border-dark-border rounded-lg overflow-hidden mb-4"
                      >
                        {/* Header do Slave - Colapsável */}
                        <button
                          onClick={() => toggleSlave(slave.macAddress)}
                          className="w-full p-4 flex items-center justify-between hover:bg-dark-card transition-colors"
                        >
                          <div className="flex items-center space-x-3">
                            {isExpanded ? (
                              <ChevronUpIcon className="w-5 h-5 text-aqua-400" />
                            ) : (
                              <ChevronDownIcon className="w-5 h-5 text-dark-textSecondary" />
                            )}
                            <div className="text-left">
                              <h4 className="font-semibold text-dark-text">{slave.name}</h4>
                              <p className="text-sm text-dark-textSecondary">{slave.macAddress}</p>
                            </div>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              slave.status === 'online'
                                ? 'bg-aqua-500/20 text-aqua-400 border border-aqua-500/30'
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {slave.status === 'online' ? 'Online' : 'Offline'}
                          </span>
                        </button>

                        {/* Conteúdo Expandido - Relés do Slave */}
                        {isExpanded && (
                          <div className="p-4 border-t border-dark-border space-y-3">
                            {slave.relays.map(relay => {
                              const relayKey = `${slave.macAddress}-${relay.id}`;
                              const isRelayExpanded = expandedRelays.has(relayKey);
                              return (
                                <div
                                  key={relay.id}
                                  className="bg-dark-card border border-dark-border rounded-lg overflow-hidden"
                                >
                                  {/* Header do Relé - Colapsável */}
                                  <button
                                    onClick={() => toggleRelay(slave.macAddress, relay.id)}
                                    className="w-full p-3 flex items-center justify-between hover:bg-dark-surface transition-colors"
                                  >
                                    <div className="flex items-center space-x-3">
                                      {isRelayExpanded ? (
                                        <ChevronUpIcon className="w-4 h-4 text-aqua-400" />
                                      ) : (
                                        <ChevronDownIcon className="w-4 h-4 text-dark-textSecondary" />
                                      )}
                                      <span className="font-medium text-dark-text">
                                        Relé {relay.id + 1}: {relay.name}
                                      </span>
                                    </div>
                                    <span
                                      className={`px-2 py-1 rounded text-xs ${
                                        relay.enabled
                                          ? 'bg-aqua-500/20 text-aqua-400'
                                          : 'bg-dark-border text-dark-textSecondary'
                                      }`}
                                    >
                                      {relay.enabled ? 'Ativo' : 'Inativo'}
                                    </span>
                                  </button>

                                  {/* Conteúdo Expandido - Configuração do Relé */}
                                  {isRelayExpanded && (
                                    <div className="p-4 border-t border-dark-border space-y-4">
                                      {/* Nome do Relé */}
                                      <div>
                                        <label className="block text-sm font-medium text-dark-textSecondary mb-2">
                                          Nome do Relé
                                        </label>
                                        <div className="flex gap-2">
                                          <input
                                            type="text"
                                            value={tempRelayNames.get(`${slave.macAddress}-${relay.id}`) ?? relay.name}
                                            onChange={e =>
                                              updateTempRelayName(slave.macAddress, relay.id, e.target.value)
                                            }
                                            className="flex-1 p-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                                            placeholder="Ex: Bomba Água, Chiller, Luz, CO2..."
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                saveSlaveRelayName(slave.macAddress, relay.id);
                                              }
                                            }}
                                          />
                                          <button
                                            onClick={() => saveSlaveRelayName(slave.macAddress, relay.id)}
                                            disabled={savingRelayNames.has(`${slave.macAddress}-${relay.id}`)}
                                            className="px-4 py-2 bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                            title="Salvar nome do relé"
                                          >
                                            {savingRelayNames.has(`${slave.macAddress}-${relay.id}`) ? 'Salvando...' : '💾 Salvar'}
                                          </button>
                                        </div>
                                        <p className="text-xs text-dark-textSecondary mt-1">
                                          Pressione Enter ou clique em Salvar para confirmar
                                        </p>
                                      </div>

                                      {/* Automação Hidropônica */}
                                      <div className="bg-aqua-500/10 border border-aqua-500/30 rounded-lg p-4">
                                        <h5 className="text-sm font-semibold text-aqua-400 mb-3">
                                          Automação Hidropônica
                                        </h5>
                                        <div className="grid grid-cols-2 gap-4">
                                          <div>
                                            <label className="block text-xs text-dark-textSecondary mb-1">
                                              Ligar a cada (minutos)
                                            </label>
                                            <input
                                              type="number"
                                              min="1"
                                              value={relay.schedule?.intervalMinutes || 30}
                                              onChange={e =>
                                                updateRelaySchedule(
                                                  slave.macAddress,
                                                  relay.id,
                                                  parseInt(e.target.value) || 30,
                                                  relay.schedule?.durationMinutes || 5
                                                )
                                              }
                                              className="w-full p-2 bg-dark-bg border border-dark-border rounded text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-xs text-dark-textSecondary mb-1">
                                              Por (minutos)
                                            </label>
                                            <input
                                              type="number"
                                              min="1"
                                              value={relay.schedule?.durationMinutes || 5}
                                              onChange={e =>
                                                updateRelaySchedule(
                                                  slave.macAddress,
                                                  relay.id,
                                                  relay.schedule?.intervalMinutes || 30,
                                                  parseInt(e.target.value) || 5
                                                )
                                              }
                                              className="w-full p-2 bg-dark-bg border border-dark-border rounded text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                                            />
                                          </div>
                                        </div>
                                        <p className="text-xs text-dark-textSecondary mt-2">
                                          Exemplo: Ligar a cada 30 minutos por 5 minutos
                                        </p>
                                      </div>

                                      {/* Botões de Controle Manual */}
                                      <div className="flex space-x-2">
                                        <button
                                          onClick={async () => {
                                            try {
                                              // ✅ NOVA API: Usar /api/relay-commands/slave para slaves
                                              const response = await fetch('/api/relay-commands/slave', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                  master_device_id: device.device_id,
                                                  user_email: userProfile?.email,
                                                  master_mac_address: device.mac_address,
                                                  slave_device_id: `ESP32_SLAVE_${slave.macAddress.replace(/:/g, '_')}`,
                                                  slave_mac_address: slave.macAddress,
                                                  relay_numbers: [relay.id],      // ✅ ARRAY
                                                  actions: ['on'],                // ✅ ARRAY
                                                  duration_seconds: [relay.schedule?.durationMinutes 
                                                    ? relay.schedule.durationMinutes * 60 
                                                    : 0],                         // ✅ ARRAY
                                                  command_type: 'manual',
                                                  priority: 10,
                                                  expires_at: null,
                                                  triggered_by: 'manual',
                                                }),
                                              });

                                              if (response.ok) {
                                                const data = await response.json();
                                                toast.success(`Comando ESP-NOW enviado: Ligar relé ${relay.id} do slave ${slave.macAddress}`);
                                              } else {
                                                const error = await response.json();
                                                toast.error(`Erro ao enviar comando ESP-NOW: ${error.error}`);
                                              }
                                            } catch (error) {
                                              console.error('Erro ao enviar comando ESP-NOW:', error);
                                              toast.error(`Erro: ${error instanceof Error ? error.message : 'Desconhecido'}`);
                                            }
                                          }}
                                          className="flex-1 py-2 px-4 bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white rounded-lg font-medium transition-all"
                                        >
                                          Ligar Agora
                                        </button>
                                        <button
                                          onClick={async () => {
                                            try {
                                              // ✅ NOVA API: Usar /api/relay-commands/slave para slaves
                                              const response = await fetch('/api/relay-commands/slave', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                  master_device_id: device.device_id,
                                                  user_email: userProfile?.email,
                                                  master_mac_address: device.mac_address,
                                                  slave_device_id: `ESP32_SLAVE_${slave.macAddress.replace(/:/g, '_')}`,
                                                  slave_mac_address: slave.macAddress,
                                                  relay_numbers: [relay.id],      // ✅ ARRAY
                                                  actions: ['off'],              // ✅ ARRAY
                                                  duration_seconds: [0],         // ✅ ARRAY
                                                  command_type: 'manual',
                                                  priority: 10,
                                                  expires_at: null,
                                                  triggered_by: 'manual',
                                                }),
                                              });

                                              if (response.ok) {
                                                const data = await response.json();
                                                toast.success(`Comando ESP-NOW enviado: Desligar relé ${relay.id} do slave ${slave.macAddress}`);
                                              } else {
                                                const error = await response.json();
                                                toast.error(`Erro ao enviar comando ESP-NOW: ${error.error}`);
                                              }
                                            } catch (error) {
                                              console.error('Erro ao enviar comando ESP-NOW:', error);
                                              toast.error(`Erro: ${error instanceof Error ? error.message : 'Desconhecido'}`);
                                            }
                                          }}
                                          className="flex-1 py-2 px-4 bg-dark-surface hover:bg-dark-border text-dark-text border border-dark-border rounded-lg font-medium transition-colors"
                                        >
                                          Desligar
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RELÉS LOCAIS (PCF8574) - APENAS BOTÕES DE TESTE */}
          {activeTab === 'local' && (
            <div className="space-y-4">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-dark-text mb-2">
                  Relés PCF8574 Locais (HydroControl)
                </h3>
                <p className="text-sm text-dark-textSecondary">
                  Botões de teste para controlar relés locais. Controle nutricional será adicionado posteriormente.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {localRelays.map(relay => (
                  <div
                    key={relay.id}
                    className="bg-dark-surface border border-dark-border rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-dark-text">{relay.name}</h4>
                      <span
                        className={`w-3 h-3 rounded-full ${
                          relay.state ? 'bg-aqua-500' : 'bg-dark-border'
                        }`}
                      />
                    </div>
                    <button
                      onClick={() => toggleLocalRelay(relay.id)}
                      className={`w-full py-2 px-4 rounded-lg font-medium transition-all ${
                        relay.state
                          ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white'
                          : 'bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white'
                      }`}
                    >
                      {relay.state ? 'Desligar' : 'Ligar'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: SLAVES ESP-NOW */}
          {activeTab === 'slaves' && (
            <div className="space-y-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-dark-text mb-2">
                    Dispositivos ESP-NOW Slaves
                  </h3>
                  <p className="text-sm text-dark-textSecondary">
                    Configure relés remotos com automação hidropônica (ON a cada X minutos por Y minutos)
                  </p>
                </div>
                <button
                  onClick={loadSlaves}
                  disabled={loadingSlaves}
                  className="px-4 py-2 bg-aqua-600 hover:bg-aqua-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingSlaves ? 'Carregando...' : '🔄 Atualizar'}
                </button>
              </div>

              {loadingSlaves ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-aqua-500 mx-auto"></div>
                  <p className="mt-4 text-dark-textSecondary">Carregando slaves ESP-NOW...</p>
                </div>
              ) : slaves.length === 0 ? (
                <div className="text-center py-8 bg-dark-surface border border-dark-border rounded-lg">
                  <p className="text-dark-textSecondary mb-2">Nenhum slave ESP-NOW encontrado</p>
                  <p className="text-xs text-dark-textSecondary">
                    Os slaves serão descobertos automaticamente pelo ESP32 Master via ESP-NOW
                    <br />
                    e registrados no Supabase quando conectados.
                  </p>
                </div>
              ) : (
                <>
                  {slaves.map(slave => {
                    const isExpanded = expandedSlaves.has(slave.macAddress);
                    return (
                      <div
                        key={slave.macAddress}
                        className="bg-dark-surface border border-dark-border rounded-lg overflow-hidden"
                      >
                        {/* Header do Slave - Colapsável */}
                        <button
                          onClick={() => toggleSlave(slave.macAddress)}
                          className="w-full p-4 flex items-center justify-between hover:bg-dark-card transition-colors"
                        >
                          <div className="flex items-center space-x-3">
                            {isExpanded ? (
                              <ChevronUpIcon className="w-5 h-5 text-aqua-400" />
                            ) : (
                              <ChevronDownIcon className="w-5 h-5 text-dark-textSecondary" />
                            )}
                            <div className="text-left">
                              <h4 className="font-semibold text-dark-text">{slave.name}</h4>
                              <p className="text-sm text-dark-textSecondary">{slave.macAddress}</p>
                            </div>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              slave.status === 'online'
                                ? 'bg-aqua-500/20 text-aqua-400 border border-aqua-500/30'
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {slave.status === 'online' ? 'Online' : 'Offline'}
                          </span>
                        </button>

                        {/* Conteúdo Expandido - Relés do Slave */}
                        {isExpanded && (
                          <div className="p-4 border-t border-dark-border space-y-4">
                            {/* ✅ NOVO: Painel de Controle Manual Rápido */}
                            <div className="bg-aqua-500/10 border border-aqua-500/30 rounded-lg p-4 mb-4">
                              <h5 className="text-sm font-semibold text-aqua-400 mb-3 flex items-center">
                                ⚡ Controle Manual Rápido
                              </h5>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {slave.relays.map(relay => {
                                  const relayKey = `${slave.macAddress}-${relay.id}`;
                                  // ✅ Usar estado local se disponível, senão usar estado do Supabase
                                  const isRelayOn = relayStates.has(relayKey) 
                                    ? relayStates.get(relayKey) || false 
                                    : relay.state || false;
                                  const isLoading = loadingRelays.get(relayKey) || false;
                                  
                                  return (
                                    <div
                                      key={relay.id}
                                      className="bg-dark-card border border-dark-border rounded-lg p-3"
                                    >
                                      <div className="flex items-center justify-between mb-2">
                                        <h6 className="text-xs font-medium text-dark-text truncate" title={relay.name || `Relé ${relay.id + 1}`}>
                                          {relay.name || `Relé ${relay.id + 1}`}
                                        </h6>
                                        <span
                                          className={`w-2 h-2 rounded-full ${
                                            isRelayOn ? 'bg-aqua-500' : 'bg-dark-border'
                                          }`}
                                        />
                                      </div>
                                      <div className="flex space-x-1">
                                        <button
                                          onClick={async () => {
                                            console.log(`🔘 [DeviceControlPanel] Botão ON clicado: Slave ${slave.macAddress}, Relé ${relay.id}`);
                                            console.log(`   Estado ANTES: ${relay.state ? 'ON' : 'OFF'}`);
                                            
                                            setLoadingRelays(prev => new Map(prev).set(relayKey, true));
                                            
                                            // ✅ Atualizar estado local IMEDIATAMENTE (otimista)
                                            setRelayStates(prev => {
                                              const newMap = new Map(prev);
                                              newMap.set(relayKey, true);
                                              console.log(`   ✅ Estado local atualizado para: ON`);
                                              return newMap;
                                            });
                                            
                                            try {
                                              console.log(`📤 [DeviceControlPanel] Enviando comando ON para Supabase...`);
                                              // ✅ NOVA API: Usar /api/relay-commands/slave para slaves
                                              const response = await fetch('/api/relay-commands/slave', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                  master_device_id: device.device_id,
                                                  user_email: userProfile?.email,
                                                  master_mac_address: device.mac_address,
                                                  slave_device_id: `ESP32_SLAVE_${slave.macAddress.replace(/:/g, '_')}`,
                                                  slave_mac_address: slave.macAddress,
                                                  relay_numbers: [relay.id],      // ✅ ARRAY
                                                  actions: ['on'],                // ✅ ARRAY
                                                  duration_seconds: [0],          // ✅ ARRAY (0 = permanente)
                                                  command_type: 'manual',
                                                  priority: 10,
                                                  expires_at: null,
                                                  triggered_by: 'manual',
                                                  }),
                                              });

                                              if (response.ok) {
                                                const data = await response.json();
                                                console.log(`✅ [DeviceControlPanel] Comando criado com sucesso:`, data);
                                                console.log(`   Comando ID: ${data.command_id}`);
                                                console.log(`   Status: ${data.command?.status}`);
                                                
                                                toast.success(`${relay.name || `Relé ${relay.id + 1}`} ligado`);
                                                
                                                // ✅ Aguardar 2 segundos antes de recarregar (dar tempo para ESP32 processar)
                                                setTimeout(() => {
                                                  console.log(`🔄 [DeviceControlPanel] Recarregando slaves após 2s para verificar estado atualizado...`);
                                                  loadSlaves();
                                                }, 2000);
                                              } else {
                                                const error = await response.json();
                                                console.error(`❌ [DeviceControlPanel] Erro ao criar comando:`, error);
                                                
                                                // ✅ Reverter estado local se falhou
                                                setRelayStates(prev => {
                                                  const newMap = new Map(prev);
                                                  newMap.set(relayKey, false);
                                                  console.log(`   ⚠️ Estado local revertido para: OFF (comando falhou)`);
                                                  return newMap;
                                                });
                                                
                                                toast.error(`Erro: ${error.error}`);
                                              }
                                            } catch (error) {
                                              console.error(`❌ [DeviceControlPanel] Erro ao enviar comando:`, error);
                                              
                                              // ✅ Reverter estado local se falhou
                                              setRelayStates(prev => {
                                                const newMap = new Map(prev);
                                                newMap.set(relayKey, false);
                                                console.log(`   ⚠️ Estado local revertido para: OFF (erro na requisição)`);
                                                return newMap;
                                              });
                                              
                                              toast.error('Erro ao enviar comando');
                                            } finally {
                                              setLoadingRelays(prev => {
                                                const next = new Map(prev);
                                                next.delete(relayKey);
                                                return next;
                                              });
                                            }
                                          }}
                                          disabled={isLoading || isRelayOn}
                                          className={`flex-1 py-1.5 px-2 text-xs font-medium rounded transition-all ${
                                            isRelayOn
                                              ? 'bg-dark-border text-dark-textSecondary cursor-not-allowed'
                                              : 'bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white'
                                          } disabled:opacity-50`}
                                        >
                                          {isLoading ? '⏳' : 'ON'}
                                        </button>
                                        <button
                                          onClick={async () => {
                                            console.log(`🔘 [DeviceControlPanel] Botão OFF clicado: Slave ${slave.macAddress}, Relé ${relay.id}`);
                                            console.log(`   Estado ANTES: ${relay.state ? 'ON' : 'OFF'}`);
                                            
                                            setLoadingRelays(prev => new Map(prev).set(relayKey, true));
                                            
                                            // ✅ Atualizar estado local IMEDIATAMENTE (otimista)
                                            setRelayStates(prev => {
                                              const newMap = new Map(prev);
                                              newMap.set(relayKey, false);
                                              console.log(`   ✅ Estado local atualizado para: OFF`);
                                              return newMap;
                                            });
                                            
                                            try {
                                              console.log(`📤 [DeviceControlPanel] Enviando comando OFF para Supabase...`);
                                              // ✅ NOVA API: Usar /api/relay-commands/slave para slaves
                                              const response = await fetch('/api/relay-commands/slave', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                  master_device_id: device.device_id,
                                                  user_email: userProfile?.email,
                                                  master_mac_address: device.mac_address,
                                                  slave_device_id: `ESP32_SLAVE_${slave.macAddress.replace(/:/g, '_')}`,
                                                  slave_mac_address: slave.macAddress,
                                                  relay_numbers: [relay.id],      // ✅ ARRAY
                                                  actions: ['off'],              // ✅ ARRAY
                                                  duration_seconds: [0],         // ✅ ARRAY
                                                  command_type: 'manual',
                                                  priority: 10,
                                                  expires_at: null,
                                                  triggered_by: 'manual',
                                                }),
                                              });

                                              if (response.ok) {
                                                const data = await response.json();
                                                console.log(`✅ [DeviceControlPanel] Comando criado com sucesso:`, data);
                                                console.log(`   Comando ID: ${data.command_id}`);
                                                console.log(`   Status: ${data.command?.status}`);
                                                
                                                toast.success(`${relay.name || `Relé ${relay.id + 1}`} desligado`);
                                                
                                                // ✅ Aguardar 2 segundos antes de recarregar (dar tempo para ESP32 processar)
                                                setTimeout(() => {
                                                  console.log(`🔄 [DeviceControlPanel] Recarregando slaves após 2s para verificar estado atualizado...`);
                                                  loadSlaves();
                                                }, 2000);
                                              } else {
                                                const error = await response.json();
                                                console.error(`❌ [DeviceControlPanel] Erro ao criar comando:`, error);
                                                
                                                // ✅ Reverter estado local se falhou
                                                setRelayStates(prev => {
                                                  const newMap = new Map(prev);
                                                  newMap.set(relayKey, true);
                                                  console.log(`   ⚠️ Estado local revertido para: ON (comando falhou)`);
                                                  return newMap;
                                                });
                                                
                                                toast.error(`Erro: ${error.error}`);
                                              }
                                            } catch (error) {
                                              console.error(`❌ [DeviceControlPanel] Erro ao enviar comando:`, error);
                                              
                                              // ✅ Reverter estado local se falhou
                                              setRelayStates(prev => {
                                                const newMap = new Map(prev);
                                                newMap.set(relayKey, true);
                                                console.log(`   ⚠️ Estado local revertido para: ON (erro na requisição)`);
                                                return newMap;
                                              });
                                              
                                              toast.error('Erro ao enviar comando');
                                            } finally {
                                              setLoadingRelays(prev => {
                                                const next = new Map(prev);
                                                next.delete(relayKey);
                                                return next;
                                              });
                                            }
                                          }}
                                          disabled={isLoading || !isRelayOn}
                                          className={`flex-1 py-1.5 px-2 text-xs font-medium rounded transition-all ${
                                            !isRelayOn
                                              ? 'bg-dark-border text-dark-textSecondary cursor-not-allowed'
                                              : 'bg-red-600 hover:bg-red-700 text-white'
                                          } disabled:opacity-50`}
                                        >
                                          {isLoading ? '⏳' : 'OFF'}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Configuração Detalhada (Colapsável) */}
                            <div className="space-y-3">
                              <button
                                onClick={() => {
                                  const allExpanded = slave.relays.every(r => 
                                    expandedRelays.has(`${slave.macAddress}-${r.id}`)
                                  );
                                  slave.relays.forEach(r => {
                                    const key = `${slave.macAddress}-${r.id}`;
                                    if (allExpanded) {
                                      setExpandedRelays(prev => {
                                        const next = new Set(prev);
                                        next.delete(key);
                                        return next;
                                      });
                                    } else {
                                      setExpandedRelays(prev => new Set(prev).add(key));
                                    }
                                  });
                                }}
                                className="w-full py-2 px-4 bg-dark-surface hover:bg-dark-border border border-dark-border rounded-lg text-sm font-medium text-dark-text transition-colors"
                              >
                                {slave.relays.every(r => expandedRelays.has(`${slave.macAddress}-${r.id}`))
                                  ? '▼ Ocultar Configurações Detalhadas'
                                  : '▶ Mostrar Configurações Detalhadas'}
                              </button>

                              {slave.relays.map(relay => {
                                const relayKey = `${slave.macAddress}-${relay.id}`;
                                const isRelayExpanded = expandedRelays.has(relayKey);
                                return (
                                  <div
                                    key={relay.id}
                                    className="bg-dark-card border border-dark-border rounded-lg overflow-hidden"
                                  >
                                    {/* Header do Relé - Colapsável */}
                                    <button
                                      onClick={() => toggleRelay(slave.macAddress, relay.id)}
                                      className="w-full p-3 flex items-center justify-between hover:bg-dark-surface transition-colors"
                                    >
                                      <div className="flex items-center space-x-3">
                                        {isRelayExpanded ? (
                                          <ChevronUpIcon className="w-4 h-4 text-aqua-400" />
                                        ) : (
                                          <ChevronDownIcon className="w-4 h-4 text-dark-textSecondary" />
                                        )}
                                        <span className="font-medium text-dark-text">
                                          Relé {relay.id + 1}: {relay.name}
                                        </span>
                                      </div>
                                      <span
                                        className={`px-2 py-1 rounded text-xs ${
                                          relay.enabled
                                            ? 'bg-aqua-500/20 text-aqua-400'
                                            : 'bg-dark-border text-dark-textSecondary'
                                        }`}
                                      >
                                        {relay.enabled ? 'Ativo' : 'Inativo'}
                                      </span>
                                    </button>

                                    {/* Conteúdo Expandido - Configuração do Relé */}
                                    {isRelayExpanded && (
                                      <div className="p-4 border-t border-dark-border space-y-4">
                                        {/* Nome do Relé */}
                                        <div>
                                          <label className="block text-sm font-medium text-dark-textSecondary mb-2">
                                            Nome do Relé
                                          </label>
                                          <div className="flex gap-2">
                                            <input
                                              type="text"
                                              value={tempRelayNames.get(`${slave.macAddress}-${relay.id}`) ?? relay.name}
                                              onChange={e =>
                                                updateTempRelayName(slave.macAddress, relay.id, e.target.value)
                                              }
                                              className="flex-1 p-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                                              placeholder="Ex: Bomba Água, Chiller, Luz, CO2..."
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  saveSlaveRelayName(slave.macAddress, relay.id);
                                                }
                                              }}
                                            />
                                            <button
                                              onClick={() => saveSlaveRelayName(slave.macAddress, relay.id)}
                                              disabled={savingRelayNames.has(`${slave.macAddress}-${relay.id}`)}
                                              className="px-4 py-2 bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                              title="Salvar nome do relé"
                                            >
                                              {savingRelayNames.has(`${slave.macAddress}-${relay.id}`) ? 'Salvando...' : '💾 Salvar'}
                                            </button>
                                          </div>
                                          <p className="text-xs text-dark-textSecondary mt-1">
                                            Pressione Enter ou clique em Salvar para confirmar
                                          </p>
                                        </div>

                                        {/* Automação Hidropônica */}
                                        <div className="bg-aqua-500/10 border border-aqua-500/30 rounded-lg p-4">
                                          <h5 className="text-sm font-semibold text-aqua-400 mb-3">
                                            Automação Hidropônica
                                          </h5>
                                          <div className="grid grid-cols-2 gap-4">
                                            <div>
                                              <label className="block text-xs text-dark-textSecondary mb-1">
                                                Ligar a cada (minutos)
                                              </label>
                                              <input
                                                type="number"
                                                min="1"
                                                value={relay.schedule?.intervalMinutes || 30}
                                                onChange={e =>
                                                  updateRelaySchedule(
                                                    slave.macAddress,
                                                    relay.id,
                                                    parseInt(e.target.value) || 30,
                                                    relay.schedule?.durationMinutes || 5
                                                  )
                                                }
                                                className="w-full p-2 bg-dark-bg border border-dark-border rounded text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-xs text-dark-textSecondary mb-1">
                                                Por (minutos)
                                              </label>
                                              <input
                                                type="number"
                                                min="1"
                                                value={relay.schedule?.durationMinutes || 5}
                                                onChange={e =>
                                                  updateRelaySchedule(
                                                    slave.macAddress,
                                                    relay.id,
                                                    relay.schedule?.intervalMinutes || 30,
                                                    parseInt(e.target.value) || 5
                                                  )
                                                }
                                                className="w-full p-2 bg-dark-bg border border-dark-border rounded text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                                              />
                                            </div>
                                          </div>
                                          <p className="text-xs text-dark-textSecondary mt-2">
                                            Exemplo: Ligar a cada 30 minutos por 5 minutos
                                          </p>
                                        </div>

                                        {/* Botões de Controle Manual */}
                                        <div className="flex space-x-2">
                                          <button
                                            onClick={async () => {
                                              try {
                                                // ✅ NOVA API: Usar /api/relay-commands/slave para slaves
                                                const response = await fetch('/api/relay-commands/slave', {
                                                  method: 'POST',
                                                  headers: { 'Content-Type': 'application/json' },
                                                  body: JSON.stringify({
                                                    master_device_id: device.device_id,
                                                    user_email: userProfile?.email,
                                                    master_mac_address: device.mac_address,
                                                    slave_device_id: `ESP32_SLAVE_${slave.macAddress.replace(/:/g, '_')}`,
                                                    slave_mac_address: slave.macAddress,
                                                    relay_numbers: [relay.id],      // ✅ ARRAY
                                                    actions: ['on'],                 // ✅ ARRAY
                                                    duration_seconds: [relay.schedule?.durationMinutes 
                                                      ? relay.schedule.durationMinutes * 60 
                                                      : 0],                         // ✅ ARRAY
                                                    command_type: 'manual',
                                                    priority: 10,
                                                    expires_at: null,
                                                    triggered_by: 'manual',
                                                  }),
                                                });

                                                if (response.ok) {
                                                  const data = await response.json();
                                                  console.log(`Comando ESP-NOW enviado: Ligar relé ${relay.id} do slave ${slave.macAddress}. Comando ID: ${data.command_id}`);
                                                } else {
                                                  const error = await response.json();
                                                  console.error('Erro ao enviar comando ESP-NOW:', error);
                                                }
                                              } catch (error) {
                                                console.error('Erro ao enviar comando ESP-NOW:', error);
                                              }
                                            }}
                                            className="flex-1 py-2 px-4 bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white rounded-lg font-medium transition-all"
                                          >
                                            Ligar Agora
                                          </button>
                                          <button
                                            onClick={async () => {
                                              try {
                                                // ✅ NOVA API: Usar /api/relay-commands/slave para slaves
                                                const response = await fetch('/api/relay-commands/slave', {
                                                  method: 'POST',
                                                  headers: { 'Content-Type': 'application/json' },
                                                  body: JSON.stringify({
                                                    master_device_id: device.device_id,
                                                    user_email: userProfile?.email,
                                                    master_mac_address: device.mac_address,
                                                    slave_device_id: `ESP32_SLAVE_${slave.macAddress.replace(/:/g, '_')}`,
                                                    slave_mac_address: slave.macAddress,
                                                    relay_numbers: [relay.id],      // ✅ ARRAY
                                                    actions: ['off'],               // ✅ ARRAY
                                                    duration_seconds: [0],         // ✅ ARRAY
                                                    command_type: 'manual',
                                                    priority: 10,
                                                    expires_at: null,
                                                    triggered_by: 'manual',
                                                  }),
                                                });

                                                if (response.ok) {
                                                  const data = await response.json();
                                                  console.log(`Comando ESP-NOW enviado: Desligar relé ${relay.id} do slave ${slave.macAddress}. Comando ID: ${data.command_id}`);
                                                } else {
                                                  const error = await response.json();
                                                  console.error('Erro ao enviar comando ESP-NOW:', error);
                                                }
                                              } catch (error) {
                                                console.error('Erro ao enviar comando ESP-NOW:', error);
                                              }
                                            }}
                                            className="flex-1 py-2 px-4 bg-dark-surface hover:bg-dark-border text-dark-text border border-dark-border rounded-lg font-medium transition-colors"
                                          >
                                            Desligar
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

