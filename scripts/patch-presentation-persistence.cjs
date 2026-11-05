const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/components/live-class/modules/presentation/presentationPersistence.ts');
let content = fs.readFileSync(filePath, 'utf8');

const serverPersistenceMethods = `
/**
 * Loads authoritative presentation deck from Cortex classroom database
 */
export const loadPresentationFromServer = async (
  classroomId: string,
  sessionId: string = 'default'
): Promise<{ deck: PresentationDeck; activeSlideIndex: number; isPresenting: boolean; version: number } | null> => {
  if (typeof fetch === 'undefined' || !classroomId) return null;
  try {
    const res = await fetch(\`/api/v1/classrooms/\${classroomId}/presentation?sessionId=\${sessionId}\`);
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
    const res = await fetch(\`/api/v1/classrooms/\${classroomId}/presentation\`, {
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
`;

if (!content.includes('loadPresentationFromServer')) {
  content += serverPersistenceMethods;
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully added server persistence methods to presentationPersistence.ts');
}
