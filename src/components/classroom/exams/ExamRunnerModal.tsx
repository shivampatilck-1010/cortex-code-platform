'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X,
  Clock,
  Award,
  Shield,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Send,
  Play,
  RotateCcw,
  Check,
  Maximize2,
  Wifi,
  WifiOff,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Download,
  Filter,
  HelpCircle,
  Code2,
  Terminal,
  Copy,
  FileText,
  Sparkles,
  Layers,
  ListChecks,
  Eye,
  PanelLeftClose,
  PanelLeftOpen,
  Trash2,
} from 'lucide-react';
import { Exam, ExamQuestion, ExamQuestionResponse, ExamSession, ExamSection } from '@/lib/classroom/models';
import dynamic from 'next/dynamic';
import { CortexLockdownPrepModal } from './CortexLockdownPrepModal';
import {
  getSebClientKeys,
  buildSebHeaders,
  getSebProtocolUri,
  validateHexColor,
  THEME_PRESETS,
} from '@/lib/classroom/seb-client';

// Dynamic Monaco editor import to avoid SSR issues
const MonacoEditor = dynamic(
  () => import('@monaco-editor/react').then((mod) => mod.default),
  { ssr: false }
);

export type AutosaveStatus =
  | 'idle'
  | 'saving'
  | 'saved'
  | 'retrying'
  | 'offline'
  | 'reconnected'
  | 'failed'
  | 'submitting'
  | 'submitted';

export type PaletteFilter = 'all' | 'answered' | 'flagged' | 'unanswered';

interface ExamRunnerModalProps {
  classroomId: string;
  examId: string;
  currentUser: { id: string; name: string; email: string };
  onClose: () => void;
  initialLaunchToken?: string;
}

export function ExamRunnerModal({
  classroomId,
  examId,
  currentUser,
  onClose,
  initialLaunchToken,
}: ExamRunnerModalProps) {
  const [exam, setExam] = useState<Exam | null>(null);
  const [session, setSession] = useState<ExamSession | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [activeBranchQuestionIds, setActiveBranchQuestionIds] = useState<string[] | null>(null);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [currentIndex, setCurrentIndex] = useState(0);

  // Modern Navigation & Palette Controls
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [paletteFilter, setPaletteFilter] = useState<PaletteFilter>('all');
  const [isPaletteCollapsed, setIsPaletteCollapsed] = useState(false);

  // Split-Screen Programming Workbench State
  const [customStdin, setCustomStdin] = useState('');
  const [activeCodeTab, setActiveCodeTab] = useState<'sample' | 'custom' | 'output'>('sample');
  const [sampleOutput, setSampleOutput] = useState<string | null>(null);
  const [isRunningSample, setIsRunningSample] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Session & Security Gate State
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [launchToken, setLaunchToken] = useState<string | null>(initialLaunchToken || null);
  const [sebRequiredInfo, setSebRequiredInfo] = useState<{
    downloadUrl: string;
    configUrl: string;
    protocolUri?: string;
    launchToken?: string;
    verificationReason?: string;
  } | null>(null);
  const [lockdownRequiredInfo, setLockdownRequiredInfo] = useState<{ downloadUrl: string; launchUrl: string } | null>(null);

  // Authoritative Monotonic Server Timer Refs
  const serverTimeOffsetRef = useRef<number>(0);
  const serverTimeAtSyncRef = useRef<number>(0);
  const clientMonotonicAtSyncRef = useRef<number>(0);
  const expiresAtRef = useRef<number | null>(null);

  // Timer state
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Autosave State Machine
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [dirtyQuestions, setDirtyQuestions] = useState<string[]>([]);
  const [isOffline, setIsOffline] = useState(false);
  const [offlineNoticeDismissed, setOfflineNoticeDismissed] = useState(false);

  // Autosave queue and sequence management
  const pendingQueueRef = useRef<Map<string, { val: any; flagged: boolean; seq: number }>>(new Map());
  const seqCounterRef = useRef<number>(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fullscreen & integrity warnings
  const [integrityWarning, setIntegrityWarning] = useState<string | null>(null);
  const [isSubmittingFinal, setIsSubmittingFinal] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [confirmAgreement, setConfirmAgreement] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<any | null>(null);

  // Centralized SEB Headers Helper
  const getSebHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const keys = await getSebClientKeys();
    return buildSebHeaders({
      configKey: keys.configKey,
      browserExamKey: keys.browserExamKey,
      launchToken: launchToken || undefined,
    });
  }, [launchToken]);

  // Network connection monitoring
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOffline(!window.navigator.onLine);

    const handleOnline = () => {
      setIsOffline(false);
      setOfflineNoticeDismissed(false);

      if (pendingQueueRef.current.size > 0) {
        setAutosaveStatus('reconnected');
        processPendingQueue();
      } else {
        setAutosaveStatus('saved');
        setLastSavedAt(Date.now());
      }

      if (session) {
        getSebHeaders().then((sebHeaders) => {
          fetch(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${session.id}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...sebHeaders },
          }).catch(() => {});
        });
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
      setAutosaveStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [session, classroomId, examId, getSebHeaders]);

  // Process pending autosave queue
  const processPendingQueue = useCallback(async () => {
    if (pendingQueueRef.current.size === 0 || !session) return;
    if (typeof window !== 'undefined' && !window.navigator.onLine) {
      setAutosaveStatus('offline');
      return;
    }

    setAutosaveStatus('saving');

    const queueItems = Array.from(pendingQueueRef.current.entries());

    for (const [qId, item] of queueItems) {
      try {
        const sebHeaders = await getSebHeaders();
        const res = await fetch(
          `/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${session.id}/responses`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...sebHeaders,
            },
            body: JSON.stringify({
              questionId: qId,
              response: item.val,
              flaggedForReview: item.flagged,
            }),
          }
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          if (res.status === 403 && (errData.sebRequired || exam?.securityLevel === 'seb')) {
            const configUrl = errData.configUrl || `/api/v1/classrooms/${classroomId}/exams/${examId}/seb-config`;
            const protocolUri = errData.protocolUri || getSebProtocolUri(configUrl);
            setSebRequiredInfo({
              downloadUrl: errData.downloadUrl || 'https://safeexambrowser.org/download_en.html',
              configUrl,
              protocolUri,
              launchToken: errData.launchToken || launchToken || undefined,
              verificationReason:
                errData.verificationReason || errData.reason || errData.error || 'Safe Exam Browser verification required',
            });
            setAutosaveStatus('failed');
            return;
          }
          throw new Error(errData.error || 'Save request failed with status ' + res.status);
        }

        const respData = await res.json().catch(() => ({}));
        if (respData.routeInfo?.activeQuestionIds) {
          setActiveBranchQuestionIds(respData.routeInfo.activeQuestionIds);
        }

        const currentInQueue = pendingQueueRef.current.get(qId);
        if (currentInQueue && currentInQueue.seq === item.seq) {
          pendingQueueRef.current.delete(qId);
          setDirtyQuestions((prev) => prev.filter((id) => id !== qId));
        }

        retryCountRef.current = 0;
      } catch (err) {
        if (typeof window !== 'undefined' && !window.navigator.onLine) {
          setAutosaveStatus('offline');
          return;
        }

        retryCountRef.current += 1;
        if (retryCountRef.current <= 5) {
          setAutosaveStatus('retrying');
          const delay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 8000);
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          retryTimerRef.current = setTimeout(() => {
            processPendingQueue();
          }, delay);
        } else {
          setAutosaveStatus('failed');
        }
        return;
      }
    }

    if (pendingQueueRef.current.size === 0) {
      setAutosaveStatus('saved');
      setLastSavedAt(Date.now());
    }
  }, [classroomId, examId, session, getSebHeaders, exam?.securityLevel, launchToken]);

  // Schedule autosave helper
  const scheduleAutosave = (qId: string, answerVal: any, flagged: boolean = false) => {
    if (!session) return;

    seqCounterRef.current += 1;
    pendingQueueRef.current.set(qId, {
      val: answerVal,
      flagged,
      seq: seqCounterRef.current,
    });

    setDirtyQuestions((prev) => (prev.includes(qId) ? prev : [...prev, qId]));

    try {
      if (typeof window !== 'undefined') {
        const currentBackup = JSON.parse(localStorage.getItem(`cortex_exam_${session.id}_responses`) || '{}');
        currentBackup[qId] = answerVal;
        localStorage.setItem(`cortex_exam_${session.id}_responses`, JSON.stringify(currentBackup));
      }
    } catch (err) {
      console.warn('[ExamRunnerModal] Non-fatal backup cache error:', err);
    }

    if (typeof window !== 'undefined' && !window.navigator.onLine) {
      setAutosaveStatus('offline');
      return;
    }

    setAutosaveStatus('saving');

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      processPendingQueue();
    }, 500);
  };

  const handleUpdateAnswer = (qId: string, val: any) => {
    const updated = { ...responses, [qId]: val };
    setResponses(updated);
    scheduleAutosave(qId, val, !!flaggedQuestions[qId]);
  };

  const handleClearAnswer = (qId: string) => {
    const updated = { ...responses };
    delete updated[qId];
    setResponses(updated);
    scheduleAutosave(qId, undefined, !!flaggedQuestions[qId]);
  };

  const toggleFlagReview = (qId: string) => {
    const updated = { ...flaggedQuestions, [qId]: !flaggedQuestions[qId] };
    setFlaggedQuestions(updated);
    scheduleAutosave(qId, responses[qId], updated[qId]);
  };

  // Run sample code against public test cases or custom stdin
  const handleRunSampleCode = async (code: string, lang: string) => {
    setIsRunningSample(true);
    setSampleOutput(null);
    setActiveCodeTab('output');

    try {
      const activeTestCases = currentQ?.testCases?.filter((tc) => !tc.isHidden) || [];
      const effectiveStdin = customStdin.trim() || activeTestCases[0]?.input || '';

      const res = await fetch('/api/v1/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: lang,
          files: [{ id: 'main', name: 'solution', path: '/solution', content: code }],
          stdin: effectiveStdin,
        }),
      });

      const data = await res.json();
      setSampleOutput(data.stdout || data.stderr || 'Execution finished with no output.');
    } catch (err: any) {
      setSampleOutput(`Execution error: ${err.message}`);
    } finally {
      setIsRunningSample(false);
    }
  };

  // Final submit handler
  const handleFinalSubmit = async () => {
    if (!session) return;
    setIsSubmittingFinal(true);
    setAutosaveStatus('submitting');

    try {
      const sebHeaders = await getSebHeaders();
      const res = await fetch(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${session.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...sebHeaders,
        },
        body: JSON.stringify({ finalResponses: responses }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 403 && (data.sebRequired || exam?.securityLevel === 'seb')) {
          const configUrl = data.configUrl || `/api/v1/classrooms/${classroomId}/exams/${examId}/seb-config`;
          const protocolUri = data.protocolUri || getSebProtocolUri(configUrl);
          setSebRequiredInfo({
            downloadUrl: data.downloadUrl || 'https://safeexambrowser.org/download_en.html',
            configUrl,
            protocolUri,
            launchToken: data.launchToken || launchToken || undefined,
            verificationReason:
              data.verificationReason || data.reason || data.error || 'Safe Exam Browser verification required for submission',
          });
          return;
        }
        throw new Error(data.error || 'Submission failed');
      }

      const data = await res.json();
      setSubmissionResult(data.session);
      setShowSubmitConfirm(false);
      setAutosaveStatus('submitted');

      try {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(`cortex_exam_${session.id}_responses`);
        }
      } catch (err) {
        console.warn('[ExamRunnerModal] Non-fatal cache eviction error:', err);
      }
    } catch (err: any) {
      setAutosaveStatus('failed');
      setError(err.message || 'Failed to submit examination');
    } finally {
      setIsSubmittingFinal(false);
    }
  };

  const handleAutoSubmitOnExpiry = () => {
    handleFinalSubmit();
  };

  // Start / Resume Session Effect
  const startSession = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      let searchToken = launchToken;
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        searchToken = urlParams.get('sebToken') || urlParams.get('launchToken') || urlParams.get('token') || launchToken;
      }
      const effectiveToken = launchToken || searchToken || undefined;
      if (searchToken && !launchToken) {
        setLaunchToken(searchToken);
      }

      const keys = await getSebClientKeys();
      const sebHeaders = buildSebHeaders({
        configKey: keys.configKey,
        browserExamKey: keys.browserExamKey,
        launchToken: effectiveToken,
      });

      const res = await fetch(`/api/v1/classrooms/${classroomId}/exams/${examId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...sebHeaders,
        },
        body: effectiveToken
          ? JSON.stringify({
              launchToken: effectiveToken,
              clientConfigKey: keys.configKey,
              clientBrowserExamKey: keys.browserExamKey,
            })
          : undefined,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.sebRequired) {
          const configUrl = data.configUrl || `/api/v1/classrooms/${classroomId}/exams/${examId}/seb-config`;
          const protocolUri = data.protocolUri || getSebProtocolUri(configUrl);
          setSebRequiredInfo({
            downloadUrl: data.downloadUrl || 'https://safeexambrowser.org/download_en.html',
            configUrl,
            protocolUri,
            launchToken: data.launchToken || effectiveToken,
            verificationReason: data.verificationReason || data.reason || data.error,
          });
          if (data.launchToken) setLaunchToken(data.launchToken);
          return;
        }
        if (data.lockdownRequired) {
          let grantParam = '';
          try {
            const authRes = await fetch('/api/v1/lockdown/authorize-launch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ classroomId, examId }),
            });
            if (authRes.ok) {
              const authData = await authRes.json();
              if (authData.launchGrant) {
                grantParam = `&grant=${encodeURIComponent(authData.launchGrant)}`;
              }
            }
          } catch (err) {
            console.warn('[ExamRunnerModal] Non-fatal auth grant error:', err);
          }

          setLockdownRequiredInfo({
            downloadUrl: data.downloadUrl || '/lockdown/download',
            launchUrl: `cortex-lockdown://launch?examId=${examId}${grantParam}`,
          });
          return;
        }
        throw new Error(data.error || 'Failed to start examination');
      }

      setExam(data.exam);
      setSession(data.session);
      const loadedQuestions: ExamQuestion[] = data.exam?.questions || [];
      setQuestions(loadedQuestions);

      if (loadedQuestions.length > 0 && loadedQuestions[0].sectionId) {
        setSelectedSectionId(loadedQuestions[0].sectionId);
      }

      const initialResp: Record<string, any> = {};
      const initialFlags: Record<string, boolean> = {};

      if (Array.isArray(data.savedResponses)) {
        data.savedResponses.forEach((r: ExamQuestionResponse) => {
          initialResp[r.questionId] = r.response;
          if (r.flaggedForReview) initialFlags[r.questionId] = true;
        });
      }

      if (typeof window !== 'undefined' && data.session?.id) {
        try {
          const localBackup = localStorage.getItem(`cortex_exam_${data.session.id}_responses`);
          if (localBackup) {
            const parsed = JSON.parse(localBackup);
            Object.keys(parsed).forEach((k) => {
              if (initialResp[k] === undefined) {
                initialResp[k] = parsed[k];
              }
            });
          }
        } catch (err) {
          console.warn('[ExamRunnerModal] Non-fatal local cache restore error:', err);
        }
      }

      setResponses(initialResp);
      setFlaggedQuestions(initialFlags);
      setAutosaveStatus('saved');
      setLastSavedAt(Date.now());

      const serverTime = typeof data.serverTime === 'number' ? data.serverTime : Date.now();
      const expiresAt = data.session.expiresAt;
      serverTimeOffsetRef.current = serverTime - Date.now();
      serverTimeAtSyncRef.current = serverTime;
      clientMonotonicAtSyncRef.current = performance.now();
      expiresAtRef.current = expiresAt;

      const rem = Math.max(0, Math.floor((expiresAt - serverTime) / 1000));
      setRemainingSeconds(rem);

      try {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch (_) {}
    } catch (err: any) {
      setError(err.message || 'Error initializing examination session');
    } finally {
      setIsStarting(false);
      setIsLoading(false);
    }
  }, [classroomId, examId, launchToken]);

  useEffect(() => {
    startSession();
  }, [startSession]);

  // Monotonic timer
  useEffect(() => {
    if (remainingSeconds === null || submissionResult) return;

    timerRef.current = setInterval(() => {
      if (expiresAtRef.current && serverTimeAtSyncRef.current) {
        const elapsed = performance.now() - clientMonotonicAtSyncRef.current;
        const currentServerTime = serverTimeAtSyncRef.current + elapsed;
        const rem = Math.max(0, Math.floor((expiresAtRef.current - currentServerTime) / 1000));
        setRemainingSeconds(rem);

        if (rem <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleAutoSubmitOnExpiry();
        }
      } else if (expiresAtRef.current) {
        const currentServerTime = Date.now() + serverTimeOffsetRef.current;
        const rem = Math.max(0, Math.floor((expiresAtRef.current - currentServerTime) / 1000));
        setRemainingSeconds(rem);

        if (rem <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleAutoSubmitOnExpiry();
        }
      } else {
        setRemainingSeconds((prev) => {
          if (prev === null || prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            handleAutoSubmitOnExpiry();
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [remainingSeconds, submissionResult]);

  // Integrity listeners
  useEffect(() => {
    if (!session || session.status !== 'in_progress' || submissionResult) return;

    const logIntegrityEvent = async (eventType: string, details?: any) => {
      try {
        await fetch(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${session.id}/integrity-event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventType, details }),
        });
      } catch (err) {
        console.warn('[ExamRunnerModal] Non-fatal integrity log error:', err);
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIntegrityWarning('Notice: Fullscreen exit detected and recorded on the examination audit log.');
        logIntegrityEvent('fullscreen_exit');
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIntegrityWarning('Notice: Tab departure or background switch detected and recorded.');
        logIntegrityEvent('tab_hidden');
      }
    };

    const handleWindowBlur = () => {
      logIntegrityEvent('window_blur');
    };

    const handlePaste = (e: ClipboardEvent) => {
      if (exam?.securityLevel === 'restricted' || exam?.securityLevel === 'seb') {
        e.preventDefault();
        setIntegrityWarning('Notice: Clipboard paste action intercepted in Restricted Exam mode.');
        logIntegrityEvent('paste_attempt');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('paste', handlePaste);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('paste', handlePaste);
    };
  }, [session, exam, classroomId, examId, submissionResult]);

  // Periodic heartbeat
  useEffect(() => {
    if (!session || session.status !== 'in_progress' || submissionResult) return;

    const heartbeatInterval = setInterval(async () => {
      if (typeof window !== 'undefined' && !window.navigator.onLine) return;

      try {
        const sebHeaders = await getSebHeaders();
        const res = await fetch(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${session.id}/heartbeat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...sebHeaders,
          },
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data?.expiresAt && data?.serverTime) {
            serverTimeOffsetRef.current = data.serverTime - Date.now();
            expiresAtRef.current = data.expiresAt;
          }
        }
      } catch (err) {
        console.warn('[ExamRunnerModal] Non-fatal heartbeat error:', err);
      }
    }, 15000);

    return () => clearInterval(heartbeatInterval);
  }, [session, classroomId, examId, getSebHeaders, submissionResult]);

  // Sections and visible questions calculation
  const sections: ExamSection[] = useMemo(() => exam?.sections || [], [exam?.sections]);

  const visibleQuestions: ExamQuestion[] = useMemo(() => {
    let list = questions;
    if (selectedSectionId && sections.length > 0) {
      const secQs = questions.filter((q) => q.sectionId === selectedSectionId);
      if (secQs.length > 0) list = secQs;
    }
    if (activeBranchQuestionIds && activeBranchQuestionIds.length > 0) {
      list = list.filter((q) => activeBranchQuestionIds.includes(q.id));
    }
    return list;
  }, [questions, selectedSectionId, sections.length, activeBranchQuestionIds]);

  const currentQ: ExamQuestion | undefined = visibleQuestions[currentIndex] || visibleQuestions[0];

  // Palette filtering
  const filteredPaletteQuestions = useMemo(() => {
    return visibleQuestions.map((q, idx) => {
      const isAnswered = responses[q.id] !== undefined && responses[q.id] !== '';
      const isFlagged = !!flaggedQuestions[q.id];
      const isDirty = dirtyQuestions.includes(q.id);
      return { q, idx, isAnswered, isFlagged, isDirty };
    }).filter((item) => {
      if (paletteFilter === 'answered') return item.isAnswered;
      if (paletteFilter === 'flagged') return item.isFlagged;
      if (paletteFilter === 'unanswered') return !item.isAnswered;
      return true;
    });
  }, [visibleQuestions, responses, flaggedQuestions, dirtyQuestions, paletteFilter]);

  // Overall Statistics
  const answeredCount = useMemo(() => {
    return visibleQuestions.filter((q) => responses[q.id] !== undefined && responses[q.id] !== '').length;
  }, [visibleQuestions, responses]);

  const flaggedCount = useMemo(() => {
    return visibleQuestions.filter((q) => !!flaggedQuestions[q.id]).length;
  }, [visibleQuestions, flaggedQuestions]);

  const unansweredCount = Math.max(0, visibleQuestions.length - answeredCount);
  const progressPercent = visibleQuestions.length > 0 ? Math.round((answeredCount / visibleQuestions.length) * 100) : 0;

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showSubmitConfirm || submissionResult || !currentQ) return;
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.closest('.monaco-editor')) {
        return;
      }

      if (e.key === 'ArrowRight') {
        setCurrentIndex((prev) => Math.min(visibleQuestions.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentIndex((prev) => Math.max(0, prev - 1));
      } else if (['1', '2', '3', '4', 'a', 'b', 'c', 'd', 'A', 'B', 'C', 'D'].includes(e.key)) {
        if (currentQ.questionType === 'mcq_single' && currentQ.options?.length) {
          const map: Record<string, number> = {
            '1': 0, 'a': 0, 'A': 0,
            '2': 1, 'b': 1, 'B': 1,
            '3': 2, 'c': 2, 'C': 2,
            '4': 3, 'd': 3, 'D': 3,
          };
          const optIdx = map[e.key];
          if (optIdx !== undefined && currentQ.options[optIdx]) {
            handleUpdateAnswer(currentQ.id, currentQ.options[optIdx].id);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSubmitConfirm, submissionResult, currentQ, visibleQuestions.length]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const renderAutosaveIndicator = () => {
    if (autosaveStatus === 'saving') {
      return (
        <span className="flex items-center gap-1.5 text-[#FF9100] font-medium text-xs animate-pulse">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Saving...</span>
        </span>
      );
    }
    if (autosaveStatus === 'retrying') {
      return (
        <span className="flex items-center gap-1.5 text-amber-400 font-medium text-xs animate-pulse">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Retrying save...</span>
        </span>
      );
    }
    if (autosaveStatus === 'offline' || isOffline) {
      return (
        <span className="flex items-center gap-1.5 text-rose-400 font-medium text-xs">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline (saved locally)</span>
        </span>
      );
    }
    if (autosaveStatus === 'reconnected') {
      return (
        <span className="flex items-center gap-1.5 text-cyan-400 font-medium text-xs">
          <Wifi className="w-3.5 h-3.5 animate-pulse" />
          <span>Reconnected, syncing...</span>
        </span>
      );
    }
    if (autosaveStatus === 'failed') {
      return (
        <button
          onClick={processPendingQueue}
          className="flex items-center gap-1 text-red-400 hover:text-red-300 font-semibold text-xs transition"
          title="Click to retry saving"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Save failed (click to retry)</span>
        </button>
      );
    }
    if (autosaveStatus === 'submitting') {
      return (
        <span className="flex items-center gap-1.5 text-cyan-300 font-medium text-xs">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Submission pending...</span>
        </span>
      );
    }
    if (autosaveStatus === 'submitted') {
      return (
        <span className="flex items-center gap-1.5 text-emerald-400 font-medium text-xs">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Submission confirmed</span>
        </span>
      );
    }
    if (lastSavedAt) {
      return (
        <span className="flex items-center gap-1.5 text-emerald-400/90 font-medium text-xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Saved at {new Date(lastSavedAt).toLocaleTimeString()}</span>
        </span>
      );
    }
    return <span className="text-gray-500 text-xs">Ready</span>;
  };

  // Safe Branding Theme Token Resolution
  const branding = exam?.brandingTheme;
  const themePresetId = branding?.themePreset || 'cortex-dark';
  const presetConfig = THEME_PRESETS.find((p) => p.id === themePresetId) || THEME_PRESETS[0];
  const accentColor = branding?.accentColor && validateHexColor(branding.accentColor)
    ? branding.accentColor
    : presetConfig.accent;
  const safeBg = presetConfig.bg && validateHexColor(presetConfig.bg) ? presetConfig.bg : '#08080a';
  const safeCardBg = presetConfig.cardBg && validateHexColor(presetConfig.cardBg) ? presetConfig.cardBg : '#101116';
  const safeBorder = presetConfig.border && validateHexColor(presetConfig.border) ? presetConfig.border : '#242732';

  const themeStyles: Record<string, string> = {
    '--exam-primary-color': accentColor,
    '--exam-accent-color': accentColor,
    '--exam-bg-color': safeBg,
    '--exam-border-color': safeBorder,
    '--exam-accent': accentColor,
    '--exam-bg': safeBg,
    '--exam-card-bg': safeCardBg,
    '--exam-border': safeBorder,
  };

  // Lockdown gate
  if (lockdownRequiredInfo || exam?.securityLevel === 'restricted') {
    return (
      <CortexLockdownPrepModal
        classroomId={classroomId}
        examId={examId}
        examTitle={exam?.title || 'Proctored Examination'}
        durationMinutes={exam?.durationMinutes}
        onClose={onClose}
      />
    );
  }

  // SEB gate
  if (sebRequiredInfo) {
    return (
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="seb-gate-title"
        className="fixed inset-0 z-50 bg-[#08080a] flex items-center justify-center p-4 text-white font-sans"
      >
        <div className="bg-[#101116] border border-rose-900/50 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-center">
          <div className="w-12 h-12 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6" />
          </div>

          <h2 id="seb-gate-title" className="text-base font-bold text-white">
            Safe Exam Browser (SEB) Required
          </h2>

          <p className="text-xs text-gray-400 leading-relaxed">
            This examination is protected with high-integrity kiosk lockdown. Standard web browsers cannot access this assessment. You must launch the examination using Safe Exam Browser.
          </p>

          {sebRequiredInfo.verificationReason && (
            <div className="p-2.5 bg-rose-950/30 border border-rose-900/40 rounded-lg text-left text-[11px] text-rose-300">
              <span className="font-semibold block text-rose-200">Security Gate Notice:</span>
              {sebRequiredInfo.verificationReason}
            </div>
          )}

          <div className="p-3 bg-[#161720] rounded-xl border border-[#242732] text-left text-xs space-y-2">
            <span className="font-semibold text-gray-300 block">Required Setup Steps:</span>
            <ol className="list-decimal pl-4 space-y-1.5 text-gray-400 text-[11px]">
              <li>
                Install Safe Exam Browser on your computer if you have not already{' '}
                <a
                  href={sebRequiredInfo.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#FF9100] hover:underline inline-flex items-center gap-0.5 ml-1 font-semibold"
                >
                  (Download Official Installer)
                </a>.
              </li>
              <li>Click <strong>&quot;Launch in Safe Exam Browser&quot;</strong> to start automatically, or download the configuration file.</li>
              <li>If downloaded, open or double-click the <strong>.seb</strong> file to begin your secure session.</li>
              <li>If already running inside Safe Exam Browser, click <strong>&quot;Retry Verification&quot;</strong> below.</li>
            </ol>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
            {sebRequiredInfo.protocolUri && (
              <a
                href={sebRequiredInfo.protocolUri}
                className="w-full sm:w-auto px-4 py-2 bg-[#FF9100] hover:bg-[#e08000] text-black font-bold text-xs rounded-lg transition shadow-md flex items-center justify-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Launch in Safe Exam Browser</span>
              </a>
            )}
            <a
              href={`${sebRequiredInfo.configUrl}${sebRequiredInfo.configUrl.includes('?') ? '&' : '?'}format=plist`}
              download
              className="w-full sm:w-auto px-4 py-2 bg-[#1b1c24] hover:bg-[#252732] text-gray-200 border border-[#2c2f3b] text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .seb Configuration</span>
            </a>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => startSession()}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Verification</span>
            </button>
            <span className="text-gray-600">|</span>
            <button
              onClick={onClose}
              className="text-xs text-gray-500 hover:text-gray-300 transition"
            >
              Return to Classroom
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={themeStyles as React.CSSProperties}
      className="fixed inset-0 z-50 bg-[#08080a] flex flex-col overflow-hidden text-white font-sans select-none"
    >
      {/* 1. Top Linear Completion Progress Bar */}
      <div className="h-1 w-full bg-[#181920] shrink-0">
        <div
          className="h-full bg-gradient-to-r from-[#FF9100] to-emerald-400 transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* 2. Standardized Assessment Top Navigation Bar */}
      <header className="h-14 px-4 bg-[#0d0e12] border-b border-[#20222a] flex items-center justify-between shrink-0 gap-4">
        {/* Left: Branding & Candidate Metadata */}
        <div className="flex items-center gap-3 min-w-0">
          {branding?.institutionLogoUrl ? (
            <img
              src={branding.institutionLogoUrl}
              alt={branding.institutionName || 'Institution'}
              className="h-7 max-w-[110px] object-contain rounded shrink-0"
            />
          ) : (
            <div className="p-1.5 rounded-lg bg-[#FF9100]/10 border border-[#FF9100]/30 text-[#FF9100] shrink-0">
              <Award className="w-4 h-4" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xs sm:text-sm font-bold text-white truncate max-w-[200px] sm:max-w-xs">
                {exam?.title || 'Examination'}
              </h1>
              {branding?.institutionName && (
                <span className="hidden md:inline-block text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 font-medium">
                  {branding.institutionName}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-gray-400 truncate">
              <span className="truncate">Candidate: <strong className="text-gray-200">{currentUser.name}</strong></span>
              <span className="text-gray-600">•</span>
              {renderAutosaveIndicator()}
            </div>
          </div>
        </div>

        {/* Center: Sections Switcher Pills (If Sections Exist) */}
        {sections.length > 1 && (
          <div className="hidden lg:flex items-center gap-1 p-1 bg-[#121318] border border-[#20222a] rounded-lg">
            {sections.map((sec) => (
              <button
                key={sec.id}
                onClick={() => {
                  setSelectedSectionId(sec.id);
                  setCurrentIndex(0);
                }}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition ${
                  selectedSectionId === sec.id
                    ? 'bg-[#FF9100] text-black font-bold shadow'
                    : 'text-gray-400 hover:text-white hover:bg-[#1c1d24]'
                }`}
              >
                {sec.title}
              </button>
            ))}
          </div>
        )}

        {/* Right: Digital Timer, Palette Toggle & Final Submit Button */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Authoritative Monotonic Countdown Clock */}
          {remainingSeconds !== null && !submissionResult && (
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono font-bold text-xs sm:text-sm transition ${
                remainingSeconds < 120
                  ? 'bg-rose-950/60 text-rose-300 border-rose-700 animate-pulse'
                  : remainingSeconds < 300
                  ? 'bg-amber-950/40 text-amber-300 border-amber-700'
                  : 'bg-[#14151b] text-white border-[#272934]'
              }`}
              title="Authoritative Server Synchronized Time Remaining"
            >
              <Clock className={`w-3.5 h-3.5 ${remainingSeconds < 300 ? 'text-amber-400' : 'text-[#FF9100]'}`} />
              <span>{formatTimer(remainingSeconds)}</span>
            </div>
          )}

          {/* Toggle Question Palette (Sidebar) */}
          <button
            onClick={() => setIsPaletteCollapsed((prev) => !prev)}
            className="h-8 px-2 rounded-lg bg-[#14151b] hover:bg-[#1e2028] text-gray-300 hover:text-white border border-[#252732] text-xs font-medium transition flex items-center gap-1"
            title={isPaletteCollapsed ? 'Expand Question Palette' : 'Collapse Question Palette'}
          >
            {isPaletteCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            <span className="hidden sm:inline">{answeredCount}/{visibleQuestions.length}</span>
          </button>

          {!submissionResult && (
            <button
              onClick={() => {
                setConfirmAgreement(false);
                setShowSubmitConfirm(true);
              }}
              disabled={isSubmittingFinal}
              className="h-8 px-3.5 rounded-lg bg-[#FF9100] hover:bg-[#e08000] text-black font-bold text-xs transition flex items-center gap-1.5 shadow-md shadow-[#FF9100]/10 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit</span>
            </button>
          )}

          {submissionResult && (
            <button
              onClick={onClose}
              className="h-8 px-4 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-semibold"
            >
              Close & Exit
            </button>
          )}
        </div>
      </header>

      {/* Network Alert Notification */}
      {(isOffline || autosaveStatus === 'offline') && !offlineNoticeDismissed && !submissionResult && (
        <div className="px-4 py-2 bg-rose-950/90 border-b border-rose-800 text-rose-200 text-xs flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              <strong>Offline Mode:</strong> Internet disconnected. Responses are securely cached in local storage and will sync automatically once online.
            </span>
          </div>
          <button
            onClick={() => setOfflineNoticeDismissed(true)}
            className="text-rose-400 hover:text-white text-[11px] font-semibold ml-3 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Integrity Violation Warning Banner */}
      {integrityWarning && !submissionResult && (
        <div className="px-4 py-1.5 bg-amber-950/70 border-b border-amber-800/80 text-amber-200 text-xs flex items-center justify-between shrink-0">
          <span className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            {integrityWarning}
          </span>
          <button
            onClick={() => setIntegrityWarning(null)}
            className="text-amber-400 hover:text-white text-[11px] font-bold"
          >
            Acknowledge
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-[#FF9100] animate-spin" />
          <p className="text-xs text-gray-400">Loading secure examination environment...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
          <div className="p-3 bg-red-950/50 border border-red-800 rounded-full text-red-400">
            <AlertCircle className="w-8 h-8" />
          </div>
          <p className="text-sm font-semibold text-red-300 max-w-md text-center">{error}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => startSession()}
              className="px-4 py-2 bg-[#FF9100] text-black font-bold text-xs rounded-lg hover:bg-[#e08000] transition"
            >
              Retry Connection
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 rounded-lg text-xs hover:bg-gray-700 text-white"
            >
              Return to Classroom
            </button>
          </div>
        </div>
      )}

      {/* 3. Completed Submission Scorecard */}
      {submissionResult && (
        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-[#111216] border border-[#22242c] rounded-2xl p-6 shadow-2xl space-y-5 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-950/70 border border-emerald-700 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle className="w-9 h-9" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-white">Examination Submitted Successfully</h2>
              <p className="text-xs text-gray-400 mt-1">
                Your examination session has been sealed and recorded on the server.
              </p>
            </div>

            {/* Score Summary Box (If Available) */}
            {submissionResult.autoScore !== null && submissionResult.autoScore !== undefined && (
              <div className="p-4 bg-[#16171d] border border-[#262832] rounded-xl space-y-2">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">Official Score</span>
                <div className="text-3xl font-extrabold text-[#FF9100]">
                  {submissionResult.autoScore}{' '}
                  <span className="text-sm text-gray-400 font-normal">/ {submissionResult.totalMarks || exam?.totalMarks}</span>
                </div>
                {submissionResult.passed !== null && (
                  <div
                    className={`inline-block px-3 py-0.5 rounded-full text-xs font-bold ${
                      submissionResult.passed
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-rose-950 text-rose-400 border border-rose-800'
                    }`}
                  >
                    {submissionResult.passed ? 'PASSED' : 'NEEDS IMPROVEMENT'}
                  </div>
                )}
              </div>
            )}

            {/* Submission Receipt Details */}
            <div className="p-3 bg-[#0d0e12] border border-[#1e2026] rounded-xl text-left text-[11px] space-y-1.5 text-gray-400 font-mono">
              <div className="flex justify-between">
                <span>Timestamp:</span>
                <span className="text-white">{new Date(submissionResult.submittedAt || Date.now()).toLocaleTimeString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Receipt Token:</span>
                <span className="text-cyan-400 truncate max-w-[180px]">
                  {session?.submissionReceipt || session?.id?.slice(0, 16) || 'CTX-REC-OK'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Answered Questions:</span>
                <span className="text-emerald-400 font-bold">{answeredCount} of {visibleQuestions.length}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              {(exam?.securityLevel === 'seb' || (typeof window !== 'undefined' && (window as any).SafeExamBrowser)) && (
                <button
                  onClick={() => {
                    const quitUrl = (exam as any)?.quitUrl || (exam as any)?.quitURL || `/classroom/${encodeURIComponent(classroomId)}?sebQuit=true`;
                    window.location.href = quitUrl;
                  }}
                  className="w-full sm:w-auto px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Exit Safe Exam Browser</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2 rounded-lg bg-[#FF9100] text-black font-bold text-xs hover:bg-[#e08000] transition shadow"
              >
                Return to Classroom Hub
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Main Examination Cockpit (Palette + Interactive Workspace) */}
      {!isLoading && !error && !submissionResult && currentQ && (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* A. Left Interactive Question Palette */}
          {!isPaletteCollapsed && (
            <aside className="w-full md:w-72 bg-[#0c0d10] border-r border-[#1e2026] flex flex-col shrink-0 overflow-hidden">
              {/* Palette Header & Filter Bar */}
              <div className="p-3.5 border-b border-[#1c1d24] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                    <ListChecks className="w-3.5 h-3.5 text-[#FF9100]" />
                    Question Palette
                  </span>
                  <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                    {answeredCount}/{visibleQuestions.length} Answered
                  </span>
                </div>

                {/* Filter Pills */}
                <div className="grid grid-cols-4 gap-1 p-1 bg-[#121318] border border-[#22242c] rounded-lg text-[10px]">
                  <button
                    onClick={() => setPaletteFilter('all')}
                    className={`py-1 rounded text-center font-medium transition ${
                      paletteFilter === 'all' ? 'bg-[#FF9100] text-black font-bold' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    All ({visibleQuestions.length})
                  </button>
                  <button
                    onClick={() => setPaletteFilter('answered')}
                    className={`py-1 rounded text-center font-medium transition ${
                      paletteFilter === 'answered' ? 'bg-emerald-600 text-white font-bold' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Ans ({answeredCount})
                  </button>
                  <button
                    onClick={() => setPaletteFilter('flagged')}
                    className={`py-1 rounded text-center font-medium transition ${
                      paletteFilter === 'flagged' ? 'bg-amber-600 text-white font-bold' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Rev ({flaggedCount})
                  </button>
                  <button
                    onClick={() => setPaletteFilter('unanswered')}
                    className={`py-1 rounded text-center font-medium transition ${
                      paletteFilter === 'unanswered' ? 'bg-rose-900 text-rose-200 font-bold' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Unans ({unansweredCount})
                  </button>
                </div>
              </div>

              {/* Palette Buttons Grid */}
              <div className="flex-1 overflow-y-auto p-3.5">
                <div className="grid grid-cols-5 gap-2">
                  {filteredPaletteQuestions.map(({ q, idx, isAnswered, isFlagged, isDirty }) => {
                    const isActive = currentIndex === idx;

                    let btnStyle = 'bg-[#14151b] text-gray-400 border-[#242732] hover:border-[#383b4c]';
                    if (isActive) {
                      btnStyle = 'bg-[#FF9100] text-black font-extrabold border-[#FF9100] shadow-md shadow-[#FF9100]/20 scale-105';
                    } else if (isFlagged) {
                      btnStyle = 'bg-amber-950/80 text-amber-300 border-amber-700 font-semibold';
                    } else if (isAnswered) {
                      btnStyle = 'bg-emerald-950/80 text-emerald-300 border-emerald-700 font-semibold';
                    }

                    return (
                      <button
                        key={q.id}
                        onClick={() => setCurrentIndex(idx)}
                        className={`h-9 rounded-lg border text-xs font-semibold flex items-center justify-center transition relative ${btnStyle}`}
                        title={`Question ${idx + 1} (${isAnswered ? 'Answered' : 'Unanswered'})`}
                      >
                        <span>{idx + 1}</span>

                        {isFlagged && !isActive && (
                          <Bookmark className="w-2.5 h-2.5 text-amber-400 fill-current absolute top-1 right-1" />
                        )}
                        {isDirty && !isActive && (
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-amber-400 border border-black absolute top-1 left-1 animate-pulse"
                            title="Syncing..."
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Palette Legend */}
              <div className="p-3 border-t border-[#1a1c22] bg-[#0a0a0d] text-[10px] text-gray-400 space-y-1.5 shrink-0">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-emerald-950 border border-emerald-700 shrink-0" />
                    <span>Answered</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-amber-950 border border-amber-700 shrink-0" />
                    <span>For Review</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-[#FF9100] border border-[#FF9100] shrink-0" />
                    <span>Current</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-[#14151b] border border-[#242732] shrink-0" />
                    <span>Unanswered</span>
                  </div>
                </div>
              </div>
            </aside>
          )}

          {/* B. Main Answering Workspace */}
          <main className="flex-1 flex flex-col overflow-hidden bg-[#090a0d]">
            {/* Question Top Subheader */}
            <div className="px-5 py-3 bg-[#0d0e12] border-b border-[#1c1d22] flex items-center justify-between text-xs text-gray-400 shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white text-sm">
                  Question {currentIndex + 1}
                  <span className="text-gray-500 font-normal ml-1">of {visibleQuestions.length}</span>
                </span>
                <span className="px-2 py-0.5 rounded bg-[#161720] text-gray-300 text-[10px] font-semibold border border-[#282a36]">
                  {currentQ.questionType.toUpperCase().replace('_', ' ')}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 text-[10px] font-semibold border border-emerald-800">
                  +{currentQ.points} {currentQ.points === 1 ? 'Mark' : 'Marks'}
                </span>
                {currentQ.negativeMarks > 0 && (
                  <span className="px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 text-[10px] font-semibold border border-rose-800">
                    -{currentQ.negativeMarks} Wrong
                  </span>
                )}
                {dirtyQuestions.includes(currentQ.id) && (
                  <span className="text-amber-400 font-mono text-[10px] animate-pulse">Syncing...</span>
                )}
              </div>

              {/* Action Buttons: Clear & Mark for Review */}
              <div className="flex items-center gap-2">
                {responses[currentQ.id] !== undefined && responses[currentQ.id] !== '' && (
                  <button
                    onClick={() => handleClearAnswer(currentQ.id)}
                    className="px-2.5 py-1 rounded-lg text-xs text-gray-400 hover:text-rose-400 hover:bg-rose-950/20 border border-transparent hover:border-rose-900 transition flex items-center gap-1"
                    title="Clear response for this question"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Clear Answer</span>
                  </button>
                )}

                <button
                  onClick={() => toggleFlagReview(currentQ.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    flaggedQuestions[currentQ.id]
                      ? 'bg-amber-950/80 text-amber-300 border border-amber-600'
                      : 'bg-[#14151b] text-gray-400 hover:text-white border border-[#272934]'
                  }`}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${flaggedQuestions[currentQ.id] ? 'fill-current' : ''}`} />
                  <span>{flaggedQuestions[currentQ.id] ? 'Marked for Review' : 'Mark for Review'}</span>
                </button>
              </div>
            </div>

            {/* Question Body: Theory/Standard Questions vs. Split-Screen Coding Workbench */}
            {currentQ.questionType === 'programming' ? (
              /* Split-Screen 50/50 Programming Workbench */
              <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* Left Split: Problem Specs & Sample Test Cases */}
                <div className="w-full lg:w-1/2 p-5 overflow-y-auto border-b lg:border-b-0 lg:border-r border-[#1c1d22] space-y-4">
                  <div className="p-4 bg-[#111216] border border-[#22242c] rounded-xl space-y-3">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Problem Description</span>
                    <p className="text-sm text-gray-100 font-medium whitespace-pre-wrap leading-relaxed">
                      {currentQ.promptText}
                    </p>
                  </div>

                  {/* Sample Test Cases (If Available) */}
                  {currentQ.testCases && currentQ.testCases.filter((tc) => !tc.isHidden).length > 0 && (
                    <div className="space-y-3">
                      <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-[#FF9100]" />
                        Sample Test Cases
                      </span>

                      {currentQ.testCases.filter((tc) => !tc.isHidden).map((tc, idx) => (
                        <div key={tc.id || idx} className="p-3 bg-[#111216] border border-[#22242c] rounded-xl space-y-2 text-xs font-mono">
                          <div className="flex items-center justify-between text-gray-400">
                            <span>Case {idx + 1}</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(tc.input);
                                setCopiedIndex(idx);
                                setTimeout(() => setCopiedIndex(null), 2000);
                              }}
                              className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1 font-sans"
                            >
                              <Copy className="w-3 h-3" />
                              <span>{copiedIndex === idx ? 'Copied' : 'Copy Input'}</span>
                            </button>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-500 uppercase font-sans">Input:</span>
                            <pre className="p-2 bg-[#090a0d] rounded border border-[#1d1f28] text-gray-200 mt-1 whitespace-pre-wrap">
                              {tc.input || '(empty)'}
                            </pre>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-500 uppercase font-sans">Expected Output:</span>
                            <pre className="p-2 bg-[#090a0d] rounded border border-[#1d1f28] text-emerald-400 mt-1 whitespace-pre-wrap">
                              {tc.expectedOutput || '(empty)'}
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right Split: Monaco Editor + Execution Console */}
                <div className="w-full lg:w-1/2 flex flex-col overflow-hidden bg-[#0d0e12]">
                  {/* Editor Sub-header */}
                  <div className="px-4 py-2 bg-[#121318] border-b border-[#202228] flex items-center justify-between text-xs">
                    <span className="text-gray-300 font-mono flex items-center gap-1.5">
                      <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                      Runtime: <strong className="text-white uppercase">{currentQ.language || 'python'}</strong>
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (currentQ.initialCode) {
                            handleUpdateAnswer(currentQ.id, currentQ.initialCode);
                          }
                        }}
                        className="px-2.5 py-1 rounded bg-[#181920] hover:bg-[#20222a] text-gray-400 hover:text-white text-xs flex items-center gap-1 border border-[#2a2d36] transition"
                        title="Reset code to initial boilerplate template"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset Code</span>
                      </button>

                      <button
                        onClick={() =>
                          handleRunSampleCode(
                            responses[currentQ.id] !== undefined ? responses[currentQ.id] : currentQ.initialCode || '',
                            currentQ.language || 'python'
                          )
                        }
                        disabled={isRunningSample}
                        className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs flex items-center gap-1.5 shadow transition disabled:opacity-50"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>{isRunningSample ? 'Compiling...' : 'Run Code'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Monaco Code Editor */}
                  <div className="flex-1 min-h-[280px]">
                    <MonacoEditor
                      height="100%"
                      language={currentQ.language || 'python'}
                      theme="vs-dark"
                      value={responses[currentQ.id] !== undefined ? responses[currentQ.id] : currentQ.initialCode || ''}
                      onChange={(val) => handleUpdateAnswer(currentQ.id, val || '')}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 2,
                      }}
                    />
                  </div>

                  {/* Interactive Execution Output / Custom Stdin Drawer */}
                  <div className="h-44 border-t border-[#202228] bg-[#090a0d] flex flex-col shrink-0">
                    <div className="flex items-center px-3 bg-[#111216] border-b border-[#202228] text-xs">
                      <button
                        onClick={() => setActiveCodeTab('output')}
                        className={`py-1.5 px-3 border-b-2 font-semibold transition ${
                          activeCodeTab === 'output' ? 'border-[#FF9100] text-[#FF9100]' : 'border-transparent text-gray-400 hover:text-white'
                        }`}
                      >
                        Execution Output
                      </button>
                      <button
                        onClick={() => setActiveCodeTab('custom')}
                        className={`py-1.5 px-3 border-b-2 font-semibold transition ${
                          activeCodeTab === 'custom' ? 'border-[#FF9100] text-[#FF9100]' : 'border-transparent text-gray-400 hover:text-white'
                        }`}
                      >
                        Custom Stdin
                      </button>
                    </div>

                    <div className="flex-1 p-3 overflow-y-auto text-xs font-mono">
                      {activeCodeTab === 'output' ? (
                        sampleOutput ? (
                          <pre className="text-gray-200 whitespace-pre-wrap leading-relaxed">{sampleOutput}</pre>
                        ) : (
                          <span className="text-gray-500 italic">Click &quot;Run Code&quot; to test your solution against test inputs.</span>
                        )
                      ) : (
                        <textarea
                          value={customStdin}
                          onChange={(e) => setCustomStdin(e.target.value)}
                          placeholder="Provide custom standard input for testing..."
                          className="w-full h-full bg-transparent text-white focus:outline-none resize-none placeholder-gray-600"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Standard Theory & Multiple Choice Question Form */
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 max-w-4xl mx-auto w-full">
                {/* Question Statement Box */}
                <div className="p-5 bg-[#111216] border border-[#22242c] rounded-2xl shadow-sm space-y-4">
                  <p className="text-sm sm:text-base text-gray-100 font-medium whitespace-pre-wrap leading-relaxed">
                    {currentQ.promptText}
                  </p>

                  {/* Media attachment if present */}
                  {currentQ.promptMediaUrl && (
                    <div className="pt-2">
                      <img
                        src={currentQ.promptMediaUrl}
                        alt="Question Diagram"
                        className="max-h-72 rounded-xl border border-[#282a36] object-contain"
                      />
                    </div>
                  )}
                </div>

                {/* 1. Single Choice MCQ Options */}
                {currentQ.questionType === 'mcq_single' && (
                  <div className="space-y-3">
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                      Select One Option (or press A-D / 1-4 on keyboard):
                    </span>
                    <div className="space-y-2.5">
                      {(currentQ.options || []).map((opt, optIdx) => {
                        const letter = String.fromCharCode(65 + optIdx);
                        const isSelected = responses[currentQ.id] === opt.id;

                        return (
                          <div
                            key={opt.id}
                            onClick={() => handleUpdateAnswer(currentQ.id, opt.id)}
                            className={`p-4 rounded-xl border text-xs sm:text-sm flex items-center gap-3.5 cursor-pointer transition transform hover:-translate-y-0.5 ${
                              isSelected
                                ? 'bg-[#FF9100]/15 border-[#FF9100] text-white font-semibold shadow-md shadow-[#FF9100]/10'
                                : 'bg-[#111216] border-[#22242c] text-gray-300 hover:border-[#333644] hover:bg-[#14151c]'
                            }`}
                          >
                            <div
                              className={`w-6 h-6 rounded-lg border text-xs font-bold flex items-center justify-center shrink-0 transition ${
                                isSelected
                                  ? 'border-[#FF9100] bg-[#FF9100] text-black'
                                  : 'border-gray-600 bg-[#171820] text-gray-400'
                              }`}
                            >
                              {letter}
                            </div>
                            <span className="flex-1 leading-relaxed">{opt.text}</span>
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                isSelected ? 'border-[#FF9100]' : 'border-gray-600'
                              }`}
                            >
                              {isSelected && <div className="w-2 h-2 rounded-full bg-[#FF9100]" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. Multiple Choice Options */}
                {currentQ.questionType === 'mcq_multiple' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                        Select All That Apply:
                      </span>
                      <span className="text-[10px] text-cyan-400 bg-cyan-950/60 border border-cyan-800 px-2 py-0.5 rounded-full font-semibold">
                        Multi-Select
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {(currentQ.options || []).map((opt, optIdx) => {
                        const letter = String.fromCharCode(65 + optIdx);
                        const currentSelected: string[] = Array.isArray(responses[currentQ.id])
                          ? responses[currentQ.id]
                          : [];
                        const isSelected = currentSelected.includes(opt.id);

                        return (
                          <div
                            key={opt.id}
                            onClick={() => {
                              const next = isSelected
                                ? currentSelected.filter((id) => id !== opt.id)
                                : [...currentSelected, opt.id];
                              handleUpdateAnswer(currentQ.id, next);
                            }}
                            className={`p-4 rounded-xl border text-xs sm:text-sm flex items-center gap-3.5 cursor-pointer transition transform hover:-translate-y-0.5 ${
                              isSelected
                                ? 'bg-[#FF9100]/15 border-[#FF9100] text-white font-semibold shadow-md shadow-[#FF9100]/10'
                                : 'bg-[#111216] border-[#22242c] text-gray-300 hover:border-[#333644] hover:bg-[#14151c]'
                            }`}
                          >
                            <div
                              className={`w-6 h-6 rounded-lg border text-xs font-bold flex items-center justify-center shrink-0 transition ${
                                isSelected
                                  ? 'border-[#FF9100] bg-[#FF9100] text-black'
                                  : 'border-gray-600 bg-[#171820] text-gray-400'
                              }`}
                            >
                              {letter}
                            </div>
                            <span className="flex-1 leading-relaxed">{opt.text}</span>
                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                isSelected ? 'border-[#FF9100] bg-[#FF9100]' : 'border-gray-600'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 text-black stroke-[3]" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. True / False */}
                {currentQ.questionType === 'true_false' && (
                  <div className="space-y-3">
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                      Choose True or False:
                    </span>
                    <div className="grid grid-cols-2 gap-4 max-w-md">
                      {[true, false].map((val) => {
                        const isSelected = responses[currentQ.id] === val;
                        return (
                          <div
                            key={String(val)}
                            onClick={() => handleUpdateAnswer(currentQ.id, val)}
                            className={`p-5 rounded-2xl border text-center text-sm font-bold cursor-pointer transition transform hover:-translate-y-0.5 ${
                              isSelected
                                ? val
                                  ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-950/40'
                                  : 'bg-rose-950/60 border-rose-500 text-rose-300 shadow-lg shadow-rose-950/40'
                                : 'bg-[#111216] border-[#22242c] text-gray-300 hover:border-[#333644]'
                            }`}
                          >
                            <div className="text-lg mb-1">{val ? '✓' : '✕'}</div>
                            <span>{val ? 'TRUE' : 'FALSE'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 4. Numerical Response */}
                {currentQ.questionType === 'numerical' && (
                  <div className="space-y-2 max-w-sm">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                      Enter Numerical Value:
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={responses[currentQ.id] !== undefined ? responses[currentQ.id] : ''}
                      onChange={(e) => handleUpdateAnswer(currentQ.id, e.target.value)}
                      placeholder="e.g. 42.5"
                      className="w-full px-4 py-3 bg-[#111216] border border-[#262832] rounded-xl text-sm font-mono text-white focus:outline-none focus:border-[#FF9100] transition"
                    />
                    {currentQ.numericalTolerance > 0 && (
                      <span className="text-[11px] text-gray-500">
                        Accepted tolerance: ±{currentQ.numericalTolerance}
                      </span>
                    )}
                  </div>
                )}

                {/* 5. Short Answer */}
                {currentQ.questionType === 'short_answer' && (
                  <div className="space-y-2 max-w-lg">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                      Type Your Answer:
                    </label>
                    <input
                      type="text"
                      value={responses[currentQ.id] || ''}
                      onChange={(e) => handleUpdateAnswer(currentQ.id, e.target.value)}
                      placeholder="Enter concise response..."
                      className="w-full px-4 py-3 bg-[#111216] border border-[#262832] rounded-xl text-sm text-white focus:outline-none focus:border-[#FF9100] transition"
                    />
                  </div>
                )}
              </div>
            )}

            {/* 5. Assessment Action Navigation Footer */}
            <footer className="p-4 bg-[#0d0e12] border-t border-[#1c1d22] flex items-center justify-between shrink-0">
              <button
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="px-4 py-2 rounded-xl bg-[#14151b] hover:bg-[#1f2028] text-xs font-semibold text-gray-300 disabled:opacity-30 flex items-center gap-1.5 border border-[#252732] transition"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (!flaggedQuestions[currentQ.id]) {
                      toggleFlagReview(currentQ.id);
                    }
                    setCurrentIndex((prev) => Math.min(visibleQuestions.length - 1, prev + 1));
                  }}
                  className="hidden sm:flex px-3.5 py-2 rounded-xl bg-[#181920] hover:bg-[#20222a] text-xs font-semibold text-amber-300 border border-amber-900/40 transition items-center gap-1"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Review & Next</span>
                </button>

                {currentIndex < visibleQuestions.length - 1 ? (
                  <button
                    onClick={() => setCurrentIndex((prev) => Math.min(visibleQuestions.length - 1, prev + 1))}
                    className="px-5 py-2 rounded-xl bg-[#FF9100] hover:bg-[#e08000] text-black font-bold text-xs transition flex items-center gap-1.5 shadow-md shadow-[#FF9100]/10"
                  >
                    <span>Save & Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setConfirmAgreement(false);
                      setShowSubmitConfirm(true);
                    }}
                    className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs transition flex items-center gap-1.5 shadow-md"
                  >
                    <Send className="w-4 h-4" />
                    <span>Review & Finalize</span>
                  </button>
                )}
              </div>
            </footer>
          </main>
        </div>
      )}

      {/* 6. Comprehensive Review & Submission Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111216] border border-[#282a36] rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#20222a] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-[#FF9100]" />
                Examination Submission Summary
              </h3>
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="text-gray-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Assessment Metrics Matrix Cards */}
            <div className="grid grid-cols-4 gap-2.5 text-center">
              <div className="p-3 bg-[#161720] border border-[#262834] rounded-xl">
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">Total</span>
                <span className="text-lg font-bold text-white">{visibleQuestions.length}</span>
              </div>
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl">
                <span className="text-[10px] text-emerald-400 uppercase font-semibold block">Answered</span>
                <span className="text-lg font-bold text-emerald-300">{answeredCount}</span>
              </div>
              <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl">
                <span className="text-[10px] text-rose-400 uppercase font-semibold block">Unanswered</span>
                <span className="text-lg font-bold text-rose-300">{unansweredCount}</span>
              </div>
              <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl">
                <span className="text-[10px] text-amber-400 uppercase font-semibold block">Marked Review</span>
                <span className="text-lg font-bold text-amber-300">{flaggedCount}</span>
              </div>
            </div>

            {/* Unanswered Questions Warning */}
            {unansweredCount > 0 && (
              <div className="p-3 bg-rose-950/30 border border-rose-900/50 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  Warning: You still have <strong>{unansweredCount} unanswered questions</strong>. Click any question pill below to review and answer.
                </span>
              </div>
            )}

            {/* Interactive Jump Grid */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                Questions Status Grid (Click to review):
              </span>
              <div className="grid grid-cols-10 gap-1.5 max-h-36 overflow-y-auto p-1">
                {visibleQuestions.map((q, idx) => {
                  const isAns = responses[q.id] !== undefined && responses[q.id] !== '';
                  const isFlag = !!flaggedQuestions[q.id];

                  let pillColor = 'bg-[#181922] text-gray-500 border-[#262836]';
                  if (isFlag) pillColor = 'bg-amber-950 text-amber-300 border-amber-700';
                  else if (isAns) pillColor = 'bg-emerald-950 text-emerald-300 border-emerald-700';
                  else pillColor = 'bg-rose-950/50 text-rose-300 border-rose-800';

                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        setCurrentIndex(idx);
                        setShowSubmitConfirm(false);
                      }}
                      className={`h-7 rounded text-[11px] font-bold border transition ${pillColor}`}
                      title={`Jump to Question ${idx + 1}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Agreement Confirmation Checkbox */}
            <label className="flex items-start gap-2.5 p-3 bg-[#161720] border border-[#262834] rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={confirmAgreement}
                onChange={(e) => setConfirmAgreement(e.target.checked)}
                className="mt-0.5 rounded border-gray-600 text-[#FF9100] focus:ring-0 shrink-0"
              />
              <span className="text-xs text-gray-300 leading-relaxed">
                I confirm that I have reviewed my responses. I understand that once submitted, this assessment will be permanently locked for evaluation.
              </span>
            </label>

            {/* Dialog Actions */}
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                disabled={isSubmittingFinal}
                className="px-4 py-2 bg-[#181920] hover:bg-[#20222a] rounded-xl text-xs font-semibold text-gray-300 border border-[#2a2d36] transition"
              >
                Return to Exam
              </button>
              <button
                onClick={handleFinalSubmit}
                disabled={!confirmAgreement || isSubmittingFinal}
                className="px-5 py-2 bg-[#FF9100] hover:bg-[#e08000] text-black font-bold text-xs rounded-xl flex items-center gap-1.5 shadow transition disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmittingFinal ? 'Submitting...' : 'Confirm Final Submission'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
