'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  WifiIcon,
  SignalIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { DeviceStatus, registerDeviceWithEmail, discoverAvailableDevices } from '@/lib/automation';
import {
  getDeviceDisplayStatus,
  getDeviceStatusText,
  getLastSeenText,
  type DeviceDisplayStatus,
} from '@/lib/realtime/device-status';
import { useDevicesWithRealtime } from '@/hooks/useDevicesWithRealtime';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import DeviceControlPanel from '@/components/DeviceControlPanel';
import BrandEmptyState from '@/components/BrandEmptyState';
import BrandLoading from '@/components/BrandLoading';

export default function DispositivosPage() {
  const { userProfile } = useAuth();
  const { t } = useLanguage();
  const d = t.dispositivos;
  const { masters: devices, loading, reload } = useDevicesWithRealtime(userProfile?.email);
  const [selectedDevice, setSelectedDevice] = useState<DeviceStatus | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<DeviceStatus[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);

  const statusLabels = {
    online: t.common.online,
    offline: t.common.offline,
    warning: d.warning,
  };

  const lastSeenLabels = {
    neverConnected: d.neverConnected,
    now: d.now,
    minutesAgo: d.minutesAgo,
    hoursAgo: d.hoursAgo,
    daysAgo: d.daysAgo,
  };

  useEffect(() => {
    if (!selectedDevice) return;
    const updated = devices.find((dev) => dev.device_id === selectedDevice.device_id);
    if (updated) setSelectedDevice(updated);
  }, [devices, selectedDevice?.device_id]);

  const handleDeviceClick = (device: DeviceStatus) => {
    setSelectedDevice(device);
    setIsPanelOpen(true);
  };

  const handleClosePanel = () => {
    setIsPanelOpen(false);
    setSelectedDevice(null);
  };

  const handleOpenAddModal = async () => {
    setIsAddModalOpen(true);
    setLoadingAvailable(true);

    try {
      const userEmail = userProfile?.email || '';
      console.log('🔍 Abrindo modal de adicionar dispositivo...');
      console.log('📧 Email do usuário:', userEmail);
      
      const discovered = await discoverAvailableDevices(userEmail);
      console.log(`✅ ${discovered.length} dispositivos encontrados para adicionar`);
      
      setAvailableDevices(discovered);
      
      if (discovered.length === 0) {
        toast(d.toastNoneFound, { 
          icon: 'ℹ️',
          duration: 3000 
        });
      }
    } catch (error) {
      console.error('❌ Erro ao descobrir dispositivos:', error);
      toast.error(d.toastDiscoverError);
    } finally {
      setLoadingAvailable(false);
    }
  };

  const handleAssignDevice = async (device: DeviceStatus) => {
    // ✅ VALIDAR: Usuário deve estar autenticado e ter email válido
    if (!userProfile || !userProfile.email) {
      toast.error(d.toastNeedLogin);
      return;
    }

    const userEmail = userProfile.email;
    
    // ✅ VALIDAR: Dispositivo deve ter device_id e mac_address válidos
    if (!device.device_id || !device.mac_address) {
      toast.error(d.toastInvalidDevice);
      return;
    }

    // ✅ VALIDAR: MAC address deve ser válido (não pode ser 00:00:00:00:00:00)
    if (device.mac_address.trim() === '' || device.mac_address === '00:00:00:00:00:00') {
      toast.error(d.toastInvalidMac);
      return;
    }

    // ✅ VALIDAR: Email do usuário deve existir na tabela users e estar ativo
    if (!userProfile.is_active) {
      toast.error(d.toastAccountDisabled);
      return;
    }

    try {
      // 1. Registrar dispositivo no Supabase com email válido do usuário
      const result = await registerDeviceWithEmail(
        device.device_id,
        device.mac_address,
        userEmail,
        device.device_name || undefined,
        device.location || undefined
      );

      if (result) {
        toast.success(
          d.toastAdded.replace('{name}', device.device_name || device.device_id)
        );
        
        // 2. ✅ Se for um slave ESP-NOW, enviar comando de teste
        const isSlave = device.device_type?.toLowerCase().includes('slave') || 
                       device.device_type?.toLowerCase().includes('relaybox') ||
                       device.device_id.startsWith('ESP32_SLAVE_');
        
        if (isSlave) {
          // Buscar o Master para enviar comando
          const masters = devices.filter(dev => 
            dev.device_type?.toLowerCase().includes('hydroponic') || 
            dev.device_type?.toLowerCase().includes('master')
          );
          
          if (masters.length > 0) {
            const master = masters[0];
            toast.loading(d.toastTestSending, { id: 'test-command' });
            
            try {
              // Enviar comando de teste: ligar relé 0 por 2 segundos
              const response = await fetch('/api/esp-now/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  master_device_id: master.device_id,
                  slave_mac_address: device.mac_address,
                  slave_name: device.device_name || device.device_id, // ✅ Nome do slave para target_device_id
                  relay_number: 0,
                  action: 'on',
                  duration_seconds: 2, // Teste rápido de 2 segundos
                  triggered_by: 'device_added_test',
                  command_type: 'manual', // ✅ FORK: Comando manual
                }),
              });

              if (response.ok) {
                const data = await response.json();
                toast.success(d.toastTestSent, { id: 'test-command' });
                console.log(`✅ Comando de teste enviado ao slave ${device.device_name}:`, data);
              } else {
                const error = await response.json();
                toast.error(
                  d.toastTestFail.replace('{error}', error.error || 'Erro desconhecido'),
                  { id: 'test-command' }
                );
                console.error('Erro ao enviar comando de teste:', error);
              }
            } catch (error) {
              toast.error(d.toastTestSkip, { id: 'test-command' });
              console.error('Erro ao enviar comando de teste:', error);
            }
          }
        }
        
        setIsAddModalOpen(false);
        reload();
      } else {
        toast.error(d.toastAssignError);
      }
    } catch (error) {
      console.error('Erro ao adicionar dispositivo:', error);
      toast.error(d.toastAssignError);
    }
  };

  const getStatusIcon = (status: DeviceDisplayStatus) => {
    switch (status) {
      case 'online':
        return <CheckCircleIcon className="w-6 h-6 text-green-500" />;
      case 'offline':
        return <XCircleIcon className="w-6 h-6 text-red-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="w-6 h-6 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: DeviceDisplayStatus) => {
    switch (status) {
      case 'online':
        return 'bg-aqua-500/20 text-aqua-400 border-aqua-500/30';
      case 'offline':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'warning':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default:
        return 'bg-dark-surface text-dark-textSecondary border-dark-border';
    }
  };

  const getStatusText = (status: DeviceDisplayStatus) =>
    getDeviceStatusText(status, statusLabels);

  const onlineCount = devices.filter((dev) => getDeviceDisplayStatus(dev) === 'online').length;
  const offlineCount = devices.filter((dev) => getDeviceDisplayStatus(dev) === 'offline').length;
  const warningCount = devices.filter((dev) => getDeviceDisplayStatus(dev) === 'warning').length;

  return (
    <div className="min-h-screen bg-dark-bg">
      
      <header className="bg-dark-card border-b border-dark-border shadow-lg">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-aqua-400 to-primary-400 bg-clip-text text-transparent">
            📱 {t.pages.dispositivosTitle}
          </h1>
          <p className="text-dark-textSecondary mt-1">{t.pages.dispositivosSubtitle}</p>
        </div>
      </header>
      
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <WifiIcon className="w-5 h-5 text-aqua-400" />
              <span className="text-sm text-dark-textSecondary">
                {d.countOnline.replace('{n}', String(onlineCount))}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <SignalIcon className="w-5 h-5 text-aqua-400" />
              <span className="text-sm text-dark-textSecondary">
                {d.countOffline.replace('{n}', String(offlineCount))}
              </span>
            </div>
          </div>
          <button 
            onClick={handleOpenAddModal}
            className="bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white font-medium py-2 px-4 rounded-lg transition-all shadow-lg hover:shadow-aqua-500/50"
          >
            + {t.common.addDevice}
          </button>
        </div>

        {loading ? (
          <BrandLoading message={t.common.loadingDevices} />
        ) : devices.length === 0 ? (
          <BrandEmptyState
            title={t.common.noDevices}
            description={t.common.noDevicesHint}
          >
            <button
              onClick={handleOpenAddModal}
              className="bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white font-medium py-2 px-4 rounded-lg transition-all shadow-lg hover:shadow-aqua-500/50"
            >
              {t.common.addFirstDevice}
            </button>
          </BrandEmptyState>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices
              .filter(device => {
                // ✅ FILTRO ADICIONAL: Garantir que só mostra dispositivos do usuário logado
                if (!userProfile?.email) return false;
                const deviceEmail = device.user_email?.toLowerCase().trim();
                const userEmail = userProfile.email.toLowerCase().trim();
                return deviceEmail === userEmail;
              })
              .map((device) => {
              const status = getDeviceDisplayStatus(device);
              return (
                <div
                  key={device.id}
                  onClick={() => handleDeviceClick(device)}
                  className={`bg-dark-card rounded-lg shadow-lg p-6 border-2 ${getStatusColor(status)} hover:shadow-aqua-500/20 transition-all cursor-pointer`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-dark-text mb-1">
                        {device.device_name || device.device_id}
                      </h3>
                      <p className="text-sm text-dark-textSecondary">
                        {device.device_type || 'ESP32_HYDROPONIC'}
                      </p>
                    </div>
                    {getStatusIcon(status)}
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-textSecondary">{d.statusLabel}</span>
                      <span className={`font-medium ${getStatusColor(status).split(' ')[1]}`}>
                        {getStatusText(status)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-textSecondary">{d.lastSeenLabel}</span>
                      <span className="text-dark-text">
                        {getLastSeenText(device.last_seen, lastSeenLabels)}
                      </span>
                    </div>
                    
                    {/* ✅ Debug de Memória - Usando dados reais do banco de dados */}
                    {device.free_heap !== undefined && device.free_heap !== null && (
                      <>
                        {(() => {
                          // ✅ free_heap vem do banco de dados (device_status.free_heap)
                          // ESP32 geralmente tem ~300KB de heap total (valor estimado)
                          const totalHeap = 300000; // ~300KB (estimativa padrão para ESP32)
                          const freeHeap = device.free_heap; // ✅ Dado real do banco
                          const freePercent = (freeHeap / totalHeap) * 100;
                          const isLowMemory = freePercent < 20;
                          const isWarning = freePercent < 30;
                          
                          return (
                            <div className={`border rounded-lg p-2 ${isLowMemory ? 'bg-red-500/10 border-red-500/30' : isWarning ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-dark-surface/50 border-dark-border'}`}>
                              <div className="flex justify-between items-center text-xs mb-1">
                                <span className="text-dark-textSecondary">{d.freeMemory}</span>
                                <span className={`font-bold ${isLowMemory ? 'text-red-400' : isWarning ? 'text-yellow-400' : 'text-aqua-400'}`}>
                                  {freePercent.toFixed(1)}%
                                </span>
                              </div>
                              <div className="w-full bg-dark-border rounded-full h-1.5 mb-1">
                                <div
                                  className={`h-1.5 rounded-full transition-all ${
                                    isLowMemory ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-aqua-500'
                                  }`}
                                  style={{ width: `${freePercent}%` }}
                                />
                              </div>
                              <div className="text-xs text-dark-textSecondary">
                                {freeHeap.toLocaleString()} / {totalHeap.toLocaleString()} bytes
                              </div>
                              {isLowMemory && (
                                <div className="mt-1 text-xs text-red-400">
                                  ⚠️ Memória baixa! Considere reduzir regras ativas
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </>
                    )}
                    
                    {device.ip_address && (
                      <div className="flex justify-between text-sm">
                        <span className="text-dark-textSecondary">IP:</span>
                        <span className="text-dark-text font-mono">{device.ip_address}</span>
                      </div>
                    )}
                    
                    {device.firmware_version && (
                      <div className="flex justify-between text-sm">
                        <span className="text-dark-textSecondary">Firmware:</span>
                        <span className="text-dark-text">{device.firmware_version}</span>
                      </div>
                    )}
                    
                    {/* ✅ Reboot Count - Device Info */}
                    {device.reboot_count !== undefined && device.reboot_count !== null && (
                      <div className="flex justify-between text-sm">
                        <span className="text-dark-textSecondary">{d.reboots}</span>
                        <span className={`font-bold ${
                          device.reboot_count === 0 
                            ? 'text-green-400' 
                            : device.reboot_count < 10 
                              ? 'text-yellow-400' 
                              : 'text-red-400'
                        }`}>
                          {device.reboot_count.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-center">
                    <span className="text-sm text-aqua-400 font-medium">{d.clickConfigure}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 bg-dark-card border border-dark-border border-t-2 border-t-aqua-500 rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-dark-text mb-4">{d.statsTitle}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-aqua-500/20 border border-aqua-500/30 p-4 rounded-lg">
              <p className="text-2xl font-bold text-aqua-400">{onlineCount}</p>
              <p className="text-sm text-aqua-300">{d.onlineDevices}</p>
            </div>
            <div className="bg-yellow-500/20 border border-yellow-500/30 p-4 rounded-lg">
              <p className="text-2xl font-bold text-yellow-400">{warningCount}</p>
              <p className="text-sm text-yellow-300">{d.withWarnings}</p>
            </div>
            <div className="bg-red-500/20 border border-red-500/30 p-4 rounded-lg">
              <p className="text-2xl font-bold text-red-400">{offlineCount}</p>
              <p className="text-sm text-red-300">{d.offlineDevices}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Controle do Dispositivo */}
      {selectedDevice && (
        <DeviceControlPanel
          device={selectedDevice}
          isOpen={isPanelOpen}
          onClose={handleClosePanel}
        />
      )}

      {/* Modal de Descobrir e Adicionar Dispositivo */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-bold text-dark-text">🔍 {t.pages.discoverTitle}</h2>
                <p className="text-sm text-dark-textSecondary mt-1">
                  {d.discoverSubtitle}
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-dark-textSecondary hover:text-dark-text"
                aria-label={d.close}
              >
                <XCircleIcon className="w-6 h-6" />
              </button>
            </div>

            {loadingAvailable ? (
              <BrandLoading message={t.common.discoveringDevices} />
            ) : availableDevices.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-dark-textSecondary mb-2">{d.noneAvailable}</p>
                <p className="text-sm text-dark-textSecondary">
                  {d.noneAvailableHint}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {availableDevices.map((device) => (
                  <div
                    key={device.device_id}
                    className="bg-dark-surface border border-dark-border rounded-lg p-4 hover:border-aqua-500/50 transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-dark-text mb-1">
                          {device.device_name || device.device_id}
                        </h3>
                        <div className="space-y-1 text-sm text-dark-textSecondary">
                          <p><span className="font-medium">{d.deviceId}</span> {device.device_id}</p>
                          {device.mac_address && (
                            <p><span className="font-medium">{d.mac}</span> {device.mac_address}</p>
                          )}
                          {device.device_type && (
                            <p><span className="font-medium">{d.type}</span> {device.device_type}</p>
                          )}
                          {device.location && (
                            <p><span className="font-medium">{d.location}</span> {device.location}</p>
                          )}
                          {device.user_email ? (
                            <p className="text-yellow-400">
                              <span className="font-medium">{d.assignedTo}</span> {device.user_email}
                            </p>
                          ) : (
                            <p className="text-aqua-400">
                              <span className="font-medium">{d.statusLabel}</span> {d.availableStatus}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleAssignDevice(device)}
                        className="bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white font-medium py-2 px-4 rounded-lg transition-all ml-4"
                      >
                        {d.add}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 text-dark-textSecondary hover:text-dark-text transition"
              >
                {d.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
