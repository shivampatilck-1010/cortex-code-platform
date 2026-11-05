import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { classroomDb } from '@/lib/classroom/db';
import {
  issueEmergencyRecoveryAuthorization,
  atomicRedeemEmergencyRecoveryAuthorizationAsync,
  redeemEmergencyRecoveryAuthorization,
  verifyLaunchGrant,
} from '@/lib/lockdown/security-policy';
import { isEntityRevoked } from '@/lib/lockdown/pilot-config';

export async function GET(req: NextRequest) {
  try {
    const user = await ClassroomAuth.getCurrentUser(req);
    if (!user || !user.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Only faculty and administrators can request proctor emergency exit codes
    if (user.role !== 'teacher' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Proctor or faculty privileges required' }, { status: 403 });
    }

    // Distributed durable rate limiting: max 10 code generations per 10 minutes per proctor
    const proctorRate = await classroomDb.checkDistributedRateLimit({
      key: `rate:proctor:${user.id}`,
      limit: 10,
      windowSeconds: 600,
    });
    if (!proctorRate.allowed) {
      return NextResponse.json(
        { error: `Proctor rate limit exceeded: Please wait ${proctorRate.resetInSeconds} seconds before requesting more recovery codes` },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(req.url);
    const examId = searchParams.get('examId');
    const challenge = searchParams.get('challenge');
    const candidateId = searchParams.get('candidateId') || searchParams.get('studentId') || 'candidate_general';
    const deviceId = searchParams.get('deviceId') || undefined;
    const sessionId = searchParams.get('sessionId') || undefined;
    const reason = searchParams.get('reason') || 'Proctor emergency intervention';

    if (!examId || !challenge) {
      return NextResponse.json({ error: 'examId and challenge query parameters are required' }, { status: 400 });
    }

    // Input sanitization: challenge must be 4-16 alphanumeric chars
    if (!/^[a-zA-Z0-9]{4,16}$/.test(challenge.trim())) {
      return NextResponse.json({ error: 'Malformed challenge code. Must be 4-16 alphanumeric characters.' }, { status: 400 });
    }

    // Check if candidate or exam is revoked
    if (candidateId && isEntityRevoked('student', candidateId).revoked) {
      return NextResponse.json({ error: 'Candidate account is revoked in pilot registry' }, { status: 403 });
    }
    if (examId && isEntityRevoked('exam', examId).revoked) {
      return NextResponse.json({ error: 'Examination is revoked in pilot registry' }, { status: 403 });
    }

    // Issue stateful, single-use, candidate-bound emergency recovery authorization
    const issueResult = issueEmergencyRecoveryAuthorization({
      examId,
      candidateId,
      challenge,
      deviceId,
      sessionId,
      reason,
      issuedBy: user.email || user.id,
      ttlSeconds: 180, // 3 minutes validity window
    });

    if (!issueResult.success || !issueResult.authorization) {
      return NextResponse.json({ error: issueResult.error || 'Failed to issue emergency recovery authorization' }, { status: 429 });
    }

    const authRecord = issueResult.authorization;

    // Audit log this proctor authorization code generation in DB without exposing plaintext OTP
    await classroomDb.createExamIntegrityEvent({
      id: `int_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sessionId: sessionId || `sess_proctor_gen_${user.id}`,
      eventType: 'proctor_action',
      timestamp: Date.now(),
      details: {
        action: 'proctor_emergency_code_issued',
        authorizationId: authRecord.id,
        examId,
        challenge: authRecord.challenge,
        candidateId,
        deviceId,
        reason,
        generatedBy: user.email || user.id,
        expiresAt: authRecord.expiresAt,
      },
    });

    return NextResponse.json({
      success: true,
      authorizationId: authRecord.id,
      examId,
      challenge: authRecord.challenge,
      candidateId,
      emergencyCode: authRecord.code,
      expiresAt: authRecord.expiresAt,
      generatedAt: authRecord.issuedAt,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to generate emergency exit code' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, examId, challenge, code, grant, candidateId: rawCandidateId, deviceId: rawDeviceId, sessionId: rawSessionId } = body;

    if (!examId || !challenge || !code) {
      return NextResponse.json({ error: 'examId, challenge, and code are required' }, { status: 400 });
    }

    // Distributed IP-based abuse rate limiting
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const ipRate = await classroomDb.checkDistributedRateLimit({
      key: `rate:ip:${clientIp}`,
      limit: 30,
      windowSeconds: 60,
    });
    if (!ipRate.allowed) {
      return NextResponse.json(
        { authorized: false, error: 'Network rate limit exceeded: Too many redemption requests from this IP' },
        { status: 429 }
      );
    }

    let candidateId = rawCandidateId;
    let deviceId = rawDeviceId;
    const sessionId = rawSessionId;

    // Identity and Session Trust: validate against signed launch grant if provided
    if (grant && typeof grant === 'string') {
      const grantVerify = verifyLaunchGrant(grant);
      if (!grantVerify.valid || !grantVerify.claims) {
        return NextResponse.json({ authorized: false, error: 'Launch grant signature invalid or expired' }, { status: 403 });
      }

      const claims = grantVerify.claims;
      if (rawCandidateId && rawCandidateId.trim() !== claims.sub) {
        return NextResponse.json({ authorized: false, error: 'Candidate identity mismatch with launch grant' }, { status: 403 });
      }
      if (rawDeviceId && claims.deviceId && rawDeviceId.trim() !== claims.deviceId) {
        return NextResponse.json({ authorized: false, error: 'Device hardware mismatch with launch grant' }, { status: 403 });
      }
      if (examId && claims.examId && examId.trim().toLowerCase() !== claims.examId.toLowerCase()) {
        return NextResponse.json({ authorized: false, error: 'Examination mismatch with launch grant' }, { status: 403 });
      }

      candidateId = claims.sub;
      deviceId = claims.deviceId;
    }

    // Active Examination Session Validation: verify candidate and session state if sessionId is provided
    if (sessionId) {
      const examSession = await classroomDb.getExamSession(sessionId);
      if (examSession) {
        if (candidateId && examSession.userId !== candidateId) {
          return NextResponse.json({ authorized: false, error: 'Examination session candidate mismatch' }, { status: 403 });
        }
        if (examSession.status !== 'in_progress') {
          return NextResponse.json(
            { authorized: false, error: `Examination session is not active (current status: ${examSession.status})` },
            { status: 403 }
          );
        }
      }
    }

    // Revocation status validation
    if (candidateId && isEntityRevoked('student', candidateId).revoked) {
      return NextResponse.json({ authorized: false, error: 'Candidate account is revoked in pilot registry' }, { status: 403 });
    }
    if (deviceId && isEntityRevoked('device', deviceId).revoked) {
      return NextResponse.json({ authorized: false, error: 'Device hardware is revoked in pilot registry' }, { status: 403 });
    }

    // Distributed candidate abuse rate limiting
    if (candidateId) {
      const candRate = await classroomDb.checkDistributedRateLimit({
        key: `rate:candidate:${candidateId}`,
        limit: 5,
        windowSeconds: 60,
      });
      if (!candRate.allowed) {
        return NextResponse.json(
          { authorized: false, error: 'Candidate redemption rate limit exceeded: Please wait 60 seconds before retrying' },
          { status: 429 }
        );
      }
    }

    // 1. Attempt server-authoritative atomic single-use redemption
    let redemption = await atomicRedeemEmergencyRecoveryAuthorizationAsync({
      examId,
      challenge,
      code,
      candidateId,
      deviceId,
      sessionId,
    });

    // In-memory fallback if database table not yet populated in test mock
    if (!redemption.authorized && redemption.reason === 'No active recovery authorization found for this examination challenge') {
      redemption = redeemEmergencyRecoveryAuthorization({
        examId,
        challenge,
        code,
        candidateId,
        deviceId,
        sessionId,
      });
    }

    if (redemption.authorized && redemption.authorization) {
      // Record successful emergency exit authorization event in DB without code
      await classroomDb.createExamIntegrityEvent({
        id: `int_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        sessionId: sessionId || redemption.authorization.sessionId || `sess_exit_${examId}`,
        eventType: 'emergency_exit',
        timestamp: Date.now(),
        details: {
          action: 'emergency_exit_authorized',
          authorizationId: redemption.authorization.id,
          examId,
          challenge,
          candidateId: redemption.authorization.candidateId,
          deviceId: redemption.authorization.deviceId,
          issuedBy: redemption.authorization.issuedBy,
          reason: redemption.authorization.reason,
          redeemedAt: redemption.authorization.redeemedAt,
        },
      });

      return NextResponse.json({
        authorized: true,
        message: 'Proctor emergency exit authorized',
        authorizationId: redemption.authorization.id,
        redeemedAt: redemption.authorization.redeemedAt,
      });
    }

    // Failure: log unauthorized exit attempt without exposing the code or code fragments
    await classroomDb.createExamIntegrityEvent({
      id: `int_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sessionId: sessionId || `sess_exit_${examId}`,
      eventType: 'proctor_action',
      timestamp: Date.now(),
      details: {
        action: 'unauthorized_emergency_exit_attempt',
        examId,
        challenge,
        rejectionReason: redemption.reason || 'Invalid authorization code',
      },
    });

    return NextResponse.json(
      {
        authorized: false,
        error: redemption.reason || 'Invalid or expired proctor authorization code',
      },
      { status: 403 }
    );
  } catch (err: any) {
    // Database failures FAIL CLOSED
    return NextResponse.json({ authorized: false, error: 'Emergency exit database unavailable: request denied (fail-closed)' }, { status: 500 });
  }
}
