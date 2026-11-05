'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Play, Send, CheckCircle, AlertTriangle, RefreshCw, ArrowLeft, 
  Terminal, Lock, Shield, ChevronUp, ChevronDown, Copy, Check, FileCode, Award
} from 'lucide-react';
import { MonacoCodeEditor } from '@/components/editor/MonacoCodeEditor';
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
  const codeRef = useRef<string>('');
  const [activeFileId, setActiveFileId] = useState('main');
  
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [execResult, setExecResult] = useState<ExecutionResult | null>(null);
  const [testResults, setTestResults] = useState<SubmissionTestCaseResult[] | null>(null);
  const [submissionScore, setSubmissionScore] = useState<{score: number, max: number} | null>(null);
  
  const [activeTab, setActiveTab] = useState<'problem' | 'testcases' | 'results'>('problem');
  const [consoleTab, setConsoleTab] = useState<'testcases' | 'terminal'>('testcases');
  const [selectedCaseIdx, setSelectedCaseIdx] = useState(0);
  const [isConsoleOpen, setIsConsoleOpen] = useState(true);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

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
          const starter = data.assignment.starterCode || (data.assignment as any).startercode || (data.assignment as any).starter_code || '';
          codeRef.current = starter;
          const ext = data.assignment.language === 'python' ? 'py' : data.assignment.language === 'cpp' ? 'cpp' : 'ts';
          setFiles([
            {
              id: 'main',
              name: `main.${ext}`,
              path: `/main.${ext}`,
              content: starter
            }
          ]);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchAsg();
  }, [roomId, asgId]);

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleRunCode = async () => {
    if (!assignment) return;
    setIsRunning(true);
    setExecResult(null);
    setTestResults(null);
    setConsoleTab('terminal');
    setIsConsoleOpen(true);
    
    try {
      const currentCode = codeRef.current || files[0]?.content || '';
      const ext = assignment.language === 'python' ? 'py' : assignment.language === 'cpp' ? 'cpp' : 'ts';
      const res = await fetch('/api/v1/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: assignment.language,
          code: currentCode,
          files: [{ id: 'main', name: `main.${ext}`, path: `/main.${ext}`, content: currentCode }],
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
    if (!assignment) return;
    setIsRunning(true);
    setExecResult(null);
    setTestResults(null);
    setConsoleTab('terminal');
    setIsConsoleOpen(true);
    
    try {
      const publicTests = (assignment.testCases || []).filter(t => t.visibility !== 'hidden' && !(t as any).isHidden);
      const results: SubmissionTestCaseResult[] = [];
      
      // Auto-wrap python solutions if student defined the function without standard runner
      let codeToRun = codeRef.current || files[0]?.content || '';
      if (assignment.language === 'python' || assignment.language === 'py') {
        if (codeToRun.includes('def two_sum(') && !codeToRun.includes('sys.stdin.read')) {
          codeToRun = `${codeToRun}\n\nif __name__ == '__main__':\n    import sys, json\n    _raw = sys.stdin.read().strip()\n    if _raw:\n        try:\n            if '],' in _raw:\n                _parts = _raw.split('],')\n                _nums = json.loads(_parts[0].strip() + ']')\n                _target = int(_parts[1].strip())\n                print(json.dumps(two_sum(_nums, _target)))\n            else:\n                _data = json.loads(_raw)\n                print(json.dumps(two_sum(_data[0], _data[1])))\n        except Exception:\n            pass\n`;
        } else if (codeToRun.includes('def is_valid_bst(') && !codeToRun.includes('sys.stdin.read')) {
          codeToRun = `${codeToRun}\n\nif __name__ == '__main__':\n    import sys, json\n    _raw = sys.stdin.read().strip()\n    if _raw:\n        try:\n            _vals = json.loads(_raw)\n            def _build_tree(nodes):\n                if not nodes or nodes[0] is None:\n                    return None\n                root = TreeNode(nodes[0])\n                queue = [root]\n                i = 1\n                while queue and i < len(nodes):\n                    curr = queue.pop(0)\n                    if i < len(nodes) and nodes[i] is not None:\n                        curr.left = TreeNode(nodes[i])\n                        queue.append(curr.left)\n                    i += 1\n                    if i < len(nodes) and nodes[i] is not None:\n                        curr.right = TreeNode(nodes[i])\n                        queue.append(curr.right)\n                    i += 1\n                return root\n            print(str(is_valid_bst(_build_tree(_vals))))\n        except Exception:\n            pass\n`;
        }
      }

      for (const tc of publicTests) {
        const res = await fetch('/api/v1/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            language: assignment.language,
            code: codeToRun,
            stdin: tc.input,
            files: [{ id: 'main', name: 'main', path: '/main', content: codeToRun }],
          })
        });
        const execData = await res.json();
        
        const normActual = (execData.stdout || '').trim().replace(/\r\n/g, '\n');
        const normExpected = (tc.expectedOutput || '').trim().replace(/\r\n/g, '\n');
        const isMatch = normActual === normExpected;
        
        results.push({
          testCaseId: tc.id,
          status: isMatch ? 'passed' : (execData.stderr ? 'error' : 'failed'),
          visibility: 'public',
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: execData.stdout,
          error: execData.stderr,
          executionTimeMs: execData.execution_time || execData.executionTimeMs || 35,
          memoryUsageMb: execData.memory || execData.memoryUsageMb || 12,
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
      const submitCode = codeRef.current || files[0]?.content || '';
      const res = await fetch(`/api/v1/classrooms/${roomId}/assignments/${asgId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: submitCode,
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
    return (
      <div className="min-h-screen bg-[#0b0c0e] flex flex-col items-center justify-center text-white space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-zinc-500" />
        <span className="text-sm font-mono text-zinc-400">Loading assignment workspace...</span>
      </div>
    );
  }

  const allTestCases = assignment.testCases || [];
  const publicTestCases = allTestCases.filter(tc => tc.visibility !== 'hidden' && !(tc as any).isHidden);
  const hiddenTestCases = allTestCases.filter(tc => tc.visibility === 'hidden' || (tc as any).isHidden);
  const activeTestCase = allTestCases[selectedCaseIdx] || allTestCases[0];

  const getTopicPills = (title: string) => {
    const lower = (title || '').toLowerCase();
    if (lower.includes('two sum') || lower.includes('hash')) {
      return ['Array', 'Hash Table', 'Linear Time O(n)'];
    }
    if (lower.includes('bst') || lower.includes('tree')) {
      return ['Tree', 'Binary Search Tree', 'DFS / Recursion'];
    }
    return ['Algorithms', 'Data Structures'];
  };

  const getDifficultyBadge = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy':
      case 'beginner':
        return 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60';
      case 'medium':
      case 'intermediate':
        return 'bg-amber-950/40 text-amber-400 border-amber-800/60';
      case 'hard':
      case 'advanced':
        return 'bg-rose-950/40 text-rose-400 border-rose-800/60';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#000000] bg-monochrome-dotted text-white overflow-hidden font-sans relative">
      <div className="absolute inset-0 bg-[#000000]/65 pointer-events-none z-0"></div>
      {/* Top Header */}
      <header className="h-14 shrink-0 bg-black/90 backdrop-blur border-b border-[#252830] px-4 flex items-center justify-between z-20 select-none">
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => router.push(`/classroom`)} 
            className="p-1.5 hover:bg-[#1e2026] text-zinc-400 hover:text-white rounded-lg transition active:scale-95"
            title="Return to Classroom"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          <div className="flex items-center space-x-2.5">
            <CortexLogo size="sm" variant="icon" />
            <h1 className="text-sm font-bold tracking-tight text-zinc-100 max-w-[280px] truncate">{assignment.title}</h1>
            
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getDifficultyBadge(assignment.difficulty)}`}>
              {assignment.difficulty}
            </span>

            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
              {assignment.maxMarks || 100} pts
            </span>

            <span className="hidden md:inline-flex items-center text-[10px] font-mono text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800/60">
              {allTestCases.length} Tests ({publicTestCases.length} Public • {hiddenTestCases.length} Hidden)
            </span>
          </div>
        </div>
        
        {/* Top Action Buttons - Cortex Cyber Chamfer Theme */}
        <div className="flex items-center space-x-2.5">
          {/* Run Code */}
          <button 
            onClick={handleRunCode}
            disabled={isRunning || isSubmitting}
            className="cyber-btn-ring cyber-btn-silver active:scale-95 transition disabled:opacity-50"
            title="Execute current script directly"
          >
            <div className="cyber-btn-inner px-3 py-1.5 text-xs font-mono font-bold flex items-center space-x-1.5">
              {isRunning && !testResults ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-zinc-300" /> : <Terminal className="w-3.5 h-3.5 text-zinc-400" />}
              <span>Run</span>
            </div>
          </button>

          {/* Test Visible Cases */}
          <button 
            onClick={handleRunTests}
            disabled={isRunning || isSubmitting}
            className="cyber-btn-ring cyber-btn-silver active:scale-95 transition disabled:opacity-50"
            title="Execute public test cases against solution"
          >
            <div className="cyber-btn-inner px-3 py-1.5 text-xs font-mono font-bold flex items-center space-x-1.5">
              {isRunning && testResults ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" /> : <Play className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400/20" />}
              <span>Test Visible</span>
            </div>
          </button>

          {/* Submit Solution */}
          <button 
            onClick={handleSubmit}
            disabled={isRunning || isSubmitting}
            className="cyber-btn-ring cyber-btn-emerald active:scale-95 transition shadow-lg shadow-emerald-950/40 disabled:opacity-50"
            title="Run autograder against all visible and hidden test cases"
          >
            <div className="cyber-btn-inner px-4 py-1.5 text-xs font-mono font-bold flex items-center space-x-1.5">
              {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Submit Solution</span>
            </div>
          </button>
        </div>
      </header>

      {/* Main Split Workspace */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Left Pane - Problem Details, Test Cases & Results */}
        <div className="w-[46%] flex flex-col border-r border-[#252830] bg-[#0e0f13]/90 backdrop-blur-md">
          {/* Tabs */}
          <div className="flex items-center border-b border-[#252830] bg-black/60 px-2 shrink-0">
            <button 
              onClick={() => setActiveTab('problem')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 ${activeTab === 'problem' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Problem Statement</span>
            </button>
            <button 
              onClick={() => setActiveTab('testcases')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 ${activeTab === 'testcases' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Test Suite ({allTestCases.length})</span>
            </button>
            <button 
              onClick={() => setActiveTab('results')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 ${activeTab === 'results' ? 'border-amber-400 text-amber-400' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Evaluation Results</span>
              {testResults && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 ml-1"></span>
              )}
            </button>
          </div>
          
          {/* Tab Content Body */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar text-zinc-300">
            {/* Tab 1: Problem Statement */}
            {activeTab === 'problem' && (
              <div className="space-y-6">
                <div className="space-y-3 pb-4 border-b border-zinc-800/80">
                  <div className="flex items-center space-x-3">
                    <h2 className="text-xl font-black text-white tracking-tight">{assignment.title}</h2>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getDifficultyBadge(assignment.difficulty)}`}>
                      {assignment.difficulty}
                    </span>
                  </div>

                  {/* Topics Badges */}
                  <div className="flex items-center space-x-2">
                    {getTopicPills(assignment.title).map(tag => (
                      <span key={tag} className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-400">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Instructions, Input/Output Format, Examples, Constraints with custom Markdown components */}
                <div className="space-y-4">
                  <Markdown
                    components={{
                      h1: ({ children }) => <h1 className="text-lg font-bold text-white mt-6 mb-3 border-b border-zinc-800 pb-2">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-base font-bold text-white mt-6 mb-2">{children}</h2>,
                      h3: ({ children }) => (
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 mt-6 mb-2.5 flex items-center space-x-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                          <span>{children}</span>
                        </h3>
                      ),
                      h4: ({ children }) => <h4 className="text-xs font-bold text-zinc-300 mt-4 mb-2">{children}</h4>,
                      p: ({ children }) => <p className="text-sm text-zinc-300 leading-relaxed mb-3.5 font-sans">{children}</p>,
                      strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                      em: ({ children }) => <em className="italic text-zinc-200">{children}</em>,
                      ul: ({ children }) => <ul className="space-y-2 mb-4 font-mono text-xs text-zinc-300 pl-1">{children}</ul>,
                      li: ({ children }) => (
                        <li className="flex items-start space-x-2">
                          <span className="text-emerald-400 mt-0.5">•</span>
                          <span className="flex-1 text-zinc-300">{children}</span>
                        </li>
                      ),
                      code: ({ className, children, ...props }: any) => {
                        const content = String(children || '');
                        const isBlock = Boolean(className) || content.includes('\n');
                        if (!isBlock) {
                          return (
                            <code className="px-1.5 py-0.5 rounded bg-[#181a20] text-amber-300 font-mono text-xs border border-zinc-700/60 inline-block align-middle my-0.5" {...props}>
                              {children}
                            </code>
                          );
                        }
                        return (
                          <code className="text-xs font-mono text-zinc-200 leading-relaxed block whitespace-pre-wrap" {...props}>
                            {children}
                          </code>
                        );
                      },
                      pre: ({ children }: any) => (
                        <div className="my-3 rounded-xl bg-black/90 border border-zinc-800/80 p-3.5 overflow-x-auto shadow-inner">
                          {children}
                        </div>
                      ),
                    }}
                  >
                    {assignment.instructions}
                  </Markdown>
                </div>

                {/* Test Cases Overview Banner */}
                <div className="p-3.5 bg-zinc-900/60 rounded-xl border border-zinc-800 flex items-center justify-between mt-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-cyan-950/40 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-zinc-200">
                        {allTestCases.length} Test Cases Total
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono">
                        {publicTestCases.length} Visible for Testing • {hiddenTestCases.length} Hidden for Grading
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveTab('testcases')}
                    className="text-xs font-mono text-cyan-400 hover:underline px-2.5 py-1 rounded bg-cyan-950/30 border border-cyan-900/60"
                  >
                    Inspect Tests →
                  </button>
                </div>
              </div>
            )}
            
            {/* Tab 2: Test Suite & Hidden Test Cases */}
            {activeTab === 'testcases' && (
              <div className="space-y-6">
                <div className="p-4 bg-zinc-900/40 rounded-xl border border-zinc-800 space-y-1">
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Shield className="w-4 h-4 text-cyan-400" />
                    <span>Grading & Validation Test Suite</span>
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Visible test cases can be run directly from the workspace to test your solution. Hidden test cases evaluate edge cases, memory limits, and stress bounds during final submission.
                  </p>
                </div>

                {/* Public Test Cases Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-2">
                    <span className="flex items-center space-x-1.5">
                      <Play className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Visible Test Cases ({publicTestCases.length})</span>
                    </span>
                    <span className="text-[10px] text-zinc-500 font-normal">Available for local testing</span>
                  </div>

                  {publicTestCases.map((tc, idx) => (
                    <div key={tc.id || idx} className="p-4 bg-zinc-900/60 rounded-xl border border-zinc-800/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center space-x-2">
                          <span className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-300 flex items-center justify-center text-[10px] font-mono">
                            {idx + 1}
                          </span>
                          <span>{tc.name || `Case ${idx + 1}`}</span>
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-900">
                            {tc.weight || 25} pts
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500">
                            {tc.timeoutMs || 2000}ms
                          </span>
                        </div>
                      </div>

                      {/* Input */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                          <span>Input (stdin / parameters):</span>
                          <button 
                            onClick={() => handleCopy(tc.input, idx)} 
                            className="hover:text-white flex items-center space-x-1 text-[10px]"
                          >
                            {copiedIdx === idx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedIdx === idx ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                        <pre className="p-2.5 bg-black rounded-lg border border-zinc-800 font-mono text-xs text-zinc-200 whitespace-pre-wrap overflow-x-auto">
                          {tc.input}
                        </pre>
                      </div>

                      {/* Expected Output */}
                      <div className="space-y-1">
                        <div className="text-[11px] font-mono text-zinc-400">Expected Output:</div>
                        <pre className="p-2.5 bg-black rounded-lg border border-zinc-800 font-mono text-xs text-emerald-400 whitespace-pre-wrap overflow-x-auto">
                          {tc.expectedOutput}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Hidden Test Cases Section */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-2">
                    <span className="flex items-center space-x-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Hidden Test Cases ({hiddenTestCases.length})</span>
                    </span>
                    <span className="text-[10px] text-amber-500/80 font-mono">Evaluated on Submit</span>
                  </div>

                  {hiddenTestCases.map((tc, idx) => (
                    <div key={tc.id || idx} className="p-4 bg-amber-950/10 rounded-xl border border-amber-900/30 space-y-2.5 relative overflow-hidden">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-300 flex items-center space-x-2">
                          <Lock className="w-3.5 h-3.5 text-amber-400" />
                          <span>{tc.name || `Hidden Case ${idx + 1}`}</span>
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60">
                          {tc.weight || 25} pts
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 leading-relaxed">
                        Input and output data are shielded to prevent hardcoding. Validates asymptotic time/space bounds, stress datasets, and extreme edge invariants.
                      </p>

                      <div className="flex items-center space-x-3 text-[11px] font-mono text-zinc-500 pt-1 border-t border-amber-900/20">
                        <span>Status: <span className="text-amber-400">🔒 Locked (Evaluated at Submission)</span></span>
                        <span>•</span>
                        <span>Timeout: {tc.timeoutMs || 2000}ms</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Tab 3: Evaluation Results */}
            {activeTab === 'results' && (
              <div className="space-y-4">
                {submissionScore && (
                  <div className="p-5 bg-emerald-950/30 border border-emerald-800/80 rounded-xl flex items-center justify-between shadow-lg shadow-emerald-950/30">
                    <div className="space-y-1">
                      <h3 className="text-emerald-400 font-bold text-sm flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        <span>Submission Graded</span>
                      </h3>
                      <p className="text-xs text-zinc-400">Your solution was auto-graded against all visible and hidden test cases.</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-emerald-400 font-mono">
                        {submissionScore.score} / {submissionScore.max}
                      </div>
                      <div className="text-[10px] font-mono text-zinc-400">Total Score</div>
                    </div>
                  </div>
                )}
                
                {!testResults && !execResult && !isRunning && !isSubmitting && (
                  <div className="text-center py-14 text-zinc-500 text-xs font-mono space-y-2">
                    <Terminal className="w-8 h-8 text-zinc-600 mx-auto" />
                    <div>No execution data yet.</div>
                    <div className="text-zinc-600">Click &quot;Run&quot; or &quot;Test Visible&quot; to inspect output.</div>
                  </div>
                )}
                
                {isRunning || isSubmitting ? (
                  <div className="flex flex-col items-center justify-center py-16 text-zinc-400 space-y-3">
                    <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
                    <span className="text-xs font-mono tracking-wider">
                      {isSubmitting ? 'Running full autograder suite (Public & Hidden)...' : 'Executing securely in cloud sandbox...'}
                    </span>
                  </div>
                ) : testResults ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-zinc-400 pb-2 border-b border-zinc-800">
                      <span>Test Cases Results</span>
                      <span className="font-mono text-[11px]">
                        Passed: {testResults.filter(r => r.status === 'passed').length} / {testResults.length}
                      </span>
                    </div>

                    {testResults.map((tr, i) => (
                      <div key={tr.testCaseId || i} className={`p-3.5 rounded-xl border text-xs ${tr.status === 'passed' ? 'bg-emerald-950/20 border-emerald-900/60' : 'bg-rose-950/20 border-rose-900/60'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold flex items-center space-x-2">
                            {tr.status === 'passed' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
                            <span className={tr.status === 'passed' ? 'text-emerald-300' : 'text-rose-300'}>
                              Test Case {i + 1} {tr.visibility === 'hidden' && '🔒 (Hidden Grading Case)'}
                            </span>
                          </span>
                          <span className="text-[11px] font-mono text-zinc-400">
                            {tr.executionTimeMs}ms • {tr.memoryUsageMb}MB
                          </span>
                        </div>
                        
                        {tr.visibility !== 'hidden' ? (
                          <div className="space-y-2 mt-2 font-mono text-xs">
                            <div>
                              <span className="text-zinc-500 text-[10px]">Input:</span>
                              <div className="bg-black/80 p-2 rounded border border-zinc-800 text-zinc-300 mt-0.5 whitespace-pre-wrap">{tr.input}</div>
                            </div>
                            <div>
                              <span className="text-zinc-500 text-[10px]">Expected:</span>
                              <div className="bg-black/80 p-2 rounded border border-zinc-800 text-zinc-300 mt-0.5 whitespace-pre-wrap">{tr.expectedOutput}</div>
                            </div>
                            <div>
                              <span className="text-zinc-500 text-[10px]">Actual Output:</span>
                              <div className="bg-black/80 p-2 rounded border border-zinc-800 text-zinc-300 mt-0.5 whitespace-pre-wrap">{tr.actualOutput || (tr.error ? 'Error occurred' : '(No output)')}</div>
                            </div>
                            {tr.error && (
                              <div className="mt-2 text-rose-300 p-2 bg-rose-950/40 rounded border border-rose-900/60 text-xs">
                                {tr.error}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-[11px] font-mono text-zinc-400 mt-1">
                            {tr.status === 'passed' 
                              ? '✓ Hidden case successfully satisfied all constraints.' 
                              : '✗ Hidden case assertion failed (Test data shielded).'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : execResult && (
                  <div className="space-y-3">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-400 pb-1 border-b border-zinc-800">Direct Execution Output</h3>
                    <div className="font-mono text-xs space-y-2">
                      {execResult.stdout && (
                        <div className="p-3 bg-black rounded-xl text-zinc-200 whitespace-pre-wrap border border-zinc-800">
                          {execResult.stdout}
                        </div>
                      )}
                      {execResult.stderr && (
                        <div className="p-3 bg-rose-950/30 rounded-xl text-rose-300 whitespace-pre-wrap border border-rose-900/60">
                          {execResult.stderr}
                        </div>
                      )}
                      {!execResult.stdout && !execResult.stderr && (
                        <div className="p-3 bg-black rounded-xl text-zinc-500 border border-zinc-800">
                          (Process completed with exit code 0 and no standard output)
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Pane - Monaco Editor + LeetCode-Style Testcase Console */}
        <div className="flex-1 flex flex-col min-w-0 bg-black">
          {/* Code Editor */}
          <div className="flex-1 overflow-hidden relative">
            <MonacoCodeEditor
              files={files}
              activeFileId={activeFileId}
              onSelectFile={setActiveFileId}
              onCloseFile={() => {}}
              onNewFile={() => {}}
              onContentChange={(val) => {
                codeRef.current = val;
              }}
              language={assignment.language === 'cpp' ? 'cpp' : assignment.language === 'python' ? 'python' : 'typescript'}
              theme="vs-dark"
              fontSize={14}
              breakpoints={[]}
              onToggleBreakpoint={() => {}}
            />
          </div>

          {/* Bottom LeetCode-Style Dual Console */}
          <div className="border-t border-[#252830] bg-[#111217] shrink-0 flex flex-col">
            {/* Console Bar Header */}
            <div className="h-10 px-4 bg-black/80 flex items-center justify-between border-b border-[#252830]">
              <div className="flex items-center space-x-3">
                {/* Console Tab Toggles */}
                <div className="flex items-center space-x-1 bg-zinc-900/80 p-0.5 rounded-lg border border-zinc-800">
                  <button
                    onClick={() => {
                      setConsoleTab('testcases');
                      if (!isConsoleOpen) setIsConsoleOpen(true);
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition flex items-center space-x-1.5 ${
                      consoleTab === 'testcases'
                        ? 'bg-zinc-800 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Testcases</span>
                  </button>

                  <button
                    onClick={() => {
                      setConsoleTab('terminal');
                      if (!isConsoleOpen) setIsConsoleOpen(true);
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition flex items-center space-x-1.5 ${
                      consoleTab === 'terminal'
                        ? 'bg-zinc-800 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Terminal & Output</span>
                    {(execResult || testResults) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    )}
                  </button>
                </div>

                {/* Case Selector Pills (Only when Testcases tab is active) */}
                {consoleTab === 'testcases' && (
                  <div className="flex items-center space-x-1.5 pl-2 border-l border-zinc-800">
                    {allTestCases.map((tc, idx) => {
                      const isHidden = tc.visibility === 'hidden' || (tc as any).isHidden;
                      const isSelected = selectedCaseIdx === idx;
                      return (
                        <button
                          key={tc.id || idx}
                          onClick={() => {
                            setSelectedCaseIdx(idx);
                            if (!isConsoleOpen) setIsConsoleOpen(true);
                          }}
                          className={`px-2 py-0.5 text-[11px] font-mono rounded transition flex items-center space-x-1 ${
                            isSelected
                              ? 'bg-zinc-800 text-white font-bold border border-zinc-700'
                              : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 border border-transparent'
                          }`}
                        >
                          {isHidden ? <Lock className="w-3 h-3 text-amber-400" /> : null}
                          <span>Case {idx + 1}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Console Collapse Toggle */}
              <button 
                onClick={() => setIsConsoleOpen(!isConsoleOpen)}
                className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 transition"
                title={isConsoleOpen ? 'Collapse console' : 'Expand console'}
              >
                {isConsoleOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>

            {/* Console Expandable Body */}
            {isConsoleOpen && (
              <div className="p-4 bg-[#0e0f13] max-h-56 overflow-y-auto custom-scrollbar font-mono text-xs">
                {/* Mode 1: Testcases Tab */}
                {consoleTab === 'testcases' && activeTestCase && (
                  <div>
                    {activeTestCase.visibility !== 'hidden' && !(activeTestCase as any).isHidden ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-zinc-400 text-[11px] pb-1 border-b border-zinc-800/60 font-sans">
                          <span className="font-bold text-zinc-200 flex items-center space-x-1.5">
                            <span>{activeTestCase.name || `Case ${selectedCaseIdx + 1}`}</span>
                          </span>
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-900/60">
                              {activeTestCase.weight || 25} pts
                            </span>
                            <span className="text-[10px] font-mono text-zinc-500">
                              {activeTestCase.timeoutMs || 2000}ms
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <div className="text-[11px] text-zinc-400 font-sans font-medium">Input (stdin):</div>
                            <div className="p-2.5 bg-black rounded-lg border border-zinc-800 text-zinc-200 whitespace-pre-wrap font-mono">
                              {activeTestCase.input}
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <div className="text-[11px] text-zinc-400 font-sans font-medium">Expected Output:</div>
                            <div className="p-2.5 bg-black rounded-lg border border-zinc-800 text-emerald-400 whitespace-pre-wrap font-mono">
                              {activeTestCase.expectedOutput}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-amber-950/20 border border-amber-900/40 rounded-lg flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-7 h-7 rounded-lg bg-amber-900/40 border border-amber-800/60 flex items-center justify-center text-amber-400">
                            <Lock className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="font-bold text-amber-300 text-xs">
                              {activeTestCase.name || `Case ${selectedCaseIdx + 1}`} (Hidden Test Case)
                            </div>
                            <div className="text-[11px] text-zinc-400 font-sans">
                              Test case data is shielded from direct view. Evaluated automatically during submission.
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/80">
                          {activeTestCase.weight || 25} pts
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Mode 2: Terminal & Output Tab */}
                {consoleTab === 'terminal' && (
                  <div className="space-y-3 font-mono">
                    {isRunning ? (
                      <div className="flex items-center space-x-3 text-zinc-400 py-4">
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                        <span className="text-xs">Executing in Cloudflare Judge0 Sandbox...</span>
                      </div>
                    ) : testResults ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                          <span className="text-xs font-bold text-white flex items-center space-x-2">
                            <Shield className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Public Test Suite Execution</span>
                          </span>
                          <span className="text-xs font-bold text-emerald-400">
                            Passed {testResults.filter(r => r.status === 'passed').length} / {testResults.length}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {testResults.map((tr, idx) => (
                            <div
                              key={idx}
                              className={`p-2.5 rounded-lg border text-xs ${
                                tr.status === 'passed'
                                  ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-300'
                                  : 'bg-rose-950/20 border-rose-900/50 text-rose-300'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5 font-bold">
                                <span>Case {idx + 1}: {tr.status.toUpperCase()}</span>
                                <span className="text-zinc-500 text-[10px]">{tr.executionTimeMs}ms • {tr.memoryUsageMb}MB</span>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-[11px] text-zinc-300">
                                <div><span className="text-zinc-500">In:</span> {tr.input}</div>
                                <div><span className="text-zinc-500">Expected:</span> {tr.expectedOutput}</div>
                                <div><span className="text-zinc-500">Got:</span> {tr.actualOutput || (tr.error ? 'Error' : 'Empty')}</div>
                              </div>
                              {tr.error && (
                                <div className="mt-1 text-rose-400 bg-black/60 p-1.5 rounded text-[11px] whitespace-pre-wrap">
                                  {tr.error}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : execResult ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-zinc-400 text-[11px] border-b border-zinc-800/80 pb-1">
                          <span className="flex items-center space-x-2">
                            <span className={`w-2 h-2 rounded-full ${execResult.exitCode === 0 ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                            <span className="font-bold text-zinc-200">
                              {execResult.exitCode === 0 ? 'Program Exited (0)' : `Non-Zero Exit Code (${execResult.exitCode})`}
                            </span>
                          </span>
                          <span>
                            {(execResult as any).execution_time || (execResult as any).executionTimeMs || 10}ms • {(execResult as any).memory || 12}MB
                          </span>
                        </div>
                        {execResult.stdout && (
                          <div className="space-y-1">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">stdout</span>
                            <pre className="p-2.5 bg-black rounded-lg border border-zinc-800 text-zinc-200 whitespace-pre-wrap font-mono text-xs">
                              {execResult.stdout}
                            </pre>
                          </div>
                        )}
                        {execResult.stderr && (
                          <div className="space-y-1">
                            <span className="text-[10px] text-rose-500 uppercase tracking-wider">stderr</span>
                            <pre className="p-2.5 bg-rose-950/30 rounded-lg border border-rose-900/60 text-rose-300 whitespace-pre-wrap font-mono text-xs">
                              {execResult.stderr}
                            </pre>
                          </div>
                        )}
                        {!execResult.stdout && !execResult.stderr && (
                          <div className="text-zinc-500 py-3 text-center">
                            Program executed successfully with no console output.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-zinc-500 space-y-1 font-sans">
                        <Terminal className="w-5 h-5 mx-auto text-zinc-600 mb-1" />
                        <div className="text-xs">No active terminal session.</div>
                        <div className="text-[11px] text-zinc-600 font-mono">Click &quot;Run&quot; or &quot;Test Visible&quot; above to execute code.</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
