'use client';

import React from 'react';
import { EcAutoStatusCard } from '@/components/EcAutoStatusCard';
import { PhAutoStatusCard } from '@/components/PhAutoStatusCard';
import CropCalendar from '@/components/CropCalendar';

export interface DashboardAutoControlSectionProps {
  selectedDeviceId: string;
}

export function DashboardAutoControlSection({ selectedDeviceId }: DashboardAutoControlSectionProps) {
  if (!selectedDeviceId) return null;

  return (
    <>
      <EcAutoStatusCard deviceId={selectedDeviceId} />
      <PhAutoStatusCard deviceId={selectedDeviceId} />
    </>
  );
}

export interface DashboardCropSectionProps {
  selectedDeviceId: string;
  userEmail: string;
}

export function DashboardCropSection({ selectedDeviceId, userEmail }: DashboardCropSectionProps) {
  return (
    <section className="mb-8">
      <CropCalendar deviceId={selectedDeviceId} userEmail={userEmail} />
    </section>
  );
}
