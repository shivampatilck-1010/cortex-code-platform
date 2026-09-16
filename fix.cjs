const fs = require('fs');
let ast = fs.readFileSync('src/lib/ai/assistant.ts', 'utf8');

const analyzeRep = 'export async function analyzeCode(code: string, languageId: string, settings: AISettings, mode: "explain" | "optimize" | "refactor" = "explain"): Promise<AIAnalysisResult> { try { const res = await fetch("/api/v1/ai/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, languageId, mode }) }); if (res.ok) return res.json(); } catch(e) {} return { explanation: "Offline analysis unavailable." }; }';
ast = ast.replace(/export async function analyzeCode\([\s\S]*?\)\s*:\s*Promise<AIAnalysisResult>\s*\{[\s\S]*?return getAIFeedback\(code, languageId, mode, settings\.apiKey\);[\s\S]*?\}/, analyzeRep);

const convertRep = 'export async function convertCode(sourceCode: string, fromLanguageId: string, toLanguageId: string, apiKey?: string): Promise<{ convertedCode: string; explanation: string }> { try { const res = await fetch("/api/v1/ai/convert", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceCode, fromLanguageId, toLanguageId }) }); if (res.ok) return res.json(); } catch(e) {} return { convertedCode: sourceCode, explanation: "Offline Convert Failed" }; }';
ast = ast.replace(/export async function convertCode\([\s\S]*?\)\s*:\s*Promise<\{ convertedCode: string; explanation: string \}>\s*\{[\s\S]*?return \{\s*convertedCode: \/\/ Converted.*?explanation: Converted syntax.*?\};\s*\}/, convertRep);

const autoFixRep = 'export async function autoFixWithGeminiOrOffline(code: string, stderr: string, languageId: string, diagnostics: any[] = [], apiKey?: string): Promise<AIFixResult> { try { const res = await fetch("/api/v1/ai/autofix", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, stderr, languageId, diagnostics }) }); if (res.ok) return res.json(); } catch(e) {} return analyzeAndFixErrorOffline(code, stderr, languageId); }';
ast = ast.replace(/export async function autoFixWithGeminiOrOffline\([\s\S]*?\)\s*:\s*Promise<AIFixResult>\s*\{[\s\S]*?return analyzeAndFixErrorOffline\(code, stderr, languageId\);[\s\S]*?\}/, autoFixRep);

const getAIBegin = ast.indexOf('export async function getAIFeedback');
if (getAIBegin !== -1) {
    const getAIEndStr = 'explanation: Offline Analysis: . Connect Gemini for AI reasoning.,\n  };\n}';
    const getAIEnd = ast.indexOf(getAIEndStr, getAIBegin);
    if (getAIEnd !== -1) {
        ast = ast.substring(0, getAIBegin) + ast.substring(getAIEnd + getAIEndStr.length);
    }
}

fs.writeFileSync('src/lib/ai/assistant.ts', ast);
console.log("Patched assistant.ts");
