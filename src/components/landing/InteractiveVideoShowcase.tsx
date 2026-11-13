'use client';

/**
 * InteractiveVideoShowcase Component
 *
 * Antigravity-inspired live representation video showcase.
 * Plays the full, unedited representation video in an infinite seamless loop
 * with hardware acceleration, in-memory Blob zero-latency caching,
 * and adaptive audio/playback controls.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sparkles,
  MonitorPlay,
} from 'lucide-react';
import { useTheme } from './ThemeContext';

export const InteractiveVideoShowcase: React.FC<{ isDark?: boolean }> = ({ isDark: propIsDark }) => {
  const themeContext = useTheme();
  const isDark = propIsDark !== undefined ? propIsDark : themeContext.isDark;

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(17);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [videoSrc, setVideoSrc] = useState<string>('/videos/finalcortex.mp4');
  const [blobReady, setBlobReady] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const theaterRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Background in-memory Blob caching for 100% zero-latency, infinite seamless looping
  useEffect(() => {
    let active = true;
    let blobUrl: string | null = null;

    async function loadSeamlessBlob() {
      try {
        const [res0, res1] = await Promise.all([
          fetch('/videos/finalcortex.part0.mp4'),
          fetch('/videos/finalcortex.part1.mp4'),
        ]);

        if (!res0.ok || !res1.ok) return;

        const [buf0, buf1] = await Promise.all([
          res0.arrayBuffer(),
          res1.arrayBuffer(),
        ]);

        if (!active) return;

        const combinedBlob = new Blob([buf0, buf1], { type: 'video/mp4' });
        blobUrl = URL.createObjectURL(combinedBlob);

        if (videoRef.current) {
          const currentPos = videoRef.current.currentTime;
          const wasPlaying = !videoRef.current.paused;

          videoRef.current.src = blobUrl;
          videoRef.current.currentTime = currentPos;
          if (wasPlaying) {
            videoRef.current.play().catch(() => {});
          }
        }
        setVideoSrc(blobUrl);
        setBlobReady(true);
      } catch (err) {
        // Fall back to direct stream on /videos/finalcortex.mp4
        console.warn('Seamless blob pre-cache deferred, streaming via edge worker:', err);
      }
    }

    loadSeamlessBlob();

    return () => {
      active = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, []);

  // Autoplay insurance: ensure uninterrupted playback across all browser policies
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    const playPromise = video.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
        })
        .catch(() => {
          setIsPlaying(false);
          // Retry on first user interaction anywhere on the page
          const handleFirstInteraction = () => {
            if (videoRef.current) {
              videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
            }
            window.removeEventListener('click', handleFirstInteraction);
            window.removeEventListener('scroll', handleFirstInteraction);
          };
          window.addEventListener('click', handleFirstInteraction, { once: true });
          window.addEventListener('scroll', handleFirstInteraction, { once: true });
        });
    }
  }, []);

  // Loop enforcement: guarantees video never halts at boundary
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      if (videoRef.current.duration && !isNaN(videoRef.current.duration)) {
        setDuration(videoRef.current.duration);
      }
    }
  };

  const handleEnded = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const toggleFullscreen = () => {
    if (!theaterRef.current) return;
    if (!document.fullscreenElement) {
      theaterRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(() => {});
    }
  };

  const handleReplay = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const targetTime = pos * duration;
    videoRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 2800);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <section
      id="showcase"
      className={`relative w-full overflow-hidden border-b py-20 transition-colors duration-300 ${
        isDark
          ? 'bg-[#08090A] border-white/[0.08]'
          : 'bg-[#F8FAFC] border-zinc-200/80'
      }`}
    >
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[850px] h-[400px] bg-gradient-to-b from-[#FF9100]/10 via-[#FF3D00]/5 to-transparent blur-3xl opacity-50 dark:opacity-30" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header Block */}
        <div className="mx-auto max-w-4xl text-center mb-10">
          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1 font-mono text-[11px] font-bold tracking-widest ${
              isDark
                ? 'border-[#FF9100]/40 bg-[#FF9100]/10 text-[#FF9100]'
                : 'border-[#FF9100]/40 bg-[#FF9100]/10 text-[#FF9100]'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF9100] animate-pulse" />
            <span>LIVE PLATFORM DEMONSTRATION // CONTINUOUS LOOP</span>
          </div>

          <h2
            className={`mt-4 text-3xl sm:text-5xl font-extrabold tracking-tight ${
              isDark ? 'text-white' : 'text-zinc-950'
            }`}
          >
            Cortex in Motion
          </h2>

          <p
            className={`mt-3 text-sm sm:text-base font-medium max-w-2xl mx-auto leading-relaxed ${
              isDark ? 'text-zinc-400' : 'text-zinc-700'
            }`}
          >
            Watch the complete unedited interactive demonstration of the unified Cortex ecosystem
            running in real-time edge playback.
          </p>
        </div>

        {/* Cinematic Device / Theater Frame */}
        <div
          ref={theaterRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setShowControls(false)}
          className={`relative mx-auto max-w-5xl overflow-hidden rounded-2xl border shadow-2xl transition-all duration-300 ${
            isDark
              ? 'border-white/[0.14] bg-[#0E0F14] shadow-[0_0_60px_rgba(0,0,0,0.8)]'
              : 'border-zinc-300 bg-black shadow-[0_20px_50px_rgba(0,0,0,0.15)]'
          }`}
        >
          {/* Top Window Bar */}
          <div
            className={`flex items-center justify-between px-4 py-2.5 border-b select-none ${
              isDark
                ? 'border-white/[0.08] bg-[#0A0B0E]'
                : 'border-white/[0.12] bg-[#14151A]'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
              <span className="ml-3 font-mono text-[11px] font-semibold text-zinc-400">
                cortex-live-demonstration.mp4
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{blobReady ? 'ZERO-LATENCY LOOP' : 'STREAMING'}</span>
              </div>
              <span className="font-mono text-[10px] text-zinc-500 hidden sm:inline">
                1080P // 60 FPS
              </span>
            </div>
          </div>

          {/* HTML5 Video Display Container */}
          <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              src={videoSrc}
              autoPlay
              loop
              muted={isMuted}
              playsInline
              preload="auto"
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleEnded}
              onWaiting={() => setIsBuffering(true)}
              onPlaying={() => setIsBuffering(false)}
              onClick={togglePlay}
              className="h-full w-full object-contain cursor-pointer"
            />

            {/* Buffering Indicator */}
            {isBuffering && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black/80 border border-white/10 text-white font-mono text-xs">
                  <div className="w-4 h-4 border-2 border-[#FF9100] border-t-transparent rounded-full animate-spin" />
                  <span>Buffering Stream...</span>
                </div>
              </div>
            )}

            {/* Floating Play Overlay when paused */}
            {!isPlaying && (
              <button
                onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px] group transition-all"
                aria-label="Play video"
              >
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[#FF9100] text-black shadow-lg transform group-hover:scale-110 transition-transform">
                  <Play className="w-7 h-7 fill-black ml-1" />
                </div>
              </button>
            )}

            {/* Bottom Controls Bar (Fades out when inactive) */}
            <div
              className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 ${
                showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              {/* Scrubbable Progress Bar */}
              <div
                onClick={handleSeek}
                className="group relative h-1.5 w-full bg-white/20 hover:h-2.5 rounded-full cursor-pointer transition-all mb-3"
              >
                <div
                  className="h-full bg-[#FF9100] rounded-full transition-all relative"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                >
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white opacity-0 group-hover:opacity-100 shadow-md transition-opacity" />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between text-white text-xs font-mono">
                <div className="flex items-center gap-3">
                  <button
                    onClick={togglePlay}
                    className="p-1.5 hover:bg-white/10 rounded transition-colors"
                    aria-label={isPlaying ? 'Pause video' : 'Play video'}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                  </button>

                  <button
                    onClick={toggleMute}
                    className="p-1.5 hover:bg-white/10 rounded transition-colors"
                    aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
                  >
                    {isMuted ? (
                      <VolumeX className="w-4 h-4 text-zinc-400" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-[#FF9100]" />
                    )}
                  </button>

                  <span className="text-[11px] text-zinc-300">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-white/10 text-[10px] text-zinc-300 font-mono">
                    UNEDITED // FULL DEMO
                  </span>

                  <button
                    onClick={handleReplay}
                    className="p-1.5 hover:bg-white/10 rounded transition-colors"
                    aria-label="Replay from beginning"
                    title="Replay from start"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <button
                    onClick={toggleFullscreen}
                    className="p-1.5 hover:bg-white/10 rounded transition-colors"
                    aria-label="Toggle Fullscreen"
                    title="Toggle Fullscreen"
                  >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Telemetry Footer */}
          <div
            className={`px-5 py-3 border-t flex flex-wrap items-center justify-between gap-4 select-none ${
              isDark ? 'bg-[#0A0B0E] border-white/[0.08]' : 'bg-[#14151A] border-white/[0.1]'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs font-bold text-[#FF9100]">
                CORTEX LIVE FEED
              </span>
              <span className="font-mono text-[11px] text-zinc-400">
                Hardware-accelerated continuous playback // 100% unedited source recording
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="font-mono text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
                Continuous Infinite Loop Active
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
