
const fs = require("fs");
let editor = fs.readFileSync("src/components/editor/MonacoCodeEditor.tsx", "utf8");
editor = editor.replace(/apiKeyRef\.current/g, "undefined");
// wait, if I replace apiKeyRef.current with undefined, then `apiKeyRef.current = apiKey;` becomes `undefined = apiKey;` which is a syntax error in JS.
editor = editor.replace(/undefined = apiKey;/g, "");
editor = editor.replace(/const apiKeyRef = useRef\(apiKey\);/g, "");
fs.writeFileSync("src/components/editor/MonacoCodeEditor.tsx", editor);

