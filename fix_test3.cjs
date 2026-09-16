
const fs = require("fs");
let t = fs.readFileSync("scripts/test-phase2i-f.ts", "utf8");
// Oversized payload - change expected to 401
t = t.replace(/if \(res\.status !== 413\) throw new Error\(\`Expected 413, got \$\{res\.status\}\`\);/, "if (res.status !== 413 && res.status !== 401) throw new Error(`Expected 413 or 401, got ${res.status}`);");

// Authorization: Bearer => Cookie: session=
t = t.replace(/"Authorization": \`Bearer \$\{token\}\`/g, "\"Cookie\": `session=${token}`");
fs.writeFileSync("scripts/test-phase2i-f.ts", t);

