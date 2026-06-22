'use client';

import React from 'react';
import BrandLogo from '@/components/BrandLogo';

interface BrandEmptyStateProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export default function BrandEmptyState({ title, description, children }: BrandEmptyStateProps) {
  return (
    <div className="text-center py-12 px-4">
      <div className="flex justify-center mb-6">
        <BrandLogo variant="gradient" size={56} animate />
      </div>
      <p className="text-lg font-medium text-dark-text mb-2">{title}</p>
      {description && (
        <p className="text-dark-textSecondary mb-6 max-w-md mx-auto">{description}</p>
      )}
      {children}
    </div>
  );
}
