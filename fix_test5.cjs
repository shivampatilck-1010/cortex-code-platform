
const fs = require("fs");
let t = fs.readFileSync("scripts/test-phase2i-f.ts", "utf8");
t = t.replace(/if \(match\) token = match\[1\];/g, "if (match) token = match[1]; console.log(\"Extracted token:\", token);");
fs.writeFileSync("scripts/test-phase2i-f.ts", t);

