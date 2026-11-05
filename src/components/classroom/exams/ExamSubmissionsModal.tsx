'use client';

import React, { useState, useEffect } from 'react';
import { X, Users, Award, Shield, AlertTriangle, Clock, CheckCircle, RefreshCw, Edit3, Save, ArrowLeft } from 'lucide-react';
import { ExamSession, ExamIntegrityEvent } from '@/lib/classroom/models';

interface ExamSubmissionsModalProps {
  classroomId: string;
  examId: string;
  onClose: () => void;
}

export function ExamSubmissionsModal({ classroomId, examId, onClose }: ExamSubmissionsModalProps) {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedIntegrityEvents, setSelectedIntegrityEvents] = useState<ExamIntegrityEvent[] | null>(null);
  const [studentNameForEvents, setStudentNameForEvents] = useState('');

  // Manual Grading State
  const [activeGradingSession, setActiveGradingSession] = useState<any | null>(null);
  const [gradingDetails, setGradingDetails] = useState<{
    session: any;
    exam: any;
    questions: any[];
    responses: any[];
  } | null>(null);
  const [isGradingLoading, setIsGradingLoading] = useState(false);
  const [gradingSaveSuccess, setGradingSaveSuccess] = useState(false);
  const [itemizedMarks, setItemizedMarks] = useState<Record<string, { points: number; notes: string }>>({});
  const [teacherFeedback, setTeacherFeedback] = useState('');

  const fetchSubmissions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/v1/classrooms/${classroomId}/exams/${examId}/submissions`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load submissions');
      }
      const data = await res.json();
      setSubmissions(data.submissions || []);
    } catch (err: any) {
      setError(err.message || 'Error loading submissions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [classroomId, examId]);

  const openGradingView = async (session: any) => {
    setActiveGradingSession(session);
    setIsGradingLoading(true);
    setGradingSaveSuccess(false);
    try {
      const res = await fetch(`/api/v1/classrooms/${classroomId}/exams/${examId}/submissions/${session.id}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load submission details');
      }
      const data = await res.json();
      setGradingDetails(data);
      setTeacherFeedback(data.session.teacherFeedback || '');

      const initialMarks: Record<string, { points: number; notes: string }> = {};
      (data.responses || []).forEach((r: any) => {
        initialMarks[r.questionId] = {
          points: r.earnedPoints || 0,
          notes: r.graderNotes || '',
        };
      });
      setItemizedMarks(initialMarks);
    } catch (err: any) {
      setError(err.message || 'Failed to open grading view');
    } finally {
      setIsGradingLoading(false);
    }
  };

  const handleSaveGrades = async () => {
    if (!activeGradingSession || !gradingDetails) return;
    setIsGradingLoading(true);
    setGradingSaveSuccess(false);
    try {
      const questionGrades = gradingDetails.questions.map((q) => {
        const mark = itemizedMarks[q.id] || { points: 0, notes: '' };
        return {
          questionId: q.id,
          earnedPoints: Number(mark.points),
          graderNotes: mark.notes,
          gradingStatus: 'manually_graded',
        };
      });

      const res = await fetch(`/api/v1/classrooms/${classroomId}/exams/${examId}/submissions/${activeGradingSession.id}/grade`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionGrades,
          teacherFeedback,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save grades');
      }

      setGradingSaveSuccess(true);
      await fetchSubmissions();
      setTimeout(() => setGradingSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Error saving grading');
    } finally {
      setIsGradingLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0b0c0e] border border-[#262830] rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#22242b] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {activeGradingSession ? (
              <button
                onClick={() => { setActiveGradingSession(null); setGradingDetails(null); }}
                className="p-1.5 rounded-lg hover:bg-[#1a1c22] text-gray-400 hover:text-white transition mr-1 flex items-center gap-1 text-xs"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to list</span>
              </button>
            ) : (
              <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400">
                <Users className="w-5 h-5" />
              </div>
            )}
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">
                {activeGradingSession ? `Grading: ${activeGradingSession.userName || 'Student'} (Attempt #${activeGradingSession.attemptNumber})` : 'Student Submissions & Integrity Audit'}
              </h2>
              <p className="text-xs text-gray-400">
                {activeGradingSession ? `Status: ${activeGradingSession.status}` : `Total Attempts Recorded: ${submissions.length}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!activeGradingSession && (
              <button
                onClick={fetchSubmissions}
                className="p-1.5 rounded-lg hover:bg-[#1a1c22] text-gray-400 hover:text-white transition"
                title="Refresh submissions"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-800 text-red-200 text-xs rounded-lg">
              {error}
            </div>
          )}

          {/* ACTIVE GRADING VIEW */}
          {activeGradingSession && gradingDetails && (
            <div className="space-y-6">
              {gradingSaveSuccess && (
                <div className="p-3 bg-emerald-950/50 border border-emerald-800 text-emerald-200 text-xs rounded-lg flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>Grades and feedback saved successfully!</span>
                </div>
              )}

              {/* Top summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#121318] border border-[#22242c] p-3 rounded-xl">
                  <span className="text-[10px] text-gray-400 font-medium">Attempt Status</span>
                  <p className="text-sm font-bold text-white capitalize">{gradingDetails.session.status}</p>
                </div>
                <div className="bg-[#121318] border border-[#22242c] p-3 rounded-xl">
                  <span className="text-[10px] text-gray-400 font-medium">Auto-Graded Score</span>
                  <p className="text-sm font-bold text-white">{gradingDetails.session.autoScore ?? 0} pts</p>
                </div>
                <div className="bg-[#121318] border border-[#22242c] p-3 rounded-xl">
                  <span className="text-[10px] text-gray-400 font-medium">Current Final Score</span>
                  <p className="text-sm font-bold text-cyan-400">
                    {gradingDetails.session.finalScore !== null ? `${gradingDetails.session.finalScore} pts` : 'Pending'}
                  </p>
                </div>
                <div className="bg-[#121318] border border-[#22242c] p-3 rounded-xl">
                  <span className="text-[10px] text-gray-400 font-medium">Sum of Inputs</span>
                  <p className="text-sm font-bold text-emerald-400">
                    {Object.values(itemizedMarks).reduce((s, m) => s + (Number(m.points) || 0), 0)} pts
                  </p>
                </div>
              </div>

              {/* Questions review and grading */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Itemized Questions & Responses</h3>
                {gradingDetails.questions.map((q, idx) => {
                  const resp = gradingDetails.responses.find((r) => r.questionId === q.id);
                  const mark = itemizedMarks[q.id] || { points: 0, notes: '' };

                  return (
                    <div key={q.id} className="p-4 bg-[#121318] border border-[#22242c] rounded-xl space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <span className="text-[11px] font-bold text-[#FF9100] uppercase tracking-wider mr-2">Q{idx + 1} ({q.questionType})</span>
                          <span className="text-xs font-medium text-white">{q.promptText}</span>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="text-xs font-semibold text-gray-400">Max: {q.points} pts</span>
                        </div>
                      </div>

                      {/* Student Submitted Response */}
                      <div className="bg-[#0b0c0e] border border-[#1e2028] p-3 rounded-lg text-xs space-y-1">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Student Submission:</span>
                        {resp && resp.response ? (
                          q.questionType === 'programming' ? (
                            <pre className="text-[11px] font-mono text-cyan-300 bg-black/60 p-2.5 rounded overflow-x-auto">
                              {typeof resp.response === 'string' ? resp.response : (resp.response.code || JSON.stringify(resp.response, null, 2))}
                            </pre>
                          ) : q.questionType === 'short_answer' || q.questionType === 'fill_in_blank' ? (
                            <p className="text-white font-mono bg-black/40 p-2 rounded">
                              {typeof resp.response === 'string' ? resp.response : (resp.response.text || JSON.stringify(resp.response))}
                            </p>
                          ) : (
                            <pre className="text-[11px] text-gray-300 bg-black/40 p-2 rounded overflow-x-auto">
                              {JSON.stringify(resp.response, null, 2)}
                            </pre>
                          )
                        ) : (
                          <p className="text-gray-500 italic">No answer submitted</p>
                        )}
                      </div>

                      {/* Teacher Grading Inputs */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-1 font-medium">Awarded Marks</label>
                          <input
                            type="number"
                            min="0"
                            max={q.points * 2}
                            step="0.5"
                            value={mark.points}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setItemizedMarks((prev) => ({
                                ...prev,
                                [q.id]: { ...mark, points: val },
                              }));
                            }}
                            className="w-full bg-[#181a20] border border-[#2c2f3a] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF9100]"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[10px] text-gray-400 block mb-1 font-medium">Question Grader Notes</label>
                          <input
                            type="text"
                            placeholder="Optional notes or feedback for this question..."
                            value={mark.notes}
                            onChange={(e) => {
                              const val = e.target.value;
                              setItemizedMarks((prev) => ({
                                ...prev,
                                [q.id]: { ...mark, notes: val },
                              }));
                            }}
                            className="w-full bg-[#181a20] border border-[#2c2f3a] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF9100]"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Overall Feedback & Save */}
              <div className="p-4 bg-[#121318] border border-[#22242c] rounded-xl space-y-3">
                <label className="text-xs font-bold text-gray-300 block">Overall Teacher Feedback</label>
                <textarea
                  rows={3}
                  placeholder="Provide constructive feedback for the student on this attempt..."
                  value={teacherFeedback}
                  onChange={(e) => setTeacherFeedback(e.target.value)}
                  className="w-full bg-[#181a20] border border-[#2c2f3a] rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-[#FF9100] resize-none"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => { setActiveGradingSession(null); setGradingDetails(null); }}
                    className="px-4 py-2 rounded-lg bg-[#181a20] text-gray-300 hover:text-white text-xs font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveGrades}
                    disabled={isGradingLoading}
                    className="px-5 py-2 rounded-lg bg-[#FF9100] hover:bg-[#e07f00] text-black font-heading font-bold text-xs flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isGradingLoading ? 'Saving...' : 'Save & Publish Grades'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SUBMISSIONS LIST TABLE */}
          {!activeGradingSession && (
            <>
              {isLoading && submissions.length === 0 && (
                <div className="text-center py-12 text-xs text-gray-500">Loading submissions...</div>
              )}

              {!isLoading && submissions.length === 0 && (
                <div className="text-center py-12 text-xs text-gray-500">
                  No students have started or submitted this examination yet.
                </div>
              )}

              {!isLoading && submissions.length > 0 && (
                <div className="border border-[#22242c] rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#121318] border-b border-[#22242c] text-gray-400 font-semibold">
                      <tr>
                        <th className="p-3">Student</th>
                        <th className="p-3">Attempt</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Started At</th>
                        <th className="p-3">Submitted At</th>
                        <th className="p-3">Score</th>
                        <th className="p-3">Integrity Events</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1c1d24]">
                      {submissions.map((s) => (
                        <tr key={s.id} className="hover:bg-[#14151b] transition">
                          <td className="p-3">
                            <div className="font-semibold text-white">{s.userName || 'Student'}</div>
                            <div className="text-[11px] text-gray-500">{s.userEmail || s.userId}</div>
                          </td>
                          <td className="p-3 text-gray-300">Attempt #{s.attemptNumber}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                                s.status === 'submitted'
                                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
                                  : s.status === 'in_progress'
                                  ? 'bg-amber-950/60 text-amber-300 border border-amber-800 animate-pulse'
                                  : 'bg-rose-950/60 text-rose-300 border border-rose-800'
                              }`}
                            >
                              {s.status}
                            </span>
                          </td>
                          <td className="p-3 text-gray-400">
                            {new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="p-3 text-gray-400">
                            {s.submittedAt
                              ? new Date(s.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                              : '-'}
                          </td>
                          <td className="p-3 font-semibold text-white">
                            {s.finalScore !== null && s.finalScore !== undefined ? (
                              <span className="text-cyan-400">{s.finalScore} pts</span>
                            ) : s.autoScore !== null ? (
                              <span>{s.autoScore} pts (Auto)</span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="p-3">
                            {s.integrityEventCount > 0 ? (
                              <button
                                onClick={() => {
                                  setSelectedIntegrityEvents(s.integrityEvents || []);
                                  setStudentNameForEvents(s.userName || 'Student');
                                }}
                                className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/60 hover:bg-amber-950 transition"
                              >
                                <AlertTriangle className="w-3 h-3" />
                                {s.integrityEventCount} Event{s.integrityEventCount !== 1 ? 's' : ''}
                              </button>
                            ) : (
                              <span className="text-gray-600 text-[11px]">Clean</span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => openGradingView(s)}
                              className="px-2.5 py-1 rounded-lg bg-[#FF9100]/20 text-[#FF9100] border border-[#FF9100]/40 hover:bg-[#FF9100] hover:text-black text-xs font-semibold transition flex items-center gap-1 ml-auto"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Grade</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* Integrity Events Inspector Modal */}
          {selectedIntegrityEvents && (
            <div className="fixed inset-0 z-60 bg-black/75 flex items-center justify-center p-4">
              <div className="bg-[#121318] border border-[#2b2e38] rounded-xl max-w-lg w-full p-4 space-y-3 shadow-2xl">
                <div className="flex items-center justify-between border-b border-[#252832] pb-2">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-amber-400" />
                    Integrity Audit Log: {studentNameForEvents}
                  </h4>
                  <button
                    onClick={() => setSelectedIntegrityEvents(null)}
                    className="text-gray-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2">
                  {selectedIntegrityEvents.map((evt, idx) => (
                    <div
                      key={evt.id || idx}
                      className="p-2.5 bg-[#181920] border border-[#272a34] rounded-lg text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-gray-300 font-medium">
                        <span className="capitalize">{evt.eventType.replace('_', ' ')}</span>
                        <span className="text-[10px] text-gray-500">
                          {new Date(evt.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      {evt.details && Object.keys(evt.details).length > 0 && (
                        <pre className="text-[10px] text-gray-400 bg-black/40 p-1.5 rounded overflow-x-auto">
                          {JSON.stringify(evt.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
