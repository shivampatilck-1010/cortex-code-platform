'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { ProjectFile } from '@/lib/execution/types';
import { LanguageConfig, getLanguageConfig } from '@/config/languages';
import { detectLanguage } from '@/lib/editor/language-detector';
import { zipSync, strToU8 } from 'fflate';
import { SaveStatus } from '@/types/ide';

export function getStarterContentForFile(filename: string, langConfig: LanguageConfig): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const baseName = filename.substring(0, filename.lastIndexOf('.')) || filename;

  switch (ext) {
    case 'java':
      return `public class ${baseName} {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n`;
    case 'cs':
      return `using System;\n\nnamespace CortexApp {\n    class ${baseName} {\n        static void Main(string[] args) {\n            Console.WriteLine("Hello, World!");\n        }\n    }\n}\n`;
    case 'cpp':
    case 'cc':
    case 'cxx':
      return `#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}\n`;
    case 'c':
      return `#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}\n`;
    case 'py':
      return `# Python Script\nprint("Hello, World!")\n`;
    case 'js':
    case 'mjs':
      return `// JavaScript Node script\nconsole.log("Hello, World!");\n`;
    case 'ts':
      return `// TypeScript Module\nconst greeting: string = "Hello, World!";\nconsole.log(greeting);\n`;
    case 'rs':
      return `fn main() {\n    println!("Hello, World!");\n}\n`;
    case 'go':
      return `package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}\n`;
    case 'html':
      return `<!DOCTYPE html>\n<html>\n<head>\n  <title>Preview</title>\n</head>\n<body>\n  <h1>Hello, World!</h1>\n</body>\n</html>\n`;
    case 'css':
      return `/* Styles */\nbody {\n  margin: 0;\n}\n`;
    case 'sql':
      return `-- SQL Query\nSELECT 1;\n`;
    case 'md':
      return `# ${baseName}\n\n`;
    default:
      return langConfig.starterCode || '';
  }
}

export interface UseIdeFilesOptions {
  projectId: string | null;
  initialFiles?: ProjectFile[];
  initialLanguage?: LanguageConfig;
}

export function useIdeFiles({ projectId, initialFiles, initialLanguage }: UseIdeFilesOptions) {
  const defaultLang = initialLanguage || getLanguageConfig('cpp');
  const [currentLang, setCurrentLang] = useState<LanguageConfig>(defaultLang);

  const defaultFiles: ProjectFile[] = initialFiles || [
    {
      id: 'main',
      name: defaultLang.defaultFileName,
      path: `/${defaultLang.defaultFileName}`,
      content: defaultLang.starterCode,
      isOpen: true,
    },
    {
      id: 'readme',
      name: 'README.md',
      path: '/README.md',
      content: '# Cortex Project\n\nWelcome to Cortex Cloud IDE.\n',
      isOpen: false,
    },
  ];

  const [files, setFiles] = useState<ProjectFile[]>(defaultFiles);
  const [activeFileId, setActiveFileId] = useState<string>(defaultFiles[0].id);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  const [fileLanguageOverrides, setFileLanguageOverrides] = useState<Record<string, string>>({});
  const lastFetchTimestampRef = useRef<Record<string, string>>({});
  const saveDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const activeFile = useMemo(() => {
    return files.find((f) => f.id === activeFileId) || files[0] || null;
  }, [files, activeFileId]);

  const handleSelectFile = useCallback((fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    if (!file || file.isFolder) return;

    setActiveFileId(fileId);
    const override = fileLanguageOverrides[fileId];
    const detectedLangId = override || detectLanguage(file.name, file.content, undefined, currentLang.id);
    const newLang = getLanguageConfig(detectedLangId);
    if (newLang) {
      setCurrentLang(newLang);
    }
  }, [files, fileLanguageOverrides, currentLang.id]);

  const handleContentChange = useCallback((newContent: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === activeFileId ? { ...f, content: newContent } : f))
    );
    setSaveStatus('saving');

    if (saveDebounceTimeoutRef.current) {
      clearTimeout(saveDebounceTimeoutRef.current);
    }

    saveDebounceTimeoutRef.current = setTimeout(async () => {
      if (projectId && activeFileId) {
        try {
          await fetch(`/api/v1/projects/${projectId}/files/${activeFileId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: newContent }),
          });
        } catch {}
      }
      setSaveStatus('saved');
    }, 800);
  }, [activeFileId, projectId]);

  const handleForceSave = useCallback(async () => {
    if (saveDebounceTimeoutRef.current) {
      clearTimeout(saveDebounceTimeoutRef.current);
    }
    setSaveStatus('saving');
    if (projectId && activeFileId && activeFile) {
      try {
        await fetch(`/api/v1/projects/${projectId}/files/${activeFileId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: activeFile.content }),
        });
      } catch {}
    }
    setSaveStatus('saved');
  }, [projectId, activeFileId, activeFile]);

  const handleCreateFile = useCallback(
    async (name: string, isFolder?: boolean, parentFolderId?: string) => {
      const parent = parentFolderId ? files.find((f) => f.id === parentFolderId) : null;
      const parentPath = parent ? parent.path.replace(/\/$/, '') : '';
      const detectedLangId = detectLanguage(name, '');
      const detectedLang = getLanguageConfig(detectedLangId);
      const starter = getStarterContentForFile(name, detectedLang);
      const initialContent = isFolder ? '' : starter;
      const path = parent ? `${parentPath}/${name}` : `/${name}`;

      if (projectId) {
        try {
          const res = await fetch(`/api/v1/projects/${projectId}/files`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, path, content: initialContent, isFolder }),
          });
          if (res.ok) {
            const data = await res.json();
            const newF = data.file;
            setFiles((prev) => [...prev, newF]);
            if (newF.updatedAt) lastFetchTimestampRef.current[newF.id] = newF.updatedAt;
            if (!isFolder) {
              setActiveFileId(newF.id);
              setCurrentLang(detectedLang);
            }
            return;
          }
        } catch (e) {
          console.error(e);
        }
      }

      const newF: ProjectFile = {
        id: `f_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name,
        path,
        content: initialContent,
        isFolder,
        parentId: parentFolderId,
      };
      setFiles((prev) => [...prev, newF]);
      if (!isFolder) {
        setActiveFileId(newF.id);
        setCurrentLang(detectedLang);
      }
    },
    [files, projectId]
  );

  const handleDeleteFile = useCallback(
    async (id: string) => {
      if (projectId) {
        try {
          await fetch(`/api/v1/projects/${projectId}/files/${id}`, { method: 'DELETE' });
        } catch (e) {
          console.error(e);
        }
      }

      const getDescendantIds = (targetId: string): string[] => {
        const children = files.filter((f) => f.parentId === targetId);
        return [targetId, ...children.flatMap((c) => getDescendantIds(c.id))];
      };

      const toDelete = getDescendantIds(id);
      setFiles((prev) => prev.filter((f) => !toDelete.includes(f.id)));
      if (toDelete.includes(activeFileId)) {
        const remaining = files.filter((f) => !toDelete.includes(f.id) && !f.isFolder);
        if (remaining[0]) handleSelectFile(remaining[0].id);
        else setActiveFileId('');
      }
    },
    [files, projectId, activeFileId, handleSelectFile]
  );

  const handleRenameFile = useCallback(
    async (id: string, newName: string) => {
      const f = files.find((x) => x.id === id);
      const parentPath = f ? f.path.substring(0, f.path.lastIndexOf('/')) : '';
      const newPath = parentPath === '' ? `/${newName}` : `${parentPath}/${newName}`;

      if (projectId) {
        try {
          await fetch(`/api/v1/projects/${projectId}/files/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName, path: newPath }),
          });
        } catch (e) {
          console.error(e);
        }
      }

      if (id === activeFileId && f && !f.isFolder) {
        const detected = detectLanguage(newName, f.content, undefined, currentLang.id);
        const conf = getLanguageConfig(detected);
        if (conf) {
          setCurrentLang(conf);
        }
      }

      setFiles((prev) =>
        prev.map((file) => {
          if (file.id !== id) return file;
          return { ...file, name: newName, path: newPath };
        })
      );
    },
    [files, projectId, activeFileId, currentLang.id]
  );

  const handleDownloadFile = useCallback((file: ProjectFile) => {
    if (file.isFolder) return;
    const content = file.id === activeFileId && activeFile ? activeFile.content : (file.content || '');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [activeFileId, activeFile]);

  const handleExportProject = useCallback(() => {
    const zipData: Record<string, Uint8Array> = {};
    files.forEach((f) => {
      if (!f.isFolder) {
        const cleanPath = f.path.replace(/^\/+/, '') || f.name;
        const content = f.id === activeFileId && activeFile ? activeFile.content : (f.content || '');
        zipData[cleanPath] = strToU8(content);
      }
    });
    const zipped = zipSync(zipData);
    const blob = new Blob([zipped as any], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const dl = document.createElement('a');
    dl.href = url;
    dl.download = `${projectId || 'cortex-project'}.zip`;
    document.body.appendChild(dl);
    dl.click();
    document.body.removeChild(dl);
    URL.revokeObjectURL(url);
  }, [files, activeFileId, activeFile, projectId]);

  return {
    files,
    setFiles,
    activeFileId,
    setActiveFileId,
    activeFile,
    currentLang,
    setCurrentLang,
    saveStatus,
    setSaveStatus,
    handleSelectFile,
    handleContentChange,
    handleForceSave,
    handleCreateFile,
    handleDeleteFile,
    handleRenameFile,
    handleDownloadFile,
    handleExportProject,
    lastFetchTimestampRef,
  };
}
