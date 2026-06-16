'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { Cog6ToothIcon, PlayIcon, PauseIcon, PlusIcon, PencilIcon, XMarkIcon } from '@heroicons/react/24/outline';
import SequentialScriptEditor from './SequentialScriptEditor';
import { formatInstructionType } from '@/lib/instruction-labels';
import { useAuth } from '@/contexts/AuthContext';

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
      
      // ✅ Console log para verificar query
      console.log('🔍 [DECISION RULES] Buscando regras:', {
        device_id: deviceId,
        user_email: userProfile.email,
        filters: {
          device_id: deviceId,
          enabled: true,
          created_by: userProfile.email
        }
      });
      
      const { data, error } = await supabase
        .from('decision_rules')
        .select('*')
        .eq('device_id', deviceId)
        .eq('enabled', true)
        .eq('created_by', userProfile.email)
        .order('priority', { ascending: false });

      if (error) throw error;
      
      // ✅ Console log para verificar resultados
      console.log('✅ [DECISION RULES] Regras encontradas:', {
        total: data?.length || 0,
        regras: data?.map(r => ({
          id: r.id,
          rule_id: r.rule_id,
          rule_name: r.rule_name,
          priority: r.priority,
          enabled: r.enabled
        }))
      });
      
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
      <div className="bg-dark-card border border-dark-border border-t-2 border-t-aqua-500 rounded-lg shadow-lg overflow-hidden">
        <div className="p-4 border-b border-dark-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cog6ToothIcon className="w-5 h-5 text-aqua-400" />
            <h2 className="text-base sm:text-lg font-semibold text-white">
              🎛️ Motor de Decisão
            </h2>
          </div>
          <button
            onClick={() => setIsEnabled(!isEnabled)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              isEnabled
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-aqua-600 hover:bg-aqua-700 text-white'
            }`}
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
          </button>
        </div>

        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-400">
              📋 Scripts Ativos ({scripts.length})
            </p>
            <button
              onClick={() => {
                setEditingScript(null);
                setShowEditor(true);
              }}
              className="px-3 py-2 bg-aqua-600 hover:bg-aqua-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <PlusIcon className="w-4 h-4" />
              Nova Função
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-400">Carregando...</div>
          ) : scripts.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
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
                      <h4 className="font-semibold text-white">{script.rule_name}</h4>
                      {script.rule_description && (
                        <p className="text-xs text-gray-400 mt-1">{script.rule_description}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {script.rule_json?.script ? 'Sequential Script' : 'Composite Rule'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingScript(script.id);
                          setShowEditor(true);
                        }}
                        className="p-2 hover:bg-dark-surface rounded-lg transition-colors"
                        title="Editar"
                      >
                        <PencilIcon className="w-4 h-4 text-aqua-400" />
                      </button>
                      <button
                        onClick={() => handleDelete(script.id)}
                        className="p-2 hover:bg-dark-surface rounded-lg transition-colors"
                        title="Excluir"
                      >
                        <XMarkIcon className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>

                  {/* Preview das instruções */}
                  {script.rule_json?.script?.instructions && (
                    <div className="mt-2 text-xs text-gray-400 space-y-1 font-mono">
                      {script.rule_json.script.instructions.slice(0, 2).map((instr: ScriptInstruction, idx: number) => (
                        <div key={idx} className="text-aqua-300">
                          {idx + 1}. {formatInstructionType(instr.type)}
                          {instr.condition && (
                            <span className="ml-2 text-gray-400">
                              {instr.condition.sensor} {instr.condition.operator} {instr.condition.value}
                            </span>
                          )}
                        </div>
                      ))}
                      {script.rule_json.script.instructions.length > 2 && (
                        <div className="text-gray-500 italic">
                          ... e mais {script.rule_json.script.instructions.length - 2} instrução(ões)
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-3 flex gap-2 flex-wrap">
                    <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded border border-blue-500/30">
                      Prioridade: {script.priority}
                    </span>
                    <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded border border-green-500/30">
                      ✅ Ativo
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Editor Sidebar */}
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
