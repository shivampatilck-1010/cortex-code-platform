import type { Challenge } from './challenges-data';

export const PROGRAMMING_CHALLENGES: Challenge[] = [
  {
    id: 'fizzbuzz-sequence',
    title: 'FizzBuzz Sequence Generator',
    slug: 'fizzbuzz-sequence',
    difficulty: 'Easy',
    track: 'Programming',
    topicCategory: 'Programming',
    level: 'Beginner',
    category: 'Control Flow & Strings',
    tags: ['Math', 'String'],
    companyTags: ['ByteWorks', 'ApexSystems'],
    description:
      'Given a positive integer `n`, print the sequence from `1` to `n` (one value per line). For multiples of `3` print `Fizz`, for multiples of `5` print `Buzz`, and for multiples of both `3` and `5` print `FizzBuzz`. Otherwise print the number as a string.',
    constraints: ['1 <= n <= 10^4'],
    examples: [
      {
        input: '5',
        output: '1\n2\nFizz\n4\nBuzz',
      },
    ],
    starterTemplates: {
      python: `import sys

def fizzbuzz(n):
    # TODO: Print each line from 1 to n
    pass

if __name__ == '__main__':
    raw = sys.stdin.read().strip()
    if raw:
        fizzbuzz(int(raw))
`,
      javascript: `const fs = require('fs');

function fizzbuzz(n) {
  // TODO: Print each line from 1 to n
}

const raw = fs.readFileSync(0, 'utf-8').trim();
if (raw) fizzbuzz(Number(raw));
`,
      cpp: `#include <iostream>
using namespace std;

void fizzbuzz(int n) {
    // TODO: Print each line from 1 to n
}

int main() {
    int n;
    if (cin >> n) fizzbuzz(n);
    return 0;
}
`,
    },
    testCases: [
      {
        id: 'fb-1',
        name: 'Up to 5',
        stdin: '5',
        expectedStdout: '1\n2\nFizz\n4\nBuzz',
        isHidden: false,
      },
      {
        id: 'fb-2',
        name: 'Up to 15',
        stdin: '15',
        expectedStdout: '1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz',
        isHidden: true,
      },
    ],
    hints: ['Check divisibility by 15 (both 3 and 5) before checking 3 or 5 individually.'],
    acceptanceRate: '78.4%',
  },
  {
    id: 'prime-sieve-count',
    title: 'Count Primes (Sieve)',
    slug: 'prime-sieve-count',
    difficulty: 'Easy',
    track: 'Programming',
    topicCategory: 'Programming',
    level: 'Beginner',
    category: 'Number Theory',
    tags: ['Math', 'Array'],
    companyTags: ['QuantLabs', 'DataGrid'],
    description:
      'Given an integer `n`, return the count of prime numbers that are strictly less than `n`.',
    constraints: ['0 <= n <= 5 * 10^5'],
    examples: [
      {
        input: '10',
        output: '4',
        explanation: 'There are 4 primes less than 10: 2, 3, 5, 7.',
      },
      {
        input: '2',
        output: '0',
      },
    ],
    starterTemplates: {
      python: `import sys

def count_primes(n):
    # TODO: Implement Sieve of Eratosthenes
    return 0

if __name__ == '__main__':
    raw = sys.stdin.read().strip()
    if raw:
        print(count_primes(int(raw)))
`,
      javascript: `const fs = require('fs');

function countPrimes(n) {
  // TODO: Implement Sieve of Eratosthenes
  return 0;
}

const raw = fs.readFileSync(0, 'utf-8').trim();
if (raw) console.log(countPrimes(Number(raw)));
`,
      cpp: `#include <iostream>
#include <vector>
using namespace std;

int countPrimes(int n) {
    // TODO: Implement Sieve of Eratosthenes
    return 0;
}

int main() {
    int n;
    if (cin >> n) cout << countPrimes(n) << endl;
    return 0;
}
`,
    },
    testCases: [
      {
        id: 'cp-1',
        name: 'Primes Below 10',
        stdin: '10',
        expectedStdout: '4',
        isHidden: false,
      },
      {
        id: 'cp-2',
        name: 'Primes Below 2',
        stdin: '2',
        expectedStdout: '0',
        isHidden: false,
      },
      {
        id: 'cp-3',
        name: 'Primes Below 100',
        stdin: '100',
        expectedStdout: '25',
        isHidden: true,
      },
    ],
    hints: [
      'Create a boolean array `is_prime` of size `n` and mark multiples of each prime `p` starting from `p * p`.',
    ],
    acceptanceRate: '61.2%',
  },
  {
    id: 'fibonacci-memoized',
    title: 'Fibonacci Sequence Value',
    slug: 'fibonacci-memoized',
    difficulty: 'Easy',
    track: 'Programming',
    topicCategory: 'Programming',
    level: 'Beginner',
    category: 'Recursion & Iteration',
    tags: ['Math', 'Recursion', 'Dynamic Programming'],
    companyTags: ['CloudCore', 'NexaTech'],
    description:
      'The Fibonacci numbers form a sequence such that `F(0) = 0`, `F(1) = 1`, and `F(n) = F(n - 1) + F(n - 2)` for `n > 1`. Given `n`, compute and print `F(n)`.',
    constraints: ['0 <= n <= 45'],
    examples: [
      {
        input: '6',
        output: '8',
      },
      {
        input: '10',
        output: '55',
      },
    ],
    starterTemplates: {
      python: `import sys

def fib(n):
    # TODO: Compute F(n) using memoized recursion or iterative DP
    return 0

if __name__ == '__main__':
    raw = sys.stdin.read().strip()
    if raw:
        print(fib(int(raw)))
`,
      javascript: `const fs = require('fs');

function fib(n) {
  // TODO: Compute F(n) using memoized recursion or iterative DP
  return 0;
}

const raw = fs.readFileSync(0, 'utf-8').trim();
if (raw) console.log(fib(Number(raw)));
`,
      cpp: `#include <iostream>
using namespace std;

long long fib(int n) {
    // TODO: Compute F(n) using memoized recursion or iterative DP
    return 0;
}

int main() {
    int n;
    if (cin >> n) cout << fib(n) << endl;
    return 0;
}
`,
    },
    testCases: [
      {
        id: 'fib-1',
        name: 'F(6)',
        stdin: '6',
        expectedStdout: '8',
        isHidden: false,
      },
      {
        id: 'fib-2',
        name: 'F(10)',
        stdin: '10',
        expectedStdout: '55',
        isHidden: false,
      },
      {
        id: 'fib-3',
        name: 'F(0)',
        stdin: '0',
        expectedStdout: '0',
        isHidden: true,
      },
    ],
    hints: ['Naive recursion is O(2^n). Cache intermediate values or iterate with two variables in O(n).'],
    acceptanceRate: '72.9%',
  },
  {
    id: 'single-number-xor',
    title: 'Single Unique Number',
    slug: 'single-number-xor',
    difficulty: 'Easy',
    track: 'Programming',
    topicCategory: 'Programming',
    level: 'Beginner',
    category: 'Bit Manipulation',
    tags: ['Array', 'Bit Manipulation'],
    companyTags: ['ApexSystems', 'FinScale'],
    description:
      'Given a non-empty array of integers `nums`, every element appears twice except for one. Find and print that single unique element in `O(n)` time and `O(1)` extra space.',
    constraints: ['1 <= nums.length <= 3 * 10^4', '-3 * 10^4 <= nums[i] <= 3 * 10^4'],
    examples: [
      {
        input: '4 1 2 1 2',
        output: '4',
      },
      {
        input: '2 2 1',
        output: '1',
      },
    ],
    starterTemplates: {
      python: `import sys

def single_number(nums):
    # TODO: Combine elements using bitwise XOR
    return 0

if __name__ == '__main__':
    raw = sys.stdin.read().strip()
    if raw:
        nums = list(map(int, raw.split()))
        print(single_number(nums))
`,
      javascript: `const fs = require('fs');

function singleNumber(nums) {
  // TODO: Combine elements using bitwise XOR
  return 0;
}

const raw = fs.readFileSync(0, 'utf-8').trim();
if (raw) {
  const nums = raw.split(/\\s+/).map(Number);
  console.log(singleNumber(nums));
}
`,
      cpp: `#include <iostream>
#include <vector>
using namespace std;

int singleNumber(const vector<int>& nums) {
    // TODO: Combine elements using bitwise XOR
    return 0;
}

int main() {
    vector<int> nums;
    int x;
    while (cin >> x) nums.push_back(x);
    if (!nums.empty()) cout << singleNumber(nums) << endl;
    return 0;
}
`,
    },
    testCases: [
      {
        id: 'sn-1',
        name: 'Five Elements',
        stdin: '4 1 2 1 2',
        expectedStdout: '4',
        isHidden: false,
      },
      {
        id: 'sn-2',
        name: 'Three Elements',
        stdin: '2 2 1',
        expectedStdout: '1',
        isHidden: false,
      },
    ],
    hints: ['Recall that `a ^ a = 0` and `a ^ 0 = a`. XOR is commutative and associative.'],
    acceptanceRate: '74.1%',
  },
  {
    id: 'run-length-encoding',
    title: 'String Run-Length Compression',
    slug: 'run-length-encoding',
    difficulty: 'Medium',
    track: 'Programming',
    topicCategory: 'Programming',
    level: 'Intermediate',
    category: 'String Processing',
    tags: ['String', 'Two Pointers'],
    companyTags: ['ByteWorks', 'CloudCore'],
    description:
      'Given an input string `s` of lowercase letters, compress consecutive repeating characters into `<char><count>` (only append `<count>` when count > 1). Print the compressed string.',
    constraints: ['1 <= s.length <= 10^4', 's contains lowercase English letters only.'],
    examples: [
      {
        input: 'aaabbc',
        output: 'a3b2c',
      },
      {
        input: 'abcd',
        output: 'abcd',
      },
    ],
    starterTemplates: {
      python: `import sys

def compress_string(s):
    # TODO: Group consecutive identical characters
    return s

if __name__ == '__main__':
    s = sys.stdin.read().strip()
    if s:
        print(compress_string(s))
`,
      javascript: `const fs = require('fs');

function compressString(s) {
  // TODO: Group consecutive identical characters
  return s;
}

const s = fs.readFileSync(0, 'utf-8').trim();
if (s) console.log(compressString(s));
`,
      cpp: `#include <iostream>
#include <string>
using namespace std;

string compressString(const string& s) {
    // TODO: Group consecutive identical characters
    return s;
}

int main() {
    string s;
    if (cin >> s) cout << compressString(s) << endl;
    return 0;
}
`,
    },
    testCases: [
      {
        id: 'rle-1',
        name: 'Repeated Runs',
        stdin: 'aaabbc',
        expectedStdout: 'a3b2c',
        isHidden: false,
      },
      {
        id: 'rle-2',
        name: 'No Repeats',
        stdin: 'abcd',
        expectedStdout: 'abcd',
        isHidden: false,
      },
      {
        id: 'rle-3',
        name: 'Double-Digit Run',
        stdin: 'aaaaaaaaaaaa',
        expectedStdout: 'a12',
        isHidden: true,
      },
    ],
    hints: ['Use two pointers `i` and `j` to count each contiguous run of equal characters.'],
    acceptanceRate: '56.4%',
  },
  {
    id: 'power-set-subsets',
    title: 'Generate All Subsets Count & Sum',
    slug: 'power-set-subsets',
    difficulty: 'Medium',
    track: 'Programming',
    topicCategory: 'Programming',
    level: 'Intermediate',
    category: 'Recursion & Bitmask',
    tags: ['Array', 'Recursion', 'Bit Manipulation'],
    companyTags: ['QuantLabs', 'NexaTech'],
    description:
      'Given an array of distinct integers `nums`, generate all possible subsets (the power set) and print the total sum of all subset sums.',
    constraints: ['1 <= nums.length <= 20', '-100 <= nums[i] <= 100'],
    examples: [
      {
        input: '1 2 3',
        output: '24',
        explanation: 'Subsets are [], [1], [2], [3], [1,2], [1,3], [2,3], [1,2,3]. Total sum = 24.',
      },
    ],
    starterTemplates: {
      python: `import sys

def total_subset_sum(nums):
    # TODO: Compute sum across all 2^n subsets via recursion or bitmasking
    return 0

if __name__ == '__main__':
    raw = sys.stdin.read().strip()
    if raw:
        nums = list(map(int, raw.split()))
        print(total_subset_sum(nums))
`,
      javascript: `const fs = require('fs');

function totalSubsetSum(nums) {
  // TODO: Compute sum across all 2^n subsets
  return 0;
}

const raw = fs.readFileSync(0, 'utf-8').trim();
if (raw) {
  const nums = raw.split(/\\s+/).map(Number);
  console.log(totalSubsetSum(nums));
}
`,
      cpp: `#include <iostream>
#include <vector>
using namespace std;

long long totalSubsetSum(const vector<int>& nums) {
    // TODO: Compute sum across all 2^n subsets
    return 0;
}

int main() {
    vector<int> nums;
    int x;
    while (cin >> x) nums.push_back(x);
    if (!nums.empty()) cout << totalSubsetSum(nums) << endl;
    return 0;
}
`,
    },
    testCases: [
      {
        id: 'ps-1',
        name: 'Three Elements',
        stdin: '1 2 3',
        expectedStdout: '24',
        isHidden: false,
      },
      {
        id: 'ps-2',
        name: 'Two Elements',
        stdin: '5 10',
        expectedStdout: '30',
        isHidden: false,
      },
    ],
    hints: ['Each element appears in exactly 2^(n - 1) subsets, or enumerate recursively/via bitmasks.'],
    acceptanceRate: '58.9%',
  },
  {
    id: 'matrix-spiral-traversal',
    title: 'Spiral Matrix Traversal',
    slug: 'matrix-spiral-traversal',
    difficulty: 'Medium',
    track: 'Programming',
    topicCategory: 'Programming',
    level: 'Intermediate',
    category: '2D Arrays & Simulation',
    tags: ['Array', 'Sorting'],
    companyTags: ['DataGrid', 'CloudCore'],
    description:
      'Given an `m x n` integer matrix, print all elements of the matrix in clockwise spiral order separated by single spaces.\n\nInput line 1 contains `m n`, followed by `m` rows of `n` integers.',
    constraints: ['1 <= m, n <= 20', '-1000 <= matrix[i][j] <= 1000'],
    examples: [
      {
        input: '3 3\n1 2 3\n4 5 6\n7 8 9',
        output: '1 2 3 6 9 8 7 4 5',
      },
    ],
    starterTemplates: {
      python: `import sys

def spiral_order(matrix):
    # TODO: Traverse boundaries top, right, bottom, left inward
    return []

if __name__ == '__main__':
    tokens = sys.stdin.read().strip().split()
    if len(tokens) >= 2:
        m, n = int(tokens[0]), int(tokens[1])
        vals = list(map(int, tokens[2:]))
        matrix = [vals[i * n:(i + 1) * n] for i in range(m)]
        print(' '.join(map(str, spiral_order(matrix))))
`,
      javascript: `const fs = require('fs');

function spiralOrder(matrix) {
  // TODO: Traverse boundaries inward
  return [];
}

const tokens = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);
if (tokens.length >= 2) {
  const m = Number(tokens[0]);
  const n = Number(tokens[1]);
  const vals = tokens.slice(2).map(Number);
  const matrix = [];
  for (let i = 0; i < m; i++) {
    matrix.push(vals.slice(i * n, (i + 1) * n));
  }
  console.log(spiralOrder(matrix).join(' '));
}
`,
      cpp: `#include <iostream>
#include <vector>
using namespace std;

vector<int> spiralOrder(const vector<vector<int>>& matrix) {
    // TODO: Traverse boundaries inward
    return {};
}

int main() {
    int m, n;
    if (!(cin >> m >> n)) return 0;
    vector<vector<int>> matrix(m, vector<int>(n));
    for (int i = 0; i < m; i++)
        for (int j = 0; j < n; j++)
            cin >> matrix[i][j];
    vector<int> res = spiralOrder(matrix);
    for (size_t i = 0; i < res.size(); i++) {
        if (i > 0) cout << " ";
        cout << res[i];
    }
    cout << endl;
    return 0;
}
`,
    },
    testCases: [
      {
        id: 'sm-1',
        name: '3x3 Matrix',
        stdin: '3 3\n1 2 3\n4 5 6\n7 8 9',
        expectedStdout: '1 2 3 6 9 8 7 4 5',
        isHidden: false,
      },
      {
        id: 'sm-2',
        name: '2x4 Matrix',
        stdin: '2 4\n1 2 3 4\n5 6 7 8',
        expectedStdout: '1 2 3 4 8 7 6 5',
        isHidden: true,
      },
    ],
    hints: ['Maintain `top`, `bottom`, `left`, `right` boundaries and shrink each boundary after traversing its edge.'],
    acceptanceRate: '51.5%',
  },
];
