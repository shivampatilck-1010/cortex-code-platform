import type { Course } from '@/types/learn';

export const cppSystemsCourse: Course = {
  id: 'cpp-systems',
  slug: 'modern-cpp-systems',
  title: 'Modern C++ Systems Foundations',
  track: 'Systems & C++',
  category: 'Systems & C++',
  level: 'Intermediate',
  description:
    'Write leak-free modern C++20 using deterministic RAII lifetimes, const references, std::unique_ptr move semantics, and std::shared_ptr / std::weak_ptr ownership graphs.',
  estimatedHours: 5,
  instructor: 'Dr. Elena Rostova',
  instructorInit: 'ER',
  featured: false,
  following: true,
  popularity: 91,
  publishedOrder: 4,
  poster: {
    gradient: 'from-[#1A1C26] via-[#222538] to-[#101219]',
    accentHex: '#F3912E',
    badge: 'C++20 · RAII',
    kicker: 'OWNERSHIP & MEMORY',
    headline: 'Smart Pointers & Lifetimes',
    codeSnippet: 'auto ptr = std::make_unique<T>();',
    motif: 'cpp',
  },
  attribution: {
    sourceName: 'Adapted from C++ Core Guidelines & cppreference',
    sourceUrl: 'https://isocpp.github.io/CppCoreGuidelines/',
    license: 'MIT / CC-BY-SA',
  },
  modules: [
    {
      id: 'cpp-mod-memory-safety',
      title: 'References, Smart Pointers & Memory Safety',
      summary:
        'Master stack vs. heap lifetimes, const lvalue references, deterministic RAII cleanup, and modern smart pointer ownership.',
      items: [
        {
          id: 'cpp-m1-notes',
          type: 'notes',
          title: 'RAII, Const References & Smart Pointers in C++20',
          readMins: 10,
          tldr: [
            'Pass read-only non-trivial objects by `const T&` to avoid unnecessary heap copies without transferring ownership.',
            'RAII ties resource acquisition to object construction and cleanup to deterministic scope-exit destruction.',
            'Prefer `std::make_unique<T>` for single ownership (`std::unique_ptr`), and reach for `std::shared_ptr` + `std::weak_ptr` only when shared lifetimes genuinely require reference counting.',
          ],
          sections: [
            {
              id: 'stack-vs-heap-lifetimes',
              heading: 'Stack Lifetimes and Dangling Reference Pitfalls',
              paragraphs: [
                'Automatic (stack-allocated) objects are destroyed deterministically in reverse order of construction when control exits their enclosing block. Heap allocations via `new` live until explicitly freed, which makes manual `delete` error-prone in the presence of early returns or exceptions.',
                'A reference is an alias to an existing object and cannot be rebound or null. Returning a reference or pointer to a local stack variable produces undefined behavior because the backing memory is reclaimed as soon as the function returns.',
              ],
              callout: {
                kind: 'pitfall',
                title: 'Never Return a Reference to a Local Variable',
                body: 'Returning `const std::string&` bound to a function-local `std::string` creates a dangling reference immediately on return. Return the object by value so C++20 NRVO / move semantics handle it safely.',
              },
            },
            {
              id: 'const-references',
              heading: 'Zero-Copy Inspection with const T&',
              paragraphs: [
                'Passing a large `std::vector<int>` by value duplicates every element on every call. Passing by `const std::vector<int>&` passes only a machine-word address while preventing the callee from mutating the caller’s buffer.',
                'As a rule from the C++ Core Guidelines, pass small trivially copyable types (`int`, `double`, pointers, `std::string_view`, `std::span`) by value, and pass larger containers or strings by `const&` when read-only.',
              ],
            },
            {
              id: 'raii-and-unique-ptr',
              heading: 'RAII and Exclusive Ownership with std::unique_ptr',
              paragraphs: [
                'Resource Acquisition Is Initialization (RAII) guarantees that destructors run automatically when an owning object leaves scope. `std::unique_ptr<T>` embodies zero-overhead exclusive ownership: it has the same size as a raw pointer, cannot be copied, and transfers ownership explicitly via `std::move`.',
                'Always construct smart pointers with `std::make_unique<T>(args...)` and `std::make_shared<T>(args...)` instead of raw `new`. This eliminates naked `new` from application code, prevents leaks if a sibling argument throws, and keeps `shared_ptr` control blocks in a single allocation.',
              ],
              table: {
                headers: ['Handle Type', 'Ownership Model', 'Copyable', 'Overhead vs Raw Pointer'],
                rows: [
                  ['const T&', 'Non-owning borrow', 'N/A (alias)', 'None (pointer-sized)'],
                  ['std::unique_ptr<T>', 'Exclusive owner (RAII)', 'No (move-only)', 'Zero size / runtime overhead'],
                  ['std::shared_ptr<T>', 'Shared reference count', 'Yes (atomic refcount)', 'Two pointers + atomic control block'],
                  ['std::weak_ptr<T>', 'Non-owning observer', 'Yes (locks to shared_ptr)', 'Control block weak count'],
                  ['T* (raw pointer)', 'Non-owning view only in modern C++', 'Yes', 'Zero (never call delete)'],
                ],
              },
            },
            {
              id: 'shared-and-weak-ptr',
              heading: 'Breaking Cycles with std::weak_ptr',
              paragraphs: [
                'When two heap objects hold `std::shared_ptr` handles to each other, their strong reference counts never drop to zero and both leak permanently. Replacing one back-edge with `std::weak_ptr<T>` breaks the cycle.',
                'Before reading a `std::weak_ptr`, call `.lock()` to atomically promote it to a temporary `std::shared_ptr<T>`, checking whether the target object is still alive.',
              ],
              callout: {
                kind: 'tip',
                title: 'Ownership Flow',
                body: 'Default to stack values first, `std::unique_ptr` second, and `std::shared_ptr` only when multiple owners genuinely outlive one another unpredictably.',
              },
              codeBlock: {
                filename: 'raii_smart_pointers.cpp',
                language: 'cpp',
                runnableInIde: true,
                code: `#include <iostream>
#include <memory>
#include <numeric>
#include <string>
#include <vector>

struct TaskBuffer {
    std::string label;
    std::vector<int> values;

    TaskBuffer(std::string name, std::vector<int> data)
        : label(std::move(name)), values(std::move(data)) {
        std::cout << "Acquired " << label << "\\n";
    }

    ~TaskBuffer() {
        std::cout << "Released " << label << "\\n";
    }
};

int sum_values(const std::vector<int>& nums) {
    return std::accumulate(nums.begin(), nums.end(), 0);
}

int main() {
    auto primary = std::make_unique<TaskBuffer>("batch-A", std::vector<int>{10, 20, 30});
    std::unique_ptr<TaskBuffer> receiver = std::move(primary);

    std::cout << "primary is null: " << (primary == nullptr ? "true" : "false") << "\\n";
    std::cout << "receiver sum: " << sum_values(receiver->values) << "\\n";
    return 0;
}
`,
              },
            },
          ],
          keyTakeaways: [
            'Use `const T&` to inspect containers without copying or owning them.',
            'Construct exclusive heap resources with `std::make_unique<T>` and transfer ownership explicitly via `std::move`.',
            'Use `std::weak_ptr` and `.lock()` to observe shared resources without creating reference-count cycles.',
          ],
        },
        {
          id: 'cpp-m1-quiz',
          type: 'quiz',
          title: 'Concept Check: References & Smart Pointers',
          passScore: 75,
          questions: [
            {
              id: 'cpp-q1',
              prompt: 'What happens if you try to compile `std::unique_ptr<int> b = a;` where `a` is a `std::unique_ptr<int>`?',
              options: [
                'Both `a` and `b` share ownership and double-free at scope exit.',
                'It fails to compile because `std::unique_ptr` deletes its copy constructor.',
                'It silently transfers ownership and sets `a` to nullptr.',
                'It allocates a deep copy of the underlying `int`.',
              ],
              correctIndex: 1,
              explanation:
                '`std::unique_ptr` enforces exclusive ownership by deleting copy construction and copy assignment; you must use `std::move(a)` explicitly.',
            },
            {
              id: 'cpp-q2',
              prompt: 'After `auto p2 = std::move(p1);` executes on two `std::unique_ptr<Node>` objects, what is the state of `p1`?',
              codeSnippet: {
                language: 'cpp',
                code: `auto p1 = std::make_unique<int>(42);
auto p2 = std::move(p1);`,
              },
              options: [
                '`p1` becomes `nullptr`, and `p2` owns the integer `42`.',
                '`p1` still points to `42` until scope exit.',
                'The integer `42` is destroyed during `std::move`.',
                'Accessing `*p2` is undefined behavior.',
              ],
              correctIndex: 0,
              explanation:
                'Moving a `std::unique_ptr` transfers the underlying pointer into `p2` and resets `p1` to `nullptr`.',
            },
            {
              id: 'cpp-q3',
              prompt: 'Why is `std::weak_ptr` paired with `std::shared_ptr` in parent-child object graphs?',
              options: [
                'To allow pointer arithmetic on heap arrays',
                'To break strong reference cycles so objects are destroyed when external owners drop',
                'To avoid atomic operations during `std::shared_ptr` destruction',
                'To bypass `const` correctness',
              ],
              correctIndex: 1,
              explanation:
                'A `std::weak_ptr` increments only the weak count, so a cyclic back-reference does not keep the strong count above zero.',
            },
            {
              id: 'cpp-q4',
              prompt: 'Which parameter signature best inspects a `std::vector<int>` without copying elements or taking ownership?',
              options: [
                'void inspect(std::vector<int> nums)',
                'void inspect(const std::vector<int>& nums)',
                'void inspect(std::unique_ptr<std::vector<int>> nums)',
                'void inspect(std::vector<int>*&& nums)',
              ],
              correctIndex: 1,
              explanation:
                '`const std::vector<int>&` borrows the vector read-only with zero heap allocation or ownership transfer.',
            },
          ],
        },
        {
          id: 'cpp-m1-lab',
          type: 'lab',
          title: 'Lab: RAII Buffer & Unique Pointer Transfer',
          estimatedMins: 25,
          language: 'cpp',
          objective:
            'Implement a const-reference sum helper and deterministic `std::unique_ptr` ownership transfer in C++20 so resources are acquired, moved, inspected, and released in exact order.',
          steps: [
            'Implement `sum_buffer(const std::vector<int>& data)` using `std::accumulate` or a range-based `for` loop over `const&` without copying the vector.',
            'In `main()`, create `auto first = std::make_unique<Packet>("frame-1", std::vector<int>{5, 10, 15});`.',
            'Transfer ownership to `auto second = std::move(first);`, print whether `first == nullptr` (`1` or `true` as formatted), and print `sum_buffer(second->payload)`.',
            'Call `second.reset();` before printing `"after reset"` so the destructor message `"drop:frame-1"` appears deterministically before `"after reset"`.',
            'Run your C++20 program in Cortex IDE and verify exact stdout matching the test case.',
          ],
          starterCode: `#include <iostream>
#include <memory>
#include <numeric>
#include <string>
#include <vector>

struct Packet {
    std::string id;
    std::vector<int> payload;

    Packet(std::string packet_id, std::vector<int> data)
        : id(std::move(packet_id)), payload(std::move(data)) {
        std::cout << "init:" << id << "\\n";
    }

    ~Packet() {
        std::cout << "drop:" << id << "\\n";
    }
};

int sum_buffer(const std::vector<int>& data) {
    // TODO: Return the sum of all integers in data without copying data
    return 0;
}

int main() {
    // TODO:
    // 1. Allocate first using std::make_unique<Packet>("frame-1", std::vector<int>{5, 10, 15})
    // 2. Move ownership to second via std::move(first)
    // 3. Print "moved_empty:" followed by (first == nullptr ? "true" : "false")
    // 4. Print "sum:" followed by sum_buffer(second->payload)
    // 5. Call second.reset() so "drop:frame-1" prints before "after_reset"
    std::cout << "after_reset\\n";
    return 0;
}
`,
          testCases: [
            {
              id: 'cpp-m1-lab-tc1',
              input: '',
              expectedStdout: 'init:frame-1\nmoved_empty:true\nsum:30\ndrop:frame-1\nafter_reset',
              isHidden: false,
            },
          ],
        },
      ],
    },
  ],
};
