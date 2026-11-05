import React from 'react';
import { Slide } from '@/types/presentation';
import { Plus, Copy, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

interface SlideThumbnailListProps {
  slides: Slide[];
  activeSlideId: string;
  onSelectSlide: (slideId: string) => void;
  onAddSlide: () => void;
  onDuplicateSlide: (slideId: string) => void;
  onDeleteSlide: (slideId: string) => void;
  onMoveSlide: (slideId: string, direction: 'up' | 'down') => void;
  disabled?: boolean;
}

export const SlideThumbnailList: React.FC<SlideThumbnailListProps> = ({
  slides,
  activeSlideId,
  onSelectSlide,
  onAddSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onMoveSlide,
  disabled = false,
}) => {
  return (
    <div className="w-56 md:w-64 border-r border-[#282A36] bg-[#0E0F13] flex flex-col h-full shrink-0 select-none">
      {/* Header with Add Slide Button */}
      <div className="p-3 border-b border-[#282A36] flex items-center justify-between bg-[#111216]">
        <div className="flex items-center space-x-1.5">
          <span className="text-xs font-semibold text-white">Slides</span>
          <span className="text-[10px] font-mono text-[#A1A1AA] bg-[#15161C] px-1.5 py-0.5 rounded border border-[#282A36]">
            {slides.length}
          </span>
        </div>
        <button
          onClick={onAddSlide}
          disabled={disabled}
          className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#06B6D4]/15 hover:bg-[#06B6D4]/25 text-[#06B6D4] border border-[#06B6D4]/30 text-xs font-medium transition-colors disabled:opacity-40"
          title="Add New Slide"
          aria-label="Add New Slide"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Slide</span>
        </button>
      </div>

      {/* Scrollable Thumbnails List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {slides.map((slide, index) => {
          const isActive = slide.id === activeSlideId;
          const isFirst = index === 0;
          const isLast = index === slides.length - 1;
          const isOnlyOne = slides.length <= 1;

          return (
            <div
              key={slide.id}
              onClick={() => onSelectSlide(slide.id)}
              className={`group rounded-lg border p-2 cursor-pointer transition-all ${
                isActive
                  ? 'border-[#06B6D4] bg-[#151D24] shadow-md ring-1 ring-[#06B6D4]/40'
                  : 'border-[#282A36] bg-[#111216] hover:bg-[#15161C] hover:border-[#383A46]'
              }`}
            >
              {/* Thumbnail Header: Number and Mini Actions */}
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                    isActive ? 'bg-[#06B6D4] text-black' : 'bg-[#1D1F27] text-[#A1A1AA]'
                  }`}
                >
                  {index + 1}
                </span>

                {/* Action Buttons (visible on hover or when active) */}
                <div
                  className={`flex items-center space-x-0.5 transition-opacity ${
                    isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Move Up */}
                  <button
                    onClick={() => onMoveSlide(slide.id, 'up')}
                    disabled={isFirst || disabled}
                    className="p-1 rounded text-[#71717A] hover:text-white hover:bg-[#1D1F27] disabled:opacity-20 transition-colors"
                    title="Move Slide Up"
                    aria-label={`Move Slide ${index + 1} Up`}
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>

                  {/* Move Down */}
                  <button
                    onClick={() => onMoveSlide(slide.id, 'down')}
                    disabled={isLast || disabled}
                    className="p-1 rounded text-[#71717A] hover:text-white hover:bg-[#1D1F27] disabled:opacity-20 transition-colors"
                    title="Move Slide Down"
                    aria-label={`Move Slide ${index + 1} Down`}
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>

                  {/* Duplicate */}
                  <button
                    onClick={() => onDuplicateSlide(slide.id)}
                    disabled={disabled}
                    className="p-1 rounded text-[#71717A] hover:text-[#06B6D4] hover:bg-[#1D1F27] transition-colors"
                    title="Duplicate Slide"
                    aria-label={`Duplicate Slide ${index + 1}`}
                  >
                    <Copy className="w-3 h-3" />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => onDeleteSlide(slide.id)}
                    disabled={isOnlyOne || disabled}
                    className="p-1 rounded text-[#71717A] hover:text-[#EF4444] hover:bg-[#1D1F27] disabled:opacity-20 transition-colors"
                    title={isOnlyOne ? 'Cannot delete the only slide' : 'Delete Slide'}
                    aria-label={`Delete Slide ${index + 1}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Thumbnail Miniature Card */}
              <div className="aspect-video w-full rounded bg-[#07080A] border border-[#282A36] p-2 flex flex-col justify-between overflow-hidden relative">
                <div>
                  <p className="text-[10px] font-bold text-white truncate leading-tight">
                    Slide {index + 1}: {slide.title || 'Untitled Slide'}
                  </p>
                  <p className="text-[9px] text-[#71717A] truncate mt-0.5">
                    {slide.subtitle || 'No subtitle'}
                  </p>
                </div>

                <div className="space-y-0.5 my-auto">
                  {slide.bullets.slice(0, 2).map((b, i) => (
                    <div key={i} className="flex items-center space-x-1">
                      <span className="w-1 h-1 rounded-full bg-[#06B6D4] shrink-0" />
                      <span className="text-[8px] text-[#A1A1AA] truncate">{b}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-[7px] text-[#52525B] pt-0.5 border-t border-[#1F212B]">
                  <span>{slide.bullets.length} points</span>
                  {slide.presenterNotes && <span className="text-[#06B6D4]">Notes</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
