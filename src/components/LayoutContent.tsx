'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useSidebar } from '@/contexts/SidebarContext';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function LayoutContent({ children }: { children: React.ReactNode }) {
  const { isExpanded } = useSidebar();
  const pathname = usePathname();
  
  // ✅ Rotas públicas (não precisam de autenticação)
  const publicRoutes = ['/login'];
  const isPublicRoute = publicRoutes.includes(pathname || '');

  // ✅ Se é rota pública, mostrar sem proteção
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // ✅ Rotas protegidas: requerem autenticação
  return (
    <ProtectedRoute>
      <div className="flex min-h-screen">
        <Sidebar />
        <main 
          className="flex-1 transition-all duration-300 ease-in-out"
          style={{ 
            marginLeft: isExpanded ? '256px' : '80px'
          }}
        >
          {children}
        </main>
      </div>
    </ProtectedRoute>
  );
}

