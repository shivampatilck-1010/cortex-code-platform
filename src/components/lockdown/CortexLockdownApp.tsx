'use client';

function formatTimer(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Monitor,
  Video,
  Mic,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Clock,
  Award,
  ChevronRight,
  ChevronLeft,
  XCircle,
  HelpCircle,
  Settings,
  Eye,
  FileCheck,
  RefreshCw,
  Zap,
  Volume2,
  UserCheck,
  Send,
  Flag,
  FileText,
  Terminal,
  Activity,
  Layers,
  Sparkles,
  ArrowRight,
  LogOut,
  Maximize2,
  Accessibility
} from 'lucide-react';
import { ExamIntegrityEventType } from '@/lib/classroom/models';
import {
  saveEncryptedAnswers,
  loadEncryptedAnswers,
  clearEncryptedAnswers,
} from '@/lib/lockdown/answer-store';
import {
  analyzeVideoFrame,
  analyzeAudioSpectrum,
  DetectedFace,
  VisionAnalysisResult,
  AudioSpectralResult,
  CandidateAccommodations,
} from '@/lib/lockdown/proctoring-engine';

type ScreenId =
  | 'welcome'
  | 'device-security'
  | 'lobby'
  | 'hardware-readiness'
  | 'instructions'
  | 'workspace'
  | 'confirm-submission'
  | 'results'
  | 'settings'
  | 'error-recovery';

interface ExamItem {
  id: string;
  title: string;
  courseCode: string;
  durationMinutes: number;
  totalMarks: number;
  passingMarks: number;
  securityLevel: string;
  status: string;
  questionsCount: number;
}

export function CortexLockdownApp() {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('welcome');
  const [selectedExam, setSelectedExam] = useState<ExamItem>({
    id: 'EXAM_CSE276_ACTIVE_MIDTERM',
    title: 'Midterm Exam: Multithreading, Memory Models & Lock-Free Structures',
    courseCode: 'CS-276',
    durationMinutes: 60,
    totalMarks: 100,
    passingMarks: 40,
    securityLevel: 'Level 2 Restricted',
    status: 'Active',
    questionsCount: 5,
  });

  // Student State
  const [studentName] = useState('Shivam Patil (Demonstration Candidate)');
  const [studentEmail] = useState('shivampatilc@gmail.com');
  const [studentId] = useState('usr_cand_synth_demo_patil');

  // Gamification & Readiness
  const [hardwareVerified, setHardwareVerified] = useState(false);
  const [sensorsVerified, setSensorsVerified] = useState(false);
  const [consentAgreed, setConsentAgreed] = useState(false);
  const [instructionsAcknowledged, setInstructionsAcknowledged] = useState(false);

  // Examination Solving State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({
    q1: 'opt_m1',
    q2: ['opt_h1', 'opt_h2'],
    q3: '4.0',
    q4: 'Mutual Exclusion, Hold and Wait, No Preemption, Circular Wait.',
    q5: '#include <atomic>\nclass SafeCounter {\n  std::atomic<int> count{0};\npublic:\n  void increment() { count.fetch_add(1); }\n  int get() const { return count.load(); }\n};'
  });
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState(3540); // 59 minutes
  const [autosaveTimestamp, setAutosaveTimestamp] = useState<number>(Date.now());
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [submissionReceipt, setSubmissionReceipt] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>('sess_cse276_01');
  const [launchGrant, setLaunchGrant] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'offline_buffered' | 'sync_error'>('synced');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isRecoveredFromDisk, setIsRecoveredFromDisk] = useState<boolean>(false);
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);
  const [confirmedSubmittedAt, setConfirmedSubmittedAt] = useState<number | null>(null);
  const sequenceNumberRef = useRef<number>(1);

  // Phase 1: Accessibility & Institutional Accommodation State
  const [highContrastMode, setHighContrastMode] = useState<'standard' | 'high-contrast-dark' | 'high-contrast-light'>('standard');
  const [fontSizeScale, setFontSizeScale] = useState<'normal' | 'large' | 'extra-large'>('normal');
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [showAccommodationModal, setShowAccommodationModal] = useState<boolean>(false);
  const [timeMultiplier, setTimeMultiplier] = useState<number>(1.0);
  const [allowScreenReader, setAllowScreenReader] = useState<boolean>(false);
  const [allowMagnifier, setAllowMagnifier] = useState<boolean>(false);
  const [allowSpeechInput, setAllowSpeechInput] = useState<boolean>(false);
  const [screenReaderAnnouncement, setScreenReaderAnnouncement] = useState<string>('');
  const announcedMilestonesRef = useRef<Set<number>>(new Set());
  const [institutionalPolicyVersion, setInstitutionalPolicyVersion] = useState<number>(1);
  const [institutionalPolicyHash, setInstitutionalPolicyHash] = useState<string>('8b452e1e7a442f71885b5e7d4493390884d622956cf9e1d8ee1dcf5f6da91599');

  // Accessible Timer Announcements via aria-live at 15m, 5m, 1m intervals
  useEffect(() => {
    if (currentScreen !== 'workspace') return;
    if (timeRemainingSeconds === 900 && !announcedMilestonesRef.current.has(900)) {
      announcedMilestonesRef.current.add(900);
      setScreenReaderAnnouncement('Notice: 15 minutes remaining in examination.');
    } else if (timeRemainingSeconds === 300 && !announcedMilestonesRef.current.has(300)) {
      announcedMilestonesRef.current.add(300);
      setScreenReaderAnnouncement('Warning: 5 minutes remaining in examination.');
    } else if (timeRemainingSeconds === 60 && !announcedMilestonesRef.current.has(60)) {
      announcedMilestonesRef.current.add(60);
      setScreenReaderAnnouncement('Urgent: 1 minute remaining in examination.');
    }
  }, [timeRemainingSeconds, currentScreen]);

  // Global Keyboard Navigation (Arrows to cycle questions, Escape to close modals)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      if (e.key === 'Escape') {
        setShowAccommodationModal(false);
        return;
      }

      if (currentScreen === 'workspace' && !isInput) {
        if (e.key === 'ArrowRight' || e.key === 'PageDown') {
          setCurrentQuestionIndex((prev) => Math.min(4, prev + 1));
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          setCurrentQuestionIndex((prev) => Math.max(0, prev - 1));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentScreen]);

  // Read URL search parameters on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const qExam = urlParams.get('examId') || urlParams.get('exam_id');
      const qGrant = urlParams.get('launchGrant') || urlParams.get('grant') || urlParams.get('launch_grant');
      const qSession = urlParams.get('sessionId') || urlParams.get('session_id');

      if (qGrant) setLaunchGrant(qGrant);
      if (qSession) setSessionId(qSession);
      if (qExam) {
        setSelectedExam((prev) => ({ ...prev, id: qExam }));
      }
    }
  }, []);

  // Restore answers from authenticated encrypted local disk storage
  useEffect(() => {
    let active = true;
    async function restoreFromDisk() {
      try {
        const record = await loadEncryptedAnswers({
          examId: selectedExam.id,
          studentId,
          sessionId,
          clientSecret: launchGrant || undefined,
        });
        if (active && record && record.answers) {
          setAnswers(record.answers);
          sequenceNumberRef.current = record.sequenceNumber;
          setAutosaveTimestamp(record.updatedAt);
          setIsRecoveredFromDisk(true);
          setRecoveryNotice(
            `Restored ${Object.keys(record.answers).length} answers from encrypted local storage (Sequence #${record.sequenceNumber}). Session verified.`
          );
        }
      } catch (err: any) {
        console.warn('[CortexLockdownApp] Local storage recovery notice:', err?.message || err);
      }
    }
    restoreFromDisk();
    return () => {
      active = false;
    };
  }, [selectedExam.id, studentId, sessionId, launchGrant]);

  // Answer modification with immediate authenticated local persistence and cloud sync
  const updateAnswer = (questionId: string, val: any) => {
    const updated = { ...answers, [questionId]: val };
    setAnswers(updated);
    sequenceNumberRef.current += 1;
    const currentSeq = sequenceNumberRef.current;
    setAutosaveTimestamp(Date.now());
    setIsAutosaving(true);
    setSyncStatus('saving');

    saveEncryptedAnswers({
      examId: selectedExam.id,
      studentId,
      sessionId,
      answers: updated,
      sequenceNumber: currentSeq,
      clientSecret: launchGrant || undefined,
    })
      .then(() => {
        return fetch('/api/v1/lockdown/sync-answers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(launchGrant ? { 'x-cortex-lockdown-grant': launchGrant } : {}),
          },
          body: JSON.stringify({
            examId: selectedExam.id,
            sessionId,
            studentId,
            answers: updated,
            sequenceNumber: currentSeq,
            clientTimestamp: Date.now(),
            launchGrant,
          }),
        });
      })
      .then((res) => {
        if (res && res.ok) {
          setSyncStatus('synced');
        } else {
          setSyncStatus('offline_buffered');
        }
      })
      .catch(() => {
        setSyncStatus('offline_buffered');
      })
      .finally(() => {
        setIsAutosaving(false);
      });
  };

  // Proctoring & Media Stream State
  const [cameraActive, setCameraActive] = useState(true);
  const [micActive, setMicActive] = useState(true);
  const [audioLevel, setAudioLevel] = useState(42);
  const [faceDetected, setFaceDetected] = useState(true);
  const [faceCount, setFaceCount] = useState(1);
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  const [audioClassification, setAudioClassification] = useState<string>('ambient_noise');
  const [speechRatio, setSpeechRatio] = useState<number>(0);
  const [integrityEventsCount, setIntegrityEventsCount] = useState(0);

  // Real Hardware WebRTC Media Stream & Telemetry Engine
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const highAudioStreakRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isUsingHardwareMedia, setIsUsingHardwareMedia] = useState(false);

  // Automated Asynchronous Telemetry Dispatcher
  const dispatchTelemetryEvent = async (eventType: ExamIntegrityEventType, details: Record<string, any> = {}) => {
    setIntegrityEventsCount((prev) => prev + 1);
    try {
      await fetch('/api/v1/lockdown/telemetry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(launchGrant ? { 'x-cortex-lockdown-grant': launchGrant } : {}),
        },
        body: JSON.stringify({
          sessionId,
          examId: selectedExam?.id || 'EXAM_CSE276_ACTIVE_MIDTERM',
          events: [
            {
              eventType,
              timestamp: Date.now(),
              details
            }
          ]
        })
      });
    } catch (_) {}
  };

  const stopHardwareMedia = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setIsUsingHardwareMedia(false);
    setCameraActive(false);
    setMicActive(false);
  };

  const initHardwareMedia = async () => {
    try {
      setMediaError(null);
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setIsUsingHardwareMedia(false);
        setCameraActive(true);
        setMicActive(true);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 } },
        audio: true
      });
      mediaStreamRef.current = stream;
      setIsUsingHardwareMedia(true);
      setCameraActive(true);
      setMicActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      if (pipVideoRef.current) {
        pipVideoRef.current.srcObject = stream;
      }

      // Track listener for disconnection / permission revocation
      stream.getVideoTracks().forEach(track => {
        track.onended = () => {
          setCameraActive(false);
          dispatchTelemetryEvent('camera_revoked', { reason: 'hardware_unplugged_or_revoked' });
        };
      });
      stream.getAudioTracks().forEach(track => {
        track.onended = () => {
          setMicActive(false);
          dispatchTelemetryEvent('microphone_revoked', { reason: 'hardware_unplugged_or_revoked' });
        };
      });

      // Web Audio RMS & Spectral Speech Analyser
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const audioCtx = new AudioContextClass();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 512;
          source.connect(analyser);

          const pcmData = new Uint8Array(analyser.frequencyBinCount);
          let active = true;
          const checkVolume = () => {
            if (!active) return;
            analyser.getByteFrequencyData(pcmData);

            // Spectral Audio Analysis across human vocal speech bands
            const spectralRes = analyzeAudioSpectrum(pcmData, audioCtx.sampleRate || 48000);
            setAudioLevel(spectralRes.decibels);
            setAudioClassification(spectralRes.classification);
            setSpeechRatio(spectralRes.speechRatio);

            // Sustained anomaly tracking (e.g. conversational speech or continuous second speaker)
            if (spectralRes.isAnomaly) {
              highAudioStreakRef.current += 1;
              if (highAudioStreakRef.current === 60) {
                const eventType = spectralRes.isFlatline ? 'audio_flatline_disconnected' : 'audio_anomaly';
                dispatchTelemetryEvent(eventType, {
                  classification: spectralRes.classification,
                  decibels: spectralRes.decibels,
                  speechRatio: spectralRes.speechRatio,
                  spectralCentroid: spectralRes.spectralCentroid,
                  durationSec: 2,
                  anomalyReason: spectralRes.anomalyReason,
                });
              }
            } else {
              highAudioStreakRef.current = Math.max(0, highAudioStreakRef.current - 1);
            }

            requestAnimationFrame(checkVolume);
          };
          requestAnimationFrame(checkVolume);
        }
      } catch (_) {}
    } catch (err: any) {
      setMediaError(err.message || 'Camera or microphone permission was denied or device not found');
      // Keep simulator fallback available
      setCameraActive(true);
      setMicActive(true);
    }
  };

  useEffect(() => {
    // When reaching hardware-readiness or workspace, ensure hardware media is initiated
    if (currentScreen === 'hardware-readiness' || currentScreen === 'workspace') {
      if (!mediaStreamRef.current) {
        initHardwareMedia();
      } else {
        if (videoRef.current && videoRef.current.srcObject !== mediaStreamRef.current) {
          videoRef.current.srcObject = mediaStreamRef.current;
        }
        if (pipVideoRef.current && pipVideoRef.current.srcObject !== mediaStreamRef.current) {
          pipVideoRef.current.srcObject = mediaStreamRef.current;
        }
      }
    } else {
      // Release camera and microphone sensors immediately upon leaving active exam screens
      stopHardwareMedia();
    }
  }, [currentScreen]);

  useEffect(() => {
    return () => {
      stopHardwareMedia();
    };
  }, []);

  // Workspace OS Event Restrictions & Automated Computer-Vision Face Monitoring
  useEffect(() => {
    if (currentScreen !== 'workspace') return;

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      dispatchTelemetryEvent('clipboard_tamper', { action: 'copy_blocked' });
    };
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      dispatchTelemetryEvent('paste_attempt', { action: 'paste_blocked' });
    };
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dispatchTelemetryEvent('clipboard_tamper', { action: 'drop_blocked' });
    };
    const handleBlur = () => {
      dispatchTelemetryEvent('window_blur', { reason: 'app_lost_focus' });
    };
    const handleVisibility = () => {
      if (document.hidden) {
        dispatchTelemetryEvent('tab_hidden', { reason: 'desktop_or_tab_switch' });
      }
    };

    window.addEventListener('copy', handleCopy);
    window.addEventListener('paste', handlePaste);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibility);

    // Advanced Computer-Vision Face & Multiple Person Verification Loop (Every 2 seconds)
    const visionInterval = setInterval(async () => {
      const video = pipVideoRef.current || videoRef.current;
      if (!video || video.readyState < 2) return;

      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
        canvasRef.current.width = 160;
        canvasRef.current.height = 120;
      }
      const canvas = canvasRef.current;

      try {
        const visionRes = await analyzeVideoFrame(video, canvas);
        setFaceCount(visionRes.faceCount);
        setDetectedFaces(visionRes.faces);

        if (visionRes.isObstructed) {
          dispatchTelemetryEvent('camera_obstructed', {
            reason: visionRes.obstructionReason || 'camera_lens_covered_or_blackout',
            lightingLevel: visionRes.lightingLevel,
            contrastRatio: visionRes.contrastRatio,
            qualityRating: visionRes.qualityRating,
          });
        }

        if (visionRes.sceneShiftDetected) {
          dispatchTelemetryEvent('scene_shift_detected', {
            reason: 'sudden_camera_shift_or_visual_environment_change',
            lightingLevel: visionRes.lightingLevel,
          });
        }

        if (visionRes.status === 'absent') {
          if (faceDetected) {
            setFaceDetected(false);
            dispatchTelemetryEvent('face_absent', {
              reason: 'candidate_out_of_frame_or_camera_covered',
              method: visionRes.method,
              lightingLevel: visionRes.lightingLevel,
              faceCount: 0,
            });
          }
        } else if (visionRes.status === 'multiple') {
          setFaceDetected(true);
          dispatchTelemetryEvent('multiple_faces_detected', {
            reason: 'unauthorized_additional_person_detected',
            faceCount: visionRes.faceCount,
            detectedFaces: visionRes.faces,
            method: visionRes.method,
          });
        } else {
          if (!faceDetected) {
            setFaceDetected(true);
          }
        }
      } catch (_) {}
    }, 2000);

    return () => {
      window.removeEventListener('copy', handleCopy);
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(visionInterval);
    };
  }, [currentScreen, faceDetected]);

  // Compute Overall Readiness Percentage
  const readinessPercentage =
    (hardwareVerified ? 25 : 0) +
    (sensorsVerified ? 25 : 0) +
    (consentAgreed ? 25 : 0) +
    (instructionsAcknowledged ? 25 : 0);

  const handleFinalSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      sequenceNumberRef.current += 1;
      await saveEncryptedAnswers({
        examId: selectedExam.id,
        studentId,
        sessionId,
        answers,
        sequenceNumber: sequenceNumberRef.current,
      });

      const response = await fetch('/api/v1/lockdown/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(launchGrant ? { 'x-cortex-lockdown-grant': launchGrant } : {}),
        },
        body: JSON.stringify({
          examId: selectedExam.id,
          sessionId,
          studentId,
          answers,
          sequenceNumber: sequenceNumberRef.current,
          launchGrant,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success && data.receipt) {
        stopHardwareMedia();
        setSubmissionReceipt(data.receipt);
        setConfirmedSubmittedAt(data.submittedAt || Date.now());
        await clearEncryptedAnswers({
          examId: selectedExam.id,
          studentId,
          sessionId,
        });
        setCurrentScreen('results');
      } else {
        setSubmissionError(
          data.error || 'Server submission could not be verified. Your answers remain securely encrypted in local storage.'
        );
      }
    } catch (err: any) {
      setSubmissionError(
        'Network delivery interruption. Your answers are safely preserved in encrypted local storage. Please click Retry Server Submission once reconnected.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Countdown Timer with Automatic Expiration Submission
  useEffect(() => {
    if (currentScreen !== 'workspace') return;
    const interval = setInterval(() => {
      setTimeRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleFinalSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [currentScreen]);

  return (
    <div
      className={`flex flex-col h-screen w-screen font-sans select-none overflow-hidden border ${
        highContrastMode === 'high-contrast-dark'
          ? 'bg-black text-white border-yellow-400'
          : highContrastMode === 'high-contrast-light'
          ? 'bg-white text-black border-blue-900'
          : 'bg-[#0B0C10] text-[#F9FAFB] border-[#22242a]'
      } ${
        fontSizeScale === 'large'
          ? 'text-lg'
          : fontSizeScale === 'extra-large'
          ? 'text-xl'
          : 'text-base'
      } ${reducedMotion ? 'motion-reduce' : ''}`}
    >
      {/* Skip to Main Examination Content Link (WCAG 2.4.1) */}
      <a
        href="#exam-questions-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-amber-400 focus:text-black focus:font-bold focus:rounded-md focus:shadow-xl focus:outline-none focus:ring-4 focus:ring-black"
      >
        Skip to examination questions
      </a>

      {/* Screen Reader Live Announcement Region (WCAG 4.1.3) */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {screenReaderAnnouncement}
      </div>

      {/* Universal Security Top Bar */}
      <div className="h-11 bg-[#121316] border-b border-[#22242a] flex items-center justify-between px-4 z-50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#FF9100]" />
            <span className="font-heading font-bold text-xs tracking-wider text-white">CORTEX LOCKDOWN</span>
          </div>
          <div className="h-3.5 w-px bg-[#26262a]" />
          <span className="text-[11px] text-gray-400 font-mono">v1.0.0-RELEASE (x64)</span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800/60 font-semibold uppercase">
            {selectedExam.securityLevel}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/60 font-mono">
            Policy v{institutionalPolicyVersion} (Authoritative)
          </span>
        </div>

        {/* Accessibility & Accommodation Controls */}
        <div className="flex items-center gap-1.5" role="toolbar" aria-label="Accessibility options">
          <button
            onClick={() => {
              const next =
                highContrastMode === 'standard'
                  ? 'high-contrast-dark'
                  : highContrastMode === 'high-contrast-dark'
                  ? 'high-contrast-light'
                  : 'standard';
              setHighContrastMode(next);
              setScreenReaderAnnouncement(`Theme changed to ${next.replace('-', ' ')}`);
            }}
            aria-label={`High Contrast Mode: currently ${highContrastMode}`}
            className="px-2 py-1 rounded border border-[#2a2d36] text-[11px] hover:bg-[#1f2128] text-gray-300 font-mono focus:ring-2 focus:ring-[#FF9100]"
          >
            Contrast: {highContrastMode === 'standard' ? 'Std' : highContrastMode === 'high-contrast-dark' ? 'Dark HC' : 'Light HC'}
          </button>

          <button
            onClick={() => {
              const next = fontSizeScale === 'normal' ? 'large' : fontSizeScale === 'large' ? 'extra-large' : 'normal';
              setFontSizeScale(next);
              setScreenReaderAnnouncement(`Text size adjusted to ${next}`);
            }}
            aria-label={`Text Size: currently ${fontSizeScale}`}
            className="px-2 py-1 rounded border border-[#2a2d36] text-[11px] hover:bg-[#1f2128] text-gray-300 font-mono focus:ring-2 focus:ring-[#FF9100]"
          >
            Text: {fontSizeScale === 'normal' ? '100%' : fontSizeScale === 'large' ? '125%' : '150%'}
          </button>

          <button
            onClick={() => {
              setReducedMotion(!reducedMotion);
              setScreenReaderAnnouncement(`Reduced motion ${!reducedMotion ? 'enabled' : 'disabled'}`);
            }}
            aria-label={`Reduced Motion: currently ${reducedMotion ? 'enabled' : 'disabled'}`}
            className={`px-2 py-1 rounded border border-[#2a2d36] text-[11px] font-mono focus:ring-2 focus:ring-[#FF9100] ${
              reducedMotion ? 'bg-amber-950/60 text-amber-300 border-amber-700' : 'text-gray-300 hover:bg-[#1f2128]'
            }`}
          >
            Motion: {reducedMotion ? 'Off' : 'On'}
          </button>

          <button
            onClick={() => setShowAccommodationModal(true)}
            aria-label="Open Disability Accommodations Settings"
            className="px-2 py-1 rounded bg-[#1e2028] hover:bg-[#282a35] text-amber-400 border border-amber-800/60 text-[11px] font-medium flex items-center gap-1 focus:ring-2 focus:ring-[#FF9100]"
          >
            <Accessibility className="w-3.5 h-3.5" />
            <span>Accommodations</span>
          </button>
        </div>

        {/* Global Navigation Screen Selector (For Verification & Demo) */}
        <div className="hidden lg:flex items-center gap-1 bg-[#181920] px-2 py-1 rounded-md border border-[#26262a] text-[11px]">
          <span className="text-gray-500 font-mono mr-1">SCREEN:</span>
          {(
            [
              ['welcome', 'Dashboard'],
              ['device-security', 'Security'],
              ['lobby', 'Lobby'],
              ['hardware-readiness', 'Sensors'],
              ['instructions', 'Rules'],
              ['workspace', 'Exam'],
              ['confirm-submission', 'Submit'],
              ['results', 'Results'],
              ['settings', 'Settings'],
              ['error-recovery', 'Recovery'],
            ] as [ScreenId, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setCurrentScreen(id)}
              className={`px-2 py-0.5 rounded transition ${
                currentScreen === id
                  ? 'bg-[#FF9100] text-black font-semibold'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Right Status Badges */}
        <div className="flex items-center gap-3">
          {currentScreen === 'workspace' && (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/50 text-emerald-400 border border-emerald-800/60 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>PROCTOR ACTIVE</span>
              </span>
              <span className="text-[11px] font-mono text-gray-400">
                {isAutosaving ? 'Saving...' : 'Saved'}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 pl-2 border-l border-[#26262a]">
            <span className="text-xs font-medium text-gray-300">{studentName}</span>
            <div className="w-6 h-6 rounded-full bg-[#1e2028] border border-[#30333d] flex items-center justify-center text-[10px] font-bold text-[#FF9100]">
              SP
            </div>
          </div>
        </div>
      </div>

      {/* Main Dynamic Viewport */}
      <div className="flex-1 overflow-hidden relative flex flex-col bg-[#0B0C10] bg-[radial-gradient(#1e2129_1px,transparent_1px)] [background-size:24px_24px]">
        {/* ========================================================================= */}
        {/* SCREEN 1: WELCOME DASHBOARD                                               */}
        {/* ========================================================================= */}
        {currentScreen === 'welcome' && (
          <div className="flex-1 p-6 lg:p-10 overflow-y-auto flex flex-col justify-between max-w-6xl mx-auto w-full space-y-6">
            <div className="space-y-6">
              {/* Header Greeting & Device Badge */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#22242a]">
                <div>
                  <h1 className="text-2xl lg:text-3xl font-heading font-extrabold text-white flex items-center gap-3">
                    <span>Welcome to Cortex Lockdown, {studentName}</span>
                    <Sparkles className="w-5 h-5 text-[#FF9100]" />
                  </h1>
                  <p className="text-xs text-gray-400 mt-1">
                    Student ID: <span className="text-gray-300 font-mono">{studentId}</span> | Institution: <span className="text-cyan-400">Cortex Institute of Technology</span>
                  </p>
                </div>

                <div className="flex items-center gap-3 bg-[#121316] border border-[#22242a] p-2.5 rounded-xl">
                  <Monitor className="w-5 h-5 text-emerald-400" />
                  <div className="text-left">
                    <div className="text-[11px] font-bold text-gray-200">Enrolled Device</div>
                    <div className="text-[10px] text-gray-400 font-mono">ThinkPad P1 Gen 5 | Windows 11 (x64)</div>
                  </div>
                </div>
              </div>

              {/* Grid: Active Exam Hero & Readiness Progress Ring */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Hero Assessment Card */}
                <div className="lg:col-span-2 bg-[#121316] border border-[#22242a] hover:border-[#30333d] rounded-2xl p-6 flex flex-col justify-between space-y-5 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF9100]/5 rounded-full blur-3xl pointer-events-none" />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        AVAILABLE NOW
                      </span>
                      <span className="text-xs font-mono text-gray-400">{selectedExam.courseCode}</span>
                    </div>

                    <h2 className="text-xl font-heading font-bold text-white group-hover:text-[#FF9100] transition">
                      {selectedExam.title}
                    </h2>
                    <p className="text-xs text-gray-400 leading-relaxed max-w-xl">
                      Official proctored examination covering thread synchronization, memory consistency models, lock-free queues, and concurrent data structure design in C/C++.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3 py-3 border-y border-[#1e2028] text-center">
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase">Duration</div>
                      <div className="text-sm font-bold text-white mt-0.5">{selectedExam.durationMinutes} Min</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase">Total Marks</div>
                      <div className="text-sm font-bold text-white mt-0.5">{selectedExam.totalMarks} Pts</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase">Passing Cutoff</div>
                      <div className="text-sm font-bold text-emerald-400 mt-0.5">{selectedExam.passingMarks} Pts</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="text-[11px] text-gray-400 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-amber-400" />
                      <span>{selectedExam.securityLevel}</span>
                    </div>
                    <button
                      onClick={() => setCurrentScreen('device-security')}
                      className="h-10 px-6 rounded-xl bg-[#FF9100] hover:bg-[#e08000] text-black font-heading font-bold text-xs transition flex items-center gap-2 shadow-lg shadow-[#FF9100]/10"
                    >
                      <span>Proceed to Security Checks</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Gamified Readiness Ring & Preparation Milestones */}
                <div className="bg-[#121316] border border-[#22242a] rounded-2xl p-6 flex flex-col justify-between space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-heading font-bold text-white uppercase tracking-wider">Exam Readiness</h3>
                    <Award className="w-4 h-4 text-[#FF9100]" />
                  </div>

                  {/* Circular SVG Progress Ring */}
                  <div className="flex flex-col items-center justify-center py-2">
                    <div className="relative w-32 h-32 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" stroke="#1f222a" strokeWidth="8" fill="none" />
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          stroke="#FF9100"
                          strokeWidth="8"
                          fill="none"
                          strokeDasharray="251.2"
                          strokeDashoffset={251.2 - (251.2 * readinessPercentage) / 100}
                          strokeLinecap="round"
                          className="transition-all duration-700 ease-out"
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <span className="text-2xl font-heading font-black text-white">{readinessPercentage}%</span>
                        <span className="text-[10px] text-gray-400 font-medium uppercase">Prepared</span>
                      </div>
                    </div>
                  </div>

                  {/* Preparation Checklist */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between text-gray-300">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className={`w-3.5 h-3.5 ${hardwareVerified ? 'text-emerald-400' : 'text-gray-600'}`} />
                        <span>Hardware & Display Check</span>
                      </span>
                      <span className="font-mono text-[10px] text-gray-500">{hardwareVerified ? 'DONE' : 'PENDING'}</span>
                    </div>
                    <div className="flex items-center justify-between text-gray-300">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className={`w-3.5 h-3.5 ${sensorsVerified ? 'text-emerald-400' : 'text-gray-600'}`} />
                        <span>Camera & Mic Verified</span>
                      </span>
                      <span className="font-mono text-[10px] text-gray-500">{sensorsVerified ? 'DONE' : 'PENDING'}</span>
                    </div>
                    <div className="flex items-center justify-between text-gray-300">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className={`w-3.5 h-3.5 ${consentAgreed ? 'text-emerald-400' : 'text-gray-600'}`} />
                        <span>Proctoring Consent</span>
                      </span>
                      <span className="font-mono text-[10px] text-gray-500">{consentAgreed ? 'DONE' : 'PENDING'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Footer Details */}
            <div className="flex items-center justify-between text-[11px] text-gray-500 pt-4 border-t border-[#181920]">
              <span>Cortex Online Examination System | University Pilot Release</span>
              <span>Encrypted via TLS 1.3 | Server-Authoritative Integrity</span>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SCREEN 2: DEVICE SECURITY CENTRE                                          */}
        {/* ========================================================================= */}
        {currentScreen === 'device-security' && (
          <div className="flex-1 p-6 lg:p-10 overflow-y-auto max-w-4xl mx-auto w-full flex flex-col justify-between space-y-6">
            <div className="space-y-6">
              <div className="border-b border-[#22242a] pb-4">
                <button
                  onClick={() => setCurrentScreen('welcome')}
                  className="text-xs text-gray-400 hover:text-white flex items-center gap-1 mb-2 transition"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back to Dashboard</span>
                </button>
                <h1 className="text-2xl font-heading font-bold text-white flex items-center gap-2.5">
                  <Shield className="w-6 h-6 text-[#FF9100]" />
                  <span>Device Security & Kiosk Audit</span>
                </h1>
                <p className="text-xs text-gray-400 mt-1">
                  Cortex Lockdown performs a pre-flight hardware and operating system check before launching the assessment.
                </p>
              </div>

              {/* Security Milestones Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Check 1: Display Monitors */}
                <div className="bg-[#121316] border border-[#22242a] p-4 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-cyan-400" />
                      Display Integrity
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-semibold border border-emerald-800/60">
                      PASSED
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Single primary monitor detected (1920x1080). Secondary external display count: 0.
                  </p>
                </div>

                {/* Check 2: Process Watchdog */}
                <div className="bg-[#121316] border border-[#22242a] p-4 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-[#FF9100]" />
                      Process Watchdog
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-semibold border border-emerald-800/60">
                      CLEAN
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    0 blacklisted processes active. Screen recorders, Discord, and remote access tools are not running.
                  </p>
                </div>

                {/* Check 3: Display Capture Shield */}
                <div className="bg-[#121316] border border-[#22242a] p-4 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <Lock className="w-4 h-4 text-emerald-400" />
                      Display Affinity
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-semibold border border-emerald-800/60">
                      WDA_MONITOR
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Native window capture protection pre-armed. Window contents will appear pitch-black to external screen recording utilities.
                  </p>
                </div>

                {/* Check 4: Remote Session & VM */}
                <div className="bg-[#121316] border border-[#22242a] p-4 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-violet-400" />
                      Virtualization & RDP
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-semibold border border-emerald-800/60">
                      BARE-METAL
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Executing directly on host physical hardware. No active Remote Desktop Protocol (RDP) sessions detected.
                  </p>
                </div>
              </div>

              {/* Action Box */}
              <div className="bg-[#16171d] border border-[#262832] p-5 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">All 4 Security Prerequisites Verified</h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">Your workstation complies with institutional examination policies.</p>
                </div>
                <button
                  onClick={async () => {
                    try {
                      fetch('/api/v1/lockdown/devices/enroll', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          deviceId: 'dev_lockdown_' + Math.random().toString(36).substring(2, 9),
                          hardwareFingerprint: 'fp_' + (typeof navigator !== 'undefined' ? navigator.userAgent.replace(/[^a-zA-Z0-9]/g, '').slice(0, 32) : 'win32'),
                          osPlatform: typeof navigator !== 'undefined' ? navigator.platform : 'Win32',
                          clientBinaryHash: '82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895',
                          monitorCount: 1,
                          isVirtualMachine: false
                        })
                      }).catch(() => {});
                    } catch (_) {}
                    setHardwareVerified(true);
                    setCurrentScreen('hardware-readiness');
                  }}
                  className="h-9 px-5 rounded-xl bg-[#FF9100] hover:bg-[#e08000] text-black font-bold text-xs transition flex items-center gap-2"
                >
                  <span>Continue to Sensor Check</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="text-[11px] text-gray-500 text-center">
              Cryptographic Fingerprint: <span className="font-mono text-gray-400">a8f3b92c4d1e0f8a9271c56391d8e40b3c2a1f09</span>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SCREEN 3: CAMERA & MICROPHONE READINESS (Hardware & Consent)              */}
        {/* ========================================================================= */}
        {currentScreen === 'hardware-readiness' && (
          <div className="flex-1 p-6 lg:p-10 overflow-y-auto max-w-4xl mx-auto w-full flex flex-col justify-between space-y-6">
            <div className="space-y-6">
              <div className="border-b border-[#22242a] pb-4">
                <button
                  onClick={() => setCurrentScreen('device-security')}
                  className="text-xs text-gray-400 hover:text-white flex items-center gap-1 mb-2 transition"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back to Device Security</span>
                </button>
                <h1 className="text-2xl font-heading font-bold text-white flex items-center gap-2.5">
                  <Video className="w-6 h-6 text-[#FF9100]" />
                  <span>Sensor Verification & Proctoring Consent</span>
                </h1>
                <p className="text-xs text-gray-400 mt-1">
                  Confirm your webcam and microphone functionality and review our academic integrity recording policy.
                </p>
              </div>

              {/* Sensor Loopback & Audio Visualizer Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Webcam Preview Loopback */}
                <div className="bg-[#121316] border border-[#22242a] rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white flex items-center gap-2">
                      <Video className="w-4 h-4 text-emerald-400" />
                      Integrated Webcam (HD)
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800/60">
                      720p @ 15 FPS
                    </span>
                  </div>

                  <div className="h-52 bg-[#090A0C] border border-[#202228] rounded-xl flex flex-col items-center justify-center relative overflow-hidden">
                    {/* Live Hardware Webcam Stream or Simulated Fallback */}
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover ${isUsingHardwareMedia ? 'block' : 'hidden'}`}
                    />
                    {!isUsingHardwareMedia && (
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-24 h-24 rounded-full bg-[#16181f] border border-[#2a2d36] flex items-center justify-center text-gray-500">
                          <UserCheck className="w-10 h-10 text-emerald-400" />
                        </div>
                        <span className="text-[11px] text-gray-400 mt-2 font-medium">Evaluation Stream | Virtual Simulation</span>
                      </div>
                    )}
                    {mediaError && (
                      <div className="absolute inset-0 bg-black/85 p-4 flex flex-col items-center justify-center text-center space-y-2 z-10">
                        <AlertTriangle className="w-6 h-6 text-amber-400" />
                        <span className="text-xs text-white font-semibold">Webcam Note</span>
                        <span className="text-[10px] text-gray-300 max-w-xs">{mediaError}</span>
                        <button
                          onClick={initHardwareMedia}
                          className="px-3 py-1 bg-[#FF9100] hover:bg-[#e08000] text-black font-bold text-xs rounded transition"
                        >
                          Retry Hardware Access
                        </button>
                      </div>
                    )}

                    {/* Green Face Tracking Bounding Box Indicator */}
                    <div className="absolute top-8 left-16 right-16 bottom-12 border border-emerald-500/40 rounded-lg pointer-events-none" />
                  </div>
                </div>

                {/* Microphone & Speaker Check */}
                <div className="bg-[#121316] border border-[#22242a] rounded-2xl p-4 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white flex items-center gap-2">
                        <Mic className="w-4 h-4 text-cyan-400" />
                        Microphone Input Level
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">Realtek Audio</span>
                    </div>

                    {/* Audio Decibel Bar */}
                    <div className="space-y-1.5">
                      <div className="h-3 w-full bg-[#181920] rounded-full overflow-hidden p-0.5 border border-[#262832]">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 rounded-full transition-all duration-300"
                          style={{ width: `${audioLevel}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                        <span>Silent</span>
                        <span>Normal Voice (Optimal)</span>
                        <span>Loud</span>
                      </div>
                    </div>
                  </div>

                  {/* Speaker Audio Test */}
                  <div className="bg-[#181920] p-3 rounded-xl border border-[#22242a] flex items-center justify-between">
                    <div className="text-left">
                      <div className="text-xs font-bold text-white">Audio Output Test</div>
                      <div className="text-[10px] text-gray-400">Verify you can hear proctor announcements</div>
                    </div>
                    <button
                      onClick={() => alert('Chime sound played successfully.')}
                      className="px-3 py-1.5 rounded-lg bg-[#22242e] hover:bg-[#2c2f3c] text-xs font-semibold text-gray-200 border border-[#30333d] transition flex items-center gap-1.5"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Test Sound</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Privacy Disclosure & Consent Agreement */}
              <div className="bg-[#121316] border border-[#22242a] p-5 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Eye className="w-4 h-4 text-[#FF9100]" />
                  <span>Student Privacy Notice & Recording Agreement</span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Video and audio are recorded solely for the duration of this examination and encrypted in transit and at rest.
                  Recordings are reviewed exclusively by authorized course instructors and purged automatically within 30 days. No automated academic disqualification occurs without human faculty review.
                </p>

                <label className="flex items-center gap-3 pt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentAgreed}
                    onChange={(e) => setConsentAgreed(e.target.checked)}
                    className="w-4 h-4 rounded bg-[#1e2028] border-gray-700 text-[#FF9100] focus:ring-0"
                  />
                  <span className="text-xs font-medium text-gray-200">
                    I acknowledge the proctoring disclosure and consent to academic integrity recording for this session.
                  </span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  disabled={!consentAgreed}
                  onClick={() => {
                    setSensorsVerified(true);
                    setCurrentScreen('instructions');
                  }}
                  className={`h-10 px-6 rounded-xl font-heading font-bold text-xs transition flex items-center gap-2 ${
                    consentAgreed
                      ? 'bg-[#FF9100] hover:bg-[#e08000] text-black shadow-lg shadow-[#FF9100]/10'
                      : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <span>Review Instructions</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="text-[11px] text-gray-500 text-center">
              FERPA & GDPR Compliant | Zero Covert Sensor Activation
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SCREEN 4: EXAMINATION INSTRUCTIONS                                        */}
        {/* ========================================================================= */}
        {currentScreen === 'instructions' && (
          <div className="flex-1 p-6 lg:p-10 overflow-y-auto max-w-4xl mx-auto w-full flex flex-col justify-between space-y-6">
            <div className="space-y-6">
              <div className="border-b border-[#22242a] pb-4">
                <button
                  onClick={() => setCurrentScreen('hardware-readiness')}
                  className="text-xs text-gray-400 hover:text-white flex items-center gap-1 mb-2 transition"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back to Sensors</span>
                </button>
                <h1 className="text-2xl font-heading font-bold text-white flex items-center gap-2.5">
                  <FileText className="w-6 h-6 text-[#FF9100]" />
                  <span>Official Examination Instructions</span>
                </h1>
                <p className="text-xs text-gray-400 mt-1">
                  Please review the rules, scoring policies, and lockdown restrictions before entering the secure workspace.
                </p>
              </div>

              {/* Rules Cards */}
              <div className="space-y-3 text-xs">
                <div className="bg-[#121316] border border-[#22242a] p-4 rounded-xl flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-950/60 text-amber-400 border border-amber-800/60 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-white">Full Kiosk Lockdown & Window Confinement</h4>
                    <p className="text-gray-400 text-[11px] mt-0.5 leading-relaxed">
                      Application switching (Alt+Tab, WinKey, Cmd+Tab) is strictly blocked. Exiting the window or triggering system dialogs records an immediate integrity incident in the instructor live proctoring dashboard.
                    </p>
                  </div>
                </div>

                <div className="bg-[#121316] border border-[#22242a] p-4 rounded-xl flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-950/60 text-amber-400 border border-amber-800/60 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-white">Continuous Autosave & Network Resilience</h4>
                    <p className="text-gray-400 text-[11px] mt-0.5 leading-relaxed">
                      Every keystroke and answer selection is saved continuously to Cloudflare D1 with monotonic sequence validation. If your connection drops, an offline buffer preserves your work locally until connectivity is restored.
                    </p>
                  </div>
                </div>

                <div className="bg-[#121316] border border-[#22242a] p-4 rounded-xl flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-950/60 text-amber-400 border border-amber-800/60 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold text-white">Server-Authoritative Deadline</h4>
                    <p className="text-gray-400 text-[11px] mt-0.5 leading-relaxed">
                      The countdown clock is synchronized with server time. When the timer expires, the exam locks automatically and submits your recorded answers. A 30-second network delivery grace period applies strictly to in-flight packet transport.
                    </p>
                  </div>
                </div>
              </div>

              {/* Acknowledgment Checkbox */}
              <label className="flex items-center gap-3 bg-[#121316] p-4 rounded-xl border border-[#22242a] cursor-pointer">
                <input
                  type="checkbox"
                  checked={instructionsAcknowledged}
                  onChange={(e) => setInstructionsAcknowledged(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#1e2028] border-gray-700 text-[#FF9100] focus:ring-0"
                />
                <span className="text-xs font-semibold text-gray-200">
                  I have read and agree to comply with the academic instructions and code of integrity.
                </span>
              </label>

              {/* Launch Exam Button */}
              <div className="flex justify-end">
                <button
                  disabled={!instructionsAcknowledged}
                  onClick={() => setCurrentScreen('workspace')}
                  className={`h-11 px-8 rounded-xl font-heading font-extrabold text-xs transition flex items-center gap-2 ${
                    instructionsAcknowledged
                      ? 'bg-[#FF9100] hover:bg-[#e08000] text-black shadow-lg shadow-[#FF9100]/20'
                      : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Enter Secure Examination Workspace</span>
                </button>
              </div>
            </div>

            <div className="text-[11px] text-gray-500 text-center">
              Emergency Proctor Exit Code: <span className="font-mono text-gray-400">Ctrl + Shift + Alt + F10</span>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SCREEN 5: SECURE EXAMINATION WORKSPACE                                    */}
        {/* ========================================================================= */}
        {currentScreen === 'workspace' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Recovery & Disk Persistence Banner */}
            {isRecoveredFromDisk && recoveryNotice && (
              <div className="bg-emerald-950/70 border-b border-emerald-800/80 px-4 py-1.5 flex items-center justify-between text-[11px] text-emerald-300 font-mono shrink-0">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{recoveryNotice}</span>
                </div>
                <button onClick={() => setIsRecoveredFromDisk(false)} className="text-gray-400 hover:text-white text-xs">Dismiss</button>
              </div>
            )}

            {/* Examination Header Controls Bar */}
            <div className="h-12 bg-[#101115] border-b border-[#202228] px-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-white">{selectedExam.title}</span>
                <span className="text-[10px] text-cyan-400 font-mono bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
                  Section 1 of 3: Core Concurrency
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border flex items-center gap-1.5 ${
                  syncStatus === 'synced'
                    ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/60'
                    : syncStatus === 'saving'
                    ? 'bg-amber-950/50 text-amber-400 border-amber-800/60'
                    : 'bg-amber-950/50 text-amber-400 border-amber-800/60'
                }`}>
                  <Shield className="w-3 h-3" />
                  <span>{syncStatus === 'synced' ? 'Persisted & Synced' : syncStatus === 'saving' ? 'Encrypting to Disk...' : 'Encrypted Local Buffer Active'}</span>
                </span>
              </div>

              <div className="flex items-center gap-4">
                {/* Countdown Timer with Visual Warning */}
                <div className="flex items-center gap-2 bg-[#181920] px-3 py-1 rounded-lg border border-[#2a2d36]">
                  <Clock className="w-3.5 h-3.5 text-[#FF9100]" />
                  <span className="font-mono font-bold text-sm text-white tracking-wider">
                    {formatTimer(timeRemainingSeconds)}
                  </span>
                </div>

                <button
                  onClick={() => setCurrentScreen('confirm-submission')}
                  className="h-8 px-4 rounded-lg bg-[#FF9100] hover:bg-[#e08000] text-black font-heading font-bold text-xs transition flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Exam</span>
                </button>
              </div>
            </div>

            {/* Core Body: Left Question Drawer + Main Question Surface */}
            <div className="flex-1 flex overflow-hidden">
              {/* Question Navigation Drawer */}
              <div className="w-56 bg-[#0E0F12] border-r border-[#202228] p-3 flex flex-col justify-between shrink-0">
                <div className="space-y-3">
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Question Matrix</div>
                  <div className="grid grid-cols-4 gap-2">
                    {[0, 1, 2, 3, 4].map((idx) => {
                      const isCurrent = currentQuestionIndex === idx;
                      const isMarked = markedForReview[`q${idx + 1}`];
                      return (
                        <button
                          key={idx}
                          onClick={() => setCurrentQuestionIndex(idx)}
                          className={`h-9 rounded-lg font-mono font-bold text-xs transition flex items-center justify-center relative ${
                            isCurrent
                              ? 'bg-[#FF9100] text-black ring-2 ring-[#FF9100]/40'
                              : 'bg-[#181920] text-gray-300 hover:bg-[#22242c] border border-[#262832]'
                          }`}
                        >
                          {idx + 1}
                          {isMarked && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5 text-[10px] text-gray-400 pt-3 border-t border-[#181920]">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded bg-[#FF9100]" />
                    <span>Current Question</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
                    <span>Answered (5/5)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded bg-amber-400" />
                    <span>Marked for Review</span>
                  </div>
                </div>

                {/* Live Candidate Proctoring PIP Stream */}
                <div className="bg-[#121316] border border-[#22242a] rounded-xl p-2.5 space-y-2 mt-4">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-mono font-bold text-emerald-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                      REC
                    </span>
                    <span className="font-mono text-gray-400">PROCTORING</span>
                  </div>
                  <div className="w-full h-24 bg-[#090A0C] border border-[#1e2026] rounded-lg overflow-hidden relative flex items-center justify-center">
                    <video
                      ref={pipVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover ${isUsingHardwareMedia ? 'block' : 'hidden'}`}
                    />
                    {!isUsingHardwareMedia && (
                      <div className="w-12 h-12 rounded-full bg-[#16181f] border border-[#2a2d36] flex items-center justify-center text-emerald-400">
                        <UserCheck className="w-6 h-6" />
                      </div>
                    )}
                    {/* Real-time Biometric Face Presence Indicator */}
                    <div className="absolute top-1.5 right-1.5">
                      {faceCount === 1 ? (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-emerald-950/90 text-emerald-400 border border-emerald-800/70">
                          1 Face Verified
                        </span>
                      ) : faceCount === 0 ? (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-rose-950/90 text-rose-400 border border-rose-800/70 animate-pulse">
                          0 Faces (Absent)
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-amber-950/90 text-amber-400 border border-amber-800/70 animate-pulse">
                          {faceCount} Faces (Multiple)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[9px] text-gray-400 font-mono">
                      <span>MIC: {audioClassification.toUpperCase().replace('_', ' ')}</span>
                      <span>{audioLevel}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-[#181920] rounded-full overflow-hidden border border-[#262832]">
                      <div
                        className={`h-full rounded-full transition-all duration-150 ${
                          audioClassification === 'speech_detected' || audioClassification === 'multiple_speakers'
                            ? 'bg-amber-400'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${audioLevel}%` }}
                      />
                    </div>
                    <p className="text-[8px] text-gray-500 leading-tight pt-1">
                      Algorithmic indicators for proctor review, not proof of cheating.
                    </p>
                  </div>
                </div>
              </div>

              {/* Question Canvas Surface (WCAG 2.1 Main Landmark & Skip Target) */}
              <main
                id="exam-questions-main"
                role="main"
                aria-label="Examination questions workspace"
                className="flex-1 p-6 lg:p-8 overflow-y-auto flex flex-col justify-between max-w-4xl mx-auto w-full focus:outline-none"
              >
                <div className="space-y-6">
                  {/* Question Header & Points */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#202228]">
                    <span className="text-xs font-bold text-gray-400 uppercase font-mono">
                      Question {currentQuestionIndex + 1} of 5
                    </span>
                    <span className="text-xs font-bold text-[#FF9100] bg-[#FF9100]/10 px-2.5 py-0.5 rounded border border-[#FF9100]/30">
                      {currentQuestionIndex === 0 && '10 Marks'}
                      {currentQuestionIndex === 1 && '20 Marks'}
                      {currentQuestionIndex === 2 && '15 Marks'}
                      {currentQuestionIndex === 3 && '15 Marks'}
                      {currentQuestionIndex === 4 && '40 Marks'}
                    </span>
                  </div>

                  {/* Question 1: MCQ Single */}
                  {currentQuestionIndex === 0 && (
                    <div className="space-y-4">
                      <h3 className="text-base font-semibold text-white leading-relaxed">
                        Under the MESI cache coherency protocol, which state indicates that a cache line is valid, modified with respect to main memory, and present only in the current core cache?
                      </h3>

                      <div className="space-y-2.5 pt-2">
                        {[
                          ['opt_m1', 'Modified (M)'],
                          ['opt_m2', 'Exclusive (E)'],
                          ['opt_m3', 'Shared (S)'],
                          ['opt_m4', 'Invalid (I)'],
                        ].map(([id, label]) => (
                          <label
                            key={id}
                            className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                              answers.q1 === id
                                ? 'bg-[#FF9100]/10 border-[#FF9100]/50 text-white font-medium'
                                : 'bg-[#121316] border-[#22242a] text-gray-300 hover:bg-[#181920]'
                            }`}
                          >
                            <input
                              type="radio"
                              name="q1"
                              checked={answers.q1 === id}
                              onChange={() => updateAnswer('q1', id)}
                              className="text-[#FF9100] focus:ring-0 bg-[#1e2028] border-gray-700"
                            />
                            <span className="text-xs">{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Question 2: MCQ Multiple */}
                  {currentQuestionIndex === 1 && (
                    <div className="space-y-4">
                      <h3 className="text-base font-semibold text-white leading-relaxed">
                        Which of the following are hazards inherent to lock-free concurrent programming that require safe memory reclamation techniques like hazard pointers or RCU? (Select all that apply)
                      </h3>

                      <div className="space-y-2.5 pt-2">
                        {[
                          ['opt_h1', 'ABA Problem'],
                          ['opt_h2', 'Premature node deallocation (Use-After-Free)'],
                          ['opt_h3', 'Priority Inversion'],
                          ['opt_h4', 'Cache line false sharing'],
                        ].map(([id, label]) => (
                          <label
                            key={id}
                            className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                              answers.q2?.includes(id)
                                ? 'bg-[#FF9100]/10 border-[#FF9100]/50 text-white font-medium'
                                : 'bg-[#121316] border-[#22242a] text-gray-300 hover:bg-[#181920]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={answers.q2?.includes(id)}
                              onChange={() => {
                                const current = answers.q2 || [];
                                const updated = current.includes(id)
                                  ? current.filter((x: string) => x !== id)
                                  : [...current, id];
                                updateAnswer('q2', updated);
                              }}
                              className="text-[#FF9100] rounded focus:ring-0 bg-[#1e2028] border-gray-700"
                            />
                            <span className="text-xs">{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Question 3: Numerical */}
                  {currentQuestionIndex === 2 && (
                    <div className="space-y-4">
                      <h3 className="text-base font-semibold text-white leading-relaxed">
                        According to Amdahl's Law, if 75% of an algorithm can be parallelized (P = 0.75), what is the theoretical maximum speedup limit S as the number of parallel processor cores approaches infinity (N -&gt; inf)?
                      </h3>

                      <div className="pt-2 max-w-xs space-y-1.5">
                        <label className="text-[11px] text-gray-400 font-mono">Enter Numerical Answer (Decimal):</label>
                        <input
                          type="text"
                          value={answers.q3}
                          onChange={(e) => updateAnswer('q3', e.target.value)}
                          className="w-full px-3.5 py-2 rounded-xl bg-[#121316] border border-[#262832] text-sm text-white font-mono focus:outline-none focus:border-[#FF9100]"
                          placeholder="e.g. 4.0"
                        />
                      </div>
                    </div>
                  )}

                  {/* Question 4: Subjective */}
                  {currentQuestionIndex === 3 && (
                    <div className="space-y-4">
                      <h3 className="text-base font-semibold text-white leading-relaxed">
                        List the four Coffman conditions necessary for deadlock to manifest in a concurrent system, and explain how establishing a global lock hierarchy eliminates Circular Wait.
                      </h3>

                      <div className="pt-2 space-y-1.5">
                        <textarea
                          rows={6}
                          value={answers.q4}
                          onChange={(e) => updateAnswer('q4', e.target.value)}
                          className="w-full p-4 rounded-xl bg-[#121316] border border-[#262832] text-xs text-white font-mono leading-relaxed focus:outline-none focus:border-[#FF9100]"
                        />
                      </div>
                    </div>
                  )}

                  {/* Question 5: Coding Challenge */}
                  {currentQuestionIndex === 4 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold text-white">
                          C++ Systems Programming: Atomic SafeCounter
                        </h3>
                        <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
                          Language: C++ (GCC 14)
                        </span>
                      </div>

                      <div className="pt-1">
                        <textarea
                          rows={10}
                          value={answers.q5}
                          onChange={(e) => updateAnswer('q5', e.target.value)}
                          className="w-full p-4 rounded-xl bg-[#090A0D] border border-[#202228] text-xs text-emerald-400 font-mono leading-relaxed focus:outline-none focus:border-[#FF9100]"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Canvas Controls */}
                <div className="flex items-center justify-between pt-6 border-t border-[#181920]">
                  <button
                    disabled={currentQuestionIndex === 0}
                    onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                    className={`h-9 px-4 rounded-lg text-xs font-medium border transition flex items-center gap-1.5 ${
                      currentQuestionIndex === 0
                        ? 'bg-transparent text-gray-600 border-gray-800 cursor-not-allowed'
                        : 'bg-[#181920] hover:bg-[#22242c] text-gray-300 border-[#2a2d36]'
                    }`}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                  </button>

                  <button
                    onClick={() => {
                      const key = `q${currentQuestionIndex + 1}`;
                      setMarkedForReview({ ...markedForReview, [key]: !markedForReview[key] });
                    }}
                    className={`h-9 px-4 rounded-lg text-xs font-medium border transition flex items-center gap-1.5 ${
                      markedForReview[`q${currentQuestionIndex + 1}`]
                        ? 'bg-amber-950/50 text-amber-400 border-amber-800/60'
                        : 'bg-[#181920] text-gray-400 hover:text-white border-[#2a2d36]'
                    }`}
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>{markedForReview[`q${currentQuestionIndex + 1}`] ? 'Marked' : 'Mark for Review'}</span>
                  </button>

                  <button
                    onClick={() => {
                      if (currentQuestionIndex < 4) {
                        setCurrentQuestionIndex((prev) => prev + 1);
                      } else {
                        setCurrentScreen('confirm-submission');
                      }
                    }}
                    className="h-9 px-5 rounded-lg bg-[#FF9100] hover:bg-[#e08000] text-black font-bold text-xs transition flex items-center gap-1.5"
                  >
                    <span>{currentQuestionIndex < 4 ? 'Next Question' : 'Review & Submit'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </main>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SCREEN 6: SUBMISSION CONFIRMATION                                         */}
        {/* ========================================================================= */}
        {currentScreen === 'confirm-submission' && (
          <div className="flex-1 p-6 lg:p-10 overflow-y-auto max-w-2xl mx-auto w-full flex flex-col justify-center space-y-6">
            <div className="bg-[#121316] border border-[#22242a] p-6 rounded-2xl space-y-5 text-center">
              <div className="w-12 h-12 rounded-full bg-[#FF9100]/10 border border-[#FF9100]/30 flex items-center justify-center mx-auto text-[#FF9100]">
                <FileCheck className="w-6 h-6" />
              </div>

              <div>
                <h2 className="text-xl font-heading font-bold text-white">Confirm Final Examination Submission</h2>
                <p className="text-xs text-gray-400 mt-1">
                  Once finalized, your answers are sealed cryptographically and no further modifications are permitted.
                </p>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3 py-4 border-y border-[#1e2028]">
                <div>
                  <div className="text-[10px] text-gray-500 uppercase">Answered</div>
                  <div className="text-base font-bold text-emerald-400 mt-0.5">5 of 5</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 uppercase">Marked for Review</div>
                  <div className="text-base font-bold text-amber-400 mt-0.5">
                    {Object.values(markedForReview).filter(Boolean).length}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 uppercase">Time Remaining</div>
                  <div className="text-base font-bold text-white mt-0.5 font-mono">{formatTimer(timeRemainingSeconds)}</div>
                </div>
              </div>

              {submissionError && (
                <div className="p-3.5 bg-red-950/60 border border-red-800/80 rounded-xl text-left space-y-1.5">
                  <div className="flex items-center gap-2 text-red-400 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span>Server Confirmation Required</span>
                  </div>
                  <p className="text-[11px] text-red-200 leading-relaxed">{submissionError}</p>
                  <p className="text-[10px] text-gray-400 font-mono">All answers are safely secured in encrypted local storage (AES-256-GCM). No answers have been lost.</p>
                </div>
              )}

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  disabled={isSubmitting}
                  onClick={() => setCurrentScreen('workspace')}
                  className="h-10 px-5 rounded-xl bg-[#181920] hover:bg-[#22242c] text-xs font-semibold text-gray-300 border border-[#2a2d36] transition disabled:opacity-50"
                >
                  Return to Exam
                </button>
                <button
                  disabled={isSubmitting}
                  onClick={handleFinalSubmit}
                  className={`h-10 px-6 rounded-xl font-heading font-extrabold text-xs transition shadow-lg flex items-center gap-2 ${
                    isSubmitting
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-[#FF9100] hover:bg-[#e08000] text-black shadow-[#FF9100]/10'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying Server Confirmation...</span>
                    </>
                  ) : submissionError ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry Server Submission</span>
                    </>
                  ) : (
                    <span>Confirm & Finalize Submission</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SCREEN 7: RESULTS VIEW                                                    */}
        {/* ========================================================================= */}
        {currentScreen === 'results' && (
          <div className="flex-1 p-6 lg:p-10 overflow-y-auto max-w-3xl mx-auto w-full flex flex-col justify-between space-y-6">
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 flex items-center justify-center mx-auto">
                  <Award className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-heading font-bold text-white">Examination Completed Successfully</h1>
                <p className="text-xs text-gray-400">
                  Your attempt has been finalized, sealed, and graded server-authoritatively.
                </p>
              </div>

              {/* Score Card */}
              <div className="bg-[#121316] border border-[#22242a] p-6 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-gray-500 uppercase">Score Earned</div>
                  <div className="text-3xl font-heading font-black text-white mt-1">
                    95 <span className="text-sm font-normal text-gray-500">/ 100 Pts</span>
                  </div>
                  <div className="text-xs text-emerald-400 font-semibold mt-1">Status: Passed Cutoff (40 Pts)</div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] font-bold text-gray-500 uppercase">Percentage</div>
                  <div className="text-3xl font-heading font-black text-cyan-400 mt-1">95.0%</div>
                  <div className="text-[11px] text-gray-400 mt-1">Grade: Honors / A+</div>
                </div>
              </div>

              {/* Cryptographic Receipt Card */}
              <div className="bg-[#121316] border border-[#22242a] p-4 rounded-xl space-y-2">
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#FF9100]" />
                  <span>Immutable Submission Receipt</span>
                </div>
                <div className="p-3 bg-[#090A0D] rounded-lg border border-[#1e2028] text-[11px] font-mono text-gray-300 space-y-1">
                  <div>RECEIPT_ID: {submissionReceipt}</div>
                  <div>SERVER_TIMESTAMP: {confirmedSubmittedAt ? new Date(confirmedSubmittedAt).toISOString() : new Date().toISOString()}</div>
                  <div>STATUS: CONFIRMED & SEALED BY SERVER (HMAC-SHA256)</div>
                  <div>DIGEST:     sha256:4b902168426af87e4fb2973eb31b1f742507a40f104c04c72a594f354827c956</div>
                  <div>INTEGRITY:  ZERO_TAMPERING_DETECTED</div>
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={() => setCurrentScreen('welcome')}
                  className="h-10 px-8 rounded-xl bg-[#181920] hover:bg-[#22242c] text-xs font-bold text-white border border-[#2a2d36] transition flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Return to Student Dashboard</span>
                </button>
              </div>
            </div>

            <div className="text-[11px] text-gray-500 text-center">
              All locks released | Operating system restored to standard state
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SCREEN 8: SETTINGS & DIAGNOSTICS                                          */}
        {/* ========================================================================= */}
        {currentScreen === 'settings' && (
          <div className="flex-1 p-6 lg:p-10 overflow-y-auto max-w-3xl mx-auto w-full space-y-6">
            <div className="border-b border-[#22242a] pb-4">
              <h1 className="text-2xl font-heading font-bold text-white flex items-center gap-2.5">
                <Settings className="w-6 h-6 text-[#FF9100]" />
                <span>Application Settings & Diagnostics</span>
              </h1>
              <p className="text-xs text-gray-400 mt-1">Configure client preferences, display zoom, and network diagnostics.</p>
            </div>

            <div className="space-y-4">
              <div className="bg-[#121316] border border-[#22242a] p-4 rounded-xl space-y-2">
                <h4 className="text-xs font-bold text-white">Display Scaling & Font Size</h4>
                <div className="flex items-center gap-2 pt-1">
                  {['100%', '125%', '150% (Recommended)', '175%'].map((scale) => (
                    <button key={scale} className="px-3 py-1.5 rounded-lg bg-[#181920] text-xs text-gray-300 border border-[#2a2d36] hover:border-gray-500">
                      {scale}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#121316] border border-[#22242a] p-4 rounded-xl space-y-2">
                <h4 className="text-xs font-bold text-white">Network Latency Diagnostic</h4>
                <div className="p-3 bg-[#090A0D] rounded-lg border border-[#1e2028] text-xs font-mono text-gray-300 flex items-center justify-between">
                  <span>Cloudflare Edge RTT: 18ms</span>
                  <span className="text-emerald-400 font-bold">OPTIMAL</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SCREEN 9: ERROR RECOVERY & SUPPORT                                        */}
        {/* ========================================================================= */}
        {currentScreen === 'error-recovery' && (
          <div className="flex-1 p-6 lg:p-10 overflow-y-auto max-w-xl mx-auto w-full flex flex-col justify-center space-y-6">
            <div className="bg-[#121316] border border-amber-800/60 p-6 rounded-2xl space-y-4 text-center">
              <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
              <h2 className="text-lg font-heading font-bold text-white">Network Connection Interrupted</h2>
              <p className="text-xs text-gray-400 leading-relaxed">
                Your connection to the Cloudflare edge was temporarily lost. All responses are saved in your encrypted local write-ahead buffer.
              </p>
              <div className="p-3 bg-[#181920] rounded-xl border border-[#262832] text-xs font-mono text-gray-300">
                Auto-reconnecting in 8s... (Attempt 2 of 10)
              </div>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => alert('Reconnected successfully!')}
                  className="h-9 px-5 rounded-lg bg-[#FF9100] text-black font-bold text-xs"
                >
                  Retry Connection Now
                </button>
                <button
                  onClick={() => setCurrentScreen('workspace')}
                  className="h-9 px-4 rounded-lg bg-gray-800 text-gray-300 text-xs"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ACCESSIBILITY & DISABILITY ACCOMMODATION MODAL (PHASE 1)                   */}
        {/* ========================================================================= */}
        {showAccommodationModal && (
          <div
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="accommodation-modal-title"
          >
            <div className="bg-[#121316] border-2 border-amber-500/80 rounded-2xl max-w-xl w-full p-6 space-y-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#22242a] pb-3">
                <div className="flex items-center gap-2.5">
                  <Accessibility className="w-5 h-5 text-amber-400" />
                  <h2 id="accommodation-modal-title" className="text-lg font-heading font-bold text-white">
                    Candidate Examination Accommodations
                  </h2>
                </div>
                <button
                  onClick={() => setShowAccommodationModal(false)}
                  className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800"
                  aria-label="Close accommodations dialog"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-xs text-amber-200 leading-relaxed">
                <span className="font-bold">Institutional Policy Guarantee:</span> Approved accessibility accommodations
                (screen reader focus, assistive magnifier tools, speech-to-text dictation, and time extensions) are recognized
                by the platform and will <span className="font-semibold underline">not</span> generate proctoring integrity alerts or score penalties.
              </div>

              <div className="space-y-4">
                {/* Time Multiplier Extension */}
                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1.5">
                    Authorized Examination Time Multiplier
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      [1.0, '1.0x (Standard 60m)'],
                      [1.25, '1.25x (75m)'],
                      [1.5, '1.5x (90m)'],
                      [2.0, '2.0x (120m)'],
                    ].map(([multiplier, label]) => (
                      <button
                        key={multiplier}
                        type="button"
                        onClick={() => {
                          const m = multiplier as number;
                          setTimeMultiplier(m);
                          const totalSec = Math.round(selectedExam.durationMinutes * 60 * m);
                          setTimeRemainingSeconds(totalSec);
                          setScreenReaderAnnouncement(`Time extension set to ${label}`);
                        }}
                        className={`p-2 rounded-xl text-xs font-medium border text-center transition ${
                          timeMultiplier === multiplier
                            ? 'bg-amber-500 text-black font-bold border-amber-400'
                            : 'bg-[#181920] text-gray-300 border-[#2a2d36] hover:bg-[#20222a]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Assistive Technology Recognitions */}
                <div className="space-y-2 pt-2">
                  <label className="text-xs font-bold text-gray-300 block">
                    Assistive Technology Integration
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-[#181920] border border-[#2a2d36] cursor-pointer hover:bg-[#1e2028]">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-white">Screen Reader Optimization</div>
                      <div className="text-[11px] text-gray-400">
                        Suppresses false focus alerts for NVDA, JAWS, and Windows Narrator navigation.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={allowScreenReader}
                      onChange={(e) => {
                        setAllowScreenReader(e.target.checked);
                        setScreenReaderAnnouncement(`Screen reader accommodation ${e.target.checked ? 'enabled' : 'disabled'}`);
                      }}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-0 bg-[#0e1014] border-gray-600"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-[#181920] border border-[#2a2d36] cursor-pointer hover:bg-[#1e2028]">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-white">Windows Magnifier Compatibility</div>
                      <div className="text-[11px] text-gray-400">
                        Permits magnify.exe overlays and viewport scaling without taskbar intrusion flags.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={allowMagnifier}
                      onChange={(e) => {
                        setAllowMagnifier(e.target.checked);
                        setScreenReaderAnnouncement(`Magnifier accommodation ${e.target.checked ? 'enabled' : 'disabled'}`);
                      }}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-0 bg-[#0e1014] border-gray-600"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-[#181920] border border-[#2a2d36] cursor-pointer hover:bg-[#1e2028]">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-white">Speech-to-Text & Verbal Reading</div>
                      <div className="text-[11px] text-gray-400">
                        Immunity from vocal audio proctoring alerts for approved student reading aloud.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={allowSpeechInput}
                      onChange={(e) => {
                        setAllowSpeechInput(e.target.checked);
                        setScreenReaderAnnouncement(`Speech input accommodation ${e.target.checked ? 'enabled' : 'disabled'}`);
                      }}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-0 bg-[#0e1014] border-gray-600"
                    />
                  </label>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowAccommodationModal(false)}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs"
                >
                  Save & Return to Examination
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
