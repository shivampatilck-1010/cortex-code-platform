import { ClassroomRoomDO } from './lib/classroom/durable-object';

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
    // Browser -> WSS -> Cloudflare Worker -> ClassroomRoomDO (Durable Object)
    const isWebSocket = request.headers.get('Upgrade') === 'websocket';
    const isClassroomWs =
      url.pathname.includes('/classrooms/') ||
      url.pathname.includes('/classroom/') ||
      url.pathname.endsWith('/ws');

    if (isWebSocket && isClassroomWs && env.CLASSROOM_ROOM_DO) {
      const parts = url.pathname.split('/');
      const wsIdx = parts.indexOf('ws');
      let classroomId = 'C1-CS201-ADV';
      if (wsIdx > 0 && parts[wsIdx - 1]) {
        classroomId = parts[wsIdx - 1];
      } else if (url.searchParams.get('classroomId')) {
        classroomId = url.searchParams.get('classroomId')!;
      }
      classroomId = classroomId.toUpperCase().trim();

      const doId = env.CLASSROOM_ROOM_DO.idFromName(classroomId);
      const stub = env.CLASSROOM_ROOM_DO.get(doId);
      return stub.fetch(request);
    }

    // Delegate standard HTTP requests to Vinext/Next.js fetch handler if available
    try {
      // @ts-ignore
      const fetchModule = await import('vinext/server/fetch-handler');
      const handler = fetchModule.default || fetchModule;
      if (typeof handler?.fetch === 'function') {
        return handler.fetch(request, env, ctx);
      }
    } catch {
      // Fallback for direct testing
    }

    return new Response('Cortex Classroom Cloudflare Worker Ready', { status: 200 });
  },
};
