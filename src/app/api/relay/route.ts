import { NextResponse } from 'next/server';
import { createRelayCommand } from '@/lib/automation';

/**
 * API LEGACY - Mantida para compatibilidade
 * 
 * NOVO: Use /api/esp-now/command para todos os comandos
 * Esta API redireciona para a nova estrutura
 * 
 * Divisão de relés:
 * - HydroControl (local): relay_number 0-15 (PCF8574)
 * - Todos os comandos são salvos em relay_commands para histórico e métricas
 */
export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { relay, seconds, device_id } = data;

    if (typeof relay !== 'number' || relay < 0 || relay > 15) {
      return NextResponse.json({ error: 'Número de relé inválido (0-15)' }, { status: 400 });
    }

    if (typeof seconds !== 'number' || seconds < 0 || seconds > 86400) {
      return NextResponse.json({ error: 'Valor de segundos inválido (0-86400)' }, { status: 400 });
    }

    const deviceId = device_id || 'default_device';

    // Usar nova API unificada (relé local HydroControl)
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/esp-now/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        master_device_id: deviceId,
        slave_mac_address: null, // null = relé local
        relay_number: relay,
        action: 'on',
        duration_seconds: seconds,
        triggered_by: 'manual',
        command_type: 'manual', // ✅ FORK: Comando manual
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json({ error: error.error || 'Erro ao criar comando' }, { status: response.status });
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      message: `Relé ${relay} ativado por ${seconds} segundos`,
      command_id: result.command_id,
      // Retrocompatibilidade
      command: result.command,
    });
  } catch (error) {
    console.error('Error in relay API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 