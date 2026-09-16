
const fs = require("fs");

let assistantCode = `
import { getLanguageConfig } from "@/config/languages";

export interface AIFixResult {
  convertedCode: string;
  explanation: string;
  bugs?: string[];
  optimizations?: string[];
  complexityEstimate?: string;
}

export function analyzeAndFixErrorOffline(
  code: string,
  stderr: string,
  languageId: string
): AIFixResult | null {
  const lang = getLanguageConfig(languageId);
  return {
    convertedCode: code,
    explanation: \`Offline heuristic: Check syntax around the reported error. \${stderr.split("\\n")[0]}\`
  };
}

export async function autoFixWithGeminiOrOffline(
  code: string,
  stderr: string,
  languageId: string,
  diagnostics: any[] = [],
  apiKey?: string
): Promise<AIFixResult> {
  try {
    const res = await fetch("/api/v1/ai/autofix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, stderr, languageId, diagnostics })
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (e) {
    console.error(e);
  }
  return analyzeAndFixErrorOffline(code, stderr, languageId) || { convertedCode: code, explanation: "Failed to fix" };
}

export async function analyzeCode(
  code: string,
  languageId: string,
  options: { suggestImprovements?: boolean },
  mode: "explain" | "optimize" | "refactor" = "explain",
  apiKey?: string
): Promise<AIFixResult> {
  try {
    const res = await fetch("/api/v1/ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, languageId, options, mode })
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (e) {
    console.error(e);
  }
  return {
    convertedCode: code,
    explanation: "Offline Analysis: " + mode
  };
}

export async function convertCode(
  sourceCode: string,
  fromLanguageId: string,
  toLanguageId: string,
  apiKey?: string
): Promise<{ convertedCode: string; explanation: string }> {
  try {
    const res = await fetch("/api/v1/ai/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceCode, fromLanguageId, toLanguageId })
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (e) {
    console.error(e);
  }
  return {
    convertedCode: sourceCode,
    explanation: "Offline Convert Failed"
  };
}

export function getLocalInlineSuggestion(codeBeforeCursor: string, currentLine: string, languageId: string): string {
  const trimmed = currentLine.trim();
  if (trimmed.length < 2) return "";
  const lower = trimmed.toLowerCase();
  
  if (languageId === "python" && "def".startsWith(lower)) return "def main():\\n    pass";
  if ((languageId === "javascript" || languageId === "typescript") && "console.log".startsWith(lower)) return "console.log(\"Hello, World!\");";
  
  return "";
}

export async function fetchInlineSuggestion(
  codeBeforeCursor: string,
  currentLine: string,
  languageId: string,
  codeAfterCursor: string = "",
  apiKey?: string
): Promise<string> {
  const localSuggestion = getLocalInlineSuggestion(codeBeforeCursor, currentLine, languageId);
  if (localSuggestion) return localSuggestion;
  
  try {
    const res = await fetch("/api/v1/ai/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: codeBeforeCursor, suffix: codeAfterCursor, languageId })
    });
    if (res.ok) {
      const data = await res.json();
      return data.suggestion || "";
    }
  } catch (e) { }
  
  return "";
}
`;

fs.writeFileSync("src/lib/ai/assistant.ts", assistantCode);
console.log("Refactored assistant.ts");

