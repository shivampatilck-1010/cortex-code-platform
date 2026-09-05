'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Lock, 
  Unlock, 
  Handshake, 
  Terminal, 
  Copy, 
  Check, 
  FileText, 
  Download, 
  ShieldAlert, 
  Eye, 
  AlertCircle,
  Users,
  Maximize2,
  Minimize2,
  GripVertical
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { ClassroomParticipant, ClassroomRole, CollaborationSession } from '@/lib/classroom/types';
import { SUPPORTED_LANGUAGES, getLanguageConfig } from '@/config/languages';
import { executeInCloudSandbox } from '@/lib/execution/engine';
import { ExecutionResult } from '@/lib/execution/types';

interface TwoWorkspaceContainerProps {
  userA?: ClassroomParticipant | null;
  userB?: ClassroomParticipant | null;
  currentUserId: string;
  currentUserRole: ClassroomRole;
  activeSession?: CollaborationSession | null;
  onCodeChangeA?: (code: string) => void;
  onCodeChangeB?: (code: string) => void;
  onLanguageChangeA?: (lang: string) => void;
  onLanguageChangeB?: (lang: string) => void;
  onEndCollaboration?: (sessionId: string) => void;
  onRequestViewAccess?: (targetUserId: string) => void;
  onDownloadFile?: (ownerId: string, fileId: string) => void;
}

export const TwoWorkspaceContainer: React.FC<TwoWorkspaceContainerProps> = ({
  userA,
  userB,
  currentUserId,
  currentUserRole,
  activeSession,
  onCodeChangeA,
  onCodeChangeB,
  onLanguageChangeA,
  onLanguageChangeB,
  onEndCollaboration,
  onRequestViewAccess,
  onDownloadFile,
}) => {
  // Individual execution states
  const [resultA, setResultA] = useState<ExecutionResult | null>(null);
  const [isRunningA, setIsRunningA] = useState(false);

  const [resultB, setResultB] = useState<ExecutionResult | null>(null);
  const [isRunningB, setIsRunningB] = useState(false);

  const [copiedA, setCopiedA] = useState(false);
  const [copiedB, setCopiedB] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [splitPercent, setSplitPercent] = useState<number>(50);
  const [isDragging, setIsDragging] = useState(false);
  const [fullscreenSlot, setFullscreenSlot] = useState<'none' | 'slotA' | 'slotB'>('none');

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleTouchStart = () => {
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const rawPercent = ((e.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(Math.max(rawPercent, 15), 85);
      setSplitPercent(clamped);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!containerRef.current || !e.touches[0]) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const rawPercent = ((e.touches[0].clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(Math.max(rawPercent, 15), 85);
      setSplitPercent(clamped);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging]);

  const handleRunA = async () => {
    if (!userA || isRunningA) return;
    setIsRunningA(true);
    try {
      const res = await executeInCloudSandbox({
        language: userA.currentLanguage || 'python',
        files: userA.files || [{ id: '1', name: 'main.py', path: '/main.py', content: userA.activeCode }],
      });
      setResultA(res);
    } catch (err: any) {
      setResultA({
        status: 'runtime_error',
        stdout: '',
        stderr: err?.message || 'Execution error in Workspace A',
        exitCode: 1,
        executionTimeMs: 0,
        memoryUsageMb: 0,
        timestamp: new Date().toISOString(),
        provider: 'cloud_sandbox',
      });
    } finally {
      setIsRunningA(false);
    }
  };

  const handleRunB = async () => {
    if (!userB || isRunningB) return;
    setIsRunningB(true);
    try {
      const res = await executeInCloudSandbox({
        language: userB.currentLanguage || 'python',
        files: userB.files || [{ id: '2', name: 'main.py', path: '/main.py', content: userB.activeCode }],
      });
      setResultB(res);
    } catch (err: any) {
      setResultB({
        status: 'runtime_error',
        stdout: '',
        stderr: err?.message || 'Execution error in Workspace B',
        exitCode: 1,
        executionTimeMs: 0,
        memoryUsageMb: 0,
        timestamp: new Date().toISOString(),
        provider: 'cloud_sandbox',
      });
    } finally {
      setIsRunningB(false);
    }
  };

  const isSharedCollab = Boolean(
    activeSession &&
    activeSession.mode === 'shared' &&
    userA &&
    userB &&
    (
      (activeSession.participantIds.includes(userA.id) && activeSession.participantIds.includes(userB.id)) ||
      (activeSession.participantIds.includes(currentUserId) && (activeSession.participantIds.includes(userA.id) || activeSession.participantIds.includes(userB.id)))
    )
  );

  return (
    <div
      ref={containerRef}
      className={`h-full w-full flex flex-col sm:flex-row overflow-hidden bg-[#0c0d10] relative ${
        isDragging ? 'select-none cursor-col-resize' : ''
      }`}
    >
      {/* ================= WORKSPACE A ================= */}
      <div
        className={`h-full flex flex-col min-w-0 overflow-hidden transition-[width] duration-75 ${
          fullscreenSlot === 'slotB' ? 'hidden' : 'flex'
        }`}
        style={{
          width: fullscreenSlot === 'slotA' ? '100%' : `${splitPercent}%`,
          flexShrink: 0,
        }}
      >
        <WorkspaceColumn
          slotLabel="Workspace A"
          slotColor="cyan"
          user={userA}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          isSharedCollab={isSharedCollab}
          activeSession={activeSession}
          isRunning={isRunningA}
          result={resultA}
          copied={copiedA}
          isFullscreen={fullscreenSlot === 'slotA'}
          onToggleFullscreen={() => setFullscreenSlot((prev) => (prev === 'slotA' ? 'none' : 'slotA'))}
          onRun={handleRunA}
          onCodeChange={onCodeChangeA}
          onLanguageChange={onLanguageChangeA}
          onEndCollaboration={onEndCollaboration}
          onRequestViewAccess={onRequestViewAccess}
          onDownloadFile={onDownloadFile}
          onCopyOutput={() => {
            if (resultA?.stdout) {
              navigator.clipboard.writeText(resultA.stdout);
              setCopiedA(true);
              setTimeout(() => setCopiedA(false), 1200);
            }
          }}
        />
      </div>

      {/* ================= DRAGGABLE SLIDER BAR ================= */}
      {fullscreenSlot === 'none' && (
        <div
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className={`relative z-20 flex-shrink-0 w-2.5 hover:w-3 group flex flex-col items-center justify-center cursor-col-resize transition-all select-none border-x ${
            isDragging
              ? 'bg-[#ff9100] border-[#ff9100] shadow-[0_0_12px_rgba(255,145,0,0.6)]'
              : 'bg-[#15161d] hover:bg-[#ff9100]/30 border-[#232532] hover:border-[#ff9100]/50'
          }`}
          title="Drag to resize workspaces • Double click for 50/50"
          onDoubleClick={() => setSplitPercent(50)}
        >
          {/* Grip Indicator */}
          <div className="flex flex-col space-y-1 items-center justify-center pointer-events-none opacity-60 group-hover:opacity-100">
            <span className="w-1 h-1 rounded-full bg-gray-400 group-hover:bg-[#ff9100]" />
            <span className="w-1 h-1 rounded-full bg-gray-400 group-hover:bg-[#ff9100]" />
            <span className="w-1 h-1 rounded-full bg-gray-400 group-hover:bg-[#ff9100]" />
          </div>

          {/* Quick Percent Tooltip on hover/drag */}
          <div className="absolute top-2 z-30 px-1.5 py-0.5 rounded bg-[#101116] border border-[#2b2d3c] text-[10px] font-mono text-gray-300 opacity-0 group-hover:opacity-100 transition shadow pointer-events-none whitespace-nowrap">
            {Math.round(splitPercent)}% : {Math.round(100 - splitPercent)}%
          </div>
        </div>
      )}

      {/* ================= WORKSPACE B ================= */}
      <div
        className={`h-full flex flex-col min-w-0 overflow-hidden transition-[width] duration-75 ${
          fullscreenSlot === 'slotA' ? 'hidden' : 'flex'
        }`}
        style={{
          width: fullscreenSlot === 'slotB' ? '100%' : `${100 - splitPercent}%`,
          flexShrink: 0,
        }}
      >
        <WorkspaceColumn
          slotLabel="Workspace B"
          slotColor="purple"
          user={userB}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          isSharedCollab={isSharedCollab}
          activeSession={activeSession}
          isRunning={isRunningB}
          result={resultB}
          copied={copiedB}
          isFullscreen={fullscreenSlot === 'slotB'}
          onToggleFullscreen={() => setFullscreenSlot((prev) => (prev === 'slotB' ? 'none' : 'slotB'))}
          onRun={handleRunB}
          onCodeChange={onCodeChangeB}
          onLanguageChange={onLanguageChangeB}
          onEndCollaboration={onEndCollaboration}
          onRequestViewAccess={onRequestViewAccess}
          onDownloadFile={onDownloadFile}
          onCopyOutput={() => {
            if (resultB?.stdout) {
              navigator.clipboard.writeText(resultB.stdout);
              setCopiedB(true);
              setTimeout(() => setCopiedB(false), 1200);
            }
          }}
        />
      </div>
    </div>
  );
};

interface WorkspaceColumnProps {
  slotLabel: string;
  slotColor: 'cyan' | 'purple';
  user?: ClassroomParticipant | null;
  currentUserId: string;
  currentUserRole: ClassroomRole;
  isSharedCollab: boolean;
  activeSession?: CollaborationSession | null;
  isRunning: boolean;
  result: ExecutionResult | null;
  copied: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onRun: () => void;
  onCodeChange?: (code: string) => void;
  onLanguageChange?: (lang: string) => void;
  onEndCollaboration?: (sessionId: string) => void;
  onRequestViewAccess?: (targetUserId: string) => void;
  onDownloadFile?: (ownerId: string, fileId: string) => void;
  onCopyOutput: () => void;
}

const WorkspaceColumn: React.FC<WorkspaceColumnProps> = ({
  slotLabel,
  slotColor,
  user,
  currentUserId,
  currentUserRole,
  isSharedCollab,
  activeSession,
  isRunning,
  result,
  copied,
  isFullscreen,
  onToggleFullscreen,
  onRun,
  onCodeChange,
  onLanguageChange,
  onEndCollaboration,
  onRequestViewAccess,
  onDownloadFile,
  onCopyOutput,
}) => {
  const editorRef = useRef<any>(null);
  const localEmittedCodeRef = useRef<string>(user?.activeCode || '');
  const loadedUserFileKeyRef = useRef<string>('');

  const isSelf = Boolean(user && user.id === currentUserId);
  const isAdmin = currentUserRole === 'admin';
  const isPublic = Boolean(user && user.privacy?.workspaceVisibility === 'public');
  const isCollaboratingWithUser = Boolean(
    activeSession &&
    activeSession.mode === 'shared' &&
    user &&
    activeSession.participantIds.includes(currentUserId) &&
    activeSession.participantIds.includes(user.id)
  );

  const currentKey = user ? `${user.id}:${user.activeFileName || 'main.py'}` : '';

  // Synchronize editor buffer safely without EVER shifting the cursor to line 1
  useEffect(() => {
    if (!editorRef.current || !user) return;

    // 1. Initial mount or user/file switch -> load new content
    if (loadedUserFileKeyRef.current !== currentKey) {
      loadedUserFileKeyRef.current = currentKey;
      localEmittedCodeRef.current = user.activeCode || '';
      editorRef.current.setValue(user.activeCode || '');
      return;
    }

    // 2. If this update matches what was just typed locally, DO NOT touch Monaco!
    if (user.activeCode === localEmittedCodeRef.current) {
      return;
    }

    // 3. If local user is solely editing their own workspace alone, ignore laggy echoes
    if (editorRef.current.hasTextFocus() && isSelf && !isCollaboratingWithUser) {
      return;
    }

    // 4. Remote change arrived: update value smoothly while strictly preserving cursor & scroll position
    const currentVal = editorRef.current.getValue();
    if (currentVal !== user.activeCode) {
      localEmittedCodeRef.current = user.activeCode || '';
      const model = editorRef.current.getModel();
      const position = editorRef.current.getPosition();
      const selection = editorRef.current.getSelection();
      const scrollTop = editorRef.current.getScrollTop();
      const scrollLeft = editorRef.current.getScrollLeft();

      if (model) {
        editorRef.current.executeEdits('remote-sync', [
          {
            range: model.getFullModelRange(),
            text: user.activeCode || '',
            forceMoveMarkers: true,
          },
        ]);
        editorRef.current.pushUndoStop();
      } else {
        editorRef.current.setValue(user.activeCode || '');
      }

      if (position) {
        try { editorRef.current.setPosition(position); } catch {}
      }
      if (selection) {
        try { editorRef.current.setSelection(selection); } catch {}
      }
      try {
        editorRef.current.setScrollTop(scrollTop);
        editorRef.current.setScrollLeft(scrollLeft);
      } catch {}
    }
  }, [user?.activeCode, currentKey, isSelf, isCollaboratingWithUser]);

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500 bg-[#0c0d10] space-y-3">
        <div className="w-12 h-12 rounded-full bg-[#16171d] border border-[#232530] flex items-center justify-center text-gray-400">
          <Users className="w-6 h-6" />
        </div>
        <div>
          <h4 className="text-sm font-heading font-semibold text-gray-300">{slotLabel} is Empty</h4>
          <p className="text-xs text-gray-500 mt-1 max-w-xs">
            Select a participant from the user list on the left to mount their workspace into {slotLabel}.
          </p>
        </div>
      </div>
    );
  }
  const hasAccess = isSelf || isAdmin || isPublic || isSharedCollab || isCollaboratingWithUser;

  const isLocked = Boolean(user.isLocked);
  const canEdit = hasAccess && (isSelf || isSharedCollab || isCollaboratingWithUser) && !isLocked;

  const lang = user.currentLanguage || 'python';
  const monacoLang = getLanguageConfig(lang).monacoLang;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0c0d10] overflow-hidden">
      {/* 1. Header Bar */}
      <div className="h-10 bg-[#121317] border-b border-[#1f2026] px-3 flex items-center justify-between z-10">
        <div className="flex items-center space-x-2.5 min-w-0">
          {/* Presence Indicator */}
          <span
            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
              user.online
                ? user.status === 'coding'
                : 'bg-emerald-400'
            }`}
          />

          {/* User Name & Slot Tag */}
          <div className="flex items-center space-x-1.5 truncate">
            <span className="font-heading font-bold text-xs text-gray-100 truncate">
              {user.name}
            </span>
            <span
              className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded border ${
                slotColor === 'cyan'
                  ? 'bg-cyan-950/60 text-cyan-300 border-cyan-700/50'
                  : 'bg-purple-950/60 text-purple-300 border-purple-700/50'
              }`}
            >
              {slotLabel}
            </span>
            {isLocked && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/60 text-amber-300 border border-amber-800/40 flex items-center space-x-0.5">
                <Lock className="w-2.5 h-2.5" />
                <span>Locked</span>
              </span>
            )}
          </div>
        </div>

        {/* Right Header: Language, Files, Fullscreen & Run */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          {/* Language Selector */}
          <select
            value={lang}
            disabled={!canEdit}
            onChange={(e) => onLanguageChange && onLanguageChange(e.target.value)}
            className="bg-[#181920] text-gray-300 text-[11px] font-mono border border-[#2b2d38] rounded px-2 py-0.5 focus:outline-none focus:border-[#ff9100] disabled:opacity-60"
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>

          {/* Full Screen View Toggle */}
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition border ${
                isFullscreen
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'bg-[#181920] hover:bg-[#252834] text-gray-400 hover:text-white border-[#2b2d38]'
              }`}
              title={isFullscreen ? 'Restore side-by-side split view' : `Expand ${slotLabel} to Full Screen`}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[10px] font-semibold hidden md:inline">Restore</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="text-[10px] hidden lg:inline">Full Screen</span>
                </>
              )}
            </button>
          )}

          {/* File Download (Own or Permitted) */}
          {user.files && user.files.length > 0 && (
            <button
              onClick={() => onDownloadFile && onDownloadFile(user.id, user.files[0].id)}
              className="p-1 rounded bg-[#181920] hover:bg-[#22242e] text-gray-300 border border-[#2b2d38] transition"
              title={`Download ${user.files[0].name}`}
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Run Button */}
          <button
            onClick={onRun}
            disabled={isRunning || !user.canRun}
            className={`flex items-center space-x-1 px-3 py-1 rounded text-xs font-heading font-bold transition shadow ${
              !user.canRun
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : isRunning
                ? 'bg-emerald-900 text-emerald-300 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
            }`}
            title={user.canRun ? 'Execute Code' : 'Execution disabled by Admin'}
          >
            <Play className={`w-3 h-3 ${isRunning ? 'animate-spin' : 'fill-current'}`} />
            <span>{isRunning ? 'Running...' : 'Run'}</span>
          </button>
        </div>
      </div>

      {/* 2. Shared Collaboration Mode Banner */}
      {isSharedCollab && activeSession && (
        <div className="h-7 bg-amber-950/40 border-b border-amber-800/40 px-3 flex items-center justify-between text-[11px] text-amber-300">
          <div className="flex items-center space-x-1.5 font-medium">
            <Handshake className="w-3.5 h-3.5 text-[#ff9100]" />
            <span>Shared Collaboration Active • Changes synchronize in real time</span>
          </div>
          {onEndCollaboration && (
            <button
              onClick={() => onEndCollaboration(activeSession.id)}
              className="px-2 py-0.5 rounded bg-amber-900/60 hover:bg-amber-800 text-white font-bold text-[10px] transition"
            >
              End Collaboration
            </button>
          )}
        </div>
      )}

      {/* 3. Editor Area or Private Workspace Shield */}
      <div className="flex-1 min-h-0 relative">
        {hasAccess ? (
          <Editor
            height="100%"
            language={monacoLang}
            defaultValue={user.activeCode}
            theme="vs-dark"
            onMount={(editor) => {
              editorRef.current = editor;
            }}
            onChange={(v) => {
              const nextVal = v || '';
              localEmittedCodeRef.current = nextVal;
              if (onCodeChange) {
                onCodeChange(nextVal);
              }
            }}
            options={{
              readOnly: !canEdit,
              fontSize: 13,
              fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace",
              minimap: { enabled: false },
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              smoothScrolling: true,
              renderLineHighlight: 'all',
              wordWrap: 'on',
              tabSize: 4,
            }}
          />
        ) : (
          /* Secure Private Shield */
          <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center bg-[#0e0f14] space-y-3 select-none">
            <div className="w-12 h-12 rounded-full bg-amber-950/30 border border-amber-800/40 flex items-center justify-center text-amber-400">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-heading font-semibold text-gray-200">
                {user.name}&apos;s Workspace is Private
              </h4>
              <p className="text-xs text-gray-500 mt-1 max-w-xs">
                This participant has enabled private workspace protection. Source code is secure and hidden.
              </p>
            </div>
            {onRequestViewAccess && !isSelf && (
              <button
                onClick={() => onRequestViewAccess(user.id)}
                className="px-3.5 py-1.5 rounded bg-[#20222b] hover:bg-[#ff9100]/20 hover:text-[#ff9100] text-gray-200 border border-[#2e313d] text-xs font-semibold transition"
              >
                Request Access
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4. Terminal Output Dock */}
      <div className="h-44 sm:h-48 border-t border-[#1f2026] bg-[#090a0d] flex flex-col">
        <div className="h-6 px-3 bg-[#0f1014] border-b border-[#1a1b22] flex items-center justify-between text-[11px] text-gray-400">
          <div className="flex items-center space-x-2">
            <Terminal className="w-3.5 h-3.5 text-gray-400" />
            <span className="font-heading font-semibold text-gray-300">
              {user.name}&apos;s Output {result ? `(exit ${result.exitCode})` : ''}
            </span>
            {result && (
              <span className="text-[10px] font-mono text-gray-500">
                {result.executionTimeMs} ms • {result.memoryUsageMb} MB
              </span>
            )}
          </div>

          {result?.stdout && (
            <button
              onClick={onCopyOutput}
              className="hover:text-white transition flex items-center space-x-1"
              title="Copy output"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span className="text-[10px]">{copied ? 'Copied' : 'Copy'}</span>
            </button>
          )}
        </div>

        <div className="flex-1 p-3 font-mono text-xs overflow-y-auto select-text text-gray-300">
          {isRunning ? (
            <span className="text-gray-500 italic animate-pulse">Running code in isolated cloud sandbox...</span>
          ) : result ? (
            <>
              {result.stdout && <pre className="whitespace-pre-wrap leading-relaxed">{result.stdout}</pre>}
              {result.stderr && <pre className="text-rose-400 whitespace-pre-wrap leading-relaxed">{result.stderr}</pre>}
              {!result.stdout && !result.stderr && (
                <span className="text-gray-500 italic">Program finished with exit code 0 (no output written).</span>
              )}
            </>
          ) : (
            <span className="text-gray-600 italic">Press Run to execute this workspace.</span>
          )}
        </div>
      </div>
    </div>
  );
};
