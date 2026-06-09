'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const router = useRouter();
  const { user, userProfile } = useAuth();

  const handleAccessDashboard = () => {
    // ✅ Se está autenticado, ir para dashboard
    if (user && userProfile && userProfile.is_active) {
      router.push('/dashboard');
    } else {
      // ✅ Se não está autenticado, ir para login
      router.push('/login');
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-dark-bg via-primary-900 to-aqua-900">
      <div className="max-w-3xl w-full bg-dark-card border border-dark-border rounded-lg shadow-2xl p-8 text-center">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-aqua-400 to-primary-400 bg-clip-text text-transparent">
            🌱 HydroWave
          </h1>
          <p className="text-lg text-dark-textSecondary">
            Sistema de Controle e Monitoramento para Cultivo Hidropônico de Alto Rendimento
          </p>
        </div>

        <div className="mb-10">
          <p className="text-dark-textSecondary mb-4">
            Nosso sistema de automação oferece controle completo sobre seu cultivo hidropônico, 
            monitorando e ajustando automaticamente parâmetros essenciais como pH, TDS, 
            temperatura da água e nutrientes.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-8">
            <div className="border border-dark-border bg-dark-surface rounded-lg p-4 hover:border-aqua-500 transition-colors">
              <h3 className="text-xl font-semibold mb-2 text-aqua-400">Monitoramento em Tempo Real</h3>
              <p className="text-dark-textSecondary text-sm">Acompanhe todos os parâmetros do seu cultivo instantaneamente através do nosso dashboard intuitivo.</p>
            </div>
            
            <div className="border border-dark-border bg-dark-surface rounded-lg p-4 hover:border-aqua-500 transition-colors">
              <h3 className="text-xl font-semibold mb-2 text-aqua-400">Controle Automatizado</h3>
              <p className="text-dark-textSecondary text-sm">Programe ações automáticas baseadas em leituras de sensores para manter seu cultivo sempre em condições ideais.</p>
            </div>
            
            <div className="border border-dark-border bg-dark-surface rounded-lg p-4 hover:border-aqua-500 transition-colors">
              <h3 className="text-xl font-semibold mb-2 text-aqua-400">Dosagem Precisa</h3>
              <p className="text-dark-textSecondary text-sm">Sistema de dosagem automática de nutrientes e ajuste de pH para maximizar o crescimento e a produtividade.</p>
            </div>
            
            <div className="border border-dark-border bg-dark-surface rounded-lg p-4 hover:border-aqua-500 transition-colors">
              <h3 className="text-xl font-semibold mb-2 text-aqua-400">Histórico e Análise</h3>
              <p className="text-dark-textSecondary text-sm">Visualize gráficos e tendências para otimizar seu cultivo com base em dados históricos.</p>
            </div>
          </div>
        </div>

        <button 
          onClick={handleAccessDashboard}
          className="inline-block bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white font-bold py-3 px-6 rounded-lg text-lg transition-all shadow-lg hover:shadow-aqua-500/50"
        >
          Acessar o Dashboard
        </button>
      </div>
    </main>
  );
}
