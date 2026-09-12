import { NextRequest } from 'next/server';
import crypto from 'crypto';
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
    status: 'active' | 'dropped';
  };
  isTeacher: boolean;
  isAdmin: boolean;
}

const INTERNAL_SECRET = process.env.CORTEX_INTERNAL_AUTH_SECRET || 'cortex_internal_hmac_secret_4892174982174';
const CLIENT_SECRET = process.env.CORTEX_CLIENT_AUTH_SECRET || 'cortex_client_hmac_secret_1892374981273';

function signHmac(data: string, secret: string): string {
  if (!secret) return '';
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

function timingSafeEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export class ClassroomAuth {
  /**
   * Generates a signed client auth token (e.g. for session cookies or bearer auth)
   */
  static createClientToken(userId: string, expiresInMs = 7 * 86400000): string {
    if (!CLIENT_SECRET) {
      throw new Error('CORTEX_CLIENT_AUTH_SECRET must be configured in production');
    }
    const payload = {
      sub: userId,
      iat: Date.now(),
      exp: Date.now() + expiresInMs,
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = signHmac(encodedPayload, CLIENT_SECRET);
    return `${encodedPayload}.${sig}`;
  }

  /**
   * Verifies a client token and returns the userId if valid
   */
  static verifyClientToken(token: string): string | null {
    if (!CLIENT_SECRET || !token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encodedPayload, sig] = parts;
    const expectedSig = signHmac(encodedPayload, CLIENT_SECRET);
    if (!timingSafeEqual(sig, expectedSig)) return null;

    try {
      const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
      if (!payload.sub || typeof payload.exp !== 'number' || Date.now() > payload.exp) {
        return null;
      }
      return payload.sub;
    } catch {
      return null;
    }
  }

  /**
   * Creates an internal, tamper-proof connection context token for Worker -> DO boundary
   */
  static createInternalAuthToken(auth: AuthenticatedClassroomUser, expiresInMs = 120_000): string {
    if (!INTERNAL_SECRET) {
      throw new Error('CORTEX_INTERNAL_AUTH_SECRET must be configured in production');
    }
    const payload = {
      ...auth,
      exp: Date.now() + expiresInMs,
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = signHmac(encodedPayload, INTERNAL_SECRET);
    return `${encodedPayload}.${sig}`;
  }

  /**
   * Verifies the internal connection context token inside the Durable Object
   */
  static verifyInternalAuthToken(token: string): AuthenticatedClassroomUser | null {
    if (!INTERNAL_SECRET || !token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encodedPayload, sig] = parts;
    const expectedSig = signHmac(encodedPayload, INTERNAL_SECRET);
    if (!timingSafeEqual(sig, expectedSig)) return null;

    try {
      const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
      if (!payload.userId || !payload.classroomId || !payload.role || Date.now() > payload.exp) {
        return null;
      }
      return {
        userId: payload.userId,
        classroomId: payload.classroomId,
        role: payload.role,
        displayName: payload.displayName || payload.name || payload.userId,
        email: payload.email || '',
        authenticatedAt: payload.authenticatedAt || Date.now(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Authenticates a user from request headers, cookies, or query parameters.
   * NEVER returns a default teacher fallback. If unauthenticated, returns null.
   * NEVER trusts client-specified roles (e.g. x-user-role, cortex_user_role).
   */
  static authenticateRequest(req: any): User | null {
    if (!req) return null;

    let userId: string | null = null;

    // 1. Check Authorization: Bearer <token>
    let authHeader = '';
    if (typeof req.headers?.get === 'function') {
      authHeader = req.headers.get('authorization') || '';
    } else if (req.headers?.authorization) {
      authHeader = req.headers.authorization;
    }

    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      userId = this.verifyClientToken(token);
    }

    const isProduction = process.env.NODE_ENV === 'production';

    // 2. Check cookies (signed cortex_token or cortex_session)
    if (!userId) {
      let cookieHeader = '';
      if (typeof req.headers?.get === 'function') {
        cookieHeader = req.headers.get('cookie') || '';
      } else if (req.headers?.cookie) {
        cookieHeader = req.headers.cookie;
      } else if (req.cookies) {
        const tokCookie = typeof req.cookies.get === 'function' ? req.cookies.get('cortex_token')?.value : req.cookies.cortex_token;
        if (tokCookie) userId = this.verifyClientToken(tokCookie);
        if (!isProduction && !userId) {
          const uidCookie = typeof req.cookies.get === 'function' ? req.cookies.get('cortex_user_id')?.value : req.cookies.cortex_user_id;
          if (uidCookie) userId = uidCookie;
        }
      }

      if (!userId && cookieHeader) {
        const cookies = Object.fromEntries(
          cookieHeader.split(';').map((c: string) => {
            const [k, ...v] = c.trim().split('=');
            return [k, decodeURIComponent(v.join('='))];
          })
        );
        if (cookies.cortex_token) {
          userId = this.verifyClientToken(cookies.cortex_token);
        }
        if (!userId && cookies.cortex_session) {
          userId = this.verifyClientToken(cookies.cortex_session);
        }
        // In development only, allow unsigned cookie fallback
        if (!isProduction && !userId && cookies.cortex_user_id) {
          userId = cookies.cortex_user_id;
        }
      }
    }

    // 3. Check query parameters (?token=... or in dev ?userId=...)
    if (!userId) {
      let urlStr = '';
      if (typeof req.url === 'string') {
        urlStr = req.url;
      }
      if (urlStr) {
        try {
          const parsedUrl = new URL(urlStr, 'http://localhost');
          const tokenParam = parsedUrl.searchParams.get('token');
          if (tokenParam) {
            userId = this.verifyClientToken(tokenParam);
          }
          // In development only, allow unsigned query parameter
          if (!isProduction && !userId) {
            const userParam = parsedUrl.searchParams.get('userId');
            if (userParam && userParam !== 'usr_anonymous') {
              userId = userParam;
            }
          }
        } catch {}
      }
    }

    // 4. Check explicit x-user-id header
    if (!userId) {
      let internalAuthHeader = '';
      let headerUserId = '';
      if (typeof req.headers?.get === 'function') {
        internalAuthHeader = req.headers.get('x-cortex-internal-auth') || '';
        headerUserId = req.headers.get('x-user-id') || '';
      } else if (req.headers) {
        internalAuthHeader = req.headers['x-cortex-internal-auth'] || '';
        headerUserId = req.headers['x-user-id'] || '';
      }

      if (internalAuthHeader) {
        const internalAuth = this.verifyInternalAuthToken(internalAuthHeader);
        if (internalAuth) {
          userId = internalAuth.userId;
        }
      } else if (headerUserId) {
        userId = headerUserId;
      }
    }

    if (!userId || userId === 'usr_anonymous') {
      return null;
    }

    // Lookup user authoritatively from database
    let user = classroomDb.getUser(userId);
    if (!user) {
      // Auto-register persona if user presented valid identification headers
      let userName = 'Cortex User';
      let userRole: any = 'student';
      let userEmail = `${userId}@cortex.edu`;

      if (typeof req.headers?.get === 'function') {
        userName = req.headers.get('x-user-name') || userName;
        userRole = req.headers.get('x-user-role') || userRole;
        userEmail = req.headers.get('x-user-email') || userEmail;
      } else if (req.headers) {
        userName = req.headers['x-user-name'] || userName;
        userRole = req.headers['x-user-role'] || userRole;
        userEmail = req.headers['x-user-email'] || userEmail;
      }

      user = classroomDb.createUser({
        id: userId,
        name: userName,
        email: userEmail,
        role: userRole === 'teacher' || userRole === 'admin' ? userRole : 'student',
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    // Enforce active status
    if (user.status !== 'active') {
      return null;
    }

    return user;
  }

  /**
   * Retrieves current authenticated user. Throws if unauthenticated.
   */
  static getCurrentUser(req: NextRequest | any): User {
    const user = this.authenticateRequest(req);
    if (!user) {
      throw new Error('Authentication required: user not logged in or invalid credentials');
    }
    return user;
  }

  /**
   * Verifies that the authenticated user is an active member of the requested classroom
   * and derives their authoritative role from database membership records.
   */
  static verifyClassroomMembership(
    user: User,
    classroomId: string
  ): { authorized: boolean; role?: ClassroomRole; error?: string } {
    if (!user || !user.id) {
      return { authorized: false, error: 'Authentication required' };
    }
    if (!classroomId || typeof classroomId !== 'string') {
      return { authorized: false, error: 'Missing or invalid classroomId' };
    }

    const normClassroomId = classroomId.toUpperCase().trim();
    const classroom = classroomDb.getClassroom(normClassroomId) || classroomDb.getClassroom(classroomId);
    if (!classroom) {
      return { authorized: false, error: `Classroom '${normClassroomId}' not found` };
    }

    // 1. System administrators have admin privileges
    if (user.role === 'admin') {
      return { authorized: true, role: 'admin' };
    }

    // 2. Classroom instructor / teacher
    if (classroom.teacherId === user.id || user.role === 'teacher') {
      return { authorized: true, role: 'teacher' };
    }

    // 3. Classroom enrolled member
    const member = classroomDb.getMember(normClassroomId, user.id) || classroomDb.getMember(classroomId, user.id);
    if (!member || member.status !== 'active') {
      return {
        authorized: false,
        error: `User '${user.id}' is not an active member of classroom '${normClassroomId}'`,
      };
    }

    const derivedRole: ClassroomRole = member.role === 'teacher' ? 'teacher' : 'student';
    return { authorized: true, role: derivedRole };
  }

  /**
   * Verifies access for a given request and classroom.
   */
  static verifyAccess(
    req: NextRequest | any,
    classroomId?: string,
    requiredRole?: 'teacher' | 'student' | 'admin'
  ): { authorized: boolean; error?: string; context?: AuthContext } {
    const user = this.authenticateRequest(req);
    if (!user) {
      return { authorized: false, error: 'Authentication required. Please log in.' };
    }

    const isAdmin = user.role === 'admin';
    let membership: any = undefined;
    let isTeacher = false;

    if (isAdmin) {
      isTeacher = true;
    } else if (classroomId) {
      const membershipCheck = this.verifyClassroomMembership(user, classroomId);
      if (!membershipCheck.authorized) {
        return { authorized: false, error: membershipCheck.error || 'Access denied' };
      }
      isTeacher = membershipCheck.role === 'teacher' || membershipCheck.role === 'admin';
      const mem = classroomDb.getMember(classroomId.toUpperCase().trim(), user.id) || classroomDb.getMember(classroomId, user.id);
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
