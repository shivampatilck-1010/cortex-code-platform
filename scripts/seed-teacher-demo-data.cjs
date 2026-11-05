const fs = require('fs');
const path = require('path');

const teacherId = 'usr_mvlyg1pd44g4k';
const teacherName = 'shivam';
const teacherEmail = 'shivampatilcka@gmail.com';

const now = Date.now();
const oneDay = 24 * 3600 * 1000;
const oneHour = 3600 * 1000;

function escapeSQL(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val.toString();
  if (typeof val === 'boolean') return val ? '1' : '0';
  return `'${val.toString().replace(/'/g, "''")}'`;
}

const students = [
  {
    id: 'usr_demo_alex',
    name: 'Alex Chen',
    email: 'alex.chen@student.cortex.edu',
    cortexId: 'alexchen',
    isOnline: 1,
    joinedAt: now - 5 * oneDay,
    lastActiveAt: now - 3 * 60 * 1000,
  },
  {
    id: 'usr_demo_sophia',
    name: 'Sophia Patel',
    email: 'sophia.patel@student.cortex.edu',
    cortexId: 'sophiap',
    isOnline: 1,
    joinedAt: now - 4 * oneDay,
    lastActiveAt: now - 10 * 60 * 1000,
  },
  {
    id: 'usr_demo_marcus',
    name: 'Marcus Vance',
    email: 'marcus.vance@student.cortex.edu',
    cortexId: 'mvance',
    isOnline: 0,
    joinedAt: now - 3 * oneDay,
    lastActiveAt: now - 2 * oneHour,
  },
  {
    id: 'usr_demo_elena',
    name: 'Elena Rostova',
    email: 'elena.rostova@student.cortex.edu',
    cortexId: 'erostova',
    isOnline: 1,
    joinedAt: now - 3 * oneDay,
    lastActiveAt: now - 15 * 60 * 1000,
  },
  {
    id: 'usr_demo_liam',
    name: 'Liam Wright',
    email: 'liam.wright@student.cortex.edu',
    cortexId: 'lwright',
    isOnline: 0,
    joinedAt: now - 2 * oneDay,
    lastActiveAt: now - 4 * oneHour,
  },
  {
    id: 'usr_mvly9ov4snurx',
    name: 'Aniket Agarwal',
    email: 'aniket.agr2007@gmail.com',
    cortexId: 'ANIKET2026',
    isOnline: 1,
    joinedAt: now - 1 * oneDay,
    lastActiveAt: now - 5 * 60 * 1000,
  },
];

const statements = [];

// 1. Ensure students & teacher exist with correct roles in users table
statements.push(`
  INSERT OR REPLACE INTO users (id, name, email, cortex_id, role, status, created_at, updated_at)
  VALUES (${escapeSQL(teacherId)}, ${escapeSQL(teacherName)}, ${escapeSQL(teacherEmail)}, 'SHIVAM_PROF', 'teacher', 'active', ${now - 10 * oneDay}, ${now});
`);

for (const s of students) {
  statements.push(`
    INSERT OR REPLACE INTO users (id, name, email, cortex_id, role, status, created_at, updated_at)
    VALUES (${escapeSQL(s.id)}, ${escapeSQL(s.name)}, ${escapeSQL(s.email)}, ${escapeSQL(s.cortexId)}, 'student', 'active', ${s.joinedAt}, ${now});
  `);
}

// Classroom definitions
const classrooms = [
  {
    id: 'CLS_DEMO_DSA_2026',
    name: 'CS 201: Data Structures and Algorithms',
    courseCode: 'CS-201',
    joinCode: 'CORTEX26',
    subject: 'Computer Science',
    description: 'Comprehensive algorithmic laboratory covering linear structures, binary search trees, graph algorithms, and competitive programming with real-time automated evaluation.',
    academicYear: '2026-2027',
    section: 'Sec 01',
    createdAt: now - 7 * oneDay,
  },
  {
    id: 'CLS_1792819623330_ZF01',
    name: 'CS 276: Systems Programming & Concurrency (cse276)',
    courseCode: 'CS-276',
    joinCode: '39TX43',
    subject: 'Computer Science',
    description: 'Advanced systems programming in C++ and Python. Explores lock-free concurrency, asynchronous I/O, consistent hashing, and distributed consensus algorithms.',
    academicYear: '2026-2027',
    section: 'Sec 02',
    createdAt: now - 1 * oneDay,
  },
];

const classroomSettings = JSON.stringify({
  allowStudentPosting: true,
  allowStudentMessaging: true,
  allowCodeSharing: true,
  leaderboardEnabled: true,
  defaultAIPolicy: 'hints_only',
});

// Seed Classrooms and Members
for (const cls of classrooms) {
  statements.push(`
    INSERT OR REPLACE INTO classrooms (
      id, name, subject, description, course_code, academic_year, section,
      teacher_id, teacher_name, join_code, join_enabled, status, created_at, updated_at, settings_json
    ) VALUES (
      ${escapeSQL(cls.id)},
      ${escapeSQL(cls.name)},
      ${escapeSQL(cls.subject)},
      ${escapeSQL(cls.description)},
      ${escapeSQL(cls.courseCode)},
      ${escapeSQL(cls.academicYear)},
      ${escapeSQL(cls.section)},
      ${escapeSQL(teacherId)},
      ${escapeSQL(teacherName)},
      ${escapeSQL(cls.joinCode)},
      1,
      'active',
      ${cls.createdAt},
      ${now},
      ${escapeSQL(classroomSettings)}
    );
  `);

  // Teacher Membership
  statements.push(`
    INSERT OR REPLACE INTO classroom_members (
      id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online
    ) VALUES (
      ${escapeSQL(`mem_${cls.id}_${teacherId}`)},
      ${escapeSQL(cls.id)},
      ${escapeSQL(teacherId)},
      ${escapeSQL(teacherName)},
      ${escapeSQL(teacherEmail)},
      'teacher',
      'active',
      ${cls.createdAt},
      ${now},
      1
    );
  `);

  // Student Memberships
  for (const s of students) {
    statements.push(`
      INSERT OR REPLACE INTO classroom_members (
        id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online
      ) VALUES (
        ${escapeSQL(`mem_${cls.id}_${s.id}`)},
        ${escapeSQL(cls.id)},
        ${escapeSQL(s.id)},
        ${escapeSQL(s.name)},
        ${escapeSQL(s.email)},
        'student',
        'active',
        ${s.joinedAt},
        ${s.lastActiveAt},
        ${s.isOnline}
      );
    `);
  }
}

// Announcements for CLS_DEMO_DSA_2026
const announcementsDSA = [
  {
    id: 'ann_dsa_welcome',
    title: 'Welcome to CS 201: Algorithmic Systems & Data Structures',
    content: 'Welcome everyone to the demo classroom. In this course, we examine algorithmic efficiency, time and space complexity, and advanced data structures using the Cortex collaborative execution environment.\n\nPlease inspect the assignments tab for open labs and review the reference guides in Resources.',
    pinned: 1,
    createdAt: now - 3 * oneDay,
  },
  {
    id: 'ann_dsa_lab1',
    title: 'Lab Assignment 1: Two Sum Hash Map Optimization Published',
    content: 'The first coding assignment is open. Implement twoSum with O(n) linear time complexity.\n\nMake sure your solution handles negative numbers, duplicate elements, and large inputs. Both public and hidden test cases are executed automatically.',
    pinned: 0,
    createdAt: now - 2 * oneDay,
  },
  {
    id: 'ann_dsa_bst',
    title: 'Lab Assignment 2: Binary Search Tree Validation in C++',
    content: 'The C++ BST verification lab is published. Implement isValidBST verifying recursive lower and upper bounds.\n\nReview starter code and test suite in the assignment solver.',
    pinned: 0,
    createdAt: now - 1 * oneDay,
  },
];

for (const ann of announcementsDSA) {
  statements.push(`
    INSERT OR REPLACE INTO announcements (
      id, classroom_id, author_id, author_name, author_role, title, content, pinned, created_at, updated_at
    ) VALUES (
      ${escapeSQL(ann.id)},
      'CLS_DEMO_DSA_2026',
      ${escapeSQL(teacherId)},
      ${escapeSQL(teacherName)},
      'teacher',
      ${escapeSQL(ann.title)},
      ${escapeSQL(ann.content)},
      ${ann.pinned},
      ${ann.createdAt},
      ${ann.createdAt}
    );
  `);
}

// Announcements for CLS_1792819623330_ZF01 (CS 276)
const announcementsCSE276 = [
  {
    id: 'ann_cse_welcome',
    title: 'Welcome to CS 276: Systems Programming & Concurrency',
    content: 'Welcome to CS 276! In this course, we delve deep into operating system fundamentals, concurrent synchronization primitives, lock-free queues, and distributed consensus.\n\nCheck the assignments tab for our first concurrency lab.',
    pinned: 1,
    createdAt: now - 1 * oneDay,
  },
  {
    id: 'ann_cse_lab1',
    title: 'Lab 1: Bounded Concurrent Queue with Thread Safety Published',
    content: 'Lab 1 is now open for submissions. Implement a thread-safe circular buffer queue with condition variable synchronization in Python.\n\nAutomated multi-thread stress tests will evaluate your implementation against race conditions.',
    pinned: 0,
    createdAt: now - 12 * oneHour,
  },
];

for (const ann of announcementsCSE276) {
  statements.push(`
    INSERT OR REPLACE INTO announcements (
      id, classroom_id, author_id, author_name, author_role, title, content, pinned, created_at, updated_at
    ) VALUES (
      ${escapeSQL(ann.id)},
      'CLS_1792819623330_ZF01',
      ${escapeSQL(teacherId)},
      ${escapeSQL(teacherName)},
      'teacher',
      ${escapeSQL(ann.title)},
      ${escapeSQL(ann.content)},
      ${ann.pinned},
      ${ann.createdAt},
      ${ann.createdAt}
    );
  `);
}

// Assignments for CLS_1792819623330_ZF01 (CS 276)
const assignmentsCSE276 = [
  {
    id: 'asg_cse_queue',
    title: 'Lab 1: Thread-Safe Bounded Concurrent Queue',
    description: 'Implement a thread-safe bounded FIFO queue using mutex locks and condition variables in Python. Your class ConcurrentQueue must support push(item, timeout), pop(timeout), and size() operations without deadlocks.',
    instructions: '1. Use threading.Lock and threading.Condition to guard push and pop operations.\n2. When full, push must block up to timeout seconds.\n3. When empty, pop must block up to timeout seconds.\n4. Avoid busy-waiting.',
    difficulty: 'medium',
    language: 'python',
    maxMarks: 100,
    dueAt: now + 5 * oneDay,
    starterCode: `import threading
import time

class ConcurrentQueue:
    def __init__(self, capacity: int = 10):
        self.capacity = capacity
        self.queue = []
        self.lock = threading.Lock()
        self.not_full = threading.Condition(self.lock)
        self.not_empty = threading.Condition(self.lock)

    def push(self, item, timeout: float = 1.0) -> bool:
        # TODO: Implement thread-safe bounded push
        with self.not_full:
            self.queue.append(item)
            self.not_empty.notify()
            return True

    def pop(self, timeout: float = 1.0):
        # TODO: Implement thread-safe bounded pop
        with self.not_empty:
            if not self.queue:
                return None
            return self.queue.pop(0)

    def size(self) -> int:
        with self.lock:
            return len(self.queue)

# Test harness
if __name__ == "__main__":
    q = ConcurrentQueue(3)
    q.push("task_1")
    q.push("task_2")
    print(f"Size: {q.size()}")
    print(f"Popped: {q.pop()}")
    print(f"Size: {q.size()}")
`,
    testCases: JSON.stringify([
      { input: "push(A), push(B), pop(), size()", expectedOutput: "Size: 2\nPopped: task_1\nSize: 1", isHidden: false, points: 50 },
      { input: "concurrent_producers_consumers(100_items)", expectedOutput: "All 100 items processed cleanly", isHidden: true, points: 50 },
    ]),
  },
  {
    id: 'asg_cse_hashring',
    title: 'Lab 2: Consistent Hashing Ring with Virtual Nodes',
    description: 'Implement a distributed Consistent Hash Ring supporting add_node, remove_node, and get_node for key lookups. Distribute keys uniformly across replica virtual nodes using MD5/SHA-256.',
    instructions: '1. Implement MD5 hashing mapped onto a 32-bit integer ring.\n2. Use bisect for O(log N) key lookups.\n3. Support virtual node replicas per physical node.\n4. Verify uniform partition balance.',
    difficulty: 'hard',
    language: 'python',
    maxMarks: 100,
    dueAt: now + 12 * oneDay,
    starterCode: `import hashlib
import bisect

class ConsistentHashRing:
    def __init__(self, replicas: int = 3):
        self.replicas = replicas
        self.ring = []
        self.node_map = {}

    def _hash(self, key: str) -> int:
        return int(hashlib.md5(key.encode('utf-8')).hexdigest(), 16)

    def add_node(self, node: str) -> None:
        for i in range(self.replicas):
            vkey = f"{node}#replica_{i}"
            h = self._hash(vkey)
            bisect.insort(self.ring, h)
            self.node_map[h] = node

    def get_node(self, key: str) -> str:
        if not self.ring:
            return None
        h = self._hash(key)
        idx = bisect.bisect_right(self.ring, h)
        if idx == len(self.ring):
            idx = 0
        return self.node_map[self.ring[idx]]

if __name__ == "__main__":
    ring = ConsistentHashRing(replicas=3)
    ring.add_node("server_alpha")
    ring.add_node("server_beta")
    print("Key user_1001 mapped to:", ring.get_node("user_1001"))
`,
    testCases: JSON.stringify([
      { input: "add_node(alpha), add_node(beta), get_node(user_1001)", expectedOutput: "Key user_1001 mapped to: server_alpha", isHidden: false, points: 50 },
      { input: "rebalance_test(remove_node)", expectedOutput: "Minimal key redistribution verified", isHidden: true, points: 50 },
    ]),
  },
];

for (const asg of assignmentsCSE276) {
  statements.push(`
    INSERT OR REPLACE INTO assignments (
      id, classroom_id, title, description, instructions, type, language,
      starter_code, difficulty, max_marks, due_at, published_at,
      attempts_allowed, allow_late_submission, late_penalty_percent,
      auto_grade, manual_grade, ai_policy, plagiarism_policy,
      status, created_by, created_at, updated_at, test_cases_json
    ) VALUES (
      ${escapeSQL(asg.id)},
      'CLS_1792819623330_ZF01',
      ${escapeSQL(asg.title)},
      ${escapeSQL(asg.description)},
      ${escapeSQL(asg.instructions)},
      'coding',
      ${escapeSQL(asg.language)},
      ${escapeSQL(asg.starterCode)},
      ${escapeSQL(asg.difficulty)},
      ${asg.maxMarks},
      ${asg.dueAt},
      ${now - 1 * oneDay},
      3,
      1,
      10,
      1,
      1,
      'hints_only',
      'review_only',
      'published',
      ${escapeSQL(teacherId)},
      ${now - 1 * oneDay},
      ${now},
      ${escapeSQL(asg.testCases)}
    );
  `);
}

// Submissions & Grades for CS 276
const sampleSubmissions = [
  {
    subId: 'sub_cse_alex_1',
    asgId: 'asg_cse_queue',
    asgTitle: 'Lab 1: Thread-Safe Bounded Concurrent Queue',
    classroomId: 'CLS_1792819623330_ZF01',
    student: students[0],
    score: 100,
    status: 'completed',
    code: `# Alex Chen submission for Concurrent Queue
import threading
import time

class ConcurrentQueue:
    def __init__(self, capacity: int = 10):
        self.capacity = capacity
        self.queue = []
        self.lock = threading.Lock()
        self.not_full = threading.Condition(self.lock)
        self.not_empty = threading.Condition(self.lock)

    def push(self, item, timeout: float = 1.0) -> bool:
        with self.not_full:
            while len(self.queue) >= self.capacity:
                if not self.not_full.wait(timeout=timeout):
                    return False
            self.queue.append(item)
            self.not_empty.notify()
            return True

    def pop(self, timeout: float = 1.0):
        with self.not_empty:
            while not self.queue:
                if not self.not_empty.wait(timeout=timeout):
                    return None
            item = self.queue.pop(0)
            self.not_full.notify()
            return item

    def size(self) -> int:
        with self.lock:
            return len(self.queue)
`,
    feedback: 'Flawless condition variable synchronization with proper while loop waiting pattern.',
  },
  {
    subId: 'sub_cse_sophia_1',
    asgId: 'asg_cse_queue',
    asgTitle: 'Lab 1: Thread-Safe Bounded Concurrent Queue',
    classroomId: 'CLS_1792819623330_ZF01',
    student: students[1],
    score: 95,
    status: 'completed',
    code: `# Sophia Patel submission
import threading

class ConcurrentQueue:
    def __init__(self, capacity: int = 10):
        self.capacity = capacity
        self.queue = []
        self.cv = threading.Condition()

    def push(self, item, timeout: float = 1.0) -> bool:
        with self.cv:
            while len(self.queue) >= self.capacity:
                self.cv.wait(timeout=timeout)
            self.queue.append(item)
            self.cv.notify_all()
            return True

    def pop(self, timeout: float = 1.0):
        with self.cv:
            while not self.queue:
                self.cv.wait(timeout=timeout)
            item = self.queue.pop(0)
            self.cv.notify_all()
            return item

    def size(self) -> int:
        with self.cv:
            return len(self.queue)
`,
    feedback: 'Excellent implementation using single condition variable notify_all.',
  },
  {
    subId: 'sub_cse_aniket_1',
    asgId: 'asg_cse_queue',
    asgTitle: 'Lab 1: Thread-Safe Bounded Concurrent Queue',
    classroomId: 'CLS_1792819623330_ZF01',
    student: students[5],
    score: 90,
    status: 'completed',
    code: `# Aniket Agarwal submission
import threading

class ConcurrentQueue:
    def __init__(self, capacity: int = 10):
        self.capacity = capacity
        self.queue = []
        self.lock = threading.Lock()
        self.not_empty = threading.Condition(self.lock)
        self.not_full = threading.Condition(self.lock)

    def push(self, item, timeout: float = 1.0) -> bool:
        with self.not_full:
            if len(self.queue) < self.capacity:
                self.queue.append(item)
                self.not_empty.notify()
                return True
            return False

    def pop(self, timeout: float = 1.0):
        with self.not_empty:
            if self.queue:
                item = self.queue.pop(0)
                self.not_full.notify()
                return item
            return None

    def size(self) -> int:
        with self.lock:
            return len(self.queue)
`,
    feedback: 'Good non-blocking check. In production, prefer while loops to handle spurious wakeups.',
  },
];

for (const sub of sampleSubmissions) {
  const resultJson = JSON.stringify([
    { id: 1, name: 'Basic Push and Pop', status: 'passed', executionTimeMs: 12 },
    { id: 2, name: 'Concurrent Thread Stress Test', status: sub.score >= 90 ? 'passed' : 'failed', executionTimeMs: 30 }
  ]);

  statements.push(`
    INSERT OR REPLACE INTO submissions (
      id, assignment_id, assignment_title, classroom_id, student_id, student_name,
      code, language, version, status, submitted_at, execution_started_at, execution_completed_at,
      score, max_score, is_late, test_results_json
    ) VALUES (
      ${escapeSQL(sub.subId)},
      ${escapeSQL(sub.asgId)},
      ${escapeSQL(sub.asgTitle)},
      ${escapeSQL(sub.classroomId)},
      ${escapeSQL(sub.student.id)},
      ${escapeSQL(sub.student.name)},
      ${escapeSQL(sub.code)},
      'python',
      1,
      ${escapeSQL(sub.status)},
      ${now - 6 * oneHour},
      ${now - 6 * oneHour},
      ${now - 6 * oneHour + 42},
      ${sub.score},
      100,
      0,
      ${escapeSQL(resultJson)}
    );
  `);

  statements.push(`
    INSERT OR REPLACE INTO grades (
      id, submission_id, student_id, assignment_id,
      automatic_score, manual_adjustment, final_score,
      graded_by, graded_by_name, graded_at
    ) VALUES (
      ${escapeSQL(`grd_${sub.subId}`)},
      ${escapeSQL(sub.subId)},
      ${escapeSQL(sub.student.id)},
      ${escapeSQL(sub.asgId)},
      ${sub.score},
      0,
      ${sub.score},
      ${escapeSQL(teacherId)},
      ${escapeSQL(teacherName)},
      ${now - 2 * oneHour}
    );
  `);
}

// Resources for CS 276
const resourcesCSE276 = [
  {
    id: 'res_cse_syllabus',
    name: 'CS 276 Course Syllabus & Lecture Schedule',
    description: 'Detailed syllabus, grading breakdown, lab schedule, and recommended concurrency textbooks.',
    type: 'link',
    url: 'https://cortexcode.io/docs/cs276-syllabus.pdf',
    unit: 'General',
  },
  {
    id: 'res_cse_posix',
    name: 'POSIX Threads & Memory Model Quick Reference',
    description: 'Concise reference card detailing mutex locking, memory ordering, atomic operations, and condition variable semantics.',
    type: 'document',
    url: 'https://cortexcode.io/docs/pthreads-reference.pdf',
    unit: 'Concurrency',
  },
  {
    id: 'res_cse_raft',
    name: 'In Search of an Understandable Consensus Algorithm (Raft)',
    description: 'Original research paper by Diego Ongaro and John Ousterhout with annotated implementation diagrams.',
    type: 'link',
    url: 'https://raft.github.io/raft.pdf',
    unit: 'Distributed Systems',
  },
];

for (const res of resourcesCSE276) {
  statements.push(`
    INSERT OR REPLACE INTO resources (
      id, classroom_id, uploaded_by, uploaded_by_name, name, type, url, description, unit, created_at, pinned, visibility
    ) VALUES (
      ${escapeSQL(res.id)},
      'CLS_1792819623330_ZF01',
      ${escapeSQL(teacherId)},
      ${escapeSQL(teacherName)},
      ${escapeSQL(res.name)},
      ${escapeSQL(res.type)},
      ${escapeSQL(res.url)},
      ${escapeSQL(res.description)},
      ${escapeSQL(res.unit)},
      ${now - 1 * oneDay},
      1,
      'public'
    );
  `);
}

// Discussion messages for CS 276 (with recipient_type and updated_at)
const messagesCSE276 = [
  {
    id: 'msg_cse_1',
    sender: students[0],
    content: 'Professor, in Lab 1 for the circular buffer, should we throw an exception or return None when pop times out?',
    createdAt: now - 8 * oneHour,
  },
  {
    id: 'msg_cse_2',
    sender: { id: teacherId, name: teacherName },
    content: 'Returning None on timeout is standard for Python queues. Ensure the condition variable timeout does not throw an uncaught exception.',
    createdAt: now - 7 * oneHour,
  },
  {
    id: 'msg_cse_3',
    sender: students[1],
    content: 'Thank you! The test suite passed all concurrency stress tests smoothly.',
    createdAt: now - 5 * oneHour,
  },
];

for (const msg of messagesCSE276) {
  statements.push(`
    INSERT OR REPLACE INTO messages (
      id, classroom_id, sender_id, sender_name, sender_role, recipient_type, content, created_at, updated_at
    ) VALUES (
      ${escapeSQL(msg.id)},
      'CLS_1792819623330_ZF01',
      ${escapeSQL(msg.sender.id)},
      ${escapeSQL(msg.sender.name)},
      ${msg.sender.id === teacherId ? "'teacher'" : "'student'"},
      'broadcast',
      ${escapeSQL(msg.content)},
      ${msg.createdAt},
      ${msg.createdAt}
    );
  `);
}

// Live Session for CLS_DEMO_DSA_2026
statements.push(`
  INSERT OR REPLACE INTO live_sessions (
    id, classroom_id, teacher_id, teacher_name, title, topic, language, starter_code, shared_code, is_broadcasting_code, started_at, status
  ) VALUES (
    'session_live_dsa_2026',
    'CLS_DEMO_DSA_2026',
    ${escapeSQL(teacherId)},
    ${escapeSQL(teacherName)},
    'Live Algorithm Review: Hash Maps and BSTs',
    'Tree Traversals and Hash Maps',
    'python',
    '# Live Class Starter Code\\ndef solve():\\n    pass\\n',
    '# Live Class Shared Code\\ndef solve():\\n    pass\\n',
    1,
    ${now - 25 * 60 * 1000},
    'active'
  );
`);

const outSQL = statements.join('\n');
const outFile = path.resolve(__dirname, 'seed-teacher-demo.sql');
fs.writeFileSync(outFile, outSQL, 'utf8');

console.log(`Generated ${statements.length} SQL statements in ${outFile}`);
