// Cortex Online Examination System — Phase 3.1 Comprehensive Security & Integrity Audit Suite
// Verifies Safe Exam Browser protocol adherence, secret protection, cross-classroom authorization,
// timing integrity, question bank ownership, and scoring honesty.

import { classroomDb } from '../src/lib/classroom/db';
import { ClassroomAuth } from '../src/lib/classroom/auth';
import {
  computeSafeExamBrowserHash,
  getExpectedBrowserExamKey,
  verifySafeExamBrowserRequest,
  hashQuitPassword,
} from '../src/lib/classroom/seb-security';
import { sanitizeExamForStudent, sanitizeQuestionForStudent } from '../src/lib/classroom/exam-sanitizer';
import { gradeQuestionResponse } from '../src/lib/classroom/exam-grader';
import { computeActiveExamRoute } from '../src/lib/classroom/exam-branching';
import crypto from 'crypto';
import assert from 'assert';

const BASE_URL = 'http://localhost:3000';

async function runSecurityAuditTests() {
  console.log('================================================================');
  console.log('CORTEX ONLINE EXAMINATION SYSTEM — PHASE 3.1 SECURITY AUDIT');
  console.log('Comprehensive Security, Authorization, SEB & Integrity Suite');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function recordPass(desc: string) {
    console.log(`[PASS] ${desc}`);
    passed++;
  }

  function recordFail(desc: string, err: any) {
    console.error(`[FAIL] ${desc}`);
    console.error(`       Error: ${err?.message || err}`);
    failed++;
  }

  const timestamp = Date.now();
  const roomA = `SEC_CLASS_A_${timestamp}`;
  const roomB = `SEC_CLASS_B_${timestamp}`;
  const teacherAId = `teacher_a_${timestamp}`;
  const teacherBId = `teacher_b_${timestamp}`;
  const student1Id = `student_1_${timestamp}`;
  const student2Id = `student_2_${timestamp}`;

  try {
    // Setup test users & classrooms
    const db = await (classroomDb as any).getDb();
    const insertUser = db.prepare('INSERT OR IGNORE INTO users (id, name, email, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
    insertUser.run(teacherAId, 'Teacher A', `${teacherAId}@cortex.test`, 'teacher', timestamp, timestamp);
    insertUser.run(teacherBId, 'Teacher B', `${teacherBId}@cortex.test`, 'teacher', timestamp, timestamp);
    insertUser.run(student1Id, 'Student 1', `${student1Id}@cortex.test`, 'student', timestamp, timestamp);
    insertUser.run(student2Id, 'Student 2', `${student2Id}@cortex.test`, 'student', timestamp, timestamp);

    await classroomDb.createClassroom({
      id: roomA,
      name: 'Security Test Class A',
      subject: 'Computer Science',
      description: 'Security Audit Class A',
      code: `SECA_${timestamp.toString().slice(-4)}`,
      courseCode: `SECA_${timestamp.toString().slice(-4)}`,
      teacherId: teacherAId,
      teacherName: 'Teacher A',
      status: 'active',
    });

    await classroomDb.createClassroom({
      id: roomB,
      name: 'Security Test Class B',
      subject: 'Data Structures',
      description: 'Security Audit Class B',
      code: `SECB_${timestamp.toString().slice(-4)}`,
      courseCode: `SECB_${timestamp.toString().slice(-4)}`,
      teacherId: teacherBId,
      teacherName: 'Teacher B',
      status: 'active',
    });

    // Memberships
    await classroomDb.addMember({ classroomId: roomA, userId: teacherAId, role: 'teacher' });
    await classroomDb.addMember({ classroomId: roomA, userId: student1Id, role: 'student' });
    await classroomDb.addMember({ classroomId: roomB, userId: teacherBId, role: 'teacher' });
    await classroomDb.addMember({ classroomId: roomB, userId: student2Id, role: 'student' });

    // Auth Sessions & Cookies
    const tokenTeacherA = `sess_ta_${timestamp}`;
    const tokenTeacherB = `sess_tb_${timestamp}`;
    const tokenStudent1 = `sess_s1_${timestamp}`;
    const tokenStudent2 = `sess_s2_${timestamp}`;

    const expiry = timestamp + 86400000;
    const insertSession = db.prepare('INSERT OR REPLACE INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)');
    insertSession.run(tokenTeacherA, teacherAId, expiry, timestamp);
    insertSession.run(tokenTeacherB, teacherBId, expiry, timestamp);
    insertSession.run(tokenStudent1, student1Id, expiry, timestamp);
    insertSession.run(tokenStudent2, student2Id, expiry, timestamp);

    const authTeacherA = { cookie: `cortex_session=${tokenTeacherA}`, 'Content-Type': 'application/json' };
    const authTeacherB = { cookie: `cortex_session=${tokenTeacherB}`, 'Content-Type': 'application/json' };
    const authStudent1 = { cookie: `cortex_session=${tokenStudent1}`, 'Content-Type': 'application/json' };
    const authStudent2 = { cookie: `cortex_session=${tokenStudent2}`, 'Content-Type': 'application/json' };

    // ===================================================================
    // SUITE 1: AUDIT A — SAFE EXAM BROWSER PROTOCOL & VERIFICATION
    // ===================================================================
    console.log('--- SUITE 1: AUDIT A — SAFE EXAM BROWSER CRYPTOGRAPHIC VERIFICATION ---');

    const knownBEK = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
    const knownCK = '908f7e6d5c4b3a291807f6e5d4c3b2a1908f7e6d5c4b3a291807f6e5d4c3b2a1';
    const quitPass = 'SuperSecretQuit99';

    const sebExam = await classroomDb.createExam({
      classroomId: roomA,
      title: 'High Security SEB Proctored Exam',
      description: 'Strict SEB Verification Test',
      durationMinutes: 60,
      startTime: timestamp - 10000,
      endTime: timestamp + 3600000,
      totalMarks: 50,
      passingMarks: 20,
      attemptsAllowed: 2,
      securityLevel: 'seb',
      sebBrowserExamKey: knownBEK,
      sebConfigKey: knownCK,
      sebQuitPassword: quitPass,
      status: 'published',
      createdBy: teacherAId,
    });

    // 1.1 Standard browser request to SEB-gated exam is rejected
    try {
      const res = await fetch(`${BASE_URL}/api/v1/classrooms/${roomA}/exams/${sebExam.id}/start`, {
        method: 'POST',
        headers: { ...authStudent1, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0' },
      });
      assert.strictEqual(res.status, 403, 'Standard browser must receive 403 on SEB exam');
      const data = await res.json();
      assert.strictEqual(data.sebRequired, true, 'sebRequired flag must be true');
      recordPass('1.1 Standard browser request is rejected with 403 and SEB download guidance');
    } catch (err: any) { recordFail('1.1 Standard browser request is rejected', err); }

    // 1.2 Missing SEB headers are rejected
    try {
      const res = await fetch(`${BASE_URL}/api/v1/classrooms/${roomA}/exams/${sebExam.id}/start`, {
        method: 'POST',
        headers: { ...authStudent1 },
      });
      assert.strictEqual(res.status, 403, 'Missing SEB headers must receive 403');
      recordPass('1.2 Missing SEB headers strictly rejected with 403');
    } catch (err: any) { recordFail('1.2 Missing SEB headers', err); }

    // 1.3 Fake User-Agent alone without cryptographic hash is rejected
    try {
      const res = await fetch(`${BASE_URL}/api/v1/classrooms/${roomA}/exams/${sebExam.id}/start`, {
        method: 'POST',
        headers: {
          ...authStudent1,
          'user-agent': 'Mozilla/5.0 SafeExamBrowser/3.4.0 (Windows NT 10.0; Win64; x64)',
        },
      });
      assert.strictEqual(res.status, 403, 'Spoofed User-Agent must NOT bypass verification');
      recordPass('1.3 Fake User-Agent alone without cryptographic hash is strictly rejected (403)');
    } catch (err: any) { recordFail('1.3 Fake User-Agent alone rejection', err); }

    // 1.4 Forged/random header hash is rejected
    try {
      const forgedHash = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
      const res = await fetch(`${BASE_URL}/api/v1/classrooms/${roomA}/exams/${sebExam.id}/start`, {
        method: 'POST',
        headers: {
          ...authStudent1,
          'user-agent': 'SafeExamBrowser/3.4.0',
          'x-safeexambrowser-requesthash': forgedHash,
        },
      });
      assert.strictEqual(res.status, 403, 'Forged hash must receive 403');
      recordPass('1.4 Forged header hash is strictly rejected (403)');
    } catch (err: any) { recordFail('1.4 Forged header hash rejection', err); }

    // 1.5 Protocol-compatible Browser Exam Key (BEK) verification
    try {
      const targetUrl = `${BASE_URL}/api/v1/classrooms/${roomA}/exams/${sebExam.id}/start`;
      const validBekHash = computeSafeExamBrowserHash(targetUrl, knownBEK);

      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          ...authStudent1,
          'user-agent': 'SafeExamBrowser/3.4.0',
          'x-safeexambrowser-requesthash': validBekHash,
        },
      });
      assert(res.status === 200 || res.status === 201, `Valid BEK request hash must authenticate (status: ${res.status})`);
      const data = await res.json();
      assert(data.session && data.session.id, 'Session must be created or resumed');
      recordPass('1.5 Authentic protocol-compatible Browser Exam Key (BEK) hash authorizes session');
    } catch (err: any) { recordFail('1.5 Authentic BEK hash authorization', err); }

    // 1.6 Protocol-compatible Config Key (CK) verification
    try {
      const targetUrl = `${BASE_URL}/api/v1/classrooms/${roomA}/exams/${sebExam.id}/start`;
      const validCkHash = computeSafeExamBrowserHash(targetUrl, knownCK);

      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          ...authStudent1,
          'user-agent': 'SafeExamBrowser/3.4.0',
          'x-safeexambrowser-configkeyhash': validCkHash,
        },
      });
      assert.strictEqual(res.status, 200, `Valid CK request hash must authenticate (status: ${res.status})`);
      recordPass('1.6 Authentic protocol-compatible Config Key (CK) hash authorizes session');
    } catch (err: any) { recordFail('1.6 Authentic Config Key hash authorization', err); }

    // 1.7 Request using another examination's BEK hash is rejected
    try {
      const otherExamBEK = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      const targetUrl = `${BASE_URL}/api/v1/classrooms/${roomA}/exams/${sebExam.id}/start`;
      const mismatchedHash = computeSafeExamBrowserHash(targetUrl, otherExamBEK);

      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          ...authStudent1,
          'user-agent': 'SafeExamBrowser/3.4.0',
          'x-safeexambrowser-requesthash': mismatchedHash,
        },
      });
      assert.strictEqual(res.status, 403, 'Cross-exam BEK hash mismatch must receive 403');
      recordPass('1.7 Cross-examination BEK hash mismatch is strictly rejected (403)');
    } catch (err: any) { recordFail('1.7 Cross-examination BEK hash mismatch', err); }

    // 1.8 Standard security level exam does NOT require SEB headers
    try {
      const standardExam = await classroomDb.createExam({
        classroomId: roomA,
        title: 'Standard Security Exam',
        durationMinutes: 30,
        startTime: timestamp - 1000,
        endTime: timestamp + 3600000,
        totalMarks: 20,
        passingMarks: 10,
        attemptsAllowed: 1,
        securityLevel: 'standard',
        status: 'published',
        createdBy: teacherAId,
      });

      const res = await fetch(`${BASE_URL}/api/v1/classrooms/${roomA}/exams/${standardExam.id}/start`, {
        method: 'POST',
        headers: { ...authStudent1, 'user-agent': 'Standard Chrome' },
      });
      assert(res.status === 200 || res.status === 201, 'Standard exam must succeed without SEB headers');
      recordPass('1.8 Standard security exam starts without requiring SEB headers');
    } catch (err: any) { recordFail('1.8 Standard security exam start', err); }

    // 1.9 SEB configuration generator produces valid XML plist without secret leaks
    try {
      const res = await fetch(`${BASE_URL}/api/v1/classrooms/${roomA}/exams/${sebExam.id}/seb-config`, {
        headers: { ...authTeacherA },
      });
      assert.strictEqual(res.status, 200, 'SEB config endpoint must return 200');
      const xml = await res.text();
      assert(xml.includes('<!DOCTYPE plist PUBLIC'), 'Must be valid Apple XML plist');
      assert(xml.includes('<key>hashedQuitPassword</key>'), 'Must include hashedQuitPassword key');
      assert(!xml.includes(quitPass), 'Must NEVER expose plaintext quit password in .seb file');
      assert(!xml.includes('secret') && !xml.includes('password'), 'Must not leak database secrets');
      recordPass('1.9 SEB XML plist configuration generated cleanly without plaintext password leaks');
    } catch (err: any) { recordFail('1.9 SEB configuration generation', err); }

    // 1.10 Student blocked from downloading config of draft examination
    try {
      const draftExam = await classroomDb.createExam({
        classroomId: roomA,
        title: 'Draft SEB Exam',
        durationMinutes: 30,
        startTime: timestamp,
        endTime: timestamp + 3600000,
        totalMarks: 20,
        passingMarks: 10,
        attemptsAllowed: 1,
        securityLevel: 'seb',
        status: 'draft',
        createdBy: teacherAId,
      });

      const res = await fetch(`${BASE_URL}/api/v1/classrooms/${roomA}/exams/${draftExam.id}/seb-config`, {
        headers: { ...authStudent1 },
      });
      assert.strictEqual(res.status, 403, 'Student cannot download draft SEB config');
      recordPass('1.10 Student is strictly blocked from downloading SEB config for draft examinations');
    } catch (err: any) { recordFail('1.10 Draft SEB config download restriction', err); }

    // ===================================================================
    // SUITE 2: AUDIT B — SECRETS, PASSWORDS & CONFIGURATION INTEGRITY
    // ===================================================================
    console.log('\n--- SUITE 2: AUDIT B — SECRETS & CONFIGURATION INTEGRITY ---');

    // 2.1 Plaintext quit passwords are eliminated at rest in the database
    try {
      const dbExam = await classroomDb.getExam(sebExam.id);
      assert.strictEqual(dbExam?.sebQuitPassword, null, 'Plaintext sebQuitPassword must be null');
      assert(dbExam?.sebQuitPasswordHash, 'sebQuitPasswordHash must be populated');
      const expectedHash = hashQuitPassword(quitPass);
      assert.strictEqual(dbExam?.sebQuitPasswordHash, expectedHash, 'Hash must match SHA-256');
      assert.strictEqual(dbExam?.hasQuitPassword, true, 'hasQuitPassword flag must be true');
      recordPass('2.1 Database eliminates plaintext quit passwords; stores SHA-256 hash at rest');
    } catch (err: any) { recordFail('2.1 Database plaintext password elimination', err); }

    // 2.2 Plaintext quit password is NEVER returned in student-facing endpoints
    try {
      const res = await fetch(`${BASE_URL}/api/v1/classrooms/${roomA}/exams/${sebExam.id}`, {
        headers: { ...authStudent1 },
      });
      const data = await res.json();
      assert.strictEqual(data.exam.sebQuitPassword, undefined, 'Student exam must not have sebQuitPassword');
      assert.strictEqual(data.exam.sebQuitPasswordHash, undefined, 'Student exam must not have sebQuitPasswordHash');
      assert.strictEqual(data.exam.sebBrowserExamKey, undefined, 'Student exam must not have sebBrowserExamKey');
      assert.strictEqual(data.exam.sebConfigKey, undefined, 'Student exam must not have sebConfigKey');
      recordPass('2.2 Student-facing examination response strictly redacts all SEB secrets and keys');
    } catch (err: any) { recordFail('2.2 Student-facing response secret redaction', err); }

    // 2.3 Teacher list exams endpoint does NOT leak quit passwords
    try {
      const res = await fetch(`${BASE_URL}/api/v1/classrooms/${roomA}/exams`, {
        headers: { ...authTeacherA },
      });
      const data = await res.json();
      const listed = data.exams.find((e: any) => e.id === sebExam.id);
      assert(listed, 'Created exam must appear in teacher list');
      assert.strictEqual(listed.sebQuitPassword, undefined, 'Teacher list must not include plaintext password');
      assert.strictEqual(listed.hasQuitPassword, true, 'Teacher list provides hasQuitPassword boolean');
      recordPass('2.3 Teacher examination list endpoint provides hasQuitPassword boolean without leaking secrets');
    } catch (err: any) { recordFail('2.3 Teacher list secret protection', err); }

    // ===================================================================
    // SUITE 3: AUDIT C — CROSS-CLASSROOM & ROLE AUTHORIZATION
    // ===================================================================
    console.log('\n--- SUITE 3: AUDIT C — CROSS-CLASSROOM & ROLE AUTHORIZATION ---');

    // Add question to Exam A
    const qA = await classroomDb.createExamQuestion({
      examId: sebExam.id,
      questionType: 'mcq_single',
      promptText: 'What is the time complexity of binary search?',
      options: [
        { id: 'opt_1', text: 'O(log n)' },
        { id: 'opt_2', text: 'O(n)' },
      ],
      correctAnswer: { selectedOptionId: 'opt_1' },
      points: 5,
      sortOrder: 1,
    });

    // 3.1 Student blocked from creating examinations
    try {
      const res = await fetch(`${BASE_URL}/api/v1/classrooms/${roomA}/exams`, {
        method: 'POST',
        headers: { ...authStudent1, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Student Hacked Exam', durationMinutes: 60 }),
      });
      assert.strictEqual(res.status, 403, 'Student must receive 403 when creating exams');
      recordPass('3.1 Student is strictly blocked from creating examinations (403)');
    } catch (err: any) { recordFail('3.1 Student exam creation gate', err); }

    // 3.2 Teacher B cannot modify questions of Examination A
    try {
      const res = await fetch(`${BASE_URL}/api/v1/classrooms/${roomB}/exams/${sebExam.id}/questions/${qA.id}`, {
        method: 'PUT',
        headers: { ...authTeacherB, 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptText: 'Cross-classroom modified prompt' }),
      });
      assert(res.status === 404 || res.status === 403, `Must reject cross-classroom question modification (status: ${res.status})`);
      const unchangedQ = await classroomDb.getExamQuestion(qA.id);
      assert.strictEqual(unchangedQ?.promptText, 'What is the time complexity of binary search?');
      recordPass('3.2 Teacher in Classroom B cannot modify questions of an examination in Classroom A');
    } catch (err: any) { recordFail('3.2 Cross-classroom question modification prevention', err); }

    // 3.3 Teacher B cannot modify sections of Examination A
    try {
      const secA = await classroomDb.createExamSection({
        examId: sebExam.id,
        title: 'Core Algorithms',
        isMandatory: true,
        sortOrder: 1,
      });

      const res = await fetch(`${BASE_URL}/api/v1/classrooms/${roomB}/exams/${sebExam.id}/sections/${secA.id}`, {
        method: 'PUT',
        headers: { ...authTeacherB, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Hacked Section' }),
      });
      assert(res.status === 404 || res.status === 403, `Must reject cross-classroom section modification (status: ${res.status})`);
      recordPass('3.3 Teacher in Classroom B cannot modify sections of an examination in Classroom A');
    } catch (err: any) { recordFail('3.3 Cross-classroom section modification prevention', err); }

    // 3.4 Teacher B cannot modify branching rules of Examination A
    try {
      const ruleA = await classroomDb.createExamBranchingRule({
        examId: sebExam.id,
        sourceQuestionId: qA.id,
        conditionOperator: 'selected_option',
        conditionValue: 'opt_1',
        destinationType: 'end',
      });

      const res = await fetch(`${BASE_URL}/api/v1/classrooms/${roomB}/exams/${sebExam.id}/branching-rules/${ruleA.id}`, {
        method: 'PUT',
        headers: { ...authTeacherB, 'Content-Type': 'application/json' },
        body: JSON.stringify({ conditionValue: 'hacked' }),
      });
      assert(res.status === 404 || res.status === 403, `Must reject cross-classroom rule modification (status: ${res.status})`);
      recordPass('3.4 Teacher in Classroom B cannot modify branching rules of an examination in Classroom A');
    } catch (err: any) { recordFail('3.4 Cross-classroom branching rule modification prevention', err); }

    // 3.5 Student 2 in Classroom B cannot access questions of Examination A
    try {
      const res = await fetch(`${BASE_URL}/api/v1/classrooms/${roomA}/exams/${sebExam.id}/questions/${qA.id}`, {
        headers: { ...authStudent2 },
      });
      assert.strictEqual(res.status, 403, 'Cross-classroom student must receive 403');
      recordPass('3.5 Student from another classroom cannot access examination questions (403)');
    } catch (err: any) { recordFail('3.5 Cross-classroom student question access prevention', err); }

    // 3.6 Student cannot view live teacher dashboard
    try {
      const res = await fetch(`${BASE_URL}/api/v1/classrooms/${roomA}/exams/${sebExam.id}/dashboard`, {
        headers: { ...authStudent1 },
      });
      assert.strictEqual(res.status, 403, 'Student must receive 403 on live dashboard');
      recordPass('3.6 Student is strictly blocked from accessing live teacher dashboard (403)');
    } catch (err: any) { recordFail('3.6 Student dashboard access gate', err); }

    // ===================================================================
    // SUITE 4: AUDIT D — TIMING, STALE OVERWRITES & SUBMISSION INTEGRITY
    // ===================================================================
    console.log('\n--- SUITE 4: AUDIT D — TIMING & SUBMISSION INTEGRITY ---');

    const timingExam = await classroomDb.createExam({
      classroomId: roomA,
      title: 'Timing & Concurrency Integrity Exam',
      durationMinutes: 30,
      startTime: timestamp - 1000,
      endTime: timestamp + 3600000,
      totalMarks: 20,
      passingMarks: 10,
      attemptsAllowed: 2,
      securityLevel: 'standard',
      status: 'published',
      createdBy: teacherAId,
    });

    const qTiming = await classroomDb.createExamQuestion({
      examId: timingExam.id,
      questionType: 'mcq_single',
      promptText: 'Timing question?',
      options: [{ id: 'opt_1', text: 'Choice 1' }, { id: 'opt_2', text: 'Choice 2' }],
      correctAnswer: { selectedOptionId: 'opt_1' },
      points: 5,
      sortOrder: 1,
    });

    // Create active session for student 1
    const testSession = await classroomDb.createExamSession({
      examId: timingExam.id,
      userId: student1Id,
      attemptNumber: 1,
      status: 'in_progress',
      startedAt: timestamp,
      expiresAt: timestamp + 60000, // 1 minute from now
    });

    // 4.1 Valid response save within window succeeds
    try {
      const res = await fetch(`${BASE_URL}/api/v1/classrooms/${roomA}/exams/${timingExam.id}/sessions/${testSession.id}/responses`, {
        method: 'PUT',
        headers: { ...authStudent1, 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: qTiming.id, response: { selectedOptionId: 'opt_1' } }),
      });
      assert.strictEqual(res.status, 200, 'Valid response within time window must save');
      recordPass('4.1 Student answer autosave within duration window succeeds (200)');
    } catch (err: any) { recordFail('4.1 Valid answer autosave', err); }

    // 4.2 Stale response overwrite protection: older update cannot overwrite newer data
    try {
      // Save newer response at t=100
      await classroomDb.saveExamResponse({
        sessionId: testSession.id,
        questionId: qTiming.id,
        response: { selectedOptionId: 'opt_1', note: 'Newer Answer' },
        updatedAt: timestamp + 5000,
      });

      // Try to save older response at t=10
      await classroomDb.saveExamResponse({
        sessionId: testSession.id,
        questionId: qTiming.id,
        response: { selectedOptionId: 'opt_2', note: 'Stale Delayed Packet' },
        updatedAt: timestamp + 1000,
      });

      const currentResp = (await classroomDb.listExamResponses(testSession.id)).find((r) => r.questionId === qTiming.id);
      assert.strictEqual(currentResp?.response?.selectedOptionId, 'opt_1', 'Newer answer must be preserved');
      recordPass('4.2 Concurrency protection: Stale delayed packet cannot overwrite newer answer');
    } catch (err: any) { recordFail('4.2 Stale response overwrite prevention', err); }

    // 4.3 Answering past expiresAt is rejected
    try {
      // Expire session
      await classroomDb.updateExamSession(testSession.id, { expiresAt: timestamp - 10000 });

      const res = await fetch(`${BASE_URL}/api/v1/classrooms/${roomA}/exams/${timingExam.id}/sessions/${testSession.id}/responses`, {
        method: 'PUT',
        headers: { ...authStudent1, 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: qTiming.id, response: { selectedOptionId: 'opt_1' } }),
      });
      assert.strictEqual(res.status, 403, 'Saving responses past expiresAt must return 403');
      recordPass('4.3 Answering past examination expiration timestamp is strictly rejected (403)');
    } catch (err: any) { recordFail('4.3 Response rejection post-expiration', err); }

    // 4.4 Late submission post-grace period cannot write new answers
    try {
      // Reset session to 1 hour expired
      await classroomDb.updateExamSession(testSession.id, {
        status: 'in_progress',
        expiresAt: timestamp - 3600000, // 1 hour ago
      });

      const res = await fetch(`${BASE_URL}/api/v1/classrooms/${roomA}/exams/${timingExam.id}/sessions/${testSession.id}/submit`, {
        method: 'POST',
        headers: { ...authStudent1, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finalResponses: {
            [qTiming.id]: { selectedOptionId: 'opt_2', forgedLate: true },
          },
        }),
      });

      // Check that response was not overwritten by late submit
      const postSubmitResp = (await classroomDb.listExamResponses(testSession.id)).find((r) => r.questionId === qTiming.id);
      assert.notStrictEqual(postSubmitResp?.response?.forgedLate, true, 'Late responses must NOT be written');
      const finalSession = await classroomDb.getExamSession(testSession.id);
      assert.strictEqual(finalSession?.status, 'timed_out', 'Session submitted late must be marked timed_out');
      recordPass('4.4 Late submit past grace period is recorded as timed_out and rejects new answers');
    } catch (err: any) { recordFail('4.4 Late submit protection', err); }

    // ===================================================================
    // SUITE 5: AUDIT E — PROGRAMMING QUESTIONS & GRADING HONESTY
    // ===================================================================
    console.log('\n--- SUITE 5: AUDIT E — PROGRAMMING QUESTIONS & GRADING HONESTY ---');

    const progQ = await classroomDb.createExamQuestion({
      examId: sebExam.id,
      questionType: 'programming',
      promptText: 'Write a function add(a, b) that returns the sum.',
      initialCode: 'def add(a, b):\n    pass',
      language: 'python',
      testCases: [
        { id: 'tc_sample', input: '1 2', expectedOutput: '3', isHidden: false, points: 2 },
        { id: 'tc_hidden1', input: '100 200', expectedOutput: '300', isHidden: true, points: 4 },
        { id: 'tc_hidden2', input: '-5 5', expectedOutput: '0', isHidden: true, points: 4 },
      ],
      points: 10,
      sortOrder: 2,
    });

    // 5.1 Hidden test cases are completely redacted for students
    try {
      const sanitizedProgQ = sanitizeQuestionForStudent(progQ);
      const hiddenCases = sanitizedProgQ.testCases?.filter((tc) => tc.isHidden) || [];
      assert.strictEqual(hiddenCases.length, 2, 'Must retain hidden case count placeholder');
      for (const hc of hiddenCases) {
        assert.strictEqual(hc.input, '[HIDDEN TEST CASE]', 'Input must be redacted');
        assert.strictEqual(hc.expectedOutput, '[HIDDEN TEST CASE]', 'Expected output must be redacted');
      }
      recordPass('5.1 Hidden test case inputs and expected outputs are strictly redacted for students');
    } catch (err: any) { recordFail('5.1 Hidden test case redaction', err); }

    // 5.2 Client-forged earnedPoints in programming response is ignored
    try {
      const forgedStudentPayload = {
        code: 'def add(a, b): return 0',
        earnedPoints: 10,
        gradingStatus: 'auto_graded',
        passedTests: 3,
        totalTests: 3,
      };

      const gradeRes = gradeQuestionResponse(progQ, forgedStudentPayload);
      assert.strictEqual(gradeRes.earnedPoints, 0, 'Forged earnedPoints must be completely ignored');
      assert.strictEqual(gradeRes.status, 'pending', 'Status must remain pending teacher or server execution');
      recordPass('5.2 Client-forged score fields (earnedPoints: 10) in programming questions are strictly ignored');
    } catch (err: any) { recordFail('5.2 Programming score forgery prevention', err); }

    // 5.3 Authoritative server test execution awards points proportionally
    try {
      const trustedExec = { passedTests: 2, totalTests: 3 };
      const gradeRes = gradeQuestionResponse(progQ, { code: 'def add(a, b): return a + b' }, { trustedExecution: trustedExec });
      // 2/3 * 10 = 6.67
      assert.strictEqual(gradeRes.earnedPoints, 6.67, 'Score must reflect authoritative trusted execution');
      assert.strictEqual(gradeRes.status, 'auto_graded', 'Status is auto_graded with trusted execution');
      recordPass('5.3 Authoritative server execution result awards proportional marks accurately (6.67/10)');
    } catch (err: any) { recordFail('5.3 Authoritative programming score calculation', err); }

    // ===================================================================
    // SUITE 6: AUDIT F — QUESTION BANK OWNERSHIP & IMMUTABILITY
    // ===================================================================
    console.log('\n--- SUITE 6: AUDIT F — QUESTION BANK OWNERSHIP & IMMUTABILITY ---');

    // Teacher A creates Bank Item
    const bankItemA = await classroomDb.createQuestionBankItem({
      teacherId: teacherAId,
      subject: 'Algorithms',
      topic: 'Sorting',
      difficulty: 'hard',
      questionType: 'mcq_single',
      promptText: 'Original Bank Question: QuickSort Worst Case',
      options: [{ id: 'opt_n2', text: 'O(n^2)' }, { id: 'opt_nlogn', text: 'O(n log n)' }],
      correctAnswer: { selectedOptionId: 'opt_n2' },
      defaultPoints: 5,
    });

    // 6.1 Teacher B cannot import Teacher A's private bank question
    try {
      const res = await fetch(`${BASE_URL}/api/v1/classrooms/${roomB}/exams/${sebExam.id}/questions/import-from-bank`, {
        method: 'POST',
        headers: { ...authTeacherB, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankQuestionId: bankItemA.id }),
      });
      assert(res.status === 403 || res.status === 404, `Teacher B must be denied importing Teacher A question (status: ${res.status})`);
      recordPass('6.1 Teacher is strictly blocked from importing a private question bank item owned by another teacher');
    } catch (err: any) { recordFail('6.1 Question bank cross-teacher import prevention', err); }

    // 6.2 Teacher A imports to Exam A and mutates bank item: Exam question remains immutable
    try {
      const importedExamQ = await classroomDb.importQuestionBankItemToExam({
        bankQuestionId: bankItemA.id,
        examId: sebExam.id,
        teacherId: teacherAId,
      });

      // Teacher A updates original bank question
      await classroomDb.updateQuestionBankItem(bankItemA.id, {
        promptText: 'Mutated Bank Question: QuickSort Modified',
      });

      // Teacher A archives original bank question
      await classroomDb.deleteQuestionBankItem(bankItemA.id, false);

      // Verify exam question snapshot in exam_questions remains original
      const fetchedExamQ = await classroomDb.getExamQuestion(importedExamQ.id);
      assert.strictEqual(fetchedExamQ?.promptText, 'Original Bank Question: QuickSort Worst Case', 'Exam question must remain immutable');
      recordPass('6.2 Immutability verified: Mutating and archiving original bank question does NOT alter exam question snapshot');
    } catch (err: any) { recordFail('6.2 Question bank snapshot immutability', err); }

    // ===================================================================
    // SUITE 7: AUDIT G — CONDITIONAL BRANCHING & CYCLE VALIDATION
    // ===================================================================
    console.log('\n--- SUITE 7: AUDIT G — CONDITIONAL BRANCHING & ROUTE EVALUATION ---');

    // 7.1 Operator allowlist enforcement
    try {
      const res = await fetch(`${BASE_URL}/api/v1/classrooms/${roomA}/exams/${sebExam.id}/branching-rules`, {
        method: 'POST',
        headers: { ...authTeacherA, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceQuestionId: qA.id,
          conditionOperator: 'eval_code_injection',
          conditionValue: 'process.exit(1)',
          destinationType: 'end',
        }),
      });
      assert.strictEqual(res.status, 400, 'Invalid condition operator must return 400');
      recordPass('7.1 Arbitrary/malformed branching condition operators are strictly rejected (400)');
    } catch (err: any) { recordFail('7.1 Branching operator allowlist', err); }

    // 7.2 Cycle detection
    try {
      const sec1 = await classroomDb.createExamSection({ examId: sebExam.id, title: 'Section Alpha', isMandatory: true, sortOrder: 1 });
      const sec2 = await classroomDb.createExamSection({ examId: sebExam.id, title: 'Section Beta', isMandatory: false, sortOrder: 2 });

      const q1 = await classroomDb.createExamQuestion({ examId: sebExam.id, sectionId: sec1.id, questionType: 'mcq_single', promptText: 'Q1', sortOrder: 1 });
      const q2 = await classroomDb.createExamQuestion({ examId: sebExam.id, sectionId: sec2.id, questionType: 'mcq_single', promptText: 'Q2', sortOrder: 2 });

      // Create cycle: q1 -> sec2; q2 -> sec1
      await classroomDb.createExamBranchingRule({ examId: sebExam.id, sourceQuestionId: q1.id, conditionOperator: 'equals', conditionValue: 'jump', destinationType: 'section', destinationId: sec2.id });
      await classroomDb.createExamBranchingRule({ examId: sebExam.id, sourceQuestionId: q2.id, conditionOperator: 'equals', conditionValue: 'loop', destinationType: 'section', destinationId: sec1.id });

      const validation = await classroomDb.validateBranchingRules(sebExam.id);
      assert.strictEqual(validation.valid, false, 'Cycle validator must flag cyclic transition');
      recordPass('7.2 Directed DFS cycle validator correctly identifies and flags circular branching transitions');
    } catch (err: any) { recordFail('7.2 Cycle detection validation', err); }

    // Cleanup test classrooms
    await classroomDb.deleteExam(sebExam.id);

  } catch (globalErr: any) {
    console.error('Fatal test error:', globalErr);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`PHASE 3.1 SECURITY AUDIT TEST SUMMARY:`);
  console.log(`TOTAL ASSERTIONS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityAuditTests().catch((err) => {
  console.error('Unhandled security test exception:', err);
  process.exit(1);
});
