import React, { useState, useEffect } from 'react';
import { Assignment, AssignmentSubmission } from '@/types/assignments';
import {
  X,
  CheckCircle2,
  XCircle,
  FileCode,
  Award,
  MessageSquare,
  Check,
  AlertCircle,
  User,
  Clock,
} from 'lucide-react';

interface GradingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: Assignment;
  submissions: AssignmentSubmission[];
  onSaveGrade: (
    submissionId: string,
    score: number,
    feedback: string,
    rubricScores?: Record<string, number>
  ) => void;
}

export const GradingDrawer: React.FC<GradingDrawerProps> = ({
  isOpen,
  onClose,
  assignment,
  submissions,
  onSaveGrade,
}) => {
  const assignmentSubmissions = submissions.filter((s) => s.assignmentId === assignment.id);
  const [selectedSubId, setSelectedSubId] = useState<string>(
    assignmentSubmissions[0]?.id || ''
  );

  const selectedSubmission = assignmentSubmissions.find((s) => s.id === selectedSubId) || assignmentSubmissions[0];

  const [score, setScore] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>('');
  const [rubricScores, setRubricScores] = useState<Record<string, number>>({});
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (selectedSubmission) {
      setScore(selectedSubmission.score);
      setFeedback(selectedSubmission.teacherFeedback || '');
      setRubricScores(selectedSubmission.rubricScores || {});
      setScoreError(null);
      setSavedSuccess(false);
    }
  }, [selectedSubmission]);

  useEffect(() => {
    if (assignmentSubmissions.length > 0 && !assignmentSubmissions.some((s) => s.id === selectedSubId)) {
      setSelectedSubId(assignmentSubmissions[0].id);
    }
  }, [assignmentSubmissions, selectedSubId]);

  if (!isOpen) return null;

  const handleScoreChange = (raw: string) => {
    if (raw.trim() === '') {
      setScore(0);
      setScoreError('Score cannot be empty');
      return;
    }
    const val = Number(raw);
    if (isNaN(val)) {
      setScoreError('Score must be a valid number');
      return;
    }
    if (val < 0) {
      setScoreError('Score cannot be negative');
    } else if (val > assignment.points) {
      setScoreError(`Score cannot exceed maximum points (${assignment.points})`);
    } else {
      setScoreError(null);
    }
    setScore(val);
  };

  const handleRubricScoreChange = (criterionId: string, val: number, max: number) => {
    const clamped = Math.max(0, Math.min(val, max));
    const nextRubric = { ...rubricScores, [criterionId]: clamped };
    setRubricScores(nextRubric);

    // Auto-calculate sum from rubric
    const sum = Object.values(nextRubric).reduce((acc, curr) => acc + curr, 0);
    setScore(sum);
    if (sum > assignment.points) {
      setScoreError(`Score cannot exceed maximum points (${assignment.points})`);
    } else {
      setScoreError(null);
    }
  };

  const handleSave = () => {
    if (!selectedSubmission) return;

    if (score < 0 || score > assignment.points) {
      setScoreError(`Please provide a valid score between 0 and ${assignment.points}`);
      return;
    }

    onSaveGrade(selectedSubmission.id, score, feedback, rubricScores);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
    }, 2500);
  };

  return (
    <div
      role="dialog"
      aria-label="Student Submissions & Grading Drawer"
      aria-modal="true"
      className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm"
    >
      <div className="w-full max-w-3xl bg-[#111216] border-l border-[#282A36] h-full flex flex-col shadow-2xl text-white">
        {/* Header */}
        <div className="p-4 border-b border-[#282A36] bg-[#15161C] flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <Award className="w-4 h-4 text-[#10B981]" />
              <h2 className="text-sm font-bold text-white">Review Submissions & Grading</h2>
            </div>
            <p className="text-xs text-[#71717A] mt-0.5 truncate max-w-md">
              {assignment.title} ({assignment.points} Max Points)
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close grading drawer"
            className="p-1.5 rounded-lg text-[#71717A] hover:text-white hover:bg-[#282A36] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {assignmentSubmissions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <AlertCircle className="w-12 h-12 text-[#71717A] mb-3" />
            <h3 className="text-sm font-semibold text-white">No Submissions Recorded</h3>
            <p className="text-xs text-[#71717A] mt-1 max-w-xs">
              No students have submitted solutions for this assignment yet. Submissions will appear here when turned in.
            </p>
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* Left Roster Column */}
            <div className="w-64 border-r border-[#282A36] bg-[#0E0F13] p-3 space-y-2 overflow-y-auto">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#71717A] px-1 mb-2">
                Submissions ({assignmentSubmissions.length})
              </div>
              {assignmentSubmissions.map((sub) => {
                const isSelected = sub.id === (selectedSubmission?.id || '');
                const isGraded = sub.status === 'graded';
                return (
                  <button
                    key={sub.id}
                    onClick={() => setSelectedSubId(sub.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-[#10B981] bg-[#15161C] shadow-sm'
                        : 'border-[#282A36] bg-[#111216] hover:border-[#3E4251]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-white truncate max-w-[130px]">
                        {sub.studentName}
                      </span>
                      {isGraded ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#10B981]/20 text-[#10B981]">
                          {sub.score}/{sub.maxScore}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#FF9100]/20 text-[#FF9100]">
                          Needs Grade
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[#71717A]">
                      <span>Attempt #{sub.attemptNumber}</span>
                      <span className="flex items-center">
                        <Clock className="w-2.5 h-2.5 mr-0.5" />
                        {new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right Review and Grading Column */}
            {selectedSubmission && (
              <div className="flex-1 p-5 overflow-y-auto space-y-5 bg-[#0B0C0E]">
                {/* Student Info Card */}
                <div className="p-4 rounded-xl border border-[#282A36] bg-[#111216] flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-full bg-[#10B981]/15 border border-[#10B981]/30 flex items-center justify-center text-[#10B981] font-bold text-xs">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center space-x-2">
                        <span>{selectedSubmission.studentName}</span>
                        <span className="text-[10px] text-[#71717A] font-normal">
                          ({selectedSubmission.studentEmail})
                        </span>
                      </div>
                      <div className="text-[11px] text-[#71717A] mt-0.5">
                        Submitted: {new Date(selectedSubmission.submittedAt).toLocaleString()} | Attempt #{selectedSubmission.attemptNumber}
                      </div>
                    </div>
                  </div>
                  <div>
                    {selectedSubmission.status === 'graded' ? (
                      <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30">
                        Graded: {selectedSubmission.score} / {selectedSubmission.maxScore}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-[#FF9100]/20 text-[#FF9100] border border-[#FF9100]/30">
                        Pending Grade
                      </span>
                    )}
                  </div>
                </div>

                {/* Submitted Code Snapshot */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs font-semibold text-[#A1A1AA]">
                      <FileCode className="w-3.5 h-3.5 text-[#06B6D4]" />
                      <span>Submitted Code ({selectedSubmission.language})</span>
                    </div>
                    <span className="text-[11px] text-[#71717A] font-mono">
                      {selectedSubmission.code.split('\n').length} lines
                    </span>
                  </div>
                  <pre className="p-3.5 rounded-lg bg-[#15161C] border border-[#282A36] font-mono text-xs text-[#E4E4E7] overflow-x-auto max-h-48 leading-relaxed select-text">
                    {selectedSubmission.code}
                  </pre>
                </div>

                {/* Test Evaluation Results */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#A1A1AA]">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
                      <span>Automated Test Evaluation Results</span>
                    </div>
                    <span className="text-[11px] font-mono text-[#10B981]">
                      {selectedSubmission.testResults.filter((r) => r.passed).length} /{' '}
                      {selectedSubmission.testResults.length} Passed
                    </span>
                  </div>
                  <div className="space-y-2">
                    {selectedSubmission.testResults.map((tr) => (
                      <div
                        key={tr.id}
                        className={`p-3 rounded-lg border text-xs font-mono flex items-center justify-between ${
                          tr.passed
                            ? 'bg-[#15161C] border-[#282A36]'
                            : 'bg-[#7F1D1D]/20 border-[#EF4444]/40'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          {tr.passed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] flex-shrink-0" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-[#EF4444] flex-shrink-0" />
                          )}
                          <div className="truncate max-w-sm">
                            <span className="text-white font-semibold">Test #{tr.id}:</span>
                            <span className="text-[#A1A1AA] ml-1.5">{tr.input}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] text-[#71717A]">
                            Result: <span className={tr.passed ? 'text-[#10B981]' : 'text-[#EF4444]'}>{tr.actualOutput}</span>
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              tr.passed
                                ? 'bg-[#10B981]/20 text-[#10B981]'
                                : 'bg-[#EF4444]/20 text-[#EF4444]'
                            }`}
                          >
                            {tr.passed ? `PASSED (${tr.runtimeMs}ms)` : 'FAILED'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rubric Evaluation (if available) */}
                {assignment.rubricCriteria && assignment.rubricCriteria.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-[#A1A1AA] flex items-center space-x-2">
                      <Award className="w-3.5 h-3.5 text-[#FF9100]" />
                      <span>Rubric Assessment Criteria</span>
                    </div>
                    <div className="space-y-2">
                      {assignment.rubricCriteria.map((crit) => (
                        <div
                          key={crit.id}
                          className="p-3 rounded-lg border border-[#282A36] bg-[#15161C] flex items-center justify-between text-xs"
                        >
                          <div className="max-w-md">
                            <div className="font-semibold text-white">{crit.title}</div>
                            <div className="text-[11px] text-[#71717A] mt-0.5">{crit.description}</div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              min="0"
                              max={crit.maxPoints}
                              value={rubricScores[crit.id] ?? crit.maxPoints}
                              onChange={(e) =>
                                handleRubricScoreChange(
                                  crit.id,
                                  parseInt(e.target.value, 10) || 0,
                                  crit.maxPoints
                                )
                              }
                              aria-label={`Score for ${crit.title}`}
                              className="w-16 px-2 py-1 rounded bg-[#0E0F13] border border-[#282A36] text-white text-xs font-mono text-right focus:outline-none focus:border-[#10B981]"
                            />
                            <span className="text-[11px] text-[#71717A]">/ {crit.maxPoints}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Score Input & Feedback */}
                <div className="p-4 rounded-xl border border-[#282A36] bg-[#111216] space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#A1A1AA] mb-1.5">
                      Total Awarded Score (Max: {assignment.points} Points)
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="number"
                        min="0"
                        max={assignment.points}
                        value={isNaN(score) ? '' : score}
                        onChange={(e) => handleScoreChange(e.target.value)}
                        aria-label="Awarded Score"
                        className="w-24 px-3 py-1.5 rounded-lg bg-[#15161C] border border-[#282A36] text-white text-sm font-bold font-mono focus:outline-none focus:border-[#10B981]"
                      />
                      <span className="text-xs text-[#71717A]">
                        points out of {assignment.points}
                      </span>
                    </div>
                    {scoreError && (
                      <p className="text-[11px] text-[#EF4444] mt-1.5 flex items-center">
                        <AlertCircle className="w-3.5 h-3.5 mr-1" />
                        {scoreError}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#A1A1AA] mb-1.5 flex items-center space-x-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-[#06B6D4]" />
                      <span>Instructor Qualitative Feedback</span>
                    </label>
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Enter specific feedback, code review comments, and optimization tips..."
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg bg-[#15161C] border border-[#282A36] text-white text-xs placeholder-[#71717A] focus:outline-none focus:border-[#10B981] resize-none"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-xs text-[#10B981] flex items-center">
                      {savedSuccess ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1 text-[#10B981]" />
                          Grade and feedback saved successfully
                        </>
                      ) : (
                        <span className="text-[#71717A]">
                          Status: {selectedSubmission.status === 'graded' ? 'Graded' : 'Unreviewed'}
                        </span>
                      )}
                    </span>
                    <button
                      onClick={handleSave}
                      className="px-4 py-2 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white text-xs font-semibold transition-colors flex items-center space-x-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Grade & Feedback</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
