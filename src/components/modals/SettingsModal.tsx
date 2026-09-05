'use client';

import React, { useState } from 'react';
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
  AlertTriangle
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
}) => {
  const [activeSection, setActiveSection] = useState<
    'general' | 'editor' | 'appearance' | 'execution' | 'ai' | 'security' | 'shortcuts' | 'api'
  >('ai');

  const [keyInput, setKeyInput] = useState(aiSettings.apiKey || '');
  const [isValidating, setIsValidating] = useState(false);
  const [validationState, setValidationState] = useState<'idle' | 'valid' | 'invalid'>(aiSettings.apiKey ? 'valid' : 'idle');
  const [validationMsg, setValidationMsg] = useState(aiSettings.apiKey ? 'Your auto fix is connected and good to go!' : '');

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#18191e] border border-[#2f323e] rounded-lg shadow-2xl w-full max-w-3xl h-[600px] flex flex-col overflow-hidden text-xs">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-[#141518] border-b border-[#252830] flex items-center justify-between">
          <div className="flex items-center space-x-3 text-gray-200">
            <CortexLogo variant="header" size="sm" />
            <span className="text-gray-600 font-normal">|</span>
            <span className="font-semibold text-xs text-gray-300">Platform Preferences</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1.5 rounded hover:bg-[#252834] transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Left Sidebar + Right Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Settings Nav Sidebar */}
          <div className="w-48 bg-[#141518] border-r border-[#2a2c36] p-2 space-y-0.5">
            {[
              { id: 'ai', label: 'AI Assistance', icon: Sparkles },
              { id: 'editor', label: 'Editor & Fonts', icon: Sliders },
              { id: 'appearance', label: 'Theme & Style', icon: Palette },
              { id: 'execution', label: 'Execution Limits', icon: Cpu },
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
                      ? 'bg-[#252830] text-[#ff9100] font-semibold'
                      : 'text-gray-400 hover:bg-[#1c1d22] hover:text-gray-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Settings Section Panel */}
          <div className="flex-1 p-5 overflow-y-auto space-y-5 bg-[#18191e]">
            {/* AI ASSISTANCE */}
            {activeSection === 'ai' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-heading font-bold text-gray-200">AI Coding Assistant & Auto-Fix</h3>
                  <p className="text-gray-400 text-xs mt-0.5">Configure automated code generation, error inspection, and autonomous repair rules.</p>
                </div>

                <div className="space-y-3 bg-[#1e2028] p-4 rounded border border-[#2d303d]">
                  {/* Inline Code Suggestions Toggle (Default OFF) */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-heading font-semibold text-gray-200 block text-xs">Inline Code Suggestions (Ghost Text)</span>
                      <span className="text-gray-400 text-xs">Show intelligent completions as you type. Press Tab to accept, Esc to dismiss. (Default: OFF)</span>
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

                  <div className="flex items-center justify-between pt-2.5 border-t border-[#2a2c36]">
                    <div>
                      <span className="font-heading font-semibold text-gray-200 block text-xs">Auto Fix Errors</span>
                      <span className="text-gray-400 text-xs">Automatically generate fixes when compiler or runtime errors are detected.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={aiSettings.autoFixErrors}
                      onChange={(e) => onUpdateAISettings({ autoFixErrors: e.target.checked })}
                      className="w-4 h-4 rounded accent-[#ff9100] cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-[#2a2c36]">
                    <div>
                      <span className="font-heading font-semibold text-gray-200 block text-xs">Explain Errors in Plain English</span>
                      <span className="text-gray-400 text-xs">Translate compiler diagnostics into beginner-friendly explanations and comments.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={aiSettings.explainErrors}
                      onChange={(e) => onUpdateAISettings({ explainErrors: e.target.checked })}
                      className="w-4 h-4 rounded accent-[#ff9100] cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-[#2a2c36]">
                    <div>
                      <span className="font-heading font-semibold text-gray-200 block text-xs">Suggest Performance Optimizations</span>
                      <span className="text-gray-400 text-xs">Provide suggestions to reduce asymptotic complexity from O(n²) to O(n).</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={aiSettings.suggestImprovements}
                      onChange={(e) => onUpdateAISettings({ suggestImprovements: e.target.checked })}
                      className="w-4 h-4 rounded accent-[#ff9100] cursor-pointer"
                    />
                  </div>
                </div>

                {/* Google Gemini AI Integration (Free API Key) Instructions & Connect */}
                <div className="bg-[#151722] border border-[#2d303f] rounded-lg p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs flex items-center space-x-1.5 text-[#ff9100]">
                      <Sparkles className="w-4 h-4 text-[#ff9100]" />
                      <span>Google Gemini AI Integration (Free API Key)</span>
                    </span>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#ff9100] hover:text-[#e08000] text-[10.5px] flex items-center space-x-1 underline"
                    >
                      <span>Get free key from Google AI Studio</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>

                  <p className="text-gray-300 text-[11px] leading-relaxed">
                    To handle complex logic and algorithmic errors across all 16 languages beyond offline heuristics, you can connect your free Google Gemini API key:
                  </p>

                  <div className="text-gray-400 text-[10.5px] space-y-1.5 bg-[#0f1015] p-2.5 rounded border border-[#222430]">
                    <div className="flex items-start space-x-2">
                      <span className="text-[#ff9100] font-bold">1.</span>
                      <span>Click <strong className="text-white">"Connect Gemini AI (Free)"</strong> directly inside the Auto-Fix widget (or in Settings).</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="text-[#ff9100] font-bold">2.</span>
                      <span>Paste your free Google AI Studio key (<span className="font-mono text-[#ff9100]">AIzaSy...</span>) from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[#ff9100] underline hover:text-[#e08000]">Google AI Studio</a>.</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="text-[#ff9100] font-bold">3.</span>
                      <span>The key is saved locally in your browser (<span className="font-mono text-gray-300">localStorage</span>), activating Gemini 2.5 Flash for deep reasoning, automated code repairs, and instant diffs. When no key is entered, Cortex runs the deterministic offline engine.</span>
                    </div>
                  </div>

                  {/* Automated Input Box */}
                  <div className="pt-1 space-y-2">
                    <label className="text-gray-300 font-semibold block text-xs">Google Gemini API Key:</label>
                    <div className="flex items-center space-x-2">
                      <div className="relative flex-1">
                        <input
                          type="password"
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
                          className="w-full bg-[#0e0f14] text-gray-200 px-3 py-2 rounded border border-[#2d303d] focus:border-[#ff9100] focus:outline-none font-mono text-xs pr-8"
                        />
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
                      <div className="text-emerald-300 text-[11px] flex items-center space-x-1.5 bg-emerald-950/40 border border-emerald-600/40 px-2.5 py-1.5 rounded animate-in fade-in">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" />
                        <span className="font-medium">{validationMsg || 'Your auto fix is connected and good to go!'}</span>
                      </div>
                    )}

                    {/* Invalid Message */}
                    {validationState === 'invalid' && (
                      <div className="text-rose-400 text-[11px] flex items-center space-x-1.5 bg-rose-950/40 border border-rose-800/40 px-2.5 py-1.5 rounded">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-rose-400" />
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
                  <h3 className="text-sm font-heading font-bold text-gray-200">Editor Settings</h3>
                  <p className="text-gray-400 text-xs mt-0.5">Control typography, indentation, and Monaco code editing options.</p>
                </div>

                <div className="space-y-3 bg-[#1e2028] p-4 rounded border border-[#2d303d]">
                  {/* Inline Code Suggestions Toggle (Default OFF) */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-heading font-semibold text-gray-200 block text-xs">Inline Code Suggestions (Ghost Text)</span>
                      <span className="text-gray-400 text-xs">Show intelligent completions as you type. Press Tab to accept, Esc to dismiss. (Default: OFF)</span>
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

                  <div className="flex items-center justify-between pt-2.5 border-t border-[#2a2c36]">
                    <span className="font-heading font-semibold text-gray-200 text-xs">Font Size (px)</span>
                    <input
                      type="number"
                      min={10}
                      max={28}
                      value={fontSize}
                      onChange={(e) => onChangeFontSize(Number(e.target.value))}
                      className="w-20 bg-[#141518] text-gray-200 p-1.5 rounded border border-[#2d303d] text-center text-xs font-mono focus:outline-none focus:border-[#ff9100]"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-2.5 border-t border-[#2a2c36]">
                    <span className="font-heading font-semibold text-gray-200 text-xs">Tab Size</span>
                    <span className="text-gray-400 font-mono text-xs">4 Spaces</span>
                  </div>
                  <div className="flex items-center justify-between pt-2.5 border-t border-[#2a2c36]">
                    <span className="font-heading font-semibold text-gray-200 text-xs">Format On Paste</span>
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded accent-[#ff9100] cursor-pointer" />
                  </div>
                </div>
              </div>
            )}

            {/* APPEARANCE */}
            {activeSection === 'appearance' && (
              <div className="space-y-4">
                <h3 className="text-sm font-heading font-bold text-gray-200">Theme & UI Aesthetic</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'vs-dark', name: 'Cortex Dark (VS Code)', preview: '#1e1e1e' },
                    { id: 'light', name: 'Cortex Light', preview: '#f8fafc' },
                    { id: 'hc-black', name: 'High Contrast Black', preview: '#000000' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => onChangeTheme(t.id)}
                      className={`p-3 rounded border text-left flex items-center space-x-3 transition ${
                        theme === t.id ? 'border-[#ff9100] bg-[#ff9100]/10' : 'border-[#2d303d] bg-[#1e2028]'
                      }`}
                    >
                      <div className="w-6 h-6 rounded border border-gray-600" style={{ backgroundColor: t.preview }} />
                      <span className="font-heading font-semibold text-gray-200 text-xs">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* EXECUTION LIMITS */}
            {activeSection === 'execution' && (
              <div className="space-y-4">
                <h3 className="text-sm font-heading font-bold text-gray-200">Sandbox Resource Quotas</h3>
                <div className="space-y-2 text-gray-300 bg-[#1e2028] p-4 rounded border border-[#2d303d] text-xs">
                  <div className="flex justify-between py-1.5 border-b border-[#2a2c36]">
                    <span>Process Timeout</span>
                    <span className="font-mono text-[#ff9100]">10 Seconds</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#2a2c36]">
                    <span>Memory Limit</span>
                    <span className="font-mono text-gray-200">256 MB</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span>Concurrent Jobs</span>
                    <span className="font-mono text-emerald-400">3 Parallel Workers</span>
                  </div>
                </div>
              </div>
            )}

            {/* SHORTCUTS */}
            {activeSection === 'shortcuts' && (
              <div className="space-y-3">
                <h3 className="text-sm font-heading font-bold text-gray-200">Keyboard Shortcuts</h3>
                <div className="divide-y divide-[#2a2c36] bg-[#1e2028] p-3.5 rounded border border-[#2d303d] text-xs">
                  <div className="flex justify-between py-2">
                    <span className="text-gray-300">Run Code</span>
                    <kbd className="px-2 py-0.5 bg-[#141518] rounded border border-gray-700 text-[#ff9100] font-mono">Ctrl + Enter</kbd>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-300">Accept Inline Suggestion</span>
                    <kbd className="px-2 py-0.5 bg-[#141518] rounded border border-gray-700 text-emerald-400 font-mono">Tab</kbd>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-300">Dismiss Inline Suggestion</span>
                    <kbd className="px-2 py-0.5 bg-[#141518] rounded border border-gray-700 text-gray-300 font-mono">Esc</kbd>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-300">Toggle Fullscreen</span>
                    <kbd className="px-2 py-0.5 bg-[#141518] rounded border border-gray-700 text-gray-300 font-mono">F11 / Esc</kbd>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-300">Save File</span>
                    <kbd className="px-2 py-0.5 bg-[#141518] rounded border border-gray-700 text-gray-300 font-mono">Ctrl + S</kbd>
                  </div>
                </div>
              </div>
            )}

            {/* DEVELOPER API KEYS */}
            {activeSection === 'api' && (
              <div className="space-y-3">
                <h3 className="text-sm font-heading font-bold text-gray-200">Public Developer API Key</h3>
                <p className="text-gray-400 text-xs">Use your developer API key to trigger programmatic cloud code executions via <code>POST /api/v1/execute</code>.</p>
                <div className="flex items-center space-x-2 bg-[#141518] p-3 rounded border border-[#2d303d] font-mono text-[#ff9100] text-xs">
                  <span>cortex_live_pk_8f73a90c12e5429188a</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#1e2028] border-t border-[#2a2c36] flex justify-end">
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
