import React, { useState, useRef, useEffect } from 'react';
import { WhiteboardTool, BackgroundType, WhiteboardDocument } from '@/types/whiteboard';
import {
  MousePointer,
  Lasso,
  Hand,
  Pen,
  Pencil,
  Highlighter,
  Eraser,
  Square,
  Circle,
  Triangle,
  Minus,
  ArrowUpRight,
  GitCommit,
  Type,
  StickyNote,
  Binary,
  Layers,
  Undo2,
  Redo2,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Minimize,
  Focus,
  Download,
  Grid,
  Zap,
  Eye,
  ChevronDown,
  Upload,
  Workflow,
  Diamond,
  FileText,
  Split,
} from 'lucide-react';

interface WhiteboardToolbarProps {
  document: WhiteboardDocument;
  selectedTool: WhiteboardTool;
  background: BackgroundType;
  zoom: number;
  canUndo: boolean;
  canRedo: boolean;
  isNavigatorOpen: boolean;
  isSpotlightActive: boolean;
  isSnapToGrid: boolean;
  isFullscreen?: boolean;
  onSelectTool: (tool: WhiteboardTool) => void;
  onToggleNavigator: () => void;
  onSetBackground: (bg: BackgroundType) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  onToggleFullscreen?: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClearPage: () => void;
  onOpenEquationModal: () => void;
  onToggleSpotlight: () => void;
  onToggleSnapToGrid: () => void;
  onExportPNG: () => void;
  onExportZIP: () => void;
  onExportPDF: () => void;
  onExportJSON: () => void;
  onImportJSON: (file: File) => void;
  onRenameDocument: (newTitle: string) => void;
}

export const WhiteboardToolbar: React.FC<WhiteboardToolbarProps> = ({
  document: doc,
  selectedTool,
  background,
  zoom,
  canUndo,
  canRedo,
  isNavigatorOpen,
  isSpotlightActive,
  isSnapToGrid,
  isFullscreen = false,
  onSelectTool,
  onToggleNavigator,
  onSetBackground,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  onToggleFullscreen,
  onUndo,
  onRedo,
  onClearPage,
  onOpenEquationModal,
  onToggleSpotlight,
  onToggleSnapToGrid,
  onExportPNG,
  onExportZIP,
  onExportPDF,
  onExportJSON,
  onImportJSON,
  onRenameDocument,
}) => {
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [bgMenuOpen, setBgMenuOpen] = useState(false);
  const [shapesMenuOpen, setShapesMenuOpen] = useState(false);
  const [connectorsMenuOpen, setConnectorsMenuOpen] = useState(false);
  const [flowMenuOpen, setFlowMenuOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [docTitle, setDocTitle] = useState(doc.title);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activePageIndex = doc.pages.findIndex((p) => p.id === doc.activePageId);
  const currentPageNum = activePageIndex >= 0 ? activePageIndex + 1 : 1;

  // Auto-close popovers on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-popover]')) {
        setExportMenuOpen(false);
        setBgMenuOpen(false);
        setShapesMenuOpen(false);
        setConnectorsMenuOpen(false);
        setFlowMenuOpen(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleTitleSubmit = () => {
    if (docTitle.trim()) {
      onRenameDocument(docTitle.trim());
    }
    setIsEditingTitle(false);
  };

  return (
    <div className="absolute top-2 left-2 right-2 z-20 flex items-center justify-between gap-1 pointer-events-none select-none max-w-[calc(100%-16px)]">
      {/* LEFT SECTION: Document Title, Page Navigator Trigger, Backgrounds */}
      <div className="flex items-center space-x-1 p-1 rounded-xl border border-[#282A36] bg-[#111216]/95 backdrop-blur-md shadow-2xl pointer-events-auto shrink min-w-0">
        {/* Document Title */}
        <div className="flex items-center px-1.5 py-1 min-w-0 max-w-[90px] sm:max-w-[130px] md:max-w-[170px] lg:max-w-[210px]">
          {isEditingTitle ? (
            <input
              type="text"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSubmit();
                if (e.key === 'Escape') setIsEditingTitle(false);
              }}
              autoFocus
              className="w-full bg-[#181920] border border-[#06B6D4] rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
            />
          ) : (
            <span
              onClick={() => setIsEditingTitle(true)}
              className="text-xs font-semibold text-white truncate cursor-pointer hover:text-[#06B6D4]"
              title={`Click to rename: ${doc.title}`}
            >
              {doc.title}
            </span>
          )}
        </div>

        <div className="w-[1px] h-5 bg-[#282A36]" />

        {/* Page Navigator Toggle */}
        <button
          onClick={onToggleNavigator}
          className={`flex items-center space-x-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors shrink-0 ${
            isNavigatorOpen
              ? 'bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/40'
              : 'text-[#A1A1AA] hover:text-white hover:bg-[#1D1F27]'
          }`}
          title="Open Page Navigator"
          aria-label="Toggle Page Navigator"
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">
            Page {currentPageNum}/{doc.pages.length}
          </span>
          <span className="sm:hidden">
            {currentPageNum}/{doc.pages.length}
          </span>
        </button>

        <div className="w-[1px] h-5 bg-[#282A36]" />

        {/* Paper Background Picker */}
        <div className="relative shrink-0" data-popover>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setBgMenuOpen(!bgMenuOpen);
            }}
            className="flex items-center space-x-1 px-1.5 py-1 rounded-lg text-xs text-[#A1A1AA] hover:text-white hover:bg-[#1D1F27] transition-colors"
            title="Paper Background Mode"
            aria-label="Change paper background"
          >
            <Grid className="w-3.5 h-3.5" />
            <span className="hidden lg:inline capitalize">{background.replace('-', ' ')}</span>
            <ChevronDown className="w-3 h-3 ml-0.5" />
          </button>

          {bgMenuOpen && (
            <div className="absolute top-full left-0 mt-2 w-44 rounded-xl border border-[#282A36] bg-[#111216] p-1.5 shadow-2xl space-y-1">
              {[
                { id: 'dark-grid', label: 'Dark Grid' },
                { id: 'light-grid', label: 'Light Grid' },
                { id: 'plain-white', label: 'Plain White' },
                { id: 'ruled', label: 'Ruled Notebook' },
                { id: 'dotted', label: 'Dot Matrix' },
                { id: 'graph', label: 'Engineering Graph' },
              ].map((bg) => (
                <button
                  key={bg.id}
                  onClick={() => {
                    onSetBackground(bg.id as BackgroundType);
                    setBgMenuOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between ${
                    background === bg.id
                      ? 'bg-[#06B6D4]/20 text-[#06B6D4] font-medium'
                      : 'text-[#A1A1AA] hover:text-white hover:bg-[#181922]'
                  }`}
                >
                  <span>{bg.label}</span>
                  {background === bg.id && <span className="w-1.5 h-1.5 rounded-full bg-[#06B6D4]" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CENTER SECTION: Main Teaching Canvas Tool Palette */}
      <div className="flex items-center space-x-0.5 sm:space-x-1 p-1 rounded-xl border border-[#282A36] bg-[#111216]/95 backdrop-blur-md shadow-2xl pointer-events-auto shrink-0">
        {/* Selection Tools */}
        <button
          onClick={() => onSelectTool('select')}
          data-testid="tool-select"
          className={`p-1.5 rounded-lg transition-colors ${
            selectedTool === 'select'
              ? 'bg-[#1D1F27] text-white border border-[#282A36]'
              : 'text-[#A1A1AA] hover:text-white'
          }`}
          title="Pointer Select (V)"
          aria-label="Select Tool"
        >
          <MousePointer className="w-4 h-4" />
        </button>

        <button
          onClick={() => onSelectTool('lasso')}
          className={`p-1.5 rounded-lg transition-colors ${
            selectedTool === 'lasso'
              ? 'bg-[#FF9100]/20 text-[#FF9100] border border-[#FF9100]/40'
              : 'text-[#A1A1AA] hover:text-white'
          }`}
          title="Lasso Selection (L)"
          aria-label="Lasso Selection Tool"
        >
          <Lasso className="w-4 h-4" />
        </button>

        <button
          onClick={() => onSelectTool('pan')}
          className={`p-1.5 rounded-lg transition-colors ${
            selectedTool === 'pan'
              ? 'bg-[#1D1F27] text-white border border-[#282A36]'
              : 'text-[#A1A1AA] hover:text-white'
          }`}
          title="Hand Pan Canvas (H / Space+Drag)"
          aria-label="Pan Tool"
        >
          <Hand className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-5 bg-[#282A36] mx-0.5" />

        {/* Freehand Drawing Tools */}
        <button
          onClick={() => onSelectTool('pen')}
          className={`p-1.5 rounded-lg transition-colors ${
            selectedTool === 'pen'
              ? 'bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/40'
              : 'text-[#A1A1AA] hover:text-white'
          }`}
          title="Freehand Pen"
          aria-label="Freehand Pen Tool"
        >
          <Pen className="w-4 h-4" />
        </button>

        <button
          onClick={() => onSelectTool('pencil')}
          className={`p-1.5 rounded-lg transition-colors ${
            selectedTool === 'pencil'
              ? 'bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/40'
              : 'text-[#A1A1AA] hover:text-white'
          }`}
          title="Sketch Pencil"
          aria-label="Pencil Tool"
        >
          <Pencil className="w-4 h-4" />
        </button>

        <button
          onClick={() => onSelectTool('highlighter')}
          className={`p-1.5 rounded-lg transition-colors ${
            selectedTool === 'highlighter'
              ? 'bg-[#FF9100]/20 text-[#FF9100] border border-[#FF9100]/40'
              : 'text-[#A1A1AA] hover:text-white'
          }`}
          title="Translucent Highlighter"
          aria-label="Highlighter Tool"
        >
          <Highlighter className="w-4 h-4" />
        </button>

        {/* Eraser Tool */}
        <button
          onClick={() => onSelectTool('eraser')}
          className={`p-1.5 rounded-lg transition-colors ${
            selectedTool === 'eraser' || selectedTool === 'object-eraser'
              ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/40 shadow-sm'
              : 'text-[#A1A1AA] hover:text-white'
          }`}
          title="Eraser (E)"
          aria-label="Eraser Tool"
        >
          <Eraser className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-5 bg-[#282A36] mx-0.5" />

        {/* Geometric Shapes */}
        <div className="relative inline-flex items-center" data-popover>
          <div
            className={`inline-flex items-center rounded-lg transition-colors ${
              ['rectangle', 'rounded-rect', 'ellipse', 'triangle'].includes(selectedTool)
                ? 'bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/40 shadow-sm'
                : 'text-[#A1A1AA] hover:text-white hover:bg-[#1D1F27]'
            }`}
          >
            <button
              onClick={() => onSelectTool('rectangle')}
              data-testid="tool-rectangle"
              className={`p-1.5 rounded-l-lg transition-colors ${
                selectedTool === 'rectangle' ? 'text-[#06B6D4]' : 'hover:text-white'
              }`}
              title="Rectangle Tool (R)"
              aria-label="Rectangle Tool"
            >
              <Square className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShapesMenuOpen(!shapesMenuOpen);
              }}
              className="pr-1 pl-0.5 py-1.5 rounded-r-lg hover:text-white transition-colors text-inherit"
              title="Shapes Menu"
              aria-label="Shapes Menu"
            >
              <ChevronDown className="w-2.5 h-2.5" />
            </button>
          </div>

          {shapesMenuOpen && (
            <div className="absolute top-full left-0 mt-2 flex flex-col p-1.5 rounded-xl border border-[#282A36] bg-[#111216] shadow-2xl space-y-1 w-40 z-50">
              {[
                { id: 'rectangle', label: 'Rectangle', icon: Square },
                { id: 'rounded-rect', label: 'Rounded Rect', icon: Square },
                { id: 'ellipse', label: 'Circle / Ellipse', icon: Circle },
                { id: 'triangle', label: 'Triangle', icon: Triangle },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      onSelectTool(s.id as WhiteboardTool);
                      setShapesMenuOpen(false);
                    }}
                    className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                      selectedTool === s.id
                        ? 'bg-[#06B6D4]/20 text-[#06B6D4]'
                        : 'text-[#A1A1AA] hover:text-white hover:bg-[#181922]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Arrow Tool */}
        <button
          onClick={() => onSelectTool('arrow')}
          data-testid="tool-arrow"
          className={`p-1.5 rounded-lg transition-colors flex items-center ${
            selectedTool === 'arrow'
              ? 'bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/40 shadow-sm'
              : 'text-[#A1A1AA] hover:text-white'
          }`}
          title="Arrow Tool (A)"
          aria-label="Arrow Tool"
        >
          <ArrowUpRight className="w-4 h-4" />
        </button>

        {/* Elbow Connector Tool */}
        <div className="relative inline-flex items-center" data-popover>
          <div
            className={`inline-flex items-center rounded-lg transition-colors ${
              ['elbow-connector', 'line', 'double-arrow'].includes(selectedTool)
                ? 'bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/40 shadow-sm'
                : 'text-[#A1A1AA] hover:text-white hover:bg-[#1D1F27]'
            }`}
          >
            <button
              onClick={() => onSelectTool('elbow-connector')}
              data-testid="tool-elbow-connector"
              className={`p-1.5 rounded-l-lg transition-colors ${
                selectedTool === 'elbow-connector' ? 'text-[#06B6D4]' : 'hover:text-white'
              }`}
              title="Elbow Connector Tool (C)"
              aria-label="Elbow Connector Tool"
            >
              <GitCommit className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConnectorsMenuOpen(!connectorsMenuOpen);
              }}
              className="pr-1 pl-0.5 py-1.5 rounded-r-lg hover:text-white transition-colors text-inherit"
              title="Lines & Connectors"
              aria-label="Lines and Connectors Menu"
            >
              <ChevronDown className="w-2.5 h-2.5" />
            </button>
          </div>

          {connectorsMenuOpen && (
            <div className="absolute top-full left-0 mt-2 flex flex-col p-1.5 rounded-xl border border-[#282A36] bg-[#111216] shadow-2xl space-y-1 w-44 z-50">
              {[
                { id: 'line', label: 'Straight Line', icon: Minus },
                { id: 'arrow', label: 'Single Arrow', icon: ArrowUpRight },
                { id: 'double-arrow', label: 'Double Arrow', icon: ArrowUpRight },
                { id: 'elbow-connector', label: 'Elbow Connector', icon: GitCommit },
              ].map((l) => {
                const Icon = l.icon;
                return (
                  <button
                    key={l.id}
                    onClick={() => {
                      onSelectTool(l.id as WhiteboardTool);
                      setConnectorsMenuOpen(false);
                    }}
                    className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                      selectedTool === l.id
                        ? 'bg-[#06B6D4]/20 text-[#06B6D4]'
                        : 'text-[#A1A1AA] hover:text-white hover:bg-[#181922]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{l.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Flowchart Symbols */}
        <div className="relative inline-flex items-center" data-popover>
          <div
            className={`inline-flex items-center rounded-lg transition-colors ${
              selectedTool.startsWith('flow-')
                ? 'bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/40 shadow-sm'
                : 'text-[#A1A1AA] hover:text-white hover:bg-[#1D1F27]'
            }`}
          >
            <button
              onClick={() => onSelectTool(selectedTool.startsWith('flow-') ? selectedTool : 'flow-process')}
              data-testid="tool-flowchart"
              className={`p-1.5 rounded-l-lg transition-colors ${
                selectedTool.startsWith('flow-') ? 'text-[#06B6D4]' : 'hover:text-white'
              }`}
              title="Flowchart Symbols (F)"
              aria-label="Flowchart Mode Menu"
            >
              <Workflow className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFlowMenuOpen(!flowMenuOpen);
              }}
              data-testid="tool-flowchart-menu-trigger"
              className="pr-1 pl-0.5 py-1.5 rounded-r-lg hover:text-white transition-colors text-inherit"
              title="Flowchart Symbols"
              aria-label="Flowchart Symbols Menu"
            >
              <ChevronDown className="w-2.5 h-2.5" />
            </button>
          </div>

          {flowMenuOpen && (
            <div className="absolute top-full left-0 mt-2 flex flex-col p-1.5 rounded-xl border border-[#282A36] bg-[#111216] shadow-2xl space-y-1 w-52 z-50">
              {[
                { id: 'flow-process', label: 'Process (Rectangle)', icon: Square },
                { id: 'flow-decision', label: 'Decision (Diamond)', icon: Diamond },
                { id: 'flow-terminal', label: 'Start / End (Pill)', icon: Circle },
                { id: 'flow-io', label: 'Input / Output (Data)', icon: Split },
                { id: 'flow-document', label: 'Document (Wave)', icon: FileText },
              ].map((f) => {
                const Icon = f.icon;
                return (
                  <button
                    key={f.id}
                    data-testid={`tool-${f.id}`}
                    onClick={() => {
                      onSelectTool(f.id as WhiteboardTool);
                      setFlowMenuOpen(false);
                    }}
                    className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                      selectedTool === f.id
                        ? 'bg-[#06B6D4]/20 text-[#06B6D4] font-medium'
                        : 'text-[#A1A1AA] hover:text-white hover:bg-[#181922]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{f.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="w-[1px] h-5 bg-[#282A36] mx-0.5" />

        {/* Natural Text Tool */}
        <button
          onClick={() => onSelectTool('text')}
          className={`p-1.5 rounded-lg transition-colors ${
            selectedTool === 'text'
              ? 'bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/40'
              : 'text-[#A1A1AA] hover:text-white'
          }`}
          title="Natural Text (T)"
          aria-label="Text Tool"
        >
          <Type className="w-4 h-4" />
        </button>

        {/* Sticky Note Tool */}
        <button
          onClick={() => onSelectTool('sticky-note')}
          className={`p-1.5 rounded-lg transition-colors ${
            selectedTool === 'sticky-note'
              ? 'bg-[#FEF08A]/20 text-[#FEF08A] border border-[#FEF08A]/40'
              : 'text-[#A1A1AA] hover:text-white'
          }`}
          title="Sticky Note (N)"
          aria-label="Sticky Note Tool"
        >
          <StickyNote className="w-4 h-4" />
        </button>

        {/* Equation Modal Trigger */}
        <button
          onClick={onOpenEquationModal}
          className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-[#06B6D4] transition-colors"
          title="Insert Math / Equation"
          aria-label="Insert Math Equation"
        >
          <Binary className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-5 bg-[#282A36] mx-0.5" />

        {/* Teaching Aids */}
        <button
          onClick={() => onSelectTool('laser')}
          className={`p-1.5 rounded-lg transition-colors ${
            selectedTool === 'laser'
              ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/40'
              : 'text-[#A1A1AA] hover:text-white'
          }`}
          title="Temporary Laser Pointer"
          aria-label="Laser Pointer Tool"
        >
          <Zap className="w-4 h-4" />
        </button>

        <button
          onClick={onToggleSpotlight}
          className={`p-1.5 rounded-lg transition-colors ${
            isSpotlightActive
              ? 'bg-[#FF9100]/20 text-[#FF9100] border border-[#FF9100]/40'
              : 'text-[#A1A1AA] hover:text-white'
          }`}
          title="Presentation Spotlight"
          aria-label="Spotlight Mode"
        >
          <Eye className="w-4 h-4" />
        </button>

        <button
          onClick={onToggleSnapToGrid}
          className={`p-1.5 rounded-lg transition-colors ${
            isSnapToGrid
              ? 'bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/40'
              : 'text-[#A1A1AA] hover:text-white'
          }`}
          title={isSnapToGrid ? 'Snap to Grid: ON' : 'Snap to Grid: OFF'}
          aria-label="Toggle Snap to Grid"
        >
          <Grid className="w-4 h-4" />
        </button>
      </div>

      {/* RIGHT SECTION: History, Zoom, Fullscreen, Export, Clear */}
      <div className="flex items-center space-x-1 p-1 rounded-xl border border-[#282A36] bg-[#111216]/95 backdrop-blur-md shadow-2xl pointer-events-auto shrink-0">
        {/* Undo & Redo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="p-1.5 text-[#A1A1AA] hover:text-white disabled:opacity-25 transition-colors rounded-lg"
          title="Undo (Ctrl+Z)"
          aria-label="Undo action"
        >
          <Undo2 className="w-4 h-4" />
        </button>

        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="p-1.5 text-[#A1A1AA] hover:text-white disabled:opacity-25 transition-colors rounded-lg"
          title="Redo (Ctrl+Y)"
          aria-label="Redo action"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-5 bg-[#282A36]" />

        {/* Zoom Controls */}
        <button
          onClick={onZoomOut}
          className="p-1.5 text-[#A1A1AA] hover:text-white transition-colors rounded-lg"
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <span className="font-mono text-[11px] text-[#A1A1AA] px-1">
          {Math.round(zoom * 100)}%
        </span>

        <button
          onClick={onZoomIn}
          className="p-1.5 text-[#A1A1AA] hover:text-white transition-colors rounded-lg"
          title="Zoom In"
          aria-label="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onZoomFit}
          className="p-1.5 text-[#A1A1AA] hover:text-white transition-colors rounded-lg"
          title="Fit to Screen"
          aria-label="Fit to Screen"
        >
          <Maximize className="w-3.5 h-3.5" />
        </button>

        {/* Fullscreen Toggle */}
        {onToggleFullscreen && (
          <button
            onClick={onToggleFullscreen}
            className={`p-1.5 transition-colors rounded-lg ${
              isFullscreen
                ? 'bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/40'
                : 'text-[#A1A1AA] hover:text-white'
            }`}
            title={isFullscreen ? 'Exit Full Screen (Esc)' : 'Enter Full Screen'}
            aria-label={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Focus className="w-3.5 h-3.5" />}
          </button>
        )}

        <div className="w-[1px] h-5 bg-[#282A36]" />

        {/* Export & Download Menu */}
        <div className="relative" data-popover>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExportMenuOpen(!exportMenuOpen);
            }}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-[#1D1F27] hover:bg-[#282A36] text-white text-xs font-medium transition-colors"
            title="Export Document"
            aria-label="Export Menu"
          >
            <Download className="w-3.5 h-3.5 text-[#06B6D4]" />
            <span>Export</span>
            <ChevronDown className="w-3 h-3 text-[#A1A1AA]" />
          </button>

          {exportMenuOpen && (
            <div className="absolute top-full right-0 mt-2 w-56 rounded-xl border border-[#282A36] bg-[#111216] p-1.5 shadow-2xl space-y-1">
              <button
                onClick={() => {
                  onExportPNG();
                  setExportMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-[#A1A1AA] hover:text-white hover:bg-[#181922] transition-colors"
              >
                Current Page (PNG)
              </button>
              <button
                onClick={() => {
                  onExportZIP();
                  setExportMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-[#A1A1AA] hover:text-white hover:bg-[#181922] transition-colors"
              >
                All Pages (ZIP Archive)
              </button>
              <button
                onClick={() => {
                  onExportPDF();
                  setExportMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-[#A1A1AA] hover:text-white hover:bg-[#181922] transition-colors"
              >
                Multi-Page PDF (.pdf)
              </button>
              <div className="w-full h-[1px] bg-[#282A36] my-1" />
              <button
                onClick={() => {
                  onExportJSON();
                  setExportMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-[#A1A1AA] hover:text-white hover:bg-[#181922] transition-colors"
              >
                Save Project JSON
              </button>
              <button
                onClick={() => {
                  fileInputRef.current?.click();
                  setExportMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-[#A1A1AA] hover:text-white hover:bg-[#181922] transition-colors flex items-center justify-between"
              >
                <span>Import Project JSON</span>
                <Upload className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <input
            type="file"
            ref={fileInputRef}
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onImportJSON(e.target.files[0]);
                e.target.value = '';
              }
            }}
          />
        </div>

        {/* Clear Current Page */}
        <button
          onClick={onClearPage}
          className="p-1.5 text-[#EF4444] hover:bg-[#EF4444]/20 transition-colors rounded-lg"
          title="Clear Current Page"
          aria-label="Clear current page"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
