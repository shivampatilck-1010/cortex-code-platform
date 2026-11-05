import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useClassroom } from '@/context/ClassroomContext';
import { useFollowTeacher } from '@/context/FollowTeacherContext';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  Hand,
  MessageSquare,
  Users,
  Settings,
  LogOut,
  Sliders,
  Radio,
  Eye,
  Loader2,
  Lock,
  Maximize2,
  Minimize2,
} from 'lucide-react';

export const MeetingBottomBar: React.FC = () => {
  const router = useRouter();
  const {
    session,
    deviceState,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
    toggleHandRaise,
    isChatOpen,
    setIsChatOpen,
    isParticipantsOpen,
    setIsParticipantsOpen,
    setIsSettingsOpen,
    participants,
    userRole,
    pendingMediaRequest,
    respondToMediaRequest,
    isFullscreen,
    toggleFullscreen,
    exitFullscreen,
  } = useClassroom();

  const { followMode, setFollowMode, returnToTeacher } = useFollowTeacher();
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showLeaveConfirm) {
        setShowLeaveConfirm(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showLeaveConfirm]);

  return (
    <>
      {pendingMediaRequest && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#15161C] border border-[#FF9100] rounded-xl p-3 shadow-2xl flex items-center space-x-3 text-xs text-white max-w-md w-[92vw] sm:w-full animate-fadeIn"
        >
          <div className="w-9 h-9 rounded-full bg-[#FF9100]/20 border border-[#FF9100]/30 flex items-center justify-center text-[#FF9100] shrink-0">
            {pendingMediaRequest.type === 'unmute' ? (
              <Mic className="w-4 h-4 text-[#FF9100]" />
            ) : (
              <Video className="w-4 h-4 text-[#FF9100]" />
            )}
          </div>
          <div className="flex-1 truncate">
            <p className="font-semibold text-white">Instructor Request</p>
            <p className="text-[11px] text-[#A1A1AA] truncate">
              {pendingMediaRequest.type === 'unmute'
                ? 'Instructor requested you to unmute your microphone.'
                : 'Instructor requested you to turn on your camera.'}
            </p>
          </div>
          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              onClick={() => respondToMediaRequest(pendingMediaRequest.type, true)}
              className="px-3 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white font-medium text-xs transition-colors shadow"
            >
              {pendingMediaRequest.type === 'unmute' ? 'Unmute' : 'Start Video'}
            </button>
            <button
              onClick={() => respondToMediaRequest(pendingMediaRequest.type, false)}
              className="px-2.5 py-1.5 rounded-lg bg-[#282A36] hover:bg-[#3E4251] text-[#A1A1AA] hover:text-white font-medium text-xs transition-colors"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      <footer className="h-16 border-t border-[#282A36] bg-[#0B0C0E] px-4 flex items-center justify-between z-20 select-none">
        {/* Left Section: Live Meeting Audio & AV Indicators */}
        <div className="flex items-center space-x-2 w-1/4 min-w-[200px]">
          {/* Mic Button & Audio Visualizer */}
          <div className="flex items-center rounded-lg bg-[#111216] border border-[#282A36] p-1 relative">
            <button
              onClick={toggleMicrophone}
              disabled={deviceState.isMicrophoneLoading}
              className={`flex items-center justify-center w-9 h-9 rounded transition-all disabled:opacity-50 relative ${
                deviceState.isMuted
                  ? 'bg-[#EF4444]/20 text-[#EF4444] hover:bg-[#EF4444]/30'
                  : 'bg-[#15161C] text-white hover:bg-[#1D1F27]'
              }`}
              title={
                userRole === 'student' && !session.permissions.allowStudentMicrophone
                  ? 'Student microphones locked by instructor'
                  : deviceState.isMicrophoneLoading
                  ? 'Connecting microphone...'
                  : deviceState.isMuted
                  ? 'Unmute Microphone'
                  : 'Mute Microphone'
              }
              aria-label={
                userRole === 'student' && !session.permissions.allowStudentMicrophone
                  ? 'Student microphones locked by instructor'
                  : deviceState.isMicrophoneLoading
                  ? 'Connecting microphone'
                  : deviceState.isMuted
                  ? 'Unmute Microphone'
                  : 'Mute Microphone'
              }
            >
              {deviceState.isMicrophoneLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#A1A1AA]" />
              ) : deviceState.isMuted ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4 text-[#10B981]" />
              )}
              {userRole === 'student' && !session.permissions.allowStudentMicrophone && (
                <span className="absolute -top-1 -right-1 p-0.5 rounded-full bg-[#EF4444] text-white shadow">
                  <Lock className="w-2.5 h-2.5" />
                </span>
              )}
            </button>

            {/* Audio level meter visualizer */}
            <div className="mx-2 flex items-center space-x-0.5 h-4" title="Audio Input Level">
              {[0, 1, 2, 3, 4].map((bar) => {
                const threshold = (bar + 1) * 18;
                const active = !deviceState.isMuted && deviceState.audioLevel >= threshold;
                return (
                  <span
                    key={bar}
                    className={`w-1 rounded-full transition-all duration-100 ${
                      active
                        ? bar > 3
                          ? 'bg-[#FF9100] h-3.5'
                          : 'bg-[#10B981] h-2.5'
                        : 'bg-[#282A36] h-1.5'
                    }`}
                  />
                );
              })}
            </div>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1 text-[#71717A] hover:text-[#A1A1AA] hover:bg-[#15161C] rounded transition-colors"
              title="Microphone Settings"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Camera Button */}
          <button
            onClick={toggleCamera}
            disabled={deviceState.isCameraLoading}
            className={`flex items-center justify-center w-10 h-10 rounded-lg border transition-all disabled:opacity-50 relative ${
              deviceState.isVideoOff
                ? 'bg-[#EF4444]/20 border-[#EF4444]/40 text-[#EF4444] hover:bg-[#EF4444]/30'
                : 'bg-[#111216] border-[#282A36] text-white hover:bg-[#15161C]'
            }`}
            title={
              userRole === 'student' && !session.permissions.allowStudentCamera
                ? 'Student cameras locked by instructor'
                : deviceState.isCameraLoading
                ? 'Connecting camera...'
                : deviceState.isVideoOff
                ? 'Start Video'
                : 'Stop Video'
            }
            aria-label={
              userRole === 'student' && !session.permissions.allowStudentCamera
                ? 'Student cameras locked by instructor'
                : deviceState.isCameraLoading
                ? 'Connecting camera'
                : deviceState.isVideoOff
                ? 'Start Video'
                : 'Stop Video'
            }
          >
            {deviceState.isCameraLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#A1A1AA]" />
            ) : deviceState.isVideoOff ? (
              <VideoOff className="w-4 h-4" />
            ) : (
              <Video className="w-4 h-4" />
            )}
            {userRole === 'student' && !session.permissions.allowStudentCamera && (
              <span className="absolute -top-1 -right-1 p-0.5 rounded-full bg-[#EF4444] text-white shadow">
                <Lock className="w-2.5 h-2.5" />
              </span>
            )}
          </button>
        </div>

        {/* Center Section: Core Classroom Interaction Controls */}
        <div className="flex items-center space-x-2">
          {/* Screen Share */}
          <button
            onClick={toggleScreenShare}
            disabled={deviceState.isScreenSharingLoading}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg border text-xs font-medium transition-all disabled:opacity-50 ${
              deviceState.isScreenSharing
                ? 'bg-[#06B6D4]/20 border-[#06B6D4] text-[#06B6D4]'
                : 'bg-[#111216] border-[#282A36] text-[#F5F5F5] hover:bg-[#15161C]'
            }`}
            title={deviceState.isScreenSharingLoading ? 'Initializing screen share...' : 'Share your screen'}
            aria-label={
              deviceState.isScreenSharingLoading
                ? 'Initializing screen share'
                : deviceState.isScreenSharing
                ? 'Stop sharing screen'
                : 'Share screen'
            }
          >
            {deviceState.isScreenSharingLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#06B6D4]" />
            ) : (
              <MonitorUp className="w-4 h-4" />
            )}
            <span className="hidden md:inline">
              {deviceState.isScreenSharingLoading
                ? 'Starting...'
                : deviceState.isScreenSharing
                ? 'Sharing Screen'
                : 'Share Screen'}
            </span>
          </button>

          {/* Raise Hand (Student) */}
          <button
            onClick={toggleHandRaise}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg border text-xs font-medium transition-all ${
              deviceState.isHandRaised
                ? 'bg-[#FF9100]/20 border-[#FF9100] text-[#FF9100]'
                : 'bg-[#111216] border-[#282A36] text-[#F5F5F5] hover:bg-[#15161C]'
            }`}
            title="Raise your hand to ask a question"
            aria-label={deviceState.isHandRaised ? 'Lower hand' : 'Raise hand to ask question'}
          >
            <Hand className={`w-4 h-4 ${deviceState.isHandRaised ? 'animate-bounce' : ''}`} />
            <span className="hidden md:inline">
              {deviceState.isHandRaised ? 'Hand Raised' : 'Raise Hand'}
            </span>
          </button>

          {/* Follow Teacher Quick Toggle for Students */}
          {userRole === 'student' && (
            <button
              onClick={() => (followMode === 'following' ? setFollowMode('independent') : returnToTeacher())}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg border text-xs font-medium transition-all ${
                followMode === 'following'
                  ? 'bg-[#06B6D4]/15 border-[#06B6D4]/50 text-[#06B6D4]'
                  : 'bg-[#FF9100]/15 border-[#FF9100]/50 text-[#FF9100]'
              }`}
              title={followMode === 'following' ? 'Unlink and explore independently' : 'Return to teacher synchronized view'}
              aria-label={followMode === 'following' ? 'Currently following teacher, click to explore independently' : 'Return to teacher synchronized view'}
            >
              {followMode === 'following' ? (
                <>
                  <Eye className="w-4 h-4 text-[#06B6D4]" />
                  <span className="hidden lg:inline">Following Teacher</span>
                </>
              ) : (
                <>
                  <Radio className="w-4 h-4 text-[#FF9100] animate-pulse" />
                  <span className="hidden lg:inline">Return to Teacher</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Right Section: Sidebars, Device Settings, Leave */}
        <div className="flex items-center justify-end space-x-2 w-1/4 min-w-[200px]">
          {/* Chat Toggle */}
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`relative flex items-center justify-center w-10 h-10 rounded-lg border transition-all ${
              isChatOpen
                ? 'bg-[#1D1F27] border-[#06B6D4] text-[#06B6D4]'
                : 'bg-[#111216] border-[#282A36] text-[#A1A1AA] hover:text-white hover:bg-[#15161C]'
            }`}
            title="Discussion Chat"
            aria-label="Discussion Chat"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#06B6D4]" />
          </button>

          {/* Participants Toggle */}
          <button
            onClick={() => setIsParticipantsOpen(!isParticipantsOpen)}
            className={`flex items-center space-x-1.5 px-3 h-10 rounded-lg border text-xs font-medium transition-all ${
              isParticipantsOpen
                ? 'bg-[#1D1F27] border-[#A855F7] text-[#A855F7]'
                : 'bg-[#111216] border-[#282A36] text-[#A1A1AA] hover:text-white hover:bg-[#15161C]'
            }`}
            title="Classroom Participants"
            aria-label="Classroom Participants"
          >
            <Users className="w-4 h-4" />
            <span className="font-mono text-xs text-white">{participants.length}</span>
          </button>

          {/* AV Settings Modal Trigger */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center justify-center w-10 h-10 rounded-lg border border-[#282A36] bg-[#111216] text-[#A1A1AA] hover:text-white hover:bg-[#15161C] transition-all"
            title="Audio and Video Settings"
            aria-label="Audio and Video Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className={`flex items-center justify-center w-10 h-10 rounded-lg border transition-all ${
              isFullscreen
                ? 'border-[#06B6D4]/50 bg-[#06B6D4]/10 text-[#06B6D4] hover:bg-[#06B6D4]/20'
                : 'border-[#282A36] bg-[#111216] text-[#A1A1AA] hover:text-white hover:bg-[#15161C]'
            }`}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-[#06B6D4]" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>

          {/* Leave Session */}
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="flex items-center space-x-1.5 px-3 h-10 rounded-lg border border-[#3F1F24] bg-[#221316] hover:bg-[#2D161B] text-[#F87171] text-xs font-medium transition-all"
            title="Leave Classroom"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden xl:inline">Leave</span>
          </button>
        </div>
      </footer>

      {/* Leave Classroom Confirmation Dialog */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl border border-[#282A36] bg-[#111216] p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-white">Leave Live Classroom?</h3>
            <p className="mt-2 text-xs text-[#A1A1AA] leading-relaxed">
              You will exit the current session. Your private Code Studio work and whiteboard notes are preserved in your local session storage.
            </p>
            <div className="mt-5 flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="px-3.5 py-1.5 rounded-lg border border-[#282A36] text-xs font-medium text-[#A1A1AA] hover:bg-[#15161C] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowLeaveConfirm(false);
                  await exitFullscreen();
                  router.push('/classroom');
                }}
                className="px-4 py-1.5 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-semibold transition-colors"
              >
                Leave Session
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
