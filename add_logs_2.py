import os

filepath = 'scripts/test-phase2e.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("assert(dataBenchRunA.resultA !== null, 'Run A works');", "console.log('dataBenchRunA', dataBenchRunA);\n    assert(!!dataBenchRunA.resultA, 'Run A works');")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
