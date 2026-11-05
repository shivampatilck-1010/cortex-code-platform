import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { classroomDb } from '@/lib/classroom/db';
import {
  getPilotConfig,
  revokePilotAccess,
  restorePilotAccess,
  resetPilotConfig,
  verifyPilotAuthorization,
  authorizeClassroomExamFallback,
  updateClassroomQuota,
} from '@/lib/lockdown/pilot-config';

export async function GET(req: NextRequest) {
  try {
    const user = await ClassroomAuth.getCurrentUser(req);
    if (!user || !user.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Role-based confidentiality: Only faculty/proctors and administrators can view pilot topology
    if (user.role !== 'teacher' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Faculty or administrator authorization required' }, { status: 403 });
    }

    const config = getPilotConfig();
    return NextResponse.json({
      pilotEnabled: config.pilotEnabled,
      tier: config.tier,
      mode: config.mode,
      institutionsCount: Object.keys(config.institutions).length,
      classroomsCount: Object.keys(config.classrooms).length,
      revocationsCount: config.revocations.length,
      institutions: config.institutions,
      classrooms: config.classrooms,
      revocations: config.revocations,
      auditLogs: config.auditLogs,
      retentionPolicy: {
        rawMedia: '0 seconds (ephemeral in DOM memory, never persisted)',
        integrityEvents: '90 days (standard academic grading dispute window)',
        emergencyAuthorizations: '30 days (operational audit window)',
        examinationAnswers: 'Institutional registrar academic grade archive policy',
      },
      supportContact: config.supportContact,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch pilot status' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await ClassroomAuth.getCurrentUser(req);
    if (!user || !user.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const { action, entityType, entityId, reason } = body;

    // Action: verify can be executed by enrolled candidates to check their own eligibility
    if (action === 'verify') {
      const { classroomId, examId, studentId, deviceId } = body;
      // Prevent student from probing other students' authorization status
      const targetStudent = user.role === 'admin' || user.role === 'teacher' ? (studentId || user.id) : user.id;

      const verification = verifyPilotAuthorization({
        classroomId: classroomId || '',
        examId: examId || '',
        studentId: targetStudent,
        deviceId,
      });
      return NextResponse.json(verification);
    }

    // All modification actions ('revoke', 'restore', 'reset') require teacher or admin privileges
    if (user.role !== 'teacher' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Faculty or administrator privileges required' }, { status: 403 });
    }

    // Administrator-only configuration reset
    if (action === 'reset') {
      if (user.role !== 'admin') {
        return NextResponse.json({ error: 'Administrator role required to reset pilot configuration' }, { status: 403 });
      }
      resetPilotConfig();
      return NextResponse.json({ success: true, message: 'Pilot configuration reset to baseline' });
    }

    // Revocation & Restoration input validation
    if (action === 'revoke' || action === 'restore') {
      if (!entityType || !entityId) {
        return NextResponse.json({ error: 'entityType and entityId are required' }, { status: 400 });
      }

      const validTypes = ['institution', 'classroom', 'exam', 'student', 'device'];
      if (!validTypes.includes(entityType)) {
        return NextResponse.json({ error: `Invalid entityType. Allowed: ${validTypes.join(', ')}` }, { status: 400 });
      }

      // Input sanitization: entityId must be clean alphanumeric/dash/underscore (max 64 chars)
      if (typeof entityId !== 'string' || entityId.length > 64 || !/^[a-zA-Z0-9_\-]+$/.test(entityId)) {
        return NextResponse.json({ error: 'Malformed entityId. Must be alphanumeric (max 64 chars)' }, { status: 400 });
      }

      // Cross-institution protection: Only admin can revoke/restore an entire institution
      if (entityType === 'institution' && user.role !== 'admin') {
        return NextResponse.json({ error: 'Administrator role required to manage institutional access' }, { status: 403 });
      }

      if (action === 'revoke') {
        const record = revokePilotAccess(
          entityType as any,
          entityId,
          reason || 'Administrative proctor revocation',
          user.email || user.id
        );

        return NextResponse.json({
          success: true,
          action: 'revoked',
          record,
        });
      }

      if (action === 'restore') {
        const result = restorePilotAccess(
          entityType as any,
          entityId,
          user.email || user.id
        );

        return NextResponse.json({
          action: 'restored',
          ...result,
        });
      }
    }

    // Emergency Classroom Fallback Authorization (Requirement 3)
    // Strictly separate operation from classroom lockdown revocation.
    if (action === 'authorize_fallback') {
      const { classroomId, examId, reason: fallbackReason } = body;
      if (!classroomId || !examId) {
        return NextResponse.json({ error: 'classroomId and examId are required for fallback authorization' }, { status: 400 });
      }

      if (!fallbackReason || typeof fallbackReason !== 'string' || fallbackReason.trim().length < 5) {
        return NextResponse.json({ error: 'A valid justification reason (minimum 5 characters) is required to authorize emergency fallback' }, { status: 400 });
      }

      const fallbackResult = authorizeClassroomExamFallback({
        classroomId,
        examId,
        reason: fallbackReason.trim(),
        authorizedBy: user.email || user.id,
        targetSecurityLevel: 'standard',
      });

      if (!fallbackResult.success) {
        return NextResponse.json({ error: fallbackResult.message }, { status: 400 });
      }

      // Update exam record if present in DB while preserving candidate answers and attempts
      try {
        await classroomDb.updateExam(examId, { securityLevel: 'standard' as any });
        await classroomDb.createExamIntegrityEvent({
          id: `int_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          sessionId: `sess_fallback_${examId}`,
          eventType: 'proctor_action',
          timestamp: Date.now(),
          details: {
            action: 'emergency_classroom_fallback_authorized',
            classroomId,
            examId,
            reason: fallbackReason.trim(),
            authorizedBy: user.email || user.id,
            targetSecurityLevel: 'standard',
          },
        });
      } catch (dbErr) {
        // Fallback recorded in pilot configuration even if DB write is non-fatal
      }

      return NextResponse.json({
        success: true,
        action: 'fallback_authorized',
        classroomId,
        examId,
        targetSecurityLevel: 'standard',
        reason: fallbackReason.trim(),
        message: fallbackResult.message,
      });
    }

    // Classroom Quota Update Action
    if (action === 'update_quota') {
      const { classroomId, baselineQuota, maxConcurrentSessions, justification } = body;
      if (!classroomId || typeof maxConcurrentSessions !== 'number') {
        return NextResponse.json({ error: 'classroomId and maxConcurrentSessions are required' }, { status: 400 });
      }
      const quotaResult = updateClassroomQuota({
        classroomId,
        baselineQuota,
        maxConcurrentSessions,
        justification: justification || 'Administrative quota adjustment',
        updatedBy: user.email || user.id,
      });
      if (!quotaResult.success) {
        return NextResponse.json({ error: quotaResult.message }, { status: 400 });
      }
      return NextResponse.json({ action: 'quota_updated', ...quotaResult });
    }

    return NextResponse.json({ error: 'Unsupported pilot action. Use "revoke", "restore", "reset", "verify", "authorize_fallback", or "update_quota"' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Pilot operation failed' }, { status: 500 });
  }
}
