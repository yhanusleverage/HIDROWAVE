import { hwToast, type ControlToastCategory } from '@/lib/control-toast';
import type { ToastOptions } from 'react-hot-toast';

/** @deprecated Use hwToast.success — mantido para compatibilidade. */
export function brandToastSuccess(message: string, options?: ToastOptions) {
  let category: ControlToastCategory = 'SISTEMA';
  if (/auto\s*ec/i.test(message)) category = 'AUTO EC';
  else if (/auto\s*ph/i.test(message)) category = 'AUTO PH';
  else if (/regra|função/i.test(message)) category = 'REGRA';
  else if (/calibr/i.test(message)) category = 'CALIBRAGEM';
  return hwToast.success(message, category, options);
}

export { hwToast };
