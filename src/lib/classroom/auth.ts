import { NextRequest } from 'next/server';
import { User, ClassroomMemberRole } from './models';
import { classroomDb } from './db';
import { createHmac, timingSafeEqual } from 'crypto';

export type ClassroomRole = 'student' | 'teacher' | 'admin';

export interface AuthenticatedClassroomUser {
  userId: string;
  classroomId: string;
  role: ClassroomRole;
  displayName: string;
  email: string;
  authenticatedAt: number;
}

export interface AuthContext {
  user: User;
  classroomId?: string;
  membership?: {
    role: ClassroomMemberRole;
    status: 'active' | 'dropped' | 'suspended';
  };
  isTeacher: boolean;
  isAdmin: boolean;
}

export class ClassroomAuth {

  /**
   * Internal Auth token creation for Worker -> Durable Object communication.
   */
  static createInternalAuthToken(user: any): string {
    const id = user.userId || user.id;
    const name = user.displayName || user.name;
    return Buffer.from(JSON.stringify({
      id,
      userId: id,
      name,
      displayName: name,
      email: user.email,
      role: user.role,
      classroomId: user.classroomId,
      cortex_id: user.cortex_id
    })).toString('base64');
  }

  static verifyInternalAuthToken(token: string): any {
    try {
      return JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    } catch {
      return null;
    }
  }

  /**
   * Resolves the server-side signing secret.
   * In production, requires CORTEX_SESSION_SECRET with >= 32 characters, otherwise fails closed.
   * In non-production, provides an explicit development fallback.
   */
  static getLiveSessionSigningSecret(): string {
    const secret =
      process.env.CORTEX_SESSION_SECRET ||
      (typeof globalThis !== 'undefined' && (globalThis as any).env?.CORTEX_SESSION_SECRET) ||
      process.env.CORTEX_INTERNAL_AUTH_SECRET ||
      (typeof globalThis !== 'undefined' && (globalThis as any).env?.CORTEX_INTERNAL_AUTH_SECRET);
    const isProd = process.env.NODE_ENV === 'production';

    if (isProd) {
      if (!secret || typeof secret !== 'string' || secret.trim().length < 32) {
        throw new Error('[ClassroomAuth] FATAL: Production environment requires CORTEX_SESSION_SECRET of at least 32 characters.');
      }
      return secret.trim();
    }

    if (secret && typeof secret === 'string' && secret.trim().length >= 32) {
      return secret.trim();
    }

    // Explicit development-only secret
    return 'dev-cortex-live-session-insecure-secret-key-32chars';
  }

  /**
   * Creates an ephemeral tamper-evident HMAC-SHA256 signed token for live classroom WebSocket signaling.
   * Does NOT expose database session credentials or user secrets.
   */
  static createLiveSessionToken(payload: {
    userId: string;
    userName: string;
    userEmail: string;
    classroomId: string;
    role: 'teacher' | 'student';
    durationMs?: number;
  }): string {
    if (!payload.userId || typeof payload.userId !== 'string' || !payload.userId.trim()) {
      throw new Error('createLiveSessionToken: userId must be a non-empty string');
    }
    if (!payload.classroomId || typeof payload.classroomId !== 'string' || !payload.classroomId.trim()) {
      throw new Error('createLiveSessionToken: classroomId must be a non-empty string');
    }
    if (payload.role !== 'teacher' && payload.role !== 'student') {
      throw new Error('createLiveSessionToken: role must be either "teacher" or "student"');
    }

    const issuedAt = Date.now();
    const defaultDuration = 1000 * 60 * 60; // 1 hour default
    const requestedDuration = typeof payload.durationMs === 'number' && !isNaN(payload.durationMs) && payload.durationMs > 0
      ? payload.durationMs
      : defaultDuration;
    const maxDuration = 1000 * 60 * 60 * 24; // 24 hours max
    const duration = Math.min(requestedDuration, maxDuration);
    const expiresAt = issuedAt + duration;

    const data = {
      sub: payload.userId.trim(),
      name: (payload.userName || 'User').trim(),
      email: (payload.userEmail || '').trim(),
      cid: payload.classroomId.toUpperCase().trim(),
      role: payload.role,
      iat: issuedAt,
      exp: expiresAt,
    };
    const encodedData = Buffer.from(JSON.stringify(data)).toString('base64url');
    const secret = this.getLiveSessionSigningSecret();
    const signature = createHmac('sha256', secret).update(encodedData).digest('base64url');
    return `${encodedData}.${signature}`;
  }

  /**
   * Verifies an ephemeral live classroom signaling token with comprehensive claim hardening.
   * Optional expectedClassroomId and expectedUserId enforce strict context binding.
   */
  static verifyLiveSessionToken(
    token: string,
    options?: { expectedClassroomId?: string; expectedUserId?: string }
  ): {
    userId: string;
    userName: string;
    userEmail: string;
    classroomId: string;
    role: 'teacher' | 'student';
    issuedAt: number;
    expiresAt: number;
  } | null {
    if (!token || typeof token !== 'string' || !token.includes('.')) {
      return null;
    }
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encodedData, signature] = parts;
    if (!encodedData || !signature) return null;

    try {
      const secret = this.getLiveSessionSigningSecret();
      const expectedSignature = createHmac('sha256', secret).update(encodedData).digest('base64url');

      const sigBuf = Buffer.from(signature, 'utf8');
      const expBuf = Buffer.from(expectedSignature, 'utf8');
      if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
        return null;
      }

      const rawJson = Buffer.from(encodedData, 'base64url').toString('utf8');
      const data = JSON.parse(rawJson);

      // Verify payload structure is an object
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return null;
      }

      // 1. Validate sub (userId)
      if (typeof data.sub !== 'string' || !data.sub.trim()) {
        return null;
      }
      if (options?.expectedUserId && data.sub !== options.expectedUserId) {
        return null;
      }

      // 2. Validate cid (classroomId)
      if (typeof data.cid !== 'string' || !data.cid.trim()) {
        return null;
      }
      if (options?.expectedClassroomId && data.cid.toUpperCase().trim() !== options.expectedClassroomId.toUpperCase().trim()) {
        return null;
      }

      // 3. Validate role enumeration
      if (data.role !== 'teacher' && data.role !== 'student') {
        return null;
      }

      // 4. Validate timestamps (finite numbers)
      if (typeof data.iat !== 'number' || isNaN(data.iat) || !isFinite(data.iat)) {
        return null;
      }
      if (typeof data.exp !== 'number' || isNaN(data.exp) || !isFinite(data.exp)) {
        return null;
      }

      const now = Date.now();
      const maxClockSkewMs = 60 * 1000; // 60 seconds tolerance

      // 5. Future issuance check
      if (data.iat > now + maxClockSkewMs) {
        return null; // Issued too far in future
      }

      // 6. Expiration ordering
      if (data.exp <= data.iat) {
        return null;
      }

      // 7. Max lifetime cap (24 hours)
      const maxLifetimeMs = 1000 * 60 * 60 * 24;
      if (data.exp - data.iat > maxLifetimeMs) {
        return null;
      }

      // 8. Enforce current expiration
      if (now > data.exp) {
        return null;
      }

      return {
        userId: data.sub,
        userName: typeof data.name === 'string' ? data.name : '',
        userEmail: typeof data.email === 'string' ? data.email : '',
        classroomId: data.cid,
        role: data.role,
        issuedAt: data.iat,
        expiresAt: data.exp,
      };
    } catch {
      return null;
    }
  }

    static async hashPassword(password: string, saltHex?: string): Promise<string> {
    const enc = new TextEncoder();
    let salt: Uint8Array;
    if (saltHex) {
      salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    } else {
      salt = crypto.getRandomValues((new Uint8Array(16) as unknown as Uint8Array) as unknown as Uint8Array);
    }
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(password).buffer as ArrayBuffer, { name: 'PBKDF2' }, false, ['deriveBits', 'deriveKey']
    );
    
    const hashBuffer = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      256
    );
    
    const saltStr = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    const hashStr = Array.from(new Uint8Array(hashBuffer as any)).map(b => b.toString(16).padStart(2, '0')).join('');
    
    return `${saltStr}:${hashStr}`;
  }

  /**
   * Verifies a password against a PBKDF2 hash.
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    if (!hash || !hash.includes(':')) return false;
    const [saltHex] = hash.split(':');
    const attempt = await this.hashPassword(password, saltHex);
    return attempt === hash;
  }

  /**
   * Generates a cryptographically secure random token.
   */
  static generateSecureToken(length: number = 32): string {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Authenticates a request STRICTLY by validating the cortex_session cookie
   * against the database 'sessions' table.
   * Discards all spoofable headers (x-user-id, query params, etc.)
   */
  static async authenticateRequest(req: NextRequest | any): Promise<User | null> {
    let cookieHeader = '';
    
    if (typeof req.headers?.get === 'function') {
      cookieHeader = req.headers.get('cookie') || '';
    } else if (req.headers?.cookie) {
      cookieHeader = req.headers.cookie;
    }
    
    let sessionId = null;
    
    if (req.cookies) {
      const sessCookie = typeof req.cookies.get === 'function' ? req.cookies.get('cortex_session')?.value : req.cookies.cortex_session;
      if (sessCookie) sessionId = sessCookie;
    }

    if (!sessionId && cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split(';').map((c: string) => {
          const parts = c.trim().split('=');
          const k = parts.shift();
          return [k, decodeURIComponent(parts.join('='))];
        })
      );
      if (cookies.cortex_session) {
        sessionId = cookies.cortex_session;
      }
    }

    if (!sessionId) {
      return null; // No session cookie
    }

    // Lookup session securely in DB
    const session = await classroomDb.getSession(sessionId);
    if (!session) {
      return null;
    }

    if (Date.now() > session.expires_at) {
      await classroomDb.deleteSession(sessionId);
      return null;
    }

    // Lookup user
    const user = await classroomDb.getUser(session.user_id);
    if (!user || user.status !== 'active') {
      return null;
    }

    return user;
  }

  static async getCurrentUser(req: NextRequest | any): Promise<User> {
    const user = await this.authenticateRequest(req);
    if (!user) {
      throw new Error('Authentication required: user not logged in or invalid credentials');
    }
    return user;
  }

  static async verifyClassroomMembership(user: User, classroomId: string): Promise<{ authorized: boolean; role?: ClassroomRole; error?: string }> {
    if (!user || !user.id) {
      return { authorized: false, error: 'Authentication required' };
    }
    if (!classroomId || typeof classroomId !== 'string') {
      return { authorized: false, error: 'Missing or invalid classroomId' };
    }

    const normClassroomId = classroomId.toUpperCase().trim();
    const classroom = (await classroomDb.getClassroom(normClassroomId)) || (await classroomDb.getClassroom(classroomId));
    if (!classroom) {
      return { authorized: false, error: `Classroom '${normClassroomId}' not found` };
    }

    if (user.role === 'admin') {
      return { authorized: true, role: 'admin' };
    }

    // Teacher access is strictly per-classroom: must be the designated owner OR have a teacher membership record.
    if (classroom.teacherId === user.id) {
      return { authorized: true, role: 'teacher' };
    }

    const member = (await classroomDb.getMember(normClassroomId, user.id)) || (await classroomDb.getMember(classroomId, user.id));
    if (!member) {
      return {
        authorized: false,
        error: `User '${user.id}' is not a member of classroom '${normClassroomId}'`,
      };
    }

    // Server-side suspension check (includes expiry evaluation)
    if (member.status === 'suspended') {
      const expiresAt = (member as any).suspensionExpiresAt;
      const isExpired = expiresAt && Date.now() >= expiresAt;
      if (!isExpired) {
        return {
          authorized: false,
          error: 'Your access to this classroom has been suspended.',
        };
      }
      // Suspension expired - treat as active (DB will be updated lazily)
    }

    if (member.status !== 'active' && member.status !== 'suspended') {
      return {
        authorized: false,
        error: `User '${user.id}' is not an active member of classroom '${normClassroomId}'`,
      };
    }

    const derivedRole: ClassroomRole = member.role === 'teacher' ? 'teacher' : 'student';
    return { authorized: true, role: derivedRole };
  }

  static async verifyAccess(
    req: NextRequest | any,
    classroomId?: string,
    requiredRole?: 'teacher' | 'student' | 'admin'
  ): Promise<{ authorized: boolean; error?: string; context?: AuthContext }> {
    const user = await this.authenticateRequest(req);
    if (!user) {
      return { authorized: false, error: 'Authentication required. Please log in.' };
    }

    const isAdmin = user.role === 'admin';
    let membership: any = undefined;
    let isTeacher = false;

    if (isAdmin) {
      isTeacher = true;
    } else if (classroomId) {
      const membershipCheck = await this.verifyClassroomMembership(user, classroomId);
      if (!membershipCheck.authorized) {
        return { authorized: false, error: membershipCheck.error || 'Access denied' };
      }
      isTeacher = membershipCheck.role === 'teacher' || membershipCheck.role === 'admin';
      const mem = (await classroomDb.getMember(classroomId.toUpperCase().trim(), user.id)) || (await classroomDb.getMember(classroomId, user.id));
      if (mem && mem.status === 'active') {
        membership = {
          role: mem.role,
          status: mem.status,
        };
      }
    } else {
      isTeacher = user.role === 'teacher';
    }

    if (requiredRole === 'teacher' && !isTeacher) {
      return {
        authorized: false,
        error: 'Teacher privileges required for this action.',
      };
    }

    if (requiredRole === 'admin' && !isAdmin) {
      return {
        authorized: false,
        error: 'Administrator privileges required.',
      };
    }

    return {
      authorized: true,
      context: {
        user,
        classroomId,
        membership,
        isTeacher,
        isAdmin,
      },
    };
  }
}
