'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { EditorLayoutMode, BottomPanelTab } from '@/types/ide';

export type SidebarTab = 'files' | 'search' | 'benchmark' | 'practice' | 'learn';

export interface UseIdeLayoutReturn {
  sidebarWidth: number;
  setSidebarWidth: React.Dispatch<React.SetStateAction<number>>;
  dockHeight: number;
  setDockHeight: React.Dispatch<React.SetStateAction<number>>;
  isExplorerCollapsed: boolean;
  setIsExplorerCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  isSidebarOpen: boolean;
  setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeSidebarTab: SidebarTab;
  setActiveSidebarTab: React.Dispatch<React.SetStateAction<SidebarTab>>;
  isBottomCollapsed: boolean;
  setIsBottomCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  editorLayoutMode: EditorLayoutMode;
  setEditorLayoutMode: React.Dispatch<React.SetStateAction<EditorLayoutMode>>;
  activeBottomTab: BottomPanelTab;
  setActiveBottomTab: React.Dispatch<React.SetStateAction<BottomPanelTab>>;
  isFullscreen: boolean;
  setIsFullscreen: React.Dispatch<React.SetStateAction<boolean>>;
  fileExplorerRef: React.RefObject<HTMLDivElement | null>;
  isResizingSidebar: boolean;
  isResizingDock: boolean;
  startResizingSidebar: (e: React.MouseEvent) => void;
  startResizingDock: (e: React.MouseEvent) => void;
  toggleFileExplorer: () => void;
  toggleSidebarTab: (tab: SidebarTab) => void;
}

export function useIdeLayout(): UseIdeLayoutReturn {
  const [sidebarWidth, setSidebarWidth] = useState<number>(250);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('files');
  const [dockHeight, setDockHeight] = useState<number>(240);
  const [isBottomCollapsed, setIsBottomCollapsed] = useState<boolean>(false);
  const [editorLayoutMode, setEditorLayoutMode] = useState<EditorLayoutMode>('code');
  const [activeBottomTab, setActiveBottomTab] = useState<BottomPanelTab>('output');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingDock, setIsResizingDock] = useState(false);
  const fileExplorerRef = useRef<HTMLDivElement>(null);

  // Derived legacy boolean for backward compatibility
  const isExplorerCollapsed = !isSidebarOpen;
  const setIsExplorerCollapsed = useCallback<React.Dispatch<React.SetStateAction<boolean>>>(
    (valOrFn) => {
      setIsSidebarOpen((prev) => {
        const nextCollapsed = typeof valOrFn === 'function' ? valOrFn(!prev) : valOrFn;
        return !nextCollapsed;
      });
    },
    []
  );

  const toggleSidebarTab = useCallback((tab: SidebarTab) => {
    if (isSidebarOpen && activeSidebarTab === tab) {
      setIsSidebarOpen(false);
    } else {
      setActiveSidebarTab(tab);
      setIsSidebarOpen(true);
    }
  }, [isSidebarOpen, activeSidebarTab]);

  const toggleFileExplorer = useCallback(() => {
    toggleSidebarTab('files');
  }, [toggleSidebarTab]);

  // Keep a ref to toggleSidebarTab for event handlers to avoid stale closures
  const toggleSidebarTabRef = useRef(toggleSidebarTab);
  useEffect(() => {
    toggleSidebarTabRef.current = toggleSidebarTab;
  }, [toggleSidebarTab]);

  // Hydration-safe localStorage persistence for layout
  useEffect(() => {
    try {
      const savedWidth = localStorage.getItem('cortex_file_explorer_width');
      if (savedWidth) {
        const val = parseInt(savedWidth, 10);
        if (!isNaN(val) && val >= 160 && val <= 600) {
          setSidebarWidth(val);
        }
      }

      const savedDock = localStorage.getItem('cortex_dock_height');
      if (savedDock) {
        const val = parseInt(savedDock, 10);
        if (!isNaN(val) && val >= 120 && val <= 800) {
          setDockHeight(val);
        }
      }

      const savedTab = localStorage.getItem('cortex_active_sidebar_tab') as SidebarTab;
      if (savedTab && ['files', 'search', 'benchmark', 'practice', 'learn'].includes(savedTab)) {
        setActiveSidebarTab(savedTab);
      }

      const savedSidebarOpen = localStorage.getItem('cortex_sidebar_open');
      const savedCollapsed = localStorage.getItem('cortex_file_explorer_collapsed');
      if (savedSidebarOpen !== null) {
        setIsSidebarOpen(savedSidebarOpen === 'true');
      } else if (savedCollapsed !== null) {
        setIsSidebarOpen(savedCollapsed !== 'true');
      }
    } catch {}

    const handleToggleFileExplorer = () => {
      toggleSidebarTabRef.current('files');
    };

    const handleSidebarTabToggle = (e: Event) => {
      const customEvent = e as CustomEvent<{ tab: SidebarTab }>;
      const targetTab = customEvent.detail?.tab;
      if (targetTab) {
        toggleSidebarTabRef.current(targetTab);
      }
    };

    window.addEventListener('cortex:toggle-file-explorer', handleToggleFileExplorer);
    window.addEventListener('cortex:sidebar-tab-toggle', handleSidebarTabToggle);
    return () => {
      window.removeEventListener('cortex:toggle-file-explorer', handleToggleFileExplorer);
      window.removeEventListener('cortex:sidebar-tab-toggle', handleSidebarTabToggle);
    };
  }, []);

  // Broadcast state changes for GlobalSidebar synchronization
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('cortex:sidebar-state', {
        detail: { 
          activeTab: activeSidebarTab, 
          isOpen: isSidebarOpen 
        },
      })
    );
    window.dispatchEvent(
      new CustomEvent('cortex:file-explorer-state', {
        detail: { isCollapsed: !isSidebarOpen },
      })
    );
  }, [isSidebarOpen, activeSidebarTab]);

  useEffect(() => {
    try {
      localStorage.setItem('cortex_file_explorer_width', String(sidebarWidth));
    } catch {}
  }, [sidebarWidth]);

  useEffect(() => {
    try {
      localStorage.setItem('cortex_dock_height', String(dockHeight));
    } catch {}
  }, [dockHeight]);

  useEffect(() => {
    try {
      localStorage.setItem('cortex_sidebar_open', String(isSidebarOpen));
      localStorage.setItem('cortex_file_explorer_collapsed', String(!isSidebarOpen));
      localStorage.setItem('cortex_active_sidebar_tab', activeSidebarTab);
    } catch {}
  }, [isSidebarOpen, activeSidebarTab]);

  const startResizingSidebar = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
  }, []);

  const startResizingDock = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingDock(true);
  }, []);

  // Window resize mousemove listener
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingSidebar) {
        const containerLeft = fileExplorerRef.current?.getBoundingClientRect().left ?? 44;
        const desiredWidth = e.clientX - containerLeft;
        const maxWidth = typeof window !== 'undefined' ? Math.min(440, Math.floor(window.innerWidth * 0.45)) : 440;
        const newWidth = Math.min(Math.max(desiredWidth, 200), maxWidth);
        setSidebarWidth(newWidth);
      } else if (isResizingDock) {
        const newHeight = window.innerHeight - e.clientY - 24;
        const maxHeight = Math.floor(window.innerHeight * 0.72);
        setDockHeight(Math.min(Math.max(newHeight, 120), maxHeight));
      }
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      setIsResizingDock(false);
    };

    if (isResizingSidebar || isResizingDock) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = isResizingSidebar ? 'col-resize' : 'row-resize';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizingSidebar, isResizingDock]);

  return {
    sidebarWidth,
    setSidebarWidth,
    dockHeight,
    setDockHeight,
    isExplorerCollapsed,
    setIsExplorerCollapsed,
    isSidebarOpen,
    setIsSidebarOpen,
    activeSidebarTab,
    setActiveSidebarTab,
    isBottomCollapsed,
    setIsBottomCollapsed,
    editorLayoutMode,
    setEditorLayoutMode,
    activeBottomTab,
    setActiveBottomTab,
    isFullscreen,
    setIsFullscreen,
    fileExplorerRef,
    isResizingSidebar,
    isResizingDock,
    startResizingSidebar,
    startResizingDock,
    toggleFileExplorer,
    toggleSidebarTab,
  };
}
