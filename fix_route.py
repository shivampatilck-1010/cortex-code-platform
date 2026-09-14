import os

filepath = 'src/app/api/v1/benchmark/run/route.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(r'file.projectId = workspace.workspaceAProjectId;\n        file.isFolder = file.isFolder || false;\n        file.createdAt = file.createdAt || Date.now();\n        file.updatedAt = Date.now();', 'file.projectId = workspace.workspaceAProjectId;\n        file.isFolder = file.isFolder || false;\n        file.createdAt = file.createdAt || Date.now();\n        file.updatedAt = Date.now();')
content = content.replace(r'file.projectId = workspace.workspaceBProjectId;\n        file.isFolder = file.isFolder || false;\n        file.createdAt = file.createdAt || Date.now();\n        file.updatedAt = Date.now();', 'file.projectId = workspace.workspaceBProjectId;\n        file.isFolder = file.isFolder || false;\n        file.createdAt = file.createdAt || Date.now();\n        file.updatedAt = Date.now();')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
