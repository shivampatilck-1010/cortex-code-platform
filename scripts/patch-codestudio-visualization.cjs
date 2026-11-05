const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '..', 'src', 'components', 'live-class', 'modules', 'codestudio', 'CodeStudioModule.tsx');
let code = fs.readFileSync(targetPath, 'utf8');

const isCRLF = code.includes('\r\n');
const nl = isCRLF ? '\r\n' : '\n';

// 1. Add Activity icon import
if (!code.includes('Activity,')) {
  code = code.replace(
    "import {\n  Play,",
    "import {\n  Play,\n  Activity,"
  );
  code = code.replace(
    "import {\r\n  Play,",
    "import {\r\n  Play,\r\n  Activity,"
  );
}

// 2. Add CodeVisualizationWorkspace and TraceSession import
if (!code.includes('CodeVisualizationWorkspace')) {
  code = code.replace(
    "import { CodeFile, CodeStudioModuleProps, ExecutionResult, BroadcastState, TeacherWorkspaceMode, StudentWorkspaceTab } from './types';",
    "import { CodeFile, CodeStudioModuleProps, ExecutionResult, BroadcastState, TeacherWorkspaceMode, StudentWorkspaceTab } from './types';" + nl +
    "import { CodeVisualizationWorkspace } from '@/components/visualization/CodeVisualizationWorkspace';" + nl +
    "import { TraceSession } from '@/lib/visualization/types';"
  );
}

// 3. Add trace state variables and update activeTerminalTab
if (!code.includes('isTracing')) {
  code = code.replace(
    "const [activeTerminalTab, setActiveTerminalTab] = useState<'output' | 'compiler' | 'stdin'>('output');",
    "const [activeTerminalTab, setActiveTerminalTab] = useState<'output' | 'compiler' | 'stdin' | 'visualize'>('output');" + nl +
    "  const [traceSession, setTraceSession] = useState<TraceSession | null>(null);" + nl +
    "  const [isTracing, setIsTracing] = useState<boolean>(false);"
  );
}

// 4. Add handleRunVisualization handler
if (!code.includes('handleRunVisualization')) {
  const handlerTarget = "  // --- Real Code Execution Handler ---";
  const handlerReplacement = `  // --- Real Live Trace Visualization Handler ---
  const handleRunVisualization = async () => {
    if (isTracing) return;
    setIsTracing(true);
    setIsConsoleOpen(true);
    setActiveTerminalTab('visualize');

    const targetFile = isTeacher ? activeTeachingFile : activeStudentFile;
    const targetFiles = isTeacher ? teachingFiles : studentFiles;

    try {
      const res = await fetch('/api/v1/visualize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: targetFile.language || 'python',
          files: targetFiles.map((f) => ({
            id: f.id,
            name: f.name,
            path: \`/\${f.name}\`,
            content: f.content,
          })),
          entrypoint: targetFile.name,
          stdin: stdinBuffer,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.session) {
          setTraceSession(data.session);
        }
      }
    } catch (err) {
      console.error('Visualization error:', err);
    } finally {
      setIsTracing(false);
    }
  };

  // --- Real Code Execution Handler ---`;
  code = code.replace(handlerTarget, handlerReplacement);
}

// 5. Add Visualize button in action toolbar
const buttonTarget = `                title="Run Code in Authorized Backend"
                aria-label="Run Code"
              >
                <Play className="w-3.5 h-3.5 fill-black" />
                <span>Run Code</span>
              </button>`.replace(/\n/g, nl);

const buttonReplacement = `                title="Run Code in Authorized Backend"
                aria-label="Run Code"
              >
                <Play className="w-3.5 h-3.5 fill-black" />
                <span>Run Code</span>
              </button>
              <button
                onClick={handleRunVisualization}
                disabled={isTracing}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#06B6D4]/15 hover:bg-[#06B6D4]/25 text-[#06B6D4] border border-[#06B6D4]/40 font-semibold text-xs transition shadow-sm active:scale-95 disabled:opacity-50"
                title="Trace & Visualize Code Execution"
                aria-label="Visualize Code"
              >
                <Activity className={\`w-3.5 h-3.5 \${isTracing ? 'animate-spin' : ''}\`} />
                <span>{isTracing ? 'Tracing...' : 'Visualize'}</span>
              </button>`.replace(/\n/g, nl);

code = code.replace(buttonTarget, buttonReplacement);

// 6. Add tab button in terminal dock
const tabTarget = `                  Stdin
                </button>`.replace(/\n/g, nl);

const tabReplacement = `                  Stdin
                </button>
                <button
                  onClick={() => setActiveTerminalTab('visualize')}
                  className={\`px-2.5 py-1 text-xs font-semibold rounded transition flex items-center space-x-1 \${
                    activeTerminalTab === 'visualize'
                      ? 'bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/40 font-bold'
                      : 'text-[#71717A] hover:text-[#A1A1AA]'
                  }\`}
                >
                  <Activity className="w-3 h-3 mr-1" />
                  <span>Visualize</span>
                </button>`.replace(/\n/g, nl);

code = code.replace(tabTarget, tabReplacement);

// 7. Add visualize tab content in dock
const contentTarget = `              {activeTerminalTab === 'stdin' && (`.replace(/\n/g, nl);

const contentReplacement = `              {activeTerminalTab === 'visualize' && (
                <div className="h-full min-h-[300px] flex flex-col overflow-hidden">
                  <CodeVisualizationWorkspace
                    traceSession={traceSession}
                    isLoading={isTracing}
                    language={isTeacher ? activeTeachingFile.language : activeStudentFile.language}
                    sourceCode={isTeacher ? activeTeachingFile.content : activeStudentFile.content}
                    onRunTrace={handleRunVisualization}
                  />
                </div>
              )}
              {activeTerminalTab === 'stdin' && (`.replace(/\n/g, nl);

code = code.replace(contentTarget, contentReplacement);

fs.writeFileSync(targetPath, code, 'utf8');
console.log('Successfully patched CodeStudioModule.tsx with visualization engine');
