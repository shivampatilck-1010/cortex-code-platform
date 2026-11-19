'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  GraduationCap,
  BarChart3,
  Swords,
  BookOpen,
  FolderOpen,
  Settings,
  User,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Code2,
} from 'lucide-react';
import { CortexLogo } from '@/components/brand/CortexLogo';
import { requestBrowserFullscreen } from '@/lib/classroom/useClassroomFullscreen';
import { SettingsModal } from '@/components/modals/SettingsModal';
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

  // Persistence: cortex_global_sidebar_expanded (default true)
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAccountOpen, setIsAccountOpen] = useState<boolean>(false);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  // Local fallback for SettingsModal if onOpenSettings not supplied
  const [localSettingsOpen, setLocalSettingsOpen] = useState(false);
  const [localAiSettings, setLocalAiSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [localFontSize, setLocalFontSize] = useState<number>(14);
  const [localTheme, setLocalTheme] = useState<string>('cortex-dark');

  const accountRef = useRef<HTMLDivElement>(null);

  // Read sidebar state from localStorage safely on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cortex_global_sidebar_expanded');
      if (saved !== null) {
        setIsExpanded(saved === 'true');
      }
    } catch {}
  }, []);

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

  const handleToggle = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('cortex_global_sidebar_expanded', String(next));
      } catch {}
      return next;
    });
  };

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

  const navItems = [
    { name: 'IDE', href: '/ide', icon: Code2 },
    {
      name: 'Classroom',
      href: '/classroom',
      icon: GraduationCap,
      onClick: () => {
        requestBrowserFullscreen().catch(() => {});
      },
    },
    { name: 'Benchmark', href: '/compare', icon: BarChart3 },
    { name: 'Practice', href: '/challenges', icon: Swords },
    { name: 'Learn', href: '/learn', icon: BookOpen },
    { name: 'Files', href: '/files', icon: FolderOpen },
  ];

  return (
    <>
      <aside
        style={{
          width: isExpanded ? '210px' : '70px',
          minWidth: isExpanded ? '210px' : '70px',
          maxWidth: isExpanded ? '210px' : '70px',
        }}
        className="bg-[#0a0b0d] border-r border-[#1f2024] text-[#e6edf3] flex flex-col justify-between h-full select-none z-40 transition-[width,min-width,max-width] duration-200 ease-in-out shrink-0 overflow-hidden"
      >
        {/* Top: Logo & Main Nav */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Logo Section */}
          <div className="h-14 flex items-center px-3 border-b border-[#1f2024]/60">
            <Link
              href="/ide"
              className={`flex items-center w-full transition ${
                isExpanded ? 'justify-start space-x-2' : 'justify-center'
              }`}
              title="Cortex - Code Beyond Limits"
            >
              {isExpanded ? (
                <CortexLogo variant="header" size="sm" />
              ) : (
                <CortexLogo variant="icon" size="sm" />
              )}
            </Link>
          </div>

          {/* Nav Items */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-1">
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
                  title={!isExpanded ? item.name : undefined}
                  className={`group relative flex items-center h-10 rounded-md transition-colors text-xs font-medium ${
                    isActive
                      ? 'bg-[#1e1f26] text-[#ff9100] font-semibold'
                      : 'text-gray-400 hover:text-[#e6edf3] hover:bg-[#14151a]'
                  } ${isExpanded ? 'px-3 space-x-3' : 'justify-center'}`}
                >
                  {/* Left accent bar on active item */}
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#ff9100] rounded-r" />
                  )}

                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-[#ff9100]' : 'text-gray-400 group-hover:text-gray-200'
                    }`}
                  />

                  {isExpanded && (
                    <span className="truncate tracking-wide">{item.name}</span>
                  )}

                  {/* Tooltip on collapsed state */}
                  {!isExpanded && (
                    <div className="pointer-events-none absolute left-full ml-2 px-2 py-1 bg-[#1a1c24] text-[#e6edf3] text-xs font-medium rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 border border-[#282a36]">
                      {item.name}
                    </div>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Divider, Settings, Account, Toggle */}
        <div className="border-t border-[#1f2024] p-2 space-y-1 bg-[#0a0b0d]">
          {/* Settings Button */}
          <button
            onClick={handleSettingsClick}
            title={!isExpanded ? 'Settings' : undefined}
            className={`group relative flex items-center w-full h-9 rounded-md transition-colors text-xs font-medium text-gray-400 hover:text-white hover:bg-[#14151a] ${
              isExpanded ? 'px-3 space-x-3' : 'justify-center'
            }`}
          >
            <Settings className="w-4 h-4 shrink-0 text-gray-400 group-hover:text-gray-200" />
            {isExpanded && <span className="truncate">Settings</span>}

            {!isExpanded && (
              <div className="pointer-events-none absolute left-full ml-2 px-2 py-1 bg-[#1a1c24] text-[#e6edf3] text-xs font-medium rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 border border-[#282a36]">
                Settings
              </div>
            )}
          </button>

          {/* Account / User Section */}
          <div ref={accountRef} className="relative">
            {user ? (
              <>
                <button
                  onClick={() => setIsAccountOpen((prev) => !prev)}
                  title={!isExpanded ? `${user.name} (${user.role || 'user'})` : undefined}
                  className={`group relative flex items-center w-full h-10 rounded-md transition-colors text-xs text-gray-300 hover:text-white hover:bg-[#14151a] ${
                    isExpanded ? 'px-2 space-x-2.5' : 'justify-center'
                  } ${isAccountOpen ? 'bg-[#16171d]' : ''}`}
                >
                  {/* Avatar Circle with Online Dot */}
                  <div className="relative shrink-0">
                    <div className="w-7 h-7 rounded-full bg-[#1e1f26] border border-[#2a2c38] flex items-center justify-center font-bold text-xs text-[#ff9100]">
                      {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-[#0a0b0d]" />
                  </div>

                  {/* Expanded info: Name + Role */}
                  {isExpanded && (
                    <div className="flex-1 flex items-center justify-between min-w-0 text-left">
                      <div className="truncate pr-1">
                        <div className="truncate font-semibold text-xs text-gray-200">
                          {user.name}
                        </div>
                      </div>
                      <span className="text-[10px] uppercase font-mono px-1 py-0.5 rounded bg-[#252830] text-[#ff9100] font-semibold shrink-0">
                        {user.role || 'user'}
                      </span>
                    </div>
                  )}

                  {!isExpanded && (
                    <div className="pointer-events-none absolute left-full ml-2 px-2 py-1 bg-[#1a1c24] text-[#e6edf3] text-xs font-medium rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 border border-[#282a36]">
                      {user.name} ({user.role || 'user'})
                    </div>
                  )}
                </button>

                {/* Account Dropdown Popover */}
                {isAccountOpen && (
                  <div
                    className={`absolute bottom-full mb-2 bg-[#121318] border border-[#232530] rounded-lg shadow-2xl p-2 z-50 text-xs ${
                      isExpanded ? 'left-0 w-52' : 'left-full ml-2 w-52'
                    }`}
                  >
                    <div className="px-2 py-1.5 border-b border-[#1f2024] mb-1">
                      <div className="font-semibold text-gray-100 truncate">{user.name}</div>
                      <div className="text-[11px] text-gray-400 truncate">
                        {user.professionalEmail || user.email}
                      </div>
                      <div className="mt-1">
                        <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#252830] text-[#ff9100] font-semibold">
                          Role: {user.role || 'Student'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <Link
                        href="/classroom"
                        onClick={() => {
                          setIsAccountOpen(false);
                          requestBrowserFullscreen().catch(() => {});
                        }}
                        className="flex items-center px-2 py-1.5 rounded text-gray-300 hover:text-white hover:bg-[#1a1b22] transition"
                      >
                        <GraduationCap className="w-3.5 h-3.5 mr-2 text-gray-400" />
                        <span>Classroom Hub</span>
                      </Link>
                      <Link
                        href="/files"
                        onClick={() => setIsAccountOpen(false)}
                        className="flex items-center px-2 py-1.5 rounded text-gray-300 hover:text-white hover:bg-[#1a1b22] transition"
                      >
                        <FolderOpen className="w-3.5 h-3.5 mr-2 text-gray-400" />
                        <span>My Files</span>
                      </Link>
                      <Link
                        href="/ide"
                        onClick={() => setIsAccountOpen(false)}
                        className="flex items-center px-2 py-1.5 rounded text-gray-300 hover:text-white hover:bg-[#1a1b22] transition"
                      >
                        <Code2 className="w-3.5 h-3.5 mr-2 text-gray-400" />
                        <span>Cloud IDE</span>
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
                title={!isExpanded ? 'Sign In' : undefined}
                className={`group relative flex items-center w-full h-9 rounded-md transition-colors text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#14151a] border border-[#232530] bg-[#121318] ${
                  isExpanded ? 'px-3 space-x-2.5' : 'justify-center'
                }`}
              >
                <User className="w-4 h-4 shrink-0 text-[#ff9100]" />
                {isExpanded && <span>Sign In</span>}

                {!isExpanded && (
                  <div className="pointer-events-none absolute left-full ml-2 px-2 py-1 bg-[#1a1c24] text-[#e6edf3] text-xs font-medium rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 border border-[#282a36]">
                    Sign In
                  </div>
                )}
              </Link>
            )}
          </div>

          {/* Expand/Collapse Toggle Button */}
          <button
            onClick={handleToggle}
            title={isExpanded ? 'Collapse Sidebar' : 'Expand Sidebar'}
            className={`group relative flex items-center w-full h-8 rounded-md transition-colors text-xs font-medium text-gray-400 hover:text-white hover:bg-[#14151a] ${
              isExpanded ? 'px-3 justify-between' : 'justify-center'
            }`}
          >
            {isExpanded && <span className="text-[11px] text-gray-500">Collapse</span>}
            {isExpanded ? (
              <ChevronLeft className="w-4 h-4 text-gray-400 group-hover:text-gray-200" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-200" />
            )}

            {!isExpanded && (
              <div className="pointer-events-none absolute left-full ml-2 px-2 py-1 bg-[#1a1c24] text-[#e6edf3] text-xs font-medium rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 border border-[#282a36]">
                Expand
              </div>
            )}
          </button>
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
