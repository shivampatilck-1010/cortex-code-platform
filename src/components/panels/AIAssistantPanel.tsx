'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Wand2,
  Zap,
  HelpCircle,
  Send,
  RefreshCw,
  ArrowRightLeft,
  Copy,
  Check,
  Loader2,
  Key,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  X,
} from 'lucide-react';
import { AISettings, AIAnalysisResult } from '@/lib/ai/assistant';
import { SUPPORTED_LANGUAGES } from '@/config/languages';
import { LanguageIcon } from '@/components/common/LanguageIcon';

interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
  isCode?: boolean;
}

interface AIAssistantPanelProps {
  currentCode: string;
  language: string;
  settings: AISettings;
  onUpdateSettings: (newSettings: Partial<AISettings>) => void;
  onTriggerExplain: () => void;
  onTriggerOptimize: () => void;
  onTriggerRefactor: () => void;
  onTriggerConvert: (toLang: string) => void;
  onTriggerAutoFix: () => void;
  analysisResult: AIAnalysisResult | null;
  isAnalyzing: boolean;
  analysisMode: 'explain' | 'optimize' | 'refactor' | null;
  isDarkMode?: boolean;
}

export const AIAssistantPanel: React.FC<AIAssistantPanelProps> = ({
  currentCode,
  language,
  settings,
  onUpdateSettings,
  onTriggerExplain,
  onTriggerOptimize,
  onTriggerRefactor,
  onTriggerConvert,
  analysisResult,
  isAnalyzing,
  analysisMode,
  isDarkMode = true,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'assistant' | 'convert' | 'settings'>('assistant');
  const [targetLang, setTargetLang] = useState('cpp');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      sender: 'ai',
      text: 'Hi! I\'m Cortex AI. Ask me anything about your code — explanations, bugs, optimizations, or how to improve it.',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Inline API key connection
  const [showKeyBanner, setShowKeyBanner] = useState(true);
  const [keyInput, setKeyInput] = useState('');
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [keyMsg, setKeyMsg] = useState('');
  const isConnected = Boolean(settings.apiKey);

  const handleConnectKey = async (keyVal: string) => {
    const trimmed = keyVal.trim();
    if (!trimmed) return;
    setIsValidatingKey(true);
    setKeyStatus('idle');
    setKeyMsg('');
    try {
      const res = await fetch('/api/v1/ai/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setKeyStatus('valid');
        setKeyMsg('Connected! Gemini AI is ready.');
        
        if (typeof window !== 'undefined') localStorage.setItem('cortex_gemini_api_key', trimmed);
        setTimeout(() => setShowKeyBanner(false), 1500);
      } else {
        setKeyStatus('invalid');
        setKeyMsg(data.error || 'Invalid key. Check your key and try again.');
      }
    } catch {
      setKeyStatus('invalid');
      setKeyMsg('Network error. Please try again.');
    } finally {
      setIsValidatingKey(false);
    }
  };

  const handleKeyPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').trim();
    if (pasted.length >= 15) {
      setKeyInput(pasted);
      setTimeout(() => handleConnectKey(pasted), 100);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatLoading]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || isChatLoading) return;

    setChatMessages((prev) => [...prev, { sender: 'user', text: trimmed }]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const res = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: trimmed,
          code: currentCode,
          language,
          
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages((prev) => [...prev, { sender: 'ai', text: data.reply || 'No response.' }]);
      } else {
        setChatMessages((prev) => [
          ...prev,
          { sender: 'ai', text: 'Error connecting to Gemini AI. Check your API key in Settings.' },
        ]);
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { sender: 'ai', text: 'Network error. Please check your connection and try again.' },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1500);
    });
  };

  const getModeLabel = () => {
    if (analysisMode === 'explain') return 'Code Explanation';
    if (analysisMode === 'optimize') return 'Optimization Report';
    if (analysisMode === 'refactor') return 'Refactored Code';
    return 'AI Analysis';
  };

  const getModeIcon = () => {
    if (analysisMode === 'optimize') return <Zap className="w-4 h-4" />;
    if (analysisMode === 'refactor') return <Wand2 className="w-4 h-4" />;
    return <HelpCircle className="w-4 h-4" />;
  };

  // Render a chat message — handles code blocks inside text
  const renderMessage = (msg: ChatMessage, idx: number) => {
    const isUser = msg.sender === 'user';

    // Split text on ```…``` blocks
    const parts: { type: 'text' | 'code'; content: string; lang?: string }[] = [];
    const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(msg.text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: msg.text.slice(lastIndex, match.index) });
      }
      parts.push({ type: 'code', content: match[2].trim(), lang: match[1] || 'code' });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < msg.text.length) {
      parts.push({ type: 'text', content: msg.text.slice(lastIndex) });
    }

    return (
      <div
        key={idx}
        className={`flex flex-col max-w-[92%] leading-relaxed text-xs gap-1 ${
          isUser ? 'ml-auto items-end' : 'mr-auto items-start'
        }`}
      >
        {parts.map((part, pi) =>
          part.type === 'code' ? (
            <div key={pi} className={`w-full rounded border overflow-hidden ${
              isDarkMode ? 'border-[#303340] bg-[#111215]' : 'border-slate-200 bg-slate-900'
            }`}>
              <div className={`flex items-center justify-between px-2.5 py-1 border-b ${
                isDarkMode ? 'bg-[#1c1e26] border-[#303340]' : 'bg-slate-800 border-slate-700'
              }`}>
                <span className="text-[10px] text-gray-400 font-heading font-semibold uppercase tracking-wider">
                  {part.lang}
                </span>
                <button
                  onClick={() => handleCopyCode(part.content)}
                  className="flex items-center space-x-1 text-[10px] text-gray-400 hover:text-[#ff9100] transition"
                >
                  {copiedCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-2.5 text-[11px] text-green-300 font-mono overflow-x-auto whitespace-pre-wrap">
                {part.content}
              </pre>
            </div>
          ) : (
            <div
              key={pi}
              className={`px-3 py-2 rounded-xl ${
                isUser
                  ? isDarkMode
                    ? 'bg-[#ff9100]/20 border border-[#ff9100]/40 text-amber-100'
                    : 'bg-amber-100 border border-amber-300 text-amber-950 shadow-sm'
                  : isDarkMode
                    ? 'bg-[#18191e] border border-[#252830] text-gray-200'
                    : 'bg-slate-100 border border-slate-200 text-slate-800 shadow-sm'
              }`}
            >
              {part.content.trim()}
            </div>
          )
        )}
      </div>
    );
  };

  return (
    <div className={`h-full flex flex-col text-xs font-mono select-text overflow-hidden transition-colors duration-200 ${
      isDarkMode ? 'bg-[#141518] text-gray-200' : 'bg-white text-slate-800'
    }`}>
      {/* Sub Tabs */}
      <div className={`px-3 border-b flex items-center transition-colors duration-200 ${
        isDarkMode ? 'bg-[#18191d] border-[#252830]' : 'bg-slate-100 border-slate-200'
      }`}>
        <div className="flex space-x-1">
          {[
            { id: 'assistant', label: 'Assistant', Icon: Sparkles },
            { id: 'convert', label: 'Convert', Icon: ArrowRightLeft },
            { id: 'settings', label: 'Settings', Icon: null },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSubTab(id as typeof activeSubTab)}
              className={`py-2 px-3.5 border-b-2 font-heading font-semibold text-xs tracking-wide transition ${
                activeSubTab === id
                  ? 'border-[#ff9100] text-[#ff9100]'
                  : isDarkMode
                    ? 'border-transparent text-gray-400 hover:text-gray-200'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center space-x-1.5">
                {Icon && <Icon className="w-3.5 h-3.5" />}
                <span>{label}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* SUBTAB 1: Assistant */}
        {activeSubTab === 'assistant' && (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Action Buttons */}
            <div className={`grid grid-cols-3 gap-2 p-3 border-b transition-colors duration-200 ${
              isDarkMode ? 'border-[#1f2129]' : 'border-slate-200 bg-slate-50'
            }`}>
              <button
                onClick={onTriggerExplain}
                disabled={isAnalyzing}
                className={`flex items-center justify-center space-x-1.5 py-2 px-2.5 rounded font-heading font-semibold text-xs transition disabled:opacity-50 border ${
                  isDarkMode
                    ? 'bg-[#1f2129] hover:bg-[#282b36] border-[#303340] text-gray-200'
                    : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800 shadow-sm'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5 text-[#ff9100]" />
                <span>Explain</span>
              </button>
              <button
                onClick={onTriggerOptimize}
                disabled={isAnalyzing}
                className={`flex items-center justify-center space-x-1.5 py-2 px-2.5 rounded font-heading font-semibold text-xs transition disabled:opacity-50 border ${
                  isDarkMode
                    ? 'bg-[#1f2129] hover:bg-[#282b36] border-[#303340] text-gray-200'
                    : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800 shadow-sm'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-[#ff9100]" />
                <span>Optimize</span>
              </button>
              <button
                onClick={onTriggerRefactor}
                disabled={isAnalyzing}
                className={`flex items-center justify-center space-x-1.5 py-2 px-2.5 rounded font-heading font-semibold text-xs transition disabled:opacity-50 border ${
                  isDarkMode
                    ? 'bg-[#1f2129] hover:bg-[#282b36] border-[#303340] text-gray-200'
                    : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800 shadow-sm'
                }`}
              >
                <Wand2 className="w-3.5 h-3.5 text-[#ff9100]" />
                <span>Refactor</span>
              </button>
            </div>

            {/* API Key Connection Banner — shows when no key is set */}
            {!isConnected && showKeyBanner && (
              <div className={`mx-3 mt-2 rounded border overflow-hidden flex-shrink-0 transition-colors duration-200 ${
                isDarkMode ? 'border-[#252830] bg-[#18191e]' : 'border-slate-200 bg-slate-50 shadow-sm'
              }`}>
                <div className="px-3 py-2.5 space-y-2">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center space-x-1.5 text-[#ff9100] font-heading font-bold text-xs">
                      <Key className="w-3.5 h-3.5" />
                      <span>Connect Gemini AI (Free)</span>
                    </span>
                    <button
                      onClick={() => setShowKeyBanner(false)}
                      className={`p-0.5 rounded transition ${isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-slate-400 hover:text-slate-600'}`}
                      aria-label="Dismiss banner"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Steps */}
                  <div className={`text-[11px] space-y-1 ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>
                    <div className="flex items-start space-x-2">
                      <span className="text-[#ff9100] font-bold">1.</span>
                      <span>
                        Get your free API key from{' '}
                        <a
                          href="https://aistudio.google.com/app/apikey"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#ff9100] underline hover:text-[#e08000] inline-flex items-center space-x-0.5"
                        >
                          <span>Google AI Studio</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="text-[#ff9100] font-bold">2.</span>
                      <span>Paste your key below — it connects automatically</span>
                    </div>
                  </div>

                  {/* Key Input */}
                  <div className="flex items-center space-x-1.5">
                    <div className="relative flex-1">
                      <input
                        type="password"
                        placeholder="Paste API key here (AIzaSy...)"
                        value={keyInput}
                        onChange={(e) => setKeyInput(e.target.value)}
                        onPaste={handleKeyPaste}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleConnectKey(keyInput);
                        }}
                        className={`w-full px-2.5 py-1.5 rounded text-xs font-mono focus:outline-none focus:border-[#ff9100] pr-7 border ${
                          isDarkMode
                            ? 'bg-[#0b0c0e] border-[#282a34] text-white placeholder:text-gray-500'
                            : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 shadow-inner'
                        }`}
                      />
                      {isValidatingKey && (
                        <Loader2 className="w-3 h-3 text-[#ff9100] animate-spin absolute right-2 top-2" />
                      )}
                    </div>
                    <button
                      onClick={() => handleConnectKey(keyInput)}
                      disabled={!keyInput.trim() || isValidatingKey}
                      className="px-3 py-1.5 bg-[#ff9100] hover:bg-[#e08000] text-[#0b0c0e] font-heading font-bold text-xs rounded transition disabled:opacity-40"
                    >
                      Connect
                    </button>
                  </div>

                  {/* Validation Result */}
                  {keyStatus === 'valid' && (
                    <div className="text-emerald-500 text-[11px] flex items-center space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{keyMsg}</span>
                    </div>
                  )}
                  {keyStatus === 'invalid' && (
                    <div className="text-rose-500 text-[11px] flex items-center space-x-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{keyMsg}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Connected indicator */}
            {isConnected && showKeyBanner && (
              <div className={`mx-3 mt-2 px-3 py-1.5 rounded border flex items-center justify-between flex-shrink-0 ${
                isDarkMode ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}>
                <span className="text-[11px] flex items-center space-x-1.5 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Gemini AI connected</span>
                </span>
                <button
                  onClick={() => setShowKeyBanner(false)}
                  className={`p-0.5 rounded transition ${isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-emerald-600 hover:text-emerald-800'}`}
                  aria-label="Dismiss banner"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Analysis Result */}
            {(isAnalyzing || analysisResult) && (
              <div className={`mx-3 mt-2.5 mb-1 rounded border overflow-hidden flex-shrink-0 transition-colors duration-200 ${
                isDarkMode ? 'border-[#252830] bg-[#18191e]' : 'border-slate-200 bg-slate-50 shadow-sm'
              }`}>
                {isAnalyzing ? (
                  <div className={`flex items-center space-x-2 p-3 ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>
                    <RefreshCw className="w-4 h-4 text-[#ff9100] animate-spin" />
                    <span className="text-xs font-heading">Analyzing with Gemini AI...</span>
                  </div>
                ) : analysisResult ? (
                  <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <span className="flex items-center space-x-1.5 text-[#ff9100] font-heading font-bold text-xs">
                        {getModeIcon()}
                        <span>{getModeLabel()}</span>
                      </span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        isDarkMode ? 'text-gray-400 bg-[#111215]' : 'text-slate-600 bg-slate-200'
                      }`}>
                        {analysisResult.complexityEstimate}
                      </span>
                    </div>

                    {/* Explanation */}
                    <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-gray-200' : 'text-slate-800'}`}>{analysisResult.explanation}</p>

                    {/* Bugs */}
                    {analysisResult.bugs && analysisResult.bugs.length > 0 && analysisResult.bugs[0] !== 'No critical static syntax defects detected in current scope.' && (
                      <div>
                        <span className="text-xs text-rose-500 font-heading font-bold block mb-1">Issues Found:</span>
                        <ul className={`list-disc list-inside space-y-0.5 text-xs ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>
                          {analysisResult.bugs.map((b, i) => <li key={i}>{b}</li>)}
                        </ul>
                      </div>
                    )}

                    {/* Optimizations */}
                    {(analysisResult.optimizations?.length ?? 0) > 0 && (
                      <div>
                        <span className="text-xs text-[#ff9100] font-heading font-bold block mb-1">
                          {analysisMode === 'optimize' ? 'Optimizations:' : analysisMode === 'refactor' ? 'Improvements:' : 'Notes:'}
                        </span>
                        <ul className={`list-disc list-inside space-y-0.5 text-xs ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>
                          {analysisResult.optimizations.map((opt, i) => <li key={i}>{opt}</li>)}
                        </ul>
                      </div>
                    )}

                    {/* Suggested Code */}
                    {analysisResult.suggestedCode && analysisResult.suggestedCode.trim() && (
                      <div className={`rounded border overflow-hidden ${
                        isDarkMode ? 'border-[#303340] bg-[#111215]' : 'border-slate-200 bg-slate-900'
                      }`}>
                        <div className={`flex items-center justify-between px-2.5 py-1 border-b ${
                          isDarkMode ? 'bg-[#1c1e26] border-[#303340]' : 'bg-slate-800 border-slate-700'
                        }`}>
                          <span className="text-[10px] text-gray-400 font-heading font-semibold uppercase tracking-wider">
                            {analysisMode === 'refactor' ? 'Refactored Code' : 'Suggested Code'}
                          </span>
                          <button
                            onClick={() => handleCopyCode(analysisResult.suggestedCode!)}
                            className="flex items-center space-x-1 text-[10px] text-gray-400 hover:text-[#ff9100] transition"
                          >
                            {copiedCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                        <pre className="p-2.5 text-[10px] text-green-300 font-mono overflow-x-auto whitespace-pre-wrap max-h-28">
                          {analysisResult.suggestedCode}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
              {chatMessages.map((msg, idx) => renderMessage(msg, idx))}
              {isChatLoading && (
                <div className={`mr-auto flex items-center space-x-2 px-3 py-2 rounded-xl text-xs border ${
                  isDarkMode ? 'bg-[#18191e] border-[#252830] text-gray-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ff9100]" />
                  <span className="font-heading">Cortex AI is thinking...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendChat} className={`flex items-center space-x-2 p-3 border-t transition-colors duration-200 ${
              isDarkMode ? 'border-[#262832]' : 'border-slate-200 bg-slate-50'
            }`}>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about your code, bugs, or how to improve it..."
                disabled={isChatLoading}
                className={`flex-1 px-3.5 py-2 rounded border focus:outline-none focus:ring-1 focus:ring-[#ff9100] text-xs disabled:opacity-60 ${
                  isDarkMode
                    ? 'bg-[#141518] text-gray-200 border-[#252830] placeholder:text-gray-500'
                    : 'bg-white text-slate-900 border-slate-300 placeholder:text-slate-400 shadow-inner'
                }`}
              />
              <button
                type="submit"
                disabled={isChatLoading || !chatInput.trim()}
                className="p-2 bg-[#ff9100] hover:bg-[#e08000] text-[#0b0c0e] font-heading font-bold rounded transition shadow-sm disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}

        {/* SUBTAB 2: Code Conversion */}
        {activeSubTab === 'convert' && (
          <div className="p-3.5 space-y-4 overflow-y-auto">
            <div>
              <h4 className={`font-heading font-bold text-sm mb-1 ${isDarkMode ? 'text-gray-200' : 'text-slate-900'}`}>Convert Language</h4>
              <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>Translate your code from {language} to another language using Gemini AI.</p>
            </div>

            <div className={`flex items-center space-x-3 p-3 rounded-lg border ${
              isDarkMode ? 'bg-[#141518] border-[#23252d]' : 'bg-slate-50 border-slate-200 shadow-sm'
            }`}>
              <div className="flex items-center space-x-2">
                <LanguageIcon languageId={language} size={20} />
                <span className={`text-xs font-heading font-bold capitalize ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{language}</span>
              </div>
              <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>→</span>
              <div className="flex items-center space-x-2">
                <LanguageIcon languageId={targetLang} size={20} />
                <span className="text-xs font-heading font-bold text-[#ff9100] capitalize">{targetLang}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className={`text-xs font-heading font-semibold block ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>Target Language:</label>
              <div className="relative flex items-center">
                <div className="absolute left-3 pointer-events-none">
                  <LanguageIcon languageId={targetLang} size={16} />
                </div>
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className={`w-full pl-9 pr-3 py-2.5 rounded border text-xs font-heading font-semibold focus:outline-none focus:border-[#ff9100] cursor-pointer ${
                    isDarkMode ? 'bg-[#1c1e24] text-gray-200 border-[#2d303b]' : 'bg-white text-slate-900 border-slate-300 shadow-sm'
                  }`}
                >
                  {SUPPORTED_LANGUAGES.filter((l) => l.id !== language).map((l) => (
                    <option key={l.id} value={l.id} className={isDarkMode ? 'bg-[#1c1e24] text-gray-200' : 'bg-white text-slate-900'}>
                      {l.name} ({l.version})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={() => onTriggerConvert(targetLang)}
              className="w-full py-2.5 bg-[#ff9100] hover:bg-[#e08000] text-[#0b0c0e] font-heading font-bold rounded shadow-sm transition text-xs flex items-center justify-center space-x-2"
            >
              <LanguageIcon languageId={targetLang} size={16} />
              <span>Convert to {targetLang.toUpperCase()}</span>
            </button>
          </div>
        )}

        {/* SUBTAB 3: Settings */}
        {activeSubTab === 'settings' && (
          <div className="p-3.5 space-y-4 overflow-y-auto">
            <h4 className={`font-heading font-bold text-sm ${isDarkMode ? 'text-gray-200' : 'text-slate-900'}`}>Assistant Settings</h4>

            {/* Operational Mode */}
            <div className="space-y-2">
              <span className={`text-xs block font-heading font-semibold ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>Operational Mode:</span>
              <div className="space-y-2">
                {[
                  { id: 'manual', label: 'Manual', desc: 'Only analyze and suggest; do not generate automatic diffs.' },
                  { id: 'confirm', label: 'Confirm Before Applying', desc: 'Show side-by-side diff modal; apply upon approval.' },
                  { id: 'automatic', label: 'Automatic', desc: 'Apply fix directly and recompile.' },
                ].map((mode) => (
                  <label
                    key={mode.id}
                    className={`flex items-start space-x-2.5 p-2.5 rounded border cursor-pointer transition ${
                      settings.operationalMode === mode.id
                        ? 'bg-[#ff9100]/10 border-[#ff9100]'
                        : isDarkMode
                          ? 'bg-[#18191d] border-[#282a33] hover:border-[#ff9100]/40'
                          : 'bg-slate-50 border-slate-200 hover:border-[#ff9100]/40 shadow-sm'
                    }`}
                  >
                    <input
                      type="radio"
                      name="operationalMode"
                      checked={settings.operationalMode === mode.id}
                      onChange={() => onUpdateSettings({ operationalMode: mode.id as 'manual' | 'confirm' | 'automatic' })}
                      className="mt-0.5 accent-[#ff9100]"
                    />
                    <div>
                      <span className={`font-heading font-bold block text-xs ${isDarkMode ? 'text-gray-200' : 'text-slate-900'}`}>{mode.label}</span>
                      <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>{mode.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className={`space-y-2 pt-2 border-t ${isDarkMode ? 'border-[#262832]' : 'border-slate-200'}`}>
              {[
                { key: 'autoFixErrors', label: 'Auto Fix Errors' },
                { key: 'explainErrors', label: 'Explain Errors with Comments' },
                { key: 'suggestImprovements', label: 'Suggest Optimizations' },
                { key: 'generateTestCases', label: 'Generate Test Cases' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between py-1.5">
                  <span className={`text-xs font-heading font-semibold ${isDarkMode ? 'text-gray-200' : 'text-slate-800'}`}>{item.label}</span>
                  <input
                    type="checkbox"
                    checked={(settings as unknown as Record<string, boolean>)[item.key]}
                    onChange={(e) => onUpdateSettings({ [item.key]: e.target.checked })}
                    className="rounded border-gray-700 accent-[#ff9100] w-4 h-4 cursor-pointer"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
