'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import ControlToaster from '@/components/ControlToaster';
import Sidebar from '@/components/Sidebar';
import CropAlarmsNotifier from '@/components/CropAlarmsNotifier';
import PageNavOverlay from '@/components/PageNavOverlay';
import { useSidebar } from '@/contexts/SidebarContext';
import { NavigationPendingProvider, useNavigationPending } from '@/contexts/NavigationPendingContext';
import ProtectedRoute from '@/components/ProtectedRoute';

function MainContent({ children }: { children: React.ReactNode }) {
  const { isExpanded } = useSidebar();
  const { pending } = useNavigationPending();

  return (
    <div className="flex min-h-screen">
      {pending && <PageNavOverlay />}
      <Sidebar />
      <main
        className={`relative flex-1 transition-all duration-300 ease-in-out min-h-screen ${
          isExpanded ? 'ml-64' : 'ml-20'
        }`}
      >
        <div className={pending ? 'opacity-0 pointer-events-none' : 'animate-page-enter'}>
          {children}
        </div>
      </main>
    </div>
  );
}

export default function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const publicRoutes = ['/login', '/quem-somos'];
  const isPublicRoute = publicRoutes.includes(pathname || '');

  if (isPublicRoute) {
    return <>{children}</>;
  }

  return (
    <ProtectedRoute>
      <NavigationPendingProvider>
        <CropAlarmsNotifier />
        <ControlToaster />
        <MainContent>{children}</MainContent>
      </NavigationPendingProvider>
    </ProtectedRoute>
  );
}
