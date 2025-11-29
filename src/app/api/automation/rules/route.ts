import { NextResponse } from 'next/server';
import { createDecisionRule, DecisionRule } from '@/lib/automation';

/**
 * API para criar regras de automação (decision_rules)
 * 
 * Usado para:
 * - Schedules de automação hidropônica (ON a cada X minutos por Y minutos)
 * - Regras baseadas em sensores
 * - Regras temporais
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      device_id,
      rule_id,
      rule_name,
      rule_description,
      rule_json,
      enabled = true,
      priority = 50,
      created_by = 'web_interface',
    } = body;

    // Validações
    if (!device_id) {
      return NextResponse.json(
        { error: 'device_id é obrigatório' },
        { status: 400 }
      );
    }

    if (!rule_id || rule_id.length < 3) {
      return NextResponse.json(
        { error: 'rule_id é obrigatório e deve ter pelo menos 3 caracteres' },
        { status: 400 }
      );
    }

    if (!rule_name) {
      return NextResponse.json(
        { error: 'rule_name é obrigatório' },
        { status: 400 }
      );
    }

    if (!rule_json || !rule_json.conditions || !rule_json.actions) {
      return NextResponse.json(
        { error: 'rule_json com conditions e actions é obrigatório' },
        { status: 400 }
      );
    }

    if (priority < 0 || priority > 100) {
      return NextResponse.json(
        { error: 'priority deve estar entre 0 e 100' },
        { status: 400 }
      );
    }

    // Criar regra no Supabase
    const rule: DecisionRule = {
      device_id,
      rule_id,
      rule_name,
      rule_description,
      rule_json,
      enabled,
      priority,
      created_by,
    };

    const createdRule = await createDecisionRule(rule);

    if (!createdRule) {
      return NextResponse.json(
        { error: 'Erro ao criar regra de automação' },
        { status: 500 }
      );
    }

    console.log(`Regra de automação criada: ${rule_name} (${rule_id}) para dispositivo ${device_id}`);

    return NextResponse.json({
      success: true,
      message: 'Regra de automação criada com sucesso',
      rule: createdRule,
    });
  } catch (error) {
    console.error('Error in automation rules API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

