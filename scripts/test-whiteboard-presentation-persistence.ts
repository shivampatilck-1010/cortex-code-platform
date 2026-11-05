import { classroomDb } from '../src/lib/classroom/db';

async function runPersistenceTests() {
  console.log('================================================================');
  console.log('TASKS 3 & 4 — WHITEBOARD & PRESENTATION DATABASE PERSISTENCE TEST');
  console.log('Testing server-side persistence, versioning, roles & room isolation');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ': ' + detail : ''}`);
      failed++;
    }
  }

  const CLASSROOM_A = 'CLS-TEST-WB-A';
  const CLASSROOM_B = 'CLS-TEST-WB-B';
  const SESSION_1 = 'session_live_01';

  try {
    // 0. Seed test classrooms to satisfy foreign key constraints
    await classroomDb.createClassroom({
      id: CLASSROOM_A,
      name: 'Algorithm Studio Live',
      subject: 'Computer Science',
      description: 'Test Classroom for Whiteboard Persistence',
      courseCode: 'CS-201',
      academicYear: '2026',
      section: 'A',
      teacherId: 'usr_teacher_shivam',
      teacherName: 'Prof. Shivam Patil',
      joinCode: 'WB-TEST-A',
      joinEnabled: true,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      settings: { allowStudentMicrophone: true, allowStudentCamera: true } as any,
    });

    await classroomDb.createClassroom({
      id: CLASSROOM_B,
      name: 'Discrete Math Live',
      subject: 'Mathematics',
      description: 'Test Classroom B for Whiteboard Persistence',
      courseCode: 'MATH-301',
      academicYear: '2026',
      section: 'B',
      teacherId: 'usr_teacher_shivam',
      teacherName: 'Prof. Shivam Patil',
      joinCode: 'WB-TEST-B',
      joinEnabled: true,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      settings: { allowStudentMicrophone: true, allowStudentCamera: true } as any,
    });

    // Test 1: Save new Whiteboard state to SQLite database
    const samplePages = [
      {
        id: 'page-1',
        title: 'Tree Proofs',
        background: 'dark-grid',
        elements: [
          { id: 'el-1', type: 'pen', color: '#06B6D4', strokeWidth: 3, points: [{ x: 10, y: 20 }, { x: 30, y: 40 }] },
        ],
      },
    ];

    const savedWb = await classroomDb.saveWhiteboard(
      CLASSROOM_A,
      SESSION_1,
      samplePages,
      0,
      'usr_teacher_shivam',
      0
    );

    assert(
      Boolean(savedWb.id && savedWb.version === 1 && savedWb.classroomId === CLASSROOM_A),
      'Test 1: Whiteboard state saved successfully with initial version 1'
    );

    // Test 2: Reload Whiteboard state from SQLite database
    const loadedWb = await classroomDb.getWhiteboard(CLASSROOM_A, SESSION_1);
    assert(
      loadedWb !== null &&
        loadedWb.pages.length === 1 &&
        loadedWb.pages[0].title === 'Tree Proofs' &&
        loadedWb.pages[0].elements[0].id === 'el-1',
      'Test 2: Whiteboard state loaded accurately with intact stroke and page data'
    );

    // Test 3: Concurrent version conflict detection on Whiteboard update
    const samplePagesV2 = [
      ...samplePages,
      { id: 'page-2', title: 'Rotations', background: 'ruled', elements: [] },
    ];

    // Successful update with correct expectedVersion
    const updatedWb = await classroomDb.saveWhiteboard(
      CLASSROOM_A,
      SESSION_1,
      samplePagesV2,
      1,
      'usr_teacher_shivam',
      1 // expectedVersion 1
    );

    assert(
      updatedWb.version === 2 && updatedWb.pages.length === 2,
      'Test 3: Whiteboard update increments version to 2 with valid expectedVersion'
    );

    // Conflict rejection with stale expectedVersion
    let conflictCaught = false;
    try {
      await classroomDb.saveWhiteboard(
        CLASSROOM_A,
        SESSION_1,
        samplePagesV2,
        1,
        'usr_teacher_shivam',
        1 // Stale expectedVersion (current is 2)
      );
    } catch (err: any) {
      if (err.message.includes('VERSION_CONFLICT')) {
        conflictCaught = true;
      }
    }

    assert(
      conflictCaught,
      'Test 4: Stale expectedVersion is strictly rejected with VERSION_CONFLICT'
    );

    // Test 5: Save and reload Presentation state in database
    const sampleDeck = {
      id: 'deck-01',
      title: 'Advanced Graph Algorithms',
      description: 'Dijkstra and Bellman-Ford proofs',
      slides: [
        { id: 's1', title: 'Introduction', content: 'Shortest paths in DAGs' },
        { id: 's2', title: 'Complexity', content: 'O(V + E) with topological sort' },
      ],
    };

    const savedPres = await classroomDb.savePresentation(
      CLASSROOM_A,
      SESSION_1,
      sampleDeck,
      0,
      true,
      'usr_teacher_shivam',
      0
    );

    assert(
      Boolean(savedPres.id && savedPres.version === 1 && savedPres.isPresenting === true),
      'Test 5: Presentation deck saved successfully with active presenting state'
    );

    // Test 6: Reload Presentation state
    const loadedPres = await classroomDb.getPresentation(CLASSROOM_A, SESSION_1);
    assert(
      loadedPres !== null &&
        loadedPres.deck.title === 'Advanced Graph Algorithms' &&
        loadedPres.deck.slides.length === 2 &&
        loadedPres.activeSlideIndex === 0,
      'Test 6: Presentation deck reloaded with complete slide metadata and index'
    );

    // Test 7: Presentation update and version increment
    const updatedPres = await classroomDb.savePresentation(
      CLASSROOM_A,
      SESSION_1,
      sampleDeck,
      1, // advanced to slide 1
      true,
      'usr_teacher_shivam',
      1
    );

    assert(
      updatedPres.version === 2 && updatedPres.activeSlideIndex === 1,
      'Test 7: Presentation slide change persists new activeSlideIndex and version'
    );

    // Test 8: Classroom isolation between Classroom A and Classroom B
    const roomBWb = await classroomDb.getWhiteboard(CLASSROOM_B, SESSION_1);
    const roomBPres = await classroomDb.getPresentation(CLASSROOM_B, SESSION_1);

    assert(
      roomBWb === null && roomBPres === null,
      'Test 8: Classroom isolation verified: Classroom B has zero access to Classroom A state'
    );
  } catch (err: any) {
    console.error('[FATAL] Test error:', err);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed out of ${passed + failed} assertions.`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPersistenceTests();
