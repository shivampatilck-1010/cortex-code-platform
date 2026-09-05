'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { LanguageConfig, SUPPORTED_LANGUAGES } from '@/config/languages';
import { LanguageIcon } from './LanguageIcon';

interface LanguageSelectorProps {
  currentLanguage: LanguageConfig;
  onSelectLanguage: (lang: LanguageConfig) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  currentLanguage,
  onSelectLanguage,
  className = '',
  size = 'md',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Focus search when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const filteredLanguages = SUPPORTED_LANGUAGES.filter(
    (lang) =>
      lang.name.toLowerCase().includes(search.toLowerCase()) ||
      lang.id.toLowerCase().includes(search.toLowerCase()) ||
      lang.aliases.some((a) => a.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`flex items-center space-x-2 rounded-md font-heading font-semibold transition border cursor-pointer select-none ${
          size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-xs'
        } ${
          isOpen
            ? 'bg-[#1c1e24] text-white border-[#ff9100] shadow-sm'
            : 'bg-[#15161b] hover:bg-[#1c1e24] text-[#e6edf3] border-[#2b2d35] hover:border-[#ff9100]/50'
        }`}
        title={`Current Language: ${currentLanguage.name} (${currentLanguage.version}). Click to change.`}
      >
        <LanguageIcon languageId={currentLanguage.id} size={16} />
        <span className="truncate">{currentLanguage.name}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-[#ff9100]' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-64 bg-[#141518] border border-[#262832] rounded-lg shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
          {/* Search Header */}
          <div className="p-2 border-b border-[#20222a] bg-[#101114]">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search language..."
                className="w-full bg-[#18191e] text-gray-200 pl-8 pr-2.5 py-1.5 rounded text-xs font-heading font-semibold border border-[#252830] focus:border-[#ff9100] focus:outline-none placeholder:text-gray-500"
              />
            </div>
          </div>

          {/* Language Options List */}
          <div className="max-h-72 overflow-y-auto p-1 space-y-0.5" role="listbox">
            {filteredLanguages.length > 0 ? (
              filteredLanguages.map((lang) => {
                const isSelected = lang.id === currentLanguage.id;
                return (
                  <button
                    key={lang.id}
                    onClick={() => {
                      onSelectLanguage(lang);
                      setIsOpen(false);
                    }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded text-xs font-heading transition text-left group ${
                      isSelected
                        ? 'bg-[#ff9100]/15 text-[#ff9100] font-bold border-l-2 border-[#ff9100]'
                        : 'text-gray-300 hover:bg-[#1c1e24] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <LanguageIcon languageId={lang.id} size={18} />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate leading-tight">{lang.name}</span>
                        <span className="text-[10px] text-gray-500 font-mono group-hover:text-gray-400">
                          {lang.version}
                        </span>
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#ff9100] flex-shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="py-6 text-center text-gray-500 text-xs font-heading">
                No languages found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
