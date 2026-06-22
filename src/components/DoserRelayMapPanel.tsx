'use client';

import { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import {
  type RelayAllocationRegistry,
  getDoserRelaySlots,
  type RelayOwnerKind,
  type DoserRelaySlotBadge,
} from '@/lib/relay-allocation';
import { HW_BG_SUBTLE, HW_RELAY_OWNER_ACCENT, HW_TEXT, type HwAccent } from '@/lib/design-tokens';

const OWNER_LABELS: Record<RelayOwnerKind, string> = {
  ec_nutrient: 'Auto EC',
  ec_dilution_drain: 'Drenagem EC',
  ec_dilution_fill: 'Enchimento EC',
  ph_up: 'pH+',
  ph_down: 'pH−',
  runtime_active: 'Em uso',
  calibragem: 'Calibragem',
  decision_rule: 'Regra',
  manual: 'Manual',
};

const SLOT_BADGE_LABEL: Record<DoserRelaySlotBadge, string> = {
  livre: 'Livre',
  atribuido: 'Atribuído',
  em_uso: 'Em uso',
};

const SLOT_BADGE_ACCENT: Record<DoserRelaySlotBadge, HwAccent> = {
  livre: 'ok',
  atribuido: 'ph',
  em_uso: 'warn',
};

function slotAccent(slot: {
  slotBadge: DoserRelaySlotBadge;
  claims: { owner: RelayOwnerKind }[];
}): HwAccent {
  if (slot.slotBadge === 'livre') return 'ok';
  if (slot.slotBadge === 'atribuido') {
    const owner = slot.claims.find((c) =>
      c.owner === 'ph_up' || c.owner === 'ph_down' || c.owner === 'ec_nutrient'
    )?.owner;
    return owner ? (HW_RELAY_OWNER_ACCENT[owner] ?? 'ph') : 'ph';
  }
  const blocking = slot.claims.find((c) =>
    c.owner === 'manual' || c.owner === 'runtime_active'
  )?.owner;
  if (blocking === 'runtime_active') return 'wait';
  return SLOT_BADGE_ACCENT.em_uso;
}

interface DoserRelayMapPanelProps {
  registry: RelayAllocationRegistry;
  defaultExpanded?: boolean;
}

export function DoserRelayMapPanel({
  registry,
  defaultExpanded = false,
}: DoserRelayMapPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const slots = getDoserRelaySlots(registry);

  return (
    <div className="bg-dark-surface border border-dark-border border-t-2 border-t-aqua-500 rounded-lg overflow-hidden mb-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-dark-card/50 transition-colors"
      >
        <span className="text-sm font-semibold text-dark-text">
          Mapa de relés dosificadores (0–7)
        </span>
        {expanded ? (
          <ChevronUpIcon className="w-4 h-4 text-dark-textSecondary shrink-0" />
        ) : (
          <ChevronDownIcon className="w-4 h-4 text-dark-textSecondary shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-dark-border">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
            {slots.map((slot) => {
              const accent = slotAccent(slot);
              const badgeAccent = SLOT_BADGE_ACCENT[slot.slotBadge];
              return (
              <div
                key={slot.relayNumber}
                className={`rounded-md border px-3 py-2 text-xs ${HW_BG_SUBTLE[accent]}`}
              >
                <div className="flex justify-between gap-2">
                  <span className="font-medium text-dark-text">
                    {slot.relayNumber}: {slot.name}
                  </span>
                  <span className={`shrink-0 ${HW_TEXT[badgeAccent]}`}>
                    {SLOT_BADGE_LABEL[slot.slotBadge]}
                  </span>
                </div>
                {slot.claims.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-dark-textSecondary">
                    {slot.claims.map((c, i) => (
                      <li key={`${c.owner}-${c.sourceId}-${i}`}>
                        <span className={HW_TEXT[HW_RELAY_OWNER_ACCENT[c.owner] ?? 'warn']}>
                          {OWNER_LABELS[c.owner]}
                        </span>
                        {' — '}{c.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );})}
          </div>
        </div>
      )}
    </div>
  );
}
