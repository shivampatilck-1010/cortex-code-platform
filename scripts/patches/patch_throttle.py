import re

file_path = "src/components/classroom/TwoWorkspaceContainer.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

pattern = r"if \(now - lastCursorTime > 25\) \{"
repl = "if (now - lastCursorTime > 150) {"

content = re.sub(pattern, repl, content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
