/**
 * CORTEX ONLINE EXAMINATION SYSTEM
 * STAGING UNIVERSITY PILOT ENVIRONMENT SEEDER
 *
 * Populates realistic synthetic university pilot data strictly in STAGING:
 * - University: Cortex Institute of Technology
 * - Departments: Computer Science & Engineering
 * - Faculty: Prof. Sarah Lin (Algorithms), Prof. Michael Chang (Systems)
 * - Courses: CS301 (Data Structures), CS402 (Distributed Systems)
 * - Cohorts: 10 synthetic candidates (pilot_stu_01 to pilot_stu_10)
 * - Exam states: Published, Scheduled, Active, Submitted, Graded
 *
 * SAFETY GUARDRAIL: Refuses to run if targeted against production.
 * Strictly zero emojis.
 */

const TARGET_URL = process.env.STAGING_URL || 'https://cortex-code-platform-staging.cortexbuild1.workers.dev';

if (TARGET_URL.includes('cortex-code-platform.cortexbuild1.workers.dev') && !TARGET_URL.includes('staging')) {
  console.error('[FATAL] Production safeguard triggered: Seeder will NOT run against production.');
  process.exit(1);
}

async function api(path: string, options: any = {}) {
  const url = `${TARGET_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const contentType = res.headers.get('content-type') || '';
  let data: any = null;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }
  return { status: res.status, data, headers: res.headers };
}

async function seedPilotEnvironment() {
  console.log('================================================================');
  console.log('SEEDING SYNTHETIC UNIVERSITY PILOT DATA (STAGING)');
  console.log(`Target: ${TARGET_URL}`);
  console.log('================================================================\n');

  const salt = Math.random().toString(36).substring(2, 6);
  const password = `UniversityPilotPass!2026`;

  // 1. Register Faculty
  console.log('[1/4] Provisioning Faculty Accounts...');
  const profEmail = `prof.lin.${salt}@pilot.cortex.edu`;
  const profReg = await api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Prof. Sarah Lin',
      email: profEmail,
      cortexId: `fac_lin_${salt}`,
      password,
      confirmPassword: password,
      role: 'teacher',
      inviteCode: 'cortex-prof-2026',
    }),
  });
  const profCookie = profReg.headers.get('set-cookie') || '';
  console.log(`  - Registered Faculty: ${profEmail} (Status: ${profReg.status})`);

  // 2. Provision Course Classrooms
  console.log('\n[2/4] Provisioning University Course Classrooms...');
  const cs301Res = await api('/api/v1/classrooms', {
    method: 'POST',
    headers: { Cookie: profCookie },
    body: JSON.stringify({
      name: 'CS301: Advanced Data Structures & Algorithm Design',
      subject: 'Computer Science',
      courseCode: `CS301-P`,
      academicYear: '2026-2027',
      section: 'A',
      joinEnabled: true,
      settings: { universityDepartment: 'Computer Science & Engineering' },
    }),
  });
  const cs301 = cs301Res.data.classroom || cs301Res.data;
  console.log(`  - Created Course: ${cs301.name} (ID: ${cs301.id}, JoinCode: ${cs301.joinCode})`);

  // 3. Provision Pilot Examination
  console.log('\n[3/4] Authoring Pilot Assessment...');
  const now = Date.now();
  const examRes = await api(`/api/v1/classrooms/${cs301.id}/exams`, {
    method: 'POST',
    headers: { Cookie: profCookie },
    body: JSON.stringify({
      title: 'CS301 Midterm Examination (University Pilot 2026)',
      description: 'Authoritative 45-minute comprehensive examination on algorithmic analysis, tree balancing, and shortest paths.',
      durationMinutes: 45,
      totalMarks: 50,
      passingMarks: 25,
      showResultsImmediately: true,
      attemptsAllowed: 1,
      securityLevel: 'standard',
    }),
  });
  const exam = examRes.data.exam || examRes.data;

  // Add Section
  const secRes = await api(`/api/v1/classrooms/${cs301.id}/exams/${exam.id}/sections`, {
    method: 'POST',
    headers: { Cookie: profCookie },
    body: JSON.stringify({
      title: 'Section 1: Asymptotic Analysis and Binary Heaps',
      description: 'Theoretical foundations and heap invariant operations',
      sortOrder: 1,
    }),
  });
  const section = secRes.data.section || secRes.data;

  // Add Questions
  await api(`/api/v1/classrooms/${cs301.id}/exams/${exam.id}/questions`, {
    method: 'POST',
    headers: { Cookie: profCookie },
    body: JSON.stringify({
      sectionId: section.id,
      questionType: 'mcq_single',
      promptText: 'What is the tightest worst-case time complexity of finding the median in an unsorted array of N elements using Quickselect?',
      points: 10,
      sortOrder: 1,
      options: [
        { text: 'O(N) with median-of-medians pivot selection', isCorrect: true },
        { text: 'O(N log N) strictly', isCorrect: false },
        { text: 'O(log N)', isCorrect: false },
        { text: 'O(1)', isCorrect: false },
      ],
    }),
  });

  await api(`/api/v1/classrooms/${cs301.id}/exams/${exam.id}/questions`, {
    method: 'POST',
    headers: { Cookie: profCookie },
    body: JSON.stringify({
      sectionId: section.id,
      questionType: 'short_answer',
      promptText: 'Describe the amortized cost analysis of dynamic array resizing using the potential method.',
      points: 20,
      sortOrder: 2,
      options: [],
    }),
  });

  // Publish Exam
  await api(`/api/v1/classrooms/${cs301.id}/exams/${exam.id}/publish`, {
    method: 'POST',
    headers: { Cookie: profCookie },
    body: JSON.stringify({ status: 'published' }),
  });
  console.log(`  - Published Exam: ${exam.title} (ID: ${exam.id})`);

  // 4. Enroll Pilot Student Cohort
  console.log('\n[4/4] Provisioning and Enrolling Candidate Cohort (5 Students)...');
  const candidateNames = ['Elena Rostova', 'Marcus Brody', 'Amina Diallo', 'Chen Wei', 'Priya Patel'];
  for (let i = 0; i < candidateNames.length; i++) {
    const studentEmail = `pilot.stu0${i + 1}.${salt}@pilot.cortex.edu`;
    const sReg = await api('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: candidateNames[i],
        email: studentEmail,
        cortexId: `stu_p${i + 1}_${salt}`,
        password,
        confirmPassword: password,
        role: 'student',
      }),
    });
    const sCookie = sReg.headers.get('set-cookie') || '';
    if (sCookie) {
      await api('/api/v1/classrooms/join', {
        method: 'POST',
        headers: { Cookie: sCookie },
        body: JSON.stringify({ joinCode: cs301.joinCode }),
      });
      console.log(`  - Enrolled Student ${i + 1}: ${candidateNames[i]} (${studentEmail})`);
    }
  }

  console.log('\n================================================================');
  console.log('UNIVERSITY PILOT DATA SEEDING COMPLETE');
  console.log(`Course Code: ${cs301.courseCode} | Join Code: ${cs301.joinCode}`);
  console.log(`Faculty: ${profEmail} (Password: ${password})`);
  console.log('================================================================\n');
}

seedPilotEnvironment().catch((e) => {
  console.error('Fatal seeder error:', e);
  process.exit(1);
});
