import { TestCase } from '../execution/types';

export interface Challenge {
  id: string;
  title: string;
  slug: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  category: string;
  tags: string[];
  description: string;
  constraints: string[];
  examples: {
    input: string;
    output: string;
    explanation?: string;
  }[];
  starterTemplates: Record<string, string>;
  testCases: TestCase[];
  hints: string[];
  acceptanceRate: string;
}

export const CHALLENGES: Challenge[] = [
  {
    id: 'two-sum',
    title: 'Two Sum',
    slug: 'two-sum',
    difficulty: 'Easy',
    category: 'Arrays & Hashing',
    tags: ['Array', 'Hash Table'],
    description: `Given an array of integers \`nums\` and an integer \`target\`, return the indices of the two numbers such that they add up to \`target\`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice. You can return the answer in any order.`,
    constraints: [
      '2 <= nums.length <= 10^4',
      '-10^9 <= nums[i] <= 10^9',
      '-10^9 <= target <= 10^9',
      'Only one valid answer exists.',
    ],
    examples: [
      {
        input: 'nums = [2,7,11,15], target = 9',
        output: '[0, 1]',
        explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].',
      },
      {
        input: 'nums = [3,2,4], target = 6',
        output: '[1, 2]',
      },
    ],
    starterTemplates: {
      python: `# Two Sum - Read input from stdin
# Format: line 1 = space-separated nums, line 2 = target
import sys

def two_sum():
    lines = sys.stdin.read().splitlines()
    if not lines:
        return
    nums = list(map(int, lines[0].split()))
    target = int(lines[1])
    
    # Complete your O(n) solution here:
    seen = {}
    for i, n in enumerate(nums):
        diff = target - n
        if diff in seen:
            print(f"[{seen[diff]}, {i}]")
            return
        seen[n] = i

if __name__ == '__main__':
    two_sum()
`,
      cpp: `#include <iostream>
#include <vector>
#include <unordered_map>
using namespace std;

int main() {
    int n, target;
    if (!(cin >> n)) return 0;
    vector<int> nums(n);
    for (int i = 0; i < n; i++) cin >> nums[i];
    cin >> target;

    unordered_map<int, int> seen;
    for (int i = 0; i < n; i++) {
        int diff = target - nums[i];
        if (seen.count(diff)) {
            cout << "[" << seen[diff] << ", " << i << "]" << endl;
            return 0;
        }
        seen[nums[i]] = i;
    }
    return 0;
}
`,
      javascript: `const fs = require('fs');
const lines = fs.readFileSync(0, 'utf-8').trim().split('\\n');
if (lines.length >= 2) {
  const nums = lines[0].trim().split(/\\s+/).map(Number);
  const target = Number(lines[1].trim());
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const diff = target - nums[i];
    if (seen.has(diff)) {
      console.log(\`[\${seen.get(diff)}, \${i}]\`);
      process.exit(0);
    }
    seen.set(nums[i], i);
  }
}
`,
    },
    testCases: [
      {
        id: 'tc-1',
        name: 'Example Case 1',
        stdin: '2 7 11 15\n9',
        expectedStdout: '[0, 1]',
        isHidden: false,
      },
      {
        id: 'tc-2',
        name: 'Example Case 2',
        stdin: '3 2 4\n6',
        expectedStdout: '[1, 2]',
        isHidden: false,
      },
      {
        id: 'tc-3',
        name: 'Hidden Case: Duplicates',
        stdin: '3 3\n6',
        expectedStdout: '[0, 1]',
        isHidden: true,
      },
      {
        id: 'tc-4',
        name: 'Hidden Case: Negative Numbers',
        stdin: '-1 -2 -3 -4 -5\n-8',
        expectedStdout: '[2, 4]',
        isHidden: true,
      },
    ],
    hints: [
      'A brute force approach checks all pairs in O(n^2) time. Can we trade space for time?',
      'Use a hash map to look up if the complement (target - current) has already been encountered in O(1) time.',
    ],
    acceptanceRate: '52.4%',
  },
  {
    id: 'valid-palindrome',
    title: 'Valid Palindrome',
    slug: 'valid-palindrome',
    difficulty: 'Easy',
    category: 'Two Pointers',
    tags: ['Two Pointers', 'String'],
    description: `A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward.\n\nGiven a string \`s\`, return \`true\` if it is a palindrome, or \`false\` otherwise.`,
    constraints: [
      '1 <= s.length <= 2 * 10^5',
      's consists only of printable ASCII characters.',
    ],
    examples: [
      {
        input: 'A man, a plan, a canal: Panama',
        output: 'true',
        explanation: '"amanaplanacanalpanama" is a palindrome.',
      },
      {
        input: 'race a car',
        output: 'false',
        explanation: '"raceacar" is not a palindrome.',
      },
    ],
    starterTemplates: {
      python: `import sys
import re

def is_palindrome():
    s = sys.stdin.read().strip()
    clean = re.sub(r'[^a-zA-Z0-9]', '', s).lower()
    print("true" if clean == clean[::-1] else "false")

if __name__ == '__main__':
    is_palindrome()
`,
      cpp: `#include <iostream>
#include <string>
#include <cctype>
using namespace std;

int main() {
    string line;
    if (!getline(cin, line)) return 0;
    string clean = "";
    for (char c : line) {
        if (isalnum(c)) clean += tolower(c);
    }
    int l = 0, r = clean.size() - 1;
    bool pal = true;
    while (l < r) {
        if (clean[l++] != clean[r--]) {
            pal = false;
            break;
        }
    }
    cout << (pal ? "true" : "false") << endl;
    return 0;
}
`,
      javascript: `const fs = require('fs');
const s = fs.readFileSync(0, 'utf-8').trim();
const clean = s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
const reversed = clean.split('').reverse().join('');
console.log(clean === reversed ? 'true' : 'false');
`,
    },
    testCases: [
      {
        id: 'pal-1',
        name: 'Standard Palindrome',
        stdin: 'A man, a plan, a canal: Panama',
        expectedStdout: 'true',
        isHidden: false,
      },
      {
        id: 'pal-2',
        name: 'Non Palindrome',
        stdin: 'race a car',
        expectedStdout: 'false',
        isHidden: false,
      },
      {
        id: 'pal-3',
        name: 'Single Character',
        stdin: 'a',
        expectedStdout: 'true',
        isHidden: true,
      },
    ],
    hints: ['Consider filtering the string first, or use two pointers moving inward.'],
    acceptanceRate: '46.8%',
  },
  {
    id: 'max-subarray',
    title: 'Maximum Subarray (Kadane)',
    slug: 'max-subarray',
    difficulty: 'Medium',
    category: 'Dynamic Programming',
    tags: ['Array', 'Dynamic Programming', 'Divide and Conquer'],
    description: `Given an integer array \`nums\`, find the subarray with the largest sum, and return its sum.`,
    constraints: ['1 <= nums.length <= 10^5', '-10^4 <= nums[i] <= 10^4'],
    examples: [
      {
        input: '-2 1 -3 4 -1 2 1 -5 4',
        output: '6',
        explanation: 'The subarray [4,-1,2,1] has the largest sum 6.',
      },
    ],
    starterTemplates: {
      python: `import sys

def max_subarray():
    line = sys.stdin.read().strip()
    if not line: return
    nums = list(map(int, line.split()))
    
    max_sum = current_sum = nums[0]
    for x in nums[1:]:
        current_sum = max(x, current_sum + x)
        max_sum = max(max_sum, current_sum)
    print(max_sum)

if __name__ == '__main__':
    max_subarray()
`,
    },
    testCases: [
      {
        id: 'sub-1',
        name: 'Example 1',
        stdin: '-2 1 -3 4 -1 2 1 -5 4',
        expectedStdout: '6',
        isHidden: false,
      },
      {
        id: 'sub-2',
        name: 'All Negative',
        stdin: '-5 -2 -8 -1',
        expectedStdout: '-1',
        isHidden: true,
      },
    ],
    hints: ['Kadane’s algorithm maintains current_sum = max(num, current_sum + num).'],
    acceptanceRate: '50.1%',
  }
];
