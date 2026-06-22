'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { Cog6ToothIcon, PlayIcon, PauseIcon, PlusIcon, PencilIcon, XMarkIcon } from '@heroicons/react/24/outline';
import SequentialScriptEditor from './SequentialScriptEditor';
import { formatInstructionType } from '@/lib/instruction-labels';
import { useAuth } from '@/contexts/AuthContext';
import { InstrumentCard } from '@/components/ui/InstrumentCard';
import { HwBadge } from '@/components/ui/HwBadge';
import { HwButton } from '@/components/ui/HwButton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { HW_LABEL } from '@/lib/design-tokens';

interface DecisionEngineCardProps {
  deviceId: string;
}

interface Script {
  id: string;
  rule_name: string;
  rule_description?: string;
  rule_json?: {
    script?: {
      instructions?: Array<{
        type: string;
        condition?: {
          sensor: string;
          operator: string;
          value: number;
        };
        [key: string]: unknown;
      }>;
    };
  };
  priority: number;
  enabled: boolean;
}

interface ScriptInstruction {
  type: string;
  condition?: {
    sensor: string;
    operator: string;
    value: number;
  };
  [key: string]: unknown;
}

export default function DecisionEngineCard({ deviceId }: DecisionEngineCardProps) {
  const { userProfile } = useAuth();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [isEnabled, setIsEnabled] = useState(false);
  const [editingScript, setEditingScript] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (deviceId && deviceId !== 'default_device' && userProfile?.email) {
      loadScripts();
    }
  }, [deviceId, userProfile?.email]);

  const loadScripts = async () => {
    if (!userProfile?.email) {
      console.warn('⚠️ Não é possível carregar scripts: userProfile.email ausente');
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('decision_rules')
        .select('*')
        .eq('device_id', deviceId)
        .eq('enabled', true)
        .eq('created_by', userProfile.email)
        .order('priority', { ascending: false });

      if (error) throw error;
      setScripts(data || []);
    } catch (error) {
      console.error('Erro ao carregar scripts:', error);
      toast.error('Erro ao carregar funções');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (scriptId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta função?')) {
      return;
    }

    if (!userProfile?.email) {
      toast.error('Erro: email do usuário não encontrado');
      return;
    }

    try {
      const { error } = await supabase
        .from('decision_rules')
        .delete()
        .eq('id', scriptId)
        .eq('created_by', userProfile.email);

      if (error) throw error;
      toast.success('Função excluída com sucesso');
      loadScripts();
    } catch (error) {
      console.error('Erro ao excluir script:', error);
      toast.error('Erro ao excluir função');
    }
  };

  return (
    <>
      <InstrumentCard
        accent="brand"
        title={
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Cog6ToothIcon className="w-5 h-5 text-aqua-400" />
              <span>Motor de Decisão</span>
            </div>
            <HwButton
              variant={isEnabled ? 'danger' : 'primary'}
              size="sm"
              onClick={() => setIsEnabled(!isEnabled)}
            >
              {isEnabled ? (
                <>
                  <PauseIcon className="w-4 h-4" />
                  Pausar
                </>
              ) : (
                <>
                  <PlayIcon className="w-4 h-4" />
                  Iniciar
                </>
              )}
            </HwButton>
          </div>
        }
      >
        <div className="flex justify-between items-center mb-4">
          <SectionHeader title={`Scripts Ativos (${scripts.length})`} accent="brand" className="mb-0" />
          <HwButton
            size="sm"
            onClick={() => {
              setEditingScript(null);
              setShowEditor(true);
            }}
          >
            <PlusIcon className="w-4 h-4" />
            Nova Função
          </HwButton>
        </div>

        {loading ? (
          <div className={`text-center py-8 ${HW_LABEL}`}>Carregando...</div>
        ) : scripts.length === 0 ? (
          <div className={`text-center py-8 ${HW_LABEL}`}>
            Nenhuma função ativa. Clique em &quot;Nova Função&quot; para criar uma.
          </div>
        ) : (
          <div className="space-y-3">
            {scripts.map((script) => (
              <div
                key={script.id}
                className="border border-dark-border rounded-lg p-4 bg-dark-surface/50 hover:bg-dark-surface transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-dark-text">{script.rule_name}</h4>
                    {script.rule_description && (
                      <p className={`text-xs mt-1 ${HW_LABEL}`}>{script.rule_description}</p>
                    )}
                    <p className={`text-xs mt-1 ${HW_LABEL}`}>
                      {script.rule_json?.script ? 'Sequential Script' : 'Composite Rule'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <HwButton
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingScript(script.id);
                        setShowEditor(true);
                      }}
                      aria-label="Editar função"
                      className="!p-2"
                    >
                      <PencilIcon className="w-4 h-4 text-aqua-400" />
                    </HwButton>
                    <HwButton
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(script.id)}
                      aria-label="Excluir função"
                      className="!p-2"
                    >
                      <XMarkIcon className="w-4 h-4 text-red-400" />
                    </HwButton>
                  </div>
                </div>

                {script.rule_json?.script?.instructions && (
                  <div className={`mt-2 text-xs space-y-1 font-mono ${HW_LABEL}`}>
                    {script.rule_json.script.instructions.slice(0, 2).map((instr: ScriptInstruction, idx: number) => (
                      <div key={idx} className="text-aqua-300">
                        {idx + 1}. {formatInstructionType(instr.type)}
                        {instr.condition && (
                          <span className="ml-2 text-dark-textSecondary">
                            {instr.condition.sensor} {instr.condition.operator} {instr.condition.value}
                          </span>
                        )}
                      </div>
                    ))}
                    {script.rule_json.script.instructions.length > 2 && (
                      <div className="text-dark-textSecondary/80 italic">
                        ... e mais {script.rule_json.script.instructions.length - 2} instrução(ões)
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3 flex gap-2 flex-wrap">
                  <HwBadge accent="brand">Prioridade: {script.priority}</HwBadge>
                  <HwBadge accent="ok">Ativo</HwBadge>
                </div>
              </div>
            ))}
          </div>
        )}
      </InstrumentCard>

      {showEditor && (
        <SequentialScriptEditor
          scriptId={editingScript}
          deviceId={deviceId}
          onClose={() => {
            setShowEditor(false);
            setEditingScript(null);
            loadScripts();
          }}
        />
      )}
    </>
  );
}
