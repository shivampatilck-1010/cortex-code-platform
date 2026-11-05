const fs = require('fs');
const path = require('path');

const twosumInstructions = `Given an array of integers \`nums\` and an integer \`target\`, return *indices of the two numbers such that they add up to \`target\`*.

You may assume that each input would have **exactly one solution**, and you may not use the same element twice.

You can return the answer in any order.

### Example 1
\`\`\`text
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: Because nums[0] + nums[1] == 2 + 7 == 9, we return [0, 1].
\`\`\`

### Example 2
\`\`\`text
Input: nums = [3,2,4], target = 6
Output: [1,2]
Explanation: Because nums[1] + nums[2] == 2 + 4 == 6, we return [1, 2].
\`\`\`

### Example 3
\`\`\`text
Input: nums = [3,3], target = 6
Output: [0,1]
\`\`\`

### Constraints
- \`2 <= nums.length <= 10⁴\`
- \`-10⁹ <= nums[i] <= 10⁹\`
- \`-10⁹ <= target <= 10⁹\`
- **Only one valid answer exists.**

### Target Complexity
- **Time Complexity:** \`O(n)\` using single-pass hash map lookup.
- **Space Complexity:** \`O(n)\` auxiliary memory for hash storage.`;

const twosumStarter = `def two_sum(nums: list[int], target: int) -> list[int]:
    """
    Find indices of two numbers in nums that add up to target.
    :type nums: List[int]
    :type target: int
    :rtype: List[int]
    """
    # Your solution here
    pass
`;

const bstInstructions = `Given the root of a binary tree, determine if it is a **valid binary search tree (BST)**.

A **valid BST** is defined as follows:
- The left subtree of a node contains only nodes with keys **strictly less than** the node's key.
- The right subtree of a node contains only nodes with keys **strictly greater than** the node's key.
- Both the left and right subtrees must also be binary search trees.

### Example 1
\`\`\`text
Input: root = [2,1,3]
Output: true
Explanation: The root node's value is 2, with left child 1 (< 2) and right child 3 (> 2).
\`\`\`

### Example 2
\`\`\`text
Input: root = [5,1,4,null,null,3,6]
Output: false
Explanation: The root node's value is 5 but its right child's value is 4 (violating the BST invariant).
\`\`\`

### Constraints
- The number of nodes in the tree is in the range \`[1, 10⁴]\`.
- \`-2³¹ <= Node.val <= 2³¹ - 1\`

### Target Complexity
- **Time Complexity:** \`O(n)\` visits each tree node once.
- **Space Complexity:** \`O(h)\` recursion stack depth where \`h\` is tree height.`;

const bstStarter = `class TreeNode:
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
`;

function esc(str) {
  return "'" + str.replace(/'/g, "''") + "'";
}

const sql = `
UPDATE assignments
SET instructions = ${esc(twosumInstructions)},
    starter_code = ${esc(twosumStarter)}
WHERE id = 'asg_demo_twosum';

UPDATE assignments
SET instructions = ${esc(bstInstructions)},
    starter_code = ${esc(bstStarter)}
WHERE id = 'asg_demo_validate_bst';
`;

fs.writeFileSync(path.join(__dirname, 'clean_leetcode.sql'), sql, 'utf8');
console.log('Generated clean_leetcode.sql');
