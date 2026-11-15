'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Shield,
  Lock,
  Terminal,
  Cpu,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  ArrowRight,
  HardDrive,
  Wifi,
  WifiOff,
  Download,
  Layers,
  Activity,
  Play,
  Monitor,
  Check,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { CortexLogo } from '@/components/brand/CortexLogo';

interface TelemetryEntry {
  id: string;
  timestamp: string;
  source: string;
  severity: 'INFO' | 'WARN' | 'CRITICAL' | 'SUCCESS';
  message: string;
}

export default function LockdownProductPage() {
  // Candidate Launch & Security States
  const [examToken, setExamToken] = useState('EXAM-2026-CS276');
  const [isFullscreenActive, setIsFullscreenActive] = useState(false);
  const [isObsBlackout, setIsObsBlackout] = useState(false);
  const [isKeyboardHookSimulated, setIsKeyboardHookSimulated] = useState(false);
  const [isWatchdogSimulated, setIsWatchdogSimulated] = useState(false);
  const [isNetworkOffline, setIsNetworkOffline] = useState(false);
  const [offlineBufferCount, setOfflineBufferCount] = useState(0);
  const [simulatedTime, setSimulatedTime] = useState(10);
  const [copiedLink, setCopiedLink] = useState(false);

  // Telemetry Log Stream
  const [telemetryLogs, setTelemetryLogs] = useState<TelemetryEntry[]>([
    {
      id: 'init-1',
      timestamp: '14:40:02.108',
      source: 'WIN32_KIOSK',
      severity: 'INFO',
      message: 'Native kiosk process initialized. TopMost=true, FormBorderStyle=None.',
    },
    {
      id: 'init-2',
      timestamp: '14:40:02.142',
      source: 'DISPLAY_AFFINITY',
      severity: 'SUCCESS',
      message: 'SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE) returned TRUE.',
    },
    {
      id: 'init-3',
      timestamp: '14:40:02.190',
      source: 'KEYBOARD_HOOK',
      severity: 'SUCCESS',
      message: 'Low-level keyboard hook (WH_KEYBOARD_LL) attached to thread message loop.',
    },
    {
      id: 'init-4',
      timestamp: '14:40:02.245',
      source: 'PROCESS_WATCHDOG',
      severity: 'INFO',
      message: 'Process watchdog daemon active. Blacklist database loaded (42 signatures).',
    },
    {
      id: 'init-5',
      timestamp: '14:40:02.310',
      source: 'STATE_ENGINE',
      severity: 'INFO',
      message: '10s auto-save sync loop armed. Edge transaction channel connected.',
    },
  ]);

  // Real Window Blur, Visibility & Fullscreen Telemetry
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        addLog(
          'PAGE_VISIBILITY',
          'WARN',
          '[BLUR DETECTED] Assessment window lost active foreground focus. Incident registered.'
        );
      }
    };
    const handleBlur = () => {
      addLog(
        'WINDOW_FOCUS',
        'WARN',
        '[FOCUS LOST] Candidate navigated away from active viewport or clicked secondary display.'
      );
    };
    const handleFullscreenChange = () => {
      const isFs = Boolean(document.fullscreenElement);
      setIsFullscreenActive(isFs);
      addLog(
        'FULLSCREEN_API',
        isFs ? 'SUCCESS' : 'WARN',
        isFs
          ? '[FULLSCREEN ENGAGED] Display locked to borderless workspace.'
          : '[FULLSCREEN DROPPED] Viewport restored to standard desktop window.'
      );
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Periodic Auto-save Simulation Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSimulatedTime((prev) => {
        if (prev <= 1) {
          if (isNetworkOffline) {
            setOfflineBufferCount((c) => c + 1);
            addLog(
              'STATE_ENGINE',
              'WARN',
              'Offline sync trigger: Transaction buffered to AES-GCM local ring storage.'
            );
          } else {
            addLog(
              'STATE_ENGINE',
              'SUCCESS',
              '10s Auto-save: State snapshot committed to Cloudflare D1 (latency: 14ms).'
            );
          }
          return 10;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isNetworkOffline]);

  const addLog = (
    source: string,
    severity: 'INFO' | 'WARN' | 'CRITICAL' | 'SUCCESS',
    message: string
  ) => {
    const now = new Date();
    const timeStr = now.toISOString().slice(11, 23);
    setTelemetryLogs((prev) => [
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: timeStr,
        source,
        severity,
        message,
      },
      ...prev.slice(0, 24),
    ]);
  };

  // Simulation Triggers
  const handleToggleObsBlackout = () => {
    const nextState = !isObsBlackout;
    setIsObsBlackout(nextState);
    if (nextState) {
      addLog(
        'WDA_EXCLUDEFROMCAPTURE',
        'CRITICAL',
        '[THREAT DETECTED] External screen capture / DWM hook detected. Display pipeline rendering 0x000000 black surface.'
      );
    } else {
      addLog(
        'WDA_EXCLUDEFROMCAPTURE',
        'INFO',
        'Direct3D presentation buffer restored to primary monitor workspace.'
      );
    }
  };

  const handleSimulateKeyboardHook = () => {
    setIsKeyboardHookSimulated(true);
    addLog(
      'WH_KEYBOARD_LL',
      'CRITICAL',
      '[BLOCKED] Intercepted VK_TAB + VK_MENU (Alt+Tab). Discarding keycode 0x09. Suppressed task-switch.'
    );
    setTimeout(() => {
      setIsKeyboardHookSimulated(false);
    }, 3500);
  };

  const handleSimulateWatchdog = () => {
    setIsWatchdogSimulated(true);
    addLog(
      'PROCESS_WATCHDOG',
      'CRITICAL',
      '[THREAT DETECTED] Blacklisted executable detected: "obs64.exe" (PID: 4912). Incident logged to D1 audit ledger.'
    );
    setTimeout(() => {
      setIsWatchdogSimulated(false);
    }, 4500);
  };

  const handleToggleNetwork = () => {
    const nextOffline = !isNetworkOffline;
    setIsNetworkOffline(nextOffline);
    if (nextOffline) {
      addLog(
        'STATE_ENGINE',
        'WARN',
        '[NETWORK DROP] Edge transport link severed. Switched to offline AES-GCM local ring buffer.'
      );
    } else {
      const synced = offlineBufferCount;
      setOfflineBufferCount(0);
      addLog(
        'STATE_ENGINE',
        'SUCCESS',
        `[NETWORK RESTORED] Edge link reconnected. ${synced} buffered snapshot(s) flushed and committed to D1 SQL.`
      );
    }
  };

  const handleToggleFullscreen = () => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {
        addLog('FULLSCREEN_API', 'WARN', 'Fullscreen request blocked by browser permissions policy.');
      });
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleTestKeyInterceptor = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const prohibitedKeys = ['F12', 'F11', 'Escape', 'Tab', 'Meta', 'Alt', 'PrintScreen'];
    if (prohibitedKeys.includes(e.key) || (e.ctrlKey && ['c', 'v', 'u', 'i', 'j'].includes(e.key.toLowerCase()))) {
      e.preventDefault();
      setIsKeyboardHookSimulated(true);
      addLog(
        'WH_KEYBOARD_LL',
        'CRITICAL',
        `[BLOCKED] Intercepted restricted key: ${e.key} (Ctrl: ${e.ctrlKey}, Alt: ${e.altKey}). Suppressed keycode propagation.`
      );
      setTimeout(() => setIsKeyboardHookSimulated(false), 3000);
    }
  };

  const handleLaunchNativeKiosk = () => {
    addLog(
      'KIOSK_PROTOCOL',
      'INFO',
      `Dispatching deep link: cortex-lockdown://launch?token=${encodeURIComponent(examToken)}`
    );
    if (typeof window !== 'undefined') {
      window.location.href = `cortex-lockdown://launch?token=${encodeURIComponent(examToken)}`;
    }
  };

  const handleResetSimulator = () => {
    setIsObsBlackout(false);
    setIsKeyboardHookSimulated(false);
    setIsWatchdogSimulated(false);
    setIsNetworkOffline(false);
    setOfflineBufferCount(0);
    setSimulatedTime(10);
    addLog('SIMULATOR_CORE', 'INFO', 'Security simulation state engine reset to idle baseline.');
  };

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#08090A] text-[#E6EDF3] flex flex-col font-sans select-none relative overflow-x-hidden">
      {/* Background Radial Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-gradient-to-b from-[#FF9100]/10 via-[#FF9100]/5 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* 1. Global Navigation Header */}
      <header className="h-14 border-b border-[#1F2024] bg-[#0B0C0E]/90 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center group transition" title="Cortex — Home">
            <CortexLogo variant="header" size="sm" />
          </Link>
          <div className="h-4 w-px bg-[#1F2024] hidden sm:block" />
          <div className="hidden sm:flex items-center gap-2">
            <span className="font-heading font-bold text-xs tracking-wider text-white">
              CORTEX BROWSER
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-[#FF9100]/10 text-[#FF9100] border border-[#FF9100]/30">
              PRODUCT 03
            </span>
          </div>
        </div>

        {/* Global Links */}
        <nav className="flex items-center gap-2 text-xs font-semibold">
          <Link
            href="/ide"
            className="px-2.5 py-1.5 rounded text-gray-400 hover:text-white hover:bg-[#16171C] transition hidden md:inline-flex items-center gap-1.5"
          >
            <span>Cloud IDE</span>
          </Link>
          <Link
            href="/classroom"
            className="px-2.5 py-1.5 rounded text-gray-400 hover:text-white hover:bg-[#16171C] transition hidden md:inline-flex items-center gap-1.5"
          >
            <span>Classroom Suite</span>
          </Link>
          <Link
            href="/lockdown/download"
            className="px-3 py-1.5 rounded bg-[#16171C] hover:bg-[#1F2026] text-gray-200 border border-[#2D3039] transition inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-[#FF9100]" />
            <span>Download Client</span>
          </Link>
          <Link
            href="/lockdown/workspace"
            className="px-3 py-1.5 rounded bg-[#FF9100] hover:bg-[#E08000] text-black font-bold transition inline-flex items-center gap-1.5 shadow-sm shadow-[#FF9100]/20"
          >
            <span>Sandbox Workspace</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </nav>
      </header>

      {/* 2. Hero & Official Status Banner */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        <section className="text-center space-y-4 max-w-4xl mx-auto">
          {/* Prominent Status Badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold tracking-wider">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>ENTERPRISE SECURITY SUITE // PRODUCTION ACTIVE</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-heading font-extrabold text-white tracking-tight leading-tight">
            CORTEX LOCKDOWN BROWSER
          </h1>

          <p className="text-sm sm:text-base text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Native Windows Kiosk Engine (Win32 / C# .NET 4.8 / WebView2) paired with zero-trust in-browser isolation. Certified for high-stakes university and enterprise coding assessments. Launch the secure candidate workspace, trigger the native Windows kiosk agent, or inspect verified defense subsystems below.
          </p>

          {/* Quick Access Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            <span className="px-3 py-1 rounded bg-[#0B0C0E] border border-[#1F2024] text-[11px] font-mono text-gray-300 flex items-center gap-1.5">
              <Terminal className="w-3 h-3 text-[#FF9100]" />
              <span>Target: Windows 10/11 x64</span>
            </span>
            <span className="px-3 py-1 rounded bg-[#0B0C0E] border border-[#1F2024] text-[11px] font-mono text-gray-300 flex items-center gap-1.5">
              <Cpu className="w-3 h-3 text-[#FF9100]" />
              <span>Engine: WebView2 + Win32 Hooks</span>
            </span>
            <span className="px-3 py-1 rounded bg-[#0B0C0E] border border-[#1F2024] text-[11px] font-mono text-gray-300 flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-[#FF9100]" />
              <span>Security Tier: Zero-Trust Examination</span>
            </span>
          </div>
        </section>

        {/* 2.5 Candidate Examination Launch Station */}
        <section className="rounded-xl border border-emerald-500/30 bg-[#0E1210]/80 backdrop-blur-md p-6 lg:p-8 space-y-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h2 className="text-base font-heading font-bold text-white">
                  Candidate Examination Launch Station
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  STATION ACTIVE
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Enter your institutional assessment access token to begin hardware initialization and lockdown session isolation.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/lockdown/download"
                className="px-3 py-2 rounded-lg bg-[#16171C] hover:bg-[#1F2026] text-gray-300 border border-[#2D3039] text-xs font-mono transition flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-[#FF9100]" />
                <span>Download Desktop Kiosk (Win x64)</span>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center pt-2">
            <div className="md:col-span-6 relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500 font-mono text-xs">
                <Lock className="w-4 h-4 text-[#FF9100]" />
              </div>
              <input
                type="text"
                value={examToken}
                onChange={(e) => setExamToken(e.target.value)}
                placeholder="Enter Assessment Code (e.g. EXAM-2026-CS276)"
                className="w-full pl-10 pr-4 py-2.5 bg-[#090A0C] border border-[#23272F] focus:border-emerald-500 rounded-lg text-xs font-mono text-white placeholder-gray-600 focus:outline-none transition"
              />
            </div>

            <div className="md:col-span-3">
              <Link
                href={`/lockdown/workspace?token=${encodeURIComponent(examToken)}`}
                className="w-full py-2.5 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-heading font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                <Shield className="w-4 h-4" />
                <span>Launch Web Workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="md:col-span-3">
              <button
                onClick={handleLaunchNativeKiosk}
                className="w-full py-2.5 px-4 rounded-lg bg-[#1B1D24] hover:bg-[#252833] text-white border border-[#2E323D] font-heading font-semibold text-xs transition flex items-center justify-center gap-2"
              >
                <Terminal className="w-4 h-4 text-[#FF9100]" />
                <span>Launch Native Agent</span>
              </button>
            </div>
          </div>
        </section>

        {/* 3. Interactive Anti-Cheat Security Simulator Card */}
        <section className="rounded-xl border border-[#1F2024] bg-[#0B0C0E]/95 backdrop-blur-md overflow-hidden shadow-2xl">
          {/* Card Header */}
          <div className="px-5 py-4 border-b border-[#1F2024] bg-[#101116] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded bg-[#FF9100]/10 border border-[#FF9100]/30 flex items-center justify-center text-[#FF9100]">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-heading font-bold text-sm text-white">
                  Interactive Anti-Cheat Security Simulator
                </h2>
                <p className="text-[11px] font-mono text-gray-400">
                  Simulate live kernel hooks, display exclusion, and telemetry polling
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleResetSimulator}
                className="px-2.5 py-1 rounded bg-[#16171C] hover:bg-[#1F2026] text-gray-300 border border-[#2D3039] text-xs font-mono transition flex items-center gap-1.5"
                title="Reset simulation parameters"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reset Baseline</span>
              </button>
              <button
                onClick={handleCopyLink}
                className="px-2.5 py-1 rounded bg-[#16171C] hover:bg-[#1F2026] text-gray-300 border border-[#2D3039] text-xs font-mono transition flex items-center gap-1.5"
                title="Share simulator link"
              >
                {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <ExternalLink className="w-3 h-3" />}
                <span>{copiedLink ? 'Copied' : 'Share'}</span>
              </button>
            </div>
          </div>

          {/* Card Body: Split Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#1F2024]">
            {/* Left Control Column (5 Cols) */}
            <div className="lg:col-span-5 p-5 space-y-4">
              <div className="text-xs font-mono uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5 text-[#FF9100]" />
                <span>Defense Simulation Triggers</span>
              </div>

              {/* Trigger 1: OBS Screen Capture Exclusion */}
              <div className="p-3.5 rounded-lg border border-[#1F2024] bg-[#0E0F13] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
                    <EyeOff className="w-3.5 h-3.5 text-[#FF9100]" />
                    <span>Display Affinity (WDA_EXCLUDE)</span>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      isObsBlackout
                        ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {isObsBlackout ? '[BLOCKED]' : '[NORMAL]'}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Forces Direct3D surface to return pure black pixels to OBS, Discord, Zoom, Snagit, and Snipping Tool.
                </p>
                <button
                  onClick={handleToggleObsBlackout}
                  className={`w-full py-2 px-3 rounded text-xs font-mono font-bold transition flex items-center justify-center gap-2 ${
                    isObsBlackout
                      ? 'bg-red-600 hover:bg-red-500 text-white'
                      : 'bg-[#1F2026] hover:bg-[#2A2B35] text-gray-200 border border-[#2D3039]'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{isObsBlackout ? 'Disable Capture Blackout' : 'Simulate External Stream / OBS Capture'}</span>
                </button>
                <div className="pt-1">
                  <button
                    onClick={handleToggleFullscreen}
                    className="w-full py-2 px-3 rounded text-xs font-mono font-bold bg-[#14151B] hover:bg-[#1D1E26] text-gray-200 border border-[#2B2D38] transition flex items-center justify-center gap-2"
                  >
                    <Monitor className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isFullscreenActive ? 'Exit Fullscreen Kiosk Mode' : 'Test Fullscreen Kiosk Lockdown'}</span>
                  </button>
                </div>
              </div>

              {/* Trigger 2: Keyboard Hook Intercept */}
              <div className="p-3.5 rounded-lg border border-[#1F2024] bg-[#0E0F13] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-[#FF9100]" />
                    <span>Low-Level Keyboard Hook</span>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      isKeyboardHookSimulated
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {isKeyboardHookSimulated ? '[INTERCEPTED]' : '[ARMED // HOOKED]'}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Win32 WH_KEYBOARD_LL hook intercepts and drops Alt+Tab, WinKey, Ctrl+Esc, F12, and PrintScreen before Windows shell processing.
                </p>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    placeholder="Click here and press F12, Alt, Tab, or Ctrl+U to test hook..."
                    onKeyDown={handleTestKeyInterceptor}
                    className="w-full px-2.5 py-1.5 bg-[#050607] border border-[#23272F] focus:border-amber-500 rounded text-[11px] font-mono text-gray-200 placeholder-gray-600 focus:outline-none"
                  />
                  <button
                    onClick={handleSimulateKeyboardHook}
                    disabled={isKeyboardHookSimulated}
                    className="w-full py-1.5 px-3 rounded text-xs font-mono font-bold bg-[#1F2026] hover:bg-[#2A2B35] disabled:opacity-50 text-gray-200 border border-[#2D3039] transition flex items-center justify-center gap-2"
                  >
                    <Terminal className="w-3.5 h-3.5 text-[#FF9100]" />
                    <span>Simulate Alt+Tab / WinKey Drop</span>
                  </button>
                </div>
              </div>

              {/* Trigger 3: Process Watchdog */}
              <div className="p-3.5 rounded-lg border border-[#1F2024] bg-[#0E0F13] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-[#FF9100]" />
                    <span>Process Watchdog (1,500ms)</span>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      isWatchdogSimulated
                        ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {isWatchdogSimulated ? '[THREAT FLAGGED]' : '[POLLING]'}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Background daemon scans active process snapshots against a 40+ signature blacklist every 1,500ms.
                </p>
                <button
                  onClick={handleSimulateWatchdog}
                  disabled={isWatchdogSimulated}
                  className="w-full py-2 px-3 rounded text-xs font-mono font-bold bg-[#1F2026] hover:bg-[#2A2B35] disabled:opacity-50 text-gray-200 border border-[#2D3039] transition flex items-center justify-center gap-2"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Simulate Prohibited Process Launch</span>
                </button>
              </div>

              {/* Trigger 4: 10s Auto-Save & Offline Buffer */}
              <div className="p-3.5 rounded-lg border border-[#1F2024] bg-[#0E0F13] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-[#FF9100]" />
                    <span>10s State Engine & Buffer</span>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      isNetworkOffline
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {isNetworkOffline ? `[OFFLINE // ${offlineBufferCount} QUEUED]` : '[CONNECTED]'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span>Next sync cadence in:</span>
                  <span className="font-mono text-[#FF9100] font-bold">{simulatedTime}s</span>
                </div>
                <button
                  onClick={handleToggleNetwork}
                  className={`w-full py-2 px-3 rounded text-xs font-mono font-bold transition flex items-center justify-center gap-2 ${
                    isNetworkOffline
                      ? 'bg-amber-600 hover:bg-amber-500 text-black'
                      : 'bg-[#1F2026] hover:bg-[#2A2B35] text-gray-200 border border-[#2D3039]'
                  }`}
                >
                  {isNetworkOffline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                  <span>{isNetworkOffline ? 'Restore Edge Connection & Flush Buffer' : 'Simulate Network Drop (Offline Buffer)'}</span>
                </button>
              </div>
            </div>

            {/* Right Display & Live Telemetry Column (7 Cols) */}
            <div className="lg:col-span-7 p-5 flex flex-col space-y-4">
              {/* Virtual Kiosk Screen Simulation */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5 text-[#FF9100]" />
                    <span>Simulated Windows Kiosk Viewport</span>
                  </span>
                  <span className="text-[11px] text-gray-500">Resolution: 1920x1080 Borderless</span>
                </div>

                <div className="relative rounded-lg border border-[#1F2024] bg-black h-56 sm:h-64 overflow-hidden flex flex-col">
                  {/* Title Bar Simulation */}
                  <div className="h-7 bg-[#101116] border-b border-[#1F2024] px-3 flex items-center justify-between text-[10px] font-mono text-gray-400 select-none">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                      <span>CortexLockdown.exe — Examination Session: #EX-2026-9041</span>
                    </div>
                    <span>AFFINITY: WDA_EXCLUDEFROMCAPTURE</span>
                  </div>

                  {/* Viewport Content */}
                  {isObsBlackout ? (
                    /* Blackout State */
                    <div className="flex-1 bg-black flex flex-col items-center justify-center p-6 text-center space-y-2 animate-fadeIn">
                      <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500">
                        <EyeOff className="w-5 h-5" />
                      </div>
                      <div className="font-mono text-xs font-bold text-red-400">
                        [OBS / EXTERNAL STREAM BLACKOUT ACTIVE]
                      </div>
                      <p className="text-[11px] font-mono text-gray-500 max-w-sm">
                        Direct3D swap-chain presentation surface excluded from Windows Desktop Duplication API. Frame output rendered as 0x000000.
                      </p>
                    </div>
                  ) : (
                    /* Active Examination State */
                    <div className="flex-1 p-4 bg-[#0B0C0E] flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-[#1F2024] pb-2">
                          <span className="text-xs font-bold text-white">
                            Question 14 of 30: Distributed Consensus Protocols
                          </span>
                          <span className="text-[11px] font-mono text-[#FF9100]">Time Remaining: 42:18</span>
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed font-sans">
                          Which mechanism in Raft consensus prevents split-vote cycles during candidate leader elections?
                        </p>
                        <div className="space-y-1.5 text-xs text-gray-400 font-mono">
                          <div className="p-1.5 rounded bg-[#16171C] border border-[#2D3039] text-gray-300">
                            [A] Randomized election timeouts
                          </div>
                          <div className="p-1.5 rounded bg-[#16171C] border border-[#2D3039]">
                            [B] Two-phase commit barriers
                          </div>
                        </div>
                      </div>

                      {/* Overlay Toast Alerts */}
                      {isKeyboardHookSimulated && (
                        <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono flex items-center gap-2 animate-pulse">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>[HOOK INTERCEPT] Alt+Tab suppressed. Keycode discarded.</span>
                        </div>
                      )}

                      {isWatchdogSimulated && (
                        <div className="p-2 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono flex items-center gap-2 animate-pulse">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>[CRITICAL] Blacklisted process obs64.exe detected. Event logged.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Live Monospace Telemetry Stream */}
              <div className="flex-1 space-y-2 flex flex-col min-h-[160px]">
                <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-[#FF9100]" />
                    <span>Real-time Telemetry Stream</span>
                  </span>
                  <span className="text-[10px] text-gray-500">Live UTC Stream</span>
                </div>

                <div className="flex-1 bg-[#050607] rounded-lg border border-[#1F2024] p-3 font-mono text-[11px] overflow-y-auto max-h-48 space-y-1.5 select-text">
                  {telemetryLogs.map((log) => {
                    const badgeColor =
                      log.severity === 'CRITICAL'
                        ? 'text-red-400'
                        : log.severity === 'WARN'
                        ? 'text-amber-400'
                        : log.severity === 'SUCCESS'
                        ? 'text-emerald-400'
                        : 'text-gray-400';
                    return (
                      <div key={log.id} className="flex items-start gap-2 leading-tight">
                        <span className="text-gray-600 shrink-0">[{log.timestamp}]</span>
                        <span className={`font-bold shrink-0 ${badgeColor}`}>[{log.source}]</span>
                        <span className="text-gray-300 break-all">{log.message}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Architecture Specifications Grid */}
        <section className="space-y-4">
          <div className="space-y-1">
            <h3 className="font-heading font-bold text-lg text-white">
              Cortex Lockdown Architecture Specifications
            </h3>
            <p className="text-xs font-mono text-gray-400">
              Low-level Win32 security subsystems enforced at kernel and user mode
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Spec 1: Display Affinity */}
            <div className="p-4 rounded-xl border border-[#1F2024] bg-[#0B0C0E] space-y-2.5 hover:border-[#FF9100]/40 transition">
              <div className="w-8 h-8 rounded-lg bg-[#FF9100]/10 border border-[#FF9100]/30 flex items-center justify-center text-[#FF9100]">
                <EyeOff className="w-4 h-4" />
              </div>
              <h4 className="font-heading font-bold text-sm text-white">
                Win32 Display Affinity
              </h4>
              <p className="text-xs text-gray-400 leading-relaxed font-mono">
                SetWindowDisplayAffinity with flag WDA_EXCLUDEFROMCAPTURE (0x00000011). Prevents DWM frame capture by screen recorders and remote desktop software.
              </p>
              <div className="pt-2 border-t border-[#1F2024] text-[10px] font-mono text-gray-500">
                Layer: User32 / D3D11 SwapChain
              </div>
            </div>

            {/* Spec 2: Low-Level Hook */}
            <div className="p-4 rounded-xl border border-[#1F2024] bg-[#0B0C0E] space-y-2.5 hover:border-[#FF9100]/40 transition">
              <div className="w-8 h-8 rounded-lg bg-[#FF9100]/10 border border-[#FF9100]/30 flex items-center justify-center text-[#FF9100]">
                <Lock className="w-4 h-4" />
              </div>
              <h4 className="font-heading font-bold text-sm text-white">
                Low-Level Keyboard Hook
              </h4>
              <p className="text-xs text-gray-400 leading-relaxed font-mono">
                SetWindowsHookEx(WH_KEYBOARD_LL) dropping Alt+Tab, Alt+Esc, WinKey, Ctrl+Esc, Ctrl+Shift+Esc, and PrintScreen. Supervisor override: Ctrl+Alt+F10.
              </p>
              <div className="pt-2 border-t border-[#1F2024] text-[10px] font-mono text-gray-500">
                Layer: Win32 Message Loop Hook
              </div>
            </div>

            {/* Spec 3: Process Watchdog */}
            <div className="p-4 rounded-xl border border-[#1F2024] bg-[#0B0C0E] space-y-2.5 hover:border-[#FF9100]/40 transition">
              <div className="w-8 h-8 rounded-lg bg-[#FF9100]/10 border border-[#FF9100]/30 flex items-center justify-center text-[#FF9100]">
                <Cpu className="w-4 h-4" />
              </div>
              <h4 className="font-heading font-bold text-sm text-white">
                Process Watchdog Daemon
              </h4>
              <p className="text-xs text-gray-400 leading-relaxed font-mono">
                Continuous 1,500ms background thread polling active process handles against a 40+ entry blacklist (Discord, OBS, AnyDesk, TeamViewer, CheatEngine).
              </p>
              <div className="pt-2 border-t border-[#1F2024] text-[10px] font-mono text-gray-500">
                Layer: Background Thread Polling
              </div>
            </div>

            {/* Spec 4: Auto-Save State Engine */}
            <div className="p-4 rounded-xl border border-[#1F2024] bg-[#0B0C0E] space-y-2.5 hover:border-[#FF9100]/40 transition">
              <div className="w-8 h-8 rounded-lg bg-[#FF9100]/10 border border-[#FF9100]/30 flex items-center justify-center text-[#FF9100]">
                <HardDrive className="w-4 h-4" />
              </div>
              <h4 className="font-heading font-bold text-sm text-white">
                10s Transactional Engine
              </h4>
              <p className="text-xs text-gray-400 leading-relaxed font-mono">
                Auto-saves every 10 seconds to Cloudflare D1 with client-side AES-GCM encrypted ring storage buffer for zero answer loss during transient drops.
              </p>
              <div className="pt-2 border-t border-[#1F2024] text-[10px] font-mono text-gray-500">
                Layer: Cloudflare Edge + Local Storage
              </div>
            </div>
          </div>
        </section>

        {/* 5. Navigation & Next Actions */}
        <section className="p-6 rounded-xl border border-[#1F2024] bg-[#0E0F13] flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <h4 className="font-heading font-bold text-base text-white">
              Ready to Explore More Cortex Platforms?
            </h4>
            <p className="text-xs text-gray-400">
              Access the other standalone suites in the decoupled ecosystem.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-semibold">
            <Link
              href="/lockdown/download"
              className="px-4 py-2 rounded-lg bg-[#16171C] hover:bg-[#1F2026] text-gray-200 border border-[#2D3039] transition inline-flex items-center gap-2"
            >
              <Download className="w-4 h-4 text-[#FF9100]" />
              <span>Download Windows Client</span>
            </Link>
            <Link
              href="/lockdown/workspace"
              className="px-4 py-2 rounded-lg bg-[#16171C] hover:bg-[#1F2026] text-gray-200 border border-[#2D3039] transition inline-flex items-center gap-2"
            >
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>Launch Examination Sandbox</span>
            </Link>
            <Link
              href="/ide"
              className="px-4 py-2 rounded-lg bg-[#16171C] hover:bg-[#1F2026] text-gray-200 border border-[#2D3039] transition inline-flex items-center gap-2"
            >
              <Terminal className="w-4 h-4 text-[#FF9100]" />
              <span>Launch Cloud IDE</span>
            </Link>
            <Link
              href="/classroom"
              className="px-4 py-2 rounded-lg bg-[#FF9100] hover:bg-[#E08000] text-black font-bold transition inline-flex items-center gap-2"
            >
              <span>Enter Classroom Suite</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      {/* 6. Enterprise Footer */}
      <footer className="border-t border-[#1F2024] bg-[#0B0C0E] py-8 px-4 sm:px-8 mt-12 text-xs font-mono text-gray-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
            <span className="text-gray-300">SYSTEM STATUS // ALL SYSTEMS OPERATIONAL</span>
          </div>
          <div>
            <span>CORTEX UNIVERSAL CODE PLATFORM — PRODUCT 03: LOCKDOWN BROWSER</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
