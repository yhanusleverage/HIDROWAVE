import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { relay, seconds } = data;

    if (typeof relay !== 'number' || relay < 0 || relay > 7) {
      return NextResponse.json({ error: 'Invalid relay number' }, { status: 400 });
    }

    if (typeof seconds !== 'number' || seconds < 0) {
      return NextResponse.json({ error: 'Invalid seconds value' }, { status: 400 });
    }

    // In a real implementation, this would send a command to the ESP32
    // For now, we'll just simulate success
    console.log(`Toggling relay ${relay} for ${seconds} seconds`);

    // Simulate a delay to represent the communication with the ESP32
    await new Promise(resolve => setTimeout(resolve, 300));

    return NextResponse.json({ success: true, message: `Relay ${relay} toggled for ${seconds} seconds` });
  } catch (error) {
    console.error('Error in relay API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 