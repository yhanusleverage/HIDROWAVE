import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import { DashboardData } from '@/types';

export async function GET(request: NextRequest) {
  try {
    // Obtener los datos ambientales más recientes
    const { data: environmentData, error: environmentError } = await supabase
      .from('environment_measurements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (environmentError) {
      console.error('Error al obtener datos ambientales:', environmentError);
      return NextResponse.json({ error: 'Error al obtener datos ambientales' }, { status: 500 });
    }

    // Obtener los datos hidropónicos más recientes
    const { data: hydroData, error: hydroError } = await supabase
      .from('hydro_measurements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (hydroError) {
      console.error('Error al obtener datos hidropónicos:', hydroError);
      return NextResponse.json({ error: 'Error al obtener datos hidropónicos' }, { status: 500 });
    }

    // Obtener los estados de los relés
    const { data: relaysData, error: relaysError } = await supabase
      .from('relay_states')
      .select('*')
      .order('id');
    
    if (relaysError) {
      console.error('Error al obtener estados de relés:', relaysError);
      return NextResponse.json({ error: 'Error al obtener estados de relés' }, { status: 500 });
    }

    // Construir la respuesta
    const dashboardData: DashboardData = {
      environment: environmentData,
      hydro: hydroData,
      relays: relaysData || []
    };

    return NextResponse.json(dashboardData);
  } catch (err) {
    console.error('Error en la API de datos:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
} 