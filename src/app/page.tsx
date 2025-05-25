import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-blue-500 to-green-500">
      <div className="max-w-3xl w-full bg-white rounded-lg shadow-2xl p-8 text-center">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4 text-blue-600">
            🌱 HydroWave
          </h1>
          <p className="text-lg text-gray-600">
            Sistema de Control y Monitoreo para Cultivo Hidropónico de Alto Rendimiento
          </p>
        </div>

        <div className="mb-10">
          <p className="text-gray-700 mb-4">
            Nuestro sistema de automatización ofrece control completo sobre su cultivo hidropónico, 
            monitoreando y ajustando automáticamente parámetros esenciales como pH, TDS, 
            temperatura del agua y nutrientes.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-8">
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-xl font-semibold mb-2 text-blue-600">Monitoreo en Tiempo Real</h3>
              <p className="text-gray-600">Sigue todos los parámetros de tu cultivo instantáneamente a través de nuestro dashboard intuitivo.</p>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-xl font-semibold mb-2 text-blue-600">Control Automatizado</h3>
              <p className="text-gray-600">Programa acciones automáticas basadas en lecturas de sensores para mantener tu cultivo siempre en condiciones ideales.</p>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-xl font-semibold mb-2 text-blue-600">Dosificación Precisa</h3>
              <p className="text-gray-600">Sistema de dosificación automática de nutrientes y ajuste de pH para maximizar el crecimiento y la productividad.</p>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-xl font-semibold mb-2 text-blue-600">Historial y Análisis</h3>
              <p className="text-gray-600">Visualiza gráficos y tendencias para optimizar tu cultivo con base en datos históricos.</p>
            </div>
          </div>
        </div>

        <Link 
          href="/dashboard" 
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors"
        >
          Acceder al Dashboard
        </Link>
      </div>
    </main>
  );
}
