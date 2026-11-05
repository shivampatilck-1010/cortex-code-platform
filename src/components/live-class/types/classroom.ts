export type UserRole = 'teacher' | 'student';

export type ClassroomModule = 
  | 'whiteboard'
  | 'code'
  | 'meeting'
  | 'presentation'
  | 'assignments'
  | 'resources';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export interface MediaDeviceOption {
  deviceId: string;
  label: string;
  kind?: 'audioinput' | 'videoinput' | 'audiooutput';
  groupId?: string;
}

export interface PermissionStatusMap {
  camera: 'prompt' | 'granted' | 'denied' | 'unavailable';
  microphone: 'prompt' | 'granted' | 'denied' | 'unavailable';
  screen: 'prompt' | 'granted' | 'denied' | 'unavailable';
}

export interface DeviceState {
  audioDeviceId: string;
  videoDeviceId: string;
  audioOutputDeviceId?: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  audioLevel: number; // 0 to 100 for visualizer
  isCameraLoading?: boolean;
  isMicrophoneLoading?: boolean;
  isScreenSharingLoading?: boolean;
  cameraError?: string | null;
  microphoneError?: string | null;
  screenShareError?: string | null;
  permissionStatus?: PermissionStatusMap;
}

export type MediaRequestStatus = 'idle' | 'pending' | 'accepted' | 'declined';

export interface StudentMediaRequest {
  type: 'unmute' | 'camera';
  targetStudentId: string;
  targetStudentName: string;
  status: MediaRequestStatus;
  timestamp: number;
}

export interface Participant {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  avatar?: string;
  currentModule: ClassroomModule;
  isSimulated?: boolean;
  unmuteRequestStatus?: MediaRequestStatus;
  cameraRequestStatus?: MediaRequestStatus;
  connectionStatus?: ConnectionStatus;
}

export interface ClassroomPermissions {
  allowStudentMicrophone: boolean;
  allowStudentCamera: boolean;
  allowStudentScreenShare: boolean;
  allowStudentChat: boolean;
  allowIndependentMode: boolean;
}

export interface ClassroomSession {
  id: string;
  title: string;
  courseCode: string;
  teacher: {
    id: string;
    name: string;
    email: string;
  };
  startedAt: number;
  permissions: ClassroomPermissions;
}
