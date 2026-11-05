import React, { useState, useRef, useEffect } from 'react';
import { useClassroom, formatInitials } from '@/context/ClassroomContext';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  Hand,
  Volume2,
  Layout,
  Grid,
  AlertCircle,
  X,
  Square,
} from 'lucide-react';

export const MeetingStageModule: React.FC = () => {
  const {
    session,
    participants,
    currentUserId,
    userRole,
    deviceState,
    toggleCamera,
    toggleMicrophone,
    setIsSettingsOpen,
    localVideoStream,
    screenShareStream,
    stopCamera,
    stopScreenShare,
    muteStudent,
    turnOffStudentCamera,
    requestStudentUnmute,
    requestStudentCamera,
    currentUserName,
    remoteStreams,
  } = useClassroom();

  const [activeSpeakerId, setActiveSpeakerId] = useState<string>(currentUserId);
  const [layoutMode, setLayoutMode] = useState<'stage' | 'grid'>('stage');
  const [dismissedError, setDismissedError] = useState<string | null>(null);

  // Video element refs for real media streams
  const localStageVideoRef = useRef<HTMLVideoElement>(null);
  const localTileVideoRef = useRef<HTMLVideoElement>(null);
  const screenStageVideoRef = useRef<HTMLVideoElement>(null);

  // Bind local camera stream to primary stage video element
  useEffect(() => {
    if (localStageVideoRef.current) {
      if (localVideoStream && !deviceState.isVideoOff) {
        localStageVideoRef.current.srcObject = localVideoStream;
        localStageVideoRef.current.play().catch(() => {});
      } else {
        localStageVideoRef.current.srcObject = null;
      }
    }
  }, [localVideoStream, deviceState.isVideoOff, activeSpeakerId, layoutMode]);

  // Bind local camera stream to gallery preview video element
  useEffect(() => {
    if (localTileVideoRef.current) {
      if (localVideoStream && !deviceState.isVideoOff) {
        localTileVideoRef.current.srcObject = localVideoStream;
        localTileVideoRef.current.play().catch(() => {});
      } else {
        localTileVideoRef.current.srcObject = null;
      }
    }
  }, [localVideoStream, deviceState.isVideoOff, layoutMode]);

  // Bind screen share stream to stage element
  useEffect(() => {
    if (screenStageVideoRef.current) {
      if (screenShareStream && deviceState.isScreenSharing) {
        screenStageVideoRef.current.srcObject = screenShareStream;
        screenStageVideoRef.current.play().catch(() => {});
      } else {
        screenStageVideoRef.current.srcObject = null;
      }
    }
  }, [screenShareStream, deviceState.isScreenSharing, layoutMode]);

  const teacher = participants.find((p) => p.role === 'teacher') || participants[0];
  const activeSpeaker = participants.find((p) => p.id === activeSpeakerId) || teacher;
  const isLocalUserActiveSpeaker = activeSpeakerId === currentUserId;

  const activeError =
    deviceState.cameraError || deviceState.microphoneError || deviceState.screenShareError;
  const showErrorBanner = activeError && activeError !== dismissedError;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B0C0E] p-4 overflow-hidden select-none">
      {/* Hardware / Permission Alert Banner */}
      {showErrorBanner && (
        <div
          role="alert"
          className="mb-3 px-4 py-2.5 rounded-lg bg-[#3F1F24] border border-[#EF4444]/40 flex items-center justify-between text-xs text-[#FCA5A5] animate-fadeIn"
        >
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0" />
            <span className="font-medium">{activeError}</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="px-2.5 py-1 rounded bg-[#EF4444]/20 hover:bg-[#EF4444]/30 text-white font-medium text-[11px] transition-colors"
            >
              Open Settings
            </button>
            <button
              onClick={() => setDismissedError(activeError)}
              className="p-1 hover:text-white transition-colors"
              aria-label="Dismiss error notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Stage Context Banner & View Mode Toggle */}
      <div className="mb-3 px-4 py-2 rounded-lg bg-[#111216] border border-[#282A36] flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
          <span className="font-semibold text-white">Live Classroom Audio/Video Stage</span>
          <span className="text-[#71717A]">•</span>
          <span className="text-[#A1A1AA]">
            Active Focus:{' '}
            <strong className="text-white">
              {deviceState.isScreenSharing
                ? 'Your Screen Share'
                : isLocalUserActiveSpeaker
                ? `You (${userRole === 'teacher' ? 'Instructor' : 'Student'})`
                : activeSpeaker.name}
            </strong>
          </span>
          {isLocalUserActiveSpeaker ? (
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
              Live Hardware
            </span>
          ) : (
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#FF9100]/15 text-[#FF9100] border border-[#FF9100]/30">
              Simulated Peer Feed
            </span>
          )}
        </div>

        {/* View Mode Controls */}
        <div className="flex items-center space-x-1 bg-[#15161C] border border-[#282A36] rounded p-0.5">
          <button
            onClick={() => setLayoutMode('stage')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              layoutMode === 'stage'
                ? 'bg-[#1D1F27] text-white border border-[#282A36]'
                : 'text-[#71717A] hover:text-white'
            }`}
            title="Speaker Stage Focus View"
            aria-label="Speaker Stage Focus View"
          >
            <Layout className="w-3.5 h-3.5 text-[#FF9100]" />
            <span className="hidden sm:inline">Stage View</span>
          </button>
          <button
            onClick={() => setLayoutMode('grid')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              layoutMode === 'grid'
                ? 'bg-[#1D1F27] text-white border border-[#282A36]'
                : 'text-[#71717A] hover:text-white'
            }`}
            title="Grid Gallery View"
            aria-label="Grid Gallery View"
          >
            <Grid className="w-3.5 h-3.5 text-[#06B6D4]" />
            <span className="hidden sm:inline">Grid View</span>
          </button>
        </div>
      </div>

      {/* Main Stage Container */}
      {layoutMode === 'stage' ? (
        /* STAGE VIEW: Primary Stage + Participant Sidebar */
        <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden">
          {/* Primary Focus Stage */}
          <div className="flex-1 rounded-xl border border-[#282A36] bg-[#111216] relative flex flex-col items-center justify-center overflow-hidden shadow-2xl">
            {/* Condition 1: Screen Sharing is Active */}
            {deviceState.isScreenSharing && screenShareStream ? (
              <div className="w-full h-full relative flex items-center justify-center bg-black">
                <video
                  ref={screenStageVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-4 left-4 flex items-center space-x-2 bg-black/75 backdrop-blur px-3 py-1.5 rounded-lg border border-[#06B6D4]/40">
                  <MonitorUp className="w-4 h-4 text-[#06B6D4] animate-pulse" />
                  <span className="text-xs font-medium text-white">
                    Screen Capture Stream (60fps High-DPI)
                  </span>
                </div>
                <div className="absolute bottom-4 right-4 flex items-center space-x-2">
                  <button
                    onClick={stopScreenShare}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-semibold shadow-lg transition-colors"
                  >
                    <Square className="w-3.5 h-3.5 fill-white" />
                    <span>Stop Sharing</span>
                  </button>
                </div>
              </div>
            ) : isLocalUserActiveSpeaker ? (
              /* Condition 2: Local User is Focused */
              !deviceState.isVideoOff && localVideoStream ? (
                /* 2A: Local Real Camera Feed */
                <div className="w-full h-full relative flex items-center justify-center bg-black">
                  <video
                    ref={localStageVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  <div className="absolute top-4 left-4 flex items-center space-x-2 bg-black/75 backdrop-blur px-2.5 py-1 rounded-md border border-[#10B981]/40 text-xs text-white">
                    <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                    <span>Live Local Camera Preview</span>
                  </div>
                  <div className="absolute bottom-4 right-4 flex items-center space-x-2">
                    <button
                      onClick={stopCamera}
                      className="px-3 py-1.5 rounded-lg bg-[#111216]/90 border border-[#282A36] hover:bg-[#1D1F27] text-white text-xs font-medium backdrop-blur transition-colors"
                    >
                      Turn Off Camera
                    </button>
                  </div>
                </div>
              ) : (
                /* 2B: Local User Camera Off State */
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                  <div className="relative mb-4">
                    <div className="w-28 h-28 rounded-full bg-[#1D1F27] border-2 border-[#10B981] flex items-center justify-center shadow-lg relative z-10">
                      <span className="text-2xl font-bold text-white tracking-wider">
                        {formatInitials(currentUserName || (userRole === 'teacher' ? 'Prof. Shivam Patil' : 'Alex Chen'))}
                      </span>
                    </div>
                    {/* Live Web Audio Pulsing Ring */}
                    {!deviceState.isMuted && deviceState.audioLevel > 15 && (
                      <div
                        className="absolute inset-0 -m-3 rounded-full border-2 border-[#10B981] transition-transform duration-75"
                        style={{
                          transform: `scale(${1 + (deviceState.audioLevel / 100) * 0.4})`,
                          opacity: 0.6,
                        }}
                      />
                    )}
                  </div>

                  <h3 className="text-base font-semibold text-white">
                    {(currentUserName || (userRole === 'teacher' ? 'Prof. Shivam Patil' : 'Alex Chen'))} (You)
                  </h3>
                  <span className="text-xs text-[#10B981] font-medium uppercase tracking-wider mt-0.5">
                    {userRole === 'teacher' ? 'Classroom Instructor' : 'Student Participant'}
                  </span>

                  <div className="mt-3 flex items-center space-x-2 text-xs text-[#A1A1AA] bg-[#15161C] px-3.5 py-1.5 rounded-full border border-[#282A36]">
                    {deviceState.isMuted ? (
                      <>
                        <MicOff className="w-3.5 h-3.5 text-[#EF4444]" />
                        <span>Microphone is currently muted</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-[#10B981]" />
                        <span>
                          Live Microphone Input: <strong>{deviceState.audioLevel}%</strong> (Web Audio API)
                        </span>
                      </>
                    )}
                  </div>

                  <div className="mt-5 flex items-center space-x-3">
                    <button
                      onClick={toggleCamera}
                      className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-[#FF9100] hover:bg-[#E08000] text-black text-xs font-semibold shadow-md transition-colors"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Start Camera</span>
                    </button>
                    <button
                      onClick={toggleMicrophone}
                      className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg border text-xs font-medium transition-colors ${
                        deviceState.isMuted
                          ? 'border-[#282A36] bg-[#15161C] text-white hover:bg-[#1D1F27]'
                          : 'border-[#10B981]/50 bg-[#10B981]/15 text-[#10B981]'
                      }`}
                    >
                      {deviceState.isMuted ? (
                        <>
                          <Mic className="w-3.5 h-3.5 text-[#10B981]" />
                          <span>Unmute Mic</span>
                        </>
                      ) : (
                        <>
                          <MicOff className="w-3.5 h-3.5 text-[#EF4444]" />
                          <span>Mute Mic</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )
            ) : (
              /* Condition 3: Remote Participant Focus */
              remoteStreams && remoteStreams.has(activeSpeaker.id) && !activeSpeaker.isVideoOff ? (
                <div className="w-full h-full relative flex items-center justify-center bg-black">
                  <video
                    ref={(el) => {
                      if (el && remoteStreams.get(activeSpeaker.id) && el.srcObject !== remoteStreams.get(activeSpeaker.id)) {
                        el.srcObject = remoteStreams.get(activeSpeaker.id) || null;
                        el.play().catch(() => {});
                      }
                    }}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-4 left-4 flex items-center space-x-2 bg-black/75 backdrop-blur px-2.5 py-1 rounded-md border border-[#FF9100]/40 text-xs text-white">
                    <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                    <span>Live Video ({activeSpeaker.name})</span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                  <div className="relative mb-4">
                    <div className="w-28 h-28 rounded-full bg-[#1D1F27] border-2 border-[#FF9100] flex items-center justify-center shadow-lg relative z-10">
                      <span className="text-2xl font-bold text-white tracking-wider">
                        {formatInitials(activeSpeaker.name)}
                      </span>
                    </div>
                    {!activeSpeaker.isMuted && (
                      <div className="absolute inset-0 -m-3 rounded-full border border-[#10B981]/50 animate-ping opacity-40" />
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-semibold text-white">{activeSpeaker.name}</h3>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                      {activeSpeaker.connectionStatus === 'connected' ? 'Connected' : 'Offline'}
                    </span>
                  </div>
                  <span className="text-xs text-[#FF9100] font-medium uppercase tracking-wider mt-0.5">
                    {activeSpeaker.role === 'teacher' ? 'Course Instructor' : 'Student Participant'}
                  </span>

                  <div className="mt-4 flex items-center space-x-2 text-xs text-[#A1A1AA] bg-[#15161C] px-3.5 py-1.5 rounded-full border border-[#282A36]">
                    {activeSpeaker.isMuted ? (
                      <>
                        <MicOff className="w-3.5 h-3.5 text-[#EF4444]" />
                        <span>Microphone is currently muted</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-[#10B981]" />
                        <span>Microphone active</span>
                      </>
                    )}
                  </div>
                </div>
              )
            )}

            {/* Lower Stage Badges */}
            <div className="absolute bottom-4 left-4 flex items-center space-x-2">
              <span className="px-2.5 py-1 rounded bg-black/70 backdrop-blur text-xs font-medium text-white flex items-center space-x-1.5 border border-[#282A36]">
                <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                <span>
                  {isLocalUserActiveSpeaker
                    ? 'You (Local Preview)'
                    : activeSpeaker.name}
                </span>
              </span>
              {(isLocalUserActiveSpeaker ? deviceState.isMuted : activeSpeaker.isMuted) ? (
                <span className="p-1 rounded bg-[#EF4444]/30 text-[#EF4444]" title="Microphone Muted">
                  <MicOff className="w-3.5 h-3.5" />
                </span>
              ) : (
                <span className="p-1 rounded bg-[#10B981]/30 text-[#10B981]" title="Microphone Active">
                  <Mic className="w-3.5 h-3.5" />
                </span>
              )}
            </div>

            <div className="absolute top-4 right-4 flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded bg-black/60 text-[10px] text-[#71717A] font-mono">
                {isLocalUserActiveSpeaker ? 'Hardware Ingest' : '1080p 60fps • 48kHz Opus'}
              </span>
            </div>
          </div>

          {/* Participant Gallery Sidebar */}
          <div className="lg:w-80 flex lg:flex-col gap-3 overflow-y-auto">
            {/* 1. Local User Video / Audio Preview Card */}
            <div
              onClick={() => setActiveSpeakerId(currentUserId)}
              className={`flex-1 lg:flex-none h-32 lg:h-40 rounded-xl border p-3 flex flex-col justify-between cursor-pointer transition-all relative overflow-hidden ${
                activeSpeakerId === currentUserId
                  ? 'border-[#10B981] bg-[#151D18] shadow-md ring-1 ring-[#10B981]/50'
                  : 'border-[#282A36] bg-[#111216] hover:bg-[#15161C]'
              }`}
            >
              {/* If camera is on, render video in background */}
              {!deviceState.isVideoOff && localVideoStream ? (
                <div className="absolute inset-0 z-0">
                  <video
                    ref={localTileVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1] opacity-80"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
                </div>
              ) : null}

              {/* Card Header */}
              <div className="flex items-center justify-between relative z-10">
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30">
                  You ({userRole})
                </span>
                <div className="flex items-center space-x-1">
                  {deviceState.isHandRaised && (
                    <span className="p-1 rounded bg-[#FF9100]/20 text-[#FF9100]">
                      <Hand className="w-3 h-3" />
                    </span>
                  )}
                  {deviceState.isMuted ? (
                    <MicOff className="w-3 h-3 text-[#EF4444]" />
                  ) : (
                    <Mic className="w-3 h-3 text-[#10B981]" />
                  )}
                </div>
              </div>

              {/* Card Center Avatar (if video off) */}
              {deviceState.isVideoOff && (
                <div className="flex items-center space-x-2 my-auto relative z-10">
                  <div className="w-9 h-9 rounded-full bg-[#1D1F27] border border-[#10B981]/50 text-white font-bold text-xs flex items-center justify-center">
                    {formatInitials(userRole === 'teacher' ? 'Prof. Shivam Patil' : 'Alex Chen')}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-semibold text-white truncate">
                      {userRole === 'teacher' ? 'Prof. Shivam Patil' : 'Alex Chen'}
                    </p>
                    <p className="text-[10px] text-[#A1A1AA] flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                      <span>Local Camera Feed</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Card Footer */}
              <div className="flex items-center justify-between text-[10px] text-[#A1A1AA] pt-1 border-t border-[#282A36]/50 relative z-10 mt-auto">
                <div className="flex items-center space-x-1">
                  {deviceState.isVideoOff ? (
                    <span className="flex items-center text-[#71717A]">
                      <VideoOff className="w-3 h-3 mr-1" /> Cam Off
                    </span>
                  ) : (
                    <span className="flex items-center text-[#10B981]">
                      <Video className="w-3 h-3 mr-1" /> Live Cam
                    </span>
                  )}
                </div>

                {/* Real Live Audio Meter */}
                <div className="flex items-center space-x-0.5" title="Live Audio Input Level">
                  {[0, 1, 2, 3].map((idx) => {
                    const threshold = (idx + 1) * 25;
                    const isActive = !deviceState.isMuted && deviceState.audioLevel >= threshold;
                    return (
                      <span
                        key={idx}
                        className={`w-1 rounded-full transition-all duration-75 ${
                          isActive
                            ? idx === 3
                              ? 'bg-[#FF9100] h-3'
                              : 'bg-[#10B981] h-2.5'
                            : 'bg-[#282A36] h-1.5'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 2. Simulated Remote Peers */}
            {participants
              .filter((p) => p.id !== currentUserId)
              .map((p) => {
                const isSelected = p.id === activeSpeakerId;
                return (
                  <div
                    key={p.id}
                    onClick={() => setActiveSpeakerId(p.id)}
                    className={`flex-1 lg:flex-none h-28 lg:h-36 rounded-xl border p-3 flex flex-col justify-between cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[#FF9100] bg-[#1D1F27]/80 shadow-md ring-1 ring-[#FF9100]/50'
                        : 'border-[#282A36] bg-[#111216] hover:bg-[#15161C]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          p.role === 'teacher'
                            ? 'bg-[#FF9100]/20 text-[#FF9100]'
                            : 'bg-[#282A36] text-[#A1A1AA]'
                        }`}
                      >
                        {p.role}
                      </span>
                      <div className="flex items-center space-x-1">
                        {p.isHandRaised && (
                          <span className="p-1 rounded bg-[#FF9100]/20 text-[#FF9100]">
                            <Hand className="w-3 h-3" />
                          </span>
                        )}
                        {p.isMuted ? (
                          <MicOff className="w-3 h-3 text-[#EF4444]" />
                        ) : (
                          <Mic className="w-3 h-3 text-[#10B981]" />
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 my-auto">
                      <div className="w-8 h-8 rounded-full bg-[#282A36] text-white font-bold text-xs flex items-center justify-center">
                        {formatInitials(p.name)}
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-medium text-white truncate">{p.name}</p>
                        <p className="text-[10px] text-[#71717A] truncate">
                          {p.role === 'teacher' ? 'Course Instructor' : 'Student Participant'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-[#71717A] pt-1 border-t border-[#282A36]">
                      <div className="flex items-center space-x-1.5">
                        <span>On {p.currentModule}</span>
                        {p.isScreenSharing && (
                          <span className="flex items-center text-[#06B6D4]">
                            <MonitorUp className="w-3 h-3 mr-0.5" /> Screen
                          </span>
                        )}
                      </div>

                      {userRole === 'teacher' && p.role === 'student' && (
                        <div
                          className="flex items-center space-x-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {p.isMuted ? (
                            <button
                              onClick={() => requestStudentUnmute(p.id)}
                              disabled={
                                !session.permissions.allowStudentMicrophone ||
                                p.unmuteRequestStatus === 'pending'
                              }
                              className="p-1 rounded bg-[#1D1F27] hover:bg-[#282A36] text-[#A1A1AA] hover:text-white border border-[#282A36] disabled:opacity-40 transition-colors"
                              title={
                                p.unmuteRequestStatus === 'pending'
                                  ? 'Unmute request pending'
                                  : `Request ${p.name} to unmute`
                              }
                              aria-label={`Request ${p.name} to unmute`}
                            >
                              <Mic className="w-3 h-3 text-[#10B981]" />
                            </button>
                          ) : (
                            <button
                              onClick={() => muteStudent(p.id)}
                              className="p-1 rounded bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#EF4444] border border-[#EF4444]/30 transition-colors"
                              title={`Mute ${p.name}`}
                              aria-label={`Mute ${p.name}`}
                            >
                              <MicOff className="w-3 h-3" />
                            </button>
                          )}

                          {p.isVideoOff ? (
                            <button
                              onClick={() => requestStudentCamera(p.id)}
                              disabled={
                                !session.permissions.allowStudentCamera ||
                                p.cameraRequestStatus === 'pending'
                              }
                              className="p-1 rounded bg-[#1D1F27] hover:bg-[#282A36] text-[#A1A1AA] hover:text-white border border-[#282A36] disabled:opacity-40 transition-colors"
                              title={
                                p.cameraRequestStatus === 'pending'
                                  ? 'Camera request pending'
                                  : `Request ${p.name} to start video`
                              }
                              aria-label={`Request ${p.name} to start camera`}
                            >
                              <Video className="w-3 h-3 text-[#06B6D4]" />
                            </button>
                          ) : (
                            <button
                              onClick={() => turnOffStudentCamera(p.id)}
                              className="p-1 rounded bg-[#FF9100]/15 hover:bg-[#FF9100]/25 text-[#FF9100] border border-[#FF9100]/30 transition-colors"
                              title={`Turn off ${p.name} camera`}
                              aria-label={`Turn off ${p.name} camera`}
                            >
                              <VideoOff className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ) : (
        /* GRID GALLERY VIEW: Equal Size Responsive Cards */
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto">
          {/* Local User Card */}
          <div
            onClick={() => setActiveSpeakerId(currentUserId)}
            className="rounded-xl border border-[#10B981]/50 bg-[#111216] p-4 flex flex-col justify-between relative overflow-hidden shadow-xl"
          >
            {!deviceState.isVideoOff && localVideoStream ? (
              <div className="absolute inset-0 z-0">
                <video
                  ref={localStageVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center my-auto text-center z-10">
                <div className="w-16 h-16 rounded-full bg-[#1D1F27] border-2 border-[#10B981] flex items-center justify-center text-lg font-bold text-white mb-2">
                  {formatInitials(userRole === 'teacher' ? 'Prof. Shivam Patil' : 'Alex Chen')}
                </div>
                <span className="text-xs font-semibold text-white">
                  {userRole === 'teacher' ? 'Prof. Shivam Patil' : 'Alex Chen'} (You)
                </span>
                <span className="text-[10px] text-[#71717A] mt-0.5">Camera is turned off</span>
              </div>
            )}

            <div className="flex items-center justify-between relative z-10">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30">
                You ({userRole})
              </span>
              <div className="flex items-center space-x-1">
                {deviceState.isMuted ? (
                  <MicOff className="w-3.5 h-3.5 text-[#EF4444]" />
                ) : (
                  <Mic className="w-3.5 h-3.5 text-[#10B981]" />
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-white pt-2 border-t border-[#282A36]/60 relative z-10 mt-auto">
              <span className="text-[11px] font-medium">Local Media Ingest</span>
              <span className="text-[10px] text-[#10B981] font-mono">
                {!deviceState.isMuted ? `RMS ${deviceState.audioLevel}%` : 'Muted'}
              </span>
            </div>
          </div>

          {/* Remote Participants */}
          {participants
            .filter((p) => p.id !== currentUserId)
            .map((p) => (
              <div
                key={p.id}
                onClick={() => setActiveSpeakerId(p.id)}
                className="rounded-xl border border-[#282A36] bg-[#111216] p-4 flex flex-col justify-between hover:bg-[#15161C] transition-all cursor-pointer shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      p.role === 'teacher'
                        ? 'bg-[#FF9100]/20 text-[#FF9100]'
                        : 'bg-[#282A36] text-[#A1A1AA]'
                    }`}
                  >
                    {p.role}
                  </span>
                  <div className="flex items-center space-x-1">
                    {p.isMuted ? (
                      <MicOff className="w-3.5 h-3.5 text-[#EF4444]" />
                    ) : (
                      <Mic className="w-3.5 h-3.5 text-[#10B981]" />
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center my-auto text-center">
                  <div className="w-16 h-16 rounded-full bg-[#1D1F27] border border-[#282A36] flex items-center justify-center text-lg font-bold text-white mb-2">
                    {formatInitials(p.name)}
                  </div>
                  <span className="text-xs font-semibold text-white">{p.name}</span>
                  <span className="text-[10px] text-[#71717A] mt-0.5">Simulated demo feed</span>
                </div>

                <div className="flex items-center justify-between text-xs text-[#71717A] pt-2 border-t border-[#282A36]">
                  <span className="text-[11px]">On {p.currentModule}</span>
                  {userRole === 'teacher' && p.role === 'student' ? (
                    <div
                      className="flex items-center space-x-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {p.isMuted ? (
                        <button
                          onClick={() => requestStudentUnmute(p.id)}
                          disabled={
                            !session.permissions.allowStudentMicrophone ||
                            p.unmuteRequestStatus === 'pending'
                          }
                          className="px-2 py-0.5 rounded text-[10px] bg-[#1D1F27] hover:bg-[#282A36] text-[#A1A1AA] hover:text-white border border-[#282A36] disabled:opacity-40 flex items-center space-x-1 transition-colors"
                          aria-label={`Request ${p.name} to unmute`}
                        >
                          <Mic className="w-3 h-3 text-[#10B981]" />
                          <span>Ask Mic</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => muteStudent(p.id)}
                          className="px-2 py-0.5 rounded text-[10px] bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#EF4444] border border-[#EF4444]/30 flex items-center space-x-1 transition-colors"
                          aria-label={`Mute ${p.name}`}
                        >
                          <MicOff className="w-3 h-3" />
                          <span>Mute</span>
                        </button>
                      )}

                      {p.isVideoOff ? (
                        <button
                          onClick={() => requestStudentCamera(p.id)}
                          disabled={
                            !session.permissions.allowStudentCamera ||
                            p.cameraRequestStatus === 'pending'
                          }
                          className="px-2 py-0.5 rounded text-[10px] bg-[#1D1F27] hover:bg-[#282A36] text-[#A1A1AA] hover:text-white border border-[#282A36] disabled:opacity-40 flex items-center space-x-1 transition-colors"
                          aria-label={`Request ${p.name} to start camera`}
                        >
                          <Video className="w-3 h-3 text-[#06B6D4]" />
                          <span>Ask Cam</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => turnOffStudentCamera(p.id)}
                          className="px-2 py-0.5 rounded text-[10px] bg-[#FF9100]/15 hover:bg-[#FF9100]/25 text-[#FF9100] border border-[#FF9100]/30 flex items-center space-x-1 transition-colors"
                          aria-label={`Turn off ${p.name} camera`}
                        >
                          <VideoOff className="w-3 h-3" />
                          <span>Stop Cam</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] font-mono">Simulated Peer</span>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
