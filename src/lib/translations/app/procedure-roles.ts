import type { HydraulicRoleId } from '@/lib/rule-procedure/types';
import type { AppTranslations } from './types';

export function hydraulicRoleCopy(
  p: AppTranslations['automacao']['procedures'],
  id: HydraulicRoleId
): { label: string; description: string; hint: string } {
  switch (id) {
    case 'circulation_pump':
      return { label: p.circulation, description: p.circulationDesc, hint: p.circulationHint };
    case 'fill_valve':
      return { label: p.fill, description: p.fillDesc, hint: p.fillHint };
    case 'drain_valve':
      return { label: p.drain, description: p.drainDesc, hint: p.drainHint };
    case 'recharge_pump':
      return { label: p.recharge, description: p.rechargeDesc, hint: p.rechargeHint };
  }
}
