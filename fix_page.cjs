
const fs = require("fs");
let page = fs.readFileSync("src/app/page.tsx", "utf8");

// We don"t need to pass aiSettings.apiKey to analyzeCode or autoFixWithGeminiOrOffline.
page = page.replace(/apiKey={aiSettings\.apiKey \|\| ""}/g, "");
page = page.replace(/, aiSettings\.apiKey\)/g, ")");
page = page.replace(/, keyToUse\)/g, ")");

fs.writeFileSync("src/app/page.tsx", page);

