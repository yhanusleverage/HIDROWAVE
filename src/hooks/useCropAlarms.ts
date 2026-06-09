/**
 * Hook personalizado para verificar e exibir alarmes do calendário de cultivo
 * 
 * Este hook:
 * 1. Busca alarmes pendentes periodicamente
 * 2. Verifica se há alarmes que devem ser disparados
 * 3. Exibe toasts quando encontrar alarmes
 * 4. Permite marcar alarmes como acknowledged
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { CropAlarm } from '@/lib/crop-calendar';

interface UseCropAlarmsOptions {
  deviceId: string;
  userEmail: string;
  enabled?: boolean;
  checkInterval?: number; // Intervalo em milissegundos (padrão: 60 segundos)
}

interface UseCropAlarmsReturn {
  alarms: CropAlarm[];
  acknowledgedAlarms: Set<string>;
  acknowledgeAlarm: (alarmId: string) => Promise<void>;
  isLoading: boolean;
}

export function useCropAlarms({
  deviceId,
  userEmail,
  enabled = true,
  checkInterval = 60000, // 60 segundos por padrão
}: UseCropAlarmsOptions): UseCropAlarmsReturn {
  const [alarms, setAlarms] = useState<CropAlarm[]>([]);
  const [acknowledgedAlarms, setAcknowledgedAlarms] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const lastCheckedRef = useRef<Set<string>>(new Set()); // IDs de alarmes já exibidos

  // Función para buscar alarmes pendentes (memorizada con useCallback)
  const fetchAlarms = useCallback(async () => {
    if (!deviceId || !userEmail || !enabled) {
      return;
    }

    try {
      setIsLoading(true);
      
      // Buscar alarmes que foram disparados (triggered = true) mas não foram acknowledged
      const response = await fetch(
        `/api/crop/alarms?device_id=${deviceId}&user_email=${userEmail}&triggered=true&acknowledged=false`
      );

      if (!response.ok) {
        console.error('❌ Erro ao buscar alarmes:', response.statusText);
        return;
      }

      const data = await response.json();
      const triggeredAlarms: CropAlarm[] = data.alarms || [];

      // Filtrar apenas alarmes que ainda não foram exibidos
      const newAlarms = triggeredAlarms.filter(
        alarm => !lastCheckedRef.current.has(String(alarm.id))
      );

      // Exibir toasts para novos alarmes
      newAlarms.forEach((alarm) => {
        const alarmId = String(alarm.id);
        
        // Adicionar ao conjunto de alarmes já verificados
        lastCheckedRef.current.add(alarmId);

        // Determinar tipo de toast baseado no alarm_type
        const toastOptions = {
          id: `alarm-${alarmId}`, // ID único para evitar duplicatas
          duration: alarm.alarm_type === 'alert' ? 10000 : 5000, // Alertas ficam mais tempo
        };

        // Mensagem do toast
        const message = alarm.description 
          ? `${alarm.title}\n${alarm.description}`
          : alarm.title;

        // Exibir toast baseado no tipo
        switch (alarm.alarm_type) {
          case 'alert':
            toast.error(message, {
              ...toastOptions,
              icon: '⚠️',
            });
            break;
          case 'notification':
            toast(message, {
              ...toastOptions,
              icon: 'ℹ️',
            });
            break;
          case 'reminder':
          default:
            toast.success(message, {
              ...toastOptions,
              icon: '🔔',
            });
            break;
        }
      });

      // Atualizar estado com todos os alarmes disparados
      setAlarms(triggeredAlarms);
    } catch (error) {
      console.error('❌ Erro ao buscar alarmes:', error);
    } finally {
      setIsLoading(false);
    }
  }, [deviceId, userEmail, enabled]); // ✅ Dependencias del useCallback

  // Função para marcar alarme como acknowledged
  const acknowledgeAlarm = async (alarmId: string) => {
    try {
      const response = await fetch('/api/crop/alarms', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: alarmId,
          acknowledged: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao marcar alarme como acknowledged');
      }

      // Adicionar ao conjunto de alarmes acknowledged
      setAcknowledgedAlarms(prev => new Set(prev).add(alarmId));
      
      // Remover da lista de alarmes
      setAlarms(prev => prev.filter(alarm => String(alarm.id) !== alarmId));
      
      toast.success('Alarme marcado como lido');
    } catch (error) {
      console.error('❌ Erro ao marcar alarme como acknowledged:', error);
      toast.error('Erro ao marcar alarme como lido');
    }
  };

  // Efeito para verificar alarmes periodicamente
  useEffect(() => {
    if (!deviceId || !userEmail || !enabled) {
      return;
    }

    // Verificar imediatamente ao montar
    fetchAlarms();

    // Configurar intervalo de verificação
    const interval = setInterval(fetchAlarms, checkInterval);

    return () => {
      clearInterval(interval);
    };
  }, [deviceId, userEmail, enabled, checkInterval, fetchAlarms]); // ✅ Incluir fetchAlarms

  return {
    alarms,
    acknowledgedAlarms,
    acknowledgeAlarm,
    isLoading,
  };
}
