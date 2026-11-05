import { Point, WhiteboardElement, ElementBounds } from '@/types/whiteboard';

/**
 * Calculates the shortest Euclidean distance from a 2D point (px, py)
 * to a finite line segment from (x1, y1) to (x2, y2).
 */
export function distPointToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return Math.hypot(px - x1, py - y1);
  }

  // Project point onto line, clamped to segment range [0, 1]
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;

  return Math.hypot(px - projX, py - projY);
}

/**
 * Computes the minimum distance between two 2D line segments
 * S1: (x1, y1) -> (x2, y2)
 * S2: (x3, y3) -> (x4, y4)
 * Based on Christer Ericson's Real-Time Collision Detection algorithm.
 */
export function distSegmentToSegment(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number
): number {
  const d1x = x2 - x1;
  const d1y = y2 - y1;
  const d2x = x4 - x3;
  const d2y = y4 - y3;
  const rx = x1 - x3;
  const ry = y1 - y3;

  const a = d1x * d1x + d1y * d1y; // Squared length of segment S1
  const e = d2x * d2x + d2y * d2y; // Squared length of segment S2
  const f = d2x * rx + d2y * ry;

  const EPSILON = 1e-6;

  let s = 0;
  let t = 0;

  if (a <= EPSILON && e <= EPSILON) {
    return Math.hypot(rx, ry);
  }

  if (a <= EPSILON) {
    s = 0;
    t = Math.max(0, Math.min(1, f / e));
  } else {
    const c = d1x * rx + d1y * ry;
    if (e <= EPSILON) {
      t = 0;
      s = Math.max(0, Math.min(1, -c / a));
    } else {
      const b = d1x * d2x + d1y * d2y;
      const denom = a * e - b * b;

      if (denom > EPSILON) {
        s = Math.max(0, Math.min(1, (b * f - c * e) / denom));
      } else {
        s = 0;
      }
      t = (b * s + f) / e;

      if (t < 0) {
        t = 0;
        s = Math.max(0, Math.min(1, -c / a));
      } else if (t > 1) {
        t = 1;
        s = Math.max(0, Math.min(1, (b - c) / a));
      }
    }
  }

  const cx1 = x1 + s * d1x;
  const cy1 = y1 + s * d1y;
  const cx2 = x3 + t * d2x;
  const cy2 = y3 + t * d2y;

  return Math.hypot(cx1 - cx2, cy1 - cy2);
}

/**
 * Finds all parameters t in (0, 1) where segment (x1, y1) -> (x2, y2)
 * intersects the circle centered at (cx, cy) with radius r.
 */
export function findSegmentCircleIntersections(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
  r: number
): number[] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const fx = x1 - cx;
  const fy = y1 - cy;

  const a = dx * dx + dy * dy;
  if (a < 1e-9) return [];

  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return [];

  const sqrtDisc = Math.sqrt(discriminant);
  const t1 = (-b - sqrtDisc) / (2 * a);
  const t2 = (-b + sqrtDisc) / (2 * a);

  const tValues: number[] = [];
  if (t1 >= 0 && t1 <= 1) tValues.push(t1);
  if (t2 >= 0 && t2 <= 1 && Math.abs(t2 - t1) > 1e-6) tValues.push(t2);

  return tValues.sort((m, n) => m - n);
}

/**
 * Erases portions of a freehand stroke (pen, pencil, or highlighter) that fall within
 * a circle at (cx, cy) of given radius.
 * Returns an array of surviving sub-strokes (0, 1, or multiple).
 */
export function eraseStrokeByCircle(
  stroke: WhiteboardElement,
  cx: number,
  cy: number,
  radius: number
): { modified: boolean; elements: WhiteboardElement[] } {
  if (!stroke.points || stroke.points.length === 0) {
    return { modified: false, elements: [stroke] };
  }

  const rEff = radius + (stroke.strokeWidth || 4) / 2;

  // Single-point dot case
  if (stroke.points.length === 1) {
    const pt = stroke.points[0];
    if (Math.hypot(pt.x - cx, pt.y - cy) <= rEff) {
      return { modified: true, elements: [] };
    }
    return { modified: false, elements: [stroke] };
  }

  const points = stroke.points;
  const survivingPieces: Point[][] = [];
  let currentPiece: Point[] = [];
  let wasModified = false;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    const d1 = Math.hypot(p1.x - cx, p1.y - cy);
    const d2 = Math.hypot(p2.x - cx, p2.y - cy);

    const p1Inside = d1 <= rEff;
    const p2Inside = d2 <= rEff;

    const tValues = findSegmentCircleIntersections(p1.x, p1.y, p2.x, p2.y, cx, cy, rEff);

    if (!p1Inside && !p2Inside) {
      if (tValues.length === 2) {
        wasModified = true;
        const enterPt: Point = {
          x: p1.x + tValues[0] * (p2.x - p1.x),
          y: p1.y + tValues[0] * (p2.y - p1.y),
        };
        const exitPt: Point = {
          x: p1.x + tValues[1] * (p2.x - p1.x),
          y: p1.y + tValues[1] * (p2.y - p1.y),
        };

        if (currentPiece.length === 0 || currentPiece[currentPiece.length - 1] !== p1) {
          currentPiece.push(p1);
        }
        currentPiece.push(enterPt);

        if (currentPiece.length >= 2) {
          survivingPieces.push(currentPiece);
        }
        currentPiece = [exitPt];
      } else {
        if (currentPiece.length === 0) {
          currentPiece.push(p1);
        } else if (currentPiece[currentPiece.length - 1] !== p1) {
          currentPiece.push(p1);
        }
      }
    } else if (!p1Inside && p2Inside) {
      wasModified = true;
      let enterPt: Point = p2;
      if (tValues.length > 0) {
        enterPt = {
          x: p1.x + tValues[0] * (p2.x - p1.x),
          y: p1.y + tValues[0] * (p2.y - p1.y),
        };
      }

      if (currentPiece.length === 0 || currentPiece[currentPiece.length - 1] !== p1) {
        currentPiece.push(p1);
      }
      currentPiece.push(enterPt);

      if (currentPiece.length >= 2) {
        survivingPieces.push(currentPiece);
      }
      currentPiece = [];
    } else if (p1Inside && !p2Inside) {
      wasModified = true;
      let exitPt: Point = p1;
      if (tValues.length > 0) {
        const lastT = tValues[tValues.length - 1];
        exitPt = {
          x: p1.x + lastT * (p2.x - p1.x),
          y: p1.y + lastT * (p2.y - p1.y),
        };
      }
      currentPiece = [exitPt];
    } else {
      wasModified = true;
      if (currentPiece.length >= 2) {
        survivingPieces.push(currentPiece);
      }
      currentPiece = [];
    }
  }

  // Handle the trailing segment endpoint
  const lastPt = points[points.length - 1];
  const lastDist = Math.hypot(lastPt.x - cx, lastPt.y - cy);
  if (lastDist > rEff) {
    if (currentPiece.length === 0) {
      currentPiece.push(lastPt);
    } else if (currentPiece[currentPiece.length - 1] !== lastPt) {
      currentPiece.push(lastPt);
    }
  }

  if (currentPiece.length >= 2) {
    survivingPieces.push(currentPiece);
  }

  if (!wasModified) {
    return { modified: false, elements: [stroke] };
  }

  const result: WhiteboardElement[] = survivingPieces.map((pts, idx) => ({
    ...stroke,
    id: survivingPieces.length === 1 && idx === 0 ? stroke.id : `${stroke.id}-part-${idx + 1}-${Date.now()}`,
    points: pts,
  }));

  return { modified: true, elements: result };
}

/**
 * Checks if a point (px, py) is inside an axis-aligned bounding box.
 */
export function pointInAABB(px: number, py: number, x1: number, y1: number, x2: number, y2: number): boolean {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  return px >= minX && px <= maxX && py >= minY && py <= maxY;
}

/**
 * Computes tight axis-aligned bounding box for any whiteboard element.
 */
export function getElementBounds(el: WhiteboardElement): ElementBounds {
  // Only freehand strokes and explicit lines/connectors should derive bounds from points
  const isPointBased =
    el.type === 'pen' ||
    el.type === 'pencil' ||
    el.type === 'highlighter' ||
    el.type === 'line' ||
    el.type === 'arrow' ||
    el.type === 'double-arrow' ||
    el.type === 'elbow-connector';

  if (isPointBased && el.points && el.points.length > 0) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of el.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const pad = (el.strokeWidth || 4) / 2;
    return {
      x: minX - pad,
      y: minY - pad,
      width: Math.max(10, maxX - minX + pad * 2),
      height: Math.max(10, maxY - minY + pad * 2),
    };
  }

  const x = el.x ?? 0;
  const y = el.y ?? 0;

  if (el.type === 'text') {
    const lines = (el.text || '').split('\n');
    const maxLineLen = lines.reduce((max, l) => Math.max(max, l.length), 0);
    const fontSize = el.fontSize || 20;
    const width = Math.max(48, maxLineLen * (fontSize * 0.62) + 16);
    const height = Math.max(28, lines.length * (fontSize * 1.45) + 8);
    return { x, y, width, height };
  }

  if (el.type === 'equation') {
    const textLen = el.text ? el.text.length : 12;
    const width = Math.max(60, textLen * 11 + 24);
    const height = 40;
    return { x: x - 8, y: y - 6, width, height };
  }

  if (el.type === 'sticky-note') {
    return {
      x,
      y,
      width: el.width || 180,
      height: el.height || 150,
    };
  }

  // Shapes & flowchart nodes
  const w = el.width || 100;
  const h = el.height || 60;
  const rx = Math.min(x, x + w);
  const ry = Math.min(y, y + h);
  const rw = Math.max(12, Math.abs(w));
  const rh = Math.max(12, Math.abs(h));

  return {
    x: rx,
    y: ry,
    width: rw,
    height: rh,
  };
}

/**
 * Checks if a 2D point (px, py) intersects with or is inside an element.
 */
export function isPointInElement(px: number, py: number, el: WhiteboardElement, tolerance = 10): boolean {
  if (el.type === 'pen' || el.type === 'pencil' || el.type === 'highlighter') {
    if (!el.points || el.points.length === 0) return false;
    const effTol = tolerance + (el.strokeWidth || 4) / 2;
    if (el.points.length === 1) {
      return Math.hypot(px - el.points[0].x, py - el.points[0].y) <= effTol;
    }
    for (let i = 0; i < el.points.length - 1; i++) {
      const d = distPointToSegment(px, py, el.points[i].x, el.points[i].y, el.points[i + 1].x, el.points[i + 1].y);
      if (d <= effTol) return true;
    }
    return false;
  }

  if (el.type === 'line' || el.type === 'arrow' || el.type === 'double-arrow' || el.type === 'elbow-connector') {
    if (!el.points || el.points.length < 2) return false;
    const effTol = tolerance + (el.strokeWidth || 4) / 2;
    if (el.type === 'elbow-connector' && el.points.length === 2) {
      const p1 = el.points[0];
      const p2 = el.points[1];
      const midX = (p1.x + p2.x) / 2;
      const d1 = distPointToSegment(px, py, p1.x, p1.y, midX, p1.y);
      const d2 = distPointToSegment(px, py, midX, p1.y, midX, p2.y);
      const d3 = distPointToSegment(px, py, midX, p2.y, p2.x, p2.y);
      return Math.min(d1, d2, d3) <= effTol;
    }
    for (let i = 0; i < el.points.length - 1; i++) {
      if (distPointToSegment(px, py, el.points[i].x, el.points[i].y, el.points[i + 1].x, el.points[i + 1].y) <= effTol) {
        return true;
      }
    }
    return false;
  }

  if (el.type === 'triangle') {
    const bounds = getElementBounds(el);
    const pTop: Point = { x: bounds.x + bounds.width / 2, y: bounds.y };
    const pLeft: Point = { x: bounds.x, y: bounds.y + bounds.height };
    const pRight: Point = { x: bounds.x + bounds.width, y: bounds.y + bounds.height };
    return (
      isPointInPolygon({ x: px, y: py }, [pTop, pLeft, pRight]) ||
      distPointToSegment(px, py, pTop.x, pTop.y, pLeft.x, pLeft.y) <= tolerance ||
      distPointToSegment(px, py, pLeft.x, pLeft.y, pRight.x, pRight.y) <= tolerance ||
      distPointToSegment(px, py, pRight.x, pRight.y, pTop.x, pTop.y) <= tolerance
    );
  }

  if (el.type === 'ellipse') {
    const bounds = getElementBounds(el);
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    const rx = bounds.width / 2;
    const ry = bounds.height / 2;
    if (rx <= 0 || ry <= 0) return false;
    const normDist = Math.pow((px - cx) / (rx + tolerance), 2) + Math.pow((py - cy) / (ry + tolerance), 2);
    return normDist <= 1;
  }

  // Rectangles, rounded-rect, flow nodes, sticky notes, text, equations
  const bounds = getElementBounds(el);
  return pointInAABB(
    px,
    py,
    bounds.x - tolerance,
    bounds.y - tolerance,
    bounds.x + bounds.width + tolerance,
    bounds.y + bounds.height + tolerance
  );
}

/**
 * Checks if a point is inside a polygon using ray casting algorithm.
 */
export function isPointInPolygon(pt: Point, poly: Point[]): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;

    const intersect = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Checks if an element is selected by a lasso polygon.
 * An element is selected if its center or any vertex falls within the lasso.
 */
export function isElementInPolygon(el: WhiteboardElement, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;

  if (el.points && el.points.length > 0) {
    for (const p of el.points) {
      if (isPointInPolygon(p, polygon)) return true;
    }
    return false;
  }

  const bounds = getElementBounds(el);
  const center: Point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  if (isPointInPolygon(center, polygon)) return true;

  // Check 4 corners
  if (isPointInPolygon({ x: bounds.x, y: bounds.y }, polygon)) return true;
  if (isPointInPolygon({ x: bounds.x + bounds.width, y: bounds.y }, polygon)) return true;
  if (isPointInPolygon({ x: bounds.x, y: bounds.y + bounds.height }, polygon)) return true;
  if (isPointInPolygon({ x: bounds.x + bounds.width, y: bounds.y + bounds.height }, polygon)) return true;

  return false;
}

/**
 * Translates an element by (dx, dy).
 */
export function moveElement(el: WhiteboardElement, dx: number, dy: number): WhiteboardElement {
  if (el.locked) return el;

  const moved: WhiteboardElement = { ...el };

  if (moved.points && moved.points.length > 0) {
    moved.points = moved.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  }

  if (moved.x !== undefined) {
    moved.x += dx;
  }
  if (moved.y !== undefined) {
    moved.y += dy;
  }

  return moved;
}

/**
 * Creates an independent duplicate of an element with new stable ID and spatial offset.
 */
export function duplicateElement(el: WhiteboardElement, offset = 24): WhiteboardElement {
  const newId = `dup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const moved = moveElement(el, offset, offset);
  return {
    ...moved,
    id: newId,
  };
}

/**
 * Hit-tests non-freehand geometric elements against an eraser trajectory.
 */
export function hitTestNonFreehandElement(
  el: WhiteboardElement,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  radius: number
): boolean {
  const threshold = radius + (el.strokeWidth || 4) / 2;

  if (el.type === 'line' || el.type === 'arrow' || el.type === 'double-arrow' || el.type === 'elbow-connector') {
    if (!el.points || el.points.length < 2) return false;
    if (el.type === 'elbow-connector' && el.points.length === 2) {
      const p1 = el.points[0];
      const p2 = el.points[1];
      const midX = (p1.x + p2.x) / 2;
      const d1 = distSegmentToSegment(x1, y1, x2, y2, p1.x, p1.y, midX, p1.y);
      const d2 = distSegmentToSegment(x1, y1, x2, y2, midX, p1.y, midX, p2.y);
      const d3 = distSegmentToSegment(x1, y1, x2, y2, midX, p2.y, p2.x, p2.y);
      return Math.min(d1, d2, d3) <= threshold;
    }
    for (let i = 0; i < el.points.length - 1; i++) {
      const p1 = el.points[i];
      const p2 = el.points[i + 1];
      if (distSegmentToSegment(x1, y1, x2, y2, p1.x, p1.y, p2.x, p2.y) <= threshold) {
        return true;
      }
    }
    return false;
  }

  if (
    el.type === 'rectangle' ||
    el.type === 'rounded-rect' ||
    el.type === 'sticky-note' ||
    el.type === 'flow-process' ||
    el.type === 'flow-decision' ||
    el.type === 'flow-terminal' ||
    el.type === 'flow-io' ||
    el.type === 'flow-document'
  ) {
    const bounds = getElementBounds(el);
    const rx1 = bounds.x;
    const rx2 = bounds.x + bounds.width;
    const ry1 = bounds.y;
    const ry2 = bounds.y + bounds.height;

    if (pointInAABB(x1, y1, rx1, ry1, rx2, ry2) || pointInAABB(x2, y2, rx1, ry1, rx2, ry2)) {
      return true;
    }

    if (distSegmentToSegment(x1, y1, x2, y2, rx1, ry1, rx2, ry1) <= threshold) return true;
    if (distSegmentToSegment(x1, y1, x2, y2, rx2, ry1, rx2, ry2) <= threshold) return true;
    if (distSegmentToSegment(x1, y1, x2, y2, rx2, ry2, rx1, ry2) <= threshold) return true;
    if (distSegmentToSegment(x1, y1, x2, y2, rx1, ry2, rx1, ry1) <= threshold) return true;

    return false;
  }

  if (el.type === 'triangle') {
    const bounds = getElementBounds(el);
    const pTop: Point = { x: bounds.x + bounds.width / 2, y: bounds.y };
    const pLeft: Point = { x: bounds.x, y: bounds.y + bounds.height };
    const pRight: Point = { x: bounds.x + bounds.width, y: bounds.y + bounds.height };

    if (distSegmentToSegment(x1, y1, x2, y2, pTop.x, pTop.y, pLeft.x, pLeft.y) <= threshold) return true;
    if (distSegmentToSegment(x1, y1, x2, y2, pLeft.x, pLeft.y, pRight.x, pRight.y) <= threshold) return true;
    if (distSegmentToSegment(x1, y1, x2, y2, pRight.x, pRight.y, pTop.x, pTop.y) <= threshold) return true;

    return isPointInPolygon({ x: x1, y: y1 }, [pTop, pLeft, pRight]);
  }

  if (el.type === 'ellipse') {
    if (el.x === undefined || el.y === undefined || el.width === undefined || el.height === undefined) {
      return false;
    }
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    const rx = Math.max(1, Math.abs(el.width / 2));
    const ry = Math.max(1, Math.abs(el.height / 2));

    const samples = 5;
    for (let s = 0; s <= samples; s++) {
      const t = s / samples;
      const px = x1 + t * (x2 - x1);
      const py = y1 + t * (y2 - y1);

      const normDist = Math.sqrt(Math.pow((px - cx) / rx, 2) + Math.pow((py - cy) / ry, 2));
      if (normDist <= 1) return true;

      const approxDistToPerimeter = Math.abs(normDist - 1) * ((rx + ry) / 2);
      if (approxDistToPerimeter <= threshold) return true;
    }
    return false;
  }

  if (el.type === 'text' || el.type === 'equation') {
    const bounds = getElementBounds(el);
    const bx1 = bounds.x;
    const bx2 = bounds.x + bounds.width;
    const by1 = bounds.y;
    const by2 = bounds.y + bounds.height;

    if (pointInAABB(x1, y1, bx1, by1, bx2, by2) || pointInAABB(x2, y2, bx1, by1, bx2, by2)) {
      return true;
    }

    if (distSegmentToSegment(x1, y1, x2, y2, bx1, by1, bx2, by1) <= threshold) return true;
    if (distSegmentToSegment(x1, y1, x2, y2, bx2, by1, bx2, by2) <= threshold) return true;
    if (distSegmentToSegment(x1, y1, x2, y2, bx2, by2, bx1, by2) <= threshold) return true;
    if (distSegmentToSegment(x1, y1, x2, y2, bx1, by2, bx1, by1) <= threshold) return true;

    return false;
  }

  return false;
}

/**
 * Applies partial-stroke eraser or atomic eraser across all elements.
 */
export function applyEraserToElements(
  elements: WhiteboardElement[],
  e1: Point,
  e2: Point,
  radius: number
): { nextElements: WhiteboardElement[]; changed: boolean } {
  let hasChanged = false;
  const result: WhiteboardElement[] = [];

  const sweepDist = Math.hypot(e2.x - e1.x, e2.y - e1.y);
  const stepCount = Math.max(1, Math.ceil(sweepDist / Math.max(4, radius / 2)));

  for (const el of elements) {
    if (el.type === 'pen' || el.type === 'pencil' || el.type === 'highlighter') {
      if (!el.points || el.points.length === 0) continue;

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const p of el.points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }

      const sw = el.strokeWidth || 4;
      const pad = radius + sw;
      const eraserMinX = Math.min(e1.x, e2.x) - pad;
      const eraserMaxX = Math.max(e1.x, e2.x) + pad;
      const eraserMinY = Math.min(e1.y, e2.y) - pad;
      const eraserMaxY = Math.max(e1.y, e2.y) + pad;

      if (maxX < eraserMinX || minX > eraserMaxX || maxY < eraserMinY || minY > eraserMaxY) {
        result.push(el);
        continue;
      }

      let currentSubStrokes: WhiteboardElement[] = [el];
      let strokeModified = false;

      for (let s = 0; s <= stepCount; s++) {
        const t = s / stepCount;
        const cx = e1.x + t * (e2.x - e1.x);
        const cy = e1.y + t * (e2.y - e1.y);

        const nextSubStrokes: WhiteboardElement[] = [];
        for (const sub of currentSubStrokes) {
          const { modified, elements: outElements } = eraseStrokeByCircle(sub, cx, cy, radius);
          if (modified) strokeModified = true;
          nextSubStrokes.push(...outElements);
        }
        currentSubStrokes = nextSubStrokes;
        if (currentSubStrokes.length === 0) break;
      }

      if (strokeModified) {
        hasChanged = true;
        result.push(...currentSubStrokes);
      } else {
        result.push(el);
      }
    } else {
      const hit = hitTestNonFreehandElement(el, e1.x, e1.y, e2.x, e2.y, radius);
      if (hit) {
        hasChanged = true;
      } else {
        result.push(el);
      }
    }
  }

  return {
    nextElements: result,
    changed: hasChanged,
  };
}

/**
 * Object Eraser mode: deletes any entire object touched by the pointer (or swept trajectory) in one click/drag.
 * Supports both single-point clicks and swept-segment dragging across fast pointer gestures.
 */
export function applyObjectEraser(
  elements: WhiteboardElement[],
  p1: Point,
  radiusOrP2: number | Point,
  radiusOpt?: number
): { nextElements: WhiteboardElement[]; changed: boolean } {
  let p2: Point;
  let radius: number;

  if (typeof radiusOrP2 === 'number') {
    p2 = p1;
    radius = radiusOrP2;
  } else {
    p2 = radiusOrP2;
    radius = typeof radiusOpt === 'number' ? radiusOpt : 16;
  }

  let hasChanged = false;
  const result = elements.filter((el) => {
    // 1. Direct point hit tests at endpoints
    if (isPointInElement(p1.x, p1.y, el, radius) || isPointInElement(p2.x, p2.y, el, radius)) {
      hasChanged = true;
      return false;
    }

    // 2. Trajectory hit testing between p1 and p2
    const threshold = radius + (el.strokeWidth || 4) / 2;

    // Freehand strokes
    if (el.type === 'pen' || el.type === 'pencil' || el.type === 'highlighter') {
      if (!el.points || el.points.length === 0) return true;
      if (el.points.length === 1) {
        if (distPointToSegment(el.points[0].x, el.points[0].y, p1.x, p1.y, p2.x, p2.y) <= threshold) {
          hasChanged = true;
          return false;
        }
      } else {
        for (let i = 0; i < el.points.length - 1; i++) {
          if (
            distSegmentToSegment(
              p1.x,
              p1.y,
              p2.x,
              p2.y,
              el.points[i].x,
              el.points[i].y,
              el.points[i + 1].x,
              el.points[i + 1].y
            ) <= threshold
          ) {
            hasChanged = true;
            return false;
          }
        }
      }
      return true;
    }

    // Non-freehand shapes, connectors, lines, text, equation, sticky note
    if (hitTestNonFreehandElement(el, p1.x, p1.y, p2.x, p2.y, radius)) {
      hasChanged = true;
      return false;
    }

    return true;
  });

  return { nextElements: result, changed: hasChanged };
}

/**
 * Returns meaningful anchor points on an element for connectors to snap to.
 */
export function getElementAnchorPoints(el: WhiteboardElement): Point[] {
  if (el.type === 'pen' || el.type === 'pencil' || el.type === 'highlighter') {
    if (!el.points || el.points.length === 0) return [];
    if (el.points.length === 1) return [el.points[0]];
    return [el.points[0], el.points[el.points.length - 1]];
  }

  if (el.type === 'line' || el.type === 'arrow' || el.type === 'double-arrow' || el.type === 'elbow-connector') {
    if (!el.points || el.points.length === 0) return [];
    return el.points;
  }

  const bounds = getElementBounds(el);
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  return [
    { x: cx, y: cy }, // Center
    { x: cx, y: bounds.y }, // Top center
    { x: cx, y: bounds.y + bounds.height }, // Bottom center
    { x: bounds.x, y: cy }, // Left center
    { x: bounds.x + bounds.width, y: cy }, // Right center
  ];
}

/**
 * Snaps a target point to the closest anchor point among existing elements if within tolerance.
 */
export function snapToElementAnchor(
  pt: Point,
  elements: WhiteboardElement[],
  tolerance = 16
): Point {
  let closest: Point = pt;
  let minDist = tolerance;

  for (const el of elements) {
    const anchors = getElementAnchorPoints(el);
    for (const anchor of anchors) {
      const d = Math.hypot(pt.x - anchor.x, pt.y - anchor.y);
      if (d <= minDist) {
        minDist = d;
        closest = { x: anchor.x, y: anchor.y };
      }
    }
  }

  return closest;
}
