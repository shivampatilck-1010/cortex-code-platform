import { NextRequest } from 'next/server';
import { User, ClassroomMemberRole } from './models';
import { classroomDb } from './db';

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
    // Basic base64 payload for DO internal auth. In production, sign this securely.
    return Buffer.from(JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
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
   * Hashes a password using PBKDF2 (SHA-256).
   */
  static async hashPassword(password: string, saltHex?: string): Promise<string> {
    const enc = new TextEncoder();
    let salt: Uint8Array;
    if (saltHex) {
      salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    } else {
      salt = crypto.getRandomValues(new Uint8Array(16));
    }
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits', 'deriveKey']
    );
    
    const hashBuffer = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      256
    );
    
    const saltStr = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    const hashStr = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    
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
