'use client';

import React from 'react';
import Image from 'next/image';

interface CortexLogoProps {
  variant?: 'full' | 'header' | 'compact' | 'icon' | 'badge';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showPillars?: boolean;
  className?: string;
  useImage?: boolean;
}

export const CortexLogo: React.FC<CortexLogoProps> = ({
  variant = 'compact',
  size = 'md',
  showPillars = false,
  className = '',
  useImage = true,
}) => {
  // Dimensions
  const iconSizes = {
    sm: { w: 24, h: 24, text: 'text-sm', sub: 'text-[9px]', motto: 'text-[8px]' },
    md: { w: 32, h: 32, text: 'text-base', sub: 'text-[10px]', motto: 'text-[8.5px]' },
    lg: { w: 44, h: 44, text: 'text-xl', sub: 'text-xs', motto: 'text-[10px]' },
    xl: { w: 72, h: 72, text: 'text-3xl', sub: 'text-sm', motto: 'text-xs' },
  }[size];

  // SVG Vector C1 Emblem fallback
  const VectorEmblem = (
    <div 
      className="relative flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
      style={{ width: iconSizes.w, height: iconSizes.h }}
    >
      <svg
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md"
      >
        <defs>
          <linearGradient id="cortex-orange-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffb300" />
            <stop offset="50%" stopColor="#ff9100" />
            <stop offset="100%" stopColor="#e06900" />
          </linearGradient>
          <linearGradient id="cortex-dark-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#434652" />
            <stop offset="50%" stopColor="#252730" />
            <stop offset="100%" stopColor="#131418" />
          </linearGradient>
        </defs>

        {/* 'C' Outer Charcoal Curved Ribbon */}
        <path
          d="M 125 40 C 65 40 30 75 30 115 C 30 155 70 185 125 185 C 150 185 170 175 180 162 C 168 168 150 170 125 170 C 80 170 48 145 48 115 C 48 85 80 55 125 55 C 145 55 162 62 172 70 C 165 52 148 40 125 40 Z"
          fill="url(#cortex-dark-grad)"
        />

        {/* 'C' Inner Glowing Orange Arc Trim */}
        <path
          d="M 125 40 C 75 40 38 72 32 110 C 37 80 72 52 120 52 C 128 52 136 53 144 56 C 138 46 132 40 125 40 Z"
          fill="url(#cortex-orange-grad)"
          opacity="0.9"
        />

        {/* Center Code Brackets: < / > */}
        <g transform="translate(72, 85) scale(0.9)">
          <path
            d="M 14 6 L 2 18 L 14 30"
            stroke="#ff9100"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M 28 4 L 20 32"
            stroke="#ff9100"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="M 34 6 L 46 18 L 34 30"
            stroke="#ff9100"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* '1' Stylized Orange Upward Ribbon Arrow */}
        <path
          d="M 140 40 L 185 40 L 185 175 L 155 175 L 155 75 L 130 95 L 120 80 Z"
          fill="url(#cortex-orange-grad)"
        />
      </svg>
    </div>
  );

  // High-Resolution 3D Transparent Emblem directly from user asset
  const ImageEmblem = (
    <div 
      className="relative flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
      style={{ width: iconSizes.w, height: iconSizes.h }}
    >
      <img
        src="/brand/cortex-emblem.png"
        alt="Cortex Emblem"
        className="w-full h-full object-contain filter drop-shadow-[0_2px_8px_rgba(255,145,0,0.15)]"
      />
    </div>
  );

  const Emblem = useImage ? ImageEmblem : VectorEmblem;

  if (variant === 'icon') {
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        {Emblem}
      </div>
    );
  }

  return (
    <div className={`inline-flex flex-col items-start ${className}`}>
      <div className="flex items-center space-x-2.5">
        {Emblem}
        
        <div className="flex flex-col leading-none">
          {/* Brand Name: Corte + Orange x */}
          <span className={`font-heading font-black tracking-tight ${iconSizes.text} text-white flex items-center`}>
            <span>Corte</span>
            <span className="text-[#ff9100]">x</span>
          </span>

          {/* Primary Tagline: CODE BEYOND LIMITS */}
          {(variant === 'header' || variant === 'full') && (
            <span className={`font-heading text-gray-400 font-bold tracking-[0.25em] ${iconSizes.sub} uppercase mt-1 select-none`}>
              CODE BEYOND LIMITS
            </span>
          )}
        </div>
      </div>

      {/* Sub-Pillars: COMPILE | CREATE | COLLABORATE | DEPLOY */}
      {(variant === 'full' || showPillars) && (
        <div className={`font-heading flex items-center space-x-2 mt-2 pt-1.5 border-t border-[#252834] ${iconSizes.motto} font-semibold uppercase tracking-wider text-gray-400 select-none`}>
          <span>COMPILE</span>
          <span className="text-[#ff9100] font-bold">|</span>
          <span>CREATE</span>
          <span className="text-[#ff9100] font-bold">|</span>
          <span>COLLABORATE</span>
          <span className="text-[#ff9100] font-bold">|</span>
          <span>DEPLOY</span>
        </div>
      )}
    </div>
  );
};
