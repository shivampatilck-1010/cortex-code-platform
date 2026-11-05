import JSZip from 'jszip';
import { PresentationDeck, Slide } from '@/types/presentation';
import { DEFAULT_PRESENTATION_DECK } from './presentationDefaults';

export const PRESENTATION_STORAGE_KEY = 'cortex_presentation_deck';

export interface ImportResult {
  success: boolean;
  deck?: PresentationDeck;
  error?: string;
}

export const loadPresentationDeck = (): PresentationDeck => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_PRESENTATION_DECK;
  }

  try {
    const raw = window.localStorage.getItem(PRESENTATION_STORAGE_KEY);
    if (!raw) return DEFAULT_PRESENTATION_DECK;

    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray(parsed.slides) &&
      parsed.slides.length > 0 &&
      parsed.slides.every((s: any) => s && typeof s.id === 'string' && typeof s.title === 'string')
    ) {
      // Validate activeSlideId
      const validActiveId = parsed.slides.some((s: Slide) => s.id === parsed.activeSlideId)
        ? parsed.activeSlideId
        : parsed.slides[0].id;

      return {
        ...parsed,
        activeSlideId: validActiveId,
      };
    }
  } catch (err) {
    console.warn('Failed to load saved presentation deck from localStorage, using default:', err);
  }

  return DEFAULT_PRESENTATION_DECK;
};

export const savePresentationDeck = (deck: PresentationDeck): boolean => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }

  try {
    const payload = JSON.stringify({
      ...deck,
      updatedAt: Date.now(),
    });
    window.localStorage.setItem(PRESENTATION_STORAGE_KEY, payload);
    return true;
  } catch (err) {
    console.error('Failed to save presentation deck to localStorage:', err);
    return false;
  }
};

export const exportPresentationToJson = (deck: PresentationDeck): void => {
  try {
    const filename = `${deck.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(deck, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  } catch (err) {
    console.error('Failed to export presentation JSON:', err);
  }
};

export const importPresentationFromJson = (jsonString: string): ImportResult => {
  try {
    const data = JSON.parse(jsonString);

    if (!data || typeof data !== 'object') {
      return { success: false, error: 'File is not a valid JSON object' };
    }

    if (!Array.isArray(data.slides) || data.slides.length === 0) {
      return { success: false, error: 'Presentation must contain a non-empty array of slides' };
    }

    // Validate and sanitize each slide with unique ID guarantees
    const seenIds = new Set<string>();
    const sanitizedSlides: Slide[] = data.slides.map((s: any, idx: number) => {
      if (!s || typeof s !== 'object') {
        throw new Error(`Slide at index ${idx + 1} is invalid`);
      }

      let slideId = typeof s.id === 'string' && s.id.trim() ? s.id.trim() : `slide_${Date.now()}_${idx}`;
      if (seenIds.has(slideId)) {
        slideId = `${slideId}_dup_${idx}`;
      }
      seenIds.add(slideId);

      const sanitizedStrokes = s.annotations && Array.isArray(s.annotations.strokes)
        ? s.annotations.strokes
            .filter((st: any) => st && typeof st === 'object' && Array.isArray(st.points))
            .map((st: any, sIdx: number) => ({
              id: typeof st.id === 'string' ? st.id : `stroke_${Date.now()}_${sIdx}`,
              color: typeof st.color === 'string' ? st.color : '#06B6D4',
              width: typeof st.width === 'number' ? Math.max(1, Math.min(12, st.width)) : 2,
              points: st.points
                .filter((p: any) => p && typeof p.x === 'number' && typeof p.y === 'number' && !isNaN(p.x) && !isNaN(p.y))
                .map((p: any) => ({
                  x: Math.max(0, Math.min(100, p.x)),
                  y: Math.max(0, Math.min(100, p.y)),
                })),
            }))
        : [];

      return {
        id: slideId,
        title: typeof s.title === 'string' ? s.title : `Slide ${idx + 1}`,
        subtitle: typeof s.subtitle === 'string' ? s.subtitle : '',
        bullets: Array.isArray(s.bullets) ? s.bullets.map(String) : [],
        diagramTitle: typeof s.diagramTitle === 'string' ? s.diagramTitle : undefined,
        codeSnippet: typeof s.codeSnippet === 'string' ? s.codeSnippet : undefined,
        presenterNotes: typeof s.presenterNotes === 'string' ? s.presenterNotes : '',
        annotations: { strokes: sanitizedStrokes },
        createdAt: typeof s.createdAt === 'number' ? s.createdAt : Date.now(),
        updatedAt: typeof s.updatedAt === 'number' ? s.updatedAt : Date.now(),
      };
    });

    const newDeck: PresentationDeck = {
      id: typeof data.id === 'string' && data.id ? data.id : `deck_${Date.now()}`,
      title: typeof data.title === 'string' && data.title ? data.title : 'Imported Presentation',
      author: typeof data.author === 'string' ? data.author : 'Instructor',
      courseCode: typeof data.courseCode === 'string' ? data.courseCode : 'CS-201',
      slides: sanitizedSlides,
      activeSlideId: sanitizedSlides[0].id,
      version: typeof data.version === 'number' ? data.version + 1 : 1,
      updatedAt: Date.now(),
    };

    return { success: true, deck: newDeck };
  } catch (err: any) {
    return { success: false, error: err.message || 'Malformed JSON presentation file' };
  }
};

export const importPresentationFromPptx = async (file: File): Promise<ImportResult> => {
  try {
    const zip = await JSZip.loadAsync(file);

    // Find all slide XML files in ppt/slides/slide*.xml
    const slideFiles: { name: string; index: number }[] = [];
    zip.forEach((relativePath) => {
      const match = relativePath.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
      if (match) {
        slideFiles.push({ name: relativePath, index: parseInt(match[1], 10) });
      }
    });

    if (slideFiles.length === 0) {
      return {
        success: false,
        error: 'No slide XML streams found in the PPTX archive. The presentation might be corrupted or empty.',
      };
    }

    // Sort slides in natural numeric sequence
    slideFiles.sort((a, b) => a.index - b.index);

    const slides: Slide[] = [];

    for (let i = 0; i < slideFiles.length; i++) {
      const entry = slideFiles[i];
      const xmlContent = await zip.file(entry.name)?.async('text');
      if (!xmlContent) continue;

      // Extract text content from XML tags: <a:t>text</a:t>
      const textMatches = Array.from(xmlContent.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)).map((m) =>
        m[1]
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
          .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
          .trim()
      );

      const validLines = textMatches.filter((t) => t.length > 0);
      const title = validLines.length > 0 ? validLines[0] : `Imported Slide ${i + 1}`;
      const subtitle = validLines.length > 1 ? validLines[1] : `Imported from ${file.name}`;
      const bullets = validLines.length > 2 ? validLines.slice(2, 8) : ['Content extracted from presentation file.'];

      slides.push({
        id: `slide_pptx_${Date.now()}_${i + 1}`,
        title,
        subtitle,
        bullets,
        presenterNotes: `Slide ${i + 1} imported from ${file.name}. Note: Complex formatting and animations are omitted for browser lightweight rendering.`,
        annotations: { strokes: [] },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    if (slides.length === 0) {
      return { success: false, error: 'Could not extract readable text slides from PPTX.' };
    }

    const baseTitle = file.name.replace(/\.pptx$/i, '').replace(/[-_]/g, ' ');
    const deck: PresentationDeck = {
      id: `deck_${Date.now()}`,
      title: baseTitle || 'Imported PowerPoint Deck',
      author: 'Imported User',
      courseCode: 'CS-201',
      slides,
      activeSlideId: slides[0].id,
      version: 1,
      updatedAt: Date.now(),
    };

    return { success: true, deck };
  } catch (err: any) {
    return {
      success: false,
      error: `Failed to parse PPTX archive: ${err.message || 'Unknown archive parsing error'}`,
    };
  }
};

/**
 * Loads authoritative presentation deck from Cortex classroom database
 */
export const loadPresentationFromServer = async (
  classroomId: string,
  sessionId: string = 'default'
): Promise<{ deck: PresentationDeck; activeSlideIndex: number; isPresenting: boolean; version: number } | null> => {
  if (typeof fetch === 'undefined' || !classroomId) return null;
  try {
    const res = await fetch(`/api/v1/classrooms/${classroomId}/presentation?sessionId=${sessionId}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.presentation?.deck) {
      return {
        deck: data.presentation.deck,
        activeSlideIndex: data.presentation.activeSlideIndex || 0,
        isPresenting: Boolean(data.presentation.isPresenting),
        version: data.presentation.version || 1,
      };
    }
  } catch (err) {
    console.warn('[Presentation] Server load error, recovering from local cache:', err);
  }
  return null;
};

/**
 * Saves authoritative presentation deck to Cortex classroom database
 */
export const savePresentationToServer = async (
  classroomId: string,
  sessionId: string = 'default',
  deck: PresentationDeck,
  activeSlideIndex: number = 0,
  isPresenting: boolean = false,
  version?: number
): Promise<{ success: boolean; version?: number; error?: string }> => {
  if (typeof fetch === 'undefined' || !classroomId) {
    return { success: false, error: 'Network unavailable' };
  }
  try {
    const res = await fetch(`/api/v1/classrooms/${classroomId}/presentation`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        deck,
        activeSlideIndex,
        isPresenting,
        version,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      // Also update local recovery backup
      try {
        localStorage.setItem(PRESENTATION_STORAGE_KEY + '_' + classroomId, JSON.stringify(deck));
      } catch (_) {}
      return { success: true, version: data?.presentation?.version };
    } else {
      const errData = await res.json().catch(() => ({}));
      return { success: false, error: errData.error || ('HTTP ' + res.status) };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};
