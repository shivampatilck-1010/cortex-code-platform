import React, { useState, useRef, useEffect } from 'react';
import { PresentationDeck } from '@/types/presentation';
import {
  importPresentationFromJson,
  importPresentationFromPptx,
  exportPresentationToJson,
} from './presentationPersistence';
import {
  X,
  Upload,
  Download,
  FileText,
  AlertCircle,
  Check,
  RotateCcw,
  Info,
  Loader2,
} from 'lucide-react';

interface PresentationImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  deck: PresentationDeck;
  onImportSuccess: (newDeck: PresentationDeck) => void;
  onResetToDefault: () => void;
  showToast: (msg: string) => void;
}

export const PresentationImportModal: React.FC<PresentationImportModalProps> = ({
  isOpen,
  onClose,
  deck,
  onImportSuccess,
  onResetToDefault,
  showToast,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const isJson = file.name.endsWith('.json') || file.type === 'application/json';
    const isPptx = file.name.endsWith('.pptx') || file.name.endsWith('.pptm');

    try {
      if (isJson) {
        let text = '';
        if (typeof file.text === 'function') {
          text = await file.text();
        } else {
          text = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string) || '');
            reader.onerror = () => reject(reader.error || new Error('Failed to read file as text'));
            reader.readAsText(file);
          });
        }
        const result = importPresentationFromJson(text);
        if (result.success && result.deck) {
          onImportSuccess(result.deck);
          setSuccessMessage(`Successfully imported "${result.deck.title}" (${result.deck.slides.length} slides)`);
          showToast(`Imported ${result.deck.slides.length} slides`);
        } else {
          setErrorMessage(result.error || 'Failed to parse JSON presentation');
        }
      } else if (isPptx) {
        let arrayBuffer: ArrayBuffer;
        if (typeof file.arrayBuffer === 'function') {
          arrayBuffer = await file.arrayBuffer();
        } else {
          arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as ArrayBuffer));
            reader.onerror = () => reject(reader.error || new Error('Failed to read file as array buffer'));
            reader.readAsArrayBuffer(file);
          });
        }
        const bufferFile = new File([arrayBuffer], file.name, { type: file.type });
        const result = await importPresentationFromPptx(bufferFile);
        if (result.success && result.deck) {
          onImportSuccess(result.deck);
          setSuccessMessage(`Successfully extracted "${result.deck.title}" (${result.deck.slides.length} slides)`);
          showToast(`Extracted ${result.deck.slides.length} slides from PowerPoint file`);
        } else {
          setErrorMessage(result.error || 'Failed to process PowerPoint archive');
        }
      } else {
        setErrorMessage('Unsupported file format. Please upload a .json presentation or .pptx presentation file.');
      }
    } catch (err: any) {
      setErrorMessage(`Import error: ${err.message || 'Unknown failure'}`);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleExport = () => {
    exportPresentationToJson(deck);
    showToast('Exported presentation to JSON file');
  };

  const handleReset = () => {
    onResetToDefault();
    showToast('Reset presentation to default CS 201 lecture deck');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="w-full max-w-lg rounded-xl border border-[#282A36] bg-[#111216] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-export-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#282A36] bg-[#0B0C0E]">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-[#06B6D4]/10 border border-[#06B6D4]/20 text-[#06B6D4]">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 id="import-export-title" className="text-sm font-semibold text-white">
                Presentation Import & Export
              </h2>
              <p className="text-[11px] text-[#A1A1AA]">
                Import existing lecture files or export your customized presentation deck
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#71717A] hover:text-white hover:bg-[#15161C] transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 text-xs text-[#F5F5F5]">
          {/* Status Messages */}
          {errorMessage && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-[#3F1F24] border border-[#EF4444]/40 text-[#FCA5A5] flex items-start space-x-2 text-xs"
            >
              <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div
              role="status"
              className="p-3 rounded-lg bg-[#152B1E] border border-[#10B981]/40 text-[#A7F3D0] flex items-start space-x-2 text-xs"
            >
              <Check className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Import Dropzone Card */}
          <div className="border border-dashed border-[#282A36] hover:border-[#06B6D4] bg-[#0B0C0E] rounded-xl p-6 text-center flex flex-col items-center justify-center transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.pptx,application/json,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              onChange={handleFileChange}
              disabled={isProcessing}
              className="hidden"
              id="presentation-file-input"
            />
            <div className="w-12 h-12 rounded-full bg-[#15161C] border border-[#282A36] flex items-center justify-center mb-3 text-[#06B6D4]">
              {isProcessing ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Upload className="w-6 h-6" />
              )}
            </div>
            <label
              htmlFor="presentation-file-input"
              className="cursor-pointer text-xs font-semibold text-white hover:text-[#06B6D4] transition-colors"
            >
              {isProcessing ? 'Processing Presentation...' : 'Click to select presentation file'}
            </label>
            <p className="text-[11px] text-[#71717A] mt-1 max-w-xs">
              Supports native Cortex Presentation JSON (.json) and Microsoft PowerPoint (.pptx)
            </p>
          </div>

          {/* Supported Format Details */}
          <div className="p-3 rounded-lg bg-[#15161C] border border-[#282A36] flex items-start space-x-2.5">
            <Info className="w-4 h-4 text-[#06B6D4] shrink-0 mt-0.5" />
            <div className="text-[11px] text-[#A1A1AA] leading-relaxed">
              <strong className="text-white block mb-0.5">Format Compatibility Notice:</strong>
              JSON imports restore complete presentations including notes and annotations. PowerPoint (.pptx) imports extract text titles, subtitles, and bullet points. Complex proprietary animations, transitions, and media embeds are omitted.
            </div>
          </div>

          {/* Export Action Card */}
          <div className="p-3.5 rounded-lg bg-[#15161C] border border-[#282A36] flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-white flex items-center space-x-1.5">
                <FileText className="w-3.5 h-3.5 text-[#10B981]" />
                <span>Export Current Deck</span>
              </h4>
              <p className="text-[11px] text-[#71717A] mt-0.5">
                Download your slides, speaker notes, and annotations as a portable JSON file.
              </p>
            </div>
            <button
              onClick={handleExport}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-[#10B981]/15 hover:bg-[#10B981]/25 text-[#10B981] border border-[#10B981]/30 text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#282A36] bg-[#0B0C0E] flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center space-x-1 text-[11px] text-[#71717A] hover:text-[#EF4444] transition-colors"
            title="Reset to default lecture slides"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset to Default</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#282A36] hover:bg-[#383A46] text-white text-xs font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
