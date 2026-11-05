import React, { useState } from 'react';
import { Slide } from '@/types/presentation';
import {
  FileText,
  Edit3,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Code,
  Layers,
} from 'lucide-react';

interface SlideEditorDrawerProps {
  slide: Slide;
  slideIndex: number;
  totalSlides: number;
  onUpdateSlide: (updated: Partial<Slide>) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const SlideEditorDrawer: React.FC<SlideEditorDrawerProps> = ({
  slide,
  slideIndex,
  totalSlides,
  onUpdateSlide,
  isOpen,
  onToggleOpen,
}) => {
  const [activeTab, setActiveTab] = useState<'content' | 'notes'>('content');

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateSlide({ title: e.target.value });
  };

  const handleSubtitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateSlide({ subtitle: e.target.value });
  };

  const handleBulletChange = (index: number, value: string) => {
    const next = [...slide.bullets];
    next[index] = value;
    onUpdateSlide({ bullets: next });
  };

  const handleAddBullet = () => {
    onUpdateSlide({ bullets: [...slide.bullets, 'New key takeaway or concept'] });
  };

  const handleDeleteBullet = (index: number) => {
    const next = slide.bullets.filter((_, i) => i !== index);
    onUpdateSlide({ bullets: next });
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdateSlide({ presenterNotes: e.target.value });
  };

  const handleDiagramTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateSlide({ diagramTitle: e.target.value });
  };

  const handleCodeSnippetChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdateSlide({ codeSnippet: e.target.value });
  };

  return (
    <div className="border-t border-[#282A36] bg-[#0E0F13] flex flex-col shrink-0 transition-all select-none">
      {/* Drawer Header & Tab Toggles */}
      <div className="h-10 px-4 bg-[#111216] border-b border-[#282A36] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={onToggleOpen}
            className="flex items-center space-x-1.5 text-xs font-semibold text-white hover:text-[#06B6D4] transition-colors"
            title={isOpen ? 'Collapse Editor Drawer' : 'Expand Editor Drawer'}
            aria-label={isOpen ? 'Collapse Editor Drawer' : 'Expand Editor Drawer'}
          >
            {isOpen ? <ChevronDown className="w-4 h-4 text-[#06B6D4]" /> : <ChevronUp className="w-4 h-4 text-[#06B6D4]" />}
            <span>Slide Workspace</span>
          </button>
          <span className="text-[#282A36]">|</span>
          <span className="text-[11px] text-[#A1A1AA]">
            Editing Slide {slideIndex + 1} of {totalSlides}
          </span>
        </div>

        {isOpen && (
          <div className="flex items-center space-x-1 bg-[#15161C] p-0.5 rounded border border-[#282A36]">
            <button
              onClick={() => setActiveTab('content')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
                activeTab === 'content'
                  ? 'bg-[#1D1F27] text-white border border-[#282A36]'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5 text-[#06B6D4]" />
              <span>Slide Content</span>
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
                activeTab === 'notes'
                  ? 'bg-[#1D1F27] text-white border border-[#282A36]'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-[#FF9100]" />
              <span>Presenter Notes</span>
              {slide.presenterNotes && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF9100]" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Drawer Body */}
      {isOpen && (
        <div className="p-4 max-h-56 overflow-y-auto bg-[#0B0C0E] text-xs">
          {activeTab === 'content' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left Column: Title, Subtitle, Invariant */}
              <div className="space-y-3">
                <div>
                  <label htmlFor="slide-title-input" className="block text-[11px] font-medium text-[#A1A1AA] mb-1">
                    Slide Headline Title
                  </label>
                  <input
                    id="slide-title-input"
                    type="text"
                    value={slide.title}
                    onChange={handleTitleChange}
                    placeholder="Enter slide title"
                    className="w-full bg-[#15161C] border border-[#282A36] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#06B6D4]"
                  />
                </div>

                <div>
                  <label htmlFor="slide-subtitle-input" className="block text-[11px] font-medium text-[#A1A1AA] mb-1">
                    Subtitle / Concept Overview
                  </label>
                  <input
                    id="slide-subtitle-input"
                    type="text"
                    value={slide.subtitle}
                    onChange={handleSubtitleChange}
                    placeholder="Enter subtitle or lecture topic"
                    className="w-full bg-[#15161C] border border-[#282A36] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#06B6D4]"
                  />
                </div>

                <div>
                  <label htmlFor="slide-diagram-input" className="block text-[11px] font-medium text-[#A1A1AA] mb-1 flex items-center space-x-1">
                    <Layers className="w-3 h-3 text-[#06B6D4]" />
                    <span>Diagram Formula / Structural Invariant (Optional)</span>
                  </label>
                  <input
                    id="slide-diagram-input"
                    type="text"
                    value={slide.diagramTitle || ''}
                    onChange={handleDiagramTitleChange}
                    placeholder="e.g. Balance Factor Invariant: BF(node) in {-1, 0, 1}"
                    className="w-full bg-[#15161C] border border-[#282A36] rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[#06B6D4]"
                  />
                </div>
              </div>

              {/* Right Column: Bullets & Code Snippet */}
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-medium text-[#A1A1AA]">
                      Bullet Points ({slide.bullets.length})
                    </label>
                    <button
                      onClick={handleAddBullet}
                      className="flex items-center space-x-1 text-[11px] text-[#06B6D4] hover:text-white transition-colors"
                      title="Add bullet point"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Point</span>
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {slide.bullets.map((bullet, idx) => (
                      <div key={idx} className="flex items-center space-x-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#06B6D4] shrink-0" />
                        <input
                          type="text"
                          value={bullet}
                          onChange={(e) => handleBulletChange(idx, e.target.value)}
                          placeholder={`Bullet ${idx + 1}`}
                          className="flex-1 bg-[#15161C] border border-[#282A36] rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#06B6D4]"
                        />
                        <button
                          onClick={() => handleDeleteBullet(idx)}
                          className="p-1 rounded text-[#71717A] hover:text-[#EF4444] transition-colors"
                          title="Remove bullet point"
                          aria-label={`Remove bullet ${idx + 1}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="slide-code-input" className="block text-[11px] font-medium text-[#A1A1AA] mb-1 flex items-center space-x-1">
                    <Code className="w-3 h-3 text-[#10B981]" />
                    <span>Algorithmic Code Snippet (Optional)</span>
                  </label>
                  <textarea
                    id="slide-code-input"
                    rows={2}
                    value={slide.codeSnippet || ''}
                    onChange={handleCodeSnippetChange}
                    placeholder="Enter short code or pseudo-code block..."
                    className="w-full bg-[#15161C] border border-[#282A36] rounded-lg p-2 text-xs font-mono text-[#10B981] focus:outline-none focus:border-[#10B981] resize-none"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Presenter Notes Tab */
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[#A1A1AA] flex items-center space-x-1">
                  <FileText className="w-3.5 h-3.5 text-[#FF9100]" />
                  <span>Private Speaker Notes</span>
                </span>
                <span className="text-[10px] text-[#71717A]">
                  Hidden from student presentation canvas during lecture broadcasts
                </span>
              </div>
              <textarea
                rows={4}
                value={slide.presenterNotes || ''}
                onChange={handleNotesChange}
                placeholder="Enter speaker notes, lecture pacing reminders, discussion questions, or solution hints..."
                className="w-full bg-[#15161C] border border-[#282A36] rounded-lg p-3 text-xs text-white focus:outline-none focus:border-[#FF9100] resize-y leading-relaxed font-sans"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
