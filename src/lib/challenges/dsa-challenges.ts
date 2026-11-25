import type { Challenge } from './challenges-data';

export const DSA_CHALLENGES: Challenge[] = [
  {
    id: 'two-sum',
    title: 'Two Sum',
    slug: 'two-sum',
    difficulty: 'Easy',
    track: 'DSA',
    topicCategory: 'Algorithms',
    level: 'Beginner',
    category: 'Arrays & Hashing',
    tags: ['Array', 'Hash Table'],
    companyTags: ['CloudCore', 'FinScale', 'ApexSystems'],
    description:
      'Given an array of integers `nums` and an integer `target`, return the indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice. You can return the answer in any order.',
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
    if len(lines) < 2:
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
#include <sstream>
#include <string>
#include <vector>
#include <unordered_map>
using namespace std;

int main() {
    string line1;
    if (!getline(cin, line1)) return 0;
    istringstream iss(line1);
    vector<int> nums;
    int val;
    while (iss >> val) nums.push_back(val);

    int target;
    if (!(cin >> target)) return 0;

    unordered_map<int, int> seen;
    for (int i = 0; i < (int)nums.size(); i++) {
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
    track: 'DSA',
    topicCategory: 'Algorithms',
    level: 'Beginner',
    category: 'Two Pointers',
    tags: ['Two Pointers', 'String'],
    companyTags: ['NexaTech', 'ByteWorks'],
    description:
      'A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward.\n\nGiven a string `s`, return `true` if it is a palindrome, or `false` otherwise.',
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
        if (isalnum(static_cast<unsigned char>(c))) clean += tolower(static_cast<unsigned char>(c));
    }
    int l = 0, r = (int)clean.size() - 1;
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
    track: 'DSA',
    topicCategory: 'Algorithms',
    level: 'Intermediate',
    category: 'Dynamic Programming',
    tags: ['Array', 'Dynamic Programming'],
    companyTags: ['CloudCore', 'QuantLabs', 'DataGrid'],
    description:
      'Given an integer array `nums`, find the contiguous subarray with the largest sum, and return its sum.',
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
    if not line:
        return
    nums = list(map(int, line.split()))

    max_sum = current_sum = nums[0]
    for x in nums[1:]:
        current_sum = max(x, current_sum + x)
        max_sum = max(max_sum, current_sum)
    print(max_sum)

if __name__ == '__main__':
    max_subarray()
`,
      cpp: `#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    vector<int> nums;
    int x;
    while (cin >> x) nums.push_back(x);
    if (nums.empty()) return 0;

    int cur = nums[0], best = nums[0];
    for (size_t i = 1; i < nums.size(); i++) {
        cur = max(nums[i], cur + nums[i]);
        best = max(best, cur);
    }
    cout << best << endl;
    return 0;
}
`,
      javascript: `const fs = require('fs');
const line = fs.readFileSync(0, 'utf-8').trim();
if (line) {
  const nums = line.split(/\\s+/).map(Number);
  let cur = nums[0];
  let best = nums[0];
  for (let i = 1; i < nums.length; i++) {
    cur = Math.max(nums[i], cur + nums[i]);
    best = Math.max(best, cur);
  }
  console.log(best);
}
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
    hints: ["Kadane's algorithm maintains current_sum = max(num, current_sum + num)."],
    acceptanceRate: '50.1%',
  },
  {
    id: 'best-time-to-buy-sell-stock',
    title: 'Best Time to Buy and Sell Stock',
    slug: 'best-time-to-buy-sell-stock',
    difficulty: 'Easy',
    track: 'DSA',
    topicCategory: 'Algorithms',
    level: 'Beginner',
    category: 'Greedy & DP',
    tags: ['Array', 'Greedy', 'Dynamic Programming'],
    companyTags: ['FinScale', 'QuantLabs', 'CloudCore'],
    description:
      'You are given an array `prices` where `prices[i]` is the price of a given stock on the `i`-th day.\n\nMaximize your profit by choosing a single day to buy one stock and choosing a different future day to sell that stock. Return the maximum profit you can achieve, or `0` if no profit is possible.',
    constraints: ['1 <= prices.length <= 10^5', '0 <= prices[i] <= 10^4'],
    examples: [
      {
        input: '7 1 5 3 6 4',
        output: '5',
        explanation: 'Buy on day 2 (price = 1) and sell on day 5 (price = 6), profit = 6 - 1 = 5.',
      },
      {
        input: '7 6 4 3 1',
        output: '0',
        explanation: 'Prices strictly decrease, so max profit is 0.',
      },
    ],
    starterTemplates: {
      python: `import sys

def max_profit(prices):
    # TODO: Track the lowest price seen so far and best profit
    return 0

if __name__ == '__main__':
    raw = sys.stdin.read().strip()
    if raw:
        prices = list(map(int, raw.split()))
        print(max_profit(prices))
`,
      javascript: `const fs = require('fs');

function maxProfit(prices) {
  // TODO: Track minimum buy price and maximum profit
  return 0;
}

const raw = fs.readFileSync(0, 'utf-8').trim();
if (raw) {
  const prices = raw.split(/\\s+/).map(Number);
  console.log(maxProfit(prices));
}
`,
      cpp: `#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int maxProfit(const vector<int>& prices) {
    // TODO: Track minimum buy price and maximum profit
    return 0;
}

int main() {
    vector<int> prices;
    int p;
    while (cin >> p) prices.push_back(p);
    if (!prices.empty()) {
        cout << maxProfit(prices) << endl;
    }
    return 0;
}
`,
    },
    testCases: [
      {
        id: 'stock-1',
        name: 'Profitable Window',
        stdin: '7 1 5 3 6 4',
        expectedStdout: '5',
        isHidden: false,
      },
      {
        id: 'stock-2',
        name: 'Monotonic Decline',
        stdin: '7 6 4 3 1',
        expectedStdout: '0',
        isHidden: false,
      },
      {
        id: 'stock-3',
        name: 'Single Day',
        stdin: '5',
        expectedStdout: '0',
        isHidden: true,
      },
    ],
    hints: [
      'Scan from left to right while maintaining `min_price` seen before the current day.',
      'At each price, update `best_profit = max(best_profit, price - min_price)`.',
    ],
    acceptanceRate: '54.2%',
  },
  {
    id: 'valid-parentheses',
    title: 'Valid Parentheses',
    slug: 'valid-parentheses',
    difficulty: 'Easy',
    track: 'DSA',
    topicCategory: 'Algorithms',
    level: 'Beginner',
    category: 'Stack',
    tags: ['String', 'Stack'],
    companyTags: ['ApexSystems', 'ByteWorks', 'CloudCore'],
    description:
      'Given a string `s` containing just the characters `(`, `)`, `{`, `}`, `[` and `]`, determine if the input string is valid.\n\nAn input string is valid if open brackets are closed by the same type of brackets in the correct nesting order.',
    constraints: ['1 <= s.length <= 10^4', 's consists only of parentheses characters ()[]{}.'],
    examples: [
      {
        input: '()[]{}',
        output: 'true',
      },
      {
        input: '([)]',
        output: 'false',
      },
    ],
    starterTemplates: {
      python: `import sys

def is_valid(s):
    # TODO: Use a stack to match opening and closing brackets
    return False

if __name__ == '__main__':
    s = sys.stdin.read().strip()
    print('true' if is_valid(s) else 'false')
`,
      javascript: `const fs = require('fs');

function isValid(s) {
  // TODO: Use a stack to match opening and closing brackets
  return false;
}

const s = fs.readFileSync(0, 'utf-8').trim();
console.log(isValid(s) ? 'true' : 'false');
`,
      cpp: `#include <iostream>
#include <string>
#include <stack>
using namespace std;

bool isValid(const string& s) {
    // TODO: Use a stack to match opening and closing brackets
    return false;
}

int main() {
    string s;
    if (getline(cin, s)) {
        cout << (isValid(s) ? "true" : "false") << endl;
    }
    return 0;
}
`,
    },
    testCases: [
      {
        id: 'paren-1',
        name: 'Mixed Balanced',
        stdin: '()[]{}',
        expectedStdout: 'true',
        isHidden: false,
      },
      {
        id: 'paren-2',
        name: 'Interleaved Invalid',
        stdin: '([)]',
        expectedStdout: 'false',
        isHidden: false,
      },
      {
        id: 'paren-3',
        name: 'Nested Valid',
        stdin: '{[()]}',
        expectedStdout: 'true',
        isHidden: true,
      },
    ],
    hints: [
      'Push opening brackets onto a stack. When encountering a closing bracket, check if the stack top is its matching opening pair.',
    ],
    acceptanceRate: '41.6%',
  },
  {
    id: 'binary-search-target',
    title: 'Binary Search Target',
    slug: 'binary-search-target',
    difficulty: 'Easy',
    track: 'DSA',
    topicCategory: 'Algorithms',
    level: 'Beginner',
    category: 'Binary Search',
    tags: ['Array', 'Binary Search'],
    companyTags: ['DataGrid', 'NexaTech'],
    description:
      'Given a sorted array of distinct integers `nums` in ascending order and an integer `target`, write a function to search `target` in `nums`. If `target` exists, return its 0-based index; otherwise return `-1`.\n\nInput line 1 contains space-separated integers `nums`; line 2 contains `target`.',
    constraints: [
      '1 <= nums.length <= 10^4',
      'All integers in nums are unique and sorted ascending.',
      'Algorithm must run in O(log n) time complexity.',
    ],
    examples: [
      {
        input: '-1 0 3 5 9 12\n9',
        output: '4',
        explanation: '9 exists in nums and its index is 4.',
      },
      {
        input: '-1 0 3 5 9 12\n2',
        output: '-1',
      },
    ],
    starterTemplates: {
      python: `import sys

def binary_search(nums, target):
    # TODO: Implement O(log n) binary search
    return -1

if __name__ == '__main__':
    lines = sys.stdin.read().splitlines()
    if len(lines) >= 2:
        nums = list(map(int, lines[0].split()))
        target = int(lines[1])
        print(binary_search(nums, target))
`,
      javascript: `const fs = require('fs');

function binarySearch(nums, target) {
  // TODO: Implement O(log n) binary search
  return -1;
}

const lines = fs.readFileSync(0, 'utf-8').trim().split('\\n');
if (lines.length >= 2) {
  const nums = lines[0].trim().split(/\\s+/).map(Number);
  const target = Number(lines[1].trim());
  console.log(binarySearch(nums, target));
}
`,
      cpp: `#include <iostream>
#include <sstream>
#include <string>
#include <vector>
using namespace std;

int binarySearch(const vector<int>& nums, int target) {
    // TODO: Implement O(log n) binary search
    return -1;
}

int main() {
    string line;
    if (!getline(cin, line)) return 0;
    istringstream iss(line);
    vector<int> nums;
    int v;
    while (iss >> v) nums.push_back(v);
    int target;
    if (cin >> target) {
        cout << binarySearch(nums, target) << endl;
    }
    return 0;
}
`,
    },
    testCases: [
      {
        id: 'bs-1',
        name: 'Target Found',
        stdin: '-1 0 3 5 9 12\n9',
        expectedStdout: '4',
        isHidden: false,
      },
      {
        id: 'bs-2',
        name: 'Target Missing',
        stdin: '-1 0 3 5 9 12\n2',
        expectedStdout: '-1',
        isHidden: false,
      },
      {
        id: 'bs-3',
        name: 'Single Element Found',
        stdin: '7\n7',
        expectedStdout: '0',
        isHidden: true,
      },
    ],
    hints: ['Maintain `left = 0` and `right = len(nums) - 1`, computing `mid = left + (right - left) // 2`.'],
    acceptanceRate: '57.9%',
  },
  {
    id: 'longest-substring-unique',
    title: 'Longest Substring Without Repeating Characters',
    slug: 'longest-substring-unique',
    difficulty: 'Medium',
    track: 'DSA',
    topicCategory: 'Algorithms',
    level: 'Intermediate',
    category: 'Sliding Window',
    tags: ['String', 'Hash Table', 'Sliding Window'],
    companyTags: ['CloudCore', 'ByteWorks', 'ApexSystems'],
    description:
      'Given a string `s`, find the length of the longest contiguous substring without repeating characters.',
    constraints: ['0 <= s.length <= 5 * 10^4', 's consists of English letters, digits, symbols, and spaces.'],
    examples: [
      {
        input: 'abcabcbb',
        output: '3',
        explanation: 'The answer is "abc", with length 3.',
      },
      {
        input: 'bbbbb',
        output: '1',
      },
    ],
    starterTemplates: {
      python: `import sys

def length_of_longest_substring(s):
    # TODO: Use sliding window with a dictionary of last seen indices
    return 0

if __name__ == '__main__':
    s = sys.stdin.read().rstrip('\\r\\n')
    print(length_of_longest_substring(s))
`,
      javascript: `const fs = require('fs');

function lengthOfLongestSubstring(s) {
  // TODO: Use sliding window with a Map of last seen indices
  return 0;
}

const s = fs.readFileSync(0, 'utf-8').replace(/\\r?\\n$/, '');
console.log(lengthOfLongestSubstring(s));
`,
      cpp: `#include <iostream>
#include <string>
#include <unordered_map>
#include <algorithm>
using namespace std;

int lengthOfLongestSubstring(const string& s) {
    // TODO: Use sliding window with last-seen map
    return 0;
}

int main() {
    string s;
    getline(cin, s);
    cout << lengthOfLongestSubstring(s) << endl;
    return 0;
}
`,
    },
    testCases: [
      {
        id: 'lswrc-1',
        name: 'Repeating Pattern',
        stdin: 'abcabcbb',
        expectedStdout: '3',
        isHidden: false,
      },
      {
        id: 'lswrc-2',
        name: 'All Identical',
        stdin: 'bbbbb',
        expectedStdout: '1',
        isHidden: false,
      },
      {
        id: 'lswrc-3',
        name: 'Mixed Window Shift',
        stdin: 'pwwkew',
        expectedStdout: '3',
        isHidden: true,
      },
    ],
    hints: [
      'Expand the right pointer one character at a time. When a duplicate appears inside the current window, advance the left pointer past its previous occurrence.',
    ],
    acceptanceRate: '35.8%',
  },
  {
    id: 'merge-overlapping-intervals',
    title: 'Merge Overlapping Intervals',
    slug: 'merge-overlapping-intervals',
    difficulty: 'Medium',
    track: 'DSA',
    topicCategory: 'Algorithms',
    level: 'Intermediate',
    category: 'Sorting & Intervals',
    tags: ['Array', 'Sorting'],
    companyTags: ['FinScale', 'CloudCore', 'NexaTech'],
    description:
      'Given a collection of intervals `[start, end]`, merge all overlapping intervals and print the resulting non-overlapping intervals sorted by start time, one `start end` pair per line.\n\nInput starts with `n` followed by `n` lines of `start end`.',
    constraints: ['1 <= intervals.length <= 10^4', '0 <= start <= end <= 10^4'],
    examples: [
      {
        input: '4\n1 3\n2 6\n8 10\n15 18',
        output: '1 6\n8 10\n15 18',
        explanation: 'Intervals [1,3] and [2,6] overlap and merge into [1,6].',
      },
    ],
    starterTemplates: {
      python: `import sys

def merge_intervals(intervals):
    # TODO: Sort intervals by start and merge overlapping bounds
    return intervals

if __name__ == '__main__':
    data = sys.stdin.read().strip().split()
    if data:
        n = int(data[0])
        intervals = [[int(data[1 + 2 * i]), int(data[2 + 2 * i])] for i in range(n)]
        for s, e in merge_intervals(intervals):
            print(f"{s} {e}")
`,
      javascript: `const fs = require('fs');

function mergeIntervals(intervals) {
  // TODO: Sort intervals by start and merge overlapping bounds
  return intervals;
}

const tokens = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);
if (tokens.length > 0 && tokens[0] !== '') {
  const n = Number(tokens[0]);
  const intervals = [];
  for (let i = 0; i < n; i++) {
    intervals.push([Number(tokens[1 + 2 * i]), Number(tokens[2 + 2 * i])]);
  }
  for (const [s, e] of mergeIntervals(intervals)) {
    console.log(\`\${s} \${e}\`);
  }
}
`,
      cpp: `#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

vector<pair<int, int>> mergeIntervals(vector<pair<int, int>>& intervals) {
    // TODO: Sort intervals by start and merge overlapping bounds
    return intervals;
}

int main() {
    int n;
    if (!(cin >> n)) return 0;
    vector<pair<int, int>> intervals(n);
    for (int i = 0; i < n; i++) cin >> intervals[i].first >> intervals[i].second;
    for (const auto& iv : mergeIntervals(intervals)) {
        cout << iv.first << " " << iv.second << endl;
    }
    return 0;
}
`,
    },
    testCases: [
      {
        id: 'mi-1',
        name: 'Standard Merge',
        stdin: '4\n1 3\n2 6\n8 10\n15 18',
        expectedStdout: '1 6\n8 10\n15 18',
        isHidden: false,
      },
      {
        id: 'mi-2',
        name: 'Touching Boundaries',
        stdin: '2\n1 4\n4 5',
        expectedStdout: '1 5',
        isHidden: false,
      },
    ],
    hints: ['Sort intervals by start coordinate first, then compare each interval start against the last merged end.'],
    acceptanceRate: '48.3%',
  },
  {
    id: 'coin-change-min-coins',
    title: 'Minimum Coin Change',
    slug: 'coin-change-min-coins',
    difficulty: 'Medium',
    track: 'DSA',
    topicCategory: 'Algorithms',
    level: 'Intermediate',
    category: 'Dynamic Programming',
    tags: ['Array', 'Dynamic Programming'],
    companyTags: ['FinScale', 'QuantLabs', 'DataGrid'],
    description:
      'You are given an integer array `coins` representing coin denominations and an integer `amount` representing a total amount of money.\n\nReturn the fewest number of coins needed to make up that `amount`. If that amount cannot be made up by any combination of the coins, return `-1`.\n\nInput line 1 contains space-separated `coins`; line 2 contains `amount`.',
    constraints: ['1 <= coins.length <= 12', '1 <= coins[i] <= 2^31 - 1', '0 <= amount <= 10^4'],
    examples: [
      {
        input: '1 2 5\n11',
        output: '3',
        explanation: '11 = 5 + 5 + 1 uses 3 coins.',
      },
      {
        input: '2\n3',
        output: '-1',
      },
    ],
    starterTemplates: {
      python: `import sys

def coin_change(coins, amount):
    # TODO: Bottom-up DP table dp[0..amount]
    return -1

if __name__ == '__main__':
    lines = sys.stdin.read().splitlines()
    if len(lines) >= 2:
        coins = list(map(int, lines[0].split()))
        amount = int(lines[1])
        print(coin_change(coins, amount))
`,
      javascript: `const fs = require('fs');

function coinChange(coins, amount) {
  // TODO: Bottom-up DP table
  return -1;
}

const lines = fs.readFileSync(0, 'utf-8').trim().split('\\n');
if (lines.length >= 2) {
  const coins = lines[0].trim().split(/\\s+/).map(Number);
  const amount = Number(lines[1].trim());
  console.log(coinChange(coins, amount));
}
`,
      cpp: `#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include <algorithm>
using namespace std;

int coinChange(const vector<int>& coins, int amount) {
    // TODO: Bottom-up DP table
    return -1;
}

int main() {
    string line;
    if (!getline(cin, line)) return 0;
    istringstream iss(line);
    vector<int> coins;
    int c;
    while (iss >> c) coins.push_back(c);
    int amount;
    if (cin >> amount) {
        cout << coinChange(coins, amount) << endl;
    }
    return 0;
}
`,
    },
    testCases: [
      {
        id: 'cc-1',
        name: 'Optimal Combination',
        stdin: '1 2 5\n11',
        expectedStdout: '3',
        isHidden: false,
      },
      {
        id: 'cc-2',
        name: 'Impossible Amount',
        stdin: '2\n3',
        expectedStdout: '-1',
        isHidden: false,
      },
      {
        id: 'cc-3',
        name: 'Zero Amount',
        stdin: '1 5\n0',
        expectedStdout: '0',
        isHidden: true,
      },
    ],
    hints: ['Define dp[a] as the minimum coins to reach amount a, initialized to amount + 1, with dp[0] = 0.'],
    acceptanceRate: '44.7%',
  },
  {
    id: 'jump-game-reachability',
    title: 'Jump Game Reachability',
    slug: 'jump-game-reachability',
    difficulty: 'Medium',
    track: 'DSA',
    topicCategory: 'Algorithms',
    level: 'Intermediate',
    category: 'Greedy',
    tags: ['Array', 'Greedy'],
    companyTags: ['ApexSystems', 'NexaTech'],
    description:
      'You are given an integer array `nums` where each element represents your maximum jump length at that position.\n\nStarting at index `0`, print `true` if you can reach the last index, or `false` otherwise.',
    constraints: ['1 <= nums.length <= 10^4', '0 <= nums[i] <= 10^5'],
    examples: [
      {
        input: '2 3 1 1 4',
        output: 'true',
      },
      {
        input: '3 2 1 0 4',
        output: 'false',
      },
    ],
    starterTemplates: {
      python: `import sys

def can_jump(nums):
    # TODO: Track the farthest reachable index greedily
    return False

if __name__ == '__main__':
    raw = sys.stdin.read().strip()
    if raw:
        nums = list(map(int, raw.split()))
        print('true' if can_jump(nums) else 'false')
`,
      javascript: `const fs = require('fs');

function canJump(nums) {
  // TODO: Track the farthest reachable index greedily
  return false;
}

const raw = fs.readFileSync(0, 'utf-8').trim();
if (raw) {
  const nums = raw.split(/\\s+/).map(Number);
  console.log(canJump(nums) ? 'true' : 'false');
}
`,
      cpp: `#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

bool canJump(const vector<int>& nums) {
    // TODO: Track the farthest reachable index greedily
    return false;
}

int main() {
    vector<int> nums;
    int x;
    while (cin >> x) nums.push_back(x);
    if (!nums.empty()) {
        cout << (canJump(nums) ? "true" : "false") << endl;
    }
    return 0;
}
`,
    },
    testCases: [
      {
        id: 'jg-1',
        name: 'Reachable End',
        stdin: '2 3 1 1 4',
        expectedStdout: 'true',
        isHidden: false,
      },
      {
        id: 'jg-2',
        name: 'Zero Trap',
        stdin: '3 2 1 0 4',
        expectedStdout: 'false',
        isHidden: false,
      },
    ],
    hints: ['Maintain `farthest = 0`. If `i > farthest` at any index, return false immediately.'],
    acceptanceRate: '39.4%',
  },
  {
    id: 'trapping-rain-water',
    title: 'Trapping Rain Water',
    slug: 'trapping-rain-water',
    difficulty: 'Hard',
    track: 'DSA',
    topicCategory: 'Algorithms',
    level: 'Advanced',
    category: 'Two Pointers & Stack',
    tags: ['Array', 'Two Pointers', 'Stack', 'Dynamic Programming'],
    companyTags: ['CloudCore', 'QuantLabs', 'ByteWorks', 'FinScale'],
    description:
      'Given `n` non-negative integers representing an elevation map where the width of each bar is `1`, compute how much water it can trap after raining.',
    constraints: ['1 <= height.length <= 2 * 10^4', '0 <= height[i] <= 10^5'],
    examples: [
      {
        input: '0 1 0 2 1 0 1 3 2 1 2 1',
        output: '6',
      },
      {
        input: '4 2 0 3 2 5',
        output: '9',
      },
    ],
    starterTemplates: {
      python: `import sys

def trap(height):
    # TODO: Solve in O(n) time and O(1) space with two pointers
    return 0

if __name__ == '__main__':
    raw = sys.stdin.read().strip()
    if raw:
        height = list(map(int, raw.split()))
        print(trap(height))
`,
      javascript: `const fs = require('fs');

function trap(height) {
  // TODO: Solve in O(n) time and O(1) space with two pointers
  return 0;
}

const raw = fs.readFileSync(0, 'utf-8').trim();
if (raw) {
  const height = raw.split(/\\s+/).map(Number);
  console.log(trap(height));
}
`,
      cpp: `#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int trap(const vector<int>& height) {
    // TODO: Solve in O(n) time and O(1) space with two pointers
    return 0;
}

int main() {
    vector<int> height;
    int h;
    while (cin >> h) height.push_back(h);
    if (!height.empty()) {
        cout << trap(height) << endl;
    }
    return 0;
}
`,
    },
    testCases: [
      {
        id: 'trw-1',
        name: 'Standard Elevation',
        stdin: '0 1 0 2 1 0 1 3 2 1 2 1',
        expectedStdout: '6',
        isHidden: false,
      },
      {
        id: 'trw-2',
        name: 'Deep Basin',
        stdin: '4 2 0 3 2 5',
        expectedStdout: '9',
        isHidden: false,
      },
    ],
    hints: [
      'Water trapped at index i depends on min(max_left, max_right) - height[i].',
      'Use two pointers from both ends while tracking left_max and right_max.',
    ],
    acceptanceRate: '63.1%',
  },
];
