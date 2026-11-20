'use client';

import React from 'react';

export interface TabItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (id: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function Tabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  className = '',
  size = 'md',
}: TabsProps<T>) {
  const sizeStyles = size === 'sm' ? 'h-8 text-xs px-2.5 gap-1.5' : 'h-9 text-xs px-3 gap-2';

  return (
    <div className={`flex items-center gap-1 bg-[#101116] p-1 rounded-lg border border-[#1f2029] ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex items-center font-medium rounded-md transition-all select-none ${sizeStyles} ${
              isActive
                ? 'bg-[#1e202a] text-[#ff9100] shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#161720]'
            }`}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge && <span className="shrink-0">{tab.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}
