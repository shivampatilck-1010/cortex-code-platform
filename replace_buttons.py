import os
import re

filepath = 'src/app/compare/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'const handleRunA = async \(\) => \{.*?\n  \};', '', content, flags=re.DOTALL)
content = re.sub(r'const handleRunB = async \(\) => \{.*?\n  \};', '', content, flags=re.DOTALL)

content = content.replace('onClick={handleRunA}', "onClick={() => handleRun('A')}")
content = content.replace('onClick={handleRunB}', "onClick={() => handleRun('B')}")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
