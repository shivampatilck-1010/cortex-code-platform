import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';

export async function POST(req: NextRequest) {
  try {
    const sessCookie = typeof req.cookies.get === 'function' ? req.cookies.get('cortex_session')?.value : (req.cookies as any).cortex_session;
    
    if (sessCookie) {
      await classroomDb.deleteSession(sessCookie);
    }

    const response = NextResponse.json({ success: true });
    
    response.cookies.set({
      name: 'cortex_session',
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: new Date(0),
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
