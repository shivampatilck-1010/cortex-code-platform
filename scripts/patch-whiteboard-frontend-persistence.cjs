const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/components/live-class/modules/whiteboard/WhiteboardModule.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Destructure session and signalingClient from useClassroom
const targetHook = `  const { userRole, showToast } = useClassroom();`;
const newHook = `  const { userRole, showToast, session, signalingClient } = useClassroom();
  const classroomId = session?.id || '';
  const versionRef = useRef<number>(1);
  const isInitialLoadRef = useRef<boolean>(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');`;

if (content.includes(targetHook)) {
  content = content.replace(targetHook, newHook);
} else {
  content = content.replace(targetHook.replace(/\n/g, '\r\n'), newHook.replace(/\n/g, '\r\n'));
}

// 2. Add server persistence effect and real-time listener
const targetAfterDoc = `  const activePage = doc.pages.find((p) => p.id === doc.activePageId) || doc.pages[0];`;
const serverSyncEffects = `  const activePage = doc.pages.find((p) => p.id === doc.activePageId) || doc.pages[0];

  // 1. Initial Load from Server Database
  useEffect(() => {
    if (!classroomId || typeof window === 'undefined') return;
    let isMounted = true;

    fetch(\`/api/v1/classrooms/\${classroomId}/whiteboard?sessionId=\${classroomId}\`)
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
      fetch(\`/api/v1/classrooms/\${classroomId}/whiteboard\`, {
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
  }, [doc.pages, doc.activePageId, classroomId]);`;

if (content.includes(targetAfterDoc)) {
  content = content.replace(targetAfterDoc, serverSyncEffects);
} else {
  content = content.replace(targetAfterDoc.replace(/\n/g, '\r\n'), serverSyncEffects.replace(/\n/g, '\r\n'));
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully added server persistence to WhiteboardModule.tsx');
