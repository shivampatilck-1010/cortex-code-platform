'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'lucide-react';
import { Exam, ExamQuestion, ExamQuestionResponse, ExamSession } from '@/lib/classroom/models';
import dynamic from 'next/dynamic';
import { CortexLockdownPrepModal } from './CortexLockdownPrepModal';

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

interface ExamRunnerModalProps {
  classroomId: string;
  examId: string;
  currentUser: { id: string; name: string; email: string };
  onClose: () => void;
}

export function ExamRunnerModal({ classroomId, examId, currentUser, onClose }: ExamRunnerModalProps) {
  const [exam, setExam] = useState<Exam | null>(null);
  const [session, setSession] = useState<ExamSession | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [activeBranchQuestionIds, setActiveBranchQuestionIds] = useState<string[] | null>(null);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [currentIndex, setCurrentIndex] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sebRequiredInfo, setSebRequiredInfo] = useState<{ downloadUrl: string; configUrl: string } | null>(null);
  const [lockdownRequiredInfo, setLockdownRequiredInfo] = useState<{ downloadUrl: string; launchUrl: string } | null>(null);

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
  const [submissionResult, setSubmissionResult] = useState<any | null>(null);

  // Programming sample run output state
  const [sampleOutput, setSampleOutput] = useState<string | null>(null);
  const [isRunningSample, setIsRunningSample] = useState(false);

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

      // Authoritative time resynchronization with server
      if (session) {
        fetch(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${session.id}/heartbeat`, {
          method: 'POST',
        })
          .then((res) => res.json())
          .then((data) => {
            if (data?.expiresAt) {
              const now = Date.now();
              const rem = Math.max(0, Math.floor((data.expiresAt - now) / 1000));
              setRemainingSeconds(rem);
            }
          })
          .catch(() => {});
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
  }, [classroomId, examId, session]);

  // Start or resume examination session
  useEffect(() => {
    async function startSession() {
      try {
        setIsStarting(true);
        setError(null);

        const res = await fetch(`/api/v1/classrooms/${classroomId}/exams/${examId}/start`, {
          method: 'POST',
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (data.sebRequired) {
            setSebRequiredInfo({
              downloadUrl: data.downloadUrl || 'https://safeexambrowser.org',
              configUrl: data.configUrl || `/api/v1/classrooms/${classroomId}/exams/${examId}/seb-config`,
            });
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
            } catch (_) {}

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
        setQuestions(data.exam?.questions || []);

        // Load existing saved responses if session was resumed
        const initialResp: Record<string, any> = {};
        const initialFlags: Record<string, boolean> = {};

        if (Array.isArray(data.savedResponses)) {
          data.savedResponses.forEach((r: ExamQuestionResponse) => {
            initialResp[r.questionId] = r.response;
            if (r.flaggedForReview) initialFlags[r.questionId] = true;
          });
        }

        // Check local storage backup if available
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
          } catch (_) {}
        }

        setResponses(initialResp);
        setFlaggedQuestions(initialFlags);
        setAutosaveStatus('saved');
        setLastSavedAt(Date.now());

        // Compute remaining seconds from server expiresAt
        const now = Date.now();
        const rem = Math.max(0, Math.floor((data.session.expiresAt - now) / 1000));
        setRemainingSeconds(rem);

        // Request browser fullscreen if supported and permitted
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
    }

    startSession();
  }, [classroomId, examId]);

  // Countdown timer effect
  useEffect(() => {
    if (remainingSeconds === null || remainingSeconds <= 0 || submissionResult) return;

    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timerRef.current!);
          handleAutoSubmitOnExpiry();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [remainingSeconds, submissionResult]);

  // Integrity Event Monitoring
  useEffect(() => {
    if (!session || session.status !== 'in_progress' || submissionResult) return;

    const logIntegrityEvent = async (eventType: string, details?: any) => {
      try {
        await fetch(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${session.id}/integrity-event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventType, details }),
        });
      } catch (_) {}
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

  // Heartbeat tracking
  useEffect(() => {
    if (!session || session.status !== 'in_progress' || submissionResult) return;

    const heartbeatInterval = setInterval(async () => {
      if (typeof window !== 'undefined' && !window.navigator.onLine) return;

      try {
        const res = await fetch(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${session.id}/heartbeat`, {
          method: 'POST',
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data?.expiresAt) {
            const now = Date.now();
            const rem = Math.max(0, Math.floor((data.expiresAt - now) / 1000));
            setRemainingSeconds(rem);
          }
        }
      } catch (_) {}
    }, 25000);

    return () => clearInterval(heartbeatInterval);
  }, [session, classroomId, examId, submissionResult]);

  // Core Queue Processing for Autosave
  const processPendingQueue = useCallback(async () => {
    if (!session) return;
    if (pendingQueueRef.current.size === 0) {
      setAutosaveStatus('saved');
      setLastSavedAt((prev) => prev || Date.now());
      return;
    }

    if (typeof window !== 'undefined' && !window.navigator.onLine) {
      setAutosaveStatus('offline');
      return;
    }

    setAutosaveStatus('saving');

    const entries = Array.from(pendingQueueRef.current.entries());

    for (const [qId, item] of entries) {
      try {
        const res = await fetch(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${session.id}/responses`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId: qId,
            response: item.val,
            flaggedForReview: item.flagged,
          }),
        });

        if (!res.ok) {
          throw new Error('Save request failed with status ' + res.status);
        }

        const respData = await res.json().catch(() => ({}));
        if (respData.routeInfo?.activeQuestionIds) {
          setActiveBranchQuestionIds(respData.routeInfo.activeQuestionIds);
        }

        // Remove from queue only if no newer edit came in
        const currentInQueue = pendingQueueRef.current.get(qId);
        if (currentInQueue && currentInQueue.seq === item.seq) {
          pendingQueueRef.current.delete(qId);
          setDirtyQuestions((prev) => prev.filter((id) => id !== qId));
        }

        retryCountRef.current = 0;
      } catch (err) {
        // If network failure, schedule retry with backoff
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
  }, [classroomId, examId, session]);

  // Trigger autosave helper
  const scheduleAutosave = (qId: string, answerVal: any, flagged: boolean = false) => {
    if (!session) return;

    seqCounterRef.current += 1;
    pendingQueueRef.current.set(qId, {
      val: answerVal,
      flagged,
      seq: seqCounterRef.current,
    });

    setDirtyQuestions((prev) => (prev.includes(qId) ? prev : [...prev, qId]));

    // Persist to local storage backup immediately
    try {
      if (typeof window !== 'undefined') {
        const currentBackup = JSON.parse(localStorage.getItem(`cortex_exam_${session.id}_responses`) || '{}');
        currentBackup[qId] = answerVal;
        localStorage.setItem(`cortex_exam_${session.id}_responses`, JSON.stringify(currentBackup));
      }
    } catch (_) {}

    if (typeof window !== 'undefined' && !window.navigator.onLine) {
      setAutosaveStatus('offline');
      return;
    }

    setAutosaveStatus('saving');

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      processPendingQueue();
    }, 600);
  };

  const handleUpdateAnswer = (qId: string, val: any) => {
    const updated = { ...responses, [qId]: val };
    setResponses(updated);
    scheduleAutosave(qId, val, !!flaggedQuestions[qId]);
  };

  const toggleFlagReview = (qId: string) => {
    const updated = { ...flaggedQuestions, [qId]: !flaggedQuestions[qId] };
    setFlaggedQuestions(updated);
    scheduleAutosave(qId, responses[qId], updated[qId]);
  };

  // Run sample code against public test cases
  const handleRunSampleCode = async (code: string, lang: string) => {
    setIsRunningSample(true);
    setSampleOutput(null);

    try {
      const res = await fetch('/api/v1/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: lang,
          files: [{ id: 'main', name: 'solution', path: '/solution', content: code }],
          stdin: questions[currentIndex]?.testCases?.find((tc) => !tc.isHidden)?.input || '',
        }),
      });

      const data = await res.json();
      setSampleOutput(data.stdout || data.stderr || 'Code executed with no output.');
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
      const res = await fetch(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${session.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finalResponses: responses }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Submission failed');
      }

      const data = await res.json();
      setSubmissionResult(data.session);
      setShowSubmitConfirm(false);
      setAutosaveStatus('submitted');

      // Clear local storage backup on confirmed submission
      try {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(`cortex_exam_${session.id}_responses`);
        }
      } catch (_) {}
    } catch (err: any) {
      setAutosaveStatus('failed');
      alert(err.message || 'Failed to submit examination');
    } finally {
      setIsSubmittingFinal(false);
    }
  };

  const handleAutoSubmitOnExpiry = () => {
    handleFinalSubmit();
  };

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

  if (sebRequiredInfo) {
    return (
      <div className="fixed inset-0 z-50 bg-[#08080a] flex items-center justify-center p-4 text-white">
        <div className="bg-[#101116] border border-rose-900/50 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-center">
          <div className="w-12 h-12 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-white">Safe Exam Browser (SEB) Required</h2>
          <p className="text-xs text-gray-400 leading-relaxed">
            This examination is configured with high-integrity kiosk lockdown. Standard web browsers cannot access this assessment. You must launch the examination using Safe Exam Browser.
          </p>

          <div className="p-3 bg-[#161720] rounded-xl border border-[#242732] text-left text-xs space-y-2">
            <span className="font-semibold text-gray-300 block">Required Setup Steps:</span>
            <ol className="list-decimal pl-4 space-y-1 text-gray-400 text-[11px]">
              <li>Install Safe Exam Browser on your computer if you have not already.</li>
              <li>Download the official examination configuration (.seb) file.</li>
              <li>Open or double-click the .seb file to enter your secure exam session.</li>
            </ol>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
            <a
              href={sebRequiredInfo.configUrl}
              download
              className="w-full sm:w-auto px-4 py-2 bg-[#FF9100] hover:bg-[#e08000] text-black font-bold text-xs rounded-lg transition"
            >
              Download Exam .seb File
            </a>
            <a
              href={sebRequiredInfo.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-4 py-2 bg-[#1b1c24] hover:bg-[#252732] text-gray-200 border border-[#2c2f3b] text-xs font-semibold rounded-lg transition"
            >
              Get Safe Exam Browser
            </a>
          </div>

          <button
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-gray-300 pt-2 block mx-auto transition"
          >
            Return to Classroom
          </button>
        </div>
      </div>
    );
  }

  const visibleQuestions = activeBranchQuestionIds
    ? questions.filter((q) => activeBranchQuestionIds.includes(q.id))
    : questions;
  const currentQ = visibleQuestions[currentIndex] || visibleQuestions[0];
  const answeredCount = Object.keys(responses).filter((k) => responses[k] !== undefined && responses[k] !== '').length;

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const renderAutosaveIndicator = () => {
    if (autosaveStatus === 'saving') {
      return (
        <span className="flex items-center gap-1.5 text-[#FF9100] font-medium animate-pulse">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Saving...</span>
        </span>
      );
    }
    if (autosaveStatus === 'retrying') {
      return (
        <span className="flex items-center gap-1.5 text-amber-400 font-medium animate-pulse">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Retrying save...</span>
        </span>
      );
    }
    if (autosaveStatus === 'offline' || isOffline) {
      return (
        <span className="flex items-center gap-1.5 text-rose-400 font-medium">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline (saved locally)</span>
        </span>
      );
    }
    if (autosaveStatus === 'reconnected') {
      return (
        <span className="flex items-center gap-1.5 text-cyan-400 font-medium">
          <Wifi className="w-3.5 h-3.5 animate-pulse" />
          <span>Reconnected, syncing...</span>
        </span>
      );
    }
    if (autosaveStatus === 'failed') {
      return (
        <button
          onClick={processPendingQueue}
          className="flex items-center gap-1 text-red-400 hover:text-red-300 font-semibold transition"
          title="Click to retry saving"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Save failed (click to retry)</span>
        </button>
      );
    }
    if (autosaveStatus === 'submitting') {
      return (
        <span className="flex items-center gap-1.5 text-cyan-300 font-medium">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Submission pending...</span>
        </span>
      );
    }
    if (autosaveStatus === 'submitted') {
      return (
        <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Submission confirmed</span>
        </span>
      );
    }
    if (lastSavedAt) {
      return (
        <span className="flex items-center gap-1.5 text-emerald-400/90 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Saved at {new Date(lastSavedAt).toLocaleTimeString()}</span>
        </span>
      );
    }
    return <span className="text-gray-500">Ready</span>;
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#08080a] flex flex-col overflow-hidden text-white font-sans">
      {/* Top Header Bar */}
      <div className="h-14 px-4 bg-[#0d0e12] border-b border-[#20222a] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-[#FF9100]/10 border border-[#FF9100]/30 text-[#FF9100]">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-bold text-white line-clamp-1">{exam?.title || 'Examination'}</h1>
            <div className="flex items-center gap-2.5 text-[11px] text-gray-400">
              <span>Candidate: {currentUser.name}</span>
              <span>Attempt #{session?.attemptNumber || 1}</span>
              <span className="text-gray-600">|</span>
              {renderAutosaveIndicator()}
            </div>
          </div>
        </div>

        {/* Timer & Submit Action */}
        <div className="flex items-center gap-3">
          {remainingSeconds !== null && !submissionResult && (
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border font-mono font-bold text-xs sm:text-sm transition ${
                remainingSeconds < 300
                  ? 'bg-rose-950/50 text-rose-300 border-rose-800 animate-pulse'
                  : 'bg-[#14151b] text-white border-[#272934]'
              }`}
            >
              <Clock className="w-4 h-4 text-[#FF9100]" />
              <span>{formatTimer(remainingSeconds)}</span>
            </div>
          )}

          {!submissionResult && (
            <button
              onClick={() => setShowSubmitConfirm(true)}
              disabled={isSubmittingFinal}
              className="h-8 px-3.5 rounded-lg bg-[#FF9100] hover:bg-[#e08000] text-black font-bold text-xs transition flex items-center gap-1.5 shadow disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit Exam</span>
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
      </div>

      {/* Network Disconnection Banner */}
      {(isOffline || autosaveStatus === 'offline') && !offlineNoticeDismissed && !submissionResult && (
        <div className="px-4 py-2 bg-rose-950/80 border-b border-rose-800 text-rose-200 text-xs flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              <strong>Network Disconnection:</strong> You are currently offline. Answers are saved locally in your browser session and will automatically synchronize when connectivity is restored.
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

      {/* Integrity Banner Alert */}
      {integrityWarning && !submissionResult && (
        <div className="px-4 py-1.5 bg-amber-950/60 border-b border-amber-800/80 text-amber-200 text-xs flex items-center justify-between shrink-0">
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            {integrityWarning}
          </span>
          <button
            onClick={() => setIntegrityWarning(null)}
            className="text-amber-400 hover:text-white text-[11px] font-semibold"
          >
            Acknowledge
          </button>
        </div>
      )}

      {/* Main Runner Body */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
          Loading examination environment...
        </div>
      )}

      {error && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-3">
          <AlertCircle className="w-10 h-10 text-red-400" />
          <p className="text-sm font-semibold text-red-300">{error}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 rounded-lg text-xs hover:bg-gray-700 text-white"
          >
            Return to Classroom
          </button>
        </div>
      )}

      {/* Completed Submission Confirmation Screen */}
      {submissionResult && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="p-4 rounded-full bg-emerald-950/60 border border-emerald-800 text-emerald-400">
            <CheckCircle className="w-12 h-12" />
          </div>
          <h2 className="text-lg font-bold text-white">Examination Submitted Successfully</h2>
          <p className="text-xs text-gray-400 max-w-md">
            Your responses have been securely recorded on the server. Your submission timestamp is{' '}
            {new Date(submissionResult.submittedAt || Date.now()).toLocaleTimeString()}.
          </p>

          {submissionResult.autoScore !== null && (
            <div className="p-4 bg-[#111216] border border-[#22242c] rounded-xl space-y-1">
              <span className="text-xs text-gray-400">Official Auto-Score</span>
              <div className="text-2xl font-bold text-cyan-400">
                {submissionResult.autoScore} / {submissionResult.totalMarks}
              </div>
              {submissionResult.passed !== null && (
                <div
                  className={`text-xs font-semibold ${
                    submissionResult.passed ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {submissionResult.passed ? 'PASSED' : 'NEEDS IMPROVEMENT'}
                </div>
              )}
            </div>
          )}

          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg bg-[#FF9100] text-black font-bold text-xs"
          >
            Return to Classroom
          </button>
        </div>
      )}

      {!isLoading && !error && !submissionResult && currentQ && (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Question Palette (Sidebar) */}
          <div className="w-full md:w-64 bg-[#0c0d10] border-r border-[#1e2026] p-4 flex flex-col gap-3 shrink-0 overflow-y-auto">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Questions ({answeredCount}/{visibleQuestions.length} Answered)
            </div>

            <div className="grid grid-cols-5 md:grid-cols-4 gap-2">
              {visibleQuestions.map((q, idx) => {
                const isAnswered = responses[q.id] !== undefined && responses[q.id] !== '';
                const isFlagged = !!flaggedQuestions[q.id];
                const isDirty = dirtyQuestions.includes(q.id);
                const isActive = currentIndex === idx;

                let badgeColor = 'bg-[#16171d] text-gray-400 border-[#252732]';
                if (isActive) {
                  badgeColor = 'bg-[#FF9100] text-black font-bold border-[#FF9100]';
                } else if (isFlagged) {
                  badgeColor = 'bg-amber-950/80 text-amber-300 border-amber-700';
                } else if (isAnswered) {
                  badgeColor = 'bg-emerald-950/80 text-emerald-300 border-emerald-700';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-9 rounded-lg border text-xs font-semibold flex items-center justify-center transition relative ${badgeColor}`}
                  >
                    <span>{idx + 1}</span>
                    {/* Flagged Bookmark */}
                    {isFlagged && !isActive && (
                      <Bookmark className="w-2.5 h-2.5 text-amber-400 fill-current absolute top-1 right-1" />
                    )}
                    {/* Unsaved Dirty Amber Indicator */}
                    {isDirty && !isActive && (
                      <span
                        className="w-2 h-2 rounded-full bg-amber-400 border border-black absolute top-1 left-1 animate-pulse"
                        title="Unsaved response syncing"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-auto border-t border-[#1a1c22] pt-3 text-[10px] text-gray-400 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-emerald-950 border border-emerald-700" />
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-amber-950 border border-amber-700" />
                <span>Marked for Review</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ml-0.5" />
                <span className="ml-0.5">Unsaved (Syncing)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-[#16171d] border border-[#252732]" />
                <span>Not Answered</span>
              </div>
            </div>
          </div>

          {/* Main Question & Answering Workspace */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0c]">
            {/* Question Header */}
            <div className="p-4 border-b border-[#1c1d22] flex items-center justify-between text-xs text-gray-400">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">Question {currentIndex + 1}</span>
                <span className="px-2 py-0.5 rounded bg-[#181920] text-gray-300 text-[10px] font-semibold border border-[#2b2d38]">
                  {currentQ.questionType.toUpperCase().replace('_', ' ')}
                </span>
                <span className="text-cyan-400 font-medium">{currentQ.points} Points</span>
                {currentQ.negativeMarks > 0 && (
                  <span className="text-rose-400">(-{currentQ.negativeMarks} for wrong)</span>
                )}
                {dirtyQuestions.includes(currentQ.id) && (
                  <span className="text-amber-400 font-mono text-[10px] animate-pulse">Syncing...</span>
                )}
              </div>

              <button
                onClick={() => toggleFlagReview(currentQ.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                  flaggedQuestions[currentQ.id]
                    ? 'bg-amber-950/80 text-amber-300 border border-amber-700'
                    : 'bg-[#14151b] text-gray-400 hover:text-white border border-[#272934]'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>{flaggedQuestions[currentQ.id] ? 'Marked for Review' : 'Mark for Review'}</span>
              </button>
            </div>

            {/* Prompt & Interactive Response Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {/* Question Text */}
              <div className="p-4 bg-[#111216] border border-[#1f2128] rounded-xl">
                <p className="text-sm text-gray-100 font-medium whitespace-pre-wrap leading-relaxed">
                  {currentQ.promptText}
                </p>
              </div>

              {/* 1. Single Choice MCQ */}
              {currentQ.questionType === 'mcq_single' && (
                <div className="space-y-2.5 max-w-xl">
                  {(currentQ.options || []).map((opt) => {
                    const isSelected = responses[currentQ.id] === opt.id;
                    return (
                      <div
                        key={opt.id}
                        onClick={() => handleUpdateAnswer(currentQ.id, opt.id)}
                        className={`p-3.5 rounded-xl border text-xs flex items-center gap-3 cursor-pointer transition ${
                          isSelected
                            ? 'bg-[#FF9100]/15 border-[#FF9100] text-white font-semibold'
                            : 'bg-[#111216] border-[#22242c] text-gray-300 hover:border-[#333644]'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected ? 'border-[#FF9100] bg-[#FF9100]' : 'border-gray-500'
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                        </div>
                        <span>{opt.text}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 2. Multiple Select MCQ */}
              {currentQ.questionType === 'mcq_multiple' && (
                <div className="space-y-2.5 max-w-xl">
                  {(currentQ.options || []).map((opt) => {
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
                        className={`p-3.5 rounded-xl border text-xs flex items-center gap-3 cursor-pointer transition ${
                          isSelected
                            ? 'bg-[#FF9100]/15 border-[#FF9100] text-white font-semibold'
                            : 'bg-[#111216] border-[#22242c] text-gray-300 hover:border-[#333644]'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            isSelected ? 'border-[#FF9100] bg-[#FF9100]' : 'border-gray-500'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-black stroke-[3]" />}
                        </div>
                        <span>{opt.text}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 3. True / False */}
              {currentQ.questionType === 'true_false' && (
                <div className="flex gap-4 max-w-sm">
                  {[true, false].map((val) => {
                    const isSelected = responses[currentQ.id] === val;
                    return (
                      <div
                        key={String(val)}
                        onClick={() => handleUpdateAnswer(currentQ.id, val)}
                        className={`flex-1 p-4 rounded-xl border text-center text-xs font-bold cursor-pointer transition ${
                          isSelected
                            ? 'bg-[#FF9100]/20 border-[#FF9100] text-[#FF9100]'
                            : 'bg-[#111216] border-[#22242c] text-gray-300 hover:border-[#333644]'
                        }`}
                      >
                        {val ? 'TRUE' : 'FALSE'}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 4. Numerical */}
              {currentQ.questionType === 'numerical' && (
                <div className="max-w-xs space-y-1.5">
                  <label className="text-xs text-gray-400">Your numerical answer:</label>
                  <input
                    type="number"
                    step="any"
                    value={responses[currentQ.id] !== undefined ? responses[currentQ.id] : ''}
                    onChange={(e) => handleUpdateAnswer(currentQ.id, e.target.value)}
                    placeholder="Enter numerical answer..."
                    className="w-full px-3 py-2 bg-[#121318] border border-[#252732] rounded-xl text-xs text-white focus:outline-none focus:border-[#FF9100]"
                  />
                </div>
              )}

              {/* 5. Short Answer */}
              {currentQ.questionType === 'short_answer' && (
                <div className="max-w-md space-y-1.5">
                  <label className="text-xs text-gray-400">Your answer:</label>
                  <input
                    type="text"
                    value={responses[currentQ.id] || ''}
                    onChange={(e) => handleUpdateAnswer(currentQ.id, e.target.value)}
                    placeholder="Type your response..."
                    className="w-full px-3 py-2 bg-[#121318] border border-[#252732] rounded-xl text-xs text-white focus:outline-none focus:border-[#FF9100]"
                  />
                </div>
              )}

              {/* 6. Programming Problem */}
              {currentQ.questionType === 'programming' && (
                <div className="space-y-4">
                  <div className="border border-[#22242c] rounded-xl overflow-hidden bg-[#101115]">
                    <div className="px-3 py-2 bg-[#14151b] border-b border-[#22242c] flex items-center justify-between text-xs">
                      <span className="text-gray-400 font-mono">Language: {currentQ.language || 'python'}</span>
                      <button
                        onClick={() =>
                          handleRunSampleCode(
                            responses[currentQ.id] || currentQ.initialCode || '',
                            currentQ.language || 'python'
                          )
                        }
                        disabled={isRunningSample}
                        className="px-3 py-1 rounded bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs flex items-center gap-1"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>{isRunningSample ? 'Running...' : 'Run Sample Tests'}</span>
                      </button>
                    </div>

                    <div className="h-64">
                      <MonacoEditor
                        height="100%"
                        language={currentQ.language || 'python'}
                        theme="vs-dark"
                        value={responses[currentQ.id] !== undefined ? responses[currentQ.id] : currentQ.initialCode || ''}
                        onChange={(val) => handleUpdateAnswer(currentQ.id, val || '')}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 13,
                          scrollBeyondLastLine: false,
                        }}
                      />
                    </div>
                  </div>

                  {sampleOutput && (
                    <div className="p-3 bg-black/60 border border-[#22242c] rounded-xl text-xs font-mono">
                      <div className="text-[10px] text-gray-500 font-semibold mb-1">SAMPLE EXECUTION OUTPUT:</div>
                      <pre className="text-gray-200 whitespace-pre-wrap">{sampleOutput}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Navigation Footer */}
            <div className="p-4 bg-[#0d0e12] border-t border-[#1c1d22] flex items-center justify-between shrink-0">
              <button
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="px-3 py-1.5 rounded-lg bg-[#14151b] hover:bg-[#1f2028] text-xs font-medium text-gray-300 disabled:opacity-30 flex items-center gap-1 border border-[#252732]"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <button
                onClick={() => setCurrentIndex((prev) => Math.min(visibleQuestions.length - 1, prev + 1))}
                disabled={currentIndex >= visibleQuestions.length - 1}
                className="px-4 py-1.5 rounded-lg bg-[#14151b] hover:bg-[#1f2028] text-xs font-medium text-gray-300 disabled:opacity-30 flex items-center gap-1 border border-[#252732]"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Confirmation Dialog */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#121318] border border-[#262830] rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-[#FF9100]" />
              Confirm Final Examination Submission
            </h3>

            <p className="text-xs text-gray-300">
              You have answered <span className="font-bold text-white">{answeredCount}</span> of{' '}
              <span className="font-bold text-white">{visibleQuestions.length}</span> questions.
              {answeredCount < visibleQuestions.length && (
                <span className="block mt-1 text-amber-400">
                  Warning: You have {visibleQuestions.length - answeredCount} unanswered questions!
                </span>
              )}
            </p>

            <p className="text-[11px] text-gray-500">
              Once submitted, your examination attempt will be completed and locked. You will not be able to change your
              answers.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                disabled={isSubmittingFinal}
                className="px-3 py-1.5 bg-[#181920] hover:bg-[#20222a] rounded-lg text-xs text-gray-300"
              >
                Continue Answering
              </button>
              <button
                onClick={handleFinalSubmit}
                disabled={isSubmittingFinal}
                className="px-4 py-1.5 bg-[#FF9100] hover:bg-[#e08000] text-black font-bold text-xs rounded-lg flex items-center gap-1.5 shadow"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmittingFinal ? 'Submitting...' : 'Yes, Submit Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
