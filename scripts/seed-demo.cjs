const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const classroomId = 'CLS_1791721370155_EK0C';
const teacherId = 'usr_mu4n608wzkpzp';
const teacherName = 'shivam';
const now = Date.now();
const oneHour = 3600 * 1000;
const oneDay = 24 * 3600 * 1000;

const students = [
  {
    id: 'usr_demo_alex',
    name: 'Alex Chen',
    email: 'alex.chen@student.cortex.edu',
    cortexId: 'alexchen',
    isOnline: 1,
    joinedAt: now - 3 * oneDay,
    lastActiveAt: now - 5 * 60 * 1000,
  },
  {
    id: 'usr_demo_sophia',
    name: 'Sophia Patel',
    email: 'sophia.patel@student.cortex.edu',
    cortexId: 'sophiap',
    isOnline: 1,
    joinedAt: now - 3 * oneDay,
    lastActiveAt: now - 12 * 60 * 1000,
  },
  {
    id: 'usr_demo_marcus',
    name: 'Marcus Vance',
    email: 'marcus.vance@student.cortex.edu',
    cortexId: 'mvance',
    isOnline: 0,
    joinedAt: now - 2 * oneDay,
    lastActiveAt: now - 2 * oneHour,
  },
  {
    id: 'usr_demo_elena',
    name: 'Elena Rostova',
    email: 'elena.rostova@student.cortex.edu',
    cortexId: 'erostova',
    isOnline: 1,
    joinedAt: now - 2 * oneDay,
    lastActiveAt: now - 25 * 60 * 1000,
  },
  {
    id: 'usr_demo_liam',
    name: 'Liam Wright',
    email: 'liam.wright@student.cortex.edu',
    cortexId: 'lwright',
    isOnline: 0,
    joinedAt: now - 1 * oneDay,
    lastActiveAt: now - 5 * oneHour,
  },
];

const announcements = [
  {
    id: 'ann_demo_welcome',
    title: '🚀 Welcome to CS 101: Algorithmic Thinking & Systems',
    content: 'Welcome everyone to the DEMO classroom! In this course, we explore foundational algorithms, data structures, and hands-on coding challenges using the Cortex collaborative execution environment.\n\nBe sure to check out the first two assignments and review the reference materials in the Resources tab. Feel free to use the class chat for study discussions!',
    pinned: 1,
    createdAt: now - 3 * oneDay,
    updatedAt: now - 3 * oneDay,
  },
  {
    id: 'ann_demo_lab1',
    title: '📌 Lab Assignment 1: Two Sum & Hash Map Lookup Published',
    content: 'The first coding assignment is officially open! Implement twoSum with O(n) linear time complexity.\n\nMake sure your solution handles negative numbers, duplicates, and edge bounds. The test runner will automatically validate your code against public and hidden test cases upon submission.',
    pinned: 0,
    createdAt: now - 2 * oneDay,
    updatedAt: now - 2 * oneDay,
  },
  {
    id: 'ann_demo_session',
    title: '⚡ Upcoming Live Workspace: Binary Search Tree Invariants',
    content: 'We will be holding an interactive live coding session on recursive tree validation and depth-first search patterns.\n\nReview the starter code in Assignment 2 before attending!',
    pinned: 0,
    createdAt: now - 1 * oneDay,
    updatedAt: now - 1 * oneDay,
  },
];

const announcementComments = [
  {
    id: 'msg_ann_comm_1',
    announcementId: 'ann_demo_welcome',
    sender: students[0],
    role: 'student',
    content: 'Excited to get started with the Cortex platform! The IDE looks super fast.',
    createdAt: now - (2 * oneDay + 18 * oneHour),
  },
  {
    id: 'msg_ann_comm_2',
    announcementId: 'ann_demo_welcome',
    sender: students[1],
    role: 'student',
    content: 'Professor, will the assignments be evaluated using Python 3.11 with full standard library?',
    createdAt: now - (2 * oneDay + 14 * oneHour),
  },
  {
    id: 'msg_ann_comm_3',
    announcementId: 'ann_demo_welcome',
    sender: { id: teacherId, name: teacherName },
    role: 'teacher',
    content: 'Yes Sophia! The sandbox worker runs isolated Python 3.11 with all standard modules available.',
    createdAt: now - (2 * oneDay + 12 * oneHour),
  },
  {
    id: 'msg_ann_comm_4',
    announcementId: 'ann_demo_lab1',
    sender: students[2],
    role: 'student',
    content: 'Just ran the test suite on Lab 1 — instant execution feedback is awesome!',
    createdAt: now - (1 * oneDay + 10 * oneHour),
  },
];

const classMessages = [
  {
    id: 'msg_class_1',
    sender: students[0],
    role: 'student',
    content: 'Hey everyone! For the BST validation problem, is anyone using in-order traversal or direct range recursion?',
    createdAt: now - (20 * oneHour),
  },
  {
    id: 'msg_class_2',
    sender: students[1],
    role: 'student',
    content: 'Range recursion with (low, high) bounds works really nicely and runs in O(n) time!',
    createdAt: now - (19 * oneHour),
  },
  {
    id: 'msg_class_3',
    sender: students[3],
    role: 'student',
    content: 'Agreed! Just remember to use strict inequality (< and >) because duplicate values violate the BST property.',
    createdAt: now - (18 * oneHour),
  },
  {
    id: 'msg_class_4',
    sender: { id: teacherId, name: teacherName },
    role: 'teacher',
    content: 'Spot on Elena and Sophia! Notice also how in-order traversal produces a strictly increasing sequence.',
    createdAt: now - (16 * oneHour),
  },
  {
    id: 'msg_class_5',
    sender: students[4],
    role: 'student',
    content: 'Thanks Professor! Just submitted Assignment 1 and looking forward to the live session.',
    createdAt: now - (6 * oneHour),
  },
  {
    id: 'msg_class_6',
    sender: students[0],
    role: 'student',
    content: 'Check out the new Big-O cheatsheet in Resources, it has great memory diagrams.',
    createdAt: now - (40 * 60 * 1000),
  },
];

const directMessages = [
  {
    id: 'msg_dm_1',
    sender: students[0],
    senderRole: 'student',
    recipientId: teacherId,
    content: 'Hi Professor, I noticed my initial solution timed out on the stress test. Is dictionary lookup preferred over nested loops?',
    createdAt: now - (14 * oneHour),
  },
  {
    id: 'msg_dm_2',
    sender: { id: teacherId, name: teacherName },
    senderRole: 'teacher',
    recipientId: students[0].id,
    content: 'Hi Alex! Yes, a single-pass hash map reduces complexity from O(n^2) to O(n) which easily passes within the 2-second limit.',
    createdAt: now - (13 * oneHour),
  },
  {
    id: 'msg_dm_3',
    sender: students[1],
    senderRole: 'student',
    recipientId: teacherId,
    content: 'Professor, I submitted Assignment 2. Please let me know if the helper recursion meets style conventions!',
    createdAt: now - (3 * oneHour),
  },
];

const assignments = [
  {
    id: 'asg_demo_twosum',
    title: 'Two Sum: Hash Map Optimization',
    description: 'Find indices of two numbers such that they add up to a specific target.',
    instructions: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nYou may assume that each input has exactly one solution, and you may not use the same element twice.\n\nYou can return the answer in any order.\n\nTarget Complexity:\n- Time Complexity: O(n)\n- Space Complexity: O(n)',
    type: 'coding',
    language: 'python',
    starterCode: `def two_sum(nums: list[int], target: int) -> list[int]:
    """
    Find indices of two numbers in nums that add up to target.
    :type nums: List[int]
    :type target: int
    :rtype: List[int]
    """
    # Your solution here
    pass
`,
    difficulty: 'Easy',
    maxMarks: 100,
    dueAt: now + 7 * oneDay,
    publishedAt: now - 2 * oneDay,
    attemptsAllowed: 5,
    allowLateSubmission: 1,
    latePenaltyPercent: 10,
    autoGrade: 1,
    manualGrade: 1,
    aiPolicy: 'hints_only',
    plagiarismPolicy: 'review_only',
    status: 'published',
    createdBy: teacherId,
    createdAt: now - 2 * oneDay,
    updatedAt: now - 2 * oneDay,
    testCases: [
      { id: 'tc1', name: 'Standard Case', input: '[2, 7, 11, 15], 9', expectedOutput: '[0, 1]', isHidden: false, weight: 25, timeoutMs: 2000 },
      { id: 'tc2', name: 'Negative Numbers', input: '[-3, 4, 3, 90], 0', expectedOutput: '[0, 2]', isHidden: false, weight: 25, timeoutMs: 2000 },
      { id: 'tc3', name: 'Duplicate Values', input: '[3, 3], 6', expectedOutput: '[0, 1]', isHidden: false, weight: 25, timeoutMs: 2000 },
      { id: 'tc4', name: 'Large Array Stress Test', input: '[1, 2, ..., 10000], 19999', expectedOutput: '[9998, 9999]', isHidden: true, weight: 25, timeoutMs: 2000 },
    ],
    rubric: [
      { id: 'correctness', name: 'Functional Correctness', maxPoints: 50, description: 'Passes all edge cases including negative numbers and duplicates.' },
      { id: 'efficiency', name: 'Time & Space Efficiency', maxPoints: 30, description: 'O(n) runtime achieved via hash table lookup.' },
      { id: 'style', name: 'Code Quality & Typing', maxPoints: 20, description: 'Clean idiomatic code with proper type annotations.' },
    ],
  },
  {
    id: 'asg_demo_validate_bst',
    title: 'Validate Binary Search Tree',
    description: 'Determine if a binary tree satisfies the Binary Search Tree invariant.',
    instructions: 'Given the root of a binary tree, determine if it is a valid binary search tree (BST).\n\nA valid BST satisfies:\n1. The left subtree contains only nodes with keys strictly less than the node\'s key.\n2. The right subtree contains only nodes with keys strictly greater than the node\'s key.\n3. Both subtrees must also be binary search trees.',
    type: 'coding',
    language: 'python',
    starterCode: `class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def is_valid_bst(root: TreeNode) -> bool:
    """
    Determine if the tree rooted at root is a valid BST.
    """
    # Your solution here
    pass
`,
    difficulty: 'Medium',
    maxMarks: 100,
    dueAt: now + 10 * oneDay,
    publishedAt: now - 1 * oneDay,
    attemptsAllowed: 3,
    allowLateSubmission: 1,
    latePenaltyPercent: 15,
    autoGrade: 1,
    manualGrade: 1,
    aiPolicy: 'hints_only',
    plagiarismPolicy: 'review_only',
    status: 'published',
    createdBy: teacherId,
    createdAt: now - 1 * oneDay,
    updatedAt: now - 1 * oneDay,
    testCases: [
      { id: 'tc1', name: 'Valid 3-Node Tree', input: '[2, 1, 3]', expectedOutput: 'True', isHidden: false, weight: 25, timeoutMs: 2000 },
      { id: 'tc2', name: 'Invalid Subtree Violation', input: '[5, 1, 4, None, None, 3, 6]', expectedOutput: 'False', isHidden: false, weight: 25, timeoutMs: 2000 },
      { id: 'tc3', name: 'Single Node Tree', input: '[1]', expectedOutput: 'True', isHidden: true, weight: 25, timeoutMs: 2000 },
      { id: 'tc4', name: 'Boundary Bounds & Large Values', input: '[2147483647]', expectedOutput: 'True', isHidden: true, weight: 25, timeoutMs: 2000 },
    ],
    rubric: [
      { id: 'correctness', name: 'Invariant Validation', maxPoints: 50, description: 'Correctly verifies subtree bounds across arbitrary depths.' },
      { id: 'recursion', name: 'Recursive Bounds Handling', maxPoints: 30, description: 'Proper lower and upper bound propagation.' },
      { id: 'readability', name: 'Clarity & Modularity', maxPoints: 20, description: 'Clear helper function structure and edge checks.' },
    ],
  },
];

const submissions = [
  {
    id: 'sub_demo_alex_twosum',
    assignmentId: 'asg_demo_twosum',
    assignmentTitle: 'Two Sum: Hash Map Optimization',
    studentId: students[0].id,
    studentName: students[0].name,
    code: `def two_sum(nums: list[int], target: int) -> list[int]:
    lookup = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in lookup:
            return [lookup[complement], i]
        lookup[num] = i
    return []
`,
    language: 'python',
    version: 1,
    status: 'completed',
    submittedAt: now - 1 * oneDay,
    score: 100,
    maxScore: 100,
    isLate: 0,
    testResults: [
      { id: 'tc1', name: 'Standard Case', status: 'passed', executionTimeMs: 12, passed: true },
      { id: 'tc2', name: 'Negative Numbers', status: 'passed', executionTimeMs: 14, passed: true },
      { id: 'tc3', name: 'Duplicate Values', status: 'passed', executionTimeMs: 10, passed: true },
      { id: 'tc4', name: 'Large Array Stress Test', status: 'passed', executionTimeMs: 45, passed: true },
    ],
    grade: {
      id: 'grd_demo_alex_twosum',
      automaticScore: 100,
      manualAdjustment: 0,
      finalScore: 100,
      gradedBy: teacherId,
      gradedByName: teacherName,
      gradedAt: now - (22 * oneHour),
      rubricScores: { correctness: 50, efficiency: 30, style: 20 },
    },
    feedback: {
      id: 'fbk_demo_alex_twosum',
      content: 'Flawless single-pass hash map solution! Excellent O(n) performance and clean type hints.',
      createdAt: now - (22 * oneHour),
    },
  },
  {
    id: 'sub_demo_sophia_twosum',
    assignmentId: 'asg_demo_twosum',
    assignmentTitle: 'Two Sum: Hash Map Optimization',
    studentId: students[1].id,
    studentName: students[1].name,
    code: `def two_sum(nums: list[int], target: int) -> list[int]:
    seen = {}
    for index, val in enumerate(nums):
        diff = target - val
        if diff in seen:
            return [seen[diff], index]
        seen[val] = index
    return []
`,
    language: 'python',
    version: 1,
    status: 'completed',
    submittedAt: now - (20 * oneHour),
    score: 100,
    maxScore: 100,
    isLate: 0,
    testResults: [
      { id: 'tc1', name: 'Standard Case', status: 'passed', executionTimeMs: 11, passed: true },
      { id: 'tc2', name: 'Negative Numbers', status: 'passed', executionTimeMs: 13, passed: true },
      { id: 'tc3', name: 'Duplicate Values', status: 'passed', executionTimeMs: 9, passed: true },
      { id: 'tc4', name: 'Large Array Stress Test', status: 'passed', executionTimeMs: 42, passed: true },
    ],
    grade: {
      id: 'grd_demo_sophia_twosum',
      automaticScore: 100,
      manualAdjustment: 0,
      finalScore: 100,
      gradedBy: teacherId,
      gradedByName: teacherName,
      gradedAt: now - (18 * oneHour),
      rubricScores: { correctness: 50, efficiency: 30, style: 20 },
    },
    feedback: {
      id: 'fbk_demo_sophia_twosum',
      content: 'Very crisp code! Perfect variable naming and handles all cases seamlessly.',
      createdAt: now - (18 * oneHour),
    },
  },
  {
    id: 'sub_demo_marcus_twosum',
    assignmentId: 'asg_demo_twosum',
    assignmentTitle: 'Two Sum: Hash Map Optimization',
    studentId: students[2].id,
    studentName: students[2].name,
    code: `def two_sum(nums: list[int], target: int) -> list[int]:
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]
    return []
`,
    language: 'python',
    version: 1,
    status: 'completed',
    submittedAt: now - (16 * oneHour),
    score: 75,
    maxScore: 100,
    isLate: 0,
    testResults: [
      { id: 'tc1', name: 'Standard Case', status: 'passed', executionTimeMs: 15, passed: true },
      { id: 'tc2', name: 'Negative Numbers', status: 'passed', executionTimeMs: 14, passed: true },
      { id: 'tc3', name: 'Duplicate Values', status: 'passed', executionTimeMs: 12, passed: true },
      { id: 'tc4', name: 'Large Array Stress Test', status: 'timeout', executionTimeMs: 2005, passed: false },
    ],
    grade: {
      id: 'grd_demo_marcus_twosum',
      automaticScore: 75,
      manualAdjustment: 0,
      finalScore: 75,
      gradedBy: teacherId,
      gradedByName: teacherName,
      gradedAt: now - (14 * oneHour),
      rubricScores: { correctness: 45, efficiency: 15, style: 15 },
    },
    feedback: {
      id: 'fbk_demo_marcus_twosum',
      content: 'Good effort Marcus! Your logic is correct, but the nested loops give O(n^2) time complexity, timing out on test case 4. Switch to a dictionary for O(1) lookup.',
      createdAt: now - (14 * oneHour),
    },
  },
  {
    id: 'sub_demo_elena_bst',
    assignmentId: 'asg_demo_validate_bst',
    assignmentTitle: 'Validate Binary Search Tree',
    studentId: students[3].id,
    studentName: students[3].name,
    code: `def is_valid_bst(root) -> bool:
    def validate(node, low=float('-inf'), high=float('inf')):
        if not node:
            return True
        if node.val <= low or node.val >= high:
            return False
        return validate(node.left, low, node.val) and validate(node.right, node.val, high)
    return validate(root)
`,
    language: 'python',
    version: 1,
    status: 'completed',
    submittedAt: now - (8 * oneHour),
    score: 95,
    maxScore: 100,
    isLate: 0,
    testResults: [
      { id: 'tc1', name: 'Valid 3-Node Tree', status: 'passed', executionTimeMs: 12, passed: true },
      { id: 'tc2', name: 'Invalid Subtree Violation', status: 'passed', executionTimeMs: 11, passed: true },
      { id: 'tc3', name: 'Single Node Tree', status: 'passed', executionTimeMs: 8, passed: true },
      { id: 'tc4', name: 'Boundary Bounds & Large Values', status: 'passed', executionTimeMs: 15, passed: true },
    ],
    grade: {
      id: 'grd_demo_elena_bst',
      automaticScore: 100,
      manualAdjustment: -5,
      finalScore: 95,
      gradedBy: teacherId,
      gradedByName: teacherName,
      gradedAt: now - (5 * oneHour),
      rubricScores: { correctness: 50, recursion: 30, readability: 15 },
    },
    feedback: {
      id: 'fbk_demo_elena_bst',
      content: 'Beautiful and clean recursive invariant solution! Minor point off for missing docstrings, but algorithmic execution is 10/10.',
      createdAt: now - (5 * oneHour),
    },
  },
];

const resources = [
  {
    id: 'res_demo_1',
    name: 'Lecture 01 - Asymptotic Analysis & Big-O Cheatsheet',
    type: 'document',
    url: 'https://cortexcode.io/resources/cheatsheet-complexity.pdf',
    description: 'Comprehensive quick-reference table for common operations across Array, Linked List, Stack, Queue, Tree, and Hash Table.',
    unit: 'Unit 1: Foundations',
    pinned: 1,
    createdAt: now - 3 * oneDay,
  },
  {
    id: 'res_demo_2',
    name: 'Python Standard Library Data Structures Guide',
    type: 'document',
    url: 'https://cortexcode.io/resources/python-structures-guide.pdf',
    description: 'Practical guide to collections.deque, heapq, dict, and bisect for competitive programming and interview prep.',
    unit: 'Unit 1: Foundations',
    pinned: 0,
    createdAt: now - 2 * oneDay,
  },
  {
    id: 'res_demo_3',
    name: 'Binary Search Tree Traversal & Invariant Patterns',
    type: 'code',
    url: 'https://cortexcode.io/resources/bst_snippets.py',
    description: 'Starter helper templates demonstrating iterative vs recursive in-order, pre-order, and level-order traversals.',
    unit: 'Unit 2: Trees & Graphs',
    pinned: 0,
    createdAt: now - 1 * oneDay,
  },
  {
    id: 'res_demo_4',
    name: 'Cortex Collaborative Sandbox Architecture',
    type: 'document',
    url: 'https://cortexcode.io/resources/cortex-architecture.pdf',
    description: 'Technical overview of dual workspace synchronization, Durable Objects, and real-time execution sandboxes.',
    unit: 'Course Overview',
    pinned: 0,
    createdAt: now - 3 * oneDay,
  },
];

// Build SQL
function escapeSQL(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

const statements = [];

// 1. Users
for (const s of students) {
  statements.push(`
    INSERT OR REPLACE INTO users (id, cortex_id, password_hash, name, email, role, avatar, status, created_at, updated_at)
    VALUES (${escapeSQL(s.id)}, ${escapeSQL(s.cortexId)}, NULL, ${escapeSQL(s.name)}, ${escapeSQL(s.email)}, 'student', NULL, 'active', ${s.joinedAt}, ${s.lastActiveAt});
  `);
}

// 2. Classroom Members
for (const s of students) {
  const memberId = `mem_${classroomId}_${s.id}`;
  statements.push(`
    INSERT OR REPLACE INTO classroom_members (id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online)
    VALUES (${escapeSQL(memberId)}, ${escapeSQL(classroomId)}, ${escapeSQL(s.id)}, ${escapeSQL(s.name)}, ${escapeSQL(s.email)}, 'student', 'active', ${s.joinedAt}, ${s.lastActiveAt}, ${s.isOnline});
  `);
}

// 3. Announcements
for (const a of announcements) {
  statements.push(`
    INSERT OR REPLACE INTO announcements (id, classroom_id, author_id, author_name, author_role, title, content, pinned, created_at, updated_at)
    VALUES (${escapeSQL(a.id)}, ${escapeSQL(classroomId)}, ${escapeSQL(teacherId)}, ${escapeSQL(teacherName)}, 'teacher', ${escapeSQL(a.title)}, ${escapeSQL(a.content)}, ${a.pinned}, ${a.createdAt}, ${a.updatedAt});
  `);
}

// 4. Announcement Comments (Messages with recipient_type = 'announcement')
for (const c of announcementComments) {
  statements.push(`
    INSERT OR REPLACE INTO messages (id, classroom_id, sender_id, sender_name, sender_role, recipient_type, recipient_id, content, created_at, updated_at)
    VALUES (${escapeSQL(c.id)}, ${escapeSQL(classroomId)}, ${escapeSQL(c.sender.id)}, ${escapeSQL(c.sender.name)}, ${escapeSQL(c.role)}, 'announcement', ${escapeSQL(c.announcementId)}, ${escapeSQL(c.content)}, ${c.createdAt}, ${c.createdAt});
  `);
}

// 5. Class Messages (recipient_type = 'class')
for (const m of classMessages) {
  statements.push(`
    INSERT OR REPLACE INTO messages (id, classroom_id, sender_id, sender_name, sender_role, recipient_type, recipient_id, content, created_at, updated_at)
    VALUES (${escapeSQL(m.id)}, ${escapeSQL(classroomId)}, ${escapeSQL(m.sender.id)}, ${escapeSQL(m.sender.name)}, ${escapeSQL(m.role)}, 'class', NULL, ${escapeSQL(m.content)}, ${m.createdAt}, ${m.createdAt});
  `);
}

// 6. Direct Messages (recipient_type = 'direct')
for (const dm of directMessages) {
  statements.push(`
    INSERT OR REPLACE INTO messages (id, classroom_id, sender_id, sender_name, sender_role, recipient_type, recipient_id, content, created_at, updated_at)
    VALUES (${escapeSQL(dm.id)}, ${escapeSQL(classroomId)}, ${escapeSQL(dm.sender.id)}, ${escapeSQL(dm.sender.name)}, ${escapeSQL(dm.senderRole)}, 'direct', ${escapeSQL(dm.recipientId)}, ${escapeSQL(dm.content)}, ${dm.createdAt}, ${dm.createdAt});
  `);
}

// 7. Assignments
for (const asg of assignments) {
  statements.push(`
    INSERT OR REPLACE INTO assignments (
      id, classroom_id, title, description, instructions, type, language, starter_code, difficulty,
      max_marks, due_at, published_at, attempts_allowed, allow_late_submission, late_penalty_percent,
      auto_grade, manual_grade, ai_policy, plagiarism_policy, status, created_by, created_at, updated_at,
      test_cases_json, rubric_json
    ) VALUES (
      ${escapeSQL(asg.id)}, ${escapeSQL(classroomId)}, ${escapeSQL(asg.title)}, ${escapeSQL(asg.description)},
      ${escapeSQL(asg.instructions)}, ${escapeSQL(asg.type)}, ${escapeSQL(asg.language)}, ${escapeSQL(asg.starterCode)},
      ${escapeSQL(asg.difficulty)}, ${asg.maxMarks}, ${asg.dueAt}, ${asg.publishedAt}, ${asg.attemptsAllowed},
      ${asg.allowLateSubmission}, ${asg.latePenaltyPercent}, ${asg.autoGrade}, ${asg.manualGrade},
      ${escapeSQL(asg.aiPolicy)}, ${escapeSQL(asg.plagiarismPolicy)}, ${escapeSQL(asg.status)},
      ${escapeSQL(asg.createdBy)}, ${asg.createdAt}, ${asg.updatedAt},
      ${escapeSQL(JSON.stringify(asg.testCases))}, ${escapeSQL(JSON.stringify(asg.rubric))}
    );
  `);
}

// 8. Submissions, Grades, and Feedback
for (const sub of submissions) {
  statements.push(`
    INSERT OR REPLACE INTO submissions (
      id, assignment_id, assignment_title, classroom_id, student_id, student_name, code, language,
      version, status, submitted_at, score, max_score, is_late, test_results_json
    ) VALUES (
      ${escapeSQL(sub.id)}, ${escapeSQL(sub.assignmentId)}, ${escapeSQL(sub.assignmentTitle)},
      ${escapeSQL(classroomId)}, ${escapeSQL(sub.studentId)}, ${escapeSQL(sub.studentName)},
      ${escapeSQL(sub.code)}, ${escapeSQL(sub.language)}, ${sub.version}, ${escapeSQL(sub.status)},
      ${sub.submittedAt}, ${sub.score}, ${sub.maxScore}, ${sub.isLate},
      ${escapeSQL(JSON.stringify(sub.testResults))}
    );
  `);

  if (sub.grade) {
    statements.push(`
      INSERT OR REPLACE INTO grades (
        id, submission_id, student_id, assignment_id, automatic_score, manual_adjustment, final_score,
        graded_by, graded_by_name, graded_at, rubric_scores_json
      ) VALUES (
        ${escapeSQL(sub.grade.id)}, ${escapeSQL(sub.id)}, ${escapeSQL(sub.studentId)},
        ${escapeSQL(sub.assignmentId)}, ${sub.grade.automaticScore}, ${sub.grade.manualAdjustment},
        ${sub.grade.finalScore}, ${escapeSQL(sub.grade.gradedBy)}, ${escapeSQL(sub.grade.gradedByName)},
        ${sub.grade.gradedAt}, ${escapeSQL(JSON.stringify(sub.grade.rubricScores))}
      );
    `);
  }

  if (sub.feedback) {
    statements.push(`
      INSERT OR REPLACE INTO feedback (
        id, submission_id, author_id, author_name, content, created_at, updated_at
      ) VALUES (
        ${escapeSQL(sub.feedback.id)}, ${escapeSQL(sub.id)}, ${escapeSQL(teacherId)},
        ${escapeSQL(teacherName)}, ${escapeSQL(sub.feedback.content)},
        ${sub.feedback.createdAt}, ${sub.feedback.createdAt}
      );
    `);
  }
}

// 9. Resources
for (const res of resources) {
  statements.push(`
    INSERT OR REPLACE INTO resources (
      id, classroom_id, uploaded_by, uploaded_by_name, name, type, url, description, unit, created_at, pinned, visibility
    ) VALUES (
      ${escapeSQL(res.id)}, ${escapeSQL(classroomId)}, ${escapeSQL(teacherId)}, ${escapeSQL(teacherName)},
      ${escapeSQL(res.name)}, ${escapeSQL(res.type)}, ${escapeSQL(res.url)}, ${escapeSQL(res.description)},
      ${escapeSQL(res.unit)}, ${res.createdAt}, ${res.pinned}, 'public'
    );
  `);
}

const sqlOutput = statements.map(s => s.trim()).join('\n\n');
const outPath = path.join(__dirname, 'seed-demo.sql');
fs.writeFileSync(outPath, sqlOutput, 'utf8');
console.log(`Generated SQL with ${statements.length} statements at ${outPath}`);
