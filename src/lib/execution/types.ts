export interface ProjectFile {
  id: string;
  name: string;
  path: string;
  content: string;
  isFolder?: boolean;
  isOpen?: boolean;
  parentId?: string;
}

export interface ExecutionRequest {
  language: string;
  version?: string;
  files: ProjectFile[];
  entrypoint?: string;
  stdin?: string;
  args?: string[];
  compileTimeoutMs?: number;
  runTimeoutMs?: number;
  memoryLimitMb?: number;
}

export interface DiagnosticError {
  line: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  source?: string;
}

export interface ExecutionResult {
  status: 'success' | 'compilation_error' | 'runtime_error' | 'timeout' | 'memory_limit_exceeded';
  exitCode: number;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  memoryUsageMb: number;
  compileOutput?: string;
  diagnostics?: DiagnosticError[];
  timestamp: string;
  provider: 'cloud_sandbox' | 'local_worker' | 'docker_isolated';
}

export interface TestCase {
  id: string;
  name: string;
  stdin: string;
  expectedStdout: string;
  isHidden?: boolean;
  actualStdout?: string;
  passed?: boolean;
  timeMs?: number;
  memoryMb?: number;
  error?: string;
}

export interface BenchmarkMetrics {
  iterations: number;
  averageTimeMs: number;
  minTimeMs: number;
  maxTimeMs: number;
  memoryUsageMb: number;
  approxComplexity: string;
}
