'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getCourseByIdOrSlug } from '@/data/courses';
import { CoursePlayerShell } from '@/components/learn/CoursePlayerShell';

function CoursePlayerRouteInner() {
  const params = useParams<{ courseId: string }>();
  const searchParams = useSearchParams();

  const courseId = typeof params?.courseId === 'string' ? params.courseId : '';
  const course = getCourseByIdOrSlug(courseId);
  const lessonId = searchParams?.get('lesson');

  if (!course) {
    return (
      <div className="min-h-screen bg-[#15181E] text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-xl border border-white/[0.07] bg-[#22252C] p-6 space-y-4 text-center">
          <h1 className="text-[18px] font-bold">Course not found</h1>
          <p className="text-[13.5px] text-zinc-400">
            The requested course could not be located in the CortexLearn catalog.
          </p>
          <Link
            href="/learn"
            className="h-9 px-4 rounded-lg text-[13px] font-semibold bg-[#F3912E] hover:bg-[#E07D19] text-white inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Courses</span>
          </Link>
        </div>
      </div>
    );
  }

  return <CoursePlayerShell course={course} initialLessonId={lessonId} />;
}

export default function CoursePlayerPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#15181E] text-zinc-400 flex items-center justify-center text-[13px] font-mono">
          Loading course...
        </div>
      }
    >
      <CoursePlayerRouteInner />
    </Suspense>
  );
}
