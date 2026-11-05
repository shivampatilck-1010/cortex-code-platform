const fs = require('fs');
const file = 'src/lib/classroom/durable-object.ts';
let code = fs.readFileSync(file, 'utf8');

// 1. Add moderation events
const modTarget = "'media.lock_camera',";
const modReplacement = `'media.lock_camera',
  'TEACHER_START_BROADCAST',
  'TEACHER_PAUSE_BROADCAST',
  'TEACHER_RESUME_BROADCAST',
  'TEACHER_STOP_BROADCAST',
  'TEACHER_CODE_BROADCAST',
  'TEACHER_SHARE_OUTPUT',
  'OBSERVE_STUDENT_SUBSCRIBE',
  'OBSERVE_STUDENT_UNSUBSCRIBE',`;

if (!code.includes(modReplacement) && code.includes(modTarget)) {
  code = code.replace(modTarget, modReplacement);
}

// 2. Add class fields
const fieldsTarget = 'private latestTeacherOutput: any | null = null;';
const fieldsReplacement = `private latestTeacherOutput: any | null = null;
  private broadcastState: 'stopped' | 'broadcasting' | 'paused' = 'stopped';
  private publishedTeacherFiles: any[] = [];
  private publishedActiveFileId: string = '';
  private publishedOutput: any = null;
  private observedSubscriptions: Map<string, string> = new Map();
  private studentWorkspaces: Map<string, { files: any[]; activeFileId: string; timestamp: number }> = new Map();`;

if (!code.includes('private broadcastState:') && code.includes(fieldsTarget)) {
  code = code.replace(fieldsTarget, fieldsReplacement);
}

// 3. Add storage recovery
const initTarget = "if (storedOutput !== undefined) this.latestTeacherOutput = storedOutput;";
const initReplacement = `if (storedOutput !== undefined) this.latestTeacherOutput = storedOutput;
        const storedBState = await this.state.storage.get('broadcastState');
        if (typeof storedBState === 'string' && (storedBState === 'broadcasting' || storedBState === 'paused' || storedBState === 'stopped')) {
          this.broadcastState = storedBState;
        }
        const storedPubFiles = await this.state.storage.get('publishedTeacherFiles');
        if (Array.isArray(storedPubFiles)) {
          this.publishedTeacherFiles = storedPubFiles;
        }
        const storedPubFileId = await this.state.storage.get('publishedActiveFileId');
        if (typeof storedPubFileId === 'string') {
          this.publishedActiveFileId = storedPubFileId;
        }`;

if (!code.includes("storedBState") && code.includes(initTarget)) {
  code = code.replace(initTarget, initReplacement);
}

// 4. Update JOIN_CLASSROOM handling to send current broadcast state to joiner
const joinTarget = `        senderWs.send(
          JSON.stringify({
            version: '1.0',
            messageId: 'acc-' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)),
            type: 'JOIN_ACCEPTED',
            sessionId: targetSessionId,
            timestamp: Date.now(),
            payload: {
              assignedParticipantId: participantId,
              assignedRole: meta.role,
              sessionId: targetSessionId,
              activeParticipants,
            },
          })
        );`;

const joinReplacement = `        senderWs.send(
          JSON.stringify({
            version: '1.0',
            messageId: 'acc-' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)),
            type: 'JOIN_ACCEPTED',
            sessionId: targetSessionId,
            timestamp: Date.now(),
            payload: {
              assignedParticipantId: participantId,
              assignedRole: meta.role,
              sessionId: targetSessionId,
              activeParticipants,
            },
          })
        );

        // Immediate broadcast state alignment for joining participant
        senderWs.send(
          JSON.stringify({
            version: '1.0',
            messageId: 'bcast-init-' + Date.now(),
            type: 'CLASSROOM_EVENT',
            sessionId: targetSessionId,
            timestamp: Date.now(),
            payload: {
              eventName: 'BROADCAST_STATE_CHANGED',
              data: {
                state: this.broadcastState,
                files: (this.broadcastState === 'broadcasting' || this.broadcastState === 'paused') ? this.publishedTeacherFiles : [],
                activeFileId: (this.broadcastState === 'broadcasting' || this.broadcastState === 'paused') ? this.publishedActiveFileId : '',
              },
            },
          })
        );`;

if (!code.includes('bcast-init-') && code.includes(joinTarget)) {
  code = code.replace(joinTarget, joinReplacement);
}

// 5. In CLASSROOM_EVENT, handle broadcast & observation operations
const eventTarget = `        if (payload && typeof payload === 'object') {
          if (payload.data && typeof payload.data === 'object') {
            payload.data.senderId = meta.participantId;
            payload.data.actorId = meta.participantId;
            payload.data.senderRole = meta.role;
          }
          payload.senderId = meta.participantId;
        }

        const broadcastEnvelope = JSON.stringify({
          version: '1.0',
          messageId: 'evt-' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)),
          type: 'CLASSROOM_EVENT',
          sessionId: targetSessionId,
          timestamp: Date.now(),
          payload,
        });

        this.broadcastRaw(broadcastEnvelope, senderWs);
        return;`;

const eventReplacement = `        if (payload && typeof payload === 'object') {
          if (payload.data && typeof payload.data === 'object') {
            payload.data.senderId = meta.participantId;
            payload.data.actorId = meta.participantId;
            payload.data.senderRole = meta.role;
          }
          payload.senderId = meta.participantId;
        }

        // Authoritative Teaching Workspace Broadcast Lifecycle
        if (eventName === 'TEACHER_START_BROADCAST') {
          this.broadcastState = 'broadcasting';
          this.publishedTeacherFiles = payload.data?.files || [];
          this.publishedActiveFileId = payload.data?.activeFileId || '';
          if (this.state?.storage) {
            this.state.storage.put('broadcastState', 'broadcasting').catch(() => {});
            this.state.storage.put('publishedTeacherFiles', this.publishedTeacherFiles).catch(() => {});
            this.state.storage.put('publishedActiveFileId', this.publishedActiveFileId).catch(() => {});
          }
          const stateMsg = JSON.stringify({
            version: '1.0',
            messageId: 'evt-' + Date.now(),
            type: 'CLASSROOM_EVENT',
            sessionId: targetSessionId,
            timestamp: Date.now(),
            payload: {
              eventName: 'BROADCAST_STATE_CHANGED',
              data: {
                state: 'broadcasting',
                files: this.publishedTeacherFiles,
                activeFileId: this.publishedActiveFileId,
                teacherId: meta.participantId,
                teacherName: meta.name,
              },
            },
          });
          this.broadcastRaw(stateMsg);
          return;
        }

        if (eventName === 'TEACHER_PAUSE_BROADCAST') {
          this.broadcastState = 'paused';
          if (this.state?.storage) {
            this.state.storage.put('broadcastState', 'paused').catch(() => {});
          }
          const stateMsg = JSON.stringify({
            version: '1.0',
            messageId: 'evt-' + Date.now(),
            type: 'CLASSROOM_EVENT',
            sessionId: targetSessionId,
            timestamp: Date.now(),
            payload: {
              eventName: 'BROADCAST_STATE_CHANGED',
              data: {
                state: 'paused',
              },
            },
          });
          this.broadcastRaw(stateMsg);
          return;
        }

        if (eventName === 'TEACHER_RESUME_BROADCAST') {
          this.broadcastState = 'broadcasting';
          if (this.state?.storage) {
            this.state.storage.put('broadcastState', 'broadcasting').catch(() => {});
          }
          const stateMsg = JSON.stringify({
            version: '1.0',
            messageId: 'evt-' + Date.now(),
            type: 'CLASSROOM_EVENT',
            sessionId: targetSessionId,
            timestamp: Date.now(),
            payload: {
              eventName: 'BROADCAST_STATE_CHANGED',
              data: {
                state: 'broadcasting',
                files: this.publishedTeacherFiles,
                activeFileId: this.publishedActiveFileId,
              },
            },
          });
          this.broadcastRaw(stateMsg);
          return;
        }

        if (eventName === 'TEACHER_STOP_BROADCAST') {
          this.broadcastState = 'stopped';
          this.publishedTeacherFiles = [];
          this.publishedActiveFileId = '';
          if (this.state?.storage) {
            this.state.storage.put('broadcastState', 'stopped').catch(() => {});
            this.state.storage.put('publishedTeacherFiles', []).catch(() => {});
            this.state.storage.put('publishedActiveFileId', '').catch(() => {});
          }
          const stateMsg = JSON.stringify({
            version: '1.0',
            messageId: 'evt-' + Date.now(),
            type: 'CLASSROOM_EVENT',
            sessionId: targetSessionId,
            timestamp: Date.now(),
            payload: {
              eventName: 'BROADCAST_STATE_CHANGED',
              data: {
                state: 'stopped',
                files: [],
              },
            },
          });
          this.broadcastRaw(stateMsg);
          return;
        }

        if (eventName === 'TEACHER_CODE_BROADCAST') {
          if (this.broadcastState !== 'broadcasting') {
            return;
          }
          if (payload.data?.files) {
            this.publishedTeacherFiles = payload.data.files;
          }
          if (payload.data?.activeFileId) {
            this.publishedActiveFileId = payload.data.activeFileId;
          }
          const codeMsg = JSON.stringify({
            version: '1.0',
            messageId: 'evt-' + Date.now(),
            type: 'CLASSROOM_EVENT',
            sessionId: targetSessionId,
            timestamp: Date.now(),
            payload: {
              eventName: 'TEACHER_CODE_UPDATE',
              data: payload.data,
            },
          });
          this.broadcastRaw(codeMsg, senderWs);
          return;
        }

        if (eventName === 'GET_BROADCAST_STATE') {
          senderWs.send(
            JSON.stringify({
              version: '1.0',
              messageId: 'evt-' + Date.now(),
              type: 'CLASSROOM_EVENT',
              sessionId: targetSessionId,
              timestamp: Date.now(),
              payload: {
                eventName: 'BROADCAST_STATE_CHANGED',
                data: {
                  state: this.broadcastState,
                  files: (this.broadcastState === 'broadcasting' || this.broadcastState === 'paused') ? this.publishedTeacherFiles : [],
                  activeFileId: (this.broadcastState === 'broadcasting' || this.broadcastState === 'paused') ? this.publishedActiveFileId : '',
                },
              },
            })
          );
          return;
        }

        // Authoritative Student Observation Lifecycle
        if (eventName === 'OBSERVE_STUDENT_SUBSCRIBE') {
          const studentId = payload.data?.studentId;
          if (!studentId) return;
          this.observedSubscriptions.set(meta.participantId, studentId);
          const existing = this.studentWorkspaces.get(studentId);
          if (existing) {
            senderWs.send(
              JSON.stringify({
                version: '1.0',
                messageId: 'evt-' + Date.now(),
                type: 'CLASSROOM_EVENT',
                sessionId: targetSessionId,
                timestamp: Date.now(),
                payload: {
                  eventName: 'STUDENT_WORKSPACE_STREAM',
                  data: {
                    studentId,
                    files: existing.files,
                    activeFileId: existing.activeFileId,
                    timestamp: existing.timestamp,
                  },
                },
              })
            );
          }
          return;
        }

        if (eventName === 'OBSERVE_STUDENT_UNSUBSCRIBE') {
          this.observedSubscriptions.delete(meta.participantId);
          return;
        }

        if (eventName === 'STUDENT_WORKSPACE_UPDATE') {
          const studentId = meta.participantId;
          const files = payload.data?.files || [];
          const activeFileId = payload.data?.activeFileId || '';
          this.studentWorkspaces.set(studentId, { files, activeFileId, timestamp: Date.now() });

          const streamMsg = JSON.stringify({
            version: '1.0',
            messageId: 'evt-' + Date.now(),
            type: 'CLASSROOM_EVENT',
            sessionId: targetSessionId,
            timestamp: Date.now(),
            payload: {
              eventName: 'STUDENT_WORKSPACE_STREAM',
              data: {
                studentId,
                files,
                activeFileId,
                timestamp: Date.now(),
              },
            },
          });

          this.sessions.forEach((session, ws) => {
            if (ws.readyState === 1 && (session.role === 'teacher' || session.role === 'admin')) {
              const observingTarget = this.observedSubscriptions.get(session.participantId);
              if (observingTarget === studentId) {
                try { ws.send(streamMsg); } catch (_) {}
              }
            }
          });
          return;
        }

        const broadcastEnvelope = JSON.stringify({
          version: '1.0',
          messageId: 'evt-' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)),
          type: 'CLASSROOM_EVENT',
          sessionId: targetSessionId,
          timestamp: Date.now(),
          payload,
        });

        this.broadcastRaw(broadcastEnvelope, senderWs);
        return;`;

if (!code.includes('TEACHER_START_BROADCAST') && code.includes(eventTarget)) {
  code = code.replace(eventTarget, eventReplacement);
}

fs.writeFileSync(file, code, 'utf8');
console.log('Successfully patched durable-object.ts');
