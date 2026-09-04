'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { useOnboardingTour } from '@/contexts/OnboardingTourContext';
import type { OnboardingStepId } from '@/lib/onboarding-tour';

function stepCopy(
  o: ReturnType<typeof useLanguage>['t']['onboarding'],
  id: OnboardingStepId
): { title: string; body: string } {
  switch (id) {
    case 'welcome':
      return { title: o.steps.welcomeTitle, body: o.steps.welcomeBody };
    case 'devices':
      return { title: o.steps.devicesTitle, body: o.steps.devicesBody };
    case 'circulation':
      return { title: o.steps.circulationTitle, body: o.steps.circulationBody };
    case 'calibrate':
      return { title: o.steps.calibrateTitle, body: o.steps.calibrateBody };
    case 'autoEc':
      return { title: o.steps.autoEcTitle, body: o.steps.autoEcBody };
    case 'done':
      return { title: o.steps.doneTitle, body: o.steps.doneBody };
    default:
      return { title: '', body: '' };
  }
}

export function OnboardingTour() {
  const { t } = useLanguage();
  const o = t.onboarding;
  const { open, stepIndex, stepId, totalSteps, next, back, skip } = useOnboardingTour();

  if (!open) return null;

  const { title, body } = stepCopy(o, stepId);
  const isLast = stepIndex >= totalSteps - 1;
  const stepLabel = o.stepOf
    .replace('{current}', String(stepIndex + 1))
    .replace('{total}', String(totalSteps));

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-tour-title"
    >
      {/* Cortina */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" aria-hidden />

      <div className="relative w-full max-w-md rounded-2xl border border-aqua-500/40 bg-dark-card shadow-2xl shadow-black/50 overflow-hidden">
        <div className="h-1 bg-dark-surface">
          <div
            className="h-full bg-gradient-to-r from-aqua-500 to-primary-500 transition-all duration-300"
            style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
          />
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-aqua-400">
              {stepLabel}
            </span>
            <button
              type="button"
              onClick={skip}
              className="text-xs text-dark-textSecondary hover:text-dark-text transition-colors"
            >
              {o.skip}
            </button>
          </div>

          <div>
            <h2 id="onboarding-tour-title" className="text-lg font-semibold text-dark-text">
              {title}
            </h2>
            <p className="mt-2 text-sm text-dark-textSecondary leading-relaxed">{body}</p>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={back}
              disabled={stepIndex === 0}
              className="px-3 py-2 rounded-lg text-sm text-dark-textSecondary hover:text-dark-text disabled:opacity-30 disabled:pointer-events-none border border-transparent hover:border-dark-border"
            >
              {o.back}
            </button>
            <button
              type="button"
              onClick={next}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 shadow-lg shadow-aqua-500/20"
            >
              {isLast ? o.finish : o.next}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
