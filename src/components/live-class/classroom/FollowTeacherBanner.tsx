import React from 'react';
import { useClassroom } from '@/context/ClassroomContext';
import { useFollowTeacher } from '@/context/FollowTeacherContext';
import { Radio, ArrowRight, ShieldCheck, Compass } from 'lucide-react';

export const FollowTeacherBanner: React.FC = () => {
  const { userRole } = useClassroom();
  const { followMode, teacherActivity, returnToTeacher } = useFollowTeacher();

  if (userRole !== 'student' || followMode === 'following') {
    return null;
  }

  const moduleNames: Record<string, string> = {
    whiteboard: 'Collaborative Whiteboard',
    code: 'Code Studio',
    meeting: 'Live Video Stage',
    presentation: 'Presentation Slides',
    assignments: 'Lab Assignments',
    resources: 'Course Resources',
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-[#15161C] border-b border-[#FF9100]/30 px-4 py-2 flex items-center justify-between text-xs transition-colors"
    >
      <div className="flex items-center space-x-3">
        <span className="flex items-center justify-center w-5 h-5 rounded bg-[#FF9100]/20 text-[#FF9100]">
          <Compass className="w-3.5 h-3.5" />
        </span>
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-white">Independent Study Mode</span>
          <span className="text-[#71717A]">•</span>
          <span className="text-[#A1A1AA]">
            You are browsing independently. Instructor is teaching on:
          </span>
          <span className="text-[#FF9100] font-medium bg-[#1D1F27] px-2 py-0.5 rounded border border-[#282A36]">
            {moduleNames[teacherActivity.module] || teacherActivity.module}
            {teacherActivity.subLocation ? ` (${teacherActivity.subLocation})` : ''}
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <div className="hidden md:flex items-center space-x-1.5 text-[11px] text-[#71717A]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
          <span>Your private workspace is preserved</span>
        </div>

        <button
          onClick={returnToTeacher}
          className="flex items-center space-x-1.5 px-3 py-1 rounded bg-[#FF9100] hover:bg-[#E08000] text-black font-semibold text-xs transition-all shadow-sm active:translate-y-px"
        >
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          <span>Return to Instructor</span>
          <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
        </button>
      </div>
    </div>
  );
};
