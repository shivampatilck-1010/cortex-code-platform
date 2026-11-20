'use client';

import { useState, useCallback, useMemo } from 'react';

export interface UseIdeDebuggerReturn {
  isDebugging: boolean;
  setIsDebugging: React.Dispatch<React.SetStateAction<boolean>>;
  breakpoints: number[];
  setBreakpoints: React.Dispatch<React.SetStateAction<number[]>>;
  activeDebugLine?: number;
  setActiveDebugLine: React.Dispatch<React.SetStateAction<number | undefined>>;
  toggleBreakpoint: (line: number) => void;
  startDebug: (onActivateDebugTab?: () => void) => void;
  stopDebug: () => void;
  stepOver: () => void;
  parsedDebugInfo: {
    variables: Record<string, string>;
    callStack: { name: string; file: string; line: number }[];
  };
}

export function useIdeDebugger(): UseIdeDebuggerReturn {
  const [isDebugging, setIsDebugging] = useState<boolean>(false);
  const [breakpoints, setBreakpoints] = useState<number[]>([]);
  const [activeDebugLine, setActiveDebugLine] = useState<number | undefined>(undefined);

  const toggleBreakpoint = useCallback((line: number) => {
    setBreakpoints((prev) =>
      prev.includes(line) ? prev.filter((l) => l !== line) : [...prev, line]
    );
  }, []);

  const startDebug = useCallback((onActivateDebugTab?: () => void) => {
    setIsDebugging(true);
    setActiveDebugLine(breakpoints[0] || 1);
    if (onActivateDebugTab) {
      onActivateDebugTab();
    }
  }, [breakpoints]);

  const stopDebug = useCallback(() => {
    setIsDebugging(false);
    setActiveDebugLine(undefined);
  }, []);

  const stepOver = useCallback(() => {
    setActiveDebugLine((prev) => (prev ? prev + 1 : 1));
  }, []);

  const parsedDebugInfo = useMemo(() => {
    return {
      variables: {
        STATUS: 'SIMULATED',
        INFO: 'Breakpoints evaluated via trace emulator.',
      },
      callStack: [{ name: 'main()', file: 'active', line: activeDebugLine || 1 }],
    };
  }, [activeDebugLine]);

  return {
    isDebugging,
    setIsDebugging,
    breakpoints,
    setBreakpoints,
    activeDebugLine,
    setActiveDebugLine,
    toggleBreakpoint,
    startDebug,
    stopDebug,
    stepOver,
    parsedDebugInfo,
  };
}
