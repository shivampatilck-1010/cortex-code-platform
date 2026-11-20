'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FolderOpen,
  BarChart3,
  Swords,
  BookOpen,
  Settings,
  User,
  LogOut,
  GraduationCap,
  Code2,
} from 'lucide-react';
import { CortexLogo } from '@/components/brand/CortexLogo';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { Badge } from '@/components/ui/Badge';
import { AISettings, DEFAULT_AI_SETTINGS } from '@/lib/ai/assistant';

interface GlobalSidebarProps {
  onOpenSettings?: () => void;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role?: string;
  professionalEmail?: string;
}

export const GlobalSidebar: React.FC<GlobalSidebarProps> = ({ onOpenSettings }) => {
  const pathname = usePathname() || '/';

  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAccountOpen, setIsAccountOpen] = useState<boolean>(false);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  // Local fallback for SettingsModal if onOpenSettings not supplied
  const [localSettingsOpen, setLocalSettingsOpen] = useState(false);
  const [localAiSettings, setLocalAiSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [localFontSize, setLocalFontSize] = useState<number>(14);
  const [localTheme, setLocalTheme] = useState<string>('cortex-dark');

  const accountRef = useRef<HTMLDivElement>(null);

  // Fetch current user from /api/v1/auth/me
  useEffect(() => {
    let isMounted = true;
    fetch('/api/v1/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.user) {
          setUser(data.user);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  // Close account dropdown on outside click or escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setIsAccountOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAccountOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSettingsClick = () => {
    if (onOpenSettings) {
      onOpenSettings();
    } else {
      setLocalSettingsOpen(true);
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // proceed to redirect regardless
    } finally {
      window.location.href = '/login';
    }
  };

  // Reorganized navigation:
  // 1. Files (/ide) - clicking again on /ide toggles the file explorer sidebar
  // 2. Benchmark (/compare)
  // 3. Practice (/challenges)
  // 4. Learn (/learn)
  const navItems = [
    {
      name: 'Files',
      href: '/ide',
      icon: FolderOpen,
      functionality: 'Project Explorer & Files (Click to toggle)',
      onClick: (e: React.MouseEvent) => {
        if (pathname === '/ide' || pathname.startsWith('/ide')) {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('cortex:toggle-file-explorer'));
        }
      },
    },
    {
      name: 'Benchmark',
      href: '/compare',
      icon: BarChart3,
      functionality: 'Multi-Language Performance & Profiling',
    },
    {
      name: 'Practice',
      href: '/challenges',
      icon: Swords,
      functionality: 'Coding Challenges & Problem Sets',
    },
    {
      name: 'Learn',
      href: '/learn',
      icon: BookOpen,
      functionality: 'Interactive Courses & Tutorials',
    },
  ];

  return (
    <>
      <aside
        style={{
          width: '58px',
          minWidth: '58px',
          maxWidth: '58px',
        }}
        className="bg-[#0a0b0d] border-r border-[#1f2024] text-[#e6edf3] flex flex-col justify-between h-full select-none z-40 shrink-0 overflow-visible"
      >
        {/* Top: Logo & Main Nav */}
        <div className="flex flex-col flex-1 overflow-visible">
          {/* Logo Section */}
          <div className="h-14 flex items-center justify-center px-2 border-b border-[#1f2024]/60">
            <Link
              href="/ide"
              className="group relative flex items-center justify-center w-10 h-10 rounded-lg hover:bg-[#14151a] transition"
              title="Cortex — Code Beyond Limits"
            >
              <CortexLogo variant="icon" size="sm" />
              <div className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#14151b] text-[#e6edf3] text-xs rounded-md shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-150 whitespace-nowrap z-[100] border border-[#2b2d3a] flex flex-col items-start gap-0.5">
                <span className="font-semibold text-white tracking-wide">Cortex</span>
                <span className="text-[10px] text-[#ffb300] font-normal">Code Beyond Limits</span>
              </div>
            </Link>
          </div>

          {/* Nav Items (Permanent Icon-Rail) */}
          <nav className="flex-1 py-3 px-2 space-y-2 overflow-visible">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/ide'
                  ? pathname === '/ide' || pathname.startsWith('/ide')
                  : pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={item.onClick}
                  className={`group relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors text-xs font-medium ${
                    isActive
                      ? 'bg-[#1e1f26] text-[#ff9100]'
                      : 'text-gray-400 hover:text-[#e6edf3] hover:bg-[#14151a]'
                  }`}
                >
                  {/* Left accent bar on active item */}
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 bg-[#ff9100] rounded-r" />
                  )}

                  <Icon
                    className={`w-5 h-5 shrink-0 transition-colors ${
                      isActive ? 'text-[#ff9100]' : 'text-gray-400 group-hover:text-gray-200'
                    }`}
                  />

                  {/* High-visibility tooltip on hover showing full name and functionality */}
                  <div className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#14151b] text-[#e6edf3] text-xs rounded-md shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-150 whitespace-nowrap z-[100] border border-[#2b2d3a] flex flex-col items-start gap-0.5">
                    <span className="font-semibold text-white tracking-wide">{item.name}</span>
                    <span className="text-[10px] text-gray-400 font-normal">{item.functionality}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Settings & Account */}
        <div className="border-t border-[#1f2024] p-2 space-y-2 bg-[#0a0b0d] overflow-visible">
          {/* Settings Button */}
          <button
            onClick={handleSettingsClick}
            className="group relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors text-xs font-medium text-gray-400 hover:text-white hover:bg-[#14151a]"
          >
            <Settings className="w-5 h-5 shrink-0 text-gray-400 group-hover:text-gray-200" />
            <div className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#14151b] text-[#e6edf3] text-xs rounded-md shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-150 whitespace-nowrap z-[100] border border-[#2b2d3a] flex flex-col items-start gap-0.5">
              <span className="font-semibold text-white tracking-wide">Settings</span>
              <span className="text-[10px] text-gray-400 font-normal">Editor, AI Assistant & Theme</span>
            </div>
          </button>

          {/* Account / User Section */}
          <div ref={accountRef} className="relative">
            {user ? (
              <>
                <button
                  onClick={() => setIsAccountOpen((prev) => !prev)}
                  className={`group relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors text-xs text-gray-300 hover:text-white hover:bg-[#14151a] ${
                    isAccountOpen ? 'bg-[#16171d]' : ''
                  }`}
                >
                  {/* Avatar Circle with Online Dot */}
                  <div className="relative shrink-0">
                    <div className="w-8 h-8 rounded-full bg-[#1e1f26] border border-[#2a2c38] flex items-center justify-center font-bold text-xs text-[#ff9100]">
                      {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-[#0a0b0d]" />
                  </div>

                  <div className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#14151b] text-[#e6edf3] text-xs rounded-md shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-150 whitespace-nowrap z-[100] border border-[#2b2d3a] flex flex-col items-start gap-0.5">
                    <span className="font-semibold text-white tracking-wide">{user.name}</span>
                    <span className="text-[10px] text-[#ff9100] font-mono uppercase">{user.role || 'Student'}</span>
                  </div>
                </button>

                {/* Account Dropdown Popover */}
                {isAccountOpen && (
                  <div className="absolute bottom-0 left-[calc(100%+12px)] bg-[#121318] border border-[#232530] rounded-lg shadow-2xl p-2 z-[110] text-xs w-56">
                    <div className="px-2 py-1.5 border-b border-[#1f2024] mb-1">
                      <div className="font-semibold text-gray-100 truncate">{user.name}</div>
                      <div className="text-[11px] text-gray-400 truncate">
                        {user.professionalEmail || user.email}
                      </div>
                      <div className="mt-1">
                        <Badge variant="amber" size="sm">
                          Role: {user.role || 'Student'}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <Link
                        href="/ide"
                        onClick={() => setIsAccountOpen(false)}
                        className="flex items-center px-2 py-1.5 rounded text-gray-300 hover:text-white hover:bg-[#1a1b22] transition"
                      >
                        <Code2 className="w-3.5 h-3.5 mr-2 text-gray-400" />
                        <span>Cloud IDE</span>
                      </Link>
                      <Link
                        href="/classroom"
                        onClick={() => setIsAccountOpen(false)}
                        className="flex items-center px-2 py-1.5 rounded text-gray-300 hover:text-white hover:bg-[#1a1b22] transition"
                      >
                        <GraduationCap className="w-3.5 h-3.5 mr-2 text-gray-400" />
                        <span>Classroom Hub</span>
                      </Link>
                    </div>

                    <div className="border-t border-[#1f2024] my-1" />

                    <button
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="w-full flex items-center px-2 py-1.5 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition text-left"
                    >
                      <LogOut className="w-3.5 h-3.5 mr-2" />
                      <span>{isLoggingOut ? 'Signing out...' : 'Sign Out'}</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <Link
                href="/login"
                className="group relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#14151a] border border-[#232530] bg-[#121318]"
              >
                <User className="w-5 h-5 shrink-0 text-[#ff9100]" />
                <div className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#14151b] text-[#e6edf3] text-xs rounded-md shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-150 whitespace-nowrap z-[100] border border-[#2b2d3a] flex flex-col items-start gap-0.5">
                  <span className="font-semibold text-white tracking-wide">Sign In</span>
                  <span className="text-[10px] text-gray-400 font-normal">Sync your projects & progress</span>
                </div>
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* Standalone fallback SettingsModal if onOpenSettings was not provided */}
      {!onOpenSettings && (
        <SettingsModal
          isOpen={localSettingsOpen}
          onClose={() => setLocalSettingsOpen(false)}
          aiSettings={localAiSettings}
          onUpdateAISettings={(s) => setLocalAiSettings((prev) => ({ ...prev, ...s }))}
          fontSize={localFontSize}
          onChangeFontSize={setLocalFontSize}
          theme={localTheme}
          onChangeTheme={setLocalTheme}
        />
      )}
    </>
  );
};
