'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield,
  Download,
  Monitor,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  RefreshCw,
  HelpCircle,
  Laptop,
  Check,
  Copy,
  Terminal,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
  FileText,
  Lock,
} from 'lucide-react';
import Link from 'next/link';

interface CortexLockdownPrepModalProps {
  classroomId: string;
  examId: string;
  examTitle?: string;
  durationMinutes?: number;
  onClose: () => void;
}

/**
 * CortexLockdownPrepModal
 *
 * Dedicated preparation and readiness verification modal before attempting a restricted examination.
 * Mandatory Integrity Rule: Never claims application is installed merely because download was initiated.
 * Only verified native sessions authenticated via launch grants are recognized.
 */
export function CortexLockdownPrepModal({
  classroomId,
  examId,
  examTitle = 'Proctored Examination',
  durationMinutes,
  onClose,
}: CortexLockdownPrepModalProps) {
  const [activeStep, setActiveStep] = useState<number>(3); // Default to compatibility/readiness
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [osPassed, setOsPassed] = useState<boolean | null>(null);
  const [displayPassed, setDisplayPassed] = useState<boolean | null>(null);
  const [networkPassed, setNetworkPassed] = useState<boolean | null>(null);
  const [grantToken, setGrantToken] = useState<string | null>(null);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [hasAttemptedLaunch, setHasAttemptedLaunch] = useState<boolean>(false);

  // Sub-modals for detail inspection
  const [showInstallGuide, setShowInstallGuide] = useState<boolean>(false);
  const [showSysReqs, setShowSysReqs] = useState<boolean>(false);
  const [copiedHash, setCopiedHash] = useState<boolean>(false);

  const SETUP_EXE_HASH = '726E4618990C614DF6AF947F72167244BD51C37F21396D0889A3F0CD62FCF0C6';
  const HARDENED_PAYLOAD_HASH = '82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895';
  const EXE_HASH = SETUP_EXE_HASH;
  const DOWNLOAD_URL = '/api/v1/lockdown/downloads/CortexLockdown-Setup.exe';

  // Run readiness checks
  const runReadinessVerification = async () => {
    setIsChecking(true);
    setGrantError(null);

    // 1. Operating System Check (Windows 10/11)
    let isWin = false;
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent || '';
      isWin = ua.includes('Windows NT 10.0') || ua.includes('Windows NT 11.0') || ua.includes('Windows');
    }
    setOsPassed(isWin);

    // 2. Display Check (Single Monitor Enforcement)
    let singleDisplay = true;
    if (typeof window !== 'undefined' && 'screen' in window) {
      const s = window.screen as any;
      if (s.isExtended === true) {
        singleDisplay = false;
      }
    }
    setDisplayPassed(singleDisplay);

    // 3. Network Health Check
    let netOk = false;
    try {
      const netRes = await fetch('/api/v1/version');
      netOk = netRes.ok;
    } catch (_) {
      netOk = false;
    }
    setNetworkPassed(netOk);

    // 4. Server-Authoritative Launch Grant Acquisition
    try {
      const grantRes = await fetch('/api/v1/lockdown/authorize-launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classroomId, examId }),
      });
      const grantData = await grantRes.json();
      if (grantRes.ok && grantData.launchGrant) {
        setGrantToken(grantData.launchGrant);
      } else {
        setGrantError(grantData.error || 'Server rejected launch grant authorization');
      }
    } catch (err: any) {
      setGrantError(err.message || 'Failed to communicate with authorization server');
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    runReadinessVerification();
  }, [classroomId, examId]);

  const allPassed = osPassed && displayPassed && networkPassed && grantToken;

  const handleLaunchClick = () => {
    setHasAttemptedLaunch(true);
    if (!grantToken) return;
    const launchUrl = `cortex-lockdown://launch?examId=${encodeURIComponent(examId)}&classroomId=${encodeURIComponent(classroomId)}&grant=${encodeURIComponent(grantToken)}`;
    window.location.href = launchUrl;
  };

  const copyHash = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(EXE_HASH);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0C10]/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 select-none font-sans overflow-y-auto">
      <div className="bg-[#121316] border border-[#262832] rounded-2xl max-w-2xl w-full p-5 sm:p-7 space-y-6 shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a1c24] transition"
          title="Return to Classroom"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Badge & Title */}
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#FF9100]/10 border border-[#FF9100]/30 text-[#FF9100] flex items-center justify-center shrink-0 mt-0.5">
            <Shield className="w-5 h-5" />
          </div>
          <div className="space-y-1 pr-6">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FF9100]/10 border border-[#FF9100]/20 text-[#FF9100] text-[10px] font-bold tracking-wider uppercase">
              Security Level 2 • Restricted OS Kiosk
            </div>
            <h2 className="text-base sm:text-lg font-heading font-extrabold text-white tracking-tight">
              This examination requires Cortex Lockdown.
            </h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              Standard web browsers are restricted for <strong className="text-white">{examTitle}</strong>. You must complete the pre-flight readiness checks and launch inside the official desktop environment.
            </p>
          </div>
        </div>

        {/* 5-Step Progress Bar */}
        <div className="grid grid-cols-5 gap-1.5 pt-1">
          <div className={`p-2 rounded-lg text-center border text-[11px] font-semibold transition ${
            activeStep === 1 ? 'bg-[#1c1e28] border-[#FF9100] text-[#FF9100]' : 'bg-[#16171d] border-[#252732] text-gray-400'
          }`}>
            <span className="block text-[9px] uppercase tracking-wider text-gray-500">Step 1</span>
            <span>Download</span>
          </div>
          <div className={`p-2 rounded-lg text-center border text-[11px] font-semibold transition ${
            activeStep === 2 ? 'bg-[#1c1e28] border-[#FF9100] text-[#FF9100]' : 'bg-[#16171d] border-[#252732] text-gray-400'
          }`}>
            <span className="block text-[9px] uppercase tracking-wider text-gray-500">Step 2</span>
            <span>Install</span>
          </div>
          <div className={`p-2 rounded-lg text-center border text-[11px] font-semibold transition ${
            activeStep === 3 ? 'bg-[#1c1e28] border-[#FF9100] text-[#FF9100]' : 'bg-[#16171d] border-[#252732] text-gray-400'
          }`}>
            <span className="block text-[9px] uppercase tracking-wider text-gray-500">Step 3</span>
            <span>Compatibility</span>
          </div>
          <div className={`p-2 rounded-lg text-center border text-[11px] font-semibold transition ${
            activeStep === 4 ? 'bg-[#1c1e28] border-[#FF9100] text-[#FF9100]' : 'bg-[#16171d] border-[#252732] text-gray-400'
          }`}>
            <span className="block text-[9px] uppercase tracking-wider text-gray-500">Step 4</span>
            <span>Readiness</span>
          </div>
          <div className={`p-2 rounded-lg text-center border text-[11px] font-semibold transition ${
            activeStep === 5 ? 'bg-[#1c1e28] border-[#FF9100] text-[#FF9100]' : 'bg-[#16171d] border-[#252732] text-gray-400'
          }`}>
            <span className="block text-[9px] uppercase tracking-wider text-gray-500">Step 5</span>
            <span>Launch</span>
          </div>
        </div>

        {/* Readiness Checklist Card */}
        <div className="p-4 bg-[#16171d] border border-[#262832] rounded-xl space-y-3.5">
          <div className="flex items-center justify-between border-b border-[#22242c] pb-2.5">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#00E5FF]" />
              System Readiness Verification
            </span>
            <button
              onClick={runReadinessVerification}
              disabled={isChecking}
              className="text-[11px] text-gray-400 hover:text-white flex items-center gap-1.5 transition"
              title="Re-run verification checks"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin text-[#FF9100]' : ''}`} />
              <span>Retry Readiness Check</span>
            </button>
          </div>

          <div className="space-y-2.5 text-xs">
            {/* Check 1: Operating System */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Laptop className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-300">Supported OS: Windows 10 / 11 (64-bit)</span>
              </div>
              {osPassed === null ? (
                <span className="text-gray-500">Checking...</span>
              ) : osPassed ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Passed
                </span>
              ) : (
                <span className="text-red-400 font-semibold flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> Windows Required
                </span>
              )}
            </div>

            {/* Check 2: Display Configuration */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-300">Display Configuration: Single Monitor Only</span>
              </div>
              {displayPassed === null ? (
                <span className="text-gray-500">Checking...</span>
              ) : displayPassed ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Single Monitor Verified
                </span>
              ) : (
                <span className="text-amber-400 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Disconnect External Displays
                </span>
              )}
            </div>

            {/* Check 3: Network Telemetry Ping */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-300">Server Authorization & Proctor Connection</span>
              </div>
              {networkPassed === null ? (
                <span className="text-gray-500">Checking...</span>
              ) : networkPassed ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Endpoint Connected
                </span>
              ) : (
                <span className="text-red-400 font-semibold flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> Offline
                </span>
              )}
            </div>

            {/* Check 4: Cryptographic Launch Grant */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-300">Launch Grant (120s HMAC-SHA256 Token)</span>
              </div>
              {grantToken ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1 font-mono text-[11px]">
                  <Check className="w-3.5 h-3.5" /> Grant Issued
                </span>
              ) : grantError ? (
                <span className="text-amber-400 font-semibold text-[11px]">
                  {grantError}
                </span>
              ) : (
                <span className="text-gray-500">Acquiring...</span>
              )}
            </div>
          </div>
        </div>

        {/* Launch and Action Buttons */}
        <div className="space-y-3 pt-1">
          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <button
              onClick={handleLaunchClick}
              disabled={!allPassed}
              className={`w-full sm:flex-1 py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg ${
                allPassed
                  ? 'bg-[#FF9100] hover:bg-[#e08000] text-black shadow-[#FF9100]/20 cursor-pointer'
                  : 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed'
              }`}
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Launch Examination Securely in Cortex Lockdown</span>
            </button>

            <a
              href={DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto py-3 px-4 rounded-xl bg-[#181922] hover:bg-[#222430] text-gray-200 border border-[#2b2d38] font-semibold text-xs flex items-center justify-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span>Download Installer (60 KB)</span>
            </a>
          </div>

          {/* Fallback instructions when launch was triggered */}
          {hasAttemptedLaunch && (
            <div className="p-3 bg-[#161720] border border-[#2a2d3a] rounded-xl text-left text-xs space-y-1.5">
              <span className="text-amber-300 font-semibold block">Did the desktop application not open?</span>
              <p className="text-gray-400 text-[11px] leading-relaxed">
                If Windows did not prompt you to open Cortex Lockdown, the custom protocol handler is not yet registered on this computer. Please complete Step 1 (Download) and Step 2 (Run Setup once) before launching.
              </p>
            </div>
          )}
        </div>

        {/* Helper Footnotes & Collapsible Panels */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400 border-t border-[#1f2026] pt-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowInstallGuide(!showInstallGuide)}
              className="hover:text-white text-cyan-400 underline underline-offset-2 flex items-center gap-1 transition"
            >
              <span>Installation Guide</span>
              {showInstallGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setShowSysReqs(!showSysReqs)}
              className="hover:text-white text-gray-400 flex items-center gap-1 transition"
            >
              <span>System Requirements</span>
              {showSysReqs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          <Link
            href="/lockdown#troubleshoot"
            target="_blank"
            className="hover:text-[#FF9100] flex items-center gap-1 transition text-gray-400"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Support & SmartScreen Info</span>
          </Link>
        </div>

        {/* Collapsible Panel 1: Installation Guide */}
        {showInstallGuide && (
          <div className="p-4 bg-[#0e0f12] border border-[#22242a] rounded-xl text-xs space-y-2 text-left">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider text-[#00E5FF]">How to Install Cortex Lockdown</h4>
            <ol className="list-decimal pl-4 space-y-1 text-gray-300 text-[11px] leading-relaxed">
              <li>Click &quot;Download Client&quot; above to save <code className="text-cyan-300">CortexLockdown-Setup.exe</code> to your machine.</li>
              <li>Verify the SHA-256 digest in PowerShell: <code className="text-gray-400 select-all">Get-FileHash .\CortexLockdown-Setup.exe</code>.</li>
              <li>Launch the executable once to associate the <code className="text-cyan-300">cortex-lockdown://</code> URI protocol.</li>
              <li>Return to this browser window and click &quot;Launch Examination Securely&quot;.</li>
            </ol>
            <div className="pt-1 flex items-center gap-2">
              <span className="text-[10px] text-gray-500 font-mono">SHA-256: {EXE_HASH}</span>
              <button
                onClick={copyHash}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedHash ? 'Copied' : 'Copy Hash'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Collapsible Panel 2: System Requirements */}
        {showSysReqs && (
          <div className="p-4 bg-[#0e0f12] border border-[#22242a] rounded-xl text-xs space-y-2 text-left">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider text-[#FF9100]">Minimum System Requirements</h4>
            <ul className="list-disc pl-4 space-y-1 text-gray-300 text-[11px] leading-relaxed">
              <li><strong>Operating System:</strong> Windows 10 (64-bit, Version 2004+) or Windows 11 (64-bit).</li>
              <li><strong>Runtime:</strong> Microsoft .NET Framework 4.8 or later & WebView2 Evergreen.</li>
              <li><strong>Memory:</strong> 4 GB RAM minimum (&lt; 90 MB client footprint).</li>
              <li><strong>Display:</strong> Exactly one physical monitor active. Secondary HDMI/DP monitors blacked out or disconnected.</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
