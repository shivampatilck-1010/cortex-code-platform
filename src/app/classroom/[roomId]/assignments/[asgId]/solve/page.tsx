'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Send, CheckCircle, AlertTriangle, RefreshCw, ArrowLeft, Terminal } from 'lucide-react';
import { MonacoCodeEditor } from '@/components/editor/MonacoCodeEditor';
import { OutputPanel } from '@/components/panels/OutputPanel';
import { ProjectFile, ExecutionResult } from '@/lib/execution/types';
import { Assignment, SubmissionTestCaseResult } from '@/lib/classroom/models';
import Markdown from 'react-markdown';
import { CortexLogo } from '@/components/brand/CortexLogo';

export default function SolveAssignmentPage({
  params
}: {
  params: Promise<{ roomId: string; asgId: string }>;
}) {
  const router = useRouter();
  const [roomId, setRoomId] = useState('');
  const [asgId, setAsgId] = useState('');
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [activeFileId, setActiveFileId] = useState('main');
  
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [execResult, setExecResult] = useState<ExecutionResult | null>(null);
  const [testResults, setTestResults] = useState<SubmissionTestCaseResult[] | null>(null);
  const [submissionScore, setSubmissionScore] = useState<{score: number, max: number} | null>(null);
  
  const [activeTab, setActiveTab] = useState<'problem' | 'results'>('problem');

  useEffect(() => {
    params.then(p => {
      setRoomId(p.roomId);
      setAsgId(p.asgId);
    });
  }, [params]);

  useEffect(() => {
    if (!roomId || !asgId) return;

    const fetchAsg = async () => {
      try {
        const res = await fetch(`/api/v1/classrooms/${roomId}/assignments/${asgId}`);
        const data = await res.json();
        if (data.assignment) {
          setAssignment(data.assignment);
          setFiles([
            {
              id: 'main',
              name: `main.${data.assignment.language === 'python' ? 'py' : data.assignment.language === 'cpp' ? 'cpp' : 'ts'}`,
              path: `/${data.assignment.language === 'python' ? 'main.py' : 'main.cpp'}`,
              content: data.assignment.starterCode || ''
            }
          ]);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchAsg();
  }, [roomId, asgId]);

  const handleRunCode = async () => {
    if (!assignment) return;
    setIsRunning(true);
    setExecResult(null);
    setTestResults(null);
    setActiveTab('results');
    
    try {
      const res = await fetch('/api/v1/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: assignment.language,
          code: files[0].content,
          files,
        })
      });
      const data = await res.json();
      setExecResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunTests = async () => {
    // Similar to handleRunCode, but loop through visible tests?
    // Actually we can just run the public test API or run submit directly.
    // The requirement says "TEST runs the visible tests... Show Input/Expected/Actual".
    // I can do it client-side by calling /api/v1/execute in a loop for each visible test.
    if (!assignment) return;
    setIsRunning(true);
    setExecResult(null);
    setTestResults(null);
    setActiveTab('results');
    
    try {
      const publicTests = assignment.testCases.filter(t => t.visibility !== 'hidden');
      const results: SubmissionTestCaseResult[] = [];
      
      for (const tc of publicTests) {
        const res = await fetch('/api/v1/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            language: assignment.language,
            code: files[0].content,
            stdin: tc.input,
            files,
          })
        });
        const execData = await res.json();
        
        const normActual = (execData.stdout || '').trim();
        const normExpected = (tc.expectedOutput || '').trim();
        const isMatch = normActual === normExpected;
        
        results.push({
          testCaseId: tc.id,
          status: isMatch ? 'passed' : 'failed',
          visibility: 'public',
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: execData.stdout,
          error: execData.stderr,
          executionTimeMs: execData.execution_time || 0,
          memoryUsageMb: execData.memory || 0,
          score: isMatch ? tc.weight : 0,
          maxScore: tc.weight
        });
      }
      setTestResults(results);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!assignment) return;
    setIsSubmitting(true);
    setActiveTab('results');
    
    try {
      const res = await fetch(`/api/v1/classrooms/${roomId}/assignments/${asgId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: files[0].content,
          language: assignment.language,
        })
      });
      const data = await res.json();
      if (data.success) {
        setTestResults(data.testOutcome.results);
        setSubmissionScore({
          score: data.submission.score,
          max: data.submission.maxScore
        });
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!assignment) {
    return <div className="min-h-screen bg-[#0b0c0e] flex items-center justify-center text-white">Loading assignment workspace...</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-[#0b0c0e] text-white overflow-hidden">
      {/* Header */}
      <header className="h-14 shrink-0 bg-[#0d0e12] border-b border-[#252830] px-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => router.push(`/classroom`)} className="p-2 hover:bg-[#1e2026] rounded transition">
            <ArrowLeft className="w-4 h-4 text-gray-400" />
          </button>
          <div className="flex items-center space-x-2">
            <CortexLogo size="sm" variant="icon" />
            <h1 className="text-sm font-bold truncate max-w-[200px]">{assignment.title}</h1>
            <span className="text-[10px] px-2 py-0.5 rounded bg-[#1e2026] text-gray-400 border border-[#252830]">
              {assignment.difficulty}
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button 
            onClick={handleRunCode}
            disabled={isRunning || isSubmitting}
            className="px-3.5 py-1.5 bg-[#1e2026] hover:bg-[#252830] text-gray-300 rounded text-xs font-bold flex items-center space-x-1.5 transition active:scale-95 border border-[#2d313f]"
          >
            {isRunning && !testResults ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Terminal className="w-3.5 h-3.5" />}
            <span>Run</span>
          </button>
          <button 
            onClick={handleRunTests}
            disabled={isRunning || isSubmitting}
            className="px-3.5 py-1.5 bg-[#1e2026] hover:bg-[#252830] text-gray-300 rounded text-xs font-bold flex items-center space-x-1.5 transition active:scale-95 border border-[#2d313f]"
          >
            {isRunning && testResults ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span>Test Visible</span>
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isRunning || isSubmitting}
            className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black rounded text-xs font-bold flex items-center space-x-1.5 transition active:scale-95 shadow"
          >
            {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>Submit</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane - Problem / Results */}
        <div className="w-[45%] flex flex-col border-r border-[#252830] bg-[#13141a]">
          <div className="flex items-center border-b border-[#252830] bg-[#0d0e12]">
            <button 
              onClick={() => setActiveTab('problem')}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition ${activeTab === 'problem' ? 'border-[#ff9100] text-[#ff9100]' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
            >
              Problem Statement
            </button>
            <button 
              onClick={() => setActiveTab('results')}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition ${activeTab === 'results' ? 'border-[#ff9100] text-[#ff9100]' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
            >
              Test Results
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {activeTab === 'problem' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold mb-2">{assignment.title}</h2>
                  <div className="markdown-body prose prose-invert max-w-none text-sm text-gray-300">
                    <Markdown>{assignment.description}</Markdown>
                  </div>
                </div>
                <div className="p-4 bg-[#1e2026] rounded-xl border border-[#2d313f]">
                  <h3 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Instructions & Constraints</h3>
                  <div className="text-sm font-mono text-emerald-400">
                    <Markdown>{assignment.instructions}</Markdown>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'results' && (
              <div className="space-y-4">
                {submissionScore && (
                  <div className="p-4 bg-emerald-950/30 border border-emerald-900 rounded-xl flex items-center justify-between">
                    <div>
                      <h3 className="text-emerald-400 font-bold">Submission Successful</h3>
                      <p className="text-xs text-gray-400">Your solution was auto-graded.</p>
                    </div>
                    <div className="text-2xl font-black text-emerald-400">
                      {submissionScore.score} / {submissionScore.max}
                    </div>
                  </div>
                )}
                
                {!testResults && !execResult && !isRunning && !isSubmitting && (
                  <div className="text-center py-10 text-gray-500 text-sm">
                    Run your code or test cases to see results here.
                  </div>
                )}
                
                {isRunning || isSubmitting ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400 space-y-4">
                    <RefreshCw className="w-8 h-8 animate-spin text-[#ff9100]" />
                    <span className="text-sm">Executing securely...</span>
                  </div>
                ) : testResults ? (
                  <div className="space-y-3">
                    <h3 className="font-bold text-sm mb-4">Test Cases</h3>
                    {testResults.map((tr, i) => (
                      <div key={tr.testCaseId || i} className={`p-3 rounded-lg border text-sm ${tr.status === 'passed' ? 'bg-emerald-950/20 border-emerald-900' : 'bg-rose-950/20 border-rose-900'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold flex items-center space-x-2">
                            {tr.status === 'passed' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-rose-500" />}
                            <span>Test Case {i + 1} {tr.visibility === 'hidden' && '(Hidden)'}</span>
                          </span>
                          <span className="text-xs text-gray-500">{tr.executionTimeMs}ms • {tr.memoryUsageMb}MB</span>
                        </div>
                        
                        {tr.visibility === 'public' && (
                          <div className="space-y-2 mt-3 font-mono text-xs">
                            <div>
                              <span className="text-gray-500">Input:</span>
                              <div className="bg-[#0b0c0e] p-2 rounded text-gray-300 mt-1 whitespace-pre-wrap">{tr.input}</div>
                            </div>
                            <div>
                              <span className="text-gray-500">Expected:</span>
                              <div className="bg-[#0b0c0e] p-2 rounded text-gray-300 mt-1 whitespace-pre-wrap">{tr.expectedOutput}</div>
                            </div>
                            <div>
                              <span className="text-gray-500">Actual:</span>
                              <div className="bg-[#0b0c0e] p-2 rounded text-gray-300 mt-1 whitespace-pre-wrap">{tr.actualOutput || (tr.error ? 'Error occurred' : '(No output)')}</div>
                            </div>
                            {tr.error && (
                              <div className="mt-2 text-rose-400 p-2 bg-rose-950/30 rounded border border-rose-900/50">
                                {tr.error}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : execResult && (
                  <div className="space-y-3">
                    <h3 className="font-bold text-sm mb-4">Run Output</h3>
                    <div className="font-mono text-xs">
                      {execResult.stdout && (
                        <div className="p-3 bg-[#0b0c0e] rounded-lg text-gray-300 whitespace-pre-wrap border border-[#252830]">
                          {execResult.stdout}
                        </div>
                      )}
                      {execResult.stderr && (
                        <div className="p-3 mt-2 bg-rose-950/20 rounded-lg text-rose-400 whitespace-pre-wrap border border-rose-900/50">
                          {execResult.stderr}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Pane - IDE */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0d0e12]">
          <div className="flex-1 overflow-hidden relative">
            <MonacoCodeEditor
              files={files}
              activeFileId={activeFileId}
              onSelectFile={setActiveFileId}
              onCloseFile={() => {}}
              onNewFile={() => {}}
              onContentChange={(val) => {
                setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, content: val } : f));
              }}
              language={assignment.language === 'cpp' ? 'cpp' : assignment.language === 'python' ? 'python' : 'typescript'}
              theme="vs-dark"
              fontSize={14}
              breakpoints={[]}
              onToggleBreakpoint={() => {}}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
