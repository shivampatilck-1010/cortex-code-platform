'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { EditorLayoutMode, BottomPanelTab } from '@/types/ide';

export interface UseIdeLayoutReturn {
  sidebarWidth: number;
  setSidebarWidth: React.Dispatch<React.SetStateAction<number>>;
  dockHeight: number;
  setDockHeight: React.Dispatch<React.SetStateAction<number>>;
  isExplorerCollapsed: boolean;
  setIsExplorerCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
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
}

export function useIdeLayout(): UseIdeLayoutReturn {
  const [sidebarWidth, setSidebarWidth] = useState<number>(240);
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState<boolean>(false);
  const [dockHeight, setDockHeight] = useState<number>(280);
  const [isBottomCollapsed, setIsBottomCollapsed] = useState<boolean>(false);
  const [editorLayoutMode, setEditorLayoutMode] = useState<EditorLayoutMode>('code');
  const [activeBottomTab, setActiveBottomTab] = useState<BottomPanelTab>('output');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingDock, setIsResizingDock] = useState(false);
  const fileExplorerRef = useRef<HTMLDivElement>(null);

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
      const savedCollapsed = localStorage.getItem('cortex_file_explorer_collapsed');
      if (savedCollapsed !== null) {
        setIsExplorerCollapsed(savedCollapsed === 'true');
      }
    } catch {}

    const handleToggle = () => {
      setIsExplorerCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem('cortex_file_explorer_collapsed', String(next));
        } catch {}
        return next;
      });
    };

    window.addEventListener('cortex:toggle-file-explorer', handleToggle);
    return () => window.removeEventListener('cortex:toggle-file-explorer', handleToggle);
  }, []);

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

  const startResizingSidebar = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
  }, []);

  const startResizingDock = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingDock(true);
  }, []);

  const toggleFileExplorer = useCallback(() => {
    setIsExplorerCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('cortex_file_explorer_collapsed', String(next));
      } catch {}
      return next;
    });
  }, []);

  // Window resize mousemove listener
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingSidebar) {
        const containerLeft = fileExplorerRef.current?.getBoundingClientRect().left ?? 0;
        const desiredWidth = e.clientX - containerLeft;
        const maxWidth = typeof window !== 'undefined' ? Math.min(600, Math.floor(window.innerWidth * 0.45)) : 500;
        const newWidth = Math.min(Math.max(desiredWidth, 160), maxWidth);
        setSidebarWidth(newWidth);
      } else if (isResizingDock) {
        const newHeight = window.innerHeight - e.clientY;
        const maxHeight = Math.floor(window.innerHeight * 0.75);
        setDockHeight(Math.min(Math.max(newHeight, 140), maxHeight));
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
  };
}
