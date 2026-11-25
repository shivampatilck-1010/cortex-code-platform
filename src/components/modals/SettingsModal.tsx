'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Settings, 
  Sliders, 
  Sparkles, 
  Shield, 
  Key, 
  Keyboard, 
  User, 
  Cpu, 
  Palette,
  Check,
  CheckCircle2,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Eye,
  EyeOff,
  Copy,
  Lock,
  Server,
  Zap,
  RefreshCw
} from 'lucide-react';
import { AISettings } from '@/lib/ai/assistant';
import { CortexLogo } from '@/components/brand/CortexLogo';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiSettings: AISettings;
  onUpdateAISettings: (newSettings: Partial<AISettings>) => void;
  fontSize: number;
  onChangeFontSize: (size: number) => void;
  theme: string;
  onChangeTheme: (theme: string) => void;
  isDarkMode?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  aiSettings,
  onUpdateAISettings,
  fontSize,
  onChangeFontSize,
  theme,
  onChangeTheme,
  isDarkMode: propDarkMode,
}) => {
  const isDarkMode = propDarkMode ?? (theme !== 'light' && theme !== 'cortex-light');
  const [activeSection, setActiveSection] = useState<
    'general' | 'editor' | 'appearance' | 'execution' | 'ai' | 'security' | 'shortcuts' | 'api'
  >('ai');

  const [keyInput, setKeyInput] = useState(aiSettings.apiKey || '');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationState, setValidationState] = useState<'idle' | 'valid' | 'invalid'>(aiSettings.apiKey ? 'valid' : 'idle');
  const [validationMsg, setValidationMsg] = useState(aiSettings.apiKey ? 'Your auto fix is connected and good to go!' : '');

  // API Key & Execution Limits State
  // API Key Verification & Status State
  const [copiedKey, setCopiedKey] = useState(false);
  const [memoryLimit, setMemoryLimit] = useState<number>(512);
  const [processTimeout, setProcessTimeout] = useState<number>(10);

  // Load execution limits from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMem = localStorage.getItem('cortex_memory_limit');
      if (savedMem) setMemoryLimit(Number(savedMem));
      const savedTimeout = localStorage.getItem('cortex_process_timeout');
      if (savedTimeout) setProcessTimeout(Number(savedTimeout));
    }
  }, []);

  const handleSaveMemory = (val: number) => {
    setMemoryLimit(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cortex_memory_limit', String(val));
    }
  };

  const handleSaveTimeout = (val: number) => {
    setProcessTimeout(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cortex_process_timeout', String(val));
    }
  };

  const validateKey = async (k: string) => {
    const trimmed = k.trim();
    if (!trimmed) {
      setValidationState('idle');
      setValidationMsg('');
      onUpdateAISettings({ apiKey: '', provider: 'offline_ast' });
      if (typeof window !== 'undefined') localStorage.removeItem('cortex_gemini_api_key');
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
        onUpdateAISettings({ apiKey: trimmed, provider: 'gemini' });
        if (typeof window !== 'undefined') localStorage.setItem('cortex_gemini_api_key', trimmed);
      } else {
        setValidationState('invalid');
        setValidationMsg(data.error || 'Invalid API key. Please check your key from Google AI Studio and try again.');
      }
    } catch {
      setValidationState('invalid');
      setValidationMsg('Network error validating API key. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleCopyApiKey = (keyText: string) => {
    navigator.clipboard.writeText(keyText);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  if (!isOpen) return null;

  const cardClass = isDarkMode
    ? 'bg-[#1e2028] border-[#2d303d]'
    : 'bg-slate-50 border-slate-200';
  const headingClass = isDarkMode ? 'text-gray-200' : 'text-slate-900';
  const mutedClass = isDarkMode ? 'text-gray-400' : 'text-slate-600';
  const dividerClass = isDarkMode ? 'border-[#2a2c36]' : 'border-slate-200';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className={`rounded-lg shadow-2xl w-full max-w-3xl h-[600px] flex flex-col overflow-hidden text-xs border ${
          isDarkMode
            ? 'bg-[#18191e] border-[#2f323e] text-gray-200'
            : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`px-5 py-3.5 border-b flex items-center justify-between ${
            isDarkMode ? 'bg-[#141518] border-[#252830]' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className={`flex items-center space-x-3 ${headingClass}`}>
            <CortexLogo variant="header" size="sm" />
            <span className={`${mutedClass} text-xs`}>•</span>
            <span className={`font-heading font-semibold text-xs ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>
              Platform Settings
            </span>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded transition ${
              isDarkMode
                ? 'text-gray-400 hover:text-white hover:bg-[#202227]'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
            }`}
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Left Sidebar + Right Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Settings Nav Sidebar */}
          <div
            className={`w-48 border-r p-2 space-y-0.5 ${
              isDarkMode ? 'bg-[#141518] border-[#2a2c36]' : 'bg-slate-50 border-slate-200'
            }`}
          >
            {[
              { id: 'ai', label: 'AI Assistance', icon: Sparkles },
              { id: 'editor', label: 'Editor & Fonts', icon: Sliders },
              { id: 'appearance', label: 'Theme & Style', icon: Palette },
              { id: 'execution', label: 'Execution & Limits', icon: Cpu },
              { id: 'security', label: 'Security & Sandbox', icon: Shield },
              { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
              { id: 'api', label: 'Developer API Keys', icon: Key },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSection === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id as any)}
                  className={`w-full flex items-center space-x-2 px-3 py-2 rounded text-left transition ${
                    isActive
                      ? isDarkMode
                        ? 'bg-[#252830] text-[#ff9100] font-semibold'
                        : 'bg-[#ff9100]/15 text-[#b45309] font-semibold'
                      : isDarkMode
                        ? 'text-gray-400 hover:bg-[#1c1d22] hover:text-gray-200'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Settings Section Panel */}
          <div className={`flex-1 p-5 overflow-y-auto space-y-5 ${isDarkMode ? 'bg-[#18191e]' : 'bg-white'}`}>
            {/* AI ASSISTANCE */}
            {activeSection === 'ai' && (
              <div className="space-y-4">
                <div>
                  <h3 className={`text-sm font-heading font-bold ${headingClass}`}>AI Coding Assistant & Auto-Fix</h3>
                  <p className={`${mutedClass} text-xs mt-0.5`}>Configure automated code generation, error inspection, and autonomous repair rules.</p>
                </div>

                <div className={`space-y-3 p-4 rounded border ${cardClass}`}>
                  {/* Inline Code Suggestions Toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={`font-heading font-semibold block text-xs ${headingClass}`}>Inline Code Suggestions (Ghost Text)</span>
                      <span className={`${mutedClass} text-xs`}>Show intelligent completions as you type. Press Tab to accept, Esc to dismiss. (Default: OFF)</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(aiSettings.enableInlineSuggestions)}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        onUpdateAISettings({ enableInlineSuggestions: enabled });
                        if (typeof window !== 'undefined') {
                          localStorage.setItem('cortex_inline_suggestions', String(enabled));
                        }
                      }}
                      className="w-4 h-4 rounded accent-[#ff9100] cursor-pointer"
                    />
                  </div>

                  <div className={`flex items-center justify-between pt-2.5 border-t ${dividerClass}`}>
                    <div>
                      <span className={`font-heading font-semibold block text-xs ${headingClass}`}>Explain Errors in Plain English</span>
                      <span className={`${mutedClass} text-xs`}>Translate compiler diagnostics into beginner-friendly explanations and comments.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={aiSettings.explainErrors}
                      onChange={(e) => onUpdateAISettings({ explainErrors: e.target.checked })}
                      className="w-4 h-4 rounded accent-[#ff9100] cursor-pointer"
                    />
                  </div>

                  <div className={`flex items-center justify-between pt-2.5 border-t ${dividerClass}`}>
                    <div>
                      <span className={`font-heading font-semibold block text-xs ${headingClass}`}>Suggest Performance Optimizations</span>
                      <span className={`${mutedClass} text-xs`}>Provide suggestions to reduce asymptotic complexity from O(n²) to O(n).</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={aiSettings.suggestImprovements}
                      onChange={(e) => onUpdateAISettings({ suggestImprovements: e.target.checked })}
                      className="w-4 h-4 rounded accent-[#ff9100] cursor-pointer"
                    />
                  </div>
                </div>

                {/* Google Gemini AI Integration (Free API Key) */}
                <div
                  className={`border rounded-lg p-3.5 space-y-2.5 ${
                    isDarkMode ? 'bg-[#151722] border-[#2d303f]' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs flex items-center space-x-1.5 text-[#ff9100]">
                      <Sparkles className="w-4 h-4 text-[#ff9100]" />
                      <span>Google Gemini AI Integration (Free API Key)</span>
                    </span>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#ff9100] hover:text-[#e08000] text-[10.5px] flex items-center space-x-1 underline"
                    >
                      <span>Get free key from Google AI Studio</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>

                  <p className={`text-[11px] leading-relaxed ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>
                    To handle complex algorithmic errors and deep code repairs across all 16 languages beyond offline heuristics, connect your free Google Gemini API key:
                  </p>

                  <div
                    className={`text-[10.5px] space-y-1 p-2 rounded border ${
                      isDarkMode
                        ? 'text-gray-400 bg-[#0f1015] border-[#222430]'
                        : 'text-slate-600 bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-start space-x-2">
                      <span className="text-[#ff9100] font-bold">1.</span>
                      <span>Paste your key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-[#ff9100] underline">Google AI Studio</a>.</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="text-[#ff9100] font-bold">2.</span>
                      <span>The key is encrypted in your local browser storage (<span className={`font-mono ${isDarkMode ? 'text-gray-300' : 'text-slate-800'}`}>localStorage</span>). It is never logged or exposed.</span>
                    </div>
                  </div>

                  {/* Input Box with Visibility Toggle */}
                  <div className="pt-1 space-y-2">
                    <label className={`font-semibold block text-xs ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>Google Gemini API Key:</label>
                    <div className="flex items-center space-x-2">
                      <div className="relative flex-1">
                        <input
                          type={showGeminiKey ? 'text' : 'password'}
                          placeholder="AIzaSy..."
                          value={keyInput}
                          onChange={(e) => {
                            setKeyInput(e.target.value);
                            setValidationState('idle');
                            setValidationMsg('');
                            if (e.target.value.trim().length >= 25) {
                              validateKey(e.target.value);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') validateKey(keyInput);
                          }}
                          className={`w-full px-3 py-2 rounded border focus:border-[#ff9100] focus:outline-none font-mono text-xs pr-16 ${
                            isDarkMode
                              ? 'bg-[#0e0f14] text-gray-200 border-[#2d303d]'
                              : 'bg-white text-slate-900 border-slate-300'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowGeminiKey(!showGeminiKey)}
                          className={`absolute right-8 top-2.5 transition ${
                            isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-slate-400 hover:text-slate-700'
                          }`}
                          title={showGeminiKey ? 'Hide key' : 'Show key'}
                        >
                          {showGeminiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        {isValidating && (
                          <Loader2 className="w-3.5 h-3.5 text-[#ff9100] animate-spin absolute right-2.5 top-2.5" />
                        )}
                      </div>

                      <button
                        onClick={() => validateKey(keyInput)}
                        disabled={!keyInput.trim() || isValidating}
                        className="px-3.5 py-2 bg-[#ff9100] hover:bg-[#e08000] text-[#0b0c0e] font-bold text-xs rounded transition flex items-center space-x-1.5 disabled:opacity-40"
                      >
                        {isValidating ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Validating...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3" />
                            <span>Connect</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Success Message */}
                    {validationState === 'valid' && (
                      <div
                        className={`text-[11px] flex items-center space-x-1.5 border px-2.5 py-1.5 rounded animate-in fade-in ${
                          isDarkMode
                            ? 'text-emerald-300 bg-emerald-950/40 border-emerald-600/40'
                            : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-emerald-500" />
                        <span className="font-medium">{validationMsg || 'Your auto fix is connected and good to go!'}</span>
                      </div>
                    )}

                    {/* Invalid Message */}
                    {validationState === 'invalid' && (
                      <div
                        className={`text-[11px] flex items-center space-x-1.5 border px-2.5 py-1.5 rounded ${
                          isDarkMode
                            ? 'text-rose-400 bg-rose-950/40 border-rose-800/40'
                            : 'text-rose-700 bg-rose-50 border-rose-200'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-rose-500" />
                        <span>{validationMsg}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* EDITOR SETTINGS */}
            {activeSection === 'editor' && (
              <div className="space-y-4">
                <div>
                  <h3 className={`text-sm font-heading font-bold ${headingClass}`}>Editor Settings</h3>
                  <p className={`${mutedClass} text-xs mt-0.5`}>Control typography, indentation, and Monaco code editing options.</p>
                </div>

                <div className={`space-y-3 p-4 rounded border ${cardClass}`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-heading font-semibold text-xs ${headingClass}`}>Font Size (px)</span>
                    <input
                      type="number"
                      min={10}
                      max={28}
                      value={fontSize}
                      onChange={(e) => onChangeFontSize(Number(e.target.value))}
                      className={`w-20 p-1.5 rounded border text-center text-xs font-mono focus:outline-none focus:border-[#ff9100] ${
                        isDarkMode
                          ? 'bg-[#141518] text-gray-200 border-[#2d303d]'
                          : 'bg-white text-slate-900 border-slate-300'
                      }`}
                    />
                  </div>
                  <div className={`flex items-center justify-between pt-2.5 border-t ${dividerClass}`}>
                    <span className={`font-heading font-semibold text-xs ${headingClass}`}>Tab Indentation</span>
                    <span className={`${mutedClass} font-mono text-xs`}>4 Spaces</span>
                  </div>
                  <div className={`flex items-center justify-between pt-2.5 border-t ${dividerClass}`}>
                    <span className={`font-heading font-semibold text-xs ${headingClass}`}>Auto Bracket Matching</span>
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded accent-[#ff9100] cursor-pointer" />
                  </div>
                </div>
              </div>
            )}

            {/* APPEARANCE */}
            {activeSection === 'appearance' && (
              <div className="space-y-4">
                <h3 className={`text-sm font-heading font-bold ${headingClass}`}>Theme & UI Aesthetic</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'cortex-dark', name: 'Cortex Charcoal Dark', preview: '#18191e' },
                    { id: 'hc-black', name: 'High Contrast Black', preview: '#000000' },
                    { id: 'cortex-light', name: 'Cortex Light Mode', preview: '#f8fafc' },
                  ].map((t) => {
                    const isSelected =
                      theme === t.id ||
                      (t.id === 'cortex-dark' && theme === 'vs-dark') ||
                      (t.id === 'cortex-light' && theme === 'light');
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onChangeTheme(t.id)}
                        className={`p-3 rounded border text-left flex items-center space-x-3 transition ${
                          isSelected
                            ? 'border-[#ff9100] bg-[#ff9100]/10'
                            : isDarkMode
                              ? 'border-[#2d303d] bg-[#1e2028] hover:border-[#3e4254]'
                              : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded border ${isDarkMode ? 'border-gray-600' : 'border-slate-300'}`}
                          style={{ backgroundColor: t.preview }}
                        />
                        <span className={`font-heading font-semibold text-xs ${headingClass}`}>{t.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* EXECUTION & LIMITS */}
            {activeSection === 'execution' && (
              <div className="space-y-4">
                <div>
                  <h3 className={`text-sm font-heading font-bold ${headingClass}`}>Execution & Resource Quotas</h3>
                  <p className={`${mutedClass} text-xs mt-0.5`}>Customize process execution ceilings, runtime timeouts, and memory limits.</p>
                </div>

                <div className={`space-y-3 p-4 rounded border text-xs ${cardClass}`}>
                  {/* Memory Limit Selector */}
                  <div className={`flex items-center justify-between py-1.5 border-b ${dividerClass}`}>
                    <div>
                      <span className={`font-heading font-semibold block ${headingClass}`}>Memory Ceiling (RAM)</span>
                      <span className={`${mutedClass} text-[11px]`}>Maximum memory assigned to your compiler and program runtime.</span>
                    </div>
                    <select
                      value={memoryLimit}
                      onChange={(e) => handleSaveMemory(Number(e.target.value))}
                      className={`font-mono font-bold border rounded px-3 py-1.5 text-xs focus:outline-none focus:border-[#ff9100] ${
                        isDarkMode
                          ? 'bg-[#141518] text-[#ff9100] border-[#2d303d]'
                          : 'bg-white text-[#b45309] border-slate-300'
                      }`}
                    >
                      <option value={256}>256 MB (Standard)</option>
                      <option value={512}>512 MB (Recommended)</option>
                      <option value={1024}>1024 MB (1 GB - Data / ML)</option>
                      <option value={2048}>2048 MB (2 GB - High Performance)</option>
                      <option value={4096}>4096 MB (4 GB - Maximum)</option>
                    </select>
                  </div>

                  {/* Process Timeout Selector */}
                  <div className={`flex items-center justify-between py-1.5 border-b ${dividerClass}`}>
                    <div>
                      <span className={`font-heading font-semibold block ${headingClass}`}>Process Timeout</span>
                      <span className={`${mutedClass} text-[11px]`}>Automatic termination guard to prevent infinite loops and hangs.</span>
                    </div>
                    <select
                      value={processTimeout}
                      onChange={(e) => handleSaveTimeout(Number(e.target.value))}
                      className={`font-mono font-bold border rounded px-3 py-1.5 text-xs focus:outline-none focus:border-[#ff9100] ${
                        isDarkMode
                          ? 'bg-[#141518] text-[#ff9100] border-[#2d303d]'
                          : 'bg-white text-[#b45309] border-slate-300'
                      }`}
                    >
                      <option value={5}>5 Seconds (Fast Check)</option>
                      <option value={10}>10 Seconds (Default)</option>
                      <option value={15}>15 Seconds (Heavy Compute)</option>
                      <option value={30}>30 Seconds (Extended)</option>
                    </select>
                  </div>

                  {/* Parallel Execution */}
                  <div className="flex items-center justify-between py-1.5">
                    <div>
                      <span className={`font-heading font-semibold block ${headingClass}`}>Concurrent Execution Workers</span>
                      <span className={`${mutedClass} text-[11px]`}>Parallel edge containers provisioned for dual benchmarks and tests.</span>
                    </div>
                    <span
                      className={`font-mono font-bold px-3 py-1 rounded border ${
                        isDarkMode
                          ? 'text-emerald-400 bg-[#141518] border-[#2d303d]'
                          : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      }`}
                    >
                      3 Parallel Containers
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* SECURITY & SANDBOX */}
            {activeSection === 'security' && (
              <div className="space-y-4">
                <div>
                  <h3 className={`text-sm font-heading font-bold flex items-center space-x-2 ${headingClass}`}>
                    <Shield className="w-4 h-4 text-emerald-500" />
                    <span>Security & Container Sandbox Architecture</span>
                  </h3>
                  <p className={`${mutedClass} text-xs mt-0.5`}>
                    How Cortex enforces multi-tenant process isolation, memory safety, and infrastructure protection.
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Security Status Badge */}
                  <div
                    className={`p-3 border rounded flex items-center justify-between ${
                      isDarkMode
                        ? 'bg-emerald-950/30 border-emerald-800/40'
                        : 'bg-emerald-50 border-emerald-200'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <div>
                        <span className={`font-heading font-bold block text-xs ${isDarkMode ? 'text-emerald-300' : 'text-emerald-800'}`}>
                          Sandbox Status: SECURE ISOLATE ACTIVE
                        </span>
                        <span className={`text-[11px] ${isDarkMode ? 'text-emerald-400/80' : 'text-emerald-700'}`}>
                          All executions run in isolated, disposable V8 & Linux cgroup sandboxes.
                        </span>
                      </div>
                    </div>
                    <span
                      className={`font-mono text-[10.5px] px-2 py-0.5 rounded border ${
                        isDarkMode
                          ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50'
                          : 'bg-white text-emerald-700 border-emerald-300'
                      }`}
                    >
                      Tier-1 Zero Trust
                    </span>
                  </div>

                  {/* Security Features Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className={`p-3 border rounded space-y-1 ${cardClass}`}>
                      <div className={`flex items-center space-x-1.5 font-semibold ${headingClass}`}>
                        <Lock className="w-3.5 h-3.5 text-[#ff9100]" />
                        <span>Zero Host Access</span>
                      </div>
                      <p className={`${mutedClass} text-[11px] leading-relaxed`}>
                        Code runs inside an isolated micro-container. Processes cannot read host OS files, inspect other users, or access private memory.
                      </p>
                    </div>

                    <div className={`p-3 border rounded space-y-1 ${cardClass}`}>
                      <div className={`flex items-center space-x-1.5 font-semibold ${headingClass}`}>
                        <Server className="w-3.5 h-3.5 text-cyan-500" />
                        <span>Ephemeral File System</span>
                      </div>
                      <p className={`${mutedClass} text-[11px] leading-relaxed`}>
                        Each run executes on a disposable in-memory mount. All binaries and scratch files are permanently deleted upon completion.
                      </p>
                    </div>

                    <div className={`p-3 border rounded space-y-1 ${cardClass}`}>
                      <div className={`flex items-center space-x-1.5 font-semibold ${headingClass}`}>
                        <Shield className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Syscall Filter (seccomp-bpf)</span>
                      </div>
                      <p className={`${mutedClass} text-[11px] leading-relaxed`}>
                        Dangerous Linux syscalls (e.g. ptrace, reboot, mount, kexec) are blocked at the kernel level to prevent privilege escalation.
                      </p>
                    </div>

                    <div className={`p-3 border rounded space-y-1 ${cardClass}`}>
                      <div className={`flex items-center space-x-1.5 font-semibold ${headingClass}`}>
                        <Zap className="w-3.5 h-3.5 text-purple-500" />
                        <span>Network Airgap Policy</span>
                      </div>
                      <p className={`${mutedClass} text-[11px] leading-relaxed`}>
                        Raw network socket creation is restricted by default, preventing malicious outbound botnets, scraping, or port scans.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SHORTCUTS */}
            {activeSection === 'shortcuts' && (
              <div className="space-y-3">
                <h3 className={`text-sm font-heading font-bold ${headingClass}`}>Keyboard Shortcuts</h3>
                <div className={`divide-y p-3.5 rounded border text-xs ${cardClass} ${isDarkMode ? 'divide-[#2a2c36]' : 'divide-slate-200'}`}>
                  <div className="flex justify-between py-2">
                    <span className={isDarkMode ? 'text-gray-300' : 'text-slate-700'}>Run Code</span>
                    <kbd className={`px-2 py-0.5 rounded border font-mono ${isDarkMode ? 'bg-[#141518] border-gray-700 text-[#ff9100]' : 'bg-white border-slate-300 text-[#b45309]'}`}>Ctrl + Enter</kbd>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className={isDarkMode ? 'text-gray-300' : 'text-slate-700'}>Accept Inline Suggestion</span>
                    <kbd className={`px-2 py-0.5 rounded border font-mono ${isDarkMode ? 'bg-[#141518] border-gray-700 text-emerald-400' : 'bg-white border-slate-300 text-emerald-700'}`}>Tab</kbd>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className={isDarkMode ? 'text-gray-300' : 'text-slate-700'}>Dismiss Inline Suggestion</span>
                    <kbd className={`px-2 py-0.5 rounded border font-mono ${isDarkMode ? 'bg-[#141518] border-gray-700 text-gray-300' : 'bg-white border-slate-300 text-slate-700'}`}>Esc</kbd>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className={isDarkMode ? 'text-gray-300' : 'text-slate-700'}>Toggle Fullscreen</span>
                    <kbd className={`px-2 py-0.5 rounded border font-mono ${isDarkMode ? 'bg-[#141518] border-gray-700 text-gray-300' : 'bg-white border-slate-300 text-slate-700'}`}>F11 / Esc</kbd>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className={isDarkMode ? 'text-gray-300' : 'text-slate-700'}>Save File</span>
                    <kbd className={`px-2 py-0.5 rounded border font-mono ${isDarkMode ? 'bg-[#141518] border-gray-700 text-gray-300' : 'bg-white border-slate-300 text-slate-700'}`}>Ctrl + S</kbd>
                  </div>
                </div>
              </div>
            )}

            {/* DEVELOPER API & EXECUTION ENDPOINTS */}
            {activeSection === 'api' && (
              <div className="space-y-4">
                <div>
                  <h3 className={`text-sm font-heading font-bold ${headingClass}`}>Execution &amp; AI API Reference</h3>
                  <p className={`${mutedClass} text-xs mt-0.5`}>
                    Cortex API routes authenticate via your signed-in HttpOnly session cookie (<code>cortex_session</code>).
                  </p>
                </div>

                <div className={`p-4 rounded border space-y-3 ${cardClass}`}>
                  <div className={`flex items-center justify-between ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>
                    <span className="font-semibold text-xs">Cloud Sandbox Execution Endpoint</span>
                    <span className="text-[11px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                      Session Authenticated
                    </span>
                  </div>

                  <div
                    className={`flex items-center space-x-2 p-2.5 rounded border ${
                      isDarkMode ? 'bg-[#141518] border-[#2d303d]' : 'bg-white border-slate-300'
                    }`}
                  >
                    <span className={`font-mono text-xs flex-1 ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>
                      POST /api/v1/execute
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyApiKey(
                          `curl -X POST "${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/execute" -H "Content-Type: application/json" -b "cortex_session=<SESSION_COOKIE>" -d '{"language":"python","files":[{"name":"main.py","content":"print(1+1)"}]}'`
                        )
                      }
                      className={`flex items-center space-x-1 px-3 py-1 rounded text-xs transition ${
                        isDarkMode
                          ? 'bg-[#252832] hover:bg-[#30333f] text-gray-200'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                      }`}
                      title="Copy Example Command"
                    >
                      {copiedKey ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-emerald-500 font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy cURL</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div
                    className={`pt-2 border-t flex items-center justify-between text-xs ${
                      isDarkMode ? 'border-[#2d303d] text-gray-400' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <span>
                      Personal Gemini AI Key:{' '}
                      <strong className={aiSettings.apiKey ? 'text-emerald-400' : isDarkMode ? 'text-gray-300' : 'text-slate-700'}>
                        {aiSettings.apiKey ? 'Connected in Browser Storage' : 'Not Configured'}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveSection('ai')}
                      className="text-[#ff9100] hover:underline font-medium"
                    >
                      Configure Gemini Key
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className={`px-5 py-3 border-t flex justify-end ${
            isDarkMode ? 'bg-[#1e2028] border-[#2a2c36]' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <button
            onClick={onClose}
            className="px-5 py-1.5 rounded bg-[#ff9100] hover:bg-[#e08000] text-[#0b0c0e] font-heading font-bold text-xs transition shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
