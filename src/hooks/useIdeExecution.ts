'use client';

import { useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { ProjectFile, ExecutionResult, TestCase, BenchmarkMetrics } from '@/lib/execution/types';
import { LanguageConfig, getLanguageConfig } from '@/config/languages';
import { detectLanguage } from '@/lib/editor/language-detector';
import { executeInCloudSandbox, runTestCases, benchmarkExecution } from '@/lib/execution/engine';
import { formatSqlResultsToAsciiTable } from '@/lib/sql/formatter';
import { TraceSession } from '@/lib/visualization/types';
import { AIFixResult } from '@/lib/ai/assistant';

export interface UseIdeExecutionOptions {
  projectId: string | null;
  files: ProjectFile[];
  activeFile: ProjectFile | null;
  activeFileId: string;
  currentLang: LanguageConfig;
  onContentChange: (newCode: string) => void;
  onForceSave: () => Promise<void>;
  onActivateTab: (tab: 'output' | 'terminal' | 'tests' | 'ai' | 'debug' | 'preview') => void;
  onOpenBottom: () => void;
}

export function useIdeExecution({
  projectId,
  files,
  activeFile,
  activeFileId,
  currentLang,
  onContentChange,
  onForceSave,
  onActivateTab,
  onOpenBottom,
}: UseIdeExecutionOptions) {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [customStdin, setCustomStdin] = useState<string>('');

  const [testCases, setTestCases] = useState<TestCase[]>([
    { id: '1', name: 'Sample Case 1', stdin: '', expectedStdout: 'Hello, World!' },
    { id: '2', name: 'Sample Case 2', stdin: 'test input', expectedStdout: '' },
  ]);
  const [isRunningTests, setIsRunningTests] = useState<boolean>(false);

  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkMetrics | null>(null);
  const [traceSession, setTraceSession] = useState<TraceSession | null>(null);
  const [isTracing, setIsTracing] = useState<boolean>(false);

  const [previousCodeSnapshot, setPreviousCodeSnapshot] = useState<string | null>(null);

  const handleRun = useCallback(async () => {
    // Resolve the active file to execute
    const currentActive = files.find((f) => f.id === activeFileId && !f.isFolder) || activeFile;
    if (!currentActive) return;

    // Detect accurate language from active file's name and buffer
    const activeFileLangId = detectLanguage(
      currentActive.name,
      currentActive.content,
      undefined,
      currentLang.id
    );
    const executionLang = getLanguageConfig(activeFileLangId) || currentLang;

    if (executionLang.executable === false) {
      setExecutionResult({
        status: 'system_error',
        exitCode: 1,
        stdout: '',
        stderr: `Language "${executionLang.name}" is a documentation or data format and cannot be executed as a standalone program.`,
        executionTimeMs: 0,
        memoryUsageMb: 0,
        diagnostics: [],
        timestamp: new Date().toISOString(),
        provider: 'cloud_sandbox',
      });
      onActivateTab('output');
      onOpenBottom();
      return;
    }

    if (executionLang.id === 'html' || executionLang.id === 'css') {
      onActivateTab('preview');
      onOpenBottom();
      return;
    }

    if (executionLang.id === 'sql') {
      setIsRunning(true);
      onActivateTab('output');
      onOpenBottom();
      try {
        await onForceSave();
        const res = await fetch('/api/v1/sql/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: projectId || 'demo_sql_project',
            query: currentActive.content,
            dialect: 'sqlite',
          }),
        });
        const data = await res.json();
        if (data.result) {
          const { columns, rows, executionTimeMs, error, warning } = data.result;
          if (error) {
            setExecutionResult({
              status: 'runtime_error',
              exitCode: 1,
              stdout: '',
              stderr: error,
              executionTimeMs,
              memoryUsageMb: 1,
              diagnostics: [],
              timestamp: new Date().toISOString(),
              provider: 'cloud_sandbox',
            });
          } else {
            let formatted = formatSqlResultsToAsciiTable(columns, rows);
            if (warning) {
              formatted = `[Dialect Info] ${warning}\n\n` + formatted;
            }
            setExecutionResult({
              status: 'success',
              exitCode: 0,
              stdout: formatted,
              stderr: '',
              executionTimeMs,
              memoryUsageMb: 2,
              diagnostics: [],
              timestamp: new Date().toISOString(),
              provider: 'cloud_sandbox',
            });
          }
        } else {
          setExecutionResult({
            status: 'runtime_error',
            exitCode: 1,
            stdout: '',
            stderr: data.error || 'SQL query execution failed',
            executionTimeMs: 0,
            memoryUsageMb: 0,
            diagnostics: [],
            timestamp: new Date().toISOString(),
            provider: 'cloud_sandbox',
          });
        }
      } catch (err: any) {
        setExecutionResult({
          status: 'runtime_error',
          exitCode: 1,
          stdout: '',
          stderr: err.message || 'SQL execution failed',
          executionTimeMs: 0,
          memoryUsageMb: 0,
          diagnostics: [],
          timestamp: new Date().toISOString(),
          provider: 'cloud_sandbox',
        });
      } finally {
        setIsRunning(false);
      }
      return;
    }

    setIsRunning(true);
    onActivateTab('output');
    onOpenBottom();

    try {
      const syncedFiles = files.map((f) =>
        f.id === currentActive.id ? { ...f, content: currentActive.content } : f
      );

      const res = await executeInCloudSandbox({
        projectId: projectId || undefined,
        language: executionLang.id,
        files: syncedFiles,
        entrypoint: currentActive.name,
        stdin: customStdin,
      });

      setExecutionResult(res);
    } finally {
      setIsRunning(false);
    }
  }, [
    activeFile,
    activeFileId,
    currentLang,
    files,
    customStdin,
    projectId,
    onForceSave,
    onActivateTab,
    onOpenBottom,
  ]);

  const handleRunAllTests = useCallback(async () => {
    if (!activeFile) return;
    const detectedLangId = detectLanguage(activeFile.name, activeFile.content, undefined, currentLang.id);
    const targetLang = getLanguageConfig(detectedLangId) || currentLang;
    setIsRunningTests(true);
    try {
      const syncedFiles = files.map((f) =>
        f.id === activeFileId ? { ...f, content: activeFile.content } : f
      );

      const { testCases: evaluated, passedCount, totalCount } = await runTestCases(
        {
          projectId: projectId || undefined,
          language: targetLang.id,
          files: syncedFiles,
          entrypoint: activeFile.name,
        },
        testCases
      );
      setTestCases(evaluated);

      if (passedCount === totalCount && totalCount > 0) {
        confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
      }
    } finally {
      setIsRunningTests(false);
    }
  }, [activeFile, activeFileId, currentLang, files, projectId, testCases]);

  const handleRunBenchmark = useCallback(async () => {
    if (!activeFile) return;
    const detectedLangId = detectLanguage(activeFile.name, activeFile.content, undefined, currentLang.id);
    const targetLang = getLanguageConfig(detectedLangId) || currentLang;
    const syncedFiles = files.map((f) =>
      f.id === activeFileId ? { ...f, content: activeFile.content } : f
    );

    const res = await benchmarkExecution({
      projectId: projectId || undefined,
      language: targetLang.id,
      files: syncedFiles,
      entrypoint: activeFile.name,
    });
    setBenchmarkResult(res);
  }, [activeFile, activeFileId, currentLang, files, projectId]);

  const handleRunTrace = useCallback(async () => {
    if (isTracing || !activeFile) return;
    const detectedLangId = detectLanguage(activeFile.name, activeFile.content, undefined, currentLang.id);
    const targetLang = getLanguageConfig(detectedLangId) || currentLang;
    setIsTracing(true);
    try {
      const activeContent = activeFile.content || '';
      const currentFiles = files.map((f) =>
        f.id === activeFileId ? { ...f, content: activeContent } : f
      );
      const res = await fetch('/api/v1/visualize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: targetLang.id,
          files: currentFiles,
          entrypoint: activeFile.name,
          stdin: customStdin,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.session) {
          setTraceSession(data.session);
        }
      }
    } catch (err) {
      console.error('Visualization error:', err);
    } finally {
      setIsTracing(false);
    }
  }, [activeFile, activeFileId, currentLang.id, files, customStdin, isTracing]);

  const applyFixAndReverify = useCallback(
    async (fixToApply: AIFixResult) => {
      if (!activeFile) return;
      setPreviousCodeSnapshot(activeFile.content);
      onContentChange(fixToApply.fixedCode);

      setIsRunning(true);
      try {
        const detectedLangId = detectLanguage(activeFile.name, fixToApply.fixedCode, undefined, currentLang.id);
        const targetLang = getLanguageConfig(detectedLangId) || currentLang;

        const updatedFiles = files.map((f) =>
          f.id === activeFileId ? { ...f, content: fixToApply.fixedCode } : f
        );
        const retestRes = await executeInCloudSandbox({
          projectId: projectId || undefined,
          language: targetLang.id,
          files: updatedFiles,
          entrypoint: activeFile.name,
          stdin: customStdin,
        });

        setExecutionResult(retestRes);
      } finally {
        setIsRunning(false);
      }
    },
    [activeFile, activeFileId, currentLang, files, customStdin, projectId, onContentChange]
  );

  const handleUndoFix = useCallback(() => {
    if (previousCodeSnapshot) {
      onContentChange(previousCodeSnapshot);
      setPreviousCodeSnapshot(null);
    }
  }, [previousCodeSnapshot, onContentChange]);

  return {
    isRunning,
    setIsRunning,
    executionResult,
    setExecutionResult,
    customStdin,
    setCustomStdin,
    testCases,
    setTestCases,
    isRunningTests,
    benchmarkResult,
    setBenchmarkResult,
    traceSession,
    setTraceSession,
    isTracing,
    handleRun,
    handleRunAllTests,
    handleRunBenchmark,
    handleRunTrace,
    applyFixAndReverify,
    handleUndoFix,
    previousCodeSnapshot,
  };
}
