'use client';

import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDevicesWithRealtime } from '@/hooks/useDevicesWithRealtime';
import { useCropAlarms } from '@/hooks/useCropAlarms';

/**
 * Montado no layout autenticado — alarmes em todas as páginas (não só dashboard).
 */
export default function CropAlarmsNotifier() {
  const { userProfile } = useAuth();
  const userEmail = userProfile?.email || '';
  const { devices } = useDevicesWithRealtime(userEmail || undefined);

  const deviceIds = useMemo(
    () => devices.map((d) => d.device_id).filter(Boolean),
    [devices]
  );

  useCropAlarms({
    deviceIds,
    userEmail,
    enabled: Boolean(userEmail) && deviceIds.length > 0,
  });

  return null;
}
