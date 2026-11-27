'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Play, RotateCcw, Terminal, X } from 'lucide-react';
import { MonacoCodeEditor } from '@/components/editor/MonacoCodeEditor';
import { getLanguageConfig, SUPPORTED_LANGUAGES } from '@/config/languages';
import { executeInCloudSandbox } from '@/lib/execution/engine';
import type { ProjectFile } from '@/lib/execution/types';

interface SandboxDrawerProps {
  open: boolean;
  initialCode?: string;
  initialLanguage?: string;
  initialFilename?: string;
  isDarkMode: boolean;
  onClose: () => void;
}

export const SandboxDrawer: React.FC<SandboxDrawerProps> = ({
  open,
  initialCode,
  initialLanguage = 'python',
  initialFilename,
  isDarkMode,
  onClose,
}) => {
  const executableLangs = useMemo(
    () => SUPPORTED_LANGUAGES.filter((l) => l.executable !== false),
    []
  );

  const [langId, setLangId] = useState(initialLanguage);
  const langConfig = useMemo(() => getLanguageConfig(langId || 'python'), [langId]);

  const [filename, setFilename] = useState(
    initialFilename || `main${langConfig.fileExtension}`
  );
  const [code, setCode] = useState(initialCode ?? langConfig.starterCode ?? '');
  const [stdin, setStdin] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<{
    status: string;
    stdout: string;
    stderr: string;
    timeMs?: number;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    const targetCfg = getLanguageConfig(initialLanguage || 'python');
    setLangId(targetCfg.id);
    setFilename(initialFilename || `main${targetCfg.fileExtension}`);
    setCode(
      typeof initialCode === 'string' && initialCode.length > 0
        ? initialCode
        : targetCfg.starterCode || ''
    );
    setOutput(null);
  }, [open, initialCode, initialLanguage, initialFilename]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleLanguageSelect = (nextId: string) => {
    const nextCfg = getLanguageConfig(nextId);
    setLangId(nextCfg.id);
    setFilename(`main${nextCfg.fileExtension}`);
    setCode(nextCfg.starterCode || '');
    setOutput(null);
  };

  const handleRun = async () => {
    if (isRunning) return;
    setIsRunning(true);
    try {
      if (langConfig.id === 'sql') {
        const res = await fetch('/api/v1/sql/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: 'demo_sql_project',
            query: code,
            dialect: 'sqlite',
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const rows: unknown[][] = Array.isArray(data?.result?.rows)
            ? data.result.rows
            : [];
          const formattedRows = rows
            .map((r) => r.map((v) => (v === null || v === undefined ? 'NULL' : String(v))).join(' | '))
            .join('\n');
          setOutput({
            status: data?.result?.error ? 'error' : 'success',
            stdout: formattedRows || (data?.result?.error ? '' : '(Query executed successfully)'),
            stderr: data?.result?.error || '',
            timeMs: data?.result?.executionTimeMs ?? 0,
          });
          return;
        }
      }

      const file: ProjectFile = {
        id: 'sandbox-drawer-file',
        name: filename,
        path: `/${filename}`,
        content: code,
        isFolder: false,
      };
      const res = await executeInCloudSandbox({
        language: langConfig.id,
        files: [file],
        entrypoint: filename,
        stdin,
      });
      setOutput({
        status: res.status,
        stdout: res.stdout || '',
        stderr: res.stderr || '',
        timeMs: res.executionTimeMs,
      });
    } catch (err) {
      setOutput({
        status: 'error',
        stdout: '',
        stderr: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsRunning(false);
    }
  };

  const editorFiles = useMemo<ProjectFile[]>(
    () => [
      {
        id: 'sandbox-drawer-file',
        name: filename,
        path: `/${filename}`,
        content: code,
        isFolder: false,
      },
    ],
    [filename, code]
  );

  if (!open) return null;

  return (
    <div
      data-testid="sandbox-drawer-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex justify-end"
    >
      <aside
        data-testid="sandbox-drawer"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[680px] h-full bg-white dark:bg-[#21242B] border-l border-[#E2E8F0] dark:border-white/[0.08] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Drawer Header */}
        <div className="h-[54px] px-4 border-b border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#21242B] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Terminal className="w-4 h-4 text-[#F3912E] shrink-0" />
            <span className="text-[14px] font-bold text-[#0F172A] dark:text-white truncate">
              IDE Sandbox
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-[#1A1D24] border border-[#E2E8F0] dark:border-white/[0.08] font-mono text-[11px] text-slate-600 dark:text-zinc-300 truncate">
              {filename}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/ide"
              className="h-8 px-2.5 rounded-lg text-[12px] font-medium bg-[#F1F5F9] dark:bg-[#1A1D24] border border-[#E2E8F0] dark:border-white/[0.1] hover:border-[#F3912E] text-[#0F172A] dark:text-zinc-200 inline-flex items-center gap-1.5 transition-colors"
            >
              <span>Full IDE</span>
              <ExternalLink className="w-3 h-3 opacity-75" />
            </Link>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close IDE Sandbox"
              data-testid="close-sandbox-drawer"
              className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[#64748B] dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="h-11 px-4 border-b border-[#E2E8F0] dark:border-white/[0.08] bg-[#F1F5F9] dark:bg-[#1A1D24] flex items-center justify-between gap-3 shrink-0">
          <select
            value={langConfig.id}
            onChange={(e) => handleLanguageSelect(e.target.value)}
            aria-label="Sandbox language"
            className="h-8 px-2.5 rounded-md text-[12.5px] font-medium bg-white dark:bg-[#22252C] text-[#0F172A] dark:text-zinc-100 border border-[#E2E8F0] dark:border-white/[0.1] focus:border-[#F3912E] focus:outline-none"
          >
            {executableLangs.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCode(initialCode ?? langConfig.starterCode ?? '');
                setOutput(null);
              }}
              className="h-8 px-3 rounded-md text-[12px] font-medium bg-white dark:bg-[#22252C] border border-[#E2E8F0] dark:border-white/[0.1] text-[#0F172A] dark:text-zinc-200 hover:border-[#F3912E] inline-flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            <button
              type="button"
              disabled={isRunning}
              onClick={() => void handleRun()}
              data-testid="sandbox-run-btn"
              className="h-8 px-4 rounded-md text-[12.5px] font-semibold bg-[#F3912E] hover:bg-[#E07D19] text-white disabled:opacity-50 inline-flex items-center gap-1.5 transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isRunning ? 'Running...' : 'Run'}</span>
            </button>
          </div>
        </div>

        {/* Monaco Editor */}
        <div className="flex-1 min-h-[260px] relative border-b border-[#E2E8F0] dark:border-white/[0.08]">
          <MonacoCodeEditor
            files={editorFiles}
            activeFileId={editorFiles[0].id}
            onSelectFile={() => {}}
            onCloseFile={() => {}}
            onContentChange={setCode}
            language={langConfig.monacoLang}
            theme={isDarkMode ? 'cs-dark' : 'cortex-light'}
            fontSize={13}
            breakpoints={[]}
            onToggleBreakpoint={() => {}}
            isDarkMode={isDarkMode}
            hideChrome
            showMinimap={false}
          />
        </div>

        {/* Stdin + Console Output */}
        <div className="h-[220px] shrink-0 bg-[#F4F6F9] dark:bg-[#12141A] grid grid-cols-1 sm:grid-cols-3 border-t border-[#E2E8F0] dark:border-white/[0.07]">
          <div className="p-3 border-b sm:border-b-0 sm:border-r border-[#E2E8F0] dark:border-white/[0.07] flex flex-col gap-1.5">
            <label
              htmlFor="sandbox-stdin-input"
              className="text-[11px] font-mono uppercase tracking-wider text-[#64748B] dark:text-zinc-400 font-semibold"
            >
              Stdin Input
            </label>
            <textarea
              id="sandbox-stdin-input"
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              placeholder="Optional input..."
              className="flex-1 w-full resize-none rounded-md p-2 font-mono text-[12px] bg-white dark:bg-[#1A1D24] text-[#0F172A] dark:text-zinc-200 border border-[#E2E8F0] dark:border-white/[0.08] focus:border-[#F3912E] focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2 p-3 flex flex-col gap-1.5 overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#64748B] dark:text-zinc-400 font-semibold">
                Console Output
              </span>
              {output?.timeMs !== undefined && (
                <span className="text-[11px] font-mono text-[#64748B] dark:text-zinc-400">
                  {output.timeMs}ms
                </span>
              )}
            </div>
            <pre
              data-testid="sandbox-console-output"
              className="flex-1 overflow-auto rounded-md p-2.5 font-mono text-[12px] leading-relaxed bg-white dark:bg-[#1A1D24] border border-[#E2E8F0] dark:border-white/[0.08] text-[#0F172A] dark:text-zinc-200 whitespace-pre-wrap"
            >
              {output
                ? [
                    output.stdout ? output.stdout : '',
                    output.stderr ? `STDERR:\n${output.stderr}` : '',
                  ]
                    .filter(Boolean)
                    .join('\n') || '(No output)'
                : 'Click Run to execute code in Cortex sandbox...'}
            </pre>
          </div>
        </div>
      </aside>
    </div>
  );
};
