
const fs = require("fs");
let t = fs.readFileSync("scripts/test-phase2i-f.ts", "utf8");

t = t.replace(/token = data\.token;/g, `
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      const match = setCookie.match(/session=([^;]+)/);
      if (match) token = match[1];
    }
`);
fs.writeFileSync("scripts/test-phase2i-f.ts", t);

