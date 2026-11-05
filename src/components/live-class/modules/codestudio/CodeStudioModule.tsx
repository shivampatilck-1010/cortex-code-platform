import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { useClassroom } from '@/context/ClassroomContext';
import { useFollowTeacher } from '@/context/FollowTeacherContext';
import {
  CodeFile,
  CodeLanguage,
  ExecutionResult,
  BroadcastState,
  TeacherWorkspaceMode,
  StudentWorkspaceTab,
  CodeStudioSyncMessage,
} from '@/types/codestudio';
import {
  LANGUAGE_CONFIGS,
  executeCode,
  cancelActiveExecution,
} from './codeExecutionEngine';
import { CodeVisualizationWorkspace } from '@/components/visualization/CodeVisualizationWorkspace';
import { TraceSession } from '@/lib/visualization/types';
import {
  Play,
  Activity,
  Square,
  Columns,
  Maximize2,
  Minimize2,
  FileCode,
  Terminal,
  Clock,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Plus,
  Trash2,
  X,
  Edit2,
  Radio,
  Pause,
  GripHorizontal,
  ChevronDown,
  ChevronUp,
  Users,
  Eye,
  ArrowLeft,
  Copy,
  Check,
  Share2,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react';

const initialTeachingFiles: CodeFile[] = [
  {
    id: 'f1',
    name: 'main.ts',
    language: 'typescript',
    content: LANGUAGE_CONFIGS.typescript.starterCode,
  },
  {
    id: 'f2',
    name: 'solution.py',
    language: 'python',
    content: LANGUAGE_CONFIGS.python.starterCode,
  },
  {
    id: 'f3',
    name: 'avl_tree.cpp',
    language: 'cpp',
    content: LANGUAGE_CONFIGS.cpp.starterCode,
  },
  {
    id: 'f4',
    name: 'main.rs',
    language: 'rust',
    content: LANGUAGE_CONFIGS.rust.starterCode,
  },
];

const initialStudentFiles: CodeFile[] = [
  {
    id: 'sf1',
    name: 'my_solution.ts',
    language: 'typescript',
    content: `// My Workspace - Personal Scratchpad\n// Write and test your algorithm implementation here.\n\nfunction solveProblem(): void {\n  console.log("Testing student algorithm implementation...");\n}\n\nsolveProblem();\n`,
  },
  {
    id: 'sf2',
    name: 'scratch.py',
    language: 'python',
    content: `# Student Python Workspace\ndef test_solution():\n    print("Running Python algorithmic tests")\n\ntest_solution()\n`,
  },
];

export const CodeStudioModule: React.FC = () => {
  const {
    userRole,
    currentUserId,
    currentUserName,
    participants,
    signalingClient,
    showToast,
  } = useClassroom();
  const { broadcastTeacherActivity } = useFollowTeacher();

  const isTeacher = userRole === 'teacher';
  const isStudent = userRole === 'student';

  // --- Teacher Workspace Navigation & Observation State ---
  const [teacherMode, setTeacherMode] = useState<TeacherWorkspaceMode>('broadcast');
  const [isSplitView, setIsSplitView] = useState<boolean>(false);
  const [observedStudentId, setObservedStudentId] = useState<string | null>(null);
  const [observedStudentFiles, setObservedStudentFiles] = useState<CodeFile[]>([]);
  const [observedActiveFileId, setObservedActiveFileId] = useState<string>('');
  const [observedSyncStatus, setObservedSyncStatus] = useState<'synced' | 'syncing' | 'offline'>('synced');

  // --- Authoritative Broadcast State ---
  const [broadcastState, setBroadcastState] = useState<BroadcastState>('stopped');
  const [shareOutputWithStudents, setShareOutputWithStudents] = useState<boolean>(false);

  // --- Student Workspace Tabs ---
  const [studentTab, setStudentTab] = useState<StudentWorkspaceTab>('my_workspace');
  const [broadcastTeachingFiles, setBroadcastTeachingFiles] = useState<CodeFile[]>([]);
  const [broadcastActiveFileId, setBroadcastActiveFileId] = useState<string>('');
  const [copyModalOpen, setCopyModalOpen] = useState<boolean>(false);

  // --- Teacher Files (Teaching Workspace — Broadcast) ---
  const [teachingFiles, setTeachingFiles] = useState<CodeFile[]>(initialTeachingFiles);
  const [teachingActiveFileId, setTeachingActiveFileId] = useState<string>('f1');

  // --- Student Files (My Workspace) ---
  const [studentFiles, setStudentFiles] = useState<CodeFile[]>(initialStudentFiles);
  const [studentActiveFileId, setStudentActiveFileId] = useState<string>('sf1');

  // --- File Management (Create / Rename / Delete) ---
  const [isCreatingFile, setIsCreatingFile] = useState<boolean>(false);
  const [newFileNameInput, setNewFileNameInput] = useState<string>('');
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState<string>('');
  const [fileErrorMessage, setFileErrorMessage] = useState<string | null>(null);

  // --- Terminal & Execution State ---
  const [executionResult, setExecutionResult] = useState<ExecutionResult>({
    status: 'idle',
    stdout: 'Select a file and click "Run Code" to execute.\n',
    stderr: '',
  });
  const [activeTerminalTab, setActiveTerminalTab] = useState<'output' | 'compiler' | 'stdin' | 'visualize'>('output');
  const [traceSession, setTraceSession] = useState<TraceSession | null>(null);
  const [isTracing, setIsTracing] = useState<boolean>(false);
  const [stdinBuffer, setStdinBuffer] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [isConsoleOpen, setIsConsoleOpen] = useState<boolean>(false);

  // --- Fullscreen & Focus Mode ---
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);

  // --- Resizable Terminal State ---
  const [terminalHeight, setTerminalHeight] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const saved = sessionStorage.getItem('cortex_terminal_height');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 90 && parsed <= 600) return parsed;
      }
    }
    return 200;
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const monacoTeachingRef = useRef<any>(null);
  const monacoStudentRef = useRef<any>(null);
  const isDraggingDividerRef = useRef<boolean>(false);
  const startDragYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(200);

  // Cross-tab sync fallback
  const syncChannelRef = useRef<BroadcastChannel | null>(null);
  const teachingReportedValueRef = useRef<string>('');
  const studentReportedValueRef = useRef<string>('');
  const prevTeachingFileIdRef = useRef<string>('');
  const prevStudentFileIdRef = useRef<string>('');
  const debounceBroadcastTimerRef = useRef<any>(null);
  const debounceStudentUpdateTimerRef = useRef<any>(null);

  // Active files resolution
  const activeTeachingFile = teachingFiles.find((f) => f.id === teachingActiveFileId) || teachingFiles[0];
  const activeStudentFile = studentFiles.find((f) => f.id === studentActiveFileId) || studentFiles[0];
  const activeObservedFile = observedStudentFiles.find((f) => f.id === observedActiveFileId) || observedStudentFiles[0];
  const activeBroadcastDemoFile = broadcastTeachingFiles.find((f) => f.id === broadcastActiveFileId) || broadcastTeachingFiles[0];

  const currentEditorFile = isTeacher
    ? (teacherMode === 'observe' && !isSplitView ? activeObservedFile : activeTeachingFile)
    : (studentTab === 'instructor_demo' ? activeBroadcastDemoFile : activeStudentFile);

  const activeLangConfig = LANGUAGE_CONFIGS[currentEditorFile?.language || 'typescript'];

  // Helper to detect language from file extension
  const detectLanguageFromFileName = (name: string): CodeLanguage => {
    const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
    switch (ext) {
      case '.ts':
      case '.tsx':
        return 'typescript';
      case '.js':
      case '.jsx':
        return 'javascript';
      case '.py':
        return 'python';
      case '.cpp':
      case '.cc':
      case '.h':
      case '.hpp':
        return 'cpp';
      case '.rs':
        return 'rust';
      default:
        return 'typescript';
    }
  };

  // --- Realtime WebSocket & Cross-Tab Event Handling ---
  useEffect(() => {
    // 1. Cross-Tab Channel
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('cortex_codestudio_sync');
      syncChannelRef.current = channel;

      channel.onmessage = (event: MessageEvent<CodeStudioSyncMessage>) => {
        const msg = event.data;
        if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;

        if (msg.type === 'BROADCAST_STATE_CHANGED') {
          setBroadcastState(msg.state);
          if (msg.state === 'broadcasting' || msg.state === 'paused') {
            if (msg.files && Array.isArray(msg.files)) {
              setBroadcastTeachingFiles(msg.files);
              if (msg.activeFileId) setBroadcastActiveFileId(msg.activeFileId);
            }
          } else if (msg.state === 'stopped') {
            setBroadcastTeachingFiles([]);
          }
        } else if (msg.type === 'TEACHER_CODE_UPDATE' && isStudent) {
          if (broadcastState === 'broadcasting') {
            setBroadcastTeachingFiles((prev) =>
              prev.map((f) =>
                f.id === msg.fileId
                  ? { ...f, content: msg.content, language: msg.language || f.language }
                  : f
              )
            );
          }
        } else if (msg.type === 'STUDENT_WORKSPACE_STREAM' && isTeacher) {
          if (observedStudentId === msg.studentId && msg.files) {
            setObservedStudentFiles(msg.files);
            if (msg.activeFileId) setObservedActiveFileId(msg.activeFileId);
            setObservedSyncStatus('synced');
          }
        }
      };
    } catch (_) {}

    // 2. Production WebSocket Signaling Client Integration
    let unbindWs: (() => void) | null = null;
    if (signalingClient) {
      unbindWs = signalingClient.onMessage((envelope) => {
        if (!envelope || envelope.type !== 'CLASSROOM_EVENT') return;
        const payload = envelope.payload;
        if (!payload || !payload.eventName) return;

        const eventName = payload.eventName;
        const data = payload.data;

        if (eventName === 'BROADCAST_STATE_CHANGED') {
          if (data?.state) {
            setBroadcastState(data.state);
            if (data.state === 'broadcasting' || data.state === 'paused') {
              if (Array.isArray(data.files)) {
                setBroadcastTeachingFiles(data.files);
                if (data.activeFileId) setBroadcastActiveFileId(data.activeFileId);
              }
            } else if (data.state === 'stopped') {
              setBroadcastTeachingFiles([]);
            }
          }
        } else if (eventName === 'TEACHER_CODE_UPDATE' && isStudent) {
          if (data?.fileId && data?.content !== undefined) {
            setBroadcastTeachingFiles((prev) =>
              prev.map((f) =>
                f.id === data.fileId
                  ? { ...f, content: data.content, language: data.language || f.language }
                  : f
              )
            );
          }
        } else if (eventName === 'STUDENT_WORKSPACE_STREAM' && isTeacher) {
          if (data?.studentId === observedStudentId && Array.isArray(data.files)) {
            setObservedStudentFiles(data.files);
            if (data.activeFileId) setObservedActiveFileId(data.activeFileId);
            setObservedSyncStatus('synced');
          }
        } else if (eventName === 'OBSERVED_STUDENT_STATUS' && isTeacher) {
          if (data?.studentId === observedStudentId && data.isOnline === false) {
            setObservedSyncStatus('offline');
          }
        } else if (eventName === 'TEACHER_OUTPUT_STREAM' && isStudent) {
          if (data?.result) {
            setExecutionResult(data.result);
            setIsConsoleOpen(true);
          }
        }
      });

      // Request initial broadcast state
      signalingClient.emitClassroomEvent('GET_BROADCAST_STATE', {});
    }

    return () => {
      if (channel) channel.close();
      if (unbindWs) unbindWs();
    };
  }, [signalingClient, isTeacher, isStudent, broadcastState, observedStudentId]);

  // Keyboard shortcut: Ctrl+` to toggle Execution Console
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === '`' || e.code === 'Backquote')) {
        e.preventDefault();
        setIsConsoleOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isFullscreen) {
        handleExitFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      setTimeout(() => {
        monacoTeachingRef.current?.layout();
        monacoStudentRef.current?.layout();
      }, 100);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Layout resize trigger when view modes toggle
  useEffect(() => {
    const timer = setTimeout(() => {
      monacoTeachingRef.current?.layout();
      monacoStudentRef.current?.layout();
    }, 120);
    return () => clearTimeout(timer);
  }, [teacherMode, isSplitView, studentTab, isFocusMode, isConsoleOpen, terminalHeight]);

  // Synchronize teacher workspace editor on external updates / file switch
  useEffect(() => {
    if (!monacoTeachingRef.current || !isTeacher) return;
    const currentVal = monacoTeachingRef.current.getValue();

    if (prevTeachingFileIdRef.current !== teachingActiveFileId) {
      prevTeachingFileIdRef.current = teachingActiveFileId;
      teachingReportedValueRef.current = activeTeachingFile?.content || '';
      if (activeTeachingFile && currentVal !== activeTeachingFile.content) {
        monacoTeachingRef.current.setValue(activeTeachingFile.content || '');
      }
      return;
    }

    if (
      activeTeachingFile &&
      activeTeachingFile.content !== currentVal &&
      activeTeachingFile.content !== teachingReportedValueRef.current
    ) {
      teachingReportedValueRef.current = activeTeachingFile.content;
      const model = monacoTeachingRef.current.getModel();
      const prevSelection = monacoTeachingRef.current.getSelection();
      if (model) {
        monacoTeachingRef.current.executeEdits('external', [{
          range: model.getFullModelRange(),
          text: activeTeachingFile.content,
          forceMoveMarkers: true,
        }]);
        if (prevSelection) {
          monacoTeachingRef.current.setSelection(prevSelection);
        }
      } else {
        monacoTeachingRef.current.setValue(activeTeachingFile.content);
      }
    }
  }, [teachingActiveFileId, activeTeachingFile?.content, isTeacher]);

  // Synchronize student workspace editor on external updates / file switch
  useEffect(() => {
    if (!monacoStudentRef.current || !isStudent) return;
    const currentVal = monacoStudentRef.current.getValue();

    if (prevStudentFileIdRef.current !== studentActiveFileId) {
      prevStudentFileIdRef.current = studentActiveFileId;
      studentReportedValueRef.current = activeStudentFile?.content || '';
      if (activeStudentFile && currentVal !== activeStudentFile.content) {
        monacoStudentRef.current.setValue(activeStudentFile.content || '');
      }
      return;
    }

    if (
      activeStudentFile &&
      activeStudentFile.content !== currentVal &&
      activeStudentFile.content !== studentReportedValueRef.current
    ) {
      studentReportedValueRef.current = activeStudentFile.content;
      const model = monacoStudentRef.current.getModel();
      const prevSelection = monacoStudentRef.current.getSelection();
      if (model) {
        monacoStudentRef.current.executeEdits('external', [{
          range: model.getFullModelRange(),
          text: activeStudentFile.content,
          forceMoveMarkers: true,
        }]);
        if (prevSelection) {
          monacoStudentRef.current.setSelection(prevSelection);
        }
      } else {
        monacoStudentRef.current.setValue(activeStudentFile.content);
      }
    }
  }, [studentActiveFileId, activeStudentFile?.content, isStudent]);

  // --- Teacher Code Change Handler ---
  const handleTeachingCodeChange = (value: string | undefined) => {
    if (value === undefined || !isTeacher) return;
    teachingReportedValueRef.current = value;
    const updated = teachingFiles.map((f) =>
      f.id === teachingActiveFileId ? { ...f, content: value } : f
    );
    setTeachingFiles(updated);

    broadcastTeacherActivity({
      module: 'code',
      subLocation: activeTeachingFile.name,
    });

    // If currently broadcasting, stream updates to students
    if (broadcastState === 'broadcasting') {
      if (debounceBroadcastTimerRef.current) {
        clearTimeout(debounceBroadcastTimerRef.current);
      }
      debounceBroadcastTimerRef.current = setTimeout(() => {
        if (signalingClient) {
          signalingClient.emitClassroomEvent('TEACHER_CODE_BROADCAST', {
            fileId: activeTeachingFile.id,
            fileName: activeTeachingFile.name,
            language: activeTeachingFile.language,
            content: value,
            files: updated,
            activeFileId: activeTeachingFile.id,
          });
        }
        if (syncChannelRef.current) {
          syncChannelRef.current.postMessage({
            type: 'TEACHER_CODE_UPDATE',
            fileId: activeTeachingFile.id,
            fileName: activeTeachingFile.name,
            language: activeTeachingFile.language,
            content: value,
            timestamp: Date.now(),
          } as CodeStudioSyncMessage);
        }
      }, 150);
    }
  };

  // --- Student Workspace Code Change Handler ---
  const handleStudentCodeChange = (value: string | undefined) => {
    if (value === undefined || !isStudent) return;
    studentReportedValueRef.current = value;
    const updated = studentFiles.map((f) =>
      f.id === studentActiveFileId ? { ...f, content: value } : f
    );
    setStudentFiles(updated);

    // Debounced stream of student workspace to observing teachers
    if (debounceStudentUpdateTimerRef.current) {
      clearTimeout(debounceStudentUpdateTimerRef.current);
    }
    debounceStudentUpdateTimerRef.current = setTimeout(() => {
      if (signalingClient) {
        signalingClient.emitClassroomEvent('STUDENT_WORKSPACE_UPDATE', {
          files: updated,
          activeFileId: studentActiveFileId,
        });
      }
      if (syncChannelRef.current) {
        syncChannelRef.current.postMessage({
          type: 'STUDENT_WORKSPACE_STREAM',
          studentId: currentUserId,
          files: updated,
          activeFileId: studentActiveFileId,
          timestamp: Date.now(),
        } as CodeStudioSyncMessage);
      }
    }, 250);
  };

  // --- Teacher Broadcasting Lifecycle Operations ---
  const handleStartBroadcast = () => {
    if (!isTeacher) return;
    setBroadcastState('broadcasting');
    if (signalingClient) {
      signalingClient.emitClassroomEvent('TEACHER_START_BROADCAST', {
        files: teachingFiles,
        activeFileId: teachingActiveFileId,
      }, true);
    }
    if (syncChannelRef.current) {
      syncChannelRef.current.postMessage({
        type: 'BROADCAST_STATE_CHANGED',
        state: 'broadcasting',
        files: teachingFiles,
        activeFileId: teachingActiveFileId,
        timestamp: Date.now(),
      } as CodeStudioSyncMessage);
    }
    showToast('Teaching Workspace is now broadcasting live to all students.');
  };

  const handlePauseBroadcast = () => {
    if (!isTeacher) return;
    setBroadcastState('paused');
    if (signalingClient) {
      signalingClient.emitClassroomEvent('TEACHER_PAUSE_BROADCAST', {}, true);
    }
    if (syncChannelRef.current) {
      syncChannelRef.current.postMessage({
        type: 'BROADCAST_STATE_CHANGED',
        state: 'paused',
        timestamp: Date.now(),
      } as CodeStudioSyncMessage);
    }
    showToast('Broadcast paused. Live updates are frozen on student screens.');
  };

  const handleResumeBroadcast = () => {
    if (!isTeacher) return;
    setBroadcastState('broadcasting');
    if (signalingClient) {
      signalingClient.emitClassroomEvent('TEACHER_RESUME_BROADCAST', {
        files: teachingFiles,
        activeFileId: teachingActiveFileId,
      }, true);
    }
    if (syncChannelRef.current) {
      syncChannelRef.current.postMessage({
        type: 'BROADCAST_STATE_CHANGED',
        state: 'broadcasting',
        files: teachingFiles,
        activeFileId: teachingActiveFileId,
        timestamp: Date.now(),
      } as CodeStudioSyncMessage);
    }
    showToast('Broadcast resumed. Students are receiving live code updates.');
  };

  const handleStopBroadcast = () => {
    if (!isTeacher) return;
    setBroadcastState('stopped');
    if (signalingClient) {
      signalingClient.emitClassroomEvent('TEACHER_STOP_BROADCAST', {}, true);
    }
    if (syncChannelRef.current) {
      syncChannelRef.current.postMessage({
        type: 'BROADCAST_STATE_CHANGED',
        state: 'stopped',
        files: [],
        timestamp: Date.now(),
      } as CodeStudioSyncMessage);
    }
    showToast('Broadcast stopped. Student access to unpublished code has been revoked.');
  };

  // --- Student Observation Operations (Teacher Only) ---
  const handleSelectStudentForObservation = (studentId: string) => {
    if (!isTeacher) return;
    if (observedStudentId === studentId) return;

    // Unsubscribe previous student if any
    if (observedStudentId && signalingClient) {
      signalingClient.emitClassroomEvent('OBSERVE_STUDENT_UNSUBSCRIBE', { studentId: observedStudentId }, true);
    }

    setObservedStudentId(studentId);
    setObservedSyncStatus('syncing');

    // Subscribe to new student
    if (signalingClient) {
      signalingClient.emitClassroomEvent('OBSERVE_STUDENT_SUBSCRIBE', { studentId }, true);
    }

    const targetStudent = participants.find((p) => p.id === studentId);
    showToast(`Observing student: ${targetStudent?.name || studentId} (Read-Only Mode)`);
  };

  const handleReturnToTeachingWorkspace = () => {
    if (observedStudentId && signalingClient) {
      signalingClient.emitClassroomEvent('OBSERVE_STUDENT_UNSUBSCRIBE', { studentId: observedStudentId }, true);
    }
    setTeacherMode('broadcast');
    setIsSplitView(false);
  };

  // --- Student "Copy to My Workspace" Operation ---
  const handleConfirmCopyToOwnWorkspace = () => {
    if (!activeBroadcastDemoFile) return;

    let candidateName = `demo_${activeBroadcastDemoFile.name}`;
    let counter = 1;
    while (studentFiles.some((f) => f.name.toLowerCase() === candidateName.toLowerCase())) {
      candidateName = `demo_${counter}_${activeBroadcastDemoFile.name}`;
      counter++;
    }

    const copiedFile: CodeFile = {
      id: `cf_${Date.now()}`,
      name: candidateName,
      language: activeBroadcastDemoFile.language,
      content: activeBroadcastDemoFile.content,
      isReadOnly: false,
    };

    setStudentFiles((prev) => [...prev, copiedFile]);
    setStudentActiveFileId(copiedFile.id);
    setStudentTab('my_workspace');
    setCopyModalOpen(false);
    showToast(`Copied demonstration code into My Workspace as "${candidateName}".`);
  };

  // --- Language Switching ---
  const handleSelectLanguage = (lang: CodeLanguage) => {
    const targetFiles = isTeacher ? teachingFiles : studentFiles;
    const activeFile = isTeacher ? activeTeachingFile : activeStudentFile;

    if (activeFile.language === lang) return;

    const existingFile = targetFiles.find((f) => f.language === lang);
    if (existingFile) {
      if (isTeacher) setTeachingActiveFileId(existingFile.id);
      else setStudentActiveFileId(existingFile.id);
      showToast(`Switched to ${existingFile.name} (${LANGUAGE_CONFIGS[lang].label})`);
    } else {
      const config = LANGUAGE_CONFIGS[lang];
      let candidateName = config.defaultFileName;
      let counter = 1;
      while (targetFiles.some((f) => f.name === candidateName)) {
        candidateName = `${config.defaultFileName.replace(config.extension, '')}_${counter}${config.extension}`;
        counter++;
      }

      const newFile: CodeFile = {
        id: `f_${Date.now()}`,
        name: candidateName,
        language: lang,
        content: config.starterCode,
      };

      if (isTeacher) {
        setTeachingFiles((prev) => [...prev, newFile]);
        setTeachingActiveFileId(newFile.id);
      } else {
        setStudentFiles((prev) => [...prev, newFile]);
        setStudentActiveFileId(newFile.id);
      }
      showToast(`Created ${candidateName} for ${config.label}`);
    }
  };

  // --- File Creation Operations ---
  const handleStartCreateFile = () => {
    setIsCreatingFile(true);
    setNewFileNameInput(`solution${activeLangConfig.extension}`);
    setFileErrorMessage(null);
  };

  const handleConfirmCreateFile = () => {
    const trimmed = newFileNameInput.trim();
    if (!trimmed) {
      setFileErrorMessage('File name cannot be empty.');
      return;
    }
    if (!/^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9]+)?$/.test(trimmed)) {
      setFileErrorMessage('Invalid characters in file name.');
      return;
    }

    let finalName = trimmed;
    if (!finalName.includes('.')) {
      finalName += activeLangConfig.extension;
    }

    const currentFileList = isTeacher ? teachingFiles : studentFiles;
    if (currentFileList.some((f) => f.name.toLowerCase() === finalName.toLowerCase())) {
      setFileErrorMessage(`A file named "${finalName}" already exists.`);
      return;
    }

    const detectedLang = detectLanguageFromFileName(finalName);
    const starter = LANGUAGE_CONFIGS[detectedLang]?.starterCode || '// New File\n';

    const newFile: CodeFile = {
      id: `f_${Date.now()}`,
      name: finalName,
      language: detectedLang,
      content: starter,
    };

    if (isTeacher) {
      setTeachingFiles((prev) => [...prev, newFile]);
      setTeachingActiveFileId(newFile.id);
    } else {
      setStudentFiles((prev) => [...prev, newFile]);
      setStudentActiveFileId(newFile.id);
    }

    setIsCreatingFile(false);
    setNewFileNameInput('');
    setFileErrorMessage(null);
    showToast(`Created file: ${finalName}`);
  };

  // --- File Rename Operations ---
  const handleStartRenameFile = (file: CodeFile, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingFileId(file.id);
    setRenameInput(file.name);
    setFileErrorMessage(null);
  };

  const handleConfirmRenameFile = () => {
    if (!renamingFileId) return;
    const trimmed = renameInput.trim();
    if (!trimmed) {
      setFileErrorMessage('File name cannot be empty.');
      return;
    }

    const currentFileList = isTeacher ? teachingFiles : studentFiles;
    if (currentFileList.some((f) => f.id !== renamingFileId && f.name.toLowerCase() === trimmed.toLowerCase())) {
      setFileErrorMessage(`A file named "${trimmed}" already exists.`);
      return;
    }

    const detectedLang = detectLanguageFromFileName(trimmed);
    if (isTeacher) {
      setTeachingFiles((prev) =>
        prev.map((f) => (f.id === renamingFileId ? { ...f, name: trimmed, language: detectedLang } : f))
      );
    } else {
      setStudentFiles((prev) =>
        prev.map((f) => (f.id === renamingFileId ? { ...f, name: trimmed, language: detectedLang } : f))
      );
    }

    setRenamingFileId(null);
    setRenameInput('');
    setFileErrorMessage(null);
    showToast(`Renamed file to: ${trimmed}`);
  };

  // --- File Delete Operations ---
  const handleDeleteFile = (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentFileList = isTeacher ? teachingFiles : studentFiles;
    if (currentFileList.length <= 1) {
      showToast('Cannot delete the only remaining file in the workspace.');
      return;
    }

    const nextFiles = currentFileList.filter((f) => f.id !== fileId);
    if (isTeacher) {
      setTeachingFiles(nextFiles);
      if (teachingActiveFileId === fileId) setTeachingActiveFileId(nextFiles[0].id);
    } else {
      setStudentFiles(nextFiles);
      if (studentActiveFileId === fileId) setStudentActiveFileId(nextFiles[0].id);
    }
    showToast('File deleted.');
  };

  // --- Real Live Trace Visualization Handler ---
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
            path: `/${f.name}`,
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

  // --- Real Code Execution Handler ---
  const handleRunCode = async () => {
    if (isExecuting) return;
    setIsConsoleOpen(true);
    setIsExecuting(true);

    const targetFile = isTeacher ? activeTeachingFile : activeStudentFile;

    setExecutionResult({
      status: 'running',
      stdout: `Compiling and executing ${targetFile.name} in authorized backend...\n`,
      stderr: '',
    });

    try {
      const result = await executeCode(targetFile, stdinBuffer, 8000);
      setExecutionResult(result);

      if (result.status === 'error' && result.stderr) {
        setActiveTerminalTab('compiler');
      } else {
        setActiveTerminalTab('output');
      }

      // If teacher has enabled output sharing, broadcast to students
      if (isTeacher && shareOutputWithStudents && signalingClient) {
        signalingClient.emitClassroomEvent('TEACHER_OUTPUT_STREAM', {
          result,
        });
      }

      if (result.exitCode === 0) {
        showToast(`Execution finished: Exit Code 0 (${result.executionTimeMs}ms)`);
      } else if (result.exitCode === 126) {
        showToast(`Notice: ${activeLangConfig.label} is in Editor-Only mode.`);
      } else {
        showToast(`Execution ended with status (Exit ${result.exitCode ?? 1})`);
      }
    } catch (err: any) {
      setExecutionResult({
        status: 'error',
        stdout: '',
        stderr: `Execution System Error: ${err.message || String(err)}\n`,
        executionTimeMs: 0,
        exitCode: 1,
      });
      setActiveTerminalTab('compiler');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleStopExecution = () => {
    cancelActiveExecution();
    setIsExecuting(false);
    setExecutionResult((prev) => ({
      ...prev,
      status: 'error',
      stderr: `${prev.stderr}\n[Process manually terminated by user]\n`,
      exitCode: 130,
    }));
    showToast('Execution stopped.');
  };

  const handleClearTerminal = () => {
    setExecutionResult({
      status: 'idle',
      stdout: '',
      stderr: '',
    });
    showToast('Terminal cleared.');
  };

  // --- Fullscreen Toggle Operation ---
  const handleToggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      if (containerRef.current?.requestFullscreen) {
        await containerRef.current.requestFullscreen();
      } else if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  const handleExitFullscreen = async () => {
    if (document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen();
    }
    setIsFullscreen(false);
  };

  // Resizable Divider Handlers
  const handleDividerPointerDown = (e: React.PointerEvent) => {
    isDraggingDividerRef.current = true;
    startDragYRef.current = e.clientY;
    startHeightRef.current = terminalHeight;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleDividerPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingDividerRef.current) return;
    const deltaY = startDragYRef.current - e.clientY;
    const containerHeight = containerRef.current?.clientHeight || 600;
    const maxHeight = Math.round(containerHeight * 0.7);
    const newHeight = Math.max(90, Math.min(maxHeight, startHeightRef.current + deltaY));
    setTerminalHeight(newHeight);
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        sessionStorage.setItem('cortex_terminal_height', String(newHeight));
      } catch (_) {}
    }
  };

  const handleDividerPointerUp = (e: React.PointerEvent) => {
    if (isDraggingDividerRef.current) {
      isDraggingDividerRef.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  // Filter students for Observe Student roster
  const studentParticipants = participants.filter((p) => p.role === 'student');
  const observedStudentObj = studentParticipants.find((p) => p.id === observedStudentId);

  return (
    <div
      ref={containerRef}
      className={`flex-1 flex flex-col h-full bg-[#0B0C0E] overflow-hidden select-none relative ${
        isFullscreen ? 'fixed inset-0 z-50 bg-[#0B0C0E] h-screen w-screen' : ''
      }`}
    >
      {/* Floating Exit Fullscreen Control when in Fullscreen */}
      {isFullscreen && (
        <button
          onClick={handleExitFullscreen}
          className="absolute top-2 right-4 z-50 flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#15161C]/90 hover:bg-[#1D1F27] border border-[#282A36] text-white text-xs font-medium shadow-2xl backdrop-blur transition"
          title="Exit Full Screen (Escape)"
        >
          <Minimize2 className="w-3.5 h-3.5 text-[#FF9100]" />
          <span>Exit Full Screen</span>
        </button>
      )}

      {/* Code Studio Primary Action Bar */}
      <div className="h-11 border-b border-[#282A36] bg-[#111216] px-3 sm:px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2 sm:space-x-3 overflow-x-auto no-scrollbar">
          {/* TEACHER WORKSPACE CONTROLS */}
          {isTeacher && (
            <div className="flex items-center space-x-1 bg-[#15161C] border border-[#282A36] rounded p-0.5">
              <button
                onClick={() => {
                  setTeacherMode('broadcast');
                  setIsSplitView(false);
                }}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-semibold transition ${
                  teacherMode === 'broadcast' && !isSplitView
                    ? 'bg-[#1D1F27] text-white border border-[#282A36] shadow-sm'
                    : 'text-[#71717A] hover:text-white'
                }`}
                title="Teaching Workspace (Broadcast)"
              >
                <Radio className={`w-3.5 h-3.5 ${broadcastState === 'broadcasting' ? 'text-[#10B981] animate-pulse' : 'text-[#FF9100]'}`} />
                <span>Teaching Workspace</span>
              </button>

              <button
                onClick={() => {
                  setTeacherMode('observe');
                  if (!observedStudentId && studentParticipants.length > 0) {
                    handleSelectStudentForObservation(studentParticipants[0].id);
                  }
                }}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${
                  teacherMode === 'observe' && !isSplitView
                    ? 'bg-[#1D1F27] text-white border border-[#282A36] shadow-sm'
                    : 'text-[#71717A] hover:text-white'
                }`}
                title="Observe Student Workspaces"
              >
                <Eye className="w-3.5 h-3.5 text-[#06B6D4]" />
                <span>Observe Student</span>
              </button>

              <button
                onClick={() => {
                  setIsSplitView((prev) => !prev);
                  if (!isSplitView && !observedStudentId && studentParticipants.length > 0) {
                    handleSelectStudentForObservation(studentParticipants[0].id);
                  }
                }}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${
                  isSplitView
                    ? 'bg-[#1D1F27] text-[#A855F7] border border-[#A855F7]/40 shadow-sm'
                    : 'text-[#71717A] hover:text-white'
                }`}
                title="Optional Split View: Compare Teaching Workspace and Selected Student"
              >
                <Columns className="w-3.5 h-3.5 text-[#A855F7]" />
                <span className="hidden md:inline">Split View</span>
              </button>
            </div>
          )}

          {/* STUDENT WORKSPACE CONTROLS */}
          {isStudent && (
            <div className="flex items-center space-x-1 bg-[#15161C] border border-[#282A36] rounded p-0.5">
              <button
                onClick={() => setStudentTab('my_workspace')}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-semibold transition ${
                  studentTab === 'my_workspace'
                    ? 'bg-[#1D1F27] text-white border border-[#282A36] shadow-sm'
                    : 'text-[#71717A] hover:text-white'
                }`}
                title="My Personal Coding Workspace"
              >
                <FileCode className="w-3.5 h-3.5 text-[#06B6D4]" />
                <span>My Workspace</span>
              </button>

              <button
                onClick={() => setStudentTab('instructor_demo')}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-semibold transition ${
                  studentTab === 'instructor_demo'
                    ? 'bg-[#1D1F27] text-[#FF9100] border border-[#FF9100]/40 shadow-sm'
                    : 'text-[#71717A] hover:text-white'
                }`}
                title="Instructor Demonstration Code"
              >
                <Radio className={`w-3.5 h-3.5 ${broadcastState === 'broadcasting' ? 'text-[#10B981] animate-pulse' : broadcastState === 'paused' ? 'text-[#EAB308]' : 'text-[#71717A]'}`} />
                <span>Instructor Demonstration</span>
                {broadcastState === 'broadcasting' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                )}
              </button>
            </div>
          )}

          {/* Language Selector Dropdown */}
          <div className="flex items-center space-x-2">
            <span className="text-[10px] text-[#71717A] uppercase font-mono hidden xl:inline">
              Language:
            </span>
            <select
              value={currentEditorFile?.language || 'typescript'}
              onChange={(e) => handleSelectLanguage(e.target.value as CodeLanguage)}
              disabled={isStudent && studentTab === 'instructor_demo'}
              className="bg-[#15161C] border border-[#282A36] text-white text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-[#FF9100] cursor-pointer disabled:opacity-50"
              aria-label="Select Code Language"
            >
              <option value="typescript">TypeScript 5.7</option>
              <option value="javascript">JavaScript ES2024</option>
              <option value="python">Python 3.11</option>
              <option value="cpp">C++17</option>
              <option value="rust">Rust 1.75</option>
            </select>
          </div>
        </div>

        {/* Action Controls & Execution Badge */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Honest Execution Support Badge */}
          <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono bg-[#15161C] border-[#282A36]">
            {isExecuting ? (
              <span className="text-[#FF9100] flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF9100] animate-pulse" />
                <span>Running...</span>
              </span>
            ) : executionResult.status === 'success' ? (
              <span className="text-[#10B981] flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                <span>Completed</span>
              </span>
            ) : (
              <span className="text-[#10B981] flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                <span>Execution Ready</span>
              </span>
            )}
          </div>

          {/* Focus Mode Toggle */}
          <button
            onClick={() => setIsFocusMode((prev) => !prev)}
            className={`hidden md:flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition ${
              isFocusMode
                ? 'bg-[#1D1F27] text-[#FF9100] border-[#FF9100]/40'
                : 'bg-[#15161C] text-[#A1A1AA] hover:text-white border-[#282A36]'
            }`}
            title="Toggle Focus Mode (reduces secondary navigation)"
            aria-label="Toggle Focus Mode"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#FF9100]" />
            <span>Focus</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={handleToggleFullscreen}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition ${
              isFullscreen
                ? 'bg-[#1D1F27] text-[#FF9100] border-[#FF9100]/40'
                : 'bg-[#15161C] text-[#A1A1AA] hover:text-white border-[#282A36]'
            }`}
            title={isFullscreen ? 'Exit Full Screen' : 'Full Screen Editor'}
            aria-label="Toggle Full Screen"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Toggle Console Button */}
          <button
            onClick={() => setIsConsoleOpen((prev) => !prev)}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
              isConsoleOpen
                ? 'bg-[#1D1F27] text-white border-[#FF9100]/50'
                : 'bg-[#15161C] text-[#A1A1AA] hover:text-white border-[#282A36]'
            }`}
            title="Toggle Execution Console (Ctrl+`)"
            aria-label="Toggle Execution Console"
          >
            <Terminal className="w-3.5 h-3.5 text-[#FF9100]" />
            <span className="hidden sm:inline">Console</span>
            {executionResult.stderr && !isConsoleOpen && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
            )}
          </button>

          {/* Execution Controls (Only available for editable workspaces) */}
          {(!isStudent || studentTab === 'my_workspace') && (
            isExecuting ? (
              <button
                onClick={handleStopExecution}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white font-semibold text-xs transition shadow-sm"
                title="Stop Execution"
                aria-label="Stop Execution"
              >
                <Square className="w-3.5 h-3.5 fill-white" />
                <span>Stop</span>
              </button>
            ) : (
              <>
              <button
                onClick={handleRunCode}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-[#FF9100] hover:bg-[#E08000] text-black font-semibold text-xs transition shadow-sm active:scale-95"
                title="Run Code in Authorized Backend"
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
                <Activity className={`w-3.5 h-3.5 ${isTracing ? 'animate-spin' : ''}`} />
                <span>{isTracing ? 'Tracing...' : 'Visualize'}</span>
              </button>
              </>
            )
          )}
        </div>
      </div>

      {/* TEACHER SUB-TOOLBAR: BROADCAST CONTROLS & STUDENT OBSERVATION */}
      {isTeacher && (
        <div className="bg-[#0E0F13] border-b border-[#282A36] px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Left: Broadcast Lifecycle Controls */}
          <div className="flex items-center space-x-2">
            <span className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider">
              Broadcast Status:
            </span>

            {broadcastState === 'broadcasting' && (
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                <span>Broadcasting Live</span>
              </span>
            )}

            {broadcastState === 'paused' && (
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-[#EAB308]/10 border border-[#EAB308]/40 text-[#EAB308] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#EAB308]" />
                <span>Broadcast Paused (Snapshot Preserved)</span>
              </span>
            )}

            {broadcastState === 'stopped' && (
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-[#282A36] text-[#A1A1AA] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#71717A]" />
                <span>Broadcast Inactive</span>
              </span>
            )}

            {/* Broadcast Action Buttons */}
            <div className="flex items-center space-x-1.5 ml-2">
              {broadcastState === 'stopped' ? (
                <button
                  onClick={handleStartBroadcast}
                  className="inline-flex items-center space-x-1 px-3 py-1 rounded-md bg-[#FF9100] hover:bg-[#E08000] text-black font-semibold text-xs transition"
                  title="Publish teaching code and begin live broadcasting"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Start Broadcast</span>
                </button>
              ) : broadcastState === 'broadcasting' ? (
                <>
                  <button
                    onClick={handlePauseBroadcast}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-[#1D1F27] hover:bg-[#282A36] text-[#EAB308] border border-[#282A36] font-medium text-xs transition"
                    title="Pause live code streaming while preserving published state for students"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause</span>
                  </button>
                  <button
                    onClick={handleStopBroadcast}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30 font-medium text-xs transition"
                    title="End broadcast and revoke student access to unpublished content"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Stop Broadcast</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleResumeBroadcast}
                    className="inline-flex items-center space-x-1 px-3 py-1 rounded-md bg-[#10B981] hover:bg-[#059669] text-black font-semibold text-xs transition"
                    title="Resume live streaming from teaching workspace"
                  >
                    <Play className="w-3.5 h-3.5 fill-black" />
                    <span>Resume Broadcast</span>
                  </button>
                  <button
                    onClick={handleStopBroadcast}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30 font-medium text-xs transition"
                    title="End broadcast and revoke student access to unpublished content"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Stop Broadcast</span>
                  </button>
                </>
              )}
            </div>

            {/* Share Console Output Toggle */}
            {(broadcastState === 'broadcasting' || broadcastState === 'paused') && (
              <label className="hidden sm:inline-flex items-center space-x-1.5 text-[11px] text-[#A1A1AA] cursor-pointer ml-3">
                <input
                  type="checkbox"
                  checked={shareOutputWithStudents}
                  onChange={(e) => setShareOutputWithStudents(e.target.checked)}
                  className="rounded border-[#282A36] bg-[#15161C] text-[#FF9100] focus:ring-0"
                />
                <span>Share Execution Output</span>
              </label>
            )}
          </div>

          {/* Right: Student Observation Roster & Selection */}
          {(teacherMode === 'observe' || isSplitView) && (
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase font-bold text-[#06B6D4] tracking-wider flex items-center space-x-1">
                <Eye className="w-3.5 h-3.5" />
                <span>Observe Student:</span>
              </span>

              {studentParticipants.length === 0 ? (
                <span className="text-xs text-[#71717A] italic">No students currently in classroom</span>
              ) : (
                <select
                  value={observedStudentId || ''}
                  onChange={(e) => handleSelectStudentForObservation(e.target.value)}
                  className="bg-[#15161C] border border-[#282A36] text-white text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-[#06B6D4] cursor-pointer"
                  aria-label="Select student to observe"
                >
                  <option value="" disabled>Select a student...</option>
                  {studentParticipants.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} ({student.connectionStatus === 'connected' ? 'Online' : 'Offline'})
                    </option>
                  ))}
                </select>
              )}

              {teacherMode === 'observe' && !isSplitView && (
                <button
                  onClick={handleReturnToTeachingWorkspace}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-[#15161C] hover:bg-[#1D1F27] border border-[#282A36] text-[#A1A1AA] hover:text-white transition ml-2"
                  title="Return to Teaching Workspace"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Return to Teaching Code</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* STUDENT SUB-TOOLBAR: DEMONSTRATION STATUS & SAFE COPY ACTION */}
      {isStudent && studentTab === 'instructor_demo' && (
        <div className="bg-[#0E0F13] border-b border-[#282A36] px-4 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-3">
            <span className="text-[10px] uppercase font-bold text-[#FF9100] tracking-wider flex items-center space-x-1">
              <Radio className="w-3.5 h-3.5" />
              <span>Instructor Demonstration:</span>
            </span>

            {broadcastState === 'broadcasting' ? (
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                <span>Broadcasting Live</span>
              </span>
            ) : broadcastState === 'paused' ? (
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-[#EAB308]/10 border border-[#EAB308]/40 text-[#EAB308] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#EAB308]" />
                <span>Broadcast Paused (Frozen Snapshot)</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-[#282A36] text-[#A1A1AA] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#71717A]" />
                <span>Broadcast Inactive</span>
              </span>
            )}

            <span className="text-[11px] text-[#71717A] hidden sm:inline flex items-center space-x-1">
              <Lock className="w-3 h-3 text-[#A1A1AA]" />
              <span>Read-Only</span>
            </span>
          </div>

          {/* Copy to My Workspace Action */}
          {broadcastTeachingFiles.length > 0 && (
            <button
              onClick={() => setCopyModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-md bg-[#FF9100] hover:bg-[#E08000] text-black font-semibold text-xs shadow-sm transition"
              title="Copy this code into your workspace without modifying instructor code"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy to My Workspace</span>
            </button>
          )}
        </div>
      )}

      {/* MAIN WORKSPACE CANVAS STAGE */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* --- VIEW BRANCH 1: TEACHER SPLIT VIEW (TEACHING WORKSPACE + OBSERVED STUDENT) --- */}
        {isTeacher && isSplitView ? (
          <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden">
            {/* Left Pane: Teaching Workspace (Broadcast) */}
            <div className="flex-1 flex flex-col h-full border-b lg:border-b-0 lg:border-r border-[#282A36] bg-[#0E0F13] overflow-hidden">
              <div className="h-9 border-b border-[#282A36] bg-[#111216] px-2 flex items-center justify-between shrink-0 overflow-x-auto no-scrollbar">
                <div className="flex items-center space-x-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#FF9100] px-2 py-0.5 rounded bg-[#FF9100]/10 border border-[#FF9100]/20 mr-1.5 shrink-0 flex items-center space-x-1">
                    <Radio className="w-3 h-3 text-[#FF9100]" />
                    <span>Teaching Workspace (Broadcast)</span>
                  </span>

                  {teachingFiles.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => setTeachingActiveFileId(file.id)}
                      className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs transition border shrink-0 ${
                        teachingActiveFileId === file.id
                          ? 'bg-[#1D1F27] text-white border-[#282A36] shadow-sm'
                          : 'bg-[#15161C]/50 text-[#71717A] border-transparent hover:text-[#A1A1AA]'
                      }`}
                    >
                      <FileCode className="w-3.5 h-3.5 text-[#FF9100]" />
                      <span>{file.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-hidden relative select-text" style={{ userSelect: 'text' }}>
                <Editor
                  key={`split-teach-${activeTeachingFile.id}`}
                  path={`teaching-${activeTeachingFile.id}`}
                  height="100%"
                  language={activeTeachingFile.language}
                  defaultValue={activeTeachingFile.content}
                  onChange={handleTeachingCodeChange}
                  onMount={(editor) => (monacoTeachingRef.current = editor)}
                  theme="vs-dark"
                  options={{
                    fontSize: 13,
                    fontFamily: "'Fira Code', 'Courier New', monospace",
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    lineNumbers: 'on',
                    renderLineHighlight: 'all',
                    selectOnLineNumbers: true,
                    dragAndDrop: true,
                    contextmenu: true,
                    multiCursorModifier: 'alt',
                    copyWithSyntaxHighlighting: true,
                    emptySelectionClipboard: false,
                    selectionHighlight: true,
                    autoClosingBrackets: 'always',
                    autoClosingQuotes: 'always',
                    autoSurround: 'languageDefined',
                    bracketPairColorization: { enabled: true },
                    formatOnPaste: false,
                    formatOnType: false,
                  }}
                />
              </div>
            </div>

            {/* Right Pane: Observed Student Workspace (Read-Only) */}
            <div className="flex-1 flex flex-col h-full bg-[#0E0F13] overflow-hidden">
              <div className="h-9 border-b border-[#282A36] bg-[#111216] px-2 flex items-center justify-between shrink-0 overflow-x-auto no-scrollbar">
                <div className="flex items-center space-x-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#06B6D4] px-2 py-0.5 rounded bg-[#06B6D4]/10 border border-[#06B6D4]/20 mr-1.5 shrink-0 flex items-center space-x-1">
                    <Lock className="w-3 h-3 text-[#06B6D4]" />
                    <span>Student: {observedStudentObj?.name || 'Observing Student'} (Read-Only)</span>
                  </span>

                  {observedStudentFiles.length === 0 ? (
                    <span className="text-xs text-[#71717A] italic px-2">No files shared yet</span>
                  ) : (
                    observedStudentFiles.map((file) => (
                      <button
                        key={file.id}
                        onClick={() => setObservedActiveFileId(file.id)}
                        className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs transition border shrink-0 ${
                          observedActiveFileId === file.id
                            ? 'bg-[#1D1F27] text-white border-[#282A36]'
                            : 'bg-[#15161C]/50 text-[#71717A] border-transparent hover:text-[#A1A1AA]'
                        }`}
                      >
                        <FileCode className="w-3.5 h-3.5 text-[#06B6D4]" />
                        <span>{file.name}</span>
                      </button>
                    ))
                  )}
                </div>

                <div className="flex items-center space-x-2 mr-2">
                  <span className="text-[10px] font-mono text-[#06B6D4] flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#06B6D4]" />
                    <span>{observedSyncStatus === 'synced' ? 'Live Synced' : observedSyncStatus === 'syncing' ? 'Syncing...' : 'Disconnected'}</span>
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-hidden relative">
                {observedStudentFiles.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#71717A]">
                    <Eye className="w-10 h-10 mb-3 text-[#06B6D4]/40" />
                    <p className="text-sm font-semibold text-white">Awaiting Student Code Activity</p>
                    <p className="text-xs mt-1 max-w-sm">
                      When {observedStudentObj?.name || 'the student'} types or opens files in their workspace, live updates will appear here automatically.
                    </p>
                  </div>
                ) : (
                  <Editor
                    height="100%"
                    language={activeObservedFile?.language || 'typescript'}
                    value={activeObservedFile?.content || ''}
                    theme="vs-dark"
                    options={{
                      readOnly: true,
                      fontSize: 13,
                      fontFamily: "'Fira Code', 'Courier New', monospace",
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      lineNumbers: 'on',
                      renderLineHighlight: 'none',
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        ) : isTeacher && teacherMode === 'observe' ? (
          /* --- VIEW BRANCH 2: TEACHER OBSERVE SINGLE PANE --- */
          <div className="flex-1 flex flex-col h-full bg-[#0E0F13] overflow-hidden">
            <div className="h-9 border-b border-[#282A36] bg-[#111216] px-2 flex items-center justify-between shrink-0 overflow-x-auto no-scrollbar">
              <div className="flex items-center space-x-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#06B6D4] px-2 py-0.5 rounded bg-[#06B6D4]/10 border border-[#06B6D4]/20 mr-1.5 shrink-0 flex items-center space-x-1">
                  <Lock className="w-3 h-3 text-[#06B6D4]" />
                  <span>Observing Student: {observedStudentObj?.name || 'Selected Student'} (Read-Only)</span>
                </span>

                {observedStudentFiles.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => setObservedActiveFileId(file.id)}
                    className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs transition border shrink-0 ${
                      observedActiveFileId === file.id
                        ? 'bg-[#1D1F27] text-white border-[#282A36]'
                        : 'bg-[#15161C]/50 text-[#71717A] border-transparent hover:text-[#A1A1AA]'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5 text-[#06B6D4]" />
                    <span>{file.name}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center space-x-3 mr-2">
                <span className="text-[10px] font-mono text-[#06B6D4] flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#06B6D4]" />
                  <span>{observedSyncStatus === 'synced' ? 'Real-time Observation' : 'Syncing...'}</span>
                </span>
                <button
                  onClick={handleReturnToTeachingWorkspace}
                  className="px-2.5 py-1 rounded bg-[#15161C] hover:bg-[#1D1F27] border border-[#282A36] text-[#A1A1AA] hover:text-white text-xs font-medium transition"
                >
                  Return to Teaching Workspace
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
              {observedStudentFiles.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#71717A]">
                  <Eye className="w-12 h-12 mb-3 text-[#06B6D4]/40" />
                  <p className="text-sm font-semibold text-white">Awaiting Student Code Activity</p>
                  <p className="text-xs mt-1 max-w-sm">
                    No files received yet for {observedStudentObj?.name || 'this student'}. When the student works in My Workspace, updates stream here in real time.
                  </p>
                </div>
              ) : (
                <Editor
                  height="100%"
                  language={activeObservedFile?.language || 'typescript'}
                  value={activeObservedFile?.content || ''}
                  theme="vs-dark"
                  options={{
                    readOnly: true,
                    fontSize: 13,
                    fontFamily: "'Fira Code', 'Courier New', monospace",
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    lineNumbers: 'on',
                    renderLineHighlight: 'none',
                  }}
                />
              )}
            </div>
          </div>
        ) : isStudent && studentTab === 'instructor_demo' ? (
          /* --- VIEW BRANCH 3: STUDENT INSTRUCTOR DEMONSTRATION TAB --- */
          <div className="flex-1 flex flex-col h-full bg-[#0E0F13] overflow-hidden">
            <div className="h-9 border-b border-[#282A36] bg-[#111216] px-2 flex items-center justify-between shrink-0 overflow-x-auto no-scrollbar">
              <div className="flex items-center space-x-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#FF9100] px-2 py-0.5 rounded bg-[#FF9100]/10 border border-[#FF9100]/20 mr-1.5 shrink-0 flex items-center space-x-1">
                  <Radio className="w-3 h-3 text-[#FF9100]" />
                  <span>Instructor Demonstration (Read-Only)</span>
                </span>

                {broadcastTeachingFiles.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => setBroadcastActiveFileId(file.id)}
                    className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs transition border shrink-0 ${
                      broadcastActiveFileId === file.id
                        ? 'bg-[#1D1F27] text-white border-[#282A36]'
                        : 'bg-[#15161C]/50 text-[#71717A] border-transparent hover:text-[#A1A1AA]'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5 text-[#FF9100]" />
                    <span>{file.name}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center space-x-2 mr-2">
                <span className="text-[10px] font-mono text-[#FF9100] flex items-center space-x-1">
                  <Lock className="w-3 h-3" />
                  <span>Protected Read-Only</span>
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
              {broadcastTeachingFiles.length === 0 || broadcastState === 'stopped' ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#71717A]">
                  <Radio className="w-12 h-12 mb-3 text-[#71717A]/40" />
                  <p className="text-sm font-semibold text-white">Broadcast Inactive</p>
                  <p className="text-xs mt-1 max-w-sm">
                    The instructor has not started broadcasting code yet. Please continue working on your implementation in My Workspace.
                  </p>
                  <button
                    onClick={() => setStudentTab('my_workspace')}
                    className="mt-4 px-4 py-2 rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] text-black font-semibold text-xs transition"
                  >
                    Go to My Workspace
                  </button>
                </div>
              ) : (
                <Editor
                  height="100%"
                  language={activeBroadcastDemoFile?.language || 'typescript'}
                  value={activeBroadcastDemoFile?.content || ''}
                  theme="vs-dark"
                  options={{
                    readOnly: true,
                    fontSize: 13,
                    fontFamily: "'Fira Code', 'Courier New', monospace",
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    lineNumbers: 'on',
                    renderLineHighlight: 'none',
                  }}
                />
              )}
            </div>
          </div>
        ) : (
          /* --- VIEW BRANCH 4: STANDARD EDITABLE WORKSPACE (TEACHING BROADCAST OR STUDENT MY WORKSPACE) --- */
          <div className="flex-1 flex flex-col h-full bg-[#0E0F13] overflow-hidden">
            {/* File Tabs Toolbar */}
            <div className="h-9 border-b border-[#282A36] bg-[#111216] px-2 flex items-center justify-between shrink-0 overflow-x-auto no-scrollbar">
              <div className="flex items-center space-x-1">
                <span
                  className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded mr-1.5 shrink-0 flex items-center space-x-1 ${
                    isTeacher
                      ? 'text-[#FF9100] bg-[#FF9100]/10 border border-[#FF9100]/20'
                      : 'text-[#06B6D4] bg-[#06B6D4]/10 border border-[#06B6D4]/20'
                  }`}
                >
                  <FileCode className="w-3 h-3" />
                  <span>{isTeacher ? 'Teaching Workspace' : 'My Workspace'}</span>
                </span>

                {(isTeacher ? teachingFiles : studentFiles).map((file) => {
                  const isActive = isTeacher
                    ? file.id === teachingActiveFileId
                    : file.id === studentActiveFileId;
                  const isRenaming = file.id === renamingFileId;

                  return (
                    <div
                      key={file.id}
                      onClick={() => {
                        if (!isRenaming) {
                          if (isTeacher) setTeachingActiveFileId(file.id);
                          else setStudentActiveFileId(file.id);
                        }
                      }}
                      className={`group flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs transition cursor-pointer shrink-0 border ${
                        isActive
                          ? 'bg-[#1D1F27] text-white border-[#282A36] shadow-sm'
                          : 'bg-[#15161C]/50 text-[#71717A] border-transparent hover:text-[#A1A1AA] hover:bg-[#15161C]'
                      }`}
                    >
                      <FileCode className={`w-3.5 h-3.5 ${isTeacher ? 'text-[#FF9100]' : 'text-[#06B6D4]'}`} />
                      {isRenaming ? (
                        <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={renameInput}
                            onChange={(e) => {
                              setRenameInput(e.target.value);
                              if (fileErrorMessage) setFileErrorMessage(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleConfirmRenameFile();
                              if (e.key === 'Escape') {
                                setRenamingFileId(null);
                                setFileErrorMessage(null);
                              }
                            }}
                            autoFocus
                            className="w-24 bg-[#0B0C0E] border border-[#FF9100] text-white text-[11px] px-1 py-0.5 rounded focus:outline-none"
                          />
                          <button
                            onClick={handleConfirmRenameFile}
                            className="text-[#10B981] hover:text-white"
                            title="Confirm Rename"
                          >
                            ✓
                          </button>
                        </div>
                      ) : (
                        <span onDoubleClick={(e) => handleStartRenameFile(file, e)} title="Double click to rename">
                          {file.name}
                        </span>
                      )}

                      {!isRenaming && isActive && (
                        <button
                          onClick={(e) => handleStartRenameFile(file, e)}
                          className="opacity-0 group-hover:opacity-100 hover:text-white p-0.5 transition"
                          title="Rename file"
                        >
                          <Edit2 className="w-2.5 h-2.5 text-[#71717A]" />
                        </button>
                      )}

                      {!isRenaming && (isTeacher ? teachingFiles : studentFiles).length > 1 && (
                        <button
                          onClick={(e) => handleDeleteFile(file.id, e)}
                          className="opacity-0 group-hover:opacity-100 hover:text-[#EF4444] p-0.5 transition"
                          title="Delete file"
                        >
                          <X className="w-2.5 h-2.5 text-[#71717A]" />
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Add New File Button */}
                <button
                  onClick={handleStartCreateFile}
                  className="p-1 rounded text-[#71717A] hover:text-white hover:bg-[#1D1F27] border border-dashed border-[#282A36] transition ml-1"
                  title="Add New Source File"
                  aria-label="Add New File"
                >
                  <Plus className={`w-3 h-3 ${isTeacher ? 'text-[#FF9100]' : 'text-[#06B6D4]'}`} />
                </button>
              </div>
            </div>

            {/* Inline New File Creator */}
            {isCreatingFile && (
              <div className="bg-[#15161C] border-b border-[#282A36] px-3 py-2 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <span className="text-[#A1A1AA]">New File:</span>
                  <input
                    type="text"
                    value={newFileNameInput}
                    onChange={(e) => setNewFileNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleConfirmCreateFile();
                      if (e.key === 'Escape') setIsCreatingFile(false);
                    }}
                    placeholder="e.g. solution.ts"
                    autoFocus
                    className="bg-[#0B0C0E] border border-[#282A36] focus:border-[#FF9100] text-white px-2 py-1 rounded text-xs focus:outline-none"
                  />
                  <button
                    onClick={handleConfirmCreateFile}
                    className="px-2.5 py-1 rounded bg-[#FF9100] text-black font-semibold hover:bg-[#E08000] transition"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setIsCreatingFile(false)}
                    className="px-2 py-1 rounded text-[#71717A] hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
                {fileErrorMessage && (
                  <span className="text-[#EF4444] text-[11px]">{fileErrorMessage}</span>
                )}
              </div>
            )}

            {/* Monaco Editor Instance */}
            <div className="flex-1 overflow-hidden relative select-text" style={{ userSelect: 'text' }}>
              <Editor
                key={isTeacher ? `teach-${activeTeachingFile.id}` : `stud-${activeStudentFile.id}`}
                path={isTeacher ? `teaching-${activeTeachingFile.id}` : `student-${activeStudentFile.id}`}
                height="100%"
                language={isTeacher ? activeTeachingFile.language : activeStudentFile.language}
                defaultValue={isTeacher ? activeTeachingFile.content : activeStudentFile.content}
                onChange={isTeacher ? handleTeachingCodeChange : handleStudentCodeChange}
                onMount={(editor) => {
                  if (isTeacher) monacoTeachingRef.current = editor;
                  else monacoStudentRef.current = editor;
                }}
                theme="vs-dark"
                options={{
                  fontSize: 13,
                  fontFamily: "'Fira Code', 'Courier New', monospace",
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  lineNumbers: 'on',
                  cursorBlinking: 'smooth',
                  cursorSmoothCaretAnimation: 'on',
                  renderLineHighlight: 'all',
                  selectOnLineNumbers: true,
                  dragAndDrop: true,
                  contextmenu: true,
                  multiCursorModifier: 'alt',
                  copyWithSyntaxHighlighting: true,
                  emptySelectionClipboard: false,
                  selectionHighlight: true,
                  autoClosingBrackets: 'always',
                  autoClosingQuotes: 'always',
                  autoSurround: 'languageDefined',
                  bracketPairColorization: { enabled: true },
                  formatOnPaste: false,
                  formatOnType: false,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Execution Console Dock Bar / Collapsible Terminal */}
      {!isConsoleOpen ? (
        <div
          onClick={() => setIsConsoleOpen(true)}
          role="button"
          tabIndex={0}
          className="h-7 bg-[#111216] border-t border-[#282A36] px-4 flex items-center justify-between text-[11px] text-[#71717A] hover:text-[#A1A1AA] hover:bg-[#15161C] cursor-pointer transition shrink-0 select-none"
          title="Click or press Ctrl+` to expand Execution Console"
          aria-label="Open Execution Console"
        >
          <div className="flex items-center space-x-2">
            <Terminal className="w-3.5 h-3.5 text-[#FF9100]" />
            <span className="font-semibold text-[#A1A1AA]">Execution Console (Collapsed)</span>
            <span className="text-[10px] text-[#71717A] hidden sm:inline">
              • Click or press Ctrl+` to expand
            </span>
          </div>

          <div className="flex items-center space-x-3 text-[11px] font-mono">
            {executionResult.executionTimeMs !== undefined && (
              <span className="flex items-center space-x-1 text-[#10B981]">
                <Clock className="w-3 h-3" />
                <span>{executionResult.executionTimeMs}ms</span>
              </span>
            )}
            {executionResult.stderr ? (
              <span className="flex items-center space-x-1 text-[#EF4444]">
                <AlertTriangle className="w-3 h-3" />
                <span>Diagnostics Reported</span>
              </span>
            ) : executionResult.exitCode === 0 ? (
              <span className="flex items-center space-x-1 text-[#10B981]">
                <CheckCircle2 className="w-3 h-3" />
                <span>Ready • Exit 0</span>
              </span>
            ) : null}
            <ChevronUp className="w-3.5 h-3.5 text-[#71717A]" />
          </div>
        </div>
      ) : (
        <>
          {/* Draggable Vertical Split Resizer Divider */}
          <div
            tabIndex={0}
            role="separator"
            aria-orientation="horizontal"
            aria-valuenow={terminalHeight}
            aria-valuemin={90}
            aria-valuemax={Math.round((containerRef.current?.clientHeight || 600) * 0.7)}
            aria-label="Execution Console Resize Divider"
            onPointerDown={handleDividerPointerDown}
            onPointerMove={handleDividerPointerMove}
            onPointerUp={handleDividerPointerUp}
            className="h-2 bg-[#15161C] hover:bg-[#FF9100]/50 focus:bg-[#FF9100]/50 border-t border-b border-[#282A36] cursor-row-resize flex items-center justify-center transition group relative z-10 select-none outline-none"
            title="Drag vertically to resize terminal"
          >
            <GripHorizontal className="w-4 h-4 text-[#71717A] group-hover:text-white" />
          </div>

          {/* Expanded Execution Terminal Panel */}
          <div
            style={{ height: `${terminalHeight}px` }}
            className="border-t border-[#282A36] bg-[#0B0C0E] flex flex-col shrink-0 select-text"
          >
            <div className="h-8 border-b border-[#282A36] bg-[#111216] px-3 flex items-center justify-between">
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setActiveTerminalTab('output')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition ${
                    activeTerminalTab === 'output'
                      ? 'bg-[#1D1F27] text-white border border-[#282A36]'
                      : 'text-[#71717A] hover:text-[#A1A1AA]'
                  }`}
                >
                  Stdout
                </button>
                <button
                  onClick={() => setActiveTerminalTab('compiler')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition flex items-center space-x-1 ${
                    activeTerminalTab === 'compiler'
                      ? 'bg-[#1D1F27] text-white border border-[#282A36]'
                      : 'text-[#71717A] hover:text-[#A1A1AA]'
                  }`}
                >
                  <span>Diagnostics</span>
                  {executionResult.stderr && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTerminalTab('stdin')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition ${
                    activeTerminalTab === 'stdin'
                      ? 'bg-[#1D1F27] text-white border border-[#282A36]'
                      : 'text-[#71717A] hover:text-[#A1A1AA]'
                  }`}
                >
                  Stdin
                </button>
                <button
                  onClick={() => setActiveTerminalTab('visualize')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition flex items-center space-x-1 ${
                    activeTerminalTab === 'visualize'
                      ? 'bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/40 font-bold'
                      : 'text-[#71717A] hover:text-[#A1A1AA]'
                  }`}
                >
                  <Activity className="w-3 h-3 mr-1" />
                  <span>Visualize</span>
                </button>
              </div>

              <div className="flex items-center space-x-3 text-xs">
                <button
                  onClick={handleClearTerminal}
                  className="text-[#71717A] hover:text-white transition"
                  title="Clear Terminal Output"
                >
                  Clear
                </button>
                <button
                  onClick={() => setIsConsoleOpen(false)}
                  className="text-[#71717A] hover:text-white transition"
                  title="Collapse Terminal"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Terminal Tab Content */}
            <div className="flex-1 p-3 overflow-y-auto font-mono text-xs text-[#D4D4D8] bg-[#090A0D]">
              {activeTerminalTab === 'output' && (
                <pre className="whitespace-pre-wrap leading-relaxed">
                  {executionResult.stdout || 'Program produced no stdout output.'}
                </pre>
              )}
              {activeTerminalTab === 'compiler' && (
                <pre className="whitespace-pre-wrap leading-relaxed text-[#EF4444]">
                  {executionResult.stderr || 'No diagnostic errors reported.'}
                </pre>
              )}
              {activeTerminalTab === 'visualize' && (
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
              {activeTerminalTab === 'stdin' && (
                <div className="flex flex-col h-full space-y-2">
                  <span className="text-[11px] text-[#71717A]">
                    Provide standard input lines for execution:
                  </span>
                  <textarea
                    value={stdinBuffer}
                    onChange={(e) => setStdinBuffer(e.target.value)}
                    placeholder="Enter input to pass to standard input..."
                    className="flex-1 bg-[#111216] border border-[#282A36] rounded p-2 text-white font-mono text-xs focus:outline-none focus:border-[#FF9100]"
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* SAFE COPY CONFIRMATION MODAL (FOR STUDENTS) */}
      {copyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#111216] border border-[#282A36] rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-[#FF9100]/10 border border-[#FF9100]/30 text-[#FF9100] flex items-center justify-center">
              <Copy className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                Copy Demonstration to My Workspace?
              </h3>
              <p className="text-xs text-[#A1A1AA] mt-1.5 leading-relaxed">
                This will create a new personal file in your workspace containing the instructor's current code. Your existing files will remain safe and will not be overwritten.
              </p>
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <button
                onClick={() => setCopyModalOpen(false)}
                className="flex-1 py-2 px-3 rounded-lg bg-[#1D1F27] hover:bg-[#282A36] border border-[#282A36] text-white text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCopyToOwnWorkspace}
                className="flex-1 py-2 px-3 rounded-lg bg-[#FF9100] hover:bg-[#E08000] text-black text-xs font-semibold shadow-md transition"
              >
                Copy to Workspace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
