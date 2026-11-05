'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Activity,
  Users,
  Clock,
  Shield,
  ShieldAlert,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Search,
  ExternalLink,
  PlusCircle,
  StopCircle,
  Eye,
  Maximize2,
  Wifi,
  WifiOff,
  Radio,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Download,
} from 'lucide-react';
import {
  ExamLiveDashboardData,
  CandidateSessionInfo,
  getIntegrityEventSeverity,
  IntegrityEventSeverity,
} from '@/lib/classroom/models';

interface ExamLiveDashboardModalProps {
  classroomId: string;
  examId: string;
  onClose: () => void;
}

export function ExamLiveDashboardModal({
  classroomId,
  examId,
  onClose,
}: ExamLiveDashboardModalProps) {
  const [data, setData] = useState<ExamLiveDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'in_progress' | 'submitted' | 'expired' | 'attention'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoPoll, setAutoPoll] = useState(true);

  // Candidate detail state
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateSessionInfo | null>(null);
  const [candidateDetail, setCandidateDetail] = useState<any | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Time extension modal state
  const [extendingUserId, setExtendingUserId] = useState<string | null>(null);
  const [extensionMinutes, setExtensionMinutes] = useState(15);
  const [isSubmittingExtension, setIsSubmittingExtension] = useState(false);

  // Termination modal state (Replaces window.prompt)
  const [candidateToTerminate, setCandidateToTerminate] = useState<CandidateSessionInfo | null>(null);
  const [terminationReason, setTerminationReason] = useState('Manual termination by proctor');
  const [isSubmittingTermination, setIsSubmittingTermination] = useState(false);

  // Policy & RBAC Administration modal state
  const [showPolicyModal, setShowPolicyModal] = useState(false);

  // In-modal action notification banner
  const [actionBanner, setActionBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const showBanner = (type: 'success' | 'error', message: string) => {
    setActionBanner({ type, message });
    setTimeout(() => {
      setActionBanner((prev) => (prev?.message === message ? null : prev));
    }, 6000);
  };

  const fetchDashboardData = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/v1/classrooms/${classroomId}/exams/${examId}/dashboard`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to load live examination dashboard');
      }
      const json: ExamLiveDashboardData = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err?.message || 'Error fetching dashboard telemetry');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [classroomId, examId]);

  // Periodic polling effect
  useEffect(() => {
    if (!autoPoll) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    pollIntervalRef.current = setInterval(() => {
      fetchDashboardData(true);
    }, 8000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [autoPoll, classroomId, examId]);

  // Load detailed inspection for a specific candidate
  const handleOpenCandidateDetail = async (cand: CandidateSessionInfo) => {
    setSelectedCandidate(cand);
    setCandidateDetail(null);
    if (!cand.sessionId) return;

    try {
      setIsLoadingDetail(true);
      const res = await fetch(
        `/api/v1/classrooms/${classroomId}/exams/${examId}/dashboard/candidates/${cand.userId}`
      );
      if (res.ok) {
        const json = await res.json();
        setCandidateDetail(json);
      }
    } catch (_) {
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Teacher Action: Grant Time Extension
  const handleGrantTimeExtension = async () => {
    if (!extendingUserId) return;
    setIsSubmittingExtension(true);
    const candidateName = data?.candidates.find((c) => c.userId === extendingUserId)?.name || extendingUserId;

    try {
      const res = await fetch(
        `/api/v1/classrooms/${classroomId}/exams/${examId}/dashboard/candidates/${extendingUserId}/extend-time`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ additionalMinutes: extensionMinutes }),
        }
      );
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to extend time');
      }
      showBanner('success', `Granted ${extensionMinutes} minutes extension to ${candidateName}.`);
      setExtendingUserId(null);
      fetchDashboardData(true);
    } catch (err: any) {
      showBanner('error', err.message || 'Error extending examination time.');
    } finally {
      setIsSubmittingExtension(false);
    }
  };

  // Teacher Action: Terminate Attempt (In-modal execution)
  const handleExecuteTermination = async () => {
    if (!candidateToTerminate) return;
    setIsSubmittingTermination(true);
    const candidateName = candidateToTerminate.name;

    try {
      const res = await fetch(
        `/api/v1/classrooms/${classroomId}/exams/${examId}/dashboard/candidates/${candidateToTerminate.userId}/terminate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: terminationReason, action: 'force_submit' }),
        }
      );
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to terminate candidate attempt');
      }
      showBanner('success', `Examination attempt concluded for ${candidateName}.`);
      setCandidateToTerminate(null);
      fetchDashboardData(true);
    } catch (err: any) {
      showBanner('error', err.message || 'Error terminating session.');
    } finally {
      setIsSubmittingTermination(false);
    }
  };

  // Faculty Action: Export Full Examination Audit Report
  const handleExportReport = () => {
    if (!data) return;
    const report = {
      title: 'Cortex Examination Audit Report',
      classroomId,
      examId,
      exportedAt: new Date().toISOString(),
      fairnessNotice: 'Algorithmic indicators are heuristic review signals, not proof of misconduct. Final determinations require human proctor review.',
      metrics: {
        totalEnrolled: data.metrics.totalCandidates,
        inProgress: data.metrics.inProgress,
        submitted: data.metrics.submitted,
        attentionNeeded: data.metrics.requiresAttention,
      },
      candidates: data.candidates.map((c) => ({
        userId: c.userId,
        name: c.name,
        email: c.email,
        status: c.status,
        score: c.autoScore,
        integrityEventCount: c.integrityEventCount,
        connectionState: c.connectionState,
        lastHeartbeatAt: c.lastHeartbeatAt,
      })),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cortex-exam-audit-${examId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showBanner('success', 'Examination audit report exported successfully.');
  };

  // Faculty Action: Export Cohort Summary (CSV)
  const handleExportReportCsv = () => {
    if (!data) return;
    const headers = [
      'User ID',
      'Name',
      'Email',
      'Status',
      'AutoScore',
      'Integrity Events',
      'Connection',
      'Last Heartbeat',
    ];
    const escapeCsv = (val: any) => {
      const s = String(val === undefined || val === null ? '' : val);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const rows = data.candidates.map((c) => [
      escapeCsv(c.userId),
      escapeCsv(c.name),
      escapeCsv(c.email),
      escapeCsv(c.status),
      escapeCsv(c.autoScore),
      escapeCsv(c.integrityEventCount),
      escapeCsv(c.connectionState),
      escapeCsv(c.lastHeartbeatAt ? new Date(c.lastHeartbeatAt).toISOString() : 'Never'),
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cortex-exam-cohort-${examId}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showBanner('success', 'Cohort CSV report exported successfully.');
  };

  const filteredCandidates = (data?.candidates || []).filter((cand) => {
    if (filter === 'in_progress' && cand.status !== 'in_progress') return false;
    if (filter === 'submitted' && cand.status !== 'submitted') return false;
    if (filter === 'expired' && cand.status !== 'timed_out') return false;
    if (filter === 'attention') {
      const needsAttention = cand.integrityEventCount >= 2 || cand.connectionState === 'stale';
      if (!needsAttention) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return cand.name.toLowerCase().includes(q) || cand.email.toLowerCase().includes(q);
    }
    return true;
  });

  const formatRemainingTime = (seconds: number) => {
    if (seconds <= 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatHeartbeatTime = (timestamp?: number | null) => {
    if (!timestamp) return 'Never';
    const diff = Date.now() - timestamp;
    if (diff < 15000) return 'Just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0f1013] border border-[#262830] rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-[#22242b] flex items-center justify-between bg-[#0c0d10]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-emerald-400">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white">Live Proctoring & Session Monitor</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-950 text-emerald-300 border border-emerald-800">
                  Live
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Authoritative real-time candidate telemetry, heartbeat tracking, and integrity event logging.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-gray-400 mr-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoPoll}
                onChange={(e) => setAutoPoll(e.target.checked)}
                className="rounded border-[#30333d] bg-[#1a1b22] text-[#FF9100] focus:ring-0"
              />
              <span>Auto-refresh (8s)</span>
            </label>
            <button
              onClick={() => setShowPolicyModal(true)}
              className="px-3 py-1.5 rounded-lg bg-[#16171c] hover:bg-[#20222a] text-xs font-semibold text-blue-300 hover:text-white border border-blue-900/60 transition flex items-center gap-1.5"
              title="Inspect Institutional Exam Policy & Governance"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-blue-400" />
              <span>Policy & RBAC</span>
            </button>
            <button
              onClick={handleExportReport}
              disabled={!data || data.candidates.length === 0}
              className="px-3 py-1.5 rounded-lg bg-[#16171c] hover:bg-[#20222a] text-xs font-semibold text-gray-300 hover:text-white border border-[#2a2d36] transition flex items-center gap-1.5 disabled:opacity-50"
              title="Export Full Audit Report (JSON)"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export Audit</span>
            </button>
            <button
              onClick={handleExportReportCsv}
              disabled={!data || data.candidates.length === 0}
              className="px-3 py-1.5 rounded-lg bg-[#16171c] hover:bg-[#20222a] text-xs font-semibold text-gray-300 hover:text-white border border-[#2a2d36] transition flex items-center gap-1.5 disabled:opacity-50"
              title="Export Cohort Data (CSV)"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => fetchDashboardData(false)}
              disabled={isLoading}
              className="p-2 rounded-lg bg-[#16171c] hover:bg-[#20222a] text-gray-300 hover:text-white border border-[#2a2d36] transition"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[#1a1c22] text-gray-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cortex Lockdown Enforcement & Native Session Status Banner */}
        {data?.exam?.securityLevel === 'restricted' && (
          <div className="p-3.5 bg-gradient-to-r from-cyan-950/40 via-[#101520] to-[#0d0e12] border-b border-cyan-800/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-700/50 text-[#FF9100]">
                <Shield className="w-5 h-5 text-[#FF9100]" />
              </div>
              <div>
                <div className="flex items-center gap-2 font-semibold text-white">
                  <span>Cortex Lockdown Enforcement Active</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                    Windows 10/11 x64
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono text-gray-300 bg-gray-900 border border-gray-800">
                    Client v1.0.0-rc1.2
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Standard browser access is blocked. Candidates must authenticate and launch via native client (<code className="text-cyan-300">cortex-lockdown://</code>) with an active launch grant.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-[11px] w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-2 md:pt-0 border-cyan-900/30">
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-gray-400 block text-[10px] uppercase font-mono">Verified Active</span>
                  <span className="text-emerald-400 font-bold font-mono">
                    {data.candidates.filter((c) => c.status === 'in_progress' && c.connectionState === 'active').length}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-gray-400 block text-[10px] uppercase font-mono">Stale / Attention</span>
                  <span className="text-amber-400 font-bold font-mono">
                    {data.candidates.filter((c) => c.connectionState === 'stale' || c.integrityEventCount > 0).length}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-gray-400 block text-[10px] uppercase font-mono">Pending Launch</span>
                  <span className="text-gray-300 font-bold font-mono">
                    {data.candidates.filter((c) => c.status === 'not_started').length}
                  </span>
                </div>
              </div>
              <a
                href="/lockdown"
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 rounded-lg bg-cyan-900/40 hover:bg-cyan-900/70 text-cyan-200 border border-cyan-700/60 font-semibold transition flex items-center gap-1.5"
                title="View Student Installation Guidance & Verification Hashes"
              >
                <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                <span>Installation Guidance</span>
              </a>
            </div>
          </div>
        )}

        {/* Action Notification Banner */}
        {actionBanner && (
          <div
            className={`px-4 py-2 text-xs flex items-center justify-between border-b ${
              actionBanner.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                : 'bg-rose-950/60 border-rose-800 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {actionBanner.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400" />
              )}
              <span>{actionBanner.message}</span>
            </div>
            <button
              onClick={() => setActionBanner(null)}
              className="text-gray-400 hover:text-white text-xs font-semibold"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Metrics Banner */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 p-4 border-b border-[#1f2128] bg-[#111217]">
            <div className="p-2.5 rounded-lg bg-[#16171d] border border-[#23252f]">
              <span className="text-[10px] text-gray-400 block font-semibold uppercase">Total Candidates</span>
              <span className="text-lg font-bold text-white">{data.metrics.totalCandidates}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#16171d] border border-[#23252f]">
              <span className="text-[10px] text-gray-400 block font-semibold uppercase">Not Started</span>
              <span className="text-lg font-bold text-gray-300">{data.metrics.notStarted}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#16171d] border border-[#23252f]">
              <span className="text-[10px] text-emerald-400 block font-semibold uppercase">Active Testing</span>
              <span className="text-lg font-bold text-emerald-400">{data.metrics.inProgress}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#16171d] border border-[#23252f]">
              <span className="text-[10px] text-cyan-400 block font-semibold uppercase">Submitted</span>
              <span className="text-lg font-bold text-cyan-300">{data.metrics.submitted}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#16171d] border border-[#23252f]">
              <span className="text-[10px] text-amber-400 block font-semibold uppercase">Expired</span>
              <span className="text-lg font-bold text-amber-300">{data.metrics.expired}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-900/40">
              <span className="text-[10px] text-rose-400 block font-semibold uppercase">Attention Flag</span>
              <span className="text-lg font-bold text-rose-300">{data.metrics.requiresAttention}</span>
            </div>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="p-4 border-b border-[#1e2027] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0d0e12]">
          <div className="flex items-center gap-1.5 p-1 bg-[#14151a] border border-[#252730] rounded-lg">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition ${
                filter === 'all' ? 'bg-[#FF9100]/20 text-[#FF9100] font-semibold' : 'text-gray-400 hover:text-white'
              }`}
            >
              All ({data?.candidates.length || 0})
            </button>
            <button
              onClick={() => setFilter('in_progress')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition ${
                filter === 'in_progress' ? 'bg-emerald-950 text-emerald-300 font-semibold' : 'text-gray-400 hover:text-white'
              }`}
            >
              Active ({data?.metrics.inProgress || 0})
            </button>
            <button
              onClick={() => setFilter('submitted')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition ${
                filter === 'submitted' ? 'bg-cyan-950 text-cyan-300 font-semibold' : 'text-gray-400 hover:text-white'
              }`}
            >
              Submitted ({data?.metrics.submitted || 0})
            </button>
            <button
              onClick={() => setFilter('attention')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition ${
                filter === 'attention' ? 'bg-rose-950 text-rose-300 font-semibold' : 'text-gray-400 hover:text-white'
              }`}
            >
              Attention Needed ({data?.metrics.requiresAttention || 0})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              placeholder="Search candidate name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#14151a] border border-[#252730] rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FF9100]/50"
            />
          </div>
        </div>

        {/* Candidates Table */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="p-3 mb-4 bg-red-950/40 border border-red-800 text-red-200 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {filteredCandidates.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-[#22242b] rounded-xl text-gray-400 text-xs">
              No candidates match the specified filter criteria.
            </div>
          ) : (
            <div className="border border-[#20222a] rounded-xl overflow-hidden bg-[#111217]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#16171d] border-b border-[#232530] text-gray-400 uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Candidate</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold">Connection</th>
                    <th className="py-2.5 px-3 font-semibold">Last Heartbeat</th>
                    <th className="py-2.5 px-3 font-semibold">Time Remaining</th>
                    <th className="py-2.5 px-3 font-semibold">Integrity Events</th>
                    <th className="py-2.5 px-3 font-semibold">Flagged Qs</th>
                    <th className="py-2.5 px-3 font-semibold">Score</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1c1d25] text-gray-300">
                  {filteredCandidates.map((cand) => {
                    const isAttn = cand.integrityEventCount >= 2 || cand.connectionState === 'stale';

                    return (
                      <tr
                        key={cand.userId}
                        className={`hover:bg-[#181922] transition ${isAttn ? 'bg-rose-950/10' : ''}`}
                      >
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-white">{cand.name}</div>
                          <div className="text-[11px] text-gray-500">{cand.email}</div>
                        </td>

                        <td className="py-2.5 px-3">
                          {cand.status === 'in_progress' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 animate-pulse">
                              In Progress
                            </span>
                          ) : cand.status === 'submitted' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                              Submitted
                            </span>
                          ) : cand.status === 'timed_out' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                              Expired
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-800 text-gray-400">
                              Not Started
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3">
                          {cand.connectionState === 'active' ? (
                            <span className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                              Active
                            </span>
                          ) : cand.connectionState === 'stale' ? (
                            <span className="flex items-center gap-1.5 text-[11px] text-amber-400" title="No heartbeat in last 60s">
                              <span className="w-2 h-2 rounded-full bg-amber-400" />
                              Stale Heartbeat
                            </span>
                          ) : cand.status === 'in_progress' ? (
                            <span className="flex items-center gap-1.5 text-[11px] text-rose-400">
                              <WifiOff className="w-3 h-3" />
                              Disconnected
                            </span>
                          ) : (
                            <span className="text-gray-500 text-[11px]">-</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 font-mono text-[11px] text-gray-400">
                          {formatHeartbeatTime(cand.lastHeartbeatAt)}
                        </td>

                        <td className="py-2.5 px-3 font-mono font-medium">
                          {cand.status === 'in_progress' ? (
                            <span className={cand.remainingSeconds < 300 ? 'text-rose-400 font-bold' : 'text-gray-200'}>
                              {formatRemainingTime(cand.remainingSeconds)}
                            </span>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3">
                          {cand.integrityEventCount > 0 ? (
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                                cand.integrityEventCount >= 2
                                  ? 'bg-rose-950/50 border-rose-800 text-rose-300'
                                  : 'bg-amber-950/40 border-amber-800 text-amber-300'
                              }`}
                            >
                              {cand.integrityEventCount} Events
                            </span>
                          ) : (
                            <span className="text-gray-500 text-[11px]">0</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3">
                          {cand.flaggedQuestionCount > 0 ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950/40 border border-amber-800 text-amber-300">
                              {cand.flaggedQuestionCount} Flagged
                            </span>
                          ) : (
                            <span className="text-gray-500 text-[11px]">0</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 font-semibold">
                          {cand.finalScore !== null && cand.finalScore !== undefined ? (
                            <span className="text-emerald-400">{cand.finalScore} pts</span>
                          ) : cand.status === 'submitted' ? (
                            <span className="text-gray-400">{cand.autoScore} (Pending Review)</span>
                          ) : (
                            <span className="text-gray-600">-</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenCandidateDetail(cand)}
                              className="p-1.5 rounded hover:bg-[#20222c] text-gray-300 hover:text-white"
                              title="Inspect Candidate Timeline"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {cand.status === 'in_progress' && (
                              <>
                                <button
                                  onClick={() => setExtendingUserId(cand.userId)}
                                  className="p-1.5 rounded hover:bg-[#20222c] text-emerald-400"
                                  title="Grant Extra Time"
                                >
                                  <Clock className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setCandidateToTerminate(cand);
                                    setTerminationReason('Manual termination by proctor');
                                  }}
                                  className="p-1.5 rounded hover:bg-red-950/40 text-rose-400"
                                  title="Conclude / Terminate Attempt"
                                >
                                  <StopCircle className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Time Extension Dialog */}
        {extendingUserId && (
          <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-[#14151a] border border-[#2a2d36] rounded-xl p-5 w-full max-w-sm space-y-4 shadow-2xl">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#FF9100]" />
                Grant Individual Time Extension
              </h4>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Extends official candidate expiration. Synchronizes to active session countdown immediately. An authoritative audit entry will be recorded.
              </p>

              {/* Preset buttons */}
              <div>
                <label className="block text-[11px] text-gray-400 mb-1.5">Quick Presets:</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[5, 10, 15, 30].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setExtensionMinutes(preset)}
                      className={`py-1 rounded text-xs font-semibold border transition ${
                        extensionMinutes === preset
                          ? 'bg-[#FF9100]/20 border-[#FF9100] text-[#FF9100]'
                          : 'bg-[#181920] border-[#252732] text-gray-300 hover:border-gray-500'
                      }`}
                    >
                      +{preset}m
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-gray-300 mb-1">Additional Minutes</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={extensionMinutes}
                  onChange={(e) => setExtensionMinutes(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-1.5 bg-[#0e0f12] border border-[#252730] rounded text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setExtendingUserId(null)}
                  disabled={isSubmittingExtension}
                  className="px-3 py-1.5 rounded bg-[#1c1d24] text-xs text-gray-300 hover:bg-[#252732]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingExtension}
                  onClick={handleGrantTimeExtension}
                  className="px-4 py-1.5 rounded bg-[#FF9100] text-black font-bold text-xs disabled:opacity-50 hover:bg-[#e08000]"
                >
                  {isSubmittingExtension ? 'Granting...' : 'Confirm Extension'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Terminate Candidate Attempt Dialog (Confirmed in-modal dialog replacing window.prompt) */}
        {candidateToTerminate && (
          <div className="fixed inset-0 z-60 bg-black/75 flex items-center justify-center p-4">
            <div className="bg-[#14151a] border border-rose-900/60 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
              <div className="flex items-center gap-2.5 text-rose-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">Confirm Early Attempt Termination</h3>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                You are about to forcibly conclude the examination attempt for{' '}
                <strong className="text-white">{candidateToTerminate.name}</strong> ({candidateToTerminate.email}).
                This action will immediately submit and lock their current responses on the authoritative server.
              </p>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-gray-400">Administrative Reason:</label>
                <input
                  type="text"
                  value={terminationReason}
                  onChange={(e) => setTerminationReason(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0e0f13] border border-[#272935] rounded-lg text-xs text-white focus:outline-none focus:border-rose-500"
                  placeholder="State reason for termination..."
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCandidateToTerminate(null)}
                  disabled={isSubmittingTermination}
                  className="px-3 py-1.5 rounded-lg bg-[#1c1d25] hover:bg-[#252732] text-xs text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteTermination}
                  disabled={isSubmittingTermination || !terminationReason.trim()}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmittingTermination ? 'Terminating...' : 'Confirm Force Submit'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Institutional Policy & RBAC Administration Modal */}
        {showPolicyModal && (
          <div
            className="fixed inset-0 z-60 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="policy-modal-title"
          >
            <div className="bg-[#121316] border border-[#2a2d36] rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#22242a] pb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-blue-400" />
                  <h3 id="policy-modal-title" className="text-sm font-bold text-white">
                    Institutional Exam Policy & Governance Administration
                  </h3>
                </div>
                <button
                  onClick={() => setShowPolicyModal(false)}
                  className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800"
                  aria-label="Close policy administration dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Policy Header & Hash */}
              <div className="p-3 bg-[#181920] rounded-xl border border-[#282a34] space-y-1 font-mono text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Institutional Baseline:</span>
                  <span className="text-white font-bold">Apex Institute of Technology (POL_APEX_TECH_HIGH_SEC)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Policy Version & Status:</span>
                  <span className="text-emerald-400 font-bold">Version 1 (Active Server-Authoritative)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Canonical SHA-256 Digest:</span>
                  <span className="text-cyan-400 truncate max-w-xs">8b452e1e7a442f71885b5e7d4493390884d622956cf9e1d8ee1dcf5f6da91599</span>
                </div>
              </div>

              {/* Baseline vs Exam Setting Comparison */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-300">
                  Institutional Defaults vs Exam-Specific Settings
                </h4>
                <div className="border border-[#22242a] rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-[#181920] text-gray-400 font-mono text-[10px] uppercase">
                      <tr>
                        <th className="p-2.5">Policy Dimension</th>
                        <th className="p-2.5">Institutional Floor</th>
                        <th className="p-2.5">Active Exam Setting</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e2028] text-gray-300">
                      <tr>
                        <td className="p-2.5 font-medium">Exam Duration</td>
                        <td className="p-2.5 text-gray-400">120 Minutes</td>
                        <td className="p-2.5 text-white font-bold">120 Minutes</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-medium">Camera Requirement</td>
                        <td className="p-2.5 text-gray-400">Continuous Proctoring</td>
                        <td className="p-2.5 text-emerald-400 font-semibold">Continuous</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-medium">Microphone Requirement</td>
                        <td className="p-2.5 text-gray-400">Continuous Spectrum</td>
                        <td className="p-2.5 text-emerald-400 font-semibold">Continuous</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-medium">Network Confinement</td>
                        <td className="p-2.5 text-gray-400">Online Mandatory</td>
                        <td className="p-2.5 text-blue-400 font-semibold">Online Mandatory (Encrypted Local Buffer)</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-medium">Break Permissions</td>
                        <td className="p-2.5 text-gray-400">Disallowed (0 Breaks)</td>
                        <td className="p-2.5 text-amber-400 font-semibold">Zero Breaks Permitted</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-medium">Permitted Applications</td>
                        <td className="p-2.5 text-gray-400 font-mono">code.exe, node.exe, calc.exe</td>
                        <td className="p-2.5 text-gray-200 font-mono">code.exe, node.exe, calc.exe</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-medium">Data Retention Window</td>
                        <td className="p-2.5 text-gray-400">90 Days</td>
                        <td className="p-2.5 text-white">90 Days (Automated Expiration Check)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Fail-Safe Security Floor Notice */}
              <div className="p-3 bg-blue-950/30 border border-blue-800/50 rounded-xl text-xs text-blue-300 leading-relaxed">
                <span className="font-bold">Fail-Safe Security Floor Guarantee:</span> Exam overrides can increase examination duration or grant individual accessibility accommodations, but cannot relax proctoring requirements or process prohibitions below institutional compliance floors.
              </div>

              {/* RBAC Governance Summary */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-300">
                  Role-Based Access Control (RBAC) Governance Matrix
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-[#181920] border border-[#242630] space-y-1">
                    <span className="font-bold text-amber-400 block">Candidate</span>
                    <span className="text-gray-400 block">Self-service telemetry export only; cross-candidate and administrative actions blocked.</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#181920] border border-[#242630] space-y-1">
                    <span className="font-bold text-blue-400 block">Proctor</span>
                    <span className="text-gray-400 block">Live session monitoring, time extension, attempt termination. Retention & purge blocked.</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#181920] border border-[#242630] space-y-1">
                    <span className="font-bold text-emerald-400 block">Faculty Lead</span>
                    <span className="text-gray-400 block">Full exam oversight, policy override preview, and cohort RFC 4180 CSV export.</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#181920] border border-[#242630] space-y-1">
                    <span className="font-bold text-purple-400 block">Department Dean</span>
                    <span className="text-gray-400 block">Institution-wide authority; authorized to configure retention periods and execute data purges.</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#181920] border border-[#242630] space-y-1 col-span-2 sm:col-span-1">
                    <span className="font-bold text-cyan-400 block">External Auditor</span>
                    <span className="text-gray-400 block">Read-only historical audit timelines & compliance verification. Live stream interception blocked.</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-[#22242a]">
                <button
                  type="button"
                  onClick={() => setShowPolicyModal(false)}
                  className="px-4 py-1.5 rounded-lg bg-[#1c1d24] text-xs font-bold text-white hover:bg-[#252732]"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Candidate Detail Drawer */}
        {selectedCandidate && (
          <div className="p-4 border-t border-[#20222a] bg-[#0c0d10] flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                Audit Trail & Response Details: {selectedCandidate.name} ({selectedCandidate.email})
              </h4>
              <button
                onClick={() => setSelectedCandidate(null)}
                className="text-xs text-gray-400 hover:text-white"
              >
                Close Audit Panel
              </button>
            </div>

            {isLoadingDetail ? (
              <div className="py-6 text-center text-xs text-gray-500 animate-pulse">Loading audit trail...</div>
            ) : candidateDetail ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs max-h-48 overflow-y-auto">
                {/* Session & Receipt Header */}
                <div className="col-span-1 sm:col-span-2 p-2.5 bg-[#161820] rounded-lg border border-[#2a2d38] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                  <div>
                    <span className="text-gray-400">Session Status: </span>
                    <span className="text-emerald-400 font-bold uppercase">{selectedCandidate.status}</span>
                  </div>
                  {candidateDetail.session?.receipt && (
                    <div>
                      <span className="text-gray-400">Submission Receipt: </span>
                      <span className="text-[#FF9100] font-bold">{candidateDetail.session.receipt}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-400">Integrity Flags: </span>
                    <span className="text-cyan-400 font-bold">{selectedCandidate.integrityEventCount}</span>
                  </div>
                </div>

                {/* Responses */}
                <div className="p-3 bg-[#131419] rounded-lg border border-[#22242e] space-y-1.5">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Saved Responses ({candidateDetail.responses?.length || 0})
                  </span>
                  {candidateDetail.responses?.length === 0 ? (
                    <span className="text-gray-500 text-[11px]">No responses saved yet.</span>
                  ) : (
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {candidateDetail.responses.map((r: any) => (
                        <div key={r.questionId} className="text-[11px] flex items-center justify-between">
                          <span className="font-mono text-gray-300">{r.questionId}</span>
                          <span className="text-gray-400">{JSON.stringify(r.response).slice(0, 30)}</span>
                          <span className="text-cyan-400 font-semibold">{r.earnedPoints} pts</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Integrity Events Timeline */}
                <div className="p-3 bg-[#131419] rounded-lg border border-[#22242e] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">
                      Recorded Integrity Events ({candidateDetail.integrityEvents?.length || 0})
                    </span>
                    <span className="text-[9px] font-mono text-gray-500">HUMAN-IN-THE-LOOP AUDIT</span>
                  </div>
                  <div className="text-[10px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded leading-relaxed">
                    Review Notice: Algorithmic indicators are heuristic signals provided for proctor review, not proof of academic misconduct. Verify video and audio context before taking action.
                  </div>
                  {candidateDetail.integrityEvents?.length === 0 ? (
                    <span className="text-emerald-400 text-[11px]">Clean audit log: 0 integrity events detected.</span>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto font-mono text-[11px]">
                      {candidateDetail.integrityEvents.map((evt: any) => {
                        const severity: IntegrityEventSeverity = getIntegrityEventSeverity(evt.eventType);
                        const severityBadgeClass =
                          severity === 'high'
                            ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                            : severity === 'medium'
                            ? 'bg-amber-950/60 text-amber-300 border-amber-800'
                            : severity === 'low'
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                            : 'bg-sky-950/60 text-sky-300 border-sky-800';

                        const detailText =
                          evt.details && typeof evt.details === 'object'
                            ? Object.entries(evt.details)
                                .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
                                .join(', ')
                            : '';

                        return (
                          <div key={evt.id} className="text-gray-300 p-1.5 rounded bg-[#181920] border border-[#262835] space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold border ${severityBadgeClass}`}>
                                  {severity}
                                </span>
                                <span className="text-gray-200 font-semibold">{evt.eventType}</span>
                              </div>
                              <span className="text-gray-500 text-[10px]">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                            </div>
                            {detailText && (
                              <div className="text-[10px] text-gray-400 truncate pl-1 font-sans">
                                {detailText}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-500">No session has been initiated by this candidate.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
