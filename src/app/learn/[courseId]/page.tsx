'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { 
  BookOpen, 
  ArrowLeft, 
  Play, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  ChevronRight,
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';
import Editor from '@monaco-editor/react';
import { COURSES } from '@/lib/learning/courses-data';
import { executeInCloudSandbox } from '@/lib/execution/engine';

export default function CourseLessonPage() {
  const params = useParams();
  const courseId = (params?.courseId as string) || 'cpp-fundamentals';
  const course = COURSES.find((c) => c.id === courseId) || COURSES[0];

  const [currentLessonIdx, setCurrentLessonIdx] = useState(0);
  const currentLesson = course.lessons[currentLessonIdx] || course.lessons[0];

  const [code, setCode] = useState(currentLesson.starterCode);
  const [output, setOutput] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isPassed, setIsPassed] = useState<boolean | null>(null);
  const [showHint, setShowHint] = useState(false);

  const handleLessonSwitch = (idx: number) => {
    setCurrentLessonIdx(idx);
    setCode(course.lessons[idx].starterCode);
    setOutput(null);
    setIsPassed(null);
    setShowHint(false);
  };

  const handleCheckSolution = async () => {
    setIsEvaluating(true);
    setIsPassed(null);

    try {
      const res = await executeInCloudSandbox({
        language: currentLesson.language,
        files: [{ id: 'lesson', name: `main.${currentLesson.language === 'python' ? 'py' : currentLesson.language === 'cpp' ? 'cpp' : 'rs'}`, path: '/main', content: code }],
      });

      const actual = (res.stdout || '').trim();
      const expected = currentLesson.expectedOutput.trim();
      setOutput(res.stdout || res.stderr);

      if (actual.includes(expected)) {
        setIsPassed(true);
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      } else {
        setIsPassed(false);
      }
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#121316] text-gray-100 font-sans select-none overflow-hidden">
      {/* Header */}
      <header className="h-12 bg-[#18191c] border-b border-[#2a2c33] px-4 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-3">
          <Link href="/learn" className="flex items-center space-x-1.5 text-gray-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" />
            <span>All Courses</span>
          </Link>
          <div className="h-4 w-[1px] bg-[#32353e]" />
          <span className="font-bold text-white text-sm">{course.title}</span>
        </div>

        {/* Progress & Run Actions */}
        <div className="flex items-center space-x-3">
          <span className="text-gray-400 font-mono">
            Lesson {currentLessonIdx + 1} of {course.lessons.length}
          </span>
          <button
            onClick={handleCheckSolution}
            disabled={isEvaluating}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-semibold shadow transition ${
              isEvaluating ? 'bg-emerald-800 text-emerald-200 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            <Play className={`w-3.5 h-3.5 ${isEvaluating ? 'animate-spin' : 'fill-current'}`} />
            <span>{isEvaluating ? 'Testing...' : 'Check Solution'}</span>
          </button>
        </div>
      </header>

      {/* 2-Pane Split: Left Lesson Content | Right Interactive Editor */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Lesson Syllabus & Instructions */}
        <div className="w-1/2 bg-[#18191d] border-r border-[#2a2c33] flex flex-col overflow-hidden text-xs">
          {/* Lessons Horizontal Progress */}
          <div className="p-2 bg-[#141518] border-b border-[#262832] flex items-center space-x-1 overflow-x-auto">
            {course.lessons.map((lesson, idx) => (
              <button
                key={lesson.id}
                onClick={() => handleLessonSwitch(idx)}
                className={`px-3 py-1 rounded transition text-[11px] whitespace-nowrap ${
                  currentLessonIdx === idx
                    ? 'bg-cyan-950/60 text-cyan-300 font-semibold border border-cyan-800/60'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {idx + 1}. {lesson.title.split('.')[1] || lesson.title}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 select-text leading-relaxed">
            <h2 className="text-lg font-bold text-white">{currentLesson.title}</h2>
            <div className="prose prose-invert prose-sm text-gray-300 whitespace-pre-wrap">
              {currentLesson.content}
            </div>

            <div className="p-3 bg-[#131417] rounded border border-[#252832] font-mono text-[11px]">
              <span className="text-gray-500 block mb-1 font-sans font-semibold">Expected Output:</span>
              <pre className="text-emerald-400">{currentLesson.expectedOutput}</pre>
            </div>

            {/* Hint Drawer */}
            <div className="pt-2">
              <button
                onClick={() => setShowHint(!showHint)}
                className="flex items-center space-x-1.5 text-yellow-400 hover:text-yellow-300 text-xs font-semibold"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>{showHint ? 'Hide Hint' : 'Need a Hint?'}</span>
              </button>
              {showHint && (
                <div className="mt-2 p-3 bg-yellow-950/20 border border-yellow-800/40 rounded text-yellow-200 text-[11px]">
                  {currentLesson.hint}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Monaco Code Editor & Solution Output */}
        <div className="w-1/2 flex flex-col overflow-hidden bg-[#1e1e1e]">
          <div className="flex-1 overflow-hidden relative">
            <Editor
              height="100%"
              language={currentLesson.language === 'cpp' ? 'cpp' : currentLesson.language === 'python' ? 'python' : 'rust'}
              value={code}
              theme="vs-dark"
              onChange={(val) => setCode(val || '')}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                lineNumbersMinChars: 3,
                automaticLayout: true,
              }}
            />
          </div>

          {/* Test Evaluation Feedback Drawer */}
          <div className="h-44 bg-[#141518] border-t border-[#2a2c33] p-4 text-xs font-mono flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-300">Automated Evaluation:</span>
                {isPassed === true && (
                  <span className="flex items-center space-x-1 text-emerald-400 font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Lesson Complete! Well Done!</span>
                  </span>
                )}
                {isPassed === false && (
                  <span className="flex items-center space-x-1 text-rose-400 font-bold">
                    <XCircle className="w-4 h-4" />
                    <span>Output does not match expected result.</span>
                  </span>
                )}
              </div>

              {output && (
                <pre className="bg-[#121316] p-2 rounded border border-[#252832] text-gray-300 text-[11px] overflow-y-auto max-h-20">
                  {output}
                </pre>
              )}
            </div>

            {/* Next Lesson Button */}
            {isPassed && currentLessonIdx + 1 < course.lessons.length && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => handleLessonSwitch(currentLessonIdx + 1)}
                  className="flex items-center space-x-1 px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-semibold rounded shadow transition"
                >
                  <span>Next Lesson</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
