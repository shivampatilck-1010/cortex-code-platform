'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Play, 
  Layers, 
  Variable, 
  Terminal, 
  AlertCircle, 
  Database, 
  Cpu, 
  RefreshCw, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  Target,
  CheckCircle2,
  HelpCircle,
  X,
  ArrowRight
} from 'lucide-react';
import { TraceSession, ExecutionStateSnapshot } from '@/lib/visualization/types';
import { reconstructState } from '@/lib/visualization/state-engine';
import { hasTracingSupport, LANGUAGE_SUPPORT_MATRIX } from '@/lib/visualization/registry';
import { VariableInspector } from './VariableInspector';
import { CallStackInspector } from './CallStackInspector';
import { StructureRenderer, SelectedElementInfo } from './StructureRenderer';
import { TimelineControls } from './TimelineControls';

interface CodeVisualizationWorkspaceProps {
  traceSession: TraceSession | null;
  isLoading: boolean;
  language: string;
  sourceCode: string;
  onRunTrace: () => void;
  onStepChange?: (line: number) => void;
  showSourcePane?: boolean;
}

export const CodeVisualizationWorkspace: React.FC<CodeVisualizationWorkspaceProps> = ({
  traceSession,
  isLoading,
  language,
  sourceCode,
  onRunTrace,
  onStepChange,
  showSourcePane = false,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'canvas' | 'state' | 'callstack' | 'output'>('canvas');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [selectedElement, setSelectedElement] = useState<SelectedElementInfo | null>(null);
  
  // Optional Restrained Gamification: Prediction Challenge Mode
  const [isPredictionMode, setIsPredictionMode] = useState<boolean>(false);
  const [predictionAnswered, setPredictionAnswered] = useState<boolean>(false);
  const [isPredictionCorrect, setIsPredictionCorrect] = useState<boolean | null>(null);

  const events = traceSession?.events || [];
  const totalSteps = events.length;

  // Reset step index and selection when a new trace session arrives
  useEffect(() => {
    if (traceSession && traceSession.events.length > 0) {
      setCurrentStepIndex(0);
      setSelectedElement(null);
      setPredictionAnswered(false);
      setIsPredictionCorrect(null);
    }
  }, [traceSession?.sessionId]);

  // Reconstruct deterministic execution state at currentStepIndex
  const snapshot: ExecutionStateSnapshot = useMemo(() => {
    return reconstructState(events, currentStepIndex);
  }, [events, currentStepIndex]);

  // Next step state for prediction challenge
  const nextSnapshot = useMemo(() => {
    if (currentStepIndex < totalSteps - 1) {
      return reconstructState(events, currentStepIndex + 1);
    }
    return null;
  }, [events, currentStepIndex, totalSteps]);

  // Notify parent on step change for editor line synchronization
  useEffect(() => {
    if (snapshot.currentLine && onStepChange) {
      onStepChange(snapshot.currentLine);
    }
    setPredictionAnswered(false);
    setIsPredictionCorrect(null);
  }, [snapshot.currentLine, onStepChange, currentStepIndex]);

  const isTraceSupported = hasTracingSupport(language);
  const matrixInfo = LANGUAGE_SUPPORT_MATRIX.find((m) => m.language === language.toLowerCase());

  // Source Code Split Lines
  const sourceLines = useMemo(() => sourceCode.split('\n'), [sourceCode]);

  // Zoom controls
  const handleZoomIn = () => setZoomLevel((z) => Math.min(1.8, Math.round((z + 0.15) * 100) / 100));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.6, Math.round((z - 0.15) * 100) / 100));
  const handleZoomReset = () => setZoomLevel(1);

  // Compute prediction challenge data unconditionally before any early returns to respect Rules of Hooks
  const targetPredictionVar = nextSnapshot?.changedVariables?.[0];
  const nextTargetRecord = targetPredictionVar ? nextSnapshot?.variables?.[targetPredictionVar] : undefined;
  const currentVal = targetPredictionVar ? snapshot?.variables?.[targetPredictionVar]?.value : undefined;
  const nextVal = nextTargetRecord?.value;

  const predictionChoices = useMemo(() => {
    if (!targetPredictionVar || nextVal === undefined) return [];
    const correct = typeof nextVal === 'object' ? JSON.stringify(nextVal) : String(nextVal);
    const prev = currentVal !== undefined ? (typeof currentVal === 'object' ? JSON.stringify(currentVal) : String(currentVal)) : '0';
    
    // Generate 3 plausible alternatives
    const options = [correct];
    if (typeof nextVal === 'number') {
      options.push(String(nextVal + 1));
      options.push(String(Math.max(0, nextVal - 1)));
    } else if (typeof nextVal === 'string') {
      options.push(`"${nextVal}!"`);
      options.push(`""`);
    } else {
      options.push(prev);
      options.push('null');
    }
    // Deduplicate and sort
    return Array.from(new Set(options)).slice(0, 3);
  }, [targetPredictionVar, nextVal, currentVal]);

  // If language does not support tracing, display honest status message
  if (!isTraceSupported && (!traceSession || traceSession.events.length === 0)) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center bg-[#0E0F12] text-[#A1A1AA] select-text">
        <Cpu className="w-10 h-10 mb-3 text-[#FF9100]/60" />
        <h3 className="text-sm font-semibold text-white mb-1">
          Internal Tracing Unavailable for {matrixInfo?.name || language}
        </h3>
        <p className="text-xs max-w-md text-[#71717A] leading-relaxed mb-4 font-mono">
          Program execution is available; internal visualization is not supported by this runtime yet.
        </p>
        <div className="p-3 bg-[#15161C] border border-[#282A36] rounded-lg max-w-md text-left text-[11px] font-mono space-y-1">
          <div className="text-white font-semibold">Planned Tracing Architecture:</div>
          <div className="text-[#06B6D4]">{matrixInfo?.tracingImplementation || 'Native Runtime Instrumentation'}</div>
          <div className="text-[#71717A] pt-1">
            Normal execution via standard runner remains fully operational.
          </div>
        </div>
      </div>
    );
  }

  // Empty state before trace execution
  if (!traceSession && !isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center bg-[#0E0F12] text-[#A1A1AA]">
        <Database className="w-12 h-12 mb-3 text-[#06B6D4]/40" />
        <h3 className="text-sm font-semibold text-white mb-1">
          Live Code Execution Visualizer
        </h3>
        <p className="text-xs max-w-md text-[#71717A] leading-relaxed mb-5 font-mono">
          Run your {matrixInfo?.name || 'Python'} program with runtime event tracing to inspect variables, call stacks, memory mutations, and data structures step by step.
        </p>
        <button
          onClick={onRunTrace}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-[#06B6D4] hover:bg-[#0891B2] text-black font-semibold font-mono text-xs rounded-md shadow-md transition"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Execute & Visualize Trace</span>
        </button>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center bg-[#0E0F12] text-[#A1A1AA]">
        <RefreshCw className="w-8 h-8 mb-3 text-[#06B6D4] animate-spin" />
        <p className="text-xs font-mono text-white font-semibold">
          Executing in Sandbox & Recording Runtime Events...
        </p>
        <p className="text-[11px] text-[#71717A] mt-1 font-mono">
          Introspecting frames, call stacks, and memory mutations
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0E0F12] text-[#E6EDF3] overflow-hidden select-text">
      {/* 1. Header Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#121318] border-b border-[#1F2024] text-xs">
        {/* Left: Status & Re-trace */}
        <div className="flex items-center space-x-2 truncate">
          <span className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-[#06B6D4]/10 text-[#06B6D4] font-mono text-[10px] font-bold border border-[#06B6D4]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#06B6D4]" />
            <span>Trace Active</span>
          </span>
          <button
            onClick={onRunTrace}
            disabled={isLoading}
            className="flex items-center space-x-1 px-2 py-0.5 rounded bg-[#181920] hover:bg-[#22242D] text-[#E4E4E7] border border-[#2B2D38] font-mono text-[11px] disabled:opacity-40 transition"
            title="Re-run and trace execution"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">Re-trace</span>
          </button>
          <span className="text-[#A1A1AA] text-xs font-mono hidden lg:inline truncate">
            {traceSession?.metadata?.adapterName || 'Runtime Tracer'}
          </span>
          {traceSession?.metadata?.truncated && (
            <span className="px-1.5 py-0.5 rounded bg-[#EAB308]/10 text-[#EAB308] border border-[#EAB308]/30 font-mono text-[10px]">
              Truncated (Limit Reached)
            </span>
          )}
        </div>

        {/* Center: Primary View Tabs */}
        <div className="flex items-center space-x-1 bg-[#181920] p-0.5 rounded border border-[#2B2D38] text-[11px] font-mono">
          <button
            onClick={() => setActiveTab('canvas')}
            className={`px-2.5 py-1 rounded transition ${
              activeTab === 'canvas'
                ? 'bg-[#22242D] text-white font-semibold'
                : 'text-[#71717A] hover:text-[#E4E4E7]'
            }`}
          >
            Visual Canvas ({snapshot.structureVisualizations.length})
          </button>
          <button
            onClick={() => setActiveTab('state')}
            className={`px-2.5 py-1 rounded transition ${
              activeTab === 'state'
                ? 'bg-[#22242D] text-white font-semibold'
                : 'text-[#71717A] hover:text-[#E4E4E7]'
            }`}
          >
            Variables ({Object.keys(snapshot.variables).length})
          </button>
          <button
            onClick={() => setActiveTab('callstack')}
            className={`px-2.5 py-1 rounded transition ${
              activeTab === 'callstack'
                ? 'bg-[#22242D] text-white font-semibold'
                : 'text-[#71717A] hover:text-[#E4E4E7]'
            }`}
          >
            Call Stack ({snapshot.callStack.length})
          </button>
          <button
            onClick={() => setActiveTab('output')}
            className={`px-2.5 py-1 rounded transition ${
              activeTab === 'output'
                ? 'bg-[#22242D] text-white font-semibold'
                : 'text-[#71717A] hover:text-[#E4E4E7]'
            }`}
          >
            Output
          </button>
        </div>

        {/* Right: Zoom & Prediction Mode Toggle */}
        <div className="flex items-center space-x-1.5">
          {/* Zoom controls */}
          <div className="hidden sm:flex items-center space-x-1 bg-[#181920] p-0.5 rounded border border-[#2B2D38] text-[10px] font-mono">
            <button
              onClick={handleZoomOut}
              className="p-1 hover:text-white text-[#71717A] transition"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="px-1 text-[#A1A1AA]">{Math.round(zoomLevel * 100)}%</span>
            <button
              onClick={handleZoomIn}
              className="p-1 hover:text-white text-[#71717A] transition"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
            <button
              onClick={handleZoomReset}
              className="p-1 hover:text-white text-[#71717A] transition"
              title="Reset Zoom (100%)"
            >
              <RotateCcw className="w-2.5 h-2.5" />
            </button>
          </div>

          {/* Prediction Challenge Toggle */}
          <button
            onClick={() => setIsPredictionMode((prev) => !prev)}
            className={`flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-mono border transition ${
              isPredictionMode
                ? 'bg-[#06B6D4]/15 border-[#06B6D4] text-[#06B6D4] font-bold'
                : 'bg-[#181920] border-[#2B2D38] text-[#71717A] hover:text-[#E4E4E7]'
            }`}
            title="Toggle interactive prediction challenges before stepping forward"
          >
            <Target className="w-3 h-3" />
            <span className="hidden md:inline">Prediction</span>
          </button>
        </div>
      </div>

      {/* 2. Execution Explanation Banner */}
      <div className="px-3.5 py-2.5 bg-[#101116] border-b border-[#1E2028] flex items-center justify-between text-xs font-mono">
        <div className="flex items-center space-x-2.5 min-w-0">
          <span className="px-2 py-0.5 rounded bg-[#FF9100]/15 text-[#FF9100] border border-[#FF9100]/30 font-bold text-[10px] uppercase flex-shrink-0">
            {snapshot.explanation?.category || 'Execution'}
          </span>
          <div className="truncate">
            <span className="text-white font-semibold mr-2">
              {snapshot.explanation?.headline}
            </span>
            <span className="text-[#A1A1AA] text-[11px] hidden sm:inline">
              {snapshot.explanation?.detail}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2 flex-shrink-0 pl-2">
          {snapshot.explanation?.observedOperation && (
            <span className="px-2 py-0.5 rounded bg-[#181920] border border-[#262832] text-[#06B6D4] text-[10px] font-mono">
              {snapshot.explanation.observedOperation}
            </span>
          )}
          <span className="text-[#71717A] text-[11px]">
            Line {snapshot.currentLine}
          </span>
        </div>
      </div>

      {/* 3. Optional Prediction Challenge Card */}
      {isPredictionMode && targetPredictionVar && !predictionAnswered && currentStepIndex < totalSteps - 1 && (
        <div className="px-4 py-2.5 bg-[#06B6D4]/10 border-b border-[#06B6D4]/30 flex flex-wrap items-center justify-between gap-2 text-xs font-mono animate-in fade-in duration-150">
          <div className="flex items-center space-x-2">
            <HelpCircle className="w-4 h-4 text-[#06B6D4] flex-shrink-0" />
            <span className="text-white font-semibold">
              Challenge: What will variable <strong className="text-[#06B6D4]">{targetPredictionVar}</strong> become on next step?
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {predictionChoices.map((choice, cIdx) => (
              <button
                key={cIdx}
                onClick={() => {
                  setPredictionAnswered(true);
                  const isCorrect = choice === (typeof nextVal === 'object' ? JSON.stringify(nextVal) : String(nextVal));
                  setIsPredictionCorrect(isCorrect);
                }}
                className="px-2.5 py-1 rounded bg-[#181920] hover:bg-[#252834] text-white border border-[#2B2D38] hover:border-[#06B6D4] text-xs font-mono transition"
              >
                {choice}
              </button>
            ))}
            <button
              onClick={() => setPredictionAnswered(true)}
              className="text-[#71717A] hover:text-white text-[11px] underline pl-1"
            >
              Reveal
            </button>
          </div>
        </div>
      )}

      {/* Feedback when prediction answered */}
      {isPredictionMode && predictionAnswered && isPredictionCorrect !== null && (
        <div className={`px-4 py-1.5 border-b text-xs font-mono flex items-center justify-between ${
          isPredictionCorrect ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-400' : 'bg-amber-950/40 border-amber-800/40 text-amber-300'
        }`}>
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isPredictionCorrect ? 'Correct prediction! Variable updated as observed.' : 'Good attempt! Observe the actual value on next step.'}</span>
          </div>
          <button onClick={() => setPredictionAnswered(false)} className="text-[10px] opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* 4. Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Code with Active Line Highlighting (when in full visualize mode) */}
        {showSourcePane && (
          <div className="w-1/2 border-r border-[#1F2024] bg-[#0A0B0E] flex flex-col overflow-hidden">
            <div className="px-3 py-1.5 bg-[#121318] border-b border-[#1F2024] text-[11px] font-mono text-[#71717A] flex items-center justify-between">
              <span>{snapshot.currentFile}</span>
              <span className="text-[#06B6D4] font-semibold">Line {snapshot.currentLine}</span>
            </div>
            <div className="flex-1 overflow-auto p-2 font-mono text-xs leading-relaxed">
              {sourceLines.map((line, idx) => {
                const lineNum = idx + 1;
                const isCurrentLine = lineNum === snapshot.currentLine;
                return (
                  <div
                    key={lineNum}
                    className={`flex items-center px-2 py-0.5 rounded transition-colors ${
                      isCurrentLine
                        ? 'bg-[#06B6D4]/15 border-l-4 border-[#06B6D4] text-white font-semibold'
                        : 'text-[#A1A1AA] hover:bg-[#15161C]/50'
                    }`}
                  >
                    <span className="w-8 text-right pr-3 select-none text-[#52525B] font-mono text-[10px]">
                      {lineNum}
                    </span>
                    <pre className="font-mono text-xs overflow-x-auto">{line || ' '}</pre>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Right / Center Area */}
        <div className={`${showSourcePane ? 'w-1/2' : 'w-full'} flex flex-col overflow-hidden`}>
          {/* Active Exception Banner */}
          {snapshot.activeException && (
            <div className="m-3 p-3 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30 text-xs font-mono text-[#EF4444] flex items-start space-x-2 shadow-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Exception: {snapshot.activeException.type}</span>
                <p className="mt-0.5 text-[#FCA5A5]">{snapshot.activeException.message}</p>
              </div>
            </div>
          )}

          {/* TAB 1: VISUAL CANVAS */}
          {activeTab === 'canvas' && (
            <div className="flex-1 flex flex-col overflow-hidden p-3.5 space-y-3">
              {/* Canvas Viewport with Zoom Scaling */}
              <div className="flex-1 overflow-auto rounded-lg border border-[#1E2028] bg-[#0A0B0E] p-4 transition-transform">
                <div 
                  className="transition-transform duration-150 origin-top-left"
                  style={{ transform: `scale(${zoomLevel})` }}
                >
                  <StructureRenderer
                    structures={snapshot.structureVisualizations}
                    changedVariables={snapshot.changedVariables}
                    selectedElementId={selectedElement?.label}
                    onSelectElement={(elem) => setSelectedElement(elem)}
                  />
                </div>
              </div>

              {/* Selected Element Details Card */}
              {selectedElement && (
                <div className="rounded-lg border border-[#06B6D4]/40 bg-[#12141A] p-3 text-xs font-mono shadow-md animate-in fade-in duration-100 flex flex-col space-y-2">
                  <div className="flex items-center justify-between border-b border-[#1E2028] pb-1.5">
                    <div className="flex items-center space-x-2">
                      <span className="px-1.5 py-0.5 rounded bg-[#06B6D4] text-black text-[10px] font-bold">
                        {selectedElement.category}
                      </span>
                      <span className="text-white font-bold">{selectedElement.label}</span>
                      {selectedElement.path && (
                        <span className="text-[#71717A] text-[10px]">({selectedElement.path})</span>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedElement(null)}
                      className="p-1 text-[#71717A] hover:text-white"
                      title="Close inspection"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    {Object.entries(selectedElement.details).map(([k, v]) => (
                      <div key={k} className="p-1.5 rounded bg-[#181A22] border border-[#242632]">
                        <span className="text-[#71717A] block text-[10px]">{k}</span>
                        <span className="text-white font-semibold">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: VARIABLES & SCOPE */}
          {activeTab === 'state' && (
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
              <div className="text-[11px] font-mono text-[#71717A] uppercase tracking-wider font-bold flex items-center space-x-1.5">
                <Variable className="w-3.5 h-3.5 text-[#06B6D4]" />
                <span>Active Scope Variables ({Object.keys(snapshot.variables).length})</span>
              </div>
              <VariableInspector
                variables={snapshot.variables}
                changedVariables={snapshot.changedVariables}
                onSelectVariable={(name, record) => {
                  setSelectedElement({
                    category: 'Variable',
                    label: name,
                    value: record.value,
                    details: {
                      Name: name,
                      Type: record.type,
                      'Scope ID': record.scopeId || 'local',
                      'Mutated This Step': snapshot.changedVariables.includes(name) ? 'Yes' : 'No',
                    },
                  });
                }}
              />
            </div>
          )}

          {/* TAB 3: CALL STACK */}
          {activeTab === 'callstack' && (
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
              <div className="text-[11px] font-mono text-[#71717A] uppercase tracking-wider font-bold flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-[#FF9100]" />
                <span>Call Stack Frames ({snapshot.callStack.length})</span>
              </div>
              <CallStackInspector callStack={snapshot.callStack} />
            </div>
          )}

          {/* TAB 4: TERMINAL OUTPUT */}
          {activeTab === 'output' && (
            <div className="flex-1 flex flex-col p-3.5 font-mono text-xs overflow-hidden">
              <div className="text-[11px] text-[#71717A] uppercase tracking-wider mb-2 font-bold flex items-center space-x-1.5">
                <Terminal className="w-3.5 h-3.5 text-[#10B981]" />
                <span>Execution Output Stream</span>
              </div>
              <div className="flex-1 p-3 rounded-lg bg-[#07080A] border border-[#1F2024] font-mono text-xs overflow-auto text-[#E4E4E7] whitespace-pre-wrap">
                {snapshot.outputHistory || traceSession?.stdout || (
                  <span className="text-[#52525B]">No terminal output recorded yet.</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. Docked Interactive Timeline Navigation Bar */}
      <TimelineControls
        currentStep={currentStepIndex}
        totalSteps={totalSteps}
        currentEvent={snapshot.currentEvent}
        onStepChange={(step) => setCurrentStepIndex(step)}
      />
    </div>
  );
};
