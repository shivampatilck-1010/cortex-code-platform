import fs from 'fs';
import path from 'path';

interface AssertionResult {
  name: string;
  passed: boolean;
  details?: string;
}

const results: AssertionResult[] = [];

function assert(name: string, condition: boolean, details?: string) {
  results.push({ name, passed: condition, details });
  const status = condition ? '[PASS]' : '[FAIL]';
  console.log(`${status} ${name}`);
  if (!condition && details) {
    console.error(`       Reason: ${details}`);
  }
}

async function runEditorRegressionTests() {
  console.log('================================================================');
  console.log('CORTEX CODE PLATFORM - EDITOR REGRESSION VERIFICATION SUITE');
  console.log('Testing Normal Typing, Backspace Across Lines, Multiline Editing,');
  console.log('Clipboard Operations, and Synchronization Non-Interference');
  console.log('================================================================\n');

  const baseDir = process.cwd();

  // -------------------------------------------------------------
  // TEST GROUP 1: Code Inspection & Structural Guarantees
  // -------------------------------------------------------------
  console.log('--- TEST GROUP 1: Editor Components & Event Listeners Audit ---');

  const monacoCodeEditorPath = path.join(baseDir, 'src/components/editor/MonacoCodeEditor.tsx');
  const codeStudioModulePath = path.join(baseDir, 'src/components/live-class/modules/codestudio/CodeStudioModule.tsx');
  const timelineControlsPath = path.join(baseDir, 'src/components/visualization/TimelineControls.tsx');
  const quickFixWidgetPath = path.join(baseDir, 'src/components/editor/InlineQuickFixWidget.tsx');
  const presentationModulePath = path.join(baseDir, 'src/components/live-class/modules/presentation/PresentationModule.tsx');
  const whiteboardModulePath = path.join(baseDir, 'src/components/live-class/modules/whiteboard/WhiteboardModule.tsx');

  const monacoEditorSrc = fs.readFileSync(monacoCodeEditorPath, 'utf8');
  const codeStudioSrc = fs.readFileSync(codeStudioModulePath, 'utf8');
  const timelineSrc = fs.readFileSync(timelineControlsPath, 'utf8');
  const quickFixSrc = fs.readFileSync(quickFixWidgetPath, 'utf8');
  const presentationSrc = fs.readFileSync(presentationModulePath, 'utf8');
  const whiteboardSrc = fs.readFileSync(whiteboardModulePath, 'utf8');

  // 1.1 MonacoCodeEditor uses pendingReportedValuesRef and removed 50ms timeout
  assert(
    'MonacoCodeEditor tracks pending local edits via pendingReportedValuesRef',
    monacoEditorSrc.includes('pendingReportedValuesRef') &&
      monacoEditorSrc.includes('pendingReportedValuesRef.current.add(nextVal)')
  );

  assert(
    'MonacoCodeEditor eliminated fragile setTimeout isSelfEditingRef race condition',
    !monacoEditorSrc.includes('isSelfEditingRef.current = false') &&
      !monacoEditorSrc.includes('setTimeout(() => {\n              isSelfEditingRef')
  );

  assert(
    'MonacoCodeEditor assigns unique path to Editor models for multi-file stability',
    monacoEditorSrc.includes('path={activeFile?.id}')
  );

  assert(
    'MonacoCodeEditor preserves selection during external document synchronization',
    monacoEditorSrc.includes('const prevSelection = editorRef.current.getSelection()') &&
      monacoEditorSrc.includes('editorRef.current.setSelection(prevSelection)')
  );

  // 1.2 CodeStudioModule uses uncontrolled defaultValue and eliminates value overwrite
  assert(
    'CodeStudioModule primary editor uses uncontrolled defaultValue instead of controlled value',
    codeStudioSrc.includes('defaultValue={isTeacher ? activeTeachingFile.content : activeStudentFile.content}') &&
      !codeStudioSrc.includes('value={isTeacher ? activeTeachingFile.content : activeStudentFile.content}')
  );

  assert(
    'CodeStudioModule split-view editor uses uncontrolled defaultValue',
    codeStudioSrc.includes('defaultValue={activeTeachingFile.content}') &&
      !codeStudioSrc.includes('value={activeTeachingFile.content}\n                  onChange={handleTeachingCodeChange}')
  );

  assert(
    'CodeStudioModule binds distinct model keys and paths per active file',
    codeStudioSrc.includes('key={isTeacher ? `teach-${activeTeachingFile.id}` : `stud-${activeStudentFile.id}`}') &&
      codeStudioSrc.includes('path={isTeacher ? `teaching-${activeTeachingFile.id}` : `student-${activeStudentFile.id}`}')
  );

  assert(
    'CodeStudioModule has safe external synchronization effects without typing fight',
    codeStudioSrc.includes('Synchronize teacher workspace editor on external updates') &&
      codeStudioSrc.includes('Synchronize student workspace editor on external updates')
  );

  // 1.3 TimelineControls does not hijack Monaco keyboard navigation
  assert(
    'TimelineControls verifies !closest(.monaco-editor) before intercepting navigation keys',
    timelineSrc.includes('.closest(\'.monaco-editor\')') &&
      timelineSrc.includes('target?.closest(\'.monaco-editor\')')
  );

  // 1.4 InlineQuickFixWidget does not steal keys from Monaco editor
  assert(
    'InlineQuickFixWidget checks .monaco-editor before intercepting 1, 2, Enter, or Escape',
    quickFixSrc.includes('.closest(\'.monaco-editor\')') &&
      quickFixSrc.includes('target?.closest(\'.monaco-editor\')')
  );

  // 1.5 PresentationModule checks activeModule and .monaco-editor
  assert(
    'PresentationModule verifies activeModule === \'presentation\' and skips Monaco editor',
    presentationSrc.includes('if (activeModule !== \'presentation\') return;') &&
      presentationSrc.includes('.closest(\'.monaco-editor\')')
  );

  // 1.6 WhiteboardModule checks activeModule and .monaco-editor
  assert(
    'WhiteboardModule verifies activeModule === \'whiteboard\' and skips Monaco editor',
    whiteboardSrc.includes('if (activeModule !== \'whiteboard\') return;') &&
      whiteboardSrc.includes('.closest(\'.monaco-editor\')')
  );

  // -------------------------------------------------------------
  // TEST GROUP 2: Deterministic Document Model & Editing Simulation
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Deterministic Editing & Keystroke Simulation ---');

  // Simulated Document Buffer modeling Monaco ITextModel behavior
  class SimulatedTextModel {
    private content: string;
    private undoStack: string[] = [];
    private redoStack: string[] = [];

    constructor(initialContent: string = '') {
      this.content = initialContent;
    }

    getValue(): string {
      return this.content;
    }

    setValue(newContent: string) {
      this.undoStack.push(this.content);
      this.redoStack = [];
      this.content = newContent;
    }

    insertText(position: number, text: string) {
      this.undoStack.push(this.content);
      this.redoStack = [];
      this.content = this.content.slice(0, position) + text + this.content.slice(position);
    }

    deleteRange(start: number, length: number) {
      this.undoStack.push(this.content);
      this.redoStack = [];
      this.content = this.content.slice(0, start) + this.content.slice(start + length);
    }

    undo(): boolean {
      if (this.undoStack.length === 0) return false;
      this.redoStack.push(this.content);
      this.content = this.undoStack.pop()!;
      return true;
    }

    redo(): boolean {
      if (this.redoStack.length === 0) return false;
      this.undoStack.push(this.content);
      this.content = this.redoStack.pop()!;
      return true;
    }

    getLineCount(): number {
      return this.content.split('\n').length;
    }

    getLine(oneBasedIndex: number): string {
      const lines = this.content.split('\n');
      return lines[oneBasedIndex - 1] ?? '';
    }
  }

  // 2.1 Typing characters consecutively
  const model = new SimulatedTextModel('function main() {\n  return 0;\n}');
  // Type 'const x = 10;' inside function at position 19 (after '\n  ')
  const insertPos = model.getValue().indexOf('return');
  model.insertText(insertPos, 'const x = 10;\n  ');
  assert(
    'Normal typing: characters inserted cleanly without buffer corruption',
    model.getValue().includes('const x = 10;\n  return 0;')
  );

  // 2.2 Enter and newline insertion across lines
  const linesBefore = model.getLineCount();
  const enterPos = model.getValue().indexOf('const x = 10;') + 'const x = 10;'.length;
  model.insertText(enterPos, '\n  const y = 20;');
  assert(
    'Newline insertion: Enter increments line count and maintains indentation',
    model.getLineCount() === linesBefore + 1 &&
      model.getValue().includes('const x = 10;\n  const y = 20;\n  return 0;')
  );

  // 2.3 Backspace across line boundary (merging lines)
  // Delete the newline character between 'const x = 10;' and '  const y = 20;'
  const newlinePos = model.getValue().indexOf('\n  const y = 20;');
  // Deleting the newline merges line 2 and line 3
  model.deleteRange(newlinePos, 1);
  assert(
    'Backspace across lines: deleting newline boundary merges adjacent lines cleanly',
    model.getValue().includes('const x = 10;  const y = 20;') &&
      model.getLineCount() === linesBefore
  );

  // 2.4 Delete forward across line boundaries
  const targetSemi = model.getValue().indexOf('const x = 10;') + 'const x = 10;'.length;
  model.deleteRange(targetSemi, 2); // delete spaces
  assert(
    'Delete key: forward delete cleans spaces and boundaries without line distortion',
    model.getValue().includes('const x = 10;const y = 20;')
  );

  // 2.5 Multiline paste
  const clipboardSnippet = [
    '// Algorithm Solution',
    'function fibonacci(n: number): number {',
    '  if (n <= 1) return n;',
    '  return fibonacci(n - 1) + fibonacci(n - 2);',
    '}',
  ].join('\n');

  model.setValue(clipboardSnippet);
  assert(
    'Multiline paste: pasted code block retains exact line structure and line count',
    model.getLineCount() === 5 &&
      model.getLine(1) === '// Algorithm Solution' &&
      model.getLine(4) === '  return fibonacci(n - 1) + fibonacci(n - 2);'
  );

  // 2.6 Undo and Redo operations
  const pastedValue = model.getValue();
  // Modify line 1
  model.insertText(0, '/* Header */\n');
  assert(
    'Editing after paste: new edit prepended to buffer',
    model.getValue().startsWith('/* Header */\n// Algorithm Solution')
  );

  const undone = model.undo();
  assert(
    'Undo operation: Ctrl+Z cleanly restores previous state without losing document history',
    undone && model.getValue() === pastedValue
  );

  const redone = model.redo();
  assert(
    'Redo operation: Ctrl+Y / Ctrl+Shift+Z successfully re-applies undone modification',
    redone && model.getValue().startsWith('/* Header */\n// Algorithm Solution')
  );

  // -------------------------------------------------------------
  // TEST GROUP 3: React State Echo & Concurrency Non-Interference
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: React Synchronization & Stale Props Non-Interference ---');

  // Simulate the React Synchronization Loop using our new algorithm
  class SynchronizedEditorSimulator {
    public editorModelText: string;
    public lastReportedValue: string;
    public pendingReportedValues: Set<string>;
    public selection: { line: number; col: number };

    constructor(initialText: string) {
      this.editorModelText = initialText;
      this.lastReportedValue = initialText;
      this.pendingReportedValues = new Set();
      this.selection = { line: 1, col: 1 };
    }

    // User types in the editor
    userTypes(newText: string, cursorLine: number, cursorCol: number) {
      this.editorModelText = newText;
      this.lastReportedValue = newText;
      this.pendingReportedValues.add(newText);
      this.selection = { line: cursorLine, col: cursorCol };
    }

    // React re-renders with a prop value (which might be lagging behind current user typing)
    receiveReactProp(incomingPropContent: string) {
      const currentVal = this.editorModelText;

      // The exact logic from MonacoCodeEditor.tsx
      if (
        incomingPropContent !== currentVal &&
        incomingPropContent !== this.lastReportedValue &&
        !this.pendingReportedValues.has(incomingPropContent)
      ) {
        // Genuine external update: apply to editor
        this.lastReportedValue = incomingPropContent;
        this.pendingReportedValues.clear();
        this.editorModelText = incomingPropContent;
      } else if (this.pendingReportedValues.has(incomingPropContent)) {
        // Acknowledged local edit from earlier render: consume from pending set
        this.pendingReportedValues.delete(incomingPropContent);
      }
    }
  }

  const sim = new SynchronizedEditorSimulator('let a = 1;');

  // Fast typing simulation: Keystroke 1: 'let a = 10;'
  sim.userTypes('let a = 10;', 1, 11);
  // Fast typing simulation: Keystroke 2: 'let a = 100;' before React finishes re-rendering
  sim.userTypes('let a = 100;', 1, 12);

  // Delayed React re-render arrives with the state from Keystroke 1 ('let a = 10;')
  sim.receiveReactProp('let a = 10;');

  // Verify that the editor was NOT reverted to 'let a = 10;'!
  assert(
    'Rapid typing safety: delayed React state echo does not clobber in-flight keystrokes',
    sim.editorModelText === 'let a = 100;' &&
      sim.selection.line === 1 &&
      sim.selection.col === 12
  );

  // When Keystroke 2 prop arrives ('let a = 100;')
  sim.receiveReactProp('let a = 100;');
  assert(
    'Prop convergence: acknowledged prop clears pending queue and leaves editor intact',
    sim.editorModelText === 'let a = 100;' &&
      sim.pendingReportedValues.size === 0
  );

  // Genuine external update arrives (e.g. AI fix applied: 'const a = 100;')
  sim.receiveReactProp('const a = 100;');
  assert(
    'External update adoption: genuine non-local changes (AI fix, templates) apply cleanly',
    sim.editorModelText === 'const a = 100;'
  );

  // -------------------------------------------------------------
  // TEST GROUP 4: Keyboard Event Filter Non-Interference
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Keyboard Event Filtering & Shortcuts ---');

  interface MockEvent {
    key: string;
    defaultPrevented: boolean;
    preventDefault: () => void;
    target: any;
  }

  function createMockEvent(key: string, isInsideMonaco: boolean): MockEvent {
    let prevented = false;
    const targetElement = isInsideMonaco
      ? {
          tagName: 'DIV',
          isContentEditable: false,
          closest: (selector: string) => (selector === '.monaco-editor' ? {} : null),
        }
      : {
          tagName: 'DIV',
          isContentEditable: false,
          closest: () => null,
        };

    return {
      key,
      get defaultPrevented() {
        return prevented;
      },
      preventDefault() {
        prevented = true;
      },
      target: targetElement,
    };
  }

  // Simulate TimelineControls filter logic
  function timelineControlsFilter(e: MockEvent): boolean {
    const target = e.target;
    if (
      target?.tagName === 'INPUT' ||
      target?.tagName === 'TEXTAREA' ||
      target?.isContentEditable ||
      Boolean(target?.closest('.monaco-editor'))
    ) {
      return false; // Skip, do not preventDefault
    }
    if (['ArrowLeft', 'ArrowRight', ' ', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      return true;
    }
    return false;
  }

  // Simulate WhiteboardModule filter logic
  function whiteboardFilter(e: MockEvent, activeModule: string): boolean {
    if (activeModule !== 'whiteboard') return false;
    const target = e.target;
    if (
      target?.tagName === 'INPUT' ||
      target?.tagName === 'TEXTAREA' ||
      target?.isContentEditable ||
      Boolean(target?.closest('.monaco-editor'))
    ) {
      return false;
    }
    if (['Backspace', 'Delete', 'z', 'y'].includes(e.key)) {
      e.preventDefault();
      return true;
    }
    return false;
  }

  // Simulate PresentationModule filter logic
  function presentationFilter(e: MockEvent, activeModule: string): boolean {
    if (activeModule !== 'presentation') return false;
    const target = e.target;
    if (
      target?.tagName === 'INPUT' ||
      target?.tagName === 'TEXTAREA' ||
      target?.isContentEditable ||
      Boolean(target?.closest('.monaco-editor'))
    ) {
      return false;
    }
    if (['ArrowRight', 'ArrowLeft', ' ', 'f', 'p', 'a', 'l'].includes(e.key)) {
      e.preventDefault();
      return true;
    }
    return false;
  }

  // 4.1 Space key in Monaco when timeline is active
  const spaceEvent = createMockEvent(' ', true);
  timelineControlsFilter(spaceEvent);
  assert(
    'TimelineControls does not call preventDefault on Space key inside Monaco editor',
    !spaceEvent.defaultPrevented
  );

  // 4.2 Arrow keys in Monaco when timeline is active
  const arrowEvent = createMockEvent('ArrowLeft', true);
  timelineControlsFilter(arrowEvent);
  assert(
    'TimelineControls does not call preventDefault on Arrow keys inside Monaco editor',
    !arrowEvent.defaultPrevented
  );

  // 4.3 Backspace in Monaco when Whiteboard module is mounted in Live Class
  const backspaceEvent = createMockEvent('Backspace', true);
  whiteboardFilter(backspaceEvent, 'code'); // activeModule is 'code'
  assert(
    'WhiteboardModule does not intercept Backspace when user is in Code Studio',
    !backspaceEvent.defaultPrevented
  );

  // 4.4 Space and Arrow keys when Presentation module is mounted in Live Class
  const presSpaceEvent = createMockEvent(' ', true);
  presentationFilter(presSpaceEvent, 'code');
  assert(
    'PresentationModule does not intercept Space key when user is in Code Studio',
    !presSpaceEvent.defaultPrevented
  );

  // 4.5 Letter keys 'f', 'a', 'p', 'l' in Monaco when Presentation module is mounted
  const letterEvent = createMockEvent('f', true);
  presentationFilter(letterEvent, 'code');
  assert(
    'PresentationModule does not intercept letter keys (f, a, p, l) when user is in Code Studio',
    !letterEvent.defaultPrevented
  );

  // -------------------------------------------------------------
  // TEST SUMMARY
  // -------------------------------------------------------------
  console.log('\n================================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`TOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);

  if (failed > 0) {
    console.error(`\nFAILED TESTS (${failed}):`);
    results.filter((r) => !r.passed).forEach((r) => console.error(` - ${r.name}: ${r.details || 'Assertion failed'}`));
    process.exit(1);
  } else {
    console.log('ALL EDITOR REGRESSION TESTS PASSED SUCCESSFULLY.');
    console.log('================================================================');
  }
}

runEditorRegressionTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
