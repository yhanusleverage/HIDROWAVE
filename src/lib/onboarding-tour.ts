/** Guia passo a passo — primeira configuração (grower). */

export const ONBOARDING_STORAGE_KEY = 'hw_onboarding_v1_done';
export const ONBOARDING_VERSION = 1;

export type OnboardingStepId =
  | 'welcome'
  | 'devices'
  | 'circulation'
  | 'calibrate'
  | 'autoEc'
  | 'done';

export interface OnboardingStepDef {
  id: OnboardingStepId;
  /** Rota ao mostrar o passo (null = não navega). */
  href: string | null;
}

export const ONBOARDING_STEPS: OnboardingStepDef[] = [
  { id: 'welcome', href: '/dashboard' },
  { id: 'devices', href: '/dispositivos' },
  { id: 'circulation', href: '/automacao?tab=procedures' },
  { id: 'calibrate', href: '/calibragem' },
  { id: 'autoEc', href: '/automacao?tab=ec' },
  { id: 'done', href: '/dashboard' },
];

export function isOnboardingDone(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1';
  } catch {
    return true;
  }
}

export function markOnboardingDone(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearOnboardingDone(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
