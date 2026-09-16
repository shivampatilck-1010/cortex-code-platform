
const fs = require("fs");

function fixRoute(file) {
  let content = fs.readFileSync(file, "utf8");
  content = content.replace(/ClassroomAuth\.getCurrentUser/g, "ClassroomAuth.authenticateRequest");
  fs.writeFileSync(file, content);
}

fixRoute("src/app/api/v1/ai/autofix/route.ts");
fixRoute("src/app/api/v1/ai/suggest/route.ts");
fixRoute("src/app/api/v1/ai/analyze/route.ts");
fixRoute("src/app/api/v1/ai/convert/route.ts");
fixRoute("src/app/api/v1/ai/chat/route.ts");

console.log("Fixed routes to use authenticateRequest");

