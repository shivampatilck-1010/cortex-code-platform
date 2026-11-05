import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';

/**
 * Escapes XML strings for safe plist generation.
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

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
    const isTeacher =
      user.role === 'admin' ||
      auth.context?.membership?.role === 'teacher' ||
      (await classroomDb.getClassroom(id))?.teacherId === user.id;

    const exam = await classroomDb.getExam(examId);
    if (!exam || exam.classroomId !== id.toUpperCase().trim()) {
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

    const origin = req.nextUrl.origin || 'http://localhost:3000';
    const startUrl = `${origin}/classroom`;
    const quitUrl = `${origin}/classroom`;

    // Retrieve hashed quit password from database
    const hashedQuitPassword = exam.sebQuitPasswordHash || (exam.sebQuitPassword ? crypto.createHash('sha256').update(exam.sebQuitPassword).digest('hex') : '');

    // Generate Browser Exam Key hash if not explicitly set
    const browserExamKey = exam.sebBrowserExamKey || crypto
      .createHash('sha256')
      .update(`${exam.id}_${exam.classroomId}_cortex_seb`)
      .digest('hex');

    const format = req.nextUrl.searchParams.get('format');

    // JSON format support for API inspection (strictly limited to instructors/administrators)
    if (format === 'json') {
      if (!isTeacher) {
        return NextResponse.json({
          error: 'JSON inspection format is restricted to instructors; examinees must download the .seb configuration file',
        }, { status: 403 });
      }
      return NextResponse.json({
        originatorVersion: 'Cortex Examination System 3.0',
        examId: exam.id,
        classroomId: exam.classroomId,
        startURL: startUrl,
        quitURL: quitUrl,
        browserExamKey,
        allowQuit: true,
        hashedQuitPassword: hashedQuitPassword || undefined,
        allowPreferencesWindow: false,
        allowReload: !!exam.sebAllowReload,
        showReloadWarning: exam.sebShowReloadWarning !== false,
        sendBrowserExamKey: true,
        browserViewMode: 0,
        enableAltTab: false,
        hookKeys: true,
        allowDeveloperConsole: false,
        securityLevel: exam.securityLevel,
        limitationsNote: 'Browser-based detection identifies User-Agent and headers; full cryptographic attestation requires the external Safe Exam Browser desktop client.',
      });
    }

    // Standard XML Plist (.seb) format
    const sebXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>originatorVersion</key>
  <string>Cortex Examination System 3.0</string>
  <key>startURL</key>
  <string>${escapeXml(startUrl)}</string>
  <key>quitURL</key>
  <string>${escapeXml(quitUrl)}</string>
  <key>allowQuit</key>
  <true/>
  ${hashedQuitPassword ? `<key>hashedQuitPassword</key>\n  <string>${escapeXml(hashedQuitPassword)}</string>` : ''}
  <key>allowPreferencesWindow</key>
  <false/>
  <key>allowReload</key>
  <${exam.sebAllowReload ? 'true' : 'false'}/>
  <key>showReloadWarning</key>
  <${exam.sebShowReloadWarning !== false ? 'true' : 'false'}/>
  <key>sendBrowserExamKey</key>
  <true/>
  <key>browserExamKey</key>
  <string>${escapeXml(browserExamKey)}</string>
  <key>browserViewMode</key>
  <integer>0</integer>
  <key>enableAltTab</key>
  <false/>
  <key>hookKeys</key>
  <true/>
  <key>allowDeveloperConsole</key>
  <false/>
  <key>allowSpellCheck</key>
  <false/>
</dict>
</plist>`;

    return new NextResponse(sebXml, {
      status: 200,
      headers: {
        'Content-Type': 'application/seb; charset=utf-8',
        'Content-Disposition': `attachment; filename="cortex-exam-${exam.id}.seb"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to generate SEB configuration' }, { status: 500 });
  }
}
