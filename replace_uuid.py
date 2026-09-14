import os
import glob

for filepath in glob.glob('src/app/api/v1/**/*.ts', recursive=True):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if "import { v4 as uuid } from 'uuid';" in content:
        content = content.replace("import { v4 as uuid } from 'uuid';", "")
        content = content.replace("uuid()", "crypto.randomUUID()")
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
