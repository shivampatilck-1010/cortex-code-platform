import re

file_path = "src/app/classroom/page.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

content = re.sub(
    r'(<div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">\s*<div className="bg-\[#14151d\] border border-\[#272a39\] rounded-2xl p-6 max-w-[a-z]+ w-full space-y-4 shadow-2xl)(">)',
    r'\1 max-h-[90vh] overflow-y-auto\2',
    content
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
