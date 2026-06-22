'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import BrandLoading from '@/components/BrandLoading';
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

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <BrandLoading layout="hero" message="Verificando autenticação..." />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (userProfile && !userProfile.is_active) {
    return null;
  }

  return <>{children}</>;
}
