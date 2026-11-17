import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import {
  generateSafeExamBrowserConfigPlist,
  buildSebExamStartUrl,
  buildSebExamQuitUrl,
  createSebLaunchToken,
  getExpectedBrowserExamKey,
  hashQuitPassword,
} from '@/lib/classroom/seb-security';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; examId: string }> }
) {
  try {
    const { id, examId } = await params;
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

    const exam = await classroomDb.getExam(examId);
    if (!exam || (exam.classroomId !== id && exam.classroomId !== id.toUpperCase().trim() && exam.classroomId.toLowerCase() !== id.toLowerCase().trim())) {
      return NextResponse.json({ error: 'Examination not found' }, { status: 404 });
    }

    // Students cannot download configuration for draft examinations or unassigned cohorts
    if (!isTeacher) {
      if (exam.status === 'draft') {
        return NextResponse.json({ error: 'Configuration unavailable for draft examinations' }, { status: 403 });
      }
      if (exam.assignedStudentIds && exam.assignedStudentIds.length > 0 && !exam.assignedStudentIds.includes(user.id)) {
        return NextResponse.json({ error: 'You are not assigned to this examination' }, { status: 403 });
      }
    }

    // Safe base URL resolution with HTTPS preference for production environments
    const fwdProto = req.headers.get('x-forwarded-proto');
    const fwdHost = req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.host || 'localhost:3000';
    const proto = (fwdProto || '').toLowerCase() === 'https' ? 'https' : (req.nextUrl.protocol.replace(':', '') || 'http');
    const origin = `${proto}://${fwdHost.trim()}`;

    // Resolve or issue single-use signed launch token bound to user, exam, and classroom
    const requestedToken = req.nextUrl.searchParams.get('launchToken') || req.nextUrl.searchParams.get('token') || req.nextUrl.searchParams.get('sebToken');
    const launchToken = requestedToken || createSebLaunchToken({
      userId: user.id || 'anonymous_student',
      assessmentId: exam.id,
      assessmentType: 'exam',
      classroomId: id,
      durationMinutes: exam.durationMinutes,
    });

    // Exact assessment deep-link startURL and post-submit quitURL
    const startUrl = buildSebExamStartUrl(origin, exam.id, exam.classroomId || id, launchToken);
    const quitUrl = buildSebExamQuitUrl(origin, exam.classroomId || id);

    // Retrieve or derive authoritative Browser Exam Key and quit password hash
    const browserExamKey = getExpectedBrowserExamKey(exam, { authoritative: true });
    const hashedQuitPassword =
      exam.sebQuitPasswordHash ||
      (exam.sebQuitPassword ? hashQuitPassword(exam.sebQuitPassword) : '');

    // Generate Apple Plist XML and official Config Key
    const { xml, configKey, configDict } = generateSafeExamBrowserConfigPlist({
      startUrl,
      quitUrl,
      quitPasswordHash: hashedQuitPassword,
      sebQuitPassword: exam.sebQuitPassword,
      browserExamKey,
      allowReload: Boolean(exam.sebAllowReload),
      showReloadWarning: exam.sebShowReloadWarning !== false,
      allowPreferencesWindow: false,
      brandingTheme: exam.brandingTheme,
    });

    // Construct direct sebs:// protocol launch URI
    const configDownloadUrl = `${origin}/api/v1/classrooms/${encodeURIComponent(id)}/exams/${encodeURIComponent(examId)}/seb-config?launchToken=${encodeURIComponent(launchToken)}`;
    const protocolUri = configDownloadUrl
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
        examId: exam.id,
        classroomId: exam.classroomId || id,
        configKey,
        configXml: xml,
        startUrl,
        quitUrl,
        protocolUri,
        downloadUrl: 'https://safeexambrowser.org/download_en.html',
        launchToken,
        configUrl: configDownloadUrl,
        filename: `cortex-exam-${exam.id}.seb`,
        allowReload: Boolean(exam.sebAllowReload),
        showReloadWarning: exam.sebShowReloadWarning !== false,
        securityLevel: exam.securityLevel,
        browserExamKey: isTeacher ? browserExamKey : undefined,
        configDict: isTeacher ? configDict : undefined,
      });
    }

    // Standard Apple XML Plist (.seb) file download
    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/seb; charset=utf-8',
        'Content-Disposition': `attachment; filename="cortex-exam-${exam.id}.seb"`,
        'Cache-Control': 'no-store, max-age=0',
        'X-SafeExamBrowser-ConfigKey': configKey,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to generate SEB configuration' }, { status: 500 });
  }
}
