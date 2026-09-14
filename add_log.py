import os

filepath = 'scripts/test-phase2e.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("assert(resWorkspace.status === 200, 'authenticated Arena access works');", "console.log('resWorkspace', resWorkspace.status, dataWorkspace);\n    assert(resWorkspace.status === 200, 'authenticated Arena access works');")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
