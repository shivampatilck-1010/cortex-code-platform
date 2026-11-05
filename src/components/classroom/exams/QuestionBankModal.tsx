'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit3,
  Copy,
  Archive,
  RefreshCw,
  Search,
  BookOpen,
  Code2,
  HelpCircle,
  CheckCircle,
  AlertCircle,
  Tag,
  Save,
  Check,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { QuestionBankItem, QuestionBankDifficulty, ExamQuestionType, ExamOption, ExamQuestionTestCase } from '@/lib/classroom/models';

interface QuestionBankModalProps {
  onClose: () => void;
  pickerMode?: boolean;
  onImportToExam?: (bankItem: QuestionBankItem, pointsOverride?: number) => Promise<void>;
}

export function QuestionBankModal({ onClose, pickerMode = false, onImportToExam }: QuestionBankModalProps) {
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedTopic, setSelectedTopic] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [includeArchived, setIncludeArchived] = useState(false);

  // Authoring Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formSubject, setFormSubject] = useState('Computer Science');
  const [formTopic, setFormTopic] = useState('Algorithms');
  const [formDifficulty, setFormDifficulty] = useState<QuestionBankDifficulty>('medium');
  const [formType, setFormType] = useState<ExamQuestionType>('mcq_single');
  const [formPrompt, setFormPrompt] = useState('');
  const [formPoints, setFormPoints] = useState(1.0);
  const [formNegativeMarks, setFormNegativeMarks] = useState(0.0);
  const [formTolerance, setFormTolerance] = useState(0.0);
  const [formTags, setFormTags] = useState('dsa, general');

  // Question specific fields
  const [mcqOptions, setMcqOptions] = useState<ExamOption[]>([
    { id: 'opt_1', text: 'Option A' },
    { id: 'opt_2', text: 'Option B' },
    { id: 'opt_3', text: 'Option C' },
    { id: 'opt_4', text: 'Option D' },
  ]);
  const [singleCorrect, setSingleCorrect] = useState('opt_1');
  const [multipleCorrect, setMultipleCorrect] = useState<string[]>(['opt_1']);
  const [tfAnswer, setTfAnswer] = useState(true);
  const [shortAnswerStr, setShortAnswerStr] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [manualGrading, setManualGrading] = useState(false);
  const [codeLanguage, setCodeLanguage] = useState('python');
  const [starterCode, setStarterCode] = useState('def solution():\n    # Implement solution\n    pass\n');
  const [sampleInput, setSampleInput] = useState('5\n');
  const [sampleOutput, setSampleOutput] = useState('10\n');
  const [hiddenInput, setHiddenInput] = useState('100\n');
  const [hiddenOutput, setHiddenOutput] = useState('200\n');

  // Importing state for picker mode
  const [importingId, setImportingId] = useState<string | null>(null);
  const [pointsOverrides, setPointsOverrides] = useState<Record<string, number>>({});

  const fetchQuestions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (selectedSubject !== 'all') params.set('subject', selectedSubject);
      if (selectedTopic !== 'all') params.set('topic', selectedTopic);
      if (selectedDifficulty !== 'all') params.set('difficulty', selectedDifficulty);
      if (selectedType !== 'all') params.set('questionType', selectedType);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (includeArchived) params.set('includeArchived', 'true');

      const res = await fetch(`/api/v1/question-bank?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load question bank');
      }
      const data = await res.json();
      setQuestions(data.questions || []);
    } catch (err: any) {
      setError(err?.message || 'Error fetching question bank');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [selectedSubject, selectedTopic, selectedDifficulty, selectedType, includeArchived]);

  // Handle Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchQuestions();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const uniqueSubjects = Array.from(new Set(questions.map((q) => q.subject).filter(Boolean)));
  const uniqueTopics = Array.from(new Set(questions.map((q) => q.topic).filter(Boolean)));

  const resetForm = () => {
    setEditingId(null);
    setFormSubject('Computer Science');
    setFormTopic('Algorithms');
    setFormDifficulty('medium');
    setFormType('mcq_single');
    setFormPrompt('');
    setFormPoints(1.0);
    setFormNegativeMarks(0.0);
    setFormTolerance(0.0);
    setFormTags('dsa, algorithms');
    setMcqOptions([
      { id: 'opt_1', text: 'Option A' },
      { id: 'opt_2', text: 'Option B' },
      { id: 'opt_3', text: 'Option C' },
      { id: 'opt_4', text: 'Option D' },
    ]);
    setSingleCorrect('opt_1');
    setMultipleCorrect(['opt_1']);
    setTfAnswer(true);
    setShortAnswerStr('');
    setCaseSensitive(false);
    setManualGrading(false);
    setCodeLanguage('python');
    setStarterCode('def solution():\n    # Implement solution\n    pass\n');
    setSampleInput('5\n');
    setSampleOutput('10\n');
    setHiddenInput('100\n');
    setHiddenOutput('200\n');
  };

  const openEditForm = (item: QuestionBankItem) => {
    setEditingId(item.id);
    setFormSubject(item.subject);
    setFormTopic(item.topic);
    setFormDifficulty(item.difficulty);
    setFormType(item.questionType);
    setFormPrompt(item.promptText);
    setFormPoints(item.defaultPoints);
    setFormNegativeMarks(item.negativeMarks || 0.0);
    setFormTolerance(item.numericalTolerance || 0.0);
    setFormTags((item.tags || []).join(', '));

    if (item.options && item.options.length > 0) {
      setMcqOptions(item.options);
    }
    if (item.correctAnswer) {
      if (item.questionType === 'mcq_single' && item.correctAnswer.correctOptionId) {
        setSingleCorrect(item.correctAnswer.correctOptionId);
      } else if (item.questionType === 'mcq_multiple' && Array.isArray(item.correctAnswer.correctOptionIds)) {
        setMultipleCorrect(item.correctAnswer.correctOptionIds);
      } else if (item.questionType === 'true_false' && typeof item.correctAnswer.correctAnswer === 'boolean') {
        setTfAnswer(item.correctAnswer.correctAnswer);
      } else if (item.questionType === 'short_answer') {
        const acc = item.correctAnswer.acceptedAnswers || [];
        setShortAnswerStr(acc.join(', '));
        setCaseSensitive(!!item.correctAnswer.caseSensitive);
        setManualGrading(!!item.correctAnswer.manualGrading);
      }
    }
    if (item.questionType === 'programming') {
      setCodeLanguage(item.language || 'python');
      setStarterCode(item.initialCode || '');
      const testCases = item.testCases || [];
      const sample = testCases.find((tc) => !tc.isHidden);
      const hidden = testCases.find((tc) => tc.isHidden);
      if (sample) {
        setSampleInput(sample.input);
        setSampleOutput(sample.expectedOutput);
      }
      if (hidden) {
        setHiddenInput(hidden.input);
        setHiddenOutput(hidden.expectedOutput);
      }
    }

    setIsFormOpen(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPrompt.trim()) {
      setError('Please provide question prompt text');
      return;
    }

    let correctAnswer: any = {};
    let testCases: ExamQuestionTestCase[] = [];

    if (formType === 'mcq_single') {
      correctAnswer = { correctOptionId: singleCorrect };
    } else if (formType === 'mcq_multiple') {
      correctAnswer = { correctOptionIds: multipleCorrect, partialCredit: true };
    } else if (formType === 'true_false') {
      correctAnswer = { correctAnswer: tfAnswer };
    } else if (formType === 'short_answer') {
      const accepted = shortAnswerStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      correctAnswer = {
        acceptedAnswers: accepted.length > 0 ? accepted : [formPrompt.trim()],
        caseSensitive,
        manualGrading,
      };
    } else if (formType === 'programming') {
      testCases = [
        { id: 'tc_sample', input: sampleInput, expectedOutput: sampleOutput, isHidden: false, points: formPoints * 0.4 },
        { id: 'tc_hidden', input: hiddenInput, expectedOutput: hiddenOutput, isHidden: true, points: formPoints * 0.6 },
      ];
    }

    const tags = formTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      subject: formSubject.trim() || 'General',
      topic: formTopic.trim() || 'General',
      difficulty: formDifficulty,
      questionType: formType,
      promptText: formPrompt.trim(),
      options: formType.startsWith('mcq_') ? mcqOptions : [],
      correctAnswer,
      testCases: formType === 'programming' ? testCases : [],
      initialCode: formType === 'programming' ? starterCode : null,
      language: formType === 'programming' ? codeLanguage : null,
      defaultPoints: Number(formPoints),
      negativeMarks: Number(formNegativeMarks),
      numericalTolerance: Number(formTolerance),
      tags,
    };

    try {
      setError(null);
      let res;
      if (editingId) {
        res = await fetch(`/api/v1/question-bank/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/v1/question-bank', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save question');
      }

      setSuccessMessage(editingId ? 'Question updated successfully' : 'Question added to Question Bank');
      setTimeout(() => setSuccessMessage(null), 3000);
      setIsFormOpen(false);
      resetForm();
      await fetchQuestions();
    } catch (err: any) {
      setError(err?.message || 'Error saving question');
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      setError(null);
      const res = await fetch(`/api/v1/question-bank/${id}/duplicate`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to duplicate question');
      }
      setSuccessMessage('Question duplicated successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchQuestions();
    } catch (err: any) {
      setError(err?.message || 'Error duplicating question');
    }
  };

  const handleArchive = async (id: string) => {
    try {
      setError(null);
      const res = await fetch(`/api/v1/question-bank/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to archive question');
      }
      setSuccessMessage('Question archived');
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchQuestions();
    } catch (err: any) {
      setError(err?.message || 'Error archiving question');
    }
  };

  const handleHardDelete = async (id: string) => {
    if (!confirm('Permanently delete this question from the Question Bank?')) return;
    try {
      setError(null);
      const res = await fetch(`/api/v1/question-bank/${id}?hard=true`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete question');
      }
      setSuccessMessage('Question permanently deleted');
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchQuestions();
    } catch (err: any) {
      setError(err?.message || 'Error deleting question');
    }
  };

  const handleImport = async (item: QuestionBankItem) => {
    if (!onImportToExam) return;
    try {
      setImportingId(item.id);
      const override = pointsOverrides[item.id];
      await onImportToExam(item, override);
      setSuccessMessage(`Imported "${item.promptText.substring(0, 30)}..." into examination`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to import question');
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0b0c0e] border border-[#262830] rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#22242b] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#FF9100]/10 border border-[#FF9100]/30 text-[#FF9100]">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                {pickerMode ? 'Import from Reusable Question Bank' : 'Cortex Reusable Question Bank'}
                <span className="text-xs text-gray-400 font-normal">({questions.length} items)</span>
              </h2>
              <p className="text-xs text-gray-400">
                {pickerMode
                  ? 'Select questions to snapshot immutably into your examination'
                  : 'Independent repository of categorized assessment items with immutable snapshotting'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchQuestions}
              disabled={isLoading}
              className="p-1.5 rounded-lg bg-[#16171c] hover:bg-[#20222a] text-gray-400 hover:text-white border border-[#2a2d36] transition"
              title="Refresh question bank"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            {!isFormOpen && (
              <button
                onClick={() => {
                  resetForm();
                  setIsFormOpen(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-[#FF9100] hover:bg-[#e07f00] text-black text-xs font-bold font-heading flex items-center gap-1.5 transition active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Bank Question</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[#1a1c22] text-gray-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-800 text-red-200 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-950/50 border border-emerald-800 text-emerald-200 text-xs rounded-lg flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Immutability Banner */}
          <div className="p-3 bg-blue-950/20 border border-blue-900/40 rounded-xl text-xs text-blue-300 flex items-start gap-2.5">
            <Layers className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong className="text-white">Immutable Snapshots:</strong> Importing a question into an examination creates a self-contained copy. Modifying or deleting questions in the Question Bank will never mutate active examinations or invalidate historical student submissions.
            </p>
          </div>

          {/* Authoring Form */}
          {isFormOpen && (
            <form onSubmit={handleSaveQuestion} className="bg-[#14151a] border border-[#2b2e38] rounded-xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#252832] pb-3">
                <h3 className="text-xs sm:text-sm font-bold text-white">
                  {editingId ? 'Edit Bank Question' : 'Author New Reusable Question'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              {/* Subject, Topic, Difficulty, Type */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1 font-medium">Subject</label>
                  <input
                    type="text"
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    placeholder="e.g. Computer Science"
                    className="w-full bg-[#1c1d24] border border-[#2e313c] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF9100]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1 font-medium">Topic</label>
                  <input
                    type="text"
                    value={formTopic}
                    onChange={(e) => setFormTopic(e.target.value)}
                    placeholder="e.g. Data Structures"
                    className="w-full bg-[#1c1d24] border border-[#2e313c] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF9100]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1 font-medium">Difficulty</label>
                  <select
                    value={formDifficulty}
                    onChange={(e) => setFormDifficulty(e.target.value as QuestionBankDifficulty)}
                    className="w-full bg-[#1c1d24] border border-[#2e313c] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF9100]"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1 font-medium">Question Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as ExamQuestionType)}
                    className="w-full bg-[#1c1d24] border border-[#2e313c] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF9100]"
                  >
                    <option value="mcq_single">Single Choice (MCQ)</option>
                    <option value="mcq_multiple">Multiple Response (Checkbox)</option>
                    <option value="true_false">True / False</option>
                    <option value="short_answer">Short Answer / Text</option>
                    <option value="programming">Coding / Programming</option>
                  </select>
                </div>
              </div>

              {/* Prompt Text */}
              <div>
                <label className="text-[10px] text-gray-400 block mb-1 font-medium">Question Prompt (Markdown Supported)</label>
                <textarea
                  rows={3}
                  value={formPrompt}
                  onChange={(e) => setFormPrompt(e.target.value)}
                  placeholder="Enter the question statement or problem description..."
                  className="w-full bg-[#1c1d24] border border-[#2e313c] rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-[#FF9100] resize-none"
                />
              </div>

              {/* MCQ Options */}
              {formType.startsWith('mcq_') && (
                <div className="space-y-2 border border-[#22242c] p-3 rounded-xl bg-[#0f1014]">
                  <span className="text-[11px] font-bold text-gray-300 block">Answer Choices & Correct Key</span>
                  {mcqOptions.map((opt, idx) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      {formType === 'mcq_single' ? (
                        <input
                          type="radio"
                          name="singleCorrectKey"
                          checked={singleCorrect === opt.id}
                          onChange={() => setSingleCorrect(opt.id)}
                          className="accent-[#FF9100] cursor-pointer"
                        />
                      ) : (
                        <input
                          type="checkbox"
                          checked={multipleCorrect.includes(opt.id)}
                          onChange={(e) => {
                            if (e.target.checked) setMultipleCorrect([...multipleCorrect, opt.id]);
                            else setMultipleCorrect(multipleCorrect.filter((id) => id !== opt.id));
                          }}
                          className="accent-[#FF9100] cursor-pointer"
                        />
                      )}
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => {
                          const next = [...mcqOptions];
                          next[idx] = { ...opt, text: e.target.value };
                          setMcqOptions(next);
                        }}
                        className="flex-1 bg-[#1a1c22] border border-[#2c2f3b] rounded-lg px-2.5 py-1 text-xs text-white"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* True/False */}
              {formType === 'true_false' && (
                <div className="border border-[#22242c] p-3 rounded-xl bg-[#0f1014] flex items-center gap-4">
                  <span className="text-xs font-semibold text-gray-300">Correct Answer:</span>
                  <label className="flex items-center gap-1.5 text-xs text-white cursor-pointer">
                    <input
                      type="radio"
                      name="tfRadio"
                      checked={tfAnswer === true}
                      onChange={() => setTfAnswer(true)}
                      className="accent-[#FF9100]"
                    />
                    <span>True</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-white cursor-pointer">
                    <input
                      type="radio"
                      name="tfRadio"
                      checked={tfAnswer === false}
                      onChange={() => setTfAnswer(false)}
                      className="accent-[#FF9100]"
                    />
                    <span>False</span>
                  </label>
                </div>
              )}

              {/* Short Answer */}
              {formType === 'short_answer' && (
                <div className="space-y-3 border border-[#22242c] p-3 rounded-xl bg-[#0f1014]">
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Accepted Answers (Comma Separated)</label>
                    <input
                      type="text"
                      value={shortAnswerStr}
                      onChange={(e) => setShortAnswerStr(e.target.value)}
                      placeholder="e.g. O(n log n), nlogn, O(N log N)"
                      className="w-full bg-[#1a1c22] border border-[#2c2f3b] rounded-lg px-2.5 py-1 text-xs text-white"
                    />
                  </div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={caseSensitive}
                        onChange={(e) => setCaseSensitive(e.target.checked)}
                        className="accent-[#FF9100]"
                      />
                      <span>Case Sensitive</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={manualGrading}
                        onChange={(e) => setManualGrading(e.target.checked)}
                        className="accent-[#FF9100]"
                      />
                      <span>Require Manual Teacher Grading</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Programming */}
              {formType === 'programming' && (
                <div className="space-y-3 border border-[#22242c] p-3 rounded-xl bg-[#0f1014]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-400 flex items-center gap-1">
                      <Code2 className="w-3.5 h-3.5" />
                      Programming Environment
                    </span>
                    <select
                      value={codeLanguage}
                      onChange={(e) => setCodeLanguage(e.target.value)}
                      className="bg-[#1a1c22] border border-[#2c2f3b] rounded-lg px-2 py-1 text-xs text-white"
                    >
                      <option value="python">Python 3</option>
                      <option value="javascript">JavaScript</option>
                      <option value="typescript">TypeScript</option>
                      <option value="cpp">C++</option>
                      <option value="java">Java</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Starter Code Template</label>
                    <textarea
                      rows={3}
                      value={starterCode}
                      onChange={(e) => setStarterCode(e.target.value)}
                      className="w-full bg-black/60 font-mono text-[11px] border border-[#2c2f3b] rounded-lg p-2 text-cyan-300 resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-2.5 bg-black/40 rounded-lg border border-[#22242c] space-y-1">
                      <span className="text-[10px] font-bold text-emerald-400">Sample Test Case (Public)</span>
                      <input
                        type="text"
                        placeholder="Input"
                        value={sampleInput}
                        onChange={(e) => setSampleInput(e.target.value)}
                        className="w-full bg-[#181a20] border border-[#2c2f3a] rounded px-2 py-1 text-[11px] text-white font-mono"
                      />
                      <input
                        type="text"
                        placeholder="Expected Output"
                        value={sampleOutput}
                        onChange={(e) => setSampleOutput(e.target.value)}
                        className="w-full bg-[#181a20] border border-[#2c2f3a] rounded px-2 py-1 text-[11px] text-white font-mono"
                      />
                    </div>
                    <div className="p-2.5 bg-black/40 rounded-lg border border-[#22242c] space-y-1">
                      <span className="text-[10px] font-bold text-amber-400">Hidden Test Case (Evaluated Securely)</span>
                      <input
                        type="text"
                        placeholder="Input"
                        value={hiddenInput}
                        onChange={(e) => setHiddenInput(e.target.value)}
                        className="w-full bg-[#181a20] border border-[#2c2f3a] rounded px-2 py-1 text-[11px] text-white font-mono"
                      />
                      <input
                        type="text"
                        placeholder="Expected Output"
                        value={hiddenOutput}
                        onChange={(e) => setHiddenOutput(e.target.value)}
                        className="w-full bg-[#181a20] border border-[#2c2f3a] rounded px-2 py-1 text-[11px] text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Points, Negative Marks, Tags */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Default Points</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={formPoints}
                    onChange={(e) => setFormPoints(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#1c1d24] border border-[#2e313c] rounded-lg px-2.5 py-1 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Negative Penalty</label>
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    value={formNegativeMarks}
                    onChange={(e) => setFormNegativeMarks(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#1c1d24] border border-[#2e313c] rounded-lg px-2.5 py-1 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Categorical Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    placeholder="e.g. array, sorting, tree"
                    className="w-full bg-[#1c1d24] border border-[#2e313c] rounded-lg px-2.5 py-1 text-xs text-white"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-1.5 rounded-lg bg-[#1a1c22] text-gray-300 text-xs font-semibold hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 rounded-lg bg-[#FF9100] hover:bg-[#e07f00] text-black text-xs font-bold font-heading flex items-center gap-1.5 transition active:scale-95"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingId ? 'Update Bank Item' : 'Save to Bank'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Filters Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 bg-[#121318] p-3 rounded-xl border border-[#22242c]">
            <div className="col-span-2 relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search prompt, subject, or topic..."
                className="w-full bg-[#181a20] border border-[#2c2f3a] rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF9100]"
              />
            </div>
            <div>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full bg-[#181a20] border border-[#2c2f3a] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF9100]"
              >
                <option value="all">All Subjects</option>
                {uniqueSubjects.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="w-full bg-[#181a20] border border-[#2c2f3a] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF9100]"
              >
                <option value="all">All Difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full bg-[#181a20] border border-[#2c2f3a] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF9100]"
              >
                <option value="all">All Question Types</option>
                <option value="mcq_single">Single MCQ</option>
                <option value="mcq_multiple">Multi Response</option>
                <option value="true_false">True/False</option>
                <option value="short_answer">Short Answer</option>
                <option value="programming">Programming</option>
              </select>
            </div>
            <div className="flex items-center justify-end">
              <label className="flex items-center gap-1.5 text-[11px] text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(e) => setIncludeArchived(e.target.checked)}
                  className="accent-[#FF9100]"
                />
                <span>Archived</span>
              </label>
            </div>
          </div>

          {/* Question List */}
          {isLoading && questions.length === 0 && (
            <div className="text-center py-12 text-xs text-gray-500">Loading question bank...</div>
          )}

          {!isLoading && questions.length === 0 && (
            <div className="text-center py-12 text-xs text-gray-500 border border-dashed border-[#22242c] rounded-xl p-8 space-y-2">
              <BookOpen className="w-8 h-8 text-gray-600 mx-auto" />
              <p>No questions found matching your filter criteria.</p>
              <button
                onClick={() => {
                  resetForm();
                  setIsFormOpen(true);
                }}
                className="text-[#FF9100] font-semibold hover:underline text-xs"
              >
                Create your first question bank item
              </button>
            </div>
          )}

          <div className="space-y-3">
            {questions.map((item) => (
              <div
                key={item.id}
                className={`p-4 bg-[#121318] border rounded-xl transition space-y-2.5 ${
                  item.isArchived ? 'border-gray-800 opacity-60' : 'border-[#22242c] hover:border-[#353844]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FF9100]/20 text-[#FF9100] border border-[#FF9100]/40 uppercase tracking-wider">
                      {item.questionType.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] font-semibold text-gray-300 bg-[#1a1c22] px-2 py-0.5 rounded border border-[#2b2d36]">
                      {item.subject} &bull; {item.topic}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase ${
                        item.difficulty === 'easy'
                          ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-800/50'
                          : item.difficulty === 'medium'
                          ? 'text-amber-400 bg-amber-950/40 border border-amber-800/50'
                          : 'text-rose-400 bg-rose-950/40 border border-rose-800/50'
                      }`}
                    >
                      {item.difficulty}
                    </span>
                    <span className="text-[10px] text-gray-400 font-semibold">{item.defaultPoints} pts</span>
                    {item.isArchived && (
                      <span className="text-[9px] bg-red-950/50 text-red-300 px-1.5 py-0.5 rounded border border-red-800">
                        Archived
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {pickerMode ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <label className="text-[10px] text-gray-400">Pts:</label>
                          <input
                            type="number"
                            min="0.5"
                            step="0.5"
                            defaultValue={item.defaultPoints}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || item.defaultPoints;
                              setPointsOverrides((prev) => ({ ...prev, [item.id]: val }));
                            }}
                            className="w-14 bg-[#181a20] border border-[#2c2f3a] rounded px-1.5 py-1 text-xs text-white text-center"
                          />
                        </div>
                        <button
                          onClick={() => handleImport(item)}
                          disabled={importingId === item.id}
                          className="px-3 py-1 rounded-lg bg-[#FF9100] hover:bg-[#e07f00] text-black text-xs font-bold font-heading flex items-center gap-1 transition active:scale-95 disabled:opacity-50"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                          <span>{importingId === item.id ? 'Importing...' : 'Import to Exam'}</span>
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => openEditForm(item)}
                          className="p-1.5 rounded-lg hover:bg-[#1f212a] text-gray-400 hover:text-white transition"
                          title="Edit Question"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDuplicate(item.id)}
                          className="p-1.5 rounded-lg hover:bg-[#1f212a] text-gray-400 hover:text-white transition"
                          title="Duplicate Question"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleArchive(item.id)}
                          className="p-1.5 rounded-lg hover:bg-[#1f212a] text-gray-400 hover:text-white transition"
                          title="Archive Question"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleHardDelete(item.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-950/60 text-gray-400 hover:text-rose-400 transition"
                          title="Delete Permanently"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Prompt Excerpt */}
                <p className="text-xs text-gray-200 leading-relaxed font-sans">{item.promptText}</p>

                {/* Tags */}
                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 pt-1">
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] text-gray-400 bg-black/40 px-2 py-0.5 rounded border border-[#22242c] flex items-center gap-1"
                      >
                        <Tag className="w-2.5 h-2.5 text-gray-500" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
