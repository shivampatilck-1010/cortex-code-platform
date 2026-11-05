'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Play,
  Clock,
  Award,
  Shield,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Settings,
  Trash2,
  Edit3,
  Eye,
  ListOrdered,
  Users,
  Search,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Sparkles,
  BookOpen,
  GitBranch,
  Activity,
} from 'lucide-react';
import { Exam, ExamStatus } from '@/lib/classroom/models';
import { ExamBuilderModal } from './ExamBuilderModal';
import { ExamQuestionsManagerModal } from './ExamQuestionsManagerModal';
import { ExamPreviewModal } from './ExamPreviewModal';
import { ExamSubmissionsModal } from './ExamSubmissionsModal';
import { ExamRunnerModal } from './ExamRunnerModal';
import { QuestionBankModal } from './QuestionBankModal';
import { ExamSectionsBranchingModal } from './ExamSectionsBranchingModal';
import { ExamLiveDashboardModal } from './ExamLiveDashboardModal';
import { CortexLockdownTeacherInfoModal } from './CortexLockdownTeacherInfoModal';

interface ExaminationsTabProps {
  classroomId: string;
  isTeacher: boolean;
  currentUser: { id: string; name: string; email: string };
}

export function ExaminationsTab({ classroomId, isTeacher, currentUser }: ExaminationsTabProps) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'draft' | 'active' | 'ended'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);

  const [isQuestionsOpen, setIsQuestionsOpen] = useState(false);
  const [selectedExamForQuestions, setSelectedExamForQuestions] = useState<Exam | null>(null);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewExamId, setPreviewExamId] = useState<string | null>(null);

  const [isSubmissionsOpen, setIsSubmissionsOpen] = useState(false);
  const [submissionsExamId, setSubmissionsExamId] = useState<string | null>(null);

  // Reusable Question Bank modal state
  const [isQuestionBankOpen, setIsQuestionBankOpen] = useState(false);

  // Active student examination runner
  const [activeRunningExamId, setActiveRunningExamId] = useState<string | null>(null);

  // Sections and Branching modal state
  const [isSectionsOpen, setIsSectionsOpen] = useState(false);
  const [selectedExamForSections, setSelectedExamForSections] = useState<Exam | null>(null);

  // Live Proctor Dashboard modal state
  const [isLiveDashboardOpen, setIsLiveDashboardOpen] = useState(false);
  const [selectedLiveDashboardExamId, setSelectedLiveDashboardExamId] = useState<string | null>(null);

  // Cortex Lockdown Management & Diagnostics Panel
  const [isLockdownInfoOpen, setIsLockdownInfoOpen] = useState(false);

  const fetchExams = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/v1/classrooms/${classroomId}/exams`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load examinations');
      }
      const data = await res.json();
      setExams(data.exams || []);
    } catch (err: any) {
      setError(err?.message || 'Error fetching examinations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (classroomId) {
      fetchExams();
    }
  }, [classroomId]);

  const handleDeleteExam = async (examId: string) => {
    if (!confirm('Are you sure you want to permanently delete this examination? All student attempts will be deleted.')) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/classrooms/${classroomId}/exams/${examId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete examination');
      }
      setExams((prev) => prev.filter((e) => e.id !== examId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete examination');
    }
  };

  const handleTogglePublish = async (exam: Exam) => {
    const targetStatus = exam.status === 'draft' ? 'published' : 'draft';
    try {
      const res = await fetch(`/api/v1/classrooms/${classroomId}/exams/${exam.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update publication status');
      }
      const data = await res.json();
      setExams((prev) => prev.map((e) => (e.id === exam.id ? { ...e, status: data.status } : e)));
    } catch (err: any) {
      alert(err.message || 'Failed to update publication status');
    }
  };

  const filteredExams = exams.filter((exam) => {
    if (filter === 'draft' && exam.status !== 'draft') return false;
    if (filter === 'active' && exam.status !== 'active' && exam.status !== 'published') return false;
    if (filter === 'ended' && exam.status !== 'ended' && exam.status !== 'results_published') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return exam.title.toLowerCase().includes(q) || exam.description.toLowerCase().includes(q);
    }
    return true;
  });

  const getStatusBadge = (status: ExamStatus) => {
    switch (status) {
      case 'draft':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700">Draft</span>;
      case 'scheduled':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-950/80 text-blue-300 border border-blue-800">Scheduled</span>;
      case 'published':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-950/80 text-cyan-300 border border-cyan-800">Published</span>;
      case 'active':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800 animate-pulse">Active</span>;
      case 'ended':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-950/80 text-amber-300 border border-amber-800">Ended</span>;
      case 'results_published':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-950/80 text-purple-300 border border-purple-800">Results Published</span>;
      default:
        return null;
    }
  };

  const getSecurityBadge = (level: string) => {
    switch (level) {
      case 'restricted':
        return <span className="flex items-center gap-1 text-[11px] text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/60"><Shield className="w-3 h-3 text-[#FF9100]" /> Cortex Lockdown</span>;
      case 'seb':
        return <span className="flex items-center gap-1 text-[11px] text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-800/60"><Shield className="w-3 h-3" /> Level 3 SEB</span>;
      default:
        return <span className="flex items-center gap-1 text-[11px] text-gray-400 bg-gray-900 px-2 py-0.5 rounded border border-gray-800"><Shield className="w-3 h-3" /> Level 1 Standard</span>;
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#262626] pb-5">
        <div>
          <h2 className="text-xl font-heading font-bold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-[#FF9100]" />
            Online Examinations
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            {isTeacher
              ? 'Manage, schedule, and grade rigorous online assessments with multi-level integrity controls.'
              : 'Take official course examinations, solve coding problems, and view your verified results.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchExams}
            disabled={isLoading}
            className="p-2 rounded-lg bg-[#16171c] hover:bg-[#20222a] text-gray-400 hover:text-white border border-[#2a2d36] transition"
            title="Refresh examinations"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {isTeacher && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsLockdownInfoOpen(true)}
                className="h-9 px-3.5 rounded-lg bg-[#16171c] hover:bg-[#20222a] text-gray-200 border border-[#2a2d36] font-semibold text-xs transition flex items-center gap-2"
                title="Cortex Lockdown Windows Application Information & Deployment Guide"
              >
                <Shield className="w-4 h-4 text-[#FF9100]" />
                <span>Cortex Lockdown</span>
              </button>
              <button
                onClick={() => setIsQuestionBankOpen(true)}
                className="h-9 px-3.5 rounded-lg bg-[#16171c] hover:bg-[#20222a] text-gray-200 border border-[#2a2d36] font-semibold text-xs transition flex items-center gap-2"
                title="Manage Reusable Question Bank"
              >
                <BookOpen className="w-4 h-4 text-cyan-400" />
                <span>Question Bank</span>
              </button>
              <button
                onClick={() => {
                  setEditingExam(null);
                  setIsBuilderOpen(true);
                }}
                className="h-9 px-4 rounded-lg bg-[#FF9100] hover:bg-[#e08000] text-black font-semibold text-xs transition flex items-center gap-2 shadow-lg shadow-[#FF9100]/10"
              >
                <Plus className="w-4 h-4" />
                Create Examination
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-[#121214] border border-[#22242a] rounded-lg">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-xs rounded-md font-medium transition ${
              filter === 'all' ? 'bg-[#FF9100]/20 text-[#FF9100] font-semibold' : 'text-gray-400 hover:text-white'
            }`}
          >
            All ({exams.length})
          </button>
          {isTeacher && (
            <button
              onClick={() => setFilter('draft')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition ${
                filter === 'draft' ? 'bg-[#FF9100]/20 text-[#FF9100] font-semibold' : 'text-gray-400 hover:text-white'
              }`}
            >
              Drafts ({exams.filter((e) => e.status === 'draft').length})
            </button>
          )}
          <button
            onClick={() => setFilter('active')}
            className={`px-3 py-1 text-xs rounded-md font-medium transition ${
              filter === 'active' ? 'bg-[#FF9100]/20 text-[#FF9100] font-semibold' : 'text-gray-400 hover:text-white'
            }`}
          >
            Active & Published
          </button>
          <button
            onClick={() => setFilter('ended')}
            className={`px-3 py-1 text-xs rounded-md font-medium transition ${
              filter === 'ended' ? 'bg-[#FF9100]/20 text-[#FF9100] font-semibold' : 'text-gray-400 hover:text-white'
            }`}
          >
            Past Examinations
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-500" />
          <input
            type="text"
            placeholder="Search examinations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-[#121214] border border-[#22242a] rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FF9100]/50"
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-950/40 border border-red-800 text-red-200 text-xs rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && exams.length === 0 && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-[#121316] border border-[#22242a] rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredExams.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-[#262626] rounded-xl text-center space-y-3">
          <FileText className="w-10 h-10 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-300">No examinations found</h3>
          <p className="text-xs text-gray-500 max-w-sm">
            {isTeacher
              ? 'Click "Create Examination" to author an assessment with MCQs, numerical problems, and coding challenges.'
              : 'There are currently no active examinations assigned to your account in this classroom.'}
          </p>
          {isTeacher && (
            <button
              onClick={() => {
                setEditingExam(null);
                setIsBuilderOpen(true);
              }}
              className="mt-2 h-8 px-3 rounded-lg bg-[#FF9100]/10 border border-[#FF9100]/30 text-[#FF9100] text-xs font-semibold hover:bg-[#FF9100]/20 transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Create First Examination
            </button>
          )}
        </div>
      )}

      {/* Examinations Cards List */}
      <div className="space-y-3">
        {filteredExams.map((exam) => {
          const now = Date.now();
          const isBeforeStart = now < exam.startTime;
          const isAfterEnd = now > exam.endTime;
          const studentState = (exam as any).studentState;

          return (
            <div
              key={exam.id}
              className="bg-[#0e0f12] border border-[#202228] hover:border-[#30333d] rounded-xl p-4 transition space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-white">{exam.title}</h3>
                    {getStatusBadge(exam.status)}
                    {getSecurityBadge(exam.securityLevel)}
                  </div>
                  {exam.description && (
                    <p className="text-xs text-gray-400 line-clamp-2 max-w-2xl">{exam.description}</p>
                  )}
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {isTeacher ? (
                    <>
                      <button
                        onClick={() => {
                          setSelectedExamForQuestions(exam);
                          setIsQuestionsOpen(true);
                        }}
                        className="h-8 px-2.5 rounded-lg bg-[#181920] hover:bg-[#22242c] text-xs text-gray-300 hover:text-white border border-[#2a2d36] transition flex items-center gap-1"
                        title="Manage Questions"
                      >
                        <ListOrdered className="w-3.5 h-3.5 text-[#FF9100]" />
                        <span>Questions ({exam.questionCount || 0})</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedExamForSections(exam);
                          setIsSectionsOpen(true);
                        }}
                        className="h-8 px-2.5 rounded-lg bg-[#181920] hover:bg-[#22242c] text-xs text-gray-300 hover:text-white border border-[#2a2d36] transition flex items-center gap-1"
                        title="Sections & Conditional Branching"
                      >
                        <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Routing</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedLiveDashboardExamId(exam.id);
                          setIsLiveDashboardOpen(true);
                        }}
                        className="h-8 px-2.5 rounded-lg bg-[#181920] hover:bg-[#22242c] text-xs text-gray-300 hover:text-white border border-[#2a2d36] transition flex items-center gap-1"
                        title="Live Proctoring & Session Telemetry"
                      >
                        <Activity className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Monitor</span>
                      </button>

                      <button
                        onClick={() => {
                          setPreviewExamId(exam.id);
                          setIsPreviewOpen(true);
                        }}
                        className="h-8 px-2.5 rounded-lg bg-[#181920] hover:bg-[#22242c] text-xs text-gray-300 hover:text-white border border-[#2a2d36] transition flex items-center gap-1"
                        title="Preview as student"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview</span>
                      </button>

                      <button
                        onClick={() => {
                          setSubmissionsExamId(exam.id);
                          setIsSubmissionsOpen(true);
                        }}
                        className="h-8 px-2.5 rounded-lg bg-[#181920] hover:bg-[#22242c] text-xs text-gray-300 hover:text-white border border-[#2a2d36] transition flex items-center gap-1"
                        title="View Submissions & Integrity"
                      >
                        <Users className="w-3.5 h-3.5 text-blue-400" />
                        <span>Submissions</span>
                      </button>

                      <button
                        onClick={() => handleTogglePublish(exam)}
                        className={`h-8 px-2.5 rounded-lg text-xs font-medium border transition ${
                          exam.status === 'draft'
                            ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-950'
                            : 'bg-gray-800/60 text-gray-300 border-gray-700 hover:bg-gray-800'
                        }`}
                        title={exam.status === 'draft' ? 'Publish examination' : 'Return to draft'}
                      >
                        {exam.status === 'draft' ? 'Publish' : 'Unpublish'}
                      </button>

                      <button
                        onClick={() => {
                          setEditingExam(exam);
                          setIsBuilderOpen(true);
                        }}
                        className="p-1.5 rounded-lg hover:bg-[#22242c] text-gray-400 hover:text-white transition"
                        title="Edit examination settings"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteExam(exam.id)}
                        className="p-1.5 rounded-lg hover:bg-red-950/50 text-gray-400 hover:text-red-400 transition"
                        title="Delete examination"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    /* Student actions */
                    <div className="flex items-center gap-2">
                      {studentState?.isSubmitted ? (
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-800/60">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Submitted
                          </span>
                          {studentState?.latestScore !== null && (
                            <span className="text-xs font-semibold text-white bg-[#1a1b22] px-2.5 py-1 rounded-lg border border-[#2a2d38]">
                              Score: {studentState.latestScore} / {exam.totalMarks}
                            </span>
                          )}
                        </div>
                      ) : studentState?.hasActiveSession ? (
                        <button
                          onClick={() => setActiveRunningExamId(exam.id)}
                          className="h-8 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs transition flex items-center gap-1.5 animate-pulse"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          Resume Exam
                        </button>
                      ) : (
                        <button
                          onClick={() => setActiveRunningExamId(exam.id)}
                          disabled={isBeforeStart || isAfterEnd || studentState?.attemptsRemaining <= 0}
                          className={`h-8 px-4 rounded-lg font-semibold text-xs transition flex items-center gap-1.5 ${
                            isBeforeStart || isAfterEnd || studentState?.attemptsRemaining <= 0
                              ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                              : 'bg-[#FF9100] hover:bg-[#e08000] text-black shadow-md shadow-[#FF9100]/10'
                          }`}
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          {isBeforeStart
                            ? 'Starts Later'
                            : isAfterEnd
                            ? 'Window Closed'
                            : studentState?.attemptsRemaining <= 0
                            ? 'No Attempts Left'
                            : exam.securityLevel === 'restricted'
                            ? 'Take in Lockdown'
                            : 'Start Exam'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom metadata tags */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-gray-400 border-t border-[#1a1c22] pt-2.5">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#FF9100]" />
                  Duration: {exam.durationMinutes} mins
                </span>
                <span className="flex items-center gap-1">
                  <Award className="w-3 h-3 text-cyan-400" />
                  Marks: {exam.totalMarks} total (Pass: {exam.passingMarks})
                </span>
                <span>
                  Window: {new Date(exam.startTime).toLocaleDateString()} {new Date(exam.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(exam.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span>Attempts: {exam.attemptsAllowed}</span>
                {exam.shuffleQuestions && (
                  <span className="text-gray-500">Randomized Questions</span>
                )}
                {exam.showResultsImmediately && (
                  <span className="text-cyan-400/80">Immediate Results</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      {isBuilderOpen && (
        <ExamBuilderModal
          classroomId={classroomId}
          existingExam={editingExam}
          onClose={() => {
            setIsBuilderOpen(false);
            setEditingExam(null);
          }}
          onSaved={() => {
            setIsBuilderOpen(false);
            setEditingExam(null);
            fetchExams();
          }}
        />
      )}

      {isQuestionsOpen && selectedExamForQuestions && (
        <ExamQuestionsManagerModal
          classroomId={classroomId}
          exam={selectedExamForQuestions}
          onClose={() => {
            setIsQuestionsOpen(false);
            setSelectedExamForQuestions(null);
            fetchExams();
          }}
        />
      )}

      {isPreviewOpen && previewExamId && (
        <ExamPreviewModal
          classroomId={classroomId}
          examId={previewExamId}
          onClose={() => {
            setIsPreviewOpen(false);
            setPreviewExamId(null);
          }}
        />
      )}

      {isSubmissionsOpen && submissionsExamId && (
        <ExamSubmissionsModal
          classroomId={classroomId}
          examId={submissionsExamId}
          onClose={() => {
            setIsSubmissionsOpen(false);
            setSubmissionsExamId(null);
          }}
        />
      )}

      {/* Student Examination Runner */}
      {activeRunningExamId && (
        <ExamRunnerModal
          classroomId={classroomId}
          examId={activeRunningExamId}
          currentUser={currentUser}
          onClose={() => {
            setActiveRunningExamId(null);
            fetchExams();
          }}
        />
      )}

      {/* Reusable Question Bank Modal */}
      {isQuestionBankOpen && (
        <QuestionBankModal onClose={() => setIsQuestionBankOpen(false)} />
      )}

      {/* Sections and Conditional Branching Modal */}
      {isSectionsOpen && selectedExamForSections && (
        <ExamSectionsBranchingModal
          classroomId={classroomId}
          exam={selectedExamForSections}
          onClose={() => {
            setIsSectionsOpen(false);
            setSelectedExamForSections(null);
            fetchExams();
          }}
          onUpdated={fetchExams}
        />
      )}

      {/* Live Proctoring & Session Monitor Modal */}
      {isLiveDashboardOpen && selectedLiveDashboardExamId && (
        <ExamLiveDashboardModal
          classroomId={classroomId}
          examId={selectedLiveDashboardExamId}
          onClose={() => {
            setIsLiveDashboardOpen(false);
            setSelectedLiveDashboardExamId(null);
            fetchExams();
          }}
        />
      )}

      {/* Cortex Lockdown Teacher Information Modal */}
      {isLockdownInfoOpen && (
        <CortexLockdownTeacherInfoModal onClose={() => setIsLockdownInfoOpen(false)} />
      )}
    </div>
  );
}
