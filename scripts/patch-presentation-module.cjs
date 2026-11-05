const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/components/live-class/modules/presentation/PresentationModule.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add import for loadPresentationFromServer and savePresentationToServer
const importOld = `import {
  loadPresentationDeck,
  savePresentationDeck,
  exportPresentationToJson,
} from './presentationPersistence';`;

const importNew = `import {
  loadPresentationDeck,
  savePresentationDeck,
  exportPresentationToJson,
  loadPresentationFromServer,
  savePresentationToServer,
} from './presentationPersistence';`;

if (content.includes(importOld)) {
  content = content.replace(importOld, importNew);
} else {
  content = content.replace(importOld.replace(/\n/g, '\r\n'), importNew.replace(/\n/g, '\r\n'));
}

// 2. Add versionRef and server load effect
const oldDeckState = `  // Deck State
  const [deck, setDeck] = useState<PresentationDeck>(() => loadPresentationDeck());
  const [saveStatus, setSaveStatus] = useState<'Saved' | 'Saving...' | 'Save failed'>('Saved');`;

const newDeckState = `  // Deck State
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
  }, [classroomId]);`;

if (content.includes(oldDeckState)) {
  content = content.replace(oldDeckState, newDeckState);
} else {
  content = content.replace(oldDeckState.replace(/\n/g, '\r\n'), newDeckState.replace(/\n/g, '\r\n'));
}

// 3. Update triggerSave to call savePresentationToServer
const oldTriggerSave = `  const triggerSave = useCallback((newDeck: PresentationDeck) => {
    setSaveStatus('Saving...');
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      const ok = savePresentationDeck(newDeck);
      setSaveStatus(ok ? 'Saved' : 'Save failed');
    }, 400);
  }, []);`;

const newTriggerSave = `  const triggerSave = useCallback((newDeck: PresentationDeck) => {
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
  }, [classroomId, isTeacher, currentSlideIndex]);`;

if (content.includes(oldTriggerSave)) {
  content = content.replace(oldTriggerSave, newTriggerSave);
} else {
  content = content.replace(oldTriggerSave.replace(/\n/g, '\r\n'), newTriggerSave.replace(/\n/g, '\r\n'));
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated PresentationModule.tsx with server persistence');
