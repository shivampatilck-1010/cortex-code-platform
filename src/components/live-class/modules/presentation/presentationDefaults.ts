import { PresentationDeck, Slide } from '@/types/presentation';

export const DEFAULT_SLIDES: Slide[] = [
  {
    id: 'slide_avl_01',
    title: 'Self-Balancing Binary Search Trees',
    subtitle: 'Lecture 14 — AVL Tree Invariants and Rotations',
    bullets: [
      'Standard BST worst-case lookup degrades to O(n) on sorted insertions.',
      'AVL invariant: For every node, height difference between left and right subtrees is at most 1.',
      'Rebalancing is achieved through local pointer rotations in O(1) time.',
    ],
    diagramTitle: 'Balance Factor Calculation: BF(node) = height(left) - height(right)',
    presenterNotes:
      'Emphasize the motivation: why an unbalanced BST causes performance degradation. Ask the class what the worst-case insertion order is (e.g. monotonically increasing sequence).',
    annotations: { strokes: [] },
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    id: 'slide_avl_02',
    title: 'The Four Imbalance Scenarios',
    subtitle: 'Classifying BST balance violations',
    bullets: [
      'Left-Left (LL): Single Right Rotation at node k2.',
      'Right-Right (RR): Single Left Rotation at node k1.',
      'Left-Right (LR): Left rotation on child followed by Right rotation on parent.',
      'Right-Left (RL): Right rotation on child followed by Left rotation on parent.',
    ],
    codeSnippet: 'BF in {-1, 0, +1} -> Invariant satisfied\nBF > 1 or BF < -1 -> Rotation required',
    presenterNotes:
      'Walk through the symmetry between LL and RR rotations. Clarify that double rotations (LR and RL) require two discrete pointer transformation steps.',
    annotations: { strokes: [] },
    createdAt: 1700000001000,
    updatedAt: 1700000001000,
  },
  {
    id: 'slide_avl_03',
    title: 'Right Rotation Algorithm Mechanics',
    subtitle: 'Pointer manipulation and height recalculation',
    bullets: [
      'Node x becomes the new subtree root.',
      'Subtree T2 moves from right of x to become left child of y.',
      'Node y becomes right child of x.',
      'Height updates must occur from deepest modified node upwards.',
    ],
    diagramTitle: 'Structural Invariant: Keys in T2 satisfy key(x) < key(T2) < key(y)',
    presenterNotes:
      'Highlight how the BST ordering property is preserved: keys in T2 are strictly greater than x and strictly less than y. This invariant never breaks.',
    annotations: { strokes: [] },
    createdAt: 1700000002000,
    updatedAt: 1700000002000,
  },
  {
    id: 'slide_avl_04',
    title: 'Asymptotic Complexity Analysis',
    subtitle: 'Time and space guarantees across operations',
    bullets: [
      'Search Operation: O(log n) guaranteed.',
      'Insertion Operation: O(log n) with at most 2 rotations.',
      'Deletion Operation: O(log n) with at most O(log n) rotations along ancestor path.',
      'Space Complexity: O(1) auxiliary overhead beyond tree nodes.',
    ],
    presenterNotes:
      'Compare AVL height upper bound (approximately 1.44 log2 n) with Red-Black tree height bound (2 log2 n). AVL is more rigidly balanced and better for search-heavy workloads.',
    annotations: { strokes: [] },
    createdAt: 1700000003000,
    updatedAt: 1700000003000,
  },
];

export const DEFAULT_PRESENTATION_DECK: PresentationDeck = {
  id: 'deck_cs201_avl_trees',
  title: 'CS 201: AVL Trees and Rotations',
  author: 'Prof. Shivam Patil',
  courseCode: 'CS-201',
  slides: DEFAULT_SLIDES,
  activeSlideId: 'slide_avl_01',
  version: 1,
  updatedAt: 1700000004000,
};

export const createNewBlankSlide = (slideNumber: number): Slide => {
  const timestamp = Date.now();
  const id = `slide_${timestamp.toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
  return {
    id,
    title: `New Slide ${slideNumber}`,
    subtitle: 'Enter subtitle or topic summary',
    bullets: ['Click to edit bullet point or add key concepts.'],
    presenterNotes: 'Speaker notes for this slide (only visible to the presenter).',
    annotations: { strokes: [] },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};
