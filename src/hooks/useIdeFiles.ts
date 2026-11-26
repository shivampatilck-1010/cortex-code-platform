'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { ProjectFile } from '@/lib/execution/types';
import { LanguageConfig, SUPPORTED_LANGUAGES, getLanguageConfig } from '@/config/languages';
import { detectLanguage, detectLanguageFromFilename } from '@/lib/editor/language-detector';
import { zipSync, strToU8 } from 'fflate';
import { SaveStatus } from '@/types/ide';

function toValidTypeIdentifier(raw: string, fallback: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[^a-zA-Z_]+/, '');
  return cleaned || fallback;
}

const KNOWN_EXTENSION_STARTERS: Record<string, (baseName: string, filename: string) => string> = {
  java: (base) =>
    `public class ${toValidTypeIdentifier(base, 'Main')} {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n`,
  cs: (base) =>
    `using System;\n\nnamespace CortexApp {\n    class ${toValidTypeIdentifier(base, 'Program')} {\n        static void Main(string[] args) {\n            Console.WriteLine("Hello, World!");\n        }\n    }\n}\n`,
  cpp: () =>
    `#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!\\n";\n    return 0;\n}\n`,
  cc: () =>
    `#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!\\n";\n    return 0;\n}\n`,
  cxx: () =>
    `#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!\\n";\n    return 0;\n}\n`,
  'c++': () =>
    `#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!\\n";\n    return 0;\n}\n`,
  hpp: (base) => `#pragma once\n\n// ${base} C++ header declarations\n`,
  c: () => `#include <stdio.h>\n\nint main(void) {\n    printf("Hello, World!\\n");\n    return 0;\n}\n`,
  h: (base) => {
    const guard = `${toValidTypeIdentifier(base, 'HEADER').toUpperCase()}_H`;
    return `#ifndef ${guard}\n#define ${guard}\n\n#endif\n`;
  },
  py: () => `# Python 3.14 Script\nprint("Hello, World!")\n`,
  pyw: () => `# Python Script\nprint("Hello, World!")\n`,
  js: () => `// JavaScript (Node.js 22 LTS)\nconsole.log("Hello, World!");\n`,
  mjs: () => `// JavaScript ES Module\nconsole.log("Hello, World!");\n`,
  cjs: () => `// JavaScript CommonJS\nconsole.log("Hello, World!");\n`,
  jsx: () => `// JSX Component\nexport default function App() {\n  return <h1>Hello, World!</h1>;\n}\n`,
  ts: () => `// TypeScript 5.6+ Module\nconst greeting: string = "Hello, World!";\nconsole.log(greeting);\n`,
  mts: () => `// TypeScript ES Module\nconst greeting: string = "Hello, World!";\nconsole.log(greeting);\n`,
  tsx: () => `// TypeScript React Component\nexport default function App() {\n  return <h1>Hello, World!</h1>;\n}\n`,
  rs: () => `fn main() {\n    println!("Hello, World!");\n}\n`,
  go: () => `package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}\n`,
  kt: () => `fun main() {\n    println("Hello, World!")\n}\n`,
  kts: () => `println("Hello, World!")\n`,
  swift: () => `import Foundation\n\nprint("Hello, World!")\n`,
  php: () => `<?php\necho "Hello, World!\\n";\n`,
  rb: () => `# Ruby Script\nputs "Hello, World!"\n`,
  dart: () => `void main() {\n  print('Hello, World!');\n}\n`,
  scala: () => `@main def run(): Unit =\n  println("Hello, World!")\n`,
  sc: () => `println("Hello, World!")\n`,
  hs: () => `main :: IO ()\nmain = putStrLn "Hello, World!"\n`,
  exs: () => `IO.puts("Hello, World!")\n`,
  ex: () => `defmodule Main do\n  def run, do: IO.puts("Hello, World!")\nend\n`,
  fs: () => `[<EntryPoint>]\nlet main _ =\n    printfn "Hello, World!"\n    0\n`,
  fsx: () => `printfn "Hello, World!"\n`,
  r: () => `cat("Hello, World!\\n")\n`,
  sh: () => `#!/bin/bash\necho "Hello, World!"\n`,
  bash: () => `#!/bin/bash\necho "Hello, World!"\n`,
  lua: () => `print("Hello, World!")\n`,
  pl: () => `#!/usr/bin/perl\nuse strict;\nuse warnings;\nprint "Hello, World!\\n";\n`,
  pm: (base) => `package ${toValidTypeIdentifier(base, 'Module')};\nuse strict;\nuse warnings;\n1;\n`,
  html: () => `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <title>Preview</title>\n</head>\n<body>\n  <h1>Hello, World!</h1>\n</body>\n</html>\n`,
  htm: () => `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <title>Preview</title>\n</head>\n<body>\n  <h1>Hello, World!</h1>\n</body>\n</html>\n`,
  css: () => `/* Styles */\nbody {\n  margin: 0;\n  font-family: system-ui, sans-serif;\n}\n`,
  scss: () => `/* SCSS Styles */\nbody {\n  margin: 0;\n}\n`,
  sql: () => `-- SQL Query\nSELECT 1 AS status;\n`,
  json: () => `{\n  "name": "cortex-project",\n  "version": "1.0.0"\n}\n`,
  yaml: () => `# YAML Configuration\nname: cortex-project\nversion: 1.0.0\n`,
  yml: () => `# YAML Configuration\nname: cortex-project\nversion: 1.0.0\n`,
  toml: () => `# TOML Configuration\nname = "cortex-project"\nversion = "1.0.0"\n`,
  ini: () => `[cortex]\nversion = 1.0.0\n`,
  xml: () => `<?xml version="1.0" encoding="UTF-8"?>\n<root />\n`,
  svg: () => `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"></svg>\n`,
  md: (base) => `# ${base}\n\n`,
  markdown: (base) => `# ${base}\n\n`,
  txt: () => ``,
  log: () => ``,
};

export function getStarterContentForFile(filename: string, langConfig?: LanguageConfig): string {
  const dotIdx = filename.lastIndexOf('.');
  const ext = dotIdx !== -1 ? filename.substring(dotIdx + 1).toLowerCase() : '';
  const baseName = dotIdx > 0 ? filename.substring(0, dotIdx) : filename || 'main';

  if (ext && KNOWN_EXTENSION_STARTERS[ext]) {
    return KNOWN_EXTENSION_STARTERS[ext](baseName, filename);
  }

  const extLangId = detectLanguageFromFilename(filename);
  if (extLangId) {
    return getLanguageConfig(extLangId).starterCode || '';
  }

  if (dotIdx !== -1 && !langConfig) {
    return '';
  }

  return langConfig?.starterCode || '';
}

/**
 * Returns true if the current buffer is empty or still equals an unmodified
 * starter/boilerplate template (so renaming a file extension or switching
 * languages can cleanly refresh the template without discarding user code).
 */
export function isUntouchedStarterCode(content: string, currentFilename?: string): boolean {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  if (!normalized) return true;

  for (const lang of SUPPORTED_LANGUAGES) {
    if (lang.starterCode.replace(/\r\n/g, '\n').trim() === normalized) {
      return true;
    }
    const fromDefault = getStarterContentForFile(lang.defaultFileName, lang).replace(/\r\n/g, '\n').trim();
    if (fromDefault && fromDefault === normalized) {
      return true;
    }
  }

  if (currentFilename) {
    const extId = detectLanguageFromFilename(currentFilename);
    const cfg = extId ? getLanguageConfig(extId) : undefined;
    const forFile = getStarterContentForFile(currentFilename, cfg).replace(/\r\n/g, '\n').trim();
    if (forFile && forFile === normalized) {
      return true;
    }
  }

  for (const builder of Object.values(KNOWN_EXTENSION_STARTERS)) {
    const sample = builder('main', 'main.tmp').replace(/\r\n/g, '\n').trim();
    if (sample && sample === normalized) {
      return true;
    }
  }

  // Also catch legacy hardcoded Python 3.12+ default boilerplate across workspaces
  if (
    normalized.startsWith('# Universal Online Platform - ') &&
    normalized.split('\n').length <= 24
  ) {
    return true;
  }
  if (normalized === '# Python Script\nprint("Hello, World!")') {
    return true;
  }

  return false;
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
