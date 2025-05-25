import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { relay, seconds } = body;
    
    if (relay === undefined) {
      return NextResponse.json({ error: 'Se requiere el parámetro relay' }, { status: 400 });
    }
    
    // Validar que relay sea un número entre 0 y 7
    if (typeof relay !== 'number' || relay < 0 || relay > 7) {
      return NextResponse.json({ error: 'El parámetro relay debe ser un número entre 0 y 7' }, { status: 400 });
    }
    
    // Obtener el estado actual del relé
    const { data: relayData, error: fetchError } = await supabase
      .from('relay_states')
      .select('state')
      .eq('id', relay + 1)
      .single();
    
    if (fetchError) {
      console.error('Error al obtener el estado del relé:', fetchError);
      return NextResponse.json({ error: 'Error al obtener el estado del relé' }, { status: 500 });
    }
    
    // Cambiar el estado del relé
    const newState = !relayData.state;
    
    const { error: updateError } = await supabase
      .from('relay_states')
      .update({ state: newState, timer: seconds > 0 ? seconds : null })
      .eq('id', relay + 1);
    
    if (updateError) {
      console.error('Error al actualizar el estado del relé:', updateError);
      return NextResponse.json({ error: 'Error al actualizar el estado del relé' }, { status: 500 });
    }
    
    // Si hay un temporizador, también enviar el comando al ESP32
    if (seconds > 0) {
      try {
        // Aquí puedes implementar la lógica para enviar un comando al ESP32
        // Por ejemplo, mediante una solicitud HTTP a la IP del ESP32
        
        // Esta es una implementación de ejemplo:
        const esp32Ip = process.env.ESP32_IP || '192.168.1.100';
        const response = await fetch(`http://${esp32Ip}/relay`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ relay, seconds }),
        });
        
        if (!response.ok) {
          console.warn('No se pudo enviar el comando al ESP32, pero se actualizó la base de datos');
        }
      } catch (err) {
        console.warn('Error al comunicarse con el ESP32:', err);
        // No retornamos error, ya que la base de datos se actualizó correctamente
      }
    }
    
    return NextResponse.json({
      success: true,
      relay,
      state: newState,
      timer: seconds > 0 ? seconds : null
    });
  } catch (err) {
    console.error('Error en la API de relé:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
} 