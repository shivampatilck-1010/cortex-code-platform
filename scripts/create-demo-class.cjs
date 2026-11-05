const fs = require('fs');
const path = require('path');

const classroomId = 'CLS_DEMO_DSA_2026';
const joinCode = 'CORTEX26';
const teacherId = 'usr_mvlwemxk12ink';
const teacherName = 'shivam';
const teacherEmail = 'shivampatilcka@gmail.com';

const now = Date.now();
const oneHour = 3600 * 1000;
const oneDay = 24 * 3600 * 1000;

function escapeSQL(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 1 : 0;
  return `'${String(val).replace(/'/g, "''")}'`;
}

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

const statements = [];

// 1. Ensure students exist in users table
for (const s of students) {
  statements.push(`
    INSERT OR REPLACE INTO users (id, name, email, cortex_id, role, status, created_at, updated_at)
    VALUES (${escapeSQL(s.id)}, ${escapeSQL(s.name)}, ${escapeSQL(s.email)}, ${escapeSQL(s.cortexId)}, 'student', 'active', ${s.joinedAt}, ${now});
  `);
}

// 2. Classroom definition
const classroomSettings = {
  allowStudentPosting: true,
  allowStudentMessaging: true,
  allowCodeSharing: true,
  leaderboardEnabled: true,
  defaultAIPolicy: 'hints_only',
};

statements.push(`
  INSERT OR REPLACE INTO classrooms (
    id, name, subject, description, course_code, academic_year, section,
    teacher_id, teacher_name, join_code, join_enabled, status, created_at, updated_at, settings_json
  ) VALUES (
    ${escapeSQL(classroomId)},
    'CS 201: Data Structures and Algorithms',
    'Computer Science',
    'Comprehensive algorithmic laboratory covering linear structures, binary search trees, graph algorithms, and competitive programming with real-time automated evaluation.',
    'CS-201',
    '2026-2027',
    'Sec 01',
    ${escapeSQL(teacherId)},
    ${escapeSQL(teacherName)},
    ${escapeSQL(joinCode)},
    1,
    'active',
    ${now - 7 * oneDay},
    ${now},
    ${escapeSQL(JSON.stringify(classroomSettings))}
  );
`);

// 3. Register teacher and students as classroom members
statements.push(`
  INSERT OR REPLACE INTO classroom_members (
    id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online
  ) VALUES (
    ${escapeSQL(`mem_${classroomId}_${teacherId}`)},
    ${escapeSQL(classroomId)},
    ${escapeSQL(teacherId)},
    ${escapeSQL(teacherName)},
    ${escapeSQL(teacherEmail)},
    'teacher',
    'active',
    ${now - 7 * oneDay},
    ${now},
    1
  );
`);

for (const s of students) {
  statements.push(`
    INSERT OR REPLACE INTO classroom_members (
      id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online
    ) VALUES (
      ${escapeSQL(`mem_${classroomId}_${s.id}`)},
      ${escapeSQL(classroomId)},
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

// 4. Announcements (includes author_role)
const announcements = [
  {
    id: 'ann_demo_welcome',
    title: 'Welcome to CS 201: Algorithmic Systems & Data Structures',
    content: 'Welcome everyone to the demo classroom. In this course, we examine algorithmic efficiency, time and space complexity, and advanced data structures using the Cortex collaborative execution environment.\n\nPlease inspect the assignments tab for open labs and review the reference guides in Resources.',
    pinned: 1,
    createdAt: now - 3 * oneDay,
  },
  {
    id: 'ann_demo_lab1',
    title: 'Lab Assignment 1: Two Sum Hash Map Optimization Published',
    content: 'The first coding assignment is open. Implement twoSum with O(n) linear time complexity.\n\nMake sure your solution handles negative numbers, duplicate elements, and large inputs. Both public and hidden test cases are executed automatically.',
    pinned: 0,
    createdAt: now - 2 * oneDay,
  },
  {
    id: 'ann_demo_bst',
    title: 'Lab Assignment 2: Binary Search Tree Validation in C++',
    content: 'The C++ BST verification lab is published. Implement isValidBST verifying recursive lower and upper bounds.\n\nReview starter code and test suite in the assignment solver.',
    pinned: 0,
    createdAt: now - 1 * oneDay,
  },
];

for (const ann of announcements) {
  statements.push(`
    INSERT OR REPLACE INTO announcements (
      id, classroom_id, author_id, author_name, author_role, title, content, pinned, created_at, updated_at
    ) VALUES (
      ${escapeSQL(ann.id)},
      ${escapeSQL(classroomId)},
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

// 5. Class discussion messages
const classMessages = [
  {
    id: 'msg_dsa_1',
    sender: students[0],
    role: 'student',
    content: 'For the BST validation problem, should we use in-order traversal or range-based recursion with min and max bounds?',
    createdAt: now - (20 * oneHour),
  },
  {
    id: 'msg_dsa_2',
    sender: students[1],
    role: 'student',
    content: 'Range recursion with long long bounds prevents integer overflow on INT_MAX and INT_MIN edge cases.',
    createdAt: now - (19 * oneHour),
  },
  {
    id: 'msg_dsa_3',
    sender: { id: teacherId, name: teacherName },
    role: 'teacher',
    content: 'Excellent observation Sophia. Using long long for bounds handles edge tests where node values equal INT_MIN or INT_MAX.',
    createdAt: now - (18 * oneHour),
  },
  {
    id: 'msg_dsa_4',
    sender: students[2],
    role: 'student',
    content: 'Just ran the test runner on Lab 1 and passed all public and hidden cases in 35ms.',
    createdAt: now - (10 * oneHour),
  },
  {
    id: 'msg_dsa_5',
    sender: students[3],
    role: 'student',
    content: 'The dual workspace split view is very helpful for comparing recursive implementations.',
    createdAt: now - (3 * oneHour),
  },
];

for (const m of classMessages) {
  statements.push(`
    INSERT OR REPLACE INTO messages (
      id, classroom_id, sender_id, sender_name, sender_role, recipient_type, recipient_id, content, created_at, updated_at
    ) VALUES (
      ${escapeSQL(m.id)},
      ${escapeSQL(classroomId)},
      ${escapeSQL(m.sender.id)},
      ${escapeSQL(m.sender.name)},
      ${escapeSQL(m.role)},
      'class',
      NULL,
      ${escapeSQL(m.content)},
      ${m.createdAt},
      ${m.createdAt}
    );
  `);
}

// 6. Direct Messages
const directMessages = [
  {
    id: 'dm_dsa_1',
    sender: students[0],
    senderRole: 'student',
    recipientId: teacherId,
    content: 'Professor, I submitted Assignment 1. Would you recommend unordered_map or two-pointer approach when the input array is already sorted?',
    createdAt: now - (14 * oneHour),
  },
  {
    id: 'dm_dsa_2',
    sender: { id: teacherId, name: teacherName },
    senderRole: 'teacher',
    recipientId: students[0].id,
    content: 'If the array is already sorted, the two-pointer technique achieves O(1) auxiliary space without hash map overhead.',
    createdAt: now - (13 * oneHour),
  },
];

for (const dm of directMessages) {
  statements.push(`
    INSERT OR REPLACE INTO messages (
      id, classroom_id, sender_id, sender_name, sender_role, recipient_type, recipient_id, content, created_at, updated_at
    ) VALUES (
      ${escapeSQL(dm.id)},
      ${escapeSQL(classroomId)},
      ${escapeSQL(dm.sender.id)},
      ${escapeSQL(dm.sender.name)},
      ${escapeSQL(dm.senderRole)},
      'direct',
      ${escapeSQL(dm.recipientId)},
      ${escapeSQL(dm.content)},
      ${dm.createdAt},
      ${dm.createdAt}
    );
  `);
}

// 7. Comprehensive Assignments (Python and C++)
const assignments = [
  {
    id: 'asg_demo_twosum',
    title: 'Two Sum: Hash Map Optimization',
    description: 'Find indices of two numbers such that they add up to a specific target.',
    instructions: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nYou may assume each input has exactly one solution, and you may not use the same element twice.\n\nTarget Complexity:\n- Time Complexity: O(n)\n- Space Complexity: O(n)',
    type: 'coding',
    language: 'python',
    starterCode: `def two_sum(nums: list[int], target: int) -> list[int]:
    """
    Find indices of two numbers that add up to target.
    """
    # Your implementation here
    pass
`,
    difficulty: 'Easy',
    maxMarks: 100,
    dueAt: now + 7 * oneDay,
    publishedAt: now - 3 * oneDay,
    attemptsAllowed: 5,
    allowLateSubmission: 1,
    latePenaltyPercent: 10,
    autoGrade: 1,
    manualGrade: 1,
    aiPolicy: 'hints_only',
    plagiarismPolicy: 'review_only',
    status: 'published',
    createdBy: teacherId,
    createdAt: now - 3 * oneDay,
    updatedAt: now - 3 * oneDay,
    testCases: [
      { id: 'tc1', name: 'Standard Case', input: '[2, 7, 11, 15], 9', expectedOutput: '[0, 1]', isHidden: false, weight: 25, timeoutMs: 2000 },
      { id: 'tc2', name: 'Negative Numbers', input: '[-3, 4, 3, 90], 0', expectedOutput: '[0, 2]', isHidden: false, weight: 25, timeoutMs: 2000 },
      { id: 'tc3', name: 'Duplicate Values', input: '[3, 3], 6', expectedOutput: '[0, 1]', isHidden: false, weight: 25, timeoutMs: 2000 },
      { id: 'tc4', name: 'Large Array Stress Test', input: '[1, 2, ..., 10000], 19999', expectedOutput: '[9998, 9999]', isHidden: true, weight: 25, timeoutMs: 2000 },
    ],
    rubric: [
      { id: 'correctness', name: 'Functional Correctness', maxPoints: 50, description: 'Passes all edge cases including negative numbers and duplicates.' },
      { id: 'efficiency', name: 'Time and Space Complexity', maxPoints: 30, description: 'O(n) linear execution achieved via hash map lookup.' },
      { id: 'style', name: 'Clean Code and Types', maxPoints: 20, description: 'Clear naming and proper return types.' },
    ],
  },
  {
    id: 'asg_demo_bst',
    title: 'Validate Binary Search Tree in C++',
    description: 'Determine if a binary tree satisfies the Binary Search Tree invariant.',
    instructions: 'Given the root of a binary tree, determine if it is a valid binary search tree.\n\nA valid BST satisfies:\n1. The left subtree contains only nodes with keys strictly less than the node key.\n2. The right subtree contains only nodes with keys strictly greater than the node key.\n3. Both left and right subtrees must also be binary search trees.',
    type: 'coding',
    language: 'cpp',
    starterCode: `#include <iostream>
#include <climits>

struct TreeNode {
    int val;
    TreeNode *left;
    TreeNode *right;
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
};

class Solution {
public:
    bool isValidBST(TreeNode* root) {
        // Your recursive implementation here
        return true;
    }
};
`,
    difficulty: 'Medium',
    maxMarks: 100,
    dueAt: now + 10 * oneDay,
    publishedAt: now - 2 * oneDay,
    attemptsAllowed: 3,
    allowLateSubmission: 1,
    latePenaltyPercent: 15,
    autoGrade: 1,
    manualGrade: 1,
    aiPolicy: 'hints_only',
    plagiarismPolicy: 'review_only',
    status: 'published',
    createdBy: teacherId,
    createdAt: now - 2 * oneDay,
    updatedAt: now - 2 * oneDay,
    testCases: [
      { id: 'tc1', name: 'Valid Three Node Tree', input: '[2, 1, 3]', expectedOutput: 'true', isHidden: false, weight: 25, timeoutMs: 2000 },
      { id: 'tc2', name: 'Invalid Right Subtree Violation', input: '[5, 1, 4, null, null, 3, 6]', expectedOutput: 'false', isHidden: false, weight: 25, timeoutMs: 2000 },
      { id: 'tc3', name: 'Single Node Tree', input: '[1]', expectedOutput: 'true', isHidden: true, weight: 25, timeoutMs: 2000 },
      { id: 'tc4', name: 'Integer Boundary Overflows', input: '[2147483647]', expectedOutput: 'true', isHidden: true, weight: 25, timeoutMs: 2000 },
    ],
    rubric: [
      { id: 'correctness', name: 'BST Invariant Verification', maxPoints: 50, description: 'Correctly verifies subtree bounds across arbitrary tree depths.' },
      { id: 'bounds', name: 'Integer Boundary Handling', maxPoints: 30, description: 'Safely handles INT_MIN and INT_MAX node values.' },
      { id: 'modularity', name: 'Helper Recursion Structure', maxPoints: 20, description: 'Clean helper function structure.' },
    ],
  },
  {
    id: 'asg_demo_merge_k',
    title: 'Merge K Sorted Lists in C++',
    description: 'Merge k sorted linked lists and return it as one sorted list.',
    instructions: 'You are given an array of k linked-lists lists, each linked-list is sorted in ascending order.\n\nMerge all the linked-lists into one sorted linked-list and return it.\n\nTarget Complexity: O(N log k) where N is the total number of nodes across all lists and k is the number of lists.',
    type: 'coding',
    language: 'cpp',
    starterCode: `#include <iostream>
#include <vector>
#include <queue>

struct ListNode {
    int val;
    ListNode *next;
    ListNode(int x) : val(x), next(nullptr) {}
};

class Solution {
public:
    ListNode* mergeKLists(std::vector<ListNode*>& lists) {
        // Implement using min-priority_queue
        return nullptr;
    }
};
`,
    difficulty: 'Hard',
    maxMarks: 100,
    dueAt: now + 14 * oneDay,
    publishedAt: now - 1 * oneDay,
    attemptsAllowed: 3,
    allowLateSubmission: 0,
    latePenaltyPercent: 0,
    autoGrade: 1,
    manualGrade: 1,
    aiPolicy: 'hints_only',
    plagiarismPolicy: 'review_only',
    status: 'published',
    createdBy: teacherId,
    createdAt: now - 1 * oneDay,
    updatedAt: now - 1 * oneDay,
    testCases: [
      { id: 'tc1', name: 'Three Standard Lists', input: '[[1,4,5],[1,3,4],[2,6]]', expectedOutput: '[1,1,2,3,4,4,5,6]', isHidden: false, weight: 25, timeoutMs: 2000 },
      { id: 'tc2', name: 'Empty List Array', input: '[]', expectedOutput: '[]', isHidden: false, weight: 25, timeoutMs: 2000 },
      { id: 'tc3', name: 'Array of Empty Lists', input: '[[]]', expectedOutput: '[]', isHidden: true, weight: 25, timeoutMs: 2000 },
      { id: 'tc4', name: 'K Equal 50 Large Scale Test', input: '50 sorted lists with 100 elements each', expectedOutput: 'sorted concatenation', isHidden: true, weight: 25, timeoutMs: 3000 },
    ],
    rubric: [
      { id: 'correctness', name: 'Sorting and Pointer Integrity', maxPoints: 50, description: 'Correctly links nodes without cycle creation.' },
      { id: 'complexity', name: 'Heap Optimization', maxPoints: 30, description: 'Runs in O(N log k) time complexity.' },
      { id: 'memory', name: 'No Leaks or Dangling Pointers', maxPoints: 20, description: 'Efficient in-place node relinking.' },
    ],
  },
  {
    id: 'asg_demo_sliding_window',
    title: 'Longest Substring Without Repeating Characters',
    description: 'Find the length of the longest substring without repeating characters.',
    instructions: 'Given a string s, find the length of the longest substring without repeating characters.\n\nTarget Complexity: O(n) runtime with O(min(m, n)) auxiliary space.',
    type: 'coding',
    language: 'python',
    starterCode: `def length_of_longest_substring(s: str) -> int:
    """
    Find length of the longest substring without duplicate characters.
    """
    # Your sliding window implementation here
    pass
`,
    difficulty: 'Medium',
    maxMarks: 100,
    dueAt: now + 5 * oneDay,
    publishedAt: now - 2 * oneDay,
    attemptsAllowed: 5,
    allowLateSubmission: 1,
    latePenaltyPercent: 5,
    autoGrade: 1,
    manualGrade: 1,
    aiPolicy: 'hints_only',
    plagiarismPolicy: 'review_only',
    status: 'published',
    createdBy: teacherId,
    createdAt: now - 2 * oneDay,
    updatedAt: now - 2 * oneDay,
    testCases: [
      { id: 'tc1', name: 'Standard Alternating String', input: '"abcabcbb"', expectedOutput: '3', isHidden: false, weight: 25, timeoutMs: 2000 },
      { id: 'tc2', name: 'All Identical Characters', input: '"bbbbb"', expectedOutput: '1', isHidden: false, weight: 25, timeoutMs: 2000 },
      { id: 'tc3', name: 'Subsequence vs Substring', input: '"pwwkew"', expectedOutput: '3', isHidden: false, weight: 25, timeoutMs: 2000 },
      { id: 'tc4', name: 'Empty String Boundary', input: '""', expectedOutput: '0', isHidden: true, weight: 25, timeoutMs: 2000 },
    ],
    rubric: [
      { id: 'correctness', name: 'Window Tracking Correctness', maxPoints: 50, description: 'Correct substring length across all edge inputs.' },
      { id: 'performance', name: 'Linear Sliding Window', maxPoints: 30, description: 'Two pointer sliding window with index dictionary.' },
      { id: 'edge', name: 'Empty and Single Character Handling', maxPoints: 20, description: 'Proper base cases.' },
    ],
  },
];

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

// 8. Submissions and Gradebook records
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
    status: 'graded',
    submittedAt: now - (1 * oneDay + 4 * oneHour),
    score: 100,
    maxScore: 100,
    isLate: 0,
    testResults: {
      passed: 4,
      total: 4,
      runtimeMs: 42,
      memoryMb: 14.2,
      details: [
        { testCaseId: 'tc1', passed: true, runtimeMs: 8, output: '[0, 1]' },
        { testCaseId: 'tc2', passed: true, runtimeMs: 9, output: '[0, 2]' },
        { testCaseId: 'tc3', passed: true, runtimeMs: 11, output: '[0, 1]' },
        { testCaseId: 'tc4', passed: true, runtimeMs: 14, output: '[9998, 9999]' },
      ],
    },
    grade: {
      id: 'grd_demo_alex_twosum',
      automaticScore: 100,
      manualAdjustment: 0,
      finalScore: 100,
      gradedBy: teacherId,
      gradedByName: teacherName,
      gradedAt: now - 1 * oneDay,
      rubricScores: { correctness: 50, efficiency: 30, style: 20 },
    },
    feedback: {
      id: 'fb_demo_alex_twosum',
      content: 'Excellent implementation. The single-pass dictionary lookup achieves optimal linear execution.',
      createdAt: now - 1 * oneDay,
    },
  },
  {
    id: 'sub_demo_sophia_bst',
    assignmentId: 'asg_demo_bst',
    assignmentTitle: 'Validate Binary Search Tree in C++',
    studentId: students[1].id,
    studentName: students[1].name,
    code: `#include <iostream>
#include <climits>

struct TreeNode {
    int val;
    TreeNode *left;
    TreeNode *right;
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
};

class Solution {
private:
    bool validate(TreeNode* node, long long minVal, long long maxVal) {
        if (!node) return true;
        if (node->val <= minVal || node->val >= maxVal) return false;
        return validate(node->left, minVal, node->val) &&
               validate(node->right, node->val, maxVal);
    }
public:
    bool isValidBST(TreeNode* root) {
        return validate(root, LLONG_MIN, LLONG_MAX);
    }
};
`,
    language: 'cpp',
    version: 1,
    status: 'graded',
    submittedAt: now - 18 * oneHour,
    score: 100,
    maxScore: 100,
    isLate: 0,
    testResults: {
      passed: 4,
      total: 4,
      runtimeMs: 12,
      memoryMb: 8.5,
      details: [
        { testCaseId: 'tc1', passed: true, runtimeMs: 3, output: 'true' },
        { testCaseId: 'tc2', passed: true, runtimeMs: 3, output: 'false' },
        { testCaseId: 'tc3', passed: true, runtimeMs: 2, output: 'true' },
        { testCaseId: 'tc4', passed: true, runtimeMs: 4, output: 'true' },
      ],
    },
    grade: {
      id: 'grd_demo_sophia_bst',
      automaticScore: 100,
      manualAdjustment: 0,
      finalScore: 100,
      gradedBy: teacherId,
      gradedByName: teacherName,
      gradedAt: now - 12 * oneHour,
      rubricScores: { correctness: 50, bounds: 30, modularity: 20 },
    },
    feedback: {
      id: 'fb_demo_sophia_bst',
      content: 'Clean recursive bounds validation with long long types to handle edge overflows.',
      createdAt: now - 12 * oneHour,
    },
  },
  {
    id: 'sub_demo_marcus_twosum',
    assignmentId: 'asg_demo_twosum',
    assignmentTitle: 'Two Sum: Hash Map Optimization',
    studentId: students[2].id,
    studentName: students[2].name,
    code: `def two_sum(nums: list[int], target: int) -> list[int]:
    # Brute force quadratic implementation
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]
    return []
`,
    language: 'python',
    version: 1,
    status: 'graded',
    submittedAt: now - 15 * oneHour,
    score: 75,
    maxScore: 100,
    isLate: 0,
    testResults: {
      passed: 3,
      total: 4,
      runtimeMs: 1850,
      memoryMb: 12.0,
      details: [
        { testCaseId: 'tc1', passed: true, runtimeMs: 5, output: '[0, 1]' },
        { testCaseId: 'tc2', passed: true, runtimeMs: 5, output: '[0, 2]' },
        { testCaseId: 'tc3', passed: true, runtimeMs: 6, output: '[0, 1]' },
        { testCaseId: 'tc4', passed: false, runtimeMs: 2100, error: 'Time Limit Exceeded (Stress Test)' },
      ],
    },
    grade: {
      id: 'grd_demo_marcus_twosum',
      automaticScore: 75,
      manualAdjustment: 0,
      finalScore: 75,
      gradedBy: teacherId,
      gradedByName: teacherName,
      gradedAt: now - 10 * oneHour,
      rubricScores: { correctness: 45, efficiency: 15, style: 15 },
    },
    feedback: {
      id: 'fb_demo_marcus_twosum',
      content: 'Solution passes initial cases but times out on the large scale stress test. Switch to a dictionary lookup to achieve O(n) complexity.',
      createdAt: now - 10 * oneHour,
    },
  },
  {
    id: 'sub_demo_elena_sliding',
    assignmentId: 'asg_demo_sliding_window',
    assignmentTitle: 'Longest Substring Without Repeating Characters',
    studentId: students[3].id,
    studentName: students[3].name,
    code: `def length_of_longest_substring(s: str) -> int:
    char_map = {}
    left = 0
    max_len = 0
    for right, ch in enumerate(s):
        if ch in char_map and char_map[ch] >= left:
            left = char_map[ch] + 1
        char_map[ch] = right
        max_len = max(max_len, right - left + 1)
    return max_len
`,
    language: 'python',
    version: 1,
    status: 'submitted',
    submittedAt: now - 2 * oneHour,
    score: 100,
    maxScore: 100,
    isLate: 0,
    testResults: {
      passed: 4,
      total: 4,
      runtimeMs: 38,
      memoryMb: 14.1,
      details: [
        { testCaseId: 'tc1', passed: true, runtimeMs: 8, output: '3' },
        { testCaseId: 'tc2', passed: true, runtimeMs: 7, output: '1' },
        { testCaseId: 'tc3', passed: true, runtimeMs: 9, output: '3' },
        { testCaseId: 'tc4', passed: true, runtimeMs: 6, output: '0' },
      ],
    },
  },
];

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
const resources = [
  {
    id: 'res_demo_big_o',
    name: 'Big-O Time and Space Complexity Cheat Sheet',
    type: 'link',
    url: 'https://en.wikipedia.org/wiki/Time_complexity',
    description: 'Reference guide for asymptotic complexity across sorting algorithms and linear structures.',
    unit: 'Unit 1: Foundations',
    pinned: 1,
    createdAt: now - 3 * oneDay,
  },
  {
    id: 'res_demo_cpp_stl',
    name: 'C++ STL Container Reference Guide',
    type: 'link',
    url: 'https://en.cppreference.com/w/cpp/container',
    description: 'Documentation for std::vector, std::priority_queue, std::unordered_map, and iterator patterns.',
    unit: 'Unit 2: Trees & Heaps',
    pinned: 1,
    createdAt: now - 2 * oneDay,
  },
  {
    id: 'res_demo_python_algorithms',
    name: 'Python Standard Library Collections and Heapq Primer',
    type: 'link',
    url: 'https://docs.python.org/3/library/collections.html',
    description: 'High-performance container datatypes in Python 3.11 including deque, Counter, and defaultdict.',
    unit: 'Unit 1: Foundations',
    pinned: 0,
    createdAt: now - 1 * oneDay,
  },
];

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

// Write to SQL file
const sqlOutput = statements.map(s => s.trim()).join('\n\n');
const outPath = path.join(__dirname, 'seed-demo-class.sql');
fs.writeFileSync(outPath, sqlOutput, 'utf8');
console.log(`Generated SQL with ${statements.length} statements at ${outPath}`);
