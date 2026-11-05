INSERT OR REPLACE INTO users (id, name, email, cortex_id, role, status, created_at, updated_at)
    VALUES ('usr_demo_alex', 'Alex Chen', 'alex.chen@student.cortex.edu', 'alexchen', 'student', 'active', 1792557517152, 1792816717152);

INSERT OR REPLACE INTO users (id, name, email, cortex_id, role, status, created_at, updated_at)
    VALUES ('usr_demo_sophia', 'Sophia Patel', 'sophia.patel@student.cortex.edu', 'sophiap', 'student', 'active', 1792557517152, 1792816717152);

INSERT OR REPLACE INTO users (id, name, email, cortex_id, role, status, created_at, updated_at)
    VALUES ('usr_demo_marcus', 'Marcus Vance', 'marcus.vance@student.cortex.edu', 'mvance', 'student', 'active', 1792643917152, 1792816717152);

INSERT OR REPLACE INTO users (id, name, email, cortex_id, role, status, created_at, updated_at)
    VALUES ('usr_demo_elena', 'Elena Rostova', 'elena.rostova@student.cortex.edu', 'erostova', 'student', 'active', 1792643917152, 1792816717152);

INSERT OR REPLACE INTO users (id, name, email, cortex_id, role, status, created_at, updated_at)
    VALUES ('usr_demo_liam', 'Liam Wright', 'liam.wright@student.cortex.edu', 'lwright', 'student', 'active', 1792730317152, 1792816717152);

INSERT OR REPLACE INTO classrooms (
    id, name, subject, description, course_code, academic_year, section,
    teacher_id, teacher_name, join_code, join_enabled, status, created_at, updated_at, settings_json
  ) VALUES (
    'CLS_DEMO_DSA_2026',
    'CS 201: Data Structures and Algorithms',
    'Computer Science',
    'Comprehensive algorithmic laboratory covering linear structures, binary search trees, graph algorithms, and competitive programming with real-time automated evaluation.',
    'CS-201',
    '2026-2027',
    'Sec 01',
    'usr_mvlwemxk12ink',
    'shivam',
    'CORTEX26',
    1,
    'active',
    1792211917152,
    1792816717152,
    '{"allowStudentPosting":true,"allowStudentMessaging":true,"allowCodeSharing":true,"leaderboardEnabled":true,"defaultAIPolicy":"hints_only"}'
  );

INSERT OR REPLACE INTO classroom_members (
    id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online
  ) VALUES (
    'mem_CLS_DEMO_DSA_2026_usr_mvlwemxk12ink',
    'CLS_DEMO_DSA_2026',
    'usr_mvlwemxk12ink',
    'shivam',
    'shivampatilcka@gmail.com',
    'teacher',
    'active',
    1792211917152,
    1792816717152,
    1
  );

INSERT OR REPLACE INTO classroom_members (
      id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online
    ) VALUES (
      'mem_CLS_DEMO_DSA_2026_usr_demo_alex',
      'CLS_DEMO_DSA_2026',
      'usr_demo_alex',
      'Alex Chen',
      'alex.chen@student.cortex.edu',
      'student',
      'active',
      1792557517152,
      1792816417152,
      1
    );

INSERT OR REPLACE INTO classroom_members (
      id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online
    ) VALUES (
      'mem_CLS_DEMO_DSA_2026_usr_demo_sophia',
      'CLS_DEMO_DSA_2026',
      'usr_demo_sophia',
      'Sophia Patel',
      'sophia.patel@student.cortex.edu',
      'student',
      'active',
      1792557517152,
      1792815997152,
      1
    );

INSERT OR REPLACE INTO classroom_members (
      id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online
    ) VALUES (
      'mem_CLS_DEMO_DSA_2026_usr_demo_marcus',
      'CLS_DEMO_DSA_2026',
      'usr_demo_marcus',
      'Marcus Vance',
      'marcus.vance@student.cortex.edu',
      'student',
      'active',
      1792643917152,
      1792809517152,
      0
    );

INSERT OR REPLACE INTO classroom_members (
      id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online
    ) VALUES (
      'mem_CLS_DEMO_DSA_2026_usr_demo_elena',
      'CLS_DEMO_DSA_2026',
      'usr_demo_elena',
      'Elena Rostova',
      'elena.rostova@student.cortex.edu',
      'student',
      'active',
      1792643917152,
      1792815217152,
      1
    );

INSERT OR REPLACE INTO classroom_members (
      id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online
    ) VALUES (
      'mem_CLS_DEMO_DSA_2026_usr_demo_liam',
      'CLS_DEMO_DSA_2026',
      'usr_demo_liam',
      'Liam Wright',
      'liam.wright@student.cortex.edu',
      'student',
      'active',
      1792730317152,
      1792798717152,
      0
    );

INSERT OR REPLACE INTO announcements (
      id, classroom_id, author_id, author_name, author_role, title, content, pinned, created_at, updated_at
    ) VALUES (
      'ann_demo_welcome',
      'CLS_DEMO_DSA_2026',
      'usr_mvlwemxk12ink',
      'shivam',
      'teacher',
      'Welcome to CS 201: Algorithmic Systems & Data Structures',
      'Welcome everyone to the demo classroom. In this course, we examine algorithmic efficiency, time and space complexity, and advanced data structures using the Cortex collaborative execution environment.

Please inspect the assignments tab for open labs and review the reference guides in Resources.',
      1,
      1792557517152,
      1792557517152
    );

INSERT OR REPLACE INTO announcements (
      id, classroom_id, author_id, author_name, author_role, title, content, pinned, created_at, updated_at
    ) VALUES (
      'ann_demo_lab1',
      'CLS_DEMO_DSA_2026',
      'usr_mvlwemxk12ink',
      'shivam',
      'teacher',
      'Lab Assignment 1: Two Sum Hash Map Optimization Published',
      'The first coding assignment is open. Implement twoSum with O(n) linear time complexity.

Make sure your solution handles negative numbers, duplicate elements, and large inputs. Both public and hidden test cases are executed automatically.',
      0,
      1792643917152,
      1792643917152
    );

INSERT OR REPLACE INTO announcements (
      id, classroom_id, author_id, author_name, author_role, title, content, pinned, created_at, updated_at
    ) VALUES (
      'ann_demo_bst',
      'CLS_DEMO_DSA_2026',
      'usr_mvlwemxk12ink',
      'shivam',
      'teacher',
      'Lab Assignment 2: Binary Search Tree Validation in C++',
      'The C++ BST verification lab is published. Implement isValidBST verifying recursive lower and upper bounds.

Review starter code and test suite in the assignment solver.',
      0,
      1792730317152,
      1792730317152
    );

INSERT OR REPLACE INTO messages (
      id, classroom_id, sender_id, sender_name, sender_role, recipient_type, recipient_id, content, created_at, updated_at
    ) VALUES (
      'msg_dsa_1',
      'CLS_DEMO_DSA_2026',
      'usr_demo_alex',
      'Alex Chen',
      'student',
      'class',
      NULL,
      'For the BST validation problem, should we use in-order traversal or range-based recursion with min and max bounds?',
      1792744717152,
      1792744717152
    );

INSERT OR REPLACE INTO messages (
      id, classroom_id, sender_id, sender_name, sender_role, recipient_type, recipient_id, content, created_at, updated_at
    ) VALUES (
      'msg_dsa_2',
      'CLS_DEMO_DSA_2026',
      'usr_demo_sophia',
      'Sophia Patel',
      'student',
      'class',
      NULL,
      'Range recursion with long long bounds prevents integer overflow on INT_MAX and INT_MIN edge cases.',
      1792748317152,
      1792748317152
    );

INSERT OR REPLACE INTO messages (
      id, classroom_id, sender_id, sender_name, sender_role, recipient_type, recipient_id, content, created_at, updated_at
    ) VALUES (
      'msg_dsa_3',
      'CLS_DEMO_DSA_2026',
      'usr_mvlwemxk12ink',
      'shivam',
      'teacher',
      'class',
      NULL,
      'Excellent observation Sophia. Using long long for bounds handles edge tests where node values equal INT_MIN or INT_MAX.',
      1792751917152,
      1792751917152
    );

INSERT OR REPLACE INTO messages (
      id, classroom_id, sender_id, sender_name, sender_role, recipient_type, recipient_id, content, created_at, updated_at
    ) VALUES (
      'msg_dsa_4',
      'CLS_DEMO_DSA_2026',
      'usr_demo_marcus',
      'Marcus Vance',
      'student',
      'class',
      NULL,
      'Just ran the test runner on Lab 1 and passed all public and hidden cases in 35ms.',
      1792780717152,
      1792780717152
    );

INSERT OR REPLACE INTO messages (
      id, classroom_id, sender_id, sender_name, sender_role, recipient_type, recipient_id, content, created_at, updated_at
    ) VALUES (
      'msg_dsa_5',
      'CLS_DEMO_DSA_2026',
      'usr_demo_elena',
      'Elena Rostova',
      'student',
      'class',
      NULL,
      'The dual workspace split view is very helpful for comparing recursive implementations.',
      1792805917152,
      1792805917152
    );

INSERT OR REPLACE INTO messages (
      id, classroom_id, sender_id, sender_name, sender_role, recipient_type, recipient_id, content, created_at, updated_at
    ) VALUES (
      'dm_dsa_1',
      'CLS_DEMO_DSA_2026',
      'usr_demo_alex',
      'Alex Chen',
      'student',
      'direct',
      'usr_mvlwemxk12ink',
      'Professor, I submitted Assignment 1. Would you recommend unordered_map or two-pointer approach when the input array is already sorted?',
      1792766317152,
      1792766317152
    );

INSERT OR REPLACE INTO messages (
      id, classroom_id, sender_id, sender_name, sender_role, recipient_type, recipient_id, content, created_at, updated_at
    ) VALUES (
      'dm_dsa_2',
      'CLS_DEMO_DSA_2026',
      'usr_mvlwemxk12ink',
      'shivam',
      'teacher',
      'direct',
      'usr_demo_alex',
      'If the array is already sorted, the two-pointer technique achieves O(1) auxiliary space without hash map overhead.',
      1792769917152,
      1792769917152
    );

INSERT OR REPLACE INTO assignments (
      id, classroom_id, title, description, instructions, type, language, starter_code, difficulty,
      max_marks, due_at, published_at, attempts_allowed, allow_late_submission, late_penalty_percent,
      auto_grade, manual_grade, ai_policy, plagiarism_policy, status, created_by, created_at, updated_at,
      test_cases_json, rubric_json
    ) VALUES (
      'asg_demo_twosum', 'CLS_DEMO_DSA_2026', 'Two Sum: Hash Map Optimization', 'Find indices of two numbers such that they add up to a specific target.',
      'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

You may assume each input has exactly one solution, and you may not use the same element twice.

Target Complexity:
- Time Complexity: O(n)
- Space Complexity: O(n)', 'coding', 'python', 'def two_sum(nums: list[int], target: int) -> list[int]:
    """
    Find indices of two numbers that add up to target.
    """
    # Your implementation here
    pass
',
      'Easy', 100, 1793421517152, 1792557517152, 5,
      1, 10, 1, 1,
      'hints_only', 'review_only', 'published',
      'usr_mvlwemxk12ink', 1792557517152, 1792557517152,
      '[{"id":"tc1","name":"Standard Case","input":"[2, 7, 11, 15], 9","expectedOutput":"[0, 1]","isHidden":false,"weight":25,"timeoutMs":2000},{"id":"tc2","name":"Negative Numbers","input":"[-3, 4, 3, 90], 0","expectedOutput":"[0, 2]","isHidden":false,"weight":25,"timeoutMs":2000},{"id":"tc3","name":"Duplicate Values","input":"[3, 3], 6","expectedOutput":"[0, 1]","isHidden":false,"weight":25,"timeoutMs":2000},{"id":"tc4","name":"Large Array Stress Test","input":"[1, 2, ..., 10000], 19999","expectedOutput":"[9998, 9999]","isHidden":true,"weight":25,"timeoutMs":2000}]', '[{"id":"correctness","name":"Functional Correctness","maxPoints":50,"description":"Passes all edge cases including negative numbers and duplicates."},{"id":"efficiency","name":"Time and Space Complexity","maxPoints":30,"description":"O(n) linear execution achieved via hash map lookup."},{"id":"style","name":"Clean Code and Types","maxPoints":20,"description":"Clear naming and proper return types."}]'
    );

INSERT OR REPLACE INTO assignments (
      id, classroom_id, title, description, instructions, type, language, starter_code, difficulty,
      max_marks, due_at, published_at, attempts_allowed, allow_late_submission, late_penalty_percent,
      auto_grade, manual_grade, ai_policy, plagiarism_policy, status, created_by, created_at, updated_at,
      test_cases_json, rubric_json
    ) VALUES (
      'asg_demo_bst', 'CLS_DEMO_DSA_2026', 'Validate Binary Search Tree in C++', 'Determine if a binary tree satisfies the Binary Search Tree invariant.',
      'Given the root of a binary tree, determine if it is a valid binary search tree.

A valid BST satisfies:
1. The left subtree contains only nodes with keys strictly less than the node key.
2. The right subtree contains only nodes with keys strictly greater than the node key.
3. Both left and right subtrees must also be binary search trees.', 'coding', 'cpp', '#include <iostream>
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
',
      'Medium', 100, 1793680717152, 1792643917152, 3,
      1, 15, 1, 1,
      'hints_only', 'review_only', 'published',
      'usr_mvlwemxk12ink', 1792643917152, 1792643917152,
      '[{"id":"tc1","name":"Valid Three Node Tree","input":"[2, 1, 3]","expectedOutput":"true","isHidden":false,"weight":25,"timeoutMs":2000},{"id":"tc2","name":"Invalid Right Subtree Violation","input":"[5, 1, 4, null, null, 3, 6]","expectedOutput":"false","isHidden":false,"weight":25,"timeoutMs":2000},{"id":"tc3","name":"Single Node Tree","input":"[1]","expectedOutput":"true","isHidden":true,"weight":25,"timeoutMs":2000},{"id":"tc4","name":"Integer Boundary Overflows","input":"[2147483647]","expectedOutput":"true","isHidden":true,"weight":25,"timeoutMs":2000}]', '[{"id":"correctness","name":"BST Invariant Verification","maxPoints":50,"description":"Correctly verifies subtree bounds across arbitrary tree depths."},{"id":"bounds","name":"Integer Boundary Handling","maxPoints":30,"description":"Safely handles INT_MIN and INT_MAX node values."},{"id":"modularity","name":"Helper Recursion Structure","maxPoints":20,"description":"Clean helper function structure."}]'
    );

INSERT OR REPLACE INTO assignments (
      id, classroom_id, title, description, instructions, type, language, starter_code, difficulty,
      max_marks, due_at, published_at, attempts_allowed, allow_late_submission, late_penalty_percent,
      auto_grade, manual_grade, ai_policy, plagiarism_policy, status, created_by, created_at, updated_at,
      test_cases_json, rubric_json
    ) VALUES (
      'asg_demo_merge_k', 'CLS_DEMO_DSA_2026', 'Merge K Sorted Lists in C++', 'Merge k sorted linked lists and return it as one sorted list.',
      'You are given an array of k linked-lists lists, each linked-list is sorted in ascending order.

Merge all the linked-lists into one sorted linked-list and return it.

Target Complexity: O(N log k) where N is the total number of nodes across all lists and k is the number of lists.', 'coding', 'cpp', '#include <iostream>
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
',
      'Hard', 100, 1794026317152, 1792730317152, 3,
      0, 0, 1, 1,
      'hints_only', 'review_only', 'published',
      'usr_mvlwemxk12ink', 1792730317152, 1792730317152,
      '[{"id":"tc1","name":"Three Standard Lists","input":"[[1,4,5],[1,3,4],[2,6]]","expectedOutput":"[1,1,2,3,4,4,5,6]","isHidden":false,"weight":25,"timeoutMs":2000},{"id":"tc2","name":"Empty List Array","input":"[]","expectedOutput":"[]","isHidden":false,"weight":25,"timeoutMs":2000},{"id":"tc3","name":"Array of Empty Lists","input":"[[]]","expectedOutput":"[]","isHidden":true,"weight":25,"timeoutMs":2000},{"id":"tc4","name":"K Equal 50 Large Scale Test","input":"50 sorted lists with 100 elements each","expectedOutput":"sorted concatenation","isHidden":true,"weight":25,"timeoutMs":3000}]', '[{"id":"correctness","name":"Sorting and Pointer Integrity","maxPoints":50,"description":"Correctly links nodes without cycle creation."},{"id":"complexity","name":"Heap Optimization","maxPoints":30,"description":"Runs in O(N log k) time complexity."},{"id":"memory","name":"No Leaks or Dangling Pointers","maxPoints":20,"description":"Efficient in-place node relinking."}]'
    );

INSERT OR REPLACE INTO assignments (
      id, classroom_id, title, description, instructions, type, language, starter_code, difficulty,
      max_marks, due_at, published_at, attempts_allowed, allow_late_submission, late_penalty_percent,
      auto_grade, manual_grade, ai_policy, plagiarism_policy, status, created_by, created_at, updated_at,
      test_cases_json, rubric_json
    ) VALUES (
      'asg_demo_sliding_window', 'CLS_DEMO_DSA_2026', 'Longest Substring Without Repeating Characters', 'Find the length of the longest substring without repeating characters.',
      'Given a string s, find the length of the longest substring without repeating characters.

Target Complexity: O(n) runtime with O(min(m, n)) auxiliary space.', 'coding', 'python', 'def length_of_longest_substring(s: str) -> int:
    """
    Find length of the longest substring without duplicate characters.
    """
    # Your sliding window implementation here
    pass
',
      'Medium', 100, 1793248717152, 1792643917152, 5,
      1, 5, 1, 1,
      'hints_only', 'review_only', 'published',
      'usr_mvlwemxk12ink', 1792643917152, 1792643917152,
      '[{"id":"tc1","name":"Standard Alternating String","input":"\"abcabcbb\"","expectedOutput":"3","isHidden":false,"weight":25,"timeoutMs":2000},{"id":"tc2","name":"All Identical Characters","input":"\"bbbbb\"","expectedOutput":"1","isHidden":false,"weight":25,"timeoutMs":2000},{"id":"tc3","name":"Subsequence vs Substring","input":"\"pwwkew\"","expectedOutput":"3","isHidden":false,"weight":25,"timeoutMs":2000},{"id":"tc4","name":"Empty String Boundary","input":"\"\"","expectedOutput":"0","isHidden":true,"weight":25,"timeoutMs":2000}]', '[{"id":"correctness","name":"Window Tracking Correctness","maxPoints":50,"description":"Correct substring length across all edge inputs."},{"id":"performance","name":"Linear Sliding Window","maxPoints":30,"description":"Two pointer sliding window with index dictionary."},{"id":"edge","name":"Empty and Single Character Handling","maxPoints":20,"description":"Proper base cases."}]'
    );

INSERT OR REPLACE INTO submissions (
      id, assignment_id, assignment_title, classroom_id, student_id, student_name, code, language,
      version, status, submitted_at, score, max_score, is_late, test_results_json
    ) VALUES (
      'sub_demo_alex_twosum', 'asg_demo_twosum', 'Two Sum: Hash Map Optimization',
      'CLS_DEMO_DSA_2026', 'usr_demo_alex', 'Alex Chen',
      'def two_sum(nums: list[int], target: int) -> list[int]:
    lookup = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in lookup:
            return [lookup[complement], i]
        lookup[num] = i
    return []
', 'python', 1, 'graded',
      1792715917152, 100, 100, 0,
      '{"passed":4,"total":4,"runtimeMs":42,"memoryMb":14.2,"details":[{"testCaseId":"tc1","passed":true,"runtimeMs":8,"output":"[0, 1]"},{"testCaseId":"tc2","passed":true,"runtimeMs":9,"output":"[0, 2]"},{"testCaseId":"tc3","passed":true,"runtimeMs":11,"output":"[0, 1]"},{"testCaseId":"tc4","passed":true,"runtimeMs":14,"output":"[9998, 9999]"}]}'
    );

INSERT OR REPLACE INTO grades (
        id, submission_id, student_id, assignment_id, automatic_score, manual_adjustment, final_score,
        graded_by, graded_by_name, graded_at, rubric_scores_json
      ) VALUES (
        'grd_demo_alex_twosum', 'sub_demo_alex_twosum', 'usr_demo_alex',
        'asg_demo_twosum', 100, 0,
        100, 'usr_mvlwemxk12ink', 'shivam',
        1792730317152, '{"correctness":50,"efficiency":30,"style":20}'
      );

INSERT OR REPLACE INTO feedback (
        id, submission_id, author_id, author_name, content, created_at, updated_at
      ) VALUES (
        'fb_demo_alex_twosum', 'sub_demo_alex_twosum', 'usr_mvlwemxk12ink',
        'shivam', 'Excellent implementation. The single-pass dictionary lookup achieves optimal linear execution.',
        1792730317152, 1792730317152
      );

INSERT OR REPLACE INTO submissions (
      id, assignment_id, assignment_title, classroom_id, student_id, student_name, code, language,
      version, status, submitted_at, score, max_score, is_late, test_results_json
    ) VALUES (
      'sub_demo_sophia_bst', 'asg_demo_bst', 'Validate Binary Search Tree in C++',
      'CLS_DEMO_DSA_2026', 'usr_demo_sophia', 'Sophia Patel',
      '#include <iostream>
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
', 'cpp', 1, 'graded',
      1792751917152, 100, 100, 0,
      '{"passed":4,"total":4,"runtimeMs":12,"memoryMb":8.5,"details":[{"testCaseId":"tc1","passed":true,"runtimeMs":3,"output":"true"},{"testCaseId":"tc2","passed":true,"runtimeMs":3,"output":"false"},{"testCaseId":"tc3","passed":true,"runtimeMs":2,"output":"true"},{"testCaseId":"tc4","passed":true,"runtimeMs":4,"output":"true"}]}'
    );

INSERT OR REPLACE INTO grades (
        id, submission_id, student_id, assignment_id, automatic_score, manual_adjustment, final_score,
        graded_by, graded_by_name, graded_at, rubric_scores_json
      ) VALUES (
        'grd_demo_sophia_bst', 'sub_demo_sophia_bst', 'usr_demo_sophia',
        'asg_demo_bst', 100, 0,
        100, 'usr_mvlwemxk12ink', 'shivam',
        1792773517152, '{"correctness":50,"bounds":30,"modularity":20}'
      );

INSERT OR REPLACE INTO feedback (
        id, submission_id, author_id, author_name, content, created_at, updated_at
      ) VALUES (
        'fb_demo_sophia_bst', 'sub_demo_sophia_bst', 'usr_mvlwemxk12ink',
        'shivam', 'Clean recursive bounds validation with long long types to handle edge overflows.',
        1792773517152, 1792773517152
      );

INSERT OR REPLACE INTO submissions (
      id, assignment_id, assignment_title, classroom_id, student_id, student_name, code, language,
      version, status, submitted_at, score, max_score, is_late, test_results_json
    ) VALUES (
      'sub_demo_marcus_twosum', 'asg_demo_twosum', 'Two Sum: Hash Map Optimization',
      'CLS_DEMO_DSA_2026', 'usr_demo_marcus', 'Marcus Vance',
      'def two_sum(nums: list[int], target: int) -> list[int]:
    # Brute force quadratic implementation
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]
    return []
', 'python', 1, 'graded',
      1792762717152, 75, 100, 0,
      '{"passed":3,"total":4,"runtimeMs":1850,"memoryMb":12,"details":[{"testCaseId":"tc1","passed":true,"runtimeMs":5,"output":"[0, 1]"},{"testCaseId":"tc2","passed":true,"runtimeMs":5,"output":"[0, 2]"},{"testCaseId":"tc3","passed":true,"runtimeMs":6,"output":"[0, 1]"},{"testCaseId":"tc4","passed":false,"runtimeMs":2100,"error":"Time Limit Exceeded (Stress Test)"}]}'
    );

INSERT OR REPLACE INTO grades (
        id, submission_id, student_id, assignment_id, automatic_score, manual_adjustment, final_score,
        graded_by, graded_by_name, graded_at, rubric_scores_json
      ) VALUES (
        'grd_demo_marcus_twosum', 'sub_demo_marcus_twosum', 'usr_demo_marcus',
        'asg_demo_twosum', 75, 0,
        75, 'usr_mvlwemxk12ink', 'shivam',
        1792780717152, '{"correctness":45,"efficiency":15,"style":15}'
      );

INSERT OR REPLACE INTO feedback (
        id, submission_id, author_id, author_name, content, created_at, updated_at
      ) VALUES (
        'fb_demo_marcus_twosum', 'sub_demo_marcus_twosum', 'usr_mvlwemxk12ink',
        'shivam', 'Solution passes initial cases but times out on the large scale stress test. Switch to a dictionary lookup to achieve O(n) complexity.',
        1792780717152, 1792780717152
      );

INSERT OR REPLACE INTO submissions (
      id, assignment_id, assignment_title, classroom_id, student_id, student_name, code, language,
      version, status, submitted_at, score, max_score, is_late, test_results_json
    ) VALUES (
      'sub_demo_elena_sliding', 'asg_demo_sliding_window', 'Longest Substring Without Repeating Characters',
      'CLS_DEMO_DSA_2026', 'usr_demo_elena', 'Elena Rostova',
      'def length_of_longest_substring(s: str) -> int:
    char_map = {}
    left = 0
    max_len = 0
    for right, ch in enumerate(s):
        if ch in char_map and char_map[ch] >= left:
            left = char_map[ch] + 1
        char_map[ch] = right
        max_len = max(max_len, right - left + 1)
    return max_len
', 'python', 1, 'submitted',
      1792809517152, 100, 100, 0,
      '{"passed":4,"total":4,"runtimeMs":38,"memoryMb":14.1,"details":[{"testCaseId":"tc1","passed":true,"runtimeMs":8,"output":"3"},{"testCaseId":"tc2","passed":true,"runtimeMs":7,"output":"1"},{"testCaseId":"tc3","passed":true,"runtimeMs":9,"output":"3"},{"testCaseId":"tc4","passed":true,"runtimeMs":6,"output":"0"}]}'
    );

INSERT OR REPLACE INTO resources (
      id, classroom_id, uploaded_by, uploaded_by_name, name, type, url, description, unit, created_at, pinned, visibility
    ) VALUES (
      'res_demo_big_o', 'CLS_DEMO_DSA_2026', 'usr_mvlwemxk12ink', 'shivam',
      'Big-O Time and Space Complexity Cheat Sheet', 'link', 'https://en.wikipedia.org/wiki/Time_complexity', 'Reference guide for asymptotic complexity across sorting algorithms and linear structures.',
      'Unit 1: Foundations', 1792557517152, 1, 'public'
    );

INSERT OR REPLACE INTO resources (
      id, classroom_id, uploaded_by, uploaded_by_name, name, type, url, description, unit, created_at, pinned, visibility
    ) VALUES (
      'res_demo_cpp_stl', 'CLS_DEMO_DSA_2026', 'usr_mvlwemxk12ink', 'shivam',
      'C++ STL Container Reference Guide', 'link', 'https://en.cppreference.com/w/cpp/container', 'Documentation for std::vector, std::priority_queue, std::unordered_map, and iterator patterns.',
      'Unit 2: Trees & Heaps', 1792643917152, 1, 'public'
    );

INSERT OR REPLACE INTO resources (
      id, classroom_id, uploaded_by, uploaded_by_name, name, type, url, description, unit, created_at, pinned, visibility
    ) VALUES (
      'res_demo_python_algorithms', 'CLS_DEMO_DSA_2026', 'usr_mvlwemxk12ink', 'shivam',
      'Python Standard Library Collections and Heapq Primer', 'link', 'https://docs.python.org/3/library/collections.html', 'High-performance container datatypes in Python 3.11 including deque, Counter, and defaultdict.',
      'Unit 1: Foundations', 1792730317152, 0, 'public'
    );