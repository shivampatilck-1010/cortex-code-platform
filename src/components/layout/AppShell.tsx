'use client';

import React, { useState, useEffect } from 'react';
import { GlobalSidebar } from './GlobalSidebar';

interface AppShellProps {
  children: React.ReactNode;
  onOpenSettings?: () => void;
  isDarkMode?: boolean;
}

export const AppShell: React.FC<AppShellProps> = ({ children, onOpenSettings, isDarkMode: propDarkMode }) => {
  const [internalDarkMode, setInternalDarkMode] = useState<boolean>(true);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      setInternalDarkMode(document.documentElement.classList.contains('dark'));
      const observer = new MutationObserver(() => {
        setInternalDarkMode(document.documentElement.classList.contains('dark'));
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      return () => observer.disconnect();
    }
  }, []);

  const isDarkMode = propDarkMode !== undefined ? propDarkMode : internalDarkMode;

  return (
    <div className={`flex h-screen w-screen overflow-hidden transition-colors duration-200 ${
      isDarkMode ? 'bg-[#0a0b0d]' : 'bg-[#f8fafc]'
    }`}>
      <GlobalSidebar onOpenSettings={onOpenSettings} isDarkMode={isDarkMode} />
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {children}
      </main>
    </div>
  );
};
