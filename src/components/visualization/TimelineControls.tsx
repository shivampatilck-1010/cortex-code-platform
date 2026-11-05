'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  FastForward, 
  ChevronLeft, 
  ChevronRight,
  Gauge,
  CheckCircle2
} from 'lucide-react';
import { TraceEvent } from '@/lib/visualization/types';
import { getStepSummary } from '@/lib/visualization/state-engine';

interface TimelineControlsProps {
  currentStep: number;
  totalSteps: number;
  currentEvent: TraceEvent;
  onStepChange: (step: number) => void;
  disabled?: boolean;
}

export const TimelineControls: React.FC<TimelineControlsProps> = ({
  currentStep,
  totalSteps,
  currentEvent,
  onStepChange,
  disabled = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 0.5x, 1x, 2x, 4x
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const stepForward = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      onStepChange(currentStep + 1);
    } else {
      setIsPlaying(false);
    }
  }, [currentStep, totalSteps, onStepChange]);

  const stepBackward = useCallback(() => {
    if (currentStep > 0) {
      onStepChange(currentStep - 1);
    }
  }, [currentStep, onStepChange]);

  // Autoplay Loop
  useEffect(() => {
    if (isPlaying && totalSteps > 0) {
      const intervalMs = Math.max(100, Math.round(1000 / playbackSpeed));
      timerRef.current = setInterval(() => {
        stepForward();
      }, intervalMs);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, playbackSpeed, stepForward, totalSteps]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input, textarea, contenteditable, or inside Monaco Editor
      const target = e.target as HTMLElement | null;
      const activeEl = document.activeElement as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable ||
        Boolean(target?.closest('.monaco-editor')) ||
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.isContentEditable ||
        Boolean(activeEl?.closest('.monaco-editor'))
      ) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepBackward();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepForward();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key === 'Home') {
        e.preventDefault();
        onStepChange(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        onStepChange(totalSteps - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stepBackward, stepForward, onStepChange, totalSteps]);

  if (totalSteps === 0) return null;

  const summary = getStepSummary(currentEvent);
  const progressPercent = Math.round(((currentStep + 1) / totalSteps) * 100);
  const isFinished = currentStep === totalSteps - 1;

  return (
    <div className="bg-[#121318] border-t border-[#1F2024] p-3 text-xs select-none">
      {/* Top: Current Event Summary Banner & Step Counter */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2 truncate">
          <span className="px-2 py-0.5 rounded bg-[#06B6D4]/10 text-[#06B6D4] font-mono text-[10px] font-bold border border-[#06B6D4]/30 flex-shrink-0">
            Line {currentEvent.line}
          </span>
          <span className="font-mono text-white text-xs truncate" title={summary}>
            {summary}
          </span>
        </div>
        <div className="flex items-center space-x-2 text-[#71717A] font-mono text-[11px] flex-shrink-0">
          <span>
            Step <strong className="text-white">{currentStep + 1}</strong> of <strong className="text-[#A1A1AA]">{totalSteps}</strong>
          </span>
          <span className="px-1.5 py-0.5 rounded bg-[#1C1E26] text-[#A1A1AA] font-bold text-[10px]">
            {progressPercent}%
          </span>
          {isFinished && (
            <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 text-[10px] font-bold">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Finished</span>
            </span>
          )}
        </div>
      </div>

      {/* Middle: Timeline Scrubber Bar with Progress Fill */}
      <div className="relative mb-2.5 flex items-center">
        <div 
          className="absolute left-0 h-1.5 bg-[#FF9100] rounded-l-lg pointer-events-none"
          style={{ width: `${(currentStep / Math.max(1, totalSteps - 1)) * 100}%` }}
        />
        <input
          type="range"
          min={0}
          max={totalSteps - 1}
          value={currentStep}
          disabled={disabled}
          onChange={(e) => {
            setIsPlaying(false);
            onStepChange(parseInt(e.target.value, 10));
          }}
          className="w-full h-1.5 bg-[#1F212B] rounded-lg appearance-none cursor-pointer accent-[#FF9100] focus:outline-none relative z-10 opacity-70 hover:opacity-100 transition-opacity"
        />
      </div>

      {/* Bottom: Playback & Step Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5">
          {/* Restart */}
          <button
            onClick={() => {
              setIsPlaying(false);
              onStepChange(0);
            }}
            disabled={disabled || currentStep === 0}
            className="p-1.5 rounded bg-[#181920] hover:bg-[#22242D] text-[#A1A1AA] hover:text-white border border-[#2B2D38] disabled:opacity-40 transition"
            title="Start of Execution (Home)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Step Backward */}
          <button
            onClick={() => {
              setIsPlaying(false);
              stepBackward();
            }}
            disabled={disabled || currentStep === 0}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#181920] hover:bg-[#22242D] text-[#E4E4E7] border border-[#2B2D38] font-mono text-xs font-semibold disabled:opacity-40 transition"
            title="Step Backward (Left Arrow)"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back</span>
          </button>

          {/* Play / Pause */}
          <button
            onClick={() => setIsPlaying((p) => !p)}
            disabled={disabled}
            className="flex items-center space-x-1.5 px-3.5 py-1 rounded bg-[#FF9100] hover:bg-[#E08000] text-black font-semibold font-mono text-xs shadow-sm transition"
            title="Play / Pause (Space)"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play</span>
              </>
            )}
          </button>

          {/* Step Forward */}
          <button
            onClick={() => {
              setIsPlaying(false);
              stepForward();
            }}
            disabled={disabled || currentStep === totalSteps - 1}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#181920] hover:bg-[#22242D] text-[#E4E4E7] border border-[#2B2D38] font-mono text-xs font-semibold disabled:opacity-40 transition"
            title="Step Forward (Right Arrow)"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Jump to End */}
          <button
            onClick={() => {
              setIsPlaying(false);
              onStepChange(totalSteps - 1);
            }}
            disabled={disabled || currentStep === totalSteps - 1}
            className="p-1.5 rounded bg-[#181920] hover:bg-[#22242D] text-[#A1A1AA] hover:text-white border border-[#2B2D38] disabled:opacity-40 transition"
            title="End of Execution (End)"
          >
            <FastForward className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Speed Selector */}
        <div className="flex items-center space-x-1 text-[11px] font-mono">
          <Gauge className="w-3.5 h-3.5 text-[#71717A] mr-1 hidden sm:inline" />
          {[0.5, 1, 2, 4].map((speed) => (
            <button
              key={speed}
              onClick={() => setPlaybackSpeed(speed)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition ${
                playbackSpeed === speed
                  ? 'bg-[#06B6D4]/20 border-[#06B6D4] text-[#06B6D4]'
                  : 'bg-[#181920] border-[#2B2D38] text-[#71717A] hover:text-white'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
