'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  MessageSquareCode, 
  Wand2, 
  Check, 
  CheckCircle2,
  X, 
  AlertTriangle, 
  ArrowRight,
  Code2,
  Key,
  ExternalLink,
  RefreshCw,
  Cpu,
  Loader2,
  ShieldCheck
} from 'lucide-react';
import { AIFixResult } from '@/lib/ai/assistant';
import { CortexLogo } from '@/components/brand/CortexLogo';

interface InlineQuickFixWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  fixResult?: AIFixResult | null;
  onApplyExplanationComment: (comment: string, line: number, commentedCode?: string) => void;
  onApplyLiveFix: (fix: AIFixResult) => void;
  isDarkMode?: boolean;
  aiProvider?: 'gemini' | 'offline';
  apiKey?: string;
  onSaveApiKey?: (key: string) => void;
  isAnalyzing?: boolean;
  onReanalyzeWithKey?: (key: string) => void;
}

export const InlineQuickFixWidget: React.FC<InlineQuickFixWidgetProps> = ({
  isOpen,
  onClose,
  fixResult,
  onApplyExplanationComment,
  onApplyLiveFix,
  isDarkMode = true,
  aiProvider = 'offline',
  apiKey = '',
  onSaveApiKey,
  isAnalyzing = false,
  onReanalyzeWithKey,
}) => {
  const [viewMode, setViewMode] = useState<'choice' | 'live_preview'>('choice');
  const [isApplying, setIsApplying] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [enteredKey, setEnteredKey] = useState(apiKey);
  const [isValidating, setIsValidating] = useState(false);
  const [validationState, setValidationState] = useState<'idle' | 'valid' | 'invalid'>(apiKey ? 'valid' : 'idle');
  const [validationMsg, setValidationMsg] = useState(apiKey ? 'Your auto fix is connected and good to go!' : '');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isConnected = !!apiKey || validationState === 'valid';

  // Sync apiKey
  useEffect(() => {
    setEnteredKey(apiKey);
    if (apiKey) {
      setValidationState('valid');
      setValidationMsg('Your auto fix is connected and good to go!');
    }
  }, [apiKey]);

  // Clean up timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // Reset view mode on new fix result or open
  useEffect(() => {
    if (isOpen) {
      setViewMode('choice');
      setIsApplying(false);
    }
  }, [isOpen, fixResult]);

  // Keyboard navigation: 1 for Explain, 2 for Fix, Enter for Accept, Esc for Close
  useEffect(() => {
    if (!isOpen || !fixResult || showKeyInput) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (viewMode === 'choice') {
        if (e.key === '1') {
          e.preventDefault();
          handleExplain();
        } else if (e.key === '2') {
          e.preventDefault();
          setViewMode('live_preview');
        }
      } else if (viewMode === 'live_preview') {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleAcceptFix();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, viewMode, fixResult, showKeyInput]);

  if (!isOpen) return null;

  const targetLine = fixResult?.targetLine || 1;

  const handleExplain = () => {
    if (!fixResult) return;
    onApplyExplanationComment(fixResult.inlineComment, targetLine, fixResult.commentedCode);
    onClose();
  };

  const handleAcceptFix = async () => {
    if (!fixResult) return;
    setIsApplying(true);
    await onApplyLiveFix(fixResult);
    setIsApplying(false);
    onClose();
  };

  // Automated connection and validation function
  const validateAndConnectKey = async (keyToTest: string) => {
    const trimmed = keyToTest.trim();
    if (!trimmed) {
      setValidationState('idle');
      setValidationMsg('');
      return;
    }

    setIsValidating(true);
    setValidationState('idle');
    setValidationMsg('');

    try {
      const res = await fetch('/api/v1/ai/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: trimmed }),
      });
      const data = await res.json();

      if (res.ok && data.valid) {
        setValidationState('valid');
        setValidationMsg(data.message || 'Your auto fix is connected and good to go!');
        if (onSaveApiKey) onSaveApiKey(trimmed);
        if (onReanalyzeWithKey) onReanalyzeWithKey(trimmed);
        setShowKeyInput(false);
      } else {
        setValidationState('invalid');
        setValidationMsg(data.error || 'Invalid API key. Please check your key from Google AI Studio and try again.');
      }
    } catch (e: any) {
      setValidationState('invalid');
      setValidationMsg('Network error validating API key. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  // Automated trigger when user types in the key
  const handleKeyChange = (val: string) => {
    setEnteredKey(val);
    setValidationState('idle');
    setValidationMsg('');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // If the entered string looks like a completed API key (length >= 25 or starts with AIza/AQ), automatically validate
    if (val.trim().length >= 25) {
      debounceTimerRef.current = setTimeout(() => {
        validateAndConnectKey(val);
      }, 700);
    }
  };

  // Automated trigger on paste event
  const handleKeyPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').trim();
    if (pasted.length >= 15) {
      setEnteredKey(pasted);
      setTimeout(() => {
        validateAndConnectKey(pasted);
      }, 100);
    }
  };

  const handleDisconnectKey = () => {
    if (onSaveApiKey) onSaveApiKey('');
    setEnteredKey('');
    setValidationState('idle');
    setValidationMsg('');
  };

  return (
    <div className="absolute top-8 left-1/2 -translate-x-1/2 z-40 w-full max-w-xl px-4 animate-in fade-in slide-in-from-top-2 duration-150 select-none">
      <div className="bg-[#121316] border border-[#ff9100]/40 rounded-lg shadow-2xl overflow-hidden font-sans text-xs text-[#e6edf3]">
        {/* Top Header Bar */}
        <div className="bg-[#18191e] px-3.5 py-2 border-b border-[#252830] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <CortexLogo variant="icon" size="sm" />
            <span className="font-heading font-black text-white text-sm tracking-tight flex items-center space-x-1.5">
              <span>Quick Fix</span>
              <span className="text-gray-600 font-normal">|</span>
              <span className="text-[#ff9100] font-mono text-xs">Line {targetLine}</span>
            </span>

            {/* Provider Pill */}
            {isConnected ? (
              <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-600/40 text-emerald-300 text-xs font-heading font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Gemini Active</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-[#1e2026] border border-[#2b2d36] text-gray-400 text-xs font-heading font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                <span>Offline</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-1.5">
            {/* Toggle Gemini Key */}
            <button
              onClick={() => setShowKeyInput(!showKeyInput)}
              className="text-xs font-heading font-semibold px-2.5 py-1 rounded border border-[#282a34] bg-[#14151a] hover:bg-[#1f2128] text-gray-300 hover:text-white flex items-center space-x-1.5 transition"
              title="Configure Gemini API Key"
            >
              <Key className="w-3.5 h-3.5 text-[#ff9100]" />
              <span>{isConnected ? 'API Key' : 'Connect Gemini'}</span>
            </button>

            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#20222a] transition"
              title="Close (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Gemini API Key Drawer (Collapsed by default, opens cleanly on click) */}
        {showKeyInput && (
          <div className="bg-[#14151a] border-b border-[#252830] p-3 space-y-2 animate-in slide-in-from-top-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-heading font-bold text-white flex items-center space-x-1.5">
                <Key className="w-3.5 h-3.5 text-[#ff9100]" />
                <span>Google Gemini API Key</span>
              </span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[#ff9100] hover:underline text-xs font-heading font-semibold flex items-center space-x-1"
              >
                <span>Get free key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <input
                  type="password"
                  placeholder="Paste Gemini API key (AIzaSy...)"
                  value={enteredKey}
                  onChange={(e) => handleKeyChange(e.target.value)}
                  onPaste={handleKeyPaste}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') validateAndConnectKey(enteredKey);
                  }}
                  className="w-full bg-[#0b0c0e] border border-[#282a34] focus:border-[#ff9100] px-3 py-1.5 rounded text-white text-xs font-mono focus:outline-none placeholder:text-gray-500 pr-8"
                />
                {isValidating && (
                  <Loader2 className="w-3.5 h-3.5 text-[#ff9100] animate-spin absolute right-2.5 top-2" />
                )}
              </div>

              <button
                onClick={() => validateAndConnectKey(enteredKey)}
                disabled={!enteredKey.trim() || isValidating}
                className="px-3.5 py-1.5 bg-[#ff9100] hover:bg-[#e08000] text-[#0b0c0e] font-heading font-bold text-xs rounded transition flex items-center space-x-1 disabled:opacity-40"
              >
                <span>{isValidating ? 'Checking...' : 'Save'}</span>
              </button>

              {isConnected && (
                <button
                  onClick={handleDisconnectKey}
                  className="px-3 py-1.5 bg-[#20222a] hover:bg-[#282a34] text-gray-300 hover:text-white text-xs font-heading font-semibold rounded transition"
                >
                  Remove
                </button>
              )}
            </div>

            {validationState === 'valid' && (
              <div className="text-emerald-400 text-[11px] flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Connected to Gemini. Deep reasoning active.</span>
              </div>
            )}
            {validationState === 'invalid' && (
              <div className="text-rose-400 text-[11px] flex items-center space-x-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{validationMsg || 'Invalid API key. Please check and retry.'}</span>
              </div>
            )}
          </div>
        )}

        {/* Loading State during analysis */}
        {isAnalyzing ? (
          <div className="p-8 flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-5 h-5 text-[#ff9100] animate-spin" />
            <span className="text-gray-300 text-xs">Analyzing code and preparing fix...</span>
          </div>
        ) : (
          <>
            {/* Diagnosis / Error Summary */}
            <div className="px-3.5 py-2.5 bg-[#15161b] border-b border-[#22242c] flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-amber-300 font-heading font-bold text-xs leading-tight flex items-center justify-between">
                  <span>{fixResult?.cause || `Error on line ${targetLine}`}</span>
                  {(fixResult?.errors?.length || 0) > 1 && (
                    <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-600/40 text-amber-300 text-xs font-heading font-bold">
                      {fixResult?.errors?.length} Errors
                    </span>
                  )}
                </div>
                <div className="text-gray-300 text-xs mt-1 leading-relaxed">
                  {fixResult?.explanation || 'Select an option below to resolve this error.'}
                </div>

                {/* Multi-Error Breakdown List */}
                {(fixResult?.errors?.length || 0) > 1 && fixResult?.errors && (
                  <div className="mt-2 space-y-1.5 max-h-28 overflow-y-auto pr-1">
                    {fixResult.errors.map((err, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs bg-[#0c0d10] px-2.5 py-1.5 rounded border border-[#1e2028]">
                        <span className="text-[#ff9100] font-heading font-bold flex-shrink-0">Line {err.line}</span>
                        <span className="text-gray-200 truncate mx-2 flex-1">{err.cause}</span>
                        <span className="text-gray-400 font-mono text-xs truncate max-w-[170px] flex-shrink-0">{err.inlineComment}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Mode 1: The 2 Options Choice Screen */}
            {viewMode === 'choice' ? (
              <div className="p-3.5 space-y-2.5">
                <div className="text-gray-400 text-xs font-heading font-semibold">
                  Select an action:
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Option 1: Explanation with Inline Comment */}
                  <button
                    onClick={handleExplain}
                    className="group p-3.5 rounded-lg border border-[#252832] hover:border-[#ff9100]/60 bg-[#16171d] hover:bg-[#1a1b22] transition text-left flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="w-6 h-6 rounded bg-[#20222a] flex items-center justify-center text-gray-300 group-hover:text-[#ff9100] transition">
                          <MessageSquareCode className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded bg-[#20222a] text-gray-300 font-heading font-bold">1</span>
                      </div>
                      <div>
                        <h4 className="font-heading font-bold text-white group-hover:text-[#ff9100] text-sm transition">
                          {(fixResult?.errors?.length || 0) > 1 ? `1. Explain All Errors (${fixResult?.errors?.length})` : '1. Explain with Comments'}
                        </h4>
                        <p className="text-gray-300 text-xs mt-1 leading-relaxed">
                          {(fixResult?.errors?.length || 0) > 1
                            ? `Inserts inline explanation comments beside all ${fixResult?.errors?.length} error lines.`
                            : `Adds an inline comment beside line ${targetLine} explaining why the error occurred.`}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-[#22242e] flex items-center text-gray-200 group-hover:text-[#ff9100] text-xs font-heading font-bold transition">
                      <span>Insert Comments</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </div>
                  </button>

                  {/* Option 2: Live Auto-Fix */}
                  <button
                    onClick={() => setViewMode('live_preview')}
                    className="group p-3.5 rounded-lg border border-[#252832] hover:border-[#ff9100]/80 bg-[#16171d] hover:bg-[#1a1b22] transition text-left flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="w-6 h-6 rounded bg-[#ff9100]/10 flex items-center justify-center text-[#ff9100]">
                          <Sparkles className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded bg-[#20222a] text-gray-300 font-heading font-bold">2</span>
                      </div>
                      <div>
                        <h4 className="font-heading font-bold text-white group-hover:text-[#ff9100] text-sm transition">
                          {(fixResult?.errors?.length || 0) > 1 ? `2. Auto-Fix All Errors (${fixResult?.errors?.length})` : '2. Auto-Fix Code'}
                        </h4>
                        <p className="text-gray-300 text-xs mt-1 leading-relaxed">
                          {(fixResult?.errors?.length || 0) > 1
                            ? `Directly patches all ${fixResult?.errors?.length} errors with live diff preview.`
                            : `Directly patches the code with live diff preview and validation.`}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-[#22242e] flex items-center text-[#ff9100] text-xs font-heading font-bold transition">
                      <span>Preview & Fix</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              /* Mode 2: Live Fix Preview */
              <div className="p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-white text-xs font-heading font-bold flex items-center space-x-1.5">
                    <Code2 className="w-4 h-4 text-[#ff9100]" />
                    <span>
                      {(fixResult?.errors?.length || 0) > 1
                        ? `Fix Preview (${fixResult?.errors?.length} Errors Repaired):`
                        : `Fix Preview (Line ${targetLine}):`}
                    </span>
                  </span>
                  <button
                    onClick={() => setViewMode('choice')}
                    className="text-gray-400 hover:text-white text-xs font-heading font-semibold hover:underline"
                  >
                    Back to options [1]
                  </button>
                </div>

                {/* Diff Box: Multi-Error Cards or Single Error Diff */}
                {(fixResult?.errors?.length || 0) > 1 ? (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {fixResult?.errors?.map((err, idx) => (
                      <div key={idx} className="bg-[#0b0c0e] border border-[#22242e] rounded p-2.5 font-mono text-xs space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] pb-1 border-b border-[#1c1e24]">
                          <span className="text-[#ff9100] font-heading font-bold">Line {err.line}</span>
                          <span className="text-gray-300 font-sans truncate ml-2 text-[11px]">{err.cause}</span>
                        </div>
                        {err.originalSnippet && (
                          <div className="flex items-start space-x-2 text-rose-400 bg-rose-950/20 px-2 py-1 rounded border-l-2 border-rose-500 text-[12px]">
                            <span className="select-none font-bold text-rose-500">-</span>
                            <span className="line-through flex-1">{err.originalSnippet}</span>
                          </div>
                        )}
                        {err.fixedSnippet && (
                          <div className="flex items-start space-x-2 text-emerald-300 bg-emerald-950/30 px-2 py-1 rounded border-l-2 border-emerald-500 text-[12px]">
                            <span className="select-none font-bold text-emerald-400">+</span>
                            <span className="flex-1 font-semibold">{err.fixedSnippet}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#0b0c0e] border border-[#22242e] rounded p-3 font-mono text-[13px] leading-relaxed space-y-1.5 overflow-x-auto">
                    {/* Original line */}
                    <div className="flex items-start space-x-2 text-rose-400 bg-rose-950/20 px-2.5 py-1.5 rounded border-l-2 border-rose-500">
                      <span className="select-none font-bold text-rose-500">-</span>
                      <span className="line-through flex-1">{fixResult?.originalSnippet || '// original'}</span>
                    </div>

                    {/* Fixed line */}
                    <div className="flex items-start space-x-2 text-emerald-300 bg-emerald-950/30 px-2.5 py-1.5 rounded border-l-2 border-emerald-500">
                      <span className="select-none font-bold text-emerald-400">+</span>
                      <span className="flex-1 font-semibold">{fixResult?.fixedSnippet || '// fixed'}</span>
                    </div>
                  </div>
                )}

                {/* Action Bar */}
                <div className="pt-2 flex items-center justify-between border-t border-[#22242c]">
                  <button
                    onClick={() => setViewMode('choice')}
                    className="px-3.5 py-1.5 rounded bg-[#18191e] hover:bg-[#20222a] text-gray-300 hover:text-white text-xs font-heading font-semibold transition"
                  >
                    Back
                  </button>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={onClose}
                      className="px-3.5 py-1.5 rounded bg-[#18191e] hover:bg-[#20222a] text-gray-400 hover:text-white text-xs font-heading font-semibold transition"
                    >
                      Discard (Esc)
                    </button>
                    <button
                      onClick={handleAcceptFix}
                      disabled={isApplying}
                      className="flex items-center space-x-1.5 px-4 py-1.5 rounded bg-[#ff9100] hover:bg-[#e08000] text-[#0b0c0e] font-heading font-bold text-xs shadow transition disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      <span>{isApplying ? 'Applying...' : 'Accept Fix (Enter)'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
