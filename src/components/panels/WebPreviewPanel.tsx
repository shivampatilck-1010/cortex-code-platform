'use client';

import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  RotateCw, 
  ExternalLink, 
  Smartphone, 
  Tablet, 
  Monitor, 
  ShieldCheck,
  Terminal
} from 'lucide-react';
import { ProjectFile } from '@/lib/execution/types';

interface WebPreviewPanelProps {
  files: ProjectFile[];
  isDarkMode?: boolean;
}

export const WebPreviewPanel: React.FC<WebPreviewPanelProps> = ({ files, isDarkMode = true }) => {
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [reloadKey, setReloadKey] = useState(0);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);

  // Find HTML, CSS, JS files
  const htmlFile = files.find((f) => f.name.endsWith('.html')) || files.find((f) => f.name === 'index.html');
  const cssFile = files.find((f) => f.name.endsWith('.css'));
  const jsFile = files.find((f) => f.name.endsWith('.js') || f.name.endsWith('.ts'));

  const bundledDoc = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          ${cssFile ? cssFile.content : 'body { font-family: sans-serif; padding: 1.5rem; background: #fafafa; color: #111; }'}
        </style>
      </head>
      <body>
        ${htmlFile ? htmlFile.content : `
          <div style="text-align: center; margin-top: 50px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #64748b;">
            <h3 style="color: #0f172a; margin-bottom: 8px;">Web Preview</h3>
            <p style="font-size: 14px; margin-bottom: 20px;">Add an <code>index.html</code> file to your workspace to preview custom HTML, CSS, and JavaScript.</p>
            <button id="btn" style="padding: 8px 16px; background: #ff9100; color: #0b0c0e; font-weight: 600; border: none; border-radius: 6px; cursor: pointer;">
              Test Click
            </button>
          </div>
        `}
        <script>
          (function() {
            const oldLog = console.log;
            console.log = function(...args) {
              window.parent.postMessage({ type: 'PREVIEW_CONSOLE', log: args.join(' ') }, '*');
              oldLog.apply(console, args);
            };
          })();
          ${jsFile ? jsFile.content : `
            document.getElementById('btn')?.addEventListener('click', () => {
              console.log('Test button clicked at ' + new Date().toLocaleTimeString());
            });
          `}
        </script>
      </body>
    </html>
  `;

  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      if (e.data?.type === 'PREVIEW_CONSOLE') {
        setConsoleLogs((prev) => [...prev.slice(-20), `[Browser Console]: ${e.data.log}`]);
      }
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, []);

  const handleOpenInNewTab = () => {
    if (typeof window === 'undefined') return;
    const blob = new Blob([bundledDoc], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  return (
    <div className={`h-full flex flex-col select-none overflow-hidden transition-colors duration-200 ${
      isDarkMode ? 'bg-[#121316]' : 'bg-slate-100'
    }`}>
      {/* Browser Bar */}
      <div className={`px-3 py-1.5 border-b flex items-center justify-between text-xs font-mono transition-colors duration-200 ${
        isDarkMode ? 'bg-[#18191d] border-[#262832]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className={`p-1 rounded transition ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
            title="Reload Preview"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <div className={`flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] w-64 truncate border ${
            isDarkMode ? 'bg-[#121316] border-[#2d303b] text-gray-300' : 'bg-slate-50 border-slate-200 text-slate-700 shadow-inner'
          }`}>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
            <span className="truncate">http://localhost:3000/preview</span>
          </div>
        </div>

        {/* Viewport Width Controls */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setDevice('desktop')}
            className={`p-1 rounded transition ${
              device === 'desktop'
                ? isDarkMode ? 'bg-[#252830] text-[#ff9100]' : 'bg-slate-200 text-[#ff9100] shadow-sm'
                : isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-slate-500 hover:text-slate-900'
            }`}
            title="Desktop View (100%)"
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setDevice('tablet')}
            className={`p-1 rounded transition ${
              device === 'tablet'
                ? isDarkMode ? 'bg-[#252830] text-[#ff9100]' : 'bg-slate-200 text-[#ff9100] shadow-sm'
                : isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-slate-500 hover:text-slate-900'
            }`}
            title="Tablet View (768px)"
          >
            <Tablet className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setDevice('mobile')}
            className={`p-1 rounded transition ${
              device === 'mobile'
                ? isDarkMode ? 'bg-[#252830] text-[#ff9100]' : 'bg-slate-200 text-[#ff9100] shadow-sm'
                : isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-slate-500 hover:text-slate-900'
            }`}
            title="Mobile View (375px)"
          >
            <Smartphone className="w-3.5 h-3.5" />
          </button>
          <div className={`h-3.5 w-[1px] mx-1 ${isDarkMode ? 'bg-[#2d303b]' : 'bg-slate-200'}`} />
          <button
            onClick={handleOpenInNewTab}
            className={`p-1 rounded transition ${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-[#252830]' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
            title="Open Live Preview in New Window"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Frame Container */}
      <div className={`flex-1 flex justify-center items-center overflow-auto p-2 transition-colors duration-200 ${
        isDarkMode ? 'bg-[#1e2025]' : 'bg-slate-200/60'
      }`}>
        <div
          className={`h-full bg-white transition-all shadow-xl rounded overflow-hidden ${
            device === 'desktop' ? 'w-full' : device === 'tablet' ? 'w-[768px]' : 'w-[375px]'
          }`}
        >
          <iframe
            key={reloadKey}
            title="Live Web Application Sandbox"
            srcDoc={bundledDoc}
            sandbox="allow-scripts allow-modals"
            className="w-full h-full border-0"
          />
        </div>
      </div>

      {/* Console Drawer */}
      {consoleLogs.length > 0 && (
        <div className={`h-20 border-t p-2 text-[11px] font-mono overflow-y-auto transition-colors duration-200 ${
          isDarkMode ? 'bg-[#121316] border-[#262832] text-gray-300' : 'bg-white border-slate-200 text-slate-700'
        }`}>
          {consoleLogs.map((log, i) => (
            <div key={i} className="leading-tight">{log}</div>
          ))}
        </div>
      )}
    </div>
  );
};
