import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { classroomDb } from '@/lib/classroom/db';
import {
  checkRetentionEligibility,
  executeAuthorizedDataPurge,
  dataGovernanceStore,
  PHYSICAL_STORAGE_DELETION_CAVEAT,
  RetentionRecord,
  AccessSubject,
  AuditRole,
} from '@/lib/lockdown/privacy-governance';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const examId = searchParams.get('examId') || undefined;
    const studentId = searchParams.get('studentId') || undefined;
    const actorRole = (searchParams.get('role') || 'department_dean') as AuditRole;
    const actorId = searchParams.get('actorId') || 'sys_dean';

    // Only deans, faculty leads, and external auditors can query retention registers
    if (actorRole === 'student') {
      return NextResponse.json({
        error: 'Candidates are not authorized to inspect institutional retention registries',
        errorCode: 'ROLE_ESCALATION_BLOCKED',
      }, { status: 403 });
    }

    const auditTrail = await classroomDb.listLockdownAuditLog({
      examId,
      studentId,
    });

    const chainIntegrity = await classroomDb.verifyLockdownAuditLogIntegrity();

    return NextResponse.json({
      auditTrail,
      chainIntegrity,
      retentionPolicyDefaultDays: 90,
      physicalStorageCaveat: PHYSICAL_STORAGE_DELETION_CAVEAT,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to query retention' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, actorId, actorRole, record } = body;

    const subject: AccessSubject = {
      actorId: actorId || 'anonymous',
      actorRole: (actorRole || 'student') as AuditRole,
    };

    // 1. ACTION: EVALUATE RETENTION ELIGIBILITY
    if (action === 'evaluate') {
      if (!record || !record.id) {
        return NextResponse.json({ error: 'record payload is required for eligibility evaluation' }, { status: 400 });
      }

      const eligibility = checkRetentionEligibility(record, Date.now());
      return NextResponse.json({
        recordId: record.id,
        eligibility,
      });
    }

    // 2. ACTION: APPLY OR REMOVE LEGAL/ACADEMIC APPEAL DISPUTE HOLD
    if (action === 'set_hold') {
      const { recordId, onHold, reason } = body;
      // Only Dean or Faculty Lead can place/release holds
      if (subject.actorRole !== 'department_dean' && subject.actorRole !== 'faculty_lead') {
        return NextResponse.json({
          error: `Role '${subject.actorRole}' cannot place or release academic dispute holds`,
          errorCode: 'ROLE_ESCALATION_BLOCKED',
        }, { status: 403 });
      }

      const existingRecord = dataGovernanceStore.getRetentionRecord(recordId);
      if (!existingRecord) {
        return NextResponse.json({ error: `Retention record '${recordId}' not found` }, { status: 404 });
      }

      existingRecord.status = onHold ? 'under_appeal' : 'finalized';
      dataGovernanceStore.registerRetentionRecord(existingRecord);

      await classroomDb.appendLockdownAuditEntry({
        actorId: subject.actorId,
        actorRole: subject.actorRole,
        action: 'UPDATE_RETENTION_POLICY',
        resourceType: 'retention_policy',
        resourceId: recordId,
        targetStudentId: existingRecord.studentId,
        targetExamId: existingRecord.examId,
        outcome: 'GRANTED',
        reason: onHold ? `Placed academic dispute hold: ${reason || 'Under review'}` : 'Released dispute hold; record finalized',
      });

      return NextResponse.json({
        success: true,
        recordId,
        status: existingRecord.status,
        message: onHold ? 'Record frozen under academic integrity dispute' : 'Dispute hold removed; status finalized',
      });
    }

    // 3. ACTION: EXECUTE AUTHORIZED DATA PURGE
    if (action === 'purge') {
      if (!record || !record.id) {
        return NextResponse.json({ error: 'record payload is required for purge execution' }, { status: 400 });
      }

      const purgeResult = executeAuthorizedDataPurge(subject, record, Date.now());
      if (!purgeResult.success) {
        return NextResponse.json({
          error: purgeResult.message,
          errorCode: purgeResult.errorCode || 'PURGE_REJECTED',
          physicalCaveat: purgeResult.physicalCaveat,
        }, { status: 403 });
      }

      // Append immutable audit log of the authorized deletion
      await classroomDb.appendLockdownAuditEntry({
        actorId: subject.actorId,
        actorRole: subject.actorRole,
        action: 'PURGE_TELEMETRY_DATA',
        resourceType: 'telemetry',
        resourceId: record.id,
        targetStudentId: record.studentId,
        targetExamId: record.examId,
        outcome: 'GRANTED',
        reason: purgeResult.message,
      });

      return NextResponse.json({
        success: true,
        purgedRecordId: record.id,
        message: purgeResult.message,
        physicalCaveat: purgeResult.physicalCaveat,
      });
    }

    return NextResponse.json({ error: `Unknown retention action '${action}'` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Retention operation failed' }, { status: 500 });
  }
}
