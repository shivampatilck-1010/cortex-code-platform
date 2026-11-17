import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import {
  createSebLaunchToken,
  generateSafeExamBrowserConfigPlist,
  getExpectedBrowserExamKey,
  hashQuitPassword,
  buildSebAssignmentStartUrl,
  buildSebAssignmentQuitUrl,
} from '@/lib/classroom/seb-security';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; asgId: string }> }
) {
  try {
    const { id, asgId } = await params;
    const auth = await ClassroomAuth.verifyAccess(req, id);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 403 });
    }

    const user = await ClassroomAuth.getCurrentUser(req);
    const classroom = await classroomDb.getClassroom(id);
    const isTeacher =
      user.role === 'admin' ||
      auth.context?.membership?.role === 'teacher' ||
      classroom?.teacherId === user.id;

    const assignment = await classroomDb.getAssignment(asgId);
    if (!assignment || (assignment.classroomId !== id && assignment.classroomId !== id.toUpperCase().trim() && assignment.classroomId.toLowerCase() !== id.toLowerCase().trim())) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Students cannot download configuration for draft assignments
    if (!isTeacher && assignment.status === 'draft') {
      return NextResponse.json(
        { error: 'Configuration unavailable for draft assignments' },
        { status: 403 }
      );
    }

    // Resolve base URL safely with HTTPS preference for production
    const fwdProto = req.headers.get('x-forwarded-proto');
    const fwdHost = req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.host || 'localhost:3000';
    const proto = (fwdProto || '').toLowerCase() === 'https' ? 'https' : (req.nextUrl.protocol.replace(':', '') || 'http');
    const baseUrl = `${proto}://${fwdHost.trim()}`;

    // Issue single-use signed launch token bound to user, assignment, and classroom (10-min TTL)
    const requestedToken = req.nextUrl.searchParams.get('launchToken') || req.nextUrl.searchParams.get('token') || req.nextUrl.searchParams.get('sebToken');
    const launchToken = requestedToken || createSebLaunchToken({
      userId: user.id || 'anonymous_student',
      assessmentId: asgId,
      assessmentType: 'assignment',
      classroomId: id,
      durationMinutes: assignment.durationMinutes || 0,
    });

    // Exact assignment deep-link startURL and clean quitURL
    const startUrl = buildSebAssignmentStartUrl(baseUrl, asgId, assignment.classroomId || id, launchToken);
    const quitUrl = buildSebAssignmentQuitUrl(baseUrl, assignment.classroomId || id);

    // Retrieve or derive authoritative Browser Exam Key and quit password hash
    const browserExamKey = getExpectedBrowserExamKey(assignment, { authoritative: true });
    const hashedQuitPassword =
      assignment.sebQuitPasswordHash ||
      (assignment.sebQuitPassword ? hashQuitPassword(assignment.sebQuitPassword) : '');

    // Generate Apple Plist XML and official Config Key
    const { xml: plistXml, configKey, configDict } = generateSafeExamBrowserConfigPlist({
      startUrl,
      quitUrl,
      quitPasswordHash: hashedQuitPassword,
      sebQuitPassword: assignment.sebQuitPassword,
      browserExamKey,
      allowReload: Boolean(assignment.sebAllowReload),
      showReloadWarning: assignment.sebShowReloadWarning !== false,
      allowPreferencesWindow: false,
      brandingTheme: assignment.brandingTheme,
    });

    // Construct direct sebs:// protocol launch URI
    const httpsConfigUrl = `${baseUrl}/api/v1/classrooms/${encodeURIComponent(id)}/assignments/${encodeURIComponent(asgId)}/seb-config?launchToken=${encodeURIComponent(launchToken)}`;
    const protocolUri = httpsConfigUrl
      .replace(/^https:\/\//i, 'sebs://')
      .replace(/^http:\/\//i, 'seb://');

    const format = req.nextUrl.searchParams.get('format');
    const isJsonRequested =
      format === 'json' ||
      (req.headers.get('accept')?.includes('application/json') &&
        format !== 'seb' &&
        format !== 'plist' &&
        !req.nextUrl.searchParams.has('download'));

    // JSON format support for client modals, setup gates, and teacher inspection
    if (isJsonRequested) {
      return NextResponse.json({
        success: true,
        sebRequired: true,
        assignmentId: asgId,
        classroomId: assignment.classroomId || id,
        startUrl,
        quitUrl,
        launchToken,
        configKey,
        configXml: plistXml,
        browserExamKey: isTeacher ? browserExamKey : undefined,
        protocolUri,
        configUrl: httpsConfigUrl,
        downloadUrl: 'https://safeexambrowser.org/download_en.html',
        filename: `cortex-assignment-${asgId}.seb`,
        allowReload: Boolean(assignment.sebAllowReload),
        showReloadWarning: assignment.sebShowReloadWarning !== false,
        securityLevel: assignment.securityLevel || 'standard',
        configDict: isTeacher ? configDict : undefined,
      });
    }

    // Standard Apple Plist XML (.seb) file download
    return new NextResponse(plistXml, {
      status: 200,
      headers: {
        'Content-Type': 'application/seb; charset=utf-8',
        'Content-Disposition': `attachment; filename="cortex-assignment-${asgId}.seb"`,
        'Cache-Control': 'no-store, max-age=0',
        'X-SafeExamBrowser-ConfigKey': configKey,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to generate SEB configuration' },
      { status: 500 }
    );
  }
}
