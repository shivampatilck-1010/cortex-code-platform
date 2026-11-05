/**
 * Cortex Universal Live Code Visualization Engine
 * Python Tracing Adapter
 * 
 * Uses CPython sys.settrace runtime frame introspection to capture line-by-line
 * execution, variable creations/mutations, function calls/returns, call stacks,
 * collections, and exceptions from actual program execution.
 */

import { LanguageTracingAdapter } from '../registry';
import { ProjectFile } from '../../execution/types';
import { TraceSession, TraceEvent, TracingCapabilities } from '../types';

export const PYTHON_CAPABILITIES: TracingCapabilities = {
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
    'Tracing overhead limits execution history to maximum event ceiling (default 1000 events) to prevent timeouts.',
    'Built-in C extensions (e.g. C-implemented math modules) are observed at function call boundaries.',
  ],
  verificationStatus: 'verified',
};

const PYTHON_TRACER_SCRIPT = `
import sys
import json
import io
import time
import traceback

MAX_EVENTS = 1000
events = []
event_seq = 0
truncated = False
last_locals = {}

def safe_serialize(val, depth=0, visited=None):
    if visited is None:
        visited = set()
    if depth > 4:
        return repr(val)
    if val is None or isinstance(val, (int, float, bool, str)):
        return val
    val_id = id(val)
    if val_id in visited:
        return "[Circular Reference]"
    visited.add(val_id)
    try:
        if callable(val):
            return f"<function {getattr(val, '__name__', 'anonymous')}>"
        if isinstance(val, (list, tuple)):
            res = [safe_serialize(x, depth + 1, visited) for x in val[:50]]
            visited.remove(val_id)
            return res
        if isinstance(val, set):
            res = [safe_serialize(x, depth + 1, visited) for x in list(val)[:50]]
            visited.remove(val_id)
            return res
        if isinstance(val, dict):
            res = {str(k): safe_serialize(v, depth + 1, visited) for k, v in list(val.items())[:50] if not str(k).startswith('__')}
            visited.remove(val_id)
            return res
        if hasattr(val, '__dict__'):
            fields = {k: safe_serialize(v, depth + 1, visited) for k, v in val.__dict__.items() if not k.startswith('__')}
            visited.remove(val_id)
            return {'_class': val.__class__.__name__, **fields}
    except Exception:
        pass
    if val_id in visited:
        visited.remove(val_id)
    return repr(val)

def get_call_stack(frame, target_file):
    stack = []
    curr = frame
    while curr:
        if curr.f_code.co_filename == target_file:
            stack.insert(0, {
                'name': curr.f_code.co_name,
                'file': target_file,
                'line': curr.f_lineno,
            })
        curr = curr.f_back
    return stack

def check_locals_changes(frame, line):
    global event_seq, last_locals
    clean_locals = {}
    for k, v in frame.f_locals.items():
        if not k.startswith('__') and k not in ('TARGET_FILE', 'SESSION_ID', 'sys', 'json', 'events', 'MAX_EVENTS'):
            clean_locals[k] = safe_serialize(v)

    timestamp = int(time.time() * 1000)
    for v_name, v_val in clean_locals.items():
        prev = last_locals.get(v_name)
        if v_name not in last_locals:
            event_seq += 1
            events.append({
                'id': f"evt_{event_seq}",
                'seq': event_seq,
                'sessionId': SESSION_ID,
                'timestamp': timestamp,
                'type': 'variable_created',
                'file': TARGET_FILE,
                'line': line,
                'variable': {
                    'name': v_name,
                    'value': v_val,
                    'type': type(frame.f_locals[v_name]).__name__ if v_name in frame.f_locals else 'unknown',
                },
                'callStack': get_call_stack(frame, TARGET_FILE),
            })
        elif prev != v_val:
            event_seq += 1
            events.append({
                'id': f"evt_{event_seq}",
                'seq': event_seq,
                'sessionId': SESSION_ID,
                'timestamp': timestamp,
                'type': 'variable_changed',
                'file': TARGET_FILE,
                'line': line,
                'variable': {
                    'name': v_name,
                    'value': v_val,
                    'previousValue': prev,
                    'type': type(frame.f_locals[v_name]).__name__ if v_name in frame.f_locals else 'unknown',
                },
                'callStack': get_call_stack(frame, TARGET_FILE),
            })
    last_locals = dict(clean_locals)

def trace_dispatch(frame, event, arg):
    global event_seq, truncated
    if event_seq >= MAX_EVENTS:
        truncated = True
        return None

    filename = frame.f_code.co_filename
    if filename != TARGET_FILE:
        return trace_dispatch

    line = frame.f_lineno
    func_name = frame.f_code.co_name
    timestamp = int(time.time() * 1000)

    # 1. Line Execution
    if event == 'line':
        check_locals_changes(frame, line)
        event_seq += 1
        events.append({
            'id': f"evt_{event_seq}",
            'seq': event_seq,
            'sessionId': SESSION_ID,
            'timestamp': timestamp,
            'type': 'line_executed',
            'file': TARGET_FILE,
            'line': line,
            'callStack': get_call_stack(frame, TARGET_FILE),
        })

    # 2. Function Call
    elif event == 'call':
        if func_name != '<module>':
            call_args = {}
            for k, v in frame.f_locals.items():
                if not k.startswith('__'):
                    call_args[k] = safe_serialize(v)
            event_seq += 1
            events.append({
                'id': f"evt_{event_seq}",
                'seq': event_seq,
                'sessionId': SESSION_ID,
                'timestamp': timestamp,
                'type': 'function_call',
                'file': TARGET_FILE,
                'line': line,
                'call': {
                    'functionName': func_name,
                    'arguments': call_args,
                    'file': TARGET_FILE,
                    'line': line,
                },
                'callStack': get_call_stack(frame, TARGET_FILE),
            })

    # 3. Function Return
    elif event == 'return':
        check_locals_changes(frame, line)
        if func_name != '<module>':
            ret_val = safe_serialize(arg)
            event_seq += 1
            events.append({
                'id': f"evt_{event_seq}",
                'seq': event_seq,
                'sessionId': SESSION_ID,
                'timestamp': timestamp,
                'type': 'function_return',
                'file': TARGET_FILE,
                'line': line,
                'return': {
                    'functionName': func_name,
                    'returnValue': ret_val,
                    'type': type(arg).__name__,
                },
                'callStack': get_call_stack(frame, TARGET_FILE),
            })

    # 4. Exception
    elif event == 'exception':
        exc_type, exc_val, tb = arg
        event_seq += 1
        events.append({
            'id': f"evt_{event_seq}",
            'seq': event_seq,
            'sessionId': SESSION_ID,
            'timestamp': timestamp,
            'type': 'exception',
            'file': TARGET_FILE,
            'line': line,
            'exception': {
                'type': exc_type.__name__ if hasattr(exc_type, '__name__') else str(exc_type),
                'message': str(exc_val),
            },
            'callStack': get_call_stack(frame, TARGET_FILE),
        })

    return trace_dispatch

def run_traced_program():
    global event_seq, events, truncated
    start_time = time.time()
    
    event_seq += 1
    events.append({
        'id': f"evt_{event_seq}",
        'seq': event_seq,
        'sessionId': SESSION_ID,
        'timestamp': int(start_time * 1000),
        'type': 'program_start',
        'file': TARGET_FILE,
        'line': 1,
    })

    try:
        with open(TARGET_FILE, 'r', encoding='utf-8') as f:
            user_source = f.read()
    except Exception as e:
        sys.stderr.write(f"Tracer File Error: {e}\\n")
        return

    try:
        code_obj = compile(user_source, TARGET_FILE, 'exec')
    except Exception as e:
        sys.stderr.write(f"Syntax Error: {e}\\n")
        traceback.print_exc(file=sys.stderr)
        return

    user_globals = {
        '__name__': '__main__',
        '__file__': TARGET_FILE,
    }

    sys.settrace(trace_dispatch)
    try:
        exec(code_obj, user_globals)
    except Exception as e:
        pass
    finally:
        sys.settrace(None)

    end_time = time.time()
    event_seq += 1
    events.append({
        'id': f"evt_{event_seq}",
        'seq': event_seq,
        'sessionId': SESSION_ID,
        'timestamp': int(end_time * 1000),
        'type': 'program_end',
        'file': TARGET_FILE,
        'line': events[-1]['line'] if events else 1,
    })

    payload = {
        'events': events,
        'metadata': {
            'totalEvents': len(events),
            'truncated': truncated,
            'maxEventsLimit': MAX_EVENTS,
            'executionTimeMs': int((end_time - start_time) * 1000),
        }
    }
    print("\\n__CORTEX_TRACE_START__")
    print(json.dumps(payload))
    print("__CORTEX_TRACE_END__")

if __name__ == '__main__':
    run_traced_program()
`;

export const pythonTracingAdapter: LanguageTracingAdapter = {
  languageId: 'python',
  name: 'Python',
  runtimeVersion: '3.12.5',
  capabilities: PYTHON_CAPABILITIES,

  prepareTracedExecution: (files: ProjectFile[], entrypoint?: string, stdin?: string) => {
    const nonFolderFiles = files.filter((f) => !f.isFolder);
    const mainFile =
      nonFolderFiles.find((f) => f.name === (entrypoint || 'main.py')) ||
      nonFolderFiles.find((f) => f.name.endsWith('.py')) ||
      nonFolderFiles[0];

    const targetFileName = mainFile ? mainFile.name : 'main.py';
    const sessionId = `trace_py_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const runnerContent = `TARGET_FILE = ${JSON.stringify(targetFileName)}\nSESSION_ID = ${JSON.stringify(sessionId)}\n${PYTHON_TRACER_SCRIPT}`;

    const tracedFiles: ProjectFile[] = [
      ...files,
      {
        id: '__cortex_runner__',
        name: '__cortex_runner__.py',
        path: '/__cortex_runner__.py',
        content: runnerContent,
      },
    ];

    return {
      tracedFiles,
      entrypoint: '__cortex_runner__.py',
      stdin,
    };
  },

  parseTraceOutput: (stdout: string, stderr: string, exitCode: number, executionTimeMs: number): TraceSession => {
    const traceStartIdx = stdout.indexOf('__CORTEX_TRACE_START__');
    const traceEndIdx = stdout.indexOf('__CORTEX_TRACE_END__');

    let cleanStdout = stdout;
    let events: TraceEvent[] = [];
    let truncated = false;
    let totalEvents = 0;

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
        totalEvents = parsed.metadata?.totalEvents || events.length;
      } catch (err) {
        console.error('Failed to parse Python trace JSON payload:', err);
      }
    }

    if (events.length === 0 && stderr) {
      const lineMatch = stderr.match(/line (\d+)/i);
      const errorLine = lineMatch ? parseInt(lineMatch[1], 10) : 1;
      const errorMsg = stderr.split('\\n').filter(Boolean).pop() || 'Execution error';

      events = [
        {
          id: 'evt_start',
          seq: 1,
          sessionId: 'err_session',
          timestamp: Date.now(),
          type: 'program_start',
          file: 'main.py',
          line: errorLine,
        },
        {
          id: 'evt_err',
          seq: 2,
          sessionId: 'err_session',
          timestamp: Date.now(),
          type: 'exception',
          file: 'main.py',
          line: errorLine,
          exception: {
            type: 'SyntaxError',
            message: errorMsg,
          },
        },
        {
          id: 'evt_end',
          seq: 3,
          sessionId: 'err_session',
          timestamp: Date.now(),
          type: 'program_end',
          file: 'main.py',
          line: errorLine,
        },
      ];
    }

    return {
      sessionId: events[0]?.sessionId || 'session',
      status: exitCode === 0 ? 'success' : 'runtime_error',
      events,
      metadata: {
        language: 'python',
        runtimeVersion: '3.12.5',
        adapterName: 'Python CPython sys.settrace Adapter',
        totalEvents: events.length,
        truncated,
        maxEventsLimit: 1000,
        executionTimeMs,
        capabilities: PYTHON_CAPABILITIES,
        completeness: truncated ? 'truncated' : events.length > 0 ? 'full' : 'unavailable',
        warnings: truncated ? ['Trace reached maximum event ceiling of 1000 events and was safely truncated.'] : [],
      },
      exitCode,
      stdout: cleanStdout,
      stderr,
    };
  },
};
