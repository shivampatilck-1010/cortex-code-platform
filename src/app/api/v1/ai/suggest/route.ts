import { NextRequest, NextResponse } from 'next/server';
import { getLanguageConfig } from '@/config/languages';
import { aiRateLimiter } from '@/lib/execution/rate-limiter';

interface SuggestRequestBody {
  prefix: string;
  suffix?: string;
  languageId?: string;
  line?: number;
  column?: number;
  apiKey?: string;
}

const CANDIDATE_MODELS = [
  'gemini-3.7-flash',
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
];

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateCheck = aiRateLimiter.checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'AI request rate limit exceeded. Please wait a few seconds before trying again.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rateCheck.resetMs / 1000)) } }
      );
    }

    const body = (await req.json()) as SuggestRequestBody;
    const { prefix = '', suffix = '', languageId = 'python', apiKey } = body;

    if (!prefix.trim()) {
      return NextResponse.json({ suggestion: '' });
    }

    if (prefix.length > 16384 || suffix.length > 16384) {
      return NextResponse.json({ error: 'Code context exceeds maximum length of 16KB.' }, { status: 413 });
    }

    const resolvedApiKey =
      apiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      '';


    if (resolvedApiKey) {
      const langConfig = getLanguageConfig(languageId);
      const prompt = `You are an ultra-fast code completion engine. Continue the code directly at the cursor.
Language: ${langConfig.name} (${langConfig.version})

Code before cursor:
${prefix}

Code after cursor:
${suffix}

Rules:
- Output ONLY the next 1 to 3 lines of code that complete the statement or block.
- Do NOT repeat any characters that were already typed before the cursor.
- Do NOT output markdown fences, backticks, or comments.
- Return ONLY the exact completion string.`;

      for (const modelName of CANDIDATE_MODELS) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1800);

          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${resolvedApiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: controller.signal,
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  maxOutputTokens: 60,
                  temperature: 0.1,
                  thinkingConfig: { thinkingBudget: 0 },
                },
              }),
            }
          );

          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const cleaned = text.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trimEnd();
            if (cleaned) {
              return NextResponse.json({ suggestion: cleaned });
            }
          }
        } catch {
          // Try next model or fallback
        }
      }
    }

    return NextResponse.json({ suggestion: '' });
  } catch {
    return NextResponse.json({ suggestion: '' });
  }
}
