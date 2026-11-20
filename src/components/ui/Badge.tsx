import React from 'react';

export type BadgeVariant = 'amber' | 'emerald' | 'sky' | 'rose' | 'zinc' | 'purple';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  amber: 'bg-[#ff9100]/15 text-[#ff9100] border-[#ff9100]/30',
  emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  sky: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  rose: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  zinc: 'bg-[#1e1f26] text-gray-300 border-[#2a2c3a]',
  purple: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
};

const dotColors: Record<BadgeVariant, string> = {
  amber: 'bg-[#ff9100]',
  emerald: 'bg-emerald-400',
  sky: 'bg-sky-400',
  rose: 'bg-rose-400',
  zinc: 'bg-gray-400',
  purple: 'bg-purple-400',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'text-[10px] px-1.5 py-0.5 gap-1',
  md: 'text-xs px-2 py-0.5 gap-1.5',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'zinc',
  size = 'sm',
  dot = false,
  className = '',
  ...props
}) => {
  return (
    <span
      className={`inline-flex items-center font-mono font-medium rounded border tracking-wider uppercase select-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[variant]}`} />}
      {children}
    </span>
  );
};
