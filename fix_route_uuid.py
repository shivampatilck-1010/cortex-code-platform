import os

filepath = 'src/app/api/v1/benchmark/run/route.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(r'file.id = crypto.randomUUID();\n        file.projectId = workspace.workspaceAProjectId;', 'file.id = crypto.randomUUID();\n        file.projectId = workspace.workspaceAProjectId;')
content = content.replace(r'file.id = crypto.randomUUID();\n        file.projectId = workspace.workspaceBProjectId;', 'file.id = crypto.randomUUID();\n        file.projectId = workspace.workspaceBProjectId;')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
