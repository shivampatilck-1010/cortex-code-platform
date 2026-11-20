import { ProjectFile, ExecutionResult, TestCase, BenchmarkMetrics } from '@/lib/execution/types';
import { LanguageConfig } from '@/config/languages';
import { TraceSession } from '@/lib/visualization/types';
import { AISettings, AIAnalysisResult, AIFixResult } from '@/lib/ai/assistant';

export type EditorLayoutMode = 'code' | 'visualize' | 'split';

export type BottomPanelTab = 'output' | 'terminal' | 'tests' | 'ai' | 'debug' | 'preview';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface IdeLayoutState {
  sidebarWidth: number;
  dockHeight: number;
  isExplorerCollapsed: boolean;
  isBottomCollapsed: boolean;
  editorLayoutMode: EditorLayoutMode;
  activeBottomTab: BottomPanelTab;
  isFullscreen: boolean;
}

export interface IdeFileState {
  files: ProjectFile[];
  activeFileId: string | null;
  activeFile: ProjectFile | null;
  saveStatus: SaveStatus;
  currentLang: LanguageConfig;
}

export interface IdeExecutionState {
  isRunning: boolean;
  isTracing: boolean;
  isRunningTests: boolean;
  executionResult: ExecutionResult | null;
  traceSession: TraceSession | null;
  testCases: TestCase[];
  benchmarkResult: BenchmarkMetrics | null;
  customStdin: string;
}

export interface IdeDebuggerState {
  isDebugging: boolean;
  breakpoints: number[];
  activeDebugLine?: number;
}
