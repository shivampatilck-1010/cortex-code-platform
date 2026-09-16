'use client';

import React, { useState, useEffect } from 'react';
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
import { executeInCloudSandbox } from '@/lib/execution/engine';
import { LearningCourse, LearningLesson, LearningProgress } from '@/lib/learning/db';

type CourseData = LearningCourse & { lessons: LearningLesson[] };

export default function CourseLessonPage() {
  const params = useParams();
  const courseId = (params?.courseId as string) || 'cpp-fundamentals';

  const [course, setCourse] = useState<CourseData | null>(null);
  const [progress, setProgress] = useState<LearningProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentLessonIdx, setCurrentLessonIdx] = useState(0);
  const [code, setCode] = useState('');
  const [output, setOutput] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isPassed, setIsPassed] = useState<boolean | null>(null);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const fetchCourseAndProgress = async () => {
      try {
        const [cRes, pRes] = await Promise.all([
          fetch(`/api/v1/learn/courses/${courseId}`).then(r => r.json()),
          fetch(`/api/v1/learn/progress?courseId=${courseId}`).then(r => r.json().catch(() => ({ progress: [] })))
        ]);

        if (cRes.course) {
          setCourse(cRes.course);
          const userProgress = pRes.progress || [];
          setProgress(userProgress);
          
          // Find first uncompleted lesson, or default to 0
          let initialIdx = 0;
          for (let i = 0; i < cRes.course.lessons.length; i++) {
            const lessonProgress = userProgress.find((p: any) => p.lesson_id === cRes.course.lessons[i].id);
            if (!lessonProgress || lessonProgress.status !== 'completed') {
              initialIdx = i;
              break;
            }
          }
          
          setCurrentLessonIdx(initialIdx);
          const initialLesson = cRes.course.lessons[initialIdx];
          const initialProg = userProgress.find((p: any) => p.lesson_id === initialLesson.id);
          setCode(initialProg?.last_code || initialLesson.starter_code);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchCourseAndProgress();
  }, [courseId]);

  const handleLessonSwitch = (idx: number) => {
    if (!course) return;
    setCurrentLessonIdx(idx);
    const newLesson = course.lessons[idx];
    const lessonProg = progress.find(p => p.lesson_id === newLesson.id);
    setCode(lessonProg?.last_code || newLesson.starter_code);
    setOutput(null);
    setIsPassed(lessonProg?.status === 'completed' ? true : null);
    setShowHint(false);
  };

  const saveProgress = async (status: 'completed' | 'in_progress', currentCode: string) => {
    if (!course) return;
    const currentLesson = course.lessons[currentLessonIdx];
    try {
      const res = await fetch('/api/v1/learn/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: course.id,
          lessonId: currentLesson.id,
          status,
          lastCode: currentCode
        })
      });
      const data = await res.json();
      if (data.progress) {
        setProgress(prev => {
          const filtered = prev.filter(p => p.id !== data.progress.id);
          return [...filtered, data.progress];
        });
      }
    } catch (e) {
      console.error('Failed to save progress', e);
    }
  };

  const handleCheckSolution = async () => {
    if (!course) return;
    const currentLesson = course.lessons[currentLessonIdx];
    setIsEvaluating(true);
    setIsPassed(null);

    try {
      const res = await executeInCloudSandbox({
        language: currentLesson.language,
        files: [{ id: 'lesson', name: `main.${currentLesson.language === 'python' ? 'py' : currentLesson.language === 'cpp' ? 'cpp' : 'rs'}`, path: '/main', content: code }],
      });

      const actual = (res.stdout || '').trim();
      const expected = currentLesson.expected_output.trim();
      setOutput(res.stdout || res.stderr);

      if (actual.includes(expected)) {
        setIsPassed(true);
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        await saveProgress('completed', code);
      } else {
        setIsPassed(false);
        await saveProgress('in_progress', code);
      }
    } finally {
      setIsEvaluating(false);
    }
  };

  if (loading) {
    return <div className="h-screen w-screen flex items-center justify-center bg-[#121316] text-gray-400">Loading course...</div>;
  }

  if (!course) {
    return <div className="h-screen w-screen flex items-center justify-center bg-[#121316] text-rose-400">Course not found.</div>;
  }

  const currentLesson = course.lessons[currentLessonIdx] || course.lessons[0];

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
              <pre className="text-emerald-400">{currentLesson.expected_output}</pre>
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
