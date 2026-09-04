'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  clearOnboardingDone,
  isOnboardingDone,
  markOnboardingDone,
  ONBOARDING_STEPS,
  type OnboardingStepId,
} from '@/lib/onboarding-tour';
import { hwToast } from '@/lib/control-toast';
import type { ControlToastCategory } from '@/lib/control-toast';
import { useLanguage } from '@/contexts/LanguageContext';

const TOAST_CAT: ControlToastCategory = 'SISTEMA';

interface OnboardingTourContextValue {
  open: boolean;
  stepIndex: number;
  stepId: OnboardingStepId;
  totalSteps: number;
  startTour: (opts?: { fromBeginning?: boolean }) => void;
  next: () => void;
  back: () => void;
  skip: () => void;
}

const OnboardingTourContext = createContext<OnboardingTourContextValue | null>(null);

export function OnboardingTourProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const o = t.onboarding;

  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  const goToStep = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, ONBOARDING_STEPS.length - 1));
      setStepIndex(clamped);
      const href = ONBOARDING_STEPS[clamped]?.href;
      if (href) {
        router.push(href);
      }
    },
    [router]
  );

  const startTour = useCallback(
    (opts?: { fromBeginning?: boolean }) => {
      clearOnboardingDone();
      setOpen(true);
      goToStep(opts?.fromBeginning === false ? stepIndex : 0);
    },
    [goToStep, stepIndex]
  );

  const finish = useCallback(
    (skipped: boolean) => {
      markOnboardingDone();
      setOpen(false);
      hwToast.success(skipped ? o.toastSkipped : o.toastDone, TOAST_CAT);
      if (!skipped) {
        router.push('/dashboard');
      }
    },
    [o.toastDone, o.toastSkipped, router]
  );

  const next = useCallback(() => {
    if (stepIndex >= ONBOARDING_STEPS.length - 1) {
      finish(false);
      return;
    }
    const nextIndex = stepIndex + 1;
    goToStep(nextIndex);
    const stepNum = nextIndex + 1;
    hwToast.info(o.toastStep.replace('{n}', String(stepNum)), TOAST_CAT);
  }, [finish, goToStep, o.toastStep, stepIndex]);

  const back = useCallback(() => {
    if (stepIndex <= 0) return;
    goToStep(stepIndex - 1);
  }, [goToStep, stepIndex]);

  const skip = useCallback(() => {
    finish(true);
  }, [finish]);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (pathname === '/login' || pathname === '/quem-somos') return;

    const force = searchParams.get('guia') === '1' || searchParams.get('tour') === '1';
    if (force) {
      clearOnboardingDone();
      setOpen(true);
      setStepIndex(0);
      return;
    }

    if (!isOnboardingDone() && !open) {
      setOpen(true);
      setStepIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só auto-abrir uma vez; não resetar ao navegar
  }, [hydrated, searchParams]);

  const value = useMemo<OnboardingTourContextValue>(
    () => ({
      open,
      stepIndex,
      stepId: ONBOARDING_STEPS[stepIndex]?.id ?? 'welcome',
      totalSteps: ONBOARDING_STEPS.length,
      startTour,
      next,
      back,
      skip,
    }),
    [open, stepIndex, startTour, next, back, skip]
  );

  return (
    <OnboardingTourContext.Provider value={value}>{children}</OnboardingTourContext.Provider>
  );
}

export function useOnboardingTour(): OnboardingTourContextValue {
  const ctx = useContext(OnboardingTourContext);
  if (!ctx) {
    throw new Error('useOnboardingTour must be used within OnboardingTourProvider');
  }
  return ctx;
}
