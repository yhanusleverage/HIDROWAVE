'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowPathIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { HwSelect } from '@/components/ui/HwInput';
import { ProcedureStepEditor } from '@/components/rule-procedure/ProcedureStepEditor';
import { ProcedureTriggersEditor } from '@/components/rule-procedure/ProcedureTriggersEditor';
import { ProcedureJsonPreview } from '@/components/rule-procedure/ProcedureJsonPreview';
import { cloneInitialFillDemo } from '@/lib/rule-procedure/templates/initial-fill-demo';
import type { RuleProcedure } from '@/lib/rule-procedure/types';
import { validateProcedure } from '@/lib/rule-procedure/validate-procedure';
import { compileProcedureToPayload } from '@/lib/rule-procedure/compile-procedure';
import type { HydraulicRolesMap } from '@/lib/hydraulic-relay-roles';
import { useAuth } from '@/contexts/AuthContext';

interface DeviceOption {
  device_id: string;
  device_name?: string | null;
}

interface ProcedureBuilderPanelProps {
  deviceId: string;
  devices?: DeviceOption[];
  hydraulicRoles: HydraulicRolesMap;
  embedded?: boolean;
  onDeviceIdChange?: (deviceId: string) => void;
}

export function ProcedureBuilderPanel({
  deviceId,
  devices = [],
  hydraulicRoles,
  embedded = false,
  onDeviceIdChange,
}: ProcedureBuilderPanelProps) {
  const { userProfile } = useAuth();
  const [procedure, setProcedure] = useState<RuleProcedure>(() => cloneInitialFillDemo());
  const [saving, setSaving] = useState(false);

  const validation = useMemo(
    () => validateProcedure(procedure, { hydraulicRoles }),
    [procedure, hydraulicRoles]
  );

  const payload = useMemo(() => {
    try {
      return compileProcedureToPayload(procedure, hydraulicRoles);
    } catch {
      return null;
    }
  }, [procedure, hydraulicRoles]);

  const updateStep = (index: number, step: RuleProcedure['steps'][number]) => {
    setProcedure((p) => ({
      ...p,
      steps: p.steps.map((s, i) => (i === index ? step : s)),
    }));
  };

  const handleSave = async () => {
    if (!deviceId || deviceId === 'default_device') {
      toast.error('Selecione um HydroWave Core');
      return;
    }
    if (!validation.valid) {
      toast.error(validation.errors[0] ?? 'Procedimento inválido');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/automation/procedure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId,
          procedure,
          created_by: userProfile?.email,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao guardar');
        return;
      }
      toast.success(data.created ? 'Regra criada' : 'Regra atualizada');
    } catch {
      toast.error('Erro de rede ao guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Rule Builder — procedimento"
        subtitle={`${procedure.name} · camada ${procedure.layer}`}
        accent="brand"
      />

      <div className="bg-dark-card border border-dark-border rounded-xl p-4 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block text-xs">
            <span className="text-dark-textSecondary">ID regra</span>
            <input
              type="text"
              value={procedure.id}
              onChange={(e) => setProcedure((p) => ({ ...p, id: e.target.value }))}
              className="mt-1 w-full p-2 bg-dark-surface border border-dark-border rounded-lg font-mono"
            />
          </label>
          <label className="block text-xs">
            <span className="text-dark-textSecondary">Nome</span>
            <input
              type="text"
              value={procedure.name}
              onChange={(e) => setProcedure((p) => ({ ...p, name: e.target.value }))}
              className="mt-1 w-full p-2 bg-dark-surface border border-dark-border rounded-lg"
            />
          </label>
        </div>

        {!embedded && devices.length > 0 && (
          <HwSelect
            label="HydroWave Core (obrigatório para guardar)"
            value={deviceId}
            onChange={(e) => onDeviceIdChange?.(e.target.value)}
          >
            <option value="">— Selecionar —</option>
            {devices.map((d) => (
              <option key={d.device_id} value={d.device_id}>
                {d.device_id}
              </option>
            ))}
          </HwSelect>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setProcedure(cloneInitialFillDemo())}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-dark-surface border border-dark-border text-sm hover:bg-dark-surface/80"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Recarregar Initial Fill
          </button>
          <button
            type="button"
            disabled={saving || !validation.valid}
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-aqua-600 hover:bg-aqua-500 disabled:opacity-50 text-white text-sm font-medium"
          >
            <CloudArrowUpIcon className="w-4 h-4" />
            {saving ? 'Guardando…' : 'Guardar em decision_rules'}
          </button>
        </div>
      </div>

      {!validation.valid && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          <ul className="list-disc list-inside text-xs space-y-0.5">
            {validation.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-dark-card border border-dark-border rounded-xl p-4 space-y-3">
        <SectionHeader title="Triggers" subtitle="Janela circadiana" accent="wait" />
        <ProcedureTriggersEditor
          triggers={procedure.triggers}
          onChange={(triggers) => setProcedure((p) => ({ ...p, triggers }))}
        />
      </div>

      <div className="space-y-3">
        <SectionHeader title="Steps" subtitle="Ordem procedural editável (por função hidráulica)" accent="brand" />
        <div className="grid md:grid-cols-2 gap-3">
          {procedure.steps.map((step, index) => (
            <ProcedureStepEditor
              key={step.id}
              step={step}
              index={index}
              useHydraulicRoles
              onChange={(s) => updateStep(index, s)}
            />
          ))}
        </div>
      </div>

      {payload && <ProcedureJsonPreview value={payload} />}
    </div>
  );
}
