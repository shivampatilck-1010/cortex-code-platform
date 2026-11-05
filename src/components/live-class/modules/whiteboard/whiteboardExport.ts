import { WhiteboardDocument, WhiteboardPage } from '@/types/whiteboard';
import { renderWhiteboard } from './whiteboardRenderer';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';

const EXPORT_WIDTH = 1920;
const EXPORT_HEIGHT = 1080;

/**
 * Generates an offscreen canvas containing a rendered page.
 */
export function renderPageToCanvas(page: WhiteboardPage, width = EXPORT_WIDTH, height = EXPORT_HEIGHT): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  renderWhiteboard({
    ctx,
    width,
    height,
    zoom: 1,
    pan: { x: 0, y: 0 },
    background: page.background,
    elements: page.elements,
    isExport: true,
  });

  return canvas;
}

/**
 * Triggers a browser download of a Blob or URL.
 */
export function downloadFile(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Sanitizes a title string into a safe filesystem slug.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'page';
}

/**
 * Exports the specified page as a PNG image download.
 */
export async function exportPageToPNG(page: WhiteboardPage, pageIndex: number): Promise<void> {
  const canvas = renderPageToCanvas(page);
  const dataUrl = canvas.toDataURL('image/png');
  const num = String(pageIndex + 1).padStart(2, '0');
  const slug = slugify(page.title);
  const filename = `cortex-whiteboard-page-${num}-${slug}.png`;
  downloadFile(dataUrl, filename);
}

/**
 * Exports all pages inside a ZIP archive with individual PNG files.
 */
export async function exportAllPagesToZIP(doc: WhiteboardDocument): Promise<void> {
  const zip = new JSZip();

  doc.pages.forEach((page, idx) => {
    const canvas = renderPageToCanvas(page);
    const dataUrl = canvas.toDataURL('image/png');
    const base64Data = dataUrl.split(',')[1];
    const num = String(idx + 1).padStart(2, '0');
    const slug = slugify(page.title);
    const filename = `page-${num}-${slug}.png`;

    zip.file(filename, base64Data, { base64: true });
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  const docSlug = slugify(doc.title);
  const zipUrl = URL.createObjectURL(blob);
  downloadFile(zipUrl, `cortex-whiteboard-${docSlug}.zip`);
  setTimeout(() => URL.revokeObjectURL(zipUrl), 10000);
}

/**
 * Exports all document pages into a multi-page PDF document.
 */
export async function exportDocumentToPDF(doc: WhiteboardDocument): Promise<void> {
  if (doc.pages.length === 0) return;

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: [EXPORT_WIDTH, EXPORT_HEIGHT],
  });

  doc.pages.forEach((page, idx) => {
    if (idx > 0) {
      pdf.addPage([EXPORT_WIDTH, EXPORT_HEIGHT], 'landscape');
    }

    const canvas = renderPageToCanvas(page);
    const dataUrl = canvas.toDataURL('image/png');
    pdf.addImage(dataUrl, 'PNG', 0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
  });

  const docSlug = slugify(doc.title);
  pdf.save(`cortex-whiteboard-${docSlug}.pdf`);
}

/**
 * Exports the complete document as an editable, schema-versioned JSON file.
 */
export function exportDocumentToJSON(doc: WhiteboardDocument): void {
  const payload: WhiteboardDocument = {
    schemaVersion: 1,
    id: doc.id,
    title: doc.title,
    createdAt: doc.createdAt,
    updatedAt: Date.now(),
    activePageId: doc.activePageId,
    pages: doc.pages.map((p) => ({
      id: p.id,
      title: p.title,
      background: p.background,
      elements: p.elements,
      history: [],
      redoStack: [],
      viewport: p.viewport,
    })),
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const docSlug = slugify(doc.title);
  downloadFile(url, `cortex-whiteboard-${docSlug}.json`);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Validates and imports an editable project JSON string.
 */
export function importDocumentFromJSON(
  jsonStr: string
): { valid: boolean; doc?: WhiteboardDocument; error?: string } {
  try {
    const parsed = JSON.parse(jsonStr);

    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'File content is not a valid JSON object' };
    }

    if (parsed.schemaVersion !== 1) {
      return { valid: false, error: `Unsupported schema version: ${parsed.schemaVersion}` };
    }

    if (!Array.isArray(parsed.pages) || parsed.pages.length === 0) {
      return { valid: false, error: 'Document must contain at least one page' };
    }

    const pages: WhiteboardPage[] = parsed.pages.map((p: any, idx: number) => ({
      id: typeof p.id === 'string' ? p.id : `page-${Date.now()}-${idx}`,
      title: typeof p.title === 'string' ? p.title : `Page ${idx + 1}`,
      background: p.background || 'dark-grid',
      elements: Array.isArray(p.elements) ? p.elements : [],
      history: [],
      redoStack: [],
      viewport: p.viewport || { zoom: 1, pan: { x: 0, y: 0 } },
    }));

    const activePageId = pages.some((p) => p.id === parsed.activePageId)
      ? parsed.activePageId
      : pages[0].id;

    const doc: WhiteboardDocument = {
      schemaVersion: 1,
      id: parsed.id || `doc-${Date.now()}`,
      title: parsed.title || 'Imported Whiteboard Document',
      createdAt: parsed.createdAt || Date.now(),
      updatedAt: Date.now(),
      activePageId,
      pages,
    };

    return { valid: true, doc };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Failed to parse JSON file' };
  }
}
