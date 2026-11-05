// Cortex Lockdown — Faculty Analytics & Cohort Reporting Engine
// Provides candidate readiness, completion statistics, connectivity auditing, and exportable reports.
// Strictly zero emojis.

import { IntegritySeverity } from './proctoring-engine';

export const HUMAN_REVIEW_FAIRNESS_NOTICE =
  'All integrity telemetry, flags, and score deductions are automated heuristic signals provided strictly for human faculty evaluation. They do not constitute automated determinations of academic dishonesty or final disciplinary actions.';

export interface CandidateReadinessReport {
  userId: string;
  candidateName: string;
  operatingSystem: string;
  clientVersion: string;
  monitorCount: number;
  cameraReady: boolean;
  microphoneReady: boolean;
  networkLatencyMs: number;
  overallReadinessScore: number; // 0 - 100%
  readinessState: 'ready' | 'conditional' | 'blocked';
  blockReasons: string[];
}

export interface AutosaveSyncStatus {
  lastSequenceNumber: number;
  lastSyncTimestamp: number;
  pendingUncommittedAnswers: number;
  averageSyncLatencyMs: number;
  isStorageHealthy: boolean;
}

export interface ConnectivityHistoryItem {
  timestamp: number;
  event: 'connected' | 'disconnected' | 'reconnected' | 'stale_heartbeat';
  durationSeconds?: number;
  networkType?: string;
}

export interface CandidateRecoveryRecord {
  interventionId: string;
  timestamp: number;
  action: 'time_extension' | 'emergency_otp_redemption' | 'session_reauthorization' | 'force_submit';
  proctorId: string;
  reason: string;
  metadata?: Record<string, any>;
}

export interface FilterableIntegrityTimelineEvent {
  id: string;
  timestamp: number;
  eventType: string;
  severity: IntegritySeverity;
  description: string;
  heuristicRationale: string;
  reviewStatus: 'unreviewed' | 'cleared_benign' | 'flagged_investigation';
}

export interface ExamCompletionStatistics {
  totalEnrolled: number;
  notStarted: number;
  inProgress: number;
  submitted: number;
  lateSubmitted: number;
  timedOut: number;
  averageTimeSpentMinutes: number;
  completionRatePercent: number;
  cohortAttentionFlagCount: number;
}

export interface CohortAnalyticsSummary {
  examId: string;
  classroomId: string;
  generatedAt: number;
  statistics: ExamCompletionStatistics;
  fairnessNotice: string;
  candidates: Array<{
    userId: string;
    name: string;
    email: string;
    status: 'not_started' | 'in_progress' | 'submitted' | 'timed_out';
    score: number;
    durationMinutes: number;
    integrityScore: number;
    highestSeverity: IntegritySeverity;
    proctorReviewRequired: boolean;
    autosave: AutosaveSyncStatus;
    connectivityDrops: number;
    recoveryInterventions: number;
  }>;
}

/**
 * Calculates aggregate completion statistics for an examination cohort.
 */
export function calculateCohortStatistics(candidates: Array<{
  status: 'not_started' | 'in_progress' | 'submitted' | 'timed_out';
  durationMinutes: number;
  isLate?: boolean;
  highestSeverity: IntegritySeverity;
}>): ExamCompletionStatistics {
  const total = candidates.length;
  if (total === 0) {
    return {
      totalEnrolled: 0,
      notStarted: 0,
      inProgress: 0,
      submitted: 0,
      lateSubmitted: 0,
      timedOut: 0,
      averageTimeSpentMinutes: 0,
      completionRatePercent: 0,
      cohortAttentionFlagCount: 0,
    };
  }

  let notStarted = 0;
  let inProgress = 0;
  let submitted = 0;
  let lateSubmitted = 0;
  let timedOut = 0;
  let totalTime = 0;
  let attentionFlags = 0;

  for (const c of candidates) {
    if (c.status === 'not_started') notStarted++;
    else if (c.status === 'in_progress') inProgress++;
    else if (c.status === 'submitted') {
      submitted++;
      if (c.isLate) lateSubmitted++;
    } else if (c.status === 'timed_out') timedOut++;

    totalTime += c.durationMinutes || 0;
    if (c.highestSeverity === 'high' || c.highestSeverity === 'medium') {
      attentionFlags++;
    }
  }

  const finishedCount = submitted + timedOut;
  const completionRatePercent = Math.round((finishedCount / total) * 1000) / 10;
  const averageTimeSpentMinutes = Math.round((totalTime / total) * 10) / 10;

  return {
    totalEnrolled: total,
    notStarted,
    inProgress,
    submitted,
    lateSubmitted,
    timedOut,
    averageTimeSpentMinutes,
    completionRatePercent,
    cohortAttentionFlagCount: attentionFlags,
  };
}

/**
 * Formats full examination cohort data into exportable JSON structure.
 */
export function exportCohortReportJson(summary: CohortAnalyticsSummary): string {
  return JSON.stringify(
    {
      ...summary,
      disclaimer: HUMAN_REVIEW_FAIRNESS_NOTICE,
    },
    null,
    2
  );
}

/**
 * Formats examination cohort summary into standardized RFC 4180 CSV table.
 */
export function exportCohortReportCsv(summary: CohortAnalyticsSummary): string {
  const headers = [
    'User ID',
    'Full Name',
    'Email Address',
    'Status',
    'AutoScore',
    'Duration (Min)',
    'Integrity Score (0-100)',
    'Highest Severity',
    'Review Required',
    'Last Autosave Seq',
    'Network Drops',
    'Recovery Interventions',
  ];

  const escapeCsv = (val: any) => {
    const s = String(val === undefined || val === null ? '' : val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = summary.candidates.map((c) => [
    escapeCsv(c.userId),
    escapeCsv(c.name),
    escapeCsv(c.email),
    escapeCsv(c.status),
    escapeCsv(c.score),
    escapeCsv(c.durationMinutes),
    escapeCsv(c.integrityScore),
    escapeCsv(c.highestSeverity),
    escapeCsv(c.proctorReviewRequired ? 'YES' : 'NO'),
    escapeCsv(c.autosave.lastSequenceNumber),
    escapeCsv(c.connectivityDrops),
    escapeCsv(c.recoveryInterventions),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}
