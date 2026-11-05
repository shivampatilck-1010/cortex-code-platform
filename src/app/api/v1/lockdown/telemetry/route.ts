import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { classroomDb } from '@/lib/classroom/db';
import { verifyLaunchGrant } from '@/lib/lockdown/security-policy';
import { institutionalPolicyRegistry } from '@/lib/lockdown/institutional-policy';
import { authorizeRbacRequest, AccessSubject, AuditRole } from '@/lib/lockdown/privacy-governance';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const examId = searchParams.get('examId');
    const sessionId = searchParams.get('sessionId');
    const studentId = searchParams.get('studentId');
    const actorRole = (searchParams.get('role') || 'student') as AuditRole;
    const actorId = searchParams.get('actorId') || 'unknown';

    // RBAC Authorization Guard for Telemetry Access
    const subject: AccessSubject = {
      actorId,
      actorRole,
      assignedExamIds: examId ? [examId] : undefined,
    };

    const authCheck = authorizeRbacRequest(
      subject,
      'ACCESS_LIVE_TELEMETRY',
      {
        resourceType: 'telemetry',
        targetExamId: examId || undefined,
        targetStudentId: studentId || undefined,
        targetSessionId: sessionId || undefined,
      }
    );

    if (!authCheck.authorized) {
      return NextResponse.json({
        error: authCheck.message,
        errorCode: authCheck.errorCode || 'FORBIDDEN',
      }, { status: 403 });
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId parameter is required' }, { status: 400 });
    }

    const events = await classroomDb.listExamIntegrityEvents(sessionId);
    return NextResponse.json({
      sessionId,
      examId,
      events,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch telemetry' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    let authenticatedUserId: string | null = null;
    let grantExamId: string | null = null;

    // 1. Authenticate via user session cookie
    try {
      const user = await ClassroomAuth.authenticateRequest(req);
      if (user && user.id) {
        authenticatedUserId = user.id;
      }
    } catch (_) {}

    // 2. Authenticate via cryptographic launch grant header (native desktop client)
    const grantHeader = req.headers.get('x-cortex-lockdown-grant');
    if (grantHeader) {
      const grantResult = verifyLaunchGrant(grantHeader);
      if (grantResult.valid && grantResult.claims) {
        authenticatedUserId = grantResult.claims.sub;
        grantExamId = grantResult.claims.examId;
      } else if (!authenticatedUserId) {
        return NextResponse.json({ error: `Invalid launch grant: ${grantResult.error}` }, { status: 401 });
      }
    }

    if (!authenticatedUserId) {
      return NextResponse.json({ error: 'Authentication required via session cookie or valid x-cortex-lockdown-grant' }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId, examId, events, policyHash } = body;

    if (!sessionId || !events || !Array.isArray(events)) {
      return NextResponse.json({ error: 'sessionId and events array are required' }, { status: 400 });
    }

    // Distributed Session Revocation Check
    if ((await classroomDb.isSessionRevoked(sessionId)) || (await classroomDb.isTokenRevoked(sessionId))) {
      return NextResponse.json({
        error: `Telemetry rejected: Session '${sessionId}' has been revoked or terminated`,
        errorCode: 'SESSION_REVOKED',
      }, { status: 403 });
    }

    // Cross-exam authorization check: if grant token specified examId, payload must match
    if (grantExamId && examId && grantExamId !== examId) {
      return NextResponse.json({ error: 'Grant is not authorized for the specified examId' }, { status: 403 });
    }

    // Policy Hash Verification: Ensure client hasn't modified institutional exam policy
    const clientHash = policyHash || req.headers.get('x-cortex-lockdown-policy-hash');
    if (clientHash) {
      const policyVerification = institutionalPolicyRegistry.verifySessionPolicyIntegrity(sessionId, clientHash);
      if (!policyVerification.valid) {
        return NextResponse.json({
          error: policyVerification.reason || 'Client-side policy modifications are rejected.',
          errorCode: policyVerification.errorCode || 'TAMPERED_POLICY_REJECTED',
        }, { status: 403 });
      }
    }

    let persistedCount = 0;
    for (const evt of events) {
      if (evt.eventType) {
        await classroomDb.createExamIntegrityEvent({
          id: `int_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          sessionId,
          eventType: evt.eventType,
          timestamp: evt.timestamp || Date.now(),
          details: evt.details || {},
        });
        persistedCount++;
      }
    }

    return NextResponse.json({
      received: events.length,
      persisted: persistedCount,
      status: 'recorded',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Telemetry recording failed' }, { status: 500 });
  }
}
