import { Assignment, AssignmentSubmission } from '@/types/assignments';

export const DEFAULT_ASSIGNMENTS: Assignment[] = [
  {
    id: 'lab-04',
    title: 'Lab 04: Implement AVL Left-Right (LR) Double Rotation',
    dueTime: 'End of Lecture (Today 16:30)',
    deadlineTimestamp: Date.now() + 4 * 3600 * 1000,
    points: 100,
    difficulty: 'Medium',
    category: 'Balanced Trees',
    description:
      'Given an AVL tree with a Left-Right balance violation where the left child of node Z has a balance factor of -1, implement rotateLeftRight(Node* z). Verify that all subtree invariants and balance heights are maintained in O(1) time complexity.',
    instructions:
      '1. Implement rotateLeft(z->left) to convert the LR violation into an LL violation.\n2. Implement rotateRight(z) around root node z.\n3. Recalculate heights for node z and its new parent.\n4. Return the new subtree root node pointer.',
    starterLanguage: 'C++17',
    starterCode: `// Lab 04: AVL Left-Right Double Rotation
#include <iostream>
#include <algorithm>

struct Node {
    int key;
    Node* left;
    Node* right;
    int height;
    Node(int k) : key(k), left(nullptr), right(nullptr), height(1) {}
};

int getHeight(Node* n) {
    return n ? n->height : 0;
}

Node* rotateLeft(Node* x) {
    Node* y = x->right;
    x->right = y->left;
    y->left = x;
    x->height = 1 + std::max(getHeight(x->left), getHeight(x->right));
    y->height = 1 + std::max(getHeight(y->left), getHeight(y->right));
    return y;
}

Node* rotateRight(Node* y) {
    Node* x = y->left;
    y->left = x->right;
    x->right = y;
    y->height = 1 + std::max(getHeight(y->left), getHeight(y->right));
    x->height = 1 + std::max(getHeight(x->left), getHeight(x->right));
    return x;
}

Node* rotateLeftRight(Node* z) {
    // TODO: Perform double rotation
    z->left = rotateLeft(z->left);
    return rotateRight(z);
}
`,
    status: 'published',
    testCases: [
      { id: 1, name: 'Basic LR Insertion', input: 'insert([10, 5, 8])', expectedOutput: 'Root key 8, BF 0', runtimeMs: 4 },
      { id: 2, name: 'Mid-sized Subtree Balance', input: 'insert([30, 10, 20])', expectedOutput: 'Root key 20, BF 0', runtimeMs: 6 },
      { id: 3, name: 'Deep Subtree Height Check', input: 'deepSubtreeTest([50, 20, 60, 10, 30, 25])', expectedOutput: 'Subtree 25 balanced, Height 3', runtimeMs: 9 },
    ],
    rubricCriteria: [
      { id: 'crit-1', title: 'Subtree Pointer Preservation', maxPoints: 40, description: 'Correctly reassigns orphaned subtrees without memory leaks.' },
      { id: 'crit-2', title: 'Height Recalculation', maxPoints: 30, description: 'Updates height attributes bottom-up accurately.' },
      { id: 'crit-3', title: 'Time Complexity Guarantee', maxPoints: 30, description: 'Executes rotations in strict O(1) time.' },
    ],
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 3600000,
  },
  {
    id: 'lab-03',
    title: 'Lab 03: Quadratic Probing Hash Table Invariants',
    dueTime: 'Completed Yesterday',
    deadlineTimestamp: Date.now() - 86400000,
    points: 100,
    difficulty: 'Easy',
    category: 'Hashing',
    description:
      'Implement quadratic probing collision resolution with formula h(k, i) = (h(k) + c1*i + c2*i^2) mod m. Ensure table size remains prime.',
    instructions:
      '1. Compute primary hash code h(k) = k % m.\n2. Iterate probe sequence index i from 0 up to m.\n3. Return the resolved slot index sequence until empty bucket found.',
    starterLanguage: 'Python 3.11',
    starterCode: `# Lab 03: Quadratic Probing Hash Table
def probeSequence(key: int, m: int, c1: int = 1, c2: int = 3) -> list[int]:
    h0 = key % m
    sequence = []
    for i in range(4):
        slot = (h0 + c1 * i + c2 * (i ** 2)) % m
        sequence.append(slot)
    return sequence
`,
    status: 'published',
    testCases: [
      { id: 1, name: 'Standard Quadratic Sequence', input: 'probeSequence(key=42, m=17)', expectedOutput: 'Indices [8, 10, 14, 3]', runtimeMs: 3 },
    ],
    rubricCriteria: [
      { id: 'crit-1', title: 'Formula Adherence', maxPoints: 60, description: 'Follows quadratic expansion parameters.' },
      { id: 'crit-2', title: 'Modulo Bounds Verification', maxPoints: 40, description: 'All indices stay strictly within 0 <= idx < m.' },
    ],
    createdAt: Date.now() - 172800000,
    updatedAt: Date.now() - 86400000,
  },
  {
    id: 'lab-05',
    title: 'Lab 05: Red-Black Tree Invariant Checker',
    dueTime: 'Next Lecture (Thursday 14:00)',
    deadlineTimestamp: Date.now() + 72 * 3600 * 1000,
    points: 100,
    difficulty: 'Hard',
    category: 'Balanced Trees',
    description:
      'Author a runtime verifier that checks all 5 Red-Black properties on a given binary tree: root is black, no consecutive red nodes, and uniform black height along all root-to-leaf paths.',
    instructions:
      '1. Check that root is not null and root.color === BLACK.\n2. Recursively verify that if a node is RED, both children are BLACK.\n3. Count black nodes along all paths and assert uniformity.',
    starterLanguage: 'TypeScript',
    starterCode: `// Lab 05: Red-Black Tree Validator
interface RBNode {
  key: number;
  color: 'RED' | 'BLACK';
  left: RBNode | null;
  right: RBNode | null;
}

export function validateRedBlack(root: RBNode | null): { valid: boolean; blackHeight: number } {
  if (!root) return { valid: true, blackHeight: 0 };
  if (root.color !== 'BLACK') return { valid: false, blackHeight: -1 };
  
  // TODO: Verify no consecutive reds and compute black height
  return { valid: true, blackHeight: 2 };
}
`,
    status: 'draft',
    testCases: [
      { id: 1, name: 'Root Color Invariant', input: 'validateRedBlack(RedRootTree)', expectedOutput: 'valid: false', runtimeMs: 2 },
      { id: 2, name: 'Valid Balanced RB-Tree', input: 'validateRedBlack(SampleRBTree)', expectedOutput: 'valid: true, blackHeight: 3', runtimeMs: 5 },
    ],
    rubricCriteria: [
      { id: 'crit-1', title: 'Black Height Completeness', maxPoints: 50, description: 'Verifies uniform black depth.' },
      { id: 'crit-2', title: 'Consecutive Red Guard', maxPoints: 50, description: 'Catches violations where red has red child.' },
    ],
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 1800000,
  },
];

export const DEFAULT_SUBMISSIONS: AssignmentSubmission[] = [
  {
    id: 'sub_alex_lab04_1',
    assignmentId: 'lab-04',
    studentId: 'usr_student_alex',
    studentName: 'Alex Chen',
    studentEmail: 'alex.chen@student.cortex.edu',
    attemptNumber: 1,
    code: `Node* rotateLeftRight(Node* z) {\n    z->left = rotateLeft(z->left);\n    return rotateRight(z);\n}`,
    language: 'C++17',
    testResults: [
      { id: 1, passed: true, input: 'insert([10, 5, 8])', expectedOutput: 'Root key 8, BF 0', actualOutput: 'Root key 8, BF 0', runtimeMs: 4 },
      { id: 2, passed: true, input: 'insert([30, 10, 20])', expectedOutput: 'Root key 20, BF 0', actualOutput: 'Root key 20, BF 0', runtimeMs: 6 },
      { id: 3, passed: true, input: 'deepSubtreeTest([50, 20, 60, 10, 30, 25])', expectedOutput: 'Subtree 25 balanced, Height 3', actualOutput: 'Subtree 25 balanced, Height 3', runtimeMs: 9 },
    ],
    status: 'submitted',
    score: 100,
    maxScore: 100,
    submittedAt: Date.now() - 7200000,
  },
  {
    id: 'sub_sophia_lab04_1',
    assignmentId: 'lab-04',
    studentId: 'usr_student_sophia',
    studentName: 'Sophia Patel',
    studentEmail: 'sophia.patel@student.cortex.edu',
    attemptNumber: 1,
    code: `Node* rotateLeftRight(Node* z) {\n    z->left = rotateLeft(z->left);\n    return rotateRight(z);\n}`,
    language: 'C++17',
    testResults: [
      { id: 1, passed: true, input: 'insert([10, 5, 8])', expectedOutput: 'Root key 8, BF 0', actualOutput: 'Root key 8, BF 0', runtimeMs: 4 },
      { id: 2, passed: true, input: 'insert([30, 10, 20])', expectedOutput: 'Root key 20, BF 0', actualOutput: 'Root key 20, BF 0', runtimeMs: 5 },
      { id: 3, passed: true, input: 'deepSubtreeTest([50, 20, 60, 10, 30, 25])', expectedOutput: 'Subtree 25 balanced, Height 3', actualOutput: 'Subtree 25 balanced, Height 3', runtimeMs: 8 },
    ],
    status: 'graded',
    score: 95,
    maxScore: 100,
    submittedAt: Date.now() - 14400000,
    gradedAt: Date.now() - 3600000,
    teacherFeedback: 'Flawless rotation logic. Minor point deduction for missing height null-check assertion in edge cases.',
    rubricScores: {
      'crit-1': 40,
      'crit-2': 25,
      'crit-3': 30,
    },
  },
  {
    id: 'sub_marcus_lab03_1',
    assignmentId: 'lab-03',
    studentId: 'usr_student_marcus',
    studentName: 'Marcus Vance',
    studentEmail: 'marcus.vance@student.cortex.edu',
    attemptNumber: 1,
    code: `def probeSequence(key: int, m: int, c1: int = 1, c2: int = 3):\n    return [(key % m + c1 * i + c2 * i**2) % m for i in range(4)]`,
    language: 'Python 3.11',
    testResults: [
      { id: 1, passed: true, input: 'probeSequence(key=42, m=17)', expectedOutput: 'Indices [8, 10, 14, 3]', actualOutput: 'Indices [8, 10, 14, 3]', runtimeMs: 3 },
    ],
    status: 'graded',
    score: 100,
    maxScore: 100,
    submittedAt: Date.now() - 86400000,
    gradedAt: Date.now() - 82800000,
    teacherFeedback: 'Clean Pythonic list comprehension. Meets all probing criteria.',
    rubricScores: {
      'crit-1': 60,
      'crit-2': 40,
    },
  },
];

export const createBlankAssignment = (customId?: string): Assignment => {
  const now = Date.now();
  const id = customId || `assignment_${now.toString(36)}`;
  return {
    id,
    title: 'New Coding Lab Assignment',
    dueTime: 'End of Lecture',
    deadlineTimestamp: now + 24 * 3600 * 1000,
    points: 100,
    difficulty: 'Medium',
    category: 'Algorithms',
    description: 'Implement the requested algorithmic routine and maintain all documented invariants.',
    instructions: 'Write your solution in the designated function and test against all verification cases.',
    starterLanguage: 'TypeScript',
    starterCode: `// Implement your solution below\nexport function solve(input: any): any {\n  return input;\n}\n`,
    status: 'draft',
    testCases: [
      { id: 1, name: 'Sample Test Case', input: 'solve([1, 2, 3])', expectedOutput: '[1, 2, 3]', runtimeMs: 5 },
    ],
    rubricCriteria: [
      { id: 'crit-1', title: 'Correctness', maxPoints: 70, description: 'Solution passes all test cases.' },
      { id: 'crit-2', title: 'Code Quality', maxPoints: 30, description: 'Clean idiomatic implementation.' },
    ],
    createdAt: now,
    updatedAt: now,
  };
};
