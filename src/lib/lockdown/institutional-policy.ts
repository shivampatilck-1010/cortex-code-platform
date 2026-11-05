// Cortex Lockdown — Server-Authoritative Institutional Exam Policies
// Implements configurable academic policies, server-side validation, and synthetic institution profiles.
// Strictly zero emojis.

import crypto from 'crypto';

export type CameraRequirement = 'disabled' | 'optional' | 'presence_only' | 'continuous';
export type MicrophoneRequirement = 'disabled' | 'optional' | 'continuous';
export type NetworkRequirement = 'online_mandatory' | 'offline_tolerant' | 'offline_permitted';

export interface BreakPolicy {
  allowBreaks: boolean;
  maxBreakCount: number;
  maxBreakDurationMinutes: number;
  pauseExamTimer: boolean;
}

export interface AccommodationPolicySettings {
  allowTimeExtension: boolean;
  maxTimeMultiplier: number; // e.g. 1.0 - 2.5
  allowScreenReaders: boolean;
  allowMagnifiers: boolean;
  allowSpeechInput: boolean;
  allowHighContrast: boolean;
}

export interface SubmissionDeadlineSettings {
  strictHardDeadline: boolean;
  gracePeriodMinutes: number;
  allowAutoSubmitOnTimeout: boolean;
}

export interface DataRetentionSettings {
  telemetryRetentionDays: number; // 14 to 365 days
  autoPurgeExpired: boolean;
  allowStudentTelemetryExport: boolean;
}

export interface OfflinePermissionSettings {
  allowOfflineStart: boolean;
  maxOfflineMinutes: number;
  requireEncryptedLocalBuffer: boolean;
}

export interface InstitutionalExamPolicy {
  policyId: string;
  institutionId: string;
  institutionName: string;
  policyName: string;
  description?: string;
  version: number;
  updatedAt: number;

  // 1. Examination Duration
  durationMinutes: number;

  // 2. Permitted & Prohibited Applications
  permittedProcesses: string[];
  prohibitedProcesses: string[];

  // 3. Camera Requirements
  cameraRequirement: CameraRequirement;

  // 4. Microphone Requirements
  microphoneRequirement: MicrophoneRequirement;

  // 5. Network Requirements
  networkRequirement: NetworkRequirement;

  // 6. Offline Examination Permissions
  offlinePermissions: OfflinePermissionSettings;

  // 7. Break Policies
  breakPolicy: BreakPolicy;

  // 8. Accommodation Settings
  accommodationSettings: AccommodationPolicySettings;

  // 9. Submission Deadlines
  submissionDeadlines: SubmissionDeadlineSettings;

  // 10. Data Retention Periods
  dataRetention: DataRetentionSettings;
}

/**
 * Server-side validation of institutional exam policies.
 * Ensures all thresholds and constraints conform to institutional governance.
 */
export function validateInstitutionalPolicy(policy: Partial<InstitutionalExamPolicy>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!policy.policyId || policy.policyId.trim().length === 0) {
    errors.push('policyId is required');
  }
  if (!policy.institutionId || policy.institutionId.trim().length === 0) {
    errors.push('institutionId is required');
  }

  // Duration check
  if (typeof policy.durationMinutes !== 'number' || policy.durationMinutes < 5 || policy.durationMinutes > 600) {
    errors.push('durationMinutes must be between 5 and 600 minutes');
  }

  // Permitted vs prohibited process collision
  const permitted = new Set((policy.permittedProcesses || []).map((p) => p.toLowerCase().trim()));
  const prohibited = new Set((policy.prohibitedProcesses || []).map((p) => p.toLowerCase().trim()));
  for (const proc of permitted) {
    if (prohibited.has(proc)) {
      errors.push(`Process collision: "${proc}" is listed as both permitted and prohibited`);
    }
  }

  // Sensor requirements
  const validCameraReqs: CameraRequirement[] = ['disabled', 'optional', 'presence_only', 'continuous'];
  if (policy.cameraRequirement && !validCameraReqs.includes(policy.cameraRequirement)) {
    errors.push(`Invalid cameraRequirement: "${policy.cameraRequirement}"`);
  }

  const validMicReqs: MicrophoneRequirement[] = ['disabled', 'optional', 'continuous'];
  if (policy.microphoneRequirement && !validMicReqs.includes(policy.microphoneRequirement)) {
    errors.push(`Invalid microphoneRequirement: "${policy.microphoneRequirement}"`);
  }

  // Network and offline
  if (policy.networkRequirement === 'online_mandatory' && policy.offlinePermissions?.allowOfflineStart) {
    errors.push('allowOfflineStart cannot be true when networkRequirement is "online_mandatory"');
  }

  if (policy.offlinePermissions) {
    if (policy.offlinePermissions.maxOfflineMinutes < 0 || policy.offlinePermissions.maxOfflineMinutes > 180) {
      errors.push('maxOfflineMinutes must be between 0 and 180 minutes');
    }
  }

  // Break policy
  if (policy.breakPolicy) {
    if (policy.breakPolicy.maxBreakCount < 0 || policy.breakPolicy.maxBreakCount > 10) {
      errors.push('maxBreakCount must be between 0 and 10');
    }
    if (policy.breakPolicy.maxBreakDurationMinutes < 0 || policy.breakPolicy.maxBreakDurationMinutes > 60) {
      errors.push('maxBreakDurationMinutes must be between 0 and 60');
    }
  }

  // Accommodations
  if (policy.accommodationSettings) {
    if (
      policy.accommodationSettings.maxTimeMultiplier < 1.0 ||
      policy.accommodationSettings.maxTimeMultiplier > 3.0
    ) {
      errors.push('maxTimeMultiplier must be between 1.0 and 3.0');
    }
  }

  // Deadlines
  if (policy.submissionDeadlines) {
    if (policy.submissionDeadlines.gracePeriodMinutes < 0 || policy.submissionDeadlines.gracePeriodMinutes > 60) {
      errors.push('gracePeriodMinutes must be between 0 and 60');
    }
  }

  // Retention
  if (policy.dataRetention) {
    if (policy.dataRetention.telemetryRetentionDays < 7 || policy.dataRetention.telemetryRetentionDays > 730) {
      errors.push('telemetryRetentionDays must be between 7 and 730 days');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Computes a SHA-256 integrity hash of the canonical policy definition
 * to prevent policy tampering or client-side parameter injection.
 */
export function hashInstitutionalPolicy(policy: InstitutionalExamPolicy): string {
  const sortedCopy: Record<string, any> = {};
  for (const k of Object.keys(policy).sort()) {
    sortedCopy[k] = (policy as any)[k];
  }
  return crypto.createHash('sha256').update(JSON.stringify(sortedCopy)).digest('hex');
}

/**
 * Evaluates whether an active candidate session adheres to institutional policy constraints.
 */
export function evaluateSessionPolicyCompliance(
  policy: InstitutionalExamPolicy,
  session: {
    durationElapsedMinutes: number;
    runningProcesses: string[];
    isCameraConnected: boolean;
    isMicConnected: boolean;
    isOffline: boolean;
    offlineDurationMinutes: number;
    breaksTaken: number;
    totalBreakMinutes: number;
    timeMultiplierApplied: number;
  }
): { compliant: boolean; violations: string[]; warnings: string[] } {
  const violations: string[] = [];
  const warnings: string[] = [];

  // 1. Process checks
  const prohibitedSet = new Set((policy.prohibitedProcesses || []).map((p) => p.toLowerCase().trim()));
  const permittedSet = new Set((policy.permittedProcesses || []).map((p) => p.toLowerCase().trim()));

  for (const proc of session.runningProcesses) {
    const clean = proc.toLowerCase().trim();
    if (prohibitedSet.has(clean)) {
      violations.push(`Prohibited process detected: "${proc}"`);
    }
  }

  // 2. Camera requirement
  if (policy.cameraRequirement === 'continuous' && !session.isCameraConnected) {
    violations.push('Mandatory camera stream is disconnected under continuous proctoring policy');
  } else if (policy.cameraRequirement === 'presence_only' && !session.isCameraConnected) {
    warnings.push('Camera presence verification required prior to exam progression');
  }

  // 3. Microphone requirement
  if (policy.microphoneRequirement === 'continuous' && !session.isMicConnected) {
    violations.push('Mandatory microphone stream is disconnected under continuous proctoring policy');
  }

  // 4. Network & Offline limits
  if (policy.networkRequirement === 'online_mandatory' && session.isOffline) {
    violations.push('Examination went offline under online-mandatory institutional policy');
  } else if (session.isOffline && session.offlineDurationMinutes > policy.offlinePermissions.maxOfflineMinutes) {
    violations.push(
      `Offline duration (${session.offlineDurationMinutes}m) exceeded institutional allowance (${policy.offlinePermissions.maxOfflineMinutes}m)`
    );
  }

  // 5. Breaks
  if (!policy.breakPolicy.allowBreaks && session.breaksTaken > 0) {
    violations.push('Candidate took an unapproved break under zero-break institutional policy');
  } else if (policy.breakPolicy.allowBreaks) {
    if (session.breaksTaken > policy.breakPolicy.maxBreakCount) {
      violations.push(
        `Break count (${session.breaksTaken}) exceeded policy maximum (${policy.breakPolicy.maxBreakCount})`
      );
    }
    if (session.totalBreakMinutes > policy.breakPolicy.maxBreakDurationMinutes) {
      violations.push(
        `Total break duration (${session.totalBreakMinutes}m) exceeded policy maximum (${policy.breakPolicy.maxBreakDurationMinutes}m)`
      );
    }
  }

  // 6. Time multiplier
  if (session.timeMultiplierApplied > policy.accommodationSettings.maxTimeMultiplier) {
    violations.push(
      `Applied time multiplier (${session.timeMultiplierApplied}x) exceeds institutional limit (${policy.accommodationSettings.maxTimeMultiplier}x)`
    );
  }

  // 7. Deadline expiration
  const maxAllowedDuration = policy.durationMinutes * session.timeMultiplierApplied + policy.submissionDeadlines.gracePeriodMinutes;
  if (session.durationElapsedMinutes > maxAllowedDuration) {
    violations.push(
      `Session duration (${session.durationElapsedMinutes}m) exceeded maximum allowed limit (${maxAllowedDuration}m)`
    );
  }

  return {
    compliant: violations.length === 0,
    violations,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// SYNTHETIC INSTITUTIONAL PROFILES FOR TESTING & DEMONSTRATION
// ---------------------------------------------------------------------------

export const SYNTHETIC_INSTITUTION_APEX_TECH: InstitutionalExamPolicy = {
  policyId: 'POL_APEX_TECH_HIGH_SEC',
  institutionId: 'INST_APEX_TECH',
  institutionName: 'Apex Institute of Technology (Synthetic Engineering)',
  policyName: 'High Security Computer Science Proctored Policy',
  description: 'Strict proctoring policy for concurrent systems & architectural examinations with allowed development tools.',
  version: 1,
  updatedAt: Date.now(),
  durationMinutes: 120,
  permittedProcesses: ['code.exe', 'node.exe', 'calc.exe'],
  prohibitedProcesses: [
    'obs64.exe', 'obs.exe', 'discord.exe', 'teamviewer.exe', 'anydesk.exe',
    'chrome.exe', 'msedge.exe', 'firefox.exe', 'telegram.exe', 'slack.exe'
  ],
  cameraRequirement: 'continuous',
  microphoneRequirement: 'continuous',
  networkRequirement: 'online_mandatory',
  offlinePermissions: {
    allowOfflineStart: false,
    maxOfflineMinutes: 5,
    requireEncryptedLocalBuffer: true,
  },
  breakPolicy: {
    allowBreaks: false,
    maxBreakCount: 0,
    maxBreakDurationMinutes: 0,
    pauseExamTimer: false,
  },
  accommodationSettings: {
    allowTimeExtension: true,
    maxTimeMultiplier: 1.5,
    allowScreenReaders: true,
    allowMagnifiers: true,
    allowSpeechInput: false,
    allowHighContrast: true,
  },
  submissionDeadlines: {
    strictHardDeadline: true,
    gracePeriodMinutes: 5,
    allowAutoSubmitOnTimeout: true,
  },
  dataRetention: {
    telemetryRetentionDays: 90,
    autoPurgeExpired: true,
    allowStudentTelemetryExport: true,
  },
};

export const SYNTHETIC_INSTITUTION_METRO_UNIV: InstitutionalExamPolicy = {
  policyId: 'POL_METRO_UNIV_FLEX',
  institutionId: 'INST_METRO_UNIV',
  institutionName: 'Metropolitan University (Synthetic Liberal Arts & Sciences)',
  policyName: 'Flexible Proctoring & High Accommodation Policy',
  description: 'Accessible exam policy with offline tolerance, bathroom breaks, and full accessibility accommodations.',
  version: 1,
  updatedAt: Date.now(),
  durationMinutes: 60,
  permittedProcesses: ['calc.exe', 'wordpad.exe'],
  prohibitedProcesses: [
    'obs64.exe', 'teamviewer.exe', 'anydesk.exe', 'discord.exe'
  ],
  cameraRequirement: 'presence_only',
  microphoneRequirement: 'optional',
  networkRequirement: 'offline_tolerant',
  offlinePermissions: {
    allowOfflineStart: true,
    maxOfflineMinutes: 30,
    requireEncryptedLocalBuffer: true,
  },
  breakPolicy: {
    allowBreaks: true,
    maxBreakCount: 2,
    maxBreakDurationMinutes: 10,
    pauseExamTimer: true,
  },
  accommodationSettings: {
    allowTimeExtension: true,
    maxTimeMultiplier: 2.0,
    allowScreenReaders: true,
    allowMagnifiers: true,
    allowSpeechInput: true,
    allowHighContrast: true,
  },
  submissionDeadlines: {
    strictHardDeadline: false,
    gracePeriodMinutes: 15,
    allowAutoSubmitOnTimeout: true,
  },
  dataRetention: {
    telemetryRetentionDays: 60,
    autoPurgeExpired: true,
    allowStudentTelemetryExport: true,
  },
};

// ---------------------------------------------------------------------------
// POLICY AUDIT & VERSION CONTROL MODELS
// ---------------------------------------------------------------------------

export interface PolicyAuditRecord {
  id: string;
  timestamp: number;
  policyId: string;
  version: number;
  actorId: string;
  actorRole: string;
  action:
    | 'CREATED'
    | 'UPDATED'
    | 'OVERRIDE_APPLIED'
    | 'CONFLICT_RESOLVED'
    | 'TAMPER_DETECTED'
    | 'ROLLBACK_REJECTED';
  previousHash?: string;
  newHash?: string;
  changes?: Record<string, { from: any; to: any }>;
  conflictsResolved?: string[];
  notes?: string;
}

export interface PolicyVersionEntry {
  version: number;
  updatedAt: number;
  policy: InstitutionalExamPolicy;
  hash: string;
  actorId: string;
  actorRole: string;
  changeSummary: string;
}

export interface SessionPolicyBinding {
  sessionId: string;
  examId: string;
  boundAt: number;
  version: number;
  hash: string;
  policy: InstitutionalExamPolicy;
}

// ---------------------------------------------------------------------------
// IN-MEMORY POLICY REGISTRY & SESSION BINDING STORE
// ---------------------------------------------------------------------------

class InstitutionalPolicyRegistryStore {
  private policyVersions = new Map<string, PolicyVersionEntry[]>();
  private sessionBindings = new Map<string, SessionPolicyBinding>();
  private auditLog: PolicyAuditRecord[] = [];

  constructor() {
    // Seed baseline synthetic institutions
    this.registerPolicy(SYNTHETIC_INSTITUTION_APEX_TECH, 'sys_admin', 'department_dean', 'Initial synthetic profile registration');
    this.registerPolicy(SYNTHETIC_INSTITUTION_METRO_UNIV, 'sys_admin', 'department_dean', 'Initial synthetic profile registration');
  }

  public registerPolicy(
    policy: InstitutionalExamPolicy,
    actorId: string,
    actorRole: string,
    changeSummary: string = 'Policy registration'
  ): { policy: InstitutionalExamPolicy; hash: string } {
    const validation = validateInstitutionalPolicy(policy);
    if (!validation.valid) {
      throw new Error(`Policy validation failed: ${validation.errors.join(', ')}`);
    }

    const hash = hashInstitutionalPolicy(policy);
    const versionEntry: PolicyVersionEntry = {
      version: policy.version,
      updatedAt: policy.updatedAt || Date.now(),
      policy: JSON.parse(JSON.stringify(policy)),
      hash,
      actorId,
      actorRole,
      changeSummary,
    };

    const versions = this.policyVersions.get(policy.policyId) || [];
    versions.push(versionEntry);
    this.policyVersions.set(policy.policyId, versions);

    const auditEntry: PolicyAuditRecord = {
      id: `pol_audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      timestamp: Date.now(),
      policyId: policy.policyId,
      version: policy.version,
      actorId,
      actorRole,
      action: versions.length === 1 ? 'CREATED' : 'UPDATED',
      newHash: hash,
      notes: changeSummary,
    };
    this.auditLog.push(auditEntry);

    return { policy: versionEntry.policy, hash };
  }

  public getPolicy(policyId: string, version?: number): InstitutionalExamPolicy | null {
    const versions = this.policyVersions.get(policyId);
    if (!versions || versions.length === 0) return null;

    if (typeof version === 'number') {
      const match = versions.find((v) => v.version === version);
      return match ? JSON.parse(JSON.stringify(match.policy)) : null;
    }
    // Return latest version
    const latest = versions[versions.length - 1];
    return JSON.parse(JSON.stringify(latest.policy));
  }

  public getPolicyHash(policyId: string, version?: number): string | null {
    const versions = this.policyVersions.get(policyId);
    if (!versions || versions.length === 0) return null;

    if (typeof version === 'number') {
      const match = versions.find((v) => v.version === version);
      return match ? match.hash : null;
    }
    return versions[versions.length - 1].hash;
  }

  public getPolicyVersionHistory(policyId: string): PolicyVersionEntry[] {
    const versions = this.policyVersions.get(policyId);
    if (!versions) return [];
    return JSON.parse(JSON.stringify(versions));
  }

  public updatePolicy(
    policyId: string,
    updates: Partial<InstitutionalExamPolicy>,
    actorId: string,
    actorRole: string,
    changeSummary: string
  ): { success: boolean; policy?: InstitutionalExamPolicy; hash?: string; errors?: string[]; auditRecord?: PolicyAuditRecord } {
    const current = this.getPolicy(policyId);
    if (!current) {
      return { success: false, errors: [`Policy '${policyId}' not found`] };
    }

    // Role check: Only faculty_lead or department_dean can update policies
    if (actorRole !== 'faculty_lead' && actorRole !== 'department_dean') {
      return {
        success: false,
        errors: [`Actor role '${actorRole}' is not authorized to update institutional exam policies`],
      };
    }

    // Version rollback defense: if an explicit version is passed that is <= current version
    if (typeof updates.version === 'number' && updates.version <= current.version) {
      const auditEntry: PolicyAuditRecord = {
        id: `pol_audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        timestamp: Date.now(),
        policyId,
        version: current.version,
        actorId,
        actorRole,
        action: 'ROLLBACK_REJECTED',
        notes: `Attempted version rollback to ${updates.version} rejected; current version is ${current.version}`,
      };
      this.auditLog.push(auditEntry);
      return {
        success: false,
        errors: [`POLICY_ROLLBACK_REJECTED: Requested version ${updates.version} is not greater than active version ${current.version}`],
        auditRecord: auditEntry,
      };
    }

    const previousHash = hashInstitutionalPolicy(current);
    const newVersion = current.version + 1;
    const merged: InstitutionalExamPolicy = {
      ...current,
      ...updates,
      policyId, // immutable ID
      version: newVersion,
      updatedAt: Date.now(),
    };

    const validation = validateInstitutionalPolicy(merged);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    const newHash = hashInstitutionalPolicy(merged);
    const entry: PolicyVersionEntry = {
      version: newVersion,
      updatedAt: merged.updatedAt,
      policy: JSON.parse(JSON.stringify(merged)),
      hash: newHash,
      actorId,
      actorRole,
      changeSummary,
    };

    const versions = this.policyVersions.get(policyId) || [];
    versions.push(entry);
    this.policyVersions.set(policyId, versions);

    const auditEntry: PolicyAuditRecord = {
      id: `pol_audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      timestamp: Date.now(),
      policyId,
      version: newVersion,
      actorId,
      actorRole,
      action: 'UPDATED',
      previousHash,
      newHash,
      notes: changeSummary,
    };
    this.auditLog.push(auditEntry);

    return {
      success: true,
      policy: merged,
      hash: newHash,
      auditRecord: auditEntry,
    };
  }

  public bindSessionToPolicy(
    sessionId: string,
    examId: string,
    policy: InstitutionalExamPolicy
  ): { bound: boolean; hash: string; version: number } {
    const hash = hashInstitutionalPolicy(policy);
    const binding: SessionPolicyBinding = {
      sessionId,
      examId,
      boundAt: Date.now(),
      version: policy.version,
      hash,
      policy: JSON.parse(JSON.stringify(policy)),
    };
    this.sessionBindings.set(sessionId, binding);
    return { bound: true, hash, version: policy.version };
  }

  public getSessionBoundPolicy(sessionId: string): SessionPolicyBinding | null {
    const binding = this.sessionBindings.get(sessionId);
    return binding ? JSON.parse(JSON.stringify(binding)) : null;
  }

  public verifySessionPolicyIntegrity(
    sessionId: string,
    clientSuppliedHash: string,
    clientSuppliedPolicy?: any
  ): { valid: boolean; errorCode?: string; reason?: string } {
    const binding = this.sessionBindings.get(sessionId);
    if (!binding) {
      return {
        valid: false,
        errorCode: 'SESSION_NOT_BOUND',
        reason: `No authoritative institutional policy binding exists for session '${sessionId}'`,
      };
    }

    if (clientSuppliedHash !== binding.hash) {
      const auditEntry: PolicyAuditRecord = {
        id: `pol_audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        timestamp: Date.now(),
        policyId: binding.policy.policyId,
        version: binding.version,
        actorId: sessionId,
        actorRole: 'candidate_session',
        action: 'TAMPER_DETECTED',
        previousHash: binding.hash,
        newHash: clientSuppliedHash,
        notes: `Client-supplied policy hash mismatch for session '${sessionId}'. Expected: ${binding.hash}, Received: ${clientSuppliedHash}`,
      };
      this.auditLog.push(auditEntry);

      return {
        valid: false,
        errorCode: 'TAMPERED_POLICY_REJECTED',
        reason: `Client-side policy modifications are rejected. Authoritative hash: ${binding.hash}, Submitted hash: ${clientSuppliedHash}`,
      };
    }

    if (clientSuppliedPolicy) {
      const computedHash = hashInstitutionalPolicy(clientSuppliedPolicy);
      if (computedHash !== binding.hash) {
        return {
          valid: false,
          errorCode: 'TAMPERED_POLICY_REJECTED',
          reason: 'Client-supplied policy parameters do not compute to authoritative session hash',
        };
      }
    }

    return { valid: true };
  }

  public logAudit(record: PolicyAuditRecord): void {
    this.auditLog.push(record);
  }

  public queryAuditLogs(policyId?: string): PolicyAuditRecord[] {
    if (!policyId) return [...this.auditLog];
    return this.auditLog.filter((a) => a.policyId === policyId);
  }
}

export const institutionalPolicyRegistry = new InstitutionalPolicyRegistryStore();

// ---------------------------------------------------------------------------
// CONFLICT RESOLUTION & PREVIEW ENGINE (FAIL-SAFE SECURITY FLOOR)
// ---------------------------------------------------------------------------

/**
 * Resolves conflicts between institutional baseline policies and individual exam overrides.
 * Enforces a fail-safe security floor: exam overrides cannot downgrade security constraints
 * below the institutional baseline.
 */
export function resolvePolicyConflict(
  institutionalBaseline: InstitutionalExamPolicy,
  examOverrides: Partial<InstitutionalExamPolicy>,
  actorId: string = 'faculty_author',
  actorRole: string = 'faculty_lead'
): {
  resolvedPolicy: InstitutionalExamPolicy;
  conflictsResolved: string[];
  auditRecord: PolicyAuditRecord;
} {
  const conflictsResolved: string[] = [];
  const changes: Record<string, { from: any; to: any }> = {};

  // Clone baseline as starting template
  const resolved: InstitutionalExamPolicy = JSON.parse(JSON.stringify(institutionalBaseline));

  // 1. Duration check
  if (typeof examOverrides.durationMinutes === 'number') {
    const maxAllowedCeiling = institutionalBaseline.durationMinutes * 2;
    if (examOverrides.durationMinutes > maxAllowedCeiling) {
      conflictsResolved.push(
        `Exam duration override (${examOverrides.durationMinutes}m) exceeds institutional maximum (${maxAllowedCeiling}m); clamped to ceiling.`
      );
      resolved.durationMinutes = maxAllowedCeiling;
    } else if (examOverrides.durationMinutes < 15) {
      conflictsResolved.push(
        `Exam duration override (${examOverrides.durationMinutes}m) below institutional minimum (15m); clamped to floor.`
      );
      resolved.durationMinutes = 15;
    } else {
      resolved.durationMinutes = examOverrides.durationMinutes;
    }
  }

  // 2. Camera requirement floor: continuous > presence_only > optional > disabled
  const cameraRank: Record<CameraRequirement, number> = {
    continuous: 3,
    presence_only: 2,
    optional: 1,
    disabled: 0,
  };
  if (examOverrides.cameraRequirement) {
    const baselineRank = cameraRank[institutionalBaseline.cameraRequirement] || 0;
    const overrideRank = cameraRank[examOverrides.cameraRequirement] || 0;
    if (overrideRank < baselineRank) {
      conflictsResolved.push(
        `Cannot downgrade camera requirement from institutional baseline '${institutionalBaseline.cameraRequirement}' to '${examOverrides.cameraRequirement}'. Baseline retained.`
      );
      // Retain baseline
    } else {
      resolved.cameraRequirement = examOverrides.cameraRequirement;
    }
  }

  // 3. Microphone requirement floor: continuous > optional > disabled
  const micRank: Record<MicrophoneRequirement, number> = {
    continuous: 2,
    optional: 1,
    disabled: 0,
  };
  if (examOverrides.microphoneRequirement) {
    const baselineRank = micRank[institutionalBaseline.microphoneRequirement] || 0;
    const overrideRank = micRank[examOverrides.microphoneRequirement] || 0;
    if (overrideRank < baselineRank) {
      conflictsResolved.push(
        `Cannot downgrade microphone requirement from institutional baseline '${institutionalBaseline.microphoneRequirement}' to '${examOverrides.microphoneRequirement}'. Baseline retained.`
      );
    } else {
      resolved.microphoneRequirement = examOverrides.microphoneRequirement;
    }
  }

  // 4. Network requirement & offline tolerance floor
  if (examOverrides.networkRequirement) {
    if (
      institutionalBaseline.networkRequirement === 'online_mandatory' &&
      examOverrides.networkRequirement !== 'online_mandatory'
    ) {
      conflictsResolved.push(
        `Institutional baseline requires 'online_mandatory'. Exam override to '${examOverrides.networkRequirement}' rejected.`
      );
    } else {
      resolved.networkRequirement = examOverrides.networkRequirement;
    }
  }

  if (examOverrides.offlinePermissions) {
    if (
      institutionalBaseline.networkRequirement === 'online_mandatory' &&
      examOverrides.offlinePermissions.allowOfflineStart
    ) {
      conflictsResolved.push(
        `allowOfflineStart cannot be enabled when institutional baseline is 'online_mandatory'. Clamped to false.`
      );
      resolved.offlinePermissions.allowOfflineStart = false;
    } else if (typeof examOverrides.offlinePermissions.allowOfflineStart === 'boolean') {
      resolved.offlinePermissions.allowOfflineStart = examOverrides.offlinePermissions.allowOfflineStart;
    }

    if (typeof examOverrides.offlinePermissions.maxOfflineMinutes === 'number') {
      if (examOverrides.offlinePermissions.maxOfflineMinutes > institutionalBaseline.offlinePermissions.maxOfflineMinutes) {
        conflictsResolved.push(
          `maxOfflineMinutes override (${examOverrides.offlinePermissions.maxOfflineMinutes}m) exceeds institutional baseline (${institutionalBaseline.offlinePermissions.maxOfflineMinutes}m). Clamped to baseline.`
        );
        resolved.offlinePermissions.maxOfflineMinutes = institutionalBaseline.offlinePermissions.maxOfflineMinutes;
      } else {
        resolved.offlinePermissions.maxOfflineMinutes = examOverrides.offlinePermissions.maxOfflineMinutes;
      }
    }
  }

  // 5. Prohibited vs Permitted application conflicts
  const baselineProhibited = new Set(institutionalBaseline.prohibitedProcesses.map((p) => p.toLowerCase().trim()));
  if (examOverrides.permittedProcesses) {
    const cleanPermitted: string[] = [];
    for (const proc of examOverrides.permittedProcesses) {
      const lower = proc.toLowerCase().trim();
      if (baselineProhibited.has(lower)) {
        conflictsResolved.push(
          `Process '${proc}' is prohibited by institutional policy and cannot be permitted by exam override. Removed.`
        );
      } else {
        cleanPermitted.push(proc);
      }
    }
    resolved.permittedProcesses = cleanPermitted;
  }

  if (examOverrides.prohibitedProcesses) {
    // Union institutional prohibited processes with exam-specific prohibited processes
    const mergedProhibited = new Set([
      ...institutionalBaseline.prohibitedProcesses,
      ...examOverrides.prohibitedProcesses,
    ]);
    resolved.prohibitedProcesses = Array.from(mergedProhibited);
  }

  // 6. Break policy floor
  if (examOverrides.breakPolicy) {
    if (!institutionalBaseline.breakPolicy.allowBreaks && examOverrides.breakPolicy.allowBreaks) {
      conflictsResolved.push(
        'Institutional baseline strictly prohibits breaks. Exam override to enable breaks rejected.'
      );
      resolved.breakPolicy.allowBreaks = false;
    } else {
      resolved.breakPolicy.allowBreaks = examOverrides.breakPolicy.allowBreaks;
      if (examOverrides.breakPolicy.maxBreakCount > institutionalBaseline.breakPolicy.maxBreakCount) {
        conflictsResolved.push(
          `maxBreakCount (${examOverrides.breakPolicy.maxBreakCount}) exceeds institutional baseline (${institutionalBaseline.breakPolicy.maxBreakCount}). Clamped.`
        );
        resolved.breakPolicy.maxBreakCount = institutionalBaseline.breakPolicy.maxBreakCount;
      } else {
        resolved.breakPolicy.maxBreakCount = examOverrides.breakPolicy.maxBreakCount;
      }

      if (examOverrides.breakPolicy.maxBreakDurationMinutes > institutionalBaseline.breakPolicy.maxBreakDurationMinutes) {
        conflictsResolved.push(
          `maxBreakDurationMinutes (${examOverrides.breakPolicy.maxBreakDurationMinutes}m) exceeds baseline (${institutionalBaseline.breakPolicy.maxBreakDurationMinutes}m). Clamped.`
        );
        resolved.breakPolicy.maxBreakDurationMinutes = institutionalBaseline.breakPolicy.maxBreakDurationMinutes;
      } else {
        resolved.breakPolicy.maxBreakDurationMinutes = examOverrides.breakPolicy.maxBreakDurationMinutes;
      }
    }
  }

  // 7. Accommodations ceiling
  if (examOverrides.accommodationSettings) {
    if (examOverrides.accommodationSettings.maxTimeMultiplier > institutionalBaseline.accommodationSettings.maxTimeMultiplier) {
      conflictsResolved.push(
        `maxTimeMultiplier (${examOverrides.accommodationSettings.maxTimeMultiplier}x) exceeds institutional baseline (${institutionalBaseline.accommodationSettings.maxTimeMultiplier}x). Clamped to baseline.`
      );
      resolved.accommodationSettings.maxTimeMultiplier = institutionalBaseline.accommodationSettings.maxTimeMultiplier;
    } else if (typeof examOverrides.accommodationSettings.maxTimeMultiplier === 'number') {
      resolved.accommodationSettings.maxTimeMultiplier = examOverrides.accommodationSettings.maxTimeMultiplier;
    }
    resolved.accommodationSettings.allowScreenReaders =
      examOverrides.accommodationSettings.allowScreenReaders ?? resolved.accommodationSettings.allowScreenReaders;
    resolved.accommodationSettings.allowMagnifiers =
      examOverrides.accommodationSettings.allowMagnifiers ?? resolved.accommodationSettings.allowMagnifiers;
    resolved.accommodationSettings.allowHighContrast =
      examOverrides.accommodationSettings.allowHighContrast ?? resolved.accommodationSettings.allowHighContrast;
    resolved.accommodationSettings.allowSpeechInput =
      examOverrides.accommodationSettings.allowSpeechInput ?? resolved.accommodationSettings.allowSpeechInput;
  }

  // 8. Data retention floor: cannot reduce below institutional compliance retention days
  if (examOverrides.dataRetention) {
    if (examOverrides.dataRetention.telemetryRetentionDays < institutionalBaseline.dataRetention.telemetryRetentionDays) {
      conflictsResolved.push(
        `telemetryRetentionDays (${examOverrides.dataRetention.telemetryRetentionDays}d) cannot be lower than institutional minimum (${institutionalBaseline.dataRetention.telemetryRetentionDays}d). Clamped.`
      );
      resolved.dataRetention.telemetryRetentionDays = institutionalBaseline.dataRetention.telemetryRetentionDays;
    } else if (typeof examOverrides.dataRetention.telemetryRetentionDays === 'number') {
      resolved.dataRetention.telemetryRetentionDays = examOverrides.dataRetention.telemetryRetentionDays;
    }
  }

  // Increment version and compute new hash
  resolved.version = institutionalBaseline.version + 1;
  resolved.updatedAt = Date.now();

  const previousHash = hashInstitutionalPolicy(institutionalBaseline);
  const newHash = hashInstitutionalPolicy(resolved);

  const auditRecord: PolicyAuditRecord = {
    id: `pol_audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    timestamp: Date.now(),
    policyId: resolved.policyId,
    version: resolved.version,
    actorId,
    actorRole,
    action: conflictsResolved.length > 0 ? 'CONFLICT_RESOLVED' : 'OVERRIDE_APPLIED',
    previousHash,
    newHash,
    conflictsResolved,
    notes: `Resolved policy override for exam. Conflicts handled: ${conflictsResolved.length}`,
  };

  institutionalPolicyRegistry.logAudit(auditRecord);

  return {
    resolvedPolicy: resolved,
    conflictsResolved,
    auditRecord,
  };
}

/**
 * Previews the effect of exam-specific overrides without mutating state.
 */
export function previewPolicyOverrides(
  institutionalBaseline: InstitutionalExamPolicy,
  examOverrides: Partial<InstitutionalExamPolicy>
): {
  previewPolicy: InstitutionalExamPolicy;
  validation: { valid: boolean; errors: string[] };
  conflictsResolved: string[];
  changes: Record<string, { baseline: any; override: any }>;
} {
  const result = resolvePolicyConflict(institutionalBaseline, examOverrides, 'preview_user', 'faculty_lead');
  const validation = validateInstitutionalPolicy(result.resolvedPolicy);

  const changes: Record<string, { baseline: any; override: any }> = {};
  for (const key of Object.keys(examOverrides) as Array<keyof InstitutionalExamPolicy>) {
    if (JSON.stringify(institutionalBaseline[key]) !== JSON.stringify(result.resolvedPolicy[key])) {
      changes[key] = {
        baseline: institutionalBaseline[key],
        override: result.resolvedPolicy[key],
      };
    }
  }

  return {
    previewPolicy: result.resolvedPolicy,
    validation,
    conflictsResolved: result.conflictsResolved,
    changes,
  };
}

// ---------------------------------------------------------------------------
// SERVER-SIDE RUNTIME POLICY ENFORCEMENT HELPERS
// ---------------------------------------------------------------------------

export function enforceTimeExtension(
  sessionId: string,
  additionalMinutes: number,
  requesterRole: string
): { allowed: boolean; newDurationMinutes?: number; reason?: string } {
  // Only proctors, faculty leads, and department deans can authorize extensions
  if (requesterRole !== 'proctor' && requesterRole !== 'faculty_lead' && requesterRole !== 'department_dean') {
    return {
      allowed: false,
      reason: `Role '${requesterRole}' is not authorized to grant time extensions`,
    };
  }

  const binding = institutionalPolicyRegistry.getSessionBoundPolicy(sessionId);
  if (!binding) {
    return { allowed: false, reason: 'Session not bound to an authoritative policy' };
  }

  const policy = binding.policy;
  if (!policy.accommodationSettings.allowTimeExtension) {
    return {
      allowed: false,
      reason: 'Institutional policy for this examination disallows time extensions',
    };
  }

  const maxAllowedDuration = policy.durationMinutes * policy.accommodationSettings.maxTimeMultiplier;
  const prospectiveDuration = policy.durationMinutes + additionalMinutes;

  if (prospectiveDuration > maxAllowedDuration) {
    return {
      allowed: false,
      reason: `Requested extension (${additionalMinutes}m) would exceed policy multiplier ceiling (${policy.accommodationSettings.maxTimeMultiplier}x, ${maxAllowedDuration}m max)`,
    };
  }

  return {
    allowed: true,
    newDurationMinutes: prospectiveDuration,
  };
}

export function enforceBreakRequest(
  sessionId: string,
  requestedBreakMinutes: number,
  breaksTakenSoFar: number,
  breakMinutesTakenSoFar: number
): { allowed: boolean; reason?: string } {
  const binding = institutionalPolicyRegistry.getSessionBoundPolicy(sessionId);
  if (!binding) {
    return { allowed: false, reason: 'Session not bound to an authoritative policy' };
  }

  const policy = binding.policy;
  if (!policy.breakPolicy.allowBreaks) {
    return { allowed: false, reason: 'Institutional policy strictly prohibits breaks during this examination' };
  }

  if (breaksTakenSoFar + 1 > policy.breakPolicy.maxBreakCount) {
    return {
      allowed: false,
      reason: `Maximum break count (${policy.breakPolicy.maxBreakCount}) reached for this examination`,
    };
  }

  if (breakMinutesTakenSoFar + requestedBreakMinutes > policy.breakPolicy.maxBreakDurationMinutes) {
    return {
      allowed: false,
      reason: `Total break duration would exceed policy maximum (${policy.breakPolicy.maxBreakDurationMinutes}m)`,
    };
  }

  return { allowed: true };
}

export function enforceAuthorizedApplication(
  sessionId: string,
  processName: string
): { allowed: boolean; isProhibited: boolean; reason?: string } {
  const binding = institutionalPolicyRegistry.getSessionBoundPolicy(sessionId);
  if (!binding) {
    return { allowed: true, isProhibited: false };
  }

  const policy = binding.policy;
  const cleanName = processName.toLowerCase().trim();

  // 1. Prohibited check
  const prohibitedSet = new Set(policy.prohibitedProcesses.map((p) => p.toLowerCase().trim()));
  if (prohibitedSet.has(cleanName)) {
    return {
      allowed: false,
      isProhibited: true,
      reason: `Process '${processName}' is strictly prohibited by institutional exam policy`,
    };
  }

  // 2. Permitted check (if whitelist is defined)
  if (policy.permittedProcesses && policy.permittedProcesses.length > 0) {
    const permittedSet = new Set(policy.permittedProcesses.map((p) => p.toLowerCase().trim()));
    if (!permittedSet.has(cleanName)) {
      return {
        allowed: false,
        isProhibited: false,
        reason: `Process '${processName}' is not on the institutional permitted application whitelist`,
      };
    }
  }

  return { allowed: true, isProhibited: false };
}

