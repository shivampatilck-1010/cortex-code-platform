import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ClassroomModule, UserRole } from '@/types/classroom';
import { TeacherActivityContext, FollowMode } from '@/types/realtime';

interface FollowTeacherContextValue {
  followMode: FollowMode;
  teacherActivity: TeacherActivityContext;
  hasUnfollowedChanges: boolean;
  setFollowMode: (mode: FollowMode) => void;
  returnToTeacher: () => void;
  broadcastTeacherActivity: (activity: Partial<TeacherActivityContext>) => void;
  notifyStudentNavigation: (targetModule: ClassroomModule, subLocation?: string) => void;
}

const defaultTeacherActivity: TeacherActivityContext = {
  module: 'code',
  subLocation: 'binary_search.cpp',
  title: 'CS 201: Binary Search Tree Optimization',
  timestamp: Date.now(),
};

const FollowTeacherContext = createContext<FollowTeacherContextValue | null>(null);

export const FollowTeacherProvider: React.FC<{
  children: React.ReactNode;
  userRole: UserRole;
  activeModule: ClassroomModule;
  onModuleChange: (module: ClassroomModule) => void;
}> = ({ children, userRole, activeModule, onModuleChange }) => {
  const [followMode, setFollowModeState] = useState<FollowMode>(() => {
    if (typeof window !== 'undefined' && window.location) {
      const mode = new URLSearchParams(window.location.search).get('mode');
      if (mode === 'independent') return 'independent';
    }
    return 'following';
  });
  const [teacherActivity, setTeacherActivity] = useState<TeacherActivityContext>(defaultTeacherActivity);
  const [hasUnfollowedChanges, setHasUnfollowedChanges] = useState(() => {
    if (typeof window !== 'undefined' && window.location) {
      return new URLSearchParams(window.location.search).get('mode') === 'independent';
    }
    return false;
  });

  // When teacher navigates or changes activity, broadcast new context
  const broadcastTeacherActivity = useCallback((activity: Partial<TeacherActivityContext>) => {
    setTeacherActivity((prev) => {
      const updated = {
        ...prev,
        ...activity,
        timestamp: Date.now(),
      };
      return updated;
    });
  }, []);

  // When student initiates independent navigation away from teacher's current focus
  const notifyStudentNavigation = useCallback((targetModule: ClassroomModule, _subLocation?: string) => {
    if (userRole === 'student') {
      if (targetModule !== teacherActivity.module) {
        setFollowModeState('independent');
        setHasUnfollowedChanges(true);
      }
    }
  }, [userRole, teacherActivity.module]);

  const setFollowMode = useCallback((mode: FollowMode) => {
    setFollowModeState(mode);
    if (mode === 'following') {
      setHasUnfollowedChanges(false);
      onModuleChange(teacherActivity.module);
    }
  }, [teacherActivity.module, onModuleChange]);

  const returnToTeacher = useCallback(() => {
    setFollowModeState('following');
    setHasUnfollowedChanges(false);
    onModuleChange(teacherActivity.module);
  }, [teacherActivity.module, onModuleChange]);

  // If in following mode and teacher activity changes module, keep student synchronized
  useEffect(() => {
    if (userRole === 'student' && followMode === 'following') {
      if (activeModule !== teacherActivity.module) {
        onModuleChange(teacherActivity.module);
      }
    }
  }, [userRole, followMode, teacherActivity.module, activeModule, onModuleChange]);

  return (
    <FollowTeacherContext.Provider
      value={{
        followMode,
        teacherActivity,
        hasUnfollowedChanges,
        setFollowMode,
        returnToTeacher,
        broadcastTeacherActivity,
        notifyStudentNavigation,
      }}
    >
      {children}
    </FollowTeacherContext.Provider>
  );
};

export const useFollowTeacher = () => {
  const context = useContext(FollowTeacherContext);
  if (!context) {
    throw new Error('useFollowTeacher must be used within FollowTeacherProvider');
  }
  return context;
};
