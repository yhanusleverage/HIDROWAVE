'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && userProfile && !userProfile.is_active) {
      router.push('/login');
    }
  }, [user, userProfile, loading, router]);

  // ✅ Mostrar loading enquanto verifica autenticação
  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-aqua-500 mx-auto"></div>
          <p className="mt-4 text-dark-textSecondary">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (userProfile && !userProfile.is_active) {
    return null;
  }

  // Auth OK — perfil public.users e opcional (fallback no AuthContext)
  return <>{children}</>;
}

