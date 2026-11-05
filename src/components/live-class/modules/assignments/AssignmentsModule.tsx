import React, { useState, useEffect, useMemo } from 'react';
import { useClassroom } from '@/context/ClassroomContext';
import {
  Assignment,
  AssignmentSubmission,
  TestResult,
  AssignmentStatus,
} from '@/types/assignments';
import {
  DEFAULT_ASSIGNMENTS,
  DEFAULT_SUBMISSIONS,
} from './assignmentDefaults';
import {
  loadAssignments,
  saveAssignments,
  loadSubmissions,
  saveSubmissions,
} from './assignmentPersistence';
import { evaluateAssignmentCode } from './assignmentEvaluator';
import { AssignmentModal } from './AssignmentModal';
import { GradingDrawer } from './GradingDrawer';
import {
  CheckSquare,
  FileCode,
  CheckCircle2,
  XCircle,
  Play,
  ArrowRight,
  Clock,
  Award,
  Plus,
  Edit3,
  Trash2,
  Users,
  RotateCcw,
  Check,
  AlertCircle,
} from 'lucide-react';

export const AssignmentsModule: React.FC = () => {
  const { setActiveModule, showToast, userRole, session } = useClassroom();
  const classroomId = session?.id || '';
  const [isLoadingServerAssignments, setIsLoadingServerAssignments] = useState(false);

  // State: Assignments and Submissions with localStorage persistence
  const [assignments, setAssignments] = useState<Assignment[]>(() => {
    const loaded = loadAssignments();
    return loaded && loaded.length > 0 ? loaded : DEFAULT_ASSIGNMENTS;
  });

  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>(() => {
    const loaded = loadSubmissions();
    return loaded && loaded.length > 0 ? loaded : DEFAULT_SUBMISSIONS;
  });

  // Selected assignment
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>(() => {
    return assignments[0]?.id || 'lab-04';
  });

  // Load authoritative assignments from Cortex classroom API
  useEffect(() => {
    if (!classroomId || typeof window === 'undefined') return;
    let isMounted = true;
    setIsLoadingServerAssignments(true);

    fetch(`/api/v1/classrooms/${classroomId}/assignments`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data?.assignments || !Array.isArray(data.assignments) || data.assignments.length === 0) return;

        const serverMapped: Assignment[] = data.assignments.map((a: any) => ({
          id: a.id,
          title: a.title,
          description: a.description || a.instructions || '',
          points: typeof a.maxMarks === 'number' ? a.maxMarks : 100,
          status: a.status || 'published',
          starterCode: a.starterCode || a.startercode || '',
          starterLanguage: a.language || 'C++17',
          difficulty: a.difficulty || 'medium',
          category: 'Core Curriculum',
          dueDate: new Date(a.dueAt || Date.now() + 86400000).toLocaleDateString(),
          testCases: Array.isArray(a.testCases) ? a.testCases.map((tc: any, idx: number) => ({
            id: tc.id || `tc_${idx + 1}`,
            name: tc.name || `Test Case ${idx + 1}`,
            input: tc.input || '',
            expectedOutput: tc.expectedOutput || '',
            isHidden: Boolean(tc.visibility === 'hidden' || tc.isHidden),
            weight: typeof tc.weight === 'number' ? tc.weight : 25,
          })) : [],
          rubricCriteria: [],
        }));

        setAssignments(serverMapped);
        if (serverMapped[0]) {
          setSelectedAssignmentId(serverMapped[0].id);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsLoadingServerAssignments(false);
      });

    return () => { isMounted = false; };
  }, [classroomId]);

  // Active assignment object
  const selectedAssignment = useMemo(() => {
    return assignments.find((a) => a.id === selectedAssignmentId) || assignments[0] || DEFAULT_ASSIGNMENTS[0];
  }, [assignments, selectedAssignmentId]);

  // Code editor state per assignment
  const [codeBuffers, setCodeBuffers] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    DEFAULT_ASSIGNMENTS.forEach((a) => {
      initial[a.id] = a.starterCode;
    });
    return initial;
  });

  // Test execution state per assignment
  const [testResultsMap, setTestResultsMap] = useState<Record<string, TestResult[]>>({});
  const [hasRunTestsMap, setHasRunTestsMap] = useState<Record<string, boolean>>({});
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter state for teacher view
  const [statusFilter, setStatusFilter] = useState<'all' | AssignmentStatus>('all');

  // Modals and Drawers
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [assignmentToEdit, setAssignmentToEdit] = useState<Assignment | null>(null);
  const [isGradingDrawerOpen, setIsGradingDrawerOpen] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState<Assignment | null>(null);

  // Mobile responsive tab
  const [mobileTab, setMobileTab] = useState<'list' | 'workspace'>('list');

  // Active student identity for demo/test runner
  const currentStudentId = userRole === 'teacher' ? 'usr_prof_shivam' : 'usr_student_alex';
  const currentStudentName = userRole === 'teacher' ? 'Prof. Shivam Patil' : 'Alex Chen';
  const currentStudentEmail =
    userRole === 'teacher' ? 'shivam.patil@cortex.edu' : 'alex.chen@student.cortex.edu';

  // Synchronize localStorage on assignments changes
  useEffect(() => {
    saveAssignments(assignments);
  }, [assignments]);

  // Synchronize localStorage on submissions changes
  useEffect(() => {
    saveSubmissions(submissions);
  }, [submissions]);

  // Initialize starter code when new assignment selected if not present
  useEffect(() => {
    if (selectedAssignment && !(selectedAssignment.id in codeBuffers)) {
      setCodeBuffers((prev) => ({
        ...prev,
        [selectedAssignment.id]: selectedAssignment.starterCode,
      }));
    }
  }, [selectedAssignment, codeBuffers]);

  // Filtered assignments list
  const filteredAssignments = useMemo(() => {
    let list = assignments;
    // Hide drafts from students
    if (userRole !== 'teacher') {
      list = list.filter((a) => a.status === 'published');
    } else if (statusFilter !== 'all') {
      list = list.filter((a) => a.status === statusFilter);
    }
    return list;
  }, [assignments, statusFilter, userRole]);

  // Current code buffer
  const currentCode = codeBuffers[selectedAssignment.id] ?? selectedAssignment.starterCode;

  // Current test run status
  const hasTestsRun = !!hasRunTestsMap[selectedAssignment.id];
  const currentTestResults = testResultsMap[selectedAssignment.id] || [];
  const allTestsPassed =
    hasTestsRun &&
    currentTestResults.length > 0 &&
    currentTestResults.every((r) => r.passed);

  // Current user's latest submission for this assignment
  const userSubmission = useMemo(() => {
    const studentAttempts = submissions.filter(
      (s) => s.assignmentId === selectedAssignment.id && s.studentId === currentStudentId
    );
    if (studentAttempts.length === 0) return undefined;
    return [...studentAttempts].sort((a, b) => b.attemptNumber - a.attemptNumber)[0];
  }, [submissions, selectedAssignment.id, currentStudentId]);

  // All submissions for selected assignment
  const assignmentSubmissions = useMemo(() => {
    return submissions.filter((s) => s.assignmentId === selectedAssignment.id);
  }, [submissions, selectedAssignment.id]);

  // Run Test Suites (Isolated Evaluation)
  const handleRunTests = async () => {
    setIsRunningTests(true);

    try {
      const outcome = await evaluateAssignmentCode(selectedAssignment, currentCode);
      const results = outcome.results;

      setTestResultsMap((prev) => ({
        ...prev,
        [selectedAssignment.id]: results,
      }));
      setHasRunTestsMap((prev) => ({
        ...prev,
        [selectedAssignment.id]: true,
      }));

      const passedCount = results.filter((r) => r.passed).length;
      const totalCount = results.length;
      showToast(
        `Automated test suites passed for ${selectedAssignment.title} (${passedCount}/${totalCount})`
      );
    } catch (err) {
      showToast('Error during test suite evaluation: ' + String(err));
    } finally {
      setIsRunningTests(false);
    }
  };

  // Submit Assignment
  const handleSubmit = () => {
    if (isSubmitting) return;

    if (selectedAssignment.status === 'closed') {
      showToast('This assignment is closed and is no longer accepting submissions.');
      return;
    }

    if (!hasTestsRun) {
      showToast('Please run automated test suites before submitting.');
      return;
    }

    setIsSubmitting(true);

    try {
      const passedCount = currentTestResults.filter((r) => r.passed).length;
      const totalCount = currentTestResults.length || selectedAssignment.testCases.length || 1;
      const computedScore = Math.round((passedCount / totalCount) * selectedAssignment.points);

      const existingAttempts = submissions.filter(
        (s) => s.assignmentId === selectedAssignment.id && s.studentId === currentStudentId
      );
      const attemptNumber =
        existingAttempts.length > 0
          ? Math.max(...existingAttempts.map((s) => s.attemptNumber)) + 1
          : 1;

      const newSub: AssignmentSubmission = {
        id: `sub_${currentStudentId}_${selectedAssignment.id}_att${attemptNumber}_${Date.now()}`,
        assignmentId: selectedAssignment.id,
        studentId: currentStudentId,
        studentName: currentStudentName,
        studentEmail: currentStudentEmail,
        attemptNumber,
        code: currentCode,
        language: selectedAssignment.starterLanguage,
        testResults:
          currentTestResults.length > 0
            ? currentTestResults
            : selectedAssignment.testCases.map((tc) => ({
                id: tc.id,
                passed: true,
                input: tc.input,
                expectedOutput: tc.expectedOutput,
                actualOutput: tc.expectedOutput,
                runtimeMs: tc.runtimeMs || 4,
              })),
        status: 'submitted',
        score: computedScore,
        maxScore: selectedAssignment.points,
        submittedAt: Date.now(),
      };

      // Preserve full attempt history locally
      setSubmissions((prev) => [newSub, ...prev]);

      // Synchronize with server if in live classroom context
      if (classroomId) {
        fetch(`/api/v1/classrooms/${classroomId}/assignments/${selectedAssignment.id}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: currentCode,
            language: selectedAssignment.starterLanguage,
          }),
        }).catch(() => {});
      }

      showToast(`Assignment submitted successfully (Attempt #${attemptNumber})`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset code to starter code
  const handleResetCode = () => {
    setCodeBuffers((prev) => ({
      ...prev,
      [selectedAssignment.id]: selectedAssignment.starterCode,
    }));
    setHasRunTestsMap((prev) => ({
      ...prev,
      [selectedAssignment.id]: false,
    }));
    showToast('Code reset to assignment starter template');
  };

  // Teacher Save Assignment (Create / Edit)
  const handleSaveAssignment = (saved: Assignment) => {
    if (assignmentToEdit) {
      setAssignments((prev) =>
        prev.map((a) => (a.id === saved.id ? { ...saved, updatedAt: Date.now() } : a))
      );
      showToast(`Updated assignment: ${saved.title}`);
    } else {
      setAssignments((prev) => [saved, ...prev]);
      setSelectedAssignmentId(saved.id);

      // Create on platform backend
      if (classroomId && userRole === 'teacher') {
        fetch(`/api/v1/classrooms/${classroomId}/assignments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: saved.title,
            description: saved.description,
            instructions: saved.description,
            type: 'code',
            difficulty: saved.difficulty || 'medium',
            language: saved.starterLanguage || 'cpp',
            starterCode: saved.starterCode,
            dueAt: Date.now() + 7 * 86400000,
            maxMarks: saved.points || 100,
            testCases: saved.testCases,
          }),
        }).catch(() => {});
      }

      showToast(`Created new assignment: ${saved.title}`);
    }
    setIsCreateModalOpen(false);
    setAssignmentToEdit(null);
  };

  // Teacher Delete Assignment
  const handleDeleteAssignment = (id: string) => {
    if (assignments.length <= 1) {
      showToast('Cannot delete the last remaining assignment.');
      return;
    }
    const toDelete = assignments.find((a) => a.id === id);
    setAssignments((prev) => prev.filter((a) => a.id !== id));
    if (selectedAssignmentId === id) {
      const remaining = assignments.filter((a) => a.id !== id);
      setSelectedAssignmentId(remaining[0]?.id || '');
    }
    setAssignmentToDelete(null);
    showToast(`Deleted assignment: ${toDelete?.title || id}`);
  };

  // Teacher Save Grade & Feedback
  const handleSaveGrade = (
    submissionId: string,
    score: number,
    feedback: string,
    rubricScores?: Record<string, number>
  ) => {
    setSubmissions((prev) =>
      prev.map((s) => {
        if (s.id === submissionId) {
          return {
            ...s,
            score,
            teacherFeedback: feedback,
            rubricScores: rubricScores || s.rubricScores,
            status: 'graded',
            gradedAt: Date.now(),
          };
        }
        return s;
      })
    );
    showToast('Student grade and qualitative feedback saved');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B0C0E] overflow-hidden select-none">
      {/* Module Header */}
      <div className="h-11 border-b border-[#282A36] bg-[#111216] px-4 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs text-[#A1A1AA]">
          <CheckSquare className="w-3.5 h-3.5 text-[#10B981]" />
          <span className="font-semibold text-white">Classroom Assignments & Labs</span>
        </div>
        <div className="flex items-center space-x-3">
          {/* Teacher Action Controls */}
          {userRole === 'teacher' && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setAssignmentToEdit(null);
                  setIsCreateModalOpen(true);
                }}
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#10B981] hover:bg-[#059669] text-white text-xs font-semibold transition-colors"
                title="Create a new assignment"
              >
                <Plus className="w-3 h-3" />
                <span className="hidden sm:inline">New Assignment</span>
              </button>
              <button
                onClick={() => setIsGradingDrawerOpen(true)}
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded border border-[#282A36] bg-[#15161C] hover:bg-[#282A36] text-[#E4E4E7] text-xs font-medium transition-colors"
                title="Review student submissions"
              >
                <Users className="w-3 h-3 text-[#FF9100]" />
                <span className="hidden sm:inline">Submissions</span>
                <span className="px-1.5 py-0.2 rounded-full bg-[#FF9100]/20 text-[#FF9100] text-[10px] font-bold">
                  {assignmentSubmissions.length}
                </span>
              </button>
            </div>
          )}
          <span className="text-[11px] text-[#71717A] font-mono hidden md:inline">
            In-class lab tasks and automated evaluation
          </span>
        </div>
      </div>

      {/* Mobile Tab Switcher (< md) */}
      <div className="flex md:hidden border-b border-[#282A36] bg-[#0E0F13]">
        <button
          onClick={() => setMobileTab('list')}
          className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-colors ${
            mobileTab === 'list'
              ? 'border-[#FF9100] text-white bg-[#15161C]'
              : 'border-transparent text-[#71717A] hover:text-[#A1A1AA]'
          }`}
        >
          Assignments ({filteredAssignments.length})
        </button>
        <button
          onClick={() => setMobileTab('workspace')}
          className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-colors ${
            mobileTab === 'workspace'
              ? 'border-[#10B981] text-white bg-[#15161C]'
              : 'border-transparent text-[#71717A] hover:text-[#A1A1AA]'
          }`}
        >
          Workspace & Testing
        </button>
      </div>

      {/* Main Content Split: Left Assignment List, Right Detail */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Assignment List */}
        <div
          className={`${
            mobileTab === 'list' ? 'flex' : 'hidden'
          } md:flex flex-col w-full md:w-80 border-r border-[#282A36] bg-[#0E0F13] p-4 space-y-3 overflow-y-auto`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#71717A]">
              Active Assignments
            </span>
            {userRole === 'teacher' && (
              <div className="flex items-center space-x-1">
                {(['all', 'published', 'draft'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      statusFilter === st
                        ? 'bg-[#282A36] text-white'
                        : 'text-[#71717A] hover:text-[#A1A1AA]'
                    }`}
                  >
                    {st === 'all' ? 'All Tasks' : st.charAt(0).toUpperCase() + st.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            {filteredAssignments.map((asg) => {
              const isSelected = asg.id === selectedAssignment.id;
              const subCount = submissions.filter((s) => s.assignmentId === asg.id).length;
              return (
                <div
                  key={asg.id}
                  onClick={() => {
                    setSelectedAssignmentId(asg.id);
                    setMobileTab('workspace');
                  }}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-[#FF9100] bg-[#1D1F27] shadow-sm'
                      : 'border-[#282A36] bg-[#15161C] hover:border-[#3E4251]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-mono text-[#FF9100] font-semibold">
                        {asg.difficulty}
                      </span>
                      {asg.status !== 'published' && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#71717A]/20 text-[#A1A1AA] uppercase">
                          {asg.status}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[#71717A] flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {asg.dueTime}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-white leading-snug">{asg.title}</h4>
                  <div className="mt-3 flex items-center justify-between text-[11px] pt-2 border-t border-[#282A36]">
                    <span className="text-[#A1A1AA]">{asg.points} Points</span>
                    <div className="flex items-center space-x-2">
                      {userRole === 'teacher' ? (
                        <span className="text-[10px] text-[#06B6D4] font-medium">
                          {subCount} Submissions
                        </span>
                      ) : (
                        <span className="text-[#10B981] font-mono font-medium">Auto-Graded</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Problem Specification, Solution Editor, Test Suites, and Submission */}
        <div
          className={`${
            mobileTab === 'workspace' ? 'flex' : 'hidden'
          } md:flex flex-1 flex-col p-4 md:p-6 bg-[#0B0C0E] overflow-y-auto space-y-6`}
        >
          {/* Problem Header Card */}
          <div className="rounded-xl border border-[#282A36] bg-[#111216] p-5 md:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono text-[#06B6D4] uppercase font-semibold">
                    Lab Task Specification
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-[#282A36] text-[#A1A1AA] font-mono">
                    {selectedAssignment.starterLanguage}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-[#FF9100]/15 text-[#FF9100] font-medium">
                    {selectedAssignment.points} Points
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white mt-1">
                  {selectedAssignment.title}
                </h2>
              </div>
              <div className="flex items-center space-x-2">
                {userRole === 'teacher' && (
                  <>
                    <button
                      onClick={() => {
                        setAssignmentToEdit(selectedAssignment);
                        setIsCreateModalOpen(true);
                      }}
                      className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-[#282A36] bg-[#15161C] hover:bg-[#282A36] text-white text-xs font-medium transition-colors"
                      title="Edit this assignment"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#06B6D4]" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => setAssignmentToDelete(selectedAssignment)}
                      disabled={assignments.length <= 1}
                      className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-[#282A36] bg-[#15161C] hover:bg-[#7F1D1D]/30 text-[#EF4444] text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title={
                        assignments.length <= 1
                          ? 'Cannot delete the only remaining assignment'
                          : 'Delete assignment'
                      }
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => setActiveModule('code')}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-[#06B6D4]/40 bg-[#06B6D4]/10 text-[#06B6D4] text-xs font-medium hover:bg-[#06B6D4]/20 transition-colors"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Open in Code Studio</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </button>
              </div>
            </div>

            <p className="text-xs text-[#E4E4E7] leading-relaxed bg-[#15161C] p-4 rounded-lg border border-[#282A36]">
              {selectedAssignment.description}
            </p>

            {selectedAssignment.instructions && (
              <div className="text-xs text-[#A1A1AA] bg-[#0E0F13] p-3 rounded-lg border border-[#282A36] space-y-1">
                <span className="font-semibold text-white block mb-1">Implementation Guidelines:</span>
                <div className="whitespace-pre-line leading-relaxed font-mono text-[11px]">
                  {selectedAssignment.instructions}
                </div>
              </div>
            )}
          </div>

          {/* Released Grade Card (if student submission is graded) */}
          {userSubmission && userSubmission.status === 'graded' && (
            <div className="rounded-xl border border-[#10B981]/50 bg-[#10B981]/10 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Award className="w-5 h-5 text-[#10B981]" />
                  <span className="text-sm font-bold text-white">Graded Assessment Report</span>
                </div>
                <span className="px-3 py-1 rounded-md text-xs font-bold bg-[#10B981] text-black">
                  Score: {userSubmission.score} / {userSubmission.maxScore} (
                  {Math.round((userSubmission.score / userSubmission.maxScore) * 100)}%)
                </span>
              </div>
              {userSubmission.teacherFeedback && (
                <div className="p-3 bg-[#111216] rounded-lg border border-[#10B981]/30">
                  <span className="text-[11px] font-semibold text-[#10B981] block mb-1">
                    Instructor Qualitative Feedback:
                  </span>
                  <p className="text-xs text-[#E4E4E7] leading-relaxed italic">
                    "{userSubmission.teacherFeedback}"
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Interactive Solution Code Editor */}
          <div className="rounded-xl border border-[#282A36] bg-[#111216] p-5 md:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileCode className="w-4 h-4 text-[#06B6D4]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Solution Code Editor ({selectedAssignment.starterLanguage})
                </h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleResetCode}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded border border-[#282A36] bg-[#15161C] hover:bg-[#282A36] text-[#A1A1AA] hover:text-white text-xs transition-colors"
                  title="Reset code to default template"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Template</span>
                </button>
              </div>
            </div>

            <div className="relative">
              <textarea
                value={currentCode}
                onChange={(e) => {
                  const val = e.target.value;
                  setCodeBuffers((prev) => ({
                    ...prev,
                    [selectedAssignment.id]: val,
                  }));
                }}
                spellCheck={false}
                aria-label="Assignment Solution Code"
                rows={10}
                className="w-full p-4 rounded-lg bg-[#0E0F13] border border-[#282A36] font-mono text-xs text-[#E4E4E7] leading-relaxed focus:outline-none focus:border-[#10B981] resize-y"
              />
            </div>
          </div>

          {/* Automated Test Suites */}
          <div className="rounded-xl border border-[#282A36] bg-[#111216] p-5 md:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Award className="w-4 h-4 text-[#FF9100]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Automated Test Suites (Isolated Evaluation)
                </h3>
              </div>
              <button
                onClick={handleRunTests}
                disabled={isRunningTests}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#FF9100] text-black font-semibold text-xs hover:bg-[#E08000] disabled:opacity-40 transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-black" />
                <span>{isRunningTests ? 'Executing Suites...' : 'Run Test Suites'}</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {selectedAssignment.testCases.map((tc) => {
                const result = currentTestResults.find((r) => r.id === tc.id);
                const passed = hasTestsRun ? (result ? result.passed : true) : false;

                return (
                  <div
                    key={tc.id}
                    className="p-3.5 rounded-lg bg-[#15161C] border border-[#282A36] flex flex-col sm:flex-row sm:items-center justify-between text-xs font-mono gap-2"
                  >
                    <div className="flex items-center space-x-3">
                      {hasTestsRun ? (
                        passed ? (
                          <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-[#EF4444] flex-shrink-0" />
                        )
                      ) : (
                        <Clock className="w-4 h-4 text-[#71717A] flex-shrink-0" />
                      )}
                      <div>
                        <span className="text-white font-semibold">
                          Test Case #{tc.id}
                          {tc.name ? ` (${tc.name})` : ''}:
                        </span>
                        <span className="text-[#A1A1AA] ml-2">{tc.input}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] text-[#71717A]">Expected:</span>
                      <span className="text-[#06B6D4]">{tc.expectedOutput}</span>
                      {hasTestsRun ? (
                        passed ? (
                          <span className="ml-3 px-2 py-0.5 rounded bg-[#10B981]/20 text-[#10B981] text-[10px] font-bold">
                            PASSED ({result?.runtimeMs || tc.runtimeMs || 4}ms)
                          </span>
                        ) : (
                          <span className="ml-3 px-2 py-0.5 rounded bg-[#EF4444]/20 text-[#EF4444] text-[10px] font-bold">
                            {result?.errorType === 'timeout'
                              ? 'TIMEOUT (1000ms)'
                              : result?.errorType === 'syntax_error'
                              ? 'SYNTAX ERROR'
                              : result?.errorType === 'worker_error'
                              ? 'WORKER ERROR'
                              : 'FAILED'}
                          </span>
                        )
                      ) : (
                        <span className="ml-3 px-2 py-0.5 rounded bg-[#282A36] text-[#A1A1AA] text-[10px] font-mono">
                          PENDING
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Rubric Criteria Overview (if present) */}
            {selectedAssignment.rubricCriteria && selectedAssignment.rubricCriteria.length > 0 && (
              <div className="pt-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#71717A] block mb-2">
                  Grading Rubric
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {selectedAssignment.rubricCriteria.map((rc) => (
                    <div
                      key={rc.id}
                      className="p-2.5 rounded-lg bg-[#0E0F13] border border-[#282A36] text-xs"
                    >
                      <div className="flex items-center justify-between text-white font-semibold mb-1">
                        <span>{rc.title}</span>
                        <span className="text-[#FF9100] font-mono">{rc.maxPoints} pts</span>
                      </div>
                      <p className="text-[11px] text-[#71717A] line-clamp-2">{rc.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submission Footer */}
            <div className="pt-4 border-t border-[#282A36] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-xs text-[#71717A]">
                {selectedAssignment.status === 'closed'
                  ? 'Status: Closed (Submissions concluded)'
                  : hasTestsRun && !allTestsPassed
                  ? 'Status: Test failures or timeout detected (Submission locked until passing)'
                  : userSubmission
                  ? userSubmission.status === 'graded'
                    ? `Status: Graded (${userSubmission.score}/${userSubmission.maxScore} recorded, Attempt #${userSubmission.attemptNumber})`
                    : `Status: Submitted for grading (Attempt #${userSubmission.attemptNumber})`
                  : hasTestsRun
                  ? 'Status: Verification suites passed (Ready to submit)'
                  : 'Status: Unsubmitted (Pending test execution)'}
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSubmit}
                  disabled={!hasTestsRun || !allTestsPassed || selectedAssignment.status === 'closed' || isSubmitting}
                  className="px-4 py-2 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white font-semibold text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    {selectedAssignment.status === 'closed'
                      ? 'Assignment Closed'
                      : userSubmission
                      ? 'Resubmit Assignment for Credit'
                      : 'Submit Assignment for Credit'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Teacher Create / Edit Assignment Modal */}
      <AssignmentModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setAssignmentToEdit(null);
        }}
        assignmentToEdit={assignmentToEdit}
        onSave={handleSaveAssignment}
      />

      {/* Teacher Delete Confirmation Dialog */}
      {assignmentToDelete && (
        <div
          role="dialog"
          aria-label="Confirm Assignment Deletion"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-md bg-[#111216] border border-[#282A36] rounded-xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-[#EF4444]">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <h3 className="text-sm font-bold text-white">Delete Assignment</h3>
            </div>
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <span className="text-white font-semibold">"{assignmentToDelete.title}"</span>? All
              student submissions for this assignment will remain archived.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setAssignmentToDelete(null)}
                className="px-3 py-1.5 rounded-lg border border-[#282A36] bg-[#15161C] hover:bg-[#282A36] text-[#A1A1AA] hover:text-white text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteAssignment(assignmentToDelete.id)}
                className="px-3 py-1.5 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-semibold transition-colors"
              >
                Delete Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Teacher Submissions & Grading Drawer */}
      <GradingDrawer
        isOpen={isGradingDrawerOpen}
        onClose={() => setIsGradingDrawerOpen(false)}
        assignment={selectedAssignment}
        submissions={submissions}
        onSaveGrade={handleSaveGrade}
      />
    </div>
  );
};
