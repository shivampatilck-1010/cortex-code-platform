'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Save, ArrowLeft, Plus, Trash2, Settings, Terminal, Shield, Clock } from 'lucide-react';
import { CortexLogo } from '@/components/brand/CortexLogo';
import { getClassroomAuthHeaders } from '@/lib/classroom/client-auth';

export default function AssignmentBuilderPage({
  params
}: {
  params: Promise<{ roomId: string; asgId: string }>;
}) {
  const router = useRouter();
  const [roomId, setRoomId] = useState('');
  const [asgId, setAsgId] = useState('');
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [language, setLanguage] = useState('python');
  const [difficulty, setDifficulty] = useState('Intermediate');
  const [starterCode, setStarterCode] = useState('');
  const [maxMarks, setMaxMarks] = useState(100);
  const [attemptsAllowed, setAttemptsAllowed] = useState(3);
  const [aiPolicy, setAiPolicy] = useState('hints_only');
  const [plagiarismPolicy, setPlagiarismPolicy] = useState('review_only');
  
  const [testCases, setTestCases] = useState<any[]>([
    { id: 'tc_1', input: '', expectedOutput: '', visibility: 'public', weight: 50, timeoutMs: 2000, memoryLimitMb: 128 }
  ]);
  
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    params.then(p => {
      setRoomId(p.roomId);
      setAsgId(p.asgId);
      
      if (p.asgId !== 'new') {
        fetch(`/api/v1/classrooms/${p.roomId}/assignments/${p.asgId}`, { headers: getClassroomAuthHeaders() })
          .then(res => res.json())
          .then(data => {
            if (data.assignment) {
              const a = data.assignment;
              setTitle(a.title);
              setDescription(a.description);
              setInstructions(a.instructions);
              setLanguage(a.language);
              setDifficulty(a.difficulty);
              setStarterCode(a.starterCode);
              setMaxMarks(a.maxMarks);
              setAttemptsAllowed(a.attemptsAllowed);
              setAiPolicy(a.aiPolicy);
              setPlagiarismPolicy(a.plagiarismPolicy);
              if (a.testCases) setTestCases(a.testCases);
            }
          });
      }
    });
  }, [params]);

  const handleSave = async () => {
    if (!title.trim() || !description.trim()) {
      alert("Title and Problem Statement are required");
      return;
    }
    
    const hasExecutable = testCases.some(tc => tc.expectedOutput.trim() !== '');
    if (!hasExecutable) {
      alert("At least one test case with expected output is required");
      return;
    }

    setIsSaving(true);
    const payload = {
      title,
      description,
      instructions,
      language,
      difficulty,
      starterCode,
      maxMarks,
      attemptsAllowed,
      aiPolicy,
      plagiarismPolicy,
      testCases,
      status: 'published'
    };

    try {
      const url = asgId === 'new' 
        ? `/api/v1/classrooms/${roomId}/assignments` 
        : `/api/v1/classrooms/${roomId}/assignments/${asgId}`;
        
      const method = asgId === 'new' ? 'POST' : 'PATCH';
      
      const res = await fetch(url, {
        method,
        headers: getClassroomAuthHeaders(),
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (data.success || data.assignment) {
        router.push(`/classroom`);
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const addTestCase = () => {
    setTestCases([
      ...testCases, 
      { id: `tc_${Date.now()}`, input: '', expectedOutput: '', visibility: 'public', weight: 10, timeoutMs: 2000, memoryLimitMb: 128 }
    ]);
  };

  const removeTestCase = (idx: number) => {
    const newCases = [...testCases];
    newCases.splice(idx, 1);
    setTestCases(newCases);
  };

  const updateTestCase = (idx: number, field: string, val: any) => {
    const newCases = [...testCases];
    newCases[idx][field] = val;
    setTestCases(newCases);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0c0e] text-white">
      <header className="h-16 shrink-0 bg-[#0d0e12] border-b border-[#252830] px-6 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center space-x-4">
          <button onClick={() => router.push(`/classroom`)} className="p-2 hover:bg-[#1e2026] rounded transition">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div className="flex items-center space-x-3">
            <CortexLogo size="sm" variant="icon" />
            <h1 className="text-lg font-bold">{asgId === 'new' ? 'Create Assignment' : 'Edit Assignment'}</h1>
          </div>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="px-5 py-2 bg-[#ff9100] hover:bg-[#e07f00] text-black rounded-lg text-sm font-bold flex items-center space-x-2 transition active:scale-95 shadow"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Saving...' : 'Publish Assignment'}</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-10">
          
          {/* Basics */}
          <section className="space-y-6">
            <div className="flex items-center space-x-2 border-b border-[#252830] pb-2">
              <Settings className="w-5 h-5 text-[#ff9100]" />
              <h2 className="text-lg font-bold">General Settings</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-1">Assignment Title</label>
                <input 
                  value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Dynamic Programming: Coin Change"
                  className="w-full bg-[#13141a] border border-[#252830] rounded-xl px-4 py-3 text-white focus:border-[#ff9100] focus:ring-1 focus:ring-[#ff9100] outline-none transition"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-1">Language</label>
                  <select 
                    value={language} onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-[#13141a] border border-[#252830] rounded-xl px-4 py-3 text-white focus:border-[#ff9100] outline-none"
                  >
                    <option value="python">Python 3.12</option>
                    <option value="cpp">C++ 20</option>
                    <option value="typescript">TypeScript</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-1">Difficulty</label>
                  <select 
                    value={difficulty} onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full bg-[#13141a] border border-[#252830] rounded-xl px-4 py-3 text-white focus:border-[#ff9100] outline-none"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* Problem Formulation */}
          <section className="space-y-6">
            <div className="flex items-center space-x-2 border-b border-[#252830] pb-2">
              <BookOpen className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-bold">Problem Formulation</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-1">Problem Statement (Markdown)</label>
                <textarea 
                  value={description} onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  placeholder="Describe the problem, input format, output format, and examples..."
                  className="w-full bg-[#13141a] border border-[#252830] rounded-xl px-4 py-3 text-white focus:border-[#ff9100] outline-none font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-1">Constraints & Technical Instructions</label>
                <textarea 
                  value={instructions} onChange={(e) => setInstructions(e.target.value)}
                  rows={3}
                  placeholder="e.g. O(N) time complexity, maximum array size 10^5"
                  className="w-full bg-[#13141a] border border-[#252830] rounded-xl px-4 py-3 text-white focus:border-[#ff9100] outline-none font-mono text-sm text-emerald-400"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-1">Starter Code</label>
                <textarea 
                  value={starterCode} onChange={(e) => setStarterCode(e.target.value)}
                  rows={8}
                  placeholder="def solve():\n    pass"
                  className="w-full bg-[#0d0e12] border border-[#252830] rounded-xl px-4 py-3 text-gray-300 focus:border-[#ff9100] outline-none font-mono text-sm"
                  spellCheck={false}
                />
              </div>
            </div>
          </section>

          {/* Execution & Grading */}
          <section className="space-y-6">
            <div className="flex items-center space-x-2 border-b border-[#252830] pb-2">
              <Shield className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-bold">Execution & Grading Policies</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-1">Maximum Marks</label>
                <input 
                  type="number" value={maxMarks} onChange={(e) => setMaxMarks(Number(e.target.value))}
                  className="w-full bg-[#13141a] border border-[#252830] rounded-xl px-4 py-3 text-white focus:border-[#ff9100] outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-1">Attempt Limit</label>
                <input 
                  type="number" value={attemptsAllowed} onChange={(e) => setAttemptsAllowed(Number(e.target.value))}
                  className="w-full bg-[#13141a] border border-[#252830] rounded-xl px-4 py-3 text-white focus:border-[#ff9100] outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-1">AI Assistant Policy</label>
                <select 
                  value={aiPolicy} onChange={(e) => setAiPolicy(e.target.value)}
                  className="w-full bg-[#13141a] border border-[#252830] rounded-xl px-4 py-3 text-white focus:border-[#ff9100] outline-none"
                >
                  <option value="disabled">Disabled</option>
                  <option value="explain_only">Explain Errors Only</option>
                  <option value="hints_only">Hints Only</option>
                  <option value="full">Full Assistance</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-1">Plagiarism Detection</label>
                <select 
                  value={plagiarismPolicy} onChange={(e) => setPlagiarismPolicy(e.target.value)}
                  className="w-full bg-[#13141a] border border-[#252830] rounded-xl px-4 py-3 text-white focus:border-[#ff9100] outline-none"
                >
                  <option value="disabled">Disabled</option>
                  <option value="review_only">Flag for Review</option>
                  <option value="strict">Strict Rejection</option>
                </select>
              </div>
            </div>
          </section>

          {/* Test Cases */}
          <section className="space-y-6">
            <div className="flex items-center justify-between border-b border-[#252830] pb-2">
              <div className="flex items-center space-x-2">
                <Terminal className="w-5 h-5 text-cyan-400" />
                <h2 className="text-lg font-bold">Test Cases Engine</h2>
              </div>
              <button 
                onClick={addTestCase}
                className="px-3 py-1.5 bg-[#1e2026] hover:bg-[#252830] text-gray-300 rounded text-xs font-bold flex items-center space-x-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Test Case</span>
              </button>
            </div>
            
            <div className="space-y-4">
              {testCases.map((tc, idx) => (
                <div key={idx} className="p-5 bg-[#13141a] border border-[#252830] rounded-xl space-y-4 relative">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-gray-300">Test Case {idx + 1}</h4>
                    <button onClick={() => removeTestCase(idx)} className="p-1.5 text-gray-500 hover:text-rose-400 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Input (stdin)</label>
                      <textarea 
                        value={tc.input} onChange={(e) => updateTestCase(idx, 'input', e.target.value)}
                        rows={3}
                        className="w-full bg-[#0d0e12] border border-[#252830] rounded-lg px-3 py-2 text-white outline-none font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Expected Output (stdout)</label>
                      <textarea 
                        value={tc.expectedOutput} onChange={(e) => updateTestCase(idx, 'expectedOutput', e.target.value)}
                        rows={3}
                        className="w-full bg-[#0d0e12] border border-[#252830] rounded-lg px-3 py-2 text-white outline-none font-mono text-xs"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Visibility</label>
                      <select 
                        value={tc.visibility} onChange={(e) => updateTestCase(idx, 'visibility', e.target.value)}
                        className="w-full bg-[#0d0e12] border border-[#252830] rounded-lg px-3 py-2 text-white outline-none text-xs"
                      >
                        <option value="public">Visible to Student</option>
                        <option value="hidden">Hidden</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Weight / Marks</label>
                      <input 
                        type="number" value={tc.weight} onChange={(e) => updateTestCase(idx, 'weight', Number(e.target.value))}
                        className="w-full bg-[#0d0e12] border border-[#252830] rounded-lg px-3 py-2 text-white outline-none text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Timeout (ms)</label>
                      <input 
                        type="number" value={tc.timeoutMs} onChange={(e) => updateTestCase(idx, 'timeoutMs', Number(e.target.value))}
                        className="w-full bg-[#0d0e12] border border-[#252830] rounded-lg px-3 py-2 text-white outline-none text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Memory Limit (MB)</label>
                      <input 
                        type="number" value={tc.memoryLimitMb} onChange={(e) => updateTestCase(idx, 'memoryLimitMb', Number(e.target.value))}
                        className="w-full bg-[#0d0e12] border border-[#252830] rounded-lg px-3 py-2 text-white outline-none text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

// Ensure lucide icon is defined here
import { BookOpen } from 'lucide-react';
