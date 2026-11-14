/**
 * Vector Whiteboard Delta Streaming & Protocol Serialization Helpers
 * Implements 16ms rAF-throttled stroke streaming, element-level patches,
 * and authoritative canvas snapshot synchronization for Cortex Live Classrooms.
 */

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export interface WhiteboardStrokeStartPayload {
  strokeId: string;
  tool: string;
  color: string;
  strokeWidth: number;
  strokeDash?: number[];
  startPoint: Point;
  pageIndex: number;
  senderId: string;
  timestamp: number;
}

export interface WhiteboardStrokePointPayload {
  strokeId: string;
  points: Point[];
  pageIndex: number;
  timestamp: number;
}

export interface WhiteboardStrokeEndPayload {
  strokeId: string;
  element: any;
  pageIndex: number;
  timestamp: number;
}

export interface WhiteboardElementDeltaPayload {
  action: 'UPDATE' | 'DELETE';
  elementId?: string;
  elementIds?: string[];
  patch?: Record<string, any>;
  pageIndex: number;
  timestamp: number;
}

export interface WhiteboardSnapshotPayload {
  pages: any[];
  activePageIndex: number;
  version: number;
  timestamp: number;
}

/**
 * Creates a 16ms (60fps) throttled stroke point batcher to stream smooth drawing
 * paths over WebSockets without overwhelming rate limiters or dropped frames.
 */
export function createStrokePointBatcher(
  onFlush: (points: Point[]) => void,
  intervalMs: number = 16
) {
  let buffer: Point[] = [];
  let timer: any = null;

  return {
    push(point: Point) {
      buffer.push(point);
      if (!timer) {
        timer = setTimeout(() => {
          if (buffer.length > 0) {
            onFlush([...buffer]);
            buffer = [];
          }
          timer = null;
        }, intervalMs);
      }
    },
    flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (buffer.length > 0) {
        onFlush([...buffer]);
        buffer = [];
      }
    },
    clear() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      buffer = [];
    },
  };
}
