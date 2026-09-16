
const fs = require("fs");
let t = fs.readFileSync("scripts/test-phase2i-f.ts", "utf8");
t = t.replace(/"ai_user_" \+ Date\.now\(\)/, `"ai_" + Date.now().toString().slice(-10)`);
fs.writeFileSync("scripts/test-phase2i-f.ts", t);

