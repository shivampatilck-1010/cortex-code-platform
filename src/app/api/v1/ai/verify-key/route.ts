import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiKey = (body.apiKey || '').trim();

    if (!apiKey) {
      return NextResponse.json(
        { valid: false, error: 'API key is required' },
        { status: 400 }
      );
    }

    // Validate key against Google Generative Language API
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.ok) {
      const data = await res.json();
      const hasModels = Array.isArray(data.models) && data.models.length > 0;
      return NextResponse.json({
        valid: true,
        message: 'Your auto fix is connected and good to go!',
        modelsCount: hasModels ? data.models.length : 0,
      });
    }

    const errData = await res.json().catch(() => ({}));
    const errMsg = errData.error?.message || 'Invalid Gemini API key or unauthorized.';
    return NextResponse.json(
      { valid: false, error: errMsg },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { valid: false, error: err?.message || 'Validation network request failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const envKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  return NextResponse.json({
    hasDefaultKey: !!envKey,
  });
}
