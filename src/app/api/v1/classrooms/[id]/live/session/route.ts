import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { getAuthoritativeIceServers } from '@/lib/classroom/ice-servers';
import { ClassroomIdentity } from '@/lib/classroom/identity';

/**
 * Cortex Live Class — Stage 2: Authentication and Session Context Bridge
 *
 * GET /api/v1/classrooms/[id]/live/session
 *
 * Authoritatively bridges Cortex Live Class with the Cortex Code Platform.
 * Security guarantees:
 * 1. Authenticates strictly via the platform's 'cortex_session' cookie.
 * 2. Validates classroom existence and membership authoritatively in SQLite.
 * 3. Derives role from server records (admin/owner/membership table).
 *    Completely ignores client query params (?role=...), headers, or localStorage.
 * 4. Returns non-secret session context and an ephemeral HMAC-signed live token.
 * 5. Never leaks password_hash, session cookie values, or internal DB secrets.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authoritative request authentication strictly via session cookie
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) {
      return NextResponse.json(
        { authorized: false, error: 'Authentication required. Please log in.' },
        { status: 401 }
      );
    }

    // 2. Validate classroom identifier
    const { id } = await params;
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { authorized: false, error: 'Missing or invalid classroomId parameter.' },
        { status: 400 }
      );
    }

    const normId = id.toUpperCase().trim();
    const classroom = (await classroomDb.getClassroom(normId)) || (await classroomDb.getClassroom(id));
    if (!classroom) {
      return NextResponse.json(
        { authorized: false, error: `Classroom '${normId}' not found.` },
        { status: 404 }
      );
    }

    // 3. Status check: archived classrooms cannot host live sessions
    if (classroom.status === 'archived') {
      return NextResponse.json(
        { authorized: false, error: 'This classroom is archived and cannot host live sessions.' },
        { status: 403 }
      );
    }

    // 4. Server-Side Classroom Membership and Authorization Check
    const membershipCheck = await ClassroomAuth.verifyClassroomMembership(user, classroom.id);
    if (!membershipCheck.authorized) {
      return NextResponse.json(
        { authorized: false, error: membershipCheck.error || 'Access denied to this classroom.' },
        { status: 403 }
      );
    }

    // 5. Authoritative Role Derivation
    // Strict priority: global admin > classroom owner > teacher member > student member.
    // Client-supplied parameters (e.g. ?role=teacher, headers) are completely discarded.
    const isAdmin = user.role === 'admin';
    const isOwner = classroom.teacherId === user.id;
    const isTeacher = isAdmin || isOwner || membershipCheck.role === 'teacher';
    const effectiveRole: 'teacher' | 'student' = isTeacher ? 'teacher' : 'student';

    // 6. Look up teacher info for live session display
    let teacherUser: any = null;
    if (classroom.teacherId) {
      teacherUser = await classroomDb.getUser(classroom.teacherId);
    }

    // 7. Derive permissions from classroom settings
    const settings = classroom.settings || ({} as any);
    const permissions = {
      allowStudentMicrophone: (settings as any).allowStudentMicrophone ?? true,
      allowStudentCamera: (settings as any).allowStudentCamera ?? true,
      allowStudentScreenShare: (settings as any).allowStudentScreenShare ?? false,
      allowStudentChat: (settings as any).allowStudentChat ?? settings.allowStudentMessaging ?? true,
      allowIndependentMode: (settings as any).allowIndependentMode ?? settings.allowCodeSharing ?? true,
    };

    const tokenLifetimeMs = 1000 * 60 * 60; // 1 hour default lifetime for live signaling
    const now = Date.now();

    // 8. Ephemeral Live Session Token (valid for signaling, zero exposure of cortex_session)
    const effectiveEmail = (user as any).professional_email || (user as any).professionalEmail || ClassroomIdentity.generateProfessionalIdentity(user);
    const liveSessionToken = ClassroomAuth.createLiveSessionToken({
      userId: user.id,
      userName: user.name,
      userEmail: effectiveEmail,
      classroomId: classroom.id,
      role: effectiveRole,
      durationMs: tokenLifetimeMs,
    });

    // 9. Return authoritative, non-secret session context
    return NextResponse.json({
      authorized: true,
      classroomId: classroom.id,
      classroomTitle: classroom.name,
      courseCode: classroom.coursecode || classroom.id,
      role: effectiveRole,
      user: {
        id: user.id,
        name: user.name,
        email: (user as any).professional_email || (user as any).professionalEmail || ClassroomIdentity.generateProfessionalIdentity(user),
        professionalEmail: (user as any).professional_email || (user as any).professionalEmail || ClassroomIdentity.generateProfessionalIdentity(user),
        cortexId: user.cortex_id || user.cortexId || user.id,
        role: effectiveRole,
      },
      teacher: {
        id: classroom.teacherId,
        name: classroom.teacherName || teacherUser?.name || 'Teacher',
        email: teacherUser?.professional_email || (teacherUser ? ClassroomIdentity.generateProfessionalIdentity(teacherUser) : 'teacher@cortex.com'),
        professionalEmail: teacherUser?.professional_email || (teacherUser ? ClassroomIdentity.generateProfessionalIdentity(teacherUser) : 'teacher@cortex.com'),
      },
      session: {
        id: classroom.id,
        title: classroom.name,
        courseCode: classroom.coursecode || classroom.id,
        teacher: {
          id: classroom.teacherId,
          name: classroom.teacherName || teacherUser?.name || 'Teacher',
          email: teacherUser?.professional_email || (teacherUser ? ClassroomIdentity.generateProfessionalIdentity(teacherUser) : 'teacher@cortex.com'),
          professionalEmail: teacherUser?.professional_email || (teacherUser ? ClassroomIdentity.generateProfessionalIdentity(teacherUser) : 'teacher@cortex.com'),
        },
        startedAt: classroom.createdAt,
        permissions,
      },
      permissions,
      liveSessionToken,
      iceServers: getAuthoritativeIceServers(user.id).iceServers,
      isTurnConfigured: getAuthoritativeIceServers(user.id).isTurnConfigured,
      iceMode: getAuthoritativeIceServers(user.id).mode,
      issuedAt: now,
      expiresAt: now + tokenLifetimeMs,
    });
  } catch (err: any) {
    console.error('[LiveSessionBridge] Unhandled error during live session authentication:', err);
    return NextResponse.json(
      { authorized: false, error: err?.message || 'Failed to authenticate live session context' },
      { status: 500 }
    );
  }
}
