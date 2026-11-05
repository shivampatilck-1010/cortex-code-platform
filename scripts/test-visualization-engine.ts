/**
 * Cortex Universal Live Code Visualization Engine
 * Comprehensive Unit and Integration Test Suite
 * 
 * Tests event schema, state reconstruction, Python sys.settrace tracing,
 * loop/conditional tracking, call stacks, exceptions, data structure detection,
 * limits/truncation, and language registry capabilities.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import { reconstructState, detectStructures, getStepSummary } from '../src/lib/visualization/state-engine';
import { pythonTracingAdapter } from '../src/lib/visualization/adapters/python-adapter';
import { javascriptTracingAdapter } from '../src/lib/visualization/adapters/javascript-adapter';
import { LANGUAGE_SUPPORT_MATRIX, getAdapter, hasTracingSupport } from '../src/lib/visualization/registry';
import '../src/lib/visualization/adapters';
import { ProjectFile } from '../src/lib/execution/types';
import { TraceEvent } from '../src/lib/visualization/types';

function runLocalPythonTrace(userCode: string, fileName = 'main.py') {
  const files: ProjectFile[] = [
    {
      id: 'f1',
      name: fileName,
      path: `/${fileName}`,
      content: userCode,
    },
  ];

  const prepared = pythonTracingAdapter.prepareTracedExecution(files, fileName);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex_trace_test_'));

  try {
    for (const f of prepared.tracedFiles) {
      fs.writeFileSync(path.join(tmpDir, f.name), f.content, 'utf-8');
    }

    const runnerPath = path.join(tmpDir, prepared.entrypoint);
    const proc = spawnSync('python', [runnerPath], {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });

    const session = pythonTracingAdapter.parseTraceOutput(
      proc.stdout || '',
      proc.stderr || '',
      proc.status || 0,
      100
    );

    return { session, stdout: proc.stdout, stderr: proc.stderr, exitCode: proc.status };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`[PASS] ${msg}`);
    passed++;
  } else {
    console.error(`[FAIL] ${msg}`);
    failed++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('CORTEX UNIVERSAL LIVE CODE VISUALIZATION ENGINE TEST SUITE');
  console.log('================================================================\n');

  // --- Test 1: Variable Assignment ---
  console.log('--- Section 1: Variable Assignments & Expressions ---');
  const t1 = runLocalPythonTrace(`
x = 42
name = "Cortex"
active = True
`);
  assert(t1.session.events.length > 0, 'Test 1: Python tracer emits events for simple assignments');
  const xCreated = t1.session.events.find(
    (e) => e.type === 'variable_created' && e.variable?.name === 'x'
  );
  assert(!!xCreated && xCreated.variable?.value === 42, 'Test 1: Variable x created with value 42');

  // --- Test 2: Arithmetic Expressions & Mutations ---
  const t2 = runLocalPythonTrace(`
a = 10
b = 20
c = a + b
c = c * 2
`);
  const cChanged = t2.session.events.filter(
    (e) => e.variable?.name === 'c'
  );
  assert(cChanged.length >= 2, 'Test 2: Arithmetic variable mutations tracked across steps');
  const finalC = cChanged[cChanged.length - 1];
  assert(finalC.variable?.value === 60, 'Test 2: Final value of c is 60');

  // --- Test 3: Loops and Conditionals ---
  console.log('\n--- Section 2: Loops and Conditionals ---');
  const t3 = runLocalPythonTrace(`
evens = []
for i in range(5):
    if i % 2 == 0:
        evens.append(i)
`);
  const loopLines = t3.session.events.filter((e) => e.type === 'line_executed');
  assert(loopLines.length >= 5, 'Test 3: Loop iterations observed line by line');
  const finalState3 = reconstructState(t3.session.events, t3.session.events.length - 1);
  assert(
    JSON.stringify(finalState3.variables['evens']?.value) === JSON.stringify([0, 2, 4]),
    'Test 3: Conditionals filtered evens to [0, 2, 4]'
  );

  // --- Test 4: Function Calls & Returns ---
  console.log('\n--- Section 3: Functions and Call Stacks ---');
  const t4 = runLocalPythonTrace(`
def add(a, b):
    return a + b

res = add(5, 7)
`);
  const funcCall = t4.session.events.find(
    (e) => e.type === 'function_call' && e.call?.functionName === 'add'
  );
  assert(!!funcCall, 'Test 4: Function call event captured with function name add');
  assert(funcCall?.call?.arguments['a'] === 5 && funcCall?.call?.arguments['b'] === 7, 'Test 4: Function arguments inspected accurately');
  const funcReturn = t4.session.events.find(
    (e) => e.type === 'function_return' && e.return?.functionName === 'add'
  );
  assert(!!funcReturn && funcReturn.return?.returnValue === 12, 'Test 4: Function return value is 12');

  // --- Test 5: Nested Function Calls & Recursion ---
  const t5 = runLocalPythonTrace(`
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

ans = factorial(3)
`);
  const factCalls = t5.session.events.filter(
    (e) => e.type === 'function_call' && e.call?.functionName === 'factorial'
  );
  assert(factCalls.length === 3, 'Test 5: Recursive calls recorded at every depth (n=3, 2, 1)');
  const deepState = reconstructState(t5.session.events, 10);
  assert(deepState.callStack.length >= 2, 'Test 5: Call stack preserves nested frame hierarchy');

  // --- Test 6: Exceptions ---
  console.log('\n--- Section 4: Exceptions and Errors ---');
  const t6 = runLocalPythonTrace(`
val = 100
err = val / 0
`);
  const excEvent = t6.session.events.find((e) => e.type === 'exception');
  assert(!!excEvent, 'Test 6: Exception event captured');
  assert(
    excEvent?.exception?.type.includes('ZeroDivisionError') === true,
    'Test 6: Exception type is ZeroDivisionError'
  );

  // --- Test 7: Lists and Dictionaries ---
  console.log('\n--- Section 5: Data Structures & Collections ---');
  const t7 = runLocalPythonTrace(`
items = [10, 20, 30]
items.append(40)
user = {"name": "Alice", "role": "admin"}
user["score"] = 99
`);
  const state7 = reconstructState(t7.session.events, t7.session.events.length - 1);
  assert(
    JSON.stringify(state7.variables['items']?.value) === JSON.stringify([10, 20, 30, 40]),
    'Test 7: List append updated variable state to [10, 20, 30, 40]'
  );
  assert(
    state7.variables['user']?.value?.score === 99,
    'Test 7: Dictionary mutation tracked'
  );
  const arrayStruct = state7.structureVisualizations.find((s) => s.category === 'array');
  assert(!!arrayStruct, 'Test 7: Array structure visualization automatically detected');

  // --- Test 8: Linked List Structure Detection ---
  const t8 = runLocalPythonTrace(`
class ListNode:
    def __init__(self, val, next=None):
        self.val = val
        self.next = next

head = ListNode(1, ListNode(2, ListNode(3)))
`);
  const state8 = reconstructState(t8.session.events, t8.session.events.length - 1);
  const listStruct = state8.structureVisualizations.find((s) => s.category === 'linked_list');
  assert(!!listStruct, 'Test 8: Linked list structure automatically detected from node pointers');
  assert(listStruct?.data?.length === 3, 'Test 8: Reconstructed 3 linked list nodes');

  // --- Test 9: Empty Programs ---
  console.log('\n--- Section 6: Edge Cases, Limits & Timeline Navigation ---');
  const t9 = runLocalPythonTrace('');
  assert(t9.session.events.length >= 2, 'Test 9: Empty program handled gracefully with program_start/end');

  // --- Test 10: Infinite Loop / Event Limit Ceiling ---
  const t10 = runLocalPythonTrace(`
i = 0
while i < 1500:
    i += 1
`);
  assert(t10.session.metadata.truncated === true, 'Test 10: High-frequency loop safely truncated at 1000 events ceiling');
  assert(t10.session.events.length <= 1005, 'Test 10: Event array size bounded within memory limits');

  // --- Test 11: Deterministic Timeline Navigation ---
  const t11Events = t2.session.events;
  const snapshotStep0 = reconstructState(t11Events, 0);
  const snapshotMid = reconstructState(t11Events, 3);
  const snapshotFinal = reconstructState(t11Events, t11Events.length - 1);
  assert(snapshotStep0.stepIndex === 0, 'Test 11: Timeline step 0 constructed');
  assert(snapshotMid.stepIndex === 3, 'Test 11: Timeline intermediate step constructed deterministically');
  assert(snapshotFinal.stepIndex === t11Events.length - 1, 'Test 11: Timeline final step reconstructed');
  assert(snapshotFinal.variables['c']?.value === 60, 'Test 11: State reconstructed without side-effect re-execution');

  // --- Test 12: Malformed Trace Event Resilience ---
  const malformedEvents: TraceEvent[] = [
    {
      id: 'bad_1',
      seq: 1,
      sessionId: 'malformed',
      timestamp: Date.now(),
      type: 'variable_changed',
      file: 'test.py',
      line: 1,
      // variable field omitted intentionally
    },
    {
      id: 'bad_2',
      seq: 2,
      sessionId: 'malformed',
      timestamp: Date.now(),
      type: 'line_executed',
      file: 'test.py',
      line: 2,
    },
  ];
  const malformedSnapshot = reconstructState(malformedEvents, 1);
  assert(malformedSnapshot.currentLine === 2, 'Test 12: State engine survives malformed events safely');

  // --- Test 13: Language Support Registry Audit ---
  console.log('\n--- Section 7: Language Registry & Honesty Audit ---');
  assert(hasTracingSupport('python') === true, 'Test 13: Python verified in language registry');
  assert(hasTracingSupport('javascript') === true, 'Test 13: JavaScript verified in language registry');
  assert(hasTracingSupport('cpp') === false, 'Test 13: C++ honestly marked as unsupported for internal tracing');
  assert(LANGUAGE_SUPPORT_MATRIX.length === 16, 'Test 13: All 16 advertised languages audited in support matrix');

  const pyRow = LANGUAGE_SUPPORT_MATRIX.find((m) => m.language === 'python');
  assert(pyRow?.verificationStatus === 'verified', 'Test 13: Python verification status is verified');

  const cppRow = LANGUAGE_SUPPORT_MATRIX.find((m) => m.language === 'cpp');
  assert(
    cppRow?.knownLimitations[0].includes('Program execution is available; internal visualization is not supported'),
    'Test 13: Non-traced languages include honest limitation message'
  );

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
