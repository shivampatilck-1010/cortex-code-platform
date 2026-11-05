/**
 * Cortex Universal Live Code Visualization Engine
 * Language Adapter Registry and Capabilities Matrix
 */

import { TracingCapabilities, LanguageSupportMatrixRow, TraceSession } from './types';
import { ProjectFile } from '../execution/types';

export interface LanguageTracingAdapter {
  languageId: string;
  name: string;
  runtimeVersion: string;
  capabilities: TracingCapabilities;
  prepareTracedExecution: (
    files: ProjectFile[],
    entrypoint?: string,
    stdin?: string
  ) => {
    tracedFiles: ProjectFile[];
    entrypoint: string;
    stdin?: string;
  };
  parseTraceOutput: (
    stdout: string,
    stderr: string,
    exitCode: number,
    executionTimeMs: number
  ) => TraceSession;
}

const adapters: Map<string, LanguageTracingAdapter> = new Map();

export function registerAdapter(adapter: LanguageTracingAdapter) {
  adapters.set(adapter.languageId.toLowerCase(), adapter);
}

export function getAdapter(languageId: string): LanguageTracingAdapter | undefined {
  return adapters.get(languageId.toLowerCase());
}

export function hasTracingSupport(languageId: string): boolean {
  if (!languageId) return false;
  const normalized = languageId.toLowerCase().trim();
  const adapter = getAdapter(normalized);
  if (adapter && (adapter.capabilities.verificationStatus === 'verified' || adapter.capabilities.verificationStatus === 'preview')) {
    return true;
  }
  const matrixRow = LANGUAGE_SUPPORT_MATRIX.find((m) => m.language === normalized);
  return !!matrixRow && (matrixRow.verificationStatus === 'verified' || matrixRow.verificationStatus === 'preview');
}

/**
 * Universal Language Support Matrix
 * Audits every language supported by Cortex, its runtime version, execution backend,
 * and current tracing capability status.
 */
export const LANGUAGE_SUPPORT_MATRIX: LanguageSupportMatrixRow[] = [
  {
    language: 'python',
    name: 'Python',
    executionBackend: 'CPython 3.12+ (Linux Sandbox / Judge0 / Local)',
    runtimeVersion: '3.12.5',
    existingExecutionStatus: 'supported',
    tracingImplementation: 'Native sys.settrace Frame & Scope Introspection',
    sourceLineSupport: true,
    variableInspection: true,
    callStackInspection: true,
    objectCollectionInspection: true,
    timelineNavigation: true,
    reverseHistorySupport: true,
    asyncConcurrencySupport: false,
    knownLimitations: [
      'High-frequency loops capped at maximum event ceiling (default 1000 events) to prevent timeouts.',
      'C-extension internal frames (e.g. built-in math) are represented at boundary call level.',
    ],
    verificationStatus: 'verified',
  },
  {
    language: 'javascript',
    name: 'JavaScript (Node.js)',
    executionBackend: 'V8 / Node.js 22 LTS (Linux Sandbox / Judge0 / Local)',
    runtimeVersion: '22.08.0',
    existingExecutionStatus: 'supported',
    tracingImplementation: 'V8 Runtime Scope Instrumentation Tracer',
    sourceLineSupport: true,
    variableInspection: true,
    callStackInspection: true,
    objectCollectionInspection: true,
    timelineNavigation: true,
    reverseHistorySupport: true,
    asyncConcurrencySupport: false,
    knownLimitations: [
      'Asynchronous microtasks and Promises are traced sequentially at checkpoint boundaries.',
    ],
    verificationStatus: 'verified',
  },
  {
    language: 'typescript',
    name: 'TypeScript',
    executionBackend: 'TypeScript 5.6 + Node.js 22 LTS',
    runtimeVersion: '5.6.2',
    existingExecutionStatus: 'supported',
    tracingImplementation: 'TypeScript Source-Map & Transpiled V8 Tracer',
    sourceLineSupport: true,
    variableInspection: true,
    callStackInspection: true,
    objectCollectionInspection: true,
    timelineNavigation: true,
    reverseHistorySupport: true,
    asyncConcurrencySupport: false,
    knownLimitations: [
      'Complex type assertions and interfaces are erased at runtime; values are inspected by runtime shape.',
    ],
    verificationStatus: 'preview',
  },
  {
    language: 'cpp',
    name: 'C++',
    executionBackend: 'GCC 14.1.0',
    runtimeVersion: '14.1.0',
    existingExecutionStatus: 'supported',
    tracingImplementation: 'GDB / LLDB / Sanitizer Instrumentation (Planned)',
    sourceLineSupport: false,
    variableInspection: false,
    callStackInspection: false,
    objectCollectionInspection: false,
    timelineNavigation: false,
    reverseHistorySupport: false,
    asyncConcurrencySupport: false,
    knownLimitations: [
      'Program execution is available; internal visualization is not supported by this runtime yet.',
      'Requires debug symbol extraction (-g3 -O0) and DWARF parsing backend.',
    ],
    verificationStatus: 'planned',
  },
  {
    language: 'c',
    name: 'C',
    executionBackend: 'GCC 14.1.0',
    runtimeVersion: '14.1.0',
    existingExecutionStatus: 'supported',
    tracingImplementation: 'GCC Debug Hook / Sanitizer Instrumentation (Planned)',
    sourceLineSupport: false,
    variableInspection: false,
    callStackInspection: false,
    objectCollectionInspection: false,
    timelineNavigation: false,
    reverseHistorySupport: false,
    asyncConcurrencySupport: false,
    knownLimitations: [
      'Program execution is available; internal visualization is not supported by this runtime yet.',
    ],
    verificationStatus: 'planned',
  },
  {
    language: 'java',
    name: 'Java',
    executionBackend: 'OpenJDK 17 LTS',
    runtimeVersion: '17.0.6',
    existingExecutionStatus: 'supported',
    tracingImplementation: 'JVMTI / JDI Debugger Agent (Planned)',
    sourceLineSupport: false,
    variableInspection: false,
    callStackInspection: false,
    objectCollectionInspection: false,
    timelineNavigation: false,
    reverseHistorySupport: false,
    asyncConcurrencySupport: false,
    knownLimitations: [
      'Program execution is available; internal visualization is not supported by this runtime yet.',
      'Requires JVM agent attachment with byte-code instrumentation.',
    ],
    verificationStatus: 'planned',
  },
  {
    language: 'csharp',
    name: 'C#',
    executionBackend: 'Mono / .NET 8',
    runtimeVersion: '6.6.0.161',
    existingExecutionStatus: 'supported',
    tracingImplementation: 'Mono Soft Debugger / CoreCLR Diagnostics (Planned)',
    sourceLineSupport: false,
    variableInspection: false,
    callStackInspection: false,
    objectCollectionInspection: false,
    timelineNavigation: false,
    reverseHistorySupport: false,
    asyncConcurrencySupport: false,
    knownLimitations: [
      'Program execution is available; internal visualization is not supported by this runtime yet.',
    ],
    verificationStatus: 'planned',
  },
  {
    language: 'go',
    name: 'Go',
    executionBackend: 'Go 1.23',
    runtimeVersion: '1.23.5',
    existingExecutionStatus: 'supported',
    tracingImplementation: 'Delve Headless API / AST Rewrite (Planned)',
    sourceLineSupport: false,
    variableInspection: false,
    callStackInspection: false,
    objectCollectionInspection: false,
    timelineNavigation: false,
    reverseHistorySupport: false,
    asyncConcurrencySupport: false,
    knownLimitations: [
      'Program execution is available; internal visualization is not supported by this runtime yet.',
    ],
    verificationStatus: 'planned',
  },
  {
    language: 'rust',
    name: 'Rust',
    executionBackend: 'Rustc / Cargo 1.85',
    runtimeVersion: '1.85.0',
    existingExecutionStatus: 'supported',
    tracingImplementation: 'LLDB Machine Interface / DWARF (Planned)',
    sourceLineSupport: false,
    variableInspection: false,
    callStackInspection: false,
    objectCollectionInspection: false,
    timelineNavigation: false,
    reverseHistorySupport: false,
    asyncConcurrencySupport: false,
    knownLimitations: [
      'Program execution is available; internal visualization is not supported by this runtime yet.',
    ],
    verificationStatus: 'planned',
  },
  {
    language: 'php',
    name: 'PHP',
    executionBackend: 'PHP 8.3',
    runtimeVersion: '8.3.11',
    existingExecutionStatus: 'supported',
    tracingImplementation: 'Xdebug / tick-function introspection (Planned)',
    sourceLineSupport: false,
    variableInspection: false,
    callStackInspection: false,
    objectCollectionInspection: false,
    timelineNavigation: false,
    reverseHistorySupport: false,
    asyncConcurrencySupport: false,
    knownLimitations: [
      'Program execution is available; internal visualization is not supported by this runtime yet.',
    ],
    verificationStatus: 'planned',
  },
  {
    language: 'ruby',
    name: 'Ruby',
    executionBackend: 'Ruby 2.7',
    runtimeVersion: '2.7.0',
    existingExecutionStatus: 'supported',
    tracingImplementation: 'TracePoint API (Planned)',
    sourceLineSupport: false,
    variableInspection: false,
    callStackInspection: false,
    objectCollectionInspection: false,
    timelineNavigation: false,
    reverseHistorySupport: false,
    asyncConcurrencySupport: false,
    knownLimitations: [
      'Program execution is available; internal visualization is not supported by this runtime yet.',
    ],
    verificationStatus: 'planned',
  },
  {
    language: 'kotlin',
    name: 'Kotlin',
    executionBackend: 'Kotlin 2.1 / JVM',
    runtimeVersion: '2.1.10',
    existingExecutionStatus: 'supported',
    tracingImplementation: 'JVMTI Kotlin debug extension (Planned)',
    sourceLineSupport: false,
    variableInspection: false,
    callStackInspection: false,
    objectCollectionInspection: false,
    timelineNavigation: false,
    reverseHistorySupport: false,
    asyncConcurrencySupport: false,
    knownLimitations: [
      'Program execution is available; internal visualization is not supported by this runtime yet.',
    ],
    verificationStatus: 'planned',
  },
  {
    language: 'swift',
    name: 'Swift',
    executionBackend: 'Swift 5.2 Linux',
    runtimeVersion: '5.2.3',
    existingExecutionStatus: 'supported',
    tracingImplementation: 'LLDB Swift plugin (Planned)',
    sourceLineSupport: false,
    variableInspection: false,
    callStackInspection: false,
    objectCollectionInspection: false,
    timelineNavigation: false,
    reverseHistorySupport: false,
    asyncConcurrencySupport: false,
    knownLimitations: [
      'Program execution is available; internal visualization is not supported by this runtime yet.',
    ],
    verificationStatus: 'planned',
  },
  {
    language: 'r',
    name: 'R',
    executionBackend: 'R 4.4.1',
    runtimeVersion: '4.4.1',
    existingExecutionStatus: 'supported',
    tracingImplementation: 'trace() / browser() hook (Planned)',
    sourceLineSupport: false,
    variableInspection: false,
    callStackInspection: false,
    objectCollectionInspection: false,
    timelineNavigation: false,
    reverseHistorySupport: false,
    asyncConcurrencySupport: false,
    knownLimitations: [
      'Program execution is available; internal visualization is not supported by this runtime yet.',
    ],
    verificationStatus: 'planned',
  },
  {
    language: 'dart',
    name: 'Dart',
    executionBackend: 'Dart SDK 2.19',
    runtimeVersion: '2.19.2',
    existingExecutionStatus: 'supported',
    tracingImplementation: 'Dart VM Service Protocol (Planned)',
    sourceLineSupport: false,
    variableInspection: false,
    callStackInspection: false,
    objectCollectionInspection: false,
    timelineNavigation: false,
    reverseHistorySupport: false,
    asyncConcurrencySupport: false,
    knownLimitations: [
      'Program execution is available; internal visualization is not supported by this runtime yet.',
    ],
    verificationStatus: 'planned',
  },
  {
    language: 'sql',
    name: 'SQL (SQLite)',
    executionBackend: 'SQLite 3.27.2',
    runtimeVersion: '3.27.2',
    existingExecutionStatus: 'supported',
    tracingImplementation: 'EXPLAIN QUERY PLAN & VDBE Step Trace (Planned)',
    sourceLineSupport: false,
    variableInspection: false,
    callStackInspection: false,
    objectCollectionInspection: false,
    timelineNavigation: false,
    reverseHistorySupport: false,
    asyncConcurrencySupport: false,
    knownLimitations: [
      'Program execution is available; internal visualization is not supported by this runtime yet.',
    ],
    verificationStatus: 'planned',
  },
];
