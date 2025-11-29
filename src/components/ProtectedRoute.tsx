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
    if (!loading) {
      // ✅ Se não tem usuário autenticado, redirecionar para login
      if (!user) {
        router.push('/login');
        return;
      }

      // ✅ Se tem usuário mas não tem perfil válido na tabela users, redirecionar
      if (!userProfile || !userProfile.is_active) {
        router.push('/login');
        return;
      }
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

  // ✅ Se não está autenticado, não mostrar conteúdo
  if (!user || !userProfile || !userProfile.is_active) {
    return null;
  }

  // ✅ Usuário autenticado e válido, mostrar conteúdo
  return <>{children}</>;
}

