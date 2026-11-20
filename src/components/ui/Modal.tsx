'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
}

const maxWidthMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        ref={modalRef}
        className={`w-full ${maxWidthMap[maxWidth]} bg-[#121318] border border-[#232530] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150`}
      >
        {/* Header */}
        {(title || description) && (
          <div className="flex items-start justify-between p-4 border-b border-[#1f2026]">
            <div>
              {title && <h3 className="text-sm font-semibold text-white">{title}</h3>}
              {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-[#1a1b22] transition"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-4 overflow-y-auto max-h-[80vh] text-sm text-[#e6edf3]">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-3 border-t border-[#1f2026] bg-[#0d0e12] flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
