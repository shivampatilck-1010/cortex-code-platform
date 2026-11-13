'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type ThemeMode = 'dark' | 'light';

interface ThemeContextValue {
  theme: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  isDark: false,
  toggleTheme: () => {},
  setTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem('cortex-theme') as ThemeMode | null;
      if (storedTheme === 'dark' || storedTheme === 'light') {
        setThemeState(storedTheme);
        document.documentElement.classList.toggle('dark', storedTheme === 'dark');
      } else {
        const initialTheme: ThemeMode = 'light';
        setThemeState(initialTheme);
        document.documentElement.classList.toggle('dark', false);
      }
    } catch {
      // Fallback for sandboxed or SSR environments: default light
      document.documentElement.classList.remove('dark');
    }
    setMounted(true);
  }, []);

  const setTheme = (nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
    try {
      localStorage.setItem('cortex-theme', nextTheme);
    } catch {
      // Ignored if storage is restricted
    }
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', nextTheme === 'dark');
    }
  };

  const toggleTheme = () => {
    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  const value: ThemeContextValue = {
    theme,
    isDark: theme === 'dark',
    toggleTheme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
