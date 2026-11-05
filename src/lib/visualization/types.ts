/**
 * Cortex Universal Live Code Visualization Engine
 * Universal Execution Interface and Event Schema
 * 
 * Defines language-neutral, versioned execution event schema, state models,
 * trace metadata, adapter capability contracts, and structure visualization types.
 */

export type VisualizationEventType =
  | 'program_start'
  | 'line_executed'
  | 'scope_enter'
  | 'scope_exit'
  | 'variable_created'
  | 'variable_changed'
  | 'function_call'
  | 'function_return'
  | 'collection_changed'
  | 'output'
  | 'exception'
  | 'program_end';

export interface ScopeInfo {
  id: string;
  name: string;
  depth: number;
}

export interface CallStackFrame {
  name: string;
  file: string;
  line: number;
  scopeId?: string;
}

export interface VariableRecord {
  name: string;
  value: any;
  type: string;
  scopeId?: string;
  previousValue?: any;
  isParameter?: boolean;
}

export interface CollectionRecord {
  name: string;
  type: 'list' | 'dict' | 'set' | 'tuple' | 'custom' | 'array';
  operation: 'insert' | 'append' | 'remove' | 'pop' | 'update' | 'swap' | 'compare' | 'slice';
  index?: any;
  key?: any;
  value?: any;
  previousValue?: any;
  size?: number;
  elements?: any[];
}

export interface CallRecord {
  functionName: string;
  arguments: Record<string, any>;
  file: string;
  line: number;
}

export interface ReturnRecord {
  functionName: string;
  returnValue: any;
  type: string;
}

export interface OutputRecord {
  stream: 'stdout' | 'stderr';
  text: string;
}

export interface ExceptionRecord {
  type: string;
  message: string;
  traceback?: string;
  line?: number;
}

export type StructureCategory =
  | 'array'
  | 'stack'
  | 'queue'
  | 'linked_list'
  | 'tree'
  | 'graph'
  | 'recursion'
  | 'sort'
  | 'search'
  | 'object';

export interface StructureHint {
  category: StructureCategory;
  label: string;
  data: any;
}

/**
 * Universal trace event emitted during program execution
 */
export interface TraceEvent {
  id: string;
  seq: number;
  sessionId: string;
  timestamp: number;
  type: VisualizationEventType;
  file: string;
  line: number;
  column?: number;
  scope?: ScopeInfo;
  callStack?: CallStackFrame[];
  variable?: VariableRecord;
  collection?: CollectionRecord;
  call?: CallRecord;
  return?: ReturnRecord;
  output?: OutputRecord;
  exception?: ExceptionRecord;
  structureHint?: StructureHint;
  rawDetails?: string;
}

/**
 * Capabilities declared by a language tracing adapter
 */
export interface TracingCapabilities {
  sourceLineTracing: boolean;
  variableInspection: boolean;
  callStackTracing: boolean;
  objectCollectionInspection: boolean;
  exceptionTracing: boolean;
  stepNavigation: boolean;
  reverseNavigation: boolean;
  asyncTaskTracing: boolean;
  concurrencyTracing: boolean;
  knownLimitations: string[];
  verificationStatus: 'verified' | 'preview' | 'planned' | 'unsupported';
}

/**
 * Metadata accompanying a collected trace
 */
export interface TraceMetadata {
  language: string;
  runtimeVersion: string;
  adapterName: string;
  totalEvents: number;
  truncated: boolean;
  maxEventsLimit: number;
  executionTimeMs: number;
  capabilities: TracingCapabilities;
  completeness: 'full' | 'partial' | 'truncated' | 'unavailable';
  warnings: string[];
}

/**
 * Complete trace session returned from execution event collector
 */
export interface TraceSession {
  sessionId: string;
  status: 'success' | 'runtime_error' | 'timeout' | 'error';
  events: TraceEvent[];
  metadata: TraceMetadata;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ExecutionExplanation {
  headline: string;
  detail: string;
  category: 'assignment' | 'call' | 'return' | 'loop' | 'output' | 'exception' | 'start' | 'end' | 'general';
  affectedVariable?: string;
  affectedLine?: number;
  observedOperation?: string;
}

/**
 * Deterministic execution state snapshot reconstructed at step index k
 */
export interface ExecutionStateSnapshot {
  stepIndex: number;
  totalSteps: number;
  currentEvent: TraceEvent;
  currentLine: number;
  currentFile: string;
  previousLine?: number;
  variables: Record<string, VariableRecord>;
  changedVariables: string[];
  callStack: CallStackFrame[];
  outputHistory: string;
  activeException?: ExceptionRecord;
  collections: Record<string, CollectionRecord>;
  structureVisualizations: StructureHint[];
  explanation?: ExecutionExplanation;
}

/**
 * Navigation state for the visualization workspace
 */
export interface TimelineState {
  currentStep: number;
  totalSteps: number;
  isPlaying: boolean;
  playbackSpeed: number; // steps per second (e.g. 1, 2, 4)
}

/**
 * Language support matrix row
 */
export interface LanguageSupportMatrixRow {
  language: string;
  name: string;
  executionBackend: string;
  runtimeVersion: string;
  existingExecutionStatus: 'supported' | 'unsupported';
  tracingImplementation: string;
  sourceLineSupport: boolean;
  variableInspection: boolean;
  callStackInspection: boolean;
  objectCollectionInspection: boolean;
  timelineNavigation: boolean;
  reverseHistorySupport: boolean;
  asyncConcurrencySupport: boolean;
  knownLimitations: string[];
  verificationStatus: 'verified' | 'preview' | 'planned' | 'unsupported';
}
