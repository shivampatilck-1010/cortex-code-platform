import os

filepath = 'scripts/test-phase2e.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("assert(dataBenchRunBoth.resultA !== null && dataBenchRunBoth.resultB !== null, 'Run Both works');", "console.log('dataBenchRunBoth', dataBenchRunBoth);\n    assert(!!dataBenchRunBoth.resultA && !!dataBenchRunBoth.resultB, 'Run Both works');")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
