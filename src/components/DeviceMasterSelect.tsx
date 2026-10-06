'use client';

import React from 'react';
import { useActiveDevice } from '@/contexts/ActiveDeviceContext';
import { getDeviceDisplayStatus } from '@/lib/realtime/device-status';

type Props = {
  className?: string;
  size?: 'md' | 'lg';
};

export function DeviceMasterSelect({ className = '', size = 'md' }: Props) {
  const { deviceId, masters, setDeviceId } = useActiveDevice();
  if (masters.length === 0) return null;

  const sizeClass =
    size === 'lg'
      ? 'px-4 py-3 text-base sm:text-lg'
      : 'px-4 py-2 text-sm';

  return (
    <select
      value={deviceId}
      onChange={(e) => setDeviceId(e.target.value)}
      className={`w-full sm:w-auto min-w-[200px] bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none ${sizeClass} ${className}`}
    >
      {masters.map((master) => {
        const status = getDeviceDisplayStatus(master);
        const mark = status === 'online' ? '🟢' : status === 'warning' ? '🟡' : '🔴';
        return (
          <option key={master.device_id} value={master.device_id}>
            {master.device_name || master.device_id} {mark}
          </option>
        );
      })}
    </select>
  );
}
