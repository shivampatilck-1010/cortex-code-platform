'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Terminal, 
  BookOpen, 
  ShieldAlert, 
  Menu, 
  X, 
  ChevronRight, 
  ExternalLink,
  Sun,
  Moon,
  Video
} from 'lucide-react';
import { CortexLogo } from '@/components/brand/CortexLogo';
import { useTheme } from './ThemeContext';

export const LandingHeaderNav: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled 
          ? isDark
            ? 'bg-[#0B0C0E]/95 backdrop-blur-md border-b border-[#1F2024] shadow-2xl shadow-black/60' 
            : 'bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xl shadow-slate-900/5'
          : isDark
            ? 'bg-[#08090A]/80 backdrop-blur-sm border-b border-white/5'
            : 'bg-[#FAF9F6]/80 backdrop-blur-sm border-b border-slate-200/60'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Lockup */}
        <Link 
          href="/" 
          className="flex items-center gap-3 group focus:outline-none focus:ring-1 focus:ring-[#FF9100]/50 rounded-md p-1"
          aria-label="Cortex Platform Home"
        >
          <CortexLogo variant="compact" size="md" />
        </Link>

        {/* Desktop Navigation Anchors */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          <button
            onClick={() => scrollToSection('interactive-showcase')}
            className={`px-3 py-1.5 text-xs font-mono tracking-wider rounded-md transition-colors flex items-center gap-1.5 ${
              isDark 
                ? 'text-zinc-400 hover:text-white hover:bg-white/5' 
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-slate-100'
            }`}
          >
            <Video className="w-3.5 h-3.5 text-amber-500" />
            <span>00 // SHOWCASE</span>
          </button>

          <button
            onClick={() => scrollToSection('cortex-ide')}
            className={`px-3 py-1.5 text-xs font-mono tracking-wider rounded-md transition-colors flex items-center gap-1.5 ${
              isDark 
                ? 'text-zinc-400 hover:text-white hover:bg-white/5' 
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-slate-100'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-[#FF9100]" />
            <span>01 // IDE</span>
          </button>

          <button
            onClick={() => scrollToSection('cortex-classroom')}
            className={`px-3 py-1.5 text-xs font-mono tracking-wider rounded-md transition-colors flex items-center gap-1.5 ${
              isDark 
                ? 'text-zinc-400 hover:text-white hover:bg-white/5' 
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span>02 // CLASSROOM</span>
          </button>

          <button
            onClick={() => scrollToSection('cortex-browser')}
            className={`px-3 py-1.5 text-xs font-mono tracking-wider rounded-md transition-colors flex items-center gap-1.5 ${
              isDark 
                ? 'text-zinc-400 hover:text-white hover:bg-white/5' 
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-slate-100'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
            <span>03 // BROWSER</span>
          </button>

          <div className={`h-4 w-px mx-2 ${isDark ? 'bg-zinc-800' : 'bg-slate-300'}`} />

          <Link
            href="/classroom"
            className={`px-3 py-1.5 text-xs font-mono tracking-wider rounded-md transition-colors ${
              isDark 
                ? 'text-zinc-400 hover:text-white hover:bg-white/5' 
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-slate-100'
            }`}
          >
            PORTAL
          </Link>

          <Link
            href="/lockdown"
            className={`px-3 py-1.5 text-xs font-mono tracking-wider rounded-md transition-colors flex items-center gap-1 ${
              isDark 
                ? 'text-zinc-400 hover:text-white hover:bg-white/5' 
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-slate-100'
            }`}
          >
            <span>SECURITY</span>
            <span className="text-[9px] px-1.5 py-0.2 bg-purple-500/20 text-purple-400 rounded border border-purple-500/30">PREVIEW</span>
          </Link>
        </nav>

        {/* Action Controls & Theme Toggle */}
        <div className="hidden md:flex items-center gap-3">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg border transition-colors ${
              isDark 
                ? 'bg-[#15161C] border-[#1F2026] text-amber-400 hover:text-amber-300 hover:bg-zinc-800' 
                : 'bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-200'
            }`}
            aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <Link
            href="/ide"
            className="relative group px-4 py-2 rounded-lg text-xs font-mono font-semibold tracking-wider bg-[#FF9100] text-black hover:bg-[#FFA726] transition-all duration-200 shadow-[0_0_20px_rgba(255,145,0,0.3)] hover:shadow-[0_0_25px_rgba(255,145,0,0.5)] flex items-center gap-2"
          >
            <span>LAUNCH IDE</span>
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Mobile Menu & Theme Toggle */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg border transition-colors ${
              isDark 
                ? 'bg-[#15161C] border-[#1F2026] text-amber-400' 
                : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}
            aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <Link
            href="/ide"
            className="px-3 py-1.5 rounded text-xs font-mono font-semibold bg-[#FF9100] text-black"
          >
            IDE
          </Link>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`p-2 focus:outline-none rounded-md ${
              isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-zinc-900'
            }`}
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className={`md:hidden px-4 pt-3 pb-6 space-y-3 border-b transition-colors ${
          isDark 
            ? 'bg-[#0B0C0E]/98 border-[#1F2024]' 
            : 'bg-white/98 border-slate-200'
        }`}>
          <div className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase px-2">
            Navigation Sections
          </div>
          <button
            onClick={() => scrollToSection('interactive-showcase')}
            className={`w-full text-left px-3 py-2 text-sm font-mono rounded-md flex items-center gap-2 ${
              isDark ? 'text-zinc-300 hover:text-white hover:bg-white/5' : 'text-zinc-700 hover:text-zinc-900 hover:bg-slate-100'
            }`}
          >
            <Video className="w-4 h-4 text-amber-500" />
            <span>00 // VIDEO SHOWCASE</span>
          </button>
          <button
            onClick={() => scrollToSection('cortex-ide')}
            className={`w-full text-left px-3 py-2 text-sm font-mono rounded-md flex items-center gap-2 ${
              isDark ? 'text-zinc-300 hover:text-white hover:bg-white/5' : 'text-zinc-700 hover:text-zinc-900 hover:bg-slate-100'
            }`}
          >
            <Terminal className="w-4 h-4 text-[#FF9100]" />
            <span>01 // CORTEX IDE</span>
          </button>
          <button
            onClick={() => scrollToSection('cortex-classroom')}
            className={`w-full text-left px-3 py-2 text-sm font-mono rounded-md flex items-center gap-2 ${
              isDark ? 'text-zinc-300 hover:text-white hover:bg-white/5' : 'text-zinc-700 hover:text-zinc-900 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <span>02 // CORTEX CLASSROOM</span>
          </button>
          <button
            onClick={() => scrollToSection('cortex-browser')}
            className={`w-full text-left px-3 py-2 text-sm font-mono rounded-md flex items-center gap-2 ${
              isDark ? 'text-zinc-300 hover:text-white hover:bg-white/5' : 'text-zinc-700 hover:text-zinc-900 hover:bg-slate-100'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-purple-400" />
            <span>03 // CORTEX BROWSER</span>
          </button>

          <div className={`border-t my-2 pt-2 space-y-1 ${isDark ? 'border-zinc-800' : 'border-slate-200'}`}>
            <div className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase px-2 mb-1">
              Direct Routes
            </div>
            <Link
              href="/ide"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between px-3 py-2 text-sm font-mono rounded-md ${
                isDark ? 'text-zinc-300 hover:text-white hover:bg-white/5' : 'text-zinc-700 hover:text-zinc-900 hover:bg-slate-100'
              }`}
            >
              <span>Launch Cloud IDE</span>
              <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
            </Link>
            <Link
              href="/classroom"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between px-3 py-2 text-sm font-mono rounded-md ${
                isDark ? 'text-zinc-300 hover:text-white hover:bg-white/5' : 'text-zinc-700 hover:text-zinc-900 hover:bg-slate-100'
              }`}
            >
              <span>Classroom Platform</span>
              <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
            </Link>
            <Link
              href="/lockdown"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between px-3 py-2 text-sm font-mono rounded-md ${
                isDark ? 'text-zinc-300 hover:text-white hover:bg-white/5' : 'text-zinc-700 hover:text-zinc-900 hover:bg-slate-100'
              }`}
            >
              <span>Lockdown Security Simulation</span>
              <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
