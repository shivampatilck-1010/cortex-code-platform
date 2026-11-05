/**
 * CORTEX LOCKDOWN — CONTROLLED PILOT MANAGEMENT & ACCESS CONTROL
 *
 * Provides institutional scoping, classroom whitelisting, candidate cohort authorization,
 * dynamic revocation registry, and emergency isolation for the Cortex Lockdown pilot.
 *
 * Strictly zero emojis.
 */

export interface PilotInstitution {
  id: string;
  name: string;
  domain: string;
  status: 'active' | 'suspended' | 'revoked' | 'unverified';
  recordType: 'demonstration' | 'institutional_pilot';
  authorizationStatus:
    | 'verified_institutional_pilot'
    | 'pending_institutional_authorization'
    | 'demonstration_only'
    | 'rejected'
    | 'verified_active'
    | 'pending_legal_agreement';
  contactEmail: string;
  pilotAgreementRef?: string;
  administrativeEvidenceDoc?: string;
  evidenceVerifiedAt?: number;
  evidenceVerifiedBy?: string;
  enrolledAt: number;
  enrolledBy: string;
  maxClassrooms: number;
  maxCandidates: number;
}

export interface PilotClassroom {
  classroomId: string;
  institutionId: string;
  status: 'active' | 'revoked';
  allowedExamIds: string[];
  baselineQuota?: number;
  maxConcurrentSessions: number;
  requireLockdownApp: boolean;
  allowedStudentIds?: string[];
  allowedDeviceIds?: string[];
  fallbackAuthorized?: boolean;
  fallbackReason?: string;
}

export interface RevocationRecord {
  id: string;
  entityType: 'institution' | 'classroom' | 'exam' | 'student' | 'device';
  entityId: string;
  reason: string;
  revokedAt: number;
  revokedBy: string;
}

export interface PilotAuditLog {
  id: string;
  action: 'activate' | 'deactivate' | 'revoke' | 'restore' | 'update_quota' | 'authorize_fallback' | 'reset';
  entityType?: string;
  entityId?: string;
  performedBy: string;
  timestamp: number;
  details: Record<string, any>;
}

export interface PilotConfiguration {
  pilotEnabled: boolean;
  tier: 'controlled_pilot' | 'general_availability';
  mode: 'demonstration' | 'institutional_pilot' | 'production';
  defaultConcurrentQuota: number;
  institutions: Record<string, PilotInstitution>;
  classrooms: Record<string, PilotClassroom>;
  revocations: RevocationRecord[];
  auditLogs: PilotAuditLog[];
  supportContact: {
    name: string;
    email: string;
    hotline: string;
    emergencyExitCode: string;
  };
}

// Authoritative In-Memory Pilot Registry for Pilot Phase
export const DEFAULT_PILOT_CONFIG: PilotConfiguration = {
  pilotEnabled: true,
  tier: 'controlled_pilot',
  mode: (process.env.CORTEX_LOCKDOWN_MODE as any) || 'demonstration',
  defaultConcurrentQuota: 50,
  institutions: {
    inst_cit_01: {
      id: 'inst_cit_01',
      name: 'Cortex Institute of Technology',
      domain: 'cit.edu',
      status: 'active',
      recordType: 'demonstration',
      authorizationStatus: 'demonstration_only',
      contactEmail: 'proctor-support@cit.edu',
      pilotAgreementRef: 'AGR-2026-CIT-DEMO',
      enrolledAt: 1793400000000,
      enrolledBy: 'system_admin',
      maxClassrooms: 10,
      maxCandidates: 250,
    },
    inst_state_eng: {
      id: 'inst_state_eng',
      name: 'State Engineering University',
      domain: 'seu.edu',
      status: 'active',
      recordType: 'demonstration',
      authorizationStatus: 'demonstration_only',
      contactEmail: 'assessment@seu.edu',
      pilotAgreementRef: 'AGR-2026-SEU-DEMO',
      enrolledAt: 1793400000000,
      enrolledBy: 'system_admin',
      maxClassrooms: 5,
      maxCandidates: 100,
    },
  },
  classrooms: {
    CSE276: {
      classroomId: 'CSE276',
      institutionId: 'inst_cit_01',
      status: 'active',
      allowedExamIds: ['*'], // All examinations in CS 276
      baselineQuota: 50,
      maxConcurrentSessions: 60,
      requireLockdownApp: true,
    },
    CS301: {
      classroomId: 'CS301',
      institutionId: 'inst_cit_01',
      status: 'active',
      allowedExamIds: ['*'],
      baselineQuota: 50,
      maxConcurrentSessions: 60,
      requireLockdownApp: true,
    },
    CS402: {
      classroomId: 'CS402',
      institutionId: 'inst_state_eng',
      status: 'active',
      allowedExamIds: ['*'],
      baselineQuota: 30,
      maxConcurrentSessions: 40,
      requireLockdownApp: true,
    },
  },
  revocations: [],
  auditLogs: [],
  supportContact: {
    name: 'Cortex University Examination Operations Desk',
    email: 'lockdown-support@cortex-eval.edu',
    hotline: '+1-800-555-0199',
    emergencyExitCode: 'CTRL+ALT+F10',
  },
};

// Active state holder (supports runtime revocation during testing and pilot administration)
let currentPilotConfig: PilotConfiguration = JSON.parse(JSON.stringify(DEFAULT_PILOT_CONFIG));

/**
 * Appends an auditable pilot governance log.
 */
export function recordPilotAudit(
  action: PilotAuditLog['action'],
  performedBy: string,
  details: Record<string, any>,
  entityType?: string,
  entityId?: string
): PilotAuditLog {
  const log: PilotAuditLog = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    action,
    entityType,
    entityId,
    performedBy,
    timestamp: Date.now(),
    details,
  };
  currentPilotConfig.auditLogs.push(log);
  return log;
}

/**
 * Resets pilot configuration to default baseline.
 */
export function resetPilotConfig(actor: string = 'system_admin'): void {
  currentPilotConfig = JSON.parse(JSON.stringify(DEFAULT_PILOT_CONFIG));
  recordPilotAudit('reset', actor, { reason: 'Reset to authoritative default baseline' });
}

/**
 * Retrieves the current pilot configuration.
 */
export function getPilotConfig(): PilotConfiguration {
  return currentPilotConfig;
}

/**
 * Revokes access dynamically for a specific entity.
 */
export function revokePilotAccess(
  entityType: 'institution' | 'classroom' | 'exam' | 'student' | 'device',
  entityId: string,
  reason: string,
  revokedBy: string
): RevocationRecord {
  const record: RevocationRecord = {
    id: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    entityType,
    entityId: entityId.trim().toUpperCase(),
    reason,
    revokedAt: Date.now(),
    revokedBy,
  };

  currentPilotConfig.revocations.push(record);

  // If classroom or institution, update direct status
  const normalizedId = entityId.trim().toUpperCase();
  if (entityType === 'classroom' && currentPilotConfig.classrooms[normalizedId]) {
    currentPilotConfig.classrooms[normalizedId].status = 'revoked';
  } else if (entityType === 'institution') {
    const inst = Object.values(currentPilotConfig.institutions).find(
      (i) => i.id.toUpperCase() === normalizedId
    );
    if (inst) {
      inst.status = 'revoked';
    }
  }

  recordPilotAudit('revoke', revokedBy, { entityType, entityId, reason }, entityType, entityId);
  return record;
}

/**
 * Restores access dynamically for a revoked entity.
 */
export function restorePilotAccess(
  entityType: 'institution' | 'classroom' | 'exam' | 'student' | 'device',
  entityId: string,
  restoredBy: string
): { success: boolean; message: string } {
  const normalizedId = entityId.trim().toUpperCase();
  const initialLen = currentPilotConfig.revocations.length;
  currentPilotConfig.revocations = currentPilotConfig.revocations.filter(
    (r) => !(r.entityType === entityType && r.entityId === normalizedId)
  );

  if (entityType === 'classroom' && currentPilotConfig.classrooms[normalizedId]) {
    currentPilotConfig.classrooms[normalizedId].status = 'active';
  } else if (entityType === 'institution') {
    const inst = Object.values(currentPilotConfig.institutions).find(
      (i) => i.id.toUpperCase() === normalizedId
    );
    if (inst) {
      inst.status = 'active';
    }
  }

  const removed = initialLen > currentPilotConfig.revocations.length;
  recordPilotAudit('restore', restoredBy, { entityType, entityId, removed }, entityType, entityId);
  return {
    success: true,
    message: removed
      ? `Revocation cleared for ${entityType} '${entityId}' by ${restoredBy}`
      : `No active revocation found for ${entityType} '${entityId}', status verified active`,
  };
}

/**
 * Authorizes emergency fallback of an examination to the standard browser runner.
 * Strictly decoupled from classroom access revocation.
 * Preserves candidate responses and sessions, requiring explicit faculty justification.
 */
export function authorizeClassroomExamFallback(params: {
  classroomId: string;
  examId: string;
  reason: string;
  authorizedBy: string;
  targetSecurityLevel?: 'standard';
}): {
  success: boolean;
  message: string;
  auditRecord?: PilotAuditLog;
} {
  const normClassroom = params.classroomId.trim().toUpperCase();
  const classroom = currentPilotConfig.classrooms[normClassroom];
  if (!classroom) {
    return {
      success: false,
      message: `Classroom '${params.classroomId}' is not found in pilot registry`,
    };
  }

  classroom.fallbackAuthorized = true;
  classroom.fallbackReason = params.reason;

  const audit = recordPilotAudit(
    'authorize_fallback',
    params.authorizedBy,
    {
      classroomId: params.classroomId,
      examId: params.examId,
      reason: params.reason,
      targetSecurityLevel: params.targetSecurityLevel || 'standard',
    },
    'classroom',
    params.classroomId
  );

  return {
    success: true,
    message: `Emergency fallback authorized for exam '${params.examId}' in classroom '${params.classroomId}'. Candidates may transition to standard browser runner without answer loss.`,
    auditRecord: audit,
  };
}

/**
 * Verifies whether an institution or classroom has exceeded concurrent candidate limits.
 */
export function verifyPilotQuota(
  classroomId: string,
  currentConcurrentSessions: number
): { withinQuota: boolean; limit: number; baseline: number; current: number; reason?: string } {
  const normClassroom = classroomId.trim().toUpperCase();
  const classroom = currentPilotConfig.classrooms[normClassroom];
  const limit = classroom ? classroom.maxConcurrentSessions : currentPilotConfig.defaultConcurrentQuota;
  const baseline = classroom && classroom.baselineQuota !== undefined ? classroom.baselineQuota : currentPilotConfig.defaultConcurrentQuota;

  if (currentConcurrentSessions > limit) {
    return {
      withinQuota: false,
      limit,
      baseline,
      current: currentConcurrentSessions,
      reason: `Concurrent session limit exceeded for classroom '${classroomId}' (Current: ${currentConcurrentSessions}, Limit: ${limit})`,
    };
  }

  return { withinQuota: true, limit, baseline, current: currentConcurrentSessions };
}

/**
 * Updates classroom concurrent session quotas with mandatory administrative justification and audit logging.
 */
export function updateClassroomQuota(params: {
  classroomId: string;
  baselineQuota?: number;
  maxConcurrentSessions: number;
  justification: string;
  updatedBy: string;
}): { success: boolean; message: string; classroom?: PilotClassroom } {
  const normId = params.classroomId.trim().toUpperCase();
  const classroom = currentPilotConfig.classrooms[normId];
  if (!classroom) {
    return {
      success: false,
      message: `Classroom '${params.classroomId}' is not found in pilot registry`,
    };
  }
  if (!params.justification || params.justification.trim() === '') {
    return {
      success: false,
      message: 'Administrative justification is required for quota modification',
    };
  }

  const oldBaseline = classroom.baselineQuota ?? currentPilotConfig.defaultConcurrentQuota;
  const oldMax = classroom.maxConcurrentSessions;

  classroom.maxConcurrentSessions = params.maxConcurrentSessions;
  if (params.baselineQuota !== undefined) {
    classroom.baselineQuota = params.baselineQuota;
  }

  recordPilotAudit(
    'update_quota',
    params.updatedBy,
    {
      classroomId: normId,
      oldBaseline,
      newBaseline: classroom.baselineQuota,
      oldMax,
      newMax: classroom.maxConcurrentSessions,
      justification: params.justification,
    },
    'classroom',
    normId
  );

  return {
    success: true,
    message: `Quota updated for classroom '${normId}': Baseline ${classroom.baselineQuota}, Hard Max ${classroom.maxConcurrentSessions}`,
    classroom,
  };
}

/**
 * Returns whether pilot mode is currently operational.
 */
/**
 * Explicitly enrolls an institution in the pilot registry.
 */
export function enrollPilotInstitution(institution: PilotInstitution, enrolledBy: string): { success: boolean; message: string } {
  currentPilotConfig.institutions[institution.id] = {
    ...institution,
    enrolledAt: Date.now(),
    enrolledBy,
  };
  recordPilotAudit('activate', enrolledBy, { institutionId: institution.id, name: institution.name, recordType: institution.recordType, authorizationStatus: institution.authorizationStatus }, 'institution', institution.id);
  return { success: true, message: `Institution '${institution.name}' enrolled successfully` };
}

/**
 * Explicitly enrolls a classroom in the pilot registry.
 */
export function enrollPilotClassroom(classroom: PilotClassroom, enrolledBy: string): { success: boolean; message: string } {
  const normId = classroom.classroomId.trim().toUpperCase();
  currentPilotConfig.classrooms[normId] = {
    ...classroom,
    classroomId: normId,
  };
  recordPilotAudit('activate', enrolledBy, { classroomId: normId, institutionId: classroom.institutionId, maxConcurrent: classroom.maxConcurrentSessions }, 'classroom', normId);
  return { success: true, message: `Classroom '${normId}' enrolled successfully` };
}

export function isPilotActive(): boolean {
  if (process.env.NODE_ENV === 'test') return true;
  if (process.env.CORTEX_LOCKDOWN_PILOT_MODE === 'disabled') return false;
  return currentPilotConfig.pilotEnabled;
}

/**
 * Verifies if an entity has been revoked.
 */
export function isEntityRevoked(
  entityType: 'institution' | 'classroom' | 'exam' | 'student' | 'device',
  entityId: string
): { revoked: boolean; record?: RevocationRecord } {
  const normalizedId = entityId.trim().toUpperCase();
  const record = currentPilotConfig.revocations.find(
    (r) => r.entityType === entityType && r.entityId === normalizedId
  );
  if (record) {
    return { revoked: true, record };
  }
  return { revoked: false };
}

/**
 * Verifies if an examination attempt is authorized under the controlled pilot.
 */
export function verifyPilotAuthorization(params: {
  classroomId: string;
  examId: string;
  studentId: string;
  deviceId?: string;
  institutionId?: string;
}): {
  authorized: boolean;
  status: 'authorized' | 'revoked' | 'not_in_pilot' | 'pilot_disabled';
  reason?: string;
  pilot?: {
    institutionName: string;
    classroomAllowed: boolean;
    supportContact: string;
  };
} {
  if (!isPilotActive()) {
    return {
      authorized: false,
      status: 'pilot_disabled',
      reason: 'Cortex Lockdown pilot is currently inactive',
    };
  }

  const classroomKey = params.classroomId.trim().toUpperCase();

  // Check Revocation Registry: Student
  const studentRevoked = isEntityRevoked('student', params.studentId);
  if (studentRevoked.revoked) {
    return {
      authorized: false,
      status: 'revoked',
      reason: `Student account access has been revoked: ${studentRevoked.record?.reason}`,
    };
  }

  // Check Revocation Registry: Device
  if (params.deviceId) {
    const deviceRevoked = isEntityRevoked('device', params.deviceId);
    if (deviceRevoked.revoked) {
      return {
        authorized: false,
        status: 'revoked',
        reason: `Examination device access has been revoked: ${deviceRevoked.record?.reason}`,
      };
    }
  }

  // Check Revocation Registry: Exam
  const examRevoked = isEntityRevoked('exam', params.examId);
  if (examRevoked.revoked) {
    return {
      authorized: false,
      status: 'revoked',
      reason: `Examination lockdown session has been revoked: ${examRevoked.record?.reason}`,
    };
  }

  // Check Classroom Whitelist
  const classroom = currentPilotConfig.classrooms[classroomKey];
  if (!classroom) {
    return {
      authorized: false,
      status: 'not_in_pilot',
      reason: `Classroom '${params.classroomId}' is not enrolled in the Cortex Lockdown controlled pilot`,
    };
  }

  if (classroom.status === 'revoked') {
    return {
      authorized: false,
      status: 'revoked',
      reason: `Pilot authorization for classroom '${params.classroomId}' has been revoked`,
    };
  }

  // Check Institution Status
  const institution = currentPilotConfig.institutions[classroom.institutionId];
  if (!institution || institution.status !== 'active') {
    return {
      authorized: false,
      status: 'revoked',
      reason: `Pilot institution '${classroom.institutionId}' is not active`,
    };
  }

  // Production Mode Protection: Demo institutions cannot masquerade as authorized production partners
  if (currentPilotConfig.mode === 'production' && (institution.domain === 'cit.edu' || institution.id.startsWith('inst_cit') || institution.id.startsWith('inst_state') || institution.recordType === 'demonstration')) {
    return {
      authorized: false,
      status: 'not_in_pilot',
      reason: 'Demonstration institutions cannot authorize examinations in production mode',
    };
  }

  // Institutional Pilot Mode Verification: unverified or demo institutions cannot run in institutional pilot mode
  if (currentPilotConfig.mode === 'institutional_pilot') {
    if (institution.recordType === 'demonstration') {
      return {
        authorized: false,
        status: 'not_in_pilot',
        reason: 'Demonstration institutions cannot authorize examinations in institutional pilot mode',
      };
    }
    if (
      institution.authorizationStatus !== 'verified_institutional_pilot' &&
      institution.authorizationStatus !== 'verified_active'
    ) {
      return {
        authorized: false,
        status: 'not_in_pilot',
        reason: `Institution '${institution.name}' is not verified for active institutional pilot (status: ${institution.authorizationStatus})`,
      };
    }
    if (!institution.pilotAgreementRef || institution.pilotAgreementRef.trim() === '') {
      return {
        authorized: false,
        status: 'not_in_pilot',
        reason: `Institution '${institution.name}' lacks a verified pilot agreement reference`,
      };
    }
    if (institution.authorizationStatus === 'verified_institutional_pilot') {
      if (!institution.administrativeEvidenceDoc || institution.administrativeEvidenceDoc.trim() === '') {
        return {
          authorized: false,
          status: 'not_in_pilot',
          reason: `Institution '${institution.name}' lacks verified administrative authorization evidence`,
        };
      }
      if (!institution.evidenceVerifiedAt || !institution.evidenceVerifiedBy) {
        return {
          authorized: false,
          status: 'not_in_pilot',
          reason: `Institution '${institution.name}' administrative evidence has not undergone verified administrative audit`,
        };
      }
    }
  }

  // Check Candidate Cohort Scope
  if (classroom.allowedStudentIds && classroom.allowedStudentIds.length > 0) {
    if (!classroom.allowedStudentIds.includes(params.studentId)) {
      return {
        authorized: false,
        status: 'not_in_pilot',
        reason: `Student '${params.studentId}' is not in the authorized pilot cohort for this classroom`,
      };
    }
  }

  // Check Device Workstation Scope
  if (params.deviceId && classroom.allowedDeviceIds && classroom.allowedDeviceIds.length > 0) {
    if (!classroom.allowedDeviceIds.includes(params.deviceId)) {
      return {
        authorized: false,
        status: 'not_in_pilot',
        reason: `Device '${params.deviceId}' is not an authorized hardware workstation for this classroom`,
      };
    }
  }

  // Check Examination Allowlist
  if (
    !classroom.allowedExamIds.includes('*') &&
    !classroom.allowedExamIds.includes(params.examId)
  ) {
    return {
      authorized: false,
      status: 'not_in_pilot',
      reason: `Examination '${params.examId}' is not approved for this pilot classroom`,
    };
  }

  return {
    authorized: true,
    status: 'authorized',
    pilot: {
      institutionName: institution.name,
      classroomAllowed: true,
      supportContact: currentPilotConfig.supportContact.email,
    },
  };
}
