export interface Lesson {
  id: string;
  title: string;
  slug: string;
  durationMinutes: number;
  content: string;
  starterCode: string;
  language: string;
  expectedOutput: string;
  hint: string;
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  language: string;
  icon: string;
  lessonsCount: number;
  lessons: Lesson[];
}

export const COURSES: Course[] = [
  {
    id: 'cpp-fundamentals',
    title: 'Modern C++ Mastery: From Zero to Systems',
    slug: 'cpp-fundamentals',
    description: 'Master modern C++20 features, memory management, pointers, references, and the STL.',
    level: 'Beginner',
    language: 'cpp',
    icon: 'C++',
    lessonsCount: 3,
    lessons: [
      {
        id: 'cpp-1',
        title: '1. Hello C++20 & Standard Output',
        slug: 'hello-cpp20',
        durationMinutes: 10,
        content: `### Welcome to C++20
In modern C++, we use \`std::cout\` along with the stream insertion operator \`<<\` to output formatted text to the terminal.

#### Key Concept:
- Header: \`#include <iostream>\`
- Namespace: \`std::\`
- Semicolons: Every statement terminates with a \`;\`

**Your Task**:
Output \`Hello C++20 Developer\` to the console.`,
        starterCode: `#include <iostream>

int main() {
    // Write your code below to print "Hello C++20 Developer"
    std::cout << "Hello C++20 Developer" << std::endl;
    return 0;
}
`,
        language: 'cpp',
        expectedOutput: 'Hello C++20 Developer',
        hint: 'Use std::cout << "Hello C++20 Developer" << std::endl;',
      },
      {
        id: 'cpp-2',
        title: '2. Dynamic Arrays with std::vector',
        slug: 'vectors-in-cpp',
        durationMinutes: 15,
        content: `### std::vector in C++
Unlike fixed C-arrays, \`std::vector\` is a dynamically resizable array managed on the heap.

\`\`\`cpp
#include <vector>
std::vector<int> nums = {1, 2, 3};
nums.push_back(4);
\`\`\`

**Your Task**:
Create a vector with numbers \`10, 20, 30\`, add \`40\` using \`.push_back()\`, and print the size of the vector.`,
        starterCode: `#include <iostream>
#include <vector>

int main() {
    std::vector<int> v = {10, 20, 30};
    v.push_back(40);
    std::cout << "Vector Size: " << v.size() << std::endl;
    return 0;
}
`,
        language: 'cpp',
        expectedOutput: 'Vector Size: 4',
        hint: 'Call v.size() to inspect element count.',
      },
    ],
  },
  {
    id: 'python-dsa',
    title: 'Python for Data Structures & Algorithms',
    slug: 'python-dsa',
    description: 'Learn lists, dictionaries, time-space complexity, and dynamic problem solving in Python 3.12.',
    level: 'Beginner',
    language: 'python',
    icon: 'Py',
    lessonsCount: 2,
    lessons: [
      {
        id: 'py-1',
        title: '1. List Comprehensions & Filtration',
        slug: 'list-comprehensions',
        durationMinutes: 10,
        content: `### Python List Comprehensions
List comprehensions provide a concise way to create lists:
\`\`\`python
evens = [x for x in range(10) if x % 2 == 0]
\`\`\`

**Your Task**:
Generate a list of squares of even numbers from 1 to 10 and print it.`,
        starterCode: `# Write a list comprehension to square even numbers from 1 to 10
evens_squared = [x**2 for x in range(1, 11) if x % 2 == 0]
print(evens_squared)
`,
        language: 'python',
        expectedOutput: '[4, 16, 36, 64, 100]',
        hint: '[x**2 for x in range(1, 11) if x % 2 == 0]',
      },
    ],
  },
  {
    id: 'rust-systems',
    title: 'Rust Safe Systems Programming',
    slug: 'rust-systems',
    description: 'Conquer Ownership, Borrowing, Lifetimes, and Fearless Concurrency in Rust.',
    level: 'Intermediate',
    language: 'rust',
    icon: 'Rs',
    lessonsCount: 1,
    lessons: [
      {
        id: 'rust-1',
        title: '1. Ownership & Move Semantics',
        slug: 'ownership-moves',
        durationMinutes: 15,
        content: `### The Rust Ownership Rule
1. Each value in Rust has an owner.
2. There can only be one owner at a time.
3. When the owner goes out of scope, the value is dropped.

**Your Task**:
Pass a cloned String into a printer function so the original remains valid.`,
        starterCode: `fn print_val(s: String) {
    println!("Value: {}", s);
}

fn main() {
    let s = String::from("Rust Ownership");
    print_val(s.clone());
    println!("Original still valid: {}", s);
}
`,
        language: 'rust',
        expectedOutput: "Value: Rust Ownership\nOriginal still valid: Rust Ownership",
        hint: 'Use .clone() to duplicate heap data.',
      },
    ],
  },
];
