import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  WhiteboardTool,
  WhiteboardElement,
  WhiteboardDocument,
  WhiteboardPage,
  BackgroundType,
  Point,
} from '@/types/whiteboard';
import { useClassroom } from '@/context/ClassroomContext';
import { useFollowTeacher } from '@/context/FollowTeacherContext';
import {
  applyEraserToElements,
  applyObjectEraser,
  isPointInElement,
  isElementInPolygon,
  moveElement,
  duplicateElement,
  snapToElementAnchor,
} from './whiteboardGeometry';
import { renderWhiteboard } from './whiteboardRenderer';
import {
  exportPageToPNG,
  exportAllPagesToZIP,
  exportDocumentToPDF,
  exportDocumentToJSON,
  importDocumentFromJSON,
} from './whiteboardExport';
import { WhiteboardToolbar } from './WhiteboardToolbar';
import { WhiteboardContextBar } from './WhiteboardContextBar';
import { WhiteboardPageNavigator } from './WhiteboardPageNavigator';

const INITIAL_DOC: WhiteboardDocument = {
  schemaVersion: 1,
  id: 'doc-initial-1',
  title: 'AVL Tree & Balanced Search Proofs',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  activePageId: 'page-1',
  pages: [
    {
      id: 'page-1',
      title: '1. Invariant & Rotations',
      background: 'dark-grid',
      elements: [
        {
          id: 'init-1',
          type: 'pen',
          color: '#06B6D4',
          strokeWidth: 3,
          points: [
            { x: 120, y: 80 },
            { x: 130, y: 95 },
            { x: 150, y: 120 },
            { x: 190, y: 150 },
            { x: 240, y: 160 },
          ],
        },
        {
          id: 'init-2',
          type: 'text',
          color: '#F5F5F5',
          textColor: '#F5F5F5',
          strokeWidth: 1,
          fontSize: 20,
          fontWeight: 'bold',
          x: 260,
          y: 160,
          text: 'AVL Invariant: |h(left) - h(right)| <= 1',
        },
      ],
      history: [],
      redoStack: [],
      viewport: { zoom: 1, pan: { x: 0, y: 0 } },
    },
    {
      id: 'page-2',
      title: '2. Rebalancing Algorithm',
      background: 'ruled',
      elements: [
        {
          id: 'init-p2-1',
          type: 'flow-process',
          color: '#06B6D4',
          fillColor: '#15161C',
          strokeWidth: 2,
          x: 180,
          y: 120,
          width: 180,
          height: 60,
          text: 'Insert Node(K)',
        },
        {
          id: 'init-p2-2',
          type: 'arrow',
          color: '#FF9100',
          strokeWidth: 2,
          points: [
            { x: 360, y: 150 },
            { x: 440, y: 150 },
          ],
        },
        {
          id: 'init-p2-3',
          type: 'flow-decision',
          color: '#FF9100',
          fillColor: '#15161C',
          strokeWidth: 2,
          x: 440,
          y: 110,
          width: 140,
          height: 80,
          text: 'Balance Factor?',
        },
      ],
      history: [],
      redoStack: [],
      viewport: { zoom: 1, pan: { x: 0, y: 0 } },
    },
  ],
};

export const WhiteboardModule: React.FC = () => {
  const { userRole, showToast, session, signalingClient, activeModule } = useClassroom();
  const classroomId = session?.id || '';
  const versionRef = useRef<number>(1);
  const isInitialLoadRef = useRef<boolean>(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const { broadcastTeacherActivity } = useFollowTeacher();

  // Document State
  const [doc, setDoc] = useState<WhiteboardDocument>(INITIAL_DOC);
  const activePage = doc.pages.find((p) => p.id === doc.activePageId) || doc.pages[0];

  // 1. Initial Load from Server Database
  useEffect(() => {
    if (!classroomId || typeof window === 'undefined') return;
    let isMounted = true;

    fetch(`/api/v1/classrooms/${classroomId}/whiteboard?sessionId=${classroomId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data?.whiteboard?.pages) return;
        const sPages = data.whiteboard.pages;
        versionRef.current = data.whiteboard.version || 1;
        setDoc((prev) => ({
          ...prev,
          pages: sPages,
          activePageId: sPages[data.whiteboard.activePageIndex || 0]?.id || sPages[0]?.id || prev.activePageId,
        }));
        setSyncStatus('saved');
        isInitialLoadRef.current = false;
      })
      .catch(() => {
        // Fallback to local recovery
        try {
          const local = localStorage.getItem('cortex_whiteboard_' + classroomId);
          if (local) {
            const parsed = JSON.parse(local);
            if (Array.isArray(parsed.pages)) {
              setDoc((prev) => ({ ...prev, pages: parsed.pages }));
            }
          }
        } catch (_) {}
      });

    return () => { isMounted = false; };
  }, [classroomId]);

  // 2. Real-time broadcast sync listener
  useEffect(() => {
    if (!signalingClient) return;

    const unsub = signalingClient.onMessage((envelope) => {
      if (envelope.type === 'CLASSROOM_EVENT' && envelope.payload?.eventName === 'WHITEBOARD_PAGE_SYNC') {
        const syncData = envelope.payload?.data;
        if (syncData?.pages && Array.isArray(syncData.pages)) {
          versionRef.current = syncData.version || versionRef.current;
          setDoc((prev) => ({
            ...prev,
            pages: syncData.pages,
            activePageId: syncData.pages[syncData.activePageIndex || 0]?.id || prev.activePageId,
          }));
        }
      }
    });

    return () => { unsub(); };
  }, [signalingClient]);

  // 3. Debounced Save to Server Database
  useEffect(() => {
    if (!classroomId || isInitialLoadRef.current) return;
    setSyncStatus('saving');

    const timer = setTimeout(() => {
      const activeIdx = Math.max(0, doc.pages.findIndex((p) => p.id === doc.activePageId));
      fetch(`/api/v1/classrooms/${classroomId}/whiteboard`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: classroomId,
          pages: doc.pages,
          activePageIndex: activeIdx,
          version: versionRef.current,
        }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((resData) => {
          if (resData?.whiteboard) {
            versionRef.current = resData.whiteboard.version;
            setSyncStatus('saved');
            // Write local disaster recovery cache
            try {
              localStorage.setItem('cortex_whiteboard_' + classroomId, JSON.stringify({ pages: doc.pages }));
            } catch (_) {}
          } else {
            setSyncStatus('error');
          }
        })
        .catch(() => {
          setSyncStatus('error');
        });
    }, 600);

    return () => clearTimeout(timer);
  }, [doc.pages, doc.activePageId, classroomId]);

  // Canvas Viewport & Tool State
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<WhiteboardTool>('pen');
  const [strokeColor, setStrokeColor] = useState<string>('#06B6D4');
  const [fillColor, setFillColor] = useState<string>('transparent');
  const [strokeWidth, setStrokeWidth] = useState<number>(4);
  const [strokeDash, setStrokeDash] = useState<'solid' | 'dashed'>('solid');
  const [zoom, setZoom] = useState<number>(activePage.viewport.zoom || 1);
  const [pan, setPan] = useState<Point>(activePage.viewport.pan || { x: 0, y: 0 });

  // Selection & Lasso
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [lassoPoints, setLassoPoints] = useState<Point[]>([]);

  // Modals & Panels
  const [isNavigatorOpen, setIsNavigatorOpen] = useState(false);
  const [isSpotlightActive, setIsSpotlightActive] = useState(false);
  const [spotlightCenter, setSpotlightCenter] = useState<Point | null>(null);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [equationModalOpen, setEquationModalOpen] = useState(false);
  const [latexInput, setLatexInput] = useState('T(n) = 2T(n/2) + O(n)');

  // Inline Natural Text Editor
  const [editingText, setEditingText] = useState<{
    id?: string;
    x: number;
    y: number;
    text: string;
    fontSize: number;
    textColor: string;
    isSticky?: boolean;
    bgColor?: string;
  } | null>(null);

  // Active gesture drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElement, setCurrentElement] = useState<WhiteboardElement | null>(null);

  // Drag-move for selected elements
  const dragStartRef = useRef<Point | null>(null);
  const dragInitialElementsRef = useRef<WhiteboardElement[]>([]);
  const activeMovingIdsRef = useRef<string[]>([]);
  const preMoveSnapshotRef = useRef<WhiteboardElement[] | null>(null);
  const hasMovedRef = useRef<boolean>(false);

  // Eraser interaction state and refs for reliable dragging
  const elementsRef = useRef<WhiteboardElement[]>(activePage.elements);
  elementsRef.current = activePage.elements;
  const preEraseSnapshotRef = useRef<WhiteboardElement[] | null>(null);
  const hasErasedRef = useRef<boolean>(false);
  const lastPointerPosRef = useRef<Point | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // Laser Pointer State & Trail
  const [laserPoints, setLaserPoints] = useState<Array<Point & { timestamp: number }>>([]);
  const [activeLaserPos, setActiveLaserPos] = useState<Point | null>(null);
  const laserAnimRef = useRef<number | null>(null);
  const activeLaserPosRef = useRef<Point | null>(null);
  const laserPointsRef = useRef<Array<Point & { timestamp: number }>>([]);

  // Eraser Radius
  const eraserRadius = Math.max(16, strokeWidth * 2.5);

  // Sync zoom/pan when active page changes
  useEffect(() => {
    setZoom(activePage.viewport.zoom || 1);
    setPan(activePage.viewport.pan || { x: 0, y: 0 });
    setSelectedElementIds([]);
    setEditingText(null);
  }, [activePage.id]);

  // Cleanup laser pointer when tool changes away from laser
  useEffect(() => {
    if (selectedTool !== 'laser') {
      setActiveLaserPos(null);
      setLaserPoints([]);
      activeLaserPosRef.current = null;
      laserPointsRef.current = [];
      if (laserAnimRef.current) {
        cancelAnimationFrame(laserAnimRef.current);
        laserAnimRef.current = null;
      }
    }
  }, [selectedTool]);

  // Master Canvas Redraw Routine
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const elementsToRender = currentElement
      ? [...elementsRef.current, currentElement]
      : elementsRef.current;

    renderWhiteboard({
      ctx,
      width: canvas.width,
      height: canvas.height,
      zoom,
      pan,
      background: activePage.background,
      elements: elementsToRender,
      selectedElementIds,
      lassoPoints,
      laserPoints,
      currentLaserPoint: selectedTool === 'laser' ? activeLaserPos : null,
      spotlightCenter: isSpotlightActive ? spotlightCenter : null,
      spotlightRadius: 130 * zoom,
      isExport: false,
    });
  }, [
    activePage.elements,
    activePage.background,
    currentElement,
    zoom,
    pan,
    selectedElementIds,
    lassoPoints,
    laserPoints,
    activeLaserPos,
    selectedTool,
    isSpotlightActive,
    spotlightCenter,
  ]);

  // Fullscreen state: tracks whether in native browser fullscreen or CSS-expanded fallback
  const [isFullscreenFallback, setIsFullscreenFallback] = useState(false);

  // Handle Fullscreen API state changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNativeFs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );

      setIsFullscreen(isNativeFs);
      if (!isNativeFs) {
        setIsFullscreenFallback(false);
      }

      // Re-measure canvas and redraw on layout change
      requestAnimationFrame(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          canvas.width = Math.round(rect.width);
          canvas.height = Math.round(rect.height);
          redraw();
        }
      });
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [redraw]);

  const handleToggleFullscreen = async () => {
    const isCurrentlyFs = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );

    if (isCurrentlyFs || isFullscreenFallback) {
      // Exit fullscreen
      if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
        try {
          if (document.exitFullscreen) {
            await document.exitFullscreen();
          } else if ((document as any).webkitExitFullscreen) {
            await (document as any).webkitExitFullscreen();
          } else if ((document as any).mozCancelFullScreen) {
            await (document as any).mozCancelFullScreen();
          } else if ((document as any).msExitFullscreen) {
            await (document as any).msExitFullscreen();
          }
        } catch (err) {
          console.error('Error exiting full screen:', err);
        }
      }
      setIsFullscreen(false);
      setIsFullscreenFallback(false);
      showToast('Exited full screen mode');
    } else {
      // Enter fullscreen
      const el = containerRef.current;
      if (!el) return;

      const requestFs =
        el.requestFullscreen ||
        (el as any).webkitRequestFullscreen ||
        (el as any).mozRequestFullScreen ||
        (el as any).msRequestFullscreen;

      if (requestFs) {
        try {
          await requestFs.call(el);
          showToast('Entered full screen mode');
        } catch (err: any) {
          console.warn('Native requestFullscreen failed:', err);
          showToast('Browser blocked native full screen. Using expanded workspace view.');
          setIsFullscreenFallback(true);
          setIsFullscreen(true);
        }
      } else {
        showToast('Full screen API unsupported. Using expanded workspace view.');
        setIsFullscreenFallback(true);
        setIsFullscreen(true);
      }
    }
  };

  // Handle window and container resizing
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const targetW = Math.round(rect.width);
        const targetH = Math.round(rect.height);
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
          redraw();
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      observer = new ResizeObserver(() => handleResize());
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (observer) observer.disconnect();
    };
  }, [redraw]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // Laser Pointer Animation Loop
  useEffect(() => {
    if (laserPoints.length === 0) return;

    const loop = () => {
      const now = Date.now();
      const surviving = laserPoints.filter((pt) => now - pt.timestamp < 1200);
      if (surviving.length !== laserPoints.length) {
        setLaserPoints(surviving);
      }
      if (surviving.length > 0) {
        laserAnimRef.current = requestAnimationFrame(loop);
      }
    };

    laserAnimRef.current = requestAnimationFrame(loop);
    return () => {
      if (laserAnimRef.current) cancelAnimationFrame(laserAnimRef.current);
    };
  }, [laserPoints]);

  // Push Page History Snapshot
  const commitPageElements = (newElements: WhiteboardElement[]) => {
    elementsRef.current = newElements;
    setDoc((prev) => {
      const updatedPages = prev.pages.map((p) => {
        if (p.id !== prev.activePageId) return p;
        return {
          ...p,
          history: [...p.history, p.elements],
          redoStack: [],
          elements: newElements,
        };
      });
      return { ...prev, pages: updatedPages, updatedAt: Date.now() };
    });
    redraw();
  };

  // Convert browser client coords to canvas coordinates
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
    const screenX = (e.clientX - rect.left) * scaleX;
    const screenY = (e.clientY - rect.top) * scaleY;
    const x = screenX / zoom - pan.x;
    const y = screenY / zoom - pan.y;
    return {
      x: Number.isFinite(x) ? x : 0,
      y: Number.isFinite(y) ? y : 0,
    };
  };

  // POINTER DOWN
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Safe fallback
    }

    const { x, y } = getCanvasCoords(e);
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Broadcast teacher activity
    if (userRole === 'teacher') {
      broadcastTeacherActivity({
        module: 'whiteboard',
        subLocation: `Board: ${activePage.title}`,
        cursorPosition: { canvasX: x, canvasY: y },
      });
    }

    // 1. PAN TOOL
    if (selectedTool === 'pan' || e.button === 1 || (e.nativeEvent as any)?.spaceKey) {
      setIsDrawing(true);
      dragStartRef.current = { x: screenX, y: screenY };
      return;
    }

    // 2. SPOTLIGHT MODE
    if (isSpotlightActive) {
      setSpotlightCenter({ x: screenX, y: screenY });
      setIsDrawing(true);
      return;
    }

    // 3. LASER POINTER
    if (selectedTool === 'laser') {
      setIsDrawing(true);
      setActiveLaserPos({ x, y });
      activeLaserPosRef.current = { x, y };
      const pt = { x, y, timestamp: Date.now() };
      laserPointsRef.current = [pt];
      setLaserPoints([pt]);
      return;
    }

    // 4. LASSO SELECTION
    if (selectedTool === 'lasso') {
      setIsDrawing(true);
      setLassoPoints([{ x, y }]);
      setSelectedElementIds([]);
      return;
    }

    // 5. SELECT TOOL
    if (selectedTool === 'select') {
      // Check if user clicked an existing element with comfortable tolerance
      const hitElement = [...activePage.elements].reverse().find((el) => isPointInElement(x, y, el, 10));

      if (hitElement) {
        let movingIds: string[];
        if (selectedElementIds.includes(hitElement.id)) {
          movingIds = selectedElementIds;
        } else {
          movingIds = [hitElement.id];
          setSelectedElementIds([hitElement.id]);
        }
        activeMovingIdsRef.current = movingIds;
        dragStartRef.current = { x, y };
        dragInitialElementsRef.current = activePage.elements;
        preMoveSnapshotRef.current = activePage.elements;
        hasMovedRef.current = false;
        setIsDrawing(true);
      } else {
        setSelectedElementIds([]);
        activeMovingIdsRef.current = [];
        dragStartRef.current = null;
        preMoveSnapshotRef.current = null;
        hasMovedRef.current = false;
      }
      return;
    }

    // 6. ERASER (Partial-stroke)
    if (selectedTool === 'eraser') {
      preEraseSnapshotRef.current = elementsRef.current;
      hasErasedRef.current = false;
      lastPointerPosRef.current = { x, y };
      setIsDrawing(true);

      const container = containerRef.current;
      if (container) {
        const cRect = container.getBoundingClientRect();
        setCursorPos({ x: e.clientX - cRect.left, y: e.clientY - cRect.top });
      }

      const { nextElements, changed } = applyEraserToElements(
        elementsRef.current,
        { x, y },
        { x, y },
        eraserRadius
      );
      if (changed) {
        elementsRef.current = nextElements;
        setDoc((prev) => ({
          ...prev,
          pages: prev.pages.map((p) =>
            p.id === prev.activePageId ? { ...p, elements: nextElements } : p
          ),
        }));
        hasErasedRef.current = true;
        redraw();
      }
      return;
    }

    // 7. OBJECT ERASER (Whole object deletion)
    if (selectedTool === 'object-eraser') {
      preEraseSnapshotRef.current = elementsRef.current;
      hasErasedRef.current = false;
      lastPointerPosRef.current = { x, y };
      setIsDrawing(true);

      const container = containerRef.current;
      if (container) {
        const cRect = container.getBoundingClientRect();
        setCursorPos({ x: e.clientX - cRect.left, y: e.clientY - cRect.top });
      }

      const { nextElements, changed } = applyObjectEraser(
        elementsRef.current,
        { x, y },
        { x, y },
        eraserRadius
      );
      if (changed) {
        elementsRef.current = nextElements;
        setDoc((prev) => ({
          ...prev,
          pages: prev.pages.map((p) =>
            p.id === prev.activePageId ? { ...p, elements: nextElements } : p
          ),
        }));
        hasErasedRef.current = true;
        redraw();
      }
      return;
    }

    // 8. NATURAL TEXT (Click on canvas to type immediately)
    if (selectedTool === 'text') {
      setEditingText({
        x,
        y,
        text: '',
        fontSize: 20,
        textColor: strokeColor,
      });
      return;
    }

    // 9. STICKY NOTE (Click on canvas to place post-it note)
    if (selectedTool === 'sticky-note') {
      setEditingText({
        x,
        y,
        text: '',
        fontSize: 15,
        textColor: '#18181B',
        isSticky: true,
        bgColor: '#FEF08A',
      });
      return;
    }

    // 10. DRAWING SHAPES & CONNECTORS & STROKES
    setIsDrawing(true);

    const isFreehand =
      selectedTool === 'pen' ||
      selectedTool === 'pencil' ||
      selectedTool === 'highlighter';

    const isLinear =
      selectedTool === 'line' ||
      selectedTool === 'arrow' ||
      selectedTool === 'double-arrow' ||
      selectedTool === 'elbow-connector';

    let initialPoints: Point[] | undefined = undefined;
    let startX = x;
    let startY = y;

    if (isFreehand) {
      initialPoints = [{ x, y }];
    } else if (isLinear) {
      if (selectedTool === 'elbow-connector') {
        const snappedStart = snapToElementAnchor({ x, y }, activePage.elements, 16);
        startX = snappedStart.x;
        startY = snappedStart.y;
        initialPoints = [snappedStart, { ...snappedStart }];
      } else {
        initialPoints = [{ x, y }, { x, y }];
      }
    }

    dragStartRef.current = { x: startX, y: startY };

    const newEl: WhiteboardElement = {
      id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: selectedTool,
      color: strokeColor,
      fillColor: fillColor !== 'transparent' ? fillColor : undefined,
      strokeWidth,
      strokeDash,
      points: initialPoints,
      x: startX,
      y: startY,
      width: 0,
      height: 0,
    };

    setCurrentElement(newEl);
  };

  // POINTER MOVE
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x, y } = getCanvasCoords(e);
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    if (selectedTool === 'eraser' || selectedTool === 'object-eraser') {
      const container = containerRef.current;
      if (container) {
        const cRect = container.getBoundingClientRect();
        setCursorPos({ x: e.clientX - cRect.left, y: e.clientY - cRect.top });
      } else {
        setCursorPos({ x: screenX, y: screenY });
      }
    }

    // LASER POINTER (smooth, real-time tracking whether hovering or dragging)
    if (selectedTool === 'laser') {
      setActiveLaserPos({ x, y });
      activeLaserPosRef.current = { x, y };
      const now = Date.now();
      const newPt = { x, y, timestamp: now };
      const updated = [...laserPointsRef.current.filter((p) => now - p.timestamp < 1000), newPt].slice(-50);
      laserPointsRef.current = updated;
      setLaserPoints(updated);

      if (userRole === 'teacher') {
        broadcastTeacherActivity({
          module: 'whiteboard',
          subLocation: `Board: ${activePage.title}`,
          cursorPosition: { canvasX: x, canvasY: y },
        });
      }
      return;
    }

    if (!isDrawing) return;

    // 1. PANNING
    if (selectedTool === 'pan' && dragStartRef.current) {
      const dx = screenX - dragStartRef.current.x;
      const dy = screenY - dragStartRef.current.y;
      dragStartRef.current = { x: screenX, y: screenY };
      setPan((p) => ({ x: p.x + dx / zoom, y: p.y + dy / zoom }));
      return;
    }

    // 2. SPOTLIGHT
    if (isSpotlightActive) {
      setSpotlightCenter({ x: screenX, y: screenY });
      return;
    }

    // 3. LASSO
    if (selectedTool === 'lasso') {
      setLassoPoints((prev) => [...prev, { x, y }]);
      return;
    }

    // 5. MOVING SELECTED ELEMENTS
    if (selectedTool === 'select' && dragStartRef.current && activeMovingIdsRef.current.length > 0) {
      const dx = x - dragStartRef.current.x;
      const dy = y - dragStartRef.current.y;

      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        hasMovedRef.current = true;
      }

      const movingIds = activeMovingIdsRef.current;
      const updated = dragInitialElementsRef.current.map((el) => {
        if (movingIds.includes(el.id)) {
          return moveElement(el, dx, dy);
        }
        return el;
      });

      elementsRef.current = updated;
      setDoc((prev) => ({
        ...prev,
        pages: prev.pages.map((p) =>
          p.id === prev.activePageId ? { ...p, elements: updated } : p
        ),
      }));
      return;
    }

    // 6. CONTINUOUS ERASER (Partial-stroke)
    if (selectedTool === 'eraser') {
      const prevPos = lastPointerPosRef.current || { x, y };
      lastPointerPosRef.current = { x, y };

      const { nextElements, changed } = applyEraserToElements(
        elementsRef.current,
        prevPos,
        { x, y },
        eraserRadius
      );
      if (changed) {
        elementsRef.current = nextElements;
        setDoc((prev) => ({
          ...prev,
          pages: prev.pages.map((p) =>
            p.id === prev.activePageId ? { ...p, elements: nextElements } : p
          ),
        }));
        hasErasedRef.current = true;
        redraw();
      }
      return;
    }

    // 7. CONTINUOUS OBJECT ERASER
    if (selectedTool === 'object-eraser') {
      const prevPos = lastPointerPosRef.current || { x, y };
      lastPointerPosRef.current = { x, y };

      const { nextElements, changed } = applyObjectEraser(
        elementsRef.current,
        prevPos,
        { x, y },
        eraserRadius
      );
      if (changed) {
        elementsRef.current = nextElements;
        setDoc((prev) => ({
          ...prev,
          pages: prev.pages.map((p) =>
            p.id === prev.activePageId ? { ...p, elements: nextElements } : p
          ),
        }));
        hasErasedRef.current = true;
        redraw();
      }
      return;
    }

    // 8. SHAPES, CONNECTORS & FREEHAND DRAWING
    if (!currentElement) return;

    if (
      currentElement.type === 'pen' ||
      currentElement.type === 'pencil' ||
      currentElement.type === 'highlighter'
    ) {
      setCurrentElement((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          points: [...(prev.points || []), { x, y }],
        };
      });
    } else if (
      currentElement.type === 'rectangle' ||
      currentElement.type === 'rounded-rect' ||
      currentElement.type === 'ellipse' ||
      currentElement.type === 'triangle' ||
      currentElement.type.startsWith('flow-')
    ) {
      const originX = dragStartRef.current ? dragStartRef.current.x : (currentElement.x ?? x);
      const originY = dragStartRef.current ? dragStartRef.current.y : (currentElement.y ?? y);
      const minX = Math.min(originX, x);
      const minY = Math.min(originY, y);
      const w = Math.abs(x - originX);
      const h = Math.abs(y - originY);
      setCurrentElement((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          x: minX,
          y: minY,
          width: w,
          height: h,
        };
      });
    } else if (
      currentElement.type === 'line' ||
      currentElement.type === 'arrow' ||
      currentElement.type === 'double-arrow' ||
      currentElement.type === 'elbow-connector'
    ) {
      let targetPt = { x, y };
      if (currentElement.type === 'elbow-connector') {
        targetPt = snapToElementAnchor({ x, y }, activePage.elements, 16);
      }
      setCurrentElement((prev) => {
        if (!prev || !prev.points || prev.points.length === 0) return null;
        return {
          ...prev,
          points: [prev.points[0], targetPt],
        };
      });
    }
  };

  // POINTER UP / GESTURE FINALIZE
  const finalizeDrawingGesture = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (e) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Safe fallback
      }
    }

    // Pan ended
    if (selectedTool === 'pan') {
      setIsDrawing(false);
      dragStartRef.current = null;
      return;
    }

    // Laser pointer gesture ended (retains active position)
    if (selectedTool === 'laser') {
      setIsDrawing(false);
      return;
    }

    // Spotlight ended
    if (isSpotlightActive) {
      setIsDrawing(false);
      return;
    }

    // Lasso selection committed
    if (selectedTool === 'lasso') {
      setIsDrawing(false);
      if (lassoPoints.length >= 3) {
        const selected = activePage.elements
          .filter((el) => isElementInPolygon(el, lassoPoints))
          .map((el) => el.id);
        setSelectedElementIds(selected);
      }
      setLassoPoints([]);
      return;
    }

    // Selection move committed
    if (selectedTool === 'select') {
      setIsDrawing(false);
      dragStartRef.current = null;
      if (hasMovedRef.current && preMoveSnapshotRef.current) {
        const snapshot = preMoveSnapshotRef.current;
        setDoc((prev) => ({
          ...prev,
          pages: prev.pages.map((p) => {
            if (p.id !== prev.activePageId) return p;
            return {
              ...p,
              history: [...p.history, snapshot],
              redoStack: [],
            };
          }),
        }));
      }
      preMoveSnapshotRef.current = null;
      hasMovedRef.current = false;
      activeMovingIdsRef.current = [];
      return;
    }

    // Eraser gesture committed to history
    if (selectedTool === 'eraser' || selectedTool === 'object-eraser') {
      if (hasErasedRef.current && preEraseSnapshotRef.current) {
        const snapshot = preEraseSnapshotRef.current;
        setDoc((prev) => ({
          ...prev,
          pages: prev.pages.map((p) => {
            if (p.id !== prev.activePageId) return p;
            return {
              ...p,
              history: [...p.history, snapshot],
              redoStack: [],
            };
          }),
        }));
      }
      preEraseSnapshotRef.current = null;
      hasErasedRef.current = false;
      lastPointerPosRef.current = null;
      setIsDrawing(false);
      redraw();
      return;
    }

    // New element creation committed
    if (isDrawing && currentElement) {
      let finalEl = { ...currentElement };

      // Flowchart default node label if empty
      if (finalEl.type.startsWith('flow-') && !finalEl.text) {
        const labelMap: Record<string, string> = {
          'flow-process': 'Process Block',
          'flow-decision': 'Condition?',
          'flow-terminal': 'Start / End',
          'flow-io': 'Read / Write',
          'flow-document': 'Report',
        };
        finalEl.text = labelMap[finalEl.type] || 'Node';
      }

      // Validate & normalize geometric shapes
      if (
        finalEl.type === 'rectangle' ||
        finalEl.type === 'rounded-rect' ||
        finalEl.type === 'ellipse' ||
        finalEl.type === 'triangle' ||
        finalEl.type.startsWith('flow-')
      ) {
        const originX = dragStartRef.current ? dragStartRef.current.x : (finalEl.x ?? 0);
        const originY = dragStartRef.current ? dragStartRef.current.y : (finalEl.y ?? 0);
        const currentW = finalEl.width ?? 0;
        const currentH = finalEl.height ?? 0;
        const endX = (finalEl.x ?? 0) + currentW;
        const endY = (finalEl.y ?? 0) + currentH;

        finalEl.x = Math.min(originX, endX);
        finalEl.y = Math.min(originY, endY);
        finalEl.width = Math.max(Math.abs(currentW), Math.abs(endX - originX));
        finalEl.height = Math.max(Math.abs(currentH), Math.abs(endY - originY));

        if (finalEl.type.startsWith('flow-')) {
          if (finalEl.width < 4 && finalEl.height < 4) {
            // Default node placement on single click
            finalEl.width = 140;
            finalEl.height = 70;
            finalEl.x = originX - 70;
            finalEl.y = originY - 35;
          } else {
            finalEl.width = Math.max(40, finalEl.width);
            finalEl.height = Math.max(25, finalEl.height);
          }
        } else {
          // Discard accidental zero-size clicks (< 4px) for pure shapes
          if (finalEl.width < 4 && finalEl.height < 4) {
            setCurrentElement(null);
            setIsDrawing(false);
            dragStartRef.current = null;
            redraw();
            return;
          }
        }
      }

      // Validate linear elements (line, arrow, double-arrow, elbow-connector)
      if (
        finalEl.type === 'line' ||
        finalEl.type === 'arrow' ||
        finalEl.type === 'double-arrow' ||
        finalEl.type === 'elbow-connector'
      ) {
        if (!finalEl.points || finalEl.points.length < 2) {
          setCurrentElement(null);
          setIsDrawing(false);
          dragStartRef.current = null;
          redraw();
          return;
        }
        const p1 = finalEl.points[0];
        const p2 = finalEl.points[1];
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        // Discard accidental zero-length clicks
        if (dist < 4) {
          setCurrentElement(null);
          setIsDrawing(false);
          dragStartRef.current = null;
          redraw();
          return;
        }
      }

      // Validate freehand strokes
      if (
        finalEl.type === 'pen' ||
        finalEl.type === 'pencil' ||
        finalEl.type === 'highlighter'
      ) {
        if (!finalEl.points || finalEl.points.length === 0) {
          setCurrentElement(null);
          setIsDrawing(false);
          dragStartRef.current = null;
          redraw();
          return;
        }
      }

      commitPageElements([...activePage.elements, finalEl]);
      setCurrentElement(null);
    }

    setIsDrawing(false);
    dragStartRef.current = null;
  };

  // Commit Natural Text Annotation
  const handleSaveTextAnnotation = () => {
    if (!editingText || !editingText.text.trim()) {
      setEditingText(null);
      return;
    }

    if (editingText.id) {
      // Update existing
      const updated = activePage.elements.map((el) => {
        if (el.id === editingText.id) {
          return {
            ...el,
            text: editingText.text,
            fontSize: editingText.fontSize,
            textColor: editingText.textColor,
          };
        }
        return el;
      });
      commitPageElements(updated);
    } else {
      // Create new
      const newEl: WhiteboardElement = {
        id: `text-${Date.now()}`,
        type: editingText.isSticky ? 'sticky-note' : 'text',
        color: editingText.textColor,
        textColor: editingText.textColor,
        backgroundColor: editingText.bgColor,
        strokeWidth: 1,
        fontSize: editingText.fontSize,
        x: editingText.x,
        y: editingText.y,
        width: editingText.isSticky ? 180 : undefined,
        height: editingText.isSticky ? 150 : undefined,
        text: editingText.text,
      };
      commitPageElements([...activePage.elements, newEl]);
    }

    setEditingText(null);
  };

  // Double click on canvas to re-edit existing text
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const x = screenX / zoom - pan.x;
    const y = screenY / zoom - pan.y;

    const hit = [...activePage.elements]
      .reverse()
      .find((el) => (el.type === 'text' || el.type === 'sticky-note' || el.type.startsWith('flow-')) && isPointInElement(x, y, el));

    if (hit && hit.text !== undefined) {
      setEditingText({
        id: hit.id,
        x: hit.x || x,
        y: hit.y || y,
        text: hit.text,
        fontSize: hit.fontSize || (hit.type.startsWith('flow-') ? 13 : 16),
        textColor: hit.textColor || (hit.type.startsWith('flow-') ? '#F5F5F5' : strokeColor),
        isSticky: hit.type === 'sticky-note',
        bgColor: hit.backgroundColor,
      });
    }
  };

  // UNDO & REDO
  const handleUndo = () => {
    if (activePage.history.length === 0) return;
    const prev = activePage.history[activePage.history.length - 1];
    elementsRef.current = prev;

    setDoc((d) => ({
      ...d,
      pages: d.pages.map((p) => {
        if (p.id !== d.activePageId) return p;
        return {
          ...p,
          redoStack: [...p.redoStack, p.elements],
          elements: prev,
          history: p.history.slice(0, -1),
        };
      }),
    }));
    redraw();
  };

  const handleRedo = () => {
    if (activePage.redoStack.length === 0) return;
    const next = activePage.redoStack[activePage.redoStack.length - 1];
    elementsRef.current = next;

    setDoc((d) => ({
      ...d,
      pages: d.pages.map((p) => {
        if (p.id !== d.activePageId) return p;
        return {
          ...p,
          history: [...p.history, p.elements],
          elements: next,
          redoStack: p.redoStack.slice(0, -1),
        };
      }),
    }));
    redraw();
  };

  // CLEAR PAGE
  const handleClearPage = () => {
    if (activePage.elements.length === 0) return;
    commitPageElements([]);
    setSelectedElementIds([]);
    showToast(`Page "${activePage.title}" cleared`);
  };

  // SELECTION ACTIONS
  const handleDuplicateSelected = () => {
    if (selectedElementIds.length === 0) return;
    const newElements: WhiteboardElement[] = [];
    const newSelectedIds: string[] = [];

    activePage.elements.forEach((el) => {
      newElements.push(el);
      if (selectedElementIds.includes(el.id)) {
        const dup = duplicateElement(el);
        newElements.push(dup);
        newSelectedIds.push(dup.id);
      }
    });

    commitPageElements(newElements);
    setSelectedElementIds(newSelectedIds);
    showToast('Elements duplicated');
  };

  const handleDeleteSelected = () => {
    if (selectedElementIds.length === 0) return;
    const remaining = activePage.elements.filter((el) => !selectedElementIds.includes(el.id));
    commitPageElements(remaining);
    setSelectedElementIds([]);
    showToast('Selected elements deleted');
  };

  const handleBringForward = () => {
    if (selectedElementIds.length === 0) return;
    const selected = activePage.elements.filter((el) => selectedElementIds.includes(el.id));
    const others = activePage.elements.filter((el) => !selectedElementIds.includes(el.id));
    commitPageElements([...others, ...selected]);
  };

  const handleSendBackward = () => {
    if (selectedElementIds.length === 0) return;
    const selected = activePage.elements.filter((el) => selectedElementIds.includes(el.id));
    const others = activePage.elements.filter((el) => !selectedElementIds.includes(el.id));
    commitPageElements([...selected, ...others]);
  };

  const handleUpdateSelectedProps = (props: Partial<WhiteboardElement>) => {
    if (selectedElementIds.length === 0) return;
    const updated = activePage.elements.map((el) => {
      if (selectedElementIds.includes(el.id)) {
        return { ...el, ...props };
      }
      return el;
    });
    elementsRef.current = updated;
    setDoc((prev) => ({
      ...prev,
      pages: prev.pages.map((p) =>
        p.id === prev.activePageId ? { ...p, elements: updated } : p
      ),
    }));
    redraw();
  };

  // PAGE MANAGEMENT
  const handleAddPage = () => {
    const newPageNum = doc.pages.length + 1;
    const newPage: WhiteboardPage = {
      id: `page-${Date.now()}`,
      title: `${newPageNum}. Blank Canvas`,
      background: 'dark-grid',
      elements: [],
      history: [],
      redoStack: [],
      viewport: { zoom: 1, pan: { x: 0, y: 0 } },
    };

    setDoc((prev) => ({
      ...prev,
      pages: [...prev.pages, newPage],
      activePageId: newPage.id,
      updatedAt: Date.now(),
    }));
    showToast(`Page ${newPageNum} added`);
  };

  const handleDuplicatePage = (pageId: string) => {
    const target = doc.pages.find((p) => p.id === pageId);
    if (!target) return;

    const duplicated: WhiteboardPage = {
      ...target,
      id: `page-${Date.now()}`,
      title: `${target.title} (Copy)`,
      elements: target.elements.map((el) => duplicateElement(el, 0)),
      history: [],
      redoStack: [],
    };

    const targetIdx = doc.pages.findIndex((p) => p.id === pageId);
    const updated = [...doc.pages];
    updated.splice(targetIdx + 1, 0, duplicated);

    setDoc((prev) => ({
      ...prev,
      pages: updated,
      activePageId: duplicated.id,
      updatedAt: Date.now(),
    }));
    showToast(`Duplicated "${target.title}"`);
  };

  const handleDeletePage = (pageId: string) => {
    if (doc.pages.length <= 1) {
      showToast('Cannot delete the only page in document');
      return;
    }

    const remaining = doc.pages.filter((p) => p.id !== pageId);
    const nextActive = doc.activePageId === pageId ? remaining[0].id : doc.activePageId;

    setDoc((prev) => ({
      ...prev,
      pages: remaining,
      activePageId: nextActive,
      updatedAt: Date.now(),
    }));
    showToast('Page deleted');
  };

  const handleRenamePage = (pageId: string, newTitle: string) => {
    setDoc((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => (p.id === pageId ? { ...p, title: newTitle } : p)),
    }));
  };

  const handleMovePage = (pageId: string, direction: 'up' | 'down') => {
    const idx = doc.pages.findIndex((p) => p.id === pageId);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= doc.pages.length) return;

    const pages = [...doc.pages];
    const [moved] = pages.splice(idx, 1);
    pages.splice(targetIdx, 0, moved);

    setDoc((prev) => ({ ...prev, pages }));
  };

  const handleSetBackground = (bg: BackgroundType) => {
    setDoc((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => (p.id === prev.activePageId ? { ...p, background: bg } : p)),
    }));
  };

  // EXPORTS
  const handleExportPNG = async () => {
    const idx = doc.pages.findIndex((p) => p.id === doc.activePageId);
    await exportPageToPNG(activePage, idx);
    showToast('Page exported as PNG');
  };

  const handleExportZIP = async () => {
    await exportAllPagesToZIP(doc);
    showToast('All pages exported to ZIP');
  };

  const handleExportPDF = async () => {
    await exportDocumentToPDF(doc);
    showToast('Exported multi-page PDF');
  };

  const handleExportJSON = () => {
    exportDocumentToJSON(doc);
    showToast('Exported project JSON');
  };

  const handleImportJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const { valid, doc: importedDoc, error } = importDocumentFromJSON(content);
      if (valid && importedDoc) {
        setDoc(importedDoc);
        showToast('Document imported successfully');
      } else {
        showToast(`Import failed: ${error || 'Invalid file format'}`);
      }
    };
    reader.readAsText(file);
  };

  const handleInsertEquation = () => {
    if (!latexInput.trim()) return;
    const newEl: WhiteboardElement = {
      id: `eq-${Date.now()}`,
      type: 'equation',
      color: strokeColor,
      strokeWidth: 2,
      x: 180 - pan.x,
      y: 220 - pan.y,
      text: latexInput,
    };
    commitPageElements([...activePage.elements, newEl]);
    setEquationModalOpen(false);
    showToast('Equation inserted to whiteboard');
  };

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ONLY trigger shortcuts if Whiteboard is the active module
      if (activeModule !== 'whiteboard') return;

      // Do not trigger canvas shortcuts while typing in inputs, textareas, contenteditable, or Monaco Editor
      const target = e.target as HTMLElement | null;
      const activeEl = document.activeElement as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable ||
        Boolean(target?.closest('.monaco-editor')) ||
        Boolean(activeEl?.closest('.monaco-editor')) ||
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl?.isContentEditable ||
        editingText !== null
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElementIds.length > 0) {
          e.preventDefault();
          handleDeleteSelected();
        }
      } else if (e.key === 'Escape') {
        setSelectedElementIds([]);
        setIsSpotlightActive(false);
        setEditingText(null);
        if (isFullscreen || isFullscreenFallback) {
          if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          }
          setIsFullscreen(false);
          setIsFullscreenFallback(false);
        }
      } else if (e.key === 'v' || e.key === 'V') {
        setSelectedTool('select');
      } else if (e.key === 'p' || e.key === 'P') {
        setSelectedTool('pen');
      } else if (e.key === 'e' || e.key === 'E') {
        setSelectedTool('eraser');
      } else if (e.key === 't' || e.key === 'T') {
        setSelectedTool('text');
      } else if (e.key === 'h' || e.key === 'H') {
        setSelectedTool('pan');
      } else if (e.key === 'r' || e.key === 'R') {
        setSelectedTool('rectangle');
      } else if (e.key === 'a' || e.key === 'A') {
        setSelectedTool('arrow');
      } else if (e.key === 'c' || e.key === 'C') {
        setSelectedTool('elbow-connector');
      } else if (e.key === 'f' || e.key === 'F') {
        setSelectedTool('flow-process');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementIds, activePage, editingText, isFullscreen, isFullscreenFallback, activeModule]);

  return (
    <div
      ref={containerRef}
      className={`flex-1 flex flex-col h-full bg-[#0B0C0E] relative overflow-hidden select-none ${
        isFullscreen || isFullscreenFallback ? 'fixed inset-0 z-50 w-full h-full' : ''
      }`}
    >
      {/* 1. TOP TOOLBAR & PRIMARY TOOL PALETTE */}
      <WhiteboardToolbar
        document={doc}
        selectedTool={selectedTool}
        background={activePage.background}
        zoom={zoom}
        canUndo={activePage.history.length > 0}
        canRedo={activePage.redoStack.length > 0}
        isNavigatorOpen={isNavigatorOpen}
        isSpotlightActive={isSpotlightActive}
        isSnapToGrid={snapToGrid}
        isFullscreen={isFullscreen}
        onSelectTool={setSelectedTool}
        onToggleNavigator={() => setIsNavigatorOpen(!isNavigatorOpen)}
        onSetBackground={handleSetBackground}
        onZoomIn={() => setZoom((z) => Math.min(2.5, z + 0.25))}
        onZoomOut={() => setZoom((z) => Math.max(0.5, z - 0.25))}
        onZoomFit={() => {
          setZoom(1);
          setPan({ x: 0, y: 0 });
        }}
        onToggleFullscreen={handleToggleFullscreen}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClearPage={handleClearPage}
        onOpenEquationModal={() => setEquationModalOpen(true)}
        onToggleSpotlight={() => setIsSpotlightActive(!isSpotlightActive)}
        onToggleSnapToGrid={() => setSnapToGrid(!snapToGrid)}
        onExportPNG={handleExportPNG}
        onExportZIP={handleExportZIP}
        onExportPDF={handleExportPDF}
        onExportJSON={handleExportJSON}
        onImportJSON={handleImportJSON}
        onRenameDocument={(title) => setDoc((d) => ({ ...d, title }))}
      />

      {/* 2. FLOATING CONTEXTUAL PROPERTIES BAR */}
      <WhiteboardContextBar
        selectedTool={selectedTool}
        strokeColor={strokeColor}
        fillColor={fillColor}
        strokeWidth={strokeWidth}
        strokeDash={strokeDash}
        selectedElements={activePage.elements.filter((el) => selectedElementIds.includes(el.id))}
        onSetStrokeColor={setStrokeColor}
        onSetFillColor={setFillColor}
        onSetStrokeWidth={setStrokeWidth}
        onSetStrokeDash={setStrokeDash}
        onSetTool={setSelectedTool}
        onDuplicateSelected={handleDuplicateSelected}
        onDeleteSelected={handleDeleteSelected}
        onBringForward={handleBringForward}
        onSendBackward={handleSendBackward}
        onUpdateSelectedProps={handleUpdateSelectedProps}
      />

      {/* 3. COLLAPSIBLE PAGE NAVIGATOR THUMBNAIL PANEL */}
      <WhiteboardPageNavigator
        document={doc}
        activePageId={doc.activePageId}
        isOpen={isNavigatorOpen}
        onClose={() => setIsNavigatorOpen(false)}
        onSelectPage={(id) => setDoc((d) => ({ ...d, activePageId: id }))}
        onAddPage={handleAddPage}
        onDuplicatePage={handleDuplicatePage}
        onDeletePage={handleDeletePage}
        onRenamePage={handleRenamePage}
        onMovePage={handleMovePage}
      />

      {/* 4. MASTER CANVAS ELEMENT */}
      <canvas
        ref={canvasRef}
        data-testid="whiteboard-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finalizeDrawingGesture}
        onPointerCancel={finalizeDrawingGesture}
        onLostPointerCapture={finalizeDrawingGesture}
        onDoubleClick={handleDoubleClick}
        onPointerLeave={() => {
          setCursorPos(null);
          if (selectedTool === 'laser') {
            setActiveLaserPos(null);
            activeLaserPosRef.current = null;
            setLaserPoints([]);
            laserPointsRef.current = [];
          }
          if (!isDrawing) lastPointerPosRef.current = null;
        }}
        className={`w-full h-full touch-none select-none ${
          selectedTool === 'eraser' || selectedTool === 'object-eraser'
            ? 'cursor-none'
            : selectedTool === 'laser'
            ? 'cursor-none'
            : selectedTool === 'select'
            ? 'cursor-default'
            : selectedTool === 'pan'
            ? 'cursor-grab active:cursor-grabbing'
            : selectedTool === 'text'
            ? 'cursor-text'
            : 'cursor-crosshair'
        }`}
      />

      {/* 5. VISUAL ERASER RETICLE OVERLAY */}
      {(selectedTool === 'eraser' || selectedTool === 'object-eraser') && cursorPos && (
        <div
          data-testid="whiteboard-eraser-cursor"
          className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80 ${
            selectedTool === 'object-eraser'
              ? 'bg-[#EF4444]/35 ring-2 ring-dashed ring-[#EF4444]'
              : 'bg-[#EF4444]/25 ring-2 ring-[#EF4444]'
          } shadow-lg z-30`}
          style={{
            left: cursorPos.x,
            top: cursorPos.y,
            width: Math.round(eraserRadius * 2 * zoom),
            height: Math.round(eraserRadius * 2 * zoom),
          }}
        />
      )}

      {/* 6. NATURAL INLINE TEXT / STICKY NOTE EDITOR */}
      {editingText && (
        <div
          className="absolute z-30"
          style={{
            left: (editingText.x + pan.x) * zoom,
            top: (editingText.y + pan.y) * zoom,
          }}
        >
          {editingText.isSticky ? (
            <div className="p-3 rounded-lg border border-[#EAB308] bg-[#FEF08A] shadow-2xl text-[#18181B] w-52">
              <textarea
                autoFocus
                value={editingText.text}
                placeholder="Type sticky note..."
                onChange={(e) => setEditingText({ ...editingText, text: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.shiftKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSaveTextAnnotation();
                  } else if (e.key === 'Escape') {
                    setEditingText(null);
                  }
                }}
                rows={4}
                style={{ fontSize: `${Math.max(12, (editingText.fontSize || 15) * zoom)}px` }}
                className="w-full bg-transparent resize-none focus:outline-none leading-relaxed text-[#18181B] font-medium"
              />
              <div className="flex items-center justify-between pt-1.5 border-t border-black/10 mt-1">
                <span className="text-[10px] text-zinc-600">Shift+Enter to place</span>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setEditingText(null)}
                    className="px-2 py-0.5 rounded text-[10px] text-zinc-700 hover:text-black"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveTextAnnotation}
                    className="px-2.5 py-0.5 rounded bg-zinc-900 hover:bg-black text-white font-semibold text-[10px]"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-[#06B6D4]/60 bg-[#111216]/95 backdrop-blur-md shadow-2xl p-2 min-w-[220px]">
              <textarea
                autoFocus
                value={editingText.text}
                placeholder="Type text here..."
                onChange={(e) => setEditingText({ ...editingText, text: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.shiftKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSaveTextAnnotation();
                  } else if (e.key === 'Escape') {
                    setEditingText(null);
                  }
                }}
                rows={Math.max(2, editingText.text.split('\n').length)}
                style={{
                  fontSize: `${Math.max(14, (editingText.fontSize || 20) * zoom)}px`,
                  color: editingText.textColor || '#F5F5F5',
                  lineHeight: '1.4',
                }}
                className="w-full bg-transparent resize-none focus:outline-none font-sans font-medium"
              />
              <div className="flex items-center justify-between pt-1.5 border-t border-white/10 mt-1">
                <span className="text-[10px] text-[#A1A1AA]">Shift+Enter to commit</span>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setEditingText(null)}
                    className="px-2 py-0.5 rounded text-[10px] text-[#A1A1AA] hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveTextAnnotation}
                    className="px-2.5 py-0.5 rounded bg-[#06B6D4] hover:bg-[#0891B2] text-black font-semibold text-[10px]"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 7. EQUATION MODAL */}
      {equationModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-[#282A36] bg-[#111216] p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-semibold text-white">Insert Math Equation / Recurrence</h3>
            <div>
              <label className="block text-[11px] text-[#A1A1AA] mb-1">
                Mathematical Expression (LaTeX / Plain Text)
              </label>
              <input
                type="text"
                value={latexInput}
                onChange={(e) => setLatexInput(e.target.value)}
                className="w-full bg-[#15161C] border border-[#282A36] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#FF9100]"
                placeholder="e.g. T(n) = 2T(n/2) + O(n)"
              />
            </div>
            <div className="p-3 rounded-lg bg-[#0B0C0E] border border-[#282A36]">
              <span className="text-[10px] text-[#71717A] uppercase font-mono block mb-1">Preview</span>
              <div className="font-mono text-sm text-[#06B6D4] italic">{latexInput}</div>
            </div>
            <div className="flex items-center justify-end space-x-2">
              <button
                onClick={() => setEquationModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-[#282A36] text-xs text-[#A1A1AA] hover:bg-[#15161C]"
              >
                Cancel
              </button>
              <button
                onClick={handleInsertEquation}
                className="px-4 py-1.5 rounded-lg bg-[#FF9100] text-black font-semibold text-xs hover:bg-[#E08000]"
              >
                Place on Canvas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
