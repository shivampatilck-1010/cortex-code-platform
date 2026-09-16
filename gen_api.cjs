
const fs = require("fs");
const path = require("path");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

// Ensure directories
ensureDir("src/app/api/v1/ai/analyze");
ensureDir("src/app/api/v1/ai/convert");

// Common Auth Header & JSON read
const routeTemplate = (name, bodyLogic) => `import { NextRequest, NextResponse } from "next/server";
import { ClassroomAuth } from "@/lib/classroom/auth";
import { aiRateLimiter } from "@/lib/execution/rate-limiter";

const FALLBACK_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
const CANDIDATE_MODELS = [
  "gemini-3.7-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash",
];

async function readJsonBody(req: NextRequest, maxSize: number = 512 * 1024) {
  const text = await req.text();
  if (text.length > maxSize) throw new Error("Payload too large");
  return JSON.parse(text);
}

export async function POST(req: NextRequest) {
  try {
    const user = await ClassroomAuth.getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Authentication required for AI context." }, { status: 401 });
    }

    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const rateCheck = aiRateLimiter.checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "AI request rate limit exceeded." },
        { status: 429 }
      );
    }

    const key = FALLBACK_KEY;
    if (!key) {
      return NextResponse.json({ error: "AI provider not configured." }, { status: 503 });
    }

    const body = await readJsonBody(req);
    ${bodyLogic}

  } catch (err: any) {
    if (err.message === "Payload too large") return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
`;

// 1. autofix route
fs.writeFileSync("src/app/api/v1/ai/autofix/route.ts", routeTemplate("autofix", `
    const code = (body.code || "").slice(0, 10000);
    const stderr = (body.stderr || "").slice(0, 2000);
    const prompt = \`Fix this \${body.languageId} code error:\\n\\nCode:\\n\${code}\\n\\nError:\\n\${stderr}\\nReturn JSON with { convertedCode, explanation, bugs, optimizations, complexityEstimate }\`;
    
    for (const model of CANDIDATE_MODELS) {
      try {
        const res = await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/\${model}:generateContent?key=\${key}\`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        if (res.ok) {
          const json = await res.json();
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
          let parsed;
          try {
            parsed = JSON.parse(text.replace(/\\r?\\n/g, "\\n").replace(/\\r/g, "\\n").replace(/^\\s*\`\`\`json\\s*/, "").replace(/\\s*\`\`\`\\s*$/, ""));
          } catch(e) { parsed = { convertedCode: code, explanation: "Failed to parse AI output" }; }
          return NextResponse.json(parsed);
        }
      } catch (e) {}
    }
    return NextResponse.json({ convertedCode: code, explanation: "AI Fix unavailable" });
`));

// 2. suggest route
fs.writeFileSync("src/app/api/v1/ai/suggest/route.ts", routeTemplate("suggest", `
    const prefix = (body.prefix || "").slice(-2000);
    const suffix = (body.suffix || "").slice(0, 500);
    const prompt = \`Complete the following \${body.languageId} code. ONLY output the continuation code, nothing else.\\n\\nPrefix:\\n\${prefix}\\n\\nSuffix:\\n\${suffix}\`;
    
    for (const model of CANDIDATE_MODELS) {
      try {
        const res = await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/\${model}:generateContent?key=\${key}\`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        if (res.ok) {
          const json = await res.json();
          let suggestion = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
          suggestion = suggestion.replace(/^\\s*\`\`\`[a-z]*\\n?/, "").replace(/\\n?\`\`\`\\s*$/, "");
          return NextResponse.json({ suggestion });
        }
      } catch (e) {}
    }
    return NextResponse.json({ suggestion: "" });
`));

// 3. analyze route
fs.writeFileSync("src/app/api/v1/ai/analyze/route.ts", routeTemplate("analyze", `
    const code = (body.code || "").slice(0, 10000);
    const prompt = \`Analyze this \${body.languageId} code for \${body.mode}. Return JSON with { convertedCode, explanation, bugs, optimizations, complexityEstimate }.\\n\\nCode:\\n\${code}\`;
    
    for (const model of CANDIDATE_MODELS) {
      try {
        const res = await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/\${model}:generateContent?key=\${key}\`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        if (res.ok) {
          const json = await res.json();
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
          let parsed;
          try {
            parsed = JSON.parse(text.replace(/\\r?\\n/g, "\\n").replace(/\\r/g, "\\n").replace(/^\\s*\`\`\`json\\s*/, "").replace(/\\s*\`\`\`\\s*$/, ""));
          } catch(e) { parsed = { convertedCode: code, explanation: text }; }
          return NextResponse.json(parsed);
        }
      } catch (e) {}
    }
    return NextResponse.json({ convertedCode: code, explanation: "AI Analysis unavailable" });
`));

// 4. convert route
fs.writeFileSync("src/app/api/v1/ai/convert/route.ts", routeTemplate("convert", `
    const sourceCode = (body.sourceCode || "").slice(0, 10000);
    const prompt = \`Convert this \${body.fromLanguageId} code to \${body.toLanguageId}. Return JSON with { convertedCode, explanation }.\\n\\nCode:\\n\${sourceCode}\`;
    
    for (const model of CANDIDATE_MODELS) {
      try {
        const res = await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/\${model}:generateContent?key=\${key}\`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        if (res.ok) {
          const json = await res.json();
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
          let parsed;
          try {
            parsed = JSON.parse(text.replace(/\\r?\\n/g, "\\n").replace(/\\r/g, "\\n").replace(/^\\s*\`\`\`json\\s*/, "").replace(/\\s*\`\`\`\\s*$/, ""));
          } catch(e) { parsed = { convertedCode: text.replace(/^\\s*\`\`\`[a-z]*\\n?/, "").replace(/\\n?\`\`\`\\s*$/, ""), explanation: "Converted code." }; }
          return NextResponse.json(parsed);
        }
      } catch (e) {}
    }
    return NextResponse.json({ convertedCode: sourceCode, explanation: "AI Conversion unavailable" });
`));

console.log("Generated secure API routes for AI");

