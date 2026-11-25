'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { PlatformAdminAnalytics } from '@/lib/classroom/models';
import { 
  SlidersHorizontal, 
  Activity, 
  Server, 
  ShieldCheck, 
  Users, 
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '@/config/languages';
import { CortexLogo } from '@/components/brand/CortexLogo';

export default function AdminPage() {
  const [authorized, setAuthorized] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [analytics, setAnalytics] = useState<PlatformAdminAnalytics | null>(null);
  const [feedbackList, setFeedbackList] = useState<any[]>([]);
  const [healthInfo, setHealthInfo] = useState<{ status: string; latencyMs: number; version?: string } | null>(null);
  const [loadingTelemetry, setLoadingTelemetry] = useState(true);
  const [languages, setLanguages] = useState(
    SUPPORTED_LANGUAGES.map((l) => ({ ...l, enabled: true }))
  );

  React.useEffect(() => {
    fetch('/api/v1/auth/me')
      .then(res => {
        if (!res.ok) throw new Error('Unauthenticated');
        return res.json();
      })
      .then(data => {
        if (!data.success || !data.user) {
          window.location.href = '/login?redirect=/admin';
          return;
        }
        if (data.user.role !== 'admin') {
          setAccessDenied(true);
          return;
        }
        setAuthorized(true);
        const healthStart = Date.now();
        Promise.all([
          fetch('/api/v1/admin/analytics').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/v1/feedback').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/v1/health').then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) })),
        ])
          .then(([analyticsData, feedbackData, healthRes]) => {
            if (analyticsData && analyticsData.users) {
              setAnalytics(analyticsData);
            }
            if (feedbackData && Array.isArray(feedbackData.feedback)) {
              setFeedbackList(feedbackData.feedback.slice(0, 12));
            }
            setHealthInfo({
              status: healthRes?.data?.status || (healthRes?.ok ? 'healthy' : 'degraded'),
              latencyMs: Date.now() - healthStart,
              version: healthRes?.data?.version,
            });
          })
          .finally(() => setLoadingTelemetry(false));
      })
      .catch(() => {
        window.location.href = '/login?redirect=/admin';
      });
  }, []);

  // Language registry rendered read-only from SUPPORTED_LANGUAGES config below

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-[#121316] text-gray-100 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-[#18191d] border border-rose-900/50 rounded-xl p-6 text-center space-y-4">
          <div className="text-rose-400 font-bold text-lg">Administrator Access Required (403)</div>
          <p className="text-xs text-gray-400 leading-relaxed">
            Your signed-in account does not have administrator privileges to access platform analytics and system logs.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-lg bg-[#252830] hover:bg-[#323642] text-xs font-semibold text-white transition"
            >
              Dashboard
            </Link>
            <Link
              href="/ide"
              className="px-4 py-2 rounded-lg bg-[#ff9100] hover:bg-[#e08000] text-xs font-bold text-[#0b0c0e] transition"
            >
              Return to IDE
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[#121316] text-gray-100 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <CortexLogo variant="header" size="sm" />
          <div className="text-sm text-neutral-400">Verifying administrator privileges...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121316] text-gray-100 flex flex-col font-sans select-none">
      {/* Header */}
      <header className="h-14 bg-[#141518] border-b border-[#252830] px-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link href="/" className="flex items-center group transition" title="Cortex - Code Beyond Limits">
            <CortexLogo variant="header" size="sm" />
          </Link>
          <div className="h-4 w-[1px] bg-[#32353e]" />
          <div className="flex items-center space-x-2 text-[#ff9100] font-bold text-sm">
            <SlidersHorizontal className="w-4 h-4" />
            <span className="text-white">Platform System Administration & Health</span>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-emerald-400 text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>
            {healthInfo
              ? `API ${healthInfo.status.toUpperCase()} (${healthInfo.latencyMs}ms)`
              : 'Probing Edge Health...'}
          </span>
        </div>
      </header>

      {/* Admin Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6 overflow-y-auto">
        {/* Live D1 Platform Analytics */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-[#18191d] border border-[#262832] rounded-lg">
            <span className="text-xs text-gray-400 block">Registered Users</span>
            <div className="text-2xl font-bold text-white mt-1">
              {loadingTelemetry ? '...' : (analytics?.users.total ?? 0).toLocaleString()}
            </div>
            <span className="text-[11px] text-emerald-400">
              {analytics
                ? `${analytics.users.students} students / ${analytics.users.teachers} teachers / ${analytics.users.admins} admins`
                : 'D1 user directory'}
            </span>
          </div>
          <div className="p-4 bg-[#18191d] border border-[#262832] rounded-lg">
            <span className="text-xs text-gray-400 block">Active Classrooms</span>
            <div className="text-2xl font-bold text-cyan-400 mt-1">
              {loadingTelemetry ? '...' : (analytics?.classrooms.active ?? 0).toLocaleString()}
            </div>
            <span className="text-[11px] text-gray-500">
              {analytics ? `${analytics.classrooms.total} total (${analytics.classrooms.archived} archived)` : 'Classroom records'}
            </span>
          </div>
          <div className="p-4 bg-[#18191d] border border-[#262832] rounded-lg">
            <span className="text-xs text-gray-400 block">Published Assessments</span>
            <div className="text-2xl font-bold text-purple-400 mt-1">
              {loadingTelemetry ? '...' : (analytics?.exams.active ?? 0).toLocaleString()}
            </div>
            <span className="text-[11px] text-gray-500">
              {analytics ? `${analytics.exams.total} total (${analytics.exams.completed} completed)` : 'Exam schedules'}
            </span>
          </div>
          <div className="p-4 bg-[#18191d] border border-[#262832] rounded-lg">
            <span className="text-xs text-gray-400 block">Exam Attempts</span>
            <div className="text-2xl font-bold text-amber-400 mt-1">
              {loadingTelemetry ? '...' : (analytics?.sessions.totalAttempts ?? 0).toLocaleString()}
            </div>
            <span className="text-[11px] text-emerald-400">
              {analytics ? `${analytics.sessions.activeAttempts} live / ${analytics.sessions.completedAttempts} submitted` : 'Assessment attempts'}
            </span>
          </div>
        </div>

        {/* Registered Language Runtimes */}
        <div className="p-5 bg-[#18191d] border border-[#262832] rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-sm text-gray-200">Registered Language Runtimes ({SUPPORTED_LANGUAGES.length})</h2>
              <p className="text-xs text-gray-400">Live runtime capabilities declared in the platform execution registry.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {SUPPORTED_LANGUAGES.map((l) => (
              <div
                key={l.id}
                className="p-3 bg-[#141518] border border-[#262832] rounded flex items-center justify-between text-xs gap-2"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-white block truncate">{l.name}</span>
                  <span className="text-[10px] text-gray-500 font-mono">{l.version || l.id}</span>
                </div>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded border shrink-0 ${
                    l.executable === false
                      ? 'bg-slate-800/70 text-slate-300 border-slate-700'
                      : 'bg-emerald-950/50 text-emerald-400 border-emerald-800/50'
                  }`}
                >
                  {l.executable === false ? 'Preview' : 'Executable'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Platform Feedback & Diagnostics */}
        <div className="p-5 bg-[#18191d] border border-[#262832] rounded-lg space-y-3 text-xs font-mono">
          <div className="flex items-center justify-between font-sans">
            <h3 className="font-bold text-sm text-gray-200">Platform Feedback &amp; Incident Reports</h3>
            <span className="text-[11px] text-gray-500">
              {loadingTelemetry ? 'Loading...' : `${feedbackList.length} recent record${feedbackList.length === 1 ? '' : 's'}`}
            </span>
          </div>
          <div className="bg-[#121316] border border-[#242630] rounded divide-y divide-[#20222a] p-2">
            {loadingTelemetry ? (
              <div className="py-4 text-center text-gray-500">Loading feedback records from D1...</div>
            ) : feedbackList.length === 0 ? (
              <div className="py-4 text-center text-gray-500">No feedback or incident reports recorded yet.</div>
            ) : (
              feedbackList.map((item: any) => (
                <div key={item.id} className="py-2.5 px-2 flex items-center justify-between gap-4 text-gray-300">
                  <div className="flex items-center space-x-2 min-w-0">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold shrink-0 ${
                        item.severity === 'critical' || item.severity === 'high'
                          ? 'bg-rose-950/60 text-rose-400 border border-rose-800/50'
                          : 'bg-amber-950/50 text-amber-400 border border-amber-800/40'
                      }`}
                    >
                      {item.type || 'report'}
                    </span>
                    <span className="truncate font-sans font-medium text-gray-200">{item.title}</span>
                    {item.email && <span className="text-[10px] text-gray-500 truncate hidden sm:inline">({item.email})</span>}
                  </div>
                  <span className="text-gray-500 text-[10px] shrink-0">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
