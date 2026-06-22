'use client';

import React, { useState, useEffect, useRef } from 'react';
import NavLink from '@/components/NavLink';
import { usePathname } from 'next/navigation';
import { useSidebar } from '@/contexts/SidebarContext';
import BrandLogo from '@/components/BrandLogo';
import { hwNavActiveClasses, hwNavIconClasses } from '@/lib/design-tokens';
import {
  HomeIcon,
  Cog6ToothIcon,
  DevicePhoneMobileIcon,
  WrenchScrewdriverIcon,
  BookOpenIcon,
  QuestionMarkCircleIcon,
  BeakerIcon,
  CreditCardIcon,
  UserGroupIcon,
  AcademicCapIcon,
  QueueListIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  Cog6ToothIcon as Cog6ToothIconSolid,
  DevicePhoneMobileIcon as DevicePhoneMobileIconSolid,
  WrenchScrewdriverIcon as WrenchScrewdriverIconSolid,
  BookOpenIcon as BookOpenIconSolid,
  QuestionMarkCircleIcon as QuestionMarkCircleIconSolid,
  BeakerIcon as BeakerIconSolid,
  CreditCardIcon as CreditCardIconSolid,
  UserGroupIcon as UserGroupIconSolid,
  AcademicCapIcon as AcademicCapIconSolid,
  QueueListIcon as QueueListIconSolid,
} from '@heroicons/react/24/solid';

interface MenuItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  iconSolid: React.ComponentType<{ className?: string }>;
}

const menuItems: MenuItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: HomeIcon,
    iconSolid: HomeIconSolid,
  },
  {
    name: 'Automação',
    href: '/automacao',
    icon: Cog6ToothIcon,
    iconSolid: Cog6ToothIconSolid,
  },
  {
    name: 'Calibragem',
    href: '/calibragem',
    icon: BeakerIcon,
    iconSolid: BeakerIconSolid,
  },
  {
    name: 'Dispositivos',
    href: '/dispositivos',
    icon: DevicePhoneMobileIcon,
    iconSolid: DevicePhoneMobileIconSolid,
  },
  {
    name: 'Configuração',
    href: '/configuracao',
    icon: WrenchScrewdriverIcon,
    iconSolid: WrenchScrewdriverIconSolid,
  },
  {
    name: 'Fundamentos',
    href: '/fundamentos',
    icon: BookOpenIcon,
    iconSolid: BookOpenIconSolid,
  },
  {
    name: 'Suporte',
    href: '/support',
    icon: AcademicCapIcon,
    iconSolid: AcademicCapIconSolid,
  },
  {
    name: 'Processos',
    href: '/processos',
    icon: QueueListIcon,
    iconSolid: QueueListIconSolid,
  },
  {
    name: 'Informação',
    href: '/informacao',
    icon: QuestionMarkCircleIcon,
    iconSolid: QuestionMarkCircleIconSolid,
  },
  {
    name: 'Planos',
    href: '/planos',
    icon: CreditCardIcon,
    iconSolid: CreditCardIconSolid,
  },
  {
    name: 'Quem Somos',
    href: '/quem-somos',
    icon: UserGroupIcon,
    iconSolid: UserGroupIconSolid,
  },
];

export default function Sidebar() {
  const { isExpanded, setIsExpanded } = useSidebar();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setIsExpanded(false);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [setIsExpanded]);

  const handleMouseEnter = () => {
    if (isMobile) return;
    // Limpar timeout se existir
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsExpanded(true);
  };

  const handleMouseLeave = () => {
    if (isMobile) return;
    // Delay para retrair após o mouse sair (apenas em desktop)
      timeoutRef.current = setTimeout(() => {
        setIsExpanded(false);
        timeoutRef.current = null;
      }, 500);
  };

  // Limpar timeout ao desmontar
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <>
      {isMobile && isExpanded && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-label="Fechar menu"
          onClick={() => setIsExpanded(false)}
        />
      )}
    <aside
      className={`fixed left-0 top-0 h-full bg-gradient-to-b from-dark-surface via-primary-900 to-aqua-900 border-r border-dark-border text-white transition-all duration-300 ease-in-out z-50 shadow-2xl ${
        isExpanded ? 'w-64' : 'w-20'
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Logo/Header */}
      <div
        className={`flex p-4 border-b border-dark-border ${
          isExpanded ? 'items-center justify-between' : 'flex-col items-center gap-2'
        }`}
      >
        <BrandLogo
          variant="dark"
          size={32}
          showWordmark={isExpanded}
          wordmarkSize="md"
          className={isExpanded ? 'min-w-0' : 'justify-center'}
        />
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg hover:bg-dark-card transition-colors flex-shrink-0"
          aria-label={isExpanded ? 'Recolher menu' : 'Expandir menu'}
          aria-expanded={isExpanded}
        >
          <svg
            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-0' : 'rotate-180'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Menu Items */}
      <nav className="mt-6 px-2">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href === '/dashboard' && pathname === '/') ||
              (item.href === '/support' && pathname.startsWith('/support')) ||
              (item.href === '/processos' && pathname.startsWith('/processos'));
            const Icon = isActive ? item.iconSolid : item.icon;

            return (
              <li key={item.name}>
                <NavLink
                  href={item.href}
                  prefetch
                  className={`flex items-center space-x-3 px-3 py-3 rounded-lg transition-all duration-200 ${hwNavActiveClasses(isActive)}`}
                >
                  <Icon className={`w-6 h-6 flex-shrink-0 ${hwNavIconClasses(item.href, isActive)}`} />
                  <span
                    className={`font-medium transition-opacity duration-200 ${
                      isExpanded ? 'opacity-100' : 'sr-only'
                    }`}
                  >
                    {item.name}
                  </span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className={`absolute bottom-4 left-0 right-0 px-4 transition-opacity ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
        <div className="text-xs text-dark-textSecondary text-center space-y-1">
          <NavLink href="/quem-somos" className="block hover:text-aqua-400 transition-colors">
            Quem somos
          </NavLink>
          <p>© {new Date().getFullYear()} HydroWave</p>
        </div>
      </div>
    </aside>
    </>
  );
}


