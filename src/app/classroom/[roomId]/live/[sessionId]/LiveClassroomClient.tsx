'use client';

import React from 'react';
import { ClassroomProvider, useClassroom } from '@/components/live-class/context/ClassroomContext';
import { FollowTeacherProvider } from '@/components/live-class/context/FollowTeacherContext';
import { ClassroomHeader } from '@/components/live-class/classroom/ClassroomHeader';
import { ModuleNavigation } from '@/components/live-class/classroom/ModuleNavigation';
import { FollowTeacherBanner } from '@/components/live-class/classroom/FollowTeacherBanner';
import { MeetingBottomBar } from '@/components/live-class/classroom/MeetingBottomBar';
import { DeviceSettingsModal } from '@/components/live-class/classroom/DeviceSettingsModal';
import { ChatSidebar } from '@/components/live-class/sidebars/ChatSidebar';
import { ParticipantsSidebar } from '@/components/live-class/sidebars/ParticipantsSidebar';
import { WhiteboardModule } from '@/components/live-class/modules/whiteboard/WhiteboardModule';
import { CodeStudioModule } from '@/components/live-class/modules/codestudio/CodeStudioModule';
import { MeetingStageModule } from '@/components/live-class/modules/meeting/MeetingStageModule';
import { PresentationModule } from '@/components/live-class/modules/presentation/PresentationModule';
import { AssignmentsModule } from '@/components/live-class/modules/assignments/AssignmentsModule';
import { ResourcesModule } from '@/components/live-class/modules/resources/ResourcesModule';
import { useRouter } from 'next/navigation';
import { ShieldAlert, LogIn, ArrowLeft, Loader2, VideoOff, Mic, Video } from 'lucide-react';

interface LiveClassroomClientProps {
  roomId: string;
  sessionId: string;
}

const ClassroomShell: React.FC<{ roomId: string; sessionId: string }> = ({ roomId }) => {
  const router = useRouter();
  const {
    authStatus,
    authErrorMessage,
    userRole,
    activeModule,
    setActiveModule,
    toastMessage,
    pendingMediaRequest,
    respondToMediaRequest,
  } = useClassroom();

  if (authStatus === 'loading') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0B0C0E] text-white">
        <div className="flex flex-col items-center space-y-4 max-w-sm text-center">
          <div className="w-12 h-12 rounded-xl bg-[#111216] border border-[#282A36] flex items-center justify-center text-[#FF9100] shadow-lg animate-pulse">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-semibold tracking-wide">Connecting to Live Classroom</h2>
            <p className="text-xs text-[#71717A]">Verifying authorization and establishing encrypted signaling channel...</p>
          </div>
        </div>
      </div>
    );
  }

  if (authStatus === 'unauthorized') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0B0C0E] text-white p-4">
        <div className="bg-[#111216] border border-[#282A36] rounded-2xl p-8 max-w-md w-full text-center space-y-5 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-[#FF9100]/10 border border-[#FF9100]/25 text-[#FF9100] flex items-center justify-center mx-auto">
            <LogIn className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold">Authentication Required</h2>
            <p className="text-xs text-[#A1A1AA]">Please log in to your Cortex account to join this live interactive classroom.</p>
          </div>
          <div className="flex flex-col space-y-2.5 pt-2">
            <button
              onClick={() => router.push('/login')}
              className="w-full py-2.5 px-4 rounded-xl bg-[#FF9100] hover:bg-[#E08000] text-black font-semibold text-xs transition"
            >
              Log In to Cortex
            </button>
            <button
              onClick={() => router.push(`/classroom/${roomId}`)}
              className="w-full py-2.5 px-4 rounded-xl bg-[#15161C] hover:bg-[#1D1F27] border border-[#282A36] text-white font-medium text-xs transition"
            >
              Back to Classroom
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (authStatus === 'forbidden') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0B0C0E] text-white p-4">
        <div className="bg-[#111216] border border-[#EF4444]/30 rounded-2xl p-8 max-w-md w-full text-center space-y-5 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-[#EF4444]/10 border border-[#EF4444]/25 text-[#EF4444] flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold">Access Denied</h2>
            <p className="text-xs text-[#A1A1AA]">{authErrorMessage || 'You do not have permission to join this live classroom.'}</p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => router.push(`/classroom/${roomId}`)}
              className="inline-flex items-center space-x-2 py-2.5 px-5 rounded-xl bg-[#15161C] hover:bg-[#1D1F27] border border-[#282A36] text-white font-medium text-xs transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Classroom Dashboard</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (authStatus === 'not_found') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0B0C0E] text-white p-4">
        <div className="bg-[#111216] border border-[#282A36] rounded-2xl p-8 max-w-md w-full text-center space-y-5 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-[#71717A]/10 border border-[#71717A]/25 text-[#71717A] flex items-center justify-center mx-auto">
            <VideoOff className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold">Classroom Not Found</h2>
            <p className="text-xs text-[#A1A1AA]">The requested classroom session does not exist or has already concluded.</p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => router.push('/classroom')}
              className="inline-flex items-center space-x-2 py-2.5 px-5 rounded-xl bg-[#FF9100] hover:bg-[#E08000] text-black font-semibold text-xs transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Classrooms</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <FollowTeacherProvider
      userRole={userRole}
      activeModule={activeModule}
      onModuleChange={setActiveModule}
    >
      <div className="cortex-classroom-immersive-container flex flex-col h-screen w-screen overflow-hidden bg-[#0B0C0E] text-[#F5F5F5] font-sans antialiased">
        {/* Header */}
        <ClassroomHeader />

        {/* Persistent Module Navigation Bar */}
        <ModuleNavigation />

        {/* Follow Teacher / Independent Mode Status Banner */}
        <FollowTeacherBanner />

        {/* Primary Learning Canvas Stage and Sidebars */}
        <main className="flex-1 flex overflow-hidden relative" role="main">
          <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            <div className={`flex-1 flex-col h-full overflow-hidden ${activeModule === 'code' ? 'flex' : 'hidden'}`}>
              <CodeStudioModule />
            </div>
            <div className={`flex-1 flex-col h-full overflow-hidden ${activeModule === 'whiteboard' ? 'flex' : 'hidden'}`}>
              <WhiteboardModule />
            </div>
            <div className={`flex-1 flex-col h-full overflow-hidden ${activeModule === 'meeting' ? 'flex' : 'hidden'}`}>
              <MeetingStageModule />
            </div>
            <div className={`flex-1 flex-col h-full overflow-hidden ${activeModule === 'presentation' ? 'flex' : 'hidden'}`}>
              <PresentationModule />
            </div>
            <div className={`flex-1 flex-col h-full overflow-hidden ${activeModule === 'assignments' ? 'flex' : 'hidden'}`}>
              <AssignmentsModule />
            </div>
            <div className={`flex-1 flex-col h-full overflow-hidden ${activeModule === 'resources' ? 'flex' : 'hidden'}`}>
              <ResourcesModule />
            </div>
          </div>

          {/* Integrated Sidebars */}
          <ChatSidebar />
          <ParticipantsSidebar />
        </main>

        {/* Persistent Meeting Controls Bar */}
        <MeetingBottomBar />

        {/* Hardware Devices & Audio/Video Modal */}
        <DeviceSettingsModal />

        {/* Explicit Student AV Consent Dialog */}
        {pendingMediaRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-[#111216] border border-[#282A36] rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
              <div className="w-12 h-12 rounded-xl bg-[#FF9100]/10 border border-[#FF9100]/30 text-[#FF9100] flex items-center justify-center">
                {pendingMediaRequest.type === 'unmute' ? <Mic className="w-6 h-6" /> : <Video className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {pendingMediaRequest.type === 'unmute' ? 'Instructor Requested Unmute' : 'Instructor Requested Camera'}
                </h3>
                <p className="text-xs text-[#A1A1AA] mt-1">
                  The instructor is asking you to turn on your {pendingMediaRequest.type === 'unmute' ? 'microphone' : 'camera'}. Would you like to share your {pendingMediaRequest.type === 'unmute' ? 'audio' : 'video'}?
                </p>
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <button
                  onClick={() => respondToMediaRequest(pendingMediaRequest.type, false)}
                  className="flex-1 py-2 px-3 rounded-lg bg-[#1D1F27] hover:bg-[#282A36] border border-[#282A36] text-white text-xs font-medium transition"
                >
                  Decline
                </button>
                <button
                  onClick={() => respondToMediaRequest(pendingMediaRequest.type, true)}
                  className="flex-1 py-2 px-3 rounded-lg bg-[#FF9100] hover:bg-[#E08000] text-black text-xs font-semibold shadow-md transition"
                >
                  Allow & Turn On
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global Toast Notification System */}
        {toastMessage && (
          <div
            role="alert"
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#1D1F27] border border-[#282A36] text-white px-4 py-2.5 rounded-xl text-xs shadow-2xl flex items-center space-x-2.5 transition-all"
          >
            <span className="w-2 h-2 rounded-full bg-[#FF9100] animate-pulse" />
            <span className="font-medium">{toastMessage}</span>
          </div>
        )}
      </div>
    </FollowTeacherProvider>
  );
};

export default function LiveClassroomClient({ roomId, sessionId }: LiveClassroomClientProps) {
  return (
    <ClassroomProvider classroomId={roomId} sessionId={sessionId}>
      <ClassroomShell roomId={roomId} sessionId={sessionId} />
    </ClassroomProvider>
  );
}
