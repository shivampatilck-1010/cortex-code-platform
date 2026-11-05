
UPDATE assignments
SET instructions = '### Input Format
- **Parameter 1**: `nums: List[int]` — An array of integers ($2 \le \text{len}(nums) \le 10^4$).
- **Parameter 2**: `target: int` — The integer target value ($-10^9 \le \text{target} \le 10^9$).

### Output Format
- **Return / stdout**: `List[int]` — Two distinct indices `[i, j]` such that `nums[i] + nums[j] == target`.

---

### Examples

#### Example 1
```text
Input: nums = [2, 7, 11, 15], target = 9
Output: [0, 1]
Explanation: Because nums[0] + nums[1] == 2 + 7 == 9, we return [0, 1].
```

#### Example 2
```text
Input: nums = [-3, 4, 3, 90], target = 0
Output: [0, 2]
Explanation: Because nums[0] + nums[2] == -3 + 3 == 0, we return [0, 2].
```

#### Example 3
```text
Input: nums = [3, 3], target = 6
Output: [0, 1]
Explanation: Because nums[0] + nums[1] == 3 + 3 == 6, we return [0, 1].
```

---

### Constraints & Complexity
- `2 <= len(nums) <= 10^4`
- `-10^9 <= nums[i] <= 10^9`
- `-10^9 <= target <= 10^9`
- Exactly one valid answer exists.
- **Target Time Complexity**: $\mathcal{O}(n)$
- **Target Space Complexity**: $\mathcal{O}(n)$',
    starter_code = 'def two_sum(nums: list[int], target: int) -> list[int]:
    """
    Find indices of two numbers in nums that add up to target.
    :type nums: List[int]
    :type target: int
    :rtype: List[int]
    """
    # Your solution here
    pass

# --- Local Driver / Test Runner ---
if __name__ == ''__main__'':
    # Test your solution:
    print(two_sum([2, 7, 11, 15], 9))  # Expected: [0, 1]
',
    test_cases_json = '[{"id":"tc1","name":"Standard Positive Integers","input":"[2, 7, 11, 15], 9","expectedOutput":"[0, 1]","visibility":"public","isHidden":false,"weight":25,"timeoutMs":2000,"memoryLimitMb":128},{"id":"tc2","name":"Negative Numbers & Zero Target","input":"[-3, 4, 3, 90], 0","expectedOutput":"[0, 2]","visibility":"public","isHidden":false,"weight":25,"timeoutMs":2000,"memoryLimitMb":128},{"id":"tc3","name":"Duplicate Values Case","input":"[3, 3], 6","expectedOutput":"[0, 1]","visibility":"public","isHidden":false,"weight":25,"timeoutMs":2000,"memoryLimitMb":128},{"id":"tc4","name":"Stress Test: 10,000 Elements & Large Bounds","input":"[1, 2, ..., 10000], 19999","expectedOutput":"[9998, 9999]","visibility":"hidden","isHidden":true,"weight":25,"timeoutMs":2000,"memoryLimitMb":128}]'
WHERE id = 'asg_demo_twosum';

UPDATE assignments
SET instructions = '### Input Format
- **Parameter**: `root: TreeNode` — The root node of a binary tree (represented as level-order list in test cases).

### Output Format
- **Return / stdout**: `bool` — `True` if the tree satisfies the BST invariant, `False` otherwise.

---

### Examples

#### Example 1
```text
Input: root = [2, 1, 3]
Output: True
Explanation: Root 2 has left child 1 (< 2) and right child 3 (> 2). Valid BST.
```

#### Example 2
```text
Input: root = [5, 1, 4, None, None, 3, 6]
Output: False
Explanation: The root node''s value is 5 but its right child''s value is 4 (violating BST invariant).
```

---

### Constraints & Complexity
- The number of nodes in the tree is in the range `[1, 10^4]`.
- `-2^31 <= Node.val <= 2^31 - 1`
- **Target Time Complexity**: $\mathcal{O}(n)$
- **Target Space Complexity**: $\mathcal{O}(h)$ where $h$ is tree height.',
    starter_code = 'class TreeNode:
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

# --- Local Driver / Test Runner ---
if __name__ == ''__main__'':
    # Test with sample tree [2, 1, 3]:
    sample = TreeNode(2, TreeNode(1), TreeNode(3))
    print(is_valid_bst(sample))  # Expected: True
',
    test_cases_json = '[{"id":"tc1","name":"Valid 3-Node Tree","input":"[2, 1, 3]","expectedOutput":"True","visibility":"public","isHidden":false,"weight":25,"timeoutMs":2000,"memoryLimitMb":128},{"id":"tc2","name":"Invalid Subtree Violation","input":"[5, 1, 4, null, null, 3, 6]","expectedOutput":"False","visibility":"public","isHidden":false,"weight":25,"timeoutMs":2000,"memoryLimitMb":128},{"id":"tc3","name":"Single Node Edge Case","input":"[1]","expectedOutput":"True","visibility":"hidden","isHidden":true,"weight":25,"timeoutMs":2000,"memoryLimitMb":128},{"id":"tc4","name":"32-Bit Integer Boundary Bounds","input":"[2147483647]","expectedOutput":"True","visibility":"hidden","isHidden":true,"weight":25,"timeoutMs":2000,"memoryLimitMb":128}]'
WHERE id = 'asg_demo_validate_bst';
