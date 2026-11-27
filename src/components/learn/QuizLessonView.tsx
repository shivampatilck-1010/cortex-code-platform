'use client';

import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import type { QuizLesson } from '@/types/learn';

interface QuizLessonViewProps {
  lesson: QuizLesson;
  hasNext: boolean;
  onRecordResult: (result: {
    scorePct: number;
    correctCount: number;
    totalCount: number;
    passed: boolean;
  }) => void;
  onNextItem: () => void;
}

export const QuizLessonView: React.FC<QuizLessonViewProps> = ({
  lesson,
  hasNext,
  onRecordResult,
  onNextItem,
}) => {
  const [answersById, setAnswersById] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setAnswersById({});
    setSubmitted(false);
  }, [lesson.id]);

  const total = lesson.questions.length;
  const answeredCount = lesson.questions.filter((q) => answersById[q.id] !== undefined).length;
  const correctCount = lesson.questions.filter((q) => answersById[q.id] === q.correctIndex).length;
  const scorePct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const passed = scorePct >= lesson.passScore;

  const handleSubmit = () => {
    if (answeredCount < total || submitted) return;
    setSubmitted(true);
    onRecordResult({
      scorePct,
      correctCount,
      totalCount: total,
      passed,
    });
  };

  const handleRetry = () => {
    setAnswersById({});
    setSubmitted(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] dark:border-white/[0.07] pb-4">
        <div className="space-y-1">
          <div className="text-[11.5px] font-mono uppercase tracking-wider text-[#F3912E] font-semibold">
            Concept Check · {total} Questions · Pass Score: {lesson.passScore}%
          </div>
          <h1 className="text-[22px] font-bold tracking-tight text-[#0F172A] dark:text-white">
            {lesson.title}
          </h1>
        </div>

        {submitted && (
          <div className="flex items-center gap-2.5">
            <span
              data-testid="quiz-result-badge"
              className={`px-3 py-1 rounded-md text-[12px] font-mono font-semibold ${
                passed
                  ? 'bg-emerald-500/15 text-emerald-500'
                  : 'bg-rose-500/15 text-rose-500'
              }`}
            >
              {passed ? `Passed · ${scorePct}%` : `Failed · ${scorePct}%`}
            </span>
            <button
              type="button"
              onClick={handleRetry}
              className="h-8 px-3 rounded-lg text-[12.5px] font-medium bg-white dark:bg-[#22252C] border border-[#E2E8F0] dark:border-white/[0.1] hover:border-[#F3912E] inline-flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}
      </div>

      {/* Multi-question cards */}
      <div className="space-y-4">
        {lesson.questions.map((q, qIdx) => {
          const chosen = answersById[q.id];
          const isCorrect = chosen === q.correctIndex;

          return (
            <div
              key={q.id}
              data-testid={`quiz-question-${qIdx}`}
              className="rounded-xl border border-[#E2E8F0] dark:border-white/[0.07] bg-white dark:bg-[#22252C] p-5 space-y-3.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-[14.5px] font-semibold text-[#0F172A] dark:text-white leading-snug">
                  <span className="font-mono text-[#64748B] dark:text-zinc-400 mr-2">
                    {qIdx + 1}.
                  </span>
                  {q.prompt}
                </div>
                {submitted && (
                  <span className="shrink-0 mt-0.5">
                    {isCorrect ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-500" />
                    )}
                  </span>
                )}
              </div>

              {q.codeSnippet && (
                <div className="rounded-lg overflow-hidden border border-[#E2E8F0] dark:border-white/[0.08] bg-[#1A1D24]">
                  <div className="px-3 py-1 bg-[#21242B] border-b border-white/[0.06] text-[11px] font-mono text-zinc-400">
                    {q.codeSnippet.language}
                  </div>
                  <pre className="p-3.5 overflow-x-auto font-mono text-[12.5px] leading-[1.6] text-zinc-200">
                    <code>{q.codeSnippet.code}</code>
                  </pre>
                </div>
              )}

              <div className="space-y-2">
                {q.options.map((opt, optIdx) => {
                  const selected = chosen === optIdx;
                  let optStyle =
                    'border-[#E2E8F0] dark:border-white/[0.08] bg-[#F1F5F9] dark:bg-[#1A1D24] text-[#0F172A] dark:text-zinc-200 hover:border-[#F3912E]/60';

                  if (submitted) {
                    if (optIdx === q.correctIndex) {
                      optStyle =
                        'border-emerald-500/60 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
                    } else if (selected && optIdx !== q.correctIndex) {
                      optStyle =
                        'border-rose-500/60 bg-rose-500/15 text-rose-700 dark:text-rose-300';
                    } else {
                      optStyle =
                        'border-[#E2E8F0] dark:border-white/[0.06] bg-[#F1F5F9]/60 dark:bg-[#1A1D24]/60 text-[#64748B] dark:text-zinc-400';
                    }
                  } else if (selected) {
                    optStyle =
                      'border-[#F3912E] bg-[#F3912E]/15 text-[#0F172A] dark:text-white font-medium';
                  }

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      disabled={submitted}
                      onClick={() =>
                        setAnswersById((prev) => ({ ...prev, [q.id]: optIdx }))
                      }
                      className={`w-full px-3.5 py-2.5 rounded-lg border text-left text-[13.5px] transition-colors ${optStyle}`}
                    >
                      <span className="font-mono text-[11.5px] opacity-70 mr-2.5">
                        {String.fromCharCode(65 + optIdx)}.
                      </span>
                      {opt}
                    </button>
                  );
                })}
              </div>

              {submitted && (
                <div
                  className={`rounded-lg px-3.5 py-2.5 text-[13px] ${
                    isCorrect
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {q.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Submit / Continue */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <span className="text-[12.5px] font-mono text-[#64748B] dark:text-zinc-400">
          {submitted
            ? `${correctCount}/${total} correct (${scorePct}%)`
            : `${answeredCount}/${total} answered`}
        </span>

        {!submitted ? (
          <button
            type="button"
            disabled={answeredCount < total}
            onClick={handleSubmit}
            data-testid="submit-quiz-btn"
            className="h-9 px-5 rounded-lg text-[13px] font-semibold bg-[#F3912E] hover:bg-[#E07D19] text-white disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            Submit Quiz
          </button>
        ) : (
          <div className="flex items-center gap-2.5">
            {!passed && (
              <button
                type="button"
                onClick={handleRetry}
                className="h-9 px-4 rounded-lg text-[13px] font-medium bg-white dark:bg-[#22252C] border border-[#E2E8F0] dark:border-white/[0.1] hover:border-[#F3912E] inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Quiz</span>
              </button>
            )}
            {passed && hasNext && (
              <button
                type="button"
                onClick={onNextItem}
                className="h-9 px-5 rounded-lg text-[13px] font-semibold bg-[#F3912E] hover:bg-[#E07D19] text-white inline-flex items-center gap-1.5 transition-colors"
              >
                <span>Next Lesson</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
