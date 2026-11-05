const fs = require('fs');
const file = 'src/lib/classroom/node-ws-server.ts';
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

// Global server state for broadcast & observations in node ws server
const globalTarget = 'const connectedClients = new Set<ClientMeta>();';
const globalReplacement = `const connectedClients = new Set<ClientMeta>();
const roomBroadcastState = new Map<string, 'stopped' | 'broadcasting' | 'paused'>();
const roomPublishedTeacherFiles = new Map<string, any[]>();
const roomPublishedActiveFileId = new Map<string, string>();
const roomObservedSubscriptions = new Map<string, Map<string, string>>(); // room -> (teacherId -> studentId)
const roomStudentWorkspaces = new Map<string, Map<string, { files: any[]; activeFileId: string; timestamp: number }>>();`;

if (!code.includes('roomBroadcastState') && code.includes(globalTarget)) {
  code = code.replace(globalTarget, globalReplacement);
}

// In JOIN_CLASSROOM, send current broadcast state to joiner
const joinTarget = `        // Send JOIN_ACCEPTED to caller
        sendJson(client.ws, {
          version: '1.0',
          messageId: 'acc-' + crypto.randomUUID(),
          type: 'JOIN_ACCEPTED',
          sessionId: targetSessionId,
          timestamp: Date.now(),
          payload: {
            assignedParticipantId: participantId,
            assignedRole: authoritativeRole,
            sessionId: targetSessionId,
            activeParticipants,
          },
        });`;

const joinReplacement = `        // Send JOIN_ACCEPTED to caller
        sendJson(client.ws, {
          version: '1.0',
          messageId: 'acc-' + crypto.randomUUID(),
          type: 'JOIN_ACCEPTED',
          sessionId: targetSessionId,
          timestamp: Date.now(),
          payload: {
            assignedParticipantId: participantId,
            assignedRole: authoritativeRole,
            sessionId: targetSessionId,
            activeParticipants,
          },
        });

        // Current broadcast state synchronization
        const bState = roomBroadcastState.get(targetSessionId) || 'stopped';
        const pubFiles = roomPublishedTeacherFiles.get(targetSessionId) || [];
        const pubFileId = roomPublishedActiveFileId.get(targetSessionId) || '';

        sendJson(client.ws, {
          version: '1.0',
          messageId: 'bcast-init-' + Date.now(),
          type: 'CLASSROOM_EVENT',
          sessionId: targetSessionId,
          timestamp: Date.now(),
          payload: {
            eventName: 'BROADCAST_STATE_CHANGED',
            data: {
              state: bState,
              files: (bState === 'broadcasting' || bState === 'paused') ? pubFiles : [],
              activeFileId: (bState === 'broadcasting' || bState === 'paused') ? pubFileId : '',
            },
          },
        });`;

if (!code.includes('roomBroadcastState.get') && code.includes(joinTarget)) {
  code = code.replace(joinTarget, joinReplacement);
}

// In CLASSROOM_EVENT, handle broadcast & observation events
const eventTarget = `        // Broadcast to all other peers in the room
        const broadcastEnvelope = JSON.stringify({
          version: '1.0',
          messageId: 'evt-' + crypto.randomUUID(),
          type: 'CLASSROOM_EVENT',
          sessionId: client.classroomId,
          timestamp: Date.now(),
          payload,
        });

        connectedClients.forEach((other) => {
          if (
            other !== client &&
            (other.classroomId === client.classroomId || other.roomId === client.classroomId) &&
            other.ws.readyState === 1
          ) {
            try { other.ws.send(broadcastEnvelope); } catch {}
          }
        });

        return;`;

const eventReplacement = `        // Handle Workspace Broadcast Operations
        const roomKey = client.classroomId;
        if (eventName === 'TEACHER_START_BROADCAST') {
          roomBroadcastState.set(roomKey, 'broadcasting');
          const files = payload.data?.files || [];
          const activeFileId = payload.data?.activeFileId || '';
          roomPublishedTeacherFiles.set(roomKey, files);
          roomPublishedActiveFileId.set(roomKey, activeFileId);

          const stateMsg = JSON.stringify({
            version: '1.0',
            messageId: 'evt-' + Date.now(),
            type: 'CLASSROOM_EVENT',
            sessionId: roomKey,
            timestamp: Date.now(),
            payload: {
              eventName: 'BROADCAST_STATE_CHANGED',
              data: {
                state: 'broadcasting',
                files,
                activeFileId,
                teacherId: client.participantId,
                teacherName: client.participantName,
              },
            },
          });
          connectedClients.forEach((other) => {
            if ((other.classroomId === roomKey || other.roomId === roomKey) && other.ws.readyState === 1) {
              try { other.ws.send(stateMsg); } catch {}
            }
          });
          return;
        }

        if (eventName === 'TEACHER_PAUSE_BROADCAST') {
          roomBroadcastState.set(roomKey, 'paused');
          const stateMsg = JSON.stringify({
            version: '1.0',
            messageId: 'evt-' + Date.now(),
            type: 'CLASSROOM_EVENT',
            sessionId: roomKey,
            timestamp: Date.now(),
            payload: {
              eventName: 'BROADCAST_STATE_CHANGED',
              data: {
                state: 'paused',
              },
            },
          });
          connectedClients.forEach((other) => {
            if ((other.classroomId === roomKey || other.roomId === roomKey) && other.ws.readyState === 1) {
              try { other.ws.send(stateMsg); } catch {}
            }
          });
          return;
        }

        if (eventName === 'TEACHER_RESUME_BROADCAST') {
          roomBroadcastState.set(roomKey, 'broadcasting');
          const files = roomPublishedTeacherFiles.get(roomKey) || [];
          const activeFileId = roomPublishedActiveFileId.get(roomKey) || '';
          const stateMsg = JSON.stringify({
            version: '1.0',
            messageId: 'evt-' + Date.now(),
            type: 'CLASSROOM_EVENT',
            sessionId: roomKey,
            timestamp: Date.now(),
            payload: {
              eventName: 'BROADCAST_STATE_CHANGED',
              data: {
                state: 'broadcasting',
                files,
                activeFileId,
              },
            },
          });
          connectedClients.forEach((other) => {
            if ((other.classroomId === roomKey || other.roomId === roomKey) && other.ws.readyState === 1) {
              try { other.ws.send(stateMsg); } catch {}
            }
          });
          return;
        }

        if (eventName === 'TEACHER_STOP_BROADCAST') {
          roomBroadcastState.set(roomKey, 'stopped');
          roomPublishedTeacherFiles.set(roomKey, []);
          roomPublishedActiveFileId.set(roomKey, '');
          const stateMsg = JSON.stringify({
            version: '1.0',
            messageId: 'evt-' + Date.now(),
            type: 'CLASSROOM_EVENT',
            sessionId: roomKey,
            timestamp: Date.now(),
            payload: {
              eventName: 'BROADCAST_STATE_CHANGED',
              data: {
                state: 'stopped',
                files: [],
              },
            },
          });
          connectedClients.forEach((other) => {
            if ((other.classroomId === roomKey || other.roomId === roomKey) && other.ws.readyState === 1) {
              try { other.ws.send(stateMsg); } catch {}
            }
          });
          return;
        }

        if (eventName === 'TEACHER_CODE_BROADCAST') {
          const bState = roomBroadcastState.get(roomKey) || 'stopped';
          if (bState !== 'broadcasting') {
            return;
          }
          if (payload.data?.files) {
            roomPublishedTeacherFiles.set(roomKey, payload.data.files);
          }
          if (payload.data?.activeFileId) {
            roomPublishedActiveFileId.set(roomKey, payload.data.activeFileId);
          }
          const codeMsg = JSON.stringify({
            version: '1.0',
            messageId: 'evt-' + Date.now(),
            type: 'CLASSROOM_EVENT',
            sessionId: roomKey,
            timestamp: Date.now(),
            payload: {
              eventName: 'TEACHER_CODE_UPDATE',
              data: payload.data,
            },
          });
          connectedClients.forEach((other) => {
            if (other !== client && (other.classroomId === roomKey || other.roomId === roomKey) && other.ws.readyState === 1) {
              try { other.ws.send(codeMsg); } catch {}
            }
          });
          return;
        }

        if (eventName === 'GET_BROADCAST_STATE') {
          const bState = roomBroadcastState.get(roomKey) || 'stopped';
          const pubFiles = roomPublishedTeacherFiles.get(roomKey) || [];
          const pubFileId = roomPublishedActiveFileId.get(roomKey) || '';
          sendJson(client.ws, {
            version: '1.0',
            messageId: 'evt-' + Date.now(),
            type: 'CLASSROOM_EVENT',
            sessionId: roomKey,
            timestamp: Date.now(),
            payload: {
              eventName: 'BROADCAST_STATE_CHANGED',
              data: {
                state: bState,
                files: (bState === 'broadcasting' || bState === 'paused') ? pubFiles : [],
                activeFileId: (bState === 'broadcasting' || bState === 'paused') ? pubFileId : '',
              },
            },
          });
          return;
        }

        // Handle Student Observation Operations
        if (!roomObservedSubscriptions.has(roomKey)) {
          roomObservedSubscriptions.set(roomKey, new Map());
        }
        if (!roomStudentWorkspaces.has(roomKey)) {
          roomStudentWorkspaces.set(roomKey, new Map());
        }
        const roomObsMap = roomObservedSubscriptions.get(roomKey)!;
        const roomWorkspaces = roomStudentWorkspaces.get(roomKey)!;

        if (eventName === 'OBSERVE_STUDENT_SUBSCRIBE') {
          const studentId = payload.data?.studentId;
          if (!studentId) return;
          roomObsMap.set(client.participantId, studentId);
          const existing = roomWorkspaces.get(studentId);
          if (existing) {
            sendJson(client.ws, {
              version: '1.0',
              messageId: 'evt-' + Date.now(),
              type: 'CLASSROOM_EVENT',
              sessionId: roomKey,
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
            });
          }
          return;
        }

        if (eventName === 'OBSERVE_STUDENT_UNSUBSCRIBE') {
          roomObsMap.delete(client.participantId);
          return;
        }

        if (eventName === 'STUDENT_WORKSPACE_UPDATE') {
          const studentId = client.participantId;
          const files = payload.data?.files || [];
          const activeFileId = payload.data?.activeFileId || '';
          roomWorkspaces.set(studentId, { files, activeFileId, timestamp: Date.now() });

          const streamMsg = JSON.stringify({
            version: '1.0',
            messageId: 'evt-' + Date.now(),
            type: 'CLASSROOM_EVENT',
            sessionId: roomKey,
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

          connectedClients.forEach((other) => {
            if (
              (other.classroomId === roomKey || other.roomId === roomKey) &&
              (other.participantRole === 'teacher' || other.participantRole === 'admin') &&
              other.ws.readyState === 1
            ) {
              if (roomObsMap.get(other.participantId) === studentId) {
                try { other.ws.send(streamMsg); } catch {}
              }
            }
          });
          return;
        }

        // Broadcast to all other peers in the room
        const broadcastEnvelope = JSON.stringify({
          version: '1.0',
          messageId: 'evt-' + crypto.randomUUID(),
          type: 'CLASSROOM_EVENT',
          sessionId: client.classroomId,
          timestamp: Date.now(),
          payload,
        });

        connectedClients.forEach((other) => {
          if (
            other !== client &&
            (other.classroomId === client.classroomId || other.roomId === client.classroomId) &&
            other.ws.readyState === 1
          ) {
            try { other.ws.send(broadcastEnvelope); } catch {}
          }
        });

        return;`;

if (!code.includes('TEACHER_START_BROADCAST') && code.includes(eventTarget)) {
  code = code.replace(eventTarget, eventReplacement);
}

fs.writeFileSync(file, code, 'utf8');
console.log('Successfully patched node-ws-server.ts');
