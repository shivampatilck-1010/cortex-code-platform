import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { classroomDb } from '@/lib/classroom/db';
import { DEFAULT_LOCKDOWN_POLICY, hashPolicy, isSessionRevoked } from '@/lib/lockdown/security-policy';
import {
  institutionalPolicyRegistry,
  resolvePolicyConflict,
  previewPolicyOverrides,
  hashInstitutionalPolicy,
  SYNTHETIC_INSTITUTION_APEX_TECH,
  SYNTHETIC_INSTITUTION_METRO_UNIV,
  InstitutionalExamPolicy,
} from '@/lib/lockdown/institutional-policy';
import {
  authorizeRbacRequest,
  AccessSubject,
  AuditRole,
} from '@/lib/lockdown/privacy-governance';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const examId = searchParams.get('examId');
    const sessionId = searchParams.get('sessionId');
    const institutionalPolicyId = searchParams.get('institutionalPolicyId');

    if (!examId) {
      return NextResponse.json({ error: 'examId query parameter is required' }, { status: 400 });
    }

    const exam = await classroomDb.getExam(examId);
    if (!exam) {
      return NextResponse.json({ error: 'Examination not found' }, { status: 404 });
    }

    // Determine institutional baseline
    const targetPolicyId = institutionalPolicyId || (exam.securityLevel === 'restricted' ? 'POL_APEX_TECH_HIGH_SEC' : 'POL_METRO_UNIV_FLEX');
    const institutionalPolicy = institutionalPolicyRegistry.getPolicy(targetPolicyId) || SYNTHETIC_INSTITUTION_APEX_TECH;

    // Default policy customized with exam security settings
    const legacyPolicy = {
      ...DEFAULT_LOCKDOWN_POLICY,
      allowSingleDisplayOnly: exam.securityLevel === 'restricted' || exam.securityLevel === 'seb',
      blockAppSwitching: exam.securityLevel === 'restricted' || exam.securityLevel === 'seb',
      blockScreenCapture: exam.securityLevel === 'restricted' || exam.securityLevel === 'seb',
    };

    const legacyPolicyHash = hashPolicy(legacyPolicy);
    const institutionalHash = hashInstitutionalPolicy(institutionalPolicy);

    // If session ID is provided, bind session to authoritative policy version snapshot
    if (sessionId) {
      if (isSessionRevoked(sessionId) || (await classroomDb.isSessionRevoked(sessionId)) || (await classroomDb.isTokenRevoked(sessionId))) {
        return NextResponse.json({
          error: `Policy retrieval rejected: Session '${sessionId}' has been revoked`,
          code: 'SESSION_REVOKED',
        }, { status: 403 });
      }
      institutionalPolicyRegistry.bindSessionToPolicy(sessionId, exam.id, institutionalPolicy);
      await classroomDb.saveLockdownSessionBinding({
        sessionId,
        examId: exam.id,
        version: institutionalPolicy.version,
        hash: institutionalHash,
        policyJson: JSON.stringify(institutionalPolicy),
      });
    }

    return NextResponse.json({
      examId: exam.id,
      title: exam.title,
      securityLevel: exam.securityLevel,
      policy: legacyPolicy,
      policyHash: legacyPolicyHash,
      institutionalPolicy,
      institutionalPolicyHash: institutionalHash,
      version: institutionalPolicy.version,
      boundSessionId: sessionId || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to retrieve policy' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // 1. ACTION: PREVIEW OVERRIDES
    if (action === 'preview') {
      const { baselinePolicyId, overrides } = body;
      const targetId = baselinePolicyId || 'POL_APEX_TECH_HIGH_SEC';
      const baseline = institutionalPolicyRegistry.getPolicy(targetId) || SYNTHETIC_INSTITUTION_APEX_TECH;

      const preview = previewPolicyOverrides(baseline, overrides || {});
      return NextResponse.json({
        success: true,
        preview,
      });
    }

    // 2. ACTION: VERIFY SESSION POLICY INTEGRITY (TAMPER DETECTION)
    if (action === 'verify_hash') {
      const { sessionId, clientHash, clientPolicy } = body;
      if (!sessionId || !clientHash) {
        return NextResponse.json({ error: 'sessionId and clientHash are required for verification' }, { status: 400 });
      }

      const verification = institutionalPolicyRegistry.verifySessionPolicyIntegrity(sessionId, clientHash, clientPolicy);
      if (!verification.valid) {
        return NextResponse.json({
          error: verification.reason || 'Client-side policy modifications are rejected.',
          errorCode: verification.errorCode || 'TAMPERED_POLICY_REJECTED',
          valid: false,
        }, { status: 403 });
      }

      return NextResponse.json({
        valid: true,
        status: 'verified',
        message: 'Authoritative session policy hash verified.',
      });
    }

    // 3. ACTION: QUERY POLICY VERSION HISTORY & AUDIT TRAIL
    if (action === 'history') {
      const { policyId } = body;
      if (!policyId) {
        return NextResponse.json({ error: 'policyId is required' }, { status: 400 });
      }

      const history = institutionalPolicyRegistry.getPolicyVersionHistory(policyId);
      const audits = institutionalPolicyRegistry.queryAuditLogs(policyId);

      return NextResponse.json({
        policyId,
        history,
        audits,
      });
    }

    // 4. ACTION: UPDATE POLICY WITH VERSION TRACKING (RBAC GUARDED)
    if (action === 'update') {
      const { policyId, updates, changeSummary, actorId, actorRole } = body;
      if (!policyId || !updates) {
        return NextResponse.json({ error: 'policyId and updates are required' }, { status: 400 });
      }

      const effectiveRole = (actorRole || 'student') as AuditRole;
      const effectiveActor = actorId || 'unknown_actor';

      // Check RBAC permission for policy updates (Faculty Lead or Dean required)
      if (effectiveRole !== 'faculty_lead' && effectiveRole !== 'department_dean') {
        return NextResponse.json({
          error: `Role '${effectiveRole}' is not authorized to modify institutional policies`,
          errorCode: 'ROLE_ESCALATION_BLOCKED',
        }, { status: 403 });
      }

      const updateResult = institutionalPolicyRegistry.updatePolicy(
        policyId,
        updates,
        effectiveActor,
        effectiveRole,
        changeSummary || 'Faculty administrative update'
      );

      if (!updateResult.success) {
        return NextResponse.json({
          error: updateResult.errors?.join('; ') || 'Failed to update policy',
          errorCode: updateResult.errors?.[0]?.includes('ROLLBACK') ? 'POLICY_ROLLBACK_REJECTED' : 'INVALID_POLICY',
        }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        policy: updateResult.policy,
        hash: updateResult.hash,
        auditRecord: updateResult.auditRecord,
      });
    }

    return NextResponse.json({ error: `Unknown policy action '${action}'` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Policy administration action failed' }, { status: 500 });
  }
}
