import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useClassroom } from '@/context/ClassroomContext';
import { useFollowTeacher } from '@/context/FollowTeacherContext';
import {
  PresentationDeck,
  Slide,
  AnnotationTool,
  SlideAnnotation,
  PresentationSyncMessage,
} from '@/types/presentation';
import {
  DEFAULT_PRESENTATION_DECK,
  createNewBlankSlide,
} from './presentationDefaults';
import {
  loadPresentationDeck,
  savePresentationDeck,
  loadPresentationFromServer,
  savePresentationToServer,
} from './presentationPersistence';
import { SlideThumbnailList } from './SlideThumbnailList';
import { SlideEditorDrawer } from './SlideEditorDrawer';
import { SlideAnnotationCanvas } from './SlideAnnotationCanvas';
import { PresentationImportModal } from './PresentationImportModal';
import {
  ChevronLeft,
  ChevronRight,
  Pointer,
  PenTool,
  RotateCcw,
  Maximize,
  Minimize,
  Radio,
  Upload,
  Layers,
  FileText,
  Sliders,
  Check,
  Undo2,
} from 'lucide-react';

export const PresentationModule: React.FC = () => {
  const { userRole, showToast, session, activeModule } = useClassroom();
  const { teacherActivity, followMode, broadcastTeacherActivity } = useFollowTeacher();

  const isTeacher = userRole === 'teacher';
  const isStudent = userRole === 'student';

  // DOM Refs
  const containerRef = useRef<HTMLDivElement | null>(null);
  const slideRef = useRef<HTMLDivElement | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const lastBroadcastTimeRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Deck State
  const [deck, setDeck] = useState<PresentationDeck>(() => loadPresentationDeck());
  const [saveStatus, setSaveStatus] = useState<'Saved' | 'Saving...' | 'Save failed'>('Saved');
  const versionRef = useRef<number>(1);
  const classroomId = session?.id || '';

  // Server presentation load on mount
  useEffect(() => {
    if (!classroomId || typeof window === 'undefined') return;
    let isMounted = true;
    loadPresentationFromServer(classroomId, classroomId).then((serverData) => {
      if (!isMounted || !serverData) return;
      versionRef.current = serverData.version;
      setDeck(serverData.deck);
    });
    return () => { isMounted = false; };
  }, [classroomId]);

  // Annotation and Pointer Tool State
  const [activeTool, setActiveTool] = useState<AnnotationTool>('none');
  const [penColor, setPenColor] = useState<string>('#06B6D4');
  const [penWidth, setPenWidth] = useState<number>(2);

  // Laser Pointer State
  const [laserPos, setLaserPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [isPointerOverSlide, setIsPointerOverSlide] = useState(false);

  // Remote synchronized pointer for students
  const [remoteLaserPos, setRemoteLaserPos] = useState<{ x: number; y: number } | null>(null);
  const [isRemoteLaserActive, setIsRemoteLaserActive] = useState(false);
  const [remoteLaserSlideIndex, setRemoteLaserSlideIndex] = useState<number | null>(null);

  // UI Panels State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(true);

  // Fullscreen State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFullscreenFallback, setIsFullscreenFallback] = useState(false);

  // Derived Active Slide
  const currentSlideIndex = useMemo(() => {
    const idx = deck.slides.findIndex((s) => s.id === deck.activeSlideId);
    return idx >= 0 ? idx : 0;
  }, [deck.slides, deck.activeSlideId]);

  const currentSlide = deck.slides[currentSlideIndex] || deck.slides[0];

  // Laser active flag for backward compatibility and styling
  const isLaserActive = activeTool === 'laser';

  // Debounced persistence helper
  const triggerSave = useCallback((newDeck: PresentationDeck) => {
    setSaveStatus('Saving...');
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(async () => {
      const ok = savePresentationDeck(newDeck);
      if (classroomId && isTeacher) {
        const res = await savePresentationToServer(classroomId, classroomId, newDeck, currentSlideIndex, true, versionRef.current);
        if (res.success && res.version) {
          versionRef.current = res.version;
          setSaveStatus('Saved');
        } else {
          setSaveStatus(ok ? 'Saved' : 'Save failed');
        }
      } else {
        setSaveStatus(ok ? 'Saved' : 'Save failed');
      }
    }, 400);
  }, [classroomId, isTeacher, currentSlideIndex]);

  // Initialize cross-tab / cross-window BroadcastChannel for real-time synchronization
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel('cortex_presentation_sync');
        broadcastChannelRef.current = channel;

        channel.onmessage = (event: MessageEvent<PresentationSyncMessage>) => {
          const msg = event.data;
          if (!msg || msg.sessionId !== session?.id) return;

          if (msg.type === 'SLIDE_CHANGE') {
            if (isStudent && followMode === 'following') {
              setDeck((prev) => {
                const targetSlide = prev.slides[msg.slideIndex];
                if (targetSlide) {
                  return { ...prev, activeSlideId: targetSlide.id };
                }
                return prev;
              });
              setRemoteLaserSlideIndex(msg.slideIndex);
            }
          } else if (msg.type === 'LASER_MOVE') {
            if (isStudent) {
              setRemoteLaserSlideIndex(msg.slideIndex);
              setIsRemoteLaserActive(msg.laserActive);
              if (msg.laserPos) {
                setRemoteLaserPos(msg.laserPos);
              }
            }
          } else if (msg.type === 'LASER_TOGGLE') {
            if (isStudent) {
              setIsRemoteLaserActive(msg.laserActive);
              if (!msg.laserActive) {
                setRemoteLaserPos(null);
              }
            }
          }
        };

        return () => {
          channel.close();
          broadcastChannelRef.current = null;
        };
      } catch {
        // Safe fallback if BroadcastChannel restricted in environment
      }
    }
  }, [session?.id, isStudent, followMode]);

  // Synchronize student slide from FollowTeacherContext in single-window/test contexts
  useEffect(() => {
    if (isStudent && followMode === 'following') {
      if (teacherActivity.module === 'presentation' && teacherActivity.cursorPosition?.slideIndex !== undefined) {
        const targetIndex = teacherActivity.cursorPosition.slideIndex;
        if (targetIndex >= 0 && targetIndex < deck.slides.length && targetIndex !== currentSlideIndex) {
          const targetSlide = deck.slides[targetIndex];
          if (targetSlide) {
            setDeck((prev) => ({ ...prev, activeSlideId: targetSlide.id }));
          }
        }
      }
    }
  }, [isStudent, followMode, teacherActivity, currentSlideIndex, deck.slides]);

  // Synchronize student laser pointer from FollowTeacherContext
  useEffect(() => {
    if (isStudent) {
      if (
        teacherActivity.module === 'presentation' &&
        teacherActivity.cursorPosition?.laserActive &&
        teacherActivity.cursorPosition?.slideIndex === currentSlideIndex &&
        teacherActivity.cursorPosition.laserX !== undefined &&
        teacherActivity.cursorPosition.laserY !== undefined
      ) {
        setIsRemoteLaserActive(true);
        setRemoteLaserPos({
          x: teacherActivity.cursorPosition.laserX,
          y: teacherActivity.cursorPosition.laserY,
        });
        setRemoteLaserSlideIndex(teacherActivity.cursorPosition.slideIndex);
      } else {
        setIsRemoteLaserActive(false);
        setRemoteLaserPos(null);
      }
    }
  }, [isStudent, teacherActivity, currentSlideIndex]);

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
  }, []);

  // Broadcast laser pointer updates
  const broadcastLaserUpdate = useCallback(
    (active: boolean, pos?: { x: number; y: number }) => {
      const now = Date.now();
      if (!active || now - lastBroadcastTimeRef.current >= 30) {
        lastBroadcastTimeRef.current = now;

        broadcastTeacherActivity({
          module: 'presentation',
          subLocation: `Slide ${currentSlideIndex + 1}: ${deck.slides[currentSlideIndex]?.title || ''}`,
          cursorPosition: {
            slideIndex: currentSlideIndex,
            laserX: pos?.x,
            laserY: pos?.y,
            laserActive: active,
          },
        });

        if (broadcastChannelRef.current) {
          try {
            broadcastChannelRef.current.postMessage({
              type: active ? 'LASER_MOVE' : 'LASER_TOGGLE',
              sessionId: session?.id || 'cs201-algorithms-live',
              slideIndex: currentSlideIndex,
              laserActive: active,
              laserPos: pos,
              timestamp: now,
            });
          } catch {}
        }
      }
    },
    [broadcastTeacherActivity, currentSlideIndex, deck.slides, session?.id]
  );

  // Broadcast slide changes
  const broadcastSlideChange = useCallback(
    (slideIdx: number) => {
      if (isTeacher) {
        broadcastTeacherActivity({
          module: 'presentation',
          subLocation: `Slide ${slideIdx + 1}: ${deck.slides[slideIdx]?.title || ''}`,
          cursorPosition: {
            slideIndex: slideIdx,
            laserActive: false,
          },
        });

        if (broadcastChannelRef.current) {
          try {
            broadcastChannelRef.current.postMessage({
              type: 'SLIDE_CHANGE',
              sessionId: session?.id || 'cs201-algorithms-live',
              slideIndex: slideIdx,
              laserActive: false,
              timestamp: Date.now(),
            });
          } catch {}
        }
      }
    },
    [isTeacher, broadcastTeacherActivity, deck.slides, session?.id]
  );

  // Slide Navigation Handlers
  const handleNextSlide = () => {
    if (currentSlideIndex < deck.slides.length - 1) {
      const nextIndex = currentSlideIndex + 1;
      const nextSlide = deck.slides[nextIndex];
      setDeck((prev) => ({ ...prev, activeSlideId: nextSlide.id }));
      setIsPointerOverSlide(false);
      broadcastSlideChange(nextIndex);
    }
  };

  const handlePrevSlide = () => {
    if (currentSlideIndex > 0) {
      const prevIndex = currentSlideIndex - 1;
      const prevSlide = deck.slides[prevIndex];
      setDeck((prev) => ({ ...prev, activeSlideId: prevSlide.id }));
      setIsPointerOverSlide(false);
      broadcastSlideChange(prevIndex);
    }
  };

  const handleSelectSlide = (slideId: string) => {
    const idx = deck.slides.findIndex((s) => s.id === slideId);
    if (idx >= 0 && idx !== currentSlideIndex) {
      setDeck((prev) => ({ ...prev, activeSlideId: slideId }));
      setIsPointerOverSlide(false);
      broadcastSlideChange(idx);
    }
  };

  // Slide Management Handlers
  const handleAddSlide = () => {
    const newSlide = createNewBlankSlide(deck.slides.length + 1);
    const insertIndex = currentSlideIndex + 1;
    const nextSlides = [
      ...deck.slides.slice(0, insertIndex),
      newSlide,
      ...deck.slides.slice(insertIndex),
    ];
    const newDeck: PresentationDeck = {
      ...deck,
      slides: nextSlides,
      activeSlideId: newSlide.id,
    };
    setDeck(newDeck);
    triggerSave(newDeck);
    showToast(`Added Slide ${insertIndex + 1}`);
  };

  const handleDuplicateSlide = (slideId: string) => {
    const idx = deck.slides.findIndex((s) => s.id === slideId);
    if (idx === -1) return;

    const sourceSlide = deck.slides[idx];
    const newId = `slide_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const duplicatedSlide: Slide = {
      ...sourceSlide,
      id: newId,
      title: `${sourceSlide.title} (Copy)`,
      bullets: [...sourceSlide.bullets],
      annotations: sourceSlide.annotations
        ? {
            strokes: sourceSlide.annotations.strokes.map((s) => ({
              ...s,
              id: `stroke_${Math.random().toString(36).substring(2, 6)}`,
              points: [...s.points],
            })),
          }
        : { strokes: [] },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const nextSlides = [
      ...deck.slides.slice(0, idx + 1),
      duplicatedSlide,
      ...deck.slides.slice(idx + 1),
    ];
    const newDeck: PresentationDeck = {
      ...deck,
      slides: nextSlides,
      activeSlideId: newId,
    };
    setDeck(newDeck);
    triggerSave(newDeck);
    showToast(`Duplicated slide "${sourceSlide.title}"`);
  };

  const handleDeleteSlide = (slideId: string) => {
    if (deck.slides.length <= 1) {
      showToast('Cannot delete the only slide in the presentation deck');
      return;
    }

    const idx = deck.slides.findIndex((s) => s.id === slideId);
    if (idx === -1) return;

    const deletedTitle = deck.slides[idx].title;
    const nextSlides = deck.slides.filter((s) => s.id !== slideId);

    // Determine new active slide
    const nextActiveIndex = Math.min(idx, nextSlides.length - 1);
    const nextActiveId = nextSlides[nextActiveIndex].id;

    const newDeck: PresentationDeck = {
      ...deck,
      slides: nextSlides,
      activeSlideId: nextActiveId,
    };
    setDeck(newDeck);
    triggerSave(newDeck);
    showToast(`Deleted slide "${deletedTitle}"`);
  };

  const handleMoveSlide = (slideId: string, direction: 'up' | 'down') => {
    const idx = deck.slides.findIndex((s) => s.id === slideId);
    if (idx === -1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= deck.slides.length) return;

    const nextSlides = [...deck.slides];
    const [moved] = nextSlides.splice(idx, 1);
    nextSlides.splice(targetIdx, 0, moved);

    const newDeck: PresentationDeck = {
      ...deck,
      slides: nextSlides,
    };
    setDeck(newDeck);
    triggerSave(newDeck);
  };

  // Content Editing Handler
  const handleUpdateActiveSlide = (updated: Partial<Slide>) => {
    const nextSlides = deck.slides.map((s) => {
      if (s.id === currentSlide.id) {
        return { ...s, ...updated, updatedAt: Date.now() };
      }
      return s;
    });
    const newDeck: PresentationDeck = { ...deck, slides: nextSlides };
    setDeck(newDeck);
    triggerSave(newDeck);
  };

  // Annotation Handlers
  const handleUpdateAnnotations = (updated: SlideAnnotation) => {
    handleUpdateActiveSlide({ annotations: updated });
  };

  const handleClearAnnotations = () => {
    handleUpdateActiveSlide({ annotations: { strokes: [] } });
    showToast('Cleared annotations on this slide');
  };

  const handleUndoAnnotation = () => {
    const currentStrokes = currentSlide.annotations?.strokes || [];
    if (currentStrokes.length > 0) {
      const nextStrokes = currentStrokes.slice(0, currentStrokes.length - 1);
      handleUpdateAnnotations({ strokes: nextStrokes });
    }
  };

  // Tool Toggles
  const handleToggleLaser = () => {
    const next = activeTool === 'laser' ? 'none' : 'laser';
    setActiveTool(next);
    if (next !== 'laser') {
      setIsPointerOverSlide(false);
      broadcastLaserUpdate(false);
    }
    showToast(next === 'laser' ? 'Laser pointer enabled' : 'Laser pointer disabled');
  };

  const handleTogglePen = () => {
    const next = activeTool === 'pen' ? 'none' : 'pen';
    setActiveTool(next);
    if (next === 'pen') {
      setIsPointerOverSlide(false);
      broadcastLaserUpdate(false);
    }
    showToast(next === 'pen' ? 'Drawing pen enabled' : 'Drawing pen disabled');
  };

  // Pointer Move for Laser Pointer
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool !== 'laser' || !isTeacher) return;

    const slideEl = slideRef.current;
    if (!slideEl) return;

    const rect = slideEl.getBoundingClientRect();

    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      if (isPointerOverSlide) {
        setIsPointerOverSlide(false);
        broadcastLaserUpdate(false);
      }
      return;
    }

    const normX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const normY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    const pos = { x: normX, y: normY };
    setLaserPos(pos);
    setIsPointerOverSlide(true);

    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(() => {
      broadcastLaserUpdate(true, pos);
    });
  };

  const handlePointerLeaveSlide = () => {
    if (activeTool === 'laser' && isTeacher) {
      setIsPointerOverSlide(false);
      broadcastLaserUpdate(false);
    }
  };

  // Fullscreen Routine
  const handleToggleFullscreen = async () => {
    const isCurrentlyFs = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );

    if (isCurrentlyFs || isFullscreenFallback || isFullscreen) {
      if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
        try {
          if (document.exitFullscreen) {
            await document.exitFullscreen();
          } else if ((document as any).webkitExitFullscreen) {
            await (document as any).webkitExitFullscreen();
          }
        } catch (err) {
          console.error('Error exiting full screen:', err);
        }
      }
      setIsFullscreen(false);
      setIsFullscreenFallback(false);
      showToast('Exited full screen mode');
    } else {
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
        } catch (err) {
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

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts if Presentation is the active module
      if (activeModule !== 'presentation') return;

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
        activeEl?.isContentEditable
      ) {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        handleNextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrevSlide();
      } else if (e.key === 'Escape') {
        if (isFullscreen || isFullscreenFallback) {
          if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          }
          setIsFullscreen(false);
          setIsFullscreenFallback(false);
        }
        if (activeTool !== 'none') {
          setActiveTool('none');
          setIsPointerOverSlide(false);
          broadcastLaserUpdate(false);
        }
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        handleToggleFullscreen();
      } else if (e.key === 'l' || e.key === 'L') {
        if (isTeacher) {
          e.preventDefault();
          handleToggleLaser();
        }
      } else if (e.key === 'a' || e.key === 'A') {
        if (isTeacher) {
          e.preventDefault();
          handleTogglePen();
        }
      } else if (e.key === 'p' || e.key === 'P') {
        if (isTeacher) {
          e.preventDefault();
          setIsDrawerOpen((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentSlideIndex,
    isFullscreen,
    isFullscreenFallback,
    isTeacher,
    activeTool,
    deck.slides.length,
    activeModule,
  ]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (isTeacher) {
        broadcastTeacherActivity({
          module: 'presentation',
          subLocation: undefined,
          cursorPosition: undefined,
        });
      }
    };
  }, [isTeacher, broadcastTeacherActivity]);

  // Determine active visible laser: teacher's own pointer OR remote teacher pointer on student view
  const activeLaserPoint = isTeacher
    ? isLaserActive && isPointerOverSlide
      ? laserPos
      : null
    : isRemoteLaserActive && remoteLaserSlideIndex === currentSlideIndex && remoteLaserPos
    ? remoteLaserPos
    : null;

  return (
    <div
      ref={containerRef}
      className={`flex-1 flex flex-col h-full bg-[#0B0C0E] relative overflow-hidden select-none ${
        isFullscreen || isFullscreenFallback ? 'fixed inset-0 z-50 w-full h-full' : ''
      }`}
    >
      {/* Top Presentation Toolbar */}
      <div className="h-11 border-b border-[#282A36] bg-[#111216] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          {/* Thumbnails Sidebar Toggle */}
          {!isFullscreen && (
            <button
              onClick={() => setShowThumbnails((prev) => !prev)}
              className={`p-1.5 rounded transition-colors ${
                showThumbnails ? 'text-[#06B6D4] bg-[#06B6D4]/10' : 'text-[#71717A] hover:text-white'
              }`}
              title={showThumbnails ? 'Hide slide thumbnails' : 'Show slide thumbnails'}
              aria-label={showThumbnails ? 'Hide slide thumbnails' : 'Show slide thumbnails'}
            >
              <Sliders className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center space-x-1.5 text-xs text-[#A1A1AA]">
            <Layers className="w-3.5 h-3.5 text-[#06B6D4]" />
            <span className="font-semibold text-white">Lecture Presentation Deck</span>
          </div>

          <span className="text-[#282A36]">|</span>

          {/* Slide Indicator */}
          <span className="text-xs text-[#A1A1AA]">
            Slide {currentSlideIndex + 1} of {deck.slides.length}
          </span>

          {/* Persistence Save Indicator */}
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center space-x-1 border ${
              saveStatus === 'Saved'
                ? 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/25'
                : saveStatus === 'Saving...'
                ? 'text-[#FF9100] bg-[#FF9100]/10 border-[#FF9100]/25'
                : 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/25'
            }`}
          >
            {saveStatus === 'Saved' && <Check className="w-3 h-3 mr-0.5" />}
            <span>{saveStatus}</span>
          </span>

          {isTeacher && (
            <span className="hidden sm:inline-flex items-center space-x-1 text-[11px] font-mono text-[#06B6D4] bg-[#06B6D4]/10 border border-[#06B6D4]/20 px-2 py-0.5 rounded-full">
              <Radio className="w-3 h-3 animate-pulse" />
              <span>Broadcasting Live</span>
            </span>
          )}
        </div>

        {/* Presenter & Tool Actions */}
        <div className="flex items-center space-x-2">
          {/* Laser Pointer Toggle (Teacher only) */}
          {isTeacher && (
            <button
              onClick={handleToggleLaser}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                isLaserActive
                  ? 'bg-[#EF4444]/20 border border-[#EF4444]/50 text-[#EF4444]'
                  : 'bg-[#15161C] border border-[#282A36] text-[#A1A1AA] hover:text-white'
              }`}
              title={isLaserActive ? 'Disable Laser Pointer' : 'Toggle Laser Pointer'}
              aria-label="Toggle Laser Pointer"
            >
              <Pointer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Laser Pointer</span>
            </button>
          )}

          {/* Drawing Pen Toggle (Teacher only) */}
          {isTeacher && (
            <div className="flex items-center space-x-1">
              <button
                onClick={handleTogglePen}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  activeTool === 'pen'
                    ? 'bg-[#06B6D4]/20 border border-[#06B6D4]/50 text-[#06B6D4]'
                    : 'bg-[#15161C] border border-[#282A36] text-[#A1A1AA] hover:text-white'
                }`}
                title={activeTool === 'pen' ? 'Disable Drawing Pen' : 'Toggle Drawing Pen'}
                aria-label="Toggle Drawing Pen"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Pen</span>
              </button>

              {activeTool === 'pen' && (
                <>
                  {/* Pen Color Selector */}
                  <div className="flex items-center space-x-1 bg-[#15161C] p-1 rounded-lg border border-[#282A36]">
                    {['#06B6D4', '#EAB308', '#EF4444', '#10B981', '#FFFFFF'].map((color) => (
                      <button
                        key={color}
                        onClick={() => setPenColor(color)}
                        className={`w-3.5 h-3.5 rounded-full transition-transform ${
                          penColor === color ? 'scale-125 ring-1 ring-white' : 'opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: color }}
                        title={`Select color ${color}`}
                      />
                    ))}
                  </div>

                  {/* Pen Stroke Width */}
                  <button
                    onClick={() => setPenWidth((w) => (w === 2 ? 4 : w === 4 ? 6 : 2))}
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#A1A1AA] hover:text-white hover:bg-[#15161C] border border-[#282A36] transition-colors"
                    title={`Stroke width: ${penWidth}px (click to toggle)`}
                    aria-label={`Stroke width: ${penWidth}px`}
                  >
                    {penWidth}px
                  </button>

                  {/* Undo Last Stroke */}
                  <button
                    onClick={handleUndoAnnotation}
                    className="p-1 rounded text-[#71717A] hover:text-white hover:bg-[#15161C] transition-colors"
                    title="Undo last annotation stroke"
                    aria-label="Undo last annotation stroke"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Clear Strokes on Current Slide */}
                  <button
                    onClick={handleClearAnnotations}
                    className="p-1 rounded text-[#71717A] hover:text-[#EF4444] hover:bg-[#15161C] transition-colors"
                    title="Clear annotations on this slide"
                    aria-label="Clear annotations on this slide"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          )}

          {/* Presenter Notes & Slide Editor Toggle (Teacher only) */}
          {isTeacher && !isFullscreen && (
            <button
              onClick={() => setIsDrawerOpen((prev) => !prev)}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                isDrawerOpen
                  ? 'bg-[#FF9100]/20 border-[#FF9100]/50 text-[#FF9100]'
                  : 'bg-[#15161C] border-[#282A36] text-[#A1A1AA] hover:text-white'
              }`}
              title={isDrawerOpen ? 'Close Slide Editor & Notes' : 'Edit Slide Content & Notes'}
              aria-label={isDrawerOpen ? 'Close Slide Editor & Notes' : 'Edit Slide Content & Notes'}
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Edit Slide</span>
            </button>
          )}

          {/* Import / Export Modal Trigger */}
          {isTeacher && !isFullscreen && (
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="p-1.5 rounded-lg border border-[#282A36] bg-[#15161C] text-[#A1A1AA] hover:text-white transition-colors"
              title="Import or Export Presentation Deck"
              aria-label="Import or Export Presentation Deck"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Fullscreen Mode Toggle */}
          <button
            onClick={handleToggleFullscreen}
            className={`p-1.5 transition-colors rounded-lg ${
              isFullscreen || isFullscreenFallback
                ? 'bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/40'
                : 'bg-[#15161C] border border-[#282A36] text-[#A1A1AA] hover:text-white'
            }`}
            title={isFullscreen || isFullscreenFallback ? 'Exit Full Screen (Esc)' : 'Enter Full Screen'}
            aria-label={isFullscreen || isFullscreenFallback ? 'Exit Full Screen' : 'Enter Full Screen'}
          >
            {isFullscreen || isFullscreenFallback ? (
              <Minimize className="w-3.5 h-3.5" />
            ) : (
              <Maximize className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Main Workspace Body: Thumbnails Sidebar + Slide Stage */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Thumbnails Panel */}
        {showThumbnails && !isFullscreen && (
          <SlideThumbnailList
            slides={deck.slides}
            activeSlideId={deck.activeSlideId}
            onSelectSlide={handleSelectSlide}
            onAddSlide={handleAddSlide}
            onDuplicateSlide={handleDuplicateSlide}
            onDeleteSlide={handleDeleteSlide}
            onMoveSlide={handleMoveSlide}
            disabled={!isTeacher}
          />
        )}

        {/* Slide Stage Presentation Area */}
        <div
          className="flex-1 p-4 sm:p-6 md:p-8 flex items-center justify-center relative overflow-hidden bg-[#07080A]"
          onPointerMove={handlePointerMove}
        >
          {/* Slide Frame with Strict Aspect Ratio */}
          <div
            ref={slideRef}
            onPointerLeave={handlePointerLeaveSlide}
            className={`w-full max-w-4xl aspect-[16/9] rounded-xl border border-[#282A36] bg-[#111216] shadow-2xl p-8 sm:p-10 md:p-12 flex flex-col justify-between relative overflow-hidden transition-all duration-150 ${
              isFullscreen || isFullscreenFallback ? 'max-w-6xl max-h-[85vh]' : ''
            } ${isTeacher && isLaserActive ? 'cursor-none' : activeTool === 'pen' ? 'cursor-crosshair' : 'cursor-default'}`}
          >
            {/* Subtle background ambient glow */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-[#06B6D4]/5 rounded-full blur-3xl pointer-events-none" />

            {/* Slide Header */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-widest text-[#FF9100] font-semibold">
                  CORTEX {deck.courseCode || 'CS 201'} • ALGORITHMS
                </span>
                <span className="text-[10px] font-mono text-[#71717A]">
                  Topic {currentSlideIndex + 1} / {deck.slides.length}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white mt-1.5 tracking-tight">
                {currentSlide.title}
              </h1>
              <p className="text-xs text-[#A1A1AA] mt-1">{currentSlide.subtitle}</p>
            </div>

            {/* Slide Body */}
            <div className="my-auto space-y-4 py-2">
              <ul className="space-y-2.5">
                {currentSlide.bullets.map((b, i) => (
                  <li key={i} className="flex items-start space-x-3 text-xs sm:text-sm text-[#E4E4E7]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#06B6D4] mt-2 flex-shrink-0" />
                    <span className="leading-relaxed">{b}</span>
                  </li>
                ))}
              </ul>

              {currentSlide.diagramTitle && (
                <div className="p-3 sm:p-3.5 rounded-lg bg-[#15161C] border border-[#282A36] text-xs font-mono text-[#06B6D4] flex items-center justify-between">
                  <span>{currentSlide.diagramTitle}</span>
                  <span className="text-[10px] text-[#71717A] hidden sm:inline">Mathematical Invariant</span>
                </div>
              )}

              {currentSlide.codeSnippet && (
                <pre className="p-3 rounded-lg bg-[#0B0C0E] border border-[#282A36] text-[11px] sm:text-xs font-mono text-[#10B981] overflow-x-auto">
                  {currentSlide.codeSnippet}
                </pre>
              )}
            </div>

            {/* Slide Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-[#282A36] text-[11px] text-[#71717A]">
              <span>Instructor: {deck.author || 'Prof. Shivam Patil'}</span>
              <span>Slide {currentSlideIndex + 1} / {deck.slides.length}</span>
            </div>

            {/* Slide Annotation Canvas Overlay */}
            <SlideAnnotationCanvas
              annotations={currentSlide.annotations}
              onUpdateAnnotations={handleUpdateAnnotations}
              activeTool={activeTool}
              penColor={penColor}
              penWidth={penWidth}
              slideRef={slideRef}
            />

            {/* High-Definition Multi-Layer Glowing Laser Pointer */}
            {activeLaserPoint && (
              <div
                data-testid="presentation-laser-dot"
                className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 z-30"
                style={{ left: `${activeLaserPoint.x}%`, top: `${activeLaserPoint.y}%` }}
              >
                {/* Outer soft glowing halo */}
                <div className="absolute -inset-3 rounded-full bg-[#EF4444]/25 blur-sm" />
                {/* Medium intense glowing ring */}
                <div className="absolute -inset-1 rounded-full bg-[#EF4444]/60 shadow-[0_0_8px_#EF4444]" />
                {/* Core red laser dot */}
                <div className="relative w-3.5 h-3.5 rounded-full bg-[#EF4444] border border-white/60 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                </div>
                {isStudent && (
                  <div className="absolute top-4 left-4 whitespace-nowrap px-1.5 py-0.5 rounded bg-[#111216]/95 border border-[#EF4444]/40 text-[9px] font-mono text-[#EF4444] shadow-md pointer-events-none">
                    Teacher Pointer
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Slide Content Editor and Presenter Notes Drawer (Teacher only) */}
      {isTeacher && !isFullscreen && (
        <SlideEditorDrawer
          slide={currentSlide}
          slideIndex={currentSlideIndex}
          totalSlides={deck.slides.length}
          onUpdateSlide={handleUpdateActiveSlide}
          isOpen={isDrawerOpen}
          onToggleOpen={() => setIsDrawerOpen((prev) => !prev)}
        />
      )}

      {/* Slide Navigation Bottom Strip */}
      <div className="h-14 border-t border-[#282A36] bg-[#111216] px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrevSlide}
            disabled={currentSlideIndex === 0}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-[#282A36] text-xs font-medium text-white hover:bg-[#1D1F27] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Previous Slide (Left Arrow)"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>
          <button
            onClick={handleNextSlide}
            disabled={currentSlideIndex === deck.slides.length - 1}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-[#282A36] text-xs font-medium text-white hover:bg-[#1D1F27] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Next Slide (Right Arrow / Space)"
          >
            <span>Next Slide</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Thumbnail Dots */}
        <div className="flex items-center space-x-2">
          {deck.slides.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => handleSelectSlide(s.id)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                idx === currentSlideIndex
                  ? 'bg-[#06B6D4] scale-125'
                  : 'bg-[#282A36] hover:bg-[#71717A]'
              }`}
              title={`Jump to Slide ${idx + 1}: ${s.title}`}
            />
          ))}
        </div>
      </div>

      {/* Import / Export Modal */}
      <PresentationImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        deck={deck}
        onImportSuccess={(newDeck) => {
          setDeck(newDeck);
          triggerSave(newDeck);
        }}
        onResetToDefault={() => {
          setDeck(DEFAULT_PRESENTATION_DECK);
          triggerSave(DEFAULT_PRESENTATION_DECK);
        }}
        showToast={showToast}
      />
    </div>
  );
};
