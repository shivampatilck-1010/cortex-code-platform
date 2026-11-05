import React from 'react';
import { WhiteboardTool, WhiteboardElement } from '@/types/whiteboard';
import {
  Copy,
  Trash2,
  BringToFront,
  SendToBack,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';

interface WhiteboardContextBarProps {
  selectedTool: WhiteboardTool;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  strokeDash: 'solid' | 'dashed';
  selectedElements: WhiteboardElement[];
  onSetStrokeColor: (color: string) => void;
  onSetFillColor: (color: string) => void;
  onSetStrokeWidth: (width: number) => void;
  onSetStrokeDash: (dash: 'solid' | 'dashed') => void;
  onSetTool: (tool: WhiteboardTool) => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onUpdateSelectedProps: (props: Partial<WhiteboardElement>) => void;
}

const PALETTE = [
  { label: 'White', value: '#F5F5F5' },
  { label: 'Cyan', value: '#06B6D4' },
  { label: 'Amber', value: '#FF9100' },
  { label: 'Emerald', value: '#10B981' },
  { label: 'Purple', value: '#A855F7' },
  { label: 'Red', value: '#EF4444' },
];

const STICKY_COLORS = [
  { label: 'Yellow', value: '#FEF08A' },
  { label: 'Cyan', value: '#BAE6FD' },
  { label: 'Emerald', value: '#A7F3D0' },
  { label: 'Rose', value: '#FECDD3' },
  { label: 'Purple', value: '#E9D5FF' },
];

const STROKE_WIDTHS = [2, 4, 8, 14];

export const WhiteboardContextBar: React.FC<WhiteboardContextBarProps> = ({
  selectedTool,
  strokeColor,
  fillColor,
  strokeWidth,
  strokeDash,
  selectedElements,
  onSetStrokeColor,
  onSetFillColor,
  onSetStrokeWidth,
  onSetStrokeDash,
  onSetTool,
  onDuplicateSelected,
  onDeleteSelected,
  onBringForward,
  onSendBackward,
  onUpdateSelectedProps,
}) => {
  const hasSelection = selectedElements.length > 0;
  const singleEl = hasSelection && selectedElements.length === 1 ? selectedElements[0] : null;

  // Render contextual bar if there is a selection or an active tool with properties
  const isDrawTool = selectedTool === 'pen' || selectedTool === 'pencil' || selectedTool === 'highlighter';
  const isEraserTool = selectedTool === 'eraser' || selectedTool === 'object-eraser';
  const isShapeTool =
    selectedTool === 'rectangle' ||
    selectedTool === 'rounded-rect' ||
    selectedTool === 'ellipse' ||
    selectedTool === 'triangle' ||
    selectedTool === 'line' ||
    selectedTool === 'arrow' ||
    selectedTool === 'double-arrow' ||
    selectedTool === 'elbow-connector' ||
    selectedTool.startsWith('flow-');
  const isTextTool = selectedTool === 'text';
  const isStickyTool = selectedTool === 'sticky-note';

  if (!hasSelection && !isDrawTool && !isEraserTool && !isShapeTool && !isTextTool && !isStickyTool) {
    return null;
  }

  return (
    <div
      data-testid="whiteboard-context-bar"
      className="absolute top-16 left-1/2 -translate-x-1/2 z-10 flex items-center space-x-2 px-3 py-1.5 rounded-xl border border-[#282A36] bg-[#111216]/95 backdrop-blur-md shadow-xl text-xs select-none"
    >
      {/* 1. SELECTION CONTROLS */}
      {hasSelection && (
        <div className="flex items-center space-x-1.5 pr-2 border-r border-[#282A36]">
          <span className="text-[10px] font-mono text-[#06B6D4] font-medium mr-1">
            {selectedElements.length} {selectedElements.length === 1 ? 'item' : 'items'}
          </span>
          <button
            onClick={onDuplicateSelected}
            className="p-1.5 text-[#A1A1AA] hover:text-white hover:bg-[#1D1F27] rounded transition-colors"
            title="Duplicate Selected (Ctrl+D)"
            aria-label="Duplicate selected element"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onBringForward}
            className="p-1.5 text-[#A1A1AA] hover:text-white hover:bg-[#1D1F27] rounded transition-colors"
            title="Bring to Front"
            aria-label="Bring to front"
          >
            <BringToFront className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onSendBackward}
            className="p-1.5 text-[#A1A1AA] hover:text-white hover:bg-[#1D1F27] rounded transition-colors"
            title="Send to Back"
            aria-label="Send to back"
          >
            <SendToBack className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDeleteSelected}
            className="p-1.5 text-[#EF4444] hover:bg-[#EF4444]/20 rounded transition-colors"
            title="Delete Selected (Del)"
            aria-label="Delete selected element"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. ERASER SUB-MODES */}
      {isEraserTool && (
        <div className="flex items-center space-x-2">
          <span className="text-[10px] text-[#A1A1AA] font-mono">Eraser Mode:</span>
          <button
            data-testid="eraser-mode-partial"
            onClick={() => onSetTool('eraser')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              selectedTool === 'eraser'
                ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/40'
                : 'text-[#A1A1AA] hover:text-white hover:bg-[#15161C]'
            }`}
            title="Slices and erases freehand strokes partially"
          >
            Partial Stroke
          </button>
          <button
            data-testid="eraser-mode-object"
            onClick={() => onSetTool('object-eraser')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              selectedTool === 'object-eraser'
                ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/40'
                : 'text-[#A1A1AA] hover:text-white hover:bg-[#15161C]'
            }`}
            title="Removes whole objects upon touch"
          >
            Object Eraser
          </button>
        </div>
      )}

      {/* 3. STROKE COLOR PALETTE */}
      {(isDrawTool || isShapeTool || (hasSelection && !singleEl?.type?.startsWith('sticky-'))) && (
        <div className="flex items-center space-x-1">
          {PALETTE.map((c) => (
            <button
              key={c.value}
              onClick={() => {
                onSetStrokeColor(c.value);
                if (hasSelection) onUpdateSelectedProps({ color: c.value });
              }}
              className={`w-4 h-4 rounded-full transition-transform ${
                strokeColor === c.value ? 'scale-125 ring-2 ring-white/70' : 'hover:scale-110'
              }`}
              style={{ backgroundColor: c.value }}
              title={`Stroke color ${c.label}`}
              aria-label={`Stroke color ${c.label}`}
            />
          ))}
        </div>
      )}

      {/* 4. FILL COLOR (FOR SHAPES & FLOW NODES) */}
      {(isShapeTool || (singleEl && singleEl.type !== 'text' && !singleEl.type.startsWith('sticky-'))) && (
        <div className="flex items-center space-x-1 pl-2 border-l border-[#282A36]">
          <span className="text-[10px] text-[#71717A] mr-1">Fill:</span>
          <button
            onClick={() => {
              onSetFillColor('transparent');
              if (hasSelection) onUpdateSelectedProps({ fillColor: 'transparent' });
            }}
            className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
              fillColor === 'transparent' ? 'bg-[#282A36] text-white' : 'text-[#71717A] hover:text-white'
            }`}
            title="Transparent fill"
          >
            None
          </button>
          <button
            onClick={() => {
              onSetFillColor('rgba(6, 182, 212, 0.15)');
              if (hasSelection) onUpdateSelectedProps({ fillColor: 'rgba(6, 182, 212, 0.15)' });
            }}
            className={`w-3.5 h-3.5 rounded bg-[#06B6D4]/20 border border-[#06B6D4]/50 ${
              fillColor.includes('06B6D4') ? 'ring-2 ring-white/60' : ''
            }`}
            title="Cyan tint fill"
          />
          <button
            onClick={() => {
              onSetFillColor('rgba(255, 145, 0, 0.15)');
              if (hasSelection) onUpdateSelectedProps({ fillColor: 'rgba(255, 145, 0, 0.15)' });
            }}
            className={`w-3.5 h-3.5 rounded bg-[#FF9100]/20 border border-[#FF9100]/50 ${
              fillColor.includes('FF9100') ? 'ring-2 ring-white/60' : ''
            }`}
            title="Amber tint fill"
          />
        </div>
      )}

      {/* 5. STROKE WIDTH */}
      {(isDrawTool || isShapeTool || isEraserTool || hasSelection) && (
        <div className="flex items-center space-x-1 pl-2 border-l border-[#282A36]">
          {STROKE_WIDTHS.map((w) => (
            <button
              key={w}
              onClick={() => {
                onSetStrokeWidth(w);
                if (hasSelection) onUpdateSelectedProps({ strokeWidth: w });
              }}
              className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
                strokeWidth === w ? 'bg-[#282A36] text-white border border-[#3E4050]' : 'text-[#71717A] hover:text-white'
              }`}
              title={isEraserTool ? `Radius ${w * 3}px` : `Thickness ${w}px`}
              aria-label={isEraserTool ? `Eraser size ${w * 3}px` : `Stroke width ${w}px`}
            >
              <span className="rounded-full bg-current" style={{ width: `${Math.min(10, w * 1.2)}px`, height: `${Math.min(10, w * 1.2)}px` }} />
            </button>
          ))}
        </div>
      )}

      {/* 6. DASH STYLE */}
      {(isShapeTool || (hasSelection && !isTextTool)) && (
        <div className="flex items-center space-x-1 pl-2 border-l border-[#282A36]">
          <button
            onClick={() => {
              onSetStrokeDash('solid');
              if (hasSelection) onUpdateSelectedProps({ strokeDash: 'solid' });
            }}
            className={`px-1.5 py-0.5 rounded text-[10px] ${strokeDash === 'solid' ? 'bg-[#282A36] text-white' : 'text-[#71717A] hover:text-white'}`}
          >
            Solid
          </button>
          <button
            onClick={() => {
              onSetStrokeDash('dashed');
              if (hasSelection) onUpdateSelectedProps({ strokeDash: 'dashed' });
            }}
            className={`px-1.5 py-0.5 rounded text-[10px] ${strokeDash === 'dashed' ? 'bg-[#282A36] text-white' : 'text-[#71717A] hover:text-white'}`}
          >
            Dashed
          </button>
        </div>
      )}

      {/* 7. TEXT FORMATTING CONTROLS */}
      {(isTextTool || (singleEl && singleEl.type === 'text')) && (
        <div className="flex items-center space-x-1.5 pl-2 border-l border-[#282A36]">
          <select
            value={singleEl?.fontSize || 20}
            onChange={(e) => onUpdateSelectedProps({ fontSize: Number(e.target.value) })}
            className="bg-[#15161C] border border-[#282A36] rounded px-1.5 py-0.5 text-[11px] text-white"
          >
            <option value="14">14px</option>
            <option value="16">16px</option>
            <option value="20">20px</option>
            <option value="24">24px</option>
            <option value="28">28px</option>
            <option value="32">32px</option>
            <option value="40">40px</option>
          </select>
          <button
            onClick={() =>
              onUpdateSelectedProps({
                fontWeight: singleEl?.fontWeight === 'bold' ? 'normal' : 'bold',
              })
            }
            className={`p-1 rounded ${singleEl?.fontWeight === 'bold' ? 'bg-[#282A36] text-[#06B6D4]' : 'text-[#A1A1AA] hover:text-white'}`}
            title="Bold"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() =>
              onUpdateSelectedProps({
                fontStyle: singleEl?.fontStyle === 'italic' ? 'normal' : 'italic',
              })
            }
            className={`p-1 rounded ${singleEl?.fontStyle === 'italic' ? 'bg-[#282A36] text-[#06B6D4]' : 'text-[#A1A1AA] hover:text-white'}`}
            title="Italic"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onUpdateSelectedProps({ textAlign: 'left' })}
            className={`p-1 rounded ${singleEl?.textAlign === 'left' ? 'bg-[#282A36] text-[#06B6D4]' : 'text-[#A1A1AA] hover:text-white'}`}
            title="Align Left"
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onUpdateSelectedProps({ textAlign: 'center' })}
            className={`p-1 rounded ${singleEl?.textAlign === 'center' ? 'bg-[#282A36] text-[#06B6D4]' : 'text-[#A1A1AA] hover:text-white'}`}
            title="Align Center"
          >
            <AlignCenter className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onUpdateSelectedProps({ textAlign: 'right' })}
            className={`p-1 rounded ${singleEl?.textAlign === 'right' ? 'bg-[#282A36] text-[#06B6D4]' : 'text-[#A1A1AA] hover:text-white'}`}
            title="Align Right"
          >
            <AlignRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 8. STICKY NOTE COLOR CONTROLS */}
      {(isStickyTool || (singleEl && singleEl.type === 'sticky-note')) && (
        <div className="flex items-center space-x-1.5 pl-2 border-l border-[#282A36]">
          <span className="text-[10px] text-[#71717A]">Note:</span>
          {STICKY_COLORS.map((sc) => (
            <button
              key={sc.value}
              onClick={() => {
                onUpdateSelectedProps({ backgroundColor: sc.value });
              }}
              className="w-4 h-4 rounded-sm border border-black/20 hover:scale-110 transition-transform"
              style={{ backgroundColor: sc.value }}
              title={sc.label}
            />
          ))}
        </div>
      )}

      {/* 9. FLOWCHART NODE LABEL CONTROLS */}
      {singleEl && singleEl.type.startsWith('flow-') && (
        <div className="flex items-center space-x-1.5 pl-2 border-l border-[#282A36]">
          <span className="text-[10px] text-[#71717A]">Label:</span>
          <input
            type="text"
            data-testid="flowchart-label-input"
            value={singleEl.text || ''}
            onChange={(e) => onUpdateSelectedProps({ text: e.target.value })}
            placeholder="Node label..."
            className="bg-[#15161C] border border-[#282A36] rounded px-2 py-0.5 text-xs text-white placeholder-[#71717A] w-28 focus:outline-none focus:border-[#06B6D4]"
          />
        </div>
      )}
    </div>
  );
};
