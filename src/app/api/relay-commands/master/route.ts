import { NextResponse } from 'next/server';
import { createRelayCommandProd } from '@/lib/automation';

/**
 * Cria comando(s) em relay_commands (prod) — relés locais do master.
 * Aceita um relé (relay_number) ou arrays (relay_numbers) para compatibilidade.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const master_device_id = body.master_device_id as string | undefined;

    if (!master_device_id) {
      return NextResponse.json({ error: 'master_device_id é obrigatório' }, { status: 400 });
    }

    const relay_numbers: number[] = Array.isArray(body.relay_numbers)
      ? body.relay_numbers
      : typeof body.relay_number === 'number'
        ? [body.relay_number]
        : [];

    const actions: ('on' | 'off')[] = Array.isArray(body.actions)
      ? body.actions
      : body.action === 'on' || body.action === 'off'
        ? [body.action]
        : [];

    const durations: (number | null | undefined)[] = Array.isArray(body.duration_seconds)
      ? body.duration_seconds
      : [body.duration_seconds];

    if (relay_numbers.length === 0 || actions.length !== relay_numbers.length) {
      return NextResponse.json(
        { error: 'relay_number(s) e action(s) inválidos' },
        { status: 400 }
      );
    }

    let lastCommand = null;
    for (let i = 0; i < relay_numbers.length; i++) {
      const rn = relay_numbers[i];
      if (rn < 0 || rn > 15) {
        return NextResponse.json({ error: `relay_number inválido: ${rn}` }, { status: 400 });
      }
      if (actions[i] !== 'on' && actions[i] !== 'off') {
        return NextResponse.json({ error: `action inválida: ${actions[i]}` }, { status: 400 });
      }

      lastCommand = await createRelayCommandProd({
        device_id: master_device_id,
        relay_number: rn,
        action: actions[i],
        duration_seconds: durations[i] ?? null,
        created_by: 'web_interface',
      });

      if (!lastCommand) {
        return NextResponse.json({ error: 'Erro ao inserir em relay_commands' }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Comando criado com sucesso',
      command: lastCommand,
    });
  } catch (error) {
    console.error('Erro relay-commands/master:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao criar comando' },
      { status: 500 }
    );
  }
}
