/**
 * In-Browser Lecture & Meeting Recording Hook (Zero-Cost Client MediaRecorder)
 *
 * Records live classroom audio, video, and screen sharing directly to the user's
 * computer using hardware-accelerated MediaRecorder API with zero cloud storage fees.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseLectureRecorderOptions {
  roomId?: string;
  onRecordingStart?: () => void;
  onRecordingStop?: (blob: Blob) => void;
  onNotification?: (msg: string) => void;
}

export interface LectureRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  durationSec: number;
  formattedDuration: string;
  error: string | null;
  startRecording: (stream?: MediaStream | null) => Promise<boolean>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
}

export function useLectureRecorder(options: UseLectureRecorderOptions = {}): LectureRecorderState {
  const { roomId = 'lecture', onRecordingStart, onRecordingStop, onNotification } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);

  // Format seconds to HH:MM:SS
  const formatDuration = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.warn('[LectureRecorder] Error stopping MediaRecorder:', err);
      }
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsRecording(false);
    setIsPaused(false);
  }, []);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
      } catch (err) {
        console.warn('[LectureRecorder] Pause error:', err);
      }
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      try {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
        timerIntervalRef.current = setInterval(() => {
          setDurationSec((prev) => prev + 1);
        }, 1000);
      } catch (err) {
        console.warn('[LectureRecorder] Resume error:', err);
      }
    }
  }, []);

  const startRecording = useCallback(
    async (providedStream?: MediaStream | null): Promise<boolean> => {
      setError(null);
      recordedChunksRef.current = [];

      if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
        const msg = 'MediaRecorder is not supported in this browser.';
        setError(msg);
        onNotification?.(msg);
        return false;
      }

      let captureStream: MediaStream | null = providedStream || null;

      // If no stream provided, prompt user to pick screen / window with audio
      if (!captureStream) {
        try {
          if (navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
            captureStream = await navigator.mediaDevices.getDisplayMedia({
              video: { frameRate: { ideal: 30 } },
              audio: true,
            });
          }
        } catch (e: any) {
          const msg = e?.name === 'NotAllowedError' ? 'Screen capture permission was cancelled.' : 'Failed to capture screen stream.';
          setError(msg);
          onNotification?.(msg);
          return false;
        }
      }

      if (!captureStream || captureStream.getTracks().length === 0) {
        const msg = 'No active audio or video stream available to record.';
        setError(msg);
        onNotification?.(msg);
        return false;
      }

      recordingStreamRef.current = captureStream;

      // Listen for when user stops sharing display via browser native chrome UI
      const videoTrack = captureStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.addEventListener('ended', () => {
          stopRecording();
        });
      }

      // Determine best supported MIME type with comprehensive Safari/WebKit & Chromium/Firefox compatibility
      const candidateTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/mp4;codecs=avc1',
        'video/mp4',
      ];
      let mimeType = '';
      if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
        for (const type of candidateTypes) {
          if (MediaRecorder.isTypeSupported(type)) {
            mimeType = type;
            break;
          }
        }
      }

      try {
        const recorder = mimeType ? new MediaRecorder(captureStream, { mimeType }) : new MediaRecorder(captureStream);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };

        recorder.onstop = () => {
          const recordedChunks = recordedChunksRef.current;
          if (recordedChunks.length > 0) {
            const effectiveMime = recorder.mimeType || mimeType || 'video/webm';
            const finalBlob = new Blob(recordedChunks, { type: effectiveMime });
            onRecordingStop?.(finalBlob);

            // Automatically trigger local file download
            const url = URL.createObjectURL(finalBlob);
            const a = document.createElement('a');
            const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const isMp4 = effectiveMime.toLowerCase().includes('mp4');
            const ext = isMp4 ? 'mp4' : 'webm';
            a.href = url;
            a.download = `cortex_lecture_${roomId}_${dateStr}.${ext}`;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }, 100);

            onNotification?.(`Lecture recording saved (${(finalBlob.size / (1024 * 1024)).toFixed(1)} MB)`);
          }

          // Clean up stream tracks
          if (recordingStreamRef.current) {
            recordingStreamRef.current.getTracks().forEach((t) => {
              if (t.readyState === 'live') {
                t.stop();
              }
            });
            recordingStreamRef.current = null;
          }
        };

        recorder.start(1000); // 1-second chunks
        setIsRecording(true);
        setIsPaused(false);
        setDurationSec(0);

        timerIntervalRef.current = setInterval(() => {
          setDurationSec((prev) => prev + 1);
        }, 1000);

        onRecordingStart?.();
        onNotification?.('Lecture recording started');
        return true;
      } catch (err: any) {
        const msg = `Recording Initialization Error: ${err?.message || 'Failed to start MediaRecorder'}`;
        setError(msg);
        onNotification?.(msg);
        return false;
      }
    },
    [roomId, onRecordingStart, onRecordingStop, onNotification, stopRecording]
  );

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch (_) {}
      }
      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return {
    isRecording,
    isPaused,
    durationSec,
    formattedDuration: formatDuration(durationSec),
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  };
}
