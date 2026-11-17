'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ExamRunnerModal } from '@/components/classroom/exams/ExamRunnerModal';

export default function ExamDirectLaunchPage({
  params
}: {
  params?: Promise<{ roomId: string; examId: string }>;
}) {
  const router = useRouter();
  const routeParams = useParams();
  const [roomId, setRoomId] = useState<string>((routeParams?.roomId as string) || '');
  const [examId, setExamId] = useState<string>((routeParams?.examId as string) || '');
  const [launchToken, setLaunchToken] = useState<string | null>(null);
  const [user, setUser] = useState({ id: 'student_direct', name: 'Candidate', email: 'student@cortex.edu' });

  useEffect(() => {
    if (routeParams?.roomId) setRoomId(routeParams.roomId as string);
    if (routeParams?.examId) setExamId(routeParams.examId as string);

    if (params) {
      try {
        if (typeof (params as any)?.then === 'function') {
          Promise.resolve(params)
            .then((p: any) => {
              if (p?.roomId) setRoomId(p.roomId);
              if (p?.examId) setExamId(p.examId);
            })
            .catch(() => {});
        } else {
          const p = params as any;
          if (p?.roomId) setRoomId(p.roomId);
          if (p?.examId) setExamId(p.examId);
        }
      } catch (_) {}
    }

    if (typeof window !== 'undefined') {
      const search = new URLSearchParams(window.location.search);
      const token = search.get('sebToken') || search.get('launchToken') || search.get('token');
      if (token) setLaunchToken(token);

      const rawProfile = localStorage.getItem('cortex_user_profile');
      if (rawProfile) {
        try {
          const parsed = JSON.parse(rawProfile);
          if (parsed.id) {
            setUser({
              id: parsed.id,
              name: parsed.name || 'Candidate',
              email: parsed.email || `${parsed.id}@cortex.edu`,
            });
          }
        } catch (_) {}
      }
    }
  }, [params, routeParams]);

  if (!roomId || !examId) {
    return (
      <div className="min-h-screen bg-[#08080a] flex items-center justify-center text-gray-400 font-sans">
        Loading assessment environment...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08080a]">
      <ExamRunnerModal
        classroomId={roomId}
        examId={examId}
        currentUser={user}
        initialLaunchToken={launchToken || undefined}
        onClose={() => router.push(`/classroom`)}
      />
    </div>
  );
}
