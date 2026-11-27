import type { Course } from '@/types/learn';

export const pythonDsaCourse: Course = {
  id: 'python-dsa',
  slug: 'python-dsa-mastery',
  title: 'Python & Data Structures Mastery',
  track: 'Python & DSA',
  category: 'Data Structures',
  level: 'Beginner',
  description:
    'Master core Python data structures, amortized complexity analysis, hash map lookup patterns, and stack/queue problem solving with interactive labs and timed exams.',
  estimatedHours: 6,
  instructor: 'OpenDSA Faculty',
  instructorInit: 'OF',
  featured: true,
  following: true,
  popularity: 98,
  publishedOrder: 5,
  poster: {
    gradient: 'from-[#181C24] via-[#1B2230] to-[#0F1218]',
    accentHex: '#F3912E',
    badge: 'PYTHON 3.14 · DSA',
    kicker: 'O(1) HASH & STACKS',
    headline: 'Arrays, Maps & Stacks',
    codeSnippet: 'seen[target - n] = i',
    motif: 'dsa',
  },
  attribution: {
    sourceName: 'Adapted from OpenDSA & Official Python Documentation',
    sourceUrl: 'https://opendsa-server.cs.vt.edu/',
    license: 'MIT / CC-BY-4.0',
  },
  modules: [
    {
      id: 'py-mod-arrays-hashmaps',
      title: 'Arrays & Hash Maps',
      summary:
        'Understand contiguous dynamic arrays, hash table indexing, collision handling, and O(n) complement lookup patterns.',
      items: [
        {
          id: 'py-m1-notes',
          type: 'notes',
          title: 'Dynamic Arrays, Hash Tables & Complement Lookups',
          readMins: 9,
          tldr: [
            'Python lists are dynamic arrays of object references offering O(1) index access and amortized O(1) append, but O(n) insertion or search in the middle.',
            'Python dicts are open-addressed hash tables that provide average O(1) key lookup, insertion, and deletion.',
            'Trading O(n) extra space for a hash map often reduces nested O(n^2) pair-search loops down to a single O(n) pass.',
          ],
          sections: [
            {
              id: 'contiguous-arrays',
              heading: 'How Python Lists Work Under the Hood',
              paragraphs: [
                'A Python list stores a contiguous block of pointers to elements in memory. Because elements sit at predictable byte offsets from the base pointer, indexing arr[i] takes constant O(1) time regardless of list length.',
                'When append() fills the allocated capacity, CPython allocates a larger contiguous buffer (roughly 1.125x plus a small constant) and copies the references over. Individual resizes cost O(n), yet doubling growth spreads that cost across many appends so append() remains amortized O(1). In contrast, insert(0, x) or pop(0) shifts every subsequent reference and costs O(n).',
              ],
              callout: {
                kind: 'pitfall',
                title: 'Hidden Quadratic Loops with pop(0) or "in list"',
                body: 'Checking `if x in seen_list` inside a loop scans linearly each iteration, turning an innocent-looking loop into O(n^2). Use a `set` or `dict` for membership checks inside loops.',
              },
            },
            {
              id: 'hash-tables-and-collisions',
              heading: 'Hash Tables, Keys & Amortized O(1) Lookup',
              paragraphs: [
                'A hash table maps any hashable (immutable) key through a hash function `hash(key)` to a bucket slot in an underlying array. Python dictionaries maintain a compact table alongside a sparse index array, preserving insertion order since Python 3.7 while keeping lookups fast.',
                'Two distinct keys can occasionally map to the same slot (a hash collision). Python resolves collisions using open addressing with pseudo-random probing. As long as the load factor stays bounded (CPython resizes at roughly 2/3 capacity), expected lookup, insert, and delete remain O(1), degrading to O(n) only under pathological hash collisions.',
              ],
              table: {
                headers: ['Operation', 'Python list', 'Python dict / set', 'Notes'],
                rows: [
                  ['Index / Key Lookup', 'O(1) by index', 'O(1) avg by key', 'Dict worst-case O(n) on heavy collisions'],
                  ['Membership Test (x in c)', 'O(n)', 'O(1) avg', 'Linear scan vs hash probe'],
                  ['Append / Insert Key', 'O(1) amortized', 'O(1) amortized', 'Dynamic table resizing'],
                  ['Insert / Delete at Front', 'O(n)', 'O(1) avg', 'Lists shift trailing pointers'],
                ],
              },
            },
            {
              id: 'complement-lookup-pattern',
              heading: 'The Complement Lookup Pattern (Two-Sum Intuition)',
              paragraphs: [
                'Many array problems ask whether two elements satisfy a relationship such as `a + b == target`. A brute-force nested loop compares every pair `(i, j)` in O(n^2) time.',
                'Rearranging the equation to `needed = target - current` turns pair discovery into a membership query. As you iterate left to right, check whether `needed` is already stored in a dictionary mapping `value -> index`. If found, you immediately have both indices without scanning backward; otherwise, record `seen[current] = index` and continue.',
              ],
              callout: {
                kind: 'complexity',
                title: 'Time vs. Space Trade-Off',
                body: 'Checking `complement in seen` before inserting the current element handles duplicate values (such as `[3, 3]` with target `6`) cleanly in O(n) time and O(n) auxiliary space.',
              },
              codeBlock: {
                filename: 'frequency_and_complement.py',
                language: 'python',
                runnableInIde: true,
                code: `def count_frequencies(words: list[str]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for word in words:
        counts[word] = counts.get(word, 0) + 1
    return counts


def has_pair_with_sum(nums: list[int], target: int) -> bool:
    seen: set[int] = set()
    for value in nums:
        if (target - value) in seen:
            return True
        seen.add(value)
    return False


sample_words = ["hash", "array", "hash", "map", "array", "hash"]
print("Frequencies:", count_frequencies(sample_words))
print("Has pair summing to 9:", has_pair_with_sum([2, 7, 11, 15], 9))
print("Has pair summing to 10:", has_pair_with_sum([2, 7, 11, 15], 10))
`,
              },
            },
          ],
          keyTakeaways: [
            'Use `list` for indexed sequences and `dict`/`set` whenever you need fast membership or key-value association.',
            'Avoid `x in list` and `list.pop(0)` inside loops; both cost O(n) per step.',
            'Store `seen[value] = index` while scanning once to solve complement pair problems in O(n) time.',
          ],
        },
        {
          id: 'py-m1-quiz',
          type: 'quiz',
          title: 'Concept Check: Arrays & Hash Maps',
          passScore: 75,
          questions: [
            {
              id: 'py-q1',
              prompt: 'What is the average time complexity of checking `if target - x in seen` when `seen` is a Python `dict` vs a Python `list`?',
              options: [
                'O(1) for dict, O(n) for list',
                'O(n) for dict, O(1) for list',
                'O(log n) for dict, O(n) for list',
                'O(1) for both dict and list',
              ],
              correctIndex: 0,
              explanation:
                'A Python dict hashes the key for O(1) average-case lookup, whereas `in` on a list performs a linear O(n) scan.',
            },
            {
              id: 'py-q2',
              prompt: 'Consider the function below. What happens when `nums = [3, 3]` and `target = 6`?',
              codeSnippet: {
                language: 'python',
                code: `def find_pair(nums, target):
    seen = {}
    for i, val in enumerate(nums):
        diff = target - val
        if diff in seen:
            return [seen[diff], i]
        seen[val] = i
    return []`,
              },
              options: [
                'It fails because 3 cannot be inserted twice into a dict.',
                'It returns [0, 1] because it checks `diff in seen` before overwriting `seen[3]`.',
                'It returns [0, 0] by reusing index 0.',
                'It raises a KeyError on the second iteration.',
              ],
              correctIndex: 1,
              explanation:
                'On i=0, 3 is not in `seen`, so `seen[3] = 0` is recorded. On i=1, `diff = 3` is already in `seen` at index 0, returning `[0, 1]`.',
            },
            {
              id: 'py-q3',
              prompt: 'Which Python type is invalid as a dictionary key because it is unhashable?',
              options: ['tuple of ints `(1, 2)`', 'str `"two-sum"`', 'list `[1, 2]`', 'int `42`'],
              correctIndex: 2,
              explanation:
                'Lists are mutable and define `__hash__ = None`, so attempting to use a list as a dict key raises `TypeError: unhashable type: \'list\'`.',
            },
            {
              id: 'py-q4',
              prompt: 'Why is `list.append(x)` amortized O(1) even though resizing the underlying array takes O(n)?',
              options: [
                'CPython stores list items in a linked list.',
                'Capacity grows geometrically so resizes become exponentially rarer as n increases.',
                'Python pre-allocates 1 million slots for every list.',
                'Appends bypass reference counting.',
              ],
              correctIndex: 1,
              explanation:
                'Geometric over-allocation means n appends trigger only O(log n) resizes whose total copied elements sum to O(n), averaging O(1) per append.',
            },
          ],
        },
        {
          id: 'py-m1-lab',
          type: 'lab',
          title: 'Lab: Two Sum with Hash Maps',
          estimatedMins: 20,
          language: 'python',
          ideProblemId: 'two-sum',
          objective:
            'Implement an O(n) single-pass hash map solution for Two Sum that reads space-separated integers and a target from standard input and prints `[i, j]`.',
          steps: [
            'Read `nums` and `target` from `sys.stdin` using the provided input parser.',
            'Initialize an empty dictionary mapping each visited number to its index.',
            'For each `(i, n)` in `enumerate(nums)`, compute `complement = target - n` and check if it exists in the dictionary before inserting `n`.',
            'Print `f"[{map[complement]}, {i}]"` and return immediately once a valid pair is found.',
            'Run all test cases in Cortex IDE (including duplicates and negative integers) and verify 100% pass.',
          ],
          starterCode: `# Lab: Two Sum
# Input format via stdin:
#   Line 1: space-separated integers (nums)
#   Line 2: integer target
import sys


def two_sum():
    lines = sys.stdin.read().splitlines()
    if len(lines) < 2:
        return

    nums = list(map(int, lines[0].split()))
    target = int(lines[1])

    # TODO: Use a dictionary to store previously visited values -> indices
    # and print f"[{first_index}, {second_index}]" when a pair sums to target.
    pass


if __name__ == "__main__":
    two_sum()
`,
          testCases: [
            {
              id: 'py-m1-lab-tc1',
              input: '2 7 11 15\n9',
              expectedStdout: '[0, 1]',
              isHidden: false,
            },
            {
              id: 'py-m1-lab-tc2',
              input: '3 2 4\n6',
              expectedStdout: '[1, 2]',
              isHidden: false,
            },
          ],
        },
        {
          id: 'py-m1-exam',
          type: 'exam',
          title: 'Module 1 Timed Exam: Arrays & Hash Maps',
          durationMins: 15,
          passScore: 75,
          questions: [
            {
              id: 'py-e1',
              prompt: 'What is the time and auxiliary space complexity of solving Two Sum with a single-pass hash map?',
              options: [
                'O(n) time, O(n) space',
                'O(n log n) time, O(1) space',
                'O(n^2) time, O(1) space',
                'O(1) time, O(n) space',
              ],
              correctIndex: 0,
              explanation:
                'Each of the n elements performs an O(1) average-case lookup and insertion, and at most n entries are stored in the hash map.',
            },
            {
              id: 'py-e2',
              prompt: 'What does the following snippet print?',
              codeSnippet: {
                language: 'python',
                code: `arr = [10, 20, 30, 40]
arr.insert(1, 99)
print(arr[2])`,
              },
              options: ['99', '20', '30', '10'],
              correctIndex: 1,
              explanation:
                'Inserting 99 at index 1 shifts 20, 30, and 40 one slot right, placing 20 at index 2.',
            },
            {
              id: 'py-e3',
              prompt: 'Which operation on a Python list of length n runs in O(n) time?',
              options: ['len(arr)', 'arr[-1]', 'arr.pop(0)', 'arr.append(5)'],
              correctIndex: 2,
              explanation:
                '`pop(0)` removes the first element and must shift all remaining n - 1 references left by one slot.',
            },
            {
              id: 'py-e4',
              prompt: 'If you pre-populate `index_by_val = {v: i for i, v in enumerate(nums)}` before scanning for Two Sum on `[3, 2, 4]` with `target = 6`, what bug can occur?',
              options: [
                'Index 0 (`3`) can pair with itself (`3 + 3 == 6`) unless you verify `index_by_val[diff] != i`.',
                'Dictionary comprehension reverses the list order.',
                'Python raises a ValueError for duplicate keys.',
                'It runs in O(n^2) time.',
              ],
              correctIndex: 0,
              explanation:
                'At i=0, `diff = 6 - 3 = 3` finds index 0 in the pre-populated map, falsely reusing the same element unless `j != i` is checked.',
            },
            {
              id: 'py-e5',
              prompt: 'When counting character frequencies in a string `s` of length n using a `dict`, what is the worst-case space complexity if the alphabet size is fixed (e.g., 26 lowercase ASCII letters)?',
              options: ['O(n^2)', 'O(n log n)', 'O(1) bounded by alphabet size (or O(min(n, |Sigma|)))', 'O(2^n)'],
              correctIndex: 2,
              explanation:
                'A fixed-size alphabet bounds the maximum number of distinct keys in the dictionary to a constant.',
            },
            {
              id: 'py-e6',
              prompt: 'Why should you avoid `nums[i]` lookups inside `set(nums)` when you need original indices?',
              options: [
                'Sets drop duplicate values and do not store positional indices.',
                'Sets sort elements in ascending order.',
                'Sets only accept string elements.',
                'Membership tests on sets cost O(n).',
              ],
              correctIndex: 0,
              explanation:
                'A `set` records presence only; whenever you need the original position or count, use a `dict` mapping value to index or count.',
            },
          ],
        },
      ],
    },
    {
      id: 'py-mod-stacks-queues',
      title: 'Stacks & Queues',
      summary:
        'Apply LIFO stacks and FIFO queues using collections.deque, bracket-matching state machines, and monotonic stack patterns.',
      items: [
        {
          id: 'py-m2-notes',
          type: 'notes',
          title: 'LIFO Stacks, FIFO Queues & collections.deque',
          readMins: 8,
          tldr: [
            'Stacks follow Last-In, First-Out (LIFO) semantics and are ideal for nested structure validation, undo history, and depth-first traversal.',
            'Queues follow First-In, First-Out (FIFO) semantics; always use `collections.deque` instead of `list.pop(0)` for O(1) front removal.',
            'Monotonic stacks maintain sorted order among pending elements to solve next-greater-element problems in linear O(n) time.',
          ],
          sections: [
            {
              id: 'lifo-stacks',
              heading: 'Stacks and Nested Structure Matching',
              paragraphs: [
                'A stack restricts additions (`push`) and removals (`pop`) to one end called the top. In Python, a standard `list` makes an efficient stack using `append()` and `pop()`, both of which run in O(1) amortized time.',
                'When parsing balanced delimiters such as `()[]{}`, every opening symbol pushes an expectation onto the stack. Upon seeing a closing symbol, the most recently opened unmatched delimiter sits directly on top of the stack. If the stack is empty or the top symbol does not match, the expression is invalid.',
              ],
            },
            {
              id: 'fifo-queues-and-deque',
              heading: 'Queues and Why collections.deque Matters',
              paragraphs: [
                'A queue processes items in First-In, First-Out (FIFO) order: enqueue at the back, dequeue from the front. Using a Python `list` with `pop(0)` forces CPython to shift every remaining element on each dequeue, degrading a breadth-first search over n items into O(n^2).',
                '`collections.deque` (double-ended queue) is implemented in C as a doubly-linked list of fixed-size blocks. Both `append()` / `appendleft()` and `pop()` / `popleft()` execute in O(1) time without shifting elements.',
              ],
              callout: {
                kind: 'tip',
                title: 'Rule of Thumb for Python Queues',
                body: 'Use `list` (`append`/`pop`) when you only touch the right end (stack). Switch to `collections.deque` (`append`/`popleft`) the moment you need FIFO queue operations.',
              },
              table: {
                headers: ['Operation', 'Python list', 'collections.deque', 'Best Use Case'],
                rows: [
                  ['Push right: append(x)', 'O(1) amortized', 'O(1)', 'Both stack & queue'],
                  ['Pop right: pop()', 'O(1)', 'O(1)', 'LIFO Stack'],
                  ['Push left: insert(0, x) / appendleft(x)', 'O(n)', 'O(1)', 'Deque / Sliding window'],
                  ['Pop left: pop(0) / popleft()', 'O(n)', 'O(1)', 'FIFO Queue / BFS'],
                  ['Random index: c[i]', 'O(1)', 'O(n) away from ends', 'Use list for indexing'],
                ],
              },
            },
            {
              id: 'monotonic-stack-pattern',
              heading: 'Monotonic Stack Pattern in Linear Time',
              paragraphs: [
                'A monotonic stack stores indices whose values remain strictly increasing or decreasing. When a new element breaks the ordering invariant, we pop elements until the invariant is restored, resolving each popped item in a single pass.',
                'Even though a `while` loop sits inside a `for` loop, each element is pushed once and popped at most once, keeping total time complexity strictly O(n).',
              ],
              codeBlock: {
                filename: 'deque_and_stack.py',
                language: 'python',
                runnableInIde: true,
                code: `from collections import deque


def next_greater_temperatures(temps: list[int]) -> list[int]:
    wait_days = [0] * len(temps)
    stack: list[int] = []  # stores indices with decreasing temperatures

    for idx, temp in enumerate(temps):
        while stack and temps[stack[-1]] < temp:
            prev_idx = stack.pop()
            wait_days[prev_idx] = idx - prev_idx
        stack.append(idx)

    return wait_days


queue = deque(["task-1", "task-2", "task-3"])
first = queue.popleft()
queue.append("task-4")

print("Dequeued:", first, "| Remaining queue:", list(queue))
print("Wait days:", next_greater_temperatures([73, 74, 75, 71, 69, 72, 76, 73]))
`,
              },
            },
          ],
          keyTakeaways: [
            'Use `list` (`append` and `pop`) for O(1) LIFO stacks.',
            'Use `collections.deque` (`append` and `popleft`) for O(1) FIFO queues and BFS.',
            'When validating nested delimiters, verify the stack is empty at the very end so unclosed openers are caught.',
          ],
        },
        {
          id: 'py-m2-quiz',
          type: 'quiz',
          title: 'Concept Check: Stacks & Queues',
          passScore: 75,
          questions: [
            {
              id: 'py-m2-q1',
              prompt: 'Which `collections.deque` method removes and returns the front element of a FIFO queue in O(1) time?',
              options: ['dequeue()', 'pop(0)', 'popleft()', 'shift()'],
              correctIndex: 2,
              explanation:
                '`deque.popleft()` removes the leftmost item in O(1) time. `deque.pop(0)` is not supported and `list.pop(0)` is O(n).',
            },
            {
              id: 'py-m2-q2',
              prompt: 'What does a stack-based validator return for the input `"(()"` if you forget to check `len(stack) == 0` after the loop?',
              options: [
                'It falsely returns True because no mismatched closer was encountered.',
                'It raises an IndexError on the third character.',
                'It returns False automatically.',
                'It enters an infinite loop.',
              ],
              correctIndex: 0,
              explanation:
                'After matching one pair, one unclosed `"("` remains on the stack. Checking `return not stack` at the end catches unclosed openers.',
            },
            {
              id: 'py-m2-q3',
              prompt: 'What is the total time complexity of the monotonic stack loop shown below for an array of length n?',
              codeSnippet: {
                language: 'python',
                code: `stack = []
for i, val in enumerate(nums):
    while stack and nums[stack[-1]] < val:
        stack.pop()
    stack.append(i)`,
              },
              options: ['O(n^2)', 'O(n log n)', 'O(n)', 'O(log n)'],
              correctIndex: 2,
              explanation:
                'Each index is appended once and popped at most once across the entire run, yielding O(n) total operations.',
            },
            {
              id: 'py-m2-q4',
              prompt: 'When is a `list` preferable over `collections.deque`?',
              options: [
                'When performing frequent random index lookups `arr[k]` in the middle of the collection',
                'When dequeuing millions of tasks from the front',
                'When implementing a sliding window queue',
                'When running breadth-first search on a graph',
              ],
              correctIndex: 0,
              explanation:
                '`list` supports O(1) random access anywhere, whereas `deque` requires O(n) traversal to reach middle elements.',
            },
          ],
        },
        {
          id: 'py-m2-lab',
          type: 'lab',
          title: 'Lab: Valid Parentheses',
          estimatedMins: 20,
          language: 'python',
          ideProblemId: 'valid-parentheses',
          objective:
            'Use a LIFO stack and closing-to-opening bracket map to validate balanced parentheses, braces, and square brackets in O(n) time.',
          steps: [
            'Define a dictionary mapping each closing bracket `)`, `]`, `}` to its matching opening bracket `(`, `[`, `{`.',
            'Iterate through each character in `s`; push opening brackets onto a Python list stack.',
            'When encountering a closing bracket, return `False` if the stack is empty or `stack.pop()` does not match the expected opener.',
            'Return `len(stack) == 0` after the loop so leftover unclosed openers fail validation.',
            'Verify all public and hidden test cases pass in Cortex IDE.',
          ],
          starterCode: `import sys


def is_valid(s):
    # TODO: Use a stack to match opening and closing brackets
    return False


if __name__ == '__main__':
    s = sys.stdin.read().strip()
    print('true' if is_valid(s) else 'false')
`,
          testCases: [
            {
              id: 'py-m2-lab-tc1',
              input: '()[]{}',
              expectedStdout: 'true',
              isHidden: false,
            },
            {
              id: 'py-m2-lab-tc2',
              input: '([)]',
              expectedStdout: 'false',
              isHidden: false,
            },
          ],
        },
      ],
    },
  ],
};
