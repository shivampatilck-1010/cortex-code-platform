import re

c = open('src/lib/db/index.ts', 'r', encoding='utf-8').read()

c = c.replace('((globalThis as any).__non_webpack_require__ || require)', '((globalThis as any).__non_webpack_require__ || (typeof require !== "undefined" ? require : undefined))')

open('src/lib/db/index.ts', 'w', encoding='utf-8').write(c)
