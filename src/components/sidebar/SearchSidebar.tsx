'use client';

import React, { useMemo, useState } from 'react';
import { Search, FileCode2, X } from 'lucide-react';
import { ProjectFile } from '@/lib/execution/types';
import { LanguageIcon } from '@/components/common/LanguageIcon';
import { detectLanguageFromFilename } from '@/lib/editor/language-detector';

interface SearchMatch {
  lineNumber: number;
  lineText: string;
}

interface FileSearchResult {
  file: ProjectFile;
  matches: SearchMatch[];
}

export interface SearchSidebarProps {
  files: ProjectFile[];
  onSelectMatch: (fileId: string, lineNumber?: number) => void;
  isDarkMode?: boolean;
  width?: number;
}

/**
 * Full-workspace file & content search sidebar wired cleanly into the IDE rail.
 */
export const SearchSidebar: React.FC<SearchSidebarProps> = ({
  files,
  onSelectMatch,
  isDarkMode = true,
  width,
}) => {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);

  const results = useMemo<FileSearchResult[]>(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const needle = caseSensitive ? trimmed : trimmed.toLowerCase();
    const matchedFiles: FileSearchResult[] = [];

    for (const file of files) {
      if (file.isFolder) continue;

      const fileNameTarget = caseSensitive ? file.name : file.name.toLowerCase();
      const nameMatched = fileNameTarget.includes(needle);
      const lines = (file.content || '').split('\n');
      const matches: SearchMatch[] = [];

      for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        const lineTarget = caseSensitive ? rawLine : rawLine.toLowerCase();
        if (lineTarget.includes(needle)) {
          matches.push({
            lineNumber: i + 1,
            lineText: rawLine.trim(),
          });
          if (matches.length >= 25) break;
        }
      }

      if (nameMatched || matches.length > 0) {
        matchedFiles.push({ file, matches });
      }
    }

    return matchedFiles;
  }, [files, query, caseSensitive]);

  const totalMatches = useMemo(
    () => results.reduce((sum, item) => sum + Math.max(1, item.matches.length), 0),
    [results]
  );

  return (
    <div
      data-testid="search-sidebar"
      style={width ? { width: `${width}px`, minWidth: `${width}px` } : undefined}
      className={`${
        isDarkMode ? 'dark bg-[#0F0F12] text-zinc-100' : 'bg-[#F8F8FA] text-zinc-900'
      } h-full w-full flex flex-col text-xs select-none overflow-hidden`}
    >
      {/* Header */}
      <div className="h-[34px] px-3 border-b border-black/[0.08] dark:border-white/[0.07] flex items-center justify-between shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
          Search
        </span>
        {query.trim() && (
          <span className="text-[10.5px] font-mono text-zinc-500">
            {totalMatches} {totalMatches === 1 ? 'hit' : 'hits'}
          </span>
        )}
      </div>

      {/* Search Input */}
      <div className="p-2.5 border-b border-black/[0.06] dark:border-white/[0.06] shrink-0">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across files..."
            data-testid="ide-search-input"
            className="w-full h-7 pl-8 pr-14 rounded-md text-[12px] font-mono bg-white dark:bg-[#141418] border border-black/[0.08] dark:border-white/[0.08] focus:outline-none focus:border-amber-500/70 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
          />
          <div className="absolute right-1.5 flex items-center gap-0.5">
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                title="Clear search"
                className="p-0.5 rounded text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setCaseSensitive((v) => !v)}
              title="Match Case"
              className={`px-1 h-5 rounded text-[10px] font-mono transition-colors ${
                caseSensitive
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              Aa
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {!query.trim() ? (
          <div className="py-10 px-4 text-center text-[11.5px] text-zinc-500 space-y-1">
            <FileCode2 className="w-5 h-5 mx-auto opacity-40 mb-2" />
            <p>Type to search filenames and code lines across your project.</p>
          </div>
        ) : results.length === 0 ? (
          <div className="py-10 px-4 text-center text-[11.5px] text-zinc-500">
            No matches found for &quot;{query}&quot;.
          </div>
        ) : (
          results.map(({ file, matches }) => {
            const langId = detectLanguageFromFilename(file.name);
            return (
              <div key={file.id} className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => onSelectMatch(file.id, matches[0]?.lineNumber)}
                  className="w-full px-2 py-1 rounded flex items-center justify-between gap-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.05] text-left transition-colors"
                >
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <LanguageIcon languageId={langId || 'plaintext'} className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-medium text-[11.5px] truncate text-zinc-800 dark:text-zinc-200">
                      {file.name}
                    </span>
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                    {matches.length || 'file'}
                  </span>
                </button>

                {matches.map((m, idx) => (
                  <button
                    key={`${file.id}-${m.lineNumber}-${idx}`}
                    type="button"
                    onClick={() => onSelectMatch(file.id, m.lineNumber)}
                    className="w-full pl-5 pr-2 py-1 rounded flex items-center gap-2 text-[11px] font-mono text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] text-left transition-colors"
                  >
                    <span className="text-zinc-400 shrink-0 w-6 text-right">{m.lineNumber}</span>
                    <span className="truncate">{m.lineText || '(blank)'}</span>
                  </button>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
