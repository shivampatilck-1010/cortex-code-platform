import { ClassroomAuth } from "@/lib/classroom/auth";
import { classroomDb } from "@/lib/classroom/db";
import { NextRequest, NextResponse } from 'next/server';
import { aiRateLimiter } from '@/lib/execution/rate-limiter';

// Server-only key fallback; NEXT_PUBLIC_ is deliberately omitted to prevent bundle leakage
const FALLBACK_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  '';

// Fast model priority list: gemini-3.7-flash (sub-second) -> gemini-flash-latest -> gemini-3.8-flash -> gemini-3.5-flash
const CANDIDATE_MODELS = [
  'gemini-3.7-flash',
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
];


async function readJsonBody(req: NextRequest, maxSize: number = 512 * 1024) {
  const text = await req.text();
  if (text.length > maxSize) throw new Error("Payload too large");
  return JSON.parse(text);
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json({ error: "Invalid Content-Type" }, { status: 415 });
    }

    
    

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

    let body;
    try {
      body = await readJsonBody(req);
    } catch(err: any) {
      if (err.message === "Payload too large") return NextResponse.json({ error: "Payload too large" }, { status: 413 });
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { userMessage = "", code = "", language = "javascript", classroomId, assignmentId } = body as any;

    if (classroomId) {
      const membershipResult = await ClassroomAuth.verifyClassroomMembership(user, classroomId);
      if (!membershipResult.authorized) {
        return NextResponse.json({ error: "Not a member of this classroom." }, { status: 403 });
      }

      if (assignmentId) {
        const assignment = await classroomDb.getAssignment(assignmentId);
        if (!assignment || assignment.classroomId !== classroomId) {
          return NextResponse.json({ error: "Assignment not found in this classroom." }, { status: 404 });
        }

        const isTeacher = membershipResult.role === "teacher" || membershipResult.role === "admin";
        if (!isTeacher) {
          const policy = assignment.aiPolicy || "hints_only";
          if (policy === "disabled") {
            return NextResponse.json(
              { error: "AI assistance has been disabled by your instructor for this assignment." },
              { status: 403 }
            );
          }
        }
      }
    }

    const key = FALLBACK_KEY;
    if (!key) {
      return NextResponse.json(
        { reply: "Offline: API key not configured on server.", model: "cortex-offline-fallback" },
        { status: 200 }
      );
    }

    const codeSnippet = (code || "").slice(0, 5000); // Strict limit on code length to prevent context exhaustion
    const msg = (userMessage || "").slice(0, 1000);
    const prompt = `You are Cortex AI, a senior software engineer and code assistant. The user is working on ${language} code.
Current code:
\`\`\`${language}
${codeSnippet}
\`\`\`
User: ${msg}
Cortex AI:`;

    for (const model of CANDIDATE_MODELS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 800 }
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const json = await res.json();
          const reply = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "No response generated.";
          return NextResponse.json({ reply, model });
        }
      } catch (e) {}
    }

    return NextResponse.json(
      { reply: "AI request failed.", model: "cortex-offline-fallback" },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json({ reply: "System error" }, { status: 200 });
  }
}
