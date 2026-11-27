'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FolderOpen,
  Search,
  Swords,
  BarChart3,
  BookOpen,
  Settings,
  User,
  LogOut,
} from 'lucide-react';
import { CortexLogo } from '@/components/brand/CortexLogo';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { Badge } from '@/components/ui/Badge';
import { AISettings, DEFAULT_AI_SETTINGS } from '@/lib/ai/assistant';

export type SidebarTab = 'files' | 'search' | 'benchmark' | 'practice' | 'learn';

interface GlobalSidebarProps {
  onOpenSettings?: () => void;
  isDarkMode?: boolean;
  highlightTab?: SidebarTab | null;
  hideLogo?: boolean;
  compactHeader?: boolean;
  hasPracticeSession?: boolean;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role?: string;
  avatar?: string;
  professionalEmail?: string;
}

interface NavItem {
  id: SidebarTab;
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const GlobalSidebar: React.FC<GlobalSidebarProps> = ({
  onOpenSettings,
  isDarkMode: propDarkMode,
  highlightTab,
  hideLogo = false,
  compactHeader = false,
  hasPracticeSession = false,
}) => {
  const pathname = usePathname() || '/';

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

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loginHref, setLoginHref] = useState<string>('/login');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (pathname === '/login' || pathname === '/register') {
      setLoginHref('/login');
      return;
    }
    const target = `${window.location.pathname}${window.location.search}`;
    setLoginHref(`/login?redirect=${encodeURIComponent(target)}`);
  }, [pathname]);

  useEffect(() => {
    let active = true;
    const syncAuthUser = () => {
      fetch('/api/v1/auth/me', { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!active) return;
          if (data?.user) {
            setUser(data.user);
          } else {
            setUser(null);
          }
        })
        .catch(() => {});
    };

    syncAuthUser();
    if (typeof window !== 'undefined') {
      window.addEventListener('cortex-auth-changed', syncAuthUser);
      window.addEventListener('focus', syncAuthUser);
      return () => {
        active = false;
        window.removeEventListener('cortex-auth-changed', syncAuthUser);
        window.removeEventListener('focus', syncAuthUser);
      };
    }
    return () => {
      active = false;
    };
  }, [pathname]);

  const [isAccountOpen, setIsAccountOpen] = useState<boolean>(false);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('files');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const tooltipTimerRef = useRef<number | null>(null);
  const suppressedIdRef = useRef<string | null>(null);

  const isIdeRoute = pathname === '/ide' || pathname.startsWith('/ide');
  const isIdeRouteRef = useRef(isIdeRoute);
  const isSidebarOpenRef = useRef(isSidebarOpen);
  const activeSidebarTabRef = useRef(activeSidebarTab);

  useEffect(() => {
    isIdeRouteRef.current = isIdeRoute;
    isSidebarOpenRef.current = isSidebarOpen;
    activeSidebarTabRef.current = activeSidebarTab;
  }, [isIdeRoute, isSidebarOpen, activeSidebarTab]);

  useEffect(() => {
    return () => {
      if (tooltipTimerRef.current) {
        window.clearTimeout(tooltipTimerRef.current);
        tooltipTimerRef.current = null;
      }
    };
  }, []);

  // Local fallback for SettingsModal if onOpenSettings not supplied
  const [localSettingsOpen, setLocalSettingsOpen] = useState(false);
  const [localAiSettings, setLocalAiSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [localFontSize, setLocalFontSize] = useState<number>(13);
  const [localTheme, setLocalTheme] = useState<string>('cortex-dark');

  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const savedTab = localStorage.getItem('cortex_active_sidebar_tab') as SidebarTab;
      if (savedTab && ['files', 'search', 'benchmark', 'practice', 'learn'].includes(savedTab)) {
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
      dismissTooltip();
      const customEvent = e as CustomEvent<{ activeTab: SidebarTab; isOpen: boolean }>;
      if (customEvent.detail) {
        if (typeof customEvent.detail.isOpen === 'boolean') {
          isSidebarOpenRef.current = customEvent.detail.isOpen;
          setIsSidebarOpen(customEvent.detail.isOpen);
        }
        if (customEvent.detail.activeTab) {
          activeSidebarTabRef.current = customEvent.detail.activeTab;
          setActiveSidebarTab(customEvent.detail.activeTab);
        }
      }
    };

    const handleFileExplorerState = (e: Event) => {
      dismissTooltip();
      const customEvent = e as CustomEvent<{ isCollapsed: boolean }>;
      if (customEvent.detail && typeof customEvent.detail.isCollapsed === 'boolean') {
        const nextOpen = !customEvent.detail.isCollapsed;
        isSidebarOpenRef.current = nextOpen;
        setIsSidebarOpen(nextOpen);
      }
    };

    window.addEventListener('cortex:sidebar-state', handleSidebarState);
    window.addEventListener('cortex:file-explorer-state', handleFileExplorerState);
    return () => {
      window.removeEventListener('cortex:sidebar-state', handleSidebarState);
      window.removeEventListener('cortex:file-explorer-state', handleFileExplorerState);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setIsAccountOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAccountOpen(false);
        dismissTooltip();
      }
    };
    const handleWindowBlur = () => {
      dismissTooltip();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  const scheduleTooltip = (id: string) => {
    if (suppressedIdRef.current === id) return;
    if (isIdeRoute && isSidebarOpen && activeSidebarTab === id) return;
    if (tooltipTimerRef.current) {
      window.clearTimeout(tooltipTimerRef.current);
    }
    tooltipTimerRef.current = window.setTimeout(() => {
      tooltipTimerRef.current = null;
      if (suppressedIdRef.current === id) return;
      if (
        isIdeRouteRef.current &&
        isSidebarOpenRef.current &&
        activeSidebarTabRef.current === id
      ) {
        return;
      }
      setHoveredId(id);
    }, 280);
  };

  const dismissTooltip = (suppressId?: string) => {
    if (tooltipTimerRef.current) {
      window.clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
    if (typeof suppressId === 'string') {
      suppressedIdRef.current = suppressId;
    }
    setHoveredId(null);
  };

  const handleRailItemLeave = (id: string) => {
    if (suppressedIdRef.current === id) {
      suppressedIdRef.current = null;
    }
    dismissTooltip();
  };

  const handleSettingsClick = () => {
    dismissTooltip('settings');
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
      // proceed to redirect
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('cortex_user');
        localStorage.removeItem('cortex_session_id');
        localStorage.removeItem('cortex_user_profile');
        window.dispatchEvent(new Event('cortex-auth-changed'));
      }
      window.location.href = '/login';
    }
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    const isFilesRoute = pathname === '/ide' || pathname.startsWith('/ide');
    dismissTooltip('logo');

    if (isFilesRoute) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('cortex:exit-practice-mode'));
      if (!isSidebarOpen || activeSidebarTab !== 'files') {
        window.dispatchEvent(
          new CustomEvent('cortex:sidebar-tab-toggle', {
            detail: { tab: 'files' },
          })
        );
      }
    } else {
      try {
        localStorage.setItem('cortex_active_sidebar_tab', 'files');
        localStorage.setItem('cortex_sidebar_open', 'true');
        localStorage.setItem('cortex_file_explorer_collapsed', 'false');
      } catch {}
    }
  };

  const handleNavClick = (item: NavItem, e: React.MouseEvent) => {
    const isFilesRoute = pathname === '/ide' || pathname.startsWith('/ide');
    dismissTooltip(item.id);

    if (isFilesRoute) {
      e.preventDefault();
      window.dispatchEvent(
        new CustomEvent('cortex:sidebar-tab-toggle', {
          detail: { tab: item.id },
        })
      );
    } else if (item.id === 'files' || item.id === 'search') {
      try {
        localStorage.setItem('cortex_active_sidebar_tab', item.id);
        localStorage.setItem('cortex_sidebar_open', 'true');
        localStorage.setItem('cortex_file_explorer_collapsed', 'false');
      } catch {}
    }
  };

  const navItems: NavItem[] = [
    { id: 'files', name: 'Explorer', href: '/ide', icon: FolderOpen },
    { id: 'search', name: 'Search', href: '/ide?tab=search', icon: Search },
    { id: 'practice', name: 'Practice Hub', href: '/challenges', icon: Swords },
    { id: 'benchmark', name: 'Telemetry', href: '/compare', icon: BarChart3 },
    { id: 'learn', name: 'Reference', href: '/learn', icon: BookOpen },
  ];

  return (
    <>
      <aside
        data-testid="global-activity-rail"
        style={{
          width: '58px',
          minWidth: '58px',
          maxWidth: '58px',
        }}
        className={`${
          isDarkMode ? 'dark bg-[#0A0A0C] border-white/[0.07] text-zinc-100' : 'bg-[#F4F4F6] border-black/[0.08] text-zinc-900'
        } border-r flex flex-col justify-between h-full select-none z-40 shrink-0 overflow-visible`}
      >
        <div className="flex flex-col flex-1 overflow-visible">
          {/* Top Cortex Emblem matching aligned shell header height */}
          {!hideLogo && (
            <div
              className={`${
                compactHeader ? 'h-10' : 'h-14'
              } flex items-center justify-center border-b border-black/[0.08] dark:border-white/[0.07] shrink-0`}
            >
              <Link
                href="/ide"
                onClick={handleLogoClick}
                onMouseDown={() => dismissTooltip('logo')}
                onMouseEnter={() => scheduleTooltip('logo')}
                onMouseLeave={() => handleRailItemLeave('logo')}
                onBlur={() => dismissTooltip()}
                className="relative flex items-center justify-center w-10 h-10 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
                aria-label="Cortex IDE Home"
              >
                <CortexLogo variant="icon" size="sm" />
              </Link>
            </div>
          )}

          {/* Rail Icons (58px crisp w-10 h-10 rounded-lg geometry) */}
          <nav
            className="flex-1 py-3 px-2 space-y-2 flex flex-col items-center overflow-visible"
            aria-label="Activity Rail"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = isIdeRoute
                ? highlightTab
                  ? highlightTab === item.id
                  : isSidebarOpen && activeSidebarTab === item.id
                : pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href.split('?')[0]));

              return (
                <div
                  key={item.id}
                  className="relative"
                  onMouseEnter={() => scheduleTooltip(item.id)}
                  onMouseLeave={() => handleRailItemLeave(item.id)}
                >
                  <Link
                    href={item.href}
                    data-testid={`rail-nav-${item.id}`}
                    aria-label={item.name}
                    onMouseDown={() => dismissTooltip(item.id)}
                    onClick={(e) => handleNavClick(item, e)}
                    onBlur={() => dismissTooltip()}
                    className={`relative w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                      isActive
                        ? 'bg-zinc-200/75 dark:bg-white/[0.06] text-[#F59E0B]'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-[#F4F4F5] hover:bg-zinc-200/60 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r bg-[#F59E0B]" />
                    )}
                    <Icon
                      className={`w-5 h-5 shrink-0 transition-colors ${
                        isActive ? 'text-[#F59E0B]' : ''
                      }`}
                    />
                    {item.id === 'practice' && hasPracticeSession && !isActive && (
                      <span
                        title="Active practice session"
                        className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#F59E0B]"
                      />
                    )}
                  </Link>

                  {hoveredId === item.id && !(isIdeRoute && isSidebarOpen && activeSidebarTab === item.id) && (
                    <div className="pointer-events-none absolute left-[62px] top-1/2 -translate-y-1/2 z-50 px-2.5 py-1 rounded-md bg-zinc-900 dark:bg-[#222227] border border-white/[0.1] shadow-xl text-[11px] font-medium text-zinc-100 whitespace-nowrap">
                      {item.name}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Hairline Divider + Settings & Elevated Account Tile */}
        <div className="border-t border-black/[0.08] dark:border-white/[0.07] p-2 space-y-2 flex flex-col items-center overflow-visible">
          <div
            className="relative"
            onMouseEnter={() => scheduleTooltip('settings')}
            onMouseLeave={() => handleRailItemLeave('settings')}
          >
            <button
              type="button"
              data-testid="rail-settings-btn"
              aria-label="Settings"
              onMouseDown={() => dismissTooltip('settings')}
              onClick={handleSettingsClick}
              onBlur={() => dismissTooltip()}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-[#F4F4F5] hover:bg-zinc-200/60 dark:hover:bg-white/[0.04] transition-colors"
            >
              <Settings className="w-5 h-5 shrink-0" />
            </button>
            {hoveredId === 'settings' && (
              <div className="pointer-events-none absolute left-[62px] top-1/2 -translate-y-1/2 z-50 px-2.5 py-1 rounded-md bg-zinc-900 dark:bg-[#222227] border border-white/[0.1] shadow-xl text-[11px] font-medium text-zinc-100 whitespace-nowrap">
                Settings
              </div>
            )}
          </div>

          <div
            ref={accountRef}
            className="relative"
            onMouseEnter={() => scheduleTooltip('account')}
            onMouseLeave={() => handleRailItemLeave('account')}
          >
            {user ? (
              <>
                <button
                  type="button"
                  data-testid="rail-account-btn"
                  aria-label={user.name || 'Account'}
                  onMouseDown={() => dismissTooltip('account')}
                  onClick={() => {
                    dismissTooltip('account');
                    setIsAccountOpen((prev) => !prev);
                  }}
                  onBlur={() => dismissTooltip()}
                  className={`relative w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                    isAccountOpen
                      ? 'bg-zinc-200/75 dark:bg-white/[0.08]'
                      : 'hover:bg-zinc-200/60 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full border border-black/[0.1] dark:border-white/[0.12] bg-white dark:bg-[#18181C] flex items-center justify-center text-xs font-bold text-[#F59E0B] overflow-hidden">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.name || 'User'}
                          className="w-full h-full object-cover rounded-full"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        user.name ? user.name.charAt(0).toUpperCase() : 'U'
                      )}
                    </div>
                    <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-[#F4F4F6] dark:border-[#0A0A0C]" />
                  </div>
                </button>

                {isAccountOpen && (
                  <div className="absolute bottom-0 left-[calc(100%+10px)] border rounded-lg shadow-2xl p-2 z-[110] text-xs w-56 bg-white dark:bg-[#18181C] border-black/[0.08] dark:border-white/[0.1] text-zinc-900 dark:text-zinc-100">
                    <div className="px-2 py-1.5 border-b border-black/[0.06] dark:border-white/[0.07] mb-1">
                      <div className="font-semibold truncate">{user.name}</div>
                      <div className="text-[11px] truncate text-zinc-500 dark:text-zinc-400">
                        {user.professionalEmail || user.email}
                      </div>
                      <div className="mt-1">
                        <Badge variant="amber" size="sm">
                          Role: {user.role || 'Student'}
                        </Badge>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="w-full flex items-center px-2 py-1.5 rounded text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition text-left"
                    >
                      <LogOut className="w-3.5 h-3.5 mr-2" />
                      <span>{isLoggingOut ? 'Signing out...' : 'Sign Out'}</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <Link
                href={loginHref}
                data-testid="rail-signin-link"
                aria-label="Sign In"
                onMouseDown={() => dismissTooltip('account')}
                onClick={() => dismissTooltip('account')}
                onBlur={() => dismissTooltip()}
                className="w-10 h-10 rounded-lg flex items-center justify-center bg-white dark:bg-[#121215] border border-black/[0.08] dark:border-white/[0.08] hover:border-black/[0.16] dark:hover:border-white/[0.16] text-[#F59E0B] shadow-sm dark:shadow-none transition-colors"
              >
                <User className="w-5 h-5 shrink-0 text-[#F59E0B]" />
              </Link>
            )}

            {hoveredId === 'account' && !isAccountOpen && (
              <div className="pointer-events-none absolute left-[62px] top-1/2 -translate-y-1/2 z-50 px-2.5 py-1 rounded-md bg-zinc-900 dark:bg-[#222227] border border-white/[0.1] shadow-xl text-[11px] font-medium text-zinc-100 whitespace-nowrap">
                {user ? user.name : 'Sign In'}
              </div>
            )}
          </div>
        </div>
      </aside>

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
          isDarkMode={isDarkMode}
        />
      )}
    </>
  );
};
