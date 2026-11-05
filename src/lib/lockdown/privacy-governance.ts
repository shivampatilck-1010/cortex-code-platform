// Cortex Lockdown — Privacy Governance & Data Minimization Engine
// Implements transparent disclosures, role-based audit access, retention purging, and synthetic data segregation.
// Strictly zero emojis.

import crypto from 'crypto';

export const LEGAL_GOVERNANCE_DISCLOSURE =
  'Technical privacy controls and transparency disclosures implement data minimization and fair information practices. However, technical safeguards alone do not constitute legal compliance with regulations such as GDPR or FERPA without institutional data processing agreements, campus privacy notices, and authorized administrative policies.';

export interface PrivacyCollectedItem {
  category: string;
  dataPoints: string[];
  purpose: string;
  retentionWindow: string;
  isPersonallyIdentifiable: boolean;
}

export interface PrivacyExclusionItem {
  category: string;
  excludedItems: string[];
  justification: string;
}

export interface PrivacyDisclosureManifest {
  version: string;
  lastUpdated: string;
  governanceStatement: string;
  collectedTelemetry: PrivacyCollectedItem[];
  explicitExclusions: PrivacyExclusionItem[];
}

export const CORTEX_PRIVACY_DISCLOSURE: PrivacyDisclosureManifest = {
  version: '1.2.0-institutional',
  lastUpdated: 'November 2026',
  governanceStatement: LEGAL_GOVERNANCE_DISCLOSURE,
  collectedTelemetry: [
    {
      category: 'Visual Presence Heuristics',
      dataPoints: ['Detected face count (integer 0-5)', 'Luminance average', 'Obstruction flag (boolean)'],
      purpose: 'Verifying candidate presence and detecting physical sensor obstruction during exam',
      retentionWindow: 'Configurable by institution (default 90 days)',
      isPersonallyIdentifiable: false,
    },
    {
      category: 'Acoustic Spectrum Ratios',
      dataPoints: ['Speech frequency band ratio (300Hz-3400Hz)', 'High-band ratio', 'Decibel level'],
      purpose: 'Distinguishing human speech from mechanical typing and cooling fan noise',
      retentionWindow: 'Configurable by institution (default 90 days)',
      isPersonallyIdentifiable: false,
    },
    {
      category: 'Window & Application Focus',
      dataPoints: ['Window blur timestamps', 'Restricted shortcut attempts (Alt+Tab, WinKey)', 'Duration unfocused'],
      purpose: 'Detecting unauthorized task switching and application switching attempts',
      retentionWindow: 'Configurable by institution (default 90 days)',
      isPersonallyIdentifiable: false,
    },
    {
      category: 'Encrypted Answer Persistence',
      dataPoints: ['AES-256-GCM encrypted envelope', 'Monotonic sequence counter', 'SHA-256 checksum'],
      purpose: 'Resilient local offline caching and candidate answers recovery during power or network failures',
      retentionWindow: 'Purged immediately upon confirmed server submission',
      isPersonallyIdentifiable: true,
    },
    {
      category: 'Submission Proof Receipt',
      dataPoints: ['HMAC-SHA256 receipt', 'Canonical answer digest', 'Submission timestamp'],
      purpose: 'Providing non-repudiable candidate proof of final examination submission',
      retentionWindow: 'Permanent academic grading record',
      isPersonallyIdentifiable: true,
    },
  ],
  explicitExclusions: [
    {
      category: 'Keystroke Logging',
      excludedItems: ['Candidate raw key strokes', 'Typing cadence strings', 'Non-examination inputs'],
      justification: 'Cortex Lockdown strictly blocks unauthorized shortcuts; it never records keystroke content',
    },
    {
      category: 'Continuous Raw Audio/Video Recording',
      excludedItems: ['Video MP4/WebM files', 'Audio WAV/MP3 recordings', 'Continuous camera streams'],
      justification: 'All computer vision and audio FFT heuristics execute ephemerally in local memory; no raw video or audio is ever saved to disk or transmitted to servers',
    },
    {
      category: 'Personal File System Inspection',
      excludedItems: ['Personal documents', 'Browser history outside exam', 'Desktop files'],
      justification: 'Sandbox access is restricted solely to the application cache and running process enumeration',
    },
  ],
};

export type AuditRole = 'student' | 'proctor' | 'faculty_lead' | 'department_dean' | 'external_auditor';

export interface AuditAccessPermission {
  canViewLiveTelemetry: boolean;
  canViewHistoricalTimeline: boolean;
  canAuthorizeTimeExtension: boolean;
  canTerminateSession: boolean;
  canExportCohortReport: boolean;
  canPurgeData: boolean;
}

export const ROLE_PERMISSIONS: Record<AuditRole, AuditAccessPermission> = {
  student: {
    canViewLiveTelemetry: false,
    canViewHistoricalTimeline: false, // Student can view only own self-service export
    canAuthorizeTimeExtension: false,
    canTerminateSession: false,
    canExportCohortReport: false,
    canPurgeData: false,
  },
  proctor: {
    canViewLiveTelemetry: true,
    canViewHistoricalTimeline: true,
    canAuthorizeTimeExtension: true,
    canTerminateSession: true,
    canExportCohortReport: false,
    canPurgeData: false,
  },
  faculty_lead: {
    canViewLiveTelemetry: true,
    canViewHistoricalTimeline: true,
    canAuthorizeTimeExtension: true,
    canTerminateSession: true,
    canExportCohortReport: true,
    canPurgeData: false,
  },
  department_dean: {
    canViewLiveTelemetry: true,
    canViewHistoricalTimeline: true,
    canAuthorizeTimeExtension: true,
    canTerminateSession: true,
    canExportCohortReport: true,
    canPurgeData: true,
  },
  external_auditor: {
    canViewLiveTelemetry: false,
    canViewHistoricalTimeline: true,
    canAuthorizeTimeExtension: false,
    canTerminateSession: false,
    canExportCohortReport: true,
    canPurgeData: false,
  },
};

/**
 * Checks whether an actor with a given role has permission for a specific action.
 */
export function checkAuditPermission(role: AuditRole, action: keyof AuditAccessPermission): boolean {
  const perm = ROLE_PERMISSIONS[role];
  return perm ? Boolean(perm[action]) : false;
}

/**
 * Detects whether an examination record or student identity belongs to synthetic evaluation data.
 */
export function isSyntheticEvaluationRecord(candidateId: string, examId: string): boolean {
  const cleanCand = (candidateId || '').toLowerCase();
  const cleanExam = (examId || '').toLowerCase();

  return (
    cleanCand.startsWith('usr_cand_synth_') ||
    cleanCand.includes('synth_demo') ||
    cleanCand.includes('synthetic') ||
    cleanExam.startsWith('exam_synth_') ||
    cleanExam.startsWith('exam_alpha') ||
    cleanExam.includes('active_midterm')
  );
}

/**
 * Generates candidate self-service privacy export packet.
 * Allows candidates to review all telemetry events and submission receipts recorded during their exam.
 */
export function generateCandidateSelfServiceExport(params: {
  studentId: string;
  studentName: string;
  examId: string;
  sessionId: string;
  submittedAt?: number;
  submissionReceipt?: string;
  events: Array<{ timestamp: number; eventType: string; severity: string; details: any }>;
  accommodations?: any;
}): string {
  const packet = {
    exportType: 'Cortex Lockdown Candidate Telemetry Self-Service Export',
    generatedAt: new Date().toISOString(),
    candidate: {
      studentId: params.studentId,
      name: params.studentName,
    },
    examination: {
      examId: params.examId,
      sessionId: params.sessionId,
      submittedAt: params.submittedAt ? new Date(params.submittedAt).toISOString() : null,
      submissionReceipt: params.submissionReceipt || 'Pending Submission',
    },
    accommodationsApplied: params.accommodations || null,
    telemetryEventsLogged: params.events.map((e) => ({
      timestamp: new Date(e.timestamp).toISOString(),
      type: e.eventType,
      severity: e.severity,
      details: e.details,
    })),
    dataProtectionNotice: LEGAL_GOVERNANCE_DISCLOSURE,
  };

  return JSON.stringify(packet, null, 2);
}

// ---------------------------------------------------------------------------
// SERVER-AUTHORITATIVE ROLE-BASED ACCESS CONTROL (RBAC) & DATA GOVERNANCE
// ---------------------------------------------------------------------------

export type RbacAction =
  | 'VIEW_CANDIDATE_RECORD'
  | 'ACCESS_LIVE_TELEMETRY'
  | 'ACCESS_HISTORICAL_TIMELINE'
  | 'EXPORT_COHORT_REPORT'
  | 'EXPORT_SELF_SERVICE_DATA'
  | 'AUTHORIZE_TIME_EXTENSION'
  | 'TERMINATE_SESSION'
  | 'REVOKE_SESSION'
  | 'UPDATE_RETENTION_POLICY'
  | 'PURGE_TELEMETRY_DATA';

export interface AccessSubject {
  actorId: string;
  actorRole: AuditRole;
  assignedExamIds?: string[];
  assignedClassroomIds?: string[];
  departmentId?: string;
}

export interface ResourceContext {
  resourceType: 'telemetry' | 'submission' | 'cohort_report' | 'retention_policy' | 'session' | 'self_service_export';
  targetStudentId?: string;
  targetExamId?: string;
  targetClassroomId?: string;
  targetSessionId?: string;
}

export interface DataAccessAuditEntry {
  id: string;
  timestamp: number;
  actorId: string;
  actorRole: AuditRole;
  action: RbacAction;
  resourceType: string;
  resourceId?: string;
  targetStudentId?: string;
  targetExamId?: string;
  outcome: 'GRANTED' | 'DENIED';
  errorCode?: string;
  reason: string;
  clientIp?: string;
}

export interface RetentionRecord {
  id: string;
  examId: string;
  sessionId: string;
  studentId: string;
  createdAt: number;
  retentionDays: number;
  status: 'in_progress' | 'submitted' | 'under_appeal' | 'disputed' | 'finalized';
}

export interface RetentionEligibilityResult {
  eligibleForPurge: boolean;
  daysElapsed: number;
  retentionDaysAllowed: number;
  reason: string;
  canPurge: boolean;
}

export const PHYSICAL_STORAGE_DELETION_CAVEAT =
  'Software deletion executed successfully. Physical storage notice: Modern solid-state drives (SSDs) and flash controllers implement block wear-leveling, non-deterministic cell remapping, and asynchronous TRIM garbage collection; software-level unlink or overwrite cannot guarantee instantaneous physical erasure of flash NAND cells.';

class DataGovernanceStore {
  private auditLog: DataAccessAuditEntry[] = [];
  private retentionRecords = new Map<string, RetentionRecord>();

  public logAccess(entry: DataAccessAuditEntry): void {
    this.auditLog.push(entry);
  }

  public getAuditTrail(filter?: {
    examId?: string;
    studentId?: string;
    actorId?: string;
    action?: RbacAction;
    outcome?: 'GRANTED' | 'DENIED';
  }): DataAccessAuditEntry[] {
    let list = [...this.auditLog];
    if (!filter) return list;

    if (filter.examId) {
      list = list.filter((e) => e.targetExamId === filter.examId);
    }
    if (filter.studentId) {
      list = list.filter((e) => e.targetStudentId === filter.studentId);
    }
    if (filter.actorId) {
      list = list.filter((e) => e.actorId === filter.actorId);
    }
    if (filter.action) {
      list = list.filter((e) => e.action === filter.action);
    }
    if (filter.outcome) {
      list = list.filter((e) => e.outcome === filter.outcome);
    }
    return list;
  }

  public registerRetentionRecord(record: RetentionRecord): void {
    this.retentionRecords.set(record.id, JSON.parse(JSON.stringify(record)));
  }

  public getRetentionRecord(id: string): RetentionRecord | null {
    const rec = this.retentionRecords.get(id);
    return rec ? JSON.parse(JSON.stringify(rec)) : null;
  }

  public removeRetentionRecord(id: string): boolean {
    return this.retentionRecords.delete(id);
  }
}

export const dataGovernanceStore = new DataGovernanceStore();

/**
 * Server-Authoritative RBAC Guard:
 * Evaluates actor credentials and context before permitting access to sensitive exam resources.
 */
export function authorizeRbacRequest(
  subject: AccessSubject,
  action: RbacAction,
  resource: ResourceContext,
  clientIp: string = '127.0.0.1'
): {
  authorized: boolean;
  errorCode?: string;
  message: string;
  auditLog: DataAccessAuditEntry;
} {
  const auditId = `audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const timestamp = Date.now();

  function deny(code: string, message: string) {
    const auditEntry: DataAccessAuditEntry = {
      id: auditId,
      timestamp,
      actorId: subject.actorId,
      actorRole: subject.actorRole,
      action,
      resourceType: resource.resourceType,
      resourceId: resource.targetSessionId || resource.targetExamId,
      targetStudentId: resource.targetStudentId,
      targetExamId: resource.targetExamId,
      outcome: 'DENIED',
      errorCode: code,
      reason: message,
      clientIp,
    };
    dataGovernanceStore.logAccess(auditEntry);
    return { authorized: false, errorCode: code, message, auditLog: auditEntry };
  }

  function grant(message: string) {
    const auditEntry: DataAccessAuditEntry = {
      id: auditId,
      timestamp,
      actorId: subject.actorId,
      actorRole: subject.actorRole,
      action,
      resourceType: resource.resourceType,
      resourceId: resource.targetSessionId || resource.targetExamId,
      targetStudentId: resource.targetStudentId,
      targetExamId: resource.targetExamId,
      outcome: 'GRANTED',
      reason: message,
      clientIp,
    };
    dataGovernanceStore.logAccess(auditEntry);
    return { authorized: true, message, auditLog: auditEntry };
  }

  // 1. CANDIDATE (STUDENT) AUTHORIZATION RULES
  if (subject.actorRole === 'student') {
    if (action === 'EXPORT_SELF_SERVICE_DATA' || action === 'VIEW_CANDIDATE_RECORD') {
      if (resource.targetStudentId && resource.targetStudentId !== subject.actorId) {
        return deny(
          'STUDENT_CROSS_ACCESS_FORBIDDEN',
          `Candidate '${subject.actorId}' attempted unauthorized access to candidate '${resource.targetStudentId}' records`
        );
      }
      return grant('Candidate accessed self-service examination telemetry');
    }

    if (action === 'ACCESS_LIVE_TELEMETRY') {
      return deny(
        'STUDENT_LIVE_TELEMETRY_FORBIDDEN',
        'Candidates are strictly prohibited from intercepting real-time heuristic telemetry'
      );
    }

    // Students are blocked from all administrative and cohort actions
    return deny(
      'ROLE_ESCALATION_BLOCKED',
      `Candidate role 'student' is not authorized to execute privileged action '${action}'`
    );
  }

  // 2. PROCTOR AUTHORIZATION RULES
  if (subject.actorRole === 'proctor') {
    // Proctors cannot export cohort reports, update retention policies, or purge data
    if (action === 'EXPORT_COHORT_REPORT') {
      return deny(
        'ROLE_ESCALATION_BLOCKED',
        'Proctor role is not authorized to export aggregate cohort reports; faculty lead or dean required'
      );
    }
    if (action === 'UPDATE_RETENTION_POLICY' || action === 'PURGE_TELEMETRY_DATA') {
      return deny(
        'PRIVILEGE_ESCALATION_DENIED',
        'Proctor role is not authorized to alter retention periods or execute data purges; department dean required'
      );
    }

    // Cross-examination check
    if (subject.assignedExamIds && resource.targetExamId) {
      if (!subject.assignedExamIds.includes(resource.targetExamId)) {
        return deny(
          'CROSS_EXAM_FORBIDDEN',
          `Proctor '${subject.actorId}' is not assigned to examination '${resource.targetExamId}'`
        );
      }
    }

    return grant(`Proctor authorized for action '${action}' on exam '${resource.targetExamId || 'all'}'`);
  }

  // 3. FACULTY LEAD AUTHORIZATION RULES
  if (subject.actorRole === 'faculty_lead') {
    // Faculty leads cannot modify retention policies or purge data (Dean authority required)
    if (action === 'UPDATE_RETENTION_POLICY' || action === 'PURGE_TELEMETRY_DATA') {
      return deny(
        'PRIVILEGE_ESCALATION_DENIED',
        'Faculty lead role cannot alter retention policies or execute data purges; department dean authorization required'
      );
    }

    // Cross-examination check
    if (subject.assignedExamIds && resource.targetExamId) {
      if (!subject.assignedExamIds.includes(resource.targetExamId)) {
        return deny(
          'CROSS_EXAM_FORBIDDEN',
          `Faculty lead '${subject.actorId}' is not assigned to examination '${resource.targetExamId}'`
        );
      }
    }

    return grant(`Faculty lead authorized for action '${action}' on exam '${resource.targetExamId || 'all'}'`);
  }

  // 4. DEPARTMENT DEAN AUTHORIZATION RULES
  if (subject.actorRole === 'department_dean') {
    // Full authority across institutional examinations and governance
    return grant(`Department dean authorized for administrative action '${action}'`);
  }

  // 5. EXTERNAL AUDITOR AUTHORIZATION RULES
  if (subject.actorRole === 'external_auditor') {
    if (action === 'ACCESS_LIVE_TELEMETRY') {
      return deny(
        'AUDITOR_LIVE_VIEW_FORBIDDEN',
        'External auditors are not permitted to intercept active in-progress student camera/telemetry feeds'
      );
    }
    if (
      action === 'AUTHORIZE_TIME_EXTENSION' ||
      action === 'TERMINATE_SESSION' ||
      action === 'REVOKE_SESSION' ||
      action === 'UPDATE_RETENTION_POLICY' ||
      action === 'PURGE_TELEMETRY_DATA'
    ) {
      return deny(
        'ROLE_ESCALATION_BLOCKED',
        `External auditor role is strictly read-only and cannot execute administrative mutation '${action}'`
      );
    }

    if (action === 'ACCESS_HISTORICAL_TIMELINE' || action === 'EXPORT_COHORT_REPORT') {
      return grant(`External auditor authorized for compliance inspection '${action}'`);
    }
  }

  return deny('UNKNOWN_ROLE_OR_ACTION', `Authorization denied for actor '${subject.actorId}'`);
}

/**
 * Evaluates whether an examination telemetry record is legally eligible for automated purging.
 */
export function checkRetentionEligibility(
  record: RetentionRecord,
  currentTimestamp: number = Date.now()
): RetentionEligibilityResult {
  const msElapsed = currentTimestamp - record.createdAt;
  const daysElapsed = Math.floor(msElapsed / (1000 * 60 * 60 * 24));
  const retentionDaysAllowed = record.retentionDays;

  // Active sessions cannot be purged
  if (record.status === 'in_progress') {
    return {
      eligibleForPurge: false,
      daysElapsed,
      retentionDaysAllowed,
      reason: 'Examination session is currently active/in_progress; live exam telemetry cannot be purged.',
      canPurge: false,
    };
  }

  // Disputed or appealed records must be preserved for academic review
  if (record.status === 'under_appeal' || record.status === 'disputed') {
    return {
      eligibleForPurge: false,
      daysElapsed,
      retentionDaysAllowed,
      reason: 'Examination is subject to an active academic integrity appeal or dispute; records are frozen until resolution.',
      canPurge: false,
    };
  }

  // Retention window expiration check
  if (daysElapsed < retentionDaysAllowed) {
    const daysRemaining = retentionDaysAllowed - daysElapsed;
    return {
      eligibleForPurge: false,
      daysElapsed,
      retentionDaysAllowed,
      reason: `Institutional retention period has not expired (${daysRemaining} days remaining of ${retentionDaysAllowed}d window).`,
      canPurge: false,
    };
  }

  return {
    eligibleForPurge: true,
    daysElapsed,
    retentionDaysAllowed,
    reason: `Institutional retention period has expired (${daysElapsed}d >= ${retentionDaysAllowed}d). Record is eligible for authorized purging.`,
    canPurge: true,
  };
}

/**
 * Executes authorized software data purge with Dean authorization, eligibility checks,
 * and explicit physical SSD storage caveats.
 */
export function executeAuthorizedDataPurge(
  subject: AccessSubject,
  record: RetentionRecord,
  currentTimestamp: number = Date.now()
): {
  success: boolean;
  errorCode?: string;
  message: string;
  physicalCaveat: string;
  auditLog?: DataAccessAuditEntry;
} {
  // 1. RBAC Check: Must have Dean authorization
  const rbac = authorizeRbacRequest(
    subject,
    'PURGE_TELEMETRY_DATA',
    {
      resourceType: 'telemetry',
      targetExamId: record.examId,
      targetStudentId: record.studentId,
      targetSessionId: record.sessionId,
    }
  );

  if (!rbac.authorized) {
    return {
      success: false,
      errorCode: rbac.errorCode,
      message: rbac.message,
      physicalCaveat: PHYSICAL_STORAGE_DELETION_CAVEAT,
      auditLog: rbac.auditLog,
    };
  }

  // 2. Automated Retention Eligibility Check
  const eligibility = checkRetentionEligibility(record, currentTimestamp);
  if (!eligibility.canPurge) {
    return {
      success: false,
      errorCode: 'RETENTION_NOT_EXPIRED',
      message: `Purge aborted: ${eligibility.reason}`,
      physicalCaveat: PHYSICAL_STORAGE_DELETION_CAVEAT,
    };
  }

  // 3. Execute software deletion
  dataGovernanceStore.removeRetentionRecord(record.id);

  return {
    success: true,
    message: `Telemetry record '${record.id}' for exam '${record.examId}' successfully purged under institutional retention policy.`,
    physicalCaveat: PHYSICAL_STORAGE_DELETION_CAVEAT,
    auditLog: rbac.auditLog,
  };
}

