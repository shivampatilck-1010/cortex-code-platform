import os
import re

filepath = 'scripts/test-phase2e.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("benchmarkId: 'search_' + Date.now()", "benchmarkId: testBenchmarkId")
# Also need to insert `const testBenchmarkId = 'search_' + Date.now();` before `// BENCHMARK`
content = content.replace("// BENCHMARK\n    (global as any).TEST_USER_ID = 'user_bench_1';", "const testBenchmarkId = 'search_' + Date.now();\n    // BENCHMARK\n    (global as any).TEST_USER_ID = 'user_bench_1';")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
