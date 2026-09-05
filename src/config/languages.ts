export interface LanguageConfig {
  id: string;
  name: string;
  version: string;
  aliases: string[];
  monacoLang: string;
  fileExtension: string;
  defaultFileName: string;
  compiler: string;
  buildCommand?: string;
  runCommand: string;
  debuggerSupported: boolean;
  packageManager?: string;
  pistonRuntime: {
    language: string;
    version: string;
  };
  starterCode: string;
  memoryLimitMb: number;
  timeoutSec: number;
  category: 'systems' | 'web' | 'scripting' | 'enterprise' | 'data';
}

export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  {
    id: 'python',
    name: 'Python',
    version: '3.12',
    aliases: ['py', 'python3'],
    monacoLang: 'python',
    fileExtension: '.py',
    defaultFileName: 'main.py',
    compiler: 'CPython 3.12',
    runCommand: 'python3 main.py',
    debuggerSupported: true,
    packageManager: 'pip',
    pistonRuntime: { language: 'python', version: '3.10.0' },
    starterCode: `# Universal Online Platform - Python 3.12
import sys

def main():
    print("[Cortex] Welcome to Cloud IDE")
    numbers = [1, 2, 3, 4, 5]
    squared = [x**2 for x in numbers]
    print(f"Squares: {squared}")

if __name__ == '__main__':
    main()
`,
    memoryLimitMb: 128,
    timeoutSec: 10,
    category: 'scripting',
  },
  {
    id: 'javascript',
    name: 'JavaScript (Node.js)',
    version: '20.x',
    aliases: ['js', 'node'],
    monacoLang: 'javascript',
    fileExtension: '.js',
    defaultFileName: 'index.js',
    compiler: 'V8 / Node.js 20',
    runCommand: 'node index.js',
    debuggerSupported: true,
    packageManager: 'npm',
    pistonRuntime: { language: 'javascript', version: '18.15.0' },
    starterCode: `// Universal Online Platform - JavaScript (Node.js)
console.log("[Cortex] JavaScript Runtime");

const items = ['Compile', 'Run', 'Debug', 'Test', 'Deploy'];
items.forEach((step, idx) => {
  console.log(\`[\${idx + 1}/\${items.length}] \${step} Ready\`);
});
`,
    memoryLimitMb: 128,
    timeoutSec: 10,
    category: 'web',
  },
  {
    id: 'typescript',
    name: 'TypeScript',
    version: '5.x',
    aliases: ['ts'],
    monacoLang: 'typescript',
    fileExtension: '.ts',
    defaultFileName: 'index.ts',
    compiler: 'TypeScript Compiler (tsc / tsx)',
    buildCommand: 'tsc index.ts',
    runCommand: 'node index.js',
    debuggerSupported: true,
    packageManager: 'npm',
    pistonRuntime: { language: 'typescript', version: '5.0.3' },
    starterCode: `// Universal Online Platform - TypeScript
interface ProjectSpec {
  name: string;
  languagesCount: number;
  cloudReady: boolean;
}

const spec: ProjectSpec = {
  name: "Cortex Cloud IDE",
  languagesCount: 20,
  cloudReady: true,
};

console.log(\`[Cortex] Initialized: \${spec.name} (Languages: \${spec.languagesCount})\`);
`,
    memoryLimitMb: 128,
    timeoutSec: 10,
    category: 'web',
  },
  {
    id: 'cpp',
    name: 'C++',
    version: 'G++ 13 (C++20)',
    aliases: ['cpp', 'c++'],
    monacoLang: 'cpp',
    fileExtension: '.cpp',
    defaultFileName: 'main.cpp',
    compiler: 'G++ 13',
    buildCommand: 'g++ -O2 -std=c++20 main.cpp -o main',
    runCommand: './main',
    debuggerSupported: true,
    packageManager: 'vcpkg / conan',
    pistonRuntime: { language: 'c++', version: '10.2.0' },
    starterCode: `// Universal Online Platform - C++20
#include <iostream>
#include <vector>
#include <numeric>

int main() {
    std::cout << "[Cortex] C++20 High Performance Runtime\\n";
    std::vector<int> data = {10, 20, 30, 40, 50};
    int total = std::accumulate(data.begin(), data.end(), 0);
    std::cout << "Accumulated sum: " << total << "\\n";
    return 0;
}
`,
    memoryLimitMb: 256,
    timeoutSec: 10,
    category: 'systems',
  },
  {
    id: 'c',
    name: 'C',
    version: 'GCC 13 (C17)',
    aliases: ['c'],
    monacoLang: 'c',
    fileExtension: '.c',
    defaultFileName: 'main.c',
    compiler: 'GCC 13',
    buildCommand: 'gcc -O2 main.c -o main',
    runCommand: './main',
    debuggerSupported: true,
    pistonRuntime: { language: 'c', version: '10.2.0' },
    starterCode: `// Universal Online Platform - C17
#include <stdio.h>

int main(void) {
    printf("[Cortex] Low-level power with C17 Sandbox\\n");
    for (int i = 1; i <= 5; i++) {
        printf("Thread pipeline stage: %d\\n", i);
    }
    return 0;
}
`,
    memoryLimitMb: 128,
    timeoutSec: 10,
    category: 'systems',
  },
  {
    id: 'java',
    name: 'Java',
    version: 'OpenJDK 21',
    aliases: ['java'],
    monacoLang: 'java',
    fileExtension: '.java',
    defaultFileName: 'Main.java',
    compiler: 'Javac 21',
    buildCommand: 'javac Main.java',
    runCommand: 'java Main',
    debuggerSupported: true,
    packageManager: 'maven / gradle',
    pistonRuntime: { language: 'java', version: '15.0.2' },
    starterCode: `// Universal Online Platform - OpenJDK 21
import java.util.List;

public class Main {
    public static void main(String[] args) {
        System.out.println("[Cortex] Java 21 Enterprise Sandbox");
        List<String> modules = List.of("Security", "Sandboxing", "AI-Autofix", "Live Preview");
        modules.forEach(m -> System.out.println("Loaded module: " + m));
    }
}
`,
    memoryLimitMb: 512,
    timeoutSec: 15,
    category: 'enterprise',
  },
  {
    id: 'csharp',
    name: 'C#',
    version: '.NET 8',
    aliases: ['cs', 'csharp', 'dotnet'],
    monacoLang: 'csharp',
    fileExtension: '.cs',
    defaultFileName: 'Program.cs',
    compiler: 'Roslyn / .NET 8 SDK',
    buildCommand: 'dotnet build',
    runCommand: 'dotnet run',
    debuggerSupported: true,
    packageManager: 'NuGet',
    pistonRuntime: { language: 'csharp.net', version: '7.0.400' },
    starterCode: `// Universal Online Platform - C# .NET
using System;

class Program {
    static void Main() {
        Console.WriteLine("[Cortex] C# .NET Runtime");
        string[] features = ["High Throughput", "Type Safety", "LINQ", "Cross-Platform"];
        Console.WriteLine($"System Features: {string.Join(", ", features)}");
    }
}
`,
    memoryLimitMb: 256,
    timeoutSec: 12,
    category: 'enterprise',
  },
  {
    id: 'go',
    name: 'Go',
    version: '1.22',
    aliases: ['golang', 'go'],
    monacoLang: 'go',
    fileExtension: '.go',
    defaultFileName: 'main.go',
    compiler: 'Go Compiler 1.22',
    buildCommand: 'go build -o main main.go',
    runCommand: 'go run main.go',
    debuggerSupported: true,
    packageManager: 'go modules',
    pistonRuntime: { language: 'go', version: '1.16.2' },
    starterCode: `// Universal Online Platform - Go 1.22
package main

import (
	"fmt"
	"time"
)

func main() {
	fmt.Println("[Cortex] Go Concurrent Execution Engine")
	ch := make(chan string)
	go func() {
		time.Sleep(50 * time.Millisecond)
		ch <- "Goroutine worker completed successfully!"
	}()
	fmt.Println(<-ch)
}
`,
    memoryLimitMb: 128,
    timeoutSec: 10,
    category: 'systems',
  },
  {
    id: 'rust',
    name: 'Rust',
    version: '1.75',
    aliases: ['rs', 'rust'],
    monacoLang: 'rust',
    fileExtension: '.rs',
    defaultFileName: 'main.rs',
    compiler: 'rustc 1.75',
    buildCommand: 'rustc -O main.rs -o main',
    runCommand: './main',
    debuggerSupported: true,
    packageManager: 'cargo',
    pistonRuntime: { language: 'rust', version: '1.68.2' },
    starterCode: `// Universal Online Platform - Rust
fn main() {
    println!("[Cortex] Rust Memory-Safe Sandbox");
    let items = vec!["Zero Cost Abstractions", "Move Semantics", "Guaranteed Concurrency"];
    for (i, item) in items.iter().enumerate() {
        println!("{}. {}", i + 1, item);
    }
}
`,
    memoryLimitMb: 256,
    timeoutSec: 15,
    category: 'systems',
  },
  {
    id: 'php',
    name: 'PHP',
    version: '8.3',
    aliases: ['php'],
    monacoLang: 'php',
    fileExtension: '.php',
    defaultFileName: 'index.php',
    compiler: 'Zend Engine / PHP 8.3',
    runCommand: 'php index.php',
    debuggerSupported: false,
    packageManager: 'composer',
    pistonRuntime: { language: 'php', version: '8.2.3' },
    starterCode: `<?php
// Universal Online Platform - PHP 8.3
echo "[Cortex] PHP 8.3 Modern Runtime\n";
$frameworks = ['Laravel', 'Symfony', 'WordPress'];
echo "Ecosystem: " . implode(', ', $frameworks) . "\n";
`,
    memoryLimitMb: 128,
    timeoutSec: 10,
    category: 'web',
  },
  {
    id: 'ruby',
    name: 'Ruby',
    version: '3.3',
    aliases: ['rb', 'ruby'],
    monacoLang: 'ruby',
    fileExtension: '.rb',
    defaultFileName: 'main.rb',
    compiler: 'YARV / Ruby 3.3',
    runCommand: 'ruby main.rb',
    debuggerSupported: false,
    packageManager: 'gem / bundler',
    pistonRuntime: { language: 'ruby', version: '3.0.1' },
    starterCode: `# Universal Online Platform - Ruby 3.3
puts "[Cortex] Ruby Developer Happiness"
[1, 2, 3].map { |n| n * 10 }.each do |val|
  puts "Generated scale: #{val}"
end
`,
    memoryLimitMb: 128,
    timeoutSec: 10,
    category: 'scripting',
  },
  {
    id: 'kotlin',
    name: 'Kotlin',
    version: '1.9',
    aliases: ['kt', 'kotlin'],
    monacoLang: 'kotlin',
    fileExtension: '.kt',
    defaultFileName: 'Main.kt',
    compiler: 'Kotlinc 1.9',
    buildCommand: 'kotlinc Main.kt -include-runtime -d Main.jar',
    runCommand: 'java -jar Main.jar',
    debuggerSupported: true,
    packageManager: 'gradle',
    pistonRuntime: { language: 'kotlin', version: '1.8.20' },
    starterCode: `// Universal Online Platform - Kotlin
fun main() {
    println("[Cortex] Kotlin Modern Multiplatform")
    val greeting = "Hello, World!"
    println("Greeting length: \${greeting.length}")
}
`,
    memoryLimitMb: 256,
    timeoutSec: 15,
    category: 'enterprise',
  },
  {
    id: 'swift',
    name: 'Swift',
    version: '5.9',
    aliases: ['swift'],
    monacoLang: 'swift',
    fileExtension: '.swift',
    defaultFileName: 'main.swift',
    compiler: 'Swift 5.9',
    buildCommand: 'swiftc main.swift -o main',
    runCommand: './main',
    debuggerSupported: true,
    packageManager: 'Swift Package Manager',
    pistonRuntime: { language: 'swift', version: '5.3.3' },
    starterCode: `// Universal Online Platform - Swift 5.9
import Foundation

print("[Cortex] Swift High-Performance Runtime")
let numbers = [5, 4, 3, 2, 1]
let sorted = numbers.sorted()
print("Ascending sequence: \\(sorted)")
`,
    memoryLimitMb: 256,
    timeoutSec: 12,
    category: 'systems',
  },
  {
    id: 'r',
    name: 'R',
    version: '4.3',
    aliases: ['r'],
    monacoLang: 'r',
    fileExtension: '.r',
    defaultFileName: 'main.r',
    compiler: 'Rscript 4.3',
    runCommand: 'Rscript main.r',
    debuggerSupported: false,
    packageManager: 'CRAN',
    pistonRuntime: { language: 'r', version: '4.1.1' },
    starterCode: `# Universal Online Platform - R Data Science
cat("[Cortex] R Statistical Analysis\n")
data <- c(12, 15, 23, 45, 67, 89, 90)
cat(paste("Mean:", mean(data), "\n"))
cat(paste("Standard Deviation:", sd(data), "\n"))
`,
    memoryLimitMb: 256,
    timeoutSec: 10,
    category: 'data',
  },
  {
    id: 'dart',
    name: 'Dart',
    version: '3.x',
    aliases: ['dart'],
    monacoLang: 'dart',
    fileExtension: '.dart',
    defaultFileName: 'main.dart',
    compiler: 'Dart AOT / JIT 3.x',
    runCommand: 'dart run main.dart',
    debuggerSupported: true,
    packageManager: 'pub',
    pistonRuntime: { language: 'dart', version: '2.19.6' },
    starterCode: `// Universal Online Platform - Dart
void main() {
  print('[Cortex] Dart Client-Optimized Language');
  var list = ['Flutter', 'Web', 'Server', 'CLI'];
  list.forEach((target) => print('Targeting: $target'));
}
`,
    memoryLimitMb: 128,
    timeoutSec: 10,
    category: 'web',
  },
  {
    id: 'sql',
    name: 'SQL (SQLite)',
    version: '3.x',
    aliases: ['sql', 'sqlite'],
    monacoLang: 'sql',
    fileExtension: '.sql',
    defaultFileName: 'query.sql',
    compiler: 'SQLite 3 Engine',
    runCommand: 'sqlite3 :memory: < query.sql',
    debuggerSupported: false,
    pistonRuntime: { language: 'sqlite3', version: '3.36.0' },
    starterCode: `-- Universal Online Platform - SQL Database Engine
CREATE TABLE developers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    favorite_language TEXT NOT NULL,
    projects_completed INTEGER DEFAULT 0
);

INSERT INTO developers (name, favorite_language, projects_completed) VALUES
('Ada Lovelace', 'C++', 42),
('Alan Turing', 'Python', 99),
('Grace Hopper', 'Rust', 85);

SELECT favorite_language, COUNT(*) AS devs, SUM(projects_completed) AS total_projects
FROM developers
GROUP BY favorite_language
ORDER BY total_projects DESC;
`,
    memoryLimitMb: 128,
    timeoutSec: 8,
    category: 'data',
  }
];

export function getLanguageConfig(idOrAlias: string): LanguageConfig {
  const normalized = idOrAlias.toLowerCase().trim();
  const found = SUPPORTED_LANGUAGES.find(
    (l) => l.id === normalized || l.aliases.includes(normalized)
  );
  return found || SUPPORTED_LANGUAGES[0];
}
