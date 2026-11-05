'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Layers,
  GitBranch,
  Plus,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { Exam, ExamSection, ExamQuestion, ExamBranchingRule, BranchingOperator, BranchingDestinationType } from '@/lib/classroom/models';

interface ExamSectionsBranchingModalProps {
  classroomId: string;
  exam: Exam;
  onClose: () => void;
  onUpdated?: () => void;
}

export function ExamSectionsBranchingModal({
  classroomId,
  exam,
  onClose,
  onUpdated,
}: ExamSectionsBranchingModalProps) {
  const [activeTab, setActiveTab] = useState<'sections' | 'branching'>('sections');

  const [sections, setSections] = useState<ExamSection[]>([]);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [branchingRules, setBranchingRules] = useState<ExamBranchingRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Section Form state
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionTitle, setSectionTitle] = useState('');
  const [sectionDescription, setSectionDescription] = useState('');
  const [sectionInstructions, setSectionInstructions] = useState('');
  const [sectionMandatory, setSectionMandatory] = useState(true);
  const [sectionTimeLimit, setSectionTimeLimit] = useState(0);

  // Branching Rule Form state
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [ruleSourceQuestionId, setRuleSourceQuestionId] = useState('');
  const [ruleOperator, setRuleOperator] = useState<BranchingOperator>('selected_option');
  const [ruleConditionValue, setRuleConditionValue] = useState('');
  const [ruleDestinationType, setRuleDestinationType] = useState<BranchingDestinationType>('section');
  const [ruleDestinationId, setRuleDestinationId] = useState('');
  const [ruleDefaultDestType, setRuleDefaultDestType] = useState<BranchingDestinationType>('section');
  const [ruleDefaultDestId, setRuleDefaultDestId] = useState('');

  // Validation state
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors: string[] } | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load sections
      const secRes = await fetch(`/api/v1/classrooms/${classroomId}/exams/${exam.id}/sections`);
      if (secRes.ok) {
        const secData = await secRes.json();
        setSections(secData.sections || []);
      }

      // Load questions
      const qRes = await fetch(`/api/v1/classrooms/${classroomId}/exams/${exam.id}/questions`);
      if (qRes.ok) {
        const qData = await qRes.json();
        setQuestions(qData.questions || []);
      }

      // Load branching rules
      const ruleRes = await fetch(`/api/v1/classrooms/${classroomId}/exams/${exam.id}/branching-rules`);
      if (ruleRes.ok) {
        const ruleData = await ruleRes.json();
        setBranchingRules(ruleData.rules || []);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load sections and branching configuration');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [classroomId, exam.id]);

  // Handle Section Creation / Editing
  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionTitle.trim()) {
      setError('Section title is required');
      return;
    }

    try {
      const payload = {
        title: sectionTitle.trim(),
        description: sectionDescription.trim(),
        instructions: sectionInstructions.trim(),
        isMandatory: sectionMandatory,
        timeLimitMinutes: parseInt(String(sectionTimeLimit), 10) || 0,
      };

      let res;
      if (editingSectionId) {
        res = await fetch(`/api/v1/classrooms/${classroomId}/exams/${exam.id}/sections/${editingSectionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/v1/classrooms/${classroomId}/exams/${exam.id}/sections`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, sortOrder: sections.length }),
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save section');
      }

      setSuccessMsg(editingSectionId ? 'Section updated' : 'Section created');
      resetSectionForm();
      fetchData();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      setError(err?.message || 'Error saving section');
    }
  };

  const resetSectionForm = () => {
    setIsAddingSection(false);
    setEditingSectionId(null);
    setSectionTitle('');
    setSectionDescription('');
    setSectionInstructions('');
    setSectionMandatory(true);
    setSectionTimeLimit(0);
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm('Are you sure you want to delete this section? Questions inside will be preserved and moved to unsectioned.')) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/classrooms/${classroomId}/exams/${exam.id}/sections/${sectionId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete section');
      }
      setSuccessMsg('Section deleted and questions preserved');
      fetchData();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      setError(err?.message || 'Error deleting section');
    }
  };

  const handleMoveSection = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const reordered = [...sections];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    setSections(reordered);

    try {
      await fetch(`/api/v1/classrooms/${classroomId}/exams/${exam.id}/sections/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedSectionIds: reordered.map((s) => s.id) }),
      });
    } catch (_) {
      fetchData();
    }
  };

  // Handle Branching Rule Creation
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleSourceQuestionId) {
      setError('Please select a source question for the branching decision');
      return;
    }

    try {
      const payload = {
        sourceQuestionId: ruleSourceQuestionId,
        conditionOperator: ruleOperator,
        conditionValue: ruleConditionValue,
        destinationType: ruleDestinationType,
        destinationId: ruleDestinationId || undefined,
        defaultDestinationType: ruleDefaultDestType,
        defaultDestinationId: ruleDefaultDestId || undefined,
        priority: branchingRules.length,
      };

      const res = await fetch(`/api/v1/classrooms/${classroomId}/exams/${exam.id}/branching-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create branching rule');
      }

      setSuccessMsg('Branching rule created successfully');
      setIsAddingRule(false);
      setRuleSourceQuestionId('');
      setRuleConditionValue('');
      setRuleDestinationId('');
      setRuleDefaultDestId('');
      fetchData();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      setError(err?.message || 'Error creating branching rule');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const res = await fetch(`/api/v1/classrooms/${classroomId}/exams/${exam.id}/branching-rules/${ruleId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete rule');
      }
      setSuccessMsg('Branching rule deleted');
      fetchData();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      setError(err?.message || 'Error deleting branching rule');
    }
  };

  const handleValidateBranching = async () => {
    setIsValidating(true);
    setValidationResult(null);
    try {
      const res = await fetch(`/api/v1/classrooms/${classroomId}/exams/${exam.id}/branching-rules/validate`, {
        method: 'POST',
      });
      const data = await res.json();
      setValidationResult(data);
    } catch (err: any) {
      setError('Failed to execute branching cycle validation');
    } finally {
      setIsValidating(false);
    }
  };

  const selectedSourceQ = questions.find((q) => q.id === ruleSourceQuestionId);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0f1013] border border-[#262830] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#22242b] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#FF9100]/10 border border-[#FF9100]/30 text-[#FF9100]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                Sections & Conditional Branching Engine
              </h2>
              <p className="text-xs text-gray-400">
                Partition assessment into distinct sections and route students adaptively based on responses.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#1a1c22] text-gray-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-[#1f2128] bg-[#0c0d10]">
          <button
            onClick={() => setActiveTab('sections')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition flex items-center gap-1.5 border-b-2 ${
              activeTab === 'sections'
                ? 'border-[#FF9100] text-[#FF9100] bg-[#16171c]'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Examination Sections ({sections.length})
          </button>
          <button
            onClick={() => setActiveTab('branching')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition flex items-center gap-1.5 border-b-2 ${
              activeTab === 'branching'
                ? 'border-[#FF9100] text-[#FF9100] bg-[#16171c]'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            Conditional Routing Rules ({branchingRules.length})
          </button>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div className="mx-6 mt-3 p-3 bg-red-950/40 border border-red-800 text-red-200 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-3 p-3 bg-emerald-950/40 border border-emerald-800 text-emerald-200 text-xs rounded-lg flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {activeTab === 'sections' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Configured Sections</h3>
                  <p className="text-[11px] text-gray-400">
                    Questions can be categorized into sections with independent guidelines and mandatory flags.
                  </p>
                </div>
                {!isAddingSection && (
                  <button
                    onClick={() => {
                      resetSectionForm();
                      setIsAddingSection(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#FF9100] hover:bg-[#e08000] text-black font-semibold text-xs transition flex items-center gap-1.5 shadow"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Section
                  </button>
                )}
              </div>

              {/* Add/Edit Section Form */}
              {isAddingSection && (
                <form onSubmit={handleSaveSection} className="p-4 bg-[#14151a] border border-[#282a35] rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-white">
                    {editingSectionId ? 'Edit Section Details' : 'New Section Details'}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-gray-300 mb-1">Section Title *</label>
                      <input
                        type="text"
                        required
                        value={sectionTitle}
                        onChange={(e) => setSectionTitle(e.target.value)}
                        placeholder="e.g. Part A: Fundamental Concepts"
                        className="w-full px-3 py-1.5 bg-[#0f1013] border border-[#252730] rounded text-xs text-white focus:outline-none focus:border-[#FF9100]/60"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-300 mb-1">Time Limit (Minutes, optional)</label>
                      <input
                        type="number"
                        min={0}
                        value={sectionTimeLimit}
                        onChange={(e) => setSectionTimeLimit(parseInt(e.target.value, 10))}
                        placeholder="0 = unconstrained within exam"
                        className="w-full px-3 py-1.5 bg-[#0f1013] border border-[#252730] rounded text-xs text-white focus:outline-none focus:border-[#FF9100]/60"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-gray-300 mb-1">Section Instructions (Optional)</label>
                    <textarea
                      rows={2}
                      value={sectionInstructions}
                      onChange={(e) => setSectionInstructions(e.target.value)}
                      placeholder="Special instructions for this section..."
                      className="w-full px-3 py-1.5 bg-[#0f1013] border border-[#252730] rounded text-xs text-white focus:outline-none focus:border-[#FF9100]/60 resize-none"
                    />
                  </div>

                  <div className="flex items-center gap-4 pt-1">
                    <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sectionMandatory}
                        onChange={(e) => setSectionMandatory(e.target.checked)}
                        className="rounded border-[#30333d] bg-[#1a1b22] text-[#FF9100] focus:ring-0"
                      />
                      <span>Mandatory Section (Students must complete)</span>
                    </label>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={resetSectionForm}
                      className="px-3 py-1.5 rounded bg-[#1c1d24] text-xs text-gray-300 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded bg-[#FF9100] text-black font-bold text-xs"
                    >
                      {editingSectionId ? 'Update Section' : 'Create Section'}
                    </button>
                  </div>
                </form>
              )}

              {/* Sections List */}
              {sections.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-[#22242b] rounded-xl space-y-2">
                  <p className="text-xs text-gray-400">No custom sections configured. Examination runs as a single continuous session.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sections.map((sec, idx) => {
                    const secQuestions = questions.filter((q) => q.sectionId === sec.id);
                    return (
                      <div
                        key={sec.id}
                        className="p-3.5 bg-[#121318] border border-[#20222a] rounded-xl flex items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{sec.title}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-[#1c1d24] text-gray-300 border border-[#2a2d36]">
                              {secQuestions.length} Questions
                            </span>
                            {sec.isMandatory ? (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/50">
                                Mandatory
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-gray-800 text-gray-400">
                                Optional
                              </span>
                            )}
                          </div>
                          {sec.instructions && (
                            <p className="text-[11px] text-gray-400 line-clamp-1">{sec.instructions}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleMoveSection(idx, 'up')}
                            disabled={idx === 0}
                            className="p-1 rounded hover:bg-[#1f212a] text-gray-400 disabled:opacity-30"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleMoveSection(idx, 'down')}
                            disabled={idx === sections.length - 1}
                            className="p-1 rounded hover:bg-[#1f212a] text-gray-400 disabled:opacity-30"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingSectionId(sec.id);
                              setSectionTitle(sec.title);
                              setSectionDescription(sec.description);
                              setSectionInstructions(sec.instructions || '');
                              setSectionMandatory(sec.isMandatory !== false);
                              setSectionTimeLimit(sec.timeLimitMinutes || 0);
                              setIsAddingSection(true);
                            }}
                            className="p-1 rounded hover:bg-[#1f212a] text-gray-300 hover:text-white"
                            title="Edit Section"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSection(sec.id)}
                            className="p-1 rounded hover:bg-red-950/50 text-gray-400 hover:text-red-400"
                            title="Delete Section"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'branching' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Adaptive Branching Rules</h3>
                  <p className="text-[11px] text-gray-400">
                    Route students to specialized sections or conclude testing early based on their answers.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleValidateBranching}
                    disabled={isValidating || branchingRules.length === 0}
                    className="px-3 py-1.5 rounded-lg bg-[#181920] hover:bg-[#20222a] text-gray-300 hover:text-white border border-[#2a2d36] text-xs font-medium transition flex items-center gap-1.5 disabled:opacity-40"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isValidating ? 'animate-spin' : ''}`} />
                    Validate Cycles
                  </button>
                  {!isAddingRule && (
                    <button
                      onClick={() => setIsAddingRule(true)}
                      className="px-3 py-1.5 rounded-lg bg-[#FF9100] hover:bg-[#e08000] text-black font-semibold text-xs transition flex items-center gap-1.5 shadow"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Branching Rule
                    </button>
                  )}
                </div>
              </div>

              {/* Cycle Validation Banner */}
              {validationResult && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    validationResult.valid
                      ? 'bg-emerald-950/30 border-emerald-800 text-emerald-300'
                      : 'bg-rose-950/30 border-rose-800 text-rose-300'
                  }`}
                >
                  {validationResult.valid ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>All branching rules verified: No infinite cycles or missing destination nodes detected.</span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                      <div>
                        <span className="font-bold">Validation warning:</span>
                        <ul className="list-disc pl-4 mt-1 space-y-0.5">
                          {validationResult.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Add Branching Rule Form */}
              {isAddingRule && (
                <form onSubmit={handleSaveRule} className="p-4 bg-[#14151a] border border-[#282a35] rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-white">Author Branching Condition</h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-gray-300 mb-1">Source Question *</label>
                      <select
                        required
                        value={ruleSourceQuestionId}
                        onChange={(e) => {
                          setRuleSourceQuestionId(e.target.value);
                          setRuleConditionValue('');
                        }}
                        className="w-full px-3 py-1.5 bg-[#0f1013] border border-[#252730] rounded text-xs text-white focus:outline-none focus:border-[#FF9100]/60"
                      >
                        <option value="">-- Choose question --</option>
                        {questions.map((q) => (
                          <option key={q.id} value={q.id}>
                            [{q.questionType}] {q.promptText.slice(0, 50)}...
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-gray-300 mb-1">Condition Operator</label>
                      <select
                        value={ruleOperator}
                        onChange={(e) => setRuleOperator(e.target.value as BranchingOperator)}
                        className="w-full px-3 py-1.5 bg-[#0f1013] border border-[#252730] rounded text-xs text-white focus:outline-none focus:border-[#FF9100]/60"
                      >
                        <option value="selected_option">Selected Option Equals</option>
                        <option value="equals">Exact Value Equals</option>
                        <option value="not_equals">Does Not Equal</option>
                      </select>
                    </div>
                  </div>

                  {/* Condition Value */}
                  <div>
                    <label className="block text-[11px] text-gray-300 mb-1">Matching Answer Value *</label>
                    {selectedSourceQ && selectedSourceQ.options && selectedSourceQ.options.length > 0 ? (
                      <select
                        required
                        value={ruleConditionValue}
                        onChange={(e) => setRuleConditionValue(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#0f1013] border border-[#252730] rounded text-xs text-white focus:outline-none focus:border-[#FF9100]/60"
                      >
                        <option value="">-- Select option --</option>
                        {selectedSourceQ.options.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.id}: {opt.text}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        required
                        value={ruleConditionValue}
                        onChange={(e) => setRuleConditionValue(e.target.value)}
                        placeholder="Enter value to compare against"
                        className="w-full px-3 py-1.5 bg-[#0f1013] border border-[#252730] rounded text-xs text-white focus:outline-none focus:border-[#FF9100]/60"
                      />
                    )}
                  </div>

                  {/* Destination Routing */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-[#20222a]">
                    <div>
                      <label className="block text-[11px] text-gray-300 mb-1">If Condition Matches: Destination Type</label>
                      <select
                        value={ruleDestinationType}
                        onChange={(e) => setRuleDestinationType(e.target.value as BranchingDestinationType)}
                        className="w-full px-3 py-1.5 bg-[#0f1013] border border-[#252730] rounded text-xs text-white focus:outline-none focus:border-[#FF9100]/60"
                      >
                        <option value="section">Jump to Section</option>
                        <option value="question">Jump to Specific Question</option>
                        <option value="end">Conclude Examination Early</option>
                      </select>
                    </div>

                    {ruleDestinationType === 'section' && (
                      <div>
                        <label className="block text-[11px] text-gray-300 mb-1">Target Section</label>
                        <select
                          value={ruleDestinationId}
                          onChange={(e) => setRuleDestinationId(e.target.value)}
                          className="w-full px-3 py-1.5 bg-[#0f1013] border border-[#252730] rounded text-xs text-white focus:outline-none focus:border-[#FF9100]/60"
                        >
                          <option value="">-- Choose section --</option>
                          {sections.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {ruleDestinationType === 'question' && (
                      <div>
                        <label className="block text-[11px] text-gray-300 mb-1">Target Question</label>
                        <select
                          value={ruleDestinationId}
                          onChange={(e) => setRuleDestinationId(e.target.value)}
                          className="w-full px-3 py-1.5 bg-[#0f1013] border border-[#252730] rounded text-xs text-white focus:outline-none focus:border-[#FF9100]/60"
                        >
                          <option value="">-- Choose question --</option>
                          {questions.map((q) => (
                            <option key={q.id} value={q.id}>
                              {q.promptText.slice(0, 45)}...
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Fallback Destination */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] text-gray-300 mb-1">Otherwise (Default Fallback)</label>
                      <select
                        value={ruleDefaultDestType}
                        onChange={(e) => setRuleDefaultDestType(e.target.value as BranchingDestinationType)}
                        className="w-full px-3 py-1.5 bg-[#0f1013] border border-[#252730] rounded text-xs text-white focus:outline-none focus:border-[#FF9100]/60"
                      >
                        <option value="section">Continue to Section</option>
                        <option value="question">Continue to Question</option>
                        <option value="end">End Examination</option>
                      </select>
                    </div>

                    {ruleDefaultDestType === 'section' && (
                      <div>
                        <label className="block text-[11px] text-gray-300 mb-1">Fallback Section</label>
                        <select
                          value={ruleDefaultDestId}
                          onChange={(e) => setRuleDefaultDestId(e.target.value)}
                          className="w-full px-3 py-1.5 bg-[#0f1013] border border-[#252730] rounded text-xs text-white focus:outline-none focus:border-[#FF9100]/60"
                        >
                          <option value="">-- Choose section --</option>
                          {sections.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingRule(false)}
                      className="px-3 py-1.5 rounded bg-[#1c1d24] text-xs text-gray-300 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded bg-[#FF9100] text-black font-bold text-xs"
                    >
                      Save Rule
                    </button>
                  </div>
                </form>
              )}

              {/* Branching Rules List */}
              {branchingRules.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-[#22242b] rounded-xl space-y-2">
                  <p className="text-xs text-gray-400">No branching rules defined. Assessment flows linearly by question sort order.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {branchingRules.map((rule) => {
                    const srcQ = questions.find((q) => q.id === rule.sourceQuestionId);
                    const destSec = sections.find((s) => s.id === rule.destinationId);
                    const defSec = sections.find((s) => s.id === rule.defaultDestinationId);

                    return (
                      <div
                        key={rule.id}
                        className="p-3 bg-[#121318] border border-[#20222a] rounded-xl flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">
                              IF ({srcQ ? srcQ.promptText.slice(0, 30) : rule.sourceQuestionId}...)
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-[#1f212a] text-[#FF9100] text-[10px]">
                              {rule.conditionOperator} &apos;{rule.conditionValue}&apos;
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-400">
                            THEN &rarr; <span className="text-cyan-400">{rule.destinationType}</span> (
                            {destSec ? destSec.title : rule.destinationId || 'End'}) | ELSE &rarr;{' '}
                            <span className="text-gray-300">{rule.defaultDestinationType}</span> (
                            {defSec ? defSec.title : rule.defaultDestinationId || 'End'})
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1 rounded hover:bg-red-950/50 text-gray-400 hover:text-red-400"
                          title="Delete Rule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#22242b] flex items-center justify-between bg-[#0b0c0f]">
          <span className="text-[11px] text-gray-500">
            Changes take effect immediately for new examination sessions. Active student attempts retain their initial state.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#16171c] hover:bg-[#20222a] text-gray-200 border border-[#2a2d36] text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
