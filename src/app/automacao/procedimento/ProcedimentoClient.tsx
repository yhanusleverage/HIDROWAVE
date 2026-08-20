'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** @deprecated Use /automacao?tab=procedures */
export default function ProcedimentoClient() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/automacao?tab=procedures');
  }, [router]);

  return null;
}
