'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit3,
  ListOrdered,
  CheckCircle,
  HelpCircle,
  Code2,
  Binary,
  Type,
  Hash,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  Save,
  BookOpen,
} from 'lucide-react';
import { Exam, ExamQuestion, ExamQuestionType, ExamOption, ExamQuestionTestCase } from '@/lib/classroom/models';
import { QuestionBankModal } from './QuestionBankModal';

interface ExamQuestionsManagerModalProps {
  classroomId: string;
  exam: Exam;
  onClose: () => void;
}

export function ExamQuestionsManagerModal({ classroomId, exam, onClose }: ExamQuestionsManagerModalProps) {
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Authoring form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBankPickerOpen, setIsBankPickerOpen] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  const [questionType, setQuestionType] = useState<ExamQuestionType>('mcq_single');
  const [promptText, setPromptText] = useState('');
  const [points, setPoints] = useState(1.0);
  const [negativeMarks, setNegativeMarks] = useState(0.0);
  const [numericalTolerance, setNumericalTolerance] = useState(0.0);

  // MCQ options state
  const [mcqOptions, setMcqOptions] = useState<ExamOption[]>([
    { id: 'opt_1', text: 'Option A' },
    { id: 'opt_2', text: 'Option B' },
    { id: 'opt_3', text: 'Option C' },
    { id: 'opt_4', text: 'Option D' },
  ]);
  const [singleCorrectOptionId, setSingleCorrectOptionId] = useState<string>('opt_1');
  const [multipleCorrectOptionIds, setMultipleCorrectOptionIds] = useState<string[]>(['opt_1']);
  const [partialCredit, setPartialCredit] = useState(true);

  // True/False state
  const [trueFalseAnswer, setTrueFalseAnswer] = useState(true);

  // Numerical state
  const [numericalAnswer, setNumericalAnswer] = useState(0);

  // Short answer state
  const [acceptedAnswersStr, setAcceptedAnswersStr] = useState('');
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [manualGrading, setManualGrading] = useState(false);

  // Programming state
  const [language, setLanguage] = useState('python');
  const [initialCode, setInitialCode] = useState('def solution():\n    # Write your solution here\n    pass\n');
  const [sampleInput, setSampleInput] = useState('5\n');
  const [sampleOutput, setSampleOutput] = useState('10\n');
  const [hiddenInput, setHiddenInput] = useState('100\n');
  const [hiddenOutput, setHiddenOutput] = useState('200\n');

  const fetchQuestions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/v1/classrooms/${classroomId}/exams/${exam.id}/questions`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load questions');
      }
      const data = await res.json();
      setQuestions(data.questions || []);
    } catch (err: any) {
      setError(err?.message || 'Error fetching questions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [classroomId, exam.id]);

  const resetForm = () => {
    setEditingQuestionId(null);
    setQuestionType('mcq_single');
    setPromptText('');
    setPoints(1.0);
    setNegativeMarks(0.0);
    setNumericalTolerance(0.0);
    setMcqOptions([
      { id: 'opt_1', text: 'Option A' },
      { id: 'opt_2', text: 'Option B' },
      { id: 'opt_3', text: 'Option C' },
      { id: 'opt_4', text: 'Option D' },
    ]);
    setSingleCorrectOptionId('opt_1');
    setMultipleCorrectOptionIds(['opt_1']);
    setTrueFalseAnswer(true);
    setNumericalAnswer(0);
    setAcceptedAnswersStr('');
    setIsCaseSensitive(false);
    setManualGrading(false);
    setLanguage('python');
    setInitialCode('def solution():\n    # Write your solution here\n    pass\n');
    setSampleInput('');
    setSampleOutput('');
    setHiddenInput('');
    setHiddenOutput('');
    setIsFormOpen(false);
  };

  const startEditQuestion = (q: ExamQuestion) => {
    setEditingQuestionId(q.id);
    setQuestionType(q.questionType);
    setPromptText(q.promptText);
    setPoints(q.points);
    setNegativeMarks(q.negativeMarks || 0);
    setNumericalTolerance(q.numericalTolerance || 0);

    if (q.questionType === 'mcq_single' || q.questionType === 'mcq_multiple') {
      if (q.options && q.options.length > 0) {
        setMcqOptions(q.options);
      }
      if (q.questionType === 'mcq_single') {
        const correctId = typeof q.correctAnswer === 'string' ? q.correctAnswer : q.correctAnswer?.optionId;
        if (correctId) setSingleCorrectOptionId(correctId);
      } else {
        const correctIds = Array.isArray(q.correctAnswer) ? q.correctAnswer : q.correctAnswer?.optionIds || [];
        setMultipleCorrectOptionIds(correctIds);
        setPartialCredit(q.correctAnswer?.partialCredit !== false);
      }
    } else if (q.questionType === 'true_false') {
      setTrueFalseAnswer(
        typeof q.correctAnswer === 'boolean'
          ? q.correctAnswer
          : q.correctAnswer?.value === true || String(q.correctAnswer).toLowerCase() === 'true'
      );
    } else if (q.questionType === 'numerical') {
      const val = typeof q.correctAnswer === 'number' ? q.correctAnswer : parseFloat(q.correctAnswer?.value || 0);
      setNumericalAnswer(val);
      setNumericalTolerance(q.numericalTolerance || q.correctAnswer?.tolerance || 0);
    } else if (q.questionType === 'short_answer') {
      const accepted: string[] = Array.isArray(q.correctAnswer?.acceptedAnswers)
        ? q.correctAnswer.acceptedAnswers
        : (Array.isArray(q.correctAnswer) ? q.correctAnswer : [String(q.correctAnswer?.text || '')]);
      setAcceptedAnswersStr(accepted.join('\n'));
      setIsCaseSensitive(!!q.correctAnswer?.caseSensitive);
      setManualGrading(!!q.correctAnswer?.manualGrading);
    } else if (q.questionType === 'programming') {
      setLanguage(q.language || 'python');
      setInitialCode(q.initialCode || '');
      const sample = q.testCases?.find((tc) => !tc.isHidden);
      const hidden = q.testCases?.find((tc) => tc.isHidden);
      if (sample) {
        setSampleInput(sample.input || '');
        setSampleOutput(sample.expectedOutput || '');
      }
      if (hidden) {
        setHiddenInput(hidden.input || '');
        setHiddenOutput(hidden.expectedOutput || '');
      }
    }

    setIsFormOpen(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptText.trim()) {
      alert('Prompt text is required');
      return;
    }

    // Build question payload
    let correctAnswerPayload: any = {};
    let testCasesPayload: ExamQuestionTestCase[] = [];

    if (questionType === 'mcq_single') {
      correctAnswerPayload = { optionId: singleCorrectOptionId };
    } else if (questionType === 'mcq_multiple') {
      correctAnswerPayload = { optionIds: multipleCorrectOptionIds, partialCredit };
    } else if (questionType === 'true_false') {
      correctAnswerPayload = { value: trueFalseAnswer };
    } else if (questionType === 'numerical') {
      correctAnswerPayload = { value: numericalAnswer, tolerance: numericalTolerance };
    } else if (questionType === 'short_answer') {
      const accepted = acceptedAnswersStr
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      correctAnswerPayload = {
        acceptedAnswers: accepted,
        caseSensitive: isCaseSensitive,
        manualGrading,
      };
    } else if (questionType === 'programming') {
      testCasesPayload = [
        {
          id: 'tc_sample_1',
          input: sampleInput,
          expectedOutput: sampleOutput,
          isHidden: false,
          points: Math.round(points * 0.4 * 10) / 10,
        },
        {
          id: 'tc_hidden_1',
          input: hiddenInput,
          expectedOutput: hiddenOutput,
          isHidden: true,
          points: Math.round(points * 0.6 * 10) / 10,
        },
      ];
    }

    const payload = {
      questionType,
      promptText: promptText.trim(),
      options: mcqOptions,
      correctAnswer: correctAnswerPayload,
      testCases: testCasesPayload,
      initialCode: questionType === 'programming' ? initialCode : null,
      language: questionType === 'programming' ? language : null,
      points: parseFloat(String(points)),
      negativeMarks: parseFloat(String(negativeMarks)),
      numericalTolerance: parseFloat(String(numericalTolerance)),
    };

    try {
      const url = editingQuestionId
        ? `/api/v1/classrooms/${classroomId}/exams/${exam.id}/questions/${editingQuestionId}`
        : `/api/v1/classrooms/${classroomId}/exams/${exam.id}/questions`;

      const method = editingQuestionId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save question');
      }

      resetForm();
      fetchQuestions();
    } catch (err: any) {
      alert(err.message || 'Error saving question');
    }
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      const res = await fetch(`/api/v1/classrooms/${classroomId}/exams/${exam.id}/questions/${qId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete question');
      }
      fetchQuestions();
    } catch (err: any) {
      alert(err.message || 'Failed to delete question');
    }
  };

  const handleImportFromBank = async (bankItem: any, pointsOverride?: number) => {
    const res = await fetch(`/api/v1/classrooms/${classroomId}/exams/${exam.id}/questions/import-from-bank`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bankQuestionId: bankItem.id,
        pointsOverride,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to import question from bank');
    }
    await fetchQuestions();
  };

  const handleMoveQuestion = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;

    const newOrder = [...questions];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    setQuestions(newOrder);

    try {
      await fetch(`/api/v1/classrooms/${classroomId}/exams/${exam.id}/questions/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedQuestionIds: newOrder.map((q) => q.id) }),
      });
    } catch (err) {
      fetchQuestions();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0f1013] border border-[#262830] rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#22242b] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#FF9100]/10 border border-[#FF9100]/30 text-[#FF9100]">
              <ListOrdered className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                Question Bank & Assessment Items
                <span className="text-xs text-gray-400 font-normal">({exam.title})</span>
              </h2>
              <p className="text-xs text-gray-400">Total Questions: {questions.length}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#1a1c22] text-gray-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-800 text-red-200 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Add / Form Trigger */}
          {!isFormOpen && (
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  resetForm();
                  setIsFormOpen(true);
                }}
                className="flex-1 py-3 border border-dashed border-[#FF9100]/40 rounded-xl text-xs font-semibold text-[#FF9100] hover:bg-[#FF9100]/10 transition flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Custom Question
              </button>
              <button
                onClick={() => setIsBankPickerOpen(true)}
                className="flex-1 py-3 border border-[#2a2c36] bg-[#14151a] hover:bg-[#1a1c22] rounded-xl text-xs font-semibold text-white transition flex items-center justify-center gap-2 shadow-sm"
              >
                <BookOpen className="w-4 h-4 text-cyan-400" />
                Import from Question Bank
              </button>
            </div>
          )}

          {/* Authoring Form */}
          {isFormOpen && (
            <form onSubmit={handleSaveQuestion} className="bg-[#14151a] border border-[#2b2e38] rounded-xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#252832] pb-3">
                <h3 className="text-xs sm:text-sm font-bold text-white">
                  {editingQuestionId ? 'Edit Question' : 'Add New Question'}
                </h3>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              {/* Type and Points Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Question Type</label>
                  <select
                    value={questionType}
                    onChange={(e) => setQuestionType(e.target.value as ExamQuestionType)}
                    className="w-full px-3 py-2 bg-[#191a20] border border-[#2d303c] rounded-lg text-xs text-white focus:outline-none focus:border-[#FF9100]/60"
                  >
                    <option value="mcq_single">Single-Choice MCQ</option>
                    <option value="mcq_multiple">Multiple-Select MCQ</option>
                    <option value="true_false">True / False</option>
                    <option value="numerical">Numerical Answer</option>
                    <option value="short_answer">Short Answer</option>
                    <option value="programming">Programming Problem</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Marks / Points</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    required
                    value={points}
                    onChange={(e) => setPoints(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 bg-[#191a20] border border-[#2d303c] rounded-lg text-xs text-white focus:outline-none focus:border-[#FF9100]/60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Negative Penalty</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={negativeMarks}
                    onChange={(e) => setNegativeMarks(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 bg-[#191a20] border border-[#2d303c] rounded-lg text-xs text-white focus:outline-none focus:border-[#FF9100]/60"
                  />
                </div>
              </div>

              {/* Prompt Text */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Question Prompt / Problem Description <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder="Formulate the assessment question clearly..."
                  className="w-full px-3 py-2 bg-[#191a20] border border-[#2d303c] rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FF9100]/60"
                />
              </div>

              {/* Specific Sub-forms based on Type */}

              {/* 1. MCQ Single */}
              {questionType === 'mcq_single' && (
                <div className="space-y-2 border border-[#252832] rounded-lg p-3 bg-[#111216]">
                  <span className="block text-xs font-semibold text-gray-300">
                    Options and Correct Answer (Select the radio of the correct choice)
                  </span>
                  {mcqOptions.map((opt, i) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correct_mcq_single"
                        checked={singleCorrectOptionId === opt.id}
                        onChange={() => setSingleCorrectOptionId(opt.id)}
                        className="text-[#FF9100] focus:ring-0"
                      />
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => {
                          const updated = [...mcqOptions];
                          updated[i].text = e.target.value;
                          setMcqOptions(updated);
                        }}
                        placeholder={`Option ${i + 1}`}
                        className="flex-1 px-2.5 py-1.5 bg-[#181920] border border-[#2d303c] rounded text-xs text-white"
                      />
                      {mcqOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setMcqOptions(mcqOptions.filter((o) => o.id !== opt.id))}
                          className="p-1 hover:text-red-400 text-gray-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {mcqOptions.length < 6 && (
                    <button
                      type="button"
                      onClick={() =>
                        setMcqOptions([
                          ...mcqOptions,
                          { id: `opt_${Date.now()}`, text: `Option ${mcqOptions.length + 1}` },
                        ])
                      }
                      className="text-[11px] text-[#FF9100] hover:underline pt-1 block"
                    >
                      + Add another option
                    </button>
                  )}
                </div>
              )}

              {/* 2. MCQ Multiple */}
              {questionType === 'mcq_multiple' && (
                <div className="space-y-2 border border-[#252832] rounded-lg p-3 bg-[#111216]">
                  <span className="block text-xs font-semibold text-gray-300">
                    Options and Correct Answers (Check all that apply)
                  </span>
                  {mcqOptions.map((opt, i) => {
                    const isChecked = multipleCorrectOptionIds.includes(opt.id);
                    return (
                      <div key={opt.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setMultipleCorrectOptionIds([...multipleCorrectOptionIds, opt.id]);
                            } else {
                              setMultipleCorrectOptionIds(multipleCorrectOptionIds.filter((id) => id !== opt.id));
                            }
                          }}
                          className="rounded text-[#FF9100] focus:ring-0"
                        />
                        <input
                          type="text"
                          value={opt.text}
                          onChange={(e) => {
                            const updated = [...mcqOptions];
                            updated[i].text = e.target.value;
                            setMcqOptions(updated);
                          }}
                          className="flex-1 px-2.5 py-1.5 bg-[#181920] border border-[#2d303c] rounded text-xs text-white"
                        />
                      </div>
                    );
                  })}
                  <label className="flex items-center gap-2 text-xs text-gray-400 pt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={partialCredit}
                      onChange={(e) => setPartialCredit(e.target.checked)}
                      className="rounded text-[#FF9100] focus:ring-0"
                    />
                    <span>Award partial credit for partially correct choices</span>
                  </label>
                </div>
              )}

              {/* 3. True / False */}
              {questionType === 'true_false' && (
                <div className="border border-[#252832] rounded-lg p-3 bg-[#111216] space-y-2">
                  <span className="block text-xs font-semibold text-gray-300">Correct Value</span>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
                      <input
                        type="radio"
                        name="tf_correct"
                        checked={trueFalseAnswer === true}
                        onChange={() => setTrueFalseAnswer(true)}
                        className="text-[#FF9100] focus:ring-0"
                      />
                      <span>True</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
                      <input
                        type="radio"
                        name="tf_correct"
                        checked={trueFalseAnswer === false}
                        onChange={() => setTrueFalseAnswer(false)}
                        className="text-[#FF9100] focus:ring-0"
                      />
                      <span>False</span>
                    </label>
                  </div>
                </div>
              )}

              {/* 4. Numerical */}
              {questionType === 'numerical' && (
                <div className="border border-[#252832] rounded-lg p-3 bg-[#111216] grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Correct Number</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={numericalAnswer}
                      onChange={(e) => setNumericalAnswer(parseFloat(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-[#181920] border border-[#2d303c] rounded text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Allowed Tolerance (+/-)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={numericalTolerance}
                      onChange={(e) => setNumericalTolerance(parseFloat(e.target.value))}
                      placeholder="e.g. 0.05"
                      className="w-full px-2.5 py-1.5 bg-[#181920] border border-[#2d303c] rounded text-xs text-white"
                    />
                  </div>
                </div>
              )}

              {/* 5. Short Answer */}
              {questionType === 'short_answer' && (
                <div className="border border-[#252832] rounded-lg p-3 bg-[#111216] space-y-2">
                  <span className="block text-xs font-semibold text-gray-300">Accepted Answer Keywords (One per line)</span>
                  <textarea
                    rows={2}
                    value={acceptedAnswersStr}
                    onChange={(e) => setAcceptedAnswersStr(e.target.value)}
                    placeholder="e.g. O(n log n)&#10;linearithmic"
                    className="w-full px-2.5 py-1.5 bg-[#181920] border border-[#2d303c] rounded text-xs text-white resize-none"
                  />
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isCaseSensitive}
                        onChange={(e) => setIsCaseSensitive(e.target.checked)}
                        className="rounded text-[#FF9100] focus:ring-0"
                      />
                      <span>Case Sensitive</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={manualGrading}
                        onChange={(e) => setManualGrading(e.target.checked)}
                        className="rounded text-[#FF9100] focus:ring-0"
                      />
                      <span>Require Manual Teacher Review</span>
                    </label>
                  </div>
                </div>
              )}

              {/* 6. Programming */}
              {questionType === 'programming' && (
                <div className="border border-[#252832] rounded-lg p-3 bg-[#111216] space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Target Language</label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full sm:w-48 px-2.5 py-1.5 bg-[#181920] border border-[#2d303c] rounded text-xs text-white"
                    >
                      <option value="python">Python 3.12</option>
                      <option value="javascript">JavaScript (Node 22)</option>
                      <option value="typescript">TypeScript 5.6</option>
                      <option value="cpp">C++ (GCC 14)</option>
                      <option value="java">Java 17</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Starter Code Template</label>
                    <textarea
                      rows={4}
                      value={initialCode}
                      onChange={(e) => setInitialCode(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#181920] border border-[#2d303c] rounded text-xs text-white font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="block text-[11px] font-semibold text-cyan-400">Public Sample Input / Output</span>
                      <textarea
                        rows={2}
                        value={sampleInput}
                        onChange={(e) => setSampleInput(e.target.value)}
                        placeholder="Sample input (stdin)"
                        className="w-full px-2.5 py-1 bg-[#181920] border border-[#2d303c] rounded text-xs text-white font-mono"
                      />
                      <textarea
                        rows={2}
                        value={sampleOutput}
                        onChange={(e) => setSampleOutput(e.target.value)}
                        placeholder="Expected sample output (stdout)"
                        className="w-full px-2.5 py-1 bg-[#181920] border border-[#2d303c] rounded text-xs text-white font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="block text-[11px] font-semibold text-purple-400">Hidden Verification Test (Server Only)</span>
                      <textarea
                        rows={2}
                        value={hiddenInput}
                        onChange={(e) => setHiddenInput(e.target.value)}
                        placeholder="Hidden test input (stdin)"
                        className="w-full px-2.5 py-1 bg-[#181920] border border-[#2d303c] rounded text-xs text-white font-mono"
                      />
                      <textarea
                        rows={2}
                        value={hiddenOutput}
                        onChange={(e) => setHiddenOutput(e.target.value)}
                        placeholder="Expected hidden output (stdout)"
                        className="w-full px-2.5 py-1 bg-[#181920] border border-[#2d303c] rounded text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Save / Cancel buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-1.5 rounded-lg bg-[#181920] hover:bg-[#22242c] text-xs text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#FF9100] hover:bg-[#e08000] text-black font-bold text-xs flex items-center gap-1.5 shadow"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Question
                </button>
              </div>
            </form>
          )}

          {/* List of Existing Questions */}
          <div className="space-y-3">
            {questions.map((q, idx) => (
              <div
                key={q.id}
                className="bg-[#121317] border border-[#22242c] rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                    <button
                      onClick={() => handleMoveQuestion(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1 hover:bg-[#1a1c22] rounded text-gray-400 disabled:opacity-20"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-bold text-gray-400">Q{idx + 1}</span>
                    <button
                      onClick={() => handleMoveQuestion(idx, 'down')}
                      disabled={idx === questions.length - 1}
                      className="p-1 hover:bg-[#1a1c22] rounded text-gray-400 disabled:opacity-20"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#1c1e27] text-gray-300 border border-[#2e313e]">
                        {q.questionType.toUpperCase().replace('_', ' ')}
                      </span>
                      <span className="text-xs font-semibold text-cyan-400">{q.points} pt{q.points !== 1 ? 's' : ''}</span>
                      {q.negativeMarks > 0 && (
                        <span className="text-xs text-rose-400 font-medium">(-{q.negativeMarks})</span>
                      )}
                    </div>
                    <p className="text-xs text-white line-clamp-2 max-w-xl">{q.promptText}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-center">
                  <button
                    onClick={() => startEditQuestion(q)}
                    className="p-1.5 rounded-lg hover:bg-[#20222a] text-gray-400 hover:text-white transition"
                    title="Edit question"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteQuestion(q.id)}
                    className="p-1.5 rounded-lg hover:bg-red-950/50 text-gray-400 hover:text-red-400 transition"
                    title="Delete question"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Question Bank Picker Modal */}
        {isBankPickerOpen && (
          <QuestionBankModal
            pickerMode={true}
            onImportToExam={handleImportFromBank}
            onClose={() => setIsBankPickerOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
