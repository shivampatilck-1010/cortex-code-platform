'use client';

import React, { useState, useMemo } from 'react';
import { 
  Folder, 
  FolderOpen,
  FolderPlus, 
  FilePlus, 
  FileCode, 
  Trash2, 
  Edit2, 
  Download, 
  Search,
  ChevronDown,
  ChevronRight,
  MessageSquarePlus,
  AlertCircle
} from 'lucide-react';
import { ProjectFile } from '@/lib/execution/types';
import { LanguageIcon } from '@/components/common/LanguageIcon';
import { LanguageConfig } from '@/config/languages';

interface FileExplorerProps {
  files: ProjectFile[];
  activeFileId: string;
  onSelectFile: (id: string) => void;
  onCreateFile: (name: string, isFolder?: boolean, parentFolderId?: string) => void;
  onDeleteFile: (id: string) => void;
  onRenameFile: (id: string, newName: string) => void;
  onExportProject: () => void;
  isDarkMode?: boolean;
  width?: number;
  currentLanguage?: LanguageConfig;
  onOpenFeedback?: () => void;
  hasActiveError?: boolean;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  activeFileId,
  onSelectFile,
  onCreateFile,
  onDeleteFile,
  onRenameFile,
  onExportProject,
  isDarkMode = true,
  width,
  currentLanguage,
  onOpenFeedback,
  hasActiveError = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState<{
    type: 'file' | 'folder';
    parentFolderId?: string;
  } | null>(null);
  const [createInput, setCreateInput] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // Group files by parentId
  const { rootFiles, childrenByParent, allFoldersMap } = useMemo(() => {
    const root: ProjectFile[] = [];
    const childrenMap: Record<string, ProjectFile[]> = {};
    const foldersMap: Record<string, ProjectFile> = {};

    files.forEach((f) => {
      if (f.isFolder) {
        foldersMap[f.id] = f;
      }
      const pId = f.parentId;
      if (!pId) {
        root.push(f);
      } else {
        if (!childrenMap[pId]) childrenMap[pId] = [];
        childrenMap[pId].push(f);
      }
    });

    const sortFn = (a: ProjectFile, b: ProjectFile) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    };

    root.sort(sortFn);
    Object.keys(childrenMap).forEach((key) => {
      childrenMap[key].sort(sortFn);
    });

    return { rootFiles: root, childrenByParent: childrenMap, allFoldersMap: foldersMap };
  }, [files]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
    setSelectedFolderId(folderId);
  };

  const handleStartCreate = (type: 'file' | 'folder', parentFolderId?: string) => {
    if (parentFolderId) {
      setExpandedFolders((prev) => ({ ...prev, [parentFolderId]: true }));
      setSelectedFolderId(parentFolderId);
    }
    setIsCreating({ type, parentFolderId });
    if (type === 'folder') {
      setCreateInput('new_folder');
    } else {
      const ext = currentLanguage?.fileExtension || '.py';
      let count = 1;
      let candidate = `file_${count}${ext}`;
      while (files.some((f) => f.name.toLowerCase() === candidate.toLowerCase())) {
        count++;
        candidate = `file_${count}${ext}`;
      }
      setCreateInput(candidate);
    }
  };

  const handleFinishCreate = () => {
    if (createInput.trim() && isCreating) {
      let finalName = createInput.trim();
      if (isCreating.type === 'file' && !finalName.includes('.')) {
        const ext = currentLanguage?.fileExtension || '.py';
        finalName = `${finalName}${ext}`;
      }
      onCreateFile(finalName, isCreating.type === 'folder', isCreating.parentFolderId);
      if (isCreating.parentFolderId) {
        setExpandedFolders((prev) => ({
          ...prev,
          [isCreating.parentFolderId!]: true,
        }));
      }
    }
    setIsCreating(null);
    setCreateInput('');
  };

  const handleStartRename = (file: ProjectFile) => {
    setEditingId(file.id);
    setNewName(file.name);
  };

  const handleFinishRename = (id: string) => {
    if (newName.trim()) {
      onRenameFile(id, newName.trim());
    }
    setEditingId(null);
  };

  const renderFileIcon = (fileName: string, isActive: boolean) => {
    const parts = fileName.split('.');
    const ext = parts.length > 1 ? parts.pop()?.toLowerCase() : '';
    const knownExts = ['py', 'cpp', 'c', 'h', 'hpp', 'java', 'js', 'jsx', 'ts', 'tsx', 'rs', 'go', 'rb', 'php', 'swift', 'kt', 'cs', 'r', 'sql', 'sh', 'bash'];
    if (ext && knownExts.includes(ext)) {
      const langKey = ext === 'jsx' ? 'js' : ext === 'tsx' ? 'ts' : ext === 'hpp' || ext === 'h' ? 'cpp' : ext;
      return <LanguageIcon languageId={langKey} size={14} className="flex-shrink-0" />;
    }
    return <FileCode className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-[#ff9100]' : 'text-gray-400'}`} />;
  };

  // Recursive Item Renderer
  const renderItem = (file: ProjectFile, depth = 0): React.ReactNode => {
    const isActive = file.id === activeFileId;
    const isFolder = !!file.isFolder;
    const isExpanded = isFolder ? !!expandedFolders[file.id] : false;
    const isEditing = editingId === file.id;
    const isCreatingInside = isCreating && isCreating.parentFolderId === file.id;
    const children = childrenByParent[file.id] || [];

    // Filter by search term if provided
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchesSelf = file.name.toLowerCase().includes(term);
      const matchesChild = isFolder && (function checkChildren(pid: string): boolean {
        const sub = childrenByParent[pid] || [];
        return sub.some((c) => c.name.toLowerCase().includes(term) || (c.isFolder && checkChildren(c.id)));
      })(file.id);

      if (!matchesSelf && !matchesChild) return null;
    }

    const paddingLeft = depth * 14 + 10;

    return (
      <div key={file.id} className="flex flex-col">
        {/* Row Element */}
        <div
          onClick={() => {
            if (isFolder) {
              toggleFolder(file.id);
            } else {
              onSelectFile(file.id);
            }
          }}
          style={{ paddingLeft: `${paddingLeft}px` }}
          className={`group flex items-center justify-between pr-2 py-1.5 rounded cursor-pointer transition select-none ${
            isActive && !isFolder
              ? isDarkMode
                ? 'bg-[#18191f] text-[#ff9100] font-medium border-l-2 border-[#ff9100]'
                : 'bg-[#ffffff] text-[#0f172a] font-medium border-l-2 border-[#ff9100]'
              : selectedFolderId === file.id && isFolder
                ? 'bg-[#15161b] text-gray-200'
                : isDarkMode
                  ? 'text-gray-300 hover:bg-[#16171d] hover:text-white'
                  : 'text-gray-700 hover:bg-[#f1f5f9] hover:text-gray-900'
          }`}
        >
          <div className="flex items-center space-x-1.5 truncate flex-1 min-w-0 mr-1">
            {isFolder ? (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFolder(file.id);
                  }}
                  className="p-0.5 hover:bg-[#22242c] rounded text-gray-400 hover:text-white"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                  )}
                </button>
                {isExpanded ? (
                  <FolderOpen className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                ) : (
                  <Folder className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                )}
              </>
            ) : (
              <span className="ml-4 flex-shrink-0">
                {renderFileIcon(file.name, isActive)}
              </span>
            )}

            {isEditing ? (
              <input
                type="text"
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleFinishRename(file.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                onBlur={() => handleFinishRename(file.id)}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#0e0f14] text-white px-1.5 py-0.5 rounded text-xs border border-[#ff9100] focus:outline-none font-mono w-full"
              />
            ) : (
              <span className="truncate text-xs font-mono">{file.name}</span>
            )}
          </div>

          {/* Action Buttons on Hover */}
          <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-0.5 flex-shrink-0">
            {isFolder && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartCreate('file', file.id);
                  }}
                  className="p-1 hover:bg-[#252830] rounded text-gray-400 hover:text-[#ff9100] transition"
                  title={`New file inside ${file.name}`}
                >
                  <FilePlus className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartCreate('folder', file.id);
                  }}
                  className="p-1 hover:bg-[#252830] rounded text-gray-400 hover:text-amber-400 transition"
                  title={`New subfolder inside ${file.name}`}
                >
                  <FolderPlus className="w-3 h-3" />
                </button>
              </>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleStartRename(file);
              }}
              className="p-1 hover:bg-[#252830] rounded text-gray-400 hover:text-white transition"
              title="Rename"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteFile(file.id);
              }}
              className="p-1 hover:bg-rose-900/40 rounded text-gray-400 hover:text-rose-400 transition"
              title={isFolder ? 'Delete folder and contents' : 'Delete file'}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Children & Inner Creation Container */}
        {isFolder && isExpanded && (
          <div className="flex flex-col">
            {/* Inline creation input inside this folder */}
            {isCreatingInside && (
              <div 
                style={{ paddingLeft: `${(depth + 1) * 14 + 24}px` }}
                className={`flex items-center space-x-1.5 pr-2 py-1 my-0.5 rounded border border-[#ff9100]/60 ${
                  isDarkMode ? 'bg-[#18191f]' : 'bg-[#ffffff]'
                }`}
              >
                {isCreating.type === 'folder' ? (
                  <Folder className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                ) : (
                  <FileCode className="w-3.5 h-3.5 text-[#ff9100] flex-shrink-0" />
                )}
                <input
                  type="text"
                  autoFocus
                  value={createInput}
                  onChange={(e) => setCreateInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleFinishCreate();
                    if (e.key === 'Escape') setIsCreating(null);
                  }}
                  onBlur={handleFinishCreate}
                  className={`w-full px-1.5 py-0.5 rounded text-xs border border-[#ff9100] focus:outline-none font-mono ${
                    isDarkMode ? 'bg-[#0e0f14] text-white' : 'bg-[#ffffff] text-black'
                  }`}
                />
              </div>
            )}

            {/* Child items */}
            {children.map((child) => renderItem(child, depth + 1))}

            {/* Empty Folder Placeholder / Quick Create Button */}
            {children.length === 0 && !isCreatingInside && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartCreate('file', file.id);
                }}
                style={{ paddingLeft: `${(depth + 1) * 14 + 24}px` }}
                className="py-1 pr-2 text-[11px] text-gray-500 hover:text-[#ff9100] cursor-pointer flex items-center space-x-1.5 transition select-none group/empty"
                title={`Click to create a new file inside ${file.name}`}
              >
                <FilePlus className="w-3 h-3 text-gray-500 group-hover/empty:text-[#ff9100]" />
                <span className="italic">+ New file</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const selectedFolderName = selectedFolderId ? allFoldersMap[selectedFolderId]?.name : null;

  return (
    <div 
      style={width ? { width: `${width}px`, minWidth: `${width}px` } : undefined}
      className={`w-60 border-r flex flex-col h-full text-xs select-none shadow-md transition-colors overflow-hidden ${
        isDarkMode 
          ? 'bg-[#101114] border-[#1f2024]' 
          : 'bg-[#f8fafc] border-[#e2e8f0]'
      }`}
      onClick={() => {
        // Clicking outside any specific row doesn't reset activeFile, but lets user deselect folder
      }}
    >
      {/* Sidebar Header */}
      <div className={`px-3 py-2.5 border-b flex items-center justify-between transition-colors ${
        isDarkMode ? 'bg-[#101114] border-[#1f2024]' : 'bg-[#f1f5f9] border-[#e2e8f0]'
      }`}>
        <div className="flex items-center space-x-1.5 truncate">
          <span className={`font-heading font-semibold uppercase tracking-wider text-xs ${
            isDarkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Files
          </span>
          {selectedFolderName && (
            <span 
              onClick={() => setSelectedFolderId(null)}
              className="text-[10px] text-gray-500 hover:text-gray-300 cursor-pointer font-mono truncate max-w-[70px]"
              title={`Selected folder: ${selectedFolderName}. Click to select root.`}
            >
              in /{selectedFolderName}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => handleStartCreate('file', selectedFolderId || undefined)}
            className={`p-1 rounded transition ${
              isDarkMode ? 'hover:bg-[#1f2024] text-gray-400 hover:text-white' : 'hover:bg-[#e2e8f0] text-gray-600 hover:text-gray-900'
            }`}
            title={selectedFolderName ? `New File in ${selectedFolderName}` : 'New File (root)'}
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleStartCreate('folder', selectedFolderId || undefined)}
            className={`p-1 rounded transition ${
              isDarkMode ? 'hover:bg-[#1f2024] text-gray-400 hover:text-white' : 'hover:bg-[#e2e8f0] text-gray-600 hover:text-gray-900'
            }`}
            title={selectedFolderName ? `New Subfolder in ${selectedFolderName}` : 'New Folder (root)'}
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onExportProject}
            className={`p-1 rounded transition ${
              isDarkMode ? 'hover:bg-[#1f2024] text-gray-400 hover:text-white' : 'hover:bg-[#e2e8f0] text-gray-600 hover:text-gray-900'
            }`}
            title="Export Project (JSON)"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Search Input */}
      <div className={`px-2.5 py-2 border-b ${
        isDarkMode ? 'border-[#1f2024] bg-[#0b0c0e]' : 'border-[#e2e8f0] bg-[#ffffff]'
      }`}>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-2" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-7 pr-2 py-1 rounded text-xs border focus:outline-none focus:border-[#ff9100] transition font-mono ${
              isDarkMode 
                ? 'bg-[#15161b] text-gray-200 border-[#262832] placeholder-gray-500' 
                : 'bg-[#ffffff] text-[#1f2328] border-[#cbd5e1] placeholder-gray-500'
            }`}
          />
        </div>
      </div>

      {/* File Tree List */}
      <div 
        className="flex-1 overflow-y-auto p-1.5 space-y-0.5 scrollbar-thin scrollbar-thumb-[#252830] scrollbar-track-transparent"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setSelectedFolderId(null);
          }
        }}
      >
        {/* Creating new file at root level */}
        {isCreating && !isCreating.parentFolderId && (
          <div className={`flex items-center space-x-1.5 px-2 py-1.5 rounded border border-[#ff9100]/60 ${
            isDarkMode ? 'bg-[#18191f]' : 'bg-[#ffffff]'
          }`}>
            {isCreating.type === 'folder' ? (
              <Folder className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            ) : (
              <FileCode className="w-3.5 h-3.5 text-[#ff9100] flex-shrink-0" />
            )}
            <input
              type="text"
              autoFocus
              value={createInput}
              onChange={(e) => setCreateInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFinishCreate();
                if (e.key === 'Escape') setIsCreating(null);
              }}
              onBlur={handleFinishCreate}
              className={`w-full px-1.5 py-0.5 rounded text-xs border border-[#ff9100] focus:outline-none font-mono ${
                isDarkMode ? 'bg-[#0e0f14] text-white' : 'bg-[#ffffff] text-black'
              }`}
            />
          </div>
        )}

        {/* Root level items & nested children */}
        {rootFiles.map((file) => renderItem(file, 0))}
      </div>

      {/* Bottom Left Corner: Feedback & Error Detection Section */}
      <div className={`p-2 border-t flex items-center justify-between flex-shrink-0 ${
        isDarkMode ? 'border-[#1f2024] bg-[#0e0f13]' : 'border-[#e2e8f0] bg-[#f8fafc]'
      }`}>
        <button
          onClick={onOpenFeedback}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition border ${
            hasActiveError
              ? 'bg-red-500/10 border-red-500/40 text-red-400 hover:bg-red-500/20 hover:border-red-500/60'
              : isDarkMode
              ? 'bg-[#15161b] border-[#22242c] text-gray-400 hover:text-white hover:bg-[#1a1c23] hover:border-[#2f323e]'
              : 'bg-white border-[#cbd5e1] text-gray-700 hover:bg-gray-50'
          }`}
          title="Send feedback or report an error / bug to the team"
        >
          <div className="flex items-center space-x-2 truncate">
            {hasActiveError ? (
              <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 animate-pulse" />
            ) : (
              <MessageSquarePlus className="w-3.5 h-3.5 text-[#ff9100] flex-shrink-0" />
            )}
            <span className="truncate font-heading font-medium text-[11px]">
              {hasActiveError ? 'Error Detected • Report' : 'Feedback / Bug Report'}
            </span>
          </div>
          {hasActiveError ? (
            <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 animate-ping" />
          ) : (
            <span className="text-[10px] text-gray-500 font-mono flex-shrink-0">Mail/DB</span>
          )}
        </button>
      </div>
    </div>
  );
};
