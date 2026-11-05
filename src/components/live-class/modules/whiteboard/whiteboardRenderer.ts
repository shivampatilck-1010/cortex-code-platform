import { WhiteboardElement, BackgroundType, Point } from '@/types/whiteboard';
import { getElementBounds } from './whiteboardGeometry';

export interface RenderOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  zoom: number;
  pan: Point;
  background: BackgroundType;
  elements: WhiteboardElement[];
  selectedElementIds?: string[];
  lassoPoints?: Point[];
  laserPoints?: Array<Point & { timestamp: number }>;
  currentLaserPoint?: Point | null;
  spotlightCenter?: Point | null;
  spotlightRadius?: number;
  isExport?: boolean;
}

/**
 * Safely calls ctx.setLineDash if supported.
 */
function setLineDashSafe(ctx: CanvasRenderingContext2D, segments: number[]) {
  if (typeof ctx.setLineDash === 'function') {
    ctx.setLineDash(segments);
  }
}

/**
 * Safely renders rounded rectangle or falls back to standard rectangle.
 */
function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rad: number
) {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, rad);
  } else {
    ctx.rect(x, y, w, h);
  }
}

/**
 * Draws the paper background pattern based on page background settings.
 */
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  zoom: number,
  pan: Point,
  type: BackgroundType
) {
  ctx.save();

  // Base background fill
  if (type === 'plain-white') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
    return;
  }

  const isLight = type === 'light-grid';
  ctx.fillStyle = isLight ? '#F8FAFC' : '#0B0C0E';
  ctx.fillRect(0, 0, width, height);

  const offsetX = (pan.x * zoom) % (32 * zoom);
  const offsetY = (pan.y * zoom) % (32 * zoom);

  if (type === 'dark-grid' || type === 'light-grid') {
    ctx.strokeStyle = isLight ? '#E2E8F0' : '#181920';
    ctx.lineWidth = 1;
    const step = 32 * zoom;

    ctx.beginPath();
    for (let x = offsetX; x < width; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = offsetY; y < height; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  } else if (type === 'ruled') {
    ctx.strokeStyle = isLight ? '#CBD5E1' : '#222530';
    ctx.lineWidth = 1;
    const step = 28 * zoom;

    ctx.beginPath();
    for (let y = offsetY; y < height; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Red left margin rule
    const marginX = 64 * zoom + (pan.x * zoom);
    if (marginX > 0 && marginX < width) {
      ctx.strokeStyle = isLight ? '#FDA4AF' : '#881337';
      ctx.beginPath();
      ctx.moveTo(marginX, 0);
      ctx.lineTo(marginX, height);
      ctx.stroke();
    }
  } else if (type === 'dotted') {
    ctx.fillStyle = isLight ? '#94A3B8' : '#2D313E';
    const step = 24 * zoom;
    const dotRadius = Math.max(1, 1.2 * zoom);

    for (let x = offsetX; x < width; x += step) {
      for (let y = offsetY; y < height; y += step) {
        ctx.beginPath();
        ctx.arc(x, y, dotRadius, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  } else if (type === 'graph') {
    const minorStep = 16 * zoom;
    const majorStep = 64 * zoom;

    // Minor lines
    ctx.strokeStyle = isLight ? '#F1F5F9' : '#14161C';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = (pan.x * zoom) % minorStep; x < width; x += minorStep) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = (pan.y * zoom) % minorStep; y < height; y += minorStep) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Major lines
    ctx.strokeStyle = isLight ? '#CBD5E1' : '#242833';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let x = (pan.x * zoom) % majorStep; x < width; x += majorStep) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = (pan.y * zoom) % majorStep; y < height; y += majorStep) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draws arrow heads at segment endpoints.
 */
function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  size = 12
) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - size * Math.cos(angle - Math.PI / 6),
    toY - size * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - size * Math.cos(angle + Math.PI / 6),
    toY - size * Math.sin(angle + Math.PI / 6)
  );
  ctx.stroke();
}

/**
 * Renders an individual whiteboard element.
 */
export function renderElement(
  ctx: CanvasRenderingContext2D,
  el: WhiteboardElement,
  zoom: number,
  pan: Point
) {
  ctx.save();
  ctx.strokeStyle = el.color;
  ctx.fillStyle = el.fillColor || el.color;
  ctx.lineWidth = Math.max(1, (el.strokeWidth || 2) * zoom);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (el.strokeDash === 'dashed') {
    setLineDashSafe(ctx, [8 * zoom, 6 * zoom]);
  } else {
    setLineDashSafe(ctx, []);
  }

  if (el.opacity !== undefined) {
    ctx.globalAlpha = el.opacity;
  }

  if (el.type === 'highlighter') {
    ctx.globalAlpha = 0.35;
    ctx.lineCap = 'square';
  } else if (el.type === 'pencil') {
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = Math.max(1, (el.strokeWidth || 1) * 0.75 * zoom);
  }

  // Freehand stroke types
  if (el.type === 'pen' || el.type === 'pencil' || el.type === 'highlighter') {
    if (el.points && el.points.length > 1) {
      ctx.beginPath();
      ctx.moveTo((el.points[0].x + pan.x) * zoom, (el.points[0].y + pan.y) * zoom);
      for (let i = 1; i < el.points.length; i++) {
        ctx.lineTo((el.points[i].x + pan.x) * zoom, (el.points[i].y + pan.y) * zoom);
      }
      ctx.stroke();
    } else if (el.points && el.points.length === 1) {
      // Single dot
      ctx.beginPath();
      ctx.arc(
        (el.points[0].x + pan.x) * zoom,
        (el.points[0].y + pan.y) * zoom,
        ctx.lineWidth / 2,
        0,
        2 * Math.PI
      );
      ctx.fill();
    }
  } else if (el.type === 'rectangle' && el.x !== undefined && el.y !== undefined && el.width !== undefined && el.height !== undefined) {
    const minX = Math.min(el.x, el.x + el.width);
    const minY = Math.min(el.y, el.y + el.height);
    const w = Math.abs(el.width);
    const h = Math.abs(el.height);
    const rx = (minX + pan.x) * zoom;
    const ry = (minY + pan.y) * zoom;
    const rw = w * zoom;
    const rh = h * zoom;
    if (el.fillColor && el.fillColor !== 'transparent') {
      ctx.fillStyle = el.fillColor;
      ctx.fillRect(rx, ry, rw, rh);
    }
    ctx.strokeRect(rx, ry, rw, rh);
  } else if (el.type === 'rounded-rect' && el.x !== undefined && el.y !== undefined && el.width !== undefined && el.height !== undefined) {
    const minX = Math.min(el.x, el.x + el.width);
    const minY = Math.min(el.y, el.y + el.height);
    const w = Math.abs(el.width);
    const h = Math.abs(el.height);
    const rx = (minX + pan.x) * zoom;
    const ry = (minY + pan.y) * zoom;
    const rw = w * zoom;
    const rh = h * zoom;
    const rad = Math.min(12 * zoom, rw / 4, rh / 4);

    ctx.beginPath();
    drawRoundRect(ctx, rx, ry, rw, rh, rad);
    if (el.fillColor && el.fillColor !== 'transparent') {
      ctx.fillStyle = el.fillColor;
      ctx.fill();
    }
    ctx.stroke();
  } else if (el.type === 'ellipse' && el.x !== undefined && el.y !== undefined && el.width !== undefined && el.height !== undefined) {
    const cx = (el.x + pan.x + el.width / 2) * zoom;
    const cy = (el.y + pan.y + el.height / 2) * zoom;
    const radX = Math.abs(el.width / 2) * zoom;
    const radY = Math.abs(el.height / 2) * zoom;

    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(1, radX), Math.max(1, radY), 0, 0, 2 * Math.PI);
    if (el.fillColor && el.fillColor !== 'transparent') {
      ctx.fillStyle = el.fillColor;
      ctx.fill();
    }
    ctx.stroke();
  } else if (el.type === 'triangle' && el.x !== undefined && el.y !== undefined && el.width !== undefined && el.height !== undefined) {
    const p1x = (el.x + pan.x + el.width / 2) * zoom;
    const p1y = (el.y + pan.y) * zoom;
    const p2x = (el.x + pan.x) * zoom;
    const p2y = (el.y + pan.y + el.height) * zoom;
    const p3x = (el.x + pan.x + el.width) * zoom;
    const p3y = (el.y + pan.y + el.height) * zoom;

    ctx.beginPath();
    ctx.moveTo(p1x, p1y);
    ctx.lineTo(p2x, p2y);
    ctx.lineTo(p3x, p3y);
    ctx.closePath();
    if (el.fillColor && el.fillColor !== 'transparent') {
      ctx.fillStyle = el.fillColor;
      ctx.fill();
    }
    ctx.stroke();
  } else if (el.type === 'line' && el.points && el.points.length >= 2) {
    const p1 = el.points[0];
    const p2 = el.points[1];
    ctx.beginPath();
    ctx.moveTo((p1.x + pan.x) * zoom, (p1.y + pan.y) * zoom);
    ctx.lineTo((p2.x + pan.x) * zoom, (p2.y + pan.y) * zoom);
    ctx.stroke();
  } else if (el.type === 'arrow' && el.points && el.points.length >= 2) {
    const p1 = el.points[0];
    const p2 = el.points[1];
    const x1 = (p1.x + pan.x) * zoom;
    const y1 = (p1.y + pan.y) * zoom;
    const x2 = (p2.x + pan.x) * zoom;
    const y2 = (p2.y + pan.y) * zoom;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    drawArrowHead(ctx, x1, y1, x2, y2, 14 * zoom);
  } else if (el.type === 'double-arrow' && el.points && el.points.length >= 2) {
    const p1 = el.points[0];
    const p2 = el.points[1];
    const x1 = (p1.x + pan.x) * zoom;
    const y1 = (p1.y + pan.y) * zoom;
    const x2 = (p2.x + pan.x) * zoom;
    const y2 = (p2.y + pan.y) * zoom;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    drawArrowHead(ctx, x1, y1, x2, y2, 14 * zoom);
    drawArrowHead(ctx, x2, y2, x1, y1, 14 * zoom);
  } else if (el.type === 'elbow-connector' && el.points && el.points.length >= 2) {
    const p1 = el.points[0];
    const p2 = el.points[1];
    const x1 = (p1.x + pan.x) * zoom;
    const y1 = (p1.y + pan.y) * zoom;
    const x2 = (p2.x + pan.x) * zoom;
    const y2 = (p2.y + pan.y) * zoom;
    const midX = (x1 + x2) / 2;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(midX, y1);
    ctx.lineTo(midX, y2);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const arrowFromX = Math.abs(x2 - midX) > 1e-4 ? midX : x1;
    const arrowFromY = Math.abs(x2 - midX) > 1e-4 ? y2 : y1;
    drawArrowHead(ctx, arrowFromX, arrowFromY, x2, y2, 12 * zoom);
  } else if (el.type.startsWith('flow-') && el.x !== undefined && el.y !== undefined && el.width !== undefined && el.height !== undefined) {
    // Flowchart symbols
    const minX = Math.min(el.x, el.x + el.width);
    const minY = Math.min(el.y, el.y + el.height);
    const rw = Math.max(12, Math.abs(el.width));
    const rh = Math.max(12, Math.abs(el.height));
    const x = (minX + pan.x) * zoom;
    const y = (minY + pan.y) * zoom;
    const w = rw * zoom;
    const h = rh * zoom;

    ctx.fillStyle = el.fillColor || '#15161C';

    ctx.beginPath();
    if (el.type === 'flow-process') {
      ctx.rect(x, y, w, h);
    } else if (el.type === 'flow-decision') {
      // Diamond
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h / 2);
      ctx.lineTo(x + w / 2, y + h);
      ctx.lineTo(x, y + h / 2);
      ctx.closePath();
    } else if (el.type === 'flow-terminal') {
      // Stadium / pill
      drawRoundRect(ctx, x, y, w, h, Math.min(w, h) / 2);
    } else if (el.type === 'flow-io') {
      // Parallelogram
      const skew = Math.min(14 * zoom, w / 4);
      ctx.moveTo(x + skew, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w - skew, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
    } else if (el.type === 'flow-document') {
      // Document wave bottom
      const wave = Math.min(10 * zoom, h / 5);
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h - wave);
      ctx.bezierCurveTo(
        x + (w * 3) / 4,
        y + h + wave * 0.8,
        x + w / 4,
        y + h - wave * 1.8,
        x,
        y + h - wave * 0.6
      );
      ctx.closePath();
    }

    ctx.fill();
    ctx.stroke();

    // Node label
    if (el.text) {
      ctx.fillStyle = el.textColor || '#F5F5F5';
      ctx.font = `600 ${Math.max(11, 13 * zoom)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(el.text, x + w / 2, y + h / 2);
    }
  } else if (el.type === 'sticky-note' && el.x !== undefined && el.y !== undefined) {
    // Post-it note
    const x = (el.x + pan.x) * zoom;
    const y = (el.y + pan.y) * zoom;
    const w = (el.width || 160) * zoom;
    const h = (el.height || 140) * zoom;
    const noteColor = el.backgroundColor || '#FEF08A';

    // Note card background
    ctx.fillStyle = noteColor;
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 8 * zoom;
    ctx.shadowOffsetY = 4 * zoom;

    ctx.beginPath();
    drawRoundRect(ctx, x, y, w, h, 6 * zoom);
    ctx.fill();

    // Folded bottom-right dog-ear corner
    ctx.shadowColor = 'transparent';
    const foldSize = 16 * zoom;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.beginPath();
    ctx.moveTo(x + w - foldSize, y + h);
    ctx.lineTo(x + w, y + h - foldSize);
    ctx.lineTo(x + w - foldSize, y + h - foldSize);
    ctx.closePath();
    ctx.fill();

    // Text inside sticky note
    if (el.text) {
      ctx.fillStyle = '#18181B'; // Dark ink on pastel note
      ctx.font = `500 ${Math.max(11, (el.fontSize || 14) * zoom)}px 'Caveat', Inter, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      const lines = el.text.split('\n');
      const pad = 12 * zoom;
      const lineHeight = (el.fontSize || 14) * 1.35 * zoom;
      lines.forEach((line, idx) => {
        ctx.fillText(line, x + pad, y + pad + idx * lineHeight);
      });
    }
  } else if (el.type === 'text' && el.x !== undefined && el.y !== undefined && el.text) {
    // Natural whiteboard text rendering (crisp typography, high readability)
    const x = (el.x + pan.x) * zoom;
    const y = (el.y + pan.y) * zoom;
    const fontSize = (el.fontSize || 20) * zoom;
    const fontFamily = el.fontFamily || 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const fontWeight = el.fontWeight || 'normal';
    const fontStyle = el.fontStyle || 'normal';

    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.textAlign = el.textAlign || 'left';
    ctx.textBaseline = 'top';

    const lines = el.text.split('\n');
    const lineHeight = fontSize * 1.4;

    // Optional highlight background or border
    if (el.backgroundColor && el.backgroundColor !== 'transparent') {
      const bounds = getElementBounds(el);
      ctx.fillStyle = el.backgroundColor;
      ctx.fillRect(
        (bounds.x + pan.x) * zoom - 6 * zoom,
        (bounds.y + pan.y) * zoom - 4 * zoom,
        bounds.width * zoom + 12 * zoom,
        bounds.height * zoom + 8 * zoom
      );
    }

    ctx.fillStyle = el.textColor || el.color || '#F5F5F5';
    lines.forEach((line, idx) => {
      ctx.fillText(line, x, y + idx * lineHeight);
    });
  } else if (el.type === 'equation' && el.x !== undefined && el.y !== undefined && el.text) {
    const x = (el.x + pan.x) * zoom;
    const y = (el.y + pan.y) * zoom;
    const fontSize = 16 * zoom;

    // Subtle dark badge backing for equation
    ctx.fillStyle = '#111216';
    const textLen = el.text.length;
    const estW = Math.max(50, textLen * 10 * zoom + 20 * zoom);
    const estH = 34 * zoom;
    ctx.beginPath();
    drawRoundRect(ctx, x - 8 * zoom, y - 6 * zoom, estW, estH, 6 * zoom);
    ctx.fill();
    ctx.strokeStyle = '#282A36';
    ctx.stroke();

    ctx.fillStyle = el.color || '#06B6D4';
    ctx.font = `italic 600 ${fontSize}px 'Fira Code', 'KaTeX_Math', monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(el.text, x, y);
  }

  ctx.restore();
}

/**
 * Draws selection highlight box and resize handles around selected elements.
 */
export function drawSelectionBox(
  ctx: CanvasRenderingContext2D,
  elements: WhiteboardElement[],
  selectedIds: string[],
  zoom: number,
  pan: Point
) {
  if (selectedIds.length === 0) return;

  const selectedElements = elements.filter((el) => selectedIds.includes(el.id));
  if (selectedElements.length === 0) return;

  // Compute union bounding box
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const el of selectedElements) {
    const b = getElementBounds(el);
    if (b.x < minX) minX = b.x;
    if (b.x + b.width > maxX) maxX = b.x + b.width;
    if (b.y < minY) minY = b.y;
    if (b.y + b.height > maxY) maxY = b.y + b.height;
  }

  const pad = 6;
  const sx = (minX - pad + pan.x) * zoom;
  const sy = (minY - pad + pan.y) * zoom;
  const sw = (maxX - minX + pad * 2) * zoom;
  const sh = (maxY - minY + pad * 2) * zoom;

  ctx.save();
  ctx.strokeStyle = '#06B6D4';
  ctx.lineWidth = 1.5;
  setLineDashSafe(ctx, [4 * zoom, 4 * zoom]);
  ctx.strokeRect(sx, sy, sw, sh);

  // Corner grab handles
  setLineDashSafe(ctx, []);
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#06B6D4';
  ctx.lineWidth = 2;
  const handleSize = 7;

  const handles = [
    { x: sx, y: sy },
    { x: sx + sw, y: sy },
    { x: sx, y: sy + sh },
    { x: sx + sw, y: sy + sh },
  ];

  for (const h of handles) {
    ctx.beginPath();
    ctx.arc(h.x, h.y, handleSize / 2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draws the active lasso selection boundary polygon.
 */
export function drawLasso(ctx: CanvasRenderingContext2D, points: Point[], zoom: number, pan: Point) {
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = '#FF9100';
  ctx.fillStyle = 'rgba(255, 145, 0, 0.08)';
  ctx.lineWidth = 1.5;
  setLineDashSafe(ctx, [4 * zoom, 3 * zoom]);

  ctx.beginPath();
  ctx.moveTo((points[0].x + pan.x) * zoom, (points[0].y + pan.y) * zoom);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo((points[i].x + pan.x) * zoom, (points[i].y + pan.y) * zoom);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Draws temporary decaying laser pointer trail and active laser dot.
 */
export function drawLaserTrail(
  ctx: CanvasRenderingContext2D,
  points: Array<Point & { timestamp: number }>,
  zoom: number,
  pan: Point,
  currentPoint?: Point | null
) {
  const headPoint = currentPoint || (points && points.length > 0 ? points[points.length - 1] : null);
  if (!headPoint && (!points || points.length === 0)) return;

  const now = Date.now();
  const maxAge = 1000; // ms

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 1. Draw fading trail segments if at least 2 points exist
  if (points && points.length >= 2) {
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const age = now - p2.timestamp;
      if (age > maxAge) continue;

      const alpha = Math.max(0, 1 - age / maxAge);
      ctx.strokeStyle = `rgba(239, 68, 68, ${alpha * 0.9})`;
      ctx.lineWidth = Math.max(2, (7 - (age / maxAge) * 5) * zoom);

      ctx.beginPath();
      ctx.moveTo((p1.x + pan.x) * zoom, (p1.y + pan.y) * zoom);
      ctx.lineTo((p2.x + pan.x) * zoom, (p2.y + pan.y) * zoom);
      ctx.stroke();
    }
  }

  // 2. Draw glowing laser pointer head at active pointer location
  if (headPoint) {
    const hx = (headPoint.x + pan.x) * zoom;
    const hy = (headPoint.y + pan.y) * zoom;

    // Outer soft glow halo
    ctx.beginPath();
    ctx.arc(hx, hy, 12 * zoom, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
    ctx.fill();

    // Medium intense ring with glow shadow
    ctx.beginPath();
    ctx.arc(hx, hy, 6.5 * zoom, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
    ctx.shadowColor = '#EF4444';
    ctx.shadowBlur = 10 * zoom;
    ctx.fill();

    // Core laser dot
    ctx.beginPath();
    ctx.arc(hx, hy, 3.5 * zoom, 0, 2 * Math.PI);
    ctx.fillStyle = '#EF4444';
    ctx.fill();

    // Center hot-spot for sharp visibility against all backgrounds
    ctx.beginPath();
    ctx.arc(hx, hy, 1.5 * zoom, 0, 2 * Math.PI);
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'transparent';
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draws spotlight overlay: dims the entire canvas except a circular illuminated window.
 */
export function drawSpotlightOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  center: Point,
  radius = 140
) {
  ctx.save();
  // Create an offscreen or composite cutout
  ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
  ctx.fill();

  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = 'rgba(255, 145, 0, 0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
  ctx.stroke();

  ctx.restore();
}

/**
 * Complete master render function for a whiteboard canvas.
 */
export function renderWhiteboard(options: RenderOptions) {
  const {
    ctx,
    width,
    height,
    zoom,
    pan,
    background,
    elements,
    selectedElementIds,
    lassoPoints,
    laserPoints,
    currentLaserPoint,
    spotlightCenter,
    spotlightRadius = 140,
    isExport = false,
  } = options;

  ctx.clearRect(0, 0, width, height);

  // 1. Paper / grid background
  drawBackground(ctx, width, height, zoom, pan, background);

  // 2. Elements in z-index / creation order
  for (const el of elements) {
    renderElement(ctx, el, zoom, pan);
  }

  // Transient overlays are skipped in document export
  if (!isExport) {
    // 3. Selection box
    if (selectedElementIds && selectedElementIds.length > 0) {
      drawSelectionBox(ctx, elements, selectedElementIds, zoom, pan);
    }

    // 4. Lasso boundary
    if (lassoPoints && lassoPoints.length > 1) {
      drawLasso(ctx, lassoPoints, zoom, pan);
    }

    // 5. Laser pointer trail and active head
    if ((laserPoints && laserPoints.length > 0) || currentLaserPoint) {
      drawLaserTrail(ctx, laserPoints || [], zoom, pan, currentLaserPoint);
    }

    // 6. Presentation spotlight
    if (spotlightCenter) {
      drawSpotlightOverlay(ctx, width, height, spotlightCenter, spotlightRadius);
    }
  }
}
