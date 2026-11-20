'use client';

import React, { forwardRef, ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-[#ff9100] to-[#e08200] hover:from-[#ffa726] hover:to-[#ff9100] text-black font-semibold shadow-sm hover:shadow active:scale-[0.98]',
  secondary:
    'bg-[#1a1b22] hover:bg-[#252834] text-[#e6edf3] border border-[#2b2d3c] active:scale-[0.98]',
  outline:
    'bg-transparent hover:bg-[#16171d] text-[#e6edf3] border border-[#2e3140] hover:border-gray-500',
  ghost:
    'bg-transparent hover:bg-[#16171d] text-gray-400 hover:text-white',
  danger:
    'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 active:scale-[0.98]',
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: 'h-7 px-2 text-[11px] rounded gap-1.5',
  sm: 'h-8 px-2.5 text-xs rounded-md gap-1.5',
  md: 'h-9 px-3.5 text-xs font-medium rounded-md gap-2',
  lg: 'h-10 px-4 text-sm font-medium rounded-lg gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = '',
      variant = 'secondary',
      size = 'md',
      isLoading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      ...props
    },
    ref
  ) => {
    const base =
      'inline-flex items-center justify-center font-medium transition-all duration-150 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff9100]/50 disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed';

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${base} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-current shrink-0" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        {children && <span>{children}</span>}
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
