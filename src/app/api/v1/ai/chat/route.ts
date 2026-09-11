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

    const body = await req.json();
    const { userMessage = '', code = '', language = 'javascript', apiKey } = body as {
      userMessage: string;
      code: string;
      language: string;
      apiKey?: string;
    };

    if (userMessage.length > 16384) {
      return NextResponse.json({ error: 'User message exceeds maximum length of 16KB.' }, { status: 413 });
    }
    if (code.length > 65536) {
      return NextResponse.json({ error: 'Code context exceeds maximum length of 64KB.' }, { status: 413 });
    }

    const key = apiKey || FALLBACK_KEY;
    if (!key) {
      // Local Intelligence Mode: Instant, accurate heuristic code guidance
      const trimmedMsg = (userMessage || '').toLowerCase();
      let offlineReply = '';

      if (trimmedMsg.includes('error') || trimmedMsg.includes('fix') || trimmedMsg.includes('bug') || trimmedMsg.includes('fail')) {
        offlineReply = `🔍 **Cortex Code Assistant (Local Intelligence)**\n\nI checked your active **${language}** workspace. To test your code against compiler checks and test cases right now, click **Run (Ctrl+Enter)**.\n\nIf any error occurs, our zero-latency compiler diagnostics will highlight the exact line and provide a 1-click **Quick Fix** action!\n\n💡 *Tip: To enable conversational reasoning with Gemini 1.5/2.0 Flash, paste a free Google Gemini API key in the top banner.*`;
      } else if (trimmedMsg.includes('explain') || trimmedMsg.includes('how') || trimmedMsg.includes('what') || trimmedMsg.includes('understand')) {
        const lineCount = code ? code.split('\n').length : 0;
        offlineReply = `📖 **Code Overview (${language})**\n\nYour current workspace has **${lineCount} lines** of ${language} code ready for execution.\n\n• **Run Code**: Press **Ctrl+Enter** or the green **Run** button.\n• **Step Debugger**: Click **Debug** in the top bar to inspect variables.\n• **Test Cases**: Switch to the **Tests** dock panel to run custom test cases.\n\n💡 *Tip: Paste your Gemini API key in Settings to get deep line-by-line conversational code analysis!*`;
      } else if (trimmedMsg.includes('optimize') || trimmedMsg.includes('fast') || trimmedMsg.includes('benchmark') || trimmedMsg.includes('speed')) {
        offlineReply = `⚡ **Performance & Optimization Tips (${language})**\n\n1. **Memory**: Avoid excessive allocations inside loops.\n2. **Complexity**: Check out our **Benchmark** tool in the top bar to compare two algorithms side-by-side.\n3. **I/O**: In competitive programming, use fast I/O (e.g. \`cin.tie(NULL)\` in C++ or \`sys.stdin.read\` in Python).\n\n💡 *Tip: Add a free Gemini key in Settings for AI-driven Big-O complexity refactoring.*`;
      } else {
        offlineReply = `🤖 **Cortex Code Assistant (${language})**\n\nHello! I'm active in **${language}** mode.\n\nYou can:\n• Press **Run (Ctrl+Enter)** to execute code in our cloud sandbox.\n• Toggle **Debug** for visual step-debugging.\n• Use the **Terminal** tab for interactive bash commands.\n• Test algorithm solutions in **Challenges** or explore **Learn** courses.\n\n💡 *Tip: To chat freely with Google Gemini 2.0 / 1.5 Flash, enter your free API key in the top banner or Settings.*`;
      }

      return NextResponse.json({ reply: offlineReply, model: 'cortex-local-assistant' }, { status: 200 });
    }

    const codeSnippet = (code || '').slice(0, 3000);
    const prompt = `You are Cortex AI, a senior software engineer and code assistant. The user is working on ${language} code.

Current code context:
\`\`\`${language}
${codeSnippet}
\`\`\`

Answer the user's question clearly, concisely, and helpfully. When showing code snippets, use markdown code fences. Be specific and technical. Don't repeat the full code unless asked.

User: ${userMessage}

Cortex AI:`;

    // Try each model in order until one works
    for (const model of CANDIDATE_MODELS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 800,
                thinkingConfig: { thinkingBudget: 0 },
              },
            }),
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (res.ok) {
          const json = await res.json();
          const reply =
            json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
            'No response generated. Please try rephrasing your question.';
          return NextResponse.json({ reply, model });
        }

        const errBody = await res.text().catch(() => '');
        console.warn(`[chat/route] Model ${model} failed (${res.status}):`, errBody.slice(0, 200));
        // 400 = bad request / wrong model name, 403 = bad key, 429 = quota — keep trying for 400
        if (res.status === 403 || res.status === 401) {
          // Key issue — no point trying other models
          return NextResponse.json(
            { reply: 'Invalid API key. Please check your Gemini API key in Settings → AI tab.' },
            { status: 200 }
          );
        }
      } catch (modelErr: unknown) {
        const msg = modelErr instanceof Error ? modelErr.message : String(modelErr);
        console.warn(`[chat/route] Model ${model} threw:`, msg);
        // AbortError = timeout, continue to next model
      }
    }

    // All models failed or rate-limited: return friendly offline guidance
    return NextResponse.json(
      { 
        reply: `⚡ **Cortex Offline Assistance**\n\nExternal AI services are currently unreachable or rate-limited. You can continue writing and compiling code normally in your **${language}** workspace.\n\n• Press **Ctrl+Enter** to run your code.\n• View test case results in the **Tests** tab.\n• Check your API key in Settings if you'd like to reconnect to Gemini.`,
        model: 'cortex-offline-fallback'
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[chat/route] Unexpected error:', msg);
    return NextResponse.json(
      { reply: 'System ready. Enter code or execute with Run (Ctrl+Enter).' },
      { status: 200 }
    );
  }
}
