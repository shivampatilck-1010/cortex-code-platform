'use client';

import React, { useState, useEffect } from 'react';
import { X, Eye, Award, Clock, Shield, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Exam, ExamQuestion } from '@/lib/classroom/models';

interface ExamPreviewModalProps {
  classroomId: string;
  examId: string;
  onClose: () => void;
}

export function ExamPreviewModal({ classroomId, examId, onClose }: ExamPreviewModalProps) {
  const [exam, setExam] = useState<Exam | null>(null);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadExam() {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/v1/classrooms/${classroomId}/exams/${examId}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load preview');
        }
        const data = await res.json();
        setExam(data.exam);
      } catch (err: any) {
        setError(err.message || 'Error loading preview');
      } finally {
        setIsLoading(false);
      }
    }
    loadExam();
  }, [classroomId, examId]);

  const questions = exam?.questions || [];
  const currentQ = questions[activeQuestionIndex];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0b0c0e] border border-[#262830] rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Preview Banner */}
        <div className="px-4 py-2 bg-[#FF9100]/20 border-b border-[#FF9100]/30 text-[#FF9100] text-xs font-semibold flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Eye className="w-4 h-4" />
            Teacher Mode: Student View Simulation (Sensitive answers & hidden tests are redacted)
          </span>
          <button onClick={onClose} className="hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        {isLoading && (
          <div className="p-8 text-center text-xs text-gray-400">Loading examination preview...</div>
        )}

        {error && (
          <div className="p-4 bg-red-950/40 border border-red-800 text-red-200 text-xs rounded-lg m-4">
            {error}
          </div>
        )}

        {!isLoading && exam && questions.length === 0 && (
          <div className="p-12 text-center text-xs text-gray-500">
            No questions have been added to this examination yet.
          </div>
        )}

        {!isLoading && exam && currentQ && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Exam Header */}
            <div className="p-4 border-b border-[#1c1d24] flex items-center justify-between text-xs text-gray-400">
              <span className="font-semibold text-white">{exam.title}</span>
              <div className="flex items-center gap-4">
                <span>Duration: {exam.durationMinutes} mins</span>
                <span>Question {activeQuestionIndex + 1} of {questions.length}</span>
                <span className="text-cyan-400 font-medium">{currentQ.points} Point{currentQ.points !== 1 ? 's' : ''}</span>
              </div>
            </div>

            {/* Question Display Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  {currentQ.questionType.replace('_', ' ')}
                </span>
                <p className="text-sm font-medium text-white whitespace-pre-wrap">{currentQ.promptText}</p>
              </div>

              {/* MCQ Options preview */}
              {(currentQ.questionType === 'mcq_single' || currentQ.questionType === 'mcq_multiple') && (
                <div className="space-y-2.5 max-w-xl">
                  {(currentQ.options || []).map((opt) => (
                    <div
                      key={opt.id}
                      className="p-3 bg-[#131418] border border-[#242630] rounded-xl flex items-center gap-3 text-xs text-gray-300 hover:border-[#383a48] transition cursor-pointer"
                    >
                      <div className="w-4 h-4 rounded-full border border-gray-600 shrink-0" />
                      <span>{opt.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* True/False preview */}
              {currentQ.questionType === 'true_false' && (
                <div className="flex gap-4 max-w-sm">
                  {['True', 'False'].map((label) => (
                    <div
                      key={label}
                      className="flex-1 p-3 bg-[#131418] border border-[#242630] rounded-xl text-center text-xs font-semibold text-white cursor-pointer hover:border-[#383a48]"
                    >
                      {label}
                    </div>
                  ))}
                </div>
              )}

              {/* Numerical preview */}
              {currentQ.questionType === 'numerical' && (
                <div className="max-w-xs space-y-1">
                  <label className="text-xs text-gray-400">Enter numerical answer:</label>
                  <input
                    type="number"
                    disabled
                    placeholder="Enter number..."
                    className="w-full px-3 py-2 bg-[#131418] border border-[#242630] rounded-xl text-xs text-white"
                  />
                </div>
              )}

              {/* Short Answer preview */}
              {currentQ.questionType === 'short_answer' && (
                <div className="max-w-md space-y-1">
                  <label className="text-xs text-gray-400">Your answer:</label>
                  <input
                    type="text"
                    disabled
                    placeholder="Type your response here..."
                    className="w-full px-3 py-2 bg-[#131418] border border-[#242630] rounded-xl text-xs text-white"
                  />
                </div>
              )}

              {/* Programming preview */}
              {currentQ.questionType === 'programming' && (
                <div className="space-y-3">
                  <div className="p-3 bg-[#111216] border border-[#22242c] rounded-xl font-mono text-xs text-gray-300 whitespace-pre">
                    {currentQ.initialCode || '# Code starter template'}
                  </div>
                  <div className="text-xs text-gray-500">
                    Students will write and test code using the embedded Monaco Editor against sample test cases.
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Footer */}
            <div className="p-4 border-t border-[#1c1d24] flex items-center justify-between">
              <button
                onClick={() => setActiveQuestionIndex((prev) => Math.max(0, prev - 1))}
                disabled={activeQuestionIndex === 0}
                className="px-3 py-1.5 rounded-lg bg-[#16171c] hover:bg-[#20222a] text-xs text-gray-300 disabled:opacity-30 flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              <div className="flex gap-1">
                {questions.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveQuestionIndex(i)}
                    className={`w-7 h-7 rounded-lg text-xs font-semibold transition ${
                      activeQuestionIndex === i
                        ? 'bg-[#FF9100] text-black font-bold'
                        : 'bg-[#16171c] text-gray-400 hover:text-white'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setActiveQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                disabled={activeQuestionIndex === questions.length - 1}
                className="px-3 py-1.5 rounded-lg bg-[#16171c] hover:bg-[#20222a] text-xs text-gray-300 disabled:opacity-30 flex items-center gap-1"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
