import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { User } from '@/lib/classroom/models';
import { rateLimiter } from '@/lib/classroom/rate-limiter';
import { createLogger } from '@/lib/classroom/logger';

export async function POST(req: NextRequest) {
  const logger = createLogger(req.headers.get('x-request-id') || undefined, {
    eventType: 'auth_login',
  });

  try {
    const isProd = process.env.NODE_ENV === 'production';
    const clientIp =
      req.headers.get('cf-connecting-ip') ||
      (!isProd ? req.headers.get('x-forwarded-for')?.split(',')[0].trim() : null) ||
      '127.0.0.1';

    // 1. IP-level distributed rate limiting (max 20 requests per minute)
    const ipCheck = await rateLimiter.checkDistributed(`ip:${clientIp}`, 20, 60000);
    if (!ipCheck.allowed) {
      logger.warn('Login rate limit exceeded for IP', { clientIp, retryAfterSec: ipCheck.retryAfterSec });
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(ipCheck.retryAfterSec),
          },
        }
      );
    }

    const body = await req.json();
    const { identifier, password } = body;

    if (!identifier || !password) {
      return NextResponse.json({ error: 'Identifier and password are required' }, { status: 400 });
    }

    const normalizedIdentifier = identifier.trim().toLowerCase();
    const compoundLockoutKey = `lockout:${clientIp}:${normalizedIdentifier}`;
    const userGlobalKey = `user:${normalizedIdentifier}`;

    // 2. Compound IP+Account brute force protection check (distributed)
    const clientUserCheck = await rateLimiter.checkDistributed(compoundLockoutKey, 5, 60000);
    if (!clientUserCheck.allowed) {
      logger.warn('Client IP locked out for specific account due to repeated failures', { clientIp, identifier: normalizedIdentifier });
      return NextResponse.json(
        { error: 'Too many failed login attempts from this network. Please wait before retrying.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(clientUserCheck.retryAfterSec),
          },
        }
      );
    }

    // 3. Global account throttle: If distributed failures detected on account, apply delay
    const globalCheck = rateLimiter.check(userGlobalKey, 10, 60000);
    if (!globalCheck.allowed) {
      // Delay response by 500ms to throttle distributed dictionary attacks without hard DOS on valid credentials
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    let user: User | null = null;

    if (normalizedIdentifier.includes('@')) {
      user = await classroomDb.getUserByEmail(normalizedIdentifier);
      if (!user) {
        user = await classroomDb.getUserByProfessionalEmail(normalizedIdentifier);
      }
    } else {
      user = await classroomDb.getUserByCortexId(normalizedIdentifier.toUpperCase());
    }

    // Static dummy password hash for timing equalization against account enumeration
    const DUMMY_HASH = 'a9258dc34ae07539764ec2d785e1b85a:2fc8f4d170448434df3aa11dfb0679765ae86388b3629a6a00a85d02c0b21d94';

    if (!user || user.status !== 'active' || !user.password_hash) {
      // Execute dummy password verification to equalize response timing (~16ms)
      await ClassroomAuth.verifyPassword('dummyTimingPassword#123', DUMMY_HASH);
      rateLimiter.recordAuthFailure(compoundLockoutKey);
      rateLimiter.recordAuthFailure(userGlobalKey);
      rateLimiter.recordAuthFailure(`ip:${clientIp}`);
      logger.warn('Authentication failed: user not found or inactive', { clientIp });
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const isValid = await ClassroomAuth.verifyPassword(password, user.password_hash);
    if (!isValid) {
      const lockStatus = rateLimiter.recordAuthFailure(compoundLockoutKey);
      rateLimiter.recordAuthFailure(userGlobalKey);
      rateLimiter.recordAuthFailure(`ip:${clientIp}`);
      logger.warn('Authentication failed: invalid password', { userId: user.id, clientIp, locked: lockStatus.locked });
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Reset failure counters upon successful authentication
    rateLimiter.recordAuthSuccess(compoundLockoutKey);
    rateLimiter.recordAuthSuccess(userGlobalKey);
    rateLimiter.recordAuthSuccess(`ip:${clientIp}`);

    const sessionId = ClassroomAuth.generateSecureToken(32);
    const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 days
    await classroomDb.createSession(sessionId, user.id, expiresAt);

    logger.info('User successfully authenticated', { userId: user.id, role: user.role });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        cortexId: user.cortex_id,
        professionalEmail: (user as any).professional_email || (user as any).professionalEmail,
      },
    });

    response.headers.append(
      'Set-Cookie',
      'cortex_session=' +
        sessionId +
        '; HttpOnly; Secure; SameSite=Lax; Path=/; Expires=' +
        new Date(expiresAt).toUTCString()
    );

    return response;
  } catch (err: any) {
    logger.error('Unexpected login exception', { error: err.message });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
