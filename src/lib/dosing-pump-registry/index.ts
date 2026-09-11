export {
  PERISTALTIC_RELAY_MIN,
  PERISTALTIC_RELAY_MAX,
  PERISTALTIC_RELAY_COUNT,
  isPeristalticDosingRelay,
  isCalibratedPump,
  type DosingPumpLegacySource,
  type DosingPumpSlot,
  type DosingPumpRegistry,
} from './types';

export {
  buildDosingPumpRegistryFromConfigs,
  fillEmptyPeristalticSlots,
  readLegacyDosingPumpRegistry,
  type ReadRegistryOptions,
} from './read-legacy';
