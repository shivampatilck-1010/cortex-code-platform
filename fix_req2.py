import re
c = open('src/lib/db/index.ts', 'r', encoding='utf-8').read()
c = c.replace("DatabaseSync = require('node:sqlite').DatabaseSync;", "DatabaseSync = customReq('node:sqlite').DatabaseSync;")
open('src/lib/db/index.ts', 'w', encoding='utf-8').write(c)
