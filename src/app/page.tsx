'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import BrandLogo from '@/components/BrandLogo';

export default function Home() {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const { t } = useLanguage();
  const h = t.home;

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
    <div className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-dark-bg via-primary-900 to-aqua-900">
      <div className="max-w-3xl w-full bg-dark-card border border-dark-border rounded-lg shadow-2xl p-8 text-center">
        <div className="mb-8">
          <BrandLogo
            variant="gradient"
            size={48}
            showWordmark
            wordmarkSize="xl"
            className="justify-center mb-4"
          />
          <p className="text-lg text-dark-textSecondary">{h.tagline}</p>
        </div>

        <div className="mb-10">
          <p className="text-dark-textSecondary mb-4">{h.body}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-8">
            <div className="border border-dark-border bg-dark-surface rounded-lg p-4 hover:border-aqua-500 transition-colors">
              <h3 className="text-xl font-semibold mb-2 text-aqua-400">{h.featureMonitorTitle}</h3>
              <p className="text-dark-textSecondary text-sm">{h.featureMonitorBody}</p>
            </div>

            <div className="border border-dark-border bg-dark-surface rounded-lg p-4 hover:border-aqua-500 transition-colors">
              <h3 className="text-xl font-semibold mb-2 text-aqua-400">{h.featureAutoTitle}</h3>
              <p className="text-dark-textSecondary text-sm">{h.featureAutoBody}</p>
            </div>

            <div className="border border-dark-border bg-dark-surface rounded-lg p-4 hover:border-aqua-500 transition-colors">
              <h3 className="text-xl font-semibold mb-2 text-aqua-400">{h.featureDoseTitle}</h3>
              <p className="text-dark-textSecondary text-sm">{h.featureDoseBody}</p>
            </div>

            <div className="border border-dark-border bg-dark-surface rounded-lg p-4 hover:border-aqua-500 transition-colors">
              <h3 className="text-xl font-semibold mb-2 text-aqua-400">{h.featureHistoryTitle}</h3>
              <p className="text-dark-textSecondary text-sm">{h.featureHistoryBody}</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleAccessDashboard}
          className="inline-block bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white font-bold py-3 px-6 rounded-lg text-lg transition-all shadow-lg hover:shadow-aqua-500/50"
        >
          {h.ctaDashboard}
        </button>

        <p className="mt-6 text-sm text-dark-textSecondary">
          <Link href="/quem-somos" className="text-aqua-400 hover:text-aqua-300 transition-colors">
            {h.linkQuemSomos}
          </Link>
        </p>
      </div>
    </div>
  );
}
