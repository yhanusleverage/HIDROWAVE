import { NextResponse } from 'next/server';
import { saveSlaveRelayName } from '@/lib/esp-now-slaves';

/**
 * API para salvar nome personalizado de relé de slave ESP-NOW
 * 
 * Identificação do slave:
 * - slave_mac_address: MAC address (identificador principal)
 * - slave_name: Nome do dispositivo (identificador alternativo)
 * 
 * Salva em decision_rules como metadados
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      master_device_id,
      slave_mac_address,
      slave_name,
      relay_id,
      relay_name,
      device_id, // NOVO: Device ID do slave (ESP32_SLAVE_XX_XX_XX_XX_XX_XX)
    } = body;

    // Validações
    if (!master_device_id) {
      return NextResponse.json(
        { error: 'master_device_id é obrigatório' },
        { status: 400 }
      );
    }

    if (!slave_mac_address) {
      return NextResponse.json(
        { error: 'slave_mac_address é obrigatório' },
        { status: 400 }
      );
    }

    if (typeof relay_id !== 'number' || relay_id < 0 || relay_id > 7) {
      return NextResponse.json(
        { error: 'relay_id inválido (0-7)' },
        { status: 400 }
      );
    }

    if (!relay_name || relay_name.trim().length === 0) {
      return NextResponse.json(
        { error: 'relay_name é obrigatório' },
        { status: 400 }
      );
    }

    // Salvar nome do relé na tabela relay_names
    const success = await saveSlaveRelayName(
      master_device_id,
      slave_mac_address,
      slave_name || '',
      relay_id,
      relay_name.trim(),
      device_id // Passar device_id do slave
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Erro ao salvar nome do relé' },
        { status: 500 }
      );
    }

    console.log(`Nome do relé ${relay_id} do slave ${slave_mac_address} salvo: "${relay_name}"`);

    return NextResponse.json({
      success: true,
      message: 'Nome do relé salvo com sucesso',
      data: {
        master_device_id,
        slave_mac_address,
        slave_name,
        relay_id,
        relay_name,
      },
    });
  } catch (error) {
    console.error('Error in slave relay name API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

