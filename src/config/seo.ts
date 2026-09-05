export interface LanguageSeoConfig {
  slug: string;
  name: string;
  title: string;
  description: string;
  keywords: string[];
  features: string[];
  faqs: Array<{ question: string; answer: string }>;
  sampleCode: string;
  runtimeVersion: string;
}

export const PRIMARY_KEYWORDS = [
  'online compiler',
  'online code compiler',
  'online compiler free',
  'free online compiler',
  'online coding compiler',
  'online programming compiler',
  'online IDE',
  'online code editor',
  'online code runner',
  'online code execution',
  'run code online',
  'compile code online',
  'execute code online',
  'coding platform',
  'online programming platform',
  'cloud IDE',
  'online coding environment',
  'browser IDE',
  'browser code editor',
];

export const AI_KEYWORDS = [
  'AI coding assistant',
  'AI code assistant',
  'AI code fixer',
  'AI error fixer',
  'AI coding error fixer',
  'AI debugging tool',
  'AI code debugger',
  'AI code optimizer',
  'AI code explainer',
  'AI programming assistant',
  'fix coding errors with AI',
  'fix compiler errors with AI',
  'explain coding errors',
  'automatic code fixing',
  'AI programming tool',
];

export const DEBUGGING_TESTING_KEYWORDS = [
  'online code debugger',
  'online debugger',
  'online code testing',
  'online code tester',
  'online coding test',
  'online compiler with debugger',
  'online compiler with test cases',
  'code performance analyzer',
  'online code performance tester',
  'algorithm performance analyzer',
];

export const CLOUD_IDE_KEYWORDS = [
  'cloud IDE',
  'online IDE',
  'free cloud IDE',
  'browser IDE',
  'online development environment',
  'cloud development environment',
  'online coding environment',
  'web based IDE',
  'browser based IDE',
  'online software development environment',
  'cloud code editor',
  'online programming environment',
];

export const PRACTICE_KEYWORDS = [
  'online coding practice',
  'coding challenges',
  'programming challenges',
  'coding problems',
  'online coding problems',
  'programming practice online',
  'competitive programming',
  'online coding contests',
  'algorithm practice',
  'data structures practice',
  'coding challenge platform',
];

export const FULLSTACK_KEYWORDS = [
  'online web development environment',
  'online full stack development',
  'online full stack IDE',
  'online React editor',
  'online Node.js IDE',
  'online Python IDE',
  'online Java development environment',
  'online code deployment',
  'deploy code online',
  'online app deployment',
];

export const LANGUAGE_SEO_MAP: Record<string, LanguageSeoConfig> = {
  python: {
    slug: 'python-online-compiler',
    name: 'Python',
    runtimeVersion: '3.12',
    title: 'Online Python Compiler & Cloud IDE | Run Python Online Free — Cortex',
    description:
      'Write, compile, and run Python 3.12 code online instantly with Cortex. Features real-time AI error fixing, visual debugger, interactive terminal, automated test cases, and zero setup. Free online Python IDE.',
    keywords: [
      'python online compiler',
      'online python compiler',
      'python compiler online',
      'free python compiler',
      'python online IDE',
      'python IDE online',
      'run python online',
      'execute python online',
      'python code editor',
      'python code runner',
      'python interpreter online',
      'python coding online',
      'python debugger online',
      'python 3 online compiler',
      'online python environment',
    ],
    features: [
      'Native CPython 3.12 execution sandbox with 128MB memory and 10s execution limits',
      'Autonomous AI error fixer: diagnoses syntax errors, IndentationError, and tracebacks in 0ms',
      'Visual interactive step-debugger with variable inspection and callstack frames',
      'Interactive bash terminal with support for standard inputs (stdin) and pip packages',
      'Custom test cases with automated pass/fail verification and micro-benchmarking',
    ],
    faqs: [
      {
        question: 'How do I run Python code online with Cortex?',
        answer:
          'Simply type or paste your Python 3 code in the editor and click "Run" or press Ctrl+Enter. The code executes in an isolated cloud sandbox and prints output to the terminal within milliseconds.',
      },
      {
        question: 'Does this Python online compiler support libraries and pip packages?',
        answer:
          'Yes, Cortex includes standard Python libraries (math, sys, os, json, itertools, collections, random) and popular data packages out of the box.',
      },
      {
        question: 'Can I debug Python errors and exceptions automatically?',
        answer:
          'Yes! Cortex features a built-in AI Auto-Fix engine powered by Gemini 2.5 Flash and local AST heuristics. When a syntax or runtime error occurs, click "Auto-Fix" to generate an instant explanation and verified repair.',
      },
    ],
    sampleCode: `# Universal Python 3.12 Compiler - Cortex
def fibonacci(n):
    a, b = 0, 1
    for _ in range(n):
        yield a
        a, b = b, a + b

print("First 10 Fibonacci numbers:")
print(list(fibonacci(10)))
`,
  },
  cpp: {
    slug: 'cpp-online-compiler',
    name: 'C++',
    runtimeVersion: 'C++20 (GCC 13/14)',
    title: 'Online C++ Compiler & Cloud IDE | Compile & Run C++ Online — Cortex',
    description:
      'Fast, modern online C++ compiler supporting C++20 and C++23 standards. Run C++ code online with instant GCC compilation, multi-file nested headers, live debugger, and AI compiler error fixer.',
    keywords: [
      'c++ online compiler',
      'online c++ compiler',
      'c++ compiler online',
      'free c++ compiler',
      'c++ online IDE',
      'run c++ online',
      'execute c++ online',
      'c++ code editor',
      'c++ code runner',
      'c++20 online compiler',
      'g++ online compiler',
      'compile c++ online free',
    ],
    features: [
      'High-speed G++ compiler with -O2 optimization, C++20 standard, and nested header support',
      'Multi-file support: create .h header files and .cpp implementation files in subfolders',
      'AI compiler error translation: clarifies cryptic template and linker errors into plain English',
      'Interactive bash terminal with native GCC/G++ commands and stdin support',
    ],
    faqs: [
      {
        question: 'What C++ standards are supported in this online compiler?',
        answer:
          'Cortex supports modern C++ standards including C++17, C++20, and C++23 using modern GCC compilers with full Standard Template Library (STL) support.',
      },
      {
        question: 'Can I compile multiple C++ files and header files?',
        answer:
          'Yes, Cortex has a full multi-file explorer. You can create header files (.h, .hpp) and implementation files (.cpp) in root or subfolders, and they compile together automatically.',
      },
    ],
    sampleCode: `#include <iostream>
#include <vector>
#include <numeric>

int main() {
    std::vector<int> nums = {1, 2, 3, 4, 5};
    int sum = std::accumulate(nums.begin(), nums.end(), 0);
    std::cout << "[Cortex] C++20 execution successful! Sum: " << sum << std::endl;
    return 0;
}
`,
  },
  c: {
    slug: 'c-online-compiler',
    name: 'C',
    runtimeVersion: 'C17 / C23 (GCC)',
    title: 'Online C Compiler & Cloud IDE | Compile & Run C Code Online — Cortex',
    description:
      'Compile and run C code online with GCC. Free online C compiler with syntax highlighting, pointer debugging, multi-file projects, interactive terminal, and AI auto-fix.',
    keywords: [
      'c online compiler',
      'online c compiler',
      'c compiler online',
      'free c compiler',
      'c online IDE',
      'run c online',
      'execute c online',
      'c code editor',
      'c code runner',
      'gcc online compiler',
      'c programming online',
    ],
    features: [
      'Fast GCC compiler with -Wall -Wextra flag support and POSIX compatibility',
      'Interactive terminal for stdin scanf/fgets inputs and live stdout stream',
      'Memory safety diagnostics and pointer error assistance',
    ],
    faqs: [
      {
        question: 'Can I take user input via scanf in the online C compiler?',
        answer:
          'Yes! You can either type inputs interactively in the terminal or provide inputs beforehand in the Input (stdin) tab.',
      },
    ],
    sampleCode: `#include <stdio.h>

int main() {
    printf("[Cortex] C programming online compiler active!\\n");
    for (int i = 1; i <= 5; i++) {
        printf("Iteration %d\\n", i);
    }
    return 0;
}
`,
  },
  java: {
    slug: 'java-online-compiler',
    name: 'Java',
    runtimeVersion: 'OpenJDK 21 (LTS)',
    title: 'Online Java Compiler & Cloud IDE | Run Java Online Free — Cortex',
    description:
      'Write, compile, and run Java code online using OpenJDK 21 LTS. Fast online Java IDE with multi-class files, visual debugger, interactive terminal, and AI exception repair.',
    keywords: [
      'java online compiler',
      'online java compiler',
      'java compiler online',
      'free java compiler',
      'java online IDE',
      'run java online',
      'execute java online',
      'java code editor',
      'java code runner',
      'java debugger online',
      'java 21 online compiler',
    ],
    features: [
      'OpenJDK 21 LTS with record patterns, pattern matching, virtual threads, and full Java Collections',
      'Instant javac compilation with zero local JDK installation required',
      'AI error repair for NullPointerException, ArrayIndexOutOfBoundsException, and type errors',
    ],
    faqs: [
      {
        question: 'What version of Java does Cortex run?',
        answer: 'Cortex runs modern OpenJDK 21 LTS, the latest long-term support release of Java.',
      },
    ],
    sampleCode: `import java.util.List;

public class Main {
    public static void main(String[] args) {
        List<String> items = List.of("Cortex", "Java 21", "Cloud IDE");
        items.forEach(item -> System.out.println("Processing: " + item));
    }
}
`,
  },
  javascript: {
    slug: 'javascript-online-compiler',
    name: 'JavaScript (Node.js)',
    runtimeVersion: 'Node.js 20+ LTS',
    title: 'Online JavaScript Compiler & Node.js IDE | Run JS Online — Cortex',
    description:
      'Execute JavaScript and Node.js code online in an instant cloud sandbox. Modern ES6+, async/await, npm modules, interactive terminal, and live Web Preview.',
    keywords: [
      'javascript online compiler',
      'online javascript compiler',
      'javascript compiler online',
      'javascript online editor',
      'javascript online IDE',
      'run javascript online',
      'execute javascript online',
      'javascript code runner',
      'nodejs online compiler',
      'node online IDE',
    ],
    features: [
      'V8 engine and Node.js 20+ runtime with modern ECMAScript specifications',
      'Live Web Preview panel: renders HTML, CSS, and JS simultaneously with console log bridge',
      'Full asynchronous code support including Promises, async/await, and Fetch API',
    ],
    faqs: [
      {
        question: 'Can I preview web pages with HTML, CSS, and JavaScript?',
        answer:
          'Yes! The built-in Web Preview tab allows you to write HTML, CSS, and JS and immediately view the responsive web page on desktop, tablet, and mobile viewports.',
      },
    ],
    sampleCode: `// Modern JavaScript / Node.js
const users = [
  { id: 1, name: 'Ada Lovelace', role: 'Architect' },
  { id: 2, name: 'Alan Turing', role: 'Cryptanalyst' }
];

console.log('[Cortex] JavaScript runner ready.');
users.map(u => \`\${u.name} - \${u.role}\`).forEach(s => console.log(s));
`,
  },
  typescript: {
    slug: 'typescript-online-compiler',
    name: 'TypeScript',
    runtimeVersion: 'TypeScript 5.x',
    title: 'Online TypeScript Compiler & Editor | Run TS Online — Cortex',
    description:
      'Compile and execute TypeScript 5.x online with real-time type checking, interfaces, generics, auto-complete, and instant JavaScript transpilation.',
    keywords: [
      'typescript online compiler',
      'typescript online editor',
      'run typescript online',
      'online typescript compiler',
      'typescript compiler online',
      'typescript playground',
      'ts online runner',
    ],
    features: [
      'TypeScript 5.x compiler with strict type-safety and immediate transpilation',
      'Intellisense, interface modeling, generics, and union type support',
      'AI assistant to fix type mismatches and TypeScript compiler diagnostics',
    ],
    faqs: [
      {
        question: 'Does this TypeScript compiler support strict mode?',
        answer:
          'Yes, Cortex runs TypeScript with full type checking, alerting you to any type mismatches or undefined properties.',
      },
    ],
    sampleCode: `interface Developer {
  name: string;
  languages: string[];
  isAvailable: boolean;
}

const dev: Developer = {
  name: "Cortex Engineer",
  languages: ["TypeScript", "Python", "Rust"],
  isAvailable: true
};

console.log(\`[TypeScript] Developer \${dev.name} active with \${dev.languages.length} languages.\`);
`,
  },
  rust: {
    slug: 'rust-online-compiler',
    name: 'Rust',
    runtimeVersion: 'Rust 1.75+ (rustc)',
    title: 'Online Rust Compiler & IDE | Compile & Run Rust Online — Cortex',
    description:
      'Compile and run Rust code online with rustc and Cargo. Enjoy lightning-fast builds, borrow checker diagnostics, AI compiler repair, and terminal testing.',
    keywords: [
      'rust online compiler',
      'online rust compiler',
      'rust compiler online',
      'run rust online',
      'rust code editor',
      'rust online IDE',
      'cargo online compiler',
      'rust playground',
    ],
    features: [
      'Native rustc compilation with 2021 edition support and memory safety verification',
      'AI-powered borrow checker explanation to demystify lifetime and mutability issues',
      'High-performance execution benchmarks and memory tracking',
    ],
    faqs: [
      {
        question: 'Does the online Rust compiler explain borrow checker errors?',
        answer:
          'Yes! When rustc throws a borrow or lifetime error, clicking "Auto-Fix" provides a clear explanation and suggested solution.',
      },
    ],
    sampleCode: `fn main() {
    let numbers = vec![1, 2, 3, 4, 5];
    let sum: i32 = numbers.iter().sum();
    println!("[Cortex] Rust execution successful! Sum: {}", sum);
}
`,
  },
  go: {
    slug: 'go-online-compiler',
    name: 'Go (Golang)',
    runtimeVersion: 'Go 1.22+',
    title: 'Online Go Compiler & IDE | Run Golang Online Free — Cortex',
    description:
      'Fast online Golang compiler and editor. Compile Go programs with goroutines, channels, interfaces, and fast zero-latency cloud execution.',
    keywords: [
      'go online compiler',
      'golang online compiler',
      'online go compiler',
      'run go online',
      'go compiler online',
      'golang playground',
      'go code runner',
    ],
    features: [
      'Go 1.22+ compiler with native concurrency (goroutines and channels)',
      'Clean formatting with gofmt standards and zero setup requirements',
      'Interactive terminal for stdin and environment variables',
    ],
    faqs: [
      {
        question: 'Can I test concurrency with goroutines in this online Go compiler?',
        answer: 'Yes, full concurrency with goroutines, channels, and sync packages is fully supported.',
      },
    ],
    sampleCode: `package main

import "fmt"

func main() {
    messages := make(chan string)
    go func() { messages <- "[Cortex] Hello from Goroutine!" }()
    msg := <-messages
    fmt.Println(msg)
}
`,
  },
  csharp: {
    slug: 'csharp-online-compiler',
    name: 'C# (.NET)',
    runtimeVersion: '.NET 8.0 SDK',
    title: 'Online C# Compiler & .NET IDE | Run C# Online — Cortex',
    description:
      'Write and run C# code online with modern .NET 8. Features LINQ, async/await, record types, interactive debugger, and AI error fixer.',
    keywords: [
      'c# online compiler',
      'csharp online compiler',
      'online c# compiler',
      'dotnet online compiler',
      'run c# online',
      'c# code editor',
      'c# online IDE',
    ],
    features: [
      '.NET 8 SDK with top-level statements, LINQ, records, and pattern matching',
      'Fast compilation with detailed diagnostics and stack traces',
      'AI auto-fix for syntax errors and null reference exceptions',
    ],
    faqs: [
      {
        question: 'Is .NET 8 supported in the C# online compiler?',
        answer: 'Yes, Cortex runs modern .NET 8 with modern C# 12 syntax features.',
      },
    ],
    sampleCode: `using System;
using System.Linq;

class Program {
    static void Main() {
        var nums = Enumerable.Range(1, 10);
        Console.WriteLine($"[Cortex C#] Sum of 1..10: {nums.Sum()}");
    }
}
`,
  },
  php: {
    slug: 'php-online-compiler',
    name: 'PHP',
    runtimeVersion: 'PHP 8.3',
    title: 'Online PHP Compiler & Script Runner | Run PHP Online — Cortex',
    description:
      'Execute PHP 8.3 scripts online. Free online PHP compiler with modern OOP, match expressions, array functions, and interactive terminal.',
    keywords: [
      'php online compiler',
      'online php compiler',
      'php compiler online',
      'run php online',
      'php code editor',
      'php online IDE',
      'php 8 online compiler',
    ],
    features: [
      'PHP 8.3 runtime with typed properties, match expressions, and JIT optimizations',
      'Standard web functions, JSON processing, and regex engine included',
    ],
    faqs: [
      {
        question: 'Can I test modern PHP 8 features online?',
        answer: 'Yes, Cortex runs the latest PHP 8 release supporting all modern syntax and attributes.',
      },
    ],
    sampleCode: `<?php
$data = ['name' => 'Cortex', 'status' => 'active'];
echo "[Cortex PHP] Online execution successful: " . json_encode($data) . "\\n";
`,
  },
  ruby: {
    slug: 'ruby-online-compiler',
    name: 'Ruby',
    runtimeVersion: 'Ruby 3.3',
    title: 'Online Ruby Compiler & Editor | Run Ruby Code Online — Cortex',
    description:
      'Run Ruby 3.3 code online in an instant browser sandbox. Enjoy Ruby blocks, enumerables, OOP, and AI code fixing.',
    keywords: [
      'ruby online compiler',
      'online ruby compiler',
      'run ruby online',
      'ruby code runner',
      'ruby online editor',
      'ruby online IDE',
    ],
    features: [
      'Ruby 3.3 with YJIT optimizations and modern standard libraries',
      'Clean syntax highlighting and interactive stdin/stdout stream',
    ],
    faqs: [
      {
        question: 'Can I run Ruby scripts without installing Ruby locally?',
        answer: 'Yes, Cortex runs Ruby 3 scripts completely inside your web browser with zero installation.',
      },
    ],
    sampleCode: `words = %w[cloud compiler cortex instant execution]
puts "[Cortex Ruby] Capitalized:"
puts words.map(&:capitalize).join(', ')
`,
  },
  kotlin: {
    slug: 'kotlin-online-compiler',
    name: 'Kotlin',
    runtimeVersion: 'Kotlin 1.9+',
    title: 'Online Kotlin Compiler & IDE | Run Kotlin Online — Cortex',
    description:
      'Compile and execute Kotlin code online. Free Kotlin playground with coroutines, null safety, extension functions, and JVM execution.',
    keywords: [
      'kotlin online compiler',
      'online kotlin compiler',
      'kotlin compiler online',
      'run kotlin online',
      'kotlin playground',
      'kotlin code runner',
    ],
    features: [
      'Kotlin JVM runtime with null safety and data classes',
      'Instant compilation with automatic main function detection',
    ],
    faqs: [
      {
        question: 'Does this Kotlin online compiler support data classes and collections?',
        answer: 'Yes, all standard Kotlin language constructs and standard libraries are supported.',
      },
    ],
    sampleCode: `data class User(val name: String, val role: String)

fun main() {
    val user = User("Cortex Developer", "Admin")
    println("[Cortex Kotlin] User initialized: $user")
}
`,
  },
  swift: {
    slug: 'swift-online-compiler',
    name: 'Swift',
    runtimeVersion: 'Swift 5.9+',
    title: 'Online Swift Compiler & IDE | Run Swift Online — Cortex',
    description:
      'Write and run Swift code online on any operating system without a Mac. Enjoy modern Swift syntax, optionals, protocols, and async/await.',
    keywords: [
      'swift online compiler',
      'online swift compiler',
      'swift compiler online',
      'run swift online',
      'swift code runner',
      'swift playground online',
    ],
    features: [
      'Swift 5.9 compiler with Linux/POSIX support — code in Swift on Windows or Linux',
      'Full support for optionals, generics, structs, and functional pipelines',
    ],
    faqs: [
      {
        question: 'Can I run Swift code on Windows without a Mac?',
        answer:
          'Yes! Cortex executes Swift in cloud containers, allowing you to code and test Swift on any Windows, Linux, or Chromebook device.',
      },
    ],
    sampleCode: `struct Task {
    let title: String
    let completed: Bool
}

let tasks = [Task(title: "Compile Swift", completed: true), Task(title: "Test Online", completed: true)]
print("[Cortex Swift] Completed tasks count: \\(tasks.filter { $0.completed }.count)")
`,
  },
  dart: {
    slug: 'dart-online-compiler',
    name: 'Dart',
    runtimeVersion: 'Dart 3.x',
    title: 'Online Dart Compiler & Editor | Run Dart Online — Cortex',
    description:
      'Compile and run Dart 3 code online. Supports pattern matching, sound null-safety, records, and async/await for Flutter & Dart developers.',
    keywords: [
      'dart online compiler',
      'online dart compiler',
      'dart compiler online',
      'run dart online',
      'dart code runner',
      'dart pad alternative',
    ],
    features: [
      'Dart 3 with sound null safety and switch pattern matching',
      'Zero-setup coding for Flutter and Dart algorithmic logic',
    ],
    faqs: [
      {
        question: 'Is Dart 3 with sound null safety supported?',
        answer: 'Yes, Cortex runs the latest Dart 3 SDK with complete null safety enforcement.',
      },
    ],
    sampleCode: `void main() {
  final numbers = [10, 20, 30, 40];
  print('[Cortex Dart] Sum: \${numbers.reduce((a, b) => a + b)}');
}
`,
  },
  r: {
    slug: 'r-online-compiler',
    name: 'R',
    runtimeVersion: 'R 4.3+',
    title: 'Online R Compiler & Statistics Environment | Run R Online — Cortex',
    description:
      'Run R statistical code online with data frames, vectors, matrix calculations, and mathematical models in a fast cloud IDE.',
    keywords: [
      'r online compiler',
      'online r compiler',
      'run r online',
      'r code runner',
      'r statistics online',
      'r programming online',
    ],
    features: [
      'R statistical computing engine with base statistics and data frames',
      'Instant calculation of descriptive statistics, correlations, and regressions',
    ],
    faqs: [
      {
        question: 'Can I do statistical data analysis in the online R compiler?',
        answer: 'Yes, all built-in mathematical, statistical, and vector operations run seamlessly.',
      },
    ],
    sampleCode: `data <- c(12, 15, 18, 22, 30, 45)
print(paste("[Cortex R] Mean:", mean(data), "SD:", round(sd(data), 2)))
`,
  },
  sql: {
    slug: 'sql-online-editor',
    name: 'SQL',
    runtimeVersion: 'SQLite / ANSI SQL',
    title: 'Online SQL Editor & Query Compiler | Run SQL Online — Cortex',
    description:
      'Write, execute, and test SQL queries online. Create tables, insert records, run JOINs, aggregations, and subqueries with instant tabulated output.',
    keywords: [
      'sql online editor',
      'sql online compiler',
      'online sql editor',
      'run sql online',
      'execute sql online',
      'sql database online',
      'sql playground',
    ],
    features: [
      'Real in-memory relational database with ANSI SQL and SQLite compatibility',
      'Supports CREATE TABLE, INSERT, SELECT, JOIN, GROUP BY, and subqueries',
      'Clean table output visualization with execution latency benchmarking',
    ],
    faqs: [
      {
        question: 'Can I create tables and run multi-table joins in the SQL editor?',
        answer:
          'Yes! You can define full schemas with multiple tables, populate them with INSERT statements, and query them with complex JOINs.',
      },
    ],
    sampleCode: `CREATE TABLE developers (id INTEGER PRIMARY KEY, name TEXT, language TEXT);
INSERT INTO developers VALUES (1, 'Alice', 'Python'), (2, 'Bob', 'C++'), (3, 'Charlie', 'Rust');
SELECT language, COUNT(*) as dev_count FROM developers GROUP BY language;
`,
  },
};
