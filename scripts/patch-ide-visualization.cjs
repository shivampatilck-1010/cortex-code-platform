const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '..', 'src', 'app', 'page.tsx');
let code = fs.readFileSync(targetPath, 'utf8');

const isCRLF = code.includes('\r\n');
const nl = isCRLF ? '\r\n' : '\n';

// 1. Add imports
if (!code.includes('CodeVisualizationWorkspace')) {
  code = code.replace(
    "import { MonacoCodeEditor } from '@/components/editor/MonacoCodeEditor';",
    "import { MonacoCodeEditor } from '@/components/editor/MonacoCodeEditor';" + nl +
    "import { CodeVisualizationWorkspace } from '@/components/visualization/CodeVisualizationWorkspace';" + nl +
    "import { TraceSession } from '@/lib/visualization/types';"
  );
}

// 2. Add Visualization state variables
if (!code.includes('editorLayoutMode')) {
  const stateTarget = "  // 4. Debugger State";
  const stateReplacement = `  // 4. Visualization & Layout State
  const [editorLayoutMode, setEditorLayoutMode] = useState<'code' | 'visualize' | 'split'>('code');
  const [traceSession, setTraceSession] = useState<TraceSession | null>(null);
  const [isTracing, setIsTracing] = useState<boolean>(false);

  // 4. Debugger State`;
  code = code.replace(stateTarget, stateReplacement);
}

// 3. Add handleRunTrace handler
if (!code.includes('handleRunTrace')) {
  const handlerTarget = "  // Visual Debugger Controls";
  const handlerReplacement = `  // Live Code Visualization Handler
  const handleRunTrace = async () => {
    if (isTracing) return;
    setIsTracing(true);
    if (editorLayoutMode === 'code') {
      setEditorLayoutMode('split');
    }
    try {
      const res = await fetch('/api/v1/visualize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: currentLang.id,
          files,
          entrypoint: activeFile?.name,
          stdin: customStdin,
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

  // Visual Debugger Controls`;
  code = code.replace(handlerTarget, handlerReplacement);
}

// 4. Pass props to Navbar
const navbarTarget = `        onRun={handleRun}
        isRunning={isRunning}
        onDebug={handleStartDebug}
        isDebugging={isDebugging}`.replace(/\n/g, nl);

const navbarReplacement = `        onRun={handleRun}
        isRunning={isRunning}
        onDebug={handleStartDebug}
        isDebugging={isDebugging}
        onVisualize={handleRunTrace}
        isVisualizing={isTracing}
        layoutMode={editorLayoutMode}
        onLayoutModeChange={setEditorLayoutMode}`.replace(/\n/g, nl);

code = code.replace(navbarTarget, navbarReplacement);

// 5. Wrap Center Pane with layout modes
const centerPaneStart = `          {/* Center Pane: Monaco Editor (Fullscreen mode & local dark/light theme switch) */}
          <div className="flex-1 overflow-hidden relative">
            <MonacoCodeEditor`.replace(/\n/g, nl);

const centerPaneEnd = `              enableInlineSuggestions={enableInlineSuggestions}
              onToggleInlineSuggestions={handleToggleInlineSuggestions}
            />
          </div>`.replace(/\n/g, nl);

const centerReplacement = `          {/* Center Pane: Multi-Layout (Code, Visualize, Split View) */}
          <div className="flex-1 flex overflow-hidden relative">
            {(editorLayoutMode === 'code' || editorLayoutMode === 'split') && (
              <div className={\`\${editorLayoutMode === 'split' ? 'w-1/2 border-r border-[#1f2024]' : 'w-full'} h-full overflow-hidden relative\`}>
                <MonacoCodeEditor
                  files={files}
                  activeFileId={activeFileId}
                  onSelectFile={setActiveFileId}
                  onCloseFile={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
                  onNewFile={() => {
                    const nonFolders = files.filter((f) => !f.isFolder);
                    const fileName = \`file_\${nonFolders.length + 1}\${currentLang.fileExtension}\`;
                    const newF: ProjectFile = {
                      id: \`f_\${Date.now()}_\${Math.random().toString(36).substring(2, 6)}\`,
                      name: fileName,
                      path: \`/\${fileName}\`,
                      content: getStarterContentForFile(fileName, currentLang),
                    };
                    setFiles((prev) => [...prev, newF]);
                    setActiveFileId(newF.id);
                  }}
                  onContentChange={handleContentChange}
                  language={getMonacoLangForFile(activeFile?.name || '', currentLang.monacoLang)}
                  theme={theme}
                  fontSize={fontSize}
                  breakpoints={breakpoints}
                  onToggleBreakpoint={(line) => {
                    setBreakpoints((prev) =>
                      prev.includes(line) ? prev.filter((l) => l !== line) : [...prev, line]
                    );
                  }}
                  activeLine={activeDebugLine}
                  diagnostics={executionResult?.diagnostics}
                  onCursorChange={(l, c) => {
                    if (collabBrokerRef.current) {
                      collabBrokerRef.current.updateCursor(activeFileId, l, c);
                    }
                  }}
                  isDarkMode={isDarkMode}
                  onToggleDarkMode={handleToggleDarkMode}
                  isFullscreen={isFullscreen}
                  onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
                  quickFixResult={fixResult}
                  isQuickFixOpen={isQuickFixOpen}
                  onCloseQuickFix={() => setIsQuickFixOpen(false)}
                  onApplyExplanationComment={handleApplyExplanationComment}
                  onApplyLiveFix={handleApplyLiveFix}
                  aiProvider={aiSettings.provider === 'gemini' || Boolean(aiSettings.apiKey) ? 'gemini' : 'offline'}
                  apiKey={aiSettings.apiKey || ''}
                  onSaveApiKey={handleSaveApiKey}
                  isAnalyzingFix={isAnalyzingFix}
                  onReanalyzeWithKey={handleReanalyzeWithKey}
                  enableInlineSuggestions={enableInlineSuggestions}
                  onToggleInlineSuggestions={handleToggleInlineSuggestions}
                />
              </div>
            )}

            {(editorLayoutMode === 'visualize' || editorLayoutMode === 'split') && (
              <div className={\`\${editorLayoutMode === 'split' ? 'w-1/2' : 'w-full'} h-full overflow-hidden relative\`}>
                <CodeVisualizationWorkspace
                  traceSession={traceSession}
                  isLoading={isTracing}
                  language={currentLang.id}
                  sourceCode={activeFile?.content || ''}
                  onRunTrace={handleRunTrace}
                  onStepChange={(line) => setActiveDebugLine(line)}
                  showSourcePane={editorLayoutMode === 'visualize'}
                />
              </div>
            )}
          </div>`.replace(/\n/g, nl);

// Find and replace the center pane block
const idxStart = code.indexOf(centerPaneStart);
const idxEnd = code.indexOf(centerPaneEnd);

if (idxStart !== -1 && idxEnd !== -1) {
  code = code.substring(0, idxStart) + centerReplacement + code.substring(idxEnd + centerPaneEnd.length);
  console.log('Found and replaced Center Pane in page.tsx');
} else {
  console.error('Could not locate Center Pane block:', { idxStart, idxEnd });
}

fs.writeFileSync(targetPath, code, 'utf8');
console.log('Successfully patched page.tsx');
