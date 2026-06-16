import toast, { type ToastOptions } from 'react-hot-toast';
import ControlToast, {
  type ControlToastCategory,
  type ControlToastVariant,
} from '@/components/ControlToast';

function showControlToast(
  variant: ControlToastVariant,
  message: string,
  category: ControlToastCategory = 'SISTEMA',
  options?: ToastOptions
) {
  return toast.custom(
    (t) => (
      <ControlToast t={t} variant={variant} category={category} message={message} />
    ),
    { duration: variant === 'error' ? 5000 : 4000, ...options }
  );
}

/** Toasts estilo painel de controle — sem logo, com categoria operacional. */
export const hwToast = {
  success: (message: string, category: ControlToastCategory = 'SISTEMA', options?: ToastOptions) =>
    showControlToast('success', message, category, options),
  error: (message: string, category: ControlToastCategory = 'ALERTA', options?: ToastOptions) =>
    showControlToast('error', message, category, options),
  warning: (message: string, category: ControlToastCategory = 'ALERTA', options?: ToastOptions) =>
    showControlToast('warning', message, category, options),
  info: (message: string, category: ControlToastCategory = 'SISTEMA', options?: ToastOptions) =>
    showControlToast('info', message, category, options),
  loading: (message: string, category: ControlToastCategory = 'SISTEMA', options?: ToastOptions) =>
    toast.loading(message, {
      style: {
        background: '#0f1e3a',
        color: '#bae6fd',
        border: '1px solid #1e3a5f',
        borderLeft: '3px solid #26c6da',
        fontSize: '13px',
        fontFamily: 'ui-monospace, monospace',
      },
      ...options,
    }),
  dismiss: toast.dismiss,
  custom: toast.custom,
};

export type { ControlToastCategory };
