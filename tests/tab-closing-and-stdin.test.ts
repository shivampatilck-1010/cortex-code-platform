import * as fs from 'fs';
import * as path from 'path';
import assert from 'node:assert';
import { executeInLocalSandbox } from '../src/lib/execution/local-sandbox';
import { ProjectFile } from '../src/lib/execution/types';
import { POST as terminalHandler } from '../src/app/api/v1/terminal/route';
import { NextRequest } from 'next/server';

console.log('[Test Suite] Running Tab Closing & Stdin Execution Verification Tests...');

async function runTabClosingAndStdinTests() {
  const projectRoot = process.cwd();

  // =========================================================================
  // Section 1: R1 & R2 - Tab Closing Decoupling and State Transitions
  // =========================================================================
  console.log('\n--- 1. Testing Tab Closing Decoupling & Empty State ---');

  const initialFiles: ProjectFile[] = [
    { id: 'f-main', name: 'main.py', path: '/main.py', content: 'print("main")' },
    { id: 'f-readme', name: 'README.md', path: '/README.md', content: '# Docs' },
    { id: 'f-helper', name: 'helper.py', path: '/helper.py', content: 'def help(): pass' },
  ];

  let workspaceFiles = [...initialFiles];
  let openFileIds = ['f-main', 'f-readme'];
  let activeFileId = 'f-main';

  // Helper simulating IDE handleCloseFileTab
  const handleCloseFileTab = (idToClose: string) => {
    const nextOpen = openFileIds.filter((id) => id !== idToClose);
    openFileIds = nextOpen;
    if (activeFileId === idToClose) {
      if (nextOpen.length > 0) {
        activeFileId = nextOpen[0];
      } else {
        activeFileId = '';
      }
    }
  };

  // Helper simulating IDE handleSelectFile
  const handleSelectFile = (fileId: string) => {
    const target = workspaceFiles.find((f) => f.id === fileId);
    if (!target || target.isFolder) return;
    if (!openFileIds.includes(fileId)) {
      openFileIds = [...openFileIds, fileId];
    }
    activeFileId = fileId;
  };

  // Test 1.1: Closing active tab removes it from openFileIds only
  handleCloseFileTab('f-main');
  assert.strictEqual(openFileIds.includes('f-main'), false, 'f-main must not be in openFileIds');
  assert.strictEqual(openFileIds.length, 1, 'Only 1 tab should remain open');
  assert.strictEqual(activeFileId, 'f-readme', 'f-readme should become active');
  assert.strictEqual(workspaceFiles.length, 3, 'Workspace files must NOT be deleted when closing tab');
  assert.ok(workspaceFiles.some((f) => f.id === 'f-main'), 'f-main must remain intact in workspace files');
  console.log('[PASS] Closing tab does not delete file from workspace files list');

  // Test 1.2: Closing the single remaining open tab
  handleCloseFileTab('f-readme');
  assert.strictEqual(openFileIds.length, 0, 'openFileIds should be empty');
  assert.strictEqual(activeFileId, '', 'activeFileId should be empty string');
  assert.strictEqual(workspaceFiles.length, 3, 'All 3 files remain intact in workspace');
  console.log('[PASS] Closing single remaining tab transitions to empty tabs state with 0 files deleted');

  // Test 1.3: Selecting a file from sidebar reopens it cleanly
  handleSelectFile('f-helper');
  assert.strictEqual(openFileIds.length, 1, 'f-helper added to open tabs');
  assert.strictEqual(openFileIds[0], 'f-helper', 'f-helper is in openFileIds');
  assert.strictEqual(activeFileId, 'f-helper', 'f-helper is active');
  console.log('[PASS] Selecting file from explorer cleanly reopens it in new tab');

  // Test 1.4: Source code contract verification for MonacoCodeEditor & page.tsx
  const monacoEditorPath = path.join(projectRoot, 'src', 'components', 'editor', 'MonacoCodeEditor.tsx');
  const monacoContent = fs.readFileSync(monacoEditorPath, 'utf8');

  assert.ok(
    monacoContent.includes('openFileIds?: string[];'),
    'MonacoCodeEditorProps must declare openFileIds?: string[]'
  );
  assert.ok(
    monacoContent.includes('No Files Open'),
    'MonacoCodeEditor must render "No Files Open" placeholder'
  );
  assert.ok(
    !monacoContent.includes('files.filter((f) => !f.isFolder).length > 1 &&'),
    'MonacoCodeEditor must not conditionally hide close button when only 1 tab is open'
  );
  console.log('[PASS] MonacoCodeEditor contract and placeholder state verified');

  const idePagePath = path.join(projectRoot, 'src', 'app', 'ide', 'page.tsx');
  const ideContent = fs.readFileSync(idePagePath, 'utf8');

  assert.ok(
    ideContent.includes('openFileIds={openFileIds}'),
    'ide/page.tsx must pass openFileIds to MonacoCodeEditor'
  );
  assert.ok(
    ideContent.includes('onCloseFile={handleCloseFileTab}'),
    'ide/page.tsx must pass handleCloseFileTab to onCloseFile'
  );
  console.log('[PASS] ide/page.tsx tab decoupling wiring verified');

  // =========================================================================
  // Section 2: R3 - Sandbox Stdin Pipe Termination and Handling
  // =========================================================================
  console.log('\n--- 2. Testing Sandbox Stdin Handling (Local Sandbox) ---');

  const pythonStdinFile: ProjectFile = {
    id: 'py-input',
    name: 'test_input.py',
    path: '/test_input.py',
    content: [
      'name = input("Enter name: ")',
      'age = input("Enter age: ")',
      'print(f"User: {name}, Age: {age}")',
    ].join('\n'),
  };

  // Test 2.1: Python execution with multi-line stdin
  const resWithStdin = await executeInLocalSandbox({
    language: 'python',
    files: [pythonStdinFile],
    entrypoint: 'test_input.py',
    stdin: 'Alice\n30\n',
  });

  assert.strictEqual(resWithStdin.status, 'success', 'Status must be success');
  assert.strictEqual(resWithStdin.exitCode, 0, 'Exit code must be 0');
  assert.ok(
    resWithStdin.stdout.includes('User: Alice, Age: 30'),
    `Stdout should reflect provided stdin inputs, got: ${resWithStdin.stdout}`
  );
  assert.strictEqual(resWithStdin.stdin, 'Alice\n30\n', 'Result should preserve stdin');
  console.log('[PASS] Python script successfully reads multi-line stdin and outputs result');

  // Test 2.2: Python execution with empty stdin must NOT hang or timeout!
  const startEmptyTime = Date.now();
  const resEmptyStdin = await executeInLocalSandbox({
    language: 'python',
    files: [pythonStdinFile],
    entrypoint: 'test_input.py',
    stdin: '',
  });
  const elapsedEmptyTime = Date.now() - startEmptyTime;

  assert.ok(
    elapsedEmptyTime < 5000,
    `Empty stdin execution must complete quickly without hanging (took ${elapsedEmptyTime}ms)`
  );
  assert.ok(
    resEmptyStdin.status === 'runtime_error' || resEmptyStdin.exitCode !== 0,
    'Process expecting input with empty stdin should exit cleanly with runtime_error'
  );
  assert.ok(
    resEmptyStdin.stderr.includes('EOFError'),
    `Stderr should report EOFError on empty stdin, got: ${resEmptyStdin.stderr}`
  );
  console.log('[PASS] Python script with empty stdin terminates cleanly with EOF in <5s without hanging');

  // Test 2.3: C++ execution with stdin
  const cppStdinFile: ProjectFile = {
    id: 'cpp-input',
    name: 'main.cpp',
    path: '/main.cpp',
    content: [
      '#include <iostream>',
      'using namespace std;',
      'int main() {',
      '    int x = 0;',
      '    if (cin >> x) {',
      '        cout << "Doubled: " << (x * 2) << endl;',
      '    } else {',
      '        cout << "No input received" << endl;',
      '    }',
      '    return 0;',
      '}',
    ].join('\n'),
  };

  const resCppWithStdin = await executeInLocalSandbox({
    language: 'cpp',
    files: [cppStdinFile],
    entrypoint: 'main.cpp',
    stdin: '21\n',
  });

  assert.strictEqual(resCppWithStdin.status, 'success', 'C++ status must be success');
  assert.strictEqual(resCppWithStdin.exitCode, 0, 'C++ exit code must be 0');
  assert.ok(
    resCppWithStdin.stdout.includes('Doubled: 42'),
    `C++ stdout must contain Doubled: 42, got: ${resCppWithStdin.stdout}`
  );
  console.log('[PASS] C++ program with cin >> reads stdin and returns computed output');

  // Test 2.4: C++ execution with empty stdin must NOT hang or timeout!
  const cppStartEmpty = Date.now();
  const resCppEmptyStdin = await executeInLocalSandbox({
    language: 'cpp',
    files: [cppStdinFile],
    entrypoint: 'main.cpp',
    stdin: '',
  });
  const cppElapsedEmpty = Date.now() - cppStartEmpty;

  assert.ok(
    cppElapsedEmpty < 5000,
    `C++ empty stdin execution must complete quickly without hanging (took ${cppElapsedEmpty}ms)`
  );
  assert.strictEqual(resCppEmptyStdin.status, 'success', 'C++ cin with EOF completes cleanly');
  assert.ok(
    resCppEmptyStdin.stdout.includes('No input received'),
    `C++ with empty stdin should detect EOF, got: ${resCppEmptyStdin.stdout}`
  );
  console.log('[PASS] C++ program with empty stdin closes pipe immediately and exits without hanging');

  // =========================================================================
  // Section 3: R3 - Terminal API Route (/api/v1/terminal) Stdin & Piping
  // =========================================================================
  console.log('\n--- 3. Testing Terminal API Route Stdin & Pipe Execution ---');

  const terminalTestFiles: ProjectFile[] = [
    {
      id: 'term-main',
      name: 'main.py',
      path: '/main.py',
      content: 'val = input("Value: ")\nprint("Echo: " + val)',
    },
  ];

  // Test 3.1: Pipe command echo "PipedInput" | run
  const pipeRequest = new NextRequest('http://localhost:3000/api/v1/terminal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command: 'echo "PipedInput" | run',
      files: terminalTestFiles,
    }),
  });

  const pipeResponse = await terminalHandler(pipeRequest);
  assert.strictEqual(pipeResponse.status, 200, 'Terminal pipe request should return 200');
  const pipeData = (await pipeResponse.json()) as any;

  assert.strictEqual(pipeData.exitCode, 0, `Exit code should be 0, got: ${pipeData.exitCode}`);
  assert.ok(
    pipeData.stdout.includes('Echo: PipedInput'),
    `Terminal stdout must contain "Echo: PipedInput", got: ${pipeData.stdout}`
  );
  assert.ok(
    pipeData.stdin && pipeData.stdin.includes('PipedInput'),
    'Terminal response must include resolved stdin'
  );
  console.log('[PASS] Terminal pipe command (echo "..." | run) executes with piped stdin successfully');

  // Test 3.2: Direct stdin payload in terminal request
  const directStdinRequest = new NextRequest('http://localhost:3000/api/v1/terminal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command: 'python main.py',
      files: terminalTestFiles,
      stdin: 'DirectPayloadValue\n',
    }),
  });

  const directResponse = await terminalHandler(directStdinRequest);
  assert.strictEqual(directResponse.status, 200, 'Direct stdin request should return 200');
  const directData = (await directResponse.json()) as any;

  assert.strictEqual(directData.exitCode, 0, `Exit code should be 0, got: ${directData.exitCode}`);
  assert.ok(
    directData.stdout.includes('Echo: DirectPayloadValue'),
    `Terminal stdout must contain "Echo: DirectPayloadValue", got: ${directData.stdout}`
  );
  console.log('[PASS] Terminal request with direct stdin payload executes successfully');

  // Test 3.3: Terminal execution with empty stdin completes without hanging
  const emptyTermRequest = new NextRequest('http://localhost:3000/api/v1/terminal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command: 'run',
      files: terminalTestFiles,
      stdin: '',
    }),
  });

  const termStart = Date.now();
  const emptyTermResponse = await terminalHandler(emptyTermRequest);
  const termElapsed = Date.now() - termStart;

  assert.ok(termElapsed < 5000, `Terminal execution with empty stdin must not hang (took ${termElapsed}ms)`);
  assert.strictEqual(emptyTermResponse.status, 200);
  const emptyTermData = (await emptyTermResponse.json()) as any;
  assert.ok(
    emptyTermData.stderr.includes('EOFError') || emptyTermData.exitCode !== 0,
    'Terminal execution with empty stdin returns EOFError cleanly'
  );
  console.log('[PASS] Terminal execution with empty stdin exits cleanly in <5s without hanging');

  // =========================================================================
  // Section 4: OutputPanel & TerminalPanel Interface Contracts
  // =========================================================================
  console.log('\n--- 4. Testing Panel Interface Contracts ---');

  const outputPanelPath = path.join(projectRoot, 'src', 'components', 'panels', 'OutputPanel.tsx');
  const outputPanelContent = fs.readFileSync(outputPanelPath, 'utf8');

  assert.ok(
    outputPanelContent.includes('export interface OutputPanelProps'),
    'OutputPanel must export OutputPanelProps'
  );
  assert.ok(
    outputPanelContent.includes('stdin?: string;'),
    'OutputPanelProps must accept stdin'
  );
  assert.ok(
    outputPanelContent.includes('onStdinChange?: (stdin: string) => void;'),
    'OutputPanelProps must accept onStdinChange'
  );
  assert.ok(
    outputPanelContent.includes('Standard Input (stdin)'),
    'OutputPanel must display Standard Input (stdin)'
  );
  console.log('[PASS] OutputPanelProps interface and stdin reflection verified');

  const terminalPanelPath = path.join(projectRoot, 'src', 'components', 'panels', 'TerminalPanel.tsx');
  const terminalPanelContent = fs.readFileSync(terminalPanelPath, 'utf8');

  assert.ok(
    terminalPanelContent.includes('export interface TerminalPanelProps'),
    'TerminalPanel must export TerminalPanelProps'
  );
  assert.ok(
    terminalPanelContent.includes('stdin?: string;'),
    'TerminalPanelProps must accept stdin'
  );
  console.log('[PASS] TerminalPanelProps interface verified');

  console.log('\n======================================================');
  console.log('ALL TAB CLOSING & STDIN VERIFICATION TESTS PASSED!');
  console.log('======================================================');
}

runTabClosingAndStdinTests().catch((err) => {
  console.error('[FAIL] Test execution failed:', err);
  process.exit(1);
});
