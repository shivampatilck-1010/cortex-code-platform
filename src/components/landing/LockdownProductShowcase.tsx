'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ShieldAlert, 
  Shield, 
  Lock, 
  EyeOff, 
  AlertTriangle, 
  Activity, 
  RotateCcw, 
  ArrowRight, 
  Wifi, 
  WifiOff, 
  Terminal, 
  FileText, 
  Download,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';
import { useTheme } from './ThemeContext';
import { Aurora, GlowCtaButton, InteractiveWavesBackground } from './EffectsSuite';

interface TelemetryEvent {
  id: string;
  time: string;
  source: string;
  severity: 'INFO' | 'WARN' | 'CRITICAL' | 'SUCCESS';
  message: string;
}

export const LockdownProductShowcase: React.FC = () => {
  const { isDark } = useTheme();
  // Simulator State Machine
  const [activeSimulation, setActiveSimulation] = useState<
    'none' | 'obs' | 'keyboard' | 'watchdog' | 'network'
  >('none');
  const [offlineBufferCount, setOfflineBufferCount] = useState<number>(0);
  const [telemetryLogs, setTelemetryLogs] = useState<TelemetryEvent[]>([
    {
      id: 'init-1',
      time: '14:20:00',
      source: 'SecurityKernel',
      severity: 'INFO',
      message: 'Win32 Kiosk security daemon initialized in isolated thread.',
    },
    {
      id: 'init-2',
      time: '14:20:01',
      source: 'DisplayAffinity',
      severity: 'INFO',
      message: 'SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE) active.',
    },
    {
      id: 'init-3',
      time: '14:20:02',
      source: 'ProcessWatchdog',
      severity: 'SUCCESS',
      message: '40-process integrity scan clean. Polling cycle at 1500ms.',
    },
  ]);

  const addLog = (source: string, severity: 'INFO' | 'WARN' | 'CRITICAL' | 'SUCCESS', message: string) => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const newEntry: TelemetryEvent = {
      id: Math.random().toString(36).substring(2, 9),
      time: timeStr,
      source,
      severity,
      message,
    };
    setTelemetryLogs((prev) => [newEntry, ...prev.slice(0, 7)]);
  };

  const handleSimulateObs = () => {
    setActiveSimulation('obs');
    addLog(
      'DisplayAffinity',
      'CRITICAL',
      'OBS / Discord screen stream capture attempt detected. DWM buffer blacked out.'
    );
  };

  const handleSimulateKeyboard = () => {
    setActiveSimulation('keyboard');
    addLog(
      'KeyboardHook',
      'WARN',
      'WH_KEYBOARD_LL intercepted Alt+Tab / WinKey. Keystroke suppressed before shell.'
    );
  };

  const handleSimulateWatchdog = () => {
    setActiveSimulation('watchdog');
    addLog(
      'ProcessWatchdog',
      'CRITICAL',
      'Prohibited process detected: obs64.exe (PID: 4928). Telemetry beacon emitted.'
    );
  };

  const handleSimulateNetwork = () => {
    setActiveSimulation('network');
    setOfflineBufferCount(3);
    addLog(
      'StateBuffer',
      'WARN',
      'Network connection interrupted. Enqueued 3 offline exam responses in local ring-buffer.'
    );
  };

  const handleReset = () => {
    setActiveSimulation('none');
    setOfflineBufferCount(0);
    addLog('SecurityKernel', 'SUCCESS', 'Simulation reset. Kiosk integrity returned to nominal.');
  };

  // Auto reset after 4.5 seconds for simulations
  useEffect(() => {
    if (activeSimulation !== 'none') {
      const timer = setTimeout(() => {
        if (activeSimulation === 'network') {
          addLog('StateBuffer', 'SUCCESS', 'Network restored. 3 offline buffers flushed and synced to D1 edge SQL.');
          setOfflineBufferCount(0);
        }
        setActiveSimulation('none');
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [activeSimulation]);

  return (
    <section 
      id="cortex-browser" 
      className={`py-24 border-t relative scroll-mt-24 transition-colors duration-300 ${
        isDark ? 'border-[#1F2024] bg-[#08090A] text-[#E6EDF3]' : 'border-slate-200 bg-[#FFFFFF] text-zinc-950'
      }`}
    >
      {/* Aurora Atmospheric Security Shield Glow */}
      <Aurora 
        colorStops={isDark ? ['#FF9100', '#FF3232', '#3A29FF'] : ['#FDBA74', '#FB7185', '#818CF8']}
        amplitude={1.1}
        blend={isDark ? 0.45 : 0.28}
        speed={0.4}
        className="absolute inset-0 pointer-events-none opacity-45 dark:opacity-30"
      />

      {/* Background Accent */}
      <div 
        className="absolute top-1/2 left-1/3 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none -z-10" 
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-12">
          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-mono font-semibold tracking-wider mb-4">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
            <span>03 // CORTEX BROWSER &bull; BUILDING BY TEAM // COMING SOON // PLACEHOLDER</span>
          </div>
          <h2 className={`text-3xl sm:text-5xl font-extrabold tracking-tight mb-4 ${
            isDark ? 'text-white' : 'text-zinc-900'
          }`}>
            Zero-Trust Lockdown Kiosk Engine
          </h2>
          {/* Engineering Note */}
          <div className={`p-4 rounded-xl border max-w-3xl mb-6 ${
            isDark ? 'bg-purple-950/20 border-purple-500/30' : 'bg-purple-50 border-purple-200'
          }`}>
            <p className={`text-sm leading-relaxed font-mono ${
              isDark ? 'text-purple-200' : 'text-purple-900'
            }`}>
              ENGINEERING NOTE: Our engineering team is actively building the final release of the 
              Cortex Lockdown client. Explore the architectural preview and interactive security simulation below.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <GlowCtaButton href="/lockdown">
              EXPLORE SECURITY ARCHITECTURE
            </GlowCtaButton>
            <a
              href="https://github.com/shivampatilck-1010/cortex-code-platform"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono tracking-wider border transition-colors ${
                isDark ? 'bg-[#111216] text-zinc-300 hover:text-white border-[#20222A] hover:border-zinc-700' : 'bg-white text-zinc-700 hover:text-zinc-900 border-slate-200 hover:border-slate-400'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>REQUIREMENTS SPEC</span>
            </a>
          </div>
        </div>

        {/* 4-Trigger Interactive Anti-Cheat Security Simulator Card */}
        <div className={`rounded-2xl border p-6 shadow-2xl transition-colors ${
          isDark ? 'bg-[#0B0C0E] border-[#1F2024]' : 'bg-white border-slate-200 shadow-slate-900/10'
        }`}>
          <div className={`flex flex-wrap items-center justify-between pb-4 mb-6 border-b gap-3 ${
            isDark ? 'border-[#1F2024]' : 'border-slate-200'
          }`}>
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-purple-400" />
              <div>
                <h3 className={`text-sm font-mono font-bold uppercase ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  Interactive Anti-Cheat Simulation Console
                </h3>
                <p className="text-xs text-zinc-500 font-mono">
                  Test native Win32 security hooks and real-time anomaly responses
                </p>
              </div>
            </div>
            <button
              onClick={handleReset}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono border transition-colors ${
                isDark ? 'bg-[#111216] border-[#20222A] text-zinc-400 hover:text-white' : 'bg-slate-100 border-slate-200 text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>RESET SIMULATOR</span>
            </button>
          </div>

          {/* Trigger Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {/* Trigger 1: Screen Capture */}
            <button
              onClick={handleSimulateObs}
              className={`p-3 rounded-xl border text-left transition-all ${
                activeSimulation === 'obs'
                  ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                  : isDark
                    ? 'bg-[#111216] border-[#20222A] hover:border-zinc-700 text-zinc-300'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <EyeOff className="w-4 h-4 text-rose-400" />
                <span className="text-[10px] font-mono text-zinc-500 font-bold">TRIGGER 01</span>
              </div>
              <div className="text-xs font-mono font-bold">Simulate Screen Capture</div>
              <div className="text-[10px] text-zinc-500 mt-1">OBS / Discord screen stream</div>
            </button>

            {/* Trigger 2: Keyboard Hook */}
            <button
              onClick={handleSimulateKeyboard}
              className={`p-3 rounded-xl border text-left transition-all ${
                activeSimulation === 'keyboard'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                  : isDark
                    ? 'bg-[#111216] border-[#20222A] hover:border-zinc-700 text-zinc-300'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <Lock className="w-4 h-4 text-amber-400" />
                <span className="text-[10px] font-mono text-zinc-500 font-bold">TRIGGER 02</span>
              </div>
              <div className="text-xs font-mono font-bold">Simulate Alt+Tab / WinKey</div>
              <div className="text-[10px] text-zinc-500 mt-1">Low-level keyboard hook drop</div>
            </button>

            {/* Trigger 3: Watchdog */}
            <button
              onClick={handleSimulateWatchdog}
              className={`p-3 rounded-xl border text-left transition-all ${
                activeSimulation === 'watchdog'
                  ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                  : isDark
                    ? 'bg-[#111216] border-[#20222A] hover:border-zinc-700 text-zinc-300'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <AlertTriangle className="w-4 h-4 text-purple-400" />
                <span className="text-[10px] font-mono text-zinc-500 font-bold">TRIGGER 03</span>
              </div>
              <div className="text-xs font-mono font-bold">Spawn Background Process</div>
              <div className="text-[10px] text-zinc-500 mt-1">40-process integrity scan</div>
            </button>

            {/* Trigger 4: Network Offline */}
            <button
              onClick={handleSimulateNetwork}
              className={`p-3 rounded-xl border text-left transition-all ${
                activeSimulation === 'network'
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                  : isDark
                    ? 'bg-[#111216] border-[#20222A] hover:border-zinc-700 text-zinc-300'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <WifiOff className="w-4 h-4 text-cyan-400" />
                <span className="text-[10px] font-mono text-zinc-500 font-bold">TRIGGER 04</span>
              </div>
              <div className="text-xs font-mono font-bold">Simulate Network Loss</div>
              <div className="text-[10px] text-zinc-500 mt-1">10s auto-save ring buffer</div>
            </button>
          </div>

          {/* Interactive Simulation Display & Live Telemetry Feed */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Visual Screen State Simulator */}
            <div className="lg:col-span-6 p-4 rounded-xl bg-[#08090A] border border-[#1F2024] flex flex-col justify-between min-h-[260px] text-zinc-100">
              <div className="flex items-center justify-between text-[11px] text-zinc-500 pb-2 border-b border-zinc-900">
                <span className="font-mono">Kiosk Screen Buffer (DirectX Display Mirror)</span>
                <span className="text-emerald-400 font-mono">DWM INTERCEPT ACTIVE</span>
              </div>

              {activeSimulation === 'obs' ? (
                <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
                  <div className="p-3 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    <EyeOff className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-mono font-bold text-rose-300">
                    BLACKED OUT VIA WDA_EXCLUDEFROMCAPTURE
                  </div>
                  <div className="text-[11px] font-mono text-zinc-400 max-w-xs">
                    Screen recorder captured null surface frame. Assessment content protected from exfiltration.
                  </div>
                </div>
              ) : activeSimulation === 'keyboard' ? (
                <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
                  <div className="p-3 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-mono font-bold text-amber-300">
                    HOOK DROPPED: WH_KEYBOARD_LL
                  </div>
                  <div className="text-[11px] font-mono text-zinc-400 max-w-xs">
                    Alt+Tab / WinKey intercepted and suppressed before OS shell dispatcher.
                  </div>
                </div>
              ) : activeSimulation === 'watchdog' ? (
                <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
                  <div className="p-3 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-mono font-bold text-purple-300">
                    PROHIBITED PROCESS DETECTED
                  </div>
                  <div className="text-[11px] font-mono text-zinc-400 max-w-xs">
                    Watchdog matched blacklist signature: obs64.exe (PID: 4928). Telemetry sent to proctor.
                  </div>
                </div>
              ) : activeSimulation === 'network' ? (
                <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
                  <div className="p-3 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                    <WifiOff className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-mono font-bold text-cyan-300">
                    OFFLINE BUFFER MODE ACTIVE
                  </div>
                  <div className="text-[11px] font-mono text-zinc-400 max-w-xs">
                    Candidate answers safely enqueued in local encrypted ring buffer ({offlineBufferCount} items). Auto-reconnecting...
                  </div>
                </div>
              ) : (
                <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
                  <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-mono font-bold text-zinc-200">
                    KIOSK MONITOR ACTIVE // ZERO VIOLATIONS
                  </div>
                  <div className="text-[11px] font-mono text-zinc-500 max-w-xs">
                    Click any simulation trigger above to observe how Cortex responds to cheating vectors.
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-zinc-900 flex items-center justify-between text-[10px] font-mono text-zinc-600">
                <span>Kernel Driver: CORTEX-SEC-V2</span>
                <span>Affinity: 0x00000011</span>
              </div>
            </div>

            {/* Live Telemetry Event Stream */}
            <div className="lg:col-span-6 p-4 rounded-xl bg-[#08090A] border border-[#1F2024] font-mono text-xs flex flex-col justify-between text-zinc-100">
              <div>
                <div className="flex items-center justify-between text-[11px] text-zinc-500 pb-2 mb-3 border-b border-zinc-900">
                  <span className="flex items-center gap-1.5 text-purple-400 font-semibold">
                    <Activity className="w-3.5 h-3.5" />
                    <span>LIVE TELEMETRY STREAM</span>
                  </span>
                  <span className="text-[10px] text-zinc-600">WebSocket Edge Sync</span>
                </div>

                <div className="space-y-1.5">
                  {telemetryLogs.map((log) => (
                    <div 
                      key={log.id} 
                      className="p-2 rounded bg-[#0B0C0E] border border-zinc-900 text-[11px] flex items-start gap-2 leading-tight"
                    >
                      <span className="text-zinc-500 select-none">{log.time}</span>
                      <span 
                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                          log.severity === 'CRITICAL'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : log.severity === 'WARN'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : log.severity === 'SUCCESS'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {log.severity}
                      </span>
                      <span className="text-zinc-300">
                        <strong className="text-purple-300">{log.source}:</strong> {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-900 flex items-center justify-between text-[10px] text-zinc-600">
                <span>Watchdog Polling: 1500ms</span>
                <span>SHA-256 Event Chain Active</span>
              </div>
            </div>
          </div>

          {/* Subroute Direct Links */}
          <div className={`mt-6 pt-6 border-t flex flex-wrap items-center justify-between gap-4 text-xs font-mono ${
            isDark ? 'border-[#1F2024] text-zinc-500' : 'border-slate-200 text-zinc-600'
          }`}>
            <div className="flex items-center gap-4">
              <Link href="/lockdown/download" className="text-purple-500 hover:text-purple-400 transition-colors flex items-center gap-1">
                <span>Direct Client Download</span>
                <Download className="w-3.5 h-3.5" />
              </Link>
              <Link href="/lockdown/workspace" className="hover:text-purple-400 transition-colors flex items-center gap-1">
                <span>Candidate Workspace View</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/ide" className="hover:text-white transition-colors">
                Return to IDE
              </Link>
              <Link href="/classroom" className="hover:text-white transition-colors">
                Classroom Suite
              </Link>
            </div>
          </div>
        </div>

        {/* Telemetry Cut-Out Card with Chamfered Corners and Perlin Waves */}
        <div className="mt-8">
          <div 
            className={`relative p-5 border overflow-hidden transition-colors ${
              isDark ? 'bg-[#0B0C0E]/90 border-[#1F2024]' : 'bg-white/90 border-slate-300 shadow-md'
            }`}
            style={{
              clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))',
            }}
          >
            <InteractiveWavesBackground 
              lineColor={isDark ? 'rgba(255, 145, 0, 0.22)' : 'rgba(234, 88, 12, 0.18)'}
              waveSpeedX={0.015}
              waveSpeedY={0.008}
              waveAmpX={20}
              waveAmpY={10}
            />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-mono tracking-widest text-[#FF9100] uppercase font-bold">
                    SECURITY TELEMETRY // REAL-TIME KERNEL INTEGRITY
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  Cryptographically Sealed Audit Pipeline
                </h4>
                <p className={`text-xs mt-1 max-w-2xl leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  Low-level hooks emit continuous SHA-256 telemetry events with zero PII retention, verifying non-tampered exam execution in institutional testing centers.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="px-3 py-1 rounded bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-mono font-bold">
                  WDA_EXCLUDE ACTIVE
                </span>
                <span className="px-3 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold">
                  HOOKS NOMINAL
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
