import fs from 'fs';
let content = fs.readFileSync('src/lib/db/index.ts', 'utf-8');
content = content.replace('const customReq = typeof __webpack_require__ !== \\'undefined\\' ? __non_webpack_require__ : require;', 
\    // @ts-ignore
    const customReq = typeof __webpack_require__ !== 'undefined' ? (globalThis as any).__non_webpack_require__ || require : require;\);
fs.writeFileSync('src/lib/db/index.ts', content, 'utf-8');
