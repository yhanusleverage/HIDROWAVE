'use client';

import { GrowCycleTimelinePanel } from '@/components/grow-cycle/GrowCycleTimelinePanel';
import { useAuth } from '@/contexts/AuthContext';
import { useDevicesWithRealtime } from '@/hooks/useDevicesWithRealtime';

export default function TimelineCultivoClient() {
  const { userProfile } = useAuth();
  const { devices } = useDevicesWithRealtime(userProfile?.email);

  return (
    <GrowCycleTimelinePanel
      userEmail={userProfile?.email}
      devices={devices.map((d) => ({ device_id: d.device_id }))}
    />
  );
}
