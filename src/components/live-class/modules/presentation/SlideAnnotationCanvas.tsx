import React, { useRef, useState, useCallback } from 'react';
import { SlideAnnotation, SlideAnnotationStroke, AnnotationTool } from '@/types/presentation';

interface SlideAnnotationCanvasProps {
  annotations?: SlideAnnotation;
  onUpdateAnnotations: (updated: SlideAnnotation) => void;
  activeTool: AnnotationTool;
  penColor: string;
  penWidth: number;
  slideRef: React.RefObject<HTMLDivElement | null>;
}

export const SlideAnnotationCanvas: React.FC<SlideAnnotationCanvasProps> = ({
  annotations = { strokes: [] },
  onUpdateAnnotations,
  activeTool,
  penColor,
  penWidth,
  slideRef,
}) => {
  const [currentStroke, setCurrentStroke] = useState<SlideAnnotationStroke | null>(null);
  const isDrawingRef = useRef(false);

  const getNormalizedPoint = useCallback(
    (e: React.PointerEvent): { x: number; y: number } | null => {
      const el = slideRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;

      const normX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const normY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      return { x: normX, y: normY };
    },
    [slideRef]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    if (activeTool !== 'pen') return;
    const pt = getNormalizedPoint(e);
    if (!pt) return;

    isDrawingRef.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    const newStroke: SlideAnnotationStroke = {
      id: `stroke_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      color: penColor,
      width: penWidth,
      points: [pt],
    };
    setCurrentStroke(newStroke);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawingRef.current || activeTool !== 'pen' || !currentStroke) return;
    const pt = getNormalizedPoint(e);
    if (!pt) return;

    setCurrentStroke((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        points: [...prev.points, pt],
      };
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDrawingRef.current || activeTool !== 'pen' || !currentStroke) return;
    isDrawingRef.current = false;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);

    if (currentStroke.points.length > 1) {
      const nextStrokes = [...(annotations.strokes || []), currentStroke];
      onUpdateAnnotations({ strokes: nextStrokes });
    }
    setCurrentStroke(null);
  };

  // Convert normalized points array to SVG path string
  const pointsToSvgPath = (points: Array<{ x: number; y: number }>): string => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y + 0.1}`;

    return points.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, '');
  };

  const isInteractive = activeTool === 'pen';

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`absolute inset-0 w-full h-full z-20 ${
        isInteractive ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      {/* Existing Saved Strokes */}
      {(annotations.strokes || []).map((stroke) => (
        <path
          key={stroke.id}
          d={pointsToSvgPath(stroke.points)}
          fill="none"
          stroke={stroke.color}
          strokeWidth={stroke.width * 0.3} // Scaled relative to 100x100 viewBox
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.9}
        />
      ))}

      {/* Currently In-Progress Active Stroke */}
      {currentStroke && (
        <path
          d={pointsToSvgPath(currentStroke.points)}
          fill="none"
          stroke={currentStroke.color}
          strokeWidth={currentStroke.width * 0.3}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.95}
        />
      )}
    </svg>
  );
};
