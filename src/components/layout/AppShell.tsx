'use client';

import React, { useState, useEffect } from 'react';
import { GlobalSidebar, SidebarTab } from './GlobalSidebar';

interface AppShellProps {
  children: React.ReactNode;
  onOpenSettings?: () => void;
  isDarkMode?: boolean;
  hideSidebar?: boolean;
  highlightTab?: SidebarTab | null;
  hideSidebarLogo?: boolean;
  hasPracticeSession?: boolean;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  onOpenSettings,
  isDarkMode: propDarkMode,
  hideSidebar = false,
  highlightTab,
  hideSidebarLogo = false,
  hasPracticeSession = false,
}) => {
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
    <div
      className={`flex h-screen w-screen overflow-hidden transition-colors duration-150 ${
        isDarkMode ? 'dark bg-[#0A0A0C]' : 'bg-[#F4F4F6]'
      }`}
    >
      {!hideSidebar && (
        <GlobalSidebar
          onOpenSettings={onOpenSettings}
          isDarkMode={isDarkMode}
          highlightTab={highlightTab}
          hideLogo={hideSidebarLogo}
          hasPracticeSession={hasPracticeSession}
        />
      )}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {children}
      </main>
    </div>
  );
};
