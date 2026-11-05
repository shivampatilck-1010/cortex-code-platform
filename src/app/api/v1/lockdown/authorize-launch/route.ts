import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { classroomDb } from '@/lib/classroom/db';
import { DEFAULT_LOCKDOWN_POLICY, hashPolicy, signLaunchGrant } from '@/lib/lockdown/security-policy';
import { verifyPilotAuthorization } from '@/lib/lockdown/pilot-config';
import {
  institutionalPolicyRegistry,
  hashInstitutionalPolicy,
  SYNTHETIC_INSTITUTION_APEX_TECH,
  SYNTHETIC_INSTITUTION_METRO_UNIV,
} from '@/lib/lockdown/institutional-policy';

export async function POST(req: NextRequest) {
  try {
    const user = await ClassroomAuth.getCurrentUser(req);
    if (!user || !user.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const { classroomId, examId, deviceId, hardwareFingerprint } = body;

    if (!classroomId || !examId) {
      return NextResponse.json({ error: 'classroomId and examId are required' }, { status: 400 });
    }

    const auth = await ClassroomAuth.verifyAccess(req, classroomId);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Access denied to this classroom' }, { status: 403 });
    }

    const exam = await classroomDb.getExam(examId);
    if (!exam) {
      return NextResponse.json({ error: 'Examination not found' }, { status: 404 });
    }

    if (exam.status !== 'active' && exam.status !== 'published') {
      return NextResponse.json({ error: `Examination is not active (current status: ${exam.status})` }, { status: 400 });
    }

    // Controlled Pilot Authorization Gate for Restricted Examinations
    if (exam.securityLevel === 'restricted') {
      const pilotAuth = verifyPilotAuthorization({
        classroomId,
        examId,
        studentId: user.id,
        deviceId,
      });

      if (!pilotAuth.authorized) {
        return NextResponse.json({
          error: pilotAuth.reason || 'Not authorized for Cortex Lockdown pilot',
          pilotStatus: pilotAuth.status,
          lockdownPilotRequired: true,
        }, { status: 403 });
      }
    }

    const policy = {
      ...DEFAULT_LOCKDOWN_POLICY,
      allowSingleDisplayOnly: exam.securityLevel === 'restricted' || exam.securityLevel === 'seb',
      blockAppSwitching: exam.securityLevel === 'restricted' || exam.securityLevel === 'seb',
      blockScreenCapture: exam.securityLevel === 'restricted' || exam.securityLevel === 'seb',
    };
    const policyHash = hashPolicy(policy);

    // Institutional exam policy binding
    const instPolicyId = exam.securityLevel === 'restricted' ? 'POL_APEX_TECH_HIGH_SEC' : 'POL_METRO_UNIV_FLEX';
    const institutionalPolicy = institutionalPolicyRegistry.getPolicy(instPolicyId) || SYNTHETIC_INSTITUTION_APEX_TECH;
    const institutionalHash = hashInstitutionalPolicy(institutionalPolicy);

    const devId = deviceId || `dev_${Math.random().toString(36).substring(2, 10)}`;
    const hwFp = hardwareFingerprint || 'standard_desktop_hardware';

    // Sign launch grant with 120-second TTL
    const launchGrant = signLaunchGrant({
      sub: user.id,
      examId: exam.id,
      classroomId,
      deviceId: devId,
      hardwareFingerprint: hwFp,
      policyHash,
      ttlSeconds: 120,
    });

    return NextResponse.json({
      authorized: true,
      launchGrant,
      expiresInSeconds: 120,
      exam: {
        id: exam.id,
        title: exam.title,
        durationMinutes: exam.durationMinutes,
        securityLevel: exam.securityLevel,
        totalMarks: exam.totalMarks,
        passingMarks: exam.passingMarks,
      },
      policy,
      policyHash,
      institutionalPolicy,
      institutionalPolicyHash: institutionalHash,
      version: institutionalPolicy.version,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Authorization failed' }, { status: 500 });
  }
}
