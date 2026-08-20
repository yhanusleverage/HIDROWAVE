import type { GrowCyclePlan, GrowWeekProfile } from './types';

const DEFAULT_TANK_VOLUME_L = 100;

/** Volume efectivo del tanque para la semana (masa radicular / timeline). */
export function getWeekTankVolumeL(
  plan: GrowCyclePlan,
  weekIndex: number,
  fallbackL = DEFAULT_TANK_VOLUME_L
): number {
  const profile = plan.weeks.find((w) => w.weekIndex === weekIndex);
  if (!profile) return fallbackL;
  if (
    profile.tankVolumeL != null &&
    Number.isFinite(profile.tankVolumeL) &&
    profile.tankVolumeL > 0
  ) {
    return profile.tankVolumeL;
  }
  return fallbackL;
}

export function withWeekTankVolume(
  profile: GrowWeekProfile,
  tankVolumeL: number
): GrowWeekProfile {
  return { ...profile, tankVolumeL };
}
