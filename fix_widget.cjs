
const fs = require("fs");
let widget = fs.readFileSync("src/components/editor/InlineQuickFixWidget.tsx", "utf8");

// Remove the button
widget = widget.replace(/<button[^>]*onClick=\{\(\) => setShowKeyInput\(!showKeyInput\)\}[^>]*>[\s\S]*?<\/button>/, "");

// Remove the drawer
widget = widget.replace(/\{\/\* Gemini API Key Drawer[\s\S]*?animate-in slide-in-from-top-1">[\s\S]*?<\/div>\s*\}/, "");

fs.writeFileSync("src/components/editor/InlineQuickFixWidget.tsx", widget);

