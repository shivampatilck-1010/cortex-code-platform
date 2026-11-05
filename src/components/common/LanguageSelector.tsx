'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { LanguageConfig, SUPPORTED_LANGUAGES } from '@/config/languages';
import { LanguageIcon } from './LanguageIcon';

export interface LanguageGroup {
  id: string;
  name: string;
  languages: LanguageConfig[];
}

interface LanguageSelectorProps {
  currentLanguage: LanguageConfig;
  onSelectLanguage: (lang: LanguageConfig) => void;
  className?: string;
  size?: 'sm' | 'md';
}

// Logical grouping order
const GROUP_DEFINITIONS: Array<{ id: string; name: string; matchIds: string[] }> = [
  {
    id: 'popular',
    name: 'Popular',
    matchIds: ['python', 'javascript', 'typescript', 'cpp', 'java'],
  },
  {
    id: 'systems',
    name: 'Systems',
    matchIds: ['c', 'go', 'rust', 'swift'],
  },
  {
    id: 'web',
    name: 'Web',
    matchIds: ['php', 'dart'],
  },
  {
    id: 'general',
    name: 'General-Purpose & Enterprise',
    matchIds: ['csharp', 'ruby', 'kotlin'],
  },
  {
    id: 'data',
    name: 'Data & Query',
    matchIds: ['sql', 'r'],
  },
];

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  currentLanguage,
  onSelectLanguage,
  className = '',
  size = 'md',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Organize supported languages into non-duplicative logical groups
  const { groups, flatLanguages } = useMemo(() => {
    const assignedIds = new Set<string>();
    const structuredGroups: LanguageGroup[] = [];
    const flatList: LanguageConfig[] = [];

    // Map defined groups
    for (const def of GROUP_DEFINITIONS) {
      const langs = SUPPORTED_LANGUAGES.filter(
        (l) => def.matchIds.includes(l.id) && !assignedIds.has(l.id)
      );
      if (langs.length > 0) {
        structuredGroups.push({
          id: def.id,
          name: def.name,
          languages: langs,
        });
        for (const l of langs) {
          assignedIds.add(l.id);
          flatList.push(l);
        }
      }
    }

    // Capture any remaining languages in registry without duplication
    const remaining = SUPPORTED_LANGUAGES.filter((l) => !assignedIds.has(l.id));
    if (remaining.length > 0) {
      structuredGroups.push({
        id: 'other',
        name: 'Other Supported Languages',
        languages: remaining,
      });
      for (const l of remaining) {
        flatList.push(l);
      }
    }

    return { groups: structuredGroups, flatLanguages: flatList };
  }, []);

  // Sync focused index with current language when opening
  useEffect(() => {
    if (isOpen) {
      const idx = flatLanguages.findIndex((l) => l.id === currentLanguage.id);
      setFocusedIndex(idx >= 0 ? idx : 0);
    }
  }, [isOpen, currentLanguage.id, flatLanguages]);

  // Scroll active item into view within the dropdown container only (never scrolling window or header)
  useEffect(() => {
    if (isOpen && itemRefs.current[focusedIndex] && listContainerRef.current) {
      const container = listContainerRef.current;
      const item = itemRefs.current[focusedIndex];
      if (container && item) {
        const containerRect = container.getBoundingClientRect();
        const itemRect = item.getBoundingClientRect();
        if (itemRect.top < containerRect.top) {
          container.scrollTop -= (containerRect.top - itemRect.top);
        } else if (itemRect.bottom > containerRect.bottom) {
          container.scrollTop += (itemRect.bottom - containerRect.bottom);
        }
      }
    }
  }, [focusedIndex, isOpen]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Keyboard navigation & accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev < flatLanguages.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : flatLanguages.length - 1));
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const selected = flatLanguages[focusedIndex];
        if (selected) {
          onSelectLanguage(selected);
          setIsOpen(false);
          triggerRef.current?.focus();
        }
      } else if (e.key === 'Tab') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, focusedIndex, flatLanguages, onSelectLanguage]);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button: Displays Current Language */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen((prev) => !prev)}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls="cortex-language-selector-listbox"
        aria-label={`Programming language: ${currentLanguage.name}. Click to open menu.`}
        className={`h-8 flex items-center space-x-2 rounded-md font-heading font-semibold transition border cursor-pointer select-none px-2.5 text-xs ${
          isOpen
            ? 'bg-[#1c1e24] text-white border-[#ff9100] shadow-sm ring-1 ring-[#ff9100]/40'
            : 'bg-[#15161b] hover:bg-[#1c1e24] text-[#e6edf3] border-[#2b2d35] hover:border-[#ff9100]/50'
        }`}
        title={`Current Language: ${currentLanguage.name} (${currentLanguage.version}). Click to change.`}
      >
        <LanguageIcon languageId={currentLanguage.id} size={16} />
        <span className="truncate max-w-[120px]">{currentLanguage.name}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-[#ff9100]' : ''
          }`}
        />
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div 
          id="cortex-language-selector-listbox"
          className="absolute left-0 mt-1.5 w-72 bg-[#141518] border border-[#262832] rounded-lg shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
          role="listbox"
          aria-label="Supported programming languages"
        >
          {/* Menu Header with Count */}
          <div className="px-3 py-2 bg-[#101114] border-b border-[#20222a] flex items-center justify-between text-xs">
            <span className="font-heading font-bold text-white text-[11px] tracking-wide">
              Select Language
            </span>
            <span className="text-[10px] font-mono text-[#71717A] bg-[#181920] px-1.5 py-0.5 rounded border border-[#252830]">
              {flatLanguages.length} Runtimes
            </span>
          </div>

          {/* Scrollable Language List Grouped by Category */}
          <div
            ref={listContainerRef}
            className="max-h-80 overflow-y-auto p-1.5 space-y-2 focus:outline-none"
          >
            {groups.map((group) => (
              <div key={group.id} role="group" aria-label={group.name} className="space-y-0.5">
                {/* Category Header */}
                <div className="px-2 pt-1 pb-1 text-[10px] font-mono font-bold tracking-wider text-[#71717A] uppercase select-none flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff9100]/60" />
                  <span>{group.name}</span>
                </div>

                {/* Group Items */}
                {group.languages.map((lang) => {
                  const flatIdx = flatLanguages.findIndex((l) => l.id === lang.id);
                  const isSelected = lang.id === currentLanguage.id;
                  const isFocused = flatIdx === focusedIndex;

                  return (
                    <button
                      key={lang.id}
                      ref={(el) => {
                        itemRefs.current[flatIdx] = el;
                      }}
                      onClick={() => {
                        onSelectLanguage(lang);
                        setIsOpen(false);
                        triggerRef.current?.focus();
                      }}
                      onMouseEnter={() => setFocusedIndex(flatIdx)}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-heading transition text-left cursor-pointer group ${
                        isSelected
                          ? 'bg-[#ff9100]/15 text-[#ff9100] font-bold border-l-2 border-[#ff9100]'
                          : isFocused
                          ? 'bg-[#1c1e24] text-white'
                          : 'text-gray-300 hover:bg-[#1c1e24] hover:text-white'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <LanguageIcon languageId={lang.id} size={18} />
                        <div className="flex flex-col min-w-0">
                          <span className="truncate leading-tight font-medium">
                            {lang.name}
                          </span>
                          <span className="text-[10px] text-gray-500 font-mono group-hover:text-gray-400">
                            {lang.version}
                          </span>
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-[#ff9100] flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Footer Keyboard Cue */}
          <div className="px-3 py-1 bg-[#101114] border-t border-[#20222a] text-[10px] text-[#71717A] font-mono flex items-center justify-between select-none">
            <span>Use Arrow keys / Enter</span>
            <span>Esc to close</span>
          </div>
        </div>
      )}
    </div>
  );
};
