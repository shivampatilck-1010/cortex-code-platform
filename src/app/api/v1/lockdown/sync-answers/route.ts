import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { verifyLaunchGrant, isSessionRevoked } from '@/lib/lockdown/security-policy';
import { isEntityRevoked } from '@/lib/lockdown/pilot-config';
import { institutionalPolicyRegistry } from '@/lib/lockdown/institutional-policy';

// Server-side monotonic sync sequence tracking per session
const sessionSyncSequenceMap = new Map<string, number>();

/**
 * CORTEX LOCKDOWN - REAL-TIME ANSWER SYNCHRONIZATION ENDPOINT
 *
 * Persists incremental candidate answers to Cloudflare D1 / SQLite database
 * with monotonic sequence validation and session heartbeat updating.
 *
 * Strictly zero emojis.
 */
export async function POST(req: NextRequest) {
  try {
    let authenticatedUserId: string | null = null;
    let grantExamId: string | null = null;
    let grantDeviceId: string | null = null;

    // 1. Authenticate via user session cookie
    try {
      const user = await ClassroomAuth.authenticateRequest(req);
      if (user && user.id) {
        authenticatedUserId = user.id;
      }
    } catch (_) {}

    // 2. Authenticate via cryptographic launch grant header or body
    const body = await req.json().catch(() => ({}));
    const grantToken = req.headers.get('x-cortex-lockdown-grant') || body.launchGrant;
    if (grantToken) {
      const grantResult = verifyLaunchGrant(grantToken);
      if (grantResult.valid && grantResult.claims) {
        authenticatedUserId = grantResult.claims.sub;
        grantExamId = grantResult.claims.examId;
        grantDeviceId = grantResult.claims.deviceId;
      } else if (!authenticatedUserId) {
        return NextResponse.json({
          error: `Invalid launch grant: ${grantResult.error}`,
          code: 'GRANT_INVALID',
        }, { status: 401 });
      }
    }

    if (!authenticatedUserId) {
      return NextResponse.json({
        error: 'Authentication required via session cookie or valid x-cortex-lockdown-grant token',
        code: 'UNAUTHENTICATED',
      }, { status: 401 });
    }

    const { examId, sessionId, studentId, answers, sequenceNumber, clientTimestamp } = body;

    if (!examId || !sessionId) {
      return NextResponse.json({ error: 'examId and sessionId are required' }, { status: 400 });
    }

    const effectiveStudentId = studentId || authenticatedUserId;
    if (effectiveStudentId !== authenticatedUserId) {
      return NextResponse.json({
        error: `Sync rejected: Target student ID '${effectiveStudentId}' does not match authenticated identity '${authenticatedUserId}'`,
        code: 'SUBJECT_MISMATCH',
      }, { status: 403 });
    }

    if (grantExamId && grantExamId !== examId) {
      return NextResponse.json({
        error: `Grant was issued for exam '${grantExamId}', cannot sync answers to '${examId}'`,
        code: 'EXAM_MISMATCH',
      }, { status: 403 });
    }

    if (isSessionRevoked(sessionId) || (await classroomDb.isSessionRevoked(sessionId)) || (await classroomDb.isTokenRevoked(sessionId))) {
      return NextResponse.json({
        error: `Sync rejected: Session '${sessionId}' has been revoked or terminated`,
        code: 'SESSION_REVOKED',
      }, { status: 403 });
    }

    // Verify revocation status
    const studentRevoked = isEntityRevoked('student', effectiveStudentId);
    if (studentRevoked.revoked) {
      return NextResponse.json({
        error: `Sync rejected: Candidate access has been revoked (${studentRevoked.record?.reason || 'Administrative action'})`,
        code: 'ACCESS_REVOKED',
      }, { status: 403 });
    }
    if (grantDeviceId) {
      const deviceRevoked = isEntityRevoked('device', grantDeviceId);
      if (deviceRevoked.revoked) {
        return NextResponse.json({
          error: `Sync rejected: Device has been revoked (${deviceRevoked.record?.reason || 'Hardware policy violation'})`,
          code: 'DEVICE_REVOKED',
        }, { status: 403 });
      }
    }

    // Verify session policy integrity hash
    const clientHash = body.policyHash || req.headers.get('x-cortex-lockdown-policy-hash');
    if (clientHash) {
      const policyVerification = institutionalPolicyRegistry.verifySessionPolicyIntegrity(sessionId, clientHash);
      if (!policyVerification.valid) {
        return NextResponse.json({
          error: policyVerification.reason || 'Client-side policy modifications are rejected.',
          code: policyVerification.errorCode || 'TAMPERED_POLICY_REJECTED',
        }, { status: 403 });
      }
    }

    // Monotonic sequence number validation & idempotent duplicate handling
    if (typeof sequenceNumber === 'number') {
      const lastSeq = sessionSyncSequenceMap.get(sessionId) || 0;
      if (sequenceNumber < lastSeq) {
        return NextResponse.json({
          error: `Monotonic sequence violation: Sync seq ${sequenceNumber} is older than processed seq ${lastSeq}`,
          code: 'OUT_OF_ORDER_SEQUENCE',
          lastProcessedSequence: lastSeq,
        }, { status: 409 });
      }
      if (sequenceNumber === lastSeq && lastSeq > 0) {
        return NextResponse.json({
          success: true,
          idempotent: true,
          syncedCount: Object.keys(answers || {}).length,
          sequenceNumber,
          serverTime: Date.now(),
          message: 'Idempotent sync: sequence already recorded',
        });
      }
    }

    const now = Date.now();
    const GRACE_PERIOD_MS = 30 * 1000;

    let session = await classroomDb.getExamSession(sessionId);
    if (!session) {
      const exam = await classroomDb.getExam(examId);
      const durationMs = (exam?.durationMinutes || 60) * 60 * 1000;
      try {
        session = await classroomDb.createExamSession({
          id: sessionId,
          examId,
          userId: effectiveStudentId,
          status: 'in_progress',
          startedAt: now - 60000,
          expiresAt: now + durationMs,
        });
      } catch (err: any) {
        // Concurrency defense: if concurrent requests raced, re-read created session
        session = await classroomDb.getExamSession(sessionId);
        if (!session) {
          const userSessions = await classroomDb.getUserExamSessions(examId, effectiveStudentId);
          session = userSessions.find((s) => s.id === sessionId) || userSessions[0];
        }
        if (!session) throw err;
      }
    }

    if (session.userId !== effectiveStudentId) {
      return NextResponse.json({
        error: 'Cannot sync answers to another candidate\'s session',
        code: 'SESSION_FORBIDDEN',
      }, { status: 403 });
    }

    if (session.status !== 'in_progress') {
      return NextResponse.json({
        error: `Cannot sync answers to a ${session.status} session`,
        status: session.status,
        code: 'SESSION_CLOSED',
      }, { status: 400 });
    }

    // Deadline check: reject answer modification after session expires (with grace period)
    if (session.expiresAt && now > session.expiresAt + GRACE_PERIOD_MS) {
      await classroomDb.updateExamSession(sessionId, { status: 'timed_out' });
      return NextResponse.json({
        error: 'Examination duration has ended. Answering is closed.',
        expired: true,
        expiresAt: session.expiresAt,
        serverTime: now,
      }, { status: 403 });
    }

    // Session validated: advance session sequence tracker
    if (typeof sequenceNumber === 'number') {
      sessionSyncSequenceMap.set(sessionId, sequenceNumber);
    }

    // Persist each provided question answer
    const answersObj = answers || {};
    let syncedCount = 0;
    const updatedAt = typeof clientTimestamp === 'number' ? Math.min(clientTimestamp, now) : now;

    for (const [qId, ansVal] of Object.entries(answersObj)) {
      await classroomDb.saveExamResponse({
        sessionId,
        questionId: qId,
        response: ansVal,
        updatedAt,
      });
      syncedCount++;
    }

    // Update session heartbeat
    await classroomDb.touchSessionHeartbeat(sessionId, now);

    return NextResponse.json({
      success: true,
      syncedCount,
      sequenceNumber: sequenceNumber || null,
      serverTime: now,
    });
  } catch (err: any) {
    console.error('[LockdownSync] Error syncing answers:', err);
    return NextResponse.json({
      error: err?.message || 'Server error during answer synchronization',
      code: 'SERVER_ERROR',
    }, { status: 500 });
  }
}
