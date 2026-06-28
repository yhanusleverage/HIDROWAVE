/**
 * Registro derivado de relés dosificadores master (0–7).
 * Fonte de verdade: ph_config_view + ec_config_view + relay_master runtime.
 */

import {
  PENDING_COMMAND_STATUSES,
  isRelayCommandOperationallyPending,
} from '@/lib/realtime/relay-commands';

export const DOSER_RELAY_MIN = 0;
export const DOSER_RELAY_MAX = 7;
export const DOSER_RELAY_COUNT = 8;

export type RelayOwnerKind =
  | 'ec_nutrient'
  | 'ec_dilution_drain'
  | 'ec_dilution_fill'
  | 'ph_up'
  | 'ph_down'
  | 'runtime_active'
  | 'calibragem'
  | 'decision_rule'
  | 'manual';

export interface RelaySlotClaim {
  relayNumber: number;
  owner: RelayOwnerKind;
  label: string;
  sourceId?: string;
}

export interface RelayAllocationRegistry {
  claims: RelaySlotClaim[];
  names: Map<number, string>;
}

export type RelaySelectField =
  | 'ph_up'
  | 'ph_down'
  | 'ec_nutrient'
  | 'ec_dilution_drain'
  | 'ec_dilution_fill'
  | 'calibragem';

export interface RelaySelectContext {
  field: RelaySelectField;
  currentValue: number;
  nutrientIndex?: number;
}

export interface RelayOption {
  number: number;
  name: string;
}

export interface PhConfigRelaySlice {
  relay_ph_up?: number | null;
  relay_ph_down?: number | null;
}

export interface EcNutrientRelaySlice {
  name?: string;
  relay?: number;
  relayNumber?: number;
  mlPerLiter?: number;
  active?: boolean;
}

export interface EcConfigRelaySlice {
  nutrients?: EcNutrientRelaySlice[] | null;
  dilution_drain_relay?: number | null;
  dilution_fill_relay?: number | null;
}

export interface RelayRuntimeSlice {
  doser_relay_states?: boolean[] | null;
  doser_relay_has_timers?: boolean[] | null;
}

export interface DecisionRuleRelaySlice {
  id?: string | number;
  name?: string;
  rule_name?: string;
  enabled?: boolean;
  instructions?: unknown;
  rule_json?: {
    actions?: Array<{
      relay_ids?: number[];
      target_device_id?: string;
    }>;
  };
}

export interface ManualCommandRelaySlice {
  id?: number | string;
  relay_number?: number;
  status?: string;
  created_at?: string;
  sent_at?: string;
  duration_seconds?: number | null;
}

export type DoserRelaySlotBadge = 'livre' | 'atribuido' | 'em_uso';

const CONFIG_OWNERS = new Set<RelayOwnerKind>([
  'ph_up',
  'ph_down',
  'ec_nutrient',
  'ec_dilution_drain',
  'ec_dilution_fill',
]);
const BLOCKING_OWNERS = new Set<RelayOwnerKind>([
  'runtime_active',
  'manual',
  'calibragem',
  'decision_rule',
]);

export interface BuildRegistryInput {
  phConfig?: PhConfigRelaySlice | null;
  ecConfig?: EcConfigRelaySlice | null;
  relayNames?: Map<number, string> | Record<number, string>;
  relayRuntime?: RelayRuntimeSlice | null;
  decisionRules?: DecisionRuleRelaySlice[] | null;
  pendingCommands?: ManualCommandRelaySlice[] | null;
  calibragemRelay?: number | null;
}

function formatCommandAge(createdAt: string): string {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return '';
  const mins = Math.floor(ageMs / 60_000);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} d`;
}

function manualCommandLabel(status: string, createdAt?: string): string {
  if (status === 'sent') return 'Comando manual em trânsito';
  if (createdAt) {
    const age = formatCommandAge(createdAt);
    const ageMs = Date.now() - new Date(createdAt).getTime();
    if (ageMs > 5 * 60_000 && age) return `Comando manual pendente (${age})`;
  }
  return 'Comando manual pendente';
}

function resolveSlotBadge(claims: RelaySlotClaim[]): DoserRelaySlotBadge {
  if (claims.length === 0) return 'livre';
  if (claims.some((c) => BLOCKING_OWNERS.has(c.owner))) return 'em_uso';
  if (claims.some((c) => CONFIG_OWNERS.has(c.owner))) return 'atribuido';
  return 'em_uso';
}

function slotHasBlockingClaims(claims: RelaySlotClaim[]): boolean {
  return claims.some((c) => BLOCKING_OWNERS.has(c.owner));
}

function isDoserRelay(n: number): boolean {
  return Number.isInteger(n) && n >= DOSER_RELAY_MIN && n <= DOSER_RELAY_MAX;
}

function relayName(names: Map<number, string>, relayNumber: number): string {
  return names.get(relayNumber) || `Relé ${relayNumber}`;
}

function toNamesMap(input?: Map<number, string> | Record<number, string>): Map<number, string> {
  if (!input) return new Map();
  if (input instanceof Map) return input;
  const map = new Map<number, string>();
  for (const [k, v] of Object.entries(input)) {
    const n = Number(k);
    if (isDoserRelay(n) && v) map.set(n, String(v));
  }
  return map;
}

function nutrientRelay(nut: EcNutrientRelaySlice): number | null {
  const r = nut.relay ?? nut.relayNumber;
  return typeof r === 'number' && isDoserRelay(r) ? r : null;
}

function isActiveNutrient(nut: EcNutrientRelaySlice): boolean {
  if (nut.active === false) return false;
  const ml = Number(nut.mlPerLiter);
  return Number.isFinite(ml) && ml >= 0.1;
}

function collectRelayNumbersFromInstructions(
  instructions: unknown,
  ruleId: string,
  ruleName: string,
  claims: RelaySlotClaim[]
): void {
  if (!Array.isArray(instructions)) return;

  for (let i = 0; i < instructions.length; i++) {
    const instr = instructions[i] as Record<string, unknown>;
    if (!instr || typeof instr !== 'object') continue;

    if (instr.type === 'relay_action' && instr.target !== 'slave') {
      const relay = Number(instr.relay_number);
      if (isDoserRelay(relay)) {
        claims.push({
          relayNumber: relay,
          owner: 'decision_rule',
          label: ruleName || `Regra ${ruleId}`,
          sourceId: `${ruleId}:${i}`,
        });
      }
    }

    const nestedKeys = ['instructions', 'body', 'then', 'else', 'then_instructions', 'else_instructions'];
    for (const key of nestedKeys) {
      if (Array.isArray(instr[key])) {
        collectRelayNumbersFromInstructions(instr[key], ruleId, ruleName, claims);
      }
    }
  }
}

export function buildRegistryFromConfigs(input: BuildRegistryInput): RelayAllocationRegistry {
  const names = toNamesMap(input.relayNames);
  const claims: RelaySlotClaim[] = [];

  const phUp = Number(input.phConfig?.relay_ph_up);
  if (isDoserRelay(phUp)) {
    claims.push({
      relayNumber: phUp,
      owner: 'ph_up',
      label: 'pH+ (base)',
      sourceId: 'ph_up',
    });
  }

  const phDown = Number(input.phConfig?.relay_ph_down);
  if (isDoserRelay(phDown)) {
    claims.push({
      relayNumber: phDown,
      owner: 'ph_down',
      label: 'pH− (ácido)',
      sourceId: 'ph_down',
    });
  }

  const nutrients = input.ecConfig?.nutrients;
  if (Array.isArray(nutrients)) {
    nutrients.forEach((nut, index) => {
      if (!isActiveNutrient(nut)) return;
      const relay = nutrientRelay(nut);
      if (relay == null) return;
      claims.push({
        relayNumber: relay,
        owner: 'ec_nutrient',
        label: (nut.name || '').trim() || `Nutriente ${index + 1}`,
        sourceId: String(index),
      });
    });
  }

  const dilDrain = Number(input.ecConfig?.dilution_drain_relay);
  const dilDrainMac = (input.ecConfig as { dilution_drain_slave_mac?: string })?.dilution_drain_slave_mac;
  if (isDoserRelay(dilDrain) && !dilDrainMac) {
    claims.push({
      relayNumber: dilDrain,
      owner: 'ec_dilution_drain',
      label: 'Dreno diluição EC (legacy master)',
      sourceId: 'dilution_drain',
    });
  }

  const dilFill = Number(input.ecConfig?.dilution_fill_relay);
  const dilFillMac = (input.ecConfig as { dilution_fill_slave_mac?: string })?.dilution_fill_slave_mac;
  if (isDoserRelay(dilFill) && !dilFillMac) {
    claims.push({
      relayNumber: dilFill,
      owner: 'ec_dilution_fill',
      label: 'Reposição diluição EC (legacy master)',
      sourceId: 'dilution_fill',
    });
  }

  const states = input.relayRuntime?.doser_relay_states || [];
  const timers = input.relayRuntime?.doser_relay_has_timers || [];
  for (let i = DOSER_RELAY_MIN; i <= DOSER_RELAY_MAX; i++) {
    const on = Boolean(states[i]);
    const hasTimer = Boolean(timers[i]);
    if (on || hasTimer) {
      claims.push({
        relayNumber: i,
        owner: 'runtime_active',
        label: on ? 'Relé ligado' : 'Timer ativo',
        sourceId: `runtime:${i}`,
      });
    }
  }

  if (Array.isArray(input.decisionRules)) {
    for (const rule of input.decisionRules) {
      if (rule.enabled === false) continue;
      const id = String(rule.id ?? 'rule');
      const name = (rule.rule_name || rule.name || '').trim() || `Regra ${id}`;

      const actions = rule.rule_json?.actions;
      if (Array.isArray(actions)) {
        actions.forEach((action, ai) => {
          const target = (action.target_device_id || 'local').toLowerCase();
          const isMaster =
            target === 'local' ||
            target === 'master' ||
            target.includes('master') ||
            !action.target_device_id;
          if (!isMaster) return;
          const ids = action.relay_ids;
          if (!Array.isArray(ids)) return;
          ids.forEach((relay) => {
            if (isDoserRelay(relay)) {
              claims.push({
                relayNumber: relay,
                owner: 'decision_rule',
                label: name,
                sourceId: `${id}:action:${ai}`,
              });
            }
          });
        });
      }

      collectRelayNumbersFromInstructions(rule.instructions, id, name, claims);
    }
  }

  if (Array.isArray(input.pendingCommands)) {
    const manualRelaysSeen = new Set<number>();
    for (const cmd of input.pendingCommands) {
      const relay = Number(cmd.relay_number);
      const status = (cmd.status || '').toLowerCase();
      if (!isDoserRelay(relay)) continue;
      if (!PENDING_COMMAND_STATUSES.has(status)) continue;
      if (!isRelayCommandOperationallyPending(cmd)) continue;
      if (manualRelaysSeen.has(relay)) continue;
      manualRelaysSeen.add(relay);
      claims.push({
        relayNumber: relay,
        owner: 'manual',
        label: manualCommandLabel(status, cmd.created_at),
        sourceId: cmd.id != null ? `cmd:${cmd.id}` : `cmd:${relay}`,
      });
    }
  }

  if (input.calibragemRelay != null && isDoserRelay(input.calibragemRelay)) {
    claims.push({
      relayNumber: input.calibragemRelay,
      owner: 'calibragem',
      label: 'Teste calibragem',
      sourceId: 'calibragem',
    });
  }

  return { claims, names };
}

function claimBlocksContext(claim: RelaySlotClaim, context: RelaySelectContext): boolean {
  const { field, nutrientIndex } = context;

  if (field === 'ph_up') {
    if (claim.owner === 'ph_up') return false;
    return claim.owner === 'ph_down' || claim.owner === 'ec_nutrient' || claim.owner === 'runtime_active' ||
      claim.owner === 'decision_rule' || claim.owner === 'manual' || claim.owner === 'calibragem';
  }

  if (field === 'ph_down') {
    if (claim.owner === 'ph_down') return false;
    return claim.owner === 'ph_up' || claim.owner === 'ec_nutrient' || claim.owner === 'runtime_active' ||
      claim.owner === 'decision_rule' || claim.owner === 'manual' || claim.owner === 'calibragem';
  }

  if (field === 'ec_nutrient') {
    if (claim.owner === 'ec_nutrient' && claim.sourceId === String(nutrientIndex ?? -1)) {
      return false;
    }
    return claim.owner === 'ec_nutrient' || claim.owner === 'ph_up' || claim.owner === 'ph_down' ||
      claim.owner === 'ec_dilution_drain' || claim.owner === 'ec_dilution_fill' ||
      claim.owner === 'runtime_active' || claim.owner === 'decision_rule' || claim.owner === 'manual' ||
      claim.owner === 'calibragem';
  }

  if (field === 'ec_dilution_drain') {
    if (claim.owner === 'ec_dilution_drain') return false;
    return claim.owner === 'ec_nutrient' || claim.owner === 'ph_up' || claim.owner === 'ph_down' ||
      claim.owner === 'ec_dilution_fill' || claim.owner === 'runtime_active' ||
      claim.owner === 'decision_rule' || claim.owner === 'manual' || claim.owner === 'calibragem';
  }

  if (field === 'ec_dilution_fill') {
    if (claim.owner === 'ec_dilution_fill') return false;
    return claim.owner === 'ec_nutrient' || claim.owner === 'ph_up' || claim.owner === 'ph_down' ||
      claim.owner === 'ec_dilution_drain' || claim.owner === 'runtime_active' ||
      claim.owner === 'decision_rule' || claim.owner === 'manual' || claim.owner === 'calibragem';
  }

  if (field === 'calibragem') {
    if (claim.owner === 'calibragem') return false;
    return true;
  }

  return false;
}

export function getClaimsForRelay(
  registry: RelayAllocationRegistry,
  relayNumber: number,
  context?: RelaySelectContext
): RelaySlotClaim[] {
  return registry.claims.filter((c) => {
    if (c.relayNumber !== relayNumber) return false;
    if (!context) return true;
    return claimBlocksContext(c, context);
  });
}

export function getRelayConflicts(
  registry: RelayAllocationRegistry,
  relayNumber: number,
  context: RelaySelectContext
): RelaySlotClaim[] {
  if (!isDoserRelay(relayNumber)) return [];
  return getClaimsForRelay(registry, relayNumber, context);
}

export function isRelaySelectable(
  registry: RelayAllocationRegistry,
  relayNumber: number,
  context: RelaySelectContext
): boolean {
  if (!isDoserRelay(relayNumber)) return false;
  if (relayNumber === context.currentValue) return true;
  return getRelayConflicts(registry, relayNumber, context).length === 0;
}

export function getSelectableRelays(
  registry: RelayAllocationRegistry,
  context: RelaySelectContext
): RelayOption[] {
  const options: RelayOption[] = [];
  const seen = new Set<number>();

  for (let i = DOSER_RELAY_MIN; i <= DOSER_RELAY_MAX; i++) {
    if (!isRelaySelectable(registry, i, context)) continue;
    if (seen.has(i)) continue;
    seen.add(i);
    options.push({ number: i, name: relayName(registry.names, i) });
  }

  const current = context.currentValue;
  if (isDoserRelay(current) && !seen.has(current)) {
    options.unshift({ number: current, name: relayName(registry.names, current) });
    seen.add(current);
  }

  return options.sort((a, b) => a.number - b.number);
}

export function getDoserRelaySlots(registry: RelayAllocationRegistry): Array<{
  relayNumber: number;
  name: string;
  claims: RelaySlotClaim[];
  isFree: boolean;
  slotBadge: DoserRelaySlotBadge;
}> {
  const slots = [];
  for (let i = DOSER_RELAY_MIN; i <= DOSER_RELAY_MAX; i++) {
    const slotClaims = registry.claims.filter((c) => c.relayNumber === i);
    const slotBadge = resolveSlotBadge(slotClaims);
    slots.push({
      relayNumber: i,
      name: relayName(registry.names, i),
      claims: slotClaims,
      isFree: !slotHasBlockingClaims(slotClaims),
      slotBadge,
    });
  }
  return slots;
}

export function formatRelayConflictMessage(
  registry: RelayAllocationRegistry,
  relayNumber: number,
  context: RelaySelectContext
): string | null {
  const conflicts = getRelayConflicts(registry, relayNumber, context);
  if (conflicts.length === 0) return null;
  const labels = conflicts.map((c) => `${c.label} (${c.owner})`).join(', ');
  return `Relé ${relayNumber} em uso por: ${labels} — escolha outro.`;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

export function validatePhRelayAssignment(
  relayPhUp: number,
  relayPhDown: number,
  ecNutrients: EcNutrientRelaySlice[] | null | undefined
): ValidationResult {
  if (!isDoserRelay(relayPhUp) || !isDoserRelay(relayPhDown)) {
    return { ok: false, error: 'Relés pH devem estar entre 0 e 7.' };
  }
  if (relayPhUp === relayPhDown) {
    return { ok: false, error: 'Relé pH+ e pH− não podem ser o mesmo.' };
  }

  const ecRelays = new Set<number>();
  if (Array.isArray(ecNutrients)) {
    for (const nut of ecNutrients) {
      if (!isActiveNutrient(nut)) continue;
      const r = nutrientRelay(nut);
      if (r == null) continue;
      ecRelays.add(r);
    }
  }

  if (ecRelays.has(relayPhUp)) {
    return { ok: false, error: `Relé pH+ (${relayPhUp}) já está atribuído a um nutriente Auto EC.` };
  }
  if (ecRelays.has(relayPhDown)) {
    return { ok: false, error: `Relé pH− (${relayPhDown}) já está atribuído a um nutriente Auto EC.` };
  }

  return { ok: true };
}

export function validateEcNutrientsAssignment(
  nutrients: EcNutrientRelaySlice[] | null | undefined,
  phConfig: PhConfigRelaySlice | null | undefined
): ValidationResult {
  if (!Array.isArray(nutrients)) return { ok: true };

  const phUp = Number(phConfig?.relay_ph_up);
  const phDown = Number(phConfig?.relay_ph_down);
  const seen = new Map<number, string>();

  for (let i = 0; i < nutrients.length; i++) {
    const nut = nutrients[i];
    if (!isActiveNutrient(nut)) continue;
    const relay = nutrientRelay(nut);
    if (relay == null) {
      return { ok: false, error: `Nutriente "${nut.name || i + 1}" sem relé válido (0–7).` };
    }

    const prev = seen.get(relay);
    if (prev) {
      return {
        ok: false,
        error: `Relé ${relay} duplicado entre nutrientes "${prev}" e "${nut.name || i + 1}".`,
      };
    }
    seen.set(relay, nut.name || `Nutriente ${i + 1}`);

    if (isDoserRelay(phUp) && relay === phUp) {
      return { ok: false, error: `Relé ${relay} já usado como pH+ (base) no Auto pH.` };
    }
    if (isDoserRelay(phDown) && relay === phDown) {
      return { ok: false, error: `Relé ${relay} já usado como pH− (ácido) no Auto pH.` };
    }
  }

  return { ok: true };
}

export function validateEcDilutionSlaveFields(
  config: Record<string, unknown>
): ValidationResult {
  const hasDrainMac =
    typeof config.dilution_drain_slave_mac === 'string' &&
    config.dilution_drain_slave_mac.trim().length > 0;
  const hasFillMac =
    typeof config.dilution_fill_slave_mac === 'string' &&
    config.dilution_fill_slave_mac.trim().length > 0;
  const drainRelay = Number(config.dilution_drain_relay);
  const fillRelay = Number(config.dilution_fill_relay);

  const configuring =
    hasDrainMac ||
    hasFillMac ||
    Number.isFinite(drainRelay) ||
    Number.isFinite(fillRelay);

  if (!configuring) {
    return { ok: true };
  }

  if (!hasDrainMac || !Number.isFinite(drainRelay) || drainRelay < 0 || drainRelay > 7) {
    return { ok: false, error: 'Relé slave de dreno incompleto (MAC + índice 0–7).' };
  }
  if (!hasFillMac || !Number.isFinite(fillRelay) || fillRelay < 0 || fillRelay > 7) {
    return { ok: false, error: 'Relé slave de reposição incompleto (MAC + índice 0–7).' };
  }

  const drainMac = config.dilution_drain_slave_mac!.toString().trim().toUpperCase();
  const fillMac = config.dilution_fill_slave_mac!.toString().trim().toUpperCase();
  if (drainMac === fillMac && drainRelay === fillRelay) {
    return { ok: false, error: 'Dreno e reposição não podem ser o mesmo relé slave.' };
  }

  return { ok: true };
}

export function serializeRegistryForDebug(
  registry: RelayAllocationRegistry,
  context?: RelaySelectContext
): Record<string, unknown> {
  const slots = getDoserRelaySlots(registry);
  return {
    claims: registry.claims.map((c) => ({
      relay: c.relayNumber,
      owner: c.owner,
      label: c.label,
      sourceId: c.sourceId,
    })),
    slots: slots.map((s) => ({
      relay: s.relayNumber,
      name: s.name,
      isFree: s.isFree,
      slotBadge: s.slotBadge,
      owners: s.claims.map((c) => c.owner),
    })),
    selectable: context ? getSelectableRelays(registry, context).map((r) => r.number) : undefined,
    conflicts: context && isDoserRelay(context.currentValue)
      ? getRelayConflicts(registry, context.currentValue, context).map((c) => ({
          relay: c.relayNumber,
          owner: c.owner,
          label: c.label,
        }))
      : undefined,
  };
}
