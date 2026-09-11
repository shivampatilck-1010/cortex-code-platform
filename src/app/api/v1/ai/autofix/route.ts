import { NextRequest, NextResponse } from 'next/server';
import { diffLines } from 'diff';
import { analyzeAndFixErrorOffline, AIFixResult } from '@/lib/ai/assistant';
import { getLanguageConfig } from '@/config/languages';
import { DiagnosticError } from '@/lib/execution/types';
import { aiRateLimiter } from '@/lib/execution/rate-limiter';

interface AutoFixRequestBody {
  code: string;
  stderr: string;
  languageId: string;
  diagnostics?: DiagnosticError[];
  apiKey?: string;
}

// Ultra-fast model cascade: gemini-3.7-flash (sub-second) -> gemini-flash-latest -> gemini-3.8-flash -> gemini-3.5-flash
const CANDIDATE_MODELS: Array<{ name: string; thinkingBudget?: number }> = [
  { name: 'gemini-3.7-flash', thinkingBudget: 0 },
  { name: 'gemini-flash-latest', thinkingBudget: 0 },
  { name: 'gemini-3.8-flash', thinkingBudget: 0 },
  { name: 'gemini-3.5-flash' },
  { name: 'gemini-3.6-flash' },
];

/**
 * Resilient JSON extractor for LLM responses
 */
function parseGeminiJson(rawText: string): any {
  let text = rawText.trim();
  // Strip markdown code fences if present
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  try {
    return JSON.parse(text);
  } catch {
    // Find outermost braces
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const sliced = text.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(sliced);
      } catch {
        // Fix trailing commas before } or ]
        const sanitized = sliced.replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(sanitized);
      }
    }
    throw new Error('Could not parse valid JSON from AI response');
  }
}

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

    const body = (await req.json()) as AutoFixRequestBody;
    const { code = '', stderr = '', languageId = 'python', diagnostics = [], apiKey } = body;

    if (!code) {
      return NextResponse.json(
        { error: 'Source code is required for auto-fixing' },
        { status: 400 }
      );
    }

    if (code.length > 65536) {
      return NextResponse.json({ error: 'Source code exceeds maximum length of 64KB.' }, { status: 413 });
    }
    if (stderr.length > 16384) {
      return NextResponse.json({ error: 'Stderr exceeds maximum length of 16KB.' }, { status: 413 });
    }

    const resolvedApiKey =
      apiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      '';

    const langConfig = getLanguageConfig(languageId);
    const commentPrefix = ['python', 'ruby', 'r'].includes(languageId)
      ? '# '
      : languageId === 'sql'
      ? '-- '
      : '// ';

    // 1. If Gemini API Key is provided or configured, call Google Gemini AI with fast cascade
    if (resolvedApiKey) {
      try {
        const systemPrompt = `You are Cortex AI, a world-class autonomous code compiler, diagnostics, and auto-repair engine.
A programmer encountered errors in their ${langConfig.name} (${langConfig.version}) program.
Analyze the code, stderr, and diagnostics below. Identify and resolve ALL errors across all lines (even if there are 2, 3, 5, or 10 errors across multiple lines).

Target Language: ${langConfig.name} (${langConfig.version})
Comment Prefix: ${commentPrefix}

Source Code:
\`\`\`${langConfig.monacoLang}
${code}
\`\`\`

Execution / Compilation Stderr:
\`\`\`
${stderr || '(Program failed compilation or execution)'}
\`\`\`

Diagnostics:
${JSON.stringify(diagnostics || [])}

Return a valid, parseable JSON object with these EXACT keys:
{
  "cause": "A concise summary of all issues found (e.g. 'Typo 'en' on line 25 and missing semicolon on line 26')",
  "explanation": "Clear explanation of all issues found and how they were resolved.",
  "targetLine": <number (line of the primary error)>,
  "inlineComment": "<${commentPrefix}[Cortex AI]: Error on line X - ...>",
  "errors": [
    {
      "line": <number>,
      "cause": "<concise cause of this line error>",
      "explanation": "<explanation of fix>",
      "inlineComment": "<${commentPrefix}[Cortex AI]: Error on line X - ...>",
      "originalSnippet": "<line before fix>",
      "fixedSnippet": "<line after fix>"
    }
  ],
  "fixedCode": "<COMPLETE source code with ALL fixes applied, ready to compile and run with 0 errors>",
  "originalSnippet": "<primary error line before fix>",
  "fixedSnippet": "<primary error line after fix>"
}

CRITICAL RULES:
- Identify EVERY error in the code (syntax, undeclared identifiers, missing headers/imports, mismatched brackets, semicolons, logic).
- Include EVERY error in the "errors" array with its exact line number and helpful inlineComment.
- The "fixedCode" MUST be the complete, valid, working program with all fixes applied. Do NOT use comments like '// ... rest of code'.
- Return ONLY raw JSON without markdown code fences.`;

        let consecutive429 = 0;
        for (const candidate of CANDIDATE_MODELS) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);

            const generationConfig: any = {
              responseMimeType: 'application/json',
              temperature: 0.1,
              maxOutputTokens: 3072,
            };

            if (candidate.thinkingBudget !== undefined) {
              generationConfig.thinkingConfig = { thinkingBudget: candidate.thinkingBudget };
            }

            const geminiRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${candidate.name}:generateContent?key=${resolvedApiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                  contents: [{ parts: [{ text: systemPrompt }] }],
                  generationConfig,
                }),
              }
            );

            clearTimeout(timeoutId);

            if (!geminiRes.ok) {
              console.warn(`Model ${candidate.name} returned status ${geminiRes.status}`);
              if (geminiRes.status === 429) {
                consecutive429++;
                if (consecutive429 >= 2) {
                  console.warn('Quota limit active for key, dropping instantly to offline engine');
                  break;
                }
              }
              continue;
            }

            const geminiData = await geminiRes.json();
            const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!rawText) continue;

            const parsed = parseGeminiJson(rawText);

            if (parsed.fixedCode && typeof parsed.fixedCode === 'string') {
              const diffChanges = diffLines(code, parsed.fixedCode);
              const targetLine = parsed.targetLine || diagnostics[0]?.line || 1;

              // Parse multiple error items
              const rawErrors = Array.isArray(parsed.errors) && parsed.errors.length > 0 ? parsed.errors : [];
              const errorList = rawErrors.length > 0
                ? rawErrors.map((e: any) => {
                    const lineNum = Number(e.line) || targetLine;
                    return {
                      line: lineNum,
                      cause: e.cause || 'Error on line ' + lineNum,
                      explanation: e.explanation || '',
                      inlineComment:
                        e.inlineComment ||
                        `${commentPrefix}[Cortex AI]: Error on line ${lineNum} - ${e.cause || 'Issue detected'}`,
                      originalSnippet: e.originalSnippet || code.split('\n')[lineNum - 1] || '',
                      fixedSnippet: e.fixedSnippet || '',
                    };
                  })
                : [
                    {
                      line: targetLine,
                      cause: parsed.cause || 'Diagnostic Error on line ' + targetLine,
                      explanation: parsed.explanation || '',
                      inlineComment: parsed.inlineComment || `${commentPrefix}[Cortex AI]: Error on line ${targetLine}`,
                      originalSnippet: parsed.originalSnippet || code.split('\n')[targetLine - 1] || '',
                      fixedSnippet: parsed.fixedSnippet || '',
                    },
                  ];

              // Generate commentedCode with comments beside or directly above ALL error lines
              const codeLines = code.split('\n');
              const commentedLines = [...codeLines];
              // Sort errors descending by line to handle any line insertions cleanly
              const sortedErrors = [...errorList].sort((a, b) => b.line - a.line);
              
              for (const err of sortedErrors) {
                const idx = err.line - 1;
                if (idx >= 0 && idx < commentedLines.length && !commentedLines[idx].includes('[Cortex AI]')) {
                  const lineText = commentedLines[idx];
                  if (lineText.trim().length > 0 && lineText.length < 55 && !lineText.includes('#') && !lineText.includes('//')) {
                    commentedLines[idx] = `${lineText}  ${err.inlineComment}`;
                  } else {
                    const indent = lineText.match(/^\s*/)?.[0] || '';
                    commentedLines[idx] = `${indent}${err.inlineComment}\n${commentedLines[idx]}`;
                  }
                }
              }
              const commentedCode = commentedLines.join('\n');

              const fixResult: AIFixResult = {
                cause: parsed.cause || (errorList.length > 1 ? `${errorList.length} issues diagnosed` : 'Diagnostic Error Resolved'),
                explanation: parsed.explanation || 'Fixed syntax and logic errors to ensure proper execution.',
                targetLine,
                inlineComment: parsed.inlineComment || `${commentPrefix}[Cortex AI]: Error on line ${targetLine} resolved.`,
                fixedCode: parsed.fixedCode,
                originalCode: code,
                diffChanges,
                confidence: 0.98,
                originalSnippet: parsed.originalSnippet || code.split('\n')[targetLine - 1] || '',
                fixedSnippet: parsed.fixedSnippet || parsed.fixedCode.split('\n')[targetLine - 1] || '',
                errors: errorList,
                commentedCode,
              };

              return NextResponse.json({
                success: true,
                provider: 'gemini',
                model: candidate.name,
                fix: fixResult,
              });
            }
          } catch (modelErr: any) {
            console.warn(`Model ${candidate.name} attempt failed:`, modelErr?.message);
          }
        }
      } catch (geminiError: any) {
        console.warn('Gemini API auto-fix attempt failed, falling back to offline engine:', geminiError?.message);
      }
    }

    // 2. High-Performance Multi-Pass Offline Engine Fallback
    const offlineFix = analyzeAndFixErrorOffline(code, stderr, languageId, diagnostics);
    return NextResponse.json({
      success: true,
      provider: 'offline',
      fix: offlineFix,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to process auto-fix request' },
      { status: 500 }
    );
  }
}
