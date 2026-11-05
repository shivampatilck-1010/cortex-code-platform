import React from 'react';
import { ClassroomModule } from '@/types/classroom';
import { useClassroom } from '@/context/ClassroomContext';
import { useFollowTeacher } from '@/context/FollowTeacherContext';
import {
  PenTool,
  Code2,
  Video,
  Presentation,
  CheckSquare,
  BookOpen,
  Eye,
  Radio,
} from 'lucide-react';

interface ModuleConfig {
  id: ClassroomModule;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const MODULES: ModuleConfig[] = [
  {
    id: 'code',
    label: 'Code Studio',
    icon: Code2,
    description: 'Dual-workspace collaborative editor and execution',
  },
  {
    id: 'whiteboard',
    label: 'Whiteboard',
    icon: PenTool,
    description: 'Vector whiteboard with equations and diagrams',
  },
  {
    id: 'presentation',
    label: 'Presentations',
    icon: Presentation,
    description: 'Slide deck walkthrough with live annotations',
  },
  {
    id: 'assignments',
    label: 'Assignments',
    icon: CheckSquare,
    description: 'In-class lab tasks and automated evaluation',
  },
  {
    id: 'meeting',
    label: 'Stage & Video',
    icon: Video,
    description: 'Live active speaker stage and participant grid',
  },
  {
    id: 'resources',
    label: 'Resources',
    icon: BookOpen,
    description: 'Syllabus, reference guides and handouts',
  },
];

export const ModuleNavigation: React.FC = () => {
  const { activeModule, setActiveModule, userRole } = useClassroom();
  const { teacherActivity, followMode, setFollowMode, broadcastTeacherActivity, notifyStudentNavigation } = useFollowTeacher();

  const handleSelectModule = (modId: ClassroomModule) => {
    if (userRole === 'teacher') {
      setActiveModule(modId);
      broadcastTeacherActivity({
        module: modId,
        timestamp: Date.now(),
      });
    } else {
      notifyStudentNavigation(modId);
      setActiveModule(modId);
    }
  };

  return (
    <div className="h-12 border-b border-[#282A36] bg-[#111216] px-4 flex items-center justify-between select-none overflow-x-auto">
      <nav className="flex items-center space-x-1 shrink-0" aria-label="Classroom Surface Modules">
        {MODULES.map((mod) => {
          const Icon = mod.icon;
          const isActive = activeModule === mod.id;
          const isTeacherHere = teacherActivity.module === mod.id;

          return (
            <button
              key={mod.id}
              onClick={() => handleSelectModule(mod.id)}
              className={`relative flex items-center space-x-2 px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-[#1D1F27] text-white border border-[#282A36] shadow-sm'
                  : 'text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-[#15161C]'
              }`}
              title={mod.description}
            >
              <Icon
                className={`w-3.5 h-3.5 ${
                  isActive
                    ? mod.id === 'whiteboard'
                      ? 'text-[#06B6D4]'
                      : mod.id === 'code'
                      ? 'text-[#FF9100]'
                      : 'text-white'
                    : 'text-[#71717A]'
                }`}
              />
              <span>{mod.label}</span>

              {/* Indicator if teacher is on this module while student is elsewhere */}
              {userRole === 'student' && isTeacherHere && !isActive && (
                <span className="flex items-center space-x-1 pl-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF9100] animate-pulse" />
                  <span className="text-[10px] text-[#FF9100] font-normal hidden lg:inline">Teacher</span>
                </span>
              )}

              {isActive && (
                <span
                  className={`absolute -bottom-[9px] left-3 right-3 h-[2px] rounded-t ${
                    mod.id === 'whiteboard'
                      ? 'bg-[#06B6D4]'
                      : mod.id === 'code'
                      ? 'bg-[#FF9100]'
                      : 'bg-white'
                  }`}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Surface Status / Sync Context Pill */}
      <div className="flex items-center space-x-3 text-xs">
        {userRole === 'student' ? (
          <div className="flex items-center space-x-2">
            <span className="text-[#71717A] text-[11px] hidden sm:inline">Teacher is in:</span>
            <span className="text-[#FF9100] font-mono text-[11px] bg-[#FF9100]/10 px-2 py-0.5 rounded border border-[#FF9100]/20">
              {MODULES.find((m) => m.id === teacherActivity.module)?.label}
            </span>

            {followMode === 'following' ? (
              <button
                onClick={() => setFollowMode('independent')}
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded border border-[#282A36] bg-[#15161C] hover:bg-[#1D1F27] text-[#06B6D4] text-[11px] transition-colors"
                title="Switch to independent browsing without moving the teacher's view"
              >
                <Eye className="w-3 h-3 text-[#06B6D4]" />
                <span>Following</span>
              </button>
            ) : (
              <button
                onClick={() => setFollowMode('following')}
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded border border-[#FF9100]/40 bg-[#FF9100]/10 hover:bg-[#FF9100]/20 text-[#FF9100] text-[11px] font-medium transition-colors"
                title="Synchronize your screen with teacher's live presentation"
              >
                <Radio className="w-3 h-3 text-[#FF9100] animate-pulse" />
                <span>Return to Teacher</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center space-x-2 text-[11px] text-[#A1A1AA]">
            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
            <span className="font-mono">Broadcasting to 4 students</span>
          </div>
        )}
      </div>
    </div>
  );
};
