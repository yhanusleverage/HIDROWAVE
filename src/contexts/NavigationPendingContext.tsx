'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { usePathname } from 'next/navigation';
import { PAGE_NAV_TRANSITION_MS } from '@/lib/page-navigation';

interface NavigationPendingContextValue {
  pending: boolean;
  setPending: (value: boolean) => void;
}

const NavigationPendingContext = createContext<NavigationPendingContextValue>({
  pending: false,
  setPending: () => {},
});

function scheduleClear(
  startedAt: number,
  clearTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
  setPendingState: (value: boolean) => void,
  navStartedAtRef: React.MutableRefObject<number | null>
) {
  const elapsed = Date.now() - startedAt;
  const remaining = Math.max(0, PAGE_NAV_TRANSITION_MS - elapsed);

  if (clearTimerRef.current) {
    clearTimeout(clearTimerRef.current);
  }

  clearTimerRef.current = setTimeout(() => {
    navStartedAtRef.current = null;
    setPendingState(false);
    clearTimerRef.current = null;
  }, remaining);
}

export function NavigationPendingProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPendingState] = useState(false);
  const pathname = usePathname();
  const navStartedAt = useRef<number | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setPending = useCallback((value: boolean) => {
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }

    if (!value) {
      navStartedAt.current = null;
      setPendingState(false);
      return;
    }

    const started = Date.now();
    navStartedAt.current = started;
    setPendingState(true);
    scheduleClear(started, clearTimerRef, setPendingState, navStartedAt);
  }, []);

  useEffect(() => {
    if (navStartedAt.current === null) return;
    scheduleClear(navStartedAt.current, clearTimerRef, setPendingState, navStartedAt);
  }, [pathname]);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
    };
  }, []);

  return (
    <NavigationPendingContext.Provider value={{ pending, setPending }}>
      {children}
    </NavigationPendingContext.Provider>
  );
}

export function useNavigationPending() {
  return useContext(NavigationPendingContext);
}
