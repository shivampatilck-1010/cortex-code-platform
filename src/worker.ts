import { classroomDb } from './lib/classroom/db';
import { ClassroomRoomDO } from './lib/classroom/durable-object';
import { ClassroomAuth, AuthenticatedClassroomUser } from './lib/classroom/auth';
import { executeInCloudRunner } from './lib/execution/cloud-runner';
import { arenaDb } from './lib/arena/db';
import { projectDb } from './lib/project/db';
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
  async queue(batch: any, env: Env): Promise<void> {
    (globalThis as any).env = env;
    for (const msg of batch.messages) {
      const { jobId, userId, benchmarkId, runType, langA, langB, workspaceAProjectId, workspaceBProjectId } = msg.body;
      try {
        const serverFilesA = runType === 'A' || runType === 'BOTH' ? await projectDb.listFilesForProject(workspaceAProjectId) : [];
        const serverFilesB = runType === 'B' || runType === 'BOTH' ? await projectDb.listFilesForProject(workspaceBProjectId) : [];

        let resultA: any = null;
        let resultB: any = null;

        if (runType === 'A' || runType === 'BOTH') {
          if (serverFilesA.length > 0) {
            resultA = await executeInCloudRunner({ language: langA, files: serverFilesA, runTimeoutMs: 5000, memoryLimitMb: 256 });
          }
        }

        if (runType === 'B' || runType === 'BOTH') {
          if (serverFilesB.length > 0) {
            resultB = await executeInCloudRunner({ language: langB, files: serverFilesB, runTimeoutMs: 5000, memoryLimitMb: 256 });
          }
        }

        if (runType === 'BOTH' && resultA && resultB) {
          await arenaDb.createBenchmarkRun({
            id: `brun_${crypto.randomUUID()}`,
            userId,
            benchmarkId,
            langA,
            langB,
            timeMsA: resultA.executionTimeMs || 0,
            timeMsB: resultB.executionTimeMs || 0,
            memoryMbA: resultA.memoryUsageMb || 0,
            memoryMbB: resultB.memoryUsageMb || 0,
            statusA: resultA.status || 'unknown',
            statusB: resultB.status || 'unknown',
            createdAt: Date.now()
          });
        }
        msg.ack();
      } catch (e) {
        console.error('Queue job failed', e);
        msg.retry();
      }
    }
  },

  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    // Inject env globally so database wrappers can find D1 bindings
    (globalThis as any).env = env;
    const url = new URL(request.url);

    // High-performance Cloudflare Edge streaming for unified finalcortex.mp4 (supporting HTTP 206 Partial Content)
    if ((url.pathname === '/videos/finalcortex.mp4' || url.pathname === '/videos/finalcortex') && env.ASSETS) {
      const TOTAL_SIZE = 32245720;
      const SPLIT_POINT = 16777216; // 16 MiB boundary

      if (request.method === 'HEAD') {
        return new Response(null, {
          status: 200,
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': String(TOTAL_SIZE),
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      }

      if (request.method === 'GET') {
        const rangeHeader = request.headers.get('Range');
        let start = 0;
        let end = TOTAL_SIZE - 1;
        let isRange = false;

        if (rangeHeader && rangeHeader.startsWith('bytes=')) {
          isRange = true;
          const parts = rangeHeader.replace('bytes=', '').split('-');
          if (parts[0]) start = parseInt(parts[0], 10);
          if (parts[1]) end = parseInt(parts[1], 10);
          if (isNaN(start)) start = 0;
          if (isNaN(end) || end >= TOTAL_SIZE) end = TOTAL_SIZE - 1;
        }

        if (start >= TOTAL_SIZE || start > end) {
          return new Response(null, {
            status: 416,
            headers: {
              'Content-Range': `bytes */${TOTAL_SIZE}`,
            },
          });
        }

        const contentLength = end - start + 1;

        // Sub-range within part 0
        if (end < SPLIT_POINT) {
          const req0 = new Request(new URL('/videos/finalcortex.part0.mp4', request.url), {
            headers: { Range: `bytes=${start}-${end}` },
          });
          const res0 = await env.ASSETS.fetch(req0);
          return new Response(res0.body, {
            status: isRange ? 206 : 200,
            headers: {
              'Content-Type': 'video/mp4',
              'Content-Range': `bytes ${start}-${end}/${TOTAL_SIZE}`,
              'Content-Length': String(contentLength),
              'Accept-Ranges': 'bytes',
              'Cache-Control': 'public, max-age=31536000, immutable',
            },
          });
        }

        // Sub-range within part 1
        if (start >= SPLIT_POINT) {
          const p1Start = start - SPLIT_POINT;
          const p1End = end - SPLIT_POINT;
          const req1 = new Request(new URL('/videos/finalcortex.part1.mp4', request.url), {
            headers: { Range: `bytes=${p1Start}-${p1End}` },
          });
          const res1 = await env.ASSETS.fetch(req1);
          return new Response(res1.body, {
            status: isRange ? 206 : 200,
            headers: {
              'Content-Type': 'video/mp4',
              'Content-Range': `bytes ${start}-${end}/${TOTAL_SIZE}`,
              'Content-Length': String(contentLength),
              'Accept-Ranges': 'bytes',
              'Cache-Control': 'public, max-age=31536000, immutable',
            },
          });
        }

        // Range spanning both part 0 and part 1
        const req0 = new Request(new URL('/videos/finalcortex.part0.mp4', request.url), {
          headers: { Range: `bytes=${start}-${SPLIT_POINT - 1}` },
        });
        const req1 = new Request(new URL('/videos/finalcortex.part1.mp4', request.url), {
          headers: { Range: `bytes=0-${end - SPLIT_POINT}` },
        });
        const [res0, res1] = await Promise.all([env.ASSETS.fetch(req0), env.ASSETS.fetch(req1)]);
        const { readable, writable } = new TransformStream();
        (async () => {
          try {
            if (res0.body) await res0.body.pipeTo(writable, { preventClose: true });
            if (res1.body) await res1.body.pipeTo(writable);
          } catch (e) {
            console.error('Video range stream pipe error:', e);
          }
        })();

        return new Response(readable, {
          status: isRange ? 206 : 200,
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Range': `bytes ${start}-${end}/${TOTAL_SIZE}`,
            'Content-Length': String(contentLength),
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      }
    }

    // Production Cloudflare WebSocket Path:
    // Browser -> WSS -> Cloudflare Worker (Auth & Membership Verification) -> ClassroomRoomDO (Durable Object)
    const isWebSocket = request.headers.get('Upgrade') === 'websocket';
    const isEnterpriseClassroomWs =
      url.pathname.endsWith('/ws') ||
      (url.pathname.includes('/classrooms/') && !url.pathname.includes('/events'));

    if (isWebSocket && isEnterpriseClassroomWs && env.CLASSROOM_ROOM_DO) {
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
      let user = await ClassroomAuth.authenticateRequest(request);
      if (!user) {
        const token = url.searchParams.get('token') || url.searchParams.get('joinToken');
        if (token) {
          const verified = ClassroomAuth.verifyLiveSessionToken(token, { expectedClassroomId: classroomId });
          if (verified) {
            user = await classroomDb.getUser(verified.userId);
          }
        }
      }
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
      const membership = await ClassroomAuth.verifyClassroomMembership(user, classroomId);
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
