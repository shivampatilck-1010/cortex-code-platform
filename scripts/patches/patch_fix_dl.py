import re

file_path = "src/app/classroom/[roomId]/page.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("type: 'download_request',", "type: 'file_download_request',")
content = content.replace("type: 'download_response',", "type: 'file_download_response',")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
