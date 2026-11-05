'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Save, ArrowLeft, Plus, Trash2, Settings, Terminal, Shield, Clock,
  Upload, Download, Sparkles, BookOpen, FileText, CheckCircle2, Copy, AlertCircle, Eye, EyeOff
} from 'lucide-react';
import { CortexLogo } from '@/components/brand/CortexLogo';

// Pre-built DSA Templates for Instant 1-Click Setup
const DSA_TEMPLATES = [
  {
    name: 'Two Sum (Python)',
    badge: 'Array • Hash Table',
    difficulty: 'Beginner',
    language: 'python',
    title: 'Two Sum: Hash Map Optimization',
    description: `Given an array of integers \`nums\` and an integer \`target\`, return *indices of the two numbers such that they add up to \`target\`*.

You may assume that each input would have **exactly one solution**, and you may not use the same element twice. You can return the answer in any order.`,
    instructions: `### Input Format
The first line contains a JSON array of integers \`nums\`.
The second line contains an integer \`target\`.

### Output Format
Return a JSON array of two indices \`[i, j]\`.

### Example 1
\`\`\`text
Input: [2, 7, 11, 15]
9
Output: [0, 1]
\`\`\`

### Constraints
- \`2 <= nums.length <= 10^4\`
- \`-10^9 <= nums[i] <= 10^9\`
- \`-10^9 <= target <= 10^9\`
- Only one valid answer exists.`,
    starterCode: `from typing import List
import sys, json

def two_sum(nums: List[int], target: int) -> List[int]:
    lookup = {}
    for idx, num in enumerate(nums):
        diff = target - num
        if diff in lookup:
            return [lookup[diff], idx]
        lookup[num] = idx
    return []

if __name__ == '__main__':
    lines = [line.strip() for line in sys.stdin if line.strip()]
    if len(lines) >= 2:
        nums = json.loads(lines[0])
        target = int(lines[1])
        print(json.dumps(two_sum(nums, target)))
`,
    testCases: [
      { id: 'tc_1', input: '[2, 7, 11, 15]\n9', expectedOutput: '[0, 1]', visibility: 'public', weight: 25, timeoutMs: 2000, memoryLimitMb: 128 },
      { id: 'tc_2', input: '[3, 2, 4]\n6', expectedOutput: '[1, 2]', visibility: 'public', weight: 25, timeoutMs: 2000, memoryLimitMb: 128 },
      { id: 'tc_3', input: '[3, 3]\n6', expectedOutput: '[0, 1]', visibility: 'hidden', weight: 25, timeoutMs: 2000, memoryLimitMb: 128 },
      { id: 'tc_4', input: '[-1, -2, -3, -4, -5]\n-8', expectedOutput: '[2, 4]', visibility: 'hidden', weight: 25, timeoutMs: 2000, memoryLimitMb: 128 },
    ]
  },
  {
    name: 'Reverse Linked List (C++)',
    badge: 'Linked List • Pointers',
    difficulty: 'Beginner',
    language: 'cpp',
    title: 'Reverse Singly Linked List',
    description: `Given the head of a singly linked list, reverse the list, and return *the reversed list*.`,
    instructions: `### Input Format
A bracketed comma-separated list of node values, e.g. \`[1, 2, 3, 4, 5]\`.

### Output Format
The reversed list formatted with brackets: \`[5, 4, 3, 2, 1]\`.

### Example 1
\`\`\`text
Input: [1, 2, 3, 4, 5]
Output: [5, 4, 3, 2, 1]
\`\`\`

### Constraints
- Number of nodes: \`[0, 5000]\`
- \`-5000 <= Node.val <= 5000\`
- Target: \`O(N)\` time and \`O(1)\` auxiliary space.`,
    starterCode: `#include <iostream>
#include <vector>
#include <sstream>

struct ListNode {
    int val;
    ListNode *next;
    ListNode(int x) : val(x), next(nullptr) {}
};

ListNode* reverseList(ListNode* head) {
    ListNode* prev = nullptr;
    ListNode* curr = head;
    while (curr != nullptr) {
        ListNode* nextTemp = curr->next;
        curr->next = prev;
        prev = curr;
        curr = nextTemp;
    }
    return prev;
}

int main() {
    std::string line;
    if (std::getline(std::cin, line)) {
        std::vector<int> nums;
        std::string clean = "";
        for (char c : line) {
            if (c != '[' && c != ']' && c != ' ') clean += c;
        }
        std::stringstream ss(clean);
        std::string item;
        while (std::getline(ss, item, ',')) {
            if (!item.empty()) nums.push_back(std::stoi(item));
        }

        ListNode dummy(0);
        ListNode* tail = &dummy;
        for (int v : nums) {
            tail->next = new ListNode(v);
            tail = tail->next;
        }

        ListNode* rev = reverseList(dummy.next);
        std::cout << "[";
        bool first = true;
        while (rev) {
            if (!first) std::cout << ", ";
            std::cout << rev->val;
            first = false;
            rev = rev->next;
        }
        std::cout << "]" << std::endl;
    }
    return 0;
}
`,
    testCases: [
      { id: 'tc_1', input: '[1, 2, 3, 4, 5]', expectedOutput: '[5, 4, 3, 2, 1]', visibility: 'public', weight: 25, timeoutMs: 2000, memoryLimitMb: 128 },
      { id: 'tc_2', input: '[1, 2]', expectedOutput: '[2, 1]', visibility: 'public', weight: 25, timeoutMs: 2000, memoryLimitMb: 128 },
      { id: 'tc_3', input: '[]', expectedOutput: '[]', visibility: 'hidden', weight: 25, timeoutMs: 2000, memoryLimitMb: 128 },
      { id: 'tc_4', input: '[100, 200, 300, 400, 500, 600]', expectedOutput: '[600, 500, 400, 300, 200, 100]', visibility: 'hidden', weight: 25, timeoutMs: 2000, memoryLimitMb: 128 },
    ]
  },
  {
    name: 'Valid Parentheses (C++)',
    badge: 'Stack • Strings',
    difficulty: 'Beginner',
    language: 'cpp',
    title: 'Valid Parentheses: Stack Verification',
    description: `Given a string \`s\` containing just the characters \`'('\`, \`')'\`, \`'{'\`, \`'}'\`, \`'['\` and \`']'\`, determine if the input string is valid.`,
    instructions: `### Input Format
A single line containing the string \`s\`.

### Output Format
Print \`true\` if valid, or \`false\` if invalid.

### Constraints
- \`1 <= s.length <= 10^4\`
- \`s\` consists of parentheses only \`'()[]{}'\`.`,
    starterCode: `#include <iostream>
#include <string>
#include <stack>

bool isValid(std::string s) {
    std::stack<char> st;
    for (char c : s) {
        if (c == '(' || c == '{' || c == '[') {
            st.push(c);
        } else {
            if (st.empty()) return false;
            char top = st.top();
            if ((c == ')' && top == '(') ||
                (c == '}' && top == '{') ||
                (c == ']' && top == '[')) {
                st.pop();
            } else {
                return false;
            }
        }
    }
    return st.empty();
}

int main() {
    std::string s;
    if (std::cin >> s) {
        std::cout << (isValid(s) ? "true" : "false") << std::endl;
    }
    return 0;
}
`,
    testCases: [
      { id: 'tc_1', input: '()[]{}', expectedOutput: 'true', visibility: 'public', weight: 25, timeoutMs: 2000, memoryLimitMb: 128 },
      { id: 'tc_2', input: '(]', expectedOutput: 'false', visibility: 'public', weight: 25, timeoutMs: 2000, memoryLimitMb: 128 },
      { id: 'tc_3', input: '([{}])', expectedOutput: 'true', visibility: 'hidden', weight: 25, timeoutMs: 2000, memoryLimitMb: 128 },
      { id: 'tc_4', input: '(((((', expectedOutput: 'false', visibility: 'hidden', weight: 25, timeoutMs: 2000, memoryLimitMb: 128 },
    ]
  },
  {
    name: 'Coin Change (C++)',
    badge: 'Dynamic Programming',
    difficulty: 'Intermediate',
    language: 'cpp',
    title: 'Coin Change: Fewest Coins DP',
    description: `You are given an integer array \`coins\` representing coins of different denominations and an integer \`amount\` representing a total amount of money. Return the fewest number of coins that you need to make up that amount.`,
    instructions: `### Input Format
First line: comma separated coin values \`[1, 2, 5]\`.
Second line: integer \`amount\`.

### Output Format
Fewest coins needed, or \`-1\` if impossible.`,
    starterCode: `#include <iostream>
#include <vector>
#include <sstream>
#include <algorithm>

int coinChange(std::vector<int>& coins, int amount) {
    std::vector<int> dp(amount + 1, amount + 1);
    dp[0] = 0;
    for (int i = 1; i <= amount; ++i) {
        for (int c : coins) {
            if (i - c >= 0) {
                dp[i] = std::min(dp[i], dp[i - c] + 1);
            }
        }
    }
    return dp[amount] > amount ? -1 : dp[amount];
}

int main() {
    std::string line;
    if (std::getline(std::cin, line)) {
        std::vector<int> coins;
        std::string clean = "";
        for (char c : line) {
            if (c != '[' && c != ']' && c != ' ') clean += c;
        }
        std::stringstream ss(clean);
        std::string item;
        while (std::getline(ss, item, ',')) {
            if (!item.empty()) coins.push_back(std::stoi(item));
        }

        int amount = 0;
        if (std::cin >> amount) {
            std::cout << coinChange(coins, amount) << std::endl;
        }
    }
    return 0;
}
`,
    testCases: [
      { id: 'tc_1', input: '[1, 2, 5]\n11', expectedOutput: '3', visibility: 'public', weight: 25, timeoutMs: 2000, memoryLimitMb: 128 },
      { id: 'tc_2', input: '[2]\n3', expectedOutput: '-1', visibility: 'public', weight: 25, timeoutMs: 2000, memoryLimitMb: 128 },
      { id: 'tc_3', input: '[1]\n0', expectedOutput: '0', visibility: 'hidden', weight: 25, timeoutMs: 2000, memoryLimitMb: 128 },
      { id: 'tc_4', input: '[1, 2, 5, 10, 20, 50]\n99', expectedOutput: '6', visibility: 'hidden', weight: 25, timeoutMs: 2000, memoryLimitMb: 128 },
    ]
  }
];

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
  const [language, setLanguage] = useState('cpp');
  const [difficulty, setDifficulty] = useState('Beginner');
  const [starterCode, setStarterCode] = useState('');
  const [maxMarks, setMaxMarks] = useState(100);
  const [attemptsAllowed, setAttemptsAllowed] = useState(5);
  const [aiPolicy, setAiPolicy] = useState('hints_only');
  const [plagiarismPolicy, setPlagiarismPolicy] = useState('review_only');
  
  const [testCases, setTestCases] = useState<any[]>([
    { id: 'tc_1', input: '', expectedOutput: '', visibility: 'public', weight: 50, timeoutMs: 2000, memoryLimitMb: 128 },
    { id: 'tc_2', input: '', expectedOutput: '', visibility: 'hidden', weight: 50, timeoutMs: 2000, memoryLimitMb: 128 }
  ]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    params.then(p => {
      setRoomId(p.roomId);
      setAsgId(p.asgId);
      
      if (p.asgId !== 'new') {
        fetch(`/api/v1/classrooms/${p.roomId}/assignments/${p.asgId}`)
          .then(res => res.json())
          .then(data => {
            if (data.assignment) {
              const a = data.assignment;
              setTitle(a.title || '');
              setDescription(a.description || '');
              setInstructions(a.instructions || '');
              setLanguage(a.language || 'cpp');
              setDifficulty(a.difficulty || 'Beginner');
              setStarterCode(a.starterCode || '');
              setMaxMarks(a.maxMarks || 100);
              setAttemptsAllowed(a.attemptsAllowed || 5);
              setAiPolicy(a.aiPolicy || 'hints_only');
              setPlagiarismPolicy(a.plagiarismPolicy || 'review_only');
              if (a.testCases && a.testCases.length > 0) {
                setTestCases(a.testCases);
              }
            }
          });
      }
    });
  }, [params]);

  const applyTemplate = (tpl: typeof DSA_TEMPLATES[0]) => {
    setTitle(tpl.title);
    setDescription(tpl.description);
    setInstructions(tpl.instructions);
    setLanguage(tpl.language);
    setDifficulty(tpl.difficulty);
    setStarterCode(tpl.starterCode);
    setTestCases(tpl.testCases);
    setMaxMarks(100);
    setImportNotice(`Loaded template: ${tpl.name}`);
    setTimeout(() => setImportNotice(null), 3500);
  };

  const handleExportJson = () => {
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
      testCases
    };
    const jsonStr = JSON.stringify(payload, null, 2);
    
    // Trigger download
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'assignment').toLowerCase().replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (text: string) => {
    try {
      const data = JSON.parse(text);
      if (data.title) setTitle(data.title);
      if (data.description) setDescription(data.description);
      if (data.instructions) setInstructions(data.instructions);
      if (data.language) setLanguage(data.language);
      if (data.difficulty) setDifficulty(data.difficulty);
      if (data.starterCode) setStarterCode(data.starterCode);
      if (data.maxMarks) setMaxMarks(Number(data.maxMarks));
      if (data.attemptsAllowed) setAttemptsAllowed(Number(data.attemptsAllowed));
      if (data.aiPolicy) setAiPolicy(data.aiPolicy);
      if (data.plagiarismPolicy) setPlagiarismPolicy(data.plagiarismPolicy);
      if (Array.isArray(data.testCases) && data.testCases.length > 0) {
        setTestCases(data.testCases);
      }
      setShowImportModal(false);
      setImportNotice("Assignment successfully loaded from JSON file!");
      setTimeout(() => setImportNotice(null), 3500);
    } catch (e: any) {
      alert("Invalid JSON format. Please verify the JSON syntax and try again.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleImportJson(content);
    };
    reader.readAsText(file);
  };

  const handleSave = async () => {
    if (!title.trim() || !description.trim()) {
      alert("Please provide both an Assignment Title and a Problem Statement");
      return;
    }
    
    const hasExecutable = testCases.some(tc => (tc.expectedOutput || '').trim() !== '');
    if (!hasExecutable) {
      alert("At least one testcase with expected output is required for autograding");
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (data.success || data.assignment) {
        router.push(`/classroom`);
      } else {
        alert(data.error || "Failed to publish assignment");
      }
    } catch (err) {
      console.error(err);
      alert("Connection error occurred while saving");
    } finally {
      setIsSaving(false);
    }
  };

  const addTestCase = (visibility: 'public' | 'hidden' = 'public') => {
    setTestCases([
      ...testCases, 
      { 
        id: `tc_${Date.now()}`, 
        input: '', 
        expectedOutput: '', 
        visibility, 
        weight: 25, 
        timeoutMs: 2000, 
        memoryLimitMb: 128 
      }
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
    <div className="min-h-screen flex flex-col bg-[#000000] bg-monochrome-dotted text-white font-sans select-none relative">
      <div className="absolute inset-0 bg-[#000000]/60 pointer-events-none z-0"></div>
      {/* Header */}
      <header className="h-16 shrink-0 bg-black/90 backdrop-blur border-b border-[#252830] px-6 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => router.push(`/classroom`)} 
            className="p-2 hover:bg-[#1e2026] text-zinc-400 hover:text-white rounded-lg transition"
            title="Back to Classroom"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center space-x-3">
            <CortexLogo size="sm" variant="icon" />
            <div>
              <h1 className="text-sm md:text-base font-bold text-zinc-100 flex items-center space-x-2">
                <span>{asgId === 'new' ? 'Teacher Assignment Studio' : 'Edit Assignment'}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                  {asgId === 'new' ? 'NEW' : asgId}
                </span>
              </h1>
              <p className="text-[11px] text-zinc-500 font-mono">Create, test, and assign coding challenges to students</p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          {/* Quick Import Modal Trigger */}
          <button
            onClick={() => setShowImportModal(true)}
            className="cyber-btn-ring cyber-btn-silver active:scale-95 transition"
            title="Import an assignment from a JSON file or text"
          >
            <div className="cyber-btn-inner px-3 py-1.5 text-xs font-mono font-bold flex items-center space-x-1.5">
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span>Import JSON</span>
            </div>
          </button>

          {/* Quick Export JSON */}
          <button
            onClick={handleExportJson}
            className="cyber-btn-ring cyber-btn-silver active:scale-95 transition"
            title="Export this assignment to JSON"
          >
            <div className="cyber-btn-inner px-3 py-1.5 text-xs font-mono font-bold flex items-center space-x-1.5">
              <Download className="w-3.5 h-3.5 text-zinc-300" />
              <span>Export</span>
            </div>
          </button>

          {/* Save / Publish Button */}
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="cyber-btn-ring cyber-btn-emerald active:scale-95 transition shadow-lg shadow-emerald-950/40 disabled:opacity-50"
          >
            <div className="cyber-btn-inner px-5 py-1.5 text-xs font-mono font-bold flex items-center space-x-2">
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Publishing...' : 'Publish Assignment'}</span>
            </div>
          </button>
        </div>
      </header>

      {/* Floating Notice Banner */}
      {importNotice && (
        <div className="bg-emerald-950/90 border-b border-emerald-800 px-6 py-2.5 flex items-center justify-between text-xs font-mono text-emerald-300 transition-all">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{importNotice}</span>
          </div>
          <button onClick={() => setImportNotice(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Main Form Body */}
      <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar relative z-10">
        <div className="max-w-5xl mx-auto space-y-8">

          {/* SECTION 1: 1-Click DSA Template Picker */}
          <section className="p-5 bg-gradient-to-r from-emerald-950/20 via-zinc-900/60 to-zinc-900/40 border border-emerald-900/40 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Quick-Start DSA Problem Catalog (1-Click Load)
                </h3>
              </div>
              <span className="text-[11px] font-mono text-zinc-500">Click any card to pre-fill test cases & solution</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
              {DSA_TEMPLATES.map((tpl, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => applyTemplate(tpl)}
                  className="p-3 bg-[#13141a] hover:bg-[#1c1d25] border border-zinc-800 hover:border-emerald-700/60 rounded-xl text-left transition group active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 group-hover:text-emerald-400 border border-zinc-800">
                      {tpl.language.toUpperCase()}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-400">{tpl.difficulty}</span>
                  </div>
                  <div className="text-xs font-bold text-white group-hover:text-emerald-300 truncate">
                    {tpl.name}
                  </div>
                  <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                    {tpl.badge}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* SECTION 2: Problem Metadata */}
          <section className="p-6 bg-[#111217] border border-[#252830] rounded-2xl space-y-5">
            <div className="flex items-center space-x-2 border-b border-[#252830] pb-3">
              <Settings className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200">Problem Metadata</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">Assignment Title</label>
                <input 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Reverse Linked List: In-Place Pointers"
                  className="w-full bg-[#16171f] border border-[#2b2e38] rounded-xl px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5">Programming Language</label>
                  <select 
                    value={language} 
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-[#16171f] border border-[#2b2e38] rounded-xl px-3 py-2.5 text-white text-sm focus:border-emerald-500 outline-none"
                  >
                    <option value="cpp">C++ (GCC 14.1)</option>
                    <option value="python">Python 3.12</option>
                    <option value="javascript">JavaScript (Node 20)</option>
                    <option value="typescript">TypeScript 5.4</option>
                    <option value="java">Java 21</option>
                    <option value="c">C (Clang)</option>
                    <option value="go">Go 1.22</option>
                    <option value="rust">Rust 1.78</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5">Difficulty Level</label>
                  <select 
                    value={difficulty} 
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full bg-[#16171f] border border-[#2b2e38] rounded-xl px-3 py-2.5 text-white text-sm focus:border-emerald-500 outline-none"
                  >
                    <option value="Beginner">Beginner (Easy)</option>
                    <option value="Intermediate">Intermediate (Medium)</option>
                    <option value="Advanced">Advanced (Hard)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5">Total Marks / Points</label>
                  <input 
                    type="number"
                    value={maxMarks} 
                    onChange={(e) => setMaxMarks(Number(e.target.value))}
                    className="w-full bg-[#16171f] border border-[#2b2e38] rounded-xl px-3 py-2.5 text-white text-sm focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3: Problem Statement & Instructions */}
          <section className="p-6 bg-[#111217] border border-[#252830] rounded-2xl space-y-5">
            <div className="flex items-center space-x-2 border-b border-[#252830] pb-3">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200">Problem Statement & Instructions</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">Short Problem Summary</label>
                <textarea 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="A one-sentence summary shown on the classroom assignment card..."
                  className="w-full bg-[#16171f] border border-[#2b2e38] rounded-xl px-4 py-2.5 text-white text-sm focus:border-cyan-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">
                  Detailed Instructions, Constraints & Markdown Examples
                </label>
                <textarea 
                  value={instructions} 
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={8}
                  placeholder="Write full markdown description, examples, input/output specifications, and constraints..."
                  className="w-full bg-[#16171f] border border-[#2b2e38] rounded-xl p-4 text-zinc-200 text-xs font-mono leading-relaxed focus:border-cyan-500 outline-none"
                />
              </div>
            </div>
          </section>

          {/* SECTION 4: Starter Code & Driver Harness */}
          <section className="p-6 bg-[#111217] border border-[#252830] rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#252830] pb-3">
              <div className="flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200">Starter Code & Driver Harness</h2>
              </div>
              <span className="text-[11px] text-zinc-500 font-mono">Pre-loaded in student code editor</span>
            </div>

            <textarea 
              value={starterCode} 
              onChange={(e) => setStarterCode(e.target.value)}
              rows={12}
              placeholder="# Enter the solution template or driver harness that reads stdin..."
              className="w-full bg-black border border-[#2b2e38] rounded-xl p-4 text-zinc-200 text-xs font-mono leading-relaxed focus:border-emerald-500 outline-none"
              spellCheck={false}
            />
          </section>

          {/* SECTION 5: Test Cases Engine (Public + Hidden) */}
          <section className="p-6 bg-[#111217] border border-[#252830] rounded-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#252830] pb-3">
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-cyan-400" />
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200">
                    Grading & Test Cases Suite ({testCases.length})
                  </h2>
                  <p className="text-[11px] text-zinc-500 font-mono">
                    {testCases.filter(t => t.visibility === 'public').length} Visible • {testCases.filter(t => t.visibility === 'hidden').length} Hidden (Anti-Cheat)
                  </p>
                </div>
              </div>

              {/* Add Case Buttons */}
              <div className="flex items-center space-x-2">
                <button 
                  type="button"
                  onClick={() => addTestCase('public')}
                  className="px-3 py-1.5 bg-cyan-950/40 hover:bg-cyan-900/50 text-cyan-300 border border-cyan-800/60 rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 transition active:scale-95"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>+ Public Test</span>
                </button>

                <button 
                  type="button"
                  onClick={() => addTestCase('hidden')}
                  className="px-3 py-1.5 bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 border border-amber-800/60 rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 transition active:scale-95"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>+ Hidden Test</span>
                </button>
              </div>
            </div>

            {/* Test Case Cards */}
            <div className="space-y-4">
              {testCases.map((tc, idx) => {
                const isHidden = tc.visibility === 'hidden';
                return (
                  <div 
                    key={idx} 
                    className={`p-4 rounded-xl border transition space-y-3 ${
                      isHidden 
                        ? 'bg-amber-950/10 border-amber-900/40' 
                        : 'bg-[#15161d] border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs font-bold flex items-center space-x-1.5 ${isHidden ? 'text-amber-300' : 'text-zinc-200'}`}>
                          {isHidden ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5 text-cyan-400" />}
                          <span>Test Case #{idx + 1}</span>
                        </span>

                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${
                          isHidden 
                            ? 'bg-amber-950/60 text-amber-300 border-amber-800/60' 
                            : 'bg-cyan-950/60 text-cyan-300 border-cyan-800/60'
                        }`}>
                          {isHidden ? 'Hidden (Final Grade)' : 'Public (Student Can Run)'}
                        </span>
                      </div>

                      <div className="flex items-center space-x-3">
                        <select 
                          value={tc.visibility} 
                          onChange={(e) => updateTestCase(idx, 'visibility', e.target.value)}
                          className="bg-black border border-zinc-700 rounded px-2 py-1 text-[11px] text-zinc-300 outline-none"
                        >
                          <option value="public">Public</option>
                          <option value="hidden">Hidden</option>
                        </select>

                        <button 
                          type="button"
                          onClick={() => removeTestCase(idx)} 
                          className="p-1 text-zinc-500 hover:text-rose-400 transition"
                          title="Delete test case"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-mono text-zinc-400 mb-1">Input (stdin):</label>
                        <textarea 
                          value={tc.input} 
                          onChange={(e) => updateTestCase(idx, 'input', e.target.value)}
                          rows={3}
                          placeholder="e.g. [2, 7, 11, 15]\n9"
                          className="w-full bg-black border border-zinc-800 rounded-lg p-2.5 text-zinc-200 outline-none font-mono text-xs focus:border-zinc-600"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-mono text-zinc-400 mb-1">Expected Output (stdout):</label>
                        <textarea 
                          value={tc.expectedOutput} 
                          onChange={(e) => updateTestCase(idx, 'expectedOutput', e.target.value)}
                          rows={3}
                          placeholder="e.g. [0, 1]"
                          className="w-full bg-black border border-zinc-800 rounded-lg p-2.5 text-emerald-400 outline-none font-mono text-xs focus:border-zinc-600"
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 text-[11px] font-mono text-zinc-400 pt-1 border-t border-zinc-800/60">
                      <div className="flex items-center space-x-1.5">
                        <span>Weight:</span>
                        <input 
                          type="number" 
                          value={tc.weight || 25} 
                          onChange={(e) => updateTestCase(idx, 'weight', Number(e.target.value))}
                          className="w-14 bg-black border border-zinc-800 rounded px-1.5 py-0.5 text-white text-center"
                        />
                        <span>pts</span>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <span>Timeout:</span>
                        <input 
                          type="number" 
                          value={tc.timeoutMs || 2000} 
                          onChange={(e) => updateTestCase(idx, 'timeoutMs', Number(e.target.value))}
                          className="w-16 bg-black border border-zinc-800 rounded px-1.5 py-0.5 text-white text-center"
                        />
                        <span>ms</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* SECTION 6: Policies */}
          <section className="p-6 bg-[#111217] border border-[#252830] rounded-2xl space-y-4">
            <div className="flex items-center space-x-2 border-b border-[#252830] pb-3">
              <Clock className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200">Execution Policies & Attempt Limits</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">Submission Limit</label>
                <input 
                  type="number" 
                  value={attemptsAllowed} 
                  onChange={(e) => setAttemptsAllowed(Number(e.target.value))}
                  className="w-full bg-[#16171f] border border-[#2b2e38] rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">AI Assistance</label>
                <select 
                  value={aiPolicy} 
                  onChange={(e) => setAiPolicy(e.target.value)}
                  className="w-full bg-[#16171f] border border-[#2b2e38] rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                >
                  <option value="hints_only">Hints Only</option>
                  <option value="explain_only">Explain Errors Only</option>
                  <option value="disabled">Disabled</option>
                  <option value="full">Full Assistance</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">Plagiarism Engine</label>
                <select 
                  value={plagiarismPolicy} 
                  onChange={(e) => setPlagiarismPolicy(e.target.value)}
                  className="w-full bg-[#16171f] border border-[#2b2e38] rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                >
                  <option value="review_only">Flag for Review</option>
                  <option value="strict">Strict Rejection</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
            </div>
          </section>

        </div>
      </div>

      {/* Import / Upload Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#111217] border border-zinc-700 rounded-2xl shadow-2xl p-6 space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2">
                <Upload className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Import Assignment (JSON)</h3>
              </div>
              <button 
                onClick={() => setShowImportModal(false)}
                className="text-zinc-500 hover:text-white p-1 rounded"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Upload a valid Cortex or standard JSON assignment file, or paste raw JSON directly into the box below. All fields, instructions, starter code, and test cases will be populated automatically.
            </p>

            {/* File Upload Box */}
            <div className="p-4 bg-black/60 border border-dashed border-zinc-700 hover:border-cyan-500 rounded-xl text-center cursor-pointer transition">
              <input 
                type="file" 
                ref={fileInputRef} 
                accept=".json" 
                onChange={handleFileUpload} 
                className="hidden" 
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-mono text-cyan-400 hover:underline flex items-center justify-center space-x-2 mx-auto"
              >
                <Upload className="w-4 h-4" />
                <span>Choose .json file from your computer</span>
              </button>
            </div>

            {/* Paste Raw JSON */}
            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-1">Or paste raw JSON:</label>
              <textarea 
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                rows={6}
                placeholder="{\n  &quot;title&quot;: &quot;...&quot;,\n  &quot;starterCode&quot;: &quot;...&quot;,\n  &quot;testCases&quot;: [...]\n}"
                className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-xs font-mono text-zinc-200 outline-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleImportJson(importJsonText)}
                disabled={!importJsonText.trim()}
                className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-xs font-bold text-black transition shadow"
              >
                Load Assignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
