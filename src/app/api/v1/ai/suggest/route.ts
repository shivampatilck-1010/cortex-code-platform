import { NextRequest, NextResponse } from "next/server";
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
    const user = await ClassroomAuth.authenticateRequest(req);
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
    
    const prefix = (body.prefix || "").slice(-2000);
    const suffix = (body.suffix || "").slice(0, 500);
    const prompt = `Complete the following ${body.languageId} code. ONLY output the continuation code, nothing else.\n\nPrefix:\n${prefix}\n\nSuffix:\n${suffix}`;
    
    for (const model of CANDIDATE_MODELS) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        if (res.ok) {
          const json = await res.json();
          let suggestion = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
          suggestion = suggestion.replace(/^\s*```[a-z]*\n?/, "").replace(/\n?```\s*$/, "");
          return NextResponse.json({ suggestion });
        }
      } catch (e) {}
    }
    return NextResponse.json({ suggestion: "" });


  } catch (err: any) {
    if (err.message === "Payload too large") return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
