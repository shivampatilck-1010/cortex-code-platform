
    INSERT OR REPLACE INTO assignments (
      id, classroom_id, title, description, instructions, type, language, starter_code, difficulty,
      max_marks, due_at, published_at, attempts_allowed, allow_late_submission, late_penalty_percent,
      auto_grade, manual_grade, ai_policy, plagiarism_policy, status, created_by, created_at, updated_at,
      test_cases_json
    ) VALUES (
      'asg_demo_reverse_list', 'CLS_1791721370155_EK0C', 'Reverse Linked List', 'Given the head of a singly linked list, reverse the list, and return the reversed list.',
      'Given the `head` of a singly linked list, reverse the list, and return *the reversed list*.

### Example 1
```text
Input: head = [1,2,3,4,5]
Output: [5,4,3,2,1]
```

### Example 2
```text
Input: head = [1,2]
Output: [2,1]
```

### Example 3
```text
Input: head = []
Output: []
```

### Constraints
- The number of nodes in the list is the range `[0, 5000]`.
- `-5000 <= Node.val <= 5000`

### Target Complexity
- **Time Complexity:** `O(n)` single linear traversal.
- **Space Complexity:** `O(1)` in-place pointer manipulation.', 'coding', 'cpp', '#include <iostream>
#include <vector>
#include <sstream>

struct ListNode {
    int val;
    ListNode *next;
    ListNode(int x) : val(x), next(nullptr) {}
};

ListNode* reverseList(ListNode* head) {
    ListNode* prev = nullptr;
    ListNode* curr = head;
    while (curr != nullptr) {
        ListNode* nextTemp = curr->next;
        curr->next = prev;
        prev = curr;
        curr = nextTemp;
    }
    return prev;
}

// Driver harness
int main() {
    std::string line;
    if (std::getline(std::cin, line)) {
        // Parse comma-separated list [1, 2, 3]
        std::vector<int> nums;
        std::string clean = "";
        for (char c : line) {
            if (c != ''['' && c != '']'' && c != '' '') clean += c;
        }
        std::stringstream ss(clean);
        std::string item;
        while (std::getline(ss, item, '','')) {
            if (!item.empty()) nums.push_back(std::stoi(item));
        }

        ListNode dummy(0);
        ListNode* tail = &dummy;
        for (int v : nums) {
            tail->next = new ListNode(v);
            tail = tail->next;
        }

        ListNode* rev = reverseList(dummy.next);
        std::cout << "[";
        bool first = true;
        while (rev) {
            if (!first) std::cout << ", ";
            std::cout << rev->val;
            first = false;
            rev = rev->next;
        }
        std::cout << "]" << std::endl;
    }
    return 0;
}
',
      'Easy', 100, 1792938308194, 1791728708194, 5, 1, 10,
      1, 1, 'hints_only', 'review_only', 'published', 'usr_mu4n608wzkpzp', 1791728708194, 1791728708194,
      '[{"id":"tc1","name":"Standard 5-Node List","input":"[1, 2, 3, 4, 5]","expectedOutput":"[5, 4, 3, 2, 1]","visibility":"public","isHidden":false,"weight":25,"timeoutMs":2000},{"id":"tc2","name":"Two Elements","input":"[1, 2]","expectedOutput":"[2, 1]","visibility":"public","isHidden":false,"weight":25,"timeoutMs":2000},{"id":"tc3","name":"Single Node List","input":"[42]","expectedOutput":"[42]","visibility":"hidden","isHidden":true,"weight":25,"timeoutMs":2000},{"id":"tc4","name":"Empty List Boundary","input":"[]","expectedOutput":"[]","visibility":"hidden","isHidden":true,"weight":25,"timeoutMs":2000}]'
    );
  


    INSERT OR REPLACE INTO assignments (
      id, classroom_id, title, description, instructions, type, language, starter_code, difficulty,
      max_marks, due_at, published_at, attempts_allowed, allow_late_submission, late_penalty_percent,
      auto_grade, manual_grade, ai_policy, plagiarism_policy, status, created_by, created_at, updated_at,
      test_cases_json
    ) VALUES (
      'asg_demo_valid_parentheses', 'CLS_1791721370155_EK0C', 'Valid Parentheses: Stack Verification', 'Given a string s containing just the characters ''('', '')'', ''{'', ''}'', ''['' and '']'', determine if the input string is valid.',
      'Given a string `s` containing just the characters `''(''`, `'')''`, `''{''`, `''}''`, `''[''` and `'']''`, determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.

### Example 1
```text
Input: s = "()[]{}"
Output: true
```

### Example 2
```text
Input: s = "(]"
Output: false
```

### Example 3
```text
Input: s = "([])"
Output: true
```

### Constraints
- `1 <= s.length <= 10⁴`
- `s` consists of parentheses only `''()[]{}''`.

### Target Complexity
- **Time Complexity:** `O(n)` single pass with stack.
- **Space Complexity:** `O(n)` auxiliary stack space.', 'coding', 'cpp', '#include <iostream>
#include <string>
#include <stack>

bool isValid(std::string s) {
    std::stack<char> st;
    for (char c : s) {
        if (c == ''('' || c == ''{'' || c == ''['') {
            st.push(c);
        } else {
            if (st.empty()) return false;
            char top = st.top();
            st.pop();
            if ((c == '')'' && top != ''('') ||
                (c == ''}'' && top != ''{'') ||
                (c == '']'' && top != ''['')) {
                return false;
            }
        }
    }
    return st.empty();
}

int main() {
    std::string s;
    if (std::cin >> s) {
        // Strip surrounding quotes if present
        if (s.front() == ''"'' && s.back() == ''"'') {
            s = s.substr(1, s.length() - 2);
        }
        std::cout << (isValid(s) ? "true" : "false") << std::endl;
    }
    return 0;
}
',
      'Easy', 100, 1792938308194, 1791728708194, 5, 1, 10,
      1, 1, 'hints_only', 'review_only', 'published', 'usr_mu4n608wzkpzp', 1791728708194, 1791728708194,
      '[{"id":"tc1","name":"Sequential Valid Brackets","input":"()[]{}","expectedOutput":"true","visibility":"public","isHidden":false,"weight":25,"timeoutMs":2000},{"id":"tc2","name":"Mismatched Closing Bracket","input":"(]","expectedOutput":"false","visibility":"public","isHidden":false,"weight":25,"timeoutMs":2000},{"id":"tc3","name":"Nested Heterogeneous Brackets","input":"([])","expectedOutput":"true","visibility":"hidden","isHidden":true,"weight":25,"timeoutMs":2000},{"id":"tc4","name":"Unclosed Left Brackets","input":"(((","expectedOutput":"false","visibility":"hidden","isHidden":true,"weight":25,"timeoutMs":2000}]'
    );
  


    INSERT OR REPLACE INTO assignments (
      id, classroom_id, title, description, instructions, type, language, starter_code, difficulty,
      max_marks, due_at, published_at, attempts_allowed, allow_late_submission, late_penalty_percent,
      auto_grade, manual_grade, ai_policy, plagiarism_policy, status, created_by, created_at, updated_at,
      test_cases_json
    ) VALUES (
      'asg_demo_coin_change', 'CLS_1791721370155_EK0C', 'Coin Change: Dynamic Programming', 'Find the minimum number of coins needed to make up a given amount using available coin denominations.',
      'You are given an integer array `coins` representing coins of different denominations and an integer `amount` representing a total amount of money.

Return *the fewest number of coins that you need to make up that amount*. If that amount of money cannot be made up by any combination of the coins, return `-1`.

You may assume that you have an infinite number of each kind of coin.

### Example 1
```text
Input: coins = [1,2,5], amount = 11
Output: 3
Explanation: 11 = 5 + 5 + 1 (3 coins)
```

### Example 2
```text
Input: coins = [2], amount = 3
Output: -1
```

### Example 3
```text
Input: coins = [1], amount = 0
Output: 0
```

### Constraints
- `1 <= coins.length <= 12`
- `1 <= coins[i] <= 2³¹ - 1`
- `0 <= amount <= 10⁴`

### Target Complexity
- **Time Complexity:** `O(S * n)` where `S` is amount and `n` is number of coins.
- **Space Complexity:** `O(S)` auxiliary dynamic programming table.', 'coding', 'cpp', '#include <iostream>
#include <vector>
#include <sstream>
#include <algorithm>

int coinChange(std::vector<int>& coins, int amount) {
    std::vector<int> dp(amount + 1, amount + 1);
    dp[0] = 0;
    for (int i = 1; i <= amount; ++i) {
        for (int c : coins) {
            if (c <= i) {
                dp[i] = std::min(dp[i], dp[i - c] + 1);
            }
        }
    }
    return dp[amount] > amount ? -1 : dp[amount];
}

int main() {
    std::string line;
    if (std::getline(std::cin, line)) {
        // Parse "[1, 2, 5], 11"
        auto commaPos = line.rfind('','');
        if (commaPos != std::string::npos) {
            std::string coinsPart = line.substr(0, commaPos);
            int amount = std::stoi(line.substr(commaPos + 1));
            
            std::vector<int> coins;
            std::string clean = "";
            for (char c : coinsPart) {
                if (c != ''['' && c != '']'' && c != '' '') clean += c;
            }
            std::stringstream ss(clean);
            std::string item;
            while (std::getline(ss, item, '','')) {
                if (!item.empty()) coins.push_back(std::stoi(item));
            }
            std::cout << coinChange(coins, amount) << std::endl;
        }
    }
    return 0;
}
',
      'Medium', 100, 1792938308194, 1791728708194, 5, 1, 10,
      1, 1, 'hints_only', 'review_only', 'published', 'usr_mu4n608wzkpzp', 1791728708194, 1791728708194,
      '[{"id":"tc1","name":"Greedy Fails (DP Minimum)","input":"[1, 2, 5], 11","expectedOutput":"3","visibility":"public","isHidden":false,"weight":25,"timeoutMs":2000},{"id":"tc2","name":"Impossible Amount","input":"[2], 3","expectedOutput":"-1","visibility":"public","isHidden":false,"weight":25,"timeoutMs":2000},{"id":"tc3","name":"Zero Target Amount","input":"[1], 0","expectedOutput":"0","visibility":"hidden","isHidden":true,"weight":25,"timeoutMs":2000},{"id":"tc4","name":"Multiple Denominations","input":"[1, 3, 4], 6","expectedOutput":"2","visibility":"hidden","isHidden":true,"weight":25,"timeoutMs":2000}]'
    );
  