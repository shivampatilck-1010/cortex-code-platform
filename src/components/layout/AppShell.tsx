'use client';

import React from 'react';
import { GlobalSidebar } from './GlobalSidebar';

interface AppShellProps {
  children: React.ReactNode;
  onOpenSettings?: () => void;
}

export const AppShell: React.FC<AppShellProps> = ({ children, onOpenSettings }) => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0a0b0d]">
      <GlobalSidebar onOpenSettings={onOpenSettings} />
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {children}
      </main>
    </div>
  );
};
