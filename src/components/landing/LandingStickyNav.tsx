'use client';

import React, { useState, useEffect } from 'react';
import { Terminal, BookOpen, ShieldAlert, Video } from 'lucide-react';
import { useTheme } from './ThemeContext';

interface LandingStickyNavProps {
  activeSection?: string;
  onSelectSection?: (id: string) => void;
}

export const LandingStickyNav: React.FC<LandingStickyNavProps> = ({
  activeSection: externalActiveSection,
  onSelectSection,
}) => {
  const { isDark } = useTheme();
  const [internalActiveSection, setInternalActiveSection] = useState<string>('cortex-ide');

  const currentSection = externalActiveSection || internalActiveSection;

  useEffect(() => {
    // Only run if IntersectionObserver is available
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return;
    }

    const sectionIds = ['interactive-showcase', 'cortex-ide', 'cortex-classroom', 'cortex-browser'];
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            setInternalActiveSection(id);
            if (onSelectSection) {
              onSelectSection(id);
            }
          }
        });
      },
      {
        root: null,
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0.1,
      }
    );

    elements.forEach((el) => observer.observe(el));

    return () => {
      elements.forEach((el) => observer.unobserve(el));
      observer.disconnect();
    };
  }, [onSelectSection]);

  const handleSelect = (id: string) => {
    setInternalActiveSection(id);
    if (onSelectSection) {
      onSelectSection(id);
    }
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const navItems = [
    {
      id: 'cortex-ide',
      label: '01 // CORTEX IDE',
      icon: Terminal,
      activeColor: 'text-[#FF9100]',
      activeBg: isDark ? 'bg-[#FF9100]/10 border-[#FF9100]/30' : 'bg-orange-50 border-orange-300',
      activeIndicator: 'bg-[#FF9100]',
    },
    {
      id: 'cortex-classroom',
      label: '02 // CORTEX CLASSROOM',
      icon: BookOpen,
      activeColor: 'text-cyan-500',
      activeBg: isDark ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-cyan-50 border-cyan-300',
      activeIndicator: 'bg-cyan-500',
    },
    {
      id: 'cortex-browser',
      label: '03 // CORTEX BROWSER',
      icon: ShieldAlert,
      activeColor: 'text-purple-500',
      activeBg: isDark ? 'bg-purple-500/10 border-purple-500/30' : 'bg-purple-50 border-purple-300',
      activeIndicator: 'bg-purple-500',
    },
  ];

  return (
    <div className="sticky top-16 z-30 flex justify-center px-4 py-3 pointer-events-none">
      <nav 
        className={`pointer-events-auto backdrop-blur-xl border shadow-2xl rounded-full p-1.5 flex items-center gap-1 sm:gap-2 max-w-full overflow-x-auto no-scrollbar transition-colors ${
          isDark 
            ? 'bg-[#0B0C0E]/90 border-[#1F2024] shadow-black/60' 
            : 'bg-white/95 border-slate-200 shadow-slate-900/10'
        }`}
        aria-label="Product Showcase Navigation"
      >
        {navItems.map((item) => {
          const isActive = currentSection === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => handleSelect(item.id)}
              className={`relative flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full text-xs font-mono font-medium transition-all duration-300 border ${
                isActive
                  ? `${item.activeBg} ${item.activeColor} shadow-sm`
                  : isDark
                    ? 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                    : 'border-transparent text-zinc-600 hover:text-zinc-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="whitespace-nowrap">{item.label}</span>
              {isActive && (
                <span
                  className={`w-1.5 h-1.5 rounded-full ${item.activeIndicator} animate-pulse`}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
