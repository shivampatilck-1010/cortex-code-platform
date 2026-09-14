import re
c = open('src/lib/db/index.ts', 'r', encoding='utf-8').read()

# Add import if missing
if 'createRequire' not in c:
    c = "import { createRequire } from 'module';\n" + c

new_logic = '''
    const customReq = typeof (globalThis as any).__webpack_require__ !== 'undefined' 
      ? ((globalThis as any).__non_webpack_require__ || require) 
      : (typeof require !== 'undefined' ? require : createRequire(import.meta.url));
'''
c = re.sub(r'const customReq = [^\n]+;', new_logic.strip(), c)

open('src/lib/db/index.ts', 'w', encoding='utf-8').write(c)
