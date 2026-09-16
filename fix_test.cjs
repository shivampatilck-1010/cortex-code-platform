
const fs = require("fs");
let t = fs.readFileSync("scripts/test-phase2i-f.ts", "utf8");
t = t.replace(/import fetch from "node-fetch";/, "");
fs.writeFileSync("scripts/test-phase2i-f.ts", t);

