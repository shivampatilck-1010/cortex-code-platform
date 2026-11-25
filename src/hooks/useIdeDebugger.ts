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

import type { TraceEvent } from '@/lib/visualization/types';

export interface UseIdeDebuggerOptions {
  code?: string;
  activeFileName?: string;
  language?: string;
  traceEvents?: TraceEvent[];
}

function findEnclosingFunction(lines: string[], targetLine: number): string {
  for (let i = Math.min(targetLine - 1, lines.length - 1); i >= 0; i--) {
    const trimmed = lines[i].trim();
    const match =
      trimmed.match(/^(?:async\s+)?def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/) ||
      trimmed.match(/^(?:async\s+)?function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/) ||
      trimmed.match(/^fn\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/) ||
      trimmed.match(/^func\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/) ||
      trimmed.match(/^(?:public|private|protected|static|\w+)+\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^;]*\)\s*\{/);
    if (match && match[1]) {
      return `${match[1]}()`;
    }
  }
  return 'module';
}

function extractVariablesUpToLine(lines: string[], targetLine: number): Record<string, string> {
  const vars: Record<string, string> = {};
  const limit = Math.min(targetLine, lines.length);
  for (let i = 0; i < limit; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue;
    const assignMatch = trimmed.match(
      /^(?:const|let|var|int|float|double|string|auto|mut)?\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(?::[^=]+)?=\s*([^;]+);?$/
    );
    if (assignMatch && assignMatch[1] && !['if', 'for', 'while', 'return'].includes(assignMatch[1])) {
      vars[assignMatch[1]] = assignMatch[2].trim().slice(0, 60);
    }
  }
  return vars;
}

export function useIdeDebugger(options: UseIdeDebuggerOptions = {}): UseIdeDebuggerReturn {
  const { code = '', activeFileName = 'active', language = 'plaintext', traceEvents } = options;
  const codeLines = useMemo(() => (code ? code.split('\n') : ['']), [code]);
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
    setActiveDebugLine((prev) => {
      const next = prev ? prev + 1 : 1;
      return next <= codeLines.length ? next : 1;
    });
  }, [codeLines.length]);

  const parsedDebugInfo = useMemo(() => {
    const currentLine = activeDebugLine || 1;
    if (traceEvents && traceEvents.length > 0) {
      const matchedIdx = traceEvents.findIndex((e) => e.line === currentLine);
      const limitIdx = matchedIdx >= 0 ? matchedIdx : traceEvents.length - 1;
      const traceVars: Record<string, string> = {};
      for (let i = 0; i <= limitIdx; i++) {
        const ev = traceEvents[i];
        if (ev?.variable?.name) {
          traceVars[ev.variable.name] =
            typeof ev.variable.value === 'string'
              ? ev.variable.value
              : JSON.stringify(ev.variable.value);
        }
      }
      const matchedEvent = traceEvents[limitIdx];
      return {
        variables: {
          FILE: activeFileName,
          LANGUAGE: language,
          LINE: String(matchedEvent?.line || currentLine),
          ...traceVars,
        },
        callStack:
          matchedEvent?.callStack && matchedEvent.callStack.length > 0
            ? matchedEvent.callStack.map((frame) => ({
                name: frame.name || 'frame',
                file: frame.file || activeFileName,
                line: frame.line || matchedEvent.line || currentLine,
              }))
            : [
                {
                  name: findEnclosingFunction(codeLines, currentLine),
                  file: activeFileName,
                  line: currentLine,
                },
              ],
      };
    }

    const scannedVars = extractVariablesUpToLine(codeLines, currentLine);
    return {
      variables: {
        FILE: activeFileName,
        LANGUAGE: language,
        LINE: `${currentLine} / ${codeLines.length}`,
        ...scannedVars,
      },
      callStack: [
        {
          name: findEnclosingFunction(codeLines, currentLine),
          file: activeFileName,
          line: currentLine,
        },
      ],
    };
  }, [activeDebugLine, activeFileName, language, codeLines, traceEvents]);

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
