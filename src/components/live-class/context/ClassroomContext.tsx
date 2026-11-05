import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import {
  ClassroomModule,
  UserRole,
  ConnectionStatus,
  DeviceState,
  Participant,
  ClassroomSession,
  MediaDeviceOption,
  StudentMediaRequest,
} from '@/types/classroom';
import { WebSocketClient } from '@/services/realtime/WebSocketClient';
import { useClassroomFullscreen } from '@/lib/classroom/useClassroomFullscreen';

export const formatInitials = (fullName: string): string => {
  const cleaned = fullName.replace(/^(prof\.|dr\.|mr\.|ms\.|mrs\.)\s+/i, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'CL';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export type LiveClassAuthStatus =
  | 'idle'
  | 'loading'
  | 'authenticated'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'error';

export interface ClassroomProviderProps {
  children: React.ReactNode;
  classroomId?: string;
  sessionId?: string;
  initialRole?: UserRole;
}

interface ClassroomContextValue {
  session: ClassroomSession;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  activeModule: ClassroomModule;
  setActiveModule: (module: ClassroomModule) => void;
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;
  deviceState: DeviceState;
  toggleMicrophone: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => void;
  toggleHandRaise: () => void;
  setAudioDevice: (deviceId: string) => void;
  setVideoDevice: (deviceId: string) => void;
  setAudioOutputDevice: (deviceId: string) => void;
  participants: Participant[];
  muteAllStudents: () => void;
  lowerAllHands: () => void;
  currentUserId: string;
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  isParticipantsOpen: boolean;
  setIsParticipantsOpen: (open: boolean) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  toastMessage: string | null;
  showToast: (msg: string) => void;

  authStatus: LiveClassAuthStatus;
  authErrorMessage: string | null;
  liveSessionToken: string | null;
  remoteStreams: Map<string, MediaStream>;
  isAuthoritativeTeacher: boolean;
  currentUserName: string;
  currentUserEmail: string;

  // Real Web Media API Streams and Devices
  localVideoStream: MediaStream | null;
  localAudioStream: MediaStream | null;
  screenShareStream: MediaStream | null;
  availableAudioInputs: MediaDeviceOption[];
  availableVideoInputs: MediaDeviceOption[];
  availableAudioOutputs: MediaDeviceOption[];
  refreshDevices: () => Promise<void>;
  startCamera: () => Promise<boolean>;
  stopCamera: () => void;
  startMicrophone: () => Promise<boolean>;
  stopMicrophone: () => void;
  startScreenShare: () => Promise<boolean>;
  stopScreenShare: () => void;

  // Teacher AV Moderation & Permissions Controls
  muteStudent: (studentId: string) => void;
  requestStudentUnmute: (studentId: string) => void;
  turnOffStudentCamera: (studentId: string) => void;
  requestStudentCamera: (studentId: string) => void;
  turnOffAllStudentCameras: () => void;
  toggleStudentMicrophoneLock: () => void;
  toggleStudentCameraLock: () => void;
  pendingMediaRequest: StudentMediaRequest | null;
  respondToMediaRequest: (type: 'unmute' | 'camera', accept: boolean) => Promise<void>;

  // Step 1: WebSocket Realtime Signaling Foundation
  signalingClient: WebSocketClient | null;
  lastNetworkEvent: {
    eventName: string;
    payload?: any;
    timestamp: number;
    senderId?: string;
  } | null;
  sendNetworkTestEvent: (eventName: string, data?: unknown) => void;

  // Immersive Classroom & Browser Fullscreen Controls
  isImmersive: boolean;
  isFullscreen: boolean;
  toggleFullscreen: () => Promise<void>;
  requestFullscreen: () => Promise<boolean>;
  exitFullscreen: () => Promise<void>;
}

const defaultSession: ClassroomSession = {
  id: 'CLS_CS201_LIVE',
  title: 'CS 201: Data Structures and Algorithmic Analysis',
  courseCode: 'CS-201',
  teacher: {
    id: 'usr_prof_shivam',
    name: 'Prof. Shivam Patil',
    email: 'shivam.patil@cortex.edu',
  },
  startedAt: Date.now() - 25 * 60 * 1000,
  permissions: {
    allowStudentMicrophone: true,
    allowStudentCamera: true,
    allowStudentScreenShare: false,
    allowStudentChat: true,
    allowIndependentMode: true,
  },
};

const initialParticipants: Participant[] = [
  {
    id: 'usr_prof_shivam',
    name: 'Prof. Shivam Patil',
    email: 'shivam.patil@cortex.edu',
    role: 'teacher',
    isMuted: false,
    isVideoOff: false,
    isScreenSharing: false,
    isHandRaised: false,
    currentModule: 'code',
  },
  {
    id: 'usr_student_alex',
    name: 'Alex Chen',
    email: 'alex.chen@student.cortex.edu',
    role: 'student',
    isMuted: true,
    isVideoOff: false,
    isScreenSharing: false,
    isHandRaised: false,
    currentModule: 'code',
    isSimulated: true,
  },
  {
    id: 'usr_student_sophia',
    name: 'Sophia Patel',
    email: 'sophia.patel@student.cortex.edu',
    role: 'student',
    isMuted: true,
    isVideoOff: false,
    isScreenSharing: false,
    isHandRaised: true,
    currentModule: 'code',
    isSimulated: true,
  },
  {
    id: 'usr_student_marcus',
    name: 'Marcus Vance',
    email: 'marcus.vance@student.cortex.edu',
    role: 'student',
    isMuted: true,
    isVideoOff: true,
    isScreenSharing: false,
    isHandRaised: false,
    currentModule: 'code',
    isSimulated: true,
  },
  {
    id: 'usr_student_elena',
    name: 'Elena Rostova',
    email: 'elena.rostova@student.cortex.edu',
    role: 'student',
    isMuted: false,
    isVideoOff: false,
    isScreenSharing: false,
    isHandRaised: false,
    currentModule: 'code',
    isSimulated: true,
  },
];

const ClassroomContext = createContext<ClassroomContextValue | null>(null);

const getInitialParam = (key: string, fallback: string): string => {
  if (typeof window !== 'undefined' && window.location) {
    const params = new URLSearchParams(window.location.search);
    return params.get(key) || fallback;
  }
  return fallback;
};

export const ClassroomProvider: React.FC<ClassroomProviderProps> = ({
  children,
  classroomId,
  sessionId,
  initialRole,
}) => {
  const [session, setSession] = useState<ClassroomSession>(defaultSession);
  const [userRole, setUserRoleState] = useState<UserRole>(() => 
    (getInitialParam('role', 'teacher') as UserRole)
  );
  const [activeModule, setActiveModuleState] = useState<ClassroomModule>(() => 
    (getInitialParam('surface', 'code') as ClassroomModule)
  );
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connected');
  const [pendingMediaRequest, setPendingMediaRequest] = useState<StudentMediaRequest | null>(null);

  // Immersive Classroom Mode & Browser Fullscreen Lifecycle
  const {
    isImmersive,
    isFullscreen,
    toggleFullscreen,
    requestFullscreen,
    exitFullscreen,
  } = useClassroomFullscreen({ roomId: classroomId, autoImmersive: true });

  const setActiveModule = useCallback((mod: ClassroomModule) => {
    setActiveModuleState(mod);
    if (typeof window !== 'undefined' && window.history) {
      const url = new URL(window.location.href);
      url.searchParams.set('surface', mod);
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const setUserRole = useCallback((role: UserRole) => {
    setUserRoleState(role);
    if (typeof window !== 'undefined' && window.history) {
      const url = new URL(window.location.href);
      url.searchParams.set('role', role);
      window.history.replaceState({}, '', url.toString());
    }
  }, []);
  
  const [deviceState, setDeviceState] = useState<DeviceState>({
    audioDeviceId: 'default',
    videoDeviceId: 'default',
    isMuted: true,
    isVideoOff: true,
    isScreenSharing: false,
    isHandRaised: false,
    audioLevel: 0,
    isCameraLoading: false,
    isMicrophoneLoading: false,
    isScreenSharingLoading: false,
    cameraError: null,
    microphoneError: null,
    screenShareError: null,
    permissionStatus: {
      microphone: 'prompt',
      camera: 'prompt',
      screen: 'prompt',
    },
  });

  const [localVideoStream, setLocalVideoStream] = useState<MediaStream | null>(null);
  const [localAudioStream, setLocalAudioStream] = useState<MediaStream | null>(null);
  const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null);

  const localVideoStreamRef = useRef<MediaStream | null>(null);
  const localAudioStreamRef = useRef<MediaStream | null>(null);
  const screenShareStreamRef = useRef<MediaStream | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const analyserLoopIdRef = useRef<any>(null);
  const deviceStateRef = useRef(deviceState);
  deviceStateRef.current = deviceState;

  const [availableAudioInputs, setAvailableAudioInputs] = useState<MediaDeviceOption[]>([
    { deviceId: 'default', label: 'Default Microphone' },
  ]);
  const [availableVideoInputs, setAvailableVideoInputs] = useState<MediaDeviceOption[]>([
    { deviceId: 'default', label: 'Default Camera' },
  ]);
  const [availableAudioOutputs, setAvailableAudioOutputs] = useState<MediaDeviceOption[]>([
    { deviceId: 'default', label: 'Default Speakers' },
  ]);

  const [authStatus, setAuthStatus] = useState<LiveClassAuthStatus>(() => (classroomId ? 'loading' : 'authenticated'));
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);
  const [liveSessionToken, setLiveSessionToken] = useState<string | null>(null);
  const [isAuthoritativeTeacher, setIsAuthoritativeTeacher] = useState<boolean>(() => (initialRole === 'teacher'));
  const [currentUserIdState, setCurrentUserIdState] = useState<string>('');
  const [currentUserNameState, setCurrentUserNameState] = useState<string>('');
  const [currentUserEmailState, setCurrentUserEmailState] = useState<string>('');
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());

  const [participants, setParticipants] = useState<Participant[]>(initialParticipants);
  const currentUserId = currentUserIdState || (userRole === 'teacher' ? 'usr_prof_shivam' : 'usr_student_alex');
  const currentUserName = currentUserNameState || (userRole === 'teacher' ? session.teacher.name : 'Alex Chen');
  const currentUserEmail = currentUserEmailState || (userRole === 'teacher' ? session.teacher.email : 'alex.chen@student.cortex.edu');

  // WebRTC ICE Configuration (STUN / TURN)
  const defaultIceServers: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];
  const iceServersRef = useRef<RTCIceServer[]>(defaultIceServers);

  // WebRTC Peer Connection registry
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  // WebRTC helper: get or create RTCPeerConnection for a remote peer
  const getOrCreatePeerConnection = useCallback((peerId: string) => {
    let pc = peerConnectionsRef.current.get(peerId);
    if (!pc || pc.signalingState === 'closed') {
      pc = new RTCPeerConnection({
        iceServers: iceServersRef.current,
      });

      if (localAudioStreamRef.current) {
        localAudioStreamRef.current.getAudioTracks().forEach((track) => {
          try { pc!.addTrack(track, localAudioStreamRef.current!); } catch (_) {}
        });
      }
      if (localVideoStreamRef.current) {
        localVideoStreamRef.current.getVideoTracks().forEach((track) => {
          try { pc!.addTrack(track, localVideoStreamRef.current!); } catch (_) {}
        });
      }
      if (screenShareStreamRef.current) {
        screenShareStreamRef.current.getVideoTracks().forEach((track) => {
          try { pc!.addTrack(track, screenShareStreamRef.current!); } catch (_) {}
        });
      }

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (remoteStream) {
          setRemoteStreams((prev) => {
            const copy = new Map(prev);
            copy.set(peerId, remoteStream);
            return copy;
          });
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && signalingClientRef.current) {
          signalingClientRef.current.emitClassroomEvent('WEBRTC_ICE_CANDIDATE', {
            targetUserId: peerId,
            candidate: event.candidate,
            senderId: currentUserId,
          });
        }
      };

      peerConnectionsRef.current.set(peerId, pc);
    }
    return pc;
  }, [currentUserId]);

  const initiatePeerOffer = useCallback(async (peerId: string) => {
    try {
      const pc = getOrCreatePeerConnection(peerId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (signalingClientRef.current) {
        signalingClientRef.current.emitClassroomEvent('WEBRTC_OFFER', {
          targetUserId: peerId,
          sdp: offer.sdp,
          type: offer.type,
          senderId: currentUserId,
        });
      }
    } catch (e) {
      console.warn('[WebRTC] Error initiating offer to', peerId, e);
    }
  }, [getOrCreatePeerConnection, currentUserId]);

  // Session Authentication Effect
  useEffect(() => {
    if (!classroomId) return;
    let isMounted = true;
    setAuthStatus('loading');
    setAuthErrorMessage(null);

    fetch(`/api/v1/classrooms/${classroomId}/live/session`)
      .then(async (res) => {
        if (!isMounted) return;
        if (res.status === 401) {
          setAuthStatus('unauthorized');
          setAuthErrorMessage('Authentication required. Please log in to join this live classroom.');
          return;
        }
        if (res.status === 403) {
          const errData = await res.json().catch(() => ({}));
          setAuthStatus('forbidden');
          setAuthErrorMessage(errData.error || errData.message || 'Access denied to this live classroom.');
          return;
        }
        if (res.status === 404) {
          setAuthStatus('not_found');
          setAuthErrorMessage('Live classroom not found.');
          return;
        }
        if (!res.ok) {
          setAuthStatus('error');
          setAuthErrorMessage(`Failed to authenticate live session (${res.status}).`);
          return;
        }

        const data = await res.json();
        if (!isMounted) return;

        setSession(data.session);
        setUserRoleState(data.role);
        setIsAuthoritativeTeacher(data.role === 'teacher');
        setCurrentUserIdState(data.user.id);
        setCurrentUserNameState(data.user.name);
        setCurrentUserEmailState(data.user.email);
        setLiveSessionToken(data.liveSessionToken);
        if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
          iceServersRef.current = data.iceServers;
          console.log('[WebRTC] Loaded ICE servers: mode=' + (data.iceMode || 'stun-only') + ', turnConfigured=' + Boolean(data.isTurnConfigured));
        } else {
          console.log('[WebRTC] Development Mode: Running with STUN-only configuration (TURN relay not configured).');
        }
        setAuthStatus('authenticated');

        // Fetch classroom details for participant roster
        fetch(`/api/v1/classrooms/${classroomId}`)
          .then((r) => r.json())
          .then((cData) => {
            if (!isMounted) return;
            const members = cData?.classroom?.members || cData?.members || [];
            if (Array.isArray(members) && members.length > 0) {
              const mapped: Participant[] = members.map((m: any) => ({
                id: m.userId || m.id,
                name: m.userName || m.name || 'Participant',
                email: m.email || '',
                role: (m.role === 'teacher' || m.role === 'admin' ? 'teacher' : 'student') as UserRole,
                isMuted: true,
                isVideoOff: true,
                isScreenSharing: false,
                isHandRaised: false,
                currentModule: 'code',
                connectionStatus: m.isOnline ? 'connected' : 'disconnected',
              }));
              const hasSelf = mapped.some((p) => p.id === data.user.id);
              if (!hasSelf) {
                mapped.push({
                  id: data.user.id,
                  name: data.user.name,
                  email: data.user.email,
                  role: data.role,
                  isMuted: true,
                  isVideoOff: true,
                  isScreenSharing: false,
                  isHandRaised: false,
                  currentModule: 'code',
                  connectionStatus: 'connected',
                });
              }
              setParticipants(mapped);
            } else {
              setParticipants([
                {
                  id: data.user.id,
                  name: data.user.name,
                  email: data.user.email,
                  role: data.role,
                  isMuted: true,
                  isVideoOff: true,
                  isScreenSharing: false,
                  isHandRaised: false,
                  currentModule: 'code',
                  connectionStatus: 'connected',
                },
              ]);
            }
          })
          .catch(() => {});
      })
      .catch((err) => {
        if (!isMounted) return;
        setAuthStatus('error');
        setAuthErrorMessage(err.message || 'Network error connecting to live session service.');
      });

    return () => {
      isMounted = false;
    };
  }, [classroomId]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Step 1: WebSocket Realtime Signaling State
  const [signalingClient, setSignalingClient] = useState<WebSocketClient | null>(null);
  const signalingClientRef = useRef<WebSocketClient | null>(null);
  const [lastNetworkEvent, setLastNetworkEvent] = useState<{
    eventName: string;
    payload?: any;
    timestamp: number;
    senderId?: string;
  } | null>(null);

  const sendNetworkTestEvent = useCallback((eventName: string, data?: unknown) => {
    if (signalingClientRef.current) {
      signalingClientRef.current.emitClassroomEvent(eventName, data);
    }
    setLastNetworkEvent({
      eventName,
      payload: data,
      timestamp: Date.now(),
      senderId: currentUserId,
    });
  }, [currentUserId]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 4000);
  }, []);

  const muteAllStudents = useCallback(() => {
    setParticipants((prev) =>
      prev.map((p) =>
        p.role === 'student' ? { ...p, isMuted: true, unmuteRequestStatus: 'idle' } : p
      )
    );

    if (userRole === 'student') {
      if (localAudioStreamRef.current) {
        localAudioStreamRef.current.getAudioTracks().forEach((t) => {
          t.enabled = false;
          t.stop();
        });
        localAudioStreamRef.current = null;
        setLocalAudioStream(null);
      }
      setDeviceState((prev) => ({ ...prev, isMuted: true, audioLevel: 0 }));
    }

    try {
      const ch = new BroadcastChannel('cortex_classroom_control');
      ch.postMessage({ type: 'TEACHER_MUTE_ALL' });
      ch.close();
    } catch (_) {}

    try {
      signalingClientRef.current?.emitClassroomEvent('TEACHER_MUTE_ALL', {}, true);
    } catch (_) {}

    showToast('All student microphones muted');
  }, [userRole, showToast]);

  const turnOffAllStudentCameras = useCallback(() => {
    setParticipants((prev) =>
      prev.map((p) =>
        p.role === 'student' ? { ...p, isVideoOff: true, cameraRequestStatus: 'idle' } : p
      )
    );

    if (userRole === 'student') {
      if (localVideoStreamRef.current) {
        localVideoStreamRef.current.getTracks().forEach((t) => t.stop());
        localVideoStreamRef.current = null;
        setLocalVideoStream(null);
      }
      setDeviceState((prev) => ({ ...prev, isVideoOff: true }));
    }

    try {
      const ch = new BroadcastChannel('cortex_classroom_control');
      ch.postMessage({ type: 'TEACHER_STOP_ALL_CAMERAS' });
      ch.close();
    } catch (_) {}

    try {
      signalingClientRef.current?.emitClassroomEvent('TEACHER_STOP_ALL_CAMERAS', {}, true);
    } catch (_) {}

    showToast('All student cameras turned off');
  }, [userRole, showToast]);

  const muteStudent = useCallback(
    (studentId: string) => {
      const target = participants.find((p) => p.id === studentId);
      if (!target) return;
      if (target.connectionStatus === 'disconnected') {
        showToast(`Cannot modify disconnected participant: ${target.name}`);
        return;
      }

      setParticipants((prev) =>
        prev.map((p) =>
          p.id === studentId ? { ...p, isMuted: true, unmuteRequestStatus: 'idle' } : p
        )
      );

      if (studentId === currentUserId) {
        if (localAudioStreamRef.current) {
          localAudioStreamRef.current.getAudioTracks().forEach((t) => {
            t.enabled = false;
            t.stop();
          });
          localAudioStreamRef.current = null;
          setLocalAudioStream(null);
        }
        setDeviceState((prev) => ({ ...prev, isMuted: true, audioLevel: 0 }));
      }

      try {
        const ch = new BroadcastChannel('cortex_classroom_control');
        ch.postMessage({ type: 'TEACHER_MUTE_STUDENT', payload: { targetStudentId: studentId } });
        ch.close();
      } catch (_) {}

      try {
        signalingClientRef.current?.emitClassroomEvent(
          'TEACHER_MUTE_STUDENT',
          { targetStudentId: studentId },
          true
        );
      } catch (_) {}

      showToast(`Muted ${target.name}'s microphone`);
    },
    [participants, currentUserId, showToast]
  );

  const turnOffStudentCamera = useCallback(
    (studentId: string) => {
      const target = participants.find((p) => p.id === studentId);
      if (!target) return;
      if (target.connectionStatus === 'disconnected') {
        showToast(`Cannot modify disconnected participant: ${target.name}`);
        return;
      }

      setParticipants((prev) =>
        prev.map((p) =>
          p.id === studentId ? { ...p, isVideoOff: true, cameraRequestStatus: 'idle' } : p
        )
      );

      if (studentId === currentUserId) {
        if (localVideoStreamRef.current) {
          localVideoStreamRef.current.getTracks().forEach((t) => t.stop());
          localVideoStreamRef.current = null;
          setLocalVideoStream(null);
        }
        setDeviceState((prev) => ({ ...prev, isVideoOff: true }));
      }

      try {
        const ch = new BroadcastChannel('cortex_classroom_control');
        ch.postMessage({ type: 'TEACHER_STOP_CAMERA', payload: { targetStudentId: studentId } });
        ch.close();
      } catch (_) {}

      try {
        signalingClientRef.current?.emitClassroomEvent(
          'TEACHER_STOP_CAMERA',
          { targetStudentId: studentId },
          true
        );
      } catch (_) {}

      showToast(`Turned off ${target.name}'s camera`);
    },
    [participants, currentUserId, showToast]
  );

  const requestStudentUnmute = useCallback(
    (studentId: string) => {
      const target = participants.find((p) => p.id === studentId);
      if (!target) return;
      if (target.connectionStatus === 'disconnected') {
        showToast(`Cannot send request to disconnected participant: ${target.name}`);
        return;
      }
      if (!session.permissions.allowStudentMicrophone) {
        showToast('Cannot request unmute while student microphones are locked');
        return;
      }

      setParticipants((prev) =>
        prev.map((p) => (p.id === studentId ? { ...p, unmuteRequestStatus: 'pending' } : p))
      );

      if (studentId === currentUserId) {
        setPendingMediaRequest({
          type: 'unmute',
          targetStudentId: studentId,
          targetStudentName: target.name,
          status: 'pending',
          timestamp: Date.now(),
        });
      }

      try {
        const ch = new BroadcastChannel('cortex_classroom_control');
        ch.postMessage({ type: 'TEACHER_REQUEST_UNMUTE', payload: { targetStudentId: studentId } });
        ch.close();
      } catch (_) {}

      try {
        signalingClientRef.current?.emitClassroomEvent(
          'TEACHER_REQUEST_UNMUTE',
          { targetStudentId: studentId },
          true
        );
      } catch (_) {}

      showToast(`Requested ${target.name} to unmute microphone`);

      if (target.isSimulated) {
        setTimeout(() => {
          setParticipants((prev) =>
            prev.map((p) =>
              p.id === studentId ? { ...p, isMuted: false, unmuteRequestStatus: 'accepted' } : p
            )
          );
          showToast(`${target.name} accepted unmute request`);
        }, 1800);
      }
    },
    [participants, currentUserId, session.permissions.allowStudentMicrophone, showToast]
  );

  const requestStudentCamera = useCallback(
    (studentId: string) => {
      const target = participants.find((p) => p.id === studentId);
      if (!target) return;
      if (target.connectionStatus === 'disconnected') {
        showToast(`Cannot send request to disconnected participant: ${target.name}`);
        return;
      }
      if (!session.permissions.allowStudentCamera) {
        showToast('Cannot request camera while student cameras are locked');
        return;
      }

      setParticipants((prev) =>
        prev.map((p) => (p.id === studentId ? { ...p, cameraRequestStatus: 'pending' } : p))
      );

      if (studentId === currentUserId) {
        setPendingMediaRequest({
          type: 'camera',
          targetStudentId: studentId,
          targetStudentName: target.name,
          status: 'pending',
          timestamp: Date.now(),
        });
      }

      try {
        const ch = new BroadcastChannel('cortex_classroom_control');
        ch.postMessage({ type: 'TEACHER_REQUEST_CAMERA', payload: { targetStudentId: studentId } });
        ch.close();
      } catch (_) {}

      try {
        signalingClientRef.current?.emitClassroomEvent(
          'TEACHER_REQUEST_CAMERA',
          { targetStudentId: studentId },
          true
        );
      } catch (_) {}

      showToast(`Requested ${target.name} to turn on camera`);

      if (target.isSimulated) {
        setTimeout(() => {
          setParticipants((prev) =>
            prev.map((p) =>
              p.id === studentId ? { ...p, isVideoOff: false, cameraRequestStatus: 'accepted' } : p
            )
          );
          showToast(`${target.name} accepted camera request`);
        }, 1800);
      }
    },
    [participants, currentUserId, session.permissions.allowStudentCamera, showToast]
  );

  const toggleStudentMicrophoneLock = useCallback(() => {
    setSession((prev) => {
      const nextAllowed = !prev.permissions.allowStudentMicrophone;
      if (!nextAllowed) {
        muteAllStudents();
        showToast('Student microphones locked');
      } else {
        showToast('Student microphones unlocked');
      }

      try {
        const ch = new BroadcastChannel('cortex_classroom_control');
        ch.postMessage({
          type: 'PERMISSIONS_UPDATED',
          payload: { allowStudentMicrophone: nextAllowed },
        });
        ch.close();
      } catch (_) {}

      try {
        signalingClientRef.current?.emitClassroomEvent(
          'PERMISSIONS_UPDATED',
          { allowStudentMicrophone: nextAllowed },
          true
        );
      } catch (_) {}

      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          allowStudentMicrophone: nextAllowed,
        },
      };
    });
  }, [muteAllStudents, showToast]);

  const toggleStudentCameraLock = useCallback(() => {
    setSession((prev) => {
      const nextAllowed = !prev.permissions.allowStudentCamera;
      if (!nextAllowed) {
        turnOffAllStudentCameras();
        showToast('Student cameras locked');
      } else {
        showToast('Student cameras unlocked');
      }

      try {
        const ch = new BroadcastChannel('cortex_classroom_control');
        ch.postMessage({
          type: 'PERMISSIONS_UPDATED',
          payload: { allowStudentCamera: nextAllowed },
        });
        ch.close();
      } catch (_) {}

      try {
        signalingClientRef.current?.emitClassroomEvent(
          'PERMISSIONS_UPDATED',
          { allowStudentCamera: nextAllowed },
          true
        );
      } catch (_) {}

      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          allowStudentCamera: nextAllowed,
        },
      };
    });
  }, [turnOffAllStudentCameras, showToast]);

  const lowerAllHands = useCallback(() => {
    setParticipants((prev) =>
      prev.map((p) => ({ ...p, isHandRaised: false }))
    );
    showToast('All student hands lowered');
  }, [showToast]);

  const [isChatOpen, setIsChatOpen] = useState(() => 
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('drawer') === 'chat'
  );
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(() => 
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('drawer') === 'participants'
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(() => 
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('modal') === 'settings'
  );

  // Web Audio API RMS meter setup
  const setupAudioAnalyser = useCallback((stream: MediaStream) => {
    try {
      const AudioCtx =
        typeof window !== 'undefined'
          ? window.AudioContext || (window as any).webkitAudioContext
          : null;
      if (!AudioCtx) return;

      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkAudio = () => {
        if (!analyserRef.current) return;
        if (deviceStateRef.current.isMuted) {
          setDeviceState((prev) => (prev.audioLevel === 0 ? prev : { ...prev, audioLevel: 0 }));
          analyserLoopIdRef.current = requestAnimationFrame(checkAudio);
          return;
        }

        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const calculatedLevel = Math.min(100, Math.round((avg / 120) * 100));
        setDeviceState((prev) =>
          prev.audioLevel === calculatedLevel ? prev : { ...prev, audioLevel: calculatedLevel }
        );
        analyserLoopIdRef.current = requestAnimationFrame(checkAudio);
      };

      if (analyserLoopIdRef.current) {
        cancelAnimationFrame(analyserLoopIdRef.current);
      }
      analyserLoopIdRef.current = requestAnimationFrame(checkAudio);
    } catch (err) {
      console.warn('Web Audio API analyser initialization error:', err);
    }
  }, []);

  // Enumerate Media Devices
  const refreshDevices = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioIn: MediaDeviceOption[] = [];
      const videoIn: MediaDeviceOption[] = [];
      const audioOut: MediaDeviceOption[] = [];

      devices.forEach((d) => {
        const option: MediaDeviceOption = {
          deviceId: d.deviceId,
          label:
            d.label ||
            (d.kind === 'videoinput'
              ? `Camera (${videoIn.length + 1})`
              : d.kind === 'audioinput'
              ? `Microphone (${audioIn.length + 1})`
              : `Speaker (${audioOut.length + 1})`),
          kind: d.kind,
          groupId: d.groupId,
        };
        if (d.kind === 'audioinput') audioIn.push(option);
        else if (d.kind === 'videoinput') videoIn.push(option);
        else if (d.kind === 'audiooutput') audioOut.push(option);
      });

      if (audioIn.length > 0) setAvailableAudioInputs(audioIn);
      if (videoIn.length > 0) setAvailableVideoInputs(videoIn);
      if (audioOut.length > 0) setAvailableAudioOutputs(audioOut);
    } catch (err) {
      console.warn('Failed to enumerate media devices:', err);
    }
  }, []);

  // Camera Management
  const startCamera = useCallback(async (): Promise<boolean> => {
    if (userRole === 'student' && !session.permissions.allowStudentCamera) {
      const msg = 'Student cameras are locked by the instructor';
      setDeviceState((prev) => ({
        ...prev,
        isVideoOff: true,
        isCameraLoading: false,
        cameraError: msg,
      }));
      showToast(msg);
      return false;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setDeviceState((prev) => ({
        ...prev,
        isVideoOff: true,
        cameraError: 'Camera API not supported in this environment',
      }));
      showToast('Camera API not supported in this environment');
      return false;
    }

    setDeviceState((prev) => ({ ...prev, isCameraLoading: true, cameraError: null }));

    try {
      if (localVideoStreamRef.current) {
        localVideoStreamRef.current.getTracks().forEach((t) => t.stop());
        localVideoStreamRef.current = null;
        setLocalVideoStream(null);
      }

      const constraints: MediaStreamConstraints = {
        video:
          deviceState.videoDeviceId && deviceState.videoDeviceId !== 'default'
            ? { deviceId: { exact: deviceState.videoDeviceId } }
            : true,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localVideoStreamRef.current = stream;
      setLocalVideoStream(stream);
      setDeviceState((prev) => ({
        ...prev,
        isVideoOff: false,
        isCameraLoading: false,
        cameraError: null,
      }));
      showToast('Camera turned on');
      refreshDevices();
      return true;
    } catch (err: any) {
      let msg = 'Failed to access camera';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission denied by user or system';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera device detected';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'Camera is currently in use by another application';
      }
      setDeviceState((prev) => ({
        ...prev,
        isVideoOff: true,
        isCameraLoading: false,
        cameraError: msg,
      }));
      showToast(msg);
      return false;
    }
  }, [userRole, session.permissions.allowStudentCamera, deviceState.videoDeviceId, showToast, refreshDevices]);

  const stopCamera = useCallback(() => {
    if (localVideoStreamRef.current) {
      const stream = localVideoStreamRef.current;
      localVideoStreamRef.current = null;
      stream.getTracks().forEach((t) => {
        t.onended = null;
        t.stop();
      });
    }
    setLocalVideoStream(null);
    setDeviceState((prev) => ({ ...prev, isVideoOff: true, isCameraLoading: false }));
    showToast('Camera turned off');
  }, [showToast]);

  const toggleCamera = useCallback(() => {
    if (deviceState.isVideoOff) {
      if (userRole === 'student' && !session.permissions.allowStudentCamera) {
        showToast('Student cameras are locked by the instructor');
        return;
      }
      startCamera();
    } else {
      stopCamera();
    }
  }, [deviceState.isVideoOff, userRole, session.permissions.allowStudentCamera, startCamera, stopCamera, showToast]);

  // Microphone Management
  const startMicrophone = useCallback(async (): Promise<boolean> => {
    if (userRole === 'student' && !session.permissions.allowStudentMicrophone) {
      const msg = 'Student microphones are locked by the instructor';
      setDeviceState((prev) => ({
        ...prev,
        isMuted: true,
        isMicrophoneLoading: false,
        microphoneError: msg,
        audioLevel: 0,
      }));
      showToast(msg);
      return false;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setDeviceState((prev) => ({
        ...prev,
        isMuted: true,
        microphoneError: 'Microphone API not supported in this environment',
      }));
      showToast('Microphone API not supported in this environment');
      return false;
    }

    setDeviceState((prev) => ({ ...prev, isMicrophoneLoading: true, microphoneError: null }));

    try {
      if (localAudioStreamRef.current) {
        localAudioStreamRef.current.getTracks().forEach((t) => t.stop());
        localAudioStreamRef.current = null;
        setLocalAudioStream(null);
      }

      const constraints: MediaStreamConstraints = {
        audio:
          deviceState.audioDeviceId && deviceState.audioDeviceId !== 'default'
            ? {
                deviceId: { exact: deviceState.audioDeviceId },
                echoCancellation: true,
                noiseSuppression: true,
              }
            : { echoCancellation: true, noiseSuppression: true },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localAudioStreamRef.current = stream;
      setLocalAudioStream(stream);

      setupAudioAnalyser(stream);

      setDeviceState((prev) => ({
        ...prev,
        isMuted: false,
        isMicrophoneLoading: false,
        microphoneError: null,
      }));
      showToast('Microphone unmuted');
      refreshDevices();
      return true;
    } catch (err: any) {
      let msg = 'Failed to access microphone';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Microphone permission denied by user or system';
      } else if (err.name === 'NotFoundError') {
        msg = 'No microphone device detected';
      } else if (err.name === 'NotReadableError') {
        msg = 'Microphone is currently in use by another application';
      }
      setDeviceState((prev) => ({
        ...prev,
        isMuted: true,
        isMicrophoneLoading: false,
        microphoneError: msg,
        audioLevel: 0,
      }));
      showToast(msg);
      return false;
    }
  }, [userRole, session.permissions.allowStudentMicrophone, deviceState.audioDeviceId, showToast, refreshDevices, setupAudioAnalyser]);

  const stopMicrophone = useCallback(() => {
    if (localAudioStreamRef.current) {
      const stream = localAudioStreamRef.current;
      localAudioStreamRef.current = null;
      stream.getTracks().forEach((t) => {
        t.onended = null;
        t.stop();
      });
    }
    setLocalAudioStream(null);
    setDeviceState((prev) => ({ ...prev, isMuted: true, isMicrophoneLoading: false, audioLevel: 0 }));
    showToast('Microphone muted');
  }, [showToast]);

  const toggleMicrophone = useCallback(() => {
    if (deviceState.isMuted) {
      if (userRole === 'student' && !session.permissions.allowStudentMicrophone) {
        showToast('Student microphones are locked by the instructor');
        return;
      }
      if (!localAudioStreamRef.current) {
        startMicrophone();
      } else {
        setDeviceState((prev) => {
          if (localAudioStreamRef.current) {
            localAudioStreamRef.current.getAudioTracks().forEach((t) => {
              t.enabled = true;
            });
          }
          showToast('Microphone unmuted');
          return { ...prev, isMuted: false };
        });
      }
    } else {
      setDeviceState((prev) => {
        if (localAudioStreamRef.current) {
          localAudioStreamRef.current.getAudioTracks().forEach((t) => {
            t.enabled = false;
          });
        }
        showToast('Microphone muted');
        return { ...prev, isMuted: true, audioLevel: 0 };
      });
    }
  }, [deviceState.isMuted, userRole, session.permissions.allowStudentMicrophone, startMicrophone, showToast]);

  // Screen Sharing Management
  const stopScreenShare = useCallback(() => {
    if (screenShareStreamRef.current) {
      const stream = screenShareStreamRef.current;
      screenShareStreamRef.current = null;
      stream.getTracks().forEach((t) => {
        t.onended = null;
        t.stop();
      });
    }
    setScreenShareStream(null);
    setDeviceState((prev) => ({ ...prev, isScreenSharing: false, isScreenSharingLoading: false }));
    showToast('Screen sharing stopped');
  }, [showToast]);

  const startScreenShare = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      setDeviceState((prev) => ({
        ...prev,
        isScreenSharing: false,
        screenShareError: 'Screen sharing not supported in this browser',
      }));
      showToast('Screen sharing not supported in this browser');
      return false;
    }

    setDeviceState((prev) => ({ ...prev, isScreenSharingLoading: true, screenShareError: null }));

    try {
      if (screenShareStreamRef.current) {
        screenShareStreamRef.current.getTracks().forEach((t) => t.stop());
        screenShareStreamRef.current = null;
        setScreenShareStream(null);
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      screenShareStreamRef.current = stream;
      setScreenShareStream(stream);

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopScreenShare();
        };
      }

      setDeviceState((prev) => ({
        ...prev,
        isScreenSharing: true,
        isScreenSharingLoading: false,
        screenShareError: null,
      }));
      showToast('Screen sharing active');
      return true;
    } catch (err: any) {
      let msg = 'Screen sharing cancelled';
      if (err.name === 'NotAllowedError') {
        msg = 'Screen share permission cancelled or denied';
      } else if (err.name !== 'AbortError') {
        msg = `Screen share error: ${err.message || String(err)}`;
      }
      setDeviceState((prev) => ({
        ...prev,
        isScreenSharing: false,
        isScreenSharingLoading: false,
        screenShareError: msg,
      }));
      showToast(msg);
      return false;
    }
  }, [showToast, stopScreenShare]);

  const toggleScreenShare = useCallback(() => {
    if (deviceState.isScreenSharing) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  }, [deviceState.isScreenSharing, startScreenShare, stopScreenShare]);

  const toggleHandRaise = useCallback(() => {
    setDeviceState((prev) => {
      const next = !prev.isHandRaised;
      showToast(next ? 'Hand raised' : 'Hand lowered');
      return { ...prev, isHandRaised: next };
    });
  }, [showToast]);

  const setAudioDevice = useCallback((audioDeviceId: string) => {
    setDeviceState((prev) => ({ ...prev, audioDeviceId }));
    showToast('Audio input device updated');
    // If microphone is active, restart with selected device
    if (localAudioStreamRef.current) {
      startMicrophone();
    }
  }, [showToast, startMicrophone]);

  const setVideoDevice = useCallback((videoDeviceId: string) => {
    setDeviceState((prev) => ({ ...prev, videoDeviceId }));
    showToast('Camera device updated');
    // If camera is active, restart with selected device
    if (localVideoStreamRef.current) {
      startCamera();
    }
  }, [showToast, startCamera]);

  const setAudioOutputDevice = useCallback((audioOutputDeviceId: string) => {
    setDeviceState((prev) => ({ ...prev, audioOutputDeviceId }));
    showToast('Audio output device updated');
  }, [showToast]);

  const respondToMediaRequest = useCallback(
    async (type: 'unmute' | 'camera', accept: boolean) => {
      setPendingMediaRequest(null);
      if (accept) {
        if (type === 'unmute') {
          if (!session.permissions.allowStudentMicrophone) {
            showToast('Microphones are locked by instructor');
            return;
          }
          await startMicrophone();
          setParticipants((prev) =>
            prev.map((p) =>
              p.id === currentUserId
                ? { ...p, isMuted: false, unmuteRequestStatus: 'accepted' }
                : p
            )
          );
          showToast('Microphone unmuted on instructor request');
        } else {
          if (!session.permissions.allowStudentCamera) {
            showToast('Cameras are locked by instructor');
            return;
          }
          await startCamera();
          setParticipants((prev) =>
            prev.map((p) =>
              p.id === currentUserId
                ? { ...p, isVideoOff: false, cameraRequestStatus: 'accepted' }
                : p
            )
          );
          showToast('Camera turned on on instructor request');
        }

        try {
          const ch = new BroadcastChannel('cortex_classroom_control');
          ch.postMessage({
            type: 'MEDIA_REQUEST_RESPONSE',
            payload: { targetStudentId: currentUserId, type, accepted: true },
          });
          ch.close();
        } catch (_) {}

        try {
          signalingClientRef.current?.emitClassroomEvent('MEDIA_REQUEST_RESPONSE', {
            targetStudentId: currentUserId,
            type,
            accepted: true,
          });
        } catch (_) {}
      } else {
        setParticipants((prev) =>
          prev.map((p) =>
            p.id === currentUserId
              ? {
                  ...p,
                  ...(type === 'unmute'
                    ? { unmuteRequestStatus: 'declined' }
                    : { cameraRequestStatus: 'declined' }),
                }
              : p
          )
        );
        showToast(`Declined instructor ${type === 'unmute' ? 'unmute' : 'camera'} request`);

        try {
          const ch = new BroadcastChannel('cortex_classroom_control');
          ch.postMessage({
            type: 'MEDIA_REQUEST_RESPONSE',
            payload: { targetStudentId: currentUserId, type, accepted: false },
          });
          ch.close();
        } catch (_) {}

        try {
          signalingClientRef.current?.emitClassroomEvent('MEDIA_REQUEST_RESPONSE', {
            targetStudentId: currentUserId,
            type,
            accepted: false,
          });
        } catch (_) {}
      }
    },
    [session.permissions, currentUserId, startMicrophone, startCamera, showToast]
  );

  // Multi-tab / cross-client synchronization listener
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('cortex_classroom_control');
      channel.onmessage = (event: MessageEvent<any>) => {
        const msg = event.data;
        if (!msg || typeof msg !== 'object') return;

        if (msg.type === 'TEACHER_MUTE_STUDENT' && msg.payload?.targetStudentId === currentUserId) {
          if (localAudioStreamRef.current) {
            localAudioStreamRef.current.getAudioTracks().forEach((t) => {
              t.enabled = false;
              t.stop();
            });
            localAudioStreamRef.current = null;
            setLocalAudioStream(null);
          }
          setDeviceState((prev) => ({ ...prev, isMuted: true, audioLevel: 0 }));
          showToast('Your microphone was muted by the instructor');
        } else if (
          msg.type === 'TEACHER_STOP_CAMERA' &&
          msg.payload?.targetStudentId === currentUserId
        ) {
          if (localVideoStreamRef.current) {
            localVideoStreamRef.current.getTracks().forEach((t) => t.stop());
            localVideoStreamRef.current = null;
            setLocalVideoStream(null);
          }
          setDeviceState((prev) => ({ ...prev, isVideoOff: true }));
          showToast('Your camera was turned off by the instructor');
        } else if (
          msg.type === 'TEACHER_REQUEST_UNMUTE' &&
          msg.payload?.targetStudentId === currentUserId
        ) {
          setPendingMediaRequest({
            type: 'unmute',
            targetStudentId: currentUserId,
            targetStudentName: 'You',
            status: 'pending',
            timestamp: Date.now(),
          });
        } else if (
          msg.type === 'TEACHER_REQUEST_CAMERA' &&
          msg.payload?.targetStudentId === currentUserId
        ) {
          setPendingMediaRequest({
            type: 'camera',
            targetStudentId: currentUserId,
            targetStudentName: 'You',
            status: 'pending',
            timestamp: Date.now(),
          });
        } else if (msg.type === 'TEACHER_MUTE_ALL' && userRole === 'student') {
          if (localAudioStreamRef.current) {
            localAudioStreamRef.current.getAudioTracks().forEach((t) => {
              t.enabled = false;
              t.stop();
            });
            localAudioStreamRef.current = null;
            setLocalAudioStream(null);
          }
          setDeviceState((prev) => ({ ...prev, isMuted: true, audioLevel: 0 }));
          showToast('All student microphones were muted by the instructor');
        } else if (msg.type === 'TEACHER_STOP_ALL_CAMERAS' && userRole === 'student') {
          if (localVideoStreamRef.current) {
            localVideoStreamRef.current.getTracks().forEach((t) => t.stop());
            localVideoStreamRef.current = null;
            setLocalVideoStream(null);
          }
          setDeviceState((prev) => ({ ...prev, isVideoOff: true }));
          showToast('All student cameras were turned off by the instructor');
        } else if (msg.type === 'PERMISSIONS_UPDATED') {
          if (msg.payload?.allowStudentMicrophone !== undefined) {
            setSession((prev) => ({
              ...prev,
              permissions: {
                ...prev.permissions,
                allowStudentMicrophone: msg.payload.allowStudentMicrophone,
              },
            }));
          }
          if (msg.payload?.allowStudentCamera !== undefined) {
            setSession((prev) => ({
              ...prev,
              permissions: {
                ...prev.permissions,
                allowStudentCamera: msg.payload.allowStudentCamera,
              },
            }));
          }
        } else if (msg.type === 'MEDIA_REQUEST_RESPONSE') {
          const { targetStudentId, type, accepted } = msg.payload || {};
          if (targetStudentId) {
            setParticipants((prev) =>
              prev.map((p) => {
                if (p.id !== targetStudentId) return p;
                if (type === 'unmute') {
                  return {
                    ...p,
                    isMuted: accepted ? false : p.isMuted,
                    unmuteRequestStatus: accepted ? 'accepted' : 'declined',
                  };
                } else {
                  return {
                    ...p,
                    isVideoOff: accepted ? false : p.isVideoOff,
                    cameraRequestStatus: accepted ? 'accepted' : 'declined',
                  };
                }
              })
            );
          }
        }
      };
    } catch (_) {}

    return () => {
      if (channel) channel.close();
    };
  }, [currentUserId, userRole, showToast]);

  // Step 1: Real-time WebSocket Signaling connection & event handling
  useEffect(() => {
    const isTest = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
    const allowConnect = !isTest || (typeof window !== 'undefined' && Boolean((window as any).__ENABLE_TEST_WS__));

    let wsUrl: string | undefined = undefined;
    if (typeof window !== 'undefined' && window.location) {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (!isLocal) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const targetRoom = classroomId || session.id || 'default';
        const tokenQuery = liveSessionToken ? `?token=${encodeURIComponent(liveSessionToken)}` : '';
        wsUrl = `${protocol}//${window.location.host}/api/v1/classrooms/${targetRoom}/ws${tokenQuery}`;
      }
    }

    const client = new WebSocketClient({
      url: wsUrl,
      autoReconnect: allowConnect && !isTest,
      maxReconnectAttempts: isTest ? 1 : 10,
    });

    signalingClientRef.current = client;
    setSignalingClient(client);

    const unsubState = client.onStateChange((state) => {
      if (state === 'connected') {
        setConnectionStatus('connected');
      } else if (state === 'reconnecting' || state === 'connecting') {
        setConnectionStatus('reconnecting');
      } else {
        setConnectionStatus('disconnected');
      }
    });

    const unsubMessage = client.onMessage((envelope) => {
      if (envelope.type === 'JOIN_ACCEPTED') {
        const payload = envelope.payload as any;
        if (payload?.activeParticipants && Array.isArray(payload.activeParticipants)) {
          setParticipants((prev) => {
            const existingMap = new Map(prev.map((p) => [p.id, p]));
            payload.activeParticipants.forEach((ap: any) => {
              if (ap.id === currentUserId) return;
              if (existingMap.has(ap.id)) {
                const ex = existingMap.get(ap.id)!;
                existingMap.set(ap.id, { ...ex, connectionStatus: 'connected' });
              } else {
                existingMap.set(ap.id, {
                  id: ap.id,
                  name: ap.name,
                  email: '',
                  role: ap.role,
                  isMuted: true,
                  isVideoOff: true,
                  isScreenSharing: false,
                  isHandRaised: false,
                  currentModule: 'code',
                  connectionStatus: 'connected',
                });
              }
            });
            return Array.from(existingMap.values());
          });
        }
      } else if (envelope.type === 'PARTICIPANT_JOINED') {
        const p = (envelope.payload as any)?.participant;
        if (p && p.id !== currentUserId) {
          setParticipants((prev) => {
            if (prev.some((x) => x.id === p.id)) {
              return prev.map((x) => (x.id === p.id ? { ...x, connectionStatus: 'connected' } : x));
            }
            return [
              ...prev,
              {
                id: p.id,
                name: p.name,
                email: '',
                role: p.role,
                isMuted: true,
                isVideoOff: true,
                isScreenSharing: false,
                isHandRaised: false,
                currentModule: 'code',
                connectionStatus: 'connected',
              },
            ];
          });
          if (localVideoStreamRef.current || localAudioStreamRef.current || screenShareStreamRef.current) {
            initiatePeerOffer(p.id);
          }
        }
      } else if (envelope.type === 'PARTICIPANT_LEFT') {
        const leftId = (envelope.payload as any)?.participantId;
        if (leftId) {
          setParticipants((prev) =>
            prev.map((x) => (x.id === leftId ? { ...x, connectionStatus: 'disconnected' } : x))
          );
          const pc = peerConnectionsRef.current.get(leftId);
          if (pc) {
            try { pc.close(); } catch (_) {}
            peerConnectionsRef.current.delete(leftId);
          }
          setRemoteStreams((prev) => {
            if (prev.has(leftId)) {
              const copy = new Map(prev);
              copy.delete(leftId);
              return copy;
            }
            return prev;
          });
        }
      } else if (envelope.type === 'CLASSROOM_EVENT') {
        const { eventName, data } = envelope.payload || {};
        setLastNetworkEvent({
          eventName,
          payload: data,
          timestamp: envelope.timestamp,
          senderId: envelope.senderId,
        });

        if (eventName === 'NETWORK_TEST_PING') {
          showToast(`Network test ping received from ${envelope.senderId || 'peer'}`);
        }

        // WebRTC Signaling Handshake
        if (eventName === 'WEBRTC_OFFER' && data?.targetUserId === currentUserId && data?.sdp) {
          const senderId = envelope.senderId || data.senderId;
          const pc = getOrCreatePeerConnection(senderId);
          pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: data.sdp }))
            .then(async () => {
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              signalingClientRef.current?.emitClassroomEvent('WEBRTC_ANSWER', {
                targetUserId: senderId,
                sdp: answer.sdp,
                type: answer.type,
                senderId: currentUserId,
              });
            })
            .catch((e) => console.warn('[WebRTC] Error handling offer:', e));
        } else if (eventName === 'WEBRTC_ANSWER' && data?.targetUserId === currentUserId && data?.sdp) {
          const senderId = envelope.senderId || data.senderId;
          const pc = peerConnectionsRef.current.get(senderId);
          if (pc) {
            pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }))
              .catch((e) => console.warn('[WebRTC] Error setting answer:', e));
          }
        } else if (eventName === 'WEBRTC_ICE_CANDIDATE' && data?.targetUserId === currentUserId && data?.candidate) {
          const senderId = envelope.senderId || data.senderId;
          const pc = peerConnectionsRef.current.get(senderId);
          if (pc) {
            pc.addIceCandidate(new RTCIceCandidate(data.candidate))
              .catch((e) => console.warn('[WebRTC] Error adding candidate:', e));
          }
        }

        if (eventName === 'TEACHER_MUTE_STUDENT' && data?.targetStudentId === currentUserId) {
          if (localAudioStreamRef.current) {
            localAudioStreamRef.current.getAudioTracks().forEach((t) => {
              t.enabled = false;
              t.stop();
            });
            localAudioStreamRef.current = null;
            setLocalAudioStream(null);
          }
          setDeviceState((prev) => ({ ...prev, isMuted: true, audioLevel: 0 }));
          showToast('Your microphone was muted by the instructor');
        } else if (
          eventName === 'TEACHER_STOP_CAMERA' &&
          data?.targetStudentId === currentUserId
        ) {
          if (localVideoStreamRef.current) {
            localVideoStreamRef.current.getTracks().forEach((t) => t.stop());
            localVideoStreamRef.current = null;
            setLocalVideoStream(null);
          }
          setDeviceState((prev) => ({ ...prev, isVideoOff: true }));
          showToast('Your camera was turned off by the instructor');
        } else if (
          eventName === 'TEACHER_REQUEST_UNMUTE' &&
          data?.targetStudentId === currentUserId
        ) {
          setPendingMediaRequest({
            type: 'unmute',
            targetStudentId: currentUserId,
            targetStudentName: 'You',
            status: 'pending',
            timestamp: Date.now(),
          });
        } else if (
          eventName === 'TEACHER_REQUEST_CAMERA' &&
          data?.targetStudentId === currentUserId
        ) {
          setPendingMediaRequest({
            type: 'camera',
            targetStudentId: currentUserId,
            targetStudentName: 'You',
            status: 'pending',
            timestamp: Date.now(),
          });
        } else if (eventName === 'TEACHER_MUTE_ALL' && userRole === 'student') {
          if (localAudioStreamRef.current) {
            localAudioStreamRef.current.getAudioTracks().forEach((t) => {
              t.enabled = false;
              t.stop();
            });
            localAudioStreamRef.current = null;
            setLocalAudioStream(null);
          }
          setDeviceState((prev) => ({ ...prev, isMuted: true, audioLevel: 0 }));
          showToast('All student microphones were muted by the instructor');
        } else if (eventName === 'TEACHER_STOP_ALL_CAMERAS' && userRole === 'student') {
          if (localVideoStreamRef.current) {
            localVideoStreamRef.current.getTracks().forEach((t) => t.stop());
            localVideoStreamRef.current = null;
            setLocalVideoStream(null);
          }
          setDeviceState((prev) => ({ ...prev, isVideoOff: true }));
          showToast('All student cameras were turned off by the instructor');
        } else if (eventName === 'PERMISSIONS_UPDATED') {
          if (data?.allowStudentMicrophone !== undefined) {
            setSession((prev) => ({
              ...prev,
              permissions: {
                ...prev.permissions,
                allowStudentMicrophone: data.allowStudentMicrophone,
              },
            }));
          }
          if (data?.allowStudentCamera !== undefined) {
            setSession((prev) => ({
              ...prev,
              permissions: {
                ...prev.permissions,
                allowStudentCamera: data.allowStudentCamera,
              },
            }));
          }
        } else if (eventName === 'MEDIA_REQUEST_RESPONSE') {
          const { targetStudentId, type, accepted } = data || {};
          if (targetStudentId) {
            setParticipants((prev) =>
              prev.map((p) => {
                if (p.id !== targetStudentId) return p;
                if (type === 'unmute') {
                  return {
                    ...p,
                    isMuted: accepted ? false : p.isMuted,
                    unmuteRequestStatus: accepted ? 'accepted' : 'declined',
                  };
                } else {
                  return {
                    ...p,
                    isVideoOff: accepted ? false : p.isVideoOff,
                    cameraRequestStatus: accepted ? 'accepted' : 'declined',
                  };
                }
              })
            );
          }
        }
      }
    });

    if (allowConnect) {
      client.connect();
      client.joinClassroom(session.id, {
        requestedRole: userRole,
        participantName: currentUserName,
        joinToken: liveSessionToken || undefined,
      });
    }

    return () => {
      unsubState();
      unsubMessage();
      client.disconnect();
      signalingClientRef.current = null;
    };
  }, [session.id, session.teacher.name, userRole, currentUserId, showToast]);

  // Initial device discovery and listener for device hardware changes
  useEffect(() => {
    refreshDevices();

    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
      const handleDeviceChange = () => {
        refreshDevices();
      };
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      };
    }
  }, [refreshDevices]);

  // Complete cleanup on unmount
  useEffect(() => {
    return () => {
      if (localVideoStreamRef.current) {
        localVideoStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (localAudioStreamRef.current) {
        localAudioStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (screenShareStreamRef.current) {
        screenShareStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (analyserLoopIdRef.current) {
        cancelAnimationFrame(analyserLoopIdRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  return (
    <ClassroomContext.Provider
      value={{
        session,
        userRole,
        setUserRole,
        activeModule,
        setActiveModule,
        connectionStatus,
        setConnectionStatus,
        deviceState,
        toggleMicrophone,
        toggleCamera,
        toggleScreenShare,
        toggleHandRaise,
        setAudioDevice,
        setVideoDevice,
        setAudioOutputDevice,
        participants,
        muteAllStudents,
        lowerAllHands,
        currentUserId,
        isChatOpen,
        setIsChatOpen,
        isParticipantsOpen,
        setIsParticipantsOpen,
        isSettingsOpen,
        setIsSettingsOpen,
        toastMessage,
        showToast,
        localVideoStream,
        localAudioStream,
        screenShareStream,
        availableAudioInputs,
        availableVideoInputs,
        availableAudioOutputs,
        refreshDevices,
        startCamera,
        stopCamera,
        startMicrophone,
        stopMicrophone,
        startScreenShare,
        stopScreenShare,
        muteStudent,
        requestStudentUnmute,
        turnOffStudentCamera,
        requestStudentCamera,
        turnOffAllStudentCameras,
        toggleStudentMicrophoneLock,
        toggleStudentCameraLock,
        pendingMediaRequest,
        respondToMediaRequest,
        signalingClient,
        lastNetworkEvent,
        sendNetworkTestEvent,
        authStatus,
        authErrorMessage,
        liveSessionToken,
        remoteStreams,
        isAuthoritativeTeacher,
        currentUserName,
        currentUserEmail,
        isImmersive,
        isFullscreen,
        toggleFullscreen,
        requestFullscreen,
        exitFullscreen,
      }}
    >
      {children}
    </ClassroomContext.Provider>
  );
};

export const useClassroom = () => {
  const context = useContext(ClassroomContext);
  if (!context) {
    throw new Error('useClassroom must be used within ClassroomProvider');
  }
  return context;
};
