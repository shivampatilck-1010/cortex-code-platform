'use client';

import React, { useState } from 'react';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content: React.ReactNode;
  subtitle?: React.ReactNode;
  position?: TooltipPosition;
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

const positionStyles: Record<TooltipPosition, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  subtitle,
  position = 'right',
  children,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          role="tooltip"
          className={`pointer-events-none absolute ${positionStyles[position]} px-3 py-1.5 bg-[#14151b] text-[#e6edf3] text-xs rounded-md shadow-2xl z-[150] border border-[#2b2d3a] flex flex-col items-start gap-0.5 whitespace-nowrap animate-in fade-in zoom-in-95 duration-100`}
        >
          <span className="font-semibold text-white tracking-wide">{content}</span>
          {subtitle && <span className="text-[10px] text-gray-400 font-normal">{subtitle}</span>}
        </div>
      )}
    </div>
  );
};
