'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSidebar } from '@/contexts/SidebarContext';
import {
  HomeIcon,
  Cog6ToothIcon,
  DevicePhoneMobileIcon,
  WrenchScrewdriverIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  Cog6ToothIcon as Cog6ToothIconSolid,
  DevicePhoneMobileIcon as DevicePhoneMobileIconSolid,
  WrenchScrewdriverIcon as WrenchScrewdriverIconSolid,
  QuestionMarkCircleIcon as QuestionMarkCircleIconSolid,
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
    name: 'Ajuda',
    href: '/ajuda',
    icon: QuestionMarkCircleIcon,
    iconSolid: QuestionMarkCircleIconSolid,
  },
];

export default function Sidebar() {
  const { isExpanded, setIsExpanded } = useSidebar();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    // Em mobile, sempre começar retraído
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsExpanded(false);
    }
  }, []);

  const handleMouseEnter = () => {
    // Limpar timeout se existir
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsExpanded(true);
  };

  const handleMouseLeave = () => {
    // Delay para retrair após o mouse sair (apenas em desktop)
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      timeoutRef.current = setTimeout(() => {
        setIsExpanded(false);
        timeoutRef.current = null;
      }, 500);
    }
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
    <aside
      className={`fixed left-0 top-0 h-full bg-gradient-to-b from-dark-surface via-primary-900 to-aqua-900 border-r border-dark-border text-white transition-all duration-300 ease-in-out z-50 shadow-2xl ${
        isExpanded ? 'w-64' : 'w-20'
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ marginLeft: 0 }}
    >
      {/* Logo/Header */}
      <div className="flex items-center justify-between p-4 border-b border-dark-border">
        <div className={`flex items-center space-x-3 transition-opacity ${isExpanded ? 'opacity-100' : 'opacity-0 w-0'}`}>
          <span className="text-2xl">🌱</span>
          <h1 className="text-xl font-bold whitespace-nowrap">HydroWave</h1>
        </div>
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg hover:bg-dark-card transition-colors flex-shrink-0"
          aria-label="Toggle sidebar"
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
            const isActive = pathname === item.href || (item.href === '/dashboard' && pathname === '/');
            const Icon = isActive ? item.iconSolid : item.icon;

            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-aqua-600 to-primary-600 shadow-lg shadow-aqua-500/30 transform scale-105'
                      : 'hover:bg-dark-card hover:translate-x-1'
                  }`}
                >
                  <Icon className="w-6 h-6 flex-shrink-0" />
                  <span
                    className={`font-medium transition-opacity duration-200 ${
                      isExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
                    }`}
                  >
                    {item.name}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className={`absolute bottom-4 left-0 right-0 px-4 transition-opacity ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
        <div className="text-xs text-dark-textSecondary text-center">
          <p>© {new Date().getFullYear()} HydroWave</p>
        </div>
      </div>
    </aside>
  );
}


