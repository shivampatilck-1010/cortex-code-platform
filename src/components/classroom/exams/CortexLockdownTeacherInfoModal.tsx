'use client';

import React, { useState } from 'react';
import {
  Shield,
  Download,
  Monitor,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  ExternalLink,
  X,
  FileText,
  Terminal,
  Laptop,
} from 'lucide-react';
import Link from 'next/link';

interface CortexLockdownTeacherInfoModalProps {
  onClose: () => void;
}

export function CortexLockdownTeacherInfoModal({ onClose }: CortexLockdownTeacherInfoModalProps) {
  const [copiedHash, setCopiedHash] = useState<boolean>(false);

  const SETUP_EXE_HASH = '726E4618990C614DF6AF947F72167244BD51C37F21396D0889A3F0CD62FCF0C6';
  const HARDENED_PAYLOAD_HASH = '82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895';
  const EXE_HASH = SETUP_EXE_HASH;
  const ZIP_HASH = '08BD0C5AAC9C5E7466D09A11A7E1A70F4203E131097F4C843C71231772CA6B30';
  const VERSION = '1.0.0-rc1.2';

  const copyHash = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(EXE_HASH);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0C10]/85 backdrop-blur-sm flex items-center justify-center p-4 font-sans select-none overflow-y-auto">
      <div className="bg-[#121316] border border-[#262832] rounded-2xl max-w-xl w-full p-5 sm:p-7 space-y-5 shadow-2xl relative text-left">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a1c24] transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#FF9100]/10 border border-[#FF9100]/30 text-[#FF9100] flex items-center justify-center shrink-0 mt-0.5">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-heading font-bold text-white tracking-tight">
              CORTEX LOCKDOWN
            </h3>
            <p className="text-xs text-gray-400">
              Windows Desktop Examination Security & Architecture
            </p>
          </div>
        </div>

        {/* Release & Specifications Grid */}
        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <div className="p-3 bg-[#16171e] border border-[#262832] rounded-xl space-y-1">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold block">Platform Availability</span>
            <span className="text-white font-bold block">Windows 10 & 11 (64-bit)</span>
          </div>

          <div className="p-3 bg-[#16171e] border border-[#262832] rounded-xl space-y-1">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold block">Current Release Version</span>
            <span className="text-white font-bold block">v{VERSION}</span>
          </div>

          <div className="p-3 bg-[#16171e] border border-[#262832] rounded-xl space-y-1">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold block">Installer Package</span>
            <span className="text-white font-bold block">Single-File (60 KB)</span>
          </div>

          <div className="p-3 bg-[#16171e] border border-[#262832] rounded-xl space-y-1">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold block">Protocol Scheme</span>
            <span className="text-cyan-400 font-mono font-bold block">cortex-lockdown://</span>
          </div>
        </div>

        {/* Installation Instructions for Faculty */}
        <div className="p-4 bg-[#16171e] border border-[#262832] rounded-xl space-y-2.5 text-xs">
          <span className="text-xs font-bold text-white uppercase tracking-wider block text-[#FF9100]">
            Institutional Lab Deployment Guide
          </span>
          <ol className="list-decimal pl-4 space-y-1.5 text-gray-300 text-[11px] leading-relaxed">
            <li>
              <strong>Pre-Authorize Binary:</strong> Provide the SHA-256 hash to campus IT for AppLocker or Windows Defender Application Control (WDAC) rule creation.
            </li>
            <li>
              <strong>Distribute Client:</strong> Place <code className="text-cyan-300">CortexLockdown-Setup.exe</code> on lab workstations or student test devices.
            </li>
            <li>
              <strong>Associate Protocol:</strong> Ensure <code className="text-cyan-300">cortex-lockdown://</code> is registered so browser clicks transition automatically to the desktop client.
            </li>
            <li>
              <strong>Instruct Candidates:</strong> Share the dedicated student information page with your cohort prior to the assessment window.
            </li>
          </ol>
        </div>

        {/* Checksum and Copy */}
        <div className="p-3 bg-[#0c0d10] border border-[#20222a] rounded-xl space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-400 font-semibold uppercase">Setup Installer (60,928 bytes):</span>
            <button
              onClick={copyHash}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition"
            >
              {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedHash ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <div className="font-mono text-[10px] text-gray-300 break-all select-all">
            {SETUP_EXE_HASH}
          </div>
          <div className="border-t border-[#1a1c22] pt-1.5 flex items-center justify-between">
            <span className="text-[10px] text-gray-500 uppercase">AppLocker Payload (Hardened 35,840 bytes):</span>
          </div>
          <div className="font-mono text-[10px] text-amber-300/80 break-all select-all">
            {HARDENED_PAYLOAD_HASH}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
          <Link
            href="/lockdown"
            target="_blank"
            className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-[#FF9100] hover:bg-[#e08000] text-black font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-md shadow-[#FF9100]/10"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Student Download Page</span>
          </Link>

          <a
            href="/api/v1/lockdown/downloads/CortexLockdown-Setup.exe"
            className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-[#1b1c24] hover:bg-[#252732] text-gray-200 border border-[#2c2f3b] text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Binary</span>
          </a>
        </div>
      </div>
    </div>
  );
}
