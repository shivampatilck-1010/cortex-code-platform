'use client';

import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Code2, Copy } from 'lucide-react';
import type { CourseAttribution, NotesCodeBlock, NotesLesson } from '@/types/learn';

interface NotesLessonViewProps {
  lesson: NotesLesson;
  moduleIndex: number;
  moduleTitle: string;
  isCompleted: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  attribution?: CourseAttribution;
  onPrev: () => void;
  onCompleteAndContinue: () => void;
  onTryInIde: (codeBlock: NotesCodeBlock) => void;
}

function renderInlineCode(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="font-mono text-[13px] px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-white/[0.08] text-[#0F172A] dark:text-[#F3912E]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export const NotesLessonView: React.FC<NotesLessonViewProps> = ({
  lesson,
  moduleIndex,
  moduleTitle,
  isCompleted,
  hasPrev,
  hasNext,
  attribution,
  onPrev,
  onCompleteAndContinue,
  onTryInIde,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
    }
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500);
  };

  return (
    <article className="space-y-6">
      <div className="space-y-2 border-b border-[#E2E8F0] dark:border-white/[0.07] pb-5">
        <div className="text-[11.5px] font-mono uppercase tracking-wider text-[#F3912E] font-semibold">
          Module {moduleIndex + 1} · {moduleTitle} · Reading · {lesson.readMins} min read
        </div>
        <h1 className="text-[26px] font-bold tracking-tight leading-tight text-[#0F172A] dark:text-white">
          {lesson.title}
        </h1>
      </div>

      {lesson.tldr.length > 0 && (
        <div className="rounded-xl bg-white dark:bg-[#22252C] border border-[#E2E8F0] dark:border-white/[0.07] p-5 space-y-2.5">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#F3912E] font-semibold">
            TL;DR Key Concepts
          </div>
          <ul className="list-disc pl-5 space-y-1.5 text-[14px] leading-relaxed text-slate-700 dark:text-zinc-300">
            {lesson.tldr.map((pt, idx) => (
              <li key={idx}>{renderInlineCode(pt)}</li>
            ))}
          </ul>
        </div>
      )}

      {lesson.sections.map((sec) => (
        <section key={sec.id} id={sec.id} className="space-y-3.5 pt-2 scroll-mt-6">
          <h2 className="text-[19px] font-bold tracking-tight mt-6 mb-2 text-[#0F172A] dark:text-white">
            {sec.heading}
          </h2>

          {sec.paragraphs.map((p, idx) => (
            <p
              key={idx}
              className="text-[15px] leading-[1.78] max-w-[70ch] text-slate-700 dark:text-zinc-300"
            >
              {renderInlineCode(p)}
            </p>
          ))}

          {sec.callout && (
            <div
              className={`rounded-xl border-l-4 border border-[#E2E8F0] dark:border-white/[0.07] bg-white dark:bg-[#22252C] px-4 py-3.5 space-y-1 ${
                sec.callout.kind === 'pitfall'
                  ? 'border-l-rose-500'
                  : sec.callout.kind === 'complexity'
                    ? 'border-l-emerald-500'
                    : 'border-l-[#F3912E]'
              }`}
            >
              <div className="text-[11.5px] font-mono uppercase tracking-wider text-[#64748B] dark:text-zinc-400 font-semibold">
                {sec.callout.kind} · {sec.callout.title}
              </div>
              <p className="text-[13.5px] leading-relaxed text-slate-700 dark:text-zinc-300">
                {renderInlineCode(sec.callout.body)}
              </p>
            </div>
          )}

          {sec.table && (
            <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] dark:border-white/[0.07]">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead className="bg-slate-100 dark:bg-[#21242B] border-b border-[#E2E8F0] dark:border-white/[0.07]">
                  <tr>
                    {sec.table.headers.map((header, hIdx) => (
                      <th
                        key={hIdx}
                        className="px-4 py-2.5 font-mono text-[11.5px] font-semibold text-[#64748B] dark:text-zinc-400"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] dark:divide-white/[0.06]">
                  {sec.table.rows.map((row, rIdx) => (
                    <tr key={rIdx} className="bg-white dark:bg-[#1A1D24]">
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className="px-4 py-2.5 text-[#0F172A] dark:text-zinc-200 font-mono text-[12.5px]"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {sec.codeBlock && (
            <div className="rounded-xl overflow-hidden border border-[#E2E8F0] dark:border-white/[0.08] bg-[#1A1D24] text-zinc-100">
              <div className="h-10 px-3.5 bg-[#21242B] border-b border-white/[0.07] flex items-center justify-between text-[12px] font-mono text-zinc-300">
                <span>{sec.codeBlock.filename}</span>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleCopy(sec.id, sec.codeBlock!.code)}
                    className="h-7 px-2.5 rounded bg-white/[0.06] hover:bg-white/[0.12] inline-flex items-center gap-1.5 text-zinc-200 transition-colors"
                  >
                    {copiedId === sec.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedId === sec.id ? 'Copied' : 'Copy'}</span>
                  </button>
                  {sec.codeBlock.runnableInIde && (
                    <button
                      type="button"
                      onClick={() => onTryInIde(sec.codeBlock!)}
                      className="h-7 px-2.5 rounded bg-[#F3912E]/15 hover:bg-[#F3912E]/25 border border-[#F3912E]/40 text-[#F3912E] inline-flex items-center gap-1.5 transition-colors font-medium"
                    >
                      <Code2 className="w-3.5 h-3.5" />
                      <span>Try in IDE</span>
                    </button>
                  )}
                </div>
              </div>
              <pre className="p-4 overflow-x-auto font-mono text-[13px] leading-[1.65] text-zinc-200">
                <code>{sec.codeBlock.code}</code>
              </pre>
            </div>
          )}
        </section>
      ))}

      {lesson.keyTakeaways.length > 0 && (
        <div className="rounded-xl bg-white dark:bg-[#22252C] border border-[#E2E8F0] dark:border-white/[0.07] p-5 space-y-2.5 mt-6">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#F3912E] font-semibold">
            Key Takeaways
          </div>
          <ul className="list-disc pl-5 space-y-1.5 text-[14px] leading-relaxed text-slate-700 dark:text-zinc-300">
            {lesson.keyTakeaways.map((item, idx) => (
              <li key={idx}>{renderInlineCode(item)}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="pt-8 mt-8 border-t border-[#E2E8F0] dark:border-white/[0.07] flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={!hasPrev}
          className="h-9 px-4 rounded-lg text-[13px] font-medium inline-flex items-center gap-1.5 bg-white dark:bg-[#22252C] border border-[#E2E8F0] dark:border-white/[0.08] text-[#0F172A] dark:text-zinc-200 hover:border-[#F3912E] disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Previous</span>
        </button>

        <button
          type="button"
          onClick={onCompleteAndContinue}
          data-testid="notes-complete-continue"
          className="h-9 px-5 rounded-lg text-[13px] font-semibold bg-[#F3912E] hover:bg-[#E07D19] text-white inline-flex items-center gap-1.5 transition-colors shadow-sm"
        >
          <span>
            {isCompleted
              ? hasNext
                ? 'Continue'
                : 'Completed'
              : hasNext
                ? 'Mark Complete & Continue'
                : 'Mark Complete'}
          </span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {attribution && (
        <footer className="pt-2 text-[12px] text-[#64748B] dark:text-zinc-400 flex flex-wrap items-center justify-between gap-2">
          <span>
            {attribution.sourceName} · {attribution.license}
          </span>
          {attribution.sourceUrl && (
            <a
              href={attribution.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#F3912E] hover:underline"
            >
              Source Reference
            </a>
          )}
        </footer>
      )}
    </article>
  );
};
