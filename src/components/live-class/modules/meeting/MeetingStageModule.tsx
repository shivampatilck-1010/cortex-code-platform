'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useClassroom, formatInitials } from '@/context/ClassroomContext';
import { ParticipantVideoTile } from './ParticipantVideoTile';
import { Participant, UserRole } from '@/types/classroom';
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
  Pin,
  PinOff,
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
    toggleScreenShare,
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
    remoteAudioLevels,
    activeSpeakerId: contextActiveSpeakerId,
  } = useClassroom();

  const [pinnedParticipantId, setPinnedParticipantId] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<'stage' | 'grid'>('stage');
  const [dismissedError, setDismissedError] = useState<string | null>(null);

  // Active speaker selection: prioritize pinned, then context active speaker, then teacher, then local
  const teacher = useMemo(
    () => participants.find((p) => p.role === 'teacher') || participants[0],
    [participants]
  );

  const activeSpeakerId =
    pinnedParticipantId ||
    contextActiveSpeakerId ||
    (deviceState.isScreenSharing ? currentUserId : teacher?.id || currentUserId);

  const activeSpeaker = useMemo(
    () => participants.find((p) => p.id === activeSpeakerId) || teacher,
    [participants, activeSpeakerId, teacher]
  );

  const isLocalUserActiveSpeaker = activeSpeakerId === currentUserId;

  // Synthesize self participant object
  const selfParticipant: Participant = useMemo(
    () => ({
      id: currentUserId,
      name: currentUserName || (userRole === 'teacher' ? 'Prof. Shivam Patil' : 'You'),
      email: userRole === 'teacher' ? 'teacher@cortex.edu' : 'student@cortex.edu',
      role: userRole,
      isMuted: deviceState.isMuted,
      isVideoOff: deviceState.isVideoOff,
      isScreenSharing: deviceState.isScreenSharing,
      isHandRaised: deviceState.isHandRaised,
      currentModule: 'meeting',
      connectionStatus: 'connected',
    }),
    [currentUserId, currentUserName, userRole, deviceState]
  );

  // All remote participants (excluding local)
  const remoteParticipants = useMemo(
    () => participants.filter((p) => p.id !== currentUserId),
    [participants, currentUserId]
  );

  // Combined participant list for Grid view
  const allMeetingParticipants = useMemo(
    () => [selfParticipant, ...remoteParticipants],
    [selfParticipant, remoteParticipants]
  );

  const activeError =
    deviceState.cameraError || deviceState.microphoneError || deviceState.screenShareError;
  const showErrorBanner = activeError && activeError !== dismissedError;

  // Grid columns calculator
  const gridLayoutClass = useMemo(() => {
    const count = allMeetingParticipants.length + (deviceState.isScreenSharing ? 1 : 0);
    if (count <= 1) return 'grid-cols-1 max-w-4xl';
    if (count === 2) return 'grid-cols-1 md:grid-cols-2 max-w-5xl';
    if (count <= 4) return 'grid-cols-2 max-w-5xl';
    if (count <= 6) return 'grid-cols-2 md:grid-cols-3 max-w-6xl';
    if (count <= 9) return 'grid-cols-3 max-w-6xl';
    return 'grid-cols-3 lg:grid-cols-4 max-w-7xl';
  }, [allMeetingParticipants.length, deviceState.isScreenSharing]);

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
      <div className="mb-3 px-4 py-2 rounded-lg bg-[#111216] border border-[#282A36] flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
          <span className="font-semibold text-white">Live Classroom Audio/Video Stage</span>
          <span className="text-[#71717A]">•</span>
          <span className="text-[#A1A1AA]">
            Active Focus:{' '}
            <strong className="text-white">
              {deviceState.isScreenSharing
                ? 'Your Screen Share'
                : pinnedParticipantId
                ? `${allMeetingParticipants.find((p) => p.id === pinnedParticipantId)?.name || 'Pinned'} (Pinned)`
                : isLocalUserActiveSpeaker
                ? `You (${userRole === 'teacher' ? 'Instructor' : 'Student'})`
                : activeSpeaker?.name || 'Live Stage'}
            </strong>
          </span>
          <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
            WebRTC Encrypted
          </span>
          {pinnedParticipantId && (
            <button
              onClick={() => setPinnedParticipantId(null)}
              className="ml-2 text-[11px] text-[#FF9100] hover:underline flex items-center space-x-1"
            >
              <PinOff className="w-3 h-3" />
              <span>Unpin</span>
            </button>
          )}
        </div>

        {/* View Mode Controls */}
        <div className="flex items-center space-x-1 bg-[#1A1C23] p-1 rounded-md border border-[#282A36]">
          <button
            onClick={() => setLayoutMode('stage')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition ${
              layoutMode === 'stage'
                ? 'bg-[#FF9100] text-black font-semibold'
                : 'text-[#A1A1AA] hover:text-white'
            }`}
            title="Stage View: Focus on speaker with attendee filmstrip"
          >
            <Layout className="w-3.5 h-3.5" />
            <span>Stage</span>
          </button>
          <button
            onClick={() => setLayoutMode('grid')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition ${
              layoutMode === 'grid'
                ? 'bg-[#FF9100] text-black font-semibold'
                : 'text-[#A1A1AA] hover:text-white'
            }`}
            title="Grid View: Google Meet-style equal participant tiles"
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Grid ({allMeetingParticipants.length})</span>
          </button>
        </div>
      </div>

      {/* Main Video Arena */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {layoutMode === 'stage' ? (
          /* ========================================================= */
          /* STAGE MODE: Large Primary Stage + Side Filmstrip           */
          /* ========================================================= */
          <div className="flex-1 flex flex-col lg:flex-row gap-4 h-full overflow-hidden">
            {/* Primary Focus Viewport (70% - 75% width on desktop) */}
            <div className="flex-1 flex flex-col h-full rounded-2xl overflow-hidden border border-[#282A36] bg-[#0E0F12] relative shadow-2xl">
              {/* Condition 1: Local Screen Share Focus */}
              {deviceState.isScreenSharing && screenShareStream ? (
                <div className="w-full h-full relative flex items-center justify-center bg-black">
                  <ParticipantVideoTile
                    participant={selfParticipant}
                    stream={screenShareStream}
                    isLocal={true}
                    isScreenShare={true}
                    className="w-full h-full border-none rounded-none"
                  />
                  <div className="absolute top-4 left-4 z-20 flex items-center space-x-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-white text-xs">
                    <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
                    <span>You are presenting your screen</span>
                    <button
                      onClick={stopScreenShare}
                      className="ml-2 px-2 py-0.5 rounded bg-[#EF4444] hover:bg-[#DC2626] text-white text-[11px] font-medium transition"
                    >
                      Stop Sharing
                    </button>
                  </div>
                </div>
              ) : /* Condition 2: Active Speaker or Pinned Participant */
              isLocalUserActiveSpeaker ? (
                <ParticipantVideoTile
                  participant={selfParticipant}
                  stream={localVideoStream}
                  isLocal={true}
                  audioLevel={deviceState.audioLevel}
                  isSpeaking={!deviceState.isMuted && deviceState.audioLevel > 15}
                  isPinned={pinnedParticipantId === currentUserId}
                  onTogglePin={() =>
                    setPinnedParticipantId(
                      pinnedParticipantId === currentUserId ? null : currentUserId
                    )
                  }
                  className="w-full h-full border-none rounded-none"
                />
              ) : (
                <ParticipantVideoTile
                  participant={activeSpeaker || teacher}
                  stream={
                    activeSpeaker
                      ? remoteStreams.get(activeSpeaker.id) || null
                      : null
                  }
                  isLocal={false}
                  audioLevel={
                    activeSpeaker
                      ? remoteAudioLevels?.get(activeSpeaker.id) || 0
                      : 0
                  }
                  isSpeaking={
                    activeSpeaker
                      ? (remoteAudioLevels?.get(activeSpeaker.id) || 0) > 15
                      : false
                  }
                  isPinned={pinnedParticipantId === activeSpeaker?.id}
                  onTogglePin={() =>
                    activeSpeaker &&
                    setPinnedParticipantId(
                      pinnedParticipantId === activeSpeaker.id ? null : activeSpeaker.id
                    )
                  }
                  isTeacherModerator={userRole === 'teacher'}
                  onMuteStudent={
                    activeSpeaker ? () => muteStudent(activeSpeaker.id) : undefined
                  }
                  onRequestUnmute={
                    activeSpeaker ? () => requestStudentUnmute(activeSpeaker.id) : undefined
                  }
                  className="w-full h-full border-none rounded-none"
                />
              )}
            </div>

            {/* Filmstrip Gallery Rail (Right side on desktop, bottom on mobile) */}
            <div className="lg:w-80 flex lg:flex-col gap-3 overflow-y-auto shrink-0 pr-1">
              {/* Local User Preview Tile in Filmstrip (if not on main stage) */}
              {!isLocalUserActiveSpeaker && (
                <ParticipantVideoTile
                  participant={selfParticipant}
                  stream={localVideoStream}
                  isLocal={true}
                  audioLevel={deviceState.audioLevel}
                  isSpeaking={!deviceState.isMuted && deviceState.audioLevel > 15}
                  isPinned={pinnedParticipantId === currentUserId}
                  onTogglePin={() =>
                    setPinnedParticipantId(
                      pinnedParticipantId === currentUserId ? null : currentUserId
                    )
                  }
                  className="h-36 lg:h-44 w-full shrink-0"
                />
              )}

              {/* Remote Participants in Filmstrip */}
              {remoteParticipants.map((p) => {
                // If this participant is already on the main stage, skip duplicate tile in filmstrip
                if (p.id === activeSpeakerId && !pinnedParticipantId) return null;

                const stream = remoteStreams.get(p.id) || null;
                const audioLevel = remoteAudioLevels?.get(p.id) || 0;
                const isSpeaking = audioLevel > 15;

                return (
                  <ParticipantVideoTile
                    key={p.id}
                    participant={p}
                    stream={stream}
                    isLocal={false}
                    audioLevel={audioLevel}
                    isSpeaking={isSpeaking}
                    isPinned={pinnedParticipantId === p.id}
                    onTogglePin={() =>
                      setPinnedParticipantId(
                        pinnedParticipantId === p.id ? null : p.id
                      )
                    }
                    isTeacherModerator={userRole === 'teacher'}
                    onMuteStudent={() => muteStudent(p.id)}
                    onRequestUnmute={() => requestStudentUnmute(p.id)}
                    className="h-36 lg:h-44 w-full shrink-0"
                  />
                );
              })}
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* GRID MODE: Google Meet-Class Adaptive Grid                */
          /* ========================================================= */
          <div className="flex-1 w-full h-full overflow-y-auto flex items-center justify-center p-2">
            <div
              className={`w-full grid gap-4 auto-rows-fr transition-all duration-300 ${gridLayoutClass}`}
            >
              {/* Active Screen Share Tile in Grid (if streaming) */}
              {deviceState.isScreenSharing && screenShareStream && (
                <div className="aspect-video w-full">
                  <ParticipantVideoTile
                    participant={selfParticipant}
                    stream={screenShareStream}
                    isLocal={true}
                    isScreenShare={true}
                    className="w-full h-full"
                  />
                </div>
              )}

              {/* Local User Tile */}
              <div className="aspect-video w-full">
                <ParticipantVideoTile
                  participant={selfParticipant}
                  stream={localVideoStream}
                  isLocal={true}
                  audioLevel={deviceState.audioLevel}
                  isSpeaking={!deviceState.isMuted && deviceState.audioLevel > 15}
                  isPinned={pinnedParticipantId === currentUserId}
                  onTogglePin={() =>
                    setPinnedParticipantId(
                      pinnedParticipantId === currentUserId ? null : currentUserId
                    )
                  }
                  className="w-full h-full"
                />
              </div>

              {/* All Remote Participant Tiles */}
              {remoteParticipants.map((p) => {
                const stream = remoteStreams.get(p.id) || null;
                const audioLevel = remoteAudioLevels?.get(p.id) || 0;
                const isSpeaking = audioLevel > 15;

                return (
                  <div key={p.id} className="aspect-video w-full">
                    <ParticipantVideoTile
                      participant={p}
                      stream={stream}
                      isLocal={false}
                      audioLevel={audioLevel}
                      isSpeaking={isSpeaking}
                      isPinned={pinnedParticipantId === p.id}
                      onTogglePin={() =>
                        setPinnedParticipantId(
                          pinnedParticipantId === p.id ? null : p.id
                        )
                      }
                      isTeacherModerator={userRole === 'teacher'}
                      onMuteStudent={() => muteStudent(p.id)}
                      onRequestUnmute={() => requestStudentUnmute(p.id)}
                      className="w-full h-full"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
