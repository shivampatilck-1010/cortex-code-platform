'use client';

import React, { useRef, useEffect } from 'react';
import { Participant, UserRole } from '@/types/classroom';
import { formatInitials } from '@/context/ClassroomContext';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Pin,
  PinOff,
  Shield,
  Monitor,
  Volume2,
} from 'lucide-react';

interface ParticipantVideoTileProps {
  participant: Participant;
  stream: MediaStream | null;
  isLocal: boolean;
  isScreenShare?: boolean;
  audioLevel?: number;
  isSpeaking?: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
  onMuteStudent?: () => void;
  onRequestUnmute?: () => void;
  isTeacherModerator?: boolean;
  className?: string;
}

export const ParticipantVideoTile: React.FC<ParticipantVideoTileProps> = ({
  participant,
  stream,
  isLocal,
  isScreenShare = false,
  audioLevel = 0,
  isSpeaking = false,
  isPinned = false,
  onTogglePin,
  onMuteStudent,
  onRequestUnmute,
  isTeacherModerator = false,
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const hasVideoTrack = Boolean(
    stream &&
      stream.getVideoTracks().length > 0 &&
      stream.getVideoTracks()[0].enabled &&
      (!participant.isVideoOff || isScreenShare)
  );

  const hasAudioTrack = Boolean(
    stream &&
      stream.getAudioTracks().length > 0 &&
      stream.getAudioTracks()[0].enabled &&
      !participant.isMuted
  );

  // Bind video track to video element
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (stream && hasVideoTrack) {
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
      videoEl.play().catch(() => {});
    } else {
      videoEl.srcObject = null;
    }
  }, [stream, hasVideoTrack]);

  // Bind audio track to audio element for remote peers to play incoming sound
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl || isLocal) return;

    if (stream && hasAudioTrack) {
      if (audioEl.srcObject !== stream) {
        audioEl.srcObject = stream;
      }
      audioEl.play().catch(() => {});
    } else {
      audioEl.srcObject = null;
    }
  }, [stream, hasAudioTrack, isLocal]);

  const showActivePulse = isSpeaking || (audioLevel > 15 && !participant.isMuted);

  return (
    <div
      className={`relative rounded-xl overflow-hidden bg-[#111216] border transition-all duration-200 select-none group flex flex-col items-center justify-center ${
        showActivePulse
          ? 'border-[#10B981] ring-2 ring-[#10B981]/50 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
          : isPinned
          ? 'border-[#FF9100] ring-1 ring-[#FF9100]/40'
          : 'border-[#282A36] hover:border-[#3E4251]'
      } ${className}`}
    >
      {/* Video Stream Element */}
      {hasVideoTrack ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isLocal && !isScreenShare ? '-scale-x-100' : ''
          }`}
        />
      ) : (
        /* Video Off Avatar Placeholder */
        <div className="flex flex-col items-center justify-center p-4 text-center space-y-3">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold shadow-inner ${
              participant.role === 'teacher'
                ? 'bg-[#FF9100]/15 text-[#FF9100] border border-[#FF9100]/30'
                : 'bg-[#1D1F27] text-white border border-[#282A36]'
            }`}
          >
            {formatInitials(participant.name)}
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-white tracking-wide truncate max-w-[140px]">
              {participant.name} {isLocal && '(You)'}
            </p>
            <p className="text-[10px] text-[#71717A]">
              {participant.role === 'teacher' ? 'Instructor' : 'Student'} • Camera off
            </p>
          </div>
        </div>
      )}

      {/* Hidden Audio Output Element for Remote Peers */}
      {!isLocal && <audio ref={audioRef} autoPlay playsInline />}

      {/* Top Controls Overlay (Pin / Moderation) */}
      <div className="absolute top-2.5 right-2.5 flex items-center space-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {onTogglePin && (
          <button
            onClick={onTogglePin}
            className={`p-1.5 rounded-lg text-xs backdrop-blur-md transition ${
              isPinned
                ? 'bg-[#FF9100] text-black hover:bg-[#E08000]'
                : 'bg-black/60 hover:bg-black/80 text-white'
            }`}
            title={isPinned ? 'Unpin participant' : 'Pin participant to stage'}
          >
            {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Bottom Information Ribbon */}
      <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-10">
        {/* Name Tag and Role Badge */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-white text-[11px] font-medium shadow-md">
          {isScreenShare ? (
            <Monitor className="w-3.5 h-3.5 text-[#38BDF8]" />
          ) : participant.role === 'teacher' ? (
            <Shield className="w-3.5 h-3.5 text-[#FF9100]" />
          ) : null}
          <span className="truncate max-w-[120px]">
            {isScreenShare ? `${participant.name}'s Screen` : participant.name}
            {isLocal && !isScreenShare ? ' (You)' : ''}
          </span>
          {showActivePulse && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-ping" />
          )}
        </div>

        {/* Media Track Status Badges */}
        <div className="flex items-center space-x-1">
          {/* Audio State */}
          <div
            className={`p-1 rounded-md text-[10px] backdrop-blur-md border ${
              participant.isMuted
                ? 'bg-[#EF4444]/20 border-[#EF4444]/40 text-[#EF4444]'
                : showActivePulse
                ? 'bg-[#10B981]/20 border-[#10B981]/40 text-[#10B981]'
                : 'bg-black/60 border-white/10 text-[#A1A1AA]'
            }`}
            title={participant.isMuted ? 'Microphone is muted' : 'Microphone is active'}
          >
            {participant.isMuted ? (
              <MicOff className="w-3 h-3" />
            ) : showActivePulse ? (
              <Volume2 className="w-3 h-3" />
            ) : (
              <Mic className="w-3 h-3" />
            )}
          </div>

          {/* Video State */}
          <div
            className={`p-1 rounded-md text-[10px] backdrop-blur-md border ${
              participant.isVideoOff && !isScreenShare
                ? 'bg-[#EF4444]/20 border-[#EF4444]/40 text-[#EF4444]'
                : 'bg-black/60 border-white/10 text-[#10B981]'
            }`}
            title={
              participant.isVideoOff && !isScreenShare ? 'Camera is off' : 'Camera is streaming'
            }
          >
            {participant.isVideoOff && !isScreenShare ? (
              <VideoOff className="w-3 h-3" />
            ) : (
              <Video className="w-3 h-3" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
