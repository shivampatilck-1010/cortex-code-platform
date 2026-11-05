'use client';

import React, { useState } from 'react';
import {
  Shield,
  Download,
  Monitor,
  CheckCircle2,
  Lock,
  FileText,
  Eye,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Laptop,
  Copy,
  Check,
  Terminal,
  Cpu,
  HardDrive,
  Info,
  Layers,
  HelpCircle,
  XCircle,
  Wifi,
  Radio,
  BookOpen,
} from 'lucide-react';
import Link from 'next/link';

export default function LockdownStudentDashboardPage() {
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'requirements' | 'install' | 'privacy' | 'troubleshoot'>('overview');

  const copyToClipboard = (text: string, label: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedHash(label);
      setTimeout(() => setCopiedHash(null), 2500);
    }
  };

  const SETUP_EXE_HASH = '726E4618990C614DF6AF947F72167244BD51C37F21396D0889A3F0CD62FCF0C6';
  const HARDENED_PAYLOAD_HASH = '82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895';
  const EXE_HASH = SETUP_EXE_HASH;
  const ZIP_HASH = '08BD0C5AAC9C5E7466D09A11A7E1A70F4203E131097F4C843C71231772CA6B30';
  const EXE_SIZE = '60,928 bytes (~60 KB)';
  const SETUP_SIZE = '60,928 bytes (~60 KB)';
  const HARDENED_SIZE = '35,840 bytes (35 KB)';
  const APP_VERSION = '1.0.0-rc1.2';

  return (
    <div className="min-h-screen bg-[#0B0C10] text-[#F9FAFB] flex flex-col font-sans select-none bg-[radial-gradient(#1e2129_1px,transparent_1px)] [background-size:24px_24px]">
      {/* Top Header / Navigation */}
      <header className="h-16 border-b border-[#1f2024] bg-[#0B0C10]/95 backdrop-blur-md px-4 sm:px-8 lg:px-12 flex items-center justify-between sticky top-0 z-40">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#FF9100]/10 border border-[#FF9100]/30 flex items-center justify-center text-[#FF9100]">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <span className="font-heading font-black text-sm text-white tracking-wider">CORTEX LOCKDOWN</span>
            <span className="text-[10px] text-gray-400 block font-mono">EXAMINATION CLIENT PORTAL</span>
          </div>
        </Link>

        <div className="flex items-center gap-3 text-xs font-semibold">
          <Link
            href="/classroom"
            className="text-gray-400 hover:text-white transition hidden sm:inline-block"
          >
            Classroom Portal
          </Link>
          <Link
            href="/lockdown/download"
            className="text-gray-400 hover:text-[#00E5FF] transition hidden md:inline-block"
          >
            Alternative Packages
          </Link>
          <a
            href="/api/v1/lockdown/downloads/CortexLockdown-Setup.exe"
            className="h-8 px-3.5 rounded-lg bg-[#FF9100] hover:bg-[#e08000] text-black font-bold text-xs transition flex items-center gap-1.5 shadow-md shadow-[#FF9100]/10"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </a>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#FF9100]/10 border border-[#FF9100]/30 text-[#FF9100] text-xs font-bold tracking-wide">
            <Shield className="w-3.5 h-3.5" />
            <span>OFFICIAL DESKTOP CLIENT</span>
            <span className="text-gray-500">•</span>
            <span className="text-gray-300 font-mono">v{APP_VERSION}</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-heading font-extrabold text-white tracking-tight leading-tight">
            Cortex Lockdown for Windows
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 leading-relaxed max-w-2xl mx-auto">
            A hardened desktop examination environment engineered to ensure testing fairness. Provides full-screen kiosk isolation, system shortcut suppression, screen capture protection, and tamper-evident local persistence.
          </p>

          {/* Primary Action Button */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="/api/v1/lockdown/downloads/CortexLockdown-Setup.exe"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#FF9100] hover:bg-[#e08000] text-black font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-xl shadow-[#FF9100]/15 tracking-wide"
            >
              <Download className="w-4 h-4" />
              <span>DOWNLOAD CORTEX LOCKDOWN FOR WINDOWS</span>
            </a>
            <Link
              href="/lockdown/download"
              className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-[#121316] hover:bg-[#1a1c22] text-gray-300 hover:text-white border border-[#262830] text-xs font-semibold transition flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>View All Releases & Hashes</span>
            </Link>
          </div>

          {/* Honest Release Status Pill */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-gray-400 pt-1">
            <span className="bg-[#121316] border border-[#22242b] px-2.5 py-1 rounded-md text-gray-300">
              Target: <strong className="text-white">Windows 10 / 11 (64-bit)</strong>
            </span>
            <span className="bg-[#121316] border border-[#22242b] px-2.5 py-1 rounded-md text-gray-300">
              Format: <strong className="text-white">Single-File Executable</strong> ({EXE_SIZE})
            </span>
            <span className="bg-[#121316] border border-[#22242b] px-2.5 py-1 rounded-md text-amber-300/90">
              Status: <strong>Evaluation Release Candidate</strong>
            </span>
          </div>
        </div>

        {/* Security & Code Signing Transparency Notice */}
        <div className="bg-[#121316] border border-[#FF9100]/30 rounded-2xl p-5 sm:p-6 space-y-3 relative overflow-hidden">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-[#FF9100]/10 border border-[#FF9100]/30 text-[#FF9100] flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 flex-1">
              <h3 className="text-sm font-heading font-bold text-white flex items-center gap-2">
                <span>Code Signing Disclosure & Institutional Pre-Authorization</span>
              </h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                Cortex Lockdown v{APP_VERSION} is compiled under a strict <strong className="text-white">INR 0 budget constraint</strong> and is currently unsigned by a commercial Certificate Authority. When launched on unmanaged personal PCs, <strong className="text-white">Microsoft Defender SmartScreen will display an unrecognized application warning</strong>.
              </p>
              <div className="text-[11px] text-amber-200/90 font-medium bg-[#FF9100]/10 border border-[#FF9100]/20 rounded-xl p-3 space-y-1">
                <div>
                  <strong>Mandatory Policy:</strong> Candidates must never be instructed to click &quot;Run Anyway&quot; or bypass Windows security warnings. For institutional evaluation, testing must take place on campus-managed devices with AppLocker or WDAC pre-authorization matching the authoritative hash below.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex items-center gap-1.5 border-b border-[#22242a] pb-2 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-2 rounded-lg transition whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-[#1e1f26] text-[#FF9100] border border-[#FF9100]/30'
                : 'text-gray-400 hover:text-white hover:bg-[#16171c]'
            }`}
          >
            Overview & Security
          </button>
          <button
            onClick={() => setActiveTab('requirements')}
            className={`px-3.5 py-2 rounded-lg transition whitespace-nowrap ${
              activeTab === 'requirements'
                ? 'bg-[#1e1f26] text-[#FF9100] border border-[#FF9100]/30'
                : 'text-gray-400 hover:text-white hover:bg-[#16171c]'
            }`}
          >
            System Requirements
          </button>
          <button
            onClick={() => setActiveTab('install')}
            className={`px-3.5 py-2 rounded-lg transition whitespace-nowrap ${
              activeTab === 'install'
                ? 'bg-[#1e1f26] text-[#FF9100] border border-[#FF9100]/30'
                : 'text-gray-400 hover:text-white hover:bg-[#16171c]'
            }`}
          >
            Installation Guide
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`px-3.5 py-2 rounded-lg transition whitespace-nowrap ${
              activeTab === 'privacy'
                ? 'bg-[#1e1f26] text-[#FF9100] border border-[#FF9100]/30'
                : 'text-gray-400 hover:text-white hover:bg-[#16171c]'
            }`}
          >
            Privacy Information
          </button>
          <button
            onClick={() => setActiveTab('troubleshoot')}
            className={`px-3.5 py-2 rounded-lg transition whitespace-nowrap ${
              activeTab === 'troubleshoot'
                ? 'bg-[#1e1f26] text-[#FF9100] border border-[#FF9100]/30'
                : 'text-gray-400 hover:text-white hover:bg-[#16171c]'
            }`}
          >
            Troubleshooting & Support
          </button>
        </div>

        {/* Tab 1: Overview & Security */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 bg-[#121316] border border-[#22242a] rounded-xl space-y-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#00E5FF]/10 text-[#00E5FF] flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-white">Full-Screen Kiosk Mode</h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Locks the entire display window to prevent candidate switching to web browsers, messaging tools, or external applications during an active examination.
                </p>
              </div>

              <div className="p-5 bg-[#121316] border border-[#22242a] rounded-xl space-y-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#FF9100]/10 text-[#FF9100] flex items-center justify-center">
                  <Terminal className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-white">Shortcut Suppression</h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Interprets low-level keyboard hooks to suppress Alt+Tab, Windows Key, PrintScreen, and Alt+F4, preventing unauthorized multitasking and screen grabs.
                </p>
              </div>

              <div className="p-5 bg-[#121316] border border-[#22242a] rounded-xl space-y-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Eye className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-white">Capture Blackout</h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Utilizes hardware-accelerated display affinity (WDA_EXCLUDEFROMCAPTURE) to blackout exam content from background recording software and remote desktops.
                </p>
              </div>
            </div>

            {/* Cryptographic Verification Card */}
            <div className="p-5 sm:p-6 bg-[#121316] border border-[#22242a] rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#00E5FF]" />
                    Cryptographic Integrity Verification
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Before executing the binary, verify the SHA-256 digest against the official release record.
                  </p>
                </div>
                <button
                  onClick={() => copyToClipboard(`(Get-FileHash .\\CortexLockdown-Setup.exe -Algorithm SHA256).Hash -eq "${EXE_HASH}"`, 'hash-cmd')}
                  className="px-3 py-1.5 rounded-lg bg-[#181a22] hover:bg-[#222530] text-xs font-semibold text-gray-300 hover:text-white border border-[#2c303c] transition flex items-center gap-1.5"
                >
                  {copiedHash === 'hash-cmd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedHash === 'hash-cmd' ? 'Copied' : 'Copy PowerShell Check'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-[#0a0a0d] border border-[#1e2028] rounded-lg space-y-1">
                  <div className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">Installer Digest (CortexLockdown-Setup.exe):</div>
                  <div className="font-mono text-xs text-[#00E5FF] break-all select-all">
                    {SETUP_EXE_HASH}
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono">Size: 60,928 bytes (~60 KB)</div>
                </div>
                <div className="p-3 bg-[#0a0a0d] border border-[#1e2028] rounded-lg space-y-1">
                  <div className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">Hardened Payload Digest (CortexLockdown-Hardened.exe):</div>
                  <div className="font-mono text-xs text-amber-300/90 break-all select-all">
                    {HARDENED_PAYLOAD_HASH}
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono">Size: 35,840 bytes (35 KB) • Campus IT AppLocker Rule</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: System Requirements */}
        {activeTab === 'requirements' && (
          <div className="p-6 bg-[#121316] border border-[#22242a] rounded-xl space-y-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Monitor className="w-5 h-5 text-[#FF9100]" />
                Windows System Requirements
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Verify your candidate computer meets these specifications prior to examination day.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-[#16171d] border border-[#262832] rounded-xl space-y-1.5">
                <span className="text-gray-400 text-[11px] font-semibold block uppercase">Operating System</span>
                <span className="text-white font-bold text-sm block">Windows 10 / 11 (64-bit)</span>
                <span className="text-gray-400 text-[11px] block">Windows 10 Version 2004 or newer required for screen capture exclusion API.</span>
              </div>

              <div className="p-4 bg-[#16171d] border border-[#262832] rounded-xl space-y-1.5">
                <span className="text-gray-400 text-[11px] font-semibold block uppercase">Runtime Framework</span>
                <span className="text-white font-bold text-sm block">.NET Framework 4.8+</span>
                <span className="text-gray-400 text-[11px] block">Pre-installed by default on modern Windows 10 and 11 distributions.</span>
              </div>

              <div className="p-4 bg-[#16171d] border border-[#262832] rounded-xl space-y-1.5">
                <span className="text-gray-400 text-[11px] font-semibold block uppercase">Browser Component</span>
                <span className="text-white font-bold text-sm block">Edge WebView2 Evergreen</span>
                <span className="text-gray-400 text-[11px] block">Powers secure assessment rendering; standard in Windows 10/11.</span>
              </div>

              <div className="p-4 bg-[#16171d] border border-[#262832] rounded-xl space-y-1.5">
                <span className="text-gray-400 text-[11px] font-semibold block uppercase">System Memory (RAM)</span>
                <span className="text-white font-bold text-sm block">4 GB Minimum (8 GB Rec.)</span>
                <span className="text-gray-400 text-[11px] block">Client process footprint is compact (&lt; 90 MB working set).</span>
              </div>

              <div className="p-4 bg-[#16171d] border border-[#262832] rounded-xl space-y-1.5">
                <span className="text-gray-400 text-[11px] font-semibold block uppercase">Available Disk Space</span>
                <span className="text-white font-bold text-sm block">150 MB Free Space</span>
                <span className="text-gray-400 text-[11px] block">Used for encrypted SQLite offline persistence and cached UI assets.</span>
              </div>

              <div className="p-4 bg-[#16171d] border border-[#262832] rounded-xl space-y-1.5">
                <span className="text-gray-400 text-[11px] font-semibold block uppercase">Display Configuration</span>
                <span className="text-white font-bold text-sm block">Single Physical Monitor</span>
                <span className="text-gray-400 text-[11px] block">Secondary monitors must be disconnected before launching an exam.</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Installation Guide */}
        {activeTab === 'install' && (
          <div className="p-6 bg-[#121316] border border-[#22242a] rounded-xl space-y-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Laptop className="w-5 h-5 text-[#00E5FF]" />
                Step-by-Step Installation Instructions
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Follow these four steps to install Cortex Lockdown on your evaluation computer.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex gap-4 p-4 bg-[#16171d] border border-[#262832] rounded-xl">
                <div className="w-7 h-7 rounded-lg bg-[#FF9100]/20 text-[#FF9100] flex items-center justify-center font-bold text-xs shrink-0">
                  1
                </div>
                <div className="space-y-1 flex-1">
                  <h4 className="text-xs font-bold text-white">Download the Executable</h4>
                  <p className="text-xs text-gray-400">
                    Download <code className="text-[#00E5FF]">CortexLockdown-Setup.exe</code> from the button above and place it in a local directory (e.g., your Desktop or Downloads folder).
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-[#16171d] border border-[#262832] rounded-xl">
                <div className="w-7 h-7 rounded-lg bg-[#FF9100]/20 text-[#FF9100] flex items-center justify-center font-bold text-xs shrink-0">
                  2
                </div>
                <div className="space-y-1 flex-1">
                  <h4 className="text-xs font-bold text-white">Verify Cryptographic Checksum</h4>
                  <p className="text-xs text-gray-400">
                    Open Windows PowerShell in the folder where the file is downloaded and run:
                  </p>
                  <pre className="p-2.5 bg-[#0a0a0d] border border-[#20222a] rounded text-[11px] font-mono text-gray-300 overflow-x-auto select-all">
                    Get-FileHash .\CortexLockdown-Setup.exe -Algorithm SHA256
                  </pre>
                  <p className="text-[11px] text-gray-500">
                    Ensure the returned digest matches: <span className="text-gray-300 font-mono">{EXE_HASH}</span>.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-[#16171d] border border-[#262832] rounded-xl">
                <div className="w-7 h-7 rounded-lg bg-[#FF9100]/20 text-[#FF9100] flex items-center justify-center font-bold text-xs shrink-0">
                  3
                </div>
                <div className="space-y-1 flex-1">
                  <h4 className="text-xs font-bold text-white">Protocol Association</h4>
                  <p className="text-xs text-gray-400">
                    Cortex Lockdown uses the <code className="text-cyan-400">cortex-lockdown://</code> URI scheme to transition securely from the browser into kiosk mode. Run the executable once or use the IT deployment runbook to complete registration.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-[#16171d] border border-[#262832] rounded-xl">
                <div className="w-7 h-7 rounded-lg bg-[#FF9100]/20 text-[#FF9100] flex items-center justify-center font-bold text-xs shrink-0">
                  4
                </div>
                <div className="space-y-1 flex-1">
                  <h4 className="text-xs font-bold text-white">Launch Proctored Assessment</h4>
                  <p className="text-xs text-gray-400">
                    Navigate to your assigned Classroom examination, complete the 5-step readiness check, and click <strong className="text-white">&quot;Launch in Cortex Lockdown&quot;</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Privacy Information */}
        {activeTab === 'privacy' && (
          <div className="p-6 bg-[#121316] border border-[#22242a] rounded-xl space-y-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-400" />
                Privacy & Data Retention Disclosures
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Cortex Lockdown enforces transparent boundaries. We only monitor indicators strictly relevant to exam integrity.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-[#16171d] border border-[#262832] rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4" />
                  What Cortex Lockdown Monitors
                </h4>
                <ul className="text-xs text-gray-300 space-y-2 list-disc pl-4">
                  <li>Active process names against a predefined blacklist of screen recorders, remote desktop clients, and debuggers.</li>
                  <li>System key combinations (Alt+Tab, WinKey, PrintScreen) to suppress app switching during exams.</li>
                  <li>Number of connected physical and virtual monitors to enforce single-display testing.</li>
                  <li>Periodic network heartbeat and submission timestamps to verify continuous presence.</li>
                </ul>
              </div>

              <div className="p-4 bg-[#16171d] border border-[#262832] rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-red-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <XCircle className="w-4 h-4" />
                  What Cortex Lockdown Never Does
                </h4>
                <ul className="text-xs text-gray-300 space-y-2 list-disc pl-4">
                  <li><strong>Zero Keylogging:</strong> Individual alphanumeric keystrokes are never recorded or logged.</li>
                  <li><strong>No Hidden Recording:</strong> No continuous desktop audio/video recording is saved without explicit exam proctoring disclosures.</li>
                  <li><strong>No File Scanning:</strong> Personal directories, emails, browser histories, and photos are never touched or inspected.</li>
                  <li><strong>No Persistence:</strong> Exiting the examination stops all monitoring. No background services remain running.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Troubleshooting & Support */}
        {activeTab === 'troubleshoot' && (
          <div className="p-6 bg-[#121316] border border-[#22242a] rounded-xl space-y-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-amber-400" />
                Troubleshooting & Support Information
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Solutions to the most common setup and launch difficulties.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 bg-[#16171d] border border-[#262832] rounded-xl space-y-1.5">
                <span className="font-bold text-white block">Microsoft Defender SmartScreen Warning (&quot;Windows protected your PC&quot;)</span>
                <p className="text-gray-400 leading-relaxed">
                  Because Cortex Lockdown is currently unsigned by a commercial CA (preserving zero budget), Windows displays an &quot;Unknown Publisher&quot; warning. In institutional campus environments, your lab administrator will have pre-authorized the executable via AppLocker or WDAC. If you are taking an exam on a managed campus PC, contact your lab proctor if this screen appears.
                </p>
              </div>

              <div className="p-4 bg-[#16171d] border border-[#262832] rounded-xl space-y-1.5">
                <span className="font-bold text-white block">Multiple Display Detected Error</span>
                <p className="text-gray-400 leading-relaxed">
                  Cortex Lockdown enforces single-display proctoring to prevent off-screen reference material. Disconnect all external monitors, HDMI cables, DisplayPort cables, or wireless screens before launching the exam.
                </p>
              </div>

              <div className="p-4 bg-[#16171d] border border-[#262832] rounded-xl space-y-1.5">
                <span className="font-bold text-white block">Protocol Handoff Not Launching</span>
                <p className="text-gray-400 leading-relaxed">
                  If clicking &quot;Launch in Cortex Lockdown&quot; does not open the desktop client, ensure that you have run the setup once to register the <code className="text-cyan-400">cortex-lockdown://</code> URI protocol handler in Windows.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1f2024] bg-[#0a0b0d] py-8 px-4 sm:px-8 text-center text-xs text-gray-500 space-y-2">
        <div className="flex items-center justify-center gap-4 text-gray-400">
          <Link href="/classroom" className="hover:text-white transition">Classroom</Link>
          <span>•</span>
          <Link href="/lockdown" className="hover:text-white transition">Cortex Lockdown</Link>
          <span>•</span>
          <Link href="/lockdown/download" className="hover:text-white transition">Downloads & Checksums</Link>
        </div>
        <p>Cortex Learning Systems Inc. • Strict Zero Emojis Enforced • Budget: INR 0</p>
      </footer>
    </div>
  );
}
