'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { 
  Trophy, 
  Play, 
  Send, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  ArrowLeft,
  Clock,
  Cpu
} from 'lucide-react';
import confetti from 'canvas-confetti';
import Editor from '@monaco-editor/react';
import { CHALLENGES } from '@/lib/challenges/challenges-data';
import { runTestCases } from '@/lib/execution/engine';
import { TestCase } from '@/lib/execution/types';

export default function ChallengeSolverPage() {
  const params = useParams();
  const challengeId = (params?.id as string) || 'two-sum';
  const challenge = CHALLENGES.find((c) => c.id === challengeId) || CHALLENGES[0];

  const [language, setLanguage] = useState<'python' | 'cpp' | 'javascript'>('python');
  const [code, setCode] = useState(challenge.starterTemplates.python || '');
  const [activeTab, setActiveTab] = useState<'desc' | 'hints'>('desc');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testResults, setTestResults] = useState<TestCase[]>(challenge.testCases);
  const [submissionVerdict, setSubmissionVerdict] = useState<string | null>(null);

  const handleLanguageChange = (newLang: 'python' | 'cpp' | 'javascript') => {
    setLanguage(newLang);
    setCode(challenge.starterTemplates[newLang] || '');
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmissionVerdict(null);

    try {
      const { testCases: evaluated, passedCount, totalCount } = await runTestCases(
        {
          language,
          files: [{ id: 'sol', name: `solution.${language === 'python' ? 'py' : language === 'cpp' ? 'cpp' : 'js'}`, path: '/sol', content: code }],
        },
        challenge.testCases
      );

      setTestResults(evaluated);

      if (passedCount === totalCount) {
        setSubmissionVerdict(`Accepted! (${passedCount}/${totalCount} Test Cases Passed)`);
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
      } else {
        setSubmissionVerdict(`Failed: ${passedCount}/${totalCount} Test Cases Passed`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#121316] text-gray-100 font-sans select-none overflow-hidden">
      {/* Header */}
      <header className="h-12 bg-[#18191c] border-b border-[#2a2c33] px-4 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-3">
          <Link href="/challenges" className="flex items-center space-x-1.5 text-gray-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" />
            <span>Problem Set</span>
          </Link>
          <div className="h-4 w-[1px] bg-[#32353e]" />
          <span className="font-bold text-white text-sm">{challenge.title}</span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
              challenge.difficulty === 'Easy'
                ? 'text-emerald-400 bg-emerald-950/40'
                : 'text-yellow-400 bg-yellow-950/40'
            }`}
          >
            {challenge.difficulty}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2">
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value as any)}
            className="bg-[#22242a] text-gray-200 border border-[#373a45] rounded px-2.5 py-1 text-xs font-mono cursor-pointer focus:outline-none"
          >
            <option value="python">Python 3.12</option>
            <option value="cpp">C++20 (G++ 13)</option>
            <option value="javascript">JavaScript (Node 20)</option>
          </select>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`flex items-center space-x-1.5 px-4 py-1 rounded text-xs font-semibold shadow transition ${
              isSubmitting ? 'bg-cyan-800 text-cyan-200 cursor-not-allowed' : 'bg-cyan-600 hover:bg-cyan-500 text-white'
            }`}
          >
            <Send className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
            <span>{isSubmitting ? 'Evaluating Sandbox...' : 'Submit Solution'}</span>
          </button>
        </div>
      </header>

      {/* 2-Pane Split: Left Problem Description | Right Monaco Code Editor & Evaluation */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Problem Info */}
        <div className="w-1/2 bg-[#18191d] border-r border-[#2a2c33] flex flex-col overflow-hidden text-xs">
          <div className="flex border-b border-[#262832] bg-[#141518]">
            <button
              onClick={() => setActiveTab('desc')}
              className={`py-2 px-4 border-b-2 font-semibold ${
                activeTab === 'desc' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-gray-400'
              }`}
            >
              Description
            </button>
            <button
              onClick={() => setActiveTab('hints')}
              className={`py-2 px-4 border-b-2 font-semibold ${
                activeTab === 'hints' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-gray-400'
              }`}
            >
              Hints ({challenge.hints.length})
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 leading-relaxed select-text">
            {activeTab === 'desc' && (
              <>
                <p className="text-gray-300 whitespace-pre-wrap">{challenge.description}</p>

                {/* Examples */}
                <div className="space-y-3">
                  <span className="font-bold text-gray-200 block">Examples:</span>
                  {challenge.examples.map((ex, idx) => (
                    <div key={idx} className="p-3 bg-[#131417] rounded border border-[#252832] space-y-1 font-mono">
                      <div>
                        <span className="text-gray-500">Input: </span>
                        <span className="text-cyan-300">{ex.input}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Output: </span>
                        <span className="text-emerald-300">{ex.output}</span>
                      </div>
                      {ex.explanation && (
                        <div className="text-gray-400 text-[11px] font-sans pt-1">{ex.explanation}</div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Constraints */}
                <div className="space-y-1">
                  <span className="font-bold text-gray-200 block">Constraints:</span>
                  <ul className="list-disc list-inside text-gray-400 space-y-0.5 font-mono text-[11px]">
                    {challenge.constraints.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {activeTab === 'hints' && (
              <div className="space-y-3">
                {challenge.hints.map((hint, i) => (
                  <div key={i} className="p-3 bg-[#131417] rounded border border-[#252832] space-y-1">
                    <span className="font-bold text-yellow-400 block">Hint {i + 1}:</span>
                    <p className="text-gray-300">{hint}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Code Editor & Test Case Evaluation */}
        <div className="w-1/2 flex flex-col overflow-hidden bg-[#1e1e1e]">
          {/* Editor Container */}
          <div className="flex-1 overflow-hidden relative">
            <Editor
              height="100%"
              language={language === 'python' ? 'python' : language === 'cpp' ? 'cpp' : 'javascript'}
              value={code}
              theme="vs-dark"
              onChange={(val) => setCode(val || '')}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                lineNumbersMinChars: 3,
                automaticLayout: true,
                scrollBeyondLastLine: false,
              }}
            />
          </div>

          {/* Test Case Evaluation Results Drawer */}
          <div className="h-56 bg-[#141518] border-t border-[#2a2c33] flex flex-col overflow-hidden text-xs font-mono">
            <div className="px-3 py-2 bg-[#18191d] border-b border-[#262832] flex items-center justify-between">
              <span className="font-semibold text-gray-300">Sandbox Test Runner</span>
              {submissionVerdict && (
                <span
                  className={`font-bold ${
                    submissionVerdict.startsWith('Accepted') ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {submissionVerdict}
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {testResults.map((tc) => (
                <div
                  key={tc.id}
                  className={`p-2 rounded border flex items-center justify-between ${
                    tc.passed === true
                      ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                      : tc.passed === false
                      ? 'bg-rose-950/20 border-rose-800/40 text-rose-300'
                      : 'bg-[#18191d] border-[#262832] text-gray-400'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    {tc.passed === true ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : tc.passed === false ? (
                      <XCircle className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <span className="w-3 h-3 rounded-full border border-gray-600 inline-block" />
                    )}
                    <span className="font-semibold">{tc.name}</span>
                    {tc.isHidden && <span className="text-[10px] text-gray-500">(Hidden Case)</span>}
                  </div>

                  {tc.timeMs !== undefined && <span>{tc.timeMs} ms</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
