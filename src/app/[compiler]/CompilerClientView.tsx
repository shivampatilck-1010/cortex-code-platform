'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Play, 
  Clock, 
  Cpu, 
  Zap, 
  HelpCircle, 
  Terminal as TermIcon,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { LanguageConfig } from '@/config/languages';
import { executeInCloudSandbox } from '@/lib/execution/engine';
import { ExecutionResult } from '@/lib/execution/types';
import { CortexLogo } from '@/components/brand/CortexLogo';
import { LanguageSeoConfig } from '@/config/seo';

interface CompilerClientViewProps {
  langConfig: LanguageConfig;
  seoData: LanguageSeoConfig;
}

export const CompilerClientView: React.FC<CompilerClientViewProps> = ({
  langConfig,
  seoData,
}) => {
  const [code, setCode] = useState(seoData.sampleCode || langConfig.starterCode);
  const [stdin, setStdin] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);

  const handleRun = async () => {
    setIsRunning(true);
    try {
      const res = await executeInCloudSandbox({
        language: langConfig.id,
        files: [
          {
            id: 'main',
            name: langConfig.defaultFileName,
            path: `/${langConfig.defaultFileName}`,
            content: code,
          },
        ],
        stdin,
      });
      setResult(res);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c0e] text-gray-100 font-sans select-none flex flex-col">
      {/* Top Navigation */}
      <header className="h-14 bg-[#101114] border-b border-[#1f2024] px-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link href="/" className="flex items-center group transition" title="Cortex — Code Beyond Limits">
            <CortexLogo variant="header" size="sm" />
          </Link>
          <div className="h-4 w-[1px] bg-[#2d303b]" />
          <span className="font-heading font-semibold text-xs text-gray-300">
            Online {langConfig.name} Compiler & IDE
          </span>
        </div>
        <Link
          href="/"
          className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-[#ff9100] hover:bg-[#e08000] text-black rounded text-xs font-heading font-bold shadow transition active:scale-95"
        >
          <span>Open Full Cloud IDE</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Page Title & Intro */}
        <div>
          <div className="flex items-center space-x-2 mb-1.5">
            <span className="px-2 py-0.5 rounded bg-[#ff9100]/10 text-[#ff9100] font-mono text-[11px] font-semibold border border-[#ff9100]/20">
              {seoData.runtimeVersion}
            </span>
            <span className="text-gray-500 text-xs">•</span>
            <span className="text-emerald-400 text-xs font-mono font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" /> Cloud Sandbox Active
            </span>
          </div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-white tracking-tight">
            Online {langConfig.name} Compiler & Code Runner
          </h1>
          <p className="text-gray-400 text-xs md:text-sm mt-1.5 leading-relaxed max-w-4xl">
            {seoData.description}
          </p>
        </div>

        {/* Interactive Editor & Terminal Sandbox */}
        <div className="bg-[#141518] border border-[#20222a] rounded-xl overflow-hidden shadow-2xl flex flex-col h-[560px]">
          {/* Editor Header Toolbar */}
          <div className="px-4 py-2 bg-[#101114] border-b border-[#1f2024] flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-mono text-gray-300">
              <span className="text-[#ff9100] font-bold">{langConfig.defaultFileName}</span>
              <span className="text-gray-600">|</span>
              <span className="text-gray-400">{langConfig.compiler}</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleRun}
                disabled={isRunning}
                className={`flex items-center space-x-1.5 px-4 py-1.5 rounded text-xs font-heading font-bold shadow transition ${
                  isRunning
                    ? 'bg-emerald-800 text-emerald-200 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
                }`}
              >
                <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : 'fill-current'}`} />
                <span>{isRunning ? 'Compiling & Running...' : `Run ${langConfig.name} (Ctrl+Enter)`}</span>
              </button>
            </div>
          </div>

          {/* Split View: Editor and Output */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Monaco Editor Pane */}
            <div className="w-full md:w-1/2 h-1/2 md:h-full border-b md:border-b-0 md:border-r border-[#1f2024]">
              <Editor
                height="100%"
                language={langConfig.monacoLang}
                value={code}
                theme="vs-dark"
                onChange={(val) => setCode(val || '')}
                options={{
                  fontSize: 14,
                  minimap: { enabled: false },
                  automaticLayout: true,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  fontFamily: "'JetBrains Mono', 'Consolas', monospace",
                }}
              />
            </div>

            {/* Output & Terminal Pane */}
            <div className="w-full md:w-1/2 h-1/2 md:h-full bg-[#101114] flex flex-col text-xs font-mono p-4 space-y-3 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-[#1f2024] pb-2">
                <span className="font-heading font-semibold text-gray-200 flex items-center gap-1.5">
                  <TermIcon className="w-3.5 h-3.5 text-[#ff9100]" /> Terminal Output
                </span>
                {result && (
                  <div className="flex items-center space-x-3 text-gray-400 text-[11px]">
                    <span className="flex items-center space-x-1 text-[#ff9100]">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{result.executionTimeMs} ms</span>
                    </span>
                    <span className="flex items-center space-x-1 text-purple-400">
                      <Cpu className="w-3.5 h-3.5" />
                      <span>{result.memoryUsageMb} MB</span>
                    </span>
                  </div>
                )}
              </div>

              {isRunning ? (
                <div className="flex items-center space-x-2 text-[#ff9100] py-4">
                  <div className="w-4 h-4 border-2 border-[#ff9100] border-t-transparent rounded-full animate-spin" />
                  <span>Compiling and executing in cloud sandbox...</span>
                </div>
              ) : result ? (
                <div className="space-y-2 flex-1">
                  {result.stdout && (
                    <pre className="text-gray-200 bg-[#141518] p-3 rounded-lg border border-[#1f2024] whitespace-pre-wrap leading-relaxed">
                      {result.stdout}
                    </pre>
                  )}
                  {result.stderr && (
                    <pre className="text-rose-400 bg-rose-950/20 p-3 rounded-lg border border-rose-900/40 whitespace-pre-wrap leading-relaxed">
                      {result.stderr}
                    </pre>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 space-y-1 py-12">
                  <Play className="w-6 h-6 text-gray-600 mb-1" />
                  <p>Click "Run {langConfig.name}" or press Ctrl+Enter to execute.</p>
                </div>
              )}

              {/* Stdin Drawer */}
              <div className="pt-2 border-t border-[#1f2024]">
                <label className="text-gray-400 text-[11px] block mb-1 font-sans font-medium">
                  Custom Input (stdin):
                </label>
                <input
                  type="text"
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  placeholder="Enter input to pass to standard input..."
                  className="w-full px-2.5 py-1 bg-[#141518] border border-[#22242c] focus:border-[#ff9100] rounded text-xs text-white placeholder-gray-600 outline-none font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Feature Highlights & Specifications */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 text-xs">
          <div className="p-5 bg-[#141518] border border-[#1f2024] rounded-xl space-y-3 leading-relaxed">
            <h2 className="font-heading text-sm font-bold text-white flex items-center space-x-2">
              <Zap className="w-4 h-4 text-[#ff9100]" />
              <span>Features of Cortex Online {langConfig.name} Compiler</span>
            </h2>
            <ul className="space-y-2 text-gray-300">
              {seoData.features.map((feat, idx) => (
                <li key={idx} className="flex items-start space-x-2">
                  <span className="text-[#ff9100] mt-0.5">•</span>
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-5 bg-[#141518] border border-[#1f2024] rounded-xl space-y-3 leading-relaxed">
            <h2 className="font-heading text-sm font-bold text-white flex items-center space-x-2">
              <HelpCircle className="w-4 h-4 text-amber-400" />
              <span>Frequently Asked Questions</span>
            </h2>
            <div className="space-y-3">
              {seoData.faqs.map((faq, idx) => (
                <div key={idx}>
                  <strong className="text-gray-200 block text-xs">{faq.question}</strong>
                  <p className="text-gray-400 mt-0.5">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
