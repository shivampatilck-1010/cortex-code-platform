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
}) => {
  const [activeTab, setActiveTab] = useState<'tests' | 'custom' | 'benchmark'>('tests');
  const [newStdin, setNewStdin] = useState('');
  const [newExpected, setNewExpected] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const passedCount = testCases.filter((tc) => tc.passed).length;
  const totalCount = testCases.length;

  const handleCreateTest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpected.trim()) return;
    onAddTestCase({
      name: `Test Case ${testCases.length + 1}`,
      stdin: newStdin,
      expectedStdout: newExpected,
      isHidden: false,
    });
    setNewStdin('');
    setNewExpected('');
    setShowAddModal(false);
  };

  return (
    <div className="h-full flex flex-col bg-[#141518] text-xs font-mono select-text overflow-hidden">
      {/* Sub-tabs header */}
      <div className="px-3 bg-[#18191d] border-b border-[#252830] flex items-center justify-between">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab('tests')}
            className={`py-2 px-3.5 border-b-2 font-heading font-semibold text-xs tracking-wide transition ${
              activeTab === 'tests'
                ? 'border-[#ff9100] text-[#ff9100]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Tests ({totalCount > 0 ? `${passedCount}/${totalCount}` : 0})
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`py-2 px-3.5 border-b-2 font-heading font-semibold text-xs tracking-wide transition ${
              activeTab === 'custom'
                ? 'border-[#ff9100] text-[#ff9100]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Input (stdin)
          </button>
          <button
            onClick={() => setActiveTab('benchmark')}
            className={`py-2 px-3.5 border-b-2 font-heading font-semibold text-xs tracking-wide transition ${
              activeTab === 'benchmark'
                ? 'border-[#ff9100] text-[#ff9100]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Benchmark
          </button>
        </div>

        {activeTab === 'tests' && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAddModal(!showAddModal)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#252830] rounded transition"
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
                  : 'bg-[#ff9100] hover:bg-[#e08000] text-[#0b0c0e]'
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
              <form onSubmit={handleCreateTest} className="p-2.5 bg-[#1c1e24] border border-[#2d303b] rounded space-y-2">
                <span className="font-bold text-gray-200 block text-[11px]">Add New Test Case</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Standard Input (stdin)</label>
                    <textarea
                      rows={2}
                      value={newStdin}
                      onChange={(e) => setNewStdin(e.target.value)}
                      placeholder="e.g. 5\n10 20 30"
                      className="w-full bg-[#141518] text-gray-200 p-1.5 rounded border border-[#2d303b] text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Expected Output (stdout)</label>
                    <textarea
                      rows={2}
                      value={newExpected}
                      onChange={(e) => setNewExpected(e.target.value)}
                      placeholder="e.g. 60"
                      className="w-full bg-[#141518] text-gray-200 p-1.5 rounded border border-[#2d303b] text-xs focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-2 py-0.5 rounded text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 rounded bg-[#ff9100] hover:bg-[#e08000] text-[#0b0c0e] font-bold text-[11px] transition"
                  >
                    Save Test Case
                  </button>
                </div>
              </form>
            )}

            {testCases.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No test cases yet.</p>
                <p className="text-[11px] mt-1">Click + above to add an input and expected output.</p>
              </div>
            ) : (
              testCases.map((tc, idx) => (
                <div
                  key={tc.id}
                  className={`p-2.5 rounded border transition ${
                    tc.passed === true
                      ? 'bg-emerald-950/20 border-emerald-800/50'
                      : tc.passed === false
                      ? 'bg-rose-950/20 border-rose-800/50'
                      : 'bg-[#18191d] border-[#282a33]'
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
                      <span className="font-semibold text-gray-200">{tc.name}</span>
                      {tc.isHidden && (
                        <span className="flex items-center space-x-1 px-1.5 py-0.2 rounded bg-gray-800 text-gray-400 text-[10px]">
                          <EyeOff className="w-3 h-3" />
                          <span>Hidden</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-3 text-gray-400 text-[11px]">
                      {tc.timeMs !== undefined && <span>{tc.timeMs} ms</span>}
                      <button
                        onClick={() => onDeleteTestCase(tc.id)}
                        className="text-gray-500 hover:text-rose-400 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {!tc.isHidden ? (
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-gray-500 block mb-0.5">Input:</span>
                        <pre className="bg-[#121316] p-1.5 rounded border border-[#22242b] text-gray-300 whitespace-pre-wrap">
                          {tc.stdin || '<empty>'}
                        </pre>
                      </div>
                      <div>
                        <span className="text-gray-500 block mb-0.5">Expected:</span>
                        <pre className="bg-[#121316] p-1.5 rounded border border-[#22242b] text-gray-300 whitespace-pre-wrap">
                          {tc.expectedStdout}
                        </pre>
                      </div>
                      {tc.actualStdout !== undefined && (
                        <div className="col-span-2">
                          <span className={`block mb-0.5 ${tc.passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                            Actual Output:
                          </span>
                          <pre className="bg-[#121316] p-1.5 rounded border border-[#22242b] text-gray-300 whitespace-pre-wrap">
                            {tc.actualStdout}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-[11px]">
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
            <span className="text-gray-400 text-[11px]">
              Standard input passed to your program at runtime:
            </span>
            <textarea
              rows={8}
              value={customStdin}
              onChange={(e) => onChangeCustomStdin(e.target.value)}
              placeholder="Enter standard input values here..."
              className="flex-1 w-full bg-[#18191d] text-gray-200 p-2 rounded border border-[#282a33] focus:outline-none focus:ring-1 focus:ring-[#ff9100] font-mono text-xs"
            />
          </div>
        )}

        {/* TAB 3: Benchmark & Complexity */}
        {activeTab === 'benchmark' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-heading font-bold text-sm text-gray-200">Benchmark</h4>
                <p className="text-gray-300 text-xs mt-0.5">Measure execution latency, memory, and estimated complexity across multiple runs.</p>
              </div>
              <button
                onClick={onRunBenchmark}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-[#ff9100] hover:bg-[#e08000] text-[#0b0c0e] font-heading font-bold rounded text-xs transition shadow-sm"
              >
                <Gauge className="w-3.5 h-3.5" />
                <span>Run Benchmark</span>
              </button>
            </div>

            {benchmarkResult ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-[#1c1e24] border border-[#2d303b] rounded">
                  <span className="text-xs text-gray-400 font-heading font-semibold uppercase tracking-wider block mb-1">Average Latency</span>
                  <span className="text-xl font-bold font-mono text-[#ff9100]">{benchmarkResult.averageTimeMs} ms</span>
                </div>
                <div className="p-3 bg-[#1c1e24] border border-[#2d303b] rounded">
                  <span className="text-xs text-gray-400 font-heading font-semibold uppercase tracking-wider block mb-1">Latency Range</span>
                  <span className="text-xl font-bold font-mono text-emerald-400">{benchmarkResult.minTimeMs} - {benchmarkResult.maxTimeMs} ms</span>
                </div>
                <div className="p-3 bg-[#1c1e24] border border-[#2d303b] rounded">
                  <span className="text-xs text-gray-400 font-heading font-semibold uppercase tracking-wider block mb-1">Resident Memory</span>
                  <span className="text-xl font-bold font-mono text-amber-300">{benchmarkResult.memoryUsageMb} MB</span>
                </div>
                <div className="p-3 bg-[#1c1e24] border border-[#2d303b] rounded">
                  <span className="text-xs text-gray-400 font-heading font-semibold uppercase tracking-wider block mb-1">Estimated Complexity</span>
                  <span className="text-base font-bold font-mono text-[#ff9100]">{benchmarkResult.approxComplexity}</span>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-[#18191d] border border-[#282a33] rounded text-gray-400 text-xs text-center">
                Click "Run Benchmark" to measure execution latency and memory.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
