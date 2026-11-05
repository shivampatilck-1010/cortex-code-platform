import React, { useState, useEffect } from 'react';
import { Assignment, TestCase, RubricCriterion, AssignmentDifficulty, AssignmentStatus } from '@/types/assignments';
import { X, Plus, Trash2, AlertCircle } from 'lucide-react';

interface AssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignmentToEdit?: Assignment | null;
  onSave: (saved: Assignment) => void;
}

export const AssignmentModal: React.FC<AssignmentModalProps> = ({
  isOpen,
  onClose,
  assignmentToEdit,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [points, setPoints] = useState(100);
  const [difficulty, setDifficulty] = useState<AssignmentDifficulty>('Medium');
  const [category, setCategory] = useState('Algorithms');
  const [status, setStatus] = useState<AssignmentStatus>('published');
  const [dueTime, setDueTime] = useState('End of Lecture (Today 16:30)');
  const [starterLanguage, setStarterLanguage] = useState('C++17');
  const [starterCode, setStarterCode] = useState('');
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [rubricCriteria, setRubricCriteria] = useState<RubricCriterion[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (assignmentToEdit) {
      setTitle(assignmentToEdit.title);
      setDescription(assignmentToEdit.description);
      setInstructions(assignmentToEdit.instructions || '');
      setPoints(assignmentToEdit.points);
      setDifficulty(assignmentToEdit.difficulty);
      setCategory(assignmentToEdit.category || 'Algorithms');
      setStatus(assignmentToEdit.status);
      setDueTime(assignmentToEdit.dueTime);
      setStarterLanguage(assignmentToEdit.starterLanguage);
      setStarterCode(assignmentToEdit.starterCode);
      setTestCases(assignmentToEdit.testCases ? [...assignmentToEdit.testCases] : []);
      setRubricCriteria(assignmentToEdit.rubricCriteria ? [...assignmentToEdit.rubricCriteria] : []);
    } else {
      setTitle('');
      setDescription('');
      setInstructions('');
      setPoints(100);
      setDifficulty('Medium');
      setCategory('Algorithms');
      setStatus('published');
      setDueTime('End of Lecture (Today 16:30)');
      setStarterLanguage('TypeScript');
      setStarterCode('// Write your solution here\n');
      setTestCases([
        { id: 1, name: 'Sample Case', input: 'solve([1, 2, 3])', expectedOutput: '[1, 2, 3]', runtimeMs: 5 },
      ]);
      setRubricCriteria([
        { id: 'crit-1', title: 'Algorithmic Invariant', maxPoints: 60, description: 'Correct logic and guarantees.' },
        { id: 'crit-2', title: 'Code Cleanliness', maxPoints: 40, description: 'Modular readable structure.' },
      ]);
    }
    setErrors({});
  }, [assignmentToEdit, isOpen]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = 'Title is required';
    if (!description.trim()) errs.description = 'Description is required';
    if (points <= 0) errs.points = 'Points must be greater than 0';
    if (testCases.length === 0) errs.testCases = 'At least one test case is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAddTestCase = () => {
    const nextId = testCases.length > 0 ? Math.max(...testCases.map((t) => t.id)) + 1 : 1;
    setTestCases([
      ...testCases,
      { id: nextId, name: `Test Case #${nextId}`, input: 'testInput()', expectedOutput: 'expectedResult', runtimeMs: 5 },
    ]);
  };

  const handleRemoveTestCase = (id: number) => {
    if (testCases.length <= 1) return;
    setTestCases(testCases.filter((t) => t.id !== id));
  };

  const handleUpdateTestCase = (id: number, field: keyof TestCase, val: any) => {
    setTestCases(testCases.map((tc) => (tc.id === id ? { ...tc, [field]: val } : tc)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const saved: Assignment = {
      id: assignmentToEdit ? assignmentToEdit.id : `assignment_${Date.now().toString(36)}`,
      title: title.trim(),
      description: description.trim(),
      instructions: instructions.trim(),
      points: Number(points),
      difficulty,
      category: category.trim() || 'Algorithms',
      status,
      dueTime: dueTime.trim(),
      starterLanguage,
      starterCode,
      testCases,
      rubricCriteria,
      createdAt: assignmentToEdit ? assignmentToEdit.createdAt : Date.now(),
      updatedAt: Date.now(),
    };

    onSave(saved);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div
        className="w-full max-w-2xl rounded-xl border border-[#282A36] bg-[#111216] shadow-2xl flex flex-col my-8 max-h-[90vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assignment-modal-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#282A36] bg-[#0B0C0E]">
          <h2 id="assignment-modal-title" className="text-sm font-semibold text-white">
            {assignmentToEdit ? 'Edit Coding Lab Assignment' : 'Create New Coding Lab Assignment'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#71717A] hover:text-white hover:bg-[#1D1F27] transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Title */}
          <div>
            <label htmlFor="assignment-title" className="block text-[11px] font-semibold text-[#A1A1AA] mb-1">
              Assignment Title *
            </label>
            <input
              id="assignment-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Lab 06: B-Tree Splitting and Search"
              className={`w-full px-3 py-2 rounded-lg bg-[#0B0C0E] border text-white text-xs focus:outline-none transition-colors ${
                errors.title ? 'border-[#EF4444] focus:border-[#EF4444]' : 'border-[#282A36] focus:border-[#06B6D4]'
              }`}
            />
            {errors.title && <span className="text-[10px] text-[#EF4444] mt-1 block">{errors.title}</span>}
          </div>

          {/* Grid: Difficulty, Language, Points, Status */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label htmlFor="assignment-diff" className="block text-[11px] font-semibold text-[#A1A1AA] mb-1">
                Difficulty
              </label>
              <select
                id="assignment-diff"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as AssignmentDifficulty)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#0B0C0E] border border-[#282A36] text-white text-xs focus:border-[#06B6D4] focus:outline-none"
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            <div>
              <label htmlFor="assignment-lang" className="block text-[11px] font-semibold text-[#A1A1AA] mb-1">
                Language
              </label>
              <select
                id="assignment-lang"
                value={starterLanguage}
                onChange={(e) => setStarterLanguage(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#0B0C0E] border border-[#282A36] text-white text-xs focus:border-[#06B6D4] focus:outline-none"
              >
                <option value="C++17">C++17</option>
                <option value="Python 3.11">Python 3.11</option>
                <option value="TypeScript">TypeScript</option>
                <option value="JavaScript">JavaScript</option>
                <option value="Rust">Rust</option>
              </select>
            </div>

            <div>
              <label htmlFor="assignment-points" className="block text-[11px] font-semibold text-[#A1A1AA] mb-1">
                Points *
              </label>
              <input
                id="assignment-points"
                type="number"
                min="1"
                max="1000"
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#0B0C0E] border border-[#282A36] text-white text-xs focus:border-[#06B6D4] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="assignment-status" className="block text-[11px] font-semibold text-[#A1A1AA] mb-1">
                Status
              </label>
              <select
                id="assignment-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as AssignmentStatus)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#0B0C0E] border border-[#282A36] text-white text-xs focus:border-[#06B6D4] focus:outline-none"
              >
                <option value="published">Published</option>
                <option value="draft">Draft (Hidden)</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          {/* Due Time */}
          <div>
            <label htmlFor="assignment-duetime" className="block text-[11px] font-semibold text-[#A1A1AA] mb-1">
              Due Deadline Label
            </label>
            <input
              id="assignment-duetime"
              type="text"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              placeholder="e.g. End of Lecture (Today 16:30)"
              className="w-full px-3 py-1.5 rounded-lg bg-[#0B0C0E] border border-[#282A36] text-white text-xs focus:border-[#06B6D4] focus:outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="assignment-desc" className="block text-[11px] font-semibold text-[#A1A1AA] mb-1">
              Problem Description *
            </label>
            <textarea
              id="assignment-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detail the algorithmic invariant and problem constraints..."
              className={`w-full px-3 py-2 rounded-lg bg-[#0B0C0E] border text-white text-xs focus:outline-none transition-colors ${
                errors.description ? 'border-[#EF4444]' : 'border-[#282A36] focus:border-[#06B6D4]'
              }`}
            />
          </div>

          {/* Instructions */}
          <div>
            <label htmlFor="assignment-inst" className="block text-[11px] font-semibold text-[#A1A1AA] mb-1">
              Detailed Implementation Instructions
            </label>
            <textarea
              id="assignment-inst"
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Step 1: Check root invariant&#10;Step 2: Balance subtrees..."
              className="w-full px-3 py-2 rounded-lg bg-[#0B0C0E] border border-[#282A36] text-white text-xs font-mono focus:border-[#06B6D4] focus:outline-none"
            />
          </div>

          {/* Starter Code */}
          <div>
            <label htmlFor="assignment-code" className="block text-[11px] font-semibold text-[#A1A1AA] mb-1">
              Starter Code Template
            </label>
            <textarea
              id="assignment-code"
              rows={5}
              value={starterCode}
              onChange={(e) => setStarterCode(e.target.value)}
              placeholder="// Starter boilerplate code provided to students..."
              className="w-full px-3 py-2 rounded-lg bg-[#07080A] border border-[#282A36] text-[#E4E4E7] text-xs font-mono focus:border-[#06B6D4] focus:outline-none"
            />
          </div>

          {/* Test Cases */}
          <div className="pt-2 border-t border-[#282A36]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-white uppercase tracking-wider">
                Automated Test Cases ({testCases.length})
              </span>
              <button
                type="button"
                onClick={handleAddTestCase}
                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#06B6D4]/15 hover:bg-[#06B6D4]/25 text-[#06B6D4] text-[11px] font-semibold transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>Add Test Case</span>
              </button>
            </div>

            <div className="space-y-2">
              {testCases.map((tc, idx) => (
                <div key={tc.id} className="p-2.5 rounded-lg bg-[#0B0C0E] border border-[#282A36] flex items-center space-x-2">
                  <span className="text-[10px] font-mono text-[#71717A] w-6 shrink-0">#{idx + 1}</span>
                  <input
                    type="text"
                    value={tc.input}
                    onChange={(e) => handleUpdateTestCase(tc.id, 'input', e.target.value)}
                    placeholder="Input invocation"
                    className="flex-1 px-2 py-1 rounded bg-[#15161C] border border-[#282A36] text-white text-xs font-mono"
                  />
                  <input
                    type="text"
                    value={tc.expectedOutput}
                    onChange={(e) => handleUpdateTestCase(tc.id, 'expectedOutput', e.target.value)}
                    placeholder="Expected Output"
                    className="flex-1 px-2 py-1 rounded bg-[#15161C] border border-[#282A36] text-[#06B6D4] text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveTestCase(tc.id)}
                    disabled={testCases.length <= 1}
                    className="p-1 rounded text-[#71717A] hover:text-[#EF4444] disabled:opacity-30 transition-colors"
                    title="Remove test case"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            {errors.testCases && (
              <span className="text-[10px] text-[#EF4444] mt-1 flex items-center space-x-1">
                <AlertCircle className="w-3 h-3" />
                <span>{errors.testCases}</span>
              </span>
            )}
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-[#282A36] flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#282A36] hover:bg-[#383A46] text-white text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#FF9100] hover:bg-[#E08000] text-black font-semibold text-xs transition-colors"
            >
              {assignmentToEdit ? 'Save Changes' : 'Create Assignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
