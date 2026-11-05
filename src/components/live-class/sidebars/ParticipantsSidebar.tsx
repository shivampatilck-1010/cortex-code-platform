import React from 'react';
import { useClassroom, formatInitials } from '@/context/ClassroomContext';
import {
  X,
  Users,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Hand,
  MonitorUp,
  VolumeX,
  HandMetal,
  Shield,
  Layers,
  Lock,
  Unlock,
} from 'lucide-react';

export const ParticipantsSidebar: React.FC = () => {
  const {
    isParticipantsOpen,
    setIsParticipantsOpen,
    participants,
    userRole,
    session,
    muteAllStudents,
    lowerAllHands,
    turnOffAllStudentCameras,
    toggleStudentMicrophoneLock,
    toggleStudentCameraLock,
    muteStudent,
    turnOffStudentCamera,
    requestStudentUnmute,
    requestStudentCamera,
  } = useClassroom();

  if (!isParticipantsOpen) return null;

  const teacher = participants.find((p) => p.role === 'teacher');
  const students = participants.filter((p) => p.role === 'student');

  return (
    <aside
      className="w-80 md:w-96 border-l border-[#282A36] bg-[#111216] flex flex-col h-full z-10 select-none shadow-xl"
      aria-label="Classroom Participants"
    >
      {/* Sidebar Header */}
      <div className="h-12 border-b border-[#282A36] px-4 flex items-center justify-between bg-[#0B0C0E]">
        <div className="flex items-center space-x-2">
          <Users className="w-4 h-4 text-[#A855F7]" />
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
            Participants ({participants.length})
          </h3>
        </div>
        <button
          onClick={() => setIsParticipantsOpen(false)}
          className="p-1 rounded text-[#71717A] hover:text-white hover:bg-[#15161C] transition-colors"
          aria-label="Close Participants List"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Instructor Moderation Bar (Visible to Teachers) */}
      {userRole === 'teacher' && (
        <div className="p-3 border-b border-[#282A36] bg-[#15161C] flex flex-col space-y-2">
          {/* Row 1: Bulk Actions */}
          <div className="flex items-center space-x-1.5">
            <button
              onClick={muteAllStudents}
              className="flex-1 flex items-center justify-center space-x-1 px-2 py-1.5 rounded bg-[#1D1F27] hover:bg-[#282A36] text-[#EF4444] text-[11px] font-medium border border-[#282A36] transition-colors"
              title="Mute All Student Microphones"
            >
              <VolumeX className="w-3.5 h-3.5" />
              <span>Mute All</span>
            </button>
            <button
              onClick={turnOffAllStudentCameras}
              className="flex-1 flex items-center justify-center space-x-1 px-2 py-1.5 rounded bg-[#1D1F27] hover:bg-[#282A36] text-[#FF9100] text-[11px] font-medium border border-[#282A36] transition-colors"
              title="Turn Off All Student Cameras"
            >
              <VideoOff className="w-3.5 h-3.5" />
              <span>Stop All Cams</span>
            </button>
            <button
              onClick={lowerAllHands}
              className="flex-1 flex items-center justify-center space-x-1 px-2 py-1.5 rounded bg-[#1D1F27] hover:bg-[#282A36] text-[#A1A1AA] hover:text-white text-[11px] font-medium border border-[#282A36] transition-colors"
              title="Lower All Raised Hands"
            >
              <HandMetal className="w-3.5 h-3.5" />
              <span>Lower Hands</span>
            </button>
          </div>

          {/* Row 2: Permission Locks */}
          <div className="flex items-center space-x-1.5 pt-1 border-t border-[#282A36]/50">
            <button
              onClick={toggleStudentMicrophoneLock}
              className={`flex-1 flex items-center justify-center space-x-1 px-2 py-1.5 rounded text-[10px] font-medium border transition-colors ${
                session.permissions.allowStudentMicrophone
                  ? 'bg-[#1D1F27] hover:bg-[#282A36] text-[#10B981] border-[#282A36]'
                  : 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/40 font-semibold'
              }`}
              title={
                session.permissions.allowStudentMicrophone
                  ? 'Lock student microphones (prevent students from unmuting)'
                  : 'Unlock student microphones (allow students to unmute)'
              }
              aria-label={
                session.permissions.allowStudentMicrophone
                  ? 'Lock Student Microphones'
                  : 'Unlock Student Microphones'
              }
            >
              {session.permissions.allowStudentMicrophone ? (
                <>
                  <Unlock className="w-3 h-3 text-[#10B981]" />
                  <span>Mics Allowed</span>
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3 text-[#EF4444]" />
                  <span>Mics Locked</span>
                </>
              )}
            </button>

            <button
              onClick={toggleStudentCameraLock}
              className={`flex-1 flex items-center justify-center space-x-1 px-2 py-1.5 rounded text-[10px] font-medium border transition-colors ${
                session.permissions.allowStudentCamera
                  ? 'bg-[#1D1F27] hover:bg-[#282A36] text-[#10B981] border-[#282A36]'
                  : 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/40 font-semibold'
              }`}
              title={
                session.permissions.allowStudentCamera
                  ? 'Lock student cameras (prevent students from starting video)'
                  : 'Unlock student cameras (allow students to start video)'
              }
              aria-label={
                session.permissions.allowStudentCamera
                  ? 'Lock Student Cameras'
                  : 'Unlock Student Cameras'
              }
            >
              {session.permissions.allowStudentCamera ? (
                <>
                  <Unlock className="w-3 h-3 text-[#10B981]" />
                  <span>Cams Allowed</span>
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3 text-[#EF4444]" />
                  <span>Cams Locked</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Participant List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Teacher Section */}
        {teacher && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#FF9100]">
                Host / Instructor
              </span>
              <span className="text-[10px] text-[#71717A] flex items-center space-x-1">
                <Shield className="w-3 h-3 text-[#FF9100]" />
                <span>Admin</span>
              </span>
            </div>
            <div className="rounded-lg border border-[#FF9100]/30 bg-[#FF9100]/5 p-3 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-full bg-[#FF9100] text-black font-bold text-xs flex items-center justify-center">
                  SP
                </div>
                <div>
                  <h4 className="text-xs font-medium text-white">{teacher.name}</h4>
                  <div className="flex items-center space-x-1.5 text-[10px] text-[#A1A1AA]">
                    <Layers className="w-3 h-3 text-[#FF9100]" />
                    <span className="capitalize">On {teacher.currentModule}</span>
                  </div>
                </div>
              </div>

              {/* Status Icons */}
              <div className="flex items-center space-x-1.5">
                {teacher.isMuted ? (
                  <MicOff className="w-3.5 h-3.5 text-[#EF4444]" />
                ) : (
                  <Mic className="w-3.5 h-3.5 text-[#10B981]" />
                )}
                {teacher.isVideoOff ? (
                  <VideoOff className="w-3.5 h-3.5 text-[#71717A]" />
                ) : (
                  <Video className="w-3.5 h-3.5 text-white" />
                )}
                {teacher.isScreenSharing && (
                  <MonitorUp className="w-3.5 h-3.5 text-[#06B6D4]" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Students Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA]">
              Students ({students.length})
            </span>
            <span className="text-[10px] text-[#71717A]">Active In Class</span>
          </div>

          <div className="space-y-2">
            {students.map((stu) => {
              const isDisconnected = stu.connectionStatus === 'disconnected';
              return (
                <div
                  key={stu.id}
                  className="rounded-lg border border-[#282A36] bg-[#15161C] p-2.5 flex flex-col space-y-2 hover:border-[#3E4251] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#282A36] text-white font-medium text-[11px] flex items-center justify-center">
                        {formatInitials(stu.name)}
                      </div>
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-medium text-white">{stu.name}</span>
                          {stu.isSimulated && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-[#282A36] text-[#71717A] font-mono">
                              Simulated
                            </span>
                          )}
                          {isDisconnected && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30 font-medium">
                              Disconnected
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#71717A]">
                          {isDisconnected ? 'Offline / Disconnected' : `Exploring ${stu.currentModule}`}
                        </div>
                      </div>
                    </div>

                    {/* Status indicators */}
                    <div className="flex items-center space-x-1.5">
                      {stu.isHandRaised && (
                        <span className="flex items-center px-1.5 py-0.5 rounded bg-[#FF9100]/20 text-[#FF9100] text-[10px] font-medium border border-[#FF9100]/30 animate-pulse">
                          <Hand className="w-3 h-3 mr-0.5" /> Hand
                        </span>
                      )}

                      {stu.isMuted ? (
                        <MicOff className="w-3.5 h-3.5 text-[#EF4444]" />
                      ) : (
                        <Mic className="w-3.5 h-3.5 text-[#10B981]" />
                      )}

                      {stu.isVideoOff ? (
                        <VideoOff className="w-3.5 h-3.5 text-[#71717A]" />
                      ) : (
                        <Video className="w-3.5 h-3.5 text-white" />
                      )}
                    </div>
                  </div>

                  {/* Teacher Direct Control Buttons */}
                  {userRole === 'teacher' && (
                    <div className="pt-2 border-t border-[#282A36]/60 flex items-center justify-end space-x-1.5">
                      {/* Mic Control */}
                      {stu.isMuted ? (
                        <button
                          onClick={() => requestStudentUnmute(stu.id)}
                          disabled={
                            isDisconnected ||
                            !session.permissions.allowStudentMicrophone ||
                            stu.unmuteRequestStatus === 'pending'
                          }
                          className="flex items-center space-x-1 px-2 py-1 rounded text-[10px] font-medium bg-[#1D1F27] hover:bg-[#282A36] text-[#A1A1AA] hover:text-white border border-[#282A36] disabled:opacity-40 transition-colors"
                          title={
                            isDisconnected
                              ? 'Participant is disconnected'
                              : !session.permissions.allowStudentMicrophone
                              ? 'Microphones locked'
                              : stu.unmuteRequestStatus === 'pending'
                              ? 'Unmute request pending'
                              : `Request ${stu.name} to unmute`
                          }
                          aria-label={`Request ${stu.name} to unmute`}
                        >
                          <Mic className="w-3 h-3 text-[#10B981]" />
                          <span>
                            {stu.unmuteRequestStatus === 'pending' ? 'Request sent' : 'Ask Unmute'}
                          </span>
                        </button>
                      ) : (
                        <button
                          onClick={() => muteStudent(stu.id)}
                          disabled={isDisconnected}
                          className="flex items-center space-x-1 px-2 py-1 rounded text-[10px] font-medium bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#EF4444] border border-[#EF4444]/30 disabled:opacity-40 transition-colors"
                          title={isDisconnected ? 'Participant is disconnected' : `Mute ${stu.name}`}
                          aria-label={`Mute ${stu.name}`}
                        >
                          <MicOff className="w-3 h-3" />
                          <span>Mute</span>
                        </button>
                      )}

                      {/* Video Control */}
                      {stu.isVideoOff ? (
                        <button
                          onClick={() => requestStudentCamera(stu.id)}
                          disabled={
                            isDisconnected ||
                            !session.permissions.allowStudentCamera ||
                            stu.cameraRequestStatus === 'pending'
                          }
                          className="flex items-center space-x-1 px-2 py-1 rounded text-[10px] font-medium bg-[#1D1F27] hover:bg-[#282A36] text-[#A1A1AA] hover:text-white border border-[#282A36] disabled:opacity-40 transition-colors"
                          title={
                            isDisconnected
                              ? 'Participant is disconnected'
                              : !session.permissions.allowStudentCamera
                              ? 'Cameras locked'
                              : stu.cameraRequestStatus === 'pending'
                              ? 'Camera request pending'
                              : `Request ${stu.name} to start video`
                          }
                          aria-label={`Request ${stu.name} to start camera`}
                        >
                          <Video className="w-3 h-3 text-[#06B6D4]" />
                          <span>
                            {stu.cameraRequestStatus === 'pending' ? 'Request sent' : 'Ask Cam'}
                          </span>
                        </button>
                      ) : (
                        <button
                          onClick={() => turnOffStudentCamera(stu.id)}
                          disabled={isDisconnected}
                          className="flex items-center space-x-1 px-2 py-1 rounded text-[10px] font-medium bg-[#FF9100]/15 hover:bg-[#FF9100]/25 text-[#FF9100] border border-[#FF9100]/30 disabled:opacity-40 transition-colors"
                          title={
                            isDisconnected ? 'Participant is disconnected' : `Turn off ${stu.name} camera`
                          }
                          aria-label={`Turn off ${stu.name} camera`}
                        >
                          <VideoOff className="w-3 h-3" />
                          <span>Stop Cam</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-[#282A36] bg-[#0B0C0E] text-[11px] text-[#71717A] flex items-center justify-between">
        <span>No attendance tracking enabled</span>
        <span className="font-mono text-[#A1A1AA]">Local Roster (Phase 0)</span>
      </div>
    </aside>
  );
};
