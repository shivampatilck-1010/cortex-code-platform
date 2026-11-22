'use client';

import React, { useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Trash2, 
  Play, 
  Zap, 
  Gauge,
  HelpCircle,
  EyeOff
} from 'lucide-react';
import { TestCase, BenchmarkMetrics } from '@/lib/execution/types';

interface TestCasesPanelProps {
  testCases: TestCase[];
  onAddTestCase: (tc: Omit<TestCase, 'id'>) => void;
  onDeleteTestCase: (id: string) => void;
  onRunAllTests: () => void;
  onRunBenchmark: () => void;
  isRunningTests: boolean;
  benchmarkResult: BenchmarkMetrics | null;
  customStdin: string;
  onChangeCustomStdin: (val: string) => void;
  isDarkMode?: boolean;
}

export const TestCasesPanel: React.FC<TestCasesPanelProps> = ({
  testCases,
  onAddTestCase,
  onDeleteTestCase,
  onRunAllTests,
  onRunBenchmark,
  isRunningTests,
  benchmarkResult,
  customStdin,
  onChangeCustomStdin,
  isDarkMode = true,
}) => {
  const [activeTab, setActiveTab] = useState<'tests' | 'custom' | 'benchmark'>('tests');
  const [newStdin, setNewStdin] = useState('');
  const [newExpected, setNewExpected] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const safeTests = Array.isArray(testCases) ? testCases : [];
  const passedCount = safeTests.filter((tc) => tc.passed).length;
  const totalCount = safeTests.length;

  const handleCreateTest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpected.trim()) return;
    onAddTestCase({
      name: `Test Case ${safeTests.length + 1}`,
      stdin: newStdin,
      expectedStdout: newExpected,
      isHidden: false,
    });
    setNewStdin('');
    setNewExpected('');
    setShowAddModal(false);
  };

  return (
    <div className={`h-full flex flex-col text-xs font-mono select-text overflow-hidden transition-colors duration-200 ${
      isDarkMode ? 'bg-[#141518] text-gray-200' : 'bg-white text-slate-800'
    }`}>
      {/* Sub-tabs header */}
      <div className={`px-3 border-b flex items-center justify-between transition-colors duration-200 ${
        isDarkMode ? 'bg-[#18191d] border-[#252830]' : 'bg-slate-100 border-slate-200'
      }`}>
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab('tests')}
            className={`py-2 px-3.5 border-b-2 font-heading font-semibold text-xs tracking-wide transition ${
              activeTab === 'tests'
                ? 'border-[#ff9100] text-[#ff9100]'
                : isDarkMode
                  ? 'border-transparent text-gray-400 hover:text-gray-200'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Tests ({totalCount > 0 ? `${passedCount}/${totalCount}` : 0})
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`py-2 px-3.5 border-b-2 font-heading font-semibold text-xs tracking-wide transition ${
              activeTab === 'custom'
                ? 'border-[#ff9100] text-[#ff9100]'
                : isDarkMode
                  ? 'border-transparent text-gray-400 hover:text-gray-200'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Input (stdin)
          </button>
          <button
            onClick={() => setActiveTab('benchmark')}
            className={`py-2 px-3.5 border-b-2 font-heading font-semibold text-xs tracking-wide transition ${
              activeTab === 'benchmark'
                ? 'border-[#ff9100] text-[#ff9100]'
                : isDarkMode
                  ? 'border-transparent text-gray-400 hover:text-gray-200'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Benchmark
          </button>
        </div>

        {activeTab === 'tests' && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAddModal(!showAddModal)}
              className={`p-1.5 rounded transition border border-transparent ${
                isDarkMode ? 'text-gray-400 hover:text-white hover:bg-[#252830]' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200 hover:border-slate-300'
              }`}
              title="Add Test Case"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRunAllTests}
              disabled={isRunningTests || totalCount === 0}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-heading font-bold transition shadow-sm ${
                isRunningTests
                  ? 'bg-gray-700 text-gray-300 cursor-not-allowed'
                  : 'bg-[#ff9100] hover:bg-[#e08000] text-slate-950'
              }`}
            >
              <Play className={`w-3.5 h-3.5 ${isRunningTests ? 'animate-spin' : 'fill-current'}`} />
              <span>{isRunningTests ? 'Running...' : 'Run Tests'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Content View */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* TAB 1: Automated Test Cases */}
        {activeTab === 'tests' && (
          <div className="space-y-3">
            {/* Add Test Case Form */}
            {showAddModal && (
              <form onSubmit={handleCreateTest} className={`p-2.5 rounded space-y-2 border ${
                isDarkMode ? 'bg-[#1c1e24] border-[#2d303b]' : 'bg-slate-50 border-slate-200 shadow-sm'
              }`}>
                <span className={`font-bold block text-[11px] ${isDarkMode ? 'text-gray-200' : 'text-slate-900'}`}>Add New Test Case</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`text-[10px] block mb-1 ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>Standard Input (stdin)</label>
                    <textarea
                      rows={2}
                      value={newStdin}
                      onChange={(e) => setNewStdin(e.target.value)}
                      placeholder="e.g. 5\n10 20 30"
                      className={`w-full p-1.5 rounded border text-xs focus:outline-none ${
                        isDarkMode ? 'bg-[#141518] text-gray-200 border-[#2d303b]' : 'bg-white text-slate-800 border-slate-200 shadow-sm'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`text-[10px] block mb-1 ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>Expected Output (stdout)</label>
                    <textarea
                      rows={2}
                      value={newExpected}
                      onChange={(e) => setNewExpected(e.target.value)}
                      placeholder="e.g. 60"
                      className={`w-full p-1.5 rounded border text-xs focus:outline-none ${
                        isDarkMode ? 'bg-[#141518] text-gray-200 border-[#2d303b]' : 'bg-white text-slate-800 border-slate-200 shadow-sm'
                      }`}
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className={`px-2 py-0.5 rounded ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 rounded bg-[#ff9100] hover:bg-[#e08000] text-slate-950 font-bold text-[11px] transition shadow-sm"
                  >
                    Save Test Case
                  </button>
                </div>
              </form>
            )}

            {safeTests.length === 0 ? (
              <div className={`text-center py-8 ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
                <p>No test cases yet.</p>
                <p className="text-[11px] mt-1">Click + above to add an input and expected output.</p>
              </div>
            ) : (
              safeTests.map((tc, idx) => (
                <div
                  key={tc.id}
                  className={`p-2.5 rounded border transition ${
                    tc.passed === true
                      ? isDarkMode ? 'bg-emerald-950/20 border-emerald-800/50' : 'bg-emerald-50 border-emerald-200'
                      : tc.passed === false
                      ? isDarkMode ? 'bg-rose-950/20 border-rose-800/50' : 'bg-rose-50 border-rose-200'
                      : isDarkMode ? 'bg-[#18191d] border-[#282a33]' : 'bg-slate-50 border-slate-200 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center space-x-2">
                      {tc.passed === true ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : tc.passed === false ? (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-gray-500 inline-block" />
                      )}
                      <span className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-slate-900'}`}>{tc.name}</span>
                      {tc.isHidden && (
                        <span className={`flex items-center space-x-1 px-1.5 py-0.2 rounded text-[10px] ${
                          isDarkMode ? 'bg-gray-800 text-gray-400' : 'bg-slate-200 text-slate-700'
                        }`}>
                          <EyeOff className="w-3 h-3" />
                          <span>Hidden</span>
                        </span>
                      )}
                    </div>

                    <div className={`flex items-center space-x-3 text-[11px] ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                      {tc.timeMs !== undefined && <span>{tc.timeMs} ms</span>}
                      <button
                        onClick={() => onDeleteTestCase(tc.id)}
                        className={`${isDarkMode ? 'text-gray-500 hover:text-rose-400' : 'text-slate-400 hover:text-rose-600'} transition`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {!tc.isHidden ? (
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className={`block mb-0.5 ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>Input:</span>
                        <pre className={`p-1.5 rounded border whitespace-pre-wrap ${
                          isDarkMode ? 'bg-[#121316] border-[#22242b] text-gray-300' : 'bg-white border-slate-200 text-slate-900 shadow-sm'
                        }`}>
                          {tc.stdin || '<empty>'}
                        </pre>
                      </div>
                      <div>
                        <span className={`block mb-0.5 ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>Expected:</span>
                        <pre className={`p-1.5 rounded border whitespace-pre-wrap ${
                          isDarkMode ? 'bg-[#121316] border-[#22242b] text-gray-300' : 'bg-white border-slate-200 text-slate-900 shadow-sm'
                        }`}>
                          {tc.expectedStdout}
                        </pre>
                      </div>
                      {tc.actualStdout !== undefined && (
                        <div className="col-span-2">
                          <span className={`block mb-0.5 ${tc.passed ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-700') : (isDarkMode ? 'text-rose-400' : 'text-rose-700')}`}>
                            Actual Output:
                          </span>
                          <pre className={`p-1.5 rounded border whitespace-pre-wrap ${
                            isDarkMode ? 'bg-[#121316] border-[#22242b] text-gray-300' : 'bg-white border-slate-200 text-slate-900 shadow-sm'
                          }`}>
                            {tc.actualStdout}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className={`text-[11px] ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
                      Hidden test case.
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: Custom Stdin */}
        {activeTab === 'custom' && (
          <div className="space-y-2 h-full flex flex-col">
            <span className={`text-[11px] ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>
              Standard input passed to your program at runtime:
            </span>
            <textarea
              rows={8}
              value={customStdin}
              onChange={(e) => onChangeCustomStdin(e.target.value)}
              placeholder="Enter standard input values here..."
              className={`flex-1 w-full p-2 rounded border focus:outline-none focus:ring-1 focus:ring-[#ff9100] font-mono text-xs ${
                isDarkMode ? 'bg-[#18191d] text-gray-200 border-[#282a33]' : 'bg-white text-slate-900 border-slate-200 shadow-sm'
              }`}
            />
          </div>
        )}

        {/* TAB 3: Benchmark & Complexity */}
        {activeTab === 'benchmark' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className={`font-heading font-bold text-sm ${isDarkMode ? 'text-gray-200' : 'text-slate-900'}`}>Benchmark</h4>
                <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>Measure execution latency, memory, and estimated complexity across multiple runs.</p>
              </div>
              <button
                onClick={onRunBenchmark}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-[#ff9100] hover:bg-[#e08000] text-slate-950 font-heading font-bold rounded text-xs transition shadow-sm"
              >
                <Gauge className="w-3.5 h-3.5" />
                <span>Run Benchmark</span>
              </button>
            </div>

            {benchmarkResult ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={`p-3 rounded border ${isDarkMode ? 'bg-[#1c1e24] border-[#2d303b]' : 'bg-slate-50 border-slate-200 shadow-sm'}`}>
                  <span className={`text-xs font-heading font-semibold uppercase tracking-wider block mb-1 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>Average Latency</span>
                  <span className="text-xl font-bold font-mono text-[#ff9100]">{benchmarkResult.averageTimeMs} ms</span>
                </div>
                <div className={`p-3 rounded border ${isDarkMode ? 'bg-[#1c1e24] border-[#2d303b]' : 'bg-slate-50 border-slate-200 shadow-sm'}`}>
                  <span className={`text-xs font-heading font-semibold uppercase tracking-wider block mb-1 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>Latency Range</span>
                  <span className={`text-xl font-bold font-mono ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{benchmarkResult.minTimeMs} - {benchmarkResult.maxTimeMs} ms</span>
                </div>
                <div className={`p-3 rounded border ${isDarkMode ? 'bg-[#1c1e24] border-[#2d303b]' : 'bg-slate-50 border-slate-200 shadow-sm'}`}>
                  <span className={`text-xs font-heading font-semibold uppercase tracking-wider block mb-1 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>Resident Memory</span>
                  <span className={`text-xl font-bold font-mono ${isDarkMode ? 'text-amber-300' : 'text-amber-600'}`}>{benchmarkResult.memoryUsageMb} MB</span>
                </div>
                <div className={`p-3 rounded border ${isDarkMode ? 'bg-[#1c1e24] border-[#2d303b]' : 'bg-slate-50 border-slate-200 shadow-sm'}`}>
                  <span className={`text-xs font-heading font-semibold uppercase tracking-wider block mb-1 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>Estimated Complexity</span>
                  <span className="text-base font-bold font-mono text-[#ff9100]">{benchmarkResult.approxComplexity}</span>
                </div>
              </div>
            ) : (
              <div className={`p-4 rounded text-xs text-center border ${
                isDarkMode ? 'bg-[#18191d] border-[#282a33] text-gray-400' : 'bg-slate-50 border-slate-200 text-slate-500 shadow-sm'
              }`}>
                Click "Run Benchmark" to measure execution latency and memory.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
