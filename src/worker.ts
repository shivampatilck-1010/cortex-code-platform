import { ClassroomRoomDO } from './lib/classroom/durable-object';
import { ClassroomAuth, AuthenticatedClassroomUser } from './lib/classroom/auth';
// @ts-ignore
import vinextHandler from 'vinext/server/fetch-handler';

export { ClassroomRoomDO };

export interface Env {
  CLASSROOM_ROOM_DO: any;
  ASSETS?: any;
  CF_VERSION_METADATA?: any;
  [key: string]: any;
}

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    // Production Cloudflare WebSocket Path:
    // Browser -> WSS -> Cloudflare Worker (Auth & Membership Verification) -> ClassroomRoomDO (Durable Object)
    const isWebSocket = request.headers.get('Upgrade') === 'websocket';
    const isClassroomWs =
      url.pathname.includes('/classrooms/') ||
      url.pathname.includes('/classroom/') ||
      url.pathname.endsWith('/ws');

    if (isWebSocket && isClassroomWs && env.CLASSROOM_ROOM_DO) {
      // 1. Defend against spoofed internal headers from the browser
      const cleanHeaders = new Headers(request.headers);
      cleanHeaders.delete('x-cortex-internal-auth');

      // 2. Extract classroom ID
      const parts = url.pathname.split('/');
      const wsIdx = parts.indexOf('ws');
      let classroomId = 'C1-CS201-ADV';
      if (wsIdx > 0 && parts[wsIdx - 1]) {
        classroomId = parts[wsIdx - 1];
      } else if (url.searchParams.get('classroomId')) {
        classroomId = url.searchParams.get('classroomId')!;
      }
      classroomId = classroomId.toUpperCase().trim();

      // 3. Pre-upgrade Authentication: Authenticate user before WebSocket upgrade
      const user = ClassroomAuth.authenticateRequest(request);
      if (!user) {
        console.warn(`[Security Alert] Rejected unauthenticated WebSocket connection attempt to classroom ${classroomId}`);
        return new Response(
          JSON.stringify({
            error: 'Unauthorized',
            code: 'AUTH_REQUIRED',
            message: 'Authentication required. Please log in or provide valid credentials.',
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // 4. Server-Side Classroom Membership Verification
      const membership = ClassroomAuth.verifyClassroomMembership(user, classroomId);
      if (!membership.authorized) {
        const isNotFound = membership.error?.toLowerCase().includes('not found');
        const status = isNotFound ? 404 : 403;
        const code = isNotFound ? 'CLASSROOM_NOT_FOUND' : 'FORBIDDEN_NOT_MEMBER';
        console.warn(`[Security Alert] Rejected connection: user ${user.id} (${user.name}) is not authorized for classroom ${classroomId}. ${membership.error}`);
        return new Response(
          JSON.stringify({
            error: isNotFound ? 'Not Found' : 'Forbidden',
            code,
            message: membership.error || `Access denied: user ${user.id} is not an active member of classroom ${classroomId}.`,
          }),
          {
            status,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // 5. Establish authoritative, verified connection context
      const authContext: AuthenticatedClassroomUser = {
        userId: user.id,
        classroomId,
        role: membership.role!,
        displayName: user.name,
        email: user.email,
        authenticatedAt: Date.now(),
      };

      // 6. Sign internal context token for tamper-proof Worker -> DO handoff
      const internalAuthToken = ClassroomAuth.createInternalAuthToken(authContext);
      cleanHeaders.set('x-cortex-internal-auth', internalAuthToken);

      const internalReq = new Request(request.url, {
        method: request.method,
        headers: cleanHeaders,
        // @ts-ignore
        cf: (request as any).cf,
      });

      const doId = env.CLASSROOM_ROOM_DO.idFromName(classroomId);
      const stub = env.CLASSROOM_ROOM_DO.get(doId);
      return stub.fetch(internalReq);
    }

    // Delegate standard HTTP requests to Vinext/Next.js fetch handler
    try {
      const handler = (vinextHandler as any)?.t || vinextHandler?.default || vinextHandler;
      if (typeof handler?.fetch === 'function') {
        return handler.fetch(request, env, ctx);
      }
      if (typeof handler === 'function') {
        return handler(request, env, ctx);
      }
    } catch (err) {
      console.error('[Worker HTTP Handler Error]', err);
    }

    return new Response('Cortex Classroom Cloudflare Worker Ready', { status: 200 });
  },
};
