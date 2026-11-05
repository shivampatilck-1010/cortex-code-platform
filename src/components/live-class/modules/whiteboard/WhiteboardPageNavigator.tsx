import React, { useState, useEffect, useRef } from 'react';
import { WhiteboardPage, WhiteboardDocument } from '@/types/whiteboard';
import { renderWhiteboard } from './whiteboardRenderer';
import {
  Plus,
  Copy,
  Trash2,
  ChevronUp,
  ChevronDown,
  X,
  FileText,
  Edit2,
  Check,
} from 'lucide-react';

interface WhiteboardPageNavigatorProps {
  document: WhiteboardDocument;
  activePageId: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectPage: (pageId: string) => void;
  onAddPage: () => void;
  onDuplicatePage: (pageId: string) => void;
  onDeletePage: (pageId: string) => void;
  onRenamePage: (pageId: string, newTitle: string) => void;
  onMovePage: (pageId: string, direction: 'up' | 'down') => void;
}

const PageThumbnail: React.FC<{ page: WhiteboardPage; isActive: boolean }> = ({ page, isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderWhiteboard({
      ctx,
      width: canvas.width,
      height: canvas.height,
      zoom: 0.12, // scaled down thumbnail zoom
      pan: { x: 0, y: 0 },
      background: page.background,
      elements: page.elements,
      isExport: true,
    });
  }, [page.elements, page.background]);

  return (
    <div
      className={`relative w-full aspect-video rounded-md overflow-hidden border ${
        isActive ? 'border-[#06B6D4] ring-1 ring-[#06B6D4]' : 'border-[#282A36]'
      } bg-[#0B0C0E] shadow-sm`}
    >
      <canvas ref={canvasRef} width={240} height={135} className="w-full h-full object-cover" />
    </div>
  );
};

export const WhiteboardPageNavigator: React.FC<WhiteboardPageNavigatorProps> = ({
  document: doc,
  activePageId,
  isOpen,
  onClose,
  onSelectPage,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  onRenamePage,
  onMovePage,
}) => {
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  if (!isOpen) return null;

  const startRename = (page: WhiteboardPage) => {
    setEditingPageId(page.id);
    setEditTitle(page.title);
  };

  const saveRename = (pageId: string) => {
    if (editTitle.trim()) {
      onRenamePage(pageId, editTitle.trim());
    }
    setEditingPageId(null);
  };

  return (
    <div
      data-testid="whiteboard-page-navigator"
      className="absolute top-16 left-4 z-20 w-72 max-h-[calc(100vh-140px)] flex flex-col rounded-xl border border-[#282A36] bg-[#111216]/98 backdrop-blur-md shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#282A36] bg-[#15161C]/80">
        <div className="flex items-center space-x-2">
          <FileText className="w-4 h-4 text-[#06B6D4]" />
          <span className="text-xs font-semibold text-white">Pages ({doc.pages.length})</span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={onAddPage}
            className="flex items-center space-x-1 px-2 py-1 rounded bg-[#06B6D4]/15 hover:bg-[#06B6D4]/25 text-[#06B6D4] text-[11px] font-medium transition-colors"
            title="Add New Blank Page"
            aria-label="Add new whiteboard page"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#71717A] hover:text-white transition-colors"
            title="Close Navigator"
            aria-label="Close page navigator"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pages List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-3">
        {doc.pages.map((page, index) => {
          const isActive = page.id === activePageId;
          const isFirst = index === 0;
          const isLast = index === doc.pages.length - 1;

          return (
            <div
              key={page.id}
              className={`group flex flex-col p-2 rounded-lg border transition-all ${
                isActive
                  ? 'bg-[#181A22] border-[#06B6D4]/60'
                  : 'bg-[#14151B] border-[#222430] hover:border-[#2D303E]'
              }`}
            >
              {/* Thumbnail */}
              <div
                onClick={() => onSelectPage(page.id)}
                className="cursor-pointer mb-2"
                role="button"
                tabIndex={0}
                aria-label={`Select ${page.title}`}
              >
                <PageThumbnail page={page} isActive={isActive} />
              </div>

              {/* Title and Action Controls */}
              <div className="flex items-center justify-between">
                {editingPageId === page.id ? (
                  <div className="flex items-center space-x-1 flex-1 mr-1">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveRename(page.id);
                        if (e.key === 'Escape') setEditingPageId(null);
                      }}
                      autoFocus
                      className="w-full bg-[#0B0C0E] border border-[#06B6D4] rounded px-2 py-0.5 text-xs text-white focus:outline-none"
                    />
                    <button
                      onClick={() => saveRename(page.id)}
                      className="p-1 text-[#06B6D4] hover:bg-[#06B6D4]/20 rounded"
                      aria-label="Save page name"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1.5 flex-1 min-w-0">
                    <span className="text-[10px] font-mono text-[#71717A]">{index + 1}.</span>
                    <span
                      onClick={() => onSelectPage(page.id)}
                      className="text-xs text-white truncate cursor-pointer hover:text-[#06B6D4]"
                      title={page.title}
                    >
                      {page.title}
                    </span>
                    <button
                      onClick={() => startRename(page)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-[#71717A] hover:text-white transition-opacity"
                      title="Rename Page"
                      aria-label={`Rename ${page.title}`}
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Page Toolbar Actions */}
                <div className="flex items-center space-x-0.5">
                  <button
                    onClick={() => onMovePage(page.id, 'up')}
                    disabled={isFirst}
                    className="p-1 text-[#71717A] hover:text-white disabled:opacity-20 transition-colors"
                    title="Move Page Up"
                    aria-label="Move page up"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onMovePage(page.id, 'down')}
                    disabled={isLast}
                    className="p-1 text-[#71717A] hover:text-white disabled:opacity-20 transition-colors"
                    title="Move Page Down"
                    aria-label="Move page down"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDuplicatePage(page.id)}
                    className="p-1 text-[#71717A] hover:text-[#06B6D4] transition-colors"
                    title="Duplicate Page"
                    aria-label={`Duplicate ${page.title}`}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(page.id)}
                    disabled={doc.pages.length <= 1}
                    className="p-1 text-[#71717A] hover:text-[#EF4444] disabled:opacity-20 transition-colors"
                    title={doc.pages.length <= 1 ? 'Cannot delete the only page' : 'Delete Page'}
                    aria-label={`Delete ${page.title}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="p-3 border-t border-[#282A36] bg-[#181922] space-y-2">
          <p className="text-[11px] text-[#EF4444] font-medium">Delete this page and its contents?</p>
          <div className="flex items-center justify-end space-x-2">
            <button
              onClick={() => setDeleteConfirmId(null)}
              className="px-2.5 py-1 rounded bg-[#222430] hover:bg-[#2A2C3C] text-[11px] text-white"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onDeletePage(deleteConfirmId);
                setDeleteConfirmId(null);
              }}
              className="px-2.5 py-1 rounded bg-[#EF4444] hover:bg-[#DC2626] text-[11px] text-white font-medium"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
