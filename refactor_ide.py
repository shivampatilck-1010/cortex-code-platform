import re

def refactor_page():
    with open('src/app/page.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Add imports
    content = content.replace(
        "import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';",
        "import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';\nimport { useRouter } from 'next/navigation';"
    )

    # 1. State hook for projectId
    init_state = """export default function CloudIDEPage() {
  const router = useRouter();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isProjectLoading, setIsProjectLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchProject = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        let id = urlParams.get('projectId');
        if (id) {
          const res = await fetch(`/api/v1/projects/${id}`);
          if (res.ok) {
            const data = await res.json();
            if (mounted) {
              setProjectId(data.project.id);
              if (data.files && data.files.length > 0) {
                 setFiles(data.files);
                 const main = data.files.find((f: any) => !f.isFolder) || data.files[0];
                 if (main) setActiveFileId(main.id);
              }
              const targetLang = SUPPORTED_LANGUAGES.find(l => l.id === data.project.language);
              if (targetLang) setCurrentLang(targetLang);
            }
          } else {
            // Bad ID, let's just strip it
            router.replace('/');
          }
        } else {
          // fetch all, or create new
          const res = await fetch('/api/v1/projects');
          if (res.ok) {
             const data = await res.json();
             if (data.projects && data.projects.length > 0) {
                 router.replace(`/?projectId=${data.projects[0].id}`);
             } else {
                 const pRes = await fetch('/api/v1/projects', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Default Project', language: 'python' })
                 });
                 if (pRes.ok) {
                    const pData = await pRes.json();
                    router.replace(`/?projectId=${pData.project.id}`);
                 }
             }
          }
        }
      } finally {
        if (mounted) setIsProjectLoading(false);
      }
    };
    fetchProject();
    return () => { mounted = false; };
  }, [router]);
"""
    content = content.replace("export default function CloudIDEPage() {", init_state)

    # 2. Debounce save in handleContentChange
    content_change = """const saveFileRef = useRef<NodeJS.Timeout | null>(null);

  const handleContentChange = (newContent: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === activeFileId ? { ...f, content: newContent } : f))
    );
    if (collabBrokerRef.current) {
      collabBrokerRef.current.broadcastFileChange(activeFileId, newContent);
    }
    
    // Auto-save
    if (projectId && activeFileId) {
       if (saveFileRef.current) clearTimeout(saveFileRef.current);
       saveFileRef.current = setTimeout(() => {
          fetch(`/api/v1/projects/${projectId}/files/${activeFileId}`, {
             method: 'PATCH',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ content: newContent })
          }).catch(console.error);
       }, 800);
    }
  };"""
    content = re.sub(r'const handleContentChange = \(newContent: string\) => \{[\s\S]*?^\s*\};\n', content_change + '\n', content, flags=re.MULTILINE)

    # 3. Create File Hook
    create_file = """onCreateFile={async (name, isFolder, parentFolderId) => {
            const parent = parentFolderId ? files.find((f) => f.id === parentFolderId) : null;
            const parentPath = parent ? parent.path.replace(/\\/$/, '') : '';
            const initialContent = isFolder ? '' : getStarterContentForFile(name, currentLang);
            const path = parent ? `${parentPath}/${name}` : `/${name}`;
            
            if (projectId) {
              try {
                const res = await fetch(`/api/v1/projects/${projectId}/files`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name, path, content: initialContent, isFolder })
                });
                if (res.ok) {
                  const data = await res.json();
                  const newF = data.file;
                  setFiles((prev) => [...prev, newF]);
                  if (!isFolder) setActiveFileId(newF.id);
                }
              } catch (e) { console.error(e); }
            }
          }}"""
    content = re.sub(r'onCreateFile=\{\(name, isFolder, parentFolderId\) => \{[\s\S]*?^\s*\}\}\n', create_file + '\n', content, flags=re.MULTILINE)

    # 4. Delete File Hook
    delete_file = """onDeleteFile={async (id) => {
            if (projectId) {
               try {
                 await fetch(`/api/v1/projects/${projectId}/files/${id}`, { method: 'DELETE' });
               } catch (e) { console.error(e); }
            }
            const getDescendantIds = (targetId: string): string[] => {
              const children = files.filter((f) => f.parentId === targetId);
              return [targetId, ...children.flatMap((c) => getDescendantIds(c.id))];
            };
            const toDelete = getDescendantIds(id);
            setFiles((prev) => prev.filter((f) => !toDelete.includes(f.id)));
            if (toDelete.includes(activeFileId)) {
              const remaining = files.filter((f) => !toDelete.includes(f.id) && !f.isFolder);
              setActiveFileId(remaining[0]?.id || '');
            }
          }}"""
    content = re.sub(r'onDeleteFile=\{\(id\) => \{[\s\S]*?^\s*\}\}\n', delete_file + '\n', content, flags=re.MULTILINE)

    # 5. Rename File Hook
    rename_file = """onRenameFile={async (id, newName) => {
            if (projectId) {
              const f = files.find(x => x.id === id);
              if (f) {
                const parentPath = f.path.substring(0, f.path.lastIndexOf('/'));
                const newPath = parentPath === '' ? `/${newName}` : `${parentPath}/${newName}`;
                try {
                  await fetch(`/api/v1/projects/${projectId}/files/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: newName, path: newPath })
                  });
                } catch(e) { console.error(e); }
              }
            }
            setFiles((prev) =>
              prev.map((f) => {
                if (f.id !== id) return f;
                const parentPath = f.path.substring(0, f.path.lastIndexOf('/'));
                return {
                  ...f,
                  name: newName,
                  path: parentPath === '' ? `/${newName}` : `${parentPath}/${newName}`,
                };
              })
            );
          }}"""
    content = re.sub(r'onRenameFile=\{\(id, newName\) => \{[\s\S]*?^\s*\}\}\n', rename_file + '\n', content, flags=re.MULTILINE)
    
    # 6. Add Loading state overlay
    loading_overlay = """
  if (isProjectLoading) {
    return <div className="min-h-screen bg-[#0b0c0e] flex items-center justify-center text-white">Loading workspace...</div>;
  }
    """
    content = content.replace("return (\n    <div className=\"flex flex-col h-screen", loading_overlay + "\n  return (\n    <div className=\"flex flex-col h-screen")

    with open('src/app/page.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    refactor_page()
