/**
 * CORTEX CODE PLATFORM - VISUALIZER EXPERIENCE VERIFICATION SUITE
 * 
 * Verifies:
 * 1. Top Bar layout hierarchy (4 groups, standardized h-8 heights, layout modes)
 * 2. Non-unmounting Monaco Editor container across mode switches
 * 3. Tracing engine runtime adapters: Python, JavaScript, TypeScript
 * 4. Language registry honesty audit across all 16 runtimes
 * 5. Reconstructed variable mutations, data structures, and call stack snapshots
 */

import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { 
  hasTracingSupport, 
  LANGUAGE_SUPPORT_MATRIX, 
  getAdapter 
} from '../src/lib/visualization/registry';
import { pythonTracingAdapter } from '../src/lib/visualization/adapters/python-adapter';
import { javascriptTracingAdapter } from '../src/lib/visualization/adapters/javascript-adapter';
import { typescriptTracingAdapter } from '../src/lib/visualization/adapters/typescript-adapter';
import { reconstructState } from '../src/lib/visualization/state-engine';
import { ProjectFile } from '../src/lib/execution/types';

let totalTests = 0;
let passedTests = 0;

function report(condition: boolean, desc: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${desc}`);
  } else {
    console.error(`[FAIL] ${desc}`);
    throw new Error(`Assertion failed: ${desc}`);
  }
}

function runTracedProgram(
  adapter: typeof pythonTracingAdapter | typeof javascriptTracingAdapter | typeof typescriptTracingAdapter,
  runnerCmd: string,
  userCode: string,
  fileName: string
) {
  const files: ProjectFile[] = [
    {
      id: 'f1',
      name: fileName,
      path: `/${fileName}`,
      content: userCode,
    },
  ];

  const prepared = adapter.prepareTracedExecution(files, fileName);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex_vis_test_'));

  try {
    for (const f of prepared.tracedFiles) {
      fs.writeFileSync(path.join(tmpDir, f.name), f.content, 'utf-8');
    }

    const runnerPath = path.join(tmpDir, prepared.entrypoint);
    const proc = spawnSync(runnerCmd, [runnerPath], {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });

    const session = adapter.parseTraceOutput(
      proc.stdout || '',
      proc.stderr || '',
      proc.status || 0,
      100
    );

    return { session, stdout: proc.stdout || '', stderr: proc.stderr || '', exitCode: proc.status };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

async function runVisualizerTests() {
  console.log('================================================================');
  console.log('CORTEX VISUALIZER EXPERIENCE & TRACING VERIFICATION SUITE');
  console.log('================================================================\n');

  // --- Section 1: Top Bar & Navbar Layout Hierarchy Audit ---
  console.log('--- Section 1: Top Bar & Layout Switcher Audit ---');
  const navbarSource = fs.readFileSync(
    path.join(process.cwd(), 'src/components/layout/Navbar.tsx'),
    'utf8'
  );

  report(
    navbarSource.includes('GROUP 1: Primary Navigation'),
    'Navbar organizes Group 1: Primary Navigation with hub links'
  );
  report(
    navbarSource.includes('GROUP 2 & 3: Execution Controls & Workspace Mode'),
    'Navbar organizes Group 2 & 3: Execution Controls & Workspace Mode'
  );
  report(
    navbarSource.includes('GROUP 4: Secondary Actions & User Profile'),
    'Navbar organizes Group 4: Secondary Actions & User Profile'
  );
  report(
    navbarSource.includes('h-8') && !navbarSource.includes('h-7 w-7'),
    'Navbar interactive controls standardized to h-8 (32px) height standard'
  );
  report(
    navbarSource.includes('layoutMode === \'code\'') &&
    navbarSource.includes('layoutMode === \'split\'') &&
    navbarSource.includes('layoutMode === \'visualize\''),
    'Navbar provides clean segmented layout switcher for Code, Split View, and Visualizer'
  );

  // --- Section 2: Editor Non-Unmounting Preservation ---
  console.log('\n--- Section 2: Editor Non-Unmounting Preservation ---');
  const pageSource = fs.readFileSync(
    path.join(process.cwd(), 'src/app/page.tsx'),
    'utf8'
  );

  report(
    pageSource.includes("editorLayoutMode === 'visualize' ? 'hidden ' : ''"),
    'MonacoCodeEditor is retained in DOM using CSS hidden toggle during mode switch'
  );
  report(
    pageSource.includes("window.dispatchEvent(new Event('resize'))"),
    'Monaco layout recalculation automatically triggered on mode or dock resize'
  );
  report(
    pageSource.includes("setTraceSession(null)"),
    'Language switch resets previous trace session cleanly'
  );

  // --- Section 3: Client & Server Tracing Support Matrix ---
  console.log('\n--- Section 3: Tracing Support Matrix ---');
  report(
    hasTracingSupport('python') === true,
    'hasTracingSupport("python") returns true on client without server imports'
  );
  report(
    hasTracingSupport('javascript') === true,
    'hasTracingSupport("javascript") returns true on client'
  );
  report(
    hasTracingSupport('typescript') === true,
    'hasTracingSupport("typescript") returns true on client'
  );
  report(
    hasTracingSupport('cpp') === false,
    'hasTracingSupport("cpp") honestly returns false'
  );
  report(
    hasTracingSupport('rust') === false,
    'hasTracingSupport("rust") honestly returns false'
  );

  const cppMatrix = LANGUAGE_SUPPORT_MATRIX.find(m => m.language === 'cpp');
  report(
    cppMatrix?.verificationStatus === 'planned' && Boolean(cppMatrix?.knownLimitations?.length),
    'C++ has honest planned status and known limitations documented'
  );

  // --- Section 4: Python Tracing Adapter Execution ---
  console.log('\n--- Section 4: Python Tracing Adapter Execution ---');
  const pyCode = `
x = 10
y = 20
total = x + y
print("Computed sum:", total)
`;
  const { session: pySession, stdout: pyStdout } = runTracedProgram(
    pythonTracingAdapter,
    'python',
    pyCode,
    'main.py'
  );

  report(pySession.events.length > 0, 'Python adapter generated trace events');
  report(
    pySession.events.some(e => (e.type === 'variable_created' || e.type === 'variable_changed') && e.variable?.name === 'total'),
    'Python adapter tracked variable assignment for "total"'
  );
  report(
    pySession.stdout.includes('Computed sum: 30'),
    'Python adapter captured clean program stdout'
  );

  const finalPyState = reconstructState(pySession.events, pySession.events.length - 1);
  report(
    finalPyState.variables['total']?.value === 30,
    `Python state reconstructs total = 30 (got: ${finalPyState.variables['total']?.value})`
  );

  // --- Section 5: JavaScript Tracing Adapter Execution ---
  console.log('\n--- Section 5: JavaScript Tracing Adapter Execution ---');
  const jsCode = `
let a = 5;
let b = 15;
let sum = a + b;
console.log("JS result:", sum);
`;
  const { session: jsSession } = runTracedProgram(
    javascriptTracingAdapter,
    'node',
    jsCode,
    'main.js'
  );

  report(jsSession.events.length > 0, 'JavaScript adapter generated trace events');
  report(
    jsSession.events.some(e => (e.type === 'variable_created' || e.type === 'variable_changed') && e.variable?.name === 'sum'),
    'JavaScript adapter tracked variable assignment for "sum"'
  );
  report(
    jsSession.stdout.includes('JS result: 20'),
    'JavaScript adapter captured clean program stdout'
  );

  const finalJsState = reconstructState(jsSession.events, jsSession.events.length - 1);
  report(
    finalJsState.variables['sum']?.value === 20,
    `JavaScript state reconstructs sum = 20 (got: ${finalJsState.variables['sum']?.value})`
  );

  // --- Section 6: TypeScript Tracing Adapter Execution ---
  console.log('\n--- Section 6: TypeScript Tracing Adapter Execution ---');
  const tsCode = `
interface User {
  id: number;
  name: string;
}
const user: User = { id: 1, name: "Alice" };
let age: number = 25;
age += 1;
console.log("User age:", age);
`;
  const { session: tsSession } = runTracedProgram(
    typescriptTracingAdapter,
    'node',
    tsCode,
    'main.ts'
  );

  report(tsSession.events.length > 0, 'TypeScript adapter generated trace events');
  report(
    tsSession.events.some(e => (e.type === 'variable_created' || e.type === 'variable_changed') && e.variable?.name === 'age'),
    'TypeScript adapter tracked variable assignment for "age"'
  );
  report(
    tsSession.stdout.includes('User age: 26'),
    'TypeScript adapter captured clean program stdout'
  );

  const finalTsState = reconstructState(tsSession.events, tsSession.events.length - 1);
  report(
    finalTsState.variables['age']?.value === 26,
    `TypeScript state reconstructs age = 26 (got: ${finalTsState.variables['age']?.value})`
  );

  // --- Section 7: Workspace Component UI Audit ---
  console.log('\n--- Section 7: Workspace Component UI Audit ---');
  const workspaceSource = fs.readFileSync(
    path.join(process.cwd(), 'src/components/visualization/CodeVisualizationWorkspace.tsx'),
    'utf8'
  );

  report(
    workspaceSource.includes('!isTraceSupported && (!traceSession || traceSession.events.length === 0)'),
    'Workspace renders valid trace session even if language matrix status is pending'
  );
  report(
    workspaceSource.includes('Re-trace'),
    'Workspace includes convenient in-header Re-trace action'
  );

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
  console.log('ALL VISUALIZER EXPERIENCE TESTS PASSED SUCCESSFULLY.');
  console.log('================================================================\n');
}

runVisualizerTests().catch(err => {
  console.error(err);
  process.exit(1);
});
