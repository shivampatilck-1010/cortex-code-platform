'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Terminal as TermIcon, 
  CheckSquare, 
  Sparkles, 
  Bug, 
  Globe, 
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
  Maximize2,
  Minimize2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AppShell } from '@/components/layout/AppShell';
import { Navbar } from '@/components/layout/Navbar';
import { MonacoCodeEditor } from '@/components/editor/MonacoCodeEditor';
import { CodeVisualizationWorkspace } from '@/components/visualization/CodeVisualizationWorkspace';
import { TraceSession } from '@/lib/visualization/types';
import { FileExplorer } from '@/components/sidebar/FileExplorer';
import { BenchmarkSidebar } from '@/components/sidebar/BenchmarkSidebar';
import { LearnSidebar } from '@/components/sidebar/LearnSidebar';
import { PracticeHub } from '@/components/practice/PracticeHub';
import {
  PracticeBottomTab,
  PracticeWorkspace,
  PracticeWorkspaceResultSummary,
} from '@/components/practice/PracticeWorkspace';
import {
  PracticeSubmissionRecord,
  ProblemDetailsPanel,
} from '@/components/panels/ProblemDetailsPanel';
import { usePracticeProgress } from '@/components/practice/usePracticeProgress';
import { Challenge, CHALLENGES } from '@/lib/challenges/challenges-data';
import { OutputPanel } from '@/components/panels/OutputPanel';
import { TerminalPanel } from '@/components/panels/TerminalPanel';
import { TestCasesPanel } from '@/components/panels/TestCasesPanel';
import { AIAssistantPanel } from '@/components/panels/AIAssistantPanel';
import { DebuggerPanel } from '@/components/panels/DebuggerPanel';
import { WebPreviewPanel } from '@/components/panels/WebPreviewPanel';
import { DiffModal } from '@/components/modals/DiffModal';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { ShareModal } from '@/components/modals/ShareModal';
import { FeedbackModal } from '@/components/modals/FeedbackModal';
import { SUPPORTED_LANGUAGES, LanguageConfig, getLanguageConfig } from '@/config/languages';
import { ProjectFile, ExecutionResult, TestCase, BenchmarkMetrics } from '@/lib/execution/types';
import { executeInCloudSandbox, runTestCases, benchmarkExecution, parseDiagnostics } from '@/lib/execution/engine';
import { 
  AISettings, 
  DEFAULT_AI_SETTINGS, 
  AIFixResult, 
  analyzeAndFixErrorOffline, 
  autoFixWithGeminiOrOffline,
  analyzeCode, 
  convertCode,
  AIAnalysisResult 
} from '@/lib/ai/assistant';
import { CollaborationBroker, Collaborator } from '@/lib/collaboration/broker';
import { detectLanguage, detectLanguageFromFilename, getMonacoLanguage } from '@/lib/editor/language-detector';
import { zipSync, strToU8 } from 'fflate';
import { formatSqlResultsToAsciiTable } from '@/lib/sql/formatter';
import { useIdeLayout, useIdeDebugger } from '@/hooks';
import { getStarterContentForFile } from '@/hooks/useIdeFiles';
import { getGuestSqlProjectId } from '@/lib/sql/guest-session';
import { Badge } from '@/components/ui/Badge';
import { triggerThemeRippleTransition } from '@/lib/theme/ripple-transition';

const getMonacoLangForFile = (filename: string, defaultMonacoLang: string): string => {
  const detected = getMonacoLanguage(filename);
  return (detected && detected !== 'plaintext') ? detected : (getMonacoLanguage(defaultMonacoLang) || defaultMonacoLang);
};

class IdeErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[IdeErrorBoundary] Uncaught IDE error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#0d0e11] p-6 text-center text-white font-mono">
          <div className="max-w-md rounded-xl border border-white/10 bg-[#16181d] p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-[#FF9100]">IDE Session Recovery</h2>
            <p className="mt-2 text-xs text-zinc-400">
              An unexpected client error occurred in the workspace. Your code in local cache is safe.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="rounded-lg bg-[#FF9100] px-4 py-2 text-xs font-bold text-black hover:bg-[#ffaa33]"
              >
                Reset Workspace
              </button>
              <button
                onClick={() => window.location.reload()}
                className="rounded-lg border border-white/20 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10"
              >
                Reload Window
              </button>
              <a
                href="/"
                className="rounded-lg border border-white/20 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10"
              >
                Return to Home
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function CloudIDEPageInner() {
  const router = useRouter();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isProjectLoading, setIsProjectLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchProject = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('projectId');
        const challengeParam = urlParams.get('challenge');
        const challengeQuerySuffix = challengeParam ? `&challenge=${encodeURIComponent(challengeParam)}` : '';

        const loadAndHydrateProject = async (targetId: string): Promise<'ok' | 'unauth' | 'missing'> => {
          const res = await fetch(`/api/v1/projects/${targetId}`);
          if (res.ok) {
            const data = await res.json();
            if (mounted && data?.project) {
              setProjectId(data.project.id);
              if (Array.isArray(data.files) && data.files.length > 0) {
                setFiles(data.files);
                data.files.forEach((f: any) => {
                  if (f.updatedAt) lastFetchTimestampRef.current[f.id] = f.updatedAt;
                });
                const main = data.files.find((f: any) => !f.isFolder) || data.files[0];
                let languageConfigured = false;
                if (main) {
                  setActiveFileId(main.id);
                  setOpenFileIds([main.id]);
                  const detected = detectLanguage(main.name, main.content, undefined, data.project?.language);
                  const conf = getLanguageConfig(detected);
                  if (conf) {
                    setCurrentLang(conf);
                    languageConfigured = true;
                  }
                } else {
                  setActiveFileId('');
                  setOpenFileIds([]);
                }
                if (!languageConfigured) {
                  const targetLang = SUPPORTED_LANGUAGES.find(l => l.id === data.project.language);
                  if (targetLang) setCurrentLang(targetLang);
                }
              } else {
                if (Array.isArray(data.files)) {
                  setFiles([]);
                  setActiveFileId('');
                  setOpenFileIds([]);
                }
                const targetLang = SUPPORTED_LANGUAGES.find(l => l.id === data.project.language);
                if (targetLang) setCurrentLang(targetLang);
              }
            }
            return 'ok';
          }
          if (res.status === 401) {
            return 'unauth';
          }
          return 'missing';
        };

        const resolveOrCreateDefaultProject = async () => {
          const res = await fetch('/api/v1/projects');
          if (!res.ok) return;
          const data = await res.json();
          let targetId: string | null = null;
          if (Array.isArray(data?.projects) && data.projects.length > 0) {
            targetId = data.projects[0].id;
          } else {
            const pRes = await fetch('/api/v1/projects', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: 'Default Project', language: 'python' })
            });
            if (pRes.ok) {
              const pData = await pRes.json();
              targetId = pData?.project?.id || null;
            }
          }
          if (targetId) {
            router.replace(`/ide?projectId=${targetId}${challengeQuerySuffix}`);
            await loadAndHydrateProject(targetId);
          }
        };

        if (id) {
          const status = await loadAndHydrateProject(id);
          if (status === 'unauth') {
            // Unauthenticated: preserve projectId and route to login
            const returnUrl = `/ide?projectId=${encodeURIComponent(id)}${challengeQuerySuffix}`;
            router.replace(`/login?redirect=${encodeURIComponent(returnUrl)}`);
            return;
          }
          if (status === 'missing') {
            // Bad ID or not found, strip it and hydrate default project
            router.replace(challengeParam ? `/ide?challenge=${encodeURIComponent(challengeParam)}` : '/ide');
            await resolveOrCreateDefaultProject();
          }
        } else {
          await resolveOrCreateDefaultProject();
        }
      } finally {
        if (mounted) setIsProjectLoading(false);
      }
    };
    fetchProject();
    return () => { mounted = false; };
  }, [router]);

  // 1. Language & Files State
  const [currentLang, setCurrentLang] = useState<LanguageConfig>(SUPPORTED_LANGUAGES[0]); // Python default
  const [files, setFiles] = useState<ProjectFile[]>([
    {
      id: 'main',
      name: SUPPORTED_LANGUAGES[0].defaultFileName,
      path: `/${SUPPORTED_LANGUAGES[0].defaultFileName}`,
      content: SUPPORTED_LANGUAGES[0].starterCode,
    },
    {
      id: 'readme',
      name: 'README.md',
      path: '/README.md',
      content: `# Cortex — Code Beyond Limits\n**COMPILE | CREATE | COLLABORATE | DEPLOY**\n\nFast multi-language cloud development & sandbox environment across 16+ runtimes with autonomous AI Auto-Fix.\n\nPress **Ctrl+Enter** to compile & execute code.`,
    },
  ]);
  const [openFileIds, setOpenFileIds] = useState<string[]>(['main', 'readme']);
  const [activeFileId, setActiveFileId] = useState('main');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'conflict'>('saved');
  const [fileLanguageOverrides, setFileLanguageOverrides] = useState<Record<string, string>>({});
  const lastFetchTimestampRef = useRef<Record<string, number>>({});

  const syncTimestampFromPatch = useCallback(async (fileId: string, res: Response) => {
    if (!res.ok) return;
    try {
      const data = await res.json();
      if (data?.file?.updatedAt) {
        lastFetchTimestampRef.current[fileId] = data.file.updatedAt;
        setSaveStatus('saved');
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cortex_file_language_overrides');
        if (stored) {
          setFileLanguageOverrides(JSON.parse(stored));
        }
      } catch {}
    }
  }, []);

  // 2. Execution & Diagnostics State
  const [isRunning, setIsRunning] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [customStdin, setCustomStdin] = useState('');
  const [testCases, setTestCases] = useState<TestCase[]>([
    {
      id: 'tc-sample-1',
      name: 'Sample Output Validation',
      stdin: '',
      expectedStdout: 'Squares: [1, 4, 9, 16, 25]',
      isHidden: false,
    },
  ]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkMetrics | null>(null);
  const {
    progressMap: practiceProgress,
    markAttempted: markProblemAttempted,
    markSolved: markProblemSolved,
  } = usePracticeProgress();
  const [activePracticeChallenge, setActivePracticeChallenge] = useState<Challenge | null>(null);
  const [isProblemPanelOpen, setIsProblemPanelOpen] = useState<boolean>(false);
  const [isPracticeLeftMaximized, setIsPracticeLeftMaximized] = useState<boolean>(false);
  const [practiceCursorPos, setPracticeCursorPos] = useState<{ line: number; col: number }>({
    line: 1,
    col: 1,
  });
  const [practiceFontSize, setPracticeFontSize] = useState<number>(13);
  const [practiceTabSize, setPracticeTabSize] = useState<number>(4);
  const [practiceBottomTab, setPracticeBottomTab] = useState<PracticeBottomTab>('testcase');
  const [practiceActiveCaseIdx, setPracticeActiveCaseIdx] = useState<number>(0);
  const [practiceLastResult, setPracticeLastResult] =
    useState<PracticeWorkspaceResultSummary | null>(null);
  const [practiceConsoleOutput, setPracticeConsoleOutput] = useState<string>('');
  const [practiceRunningMode, setPracticeRunningMode] = useState<'run' | 'submit' | null>(null);
  const [practiceSubmissionsByChallenge, setPracticeSubmissionsByChallenge] = useState<
    Record<string, PracticeSubmissionRecord[]>
  >({});
  const practiceFormatFnRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedSubRaw = localStorage.getItem('cortex_practice_submissions_v1');
      if (savedSubRaw) {
        const parsed = JSON.parse(savedSubRaw);
        if (parsed && typeof parsed === 'object') {
          setPracticeSubmissionsByChallenge(parsed);
        }
      }
      const savedFontRaw = localStorage.getItem('cortex_practice_font_size');
      if (savedFontRaw) {
        const parsedFont = parseInt(savedFontRaw, 10);
        if ([12, 13, 14].includes(parsedFont)) {
          setPracticeFontSize(parsedFont);
        }
      }
      const savedTabRaw = localStorage.getItem('cortex_practice_tab_size');
      if (savedTabRaw) {
        const parsedTab = parseInt(savedTabRaw, 10);
        if ([2, 4].includes(parsedTab)) {
          setPracticeTabSize(parsedTab);
        }
      }
    } catch {}
  }, []);

  // 3. Extracted Modular State Management Hooks
  const {
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
  } = useIdeLayout();

  const [traceSession, setTraceSession] = useState<TraceSession | null>(null);
  const [isTracing, setIsTracing] = useState<boolean>(false);

  const activeDebugTargetFile = files.find((f) => f.id === activeFileId && !f.isFolder);
  const {
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
  } = useIdeDebugger({
    code: activeDebugTargetFile?.content,
    activeFileName: activeDebugTargetFile?.name,
    language: currentLang?.id,
    traceEvents: traceSession?.events,
  });

  // 5. AI Assistant & Auto-Fix State
  const [aiSettings, setAiSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [analysisMode, setAnalysisMode] = useState<'explain' | 'optimize' | 'refactor' | null>(null);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [fixResult, setFixResult] = useState<AIFixResult | null>(null);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [isQuickFixOpen, setIsQuickFixOpen] = useState(false);
  const [isAnalyzingFix, setIsAnalyzingFix] = useState(false);
  const [previousCodeSnapshot, setPreviousCodeSnapshot] = useState<string | null>(null);
  const [enableInlineSuggestions, setEnableInlineSuggestions] = useState(false);

  // Load saved Gemini API Key and inline suggestions setting from browser storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem('cortex_gemini_api_key');
      if (savedKey) {
        setAiSettings((prev) => ({ ...prev, apiKey: savedKey, provider: 'gemini' }));
      }
      const savedSuggestions = localStorage.getItem('cortex_inline_suggestions');
      if (savedSuggestions === 'true') {
        setEnableInlineSuggestions(true);
        setAiSettings((prev) => ({ ...prev, enableInlineSuggestions: true }));
      }
    }
  }, []);

  const handleToggleInlineSuggestions = () => {
    setEnableInlineSuggestions((prev) => {
      const next = !prev;
      setAiSettings((s) => ({ ...s, enableInlineSuggestions: next }));
      if (typeof window !== 'undefined') {
        localStorage.setItem('cortex_inline_suggestions', String(next));
      }
      return next;
    });
  };

  // 6. Settings & Share Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [theme, setTheme] = useState('cortex-dark');

  // Trigger Monaco layout recalculation on layout mode or dock/sidebar dimension change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const timer = setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [editorLayoutMode, sidebarWidth, isBottomCollapsed, isSidebarOpen, activeSidebarTab, isProblemPanelOpen]);

  // Fullscreen Keyboard Listeners (F11 / Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        setIsFullscreen((prev) => !prev);
      } else if (e.key === 'Escape' && isFullscreen) {
        e.preventDefault();
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Synchronize document dark class with active theme on initial load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('cortex_ide_theme');
      if (savedTheme === 'light') {
        setIsDarkMode(false);
        setTheme('cortex-light');
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
      }
    }
  }, []);

  const handleThemeChange = (newTheme: string) => {
    const normalizedTheme =
      newTheme === 'light'
        ? 'cortex-light'
        : newTheme === 'vs-dark'
          ? 'cortex-dark'
          : newTheme;
    const nextDark = normalizedTheme !== 'cortex-light';
    setTheme(normalizedTheme);
    setIsDarkMode(nextDark);
    if (typeof document !== 'undefined') {
      if (nextDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('cortex_ide_theme', nextDark ? 'dark' : 'light');
    }
  };

  const handleToggleDarkMode = (coords?: { x: number; y: number }) => {
    const originX = coords?.x ?? (typeof window !== 'undefined' ? window.innerWidth / 2 : 0);
    const originY = coords?.y ?? (typeof window !== 'undefined' ? window.innerHeight / 2 : 0);
    const targetTheme = isDarkMode ? 'light' : 'dark';

    triggerThemeRippleTransition(originX, originY, targetTheme, () => {
      setIsDarkMode((prev) => {
        const next = !prev;
        setTheme(next ? 'cortex-dark' : 'cortex-light');
        if (typeof document !== 'undefined') {
          if (next) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
        if (typeof window !== 'undefined') {
          localStorage.setItem('cortex_ide_theme', next ? 'dark' : 'light');
        }
        return next;
      });
    });
  };

  // 8. Collaboration Broker
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const collabBrokerRef = useRef<CollaborationBroker | null>(null);

  // Initialize Real-time Collaboration
  useEffect(() => {
    let initialCollabUser: { id?: string; name?: string; avatar?: string } = { name: 'Guest' };
    if (typeof window !== 'undefined') {
      try {
        const storedUser = localStorage.getItem('cortex_user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          if (parsed?.name) {
            initialCollabUser = {
              id: parsed.id,
              name: parsed.name,
              avatar: parsed.avatar,
            };
          }
        }
      } catch {
        // ignore invalid stored user payload
      }
    }
    const broker = new CollaborationBroker(initialCollabUser);
    collabBrokerRef.current = broker;
    let isCancelled = false;
    fetch('/api/v1/auth/me', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isCancelled && data?.user) {
          broker.updateUser({
            id: data.user.id,
            name: data.user.name,
            avatar: data.user.avatar,
          });
        }
      })
      .catch(() => {});
    const unsub = broker.subscribe((list) => {
      setCollaborators(list);
    });
    return () => {
      isCancelled = true;
      unsub();
      broker.destroy();
    };
  }, []);

  const openFiles = useMemo(() => {
    return files.filter((f) => !f.isFolder && openFileIds.includes(f.id));
  }, [files, openFileIds]);

  const activeFile = useMemo(() => {
    return files.find((f) => f.id === activeFileId && !f.isFolder && openFileIds.includes(f.id))
      || openFiles[0]
      || null;
  }, [files, activeFileId, openFileIds, openFiles]);

  // Auto-Save / Content Update
  const saveFileRef = useRef<NodeJS.Timeout | null>(null);

  const handleForceSave = useCallback(async () => {
    if (!projectId || !activeFileId) return;
    if (saveFileRef.current) clearTimeout(saveFileRef.current);
    setSaveStatus('saving');
    try {
      const curFile = files.find(f => f.id === activeFileId);
      const res = await fetch(`/api/v1/projects/${projectId}/files/${activeFileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: curFile?.content || '',
          expectedUpdatedAt: lastFetchTimestampRef.current[activeFileId],
        }),
      });
      if (res.status === 409) {
        setSaveStatus('conflict');
      } else if (res.ok) {
        const data = await res.json();
        if (data.file?.updatedAt) {
          lastFetchTimestampRef.current[activeFileId] = data.file.updatedAt;
        }
        setSaveStatus('saved');
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    }
  }, [projectId, activeFileId, files]);

  useEffect(() => {
    const handleSaveShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleForceSave();
      }
    };
    window.addEventListener('keydown', handleSaveShortcut);
    return () => window.removeEventListener('keydown', handleSaveShortcut);
  }, [handleForceSave]);

  const handleSelectFile = (fileId: string) => {
    const selected = files.find(f => f.id === fileId);
    if (!selected || selected.isFolder) return;

    setOpenFileIds((prev) => {
      if (!prev.includes(fileId)) {
        return [...prev, fileId];
      }
      return prev;
    });
    setActiveFileId(fileId);

    const detected = detectLanguage(
      selected.name,
      selected.content,
      fileLanguageOverrides[selected.id],
      currentLang.id
    );
    const conf = getLanguageConfig(detected);
    if (conf) {
      setCurrentLang(conf);
    }
  };

  const handleCloseFileTab = (idToClose: string) => {
    const closedIndex = openFileIds.indexOf(idToClose);
    const nextOpen = openFileIds.filter((id) => id !== idToClose);
    setOpenFileIds(nextOpen);

    if (activeFileId === idToClose) {
      if (nextOpen.length > 0) {
        const nextActiveIndex = Math.min(closedIndex >= 0 ? closedIndex : 0, nextOpen.length - 1);
        const nextActiveId = nextOpen[nextActiveIndex];
        setActiveFileId(nextActiveId);
        const nextActiveFile = files.find((f) => f.id === nextActiveId);
        if (nextActiveFile && !nextActiveFile.isFolder) {
          const detected = detectLanguage(
            nextActiveFile.name,
            nextActiveFile.content,
            fileLanguageOverrides[nextActiveFile.id],
            currentLang.id
          );
          const conf = getLanguageConfig(detected);
          if (conf) setCurrentLang(conf);
        }
      } else {
        setActiveFileId('');
      }
    }
  };

  const handleCreateNewTabFile = async () => {
    const nonFolders = files.filter((f) => !f.isFolder);
    const fileName = `file_${nonFolders.length + 1}${currentLang.fileExtension}`;
    const initialContent = getStarterContentForFile(fileName, currentLang);
    const path = `/${fileName}`;

    if (projectId) {
      try {
        const res = await fetch(`/api/v1/projects/${projectId}/files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: fileName, path, content: initialContent, isFolder: false }),
        });
        if (res.ok) {
          const data = await res.json();
          const newF = data.file;
          setFiles((prev) => [...prev, newF]);
          if (newF.updatedAt) lastFetchTimestampRef.current[newF.id] = newF.updatedAt;
          setOpenFileIds((prev) => [...prev, newF.id]);
          setActiveFileId(newF.id);
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }

    const newF: ProjectFile = {
      id: `f_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: fileName,
      path,
      content: initialContent,
    };
    setFiles((prev) => [...prev, newF]);
    setOpenFileIds((prev) => [...prev, newF.id]);
    setActiveFileId(newF.id);
  };

  const handleContentChange = (newContent: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === activeFileId ? { ...f, content: newContent } : f))
    );
    if (collabBrokerRef.current) {
      collabBrokerRef.current.broadcastFileChange(activeFileId, newContent);
    }
    
    // Auto-save
    if (projectId && activeFileId) {
       setSaveStatus('saving');
       if (saveFileRef.current) clearTimeout(saveFileRef.current);
       saveFileRef.current = setTimeout(async () => {
          try {
            const res = await fetch(`/api/v1/projects/${projectId}/files/${activeFileId}`, {
               method: 'PATCH',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({
                 content: newContent,
                 expectedUpdatedAt: lastFetchTimestampRef.current[activeFileId],
               })
            });
            if (res.status === 409) {
              setSaveStatus('conflict');
            } else if (res.ok) {
              const data = await res.json();
              if (data.file?.updatedAt) {
                lastFetchTimestampRef.current[activeFileId] = data.file.updatedAt;
              }
              setSaveStatus('saved');
            } else {
              setSaveStatus('error');
            }
          } catch {
            setSaveStatus('error');
          }
       }, 800);
    }
  };

  // Language Change Handler: Preserves user code and saves manual override in local state
  const handleLanguageChange = (newLang: LanguageConfig) => {
    if (newLang.id === currentLang.id) return;

    if (activeFileId) {
      setFileLanguageOverrides((prev) => {
        const updated = { ...prev, [activeFileId]: newLang.id };
        try {
          localStorage.setItem('cortex_file_language_overrides', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }

    setCurrentLang(newLang);
    setExecutionResult(null);
    setTraceSession(null);
    if (newLang.id === 'html' || newLang.id === 'css') {
      setActiveBottomTab('preview');
      setIsBottomCollapsed(false);
    }
  };

  // AI Auto-Fix Workflow: Instant Dual-Stage Engine (Instant 0ms Open + Non-blocking AI Refinement)
  const processAutoFix = useCallback(
    async (code: string, stderr: string, diagnostics: any[], forceKey?: string) => {
      // Stage 1: Instant Local AST Diagnostic Repair (Opens in 0ms - zero delay)
      const instantFix = analyzeAndFixErrorOffline(code, stderr, currentLang.id, diagnostics);
      setFixResult(instantFix);
      setIsQuickFixOpen(true);
      setIsAnalyzingFix(false);

      // Stage 2: Background AI Refinement (asynchronous, non-blocking)
      const keyToUse =
        forceKey ||
        aiSettings.apiKey ||
        (typeof window !== 'undefined' ? localStorage.getItem('cortex_gemini_api_key') || '' : '');

      if (keyToUse) {
        autoFixWithGeminiOrOffline(code, stderr, currentLang.id, diagnostics)
          .then(({ provider, fix }) => {
            if (provider === 'gemini' && fix && fix.fixedCode) {
              setFixResult(fix);
            }
          })
          .catch(() => {
            // Keep instant fix
          });
      }
    },
    [currentLang.id, aiSettings.apiKey]
  );

  const handleSaveApiKey = (newKey: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('cortex_gemini_api_key', newKey);
    }
    setAiSettings((prev) => ({ ...prev, apiKey: newKey, provider: 'gemini' }));
  };

  const handleReanalyzeWithKey = async (newKey: string) => {
    if (!activeFile) return;
    handleSaveApiKey(newKey);
    setIsAnalyzingFix(true);
    try {
      const res = await autoFixWithGeminiOrOffline(
        activeFile.content,
        executionResult?.stderr || '',
        currentLang.id,
        executionResult?.diagnostics || [],
        newKey
      );
      if (res.fix) {
        setFixResult(res.fix);
      }
    } catch {
      // Keep existing fix
    } finally {
      setIsAnalyzingFix(false);
    }
  };

  // Option 1: Insert explanatory comments beside all error lines
  const handleApplyExplanationComment = (comment: string, targetLine: number, commentedCode?: string) => {
    if (!activeFile) return;
    setPreviousCodeSnapshot(activeFile.content);

    // If multi-error commentedCode is available, apply all comments across the entire file
    if (commentedCode && commentedCode.trim().length > 0) {
      handleContentChange(commentedCode);
      setIsQuickFixOpen(false);
      return;
    }

    const lines = activeFile.content.split('\n');
    const lineIdx = Math.max(0, targetLine - 1);

    if (lineIdx < lines.length) {
      const lineText = lines[lineIdx];
      // If line is reasonably short (< 55 chars) and doesn't already have a comment, place beside it
      if (lineText.trim().length > 0 && lineText.length < 55 && !lineText.includes('#') && !lineText.includes('//')) {
        lines[lineIdx] = `${lineText}  ${comment}`;
      } else {
        // Otherwise, place directly above the line with matching indentation
        const indent = lineText.match(/^\s*/)?.[0] || '';
        lines.splice(lineIdx, 0, `${indent}${comment}`);
      }
    } else {
      lines.push(comment);
    }

    const newContent = lines.join('\n');
    handleContentChange(newContent);
    setIsQuickFixOpen(false);
  };

  // Option 2: Live Auto-Fix directly in front of the user & re-verify
  const handleApplyLiveFix = async (fixToApply: AIFixResult) => {
    setIsQuickFixOpen(false);
    await applyFixAndReverify(fixToApply);
  };

  // Code Execution Handler
  const handleRun = async () => {
    if (files.length === 0 || !activeFile) {
      setActiveBottomTab('output');
      setIsBottomCollapsed(false);
      setExecutionResult({
        status: 'system_error',
        exitCode: 1,
        stdout: '',
        stderr: 'No files available to execute. Please create or open a file first.',
        executionTimeMs: 0,
        memoryUsageMb: 0,
        diagnostics: [],
        timestamp: new Date().toISOString(),
        provider: 'cloud_sandbox',
      });
      return;
    }

    // Resolve the active file to execute
    const currentActive = files.find((f) => f.id === activeFileId && !f.isFolder) || activeFile;
    if (!currentActive) return;

    // Detect accurate language from active file's name and buffer
    const activeFileLangId = detectLanguage(
      currentActive.name,
      currentActive.content,
      fileLanguageOverrides[currentActive.id],
      currentLang.id
    );
    const executionLang = getLanguageConfig(activeFileLangId) || currentLang;

    // Sync currentLang if different from active file language
    if (executionLang.id !== currentLang.id) {
      setCurrentLang(executionLang);
    }

    if (executionLang.executable === false) {
      setActiveBottomTab('output');
      setIsBottomCollapsed(false);
      setExecutionResult({
        status: 'system_error',
        exitCode: 0,
        stdout: `[Cortex IDE] File: ${currentActive.name}\nFormat: ${executionLang.name} (${executionLang.fileExtension})\n\nLanguage "${executionLang.name}" is a documentation or data format and cannot be executed as a standalone program.\nMonaco syntax highlighting and formatting are active.`,
        stderr: `Language "${executionLang.name}" is a documentation or data format and cannot be executed as a standalone program.`,
        executionTimeMs: 0,
        memoryUsageMb: 0,
        diagnostics: [],
        timestamp: new Date().toISOString(),
        provider: 'cloud_sandbox',
      });
      return;
    }

    if (executionLang.id === 'html' || executionLang.id === 'css') {
      setActiveBottomTab('preview');
      setIsBottomCollapsed(false);
      return;
    }

    if (executionLang.id === 'sql') {
      setIsRunning(true);
      setActiveBottomTab('output');
      setIsBottomCollapsed(false);
      try {
        await handleForceSave();
        const syncedFiles = files.map((f) =>
          f.id === currentActive.id ? { ...f, content: currentActive.content } : f
        );

        let data: any = null;
        try {
          const res = await fetch('/api/v1/sql/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: projectId || getGuestSqlProjectId(),
              query: currentActive.content,
              dialect: 'sqlite',
            }),
          });
          if (res.ok) {
            data = await res.json();
          }
        } catch {}

        const isUnavailable =
          !data ||
          !data.result ||
          (typeof data.result?.error === 'string' &&
            data.result.error.toLowerCase().includes('not available in the current runtime environment')) ||
          (typeof data.error === 'string' &&
            data.error.toLowerCase().includes('not available in the current runtime environment'));

        if (isUnavailable) {
          // Cloudflare Workers / Edge fallback: run via Judge0 / Piston cloud sandbox
          const cloudRes = await executeInCloudSandbox({
            projectId: projectId || undefined,
            language: 'sql',
            files: syncedFiles,
            entrypoint: currentActive.name,
            stdin: customStdin,
          });
          setExecutionResult(cloudRes);
          return;
        }

        if (data.result) {
          const { columns, rows, executionTimeMs, error, warning } = data.result;
          if (error) {
            setExecutionResult({
              status: 'runtime_error',
              exitCode: 1,
              stdout: '',
              stderr: error,
              executionTimeMs: executionTimeMs || 0,
              memoryUsageMb: 1,
              diagnostics: parseDiagnostics(error, 'sql'),
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
              executionTimeMs: executionTimeMs || 0,
              memoryUsageMb: 2,
              diagnostics: [],
              timestamp: new Date().toISOString(),
              provider: 'cloud_sandbox',
            });
          }
        }
      } catch (err: any) {
        // Fallback to cloud sandbox on unexpected error
        try {
          const syncedFiles = files.map((f) =>
            f.id === currentActive.id ? { ...f, content: currentActive.content } : f
          );
          const cloudRes = await executeInCloudSandbox({
            projectId: projectId || undefined,
            language: 'sql',
            files: syncedFiles,
            entrypoint: currentActive.name,
            stdin: customStdin,
          });
          setExecutionResult(cloudRes);
        } catch (innerErr: any) {
          setExecutionResult({
            status: 'runtime_error',
            exitCode: 1,
            stdout: '',
            stderr: innerErr.message || err.message || 'SQL execution failed',
            executionTimeMs: 0,
            memoryUsageMb: 0,
            diagnostics: [],
            timestamp: new Date().toISOString(),
            provider: 'cloud_sandbox',
          });
        }
      } finally {
        setIsRunning(false);
      }
      return;
    }

    setIsRunning(true);
    setActiveBottomTab('output');
    setIsBottomCollapsed(false);

    try {
      // Force save active file before run
      if (projectId && currentActive.id) {
        if (saveFileRef.current) clearTimeout(saveFileRef.current);
        try {
          const saveRes = await fetch(`/api/v1/projects/${projectId}/files/${currentActive.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: currentActive.content })
          });
          await syncTimestampFromPatch(currentActive.id, saveRes);
        } catch (e) {}
      }

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

      res.stdin = customStdin;
      setExecutionResult(res);
    } finally {
      setIsRunning(false);
    }
  };

  const loadProjectFiles = useCallback(async (targetProjectId: string) => {
    try {
      const projRes = await fetch(`/api/v1/projects/${targetProjectId}`);
      if (projRes.ok) {
        const projData = await projRes.json();
        if (Array.isArray(projData.files) && projData.files.length > 0) {
          setFiles(projData.files);
          projData.files.forEach((f: any) => {
            if (f.updatedAt) lastFetchTimestampRef.current[f.id] = f.updatedAt;
          });
          return projData.files;
        }
      }
    } catch (e) {
      console.error('Failed to reload project files:', e);
    }
    return null;
  }, []);

  const handleUploadFiles = async (uploadedFiles: FileList | File[]) => {
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    if (!projectId) {
      const newFiles: ProjectFile[] = [];
      const fileList = Array.from(uploadedFiles);
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        try {
          const text = await file.text();
          const relativePath = (file as any).webkitRelativePath || file.name;
          const cleanPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
          const newF: ProjectFile = {
            id: `f_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
            name: file.name,
            path: cleanPath,
            content: text,
            isFolder: false,
          };
          newFiles.push(newF);
        } catch (e) {
          console.error('Failed to read uploaded file', e);
        }
      }
      if (newFiles.length > 0) {
        setFiles((prev) => [...prev, ...newFiles]);
        handleSelectFile(newFiles[0].id);
      }
      return;
    }

    try {
      const formData = new FormData();
      const fileList = Array.from(uploadedFiles);
      for (const file of fileList) {
        const relativePath = (file as any).webkitRelativePath || file.name;
        formData.append('files', file, relativePath);
      }
      const res = await fetch(`/api/v1/projects/${projectId}/files/upload`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const uploadResult = await res.json().catch(() => ({}));
        const reloadedFiles = await loadProjectFiles(projectId);
        if (reloadedFiles && reloadedFiles.length > 0) {
          const firstUploaded = Array.isArray(uploadResult?.uploadedFiles) && uploadResult.uploadedFiles[0];
          const target = firstUploaded
            ? reloadedFiles.find((f: any) => f.path === firstUploaded.path || (f.name === firstUploaded.name && !f.isFolder))
            : reloadedFiles.find((f: any) => !f.isFolder);
          if (target) {
            handleSelectFile(target.id);
          }
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || 'File upload failed');
      }
    } catch (e: any) {
      alert(`Upload error: ${e.message}`);
    }
  };

  const handleDownloadFile = (file: ProjectFile) => {
    if (!file || file.isFolder) return;
    const content = file.id === activeFileId ? (activeFile?.content || file.content || '') : (file.content || '');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Apply Fix & Re-Verify
  const applyFixAndReverify = async (fixToApply: AIFixResult) => {
    const targetFile = files.find((f) => f.id === activeFileId && !f.isFolder) || activeFile;
    if (!targetFile || files.length === 0) return;
    setPreviousCodeSnapshot(targetFile.content);
    // Step 6: Apply fix
    handleContentChange(fixToApply.fixedCode);

    // Step 7: Recompile & Re-run
    setIsRunning(true);
    try {
      const detectedLangId = detectLanguage(
        targetFile.name,
        fixToApply.fixedCode,
        fileLanguageOverrides[targetFile.id],
        currentLang.id
      );
      const executionLang = getLanguageConfig(detectedLangId) || currentLang;

      const updatedFiles = files.map((f) =>
        f.id === targetFile.id ? { ...f, content: fixToApply.fixedCode } : f
      );
      const retestRes = await executeInCloudSandbox({
        projectId: projectId || undefined,
        language: executionLang.id,
        files: updatedFiles,
        entrypoint: targetFile.name,
        stdin: customStdin,
      });

      setExecutionResult(retestRes);

      // Step 8 & 9: Verify result
      if (retestRes.status === 'success') {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
      }
    } finally {
      setIsRunning(false);
    }
  };

  // Undo Fix
  const handleUndoFix = () => {
    if (previousCodeSnapshot) {
      handleContentChange(previousCodeSnapshot);
      setPreviousCodeSnapshot(null);
    }
  };

  // Automated Test Cases Runner
  const handleRunAllTests = async (
    overrideFile?: ProjectFile,
    overrideTestCases?: TestCase[],
    mode: 'run' | 'submit' = 'run'
  ) => {
    const explicitFile =
      overrideFile &&
      typeof overrideFile === 'object' &&
      'id' in overrideFile &&
      'name' in overrideFile &&
      typeof overrideFile.content === 'string'
        ? overrideFile
        : undefined;
    const targetFile = explicitFile || files.find((f) => f.id === activeFileId && !f.isFolder) || activeFile;
    if (!targetFile) return;
    const activeTestCases = Array.isArray(overrideTestCases) ? overrideTestCases : testCases;
    setIsRunningTests(true);
    setPracticeRunningMode(mode);
    try {
      if (projectId && targetFile.id) {
        if (saveFileRef.current) clearTimeout(saveFileRef.current);
        try {
          const currentContent = explicitFile
            ? explicitFile.content
            : (files.find((f) => f.id === targetFile.id)?.content ?? targetFile.content ?? '');
          const saveRes = await fetch(`/api/v1/projects/${projectId}/files/${targetFile.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: currentContent }),
          });
          await syncTimestampFromPatch(targetFile.id, saveRes);
        } catch (e) {}
      }

      const detectedLangId = detectLanguage(
        targetFile.name,
        targetFile.content,
        fileLanguageOverrides[targetFile.id],
        currentLang.id
      );
      const executionLang = getLanguageConfig(detectedLangId) || currentLang;

      if (executionLang.executable === false) {
        setTestCases((prev) =>
          (prev.length > 0 ? prev : activeTestCases).map((tc) => ({
            ...tc,
            passed: false,
            actualStdout: '',
            error: `Active file "${targetFile.name}" (${executionLang.name}) is not executable. Switch to a solution file to run tests.`,
          }))
        );
        return;
      }

      const hasTargetInFiles = files.some((f) => f.id === targetFile.id);
      const syncedFiles = hasTargetInFiles
        ? files.map((f) => (f.id === targetFile.id ? { ...f, content: targetFile.content } : f))
        : [...files, targetFile];

      let evaluated: TestCase[] = [];
      let passedCount = 0;
      const totalCount = activeTestCases.length;

      if (executionLang.id === 'sql') {
        for (const tc of activeTestCases) {
          let actualStdout = '';
          let execErr: string | undefined;
          let timeMs = 0;

          let sqlApiData: any = null;
          try {
            const res = await fetch('/api/v1/sql/execute', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                projectId: projectId || 'demo_sql_project',
                query: targetFile.content,
                dialect: 'sqlite',
              }),
            });
            if (res.ok) {
              sqlApiData = await res.json();
            }
          } catch {}

          const isSqlUnavailable =
            !sqlApiData ||
            !sqlApiData.result ||
            (typeof sqlApiData.result?.error === 'string' &&
              sqlApiData.result.error.toLowerCase().includes('not available in the current runtime environment'));

          if (!isSqlUnavailable && sqlApiData.result) {
            timeMs = sqlApiData.result.executionTimeMs || 0;
            if (sqlApiData.result.error) {
              execErr = sqlApiData.result.error;
            } else {
              const rows: any[][] = Array.isArray(sqlApiData.result.rows) ? sqlApiData.result.rows : [];
              actualStdout = rows
                .map((r) => r.map((v) => (v === null || v === undefined ? '' : String(v))).join('|'))
                .join('\n')
                .trim();
            }
          } else {
            const cloudRes = await executeInCloudSandbox({
              projectId: projectId || undefined,
              language: 'sql',
              files: syncedFiles,
              entrypoint: targetFile.name,
              stdin: tc.stdin,
            });
            timeMs = cloudRes.executionTimeMs;
            actualStdout = (cloudRes.stdout || '').replace(/\r\n/g, '\n').trim();
            if (cloudRes.status !== 'success') {
              execErr = (cloudRes.stderr || cloudRes.stdout || '').replace(/\r\n/g, '\n');
            }
          }

          const expected = (tc.expectedStdout || '').replace(/\r\n/g, '\n').trim();
          const passed = !execErr && actualStdout === expected;
          if (passed) passedCount++;

          evaluated.push({
            ...tc,
            actualStdout,
            passed,
            timeMs,
            error: execErr,
          });
        }
      } else {
        const runRes = await runTestCases(
          {
            projectId: projectId || undefined,
            language: executionLang.id,
            files: syncedFiles,
            entrypoint: targetFile.name,
          },
          activeTestCases
        );
        evaluated = runRes.testCases;
        passedCount = runRes.passedCount;
      }

      setTestCases(evaluated);

      const hasError = evaluated.some((tc) => Boolean(tc.error));
      const totalRuntimeMs = evaluated.reduce((sum, tc) => sum + (tc.timeMs || 0), 0);
      const allPassed = passedCount === totalCount && totalCount > 0;
      const summaryStatus: 'Accepted' | 'Wrong Answer' | 'Runtime Error' = allPassed
        ? 'Accepted'
        : hasError
          ? 'Runtime Error'
          : 'Wrong Answer';

      setPracticeLastResult({
        mode,
        passed: allPassed,
        status: summaryStatus,
        passedCount,
        totalCount,
        runtimeMs: totalRuntimeMs,
      });

      const consoleLines = evaluated
        .map((tc, idx) => {
          const out = tc.error
            ? `[Error] ${tc.error}`
            : tc.actualStdout !== undefined
              ? tc.actualStdout || '(empty)'
              : '(no output)';
          return `Case ${idx + 1} (${tc.passed ? 'Passed' : 'Failed'}):\n${out}`;
        })
        .join('\n\n');
      setPracticeConsoleOutput(consoleLines);

      if (mode === 'submit' && activePracticeChallenge) {
        const record: PracticeSubmissionRecord = {
          id: `sub_${Date.now()}`,
          challengeId: activePracticeChallenge.id,
          status: summaryStatus,
          runtime: `${totalRuntimeMs} ms`,
          language: executionLang.name,
          passedCount,
          totalCount,
          timestamp: Date.now(),
          code: targetFile.content,
        };
        setPracticeSubmissionsByChallenge((prev) => {
          const existingList = prev[activePracticeChallenge.id] || [];
          const next = {
            ...prev,
            [activePracticeChallenge.id]: [record, ...existingList].slice(0, 25),
          };
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('cortex_practice_submissions_v1', JSON.stringify(next));
            } catch {}
          }
          return next;
        });
      }

      if (allPassed) {
        confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
        if (activePracticeChallenge) {
          markProblemSolved(activePracticeChallenge.id);
        }
      } else if (activePracticeChallenge) {
        markProblemAttempted(activePracticeChallenge.id);
      }
    } finally {
      setIsRunningTests(false);
      setPracticeRunningMode(null);
    }
  };

  // Benchmark Runner
  const handleRunBenchmark = async () => {
    const targetFile = files.find((f) => f.id === activeFileId && !f.isFolder) || activeFile;
    if (!targetFile || files.length === 0) return;

    if (projectId && targetFile.id) {
      if (saveFileRef.current) clearTimeout(saveFileRef.current);
      try {
        const currentContent = files.find((f) => f.id === targetFile.id)?.content || '';
        const saveRes = await fetch(`/api/v1/projects/${projectId}/files/${targetFile.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: currentContent }),
        });
        await syncTimestampFromPatch(targetFile.id, saveRes);
      } catch (e) {}
    }

    const detectedLangId = detectLanguage(
      targetFile.name,
      targetFile.content,
      fileLanguageOverrides[targetFile.id],
      currentLang.id
    );
    const executionLang = getLanguageConfig(detectedLangId) || currentLang;

    const syncedFiles = files.map((f) =>
      f.id === targetFile.id ? { ...f, content: targetFile.content } : f
    );

    const res = await benchmarkExecution({
      projectId: projectId || undefined,
      language: executionLang.id,
      files: syncedFiles,
      entrypoint: targetFile.name,
    });
    setBenchmarkResult(res);
  };

  const isPracticeHubOpen = activeSidebarTab === 'practice' && isSidebarOpen;

  const handleLaunchChallenge = useCallback(
    async (challenge: Challenge, preferredLang?: string, forceResetCode = false): Promise<ProjectFile | null> => {
      const langKey =
        challenge.track === 'SQL' && challenge.starterTemplates['sql']
          ? 'sql'
          : preferredLang && challenge.starterTemplates[preferredLang]
            ? preferredLang
            : challenge.starterTemplates['python']
              ? 'python'
              : Object.keys(challenge.starterTemplates)[0] || 'python';

      const targetLang = getLanguageConfig(langKey);
      const starterCode = challenge.starterTemplates[langKey] || targetLang.starterCode || '';
      const fileName = `${challenge.slug}${targetLang.fileExtension}`;
      const filePath = `/${fileName}`;

      const existing = files.find((f) => !f.isFolder && f.name === fileName);
      let resolvedFileId = existing?.id || '';
      let resolvedFile: ProjectFile | null = null;

      if (existing) {
        if (forceResetCode || !existing.content.trim()) {
          resolvedFile = { ...existing, content: starterCode };
          setFiles((prev) =>
            prev.map((f) => (f.id === existing.id ? { ...f, content: starterCode } : f))
          );
          if (projectId) {
            if (saveFileRef.current) clearTimeout(saveFileRef.current);
            try {
              const saveRes = await fetch(`/api/v1/projects/${projectId}/files/${existing.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: starterCode }),
              });
              await syncTimestampFromPatch(existing.id, saveRes);
            } catch {}
          }
        } else {
          resolvedFile = existing;
        }
        setOpenFileIds((prev) => (prev.includes(existing.id) ? prev : [...prev, existing.id]));
        setActiveFileId(existing.id);
      } else {
        let createdFile: ProjectFile | null = null;
        if (projectId) {
          try {
            const res = await fetch(`/api/v1/projects/${projectId}/files`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: fileName,
                path: filePath,
                content: starterCode,
                isFolder: false,
              }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data?.file) {
                createdFile = data.file;
                if (data.file.updatedAt) {
                  lastFetchTimestampRef.current[data.file.id] = data.file.updatedAt;
                }
              }
            }
          } catch {}
        }

        if (!createdFile) {
          createdFile = {
            id: `practice_${challenge.id}_${langKey}_${Date.now()}`,
            name: fileName,
            path: filePath,
            content: starterCode,
            isFolder: false,
          };
        }

        resolvedFileId = createdFile.id;
        resolvedFile = createdFile;
        setFiles((prev) => [...prev, createdFile!]);
        setOpenFileIds((prev) => (prev.includes(createdFile!.id) ? prev : [...prev, createdFile!.id]));
        setActiveFileId(createdFile.id);
      }

      if (resolvedFileId) {
        setFileLanguageOverrides((prev) => {
          const updated = { ...prev, [resolvedFileId]: targetLang.id };
          try {
            localStorage.setItem('cortex_file_language_overrides', JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }

      setCurrentLang(targetLang);
      setExecutionResult(null);
      setTraceSession(null);

      if (challenge.testCases.length > 0) {
        setTestCases(challenge.testCases.map((tc) => ({ ...tc })));
        setActiveBottomTab('tests');
        setIsBottomCollapsed(false);
      } else {
        setTestCases([]);
        setActiveBottomTab('output');
        setIsBottomCollapsed(false);
      }

      setActivePracticeChallenge(challenge);
      setIsProblemPanelOpen(true);
      setIsPracticeLeftMaximized(false);
      setPracticeLastResult(null);
      setPracticeConsoleOutput('');
      setPracticeActiveCaseIdx(0);
      setPracticeBottomTab(challenge.testCases.length > 0 ? 'testcase' : 'console');
      markProblemAttempted(challenge.id);
      setActiveSidebarTab('files');
      setIsSidebarOpen(false);

      return resolvedFile;
    },
    [files, projectId, markProblemAttempted, setActiveBottomTab, setActiveSidebarTab, setIsBottomCollapsed, setIsSidebarOpen, syncTimestampFromPatch]
  );

  const handleNavigateChallenge = useCallback(
    (direction: 'prev' | 'next' | 'shuffle') => {
      if (!activePracticeChallenge || CHALLENGES.length === 0) return;
      const currentIdx = CHALLENGES.findIndex((c) => c.id === activePracticeChallenge.id);
      let targetIdx = 0;
      if (direction === 'prev') {
        targetIdx = currentIdx <= 0 ? CHALLENGES.length - 1 : currentIdx - 1;
      } else if (direction === 'next') {
        targetIdx = currentIdx >= CHALLENGES.length - 1 ? 0 : currentIdx + 1;
      } else if (CHALLENGES.length > 1) {
        do {
          targetIdx = Math.floor(Math.random() * CHALLENGES.length);
        } while (targetIdx === currentIdx);
      }
      const targetChallenge = CHALLENGES[targetIdx];
      if (targetChallenge) {
        void handleLaunchChallenge(targetChallenge, currentLang?.id, false);
      }
    },
    [activePracticeChallenge, currentLang?.id, handleLaunchChallenge]
  );

  const launchedQueryChallengeRef = useRef<string | null>(null);
  useEffect(() => {
    if (isProjectLoading || typeof window === 'undefined') return;
    const challengeParam = new URLSearchParams(window.location.search).get('challenge');
    if (!challengeParam || launchedQueryChallengeRef.current === challengeParam) return;
    const matched = CHALLENGES.find((c) => c.id === challengeParam || c.slug === challengeParam);
    if (matched) {
      launchedQueryChallengeRef.current = challengeParam;
      void handleLaunchChallenge(matched);
    }
  }, [isProjectLoading, handleLaunchChallenge]);

  const activeChallengeFile = useMemo(() => {
    if (!activePracticeChallenge) return null;
    const allowedNames = new Set(
      Object.keys(activePracticeChallenge.starterTemplates).map(
        (langKey) => `${activePracticeChallenge.slug}${getLanguageConfig(langKey).fileExtension}`
      )
    );
    if (activeFile && !activeFile.isFolder && allowedNames.has(activeFile.name)) {
      return activeFile;
    }
    const preferredName = `${activePracticeChallenge.slug}${currentLang.fileExtension}`;
    return (
      files.find((f) => !f.isFolder && f.name === preferredName) ||
      files.find((f) => !f.isFolder && allowedNames.has(f.name)) ||
      null
    );
  }, [activePracticeChallenge, activeFile, files, currentLang.fileExtension]);

  const isChallengeFileActive = useMemo(() => {
    if (!activePracticeChallenge || !activeFile) return false;
    const allowedNames = new Set(
      Object.keys(activePracticeChallenge.starterTemplates).map(
        (langKey) => `${activePracticeChallenge.slug}${getLanguageConfig(langKey).fileExtension}`
      )
    );
    return allowedNames.has(activeFile.name);
  }, [activePracticeChallenge, activeFile]);

  const isPracticeProblemMode = Boolean(activePracticeChallenge) && !isPracticeHubOpen;

  // Keyboard Shortcuts Listener (Ctrl+Enter, Ctrl+S)
  const handleRunRef = useRef(handleRun);
  const isPracticeHubOpenRef = useRef(isPracticeHubOpen);
  const isPracticeProblemModeRef = useRef(isPracticeProblemMode);
  useEffect(() => {
    handleRunRef.current = handleRun;
    isPracticeHubOpenRef.current = isPracticeHubOpen;
    isPracticeProblemModeRef.current = isPracticeProblemMode;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key === 'Enter' &&
        !isPracticeHubOpenRef.current &&
        !isPracticeProblemModeRef.current
      ) {
        e.preventDefault();
        handleRunRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Live Code Visualization Handler
  const handleRunTrace = async () => {
    if (isTracing) return;
    setIsTracing(true);
    if (editorLayoutMode === 'code') {
      setEditorLayoutMode('split');
    }
    try {
      const activeContent = activeFile?.content || '';
      const currentFiles = files.map((f) =>
        f.id === activeFileId ? { ...f, content: activeContent } : f
      );
      const res = await fetch('/api/v1/visualize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: currentLang.id,
          files: currentFiles,
          entrypoint: activeFile?.name,
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
  };

  // Visual Debugger Controls wired to useIdeDebugger hook
  const handleStartDebug = () => {
    startDebug(() => {
      setActiveBottomTab('debug');
      setIsBottomCollapsed(false);
    });
  };

  const handleStopDebug = stopDebug;
  const handleStepOver = stepOver;

  
  if (isProjectLoading) {
    return <div className="min-h-screen bg-[#0b0c0e] flex items-center justify-center text-white">Loading workspace...</div>;
  }
    
  const availPracticeLangs = activePracticeChallenge
    ? Object.keys(activePracticeChallenge.starterTemplates)
    : [];
  const resolvedPracticeLangId = activeChallengeFile
    ? detectLanguage(
        activeChallengeFile.name,
        activeChallengeFile.content,
        fileLanguageOverrides[activeChallengeFile.id],
        currentLang.id
      )
    : currentLang.id;
  const effectivePracticeLangId = availPracticeLangs.includes(resolvedPracticeLangId)
    ? resolvedPracticeLangId
    : availPracticeLangs[0] || currentLang.id;
  const effectivePracticeTestCount = activePracticeChallenge
    ? (isChallengeFileActive
        ? testCases.length
        : testCases.length > 0
          ? testCases.length
          : activePracticeChallenge.testCases.length)
    : 0;

  const executePracticeTests = async (mode: 'run' | 'submit') => {
    if (!activePracticeChallenge) return;
    if (!isChallengeFileActive) {
      const targetFile = activeChallengeFile
        ? (handleSelectFile(activeChallengeFile.id), activeChallengeFile)
        : await handleLaunchChallenge(activePracticeChallenge, undefined, false);
      if (!targetFile) return;
      const freshTests =
        mode === 'submit' && activePracticeChallenge.testCases.length > 0
          ? activePracticeChallenge.testCases.map((tc) => ({ ...tc }))
          : testCases.length > 0
            ? testCases
            : activePracticeChallenge.testCases.map((tc) => ({ ...tc }));
      await handleRunAllTests(targetFile, freshTests, mode);
      return;
    }

    const suite =
      mode === 'submit' && activePracticeChallenge.testCases.length > 0
        ? activePracticeChallenge.testCases.map((tc) => ({ ...tc }))
        : testCases.length > 0
          ? testCases
          : activePracticeChallenge.testCases.map((tc) => ({ ...tc }));
    await handleRunAllTests(undefined, suite, mode);
  };

  const practiceProblemIdx = activePracticeChallenge
    ? CHALLENGES.findIndex((c) => c.id === activePracticeChallenge.id) + 1
    : 0;

  return (
    <AppShell
      isDarkMode={isDarkMode}
      onOpenSettings={() => setIsSettingsOpen(true)}
      hideSidebar={isPracticeProblemMode}
    >
      <div className={`flex flex-col h-full w-full ${isDarkMode ? 'bg-[#0b0c0e] text-[#e6edf3]' : 'bg-[#f8fafc] text-[#0f172a]'} overflow-hidden font-sans select-none`}>
        {isPracticeHubOpen ? (
          <PracticeHub
            isDarkMode={isDarkMode}
            onToggleDarkMode={handleToggleDarkMode}
            progressMap={practiceProgress}
            activeProblemId={activePracticeChallenge?.id || null}
            onLaunchProblem={(challenge, preferredLang) =>
              handleLaunchChallenge(challenge, preferredLang || currentLang?.id)
            }
            onReturnToEditor={() => {
              setActiveSidebarTab('files');
              setIsSidebarOpen(!activePracticeChallenge);
            }}
          />
        ) : isPracticeProblemMode && activePracticeChallenge ? (
          <PracticeWorkspace
            problem={activePracticeChallenge}
            language={effectivePracticeLangId}
            languages={availPracticeLangs}
            onLanguageChange={(langId) =>
              void handleLaunchChallenge(activePracticeChallenge, langId, false)
            }
            onFormatCode={() => practiceFormatFnRef.current?.()}
            onResetCode={() => {
              const targetLang = availPracticeLangs.includes(resolvedPracticeLangId)
                ? resolvedPracticeLangId
                : undefined;
              void handleLaunchChallenge(activePracticeChallenge, targetLang, true);
            }}
            onRun={() => executePracticeTests('run')}
            onSubmit={() => executePracticeTests('submit')}
            isRunning={isRunningTests}
            runningMode={practiceRunningMode}
            aiAssistEnabled={enableInlineSuggestions}
            onToggleAiAssist={handleToggleInlineSuggestions}
            onBackToHub={() => {
              setActiveSidebarTab('practice');
              setIsSidebarOpen(true);
            }}
            onExitToIde={() => {
              setActivePracticeChallenge(null);
              setIsProblemPanelOpen(false);
              setActiveSidebarTab('files');
              setIsSidebarOpen(true);
            }}
            onPrevProblem={() => handleNavigateChallenge('prev')}
            onNextProblem={() => handleNavigateChallenge('next')}
            onShuffleProblem={() => handleNavigateChallenge('shuffle')}
            isDarkMode={isDarkMode}
            onToggleDarkMode={handleToggleDarkMode}
            isLeftCollapsed={!isProblemPanelOpen}
            onExpandLeftPanel={() => setIsProblemPanelOpen(true)}
            leftMaximized={isPracticeLeftMaximized}
            onRequestRestoreLeft={() => setIsPracticeLeftMaximized(false)}
            leftPanel={
              <ProblemDetailsPanel
                key={activePracticeChallenge.id}
                challenge={activePracticeChallenge}
                problemNumber={practiceProblemIdx > 0 ? practiceProblemIdx : undefined}
                isDarkMode={isDarkMode}
                status={practiceProgress[activePracticeChallenge.id] ?? 'unsolved'}
                submissions={practiceSubmissionsByChallenge[activePracticeChallenge.id] || []}
                isChallengeFileActive={isChallengeFileActive}
                activeFileName={activeFile?.name || null}
                activeTestCasesCount={effectivePracticeTestCount}
                onOpenChallengeFile={() => {
                  if (activeChallengeFile) {
                    handleSelectFile(activeChallengeFile.id);
                  } else {
                    void handleLaunchChallenge(activePracticeChallenge, undefined, false);
                  }
                }}
                onLoadSubmissionCode={(code, langName) => {
                  const matchedKey = availPracticeLangs.find((k) => {
                    const cfg = getLanguageConfig(k);
                    return (
                      k === langName.toLowerCase() ||
                      cfg?.name.toLowerCase() === langName.toLowerCase()
                    );
                  });
                  if (matchedKey && matchedKey !== effectivePracticeLangId) {
                    void handleLaunchChallenge(activePracticeChallenge, matchedKey, false).then(
                      (launched) => {
                        if (launched) {
                          handleContentChange(code);
                        }
                      }
                    );
                  } else {
                    handleContentChange(code);
                  }
                }}
                isMaximized={isPracticeLeftMaximized}
                onToggleMaximize={() => setIsPracticeLeftMaximized((prev) => !prev)}
                onClosePanel={() => {
                  setIsPracticeLeftMaximized(false);
                  setIsProblemPanelOpen(false);
                }}
              />
            }
            editorSlot={
              <MonacoCodeEditor
                practiceMode
                files={files}
                openFileIds={openFileIds}
                activeFileId={activeFileId}
                onSelectFile={handleSelectFile}
                saveStatus={saveStatus}
                onForceSave={handleForceSave}
                onCloseFile={handleCloseFileTab}
                onNewFile={handleCreateNewTabFile}
                onContentChange={handleContentChange}
                language={getMonacoLanguage(currentLang.id || activeFile?.name || '')}
                theme={theme}
                fontSize={practiceFontSize}
                tabSize={practiceTabSize}
                breakpoints={breakpoints}
                onToggleBreakpoint={toggleBreakpoint}
                activeLine={activeDebugLine}
                diagnostics={executionResult?.diagnostics}
                onCursorChange={(l, c) => {
                  setPracticeCursorPos({ line: l, col: c });
                  if (collabBrokerRef.current) {
                    collabBrokerRef.current.updateCursor(activeFileId, l, c);
                  }
                }}
                onFormatReady={(fn) => {
                  practiceFormatFnRef.current = fn;
                }}
                isDarkMode={isDarkMode}
                onToggleDarkMode={handleToggleDarkMode}
                quickFixResult={fixResult}
                isQuickFixOpen={isQuickFixOpen}
                onCloseQuickFix={() => setIsQuickFixOpen(false)}
                onApplyExplanationComment={handleApplyExplanationComment}
                onApplyLiveFix={handleApplyLiveFix}
                aiProvider={aiSettings.provider === 'gemini' || Boolean(aiSettings.apiKey) ? 'gemini' : 'offline'}
                apiKey={aiSettings.apiKey || ''}
                onSaveApiKey={handleSaveApiKey}
                isAnalyzingFix={isAnalyzingFix}
                onReanalyzeWithKey={handleReanalyzeWithKey}
                enableInlineSuggestions={enableInlineSuggestions}
                onToggleInlineSuggestions={handleToggleInlineSuggestions}
                isExecutable={currentLang.executable !== false}
              />
            }
            assistantSlot={
              <AIAssistantPanel
                isDarkMode={isDarkMode}
                currentCode={activeFile?.content || ''}
                language={currentLang.id}
                settings={aiSettings}
                onUpdateSettings={(s) => setAiSettings((prev) => ({ ...prev, ...s }))}
                onTriggerExplain={async () => {
                  if (!activeFile) return;
                  setAnalysisMode('explain');
                  setIsAnalyzingAI(true);
                  const res = await analyzeCode(activeFile.content, currentLang.id, aiSettings, 'explain');
                  setAiAnalysis(res);
                  setIsAnalyzingAI(false);
                }}
                onTriggerOptimize={async () => {
                  if (!activeFile) return;
                  setAnalysisMode('optimize');
                  setIsAnalyzingAI(true);
                  const res = await analyzeCode(activeFile.content, currentLang.id, aiSettings, 'optimize');
                  setAiAnalysis(res);
                  setIsAnalyzingAI(false);
                }}
                onTriggerRefactor={async () => {
                  if (!activeFile) return;
                  setAnalysisMode('refactor');
                  setIsAnalyzingAI(true);
                  const res = await analyzeCode(activeFile.content, currentLang.id, aiSettings, 'refactor');
                  setAiAnalysis(res);
                  setIsAnalyzingAI(false);
                }}
                onTriggerConvert={async (toLang) => {
                  if (!activeFile) return;
                  const res = await convertCode(activeFile.content, currentLang.id, toLang);
                  const targetLangConfig = getLanguageConfig(toLang);
                  setCurrentLang(targetLangConfig);
                  handleContentChange(res.convertedCode);
                }}
                onTriggerAutoFix={() => {
                  if (!activeFile) return;
                  processAutoFix(
                    activeFile.content,
                    executionResult?.stderr || '',
                    executionResult?.diagnostics || []
                  );
                }}
                analysisResult={aiAnalysis}
                isAnalyzing={isAnalyzingAI}
                analysisMode={analysisMode}
              />
            }
            testCases={testCases}
            activeCaseIdx={practiceActiveCaseIdx}
            onSelectCaseIdx={setPracticeActiveCaseIdx}
            onAddTestCase={() => {
              const nextIdx = testCases.length;
              setTestCases((prev) => [
                ...prev,
                {
                  id: `tc_${Date.now()}`,
                  name: `Case ${prev.length + 1}`,
                  stdin: '',
                  expectedStdout: '',
                  isHidden: false,
                },
              ]);
              setPracticeActiveCaseIdx(nextIdx);
            }}
            onDeleteTestCase={(id) => {
              setTestCases((prev) => prev.filter((tc) => tc.id !== id));
              setPracticeActiveCaseIdx((idx) => Math.max(0, idx - 1));
            }}
            onUpdateTestCase={(idx, field, value) => {
              setTestCases((prev) =>
                prev.map((tc, i) => (i === idx ? { ...tc, [field]: value } : tc))
              );
            }}
            lastResult={practiceLastResult}
            consoleOutput={practiceConsoleOutput}
            cursorPos={practiceCursorPos}
            saveStatus={saveStatus}
            onForceSave={handleForceSave}
            fontSize={practiceFontSize}
            onChangeFontSize={(sz) => {
              setPracticeFontSize(sz);
              if (typeof window !== 'undefined') {
                try {
                  localStorage.setItem('cortex_practice_font_size', String(sz));
                } catch {}
              }
            }}
            tabSize={practiceTabSize}
            onChangeTabSize={(ts) => {
              setPracticeTabSize(ts);
              if (typeof window !== 'undefined') {
                try {
                  localStorage.setItem('cortex_practice_tab_size', String(ts));
                } catch {}
              }
            }}
            bottomTab={practiceBottomTab}
            onBottomTabChange={setPracticeBottomTab}
          />
        ) : (
          <>
        {/* 1. Header Navigation */}
        <div>
          <Navbar
            isDarkMode={isDarkMode}
            currentLanguage={currentLang}
            onLanguageChange={handleLanguageChange}
            onRun={handleRun}
            isRunning={isRunning}
            onDebug={handleStartDebug}
            isDebugging={isDebugging}
            onVisualize={handleRunTrace}
            isVisualizing={isTracing}
            layoutMode={editorLayoutMode}
            onLayoutModeChange={setEditorLayoutMode}
            autoFixEnabled={aiSettings.autoFixErrors}
            onToggleAutoFix={() =>
              setAiSettings((s) => ({ ...s, autoFixErrors: !s.autoFixErrors }))
            }
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenShare={() => setIsShareOpen(true)}
          />
        </div>

        {/* 2. Main Work Area: Standard 3-Pane IDE Workspace */}
        <div className={`flex-1 flex overflow-hidden ${isDarkMode ? 'bg-[#0b0c0e]' : 'bg-[#f1f5f9]'}`}>
              {/* Left Contextual Sidebar (Resizable width & Collapsible with smooth sliding animation) */}
              <div 
                ref={fileExplorerRef}
                style={{ 
                  width: isSidebarOpen ? `${sidebarWidth}px` : 0, 
                  minWidth: isSidebarOpen ? `${sidebarWidth}px` : 0, 
                  maxWidth: isSidebarOpen ? `${sidebarWidth}px` : 0,
                  opacity: isSidebarOpen ? 1 : 0,
                }} 
                className={`${isDarkMode ? 'bg-[#101114] border-[#1f2024]' : 'bg-white border-slate-200'} flex flex-col h-full shadow-md overflow-hidden shrink-0 ${
                  !isSidebarOpen ? 'border-r-0 pointer-events-none' : 'border-r'
                } ${
                  isResizingSidebar ? '' : 'transition-all duration-300 ease-in-out'
                }`}
              >
                <div 
                  style={{ 
                    width: `${sidebarWidth}px`, 
                    minWidth: `${sidebarWidth}px`,
                    transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
                  }} 
                  className={`h-full flex flex-col shrink-0 ${
                    isResizingSidebar ? '' : 'transition-transform duration-300 ease-in-out'
                  }`}
                >
                  {activeSidebarTab === 'files' && (
                <FileExplorer
                  width={sidebarWidth}
                  files={files}
                  activeFileId={activeFileId}
                  onSelectFile={handleSelectFile}
                  currentLanguage={currentLang}
                  onOpenFeedback={() => setIsFeedbackOpen(true)}
                  hasActiveError={Boolean((executionResult && executionResult.status !== 'success') || executionResult?.stderr?.trim())}
                  onUploadFiles={handleUploadFiles}
                  onDownloadFile={handleDownloadFile}
                  onCreateFile={async (name, isFolder, parentFolderId) => {
                    const parent = parentFolderId ? files.find((f) => f.id === parentFolderId) : null;
                    const parentPath = parent ? parent.path.replace(/\/$/, '') : '';
                    const detectedLangId = detectLanguage(name, '');
                    const detectedLang = getLanguageConfig(detectedLangId);
                    const starter = getStarterContentForFile(name, detectedLang);
                    const initialContent = isFolder ? '' : (starter || detectedLang.starterCode || '');
                    const path = parent ? `${parentPath}/${name}` : `/${name}`;
                    
                    if (projectId) {
                      try {
                        const res = await fetch(`/api/v1/projects/${projectId}/files`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name, path, content: initialContent, isFolder })
                        });
                        if (res.ok) {
                          const data = await res.json();
                          const newF = data.file;
                          setFiles((prev) => [...prev, newF]);
                          if (newF.updatedAt) lastFetchTimestampRef.current[newF.id] = newF.updatedAt;
                          if (!isFolder) {
                            setOpenFileIds((prev) => [...prev, newF.id]);
                            setActiveFileId(newF.id);
                            setCurrentLang(detectedLang);
                          }
                        }
                      } catch (e) { console.error(e); }
                    } else {
                      const newF: ProjectFile = {
                        id: `f_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                        name,
                        path,
                        content: initialContent,
                        isFolder,
                        parentId: parentFolderId,
                      };
                      setFiles((prev) => [...prev, newF]);
                      if (!isFolder) {
                        setOpenFileIds((prev) => [...prev, newF.id]);
                        setActiveFileId(newF.id);
                        setCurrentLang(detectedLang);
                      }
                    }
                  }}
                  onDeleteFile={async (id) => {
                    const getDescendantIds = (targetId: string): string[] => {
                      const children = files.filter((f) => f.parentId === targetId);
                      return [targetId, ...children.flatMap((c) => getDescendantIds(c.id))];
                    };
                    const toDelete = getDescendantIds(id);
                    if (toDelete.includes(activeFileId) && saveFileRef.current) {
                      clearTimeout(saveFileRef.current);
                      saveFileRef.current = null;
                    }
                    if (projectId) {
                       try {
                         await fetch(`/api/v1/projects/${projectId}/files/${id}`, { method: 'DELETE' });
                       } catch (e) { console.error(e); }
                    }
                    setFiles((prev) => prev.filter((f) => !toDelete.includes(f.id)));
                    setOpenFileIds((prev) => prev.filter((openId) => !toDelete.includes(openId)));
                    if (toDelete.includes(activeFileId)) {
                      const remainingOpen = openFileIds.filter((openId) => !toDelete.includes(openId));
                      if (remainingOpen[0]) {
                        handleSelectFile(remainingOpen[0]);
                      } else {
                        setActiveFileId('');
                      }
                    }
                  }}
                  onRenameFile={async (id, newName) => {
                    const f = files.find((x) => x.id === id);
                    const parentPath = f ? f.path.substring(0, f.path.lastIndexOf('/')) : '';
                    const newPath = parentPath === '' ? `/${newName}` : `${parentPath}/${newName}`;

                    if (projectId) {
                      if (id === activeFileId && saveFileRef.current) {
                        clearTimeout(saveFileRef.current);
                        saveFileRef.current = null;
                      }
                      try {
                        const renameRes = await fetch(`/api/v1/projects/${projectId}/files/${id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            name: newName,
                            path: newPath,
                            ...(id === activeFileId && f ? { content: f.content } : {}),
                          }),
                        });
                        await syncTimestampFromPatch(id, renameRes);
                        if (id === activeFileId && renameRes.ok) {
                          setSaveStatus('saved');
                        }
                      } catch (e) { console.error(e); }
                    }

                    if (id === activeFileId && f && !f.isFolder) {
                      // Clear override so new extension takes effect
                      setFileLanguageOverrides((prev) => {
                        const next = { ...prev };
                        delete next[id];
                        try {
                          localStorage.setItem('cortex_file_language_overrides', JSON.stringify(next));
                        } catch {}
                        return next;
                      });

                      // Re-detect language from new filename without explicit override
                      const detected = detectLanguage(newName, f.content, undefined, currentLang.id);
                      const conf = getLanguageConfig(detected);
                      if (conf) {
                        setCurrentLang(conf);
                      }
                    }

                    setFiles((prev) =>
                      prev.map((file) => {
                        if (file.id !== id) return file;
                        return {
                          ...file,
                          name: newName,
                          path: newPath,
                        };
                      })
                    );
                  }}
                  onExportProject={() => {
                    const zipData: Record<string, Uint8Array> = {};
                    files.forEach((f) => {
                      if (!f.isFolder) {
                        const cleanPath = f.path.replace(/^\/+/, '') || f.name;
                        const content = f.id === activeFileId ? (activeFile?.content || f.content || '') : (f.content || '');
                        zipData[cleanPath] = strToU8(content);
                      }
                    });
                    const zipped = zipSync(zipData);
                    const blob = new Blob([zipped as any], { type: 'application/zip' });
                    const url = URL.createObjectURL(blob);
                    const dl = document.createElement('a');
                    dl.href = url;
                    dl.download = `${projectId || 'cortex-project'}.zip`;
                    document.body.appendChild(dl);
                    dl.click();
                    document.body.removeChild(dl);
                    URL.revokeObjectURL(url);
                  }}
                  onImportProject={async (file) => {
                    if (!projectId) return;
                    const formData = new FormData();
                    formData.append('file', file);
                    
                    try {
                      const res = await fetch(`/api/v1/projects/${projectId}/import`, {
                        method: 'POST',
                        body: formData,
                      });
                      if (res.ok) {
                        const data = await res.json();
                        const importedFiles = data.files || [];
                        setFiles(importedFiles);
                        importedFiles.forEach((f: any) => {
                          if (f.updatedAt) lastFetchTimestampRef.current[f.id] = f.updatedAt;
                        });
                        if (importedFiles.length > 0) {
                           const firstFile = importedFiles.find((f: ProjectFile) => !f.isFolder);
                           if (firstFile) {
                             setActiveFileId(firstFile.id);
                             setOpenFileIds([firstFile.id]);
                           }
                        }
                      }
                    } catch (e) {
                      console.error('Import failed', e);
                    }
                  }}
                  isDarkMode={isDarkMode}
                />
              )}

              {activeSidebarTab === 'benchmark' && (
                <BenchmarkSidebar
                  width={sidebarWidth}
                  isDarkMode={isDarkMode}
                  onLoadCode={(code, lang) => {
                    const foundLang = SUPPORTED_LANGUAGES.find(
                      (l) => l.id === lang || l.monacoLang === lang
                    );
                    if (foundLang) handleLanguageChange(foundLang);
                    if (activeFile) {
                      setFiles((prev) =>
                        prev.map((f) => (f.id === activeFileId ? { ...f, content: code } : f))
                      );
                    }
                  }}
                />
              )}

              {activeSidebarTab === 'learn' && (
                <LearnSidebar
                  width={sidebarWidth}
                  isDarkMode={isDarkMode}
                  currentLanguage={currentLang?.id}
                  onLoadLesson={(code, lang, title) => {
                    const foundLang = SUPPORTED_LANGUAGES.find(
                      (l) => l.id === lang || l.monacoLang === lang
                    );
                    if (foundLang) handleLanguageChange(foundLang);
                    if (activeFile) {
                      setFiles((prev) =>
                        prev.map((f) => (f.id === activeFileId ? { ...f, content: code } : f))
                      );
                    }
                  }}
                />
              )}
            </div>
          </div>

          {/* Horizontal Resize Splitter */}
          <div
            onMouseDown={startResizingSidebar}
            style={{
              width: !isSidebarOpen ? 0 : undefined,
              opacity: !isSidebarOpen ? 0 : 1,
              pointerEvents: !isSidebarOpen ? 'none' : 'auto',
            }}
            className={`hover:w-1.5 ${isDarkMode ? 'bg-[#1f2024]' : 'bg-slate-200'} hover:bg-[#ff9100] active:bg-[#ff9100] cursor-col-resize z-20 select-none flex-shrink-0 ${
              !isSidebarOpen ? 'w-0 overflow-hidden' : 'w-1'
            } ${isResizingSidebar ? '' : 'transition-all duration-300 ease-in-out'}`}
            title="Drag to adjust sidebar size"
          />

          {/* Center & Bottom Area */}
          <div className={`flex-1 flex flex-col overflow-hidden ${isDarkMode ? 'bg-[#0b0c0e]' : 'bg-white'}`}>
            {/* Center Pane: Multi-Layout (Code, Visualize, Split View) */}
            <div className="flex-1 flex overflow-hidden relative">
              <div className={`${editorLayoutMode === 'visualize' ? 'hidden ' : ''}${editorLayoutMode === 'split' ? (isDarkMode ? 'w-1/2 border-r border-[#1f2024]' : 'w-1/2 border-r border-slate-200') : 'w-full'} h-full overflow-hidden relative select-text`} style={{ userSelect: 'text' }}>
                  <MonacoCodeEditor
                    files={files}
                    openFileIds={openFileIds}
                    activeFileId={activeFileId}
                    onSelectFile={handleSelectFile}
                    saveStatus={saveStatus}
                    onForceSave={handleForceSave}
                    onCloseFile={handleCloseFileTab}
                    onNewFile={handleCreateNewTabFile}
                    onContentChange={handleContentChange}
                    language={getMonacoLanguage(currentLang.id || activeFile?.name || '')}
                    theme={theme}
                    fontSize={fontSize}
                    breakpoints={breakpoints}
                    onToggleBreakpoint={toggleBreakpoint}
                    activeLine={activeDebugLine}
                    diagnostics={executionResult?.diagnostics}
                    onCursorChange={(l, c) => {
                      if (collabBrokerRef.current) {
                        collabBrokerRef.current.updateCursor(activeFileId, l, c);
                      }
                    }}
                    isDarkMode={isDarkMode}
                    onToggleDarkMode={handleToggleDarkMode}
                    isFullscreen={isFullscreen}
                    onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
                    quickFixResult={fixResult}
                    isQuickFixOpen={isQuickFixOpen}
                    onCloseQuickFix={() => setIsQuickFixOpen(false)}
                    onApplyExplanationComment={handleApplyExplanationComment}
                    onApplyLiveFix={handleApplyLiveFix}
                    aiProvider={aiSettings.provider === 'gemini' || Boolean(aiSettings.apiKey) ? 'gemini' : 'offline'}
                    apiKey={aiSettings.apiKey || ''}
                    onSaveApiKey={handleSaveApiKey}
                    isAnalyzingFix={isAnalyzingFix}
                    onReanalyzeWithKey={handleReanalyzeWithKey}
                    enableInlineSuggestions={enableInlineSuggestions}
                    onToggleInlineSuggestions={handleToggleInlineSuggestions}
                    onRun={handleRun}
                    isRunning={isRunning}
                    onDebug={handleStartDebug}
                    isDebugging={isDebugging}
                    isExecutable={currentLang.executable !== false}
                  />
              </div>

              {(editorLayoutMode === 'visualize' || editorLayoutMode === 'split') && (
                <div className={`${editorLayoutMode === 'split' ? 'w-1/2' : 'w-full'} h-full overflow-hidden relative`}>
                  <CodeVisualizationWorkspace
                    traceSession={traceSession}
                    isLoading={isTracing}
                    language={currentLang.id}
                    sourceCode={activeFile?.content || ''}
                    onRunTrace={handleRunTrace}
                    onStepChange={(line) => setActiveDebugLine(line)}
                    showSourcePane={editorLayoutMode === 'visualize'}
                  />
                </div>
              )}
            </div>

            {/* Vertical Resize Splitter */}
            {!isBottomCollapsed && (
              <div
                onMouseDown={startResizingDock}
                className={`h-1 hover:h-1.5 ${isDarkMode ? 'bg-[#1f2024]' : 'bg-slate-200'} hover:bg-[#ff9100] active:bg-[#ff9100] cursor-row-resize transition-all z-20 select-none flex-shrink-0`}
                title="Drag to adjust bottom bar size"
              />
            )}

            {/* Bottom Dock: Tabbed Panels with Resizable Height */}
            <div
              style={{ height: isBottomCollapsed ? 36 : dockHeight }}
              className={`border-t ${isDarkMode ? 'border-[#1f2024] bg-[#0b0c0e]' : 'border-slate-200 bg-slate-50'} flex flex-col ${
                isResizingDock ? '' : 'transition-all duration-150'
              }`}
            >
              {/* Dock Tab Selector Header */}
              <div className={`h-9 ${isDarkMode ? 'bg-[#101114] border-[#1f2024]' : 'bg-slate-100 border-slate-200'} flex items-center justify-between px-2 text-xs select-none border-b transition-colors`}>
                <div className="flex items-center space-x-1">
                  {[
                    { id: 'output', label: 'Output', icon: TermIcon },
                    { id: 'terminal', label: 'Terminal', icon: TermIcon },
                    { id: 'tests', label: 'Tests', icon: CheckSquare },
                    { id: 'ai', label: 'Assistant', icon: Sparkles },
                    { id: 'debug', label: 'Debugger', icon: Bug },
                    { id: 'preview', label: 'Preview', icon: Globe },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeBottomTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveBottomTab(tab.id as any);
                          setIsBottomCollapsed(false);
                        }}
                        className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded transition font-heading font-semibold text-xs tracking-wide border ${
                          isActive && !isBottomCollapsed
                            ? isDarkMode
                              ? 'bg-[#18191f] text-[#ff9100] border-transparent border-b-2 border-b-[#ff9100]'
                              : 'bg-white text-[#ff9100] border-slate-200 border-b-2 border-b-[#ff9100] shadow-sm'
                            : isDarkMode
                              ? 'text-gray-400 hover:text-gray-200 hover:bg-[#14151a] border-transparent'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200 hover:border-slate-300 border-transparent'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Right Side: Status Summary & Collapse Toggle */}
                <div className="flex items-center space-x-2">
                  {executionResult && !isBottomCollapsed && (
                    <div className={`hidden sm:flex items-center space-x-2 text-xs font-mono pr-2 border-r ${
                      isDarkMode ? 'text-gray-300 border-[#1f2024]' : 'text-slate-600 border-slate-300'
                    }`}>
                      <Badge variant={executionResult.status === 'success' ? 'emerald' : 'rose'} dot size="sm">
                        Exit {executionResult.exitCode}
                      </Badge>
                      <span>•</span>
                      <span>{executionResult.executionTimeMs}ms</span>
                    </div>
                  )}

                  <button
                    onClick={() => setIsBottomCollapsed(!isBottomCollapsed)}
                    className={`p-1 rounded transition border border-transparent ${
                      isDarkMode
                        ? 'text-gray-400 hover:text-white hover:bg-[#1c1e24]'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200 hover:border-slate-300'
                    }`}
                    title={isBottomCollapsed ? 'Expand Dock' : 'Collapse Dock'}
                  >
                    {isBottomCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Panel View Container */}
              {!isBottomCollapsed && (
                <div className="flex-1 overflow-hidden">
                  {activeBottomTab === 'output' && (
                    <OutputPanel
                      result={executionResult}
                      isRunning={isRunning}
                      isDarkMode={isDarkMode}
                      stdin={customStdin}
                      customStdin={customStdin}
                      onStdinChange={setCustomStdin}
                      onChangeCustomStdin={setCustomStdin}
                      onRun={handleRun}
                      onTriggerAutoFix={() => {
                        if (!activeFile) return;
                        processAutoFix(
                          activeFile.content,
                          executionResult?.stderr || '',
                          executionResult?.diagnostics || []
                        );
                      }}
                    />
                  )}
                  {activeBottomTab === 'terminal' && (
                    <TerminalPanel
                      files={files}
                      activeFileId={activeFileId}
                      onSyncFiles={setFiles}
                      isDarkMode={isDarkMode}
                      stdin={customStdin}
                      customStdin={customStdin}
                      onStdinChange={setCustomStdin}
                      onChangeCustomStdin={setCustomStdin}
                    />
                  )}
                  {activeBottomTab === 'tests' && (
                    <TestCasesPanel
                      testCases={testCases}
                      isDarkMode={isDarkMode}
                      onAddTestCase={(tc) =>
                        setTestCases((prev) => [...prev, { ...tc, id: `tc_${Date.now()}` }])
                      }
                      onDeleteTestCase={(id) =>
                        setTestCases((prev) => prev.filter((t) => t.id !== id))
                      }
                      onRunAllTests={() => handleRunAllTests()}
                      onRunBenchmark={handleRunBenchmark}
                      isRunningTests={isRunningTests}
                      benchmarkResult={benchmarkResult}
                      customStdin={customStdin}
                      onChangeCustomStdin={setCustomStdin}
                    />
                  )}
                  {activeBottomTab === 'ai' && (
                    <AIAssistantPanel
                      isDarkMode={isDarkMode}
                      currentCode={activeFile?.content || ''}
                      language={currentLang.id}
                      settings={aiSettings}
                      onUpdateSettings={(s) => setAiSettings((prev) => ({ ...prev, ...s }))}
                      onTriggerExplain={async () => {
                        if (!activeFile) return;
                        setAnalysisMode('explain');
                        setIsAnalyzingAI(true);
                        const res = await analyzeCode(activeFile.content, currentLang.id, aiSettings, 'explain');
                        setAiAnalysis(res);
                        setIsAnalyzingAI(false);
                      }}
                      onTriggerOptimize={async () => {
                        if (!activeFile) return;
                        setAnalysisMode('optimize');
                        setIsAnalyzingAI(true);
                        const res = await analyzeCode(activeFile.content, currentLang.id, aiSettings, 'optimize');
                        setAiAnalysis(res);
                        setIsAnalyzingAI(false);
                      }}
                      onTriggerRefactor={async () => {
                        if (!activeFile) return;
                        setAnalysisMode('refactor');
                        setIsAnalyzingAI(true);
                        const res = await analyzeCode(activeFile.content, currentLang.id, aiSettings, 'refactor');
                        setAiAnalysis(res);
                        setIsAnalyzingAI(false);
                      }}
                      onTriggerConvert={async (toLang) => {
                        if (!activeFile) return;
                        const res = await convertCode(activeFile.content, currentLang.id, toLang);
                        const targetLangConfig = getLanguageConfig(toLang);
                        setCurrentLang(targetLangConfig);
                        handleContentChange(res.convertedCode);
                      }}
                      onTriggerAutoFix={() => {
                        if (!activeFile) return;
                        processAutoFix(
                          activeFile.content,
                          executionResult?.stderr || '',
                          executionResult?.diagnostics || []
                        );
                      }}
                      analysisResult={aiAnalysis}
                      isAnalyzing={isAnalyzingAI}
                      analysisMode={analysisMode}
                    />
                  )}
                  {activeBottomTab === 'debug' && (
                    <DebuggerPanel
                      isDarkMode={isDarkMode}
                      isDebugging={isDebugging}
                      onStartDebug={handleStartDebug}
                      onStopDebug={handleStopDebug}
                      onStepOver={handleStepOver}
                      onStepInto={() => handleStepOver()}
                      onStepOut={() => handleStepOver()}
                      onResume={() => handleStepOver()}
                      breakpoints={breakpoints}
                      onToggleBreakpoint={toggleBreakpoint}
                      activeLine={activeDebugLine}
                      variables={parsedDebugInfo.variables}
                      callStack={parsedDebugInfo.callStack}
                    />
                  )}
                  {activeBottomTab === 'preview' && (
                    <WebPreviewPanel
                      files={files}
                      isDarkMode={isDarkMode}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
          </>
        )}

        {/* 3. Global Modals */}
        <DiffModal
          isOpen={isDiffModalOpen}
          onClose={() => setIsDiffModalOpen(false)}
          fixResult={fixResult}
          onApplyFix={() => fixResult && applyFixAndReverify(fixResult)}
          onUndo={handleUndoFix}
          canUndo={previousCodeSnapshot !== null}
        />

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          aiSettings={aiSettings}
          onUpdateAISettings={(s) => {
            setAiSettings((prev) => ({ ...prev, ...s }));
            if (s.enableInlineSuggestions !== undefined) {
              setEnableInlineSuggestions(s.enableInlineSuggestions);
            }
          }}
          fontSize={fontSize}
          onChangeFontSize={setFontSize}
          theme={theme}
          onChangeTheme={handleThemeChange}
          isDarkMode={isDarkMode}
        />

        <ShareModal
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          projectName={`${currentLang.name} Sandbox`}
          projectId={projectId}
          activeFileName={activeFile?.name}
          activeFileContent={activeFile?.content}
        />

        <FeedbackModal
          isOpen={isFeedbackOpen}
          onClose={() => setIsFeedbackOpen(false)}
          diagnostics={{
            language: currentLang.name,
            activeFile: activeFile?.name || 'none',
            executionStatus: executionResult?.status,
            exitCode: executionResult?.exitCode,
            stderr: executionResult?.stderr,
            diagnosticsList: executionResult?.diagnostics,
            codeSnippet: activeFile?.content ? activeFile.content.slice(0, 2000) : undefined,
            systemInfo: typeof window !== 'undefined' ? {
              userAgent: navigator.userAgent,
              platform: navigator.platform,
              url: window.location.href,
            } : undefined,
          }}
        />

        {/* Semantic Search Engine Crawler Content (Screen-reader & Search Engine Indexable) */}
        <section className="sr-only" aria-label="Cortex Platform Semantic SEO Overview">
          <h1>Free Online Compiler, Cloud IDE & AI Code Debugger — Cortex</h1>
          <p>
            Cortex is an advanced online code compiler, free online programming environment, and cloud IDE supporting 16+ programming languages. Execute code online, run Python online, compile C++ online, test Java online, and transpile TypeScript in your browser with zero installation.
          </p>

          <h2>Supported Online Compilers & Runtimes</h2>
          <ul>
            <li><a href="/python-online-compiler">Python Online Compiler & Cloud IDE (Python 3.12)</a> - run Python online, online Python debugger, free Python compiler.</li>
            <li><a href="/cpp-online-compiler">C++ Online Compiler (C++20/C++23 GCC)</a> - online C++ compiler, compile C++ online, free C++ IDE.</li>
            <li><a href="/c-online-compiler">C Online Compiler (GCC)</a> - run C online, online C compiler with stdin and memory inspection.</li>
            <li><a href="/java-online-compiler">Java Online Compiler (OpenJDK 21 LTS)</a> - online Java compiler, Java online IDE, run Java code online.</li>
            <li><a href="/javascript-online-compiler">JavaScript Online Compiler & Node.js IDE</a> - execute JavaScript online with live Web Preview and npm runner.</li>
            <li><a href="/typescript-online-compiler">TypeScript Online Compiler & Playground</a> - run TypeScript online with strict type checking.</li>
            <li><a href="/rust-online-compiler">Rust Online Compiler & Cargo Playground</a> - compile Rust online with borrow checker auto-fix.</li>
            <li><a href="/go-online-compiler">Go Online Compiler (Golang)</a> - online Go compiler with concurrency and goroutines.</li>
            <li><a href="/csharp-online-compiler">C# Online Compiler (.NET 8)</a> - run C# online with LINQ and async/await.</li>
            <li><a href="/php-online-compiler">PHP Online Compiler (PHP 8.3)</a> - online PHP script runner.</li>
            <li><a href="/ruby-online-compiler">Ruby Online Compiler (Ruby 3.3)</a> - run Ruby online with interactive terminal.</li>
            <li><a href="/kotlin-online-compiler">Kotlin Online Compiler & Playground</a> - compile Kotlin online for JVM.</li>
            <li><a href="/swift-online-compiler">Swift Online Compiler</a> - write Swift online without a Mac.</li>
            <li><a href="/dart-online-compiler">Dart Online Compiler</a> - compile Dart 3 with null safety.</li>
            <li><a href="/r-online-compiler">R Online Compiler & Statistics IDE</a> - run R online for statistical computing.</li>
            <li><a href="/sql-online-editor">SQL Online Editor & Database Compiler</a> - execute ANSI SQL queries online with table outputs.</li>
          </ul>

          <h2>AI Coding Assistant & Error Fixer</h2>
          <p>
            Fix coding errors with AI, explain compiler errors, automatic code fixing, AI code debugger, and algorithm performance analyzer powered by Google Gemini 2.5 Flash.
          </p>

          <h2>Cloud Development & Competitive Programming Practice</h2>
          <p>
            Practice competitive programming challenges, online coding tests, algorithm practice, and benchmark execution latency and memory consumption.
          </p>
          <nav aria-label="Core Navigation">
            <a href="/ide">Universal Online IDE & Cloud Compiler</a>
            <a href="/compare">Algorithm Benchmark & Dual Code Comparison</a>
          </nav>
        </section>
      </div>
    </AppShell>
  );
}

export default function CloudIDEPage() {
  return (
    <IdeErrorBoundary>
      <CloudIDEPageInner />
    </IdeErrorBoundary>
  );
}
