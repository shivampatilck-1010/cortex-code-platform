
const fs = require("fs");
let panel = fs.readFileSync("src/components/panels/AIAssistantPanel.tsx", "utf8");

panel = panel.replace(/apiKey: settings.apiKey,/g, "");
panel = panel.replace(/body: JSON.stringify\(\{ apiKey: trimmed \}\),/g, "");
panel = panel.replace(/onUpdateSettings\(\{ apiKey: trimmed, provider: .*? \}\);/g, "");

fs.writeFileSync("src/components/panels/AIAssistantPanel.tsx", panel);

