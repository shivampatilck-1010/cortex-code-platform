INSERT OR REPLACE INTO users (id, cortex_id, password_hash, name, email, role, avatar, status, created_at, updated_at)
    VALUES ('usr_demo_alex', 'alexchen', NULL, 'Alex Chen', 'alex.chen@student.cortex.edu', 'student', NULL, 'active', 1791462649241, 1791721549241);

INSERT OR REPLACE INTO users (id, cortex_id, password_hash, name, email, role, avatar, status, created_at, updated_at)
    VALUES ('usr_demo_sophia', 'sophiap', NULL, 'Sophia Patel', 'sophia.patel@student.cortex.edu', 'student', NULL, 'active', 1791462649241, 1791721129241);

INSERT OR REPLACE INTO users (id, cortex_id, password_hash, name, email, role, avatar, status, created_at, updated_at)
    VALUES ('usr_demo_marcus', 'mvance', NULL, 'Marcus Vance', 'marcus.vance@student.cortex.edu', 'student', NULL, 'active', 1791549049241, 1791714649241);

INSERT OR REPLACE INTO users (id, cortex_id, password_hash, name, email, role, avatar, status, created_at, updated_at)
    VALUES ('usr_demo_elena', 'erostova', NULL, 'Elena Rostova', 'elena.rostova@student.cortex.edu', 'student', NULL, 'active', 1791549049241, 1791720349241);

INSERT OR REPLACE INTO users (id, cortex_id, password_hash, name, email, role, avatar, status, created_at, updated_at)
    VALUES ('usr_demo_liam', 'lwright', NULL, 'Liam Wright', 'liam.wright@student.cortex.edu', 'student', NULL, 'active', 1791635449241, 1791703849241);

INSERT OR REPLACE INTO classroom_members (id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online)
    VALUES ('mem_CLS_1791721370155_EK0C_usr_demo_alex', 'CLS_1791721370155_EK0C', 'usr_demo_alex', 'Alex Chen', 'alex.chen@student.cortex.edu', 'student', 'active', 1791462649241, 1791721549241, 1);

INSERT OR REPLACE INTO classroom_members (id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online)
    VALUES ('mem_CLS_1791721370155_EK0C_usr_demo_sophia', 'CLS_1791721370155_EK0C', 'usr_demo_sophia', 'Sophia Patel', 'sophia.patel@student.cortex.edu', 'student', 'active', 1791462649241, 1791721129241, 1);

INSERT OR REPLACE INTO classroom_members (id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online)
    VALUES ('mem_CLS_1791721370155_EK0C_usr_demo_marcus', 'CLS_1791721370155_EK0C', 'usr_demo_marcus', 'Marcus Vance', 'marcus.vance@student.cortex.edu', 'student', 'active', 1791549049241, 1791714649241, 0);

INSERT OR REPLACE INTO classroom_members (id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online)
    VALUES ('mem_CLS_1791721370155_EK0C_usr_demo_elena', 'CLS_1791721370155_EK0C', 'usr_demo_elena', 'Elena Rostova', 'elena.rostova@student.cortex.edu', 'student', 'active', 1791549049241, 1791720349241, 1);

INSERT OR REPLACE INTO classroom_members (id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online)
    VALUES ('mem_CLS_1791721370155_EK0C_usr_demo_liam', 'CLS_1791721370155_EK0C', 'usr_demo_liam', 'Liam Wright', 'liam.wright@student.cortex.edu', 'student', 'active', 1791635449241, 1791703849241, 0);

INSERT OR REPLACE INTO announcements (id, classroom_id, author_id, author_name, author_role, title, content, pinned, created_at, updated_at)
    VALUES ('ann_demo_welcome', 'CLS_1791721370155_EK0C', 'usr_mu4n608wzkpzp', 'shivam', 'teacher', '🚀 Welcome to CS 101: Algorithmic Thinking & Systems', 'Welcome everyone to the DEMO classroom! In this course, we explore foundational algorithms, data structures, and hands-on coding challenges using the Cortex collaborative execution environment.

Be sure to check out the first two assignments and review the reference materials in the Resources tab. Feel free to use the class chat for study discussions!', 1, 1791462649241, 1791462649241);

INSERT OR REPLACE INTO announcements (id, classroom_id, author_id, author_name, author_role, title, content, pinned, created_at, updated_at)
    VALUES ('ann_demo_lab1', 'CLS_1791721370155_EK0C', 'usr_mu4n608wzkpzp', 'shivam', 'teacher', '📌 Lab Assignment 1: Two Sum & Hash Map Lookup Published', 'The first coding assignment is officially open! Implement twoSum with O(n) linear time complexity.

Make sure your solution handles negative numbers, duplicates, and edge bounds. The test runner will automatically validate your code against public and hidden test cases upon submission.', 0, 1791549049241, 1791549049241);

INSERT OR REPLACE INTO announcements (id, classroom_id, author_id, author_name, author_role, title, content, pinned, created_at, updated_at)
    VALUES ('ann_demo_session', 'CLS_1791721370155_EK0C', 'usr_mu4n608wzkpzp', 'shivam', 'teacher', '⚡ Upcoming Live Workspace: Binary Search Tree Invariants', 'We will be holding an interactive live coding session on recursive tree validation and depth-first search patterns.

Review the starter code in Assignment 2 before attending!', 0, 1791635449241, 1791635449241);

INSERT OR REPLACE INTO messages (id, classroom_id, sender_id, sender_name, sender_role, recipient_type, recipient_id, content, created_at, updated_at)
    VALUES ('msg_ann_comm_1', 'CLS_1791721370155_EK0C', 'usr_demo_alex', 'Alex Chen', 'student', 'announcement', 'ann_demo_welcome', 'Excited to get started with the Cortex platform! The IDE looks super fast.', 1791484249241, 1791484249241);

INSERT OR REPLACE INTO messages (id, classroom_id, sender_id, sender_name, sender_role, recipient_type, recipient_id, content, created_at, updated_at)
    VALUES ('msg_ann_comm_2', 'CLS_1791721370155_EK0C', 'usr_demo_sophia', 'Sophia Patel', 'student', 'announcement', 'ann_demo_welcome', 'Professor, will the assignments be evaluated using Python 3.11 with full standard library?', 1791498649241, 1791498649241);

INSERT OR REPLACE INTO messages (id, classroom_id, sender_id, sender_name, sender_role, recipient_type, recipient_id, content, created_at, updated_at)
    VALUES ('msg_ann_comm_3', 'CLS_1791721370155_EK0C', 'usr_mu4n608wzkpzp', 'shivam', 'teacher', 'announcement', 'ann_demo_welcome', 'Yes Sophia! The sandbox worker runs isolated Python 3.11 with all standard modules available.', 1791505849241, 1791505849241);

INSERT OR REPLACE INTO messages (id, classroom_id, sender_id, sender_name, sender_role, recipient_type, recipient_id, content, created_at, updated_at)
    VALUES ('msg_ann_comm_4', 'CLS_1791721370155_EK0C', 'usr_demo_marcus', 'Marcus Vance', 'student', 'announcement', 'ann_demo_lab1', 'Just ran the test suite on Lab 1 — instant execution feedback is awesome!', 1791599449241, 1791599449241);

INSERT OR REPLACE INTO messages (id, classroom_id, sender_id, sender_name, sender_role, recipient_type, recipient_id, content, created_at, updated_at)
    VALUES ('msg_class_1', 'CLS_1791721370155_EK0C', 'usr_demo_alex', 'Alex Chen', 'student', 'class', NULL, 'Hey everyone! For the BST validation problem, is anyone using in-order traversal or direct range recursion?', 1791649849241, 1791649849241);

INSERT OR REPLACE INTO messages (id, classroom_id, sender_id, sender_name, sender_role, recipient_type, recipient_id, content, created_at, updated_at)
    VALUES ('msg_class_2', 'CLS_1791721370155_EK0C', 'usr_demo_sophia', 'Sophia Patel', 'student', 'class', NULL, 'Range recursion with (low, high) bounds works really nicely and runs in O(n) time!', 1791653449241, 1791653449241);

INSERT OR REPLACE INTO messages (id, classroom_id, sender_id, sender_name, sender_role, recipient_type, recipient_id, content, created_at, updated_at)
    VALUES ('msg_class_3', 'CLS_1791721370155_EK0C', 'usr_demo_elena', 'Elena Rostova', 'student', 'class', NULL, 'Agreed! Just remember to use strict inequality (< and >) because duplicate values violate the BST property.', 1791657049241, 1791657049241);

INSERT OR REPLACE INTO messages (id, classroom_id, sender_id, sender_name, sender_role, recipient_type, recipient_id, content, created_at, updated_at)
    VALUES ('msg_class_4', 'CLS_1791721370155_EK0C', 'usr_mu4n608wzkpzp', 'shivam', 'teacher', 'class', NULL, 'Spot on Elena and Sophia! Notice also how in-order traversal produces a strictly increasing sequence.', 1791664249241, 1791664249241);

INSERT OR REPLACE INTO messages (id, classroom_id, sender_id, sender_name, sender_role, recipient_type, recipient_id, content, created_at, updated_at)
    VALUES ('msg_class_5', 'CLS_1791721370155_EK0C', 'usr_demo_liam', 'Liam Wright', 'student', 'class', NULL, 'Thanks Professor! Just submitted Assignment 1 and looking forward to the live session.', 1791700249241, 1791700249241);

INSERT OR REPLACE INTO messages (id, classroom_id, sender_id, sender_name, sender_role, recipient_type, recipient_id, content, created_at, updated_at)
    VALUES ('msg_class_6', 'CLS_1791721370155_EK0C', 'usr_demo_alex', 'Alex Chen', 'student', 'class', NULL, 'Check out the new Big-O cheatsheet in Resources, it has great memory diagrams.', 1791719449241, 1791719449241);

INSERT OR REPLACE INTO messages (id, classroom_id, sender_id, sender_name, sender_role, recipient_type, recipient_id, content, created_at, updated_at)
    VALUES ('msg_dm_1', 'CLS_1791721370155_EK0C', 'usr_demo_alex', 'Alex Chen', 'student', 'direct', 'usr_mu4n608wzkpzp', 'Hi Professor, I noticed my initial solution timed out on the stress test. Is dictionary lookup preferred over nested loops?', 1791671449241, 1791671449241);

INSERT OR REPLACE INTO messages (id, classroom_id, sender_id, sender_name, sender_role, recipient_type, recipient_id, content, created_at, updated_at)
    VALUES ('msg_dm_2', 'CLS_1791721370155_EK0C', 'usr_mu4n608wzkpzp', 'shivam', 'teacher', 'direct', 'usr_demo_alex', 'Hi Alex! Yes, a single-pass hash map reduces complexity from O(n^2) to O(n) which easily passes within the 2-second limit.', 1791675049241, 1791675049241);

INSERT OR REPLACE INTO messages (id, classroom_id, sender_id, sender_name, sender_role, recipient_type, recipient_id, content, created_at, updated_at)
    VALUES ('msg_dm_3', 'CLS_1791721370155_EK0C', 'usr_demo_sophia', 'Sophia Patel', 'student', 'direct', 'usr_mu4n608wzkpzp', 'Professor, I submitted Assignment 2. Please let me know if the helper recursion meets style conventions!', 1791711049241, 1791711049241);

INSERT OR REPLACE INTO assignments (
      id, classroom_id, title, description, instructions, type, language, starter_code, difficulty,
      max_marks, due_at, published_at, attempts_allowed, allow_late_submission, late_penalty_percent,
      auto_grade, manual_grade, ai_policy, plagiarism_policy, status, created_by, created_at, updated_at,
      test_cases_json, rubric_json
    ) VALUES (
      'asg_demo_twosum', 'CLS_1791721370155_EK0C', 'Two Sum: Hash Map Optimization', 'Find indices of two numbers such that they add up to a specific target.',
      'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

You may assume that each input has exactly one solution, and you may not use the same element twice.

You can return the answer in any order.

Target Complexity:
- Time Complexity: O(n)
- Space Complexity: O(n)', 'coding', 'python', 'def two_sum(nums: list[int], target: int) -> list[int]:
    """
    Find indices of two numbers in nums that add up to target.
    :type nums: List[int]
    :type target: int
    :rtype: List[int]
    """
    # Your solution here
    pass
',
      'Easy', 100, 1792326649241, 1791549049241, 5,
      1, 10, 1, 1,
      'hints_only', 'review_only', 'published',
      'usr_mu4n608wzkpzp', 1791549049241, 1791549049241,
      '[{"id":"tc1","name":"Standard Case","input":"[2, 7, 11, 15], 9","expectedOutput":"[0, 1]","isHidden":false,"weight":25,"timeoutMs":2000},{"id":"tc2","name":"Negative Numbers","input":"[-3, 4, 3, 90], 0","expectedOutput":"[0, 2]","isHidden":false,"weight":25,"timeoutMs":2000},{"id":"tc3","name":"Duplicate Values","input":"[3, 3], 6","expectedOutput":"[0, 1]","isHidden":false,"weight":25,"timeoutMs":2000},{"id":"tc4","name":"Large Array Stress Test","input":"[1, 2, ..., 10000], 19999","expectedOutput":"[9998, 9999]","isHidden":true,"weight":25,"timeoutMs":2000}]', '[{"id":"correctness","name":"Functional Correctness","maxPoints":50,"description":"Passes all edge cases including negative numbers and duplicates."},{"id":"efficiency","name":"Time & Space Efficiency","maxPoints":30,"description":"O(n) runtime achieved via hash table lookup."},{"id":"style","name":"Code Quality & Typing","maxPoints":20,"description":"Clean idiomatic code with proper type annotations."}]'
    );

INSERT OR REPLACE INTO assignments (
      id, classroom_id, title, description, instructions, type, language, starter_code, difficulty,
      max_marks, due_at, published_at, attempts_allowed, allow_late_submission, late_penalty_percent,
      auto_grade, manual_grade, ai_policy, plagiarism_policy, status, created_by, created_at, updated_at,
      test_cases_json, rubric_json
    ) VALUES (
      'asg_demo_validate_bst', 'CLS_1791721370155_EK0C', 'Validate Binary Search Tree', 'Determine if a binary tree satisfies the Binary Search Tree invariant.',
      'Given the root of a binary tree, determine if it is a valid binary search tree (BST).

A valid BST satisfies:
1. The left subtree contains only nodes with keys strictly less than the node''s key.
2. The right subtree contains only nodes with keys strictly greater than the node''s key.
3. Both subtrees must also be binary search trees.', 'coding', 'python', 'class TreeNode:
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
',
      'Medium', 100, 1792585849241, 1791635449241, 3,
      1, 15, 1, 1,
      'hints_only', 'review_only', 'published',
      'usr_mu4n608wzkpzp', 1791635449241, 1791635449241,
      '[{"id":"tc1","name":"Valid 3-Node Tree","input":"[2, 1, 3]","expectedOutput":"True","isHidden":false,"weight":25,"timeoutMs":2000},{"id":"tc2","name":"Invalid Subtree Violation","input":"[5, 1, 4, None, None, 3, 6]","expectedOutput":"False","isHidden":false,"weight":25,"timeoutMs":2000},{"id":"tc3","name":"Single Node Tree","input":"[1]","expectedOutput":"True","isHidden":true,"weight":25,"timeoutMs":2000},{"id":"tc4","name":"Boundary Bounds & Large Values","input":"[2147483647]","expectedOutput":"True","isHidden":true,"weight":25,"timeoutMs":2000}]', '[{"id":"correctness","name":"Invariant Validation","maxPoints":50,"description":"Correctly verifies subtree bounds across arbitrary depths."},{"id":"recursion","name":"Recursive Bounds Handling","maxPoints":30,"description":"Proper lower and upper bound propagation."},{"id":"readability","name":"Clarity & Modularity","maxPoints":20,"description":"Clear helper function structure and edge checks."}]'
    );

INSERT OR REPLACE INTO submissions (
      id, assignment_id, assignment_title, classroom_id, student_id, student_name, code, language,
      version, status, submitted_at, score, max_score, is_late, test_results_json
    ) VALUES (
      'sub_demo_alex_twosum', 'asg_demo_twosum', 'Two Sum: Hash Map Optimization',
      'CLS_1791721370155_EK0C', 'usr_demo_alex', 'Alex Chen',
      'def two_sum(nums: list[int], target: int) -> list[int]:
    lookup = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in lookup:
            return [lookup[complement], i]
        lookup[num] = i
    return []
', 'python', 1, 'completed',
      1791635449241, 100, 100, 0,
      '[{"id":"tc1","name":"Standard Case","status":"passed","executionTimeMs":12,"passed":true},{"id":"tc2","name":"Negative Numbers","status":"passed","executionTimeMs":14,"passed":true},{"id":"tc3","name":"Duplicate Values","status":"passed","executionTimeMs":10,"passed":true},{"id":"tc4","name":"Large Array Stress Test","status":"passed","executionTimeMs":45,"passed":true}]'
    );

INSERT OR REPLACE INTO grades (
        id, submission_id, student_id, assignment_id, automatic_score, manual_adjustment, final_score,
        graded_by, graded_by_name, graded_at, rubric_scores_json
      ) VALUES (
        'grd_demo_alex_twosum', 'sub_demo_alex_twosum', 'usr_demo_alex',
        'asg_demo_twosum', 100, 0,
        100, 'usr_mu4n608wzkpzp', 'shivam',
        1791642649241, '{"correctness":50,"efficiency":30,"style":20}'
      );

INSERT OR REPLACE INTO feedback (
        id, submission_id, author_id, author_name, content, created_at, updated_at
      ) VALUES (
        'fbk_demo_alex_twosum', 'sub_demo_alex_twosum', 'usr_mu4n608wzkpzp',
        'shivam', 'Flawless single-pass hash map solution! Excellent O(n) performance and clean type hints.',
        1791642649241, 1791642649241
      );

INSERT OR REPLACE INTO submissions (
      id, assignment_id, assignment_title, classroom_id, student_id, student_name, code, language,
      version, status, submitted_at, score, max_score, is_late, test_results_json
    ) VALUES (
      'sub_demo_sophia_twosum', 'asg_demo_twosum', 'Two Sum: Hash Map Optimization',
      'CLS_1791721370155_EK0C', 'usr_demo_sophia', 'Sophia Patel',
      'def two_sum(nums: list[int], target: int) -> list[int]:
    seen = {}
    for index, val in enumerate(nums):
        diff = target - val
        if diff in seen:
            return [seen[diff], index]
        seen[val] = index
    return []
', 'python', 1, 'completed',
      1791649849241, 100, 100, 0,
      '[{"id":"tc1","name":"Standard Case","status":"passed","executionTimeMs":11,"passed":true},{"id":"tc2","name":"Negative Numbers","status":"passed","executionTimeMs":13,"passed":true},{"id":"tc3","name":"Duplicate Values","status":"passed","executionTimeMs":9,"passed":true},{"id":"tc4","name":"Large Array Stress Test","status":"passed","executionTimeMs":42,"passed":true}]'
    );

INSERT OR REPLACE INTO grades (
        id, submission_id, student_id, assignment_id, automatic_score, manual_adjustment, final_score,
        graded_by, graded_by_name, graded_at, rubric_scores_json
      ) VALUES (
        'grd_demo_sophia_twosum', 'sub_demo_sophia_twosum', 'usr_demo_sophia',
        'asg_demo_twosum', 100, 0,
        100, 'usr_mu4n608wzkpzp', 'shivam',
        1791657049241, '{"correctness":50,"efficiency":30,"style":20}'
      );

INSERT OR REPLACE INTO feedback (
        id, submission_id, author_id, author_name, content, created_at, updated_at
      ) VALUES (
        'fbk_demo_sophia_twosum', 'sub_demo_sophia_twosum', 'usr_mu4n608wzkpzp',
        'shivam', 'Very crisp code! Perfect variable naming and handles all cases seamlessly.',
        1791657049241, 1791657049241
      );

INSERT OR REPLACE INTO submissions (
      id, assignment_id, assignment_title, classroom_id, student_id, student_name, code, language,
      version, status, submitted_at, score, max_score, is_late, test_results_json
    ) VALUES (
      'sub_demo_marcus_twosum', 'asg_demo_twosum', 'Two Sum: Hash Map Optimization',
      'CLS_1791721370155_EK0C', 'usr_demo_marcus', 'Marcus Vance',
      'def two_sum(nums: list[int], target: int) -> list[int]:
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]
    return []
', 'python', 1, 'completed',
      1791664249241, 75, 100, 0,
      '[{"id":"tc1","name":"Standard Case","status":"passed","executionTimeMs":15,"passed":true},{"id":"tc2","name":"Negative Numbers","status":"passed","executionTimeMs":14,"passed":true},{"id":"tc3","name":"Duplicate Values","status":"passed","executionTimeMs":12,"passed":true},{"id":"tc4","name":"Large Array Stress Test","status":"timeout","executionTimeMs":2005,"passed":false}]'
    );

INSERT OR REPLACE INTO grades (
        id, submission_id, student_id, assignment_id, automatic_score, manual_adjustment, final_score,
        graded_by, graded_by_name, graded_at, rubric_scores_json
      ) VALUES (
        'grd_demo_marcus_twosum', 'sub_demo_marcus_twosum', 'usr_demo_marcus',
        'asg_demo_twosum', 75, 0,
        75, 'usr_mu4n608wzkpzp', 'shivam',
        1791671449241, '{"correctness":45,"efficiency":15,"style":15}'
      );

INSERT OR REPLACE INTO feedback (
        id, submission_id, author_id, author_name, content, created_at, updated_at
      ) VALUES (
        'fbk_demo_marcus_twosum', 'sub_demo_marcus_twosum', 'usr_mu4n608wzkpzp',
        'shivam', 'Good effort Marcus! Your logic is correct, but the nested loops give O(n^2) time complexity, timing out on test case 4. Switch to a dictionary for O(1) lookup.',
        1791671449241, 1791671449241
      );

INSERT OR REPLACE INTO submissions (
      id, assignment_id, assignment_title, classroom_id, student_id, student_name, code, language,
      version, status, submitted_at, score, max_score, is_late, test_results_json
    ) VALUES (
      'sub_demo_elena_bst', 'asg_demo_validate_bst', 'Validate Binary Search Tree',
      'CLS_1791721370155_EK0C', 'usr_demo_elena', 'Elena Rostova',
      'def is_valid_bst(root) -> bool:
    def validate(node, low=float(''-inf''), high=float(''inf'')):
        if not node:
            return True
        if node.val <= low or node.val >= high:
            return False
        return validate(node.left, low, node.val) and validate(node.right, node.val, high)
    return validate(root)
', 'python', 1, 'completed',
      1791693049241, 95, 100, 0,
      '[{"id":"tc1","name":"Valid 3-Node Tree","status":"passed","executionTimeMs":12,"passed":true},{"id":"tc2","name":"Invalid Subtree Violation","status":"passed","executionTimeMs":11,"passed":true},{"id":"tc3","name":"Single Node Tree","status":"passed","executionTimeMs":8,"passed":true},{"id":"tc4","name":"Boundary Bounds & Large Values","status":"passed","executionTimeMs":15,"passed":true}]'
    );

INSERT OR REPLACE INTO grades (
        id, submission_id, student_id, assignment_id, automatic_score, manual_adjustment, final_score,
        graded_by, graded_by_name, graded_at, rubric_scores_json
      ) VALUES (
        'grd_demo_elena_bst', 'sub_demo_elena_bst', 'usr_demo_elena',
        'asg_demo_validate_bst', 100, -5,
        95, 'usr_mu4n608wzkpzp', 'shivam',
        1791703849241, '{"correctness":50,"recursion":30,"readability":15}'
      );

INSERT OR REPLACE INTO feedback (
        id, submission_id, author_id, author_name, content, created_at, updated_at
      ) VALUES (
        'fbk_demo_elena_bst', 'sub_demo_elena_bst', 'usr_mu4n608wzkpzp',
        'shivam', 'Beautiful and clean recursive invariant solution! Minor point off for missing docstrings, but algorithmic execution is 10/10.',
        1791703849241, 1791703849241
      );

INSERT OR REPLACE INTO resources (
      id, classroom_id, uploaded_by, uploaded_by_name, name, type, url, description, unit, created_at, pinned, visibility
    ) VALUES (
      'res_demo_1', 'CLS_1791721370155_EK0C', 'usr_mu4n608wzkpzp', 'shivam',
      'Lecture 01 - Asymptotic Analysis & Big-O Cheatsheet', 'document', 'https://cortexcode.io/resources/cheatsheet-complexity.pdf', 'Comprehensive quick-reference table for common operations across Array, Linked List, Stack, Queue, Tree, and Hash Table.',
      'Unit 1: Foundations', 1791462649241, 1, 'public'
    );

INSERT OR REPLACE INTO resources (
      id, classroom_id, uploaded_by, uploaded_by_name, name, type, url, description, unit, created_at, pinned, visibility
    ) VALUES (
      'res_demo_2', 'CLS_1791721370155_EK0C', 'usr_mu4n608wzkpzp', 'shivam',
      'Python Standard Library Data Structures Guide', 'document', 'https://cortexcode.io/resources/python-structures-guide.pdf', 'Practical guide to collections.deque, heapq, dict, and bisect for competitive programming and interview prep.',
      'Unit 1: Foundations', 1791549049241, 0, 'public'
    );

INSERT OR REPLACE INTO resources (
      id, classroom_id, uploaded_by, uploaded_by_name, name, type, url, description, unit, created_at, pinned, visibility
    ) VALUES (
      'res_demo_3', 'CLS_1791721370155_EK0C', 'usr_mu4n608wzkpzp', 'shivam',
      'Binary Search Tree Traversal & Invariant Patterns', 'code', 'https://cortexcode.io/resources/bst_snippets.py', 'Starter helper templates demonstrating iterative vs recursive in-order, pre-order, and level-order traversals.',
      'Unit 2: Trees & Graphs', 1791635449241, 0, 'public'
    );

INSERT OR REPLACE INTO resources (
      id, classroom_id, uploaded_by, uploaded_by_name, name, type, url, description, unit, created_at, pinned, visibility
    ) VALUES (
      'res_demo_4', 'CLS_1791721370155_EK0C', 'usr_mu4n608wzkpzp', 'shivam',
      'Cortex Collaborative Sandbox Architecture', 'document', 'https://cortexcode.io/resources/cortex-architecture.pdf', 'Technical overview of dual workspace synchronization, Durable Objects, and real-time execution sandboxes.',
      'Course Overview', 1791462649241, 0, 'public'
    );