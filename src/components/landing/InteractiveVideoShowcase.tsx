'use client';

/**
 * InteractiveVideoShowcase Component
 * 
 * Antigravity-inspired interactive scrollytelling video theater.
 * Features device frame, multi-channel video switching, HTML5 video controls,
 * custom timeline scrubber, and ambient InteractiveWavesBackground physics.
 */

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Minimize2, 
  RotateCcw, 
  Sparkles, 
  Terminal, 
  BookOpen, 
  ShieldAlert, 
  CheckCircle2,
  Sliders,
  ChevronRight
} from 'lucide-react';
import { InteractiveWavesBackground } from '@/components/ui/InteractiveWavesBackground';
import { useTheme } from './ThemeContext';

interface VideoChannel {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  src: string;
  durationLabel: string;
  aspectRatio: string;
  highlights: string[];
  productLink: string;
  productLabel: string;
}

const CHANNELS: VideoChannel[] = [
  {
    id: 'ide-runtimes',
    badge: '01 // CORTEX CLOUD IDE',
    title: 'Cloud IDE & Compiler Engine',
    subtitle: '16+ isolated sandbox runtimes (C++, Python, Rust, Go, TS) with Monaco syntax highlighting, step debugging, and sub-50ms compilation.',
    src: '/videos/cortex-brand-showcase.mp4',
    durationLabel: '00:26 // 30 FPS',
    aspectRatio: 'aspect-video',
    highlights: [
      '16+ isolated sandbox language runtimes',
      'Zero-latency Monaco editor with live diagnostics',
      'Sub-50ms Cloudflare edge compilation & execution',
      'Interactive stdout/stderr streaming terminal'
    ],
    productLink: '/ide',
    productLabel: 'Launch Cloud IDE'
  },
  {
    id: 'classroom-studio',
    badge: '02 // CORTEX LIVE CLASSROOM',
    title: 'Collaborative Code Studio',
    subtitle: 'Real-time multi-cursor CRDT code sharing, live teacher broadcast stage, interactive whiteboard, and automated assignment test execution.',
    src: '/videos/cortex-screen-recording.mp4',
    durationLabel: '00:26 // 30 FPS',
    aspectRatio: 'aspect-video',
    highlights: [
      'Conflict-free Replicated Data Type (CRDT) multi-cursor sync',
      'Low-latency WebRTC audio/video stage & whiteboard',
      'Automated grading test suite with instant feedback',
      'Multi-tenant class rosters & breakout permissions'
    ],
    productLink: '/classroom',
    productLabel: 'Open Classroom'
  },
  {
    id: 'browser-lockdown',
    badge: '03 // CORTEX BROWSER',
    title: 'Hardened Lockdown Kiosk',
    subtitle: 'Tamper-resistant Windows examination security engine enforcing hardware screen-capture masking, low-level keyboard interception, and continuous process watchdog.',
    src: '/videos/cortex-brand-showcase.mp4',
    durationLabel: '00:26 // 30 FPS',
    aspectRatio: 'aspect-video',
    highlights: [
      'SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE) GPU mask',
      'WH_KEYBOARD_LL low-level kernel hotkey interception',
      '1,500ms kernel watchdog scanning 40+ prohibited binaries',
      'Cloudflare D1 10-second transactional integrity checkpoint'
    ],
    productLink: '/lockdown',
    productLabel: 'Inspect Security Engine'
  },
  {
    id: 'neural-branding',
    badge: '04 // 3D BRAND IDENTITY',
    title: 'Procedural Neural Geometry',
    subtitle: 'Volumetric GPU neon photon emission shaders and kinetic 3D typography capturing the speed and precision of universal execution.',
    src: '/videos/cortex-logo-reveal.mp4',
    durationLabel: '00:08 // 60 FPS',
    aspectRatio: 'aspect-video',
    highlights: [
      'Procedural vector geometry rendered at 60 FPS via WebGL',
      'Quantum amber photon emission model (#FF9100)',
      'Adaptive high-contrast light and dark mode grading',
      'Pointer-reactive glow tracking and spring physics'
    ],
    productLink: '/ide',
    productLabel: 'Explore Platform'
  }
];

export const InteractiveVideoShowcase: React.FC<{ isDark?: boolean }> = ({ isDark: propIsDark }) => {
  const themeContext = useTheme();
  const isDark = propIsDark !== undefined ? propIsDark : themeContext.isDark;
  const [activeChannelIndex, setActiveChannelIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showControls, setShowControls] = useState<boolean>(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const theaterRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentChannel = CHANNELS[activeChannelIndex];

  // Auto-switch channel playback
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.playbackRate = playbackSpeed;
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        // Autoplay policy prevented playback, keep paused
        setIsPlaying(false);
      });
    }
  }, [activeChannelIndex, playbackSpeed]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      if (videoRef.current.duration && !isNaN(videoRef.current.duration)) {
        setDuration(videoRef.current.duration);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      videoRef.current.playbackRate = playbackSpeed;
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {});
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

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    videoRef.current.currentTime = pos * duration;
    setCurrentTime(pos * duration);
  };

  const handleSpeedCycle = () => {
    const speeds = [1, 1.25, 1.5, 2];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackSpeed(nextSpeed);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextSpeed;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <section 
      id="showcase" 
      data-testid="interactive-video-showcase"
      className={`relative scroll-mt-28 py-24 sm:py-32 overflow-hidden transition-colors duration-300 ${
        isDark 
          ? 'bg-[#08090A] text-[#E6EDF3]' 
          : 'bg-[#FFFFFF] text-zinc-950'
      }`}
    >
      {/* Background Ambient Wave Layer */}
      <div className={`absolute inset-0 pointer-events-none ${isDark ? 'opacity-30' : 'opacity-85'}`}>
        <InteractiveWavesBackground 
          lineColor={isDark ? 'rgba(255, 145, 0, 0.35)' : '#000000'}
          lineWidth={isDark ? 1.1 : 1.25}
          waveSpeedX={0.015}
          waveSpeedY={0.008}
          waveAmpX={36}
          waveAmpY={18}
          xGap={10}
          yGap={32}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium tracking-widest uppercase mb-4 border transition-colors shadow-sm bg-orange-500/10 text-[#FF9100] border-[#FF9100]/30">
            <Sparkles className="w-3.5 h-3.5 text-[#FF9100]" />
            <span>00 // INTERACTIVE SHOWCASE // CODE BEYOND LIMITS</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-heading font-extrabold tracking-tight mb-4 uppercase">
            EXPERIENCE THE PLATFORM IN MOTION
          </h2>

          <p className={`text-sm sm:text-base leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
            Three specialized engineering tiers orchestrated into one unified codebase.
            Inspect high-fidelity cinematic captures, volumetric branding, and live execution telemetry.
          </p>
        </div>

        {/* Video Channel Selector Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-8">
          {CHANNELS.map((ch, idx) => {
            const active = idx === activeChannelIndex;
            return (
              <button
                key={ch.id}
                onClick={() => setActiveChannelIndex(idx)}
                className={`group relative px-4 py-2.5 rounded-xl text-xs font-mono tracking-wider transition-all duration-200 border flex items-center gap-2.5 ${
                  active
                    ? isDark
                      ? 'bg-[#15161C] border-[#FF9100] text-white shadow-[0_0_20px_rgba(255,145,0,0.25)]'
                      : 'bg-white border-orange-500 text-zinc-900 shadow-lg shadow-orange-500/10'
                    : isDark
                      ? 'bg-[#0D0E12]/80 border-[#1F2026] text-zinc-400 hover:text-white hover:border-zinc-700'
                      : 'bg-white/80 border-slate-200 text-zinc-600 hover:text-zinc-900 hover:border-slate-300'
                }`}
              >
                <span className={`w-2 h-2 rounded-full transition-colors ${
                  active ? 'bg-[#FF9100] animate-pulse' : 'bg-zinc-500'
                }`} />
                <span className="font-semibold">{ch.badge}</span>
                <span className={`hidden sm:inline text-[11px] opacity-75`}>
                  [{ch.durationLabel.split('//')[0].trim()}]
                </span>
              </button>
            );
          })}
        </div>

        {/* Device Theater Window */}
        <div
          ref={theaterRef}
          onMouseEnter={() => setShowControls(true)}
          onMouseMove={() => {
            setShowControls(true);
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
            controlsTimeoutRef.current = setTimeout(() => {
              if (isPlaying) setShowControls(false);
            }, 3000);
          }}
          className={`relative rounded-2xl overflow-hidden border transition-all duration-300 shadow-2xl ${
            isDark
              ? 'bg-[#070708] border-[#1F2024] shadow-black/80'
              : 'bg-white border-slate-200 shadow-orange-500/5'
          }`}
        >
          {/* Hardware Window Title Bar */}
          <div className={`px-4 py-3 border-b flex items-center justify-between transition-colors ${
            isDark ? 'bg-[#111216] border-[#1F2024]' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
              <div className="h-4 w-px bg-zinc-700/40 mx-2" />
              <span className={`text-xs font-mono font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                cortex-theater://{currentChannel.id}.mp4
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>HARDWARE ACCELERATED</span>
              </span>
              <span className={`text-[11px] font-mono hidden sm:inline ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                {currentChannel.durationLabel}
              </span>
            </div>
          </div>

          {/* HTML5 Video Canvas Stage */}
          <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden group">
            <video
              ref={videoRef}
              src={currentChannel.src}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onClick={togglePlay}
              muted={isMuted}
              autoPlay
              loop
              playsInline
              className="w-full h-full object-cover cursor-pointer"
            />

            {/* Center Play/Pause Overlay Indicator on Pause */}
            {!isPlaying && (
              <button
                onClick={togglePlay}
                aria-label="Play video"
                className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs transition-opacity"
              >
                <div className="w-20 h-20 rounded-full bg-[#FF9100] text-black flex items-center justify-center shadow-2xl transform hover:scale-110 transition-transform">
                  <Play className="w-8 h-8 ml-1 fill-black" />
                </div>
              </button>
            )}

            {/* Bottom Floating Control Bar */}
            <div 
              className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-opacity duration-300 ${
                showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              {/* Interactive Timeline Scrubber */}
              <div 
                onClick={handleSeek}
                className="relative h-2 w-full bg-white/20 hover:h-3 rounded-full cursor-pointer mb-3 transition-all overflow-hidden"
              >
                <div 
                  className="absolute left-0 top-0 bottom-0 bg-[#FF9100] transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Control Buttons */}
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
                    aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4 text-zinc-400" /> : <Volume2 className="w-4 h-4 text-[#FF9100]" />}
                  </button>

                  <span className="text-[11px] text-zinc-300">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Speed Switcher */}
                  <button
                    onClick={handleSpeedCycle}
                    className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[10px] font-bold tracking-wider transition-colors"
                    title="Toggle playback speed"
                  >
                    {playbackSpeed}x
                  </button>

                  {/* Reset to Start */}
                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.currentTime = 0;
                        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
                      }
                    }}
                    className="p-1.5 hover:bg-white/10 rounded transition-colors"
                    aria-label="Replay from start"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  {/* Fullscreen Toggle */}
                  <button
                    onClick={toggleFullscreen}
                    className="p-1.5 hover:bg-white/10 rounded transition-colors"
                    aria-label="Toggle Fullscreen"
                  >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Contextual Video Channel Details & Deep Dive */}
          <div className={`p-6 sm:p-8 border-t grid grid-cols-1 lg:grid-cols-3 gap-6 items-center transition-colors ${
            isDark ? 'bg-[#070708] border-[#1F2024]' : 'bg-slate-50/80 border-slate-200'
          }`}>
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center gap-2 text-xs font-mono text-[#FF9100]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF9100]" />
                <span>{currentChannel.badge}</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-heading font-bold">
                {currentChannel.title}
              </h3>
              <p className={`text-sm leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                {currentChannel.subtitle}
              </p>

              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                {currentChannel.highlights.map((highlight, hIdx) => (
                  <div key={hIdx} className="flex items-center gap-2 text-zinc-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className={isDark ? 'text-zinc-300' : 'text-zinc-700'}>{highlight}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 justify-end items-stretch">
              <Link
                href={currentChannel.productLink}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-mono font-bold tracking-wider bg-[#FF9100] text-black hover:bg-[#FFA726] transition-all duration-200 shadow-[0_0_20px_rgba(255,145,0,0.3)] hover:shadow-[0_0_25px_rgba(255,145,0,0.5)]"
              >
                <span>{currentChannel.productLabel}</span>
                <ChevronRight className="w-4 h-4" />
              </Link>

              <div className={`text-[11px] font-mono text-center ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                Hardware acceleration active // HTML5 Canvas & WebGL enabled
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
