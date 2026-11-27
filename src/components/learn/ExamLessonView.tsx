'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock, Flag, RotateCcw, XCircle } from 'lucide-react';
import type { ExamLesson } from '@/types/learn';

interface ExamLessonViewProps {
  lesson: ExamLesson;
  examStarted: boolean;
  examSubmitted: boolean;
  secondsLeft: number;
  hasNext: boolean;
  onStartExam: () => void;
  onSubmitExam: (result: {
    scorePct: number;
    correctCount: number;
    totalCount: number;
    passed: boolean;
    timeTakenSecs: number;
  }) => void;
  onRetryExam: () => void;
  onNextItem: () => void;
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60)
    .toString()
    .padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export const ExamLessonView: React.FC<ExamLessonViewProps> = ({
  lesson,
  examStarted,
  examSubmitted,
  secondsLeft,
  hasNext,
  onStartExam,
  onSubmitExam,
  onRetryExam,
  onNextItem,
}) => {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [activeQIndex, setActiveQIndex] = useState(0);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);

  const totalSecs = lesson.durationMins * 60;
  const totalQuestions = lesson.questions.length;

  useEffect(() => {
    setAnswers({});
    setFlagged({});
    setActiveQIndex(0);
    setConfirmingSubmit(false);
  }, [lesson.id]);

  const finalizeExam = useCallback(() => {
    const correctCount = lesson.questions.filter(
      (q) => answers[q.id] === q.correctIndex
    ).length;
    const scorePct =
      totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const passed = scorePct >= lesson.passScore;
    const timeTakenSecs = Math.max(0, totalSecs - secondsLeft);

    setConfirmingSubmit(false);
    onSubmitExam({
      scorePct,
      correctCount,
      totalCount: totalQuestions,
      passed,
      timeTakenSecs,
    });
  }, [lesson.questions, lesson.passScore, answers, totalQuestions, totalSecs, secondsLeft, onSubmitExam]);

  useEffect(() => {
    if (examStarted && !examSubmitted && secondsLeft === 0) {
      finalizeExam();
    }
  }, [examStarted, examSubmitted, secondsLeft, finalizeExam]);

  // Briefing Screen
  if (!examStarted && !examSubmitted) {
    return (
      <div className="rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#22252C] p-8 space-y-5">
        <div className="text-[11.5px] font-mono uppercase tracking-wider text-[#F3912E] font-semibold">
          Timed Graded Exam
        </div>
        <h1 className="text-[24px] font-bold tracking-tight text-[#0F172A] dark:text-white">
          {lesson.title}
        </h1>
        <div className="flex flex-wrap gap-6 text-[13px] text-[#64748B] dark:text-zinc-300 font-mono">
          <span>Duration: {lesson.durationMins} mins</span>
          <span>Questions: {totalQuestions}</span>
          <span>Pass Score: {lesson.passScore}%</span>
        </div>
        <p className="text-[14px] text-[#64748B] dark:text-zinc-400 leading-relaxed max-w-[60ch]">
          Starting the exam automatically collapses the syllabus sidebar for distraction-free focus. Flag questions to review before submitting.
        </p>
        <button
          type="button"
          onClick={onStartExam}
          data-testid="begin-exam-button"
          className="h-10 px-5 rounded-lg text-[13.5px] font-semibold bg-[#F3912E] hover:bg-[#E07D19] text-white transition-colors"
        >
          Begin Exam →
        </button>
      </div>
    );
  }

  // Exam Report Screen
  if (examSubmitted) {
    const correctCount = lesson.questions.filter(
      (q) => answers[q.id] === q.correctIndex
    ).length;
    const scorePct =
      totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const passed = scorePct >= lesson.passScore;
    const timeTakenSecs = Math.max(0, totalSecs - secondsLeft);

    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#22252C] p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span
              className={`px-3 py-1 rounded-md text-[12px] font-mono font-semibold ${
                passed
                  ? 'bg-emerald-500/15 text-emerald-500'
                  : 'bg-rose-500/15 text-rose-500'
              }`}
            >
              {passed ? `Passed · ${scorePct}%` : `Failed · ${scorePct}%`}
            </span>
            <span className="text-[12px] font-mono text-[#64748B] dark:text-zinc-400">
              Time Taken: {formatDuration(timeTakenSecs)} · Pass Threshold: {lesson.passScore}%
            </span>
          </div>

          <h1 className="text-[22px] font-bold tracking-tight text-[#0F172A] dark:text-white">
            {lesson.title}
          </h1>
          <p className="text-[14px] text-[#64748B] dark:text-zinc-300">
            Score: {correctCount}/{totalQuestions} correct ({scorePct}%).
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                setAnswers({});
                setFlagged({});
                setActiveQIndex(0);
                onRetryExam();
              }}
              className="h-9 px-4 rounded-lg text-[13px] font-medium bg-[#F1F5F9] dark:bg-[#1A1D24] border border-[#E2E8F0] dark:border-white/[0.1] hover:border-[#F3912E] inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Exam</span>
            </button>

            {passed && hasNext && (
              <button
                type="button"
                onClick={onNextItem}
                className="h-9 px-4 rounded-lg text-[13px] font-semibold bg-[#F3912E] hover:bg-[#E07D19] text-white inline-flex items-center gap-1.5"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {lesson.questions.map((q, idx) => {
            const chosen = answers[q.id];
            const isCorrect = chosen === q.correctIndex;
            return (
              <div
                key={q.id}
                className="rounded-xl border border-[#E2E8F0] dark:border-white/[0.07] bg-white dark:bg-[#22252C] p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-[14.5px] font-semibold text-[#0F172A] dark:text-white">
                    <span className="font-mono text-[#64748B] dark:text-zinc-400 mr-2">
                      {idx + 1}.
                    </span>
                    {q.prompt}
                  </div>
                  {isCorrect ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  )}
                </div>

                <div className="space-y-1.5">
                  {q.options.map((opt, optIdx) => {
                    const isRight = optIdx === q.correctIndex;
                    const isChosen = chosen === optIdx;
                    let cls =
                      'border-[#E2E8F0] dark:border-white/[0.06] bg-[#F1F5F9] dark:bg-[#1A1D24] text-[#64748B] dark:text-zinc-400';
                    if (isRight) {
                      cls =
                        'border-emerald-500/60 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
                    } else if (isChosen && !isRight) {
                      cls =
                        'border-rose-500/60 bg-rose-500/15 text-rose-700 dark:text-rose-300';
                    }

                    return (
                      <div key={optIdx} className={`px-3 py-2 rounded-lg border text-[13px] ${cls}`}>
                        <span className="font-mono text-[11px] opacity-60 mr-2">
                          {String.fromCharCode(65 + optIdx)}.
                        </span>
                        {opt}
                      </div>
                    );
                  })}
                </div>

                <div
                  className={`text-[12.5px] px-3 py-2 rounded-lg ${
                    isCorrect
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {q.explanation}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const currentQ = lesson.questions[activeQIndex] ?? lesson.questions[0];
  const unansweredCount = lesson.questions.filter((q) => answers[q.id] === undefined).length;
  const timerColorClass =
    secondsLeft < 120
      ? 'border-rose-500/40 bg-rose-500/15 text-rose-500'
      : 'border-[#E2E8F0] dark:border-white/[0.1] bg-[#F1F5F9] dark:bg-[#1A1D24] text-[#0F172A] dark:text-zinc-100';

  return (
    <div className="space-y-5">
      {/* Sticky Exam Navigator Bar */}
      <div className="sticky top-0 z-10 px-4 py-2.5 rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-white/95 dark:bg-[#21242B]/95 backdrop-blur flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {lesson.questions.map((q, idx) => {
            const isCurrent = idx === activeQIndex;
            const isAnswered = answers[q.id] !== undefined;
            const isFlagged = Boolean(flagged[q.id]);

            let pillCls =
              'border-[#E2E8F0] dark:border-white/[0.08] bg-[#F1F5F9] dark:bg-[#1A1D24] text-[#64748B] dark:text-zinc-400';
            if (isCurrent) {
              pillCls =
                'border-[#F3912E] bg-[#F3912E]/15 text-[#F3912E] font-semibold';
            } else if (isFlagged) {
              pillCls = 'border-[#F3912E]/50 text-[#F3912E]';
            } else if (isAnswered) {
              pillCls =
                'border-emerald-500/40 bg-emerald-500/15 text-emerald-500';
            }

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setActiveQIndex(idx)}
                className={`h-7 min-w-[28px] px-2 rounded-md text-[12px] font-mono border transition-colors ${pillCls}`}
                aria-label={`Question ${idx + 1}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2.5">
          <div
            className={`px-2.5 py-1 rounded-md font-mono text-[12px] font-semibold inline-flex items-center gap-1.5 border ${timerColorClass}`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{formatDuration(secondsLeft)}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (unansweredCount > 0) {
                setConfirmingSubmit(true);
              } else {
                finalizeExam();
              }
            }}
            data-testid="submit-exam-button"
            className="h-8 px-3.5 rounded-lg text-[12.5px] font-semibold bg-[#F3912E] hover:bg-[#E07D19] text-white transition-colors"
          >
            Submit Exam
          </button>
        </div>
      </div>

      {confirmingSubmit && (
        <div className="rounded-xl border border-[#F3912E]/50 bg-[#F3912E]/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-[13px]">
          <span>
            You have {unansweredCount} unanswered{' '}
            {unansweredCount === 1 ? 'question' : 'questions'}. Submit anyway?
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmingSubmit(false)}
              className="h-7 px-3 rounded-md text-[12px] border border-[#E2E8F0] dark:border-white/[0.1] bg-white dark:bg-[#1A1D24]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={finalizeExam}
              data-testid="confirm-submit-exam"
              className="h-7 px-3 rounded-md text-[12px] font-semibold bg-[#F3912E] text-white"
            >
              Confirm Submit
            </button>
          </div>
        </div>
      )}

      {currentQ && (
        <div className="rounded-xl border border-[#E2E8F0] dark:border-white/[0.07] bg-white dark:bg-[#22252C] p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="text-[15px] font-semibold text-[#0F172A] dark:text-white leading-relaxed">
              <span className="font-mono text-[#64748B] dark:text-zinc-400 mr-2">
                Q{activeQIndex + 1}/{totalQuestions}.
              </span>
              {currentQ.prompt}
            </div>
            <button
              type="button"
              onClick={() =>
                setFlagged((prev) => ({ ...prev, [currentQ.id]: !prev[currentQ.id] }))
              }
              className={`px-2.5 py-1 rounded-md text-[12px] inline-flex items-center gap-1 border shrink-0 transition-colors ${
                flagged[currentQ.id]
                  ? 'text-[#F3912E] border-[#F3912E] bg-[#F3912E]/15'
                  : 'border-[#E2E8F0] dark:border-white/[0.1] text-[#64748B] dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-white'
              }`}
            >
              <Flag className="w-3.5 h-3.5" />
              <span>{flagged[currentQ.id] ? 'Flagged' : 'Flag'}</span>
            </button>
          </div>

          {currentQ.codeSnippet && (
            <div className="rounded-lg overflow-hidden border border-[#E2E8F0] dark:border-white/[0.08] bg-[#1A1D24]">
              <pre className="p-3.5 overflow-x-auto font-mono text-[12.5px] leading-[1.6] text-zinc-200">
                <code>{currentQ.codeSnippet.code}</code>
              </pre>
            </div>
          )}

          <div className="space-y-2">
            {currentQ.options.map((opt, optIdx) => {
              const selected = answers[currentQ.id] === optIdx;
              return (
                <button
                  key={optIdx}
                  type="button"
                  onClick={() =>
                    setAnswers((prev) => ({ ...prev, [currentQ.id]: optIdx }))
                  }
                  className={`w-full px-3.5 py-2.5 rounded-lg border text-left text-[13.5px] transition-colors ${
                    selected
                      ? 'border-[#F3912E] bg-[#F3912E]/15 text-[#0F172A] dark:text-white font-medium'
                      : 'border-[#E2E8F0] dark:border-white/[0.08] bg-[#F1F5F9] dark:bg-[#1A1D24] hover:border-[#F3912E]/60'
                  }`}
                >
                  <span className="font-mono text-[11.5px] opacity-65 mr-2.5">
                    {String.fromCharCode(65 + optIdx)}.
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              disabled={activeQIndex === 0}
              onClick={() => setActiveQIndex((i) => Math.max(0, i - 1))}
              className="h-8 px-3.5 rounded-lg text-[12.5px] bg-[#F1F5F9] dark:bg-[#1A1D24] border border-[#E2E8F0] dark:border-white/[0.08] disabled:opacity-40"
            >
              ← Previous
            </button>
            <button
              type="button"
              disabled={activeQIndex >= totalQuestions - 1}
              onClick={() => setActiveQIndex((i) => Math.min(totalQuestions - 1, i + 1))}
              className="h-8 px-3.5 rounded-lg text-[12.5px] bg-[#F1F5F9] dark:bg-[#1A1D24] border border-[#E2E8F0] dark:border-white/[0.08] disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
