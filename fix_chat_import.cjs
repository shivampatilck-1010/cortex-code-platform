
const fs = require("fs");
let c = fs.readFileSync("src/app/api/v1/ai/chat/route.ts", "utf8");
c = c.replace(/const \{ ClassroomAuth \} = await import\("@\/lib\/classroom\/auth"\);/, "");
c = c.replace(/const \{ classroomDb \} = await import\("@\/lib\/classroom\/db"\);/, "");
c = "import { ClassroomAuth } from \"@/lib/classroom/auth\";\nimport { classroomDb } from \"@/lib/classroom/db\";\n" + c;
fs.writeFileSync("src/app/api/v1/ai/chat/route.ts", c);
console.log("Fixed imports");

