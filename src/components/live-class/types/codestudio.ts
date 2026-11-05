export type CodeLanguage = 'typescript' | 'javascript' | 'python' | 'cpp' | 'rust';

export type ExecutionSupportLevel = 'fully-supported' | 'experimental' | 'editor-only' | 'unsupported';

export type BroadcastState = 'stopped' | 'broadcasting' | 'paused';

export type TeacherWorkspaceMode = 'broadcast' | 'observe';

export type StudentWorkspaceTab = 'my_workspace' | 'instructor_demo';

export interface LanguageConfig {
  id: CodeLanguage;
  label: string;
  extension: string;
  defaultFileName: string;
  supportLevel: ExecutionSupportLevel;
  supportBadge: string;
  starterCode: string;
}

export interface CodeFile {
  id: string;
  name: string;
  language: CodeLanguage;
  content: string;
  isReadOnly?: boolean;
}

export interface ExecutionResult {
  status: 'idle' | 'running' | 'success' | 'error';
  stdout: string;
  stderr: string;
  executionTimeMs?: number;
  memoryKb?: number;
  exitCode?: number;
}

export interface WorkspaceState {
  ownerId: string;
  ownerName: string;
  ownerRole: 'teacher' | 'student';
  files: CodeFile[];
  activeFileId: string;
  isReadOnly: boolean;
  executionResult: ExecutionResult;
}

export type CodeStudioSyncMessage =
  | {
      type: 'TEACHER_CODE_UPDATE';
      sessionId?: string;
      fileId: string;
      fileName: string;
      language: CodeLanguage;
      content: string;
      timestamp: number;
    }
  | {
      type: 'TEACHER_FILE_SELECT';
      sessionId?: string;
      fileId: string;
      fileName: string;
      timestamp: number;
    }
  | {
      type: 'STUDENT_SYNC_REQUEST';
      timestamp: number;
    }
  | {
      type: 'TEACHER_FULL_SYNC';
      sessionId?: string;
      files: CodeFile[];
      activeFileId: string;
      timestamp: number;
    }
  | {
      type: 'TEACHER_START_BROADCAST';
      sessionId?: string;
      files: CodeFile[];
      activeFileId: string;
      timestamp: number;
    }
  | {
      type: 'TEACHER_PAUSE_BROADCAST';
      sessionId?: string;
      timestamp: number;
    }
  | {
      type: 'TEACHER_RESUME_BROADCAST';
      sessionId?: string;
      timestamp: number;
    }
  | {
      type: 'TEACHER_STOP_BROADCAST';
      sessionId?: string;
      timestamp: number;
    }
  | {
      type: 'BROADCAST_STATE_CHANGED';
      sessionId?: string;
      state: BroadcastState;
      files?: CodeFile[];
      activeFileId?: string;
      timestamp: number;
    }
  | {
      type: 'OBSERVE_STUDENT_SUBSCRIBE';
      sessionId?: string;
      studentId: string;
      timestamp: number;
    }
  | {
      type: 'OBSERVE_STUDENT_UNSUBSCRIBE';
      sessionId?: string;
      studentId: string;
      timestamp: number;
    }
  | {
      type: 'STUDENT_WORKSPACE_UPDATE';
      sessionId?: string;
      studentId: string;
      files: CodeFile[];
      activeFileId: string;
      timestamp: number;
    }
  | {
      type: 'STUDENT_WORKSPACE_STREAM';
      sessionId?: string;
      studentId: string;
      files: CodeFile[];
      activeFileId: string;
      timestamp: number;
    };
