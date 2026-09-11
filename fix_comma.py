import re

with open('src/app/classroom/page.tsx', 'r') as f:
    content = f.read()

content = content.replace("  X\n  BarChart2,", "  X,\n  BarChart2,")

with open('src/app/classroom/page.tsx', 'w') as f:
    f.write(content)
