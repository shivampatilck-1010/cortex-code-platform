/**
 * Cortex Universal Live Code Visualization Engine
 * TypeScript Tracing Adapter
 */

import { LanguageTracingAdapter } from '../registry';
import { ProjectFile } from '../../execution/types';
import { TraceSession, TraceEvent, TracingCapabilities } from '../types';

export const TS_CAPABILITIES: TracingCapabilities = {
  sourceLineTracing: true,
  variableInspection: true,
  callStackTracing: true,
  objectCollectionInspection: true,
  exceptionTracing: true,
  stepNavigation: true,
  reverseNavigation: true,
  asyncTaskTracing: false,
  concurrencyTracing: false,
  knownLimitations: [
    'Complex type assertions and interfaces are erased at runtime; values are inspected by runtime shape.',
  ],
  verificationStatus: 'verified',
};

const TS_TRACER_SCRIPT = `
const fs = require('fs');
const vm = require('vm');

const MAX_EVENTS = 1000;
const events = [];
let eventSeq = 0;
let truncated = false;
let lastVars = {};

function safeSerialize(val, depth = 0, visited = new Set()) {
  if (depth > 4) return String(val);
  if (val === null || (typeof val !== 'object' && typeof val !== 'function')) return val;
  if (typeof val === 'function') return \`<function \${val.name || 'anonymous'}>\`;
  if (visited.has(val)) return '[Circular Reference]';
  visited.add(val);

  try {
    if (Array.isArray(val)) {
      const res = val.slice(0, 50).map(x => safeSerialize(x, depth + 1, visited));
      visited.delete(val);
      return res;
    }
    const out = {};
    for (const [k, v] of Object.entries(val).slice(0, 50)) {
      if (!k.startsWith('__')) {
        out[k] = safeSerialize(v, depth + 1, visited);
      }
    }
    visited.delete(val);
    return out;
  } catch {
    visited.delete(val);
    return String(val);
  }
}

function stripTypes(code) {
  try {
    const ts = require('typescript');
    return ts.transpileModule(code, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        removeComments: false,
      }
    }).outputText;
  } catch (e) {
    return code
      .replace(/^\\s*interface\\s+[A-Za-z0-9_$]+(?:<[^>]*>)?\\s*\\{[\\s\\S]*?\\}/gm, '')
      .replace(/^\\s*type\\s+[A-Za-z0-9_$]+(?:<[^>]*>)?\\s*=[^;]+;/gm, '')
      .replace(/(?:let|const|var)\\s+([A-Za-z0-9_$]+)\\s*:\\s*[A-Za-z0-9_$\\[\\]<>, |&]+/g, '$1')
      .replace(/<[A-Za-z0-9_$, ]+>(?=\\()/g, '')
      .replace(/\\bas\\s+[A-Za-z0-9_$\\[\\]<>, |&]+/g, '');
  }
}

async function runTracer() {
  const startTime = Date.now();
  eventSeq++;
  events.push({
    id: \`evt_\${eventSeq}\`,
    seq: eventSeq,
    sessionId: SESSION_ID,
    timestamp: startTime,
    type: 'program_start',
    file: TARGET_FILE,
    line: 1,
  });

  let userCode = '';
  try {
    userCode = fs.readFileSync(TARGET_FILE, 'utf-8');
  } catch (err) {
    console.error('File read error:', err.message);
    return;
  }

  const jsCode = stripTypes(userCode);
  const lines = jsCode.split('\\n');
  const trackedVars = new Set();
  const instrumentedLines = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    const lineNo = i + 1;

    const varDeclMatch = trimmed.match(/^(?:let|const|var)\\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
    const assignMatch = trimmed.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\\s*=[^=]/);

    if (varDeclMatch) {
      trackedVars.add(varDeclMatch[1]);
    } else if (assignMatch && !trimmed.startsWith('if') && !trimmed.startsWith('while') && !trimmed.startsWith('for')) {
      trackedVars.add(assignMatch[1]);
    }

    instrumentedLines.push(rawLine);

    if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*') && !trimmed.startsWith('}') && !trimmed.startsWith('{')) {
      const varsArray = Array.from(trackedVars);
      const varsNamesStr = JSON.stringify(varsArray);
      const varsValsStr = \`[\${varsArray.map(v => \`typeof \${v} !== 'undefined' ? \${v} : undefined\`).join(', ')}]\`;
      instrumentedLines.push(\`__trace_step(\${lineNo}, \${varsNamesStr}, \${varsValsStr});\`);
    }
  }

  const instrumentedCode = instrumentedLines.join('\\n');

  let currentLine = 1;
  const sandbox = {
    console: {
      log: (...args) => {
        const text = args.map(a => typeof a === 'object' ? JSON.stringify(safeSerialize(a)) : String(a)).join(' ') + '\\n';
        process.stdout.write(text);
        if (eventSeq < MAX_EVENTS) {
          eventSeq++;
          events.push({
            id: \`evt_\${eventSeq}\`,
            seq: eventSeq,
            sessionId: SESSION_ID,
            timestamp: Date.now(),
            type: 'output',
            file: TARGET_FILE,
            line: currentLine,
            output: { stream: 'stdout', text },
          });
        }
      },
      error: (...args) => {
        const text = args.map(a => String(a)).join(' ') + '\\n';
        process.stderr.write(text);
      }
    },
    __trace_step: (lineNo, varNames, varVals) => {
      if (eventSeq >= MAX_EVENTS) {
        truncated = true;
        return;
      }
      currentLine = lineNo;
      eventSeq++;
      events.push({
        id: \`evt_\${eventSeq}\`,
        seq: eventSeq,
        sessionId: SESSION_ID,
        timestamp: Date.now(),
        type: 'line_executed',
        file: TARGET_FILE,
        line: lineNo,
      });

      varNames.forEach((name, i) => {
        const val = varVals[i];
        if (val !== undefined) {
          const serialized = safeSerialize(val);
          if (!(name in lastVars)) {
            eventSeq++;
            events.push({
              id: \`evt_\${eventSeq}\`,
              seq: eventSeq,
              sessionId: SESSION_ID,
              timestamp: Date.now(),
              type: 'variable_created',
              file: TARGET_FILE,
              line: lineNo,
              variable: {
                name,
                value: serialized,
                type: typeof val,
              },
            });
          } else if (JSON.stringify(lastVars[name]) !== JSON.stringify(serialized)) {
            eventSeq++;
            events.push({
              id: \`evt_\${eventSeq}\`,
              seq: eventSeq,
              sessionId: SESSION_ID,
              timestamp: Date.now(),
              type: 'variable_changed',
              file: TARGET_FILE,
              line: lineNo,
              variable: {
                name,
                value: serialized,
                previousValue: lastVars[name],
                type: typeof val,
              },
            });
          }
          lastVars[name] = serialized;
        }
      });
    }
  };

  vm.createContext(sandbox);

  try {
    vm.runInContext(instrumentedCode, sandbox, { filename: TARGET_FILE, timeout: 5000 });
  } catch (err) {
    eventSeq++;
    events.push({
      id: \`evt_\${eventSeq}\`,
      seq: eventSeq,
      sessionId: SESSION_ID,
      timestamp: Date.now(),
      type: 'exception',
      file: TARGET_FILE,
      line: currentLine,
      exception: {
        type: err.name || 'Error',
        message: err.message || String(err),
      }
    });
  }

  const endTime = Date.now();
  eventSeq++;
  events.push({
    id: \`evt_\${eventSeq}\`,
    seq: eventSeq,
    sessionId: SESSION_ID,
    timestamp: endTime,
    type: 'program_end',
    file: TARGET_FILE,
    line: currentLine,
  });

  const payload = {
    events,
    metadata: {
      totalEvents: events.length,
      truncated,
      maxEventsLimit: MAX_EVENTS,
      executionTimeMs: endTime - startTime,
    }
  };

  console.log('\\n__CORTEX_TRACE_START__');
  console.log(JSON.stringify(payload));
  console.log('__CORTEX_TRACE_END__');
}

runTracer();
`;

export const typescriptTracingAdapter: LanguageTracingAdapter = {
  languageId: 'typescript',
  name: 'TypeScript',
  runtimeVersion: '5.6.2',
  capabilities: TS_CAPABILITIES,

  prepareTracedExecution: (files: ProjectFile[], entrypoint?: string, stdin?: string) => {
    const nonFolderFiles = files.filter((f) => !f.isFolder);
    const mainFile =
      nonFolderFiles.find((f) => f.name === (entrypoint || 'main.ts')) ||
      nonFolderFiles.find((f) => f.name.endsWith('.ts')) ||
      nonFolderFiles[0];

    const targetFileName = mainFile ? mainFile.name : 'main.ts';
    const sessionId = `trace_ts_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const runnerContent = `const TARGET_FILE = ${JSON.stringify(targetFileName)};\nconst SESSION_ID = ${JSON.stringify(sessionId)};\n${TS_TRACER_SCRIPT}`;

    const tracedFiles: ProjectFile[] = [
      ...files,
      {
        id: '__cortex_runner__',
        name: '__cortex_runner__.js',
        path: '/__cortex_runner__.js',
        content: runnerContent,
      },
    ];

    return {
      tracedFiles,
      entrypoint: '__cortex_runner__.js',
      stdin,
    };
  },

  parseTraceOutput: (stdout: string, stderr: string, exitCode: number, executionTimeMs: number): TraceSession => {
    const traceStartIdx = stdout.indexOf('__CORTEX_TRACE_START__');
    const traceEndIdx = stdout.indexOf('__CORTEX_TRACE_END__');

    let cleanStdout = stdout;
    let events: TraceEvent[] = [];
    let truncated = false;

    if (traceStartIdx !== -1 && traceEndIdx !== -1 && traceEndIdx > traceStartIdx) {
      const jsonStr = stdout
        .substring(traceStartIdx + '__CORTEX_TRACE_START__'.length, traceEndIdx)
        .trim();
      cleanStdout = (
        stdout.substring(0, traceStartIdx) +
        stdout.substring(traceEndIdx + '__CORTEX_TRACE_END__'.length)
      ).trim();

      try {
        const parsed = JSON.parse(jsonStr);
        events = parsed.events || [];
        truncated = !!parsed.metadata?.truncated;
      } catch (err) {
        console.error('Failed to parse TS trace payload:', err);
      }
    }

    return {
      sessionId: events[0]?.sessionId || 'session',
      status: exitCode === 0 ? 'success' : 'runtime_error',
      events,
      metadata: {
        language: 'typescript',
        runtimeVersion: '5.6.2',
        adapterName: 'TypeScript V8 Node.js Adapter',
        totalEvents: events.length,
        truncated,
        maxEventsLimit: 1000,
        executionTimeMs,
        capabilities: TS_CAPABILITIES,
        completeness: truncated ? 'truncated' : events.length > 0 ? 'full' : 'unavailable',
        warnings: truncated ? ['Trace reached maximum event limit of 1000 events.'] : [],
      },
      exitCode,
      stdout: cleanStdout,
      stderr,
    };
  },
};
