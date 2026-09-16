
const fs = require("fs");
let t = fs.readFileSync("scripts/test-regression.ts", "utf8");
t = t.replace(
  `"scripts/test-phase2i-f.ts"`, 
  `"scripts/test-phase2i-f.ts",\n  "scripts/test-phase2i-g.ts"`
);
fs.writeFileSync("scripts/test-regression.ts", t);

