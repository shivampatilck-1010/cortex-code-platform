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
} from 'lucide-react';
import { CortexLogo } from '@/components/brand/CortexLogo';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { Badge } from '@/components/ui/Badge';
import { AISettings, DEFAULT_AI_SETTINGS } from '@/lib/ai/assistant';

export type SidebarTab = 'files' | 'benchmark' | 'practice' | 'learn';

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

interface NavItem {
  id: SidebarTab;
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  functionality?: string;
}

export const GlobalSidebar: React.FC<GlobalSidebarProps> = ({ onOpenSettings }) => {
  const pathname = usePathname() || '/';

  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAccountOpen, setIsAccountOpen] = useState<boolean>(false);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  // Tab & Open State for Adjacent Contextual Sidebar
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('files');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  // Floating tooltip window tracking cursor position
  const [floatingTooltip, setFloatingTooltip] = useState<{
    title: string;
    description?: string;
    x: number;
    y: number;
  } | null>(null);

  // Local fallback for SettingsModal if onOpenSettings not supplied
  const [localSettingsOpen, setLocalSettingsOpen] = useState(false);
  const [localAiSettings, setLocalAiSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [localFontSize, setLocalFontSize] = useState<number>(14);
  const [localTheme, setLocalTheme] = useState<string>('cortex-dark');

  const accountRef = useRef<HTMLDivElement>(null);

  // Sync sidebar tab and open state with localStorage and custom event broadcasts
  useEffect(() => {
    try {
      const savedTab = localStorage.getItem('cortex_active_sidebar_tab') as SidebarTab;
      if (savedTab && ['files', 'benchmark', 'practice', 'learn'].includes(savedTab)) {
        setActiveSidebarTab(savedTab);
      }
      const savedOpen = localStorage.getItem('cortex_sidebar_open');
      const savedCollapsed = localStorage.getItem('cortex_file_explorer_collapsed');
      if (savedOpen !== null) {
        setIsSidebarOpen(savedOpen === 'true');
      } else if (savedCollapsed !== null) {
        setIsSidebarOpen(savedCollapsed !== 'true');
      }
    } catch {}

    const handleSidebarState = (e: Event) => {
      const customEvent = e as CustomEvent<{ activeTab: SidebarTab; isOpen: boolean }>;
      if (customEvent.detail) {
        if (typeof customEvent.detail.isOpen === 'boolean') {
          setIsSidebarOpen(customEvent.detail.isOpen);
        }
        if (customEvent.detail.activeTab) {
          setActiveSidebarTab(customEvent.detail.activeTab);
        }
      }
    };

    const handleFileExplorerState = (e: Event) => {
      const customEvent = e as CustomEvent<{ isCollapsed: boolean }>;
      if (customEvent.detail && typeof customEvent.detail.isCollapsed === 'boolean') {
        setIsSidebarOpen(!customEvent.detail.isCollapsed);
      }
    };

    window.addEventListener('cortex:sidebar-state', handleSidebarState);
    window.addEventListener('cortex:file-explorer-state', handleFileExplorerState);
    return () => {
      window.removeEventListener('cortex:sidebar-state', handleSidebarState);
      window.removeEventListener('cortex:file-explorer-state', handleFileExplorerState);
    };
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

  // Hover handlers for floating window right next to the cursor
  const showFloatingTooltip = (title: string, description: string | undefined, e: React.MouseEvent) => {
    setFloatingTooltip({
      title,
      description,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const moveFloatingTooltip = (e: React.MouseEvent) => {
    setFloatingTooltip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
  };

  const hideFloatingTooltip = () => {
    setFloatingTooltip(null);
  };

  const handleNavClick = (item: NavItem, e: React.MouseEvent) => {
    const isFilesRoute = pathname === '/ide' || pathname.startsWith('/ide');

    if (isFilesRoute) {
      e.preventDefault();
      // On /ide:
      // If currently active tab is open, clicking it toggles it closed
      // If closed or a different tab is clicked, switch tab and open the sidebar
      window.dispatchEvent(
        new CustomEvent('cortex:sidebar-tab-toggle', {
          detail: { tab: item.id },
        })
      );
    } else {
      // On other routes: remember tab so when returning to /ide it opens directly
      try {
        localStorage.setItem('cortex_active_sidebar_tab', item.id);
        localStorage.setItem('cortex_sidebar_open', 'true');
        localStorage.setItem('cortex_file_explorer_collapsed', 'false');
      } catch {}
    }
  };

  // Strictly reordered nav items:
  // 1. Files (/ide)
  // 2. Benchmark (/compare)
  // 3. Practice (/challenges)
  // 4. Learn (/learn)
  const navItems: NavItem[] = [
    {
      id: 'files',
      name: 'Files',
      href: '/ide',
      icon: FolderOpen,
      functionality: 'Project Explorer & Workspace Files',
    },
    {
      id: 'benchmark',
      name: 'Benchmark',
      href: '/compare',
      icon: BarChart3,
      functionality: 'Multi-Language Performance & Profiling',
    },
    {
      id: 'practice',
      name: 'Practice',
      href: '/challenges',
      icon: Swords,
      functionality: 'Coding Challenges & Problem Sets',
    },
    {
      id: 'learn',
      name: 'Learn',
      href: '/learn',
      icon: BookOpen,
      functionality: 'Interactive Courses & Tutorials',
    },
  ];

  const isIdeRoute = pathname === '/ide' || pathname.startsWith('/ide');

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
              onMouseEnter={(e) => showFloatingTooltip('Cortex', 'Code Beyond Limits', e)}
              onMouseMove={moveFloatingTooltip}
              onMouseLeave={hideFloatingTooltip}
              className="relative flex items-center justify-center w-10 h-10 rounded-lg hover:bg-[#14151a] transition"
              title="Cortex — Code Beyond Limits"
            >
              <CortexLogo variant="icon" size="sm" />
            </Link>
          </div>

          {/* Nav Items (Permanent Icon-Rail) */}
          <nav className="flex-1 py-3 px-2 space-y-2 overflow-visible">
            {navItems.map((item) => {
              const Icon = item.icon;

              // Active icon highlight: amber accent and left indicator bar appear ONLY when isSidebarOpen is true on /ide
              const isActive = isIdeRoute
                ? isSidebarOpen && activeSidebarTab === item.id
                : pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={(e) => handleNavClick(item, e)}
                  onMouseEnter={(e) => showFloatingTooltip(item.name, item.functionality, e)}
                  onMouseMove={moveFloatingTooltip}
                  onMouseLeave={hideFloatingTooltip}
                  className={`relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors text-xs font-medium ${
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
                      isActive ? 'text-[#ff9100]' : 'text-gray-400 hover:text-gray-200'
                    }`}
                  />
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
            onMouseEnter={(e) => showFloatingTooltip('Settings', 'Editor, AI Assistant & Theme', e)}
            onMouseMove={moveFloatingTooltip}
            onMouseLeave={hideFloatingTooltip}
            className="relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors text-xs font-medium text-gray-400 hover:text-white hover:bg-[#14151a]"
          >
            <Settings className="w-5 h-5 shrink-0 text-gray-400 hover:text-gray-200" />
          </button>

          {/* Account / User Section */}
          <div ref={accountRef} className="relative">
            {user ? (
              <>
                <button
                  onClick={() => setIsAccountOpen((prev) => !prev)}
                  onMouseEnter={(e) => showFloatingTooltip(user.name, user.role || 'Student', e)}
                  onMouseMove={moveFloatingTooltip}
                  onMouseLeave={hideFloatingTooltip}
                  className={`relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors text-xs text-gray-300 hover:text-white hover:bg-[#14151a] ${
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
                onMouseEnter={(e) => showFloatingTooltip('Sign In', 'Sync your projects & progress', e)}
                onMouseMove={moveFloatingTooltip}
                onMouseLeave={hideFloatingTooltip}
                className="relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#14151a] border border-[#232530] bg-[#121318]"
              >
                <User className="w-5 h-5 shrink-0 text-[#ff9100]" />
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* Floating Tooltip Window displayed right next to the cursor on hover */}
      {floatingTooltip && (
        <div
          style={{
            left: `${floatingTooltip.x + 16}px`,
            top: `${Math.min(
              Math.max(floatingTooltip.y - 18, 10),
              typeof window !== 'undefined' ? window.innerHeight - 80 : 600
            )}px`,
          }}
          className="fixed pointer-events-none z-[9999] select-none transition-opacity duration-150"
        >
          <div className="bg-[#121318]/95 backdrop-blur-md text-[#e6edf3] text-xs rounded-lg shadow-2xl px-3.5 py-2 border border-[#2b2d3a] flex flex-col items-start gap-1 min-w-[130px] max-w-[260px] animate-in fade-in duration-100">
            <div className="flex items-center space-x-1.5 w-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff9100] shrink-0" />
              <span className="font-semibold text-white tracking-wide text-xs">
                {floatingTooltip.title}
              </span>
            </div>
            {floatingTooltip.description && (
              <span className="text-[11px] text-gray-400 font-normal leading-tight">
                {floatingTooltip.description}
              </span>
            )}
          </div>
        </div>
      )}

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
