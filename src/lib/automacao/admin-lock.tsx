'use client';

import toast from 'react-hot-toast';
import { LockClosedIcon } from '@heroicons/react/24/outline';

export function validateAdminPassword(password: string): boolean {
  return password === 'admin';
}

export function showLockUnlockToast(
  isLocked: boolean,
  sectionName: string,
  onConfirm: () => void
): void {
  let passwordInputRef: HTMLInputElement | null = null;

  toast.custom(
    (t) => {
      const handleConfirm = () => {
        const password = passwordInputRef?.value || '';

        if (password && validateAdminPassword(password)) {
          onConfirm();
          toast.dismiss(t.id);
          toast.success(isLocked ? `✅ ${sectionName} desbloqueado` : `🔒 ${sectionName} bloqueado`);
        } else {
          toast.error('Senha incorreta!', { id: 'password-error' });
          if (passwordInputRef) {
            passwordInputRef.value = '';
            passwordInputRef.focus();
          }
        }
      };

      return (
        <div
          className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-dark-card border border-dark-border shadow-lg rounded-lg pointer-events-auto flex flex-col p-4`}
        >
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <LockClosedIcon className="h-6 w-6 text-yellow-400" />
            </div>
            <div className="ml-3 w-full">
              <h3 className="text-sm font-medium text-dark-text mb-2">
                🔒 {isLocked ? 'Desbloquear' : 'Bloquear'} {sectionName}
              </h3>
              <p className="text-xs text-dark-textSecondary mb-3">
                Esta ação requer senha de administrador para proteger a configuração.
              </p>
              <input
                ref={(el) => {
                  passwordInputRef = el;
                  if (el) {
                    setTimeout(() => el.focus(), 100);
                  }
                }}
                type="password"
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-md text-dark-text focus:border-aqua-500 focus:outline-none mb-3"
                placeholder="Digite a senha de administrador"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirm();
                  }
                }}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="flex-1 px-3 py-2 bg-aqua-500 hover:bg-aqua-600 text-white rounded-md text-sm font-medium transition-colors"
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => toast.dismiss(t.id)}
                  className="flex-1 px-3 py-2 bg-dark-surface hover:bg-dark-border border border-dark-border text-dark-text rounded-md text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    },
    { duration: Infinity }
  );
}
