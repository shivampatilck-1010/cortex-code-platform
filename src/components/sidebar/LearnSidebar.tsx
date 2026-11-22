'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  BookOpen, 
  ExternalLink, 
  CheckCircle2, 
  ChevronRight, 
  ChevronDown, 
  Award,
  Clock, 
  Code2
} from 'lucide-react';
import { COURSES, Course, Lesson } from '@/lib/learning/courses-data';

interface LearnSidebarProps {
  width?: number;
  currentLanguage?: string;
  onLoadLesson?: (code: string, language: string, title: string) => void;
  onClose?: () => void;
}

export const LearnSidebar: React.FC<LearnSidebarProps> = ({
  width = 240,
  currentLanguage = 'python',
  onLoadLesson,
  onClose,
}) => {
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(COURSES[0]?.id || null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const toggleCourse = (courseId: string) => {
    setExpandedCourseId((prev) => (prev === courseId ? null : courseId));
  };

  const handleSelectLesson = (lesson: Lesson, course: Course) => {
    if (onLoadLesson) {
      onLoadLesson(lesson.starterCode, lesson.language, lesson.title);
      setStatusMessage(`Loaded "${lesson.title}"`);
      setTimeout(() => setStatusMessage(null), 2500);
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'Beginner':
        return 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40';
      case 'Intermediate':
        return 'text-amber-400 bg-amber-950/60 border-amber-800/40';
      case 'Advanced':
        return 'text-rose-400 bg-rose-950/60 border-rose-800/40';
      default:
        return 'text-gray-400 bg-gray-800 border-gray-700';
    }
  };

  return (
    <div
      style={{ width: `${width}px` }}
      className="h-full flex flex-col bg-[#101114] text-[#e6edf3] select-none text-xs"
    >
      {/* Header */}
      <div className="h-10 px-3.5 border-b border-[#1f2024] flex items-center justify-between shrink-0 bg-[#0d0e11]">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-4 h-4 text-[#ff9100]" />
          <span className="font-semibold uppercase tracking-wider text-[11px] text-gray-200">
            Learn
          </span>
          <span className="px-1.5 py-0.2 bg-[#ff9100]/15 text-[#ff9100] text-[10px] rounded font-mono font-medium">
            Courses
          </span>
        </div>
        <Link
          href="/learn"
          className="flex items-center space-x-1 text-[11px] text-[#ff9100] hover:text-[#ffaa33] transition"
          title="Open Learning Catalog"
        >
          <span>Catalog</span>
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* Course Banner */}
      <div className="p-2.5 bg-[#0c0d10] border-b border-[#1f2024] shrink-0">
        <div className="flex items-center space-x-1.5 mb-1 text-gray-200 font-medium">
          <Award className="w-3.5 h-3.5 text-[#ff9100]" />
          <span>Interactive Curricula</span>
        </div>
        <p className="text-[10px] text-gray-400 leading-relaxed">
          Step-by-step programming tracks with live editor verification and instant terminal feedback.
        </p>
      </div>

      {/* Status notification */}
      {statusMessage && (
        <div className="mx-2.5 mt-2 px-2.5 py-1.5 bg-emerald-950/60 border border-emerald-700/50 rounded text-[11px] text-emerald-300 flex items-center space-x-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate">{statusMessage}</span>
        </div>
      )}

      {/* Courses Accordion List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2 custom-scrollbar">
        {COURSES.map((course) => {
          const isExpanded = expandedCourseId === course.id;

          return (
            <div
              key={course.id}
              className="border border-[#1e2026] rounded-lg overflow-hidden bg-[#121318]"
            >
              {/* Course Title Header */}
              <button
                onClick={() => toggleCourse(course.id)}
                className="w-full p-2.5 flex items-center justify-between text-left hover:bg-[#15161e] transition"
              >
                <div className="flex-1 pr-2">
                  <div className="flex items-center space-x-1.5 mb-1">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-medium border ${getLevelColor(
                        course.level
                      )}`}
                    >
                      {course.level}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {course.lessonsCount} lessons
                    </span>
                  </div>
                  <div className="font-semibold text-gray-200 text-xs line-clamp-1">
                    {course.title}
                  </div>
                </div>

                <div className="text-gray-400">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-[#ff9100]" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </div>
              </button>

              {/* Expanded Lessons */}
              {isExpanded && (
                <div className="p-2 border-t border-[#1b1c24] bg-[#0d0e12] space-y-1.5">
                  <div className="text-[10px] text-gray-400 mb-2 leading-relaxed px-1">
                    {course.description}
                  </div>

                  {course.lessons.map((lesson) => (
                    <div
                      key={lesson.id}
                      className="p-2 bg-[#14151b] hover:bg-[#181922] border border-[#20222c] rounded-md transition flex items-center justify-between"
                    >
                      <div className="flex-1 pr-2">
                        <div className="font-medium text-gray-200 text-[11px] line-clamp-1">
                          {lesson.title}
                        </div>
                        <div className="flex items-center space-x-1 text-[9px] text-gray-500 mt-0.5 font-mono">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{lesson.durationMinutes}m</span>
                          <span>•</span>
                          <span className="uppercase">{lesson.language}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          onClick={() => handleSelectLesson(lesson, course)}
                          className="px-2 py-1 bg-[#1e2028] hover:bg-[#ff9100] hover:text-black text-gray-300 rounded text-[10px] font-medium transition flex items-center space-x-1 border border-[#2b2d3a]"
                          title="Load lesson starter code into IDE"
                        >
                          <Code2 className="w-3 h-3" />
                          <span>Load</span>
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="pt-1.5">
                    <Link
                      href={`/learn/${course.slug}`}
                      className="w-full py-1.5 px-2 bg-[#191a22] hover:bg-[#222430] text-gray-300 hover:text-white rounded text-[10px] font-medium flex items-center justify-center space-x-1 border border-[#252834] transition"
                    >
                      <span>Open Full Course</span>
                      <ExternalLink className="w-3 h-3 text-[#ff9100]" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
