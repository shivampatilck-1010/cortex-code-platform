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
} from 'lucide-react';
import Link from 'next/link';

export default function LockdownDownloadPage() {
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(label);
    setTimeout(() => setCopiedHash(null), 2500);
  };

  const ZIP_HASH = '08BD0C5AAC9C5E7466D09A11A7E1A70F4203E131097F4C843C71231772CA6B30';
  const EXE_HASH = '82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895';

  return (
    <div className="min-h-screen bg-[#0B0C10] text-[#F9FAFB] flex flex-col font-sans select-none bg-[radial-gradient(#1e2129_1px,transparent_1px)] [background-size:24px_24px]">
      {/* Top Header / Navigation */}
      <header className="h-16 border-b border-[#22242a] bg-[#101115]/90 backdrop-blur-md px-6 lg:px-12 flex items-center justify-between sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#FF9100]/10 border border-[#FF9100]/30 flex items-center justify-center text-[#FF9100]">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <span className="font-heading font-black text-sm text-white tracking-wider">CORTEX LOCKDOWN</span>
            <span className="text-[10px] text-gray-400 block font-mono">SECURE ASSESSMENT CLIENT</span>
          </div>
        </Link>

        <div className="flex items-center gap-4 text-xs font-semibold">
          <Link href="/login" className="text-gray-400 hover:text-white transition">
            Sign In to Cortex
          </Link>
          <Link
            href="/lockdown/workspace"
            className="h-8 px-4 rounded-lg bg-[#181920] hover:bg-[#22242c] text-gray-200 border border-[#2a2d36] transition flex items-center gap-1.5"
          >
            <span>Launch Web App</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#FF9100]" />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-12 lg:py-16 space-y-12">
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF9100]/10 border border-[#FF9100]/30 text-[#FF9100] text-xs font-bold uppercase tracking-wider">
            <span>Release Candidate v1.0.0-rc1.2</span>
            <span className="text-gray-500">•</span>
            <span className="text-gray-400 font-mono">Staging Pilot & Evaluation</span>
          </div>
          <h1 className="text-3xl lg:text-5xl font-heading font-extrabold text-white tracking-tight">
            Cortex Lockdown Client Download
          </h1>
          <p className="text-xs lg:text-sm text-gray-400 leading-relaxed max-w-2xl mx-auto">
            A dedicated Windows desktop examination environment providing full-screen kiosk isolation, low-level keyboard hook suppression, hardware display capture blackout, and encrypted offline answer persistence.
          </p>
        </div>

        {/* Security & Code Signing Transparency Notice */}
        <div className="bg-[#161412] border border-[#FF9100]/30 rounded-2xl p-6 lg:p-8 space-y-4 relative overflow-hidden">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#FF9100]/10 border border-[#FF9100]/40 text-[#FF9100] flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-heading font-bold text-white flex items-center gap-2">
                <span>Code Signing Notice & Institutional Pre-Authorization Protocol</span>
              </h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                Cortex Lockdown binaries are compiled under a strict <strong className="text-white">INR 0 budget constraint</strong> and are currently unsigned by a commercial Certificate Authority. When launched on unmanaged personal PCs, <strong className="text-white">Microsoft Defender SmartScreen will display an unrecognized application warning</strong>.
              </p>
              <div className="text-xs text-amber-200/90 font-medium bg-[#FF9100]/10 border border-[#FF9100]/20 rounded-xl p-3.5 space-y-1.5">
                <div>
                  <strong>Mandatory Policy:</strong> Campus IT policies and faculty runbooks strictly prohibit instructing candidates to click &quot;Run Anyway&quot; or bypass Windows security prompts.
                </div>
                <div className="text-gray-400">
                  Campus IT administrators must pre-authorize the verified SHA-256 binary hash in Windows Defender Application Control (WDAC) or AppLocker before laboratory examination sessions.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Download Matrix: Evaluation Packages vs Blocked Platforms */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Windows Portable Distribution ZIP (Recommended for Pilot) */}
          <div className="bg-[#121316] border border-[#22242a] hover:border-[#30333d] rounded-2xl p-6 flex flex-col justify-between space-y-6 relative group">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-blue-950/60 border border-blue-800/60 text-blue-400 flex items-center justify-center">
                  <Monitor className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 text-[10px] font-mono font-bold uppercase">
                  Pilot Qualified
                </span>
              </div>

              <div>
                <span className="text-[10px] text-gray-500 font-mono uppercase">Controlled Evaluation Package</span>
                <h3 className="text-lg font-heading font-bold text-white mt-0.5">Windows Portable ZIP</h3>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                  Self-contained portable distribution including the hardened application, protocol registrar, and installer/uninstaller scripts.
                </p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-[#1e2028] text-xs text-gray-300 font-mono text-[11px]">
                <div>File: CortexLockdown-Windows-x64.zip</div>
                <div>Size: 18.7 KB (18,700 bytes)</div>
                <div>Platform: Windows 10 & 11 (x64)</div>
                <div className="text-[10px] text-gray-500 break-all">SHA-256: {ZIP_HASH}</div>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-[#1e2028]">
              <a
                href="/api/v1/lockdown/downloads/CortexLockdown-Windows-x64.zip"
                download="CortexLockdown-Windows-x64.zip"
                className="w-full h-11 rounded-xl bg-[#FF9100] hover:bg-[#e08000] text-black font-heading font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-[#FF9100]/10"
              >
                <Download className="w-4 h-4" />
                <span>Download Portable ZIP</span>
              </a>
              <button
                onClick={() => copyToClipboard(ZIP_HASH, 'zip')}
                className="w-full text-[10px] text-gray-400 hover:text-white font-mono flex items-center justify-center gap-1.5 py-1"
              >
                {copiedHash === 'zip' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedHash === 'zip' ? 'SHA-256 Copied!' : 'Copy SHA-256 Digest'}</span>
              </button>
            </div>
          </div>

          {/* Card 2: Hardened Standalone Binary */}
          <div className="bg-[#121316] border border-[#22242a] hover:border-[#30333d] rounded-2xl p-6 flex flex-col justify-between space-y-6 relative group">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-amber-950/60 border border-amber-800/60 text-amber-400 flex items-center justify-center">
                  <Terminal className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-950/60 border border-blue-800/60 text-blue-400 text-[10px] font-mono font-bold uppercase">
                  Standalone Binary
                </span>
              </div>

              <div>
                <span className="text-[10px] text-gray-500 font-mono uppercase">Direct Windows Executable</span>
                <h3 className="text-lg font-heading font-bold text-white mt-0.5">CortexLockdown-Hardened</h3>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                  Standalone compiled Win32 PE32+ executable with integrated assembly metadata and embedded manifest.
                </p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-[#1e2028] text-xs text-gray-300 font-mono text-[11px]">
                <div>File: CortexLockdown-Hardened.exe</div>
                <div>Size: 35.8 KB (35,840 bytes)</div>
                <div>Platform: Windows 10 & 11 (x64)</div>
                <div className="text-[10px] text-gray-500 break-all">SHA-256: {EXE_HASH}</div>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-[#1e2028]">
              <a
                href="/api/v1/lockdown/downloads/CortexLockdown-Hardened.exe"
                download="CortexLockdown-Hardened.exe"
                className="w-full h-11 rounded-xl bg-[#181920] hover:bg-[#22242c] text-white font-heading font-bold text-xs border border-[#2a2d36] transition flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4 text-[#FF9100]" />
                <span>Download Hardened EXE</span>
              </a>
              <button
                onClick={() => copyToClipboard(EXE_HASH, 'exe')}
                className="w-full text-[10px] text-gray-400 hover:text-white font-mono flex items-center justify-center gap-1.5 py-1"
              >
                {copiedHash === 'exe' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedHash === 'exe' ? 'SHA-256 Copied!' : 'Copy SHA-256 Digest'}</span>
              </button>
            </div>
          </div>

          {/* Card 3: macOS Architecture Status (Honest Blocker) */}
          <div className="bg-[#121316] border border-[#22242a] rounded-2xl p-6 flex flex-col justify-between space-y-6 opacity-75">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-400 flex items-center justify-center">
                  <Laptop className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-rose-950/60 border border-rose-800/60 text-rose-400 text-[10px] font-mono font-bold uppercase">
                  Blocked / Non-Goal
                </span>
              </div>

              <div>
                <span className="text-[10px] text-gray-500 font-mono uppercase">Apple macOS Platform</span>
                <h3 className="text-lg font-heading font-bold text-white mt-0.5">macOS Architecture</h3>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                  Cortex Lockdown relies upon Windows Win32 API subsystems (WH_KEYBOARD_LL, SetWindowDisplayAffinity, Task Manager registry controls).
                </p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-[#1e2028] text-xs text-rose-300 font-mono text-[11px]">
                <div>Status: Not Supported in v1.0</div>
                <div>Requirement: Native Cocoa / Quartz Engine</div>
                <div>Release Decision: NO-GO</div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#1e2028]">
              <div className="w-full h-11 rounded-xl bg-[#181920]/60 text-gray-500 font-heading font-bold text-xs border border-[#22242a] flex items-center justify-center gap-2 cursor-not-allowed">
                <XCircle className="w-4 h-4 text-rose-500" />
                <span>macOS Build Unavailable</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cryptographic SHA-256 Verification Guide */}
        <div className="bg-[#121316] border border-[#22242a] rounded-2xl p-6 lg:p-8 space-y-4">
          <h3 className="text-sm font-heading font-bold text-white flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>Cryptographic Integrity Verification Instructions</span>
          </h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            Verify the cryptographic SHA-256 checksum of your downloaded package in PowerShell or Windows Command Prompt before execution:
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
            <div className="bg-[#090a0d] border border-[#1e2028] rounded-xl p-4 space-y-2 font-mono text-xs">
              <div className="text-gray-500 text-[11px] font-sans font-semibold">PowerShell (Recommended):</div>
              <div className="text-cyan-300 select-all overflow-x-auto whitespace-pre">
                Get-FileHash CortexLockdown-Windows-x64.zip -Algorithm SHA256
              </div>
              <div className="text-[11px] text-gray-400">
                Expected: <span className="text-emerald-400 break-all">{ZIP_HASH}</span>
              </div>
            </div>

            <div className="bg-[#090a0d] border border-[#1e2028] rounded-xl p-4 space-y-2 font-mono text-xs">
              <div className="text-gray-500 text-[11px] font-sans font-semibold">Windows Command Prompt:</div>
              <div className="text-cyan-300 select-all overflow-x-auto whitespace-pre">
                certutil -hashfile CortexLockdown-Windows-x64.zip SHA256
              </div>
              <div className="text-[11px] text-gray-400">
                Expected: <span className="text-emerald-400 break-all">{ZIP_HASH}</span>
              </div>
            </div>
          </div>
        </div>

        {/* System Requirements & Step-by-Step Installation Guide */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Minimum System Requirements */}
          <div className="bg-[#121316] border border-[#22242a] rounded-2xl p-6 lg:p-8 space-y-4">
            <h3 className="text-sm font-heading font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#FF9100]" />
              <span>Minimum System Requirements</span>
            </h3>
            <ul className="space-y-2.5 text-xs text-gray-300">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Operating System:</strong> Windows 10 Version 1809 (Build 17763) or Windows 11 (64-bit x64 architecture).
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Runtimes:</strong> Microsoft Edge WebView2 Evergreen Runtime &amp; Microsoft .NET Framework 4.8+.
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Hardware:</strong> Dual-core x64 CPU, 4 GB RAM, 100 MB available storage.
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Display &amp; Peripherals:</strong> 1280x720 minimum resolution. Single physical display only (multi-monitor disallowed during active testing).
                </div>
              </li>
            </ul>
          </div>

          {/* Installation & Deployment Guide */}
          <div className="bg-[#121316] border border-[#22242a] rounded-2xl p-6 lg:p-8 space-y-4">
            <h3 className="text-sm font-heading font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#00E5FF]" />
              <span>Installation &amp; Execution Protocol</span>
            </h3>
            <ol className="space-y-2.5 text-xs text-gray-300 list-decimal list-inside">
              <li>
                <span className="text-white font-medium">Download &amp; Verify:</span> Download the portable archive and confirm the SHA-256 hash matches the authoritative digest.
              </li>
              <li>
                <span className="text-white font-medium">Extract Package:</span> Extract <code className="text-cyan-300">CortexLockdown-Windows-x64.zip</code> to a designated local folder (e.g., <code className="text-gray-300">%LOCALAPPDATA%\CortexLockdown</code>).
              </li>
              <li>
                <span className="text-white font-medium">Register Protocol:</span> Run <code className="text-cyan-300">install.bat</code> to register the <code className="text-amber-400">cortex-lockdown://</code> URI protocol and create Start Menu shortcuts.
              </li>
              <li>
                <span className="text-white font-medium">Authentication &amp; Launch:</span> Log in to your Cortex university portal and click &quot;Launch Assessment in Cortex Lockdown&quot;.
              </li>
              <li>
                <span className="text-white font-medium">Emergency Override:</span> In the event of a proctor intervention, invoke <code className="text-amber-400 font-bold">Ctrl + Alt + F10</code> and enter the proctor challenge code.
              </li>
            </ol>
          </div>
        </div>

        {/* Privacy & Security Boundaries Disclosures */}
        <div className="bg-[#121316] border border-[#22242a] rounded-2xl p-6 lg:p-8 space-y-6">
          <div className="space-y-2">
            <h3 className="text-sm font-heading font-bold text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#FF9100]" />
              <span>Transparent Privacy Architecture &amp; Security Boundaries</span>
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Cortex operates under an explicit transparent engineering charter. We explicitly document what our software protects against, what it does not protect against, and how student data is processed.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-gray-300 pt-2 border-t border-[#1e2028]">
            <div className="space-y-3">
              <h4 className="font-semibold text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Verified Privacy Commitments</span>
              </h4>
              <ul className="space-y-2 text-gray-400 list-disc list-inside">
                <li><strong className="text-gray-300">In-RAM Analysis:</strong> Facial presence and audio RMS levels are analyzed ephemerally in volatile RAM; zero raw video or continuous audio streams are stored or uploaded.</li>
                <li><strong className="text-gray-300">Wire Packet Capture Boundary:</strong> Egress privacy is verified at the source application layer; physical network wire packet sniffing is classified as unverified at the wire layer.</li>
                <li><strong className="text-gray-300">Encrypted Local Persistence:</strong> Answers are encrypted with AES-256-GCM (100,000 PBKDF2 rounds) with salted session bindings.</li>
                <li><strong className="text-gray-300">Flash Wear-Leveling Disclosure:</strong> SSD Flash Translation Layer (FTL) wear leveling leaves unzeroed ciphertext on NAND; protection rests on AES-256-GCM.</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-white flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Documented Security Boundaries &amp; Non-Goals</span>
              </h4>
              <ul className="space-y-2 text-gray-400 list-disc list-inside">
                <li><strong className="text-gray-300">Ctrl+Alt+Del Kernel Boundary:</strong> The Secure Attention Sequence is processed by Winlogon in the Windows kernel; user-mode software cannot intercept it.</li>
                <li><strong className="text-gray-300">Hardware Video Splitters:</strong> Physical HDMI capture taps operate downstream of the GPU TMDS transmitter and require physical proctoring.</li>
                <li><strong className="text-gray-300">SAML Federation Status:</strong> Non-W3C Exclusive C14N XML canonicalizer blocks multi-institution federations; LTI 1.3 is recommended.</li>
                <li><strong className="text-gray-300">SSRF Forward Proxy Requirement:</strong> Preflight DNS resolution requires an enterprise forward proxy with destination socket pinning in zero-trust setups.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Active Defect Register & Support */}
        <div className="bg-[#121316] border border-[#22242a] rounded-2xl p-6 lg:p-8 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-heading font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-cyan-400" />
                <span>Active Defect Register &amp; Institutional Support</span>
              </h3>
              <p className="text-xs text-gray-400">
                Current release tracking active defects: DEF-RC1-001 (SAML C14N), DEF-RC1-002 (Cloudflare D1 high-concurrency untested), DEF-RC1-003 (SSRF secondary DNS lookup), DEF-RC1-006 (SmartScreen unsigned warning).
              </p>
            </div>

            <Link
              href="/lockdown/workspace"
              className="h-10 px-5 rounded-xl bg-[#181920] hover:bg-[#22242c] text-xs font-semibold text-gray-200 border border-[#2a2d36] transition flex items-center gap-2 shrink-0 self-start md:self-auto"
            >
              <span>Test Web Sandbox</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#22242a] py-6 px-6 lg:px-12 text-center text-xs text-gray-500">
        <div>Cortex Lockdown • Secure Desktop Assessment Client • Release Candidate 1.2 • November 2026</div>
      </footer>
    </div>
  );
}
