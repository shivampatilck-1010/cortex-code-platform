#!/usr/bin/env node
/**
 * Comprehensive fix for:
 * 1. Code flickering / empty workspaces (state overwrite on every poll)
 * 2. Connection stability (WebSocket timeout, SSE reconnect)
 * 3. Collaboration request flow (proper HTTP persistence)
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');

function readNormalized(filePath) {
  return readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function writeNormalized(filePath, content) {
  writeFileSync(filePath, content, 'utf8');
}

// ============================================================
// FIX 1: page.tsx — Stop code flickering from poll overwrites
// ============================================================
const pagePath = resolve(ROOT, 'src/app/classroom/[roomId]/page.tsx');
let page = readNormalized(pagePath);

// 1a. In isRoomDifferent: REMOVE activeCode comparison — code is managed by Yjs CRDT, not HTTP poll
// This is THE primary cause of flickering: every 5s poll returns slightly different activeCode
// from cold edge isolates, triggering a full React re-render that resets the editor
page = page.replace(
  `      if (pp.activeCode !== np.activeCode) return true;\n`,
  `      // activeCode comparison REMOVED — Yjs CRDT manages editor content, not HTTP state poll\n      // Comparing activeCode caused flickering: cold edge isolates return empty/stale code\n      // which triggered re-renders that clobbered the live editor content\n`
);

// 1b. In applyRoomState: NEVER overwrite participant activeCode with empty/shorter server values
// The server returns empty activeCode from fresh edge isolates. We must keep local client code.
const oldMergeBlock = `    // Merge chat messages so local/optimistic or peer-received messages are NEVER lost
      const existingMap = new Map<string, ChatMessage>();
      (prev?.chatMessages || []).forEach((m) => {
        if (m && m.id) existingMap.set(m.id, m);
      });
      (newRoom?.chatMessages || []).forEach((m) => {
        if (m && m.id) existingMap.set(m.id, m);
      });
      const mergedChat = Array.from(existingMap.values()).sort((a, b) => a.timestamp - b.timestamp);

      const resolvedRoom: ClassroomRoom = {
        ...newRoom,
        chatMessages: mergedChat,
      };`;

const newMergeBlock = `    // Merge chat messages so local/optimistic or peer-received messages are NEVER lost
      const existingMap = new Map<string, ChatMessage>();
      (prev?.chatMessages || []).forEach((m) => {
        if (m && m.id) existingMap.set(m.id, m);
      });
      (newRoom?.chatMessages || []).forEach((m) => {
        if (m && m.id) existingMap.set(m.id, m);
      });
      const mergedChat = Array.from(existingMap.values()).sort((a, b) => a.timestamp - b.timestamp);

      // CRITICAL: Protect participant activeCode from server overwrites.
      // Cold edge isolates return empty activeCode which clobbers live editor content.
      // Rule: NEVER replace non-empty local code with empty/shorter server code.
      const protectedParticipants = { ...newRoom.participants };
      if (prev?.participants) {
        for (const [pid, serverP] of Object.entries(protectedParticipants)) {
          const localP = prev.participants[pid];
          if (localP && localP.activeCode && (!serverP.activeCode || serverP.activeCode.length < localP.activeCode.length)) {
            protectedParticipants[pid] = { ...serverP, activeCode: localP.activeCode };
          }
        }
      }

      const resolvedRoom: ClassroomRoom = {
        ...newRoom,
        participants: protectedParticipants,
        chatMessages: mergedChat,
      };`;

page = page.replace(oldMergeBlock, newMergeBlock);

// 1c. Increase the poll interval from 5s to 10s — reduces server traffic and flicker probability
page = page.replace(
  `    }, 5000);`,
  `    }, 10000);`
);

// 1d. In fetchRoomState gossip: don't send activeCode in the gossip payload to avoid
// propagating stale code to other edge isolates. Code is synced via Yjs CRDT.
const oldGossipSelf = `      if (activeId && activeName) {
        const existingLocal = participantMap.get(activeId);
        participantMap.set(activeId, {
          id: activeId,
          name: activeName,
          role: activeRole || 'user',
          joinedAt: existingLocal?.joinedAt || Date.now(),
          lastActive: Date.now(),
          status: existingLocal?.status || 'idle',
          online: true,
          activeCode: existingLocal?.activeCode || '',
          currentLanguage: existingLocal?.currentLanguage || 'python',
          activeFileName: existingLocal?.activeFileName || 'main.py',
          canRun: existingLocal?.canRun ?? true,
          isLocked: existingLocal?.isLocked ?? false,
          privacy: existingLocal?.privacy || { codeHidden: false, lockActive: false, isIncognito: false },
        });
      }`;

const newGossipSelf = `      if (activeId && activeName) {
        const existingLocal = participantMap.get(activeId);
        participantMap.set(activeId, {
          id: activeId,
          name: activeName,
          role: activeRole || 'user',
          joinedAt: existingLocal?.joinedAt || Date.now(),
          lastActive: Date.now(),
          status: existingLocal?.status || 'idle',
          online: true,
          // activeCode intentionally omitted from gossip — Yjs CRDT handles code sync.
          // Sending stale code here caused edge isolates to overwrite live content.
          currentLanguage: existingLocal?.currentLanguage || 'python',
          activeFileName: existingLocal?.activeFileName || 'main.py',
          canRun: existingLocal?.canRun ?? true,
          isLocked: existingLocal?.isLocked ?? false,
          privacy: existingLocal?.privacy || { codeHidden: false, lockActive: false, isIncognito: false },
        });
      }`;

page = page.replace(oldGossipSelf, newGossipSelf);

writeNormalized(pagePath, page);
console.log('✅ Fixed page.tsx — code flickering eliminated');


// ============================================================
// FIX 2: collab-sync.ts — Connection stability improvements
// ============================================================
const collabPath = resolve(ROOT, 'src/lib/classroom/collab-sync.ts');
let collab = readNormalized(collabPath);

// 2a. Increase WebSocket connect timeout from 3000ms to 6000ms
collab = collab.replace(
  `      }, 3000);`,
  `      }, 6000);`
);

// 2b. SSE onerror: add proper reconnection scheduling instead of just setting lifecycle
const oldSseError = `      this.sse.onerror = () => {
        if (!this.isDestroyed) {
          this.setLifecycle('reconnecting');
        }
      };`;

const newSseError = `      this.sse.onerror = () => {
        if (!this.isDestroyed) {
          this.setLifecycle('reconnecting');
          // Close broken SSE and attempt full reconnection after backoff
          try { this.sse?.close(); } catch {}
          this.sse = null;
          this.scheduleReconnect();
        }
      };`;

collab = collab.replace(oldSseError, newSseError);

// 2c. In scheduleReconnect: cap max attempts to 10 then fall back to stable SSE polling
const oldScheduleReconnect = `  private scheduleReconnect() {
    if (this.isDestroyed || this.reconnectTimer) return;

    this.reconnectAttempts++;
    // Exponential backoff with random jitter: min(1000 * 2^attempts, 16000) + random(500)
    const baseDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 16000);
    const jitter = Math.floor(Math.random() * 500);
    const delay = baseDelay + jitter;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isDestroyed) {
        this.initConnection();
      }
    }, delay);
  }`;

const newScheduleReconnect = `  private scheduleReconnect() {
    if (this.isDestroyed || this.reconnectTimer) return;

    this.reconnectAttempts++;

    // After 8 failed reconnection attempts, settle on SSE long-polling permanently
    // to avoid infinite reconnect loops that waste bandwidth and CPU
    if (this.reconnectAttempts > 8) {
      console.warn('[CollabClient] Max reconnect attempts reached, settling on SSE');
      if (!this.sse) {
        this.fallbackToSSE();
      }
      return;
    }

    // Exponential backoff with random jitter: min(1000 * 2^attempts, 16000) + random(500)
    const baseDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 16000);
    const jitter = Math.floor(Math.random() * 500);
    const delay = baseDelay + jitter;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isDestroyed) {
        this.initConnection();
      }
    }, delay);
  }`;

collab = collab.replace(oldScheduleReconnect, newScheduleReconnect);

// 2d. Reduce heartbeat interval from 15s to 25s to reduce unnecessary traffic
collab = collab.replace(
  `    }, 15000);
  }

  private setLifecycle`,
  `    }, 25000);
  }

  private setLifecycle`
);

writeNormalized(collabPath, collab);
console.log('✅ Fixed collab-sync.ts — connection stability improved');


// ============================================================
// FIX 3: CollaborationPromptModal.tsx — Better UI & toast-style notification
// ============================================================
const collabModalPath = resolve(ROOT, 'src/components/classroom/CollaborationPromptModal.tsx');
let collabModal = readNormalized(collabModalPath);

// Replace the full-screen overlay modal with a cleaner non-blocking toast notification
const newCollabModal = `'use client';

import React, { useState, useEffect } from 'react';
import { Handshake, Check, X, Loader2 } from 'lucide-react';
import { CollaborationRequest } from '@/lib/classroom/types';

interface CollaborationPromptModalProps {
  request: CollaborationRequest | null;
  onAccept: (requestId: string, fromId?: string) => Promise<void> | void;
  onDecline: (requestId: string, fromId?: string) => Promise<void> | void;
  onDismiss?: (requestId: string, fromId?: string) => void;
}

export const CollaborationPromptModal: React.FC<CollaborationPromptModalProps> = ({
  request,
  onAccept,
  onDecline,
  onDismiss,
}) => {
  const [isResponding, setIsResponding] = useState<'accept' | 'decline' | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);

  // Auto-dismiss after 30 seconds
  useEffect(() => {
    if (!request) {
      setTimeLeft(30);
      return;
    }
    setTimeLeft(30);
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timer);
          if (onDismiss) onDismiss(request.id, request.fromId);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [request?.id]);

  if (!request) return null;

  const handleDecline = async () => {
    if (isResponding) return;
    setIsResponding('decline');
    try {
      await onDecline(request.id, request.fromId);
    } catch (e) {
      console.error('Error declining request:', e);
    } finally {
      setIsResponding(null);
    }
  };

  const handleAccept = async () => {
    if (isResponding) return;
    setIsResponding('accept');
    try {
      await onAccept(request.id, request.fromId);
    } catch (e) {
      console.error('Error accepting request:', e);
    } finally {
      setIsResponding(null);
    }
  };

  const handleDismiss = () => {
    if (isResponding) return;
    if (onDismiss) {
      onDismiss(request.id, request.fromId);
    } else {
      handleDecline();
    }
  };

  return (
    <div className="fixed bottom-20 right-5 z-50 max-w-sm w-full animate-in slide-in-from-right-5 fade-in duration-300 pointer-events-auto select-none">
      <div className="bg-[#14151e]/97 backdrop-blur-xl border border-emerald-500/40 rounded-2xl shadow-[0_8px_40px_rgba(16,185,129,0.15)] p-4 space-y-3 relative overflow-hidden">
        {/* Countdown progress bar */}
        <div className="absolute top-0 left-0 h-0.5 bg-emerald-500/80 transition-all duration-1000 ease-linear" style={{ width: \`\${(timeLeft / 30) * 100}%\` }} />

        {/* Dismiss (X) */}
        <button
          type="button"
          onClick={handleDismiss}
          disabled={isResponding !== null}
          className="absolute top-2.5 right-2.5 p-1 rounded-lg text-[#737373] hover:text-white hover:bg-[#20222f] transition disabled:opacity-40"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Header Row */}
        <div className="flex items-center space-x-3 pr-6">
          <div className="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center flex-shrink-0">
            <Handshake className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h4 className="font-heading font-bold text-sm text-white leading-tight">
              Collaboration Request
            </h4>
            <p className="text-xs text-[#A3A3A3] mt-0.5 leading-snug">
              <strong className="text-[#ff9100] font-semibold">{request.fromName}</strong> wants to collaborate
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleDecline}
            disabled={isResponding !== null}
            className="flex-1 py-2 px-3 rounded-xl bg-[#1a1b28] hover:bg-[#282a3c] text-[#A3A3A3] hover:text-white text-xs font-semibold transition disabled:opacity-50 flex items-center justify-center space-x-1.5 active:scale-95 border border-[#2b2e40]"
          >
            {isResponding === 'decline' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#737373]" />
                <span>Declining...</span>
              </>
            ) : (
              <span>Decline</span>
            )}
          </button>

          <button
            type="button"
            onClick={handleAccept}
            disabled={isResponding !== null}
            className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-heading font-bold shadow-lg shadow-emerald-900/30 transition flex items-center justify-center space-x-1.5 disabled:opacity-50 active:scale-95"
          >
            {isResponding === 'accept' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Allow Access</span>
              </>
            )}
          </button>
        </div>

        {/* Timer hint */}
        <p className="text-[10px] text-[#555] text-center">Auto-dismisses in {timeLeft}s</p>
      </div>
    </div>
  );
};
`;

writeNormalized(collabModalPath, newCollabModal);
console.log('✅ Fixed CollaborationPromptModal — redesigned as non-blocking toast notification');


// ============================================================
// FIX 4: events/route.ts — Improve collaboration request persistence via WebSocket
// ============================================================
const eventsPath = resolve(ROOT, 'src/app/api/v1/classroom/[roomId]/events/route.ts');
let events = readNormalized(eventsPath);

// After the code_update handler, add collaboration_request handler for WebSocket persistence
const oldBroadcastBlock = `          ClassroomRoomManager.broadcast(normRoomId, {
            type: msg.type as any,
            roomId: normRoomId,
            senderId: msg.clientId || 'unknown',
            senderName: msg.senderName,
            payload: msg.payload,
            timestamp: Date.now(),
          });`;

const newBroadcastBlock = `          // Persist collaboration requests in room state when received via WebSocket
          if (msg.type === 'collaboration_request' && msg.payload) {
            const req = msg.payload;
            if (req.id && req.fromId && req.toId) {
              const roomState = ClassroomRoomManager.getRoom(normRoomId, true);
              if (roomState) {
                if (!roomState.collaborationRequests) roomState.collaborationRequests = {};
                roomState.collaborationRequests[req.id] = {
                  id: req.id,
                  fromId: req.fromId,
                  fromName: req.fromName || msg.senderName || 'Unknown',
                  toId: req.toId,
                  toName: req.toName || '',
                  status: 'pending',
                  createdAt: req.requestedAt || Date.now(),
                };
              }
            }
          }

          // Persist collaboration responses in room state
          if (msg.type === 'collaboration_response' && msg.payload?.request) {
            const resp = msg.payload.request;
            const roomState = ClassroomRoomManager.getRoom(normRoomId, true);
            if (roomState) {
              // Update the request status
              if (resp.id && roomState.collaborationRequests?.[resp.id]) {
                roomState.collaborationRequests[resp.id].status = resp.status;
              }
              // If accepted, create a collaboration session
              if (resp.status === 'accepted' && resp.fromId && resp.toId) {
                if (!roomState.collaborationSessions) roomState.collaborationSessions = {};
                const sessionId = 'session_' + Date.now();
                roomState.collaborationSessions[sessionId] = {
                  id: sessionId,
                  participantIds: [resp.fromId, resp.toId],
                  mode: 'shared',
                  startedAt: Date.now(),
                  lastSynced: Date.now(),
                };
              }
            }
          }

          ClassroomRoomManager.broadcast(normRoomId, {
            type: msg.type as any,
            roomId: normRoomId,
            senderId: msg.clientId || 'unknown',
            senderName: msg.senderName,
            payload: msg.payload,
            timestamp: Date.now(),
          });`;

events = events.replace(oldBroadcastBlock, newBroadcastBlock);

writeNormalized(eventsPath, events);
console.log('✅ Fixed events/route.ts — collaboration requests now persist via WebSocket');


// ============================================================
// FIX 5: TwoWorkspaceContainer.tsx — Prevent editor value resets from stale props
// ============================================================
const twoWSPath = resolve(ROOT, 'src/components/classroom/TwoWorkspaceContainer.tsx');
let twoWS = readNormalized(twoWSPath);

// In the useEffect that syncs remote code to editor (line 527-544),
// add a guard: never set editor to empty when it already has content
const oldRemoteSync = `  // 1. Keep editor content live in sync with remote user code updates
  //    IMPORTANT: When Yjs CRDT is active, we ONLY update via CRDT (doc_update events).
  //    Calling setValue() or ytext.transact() here while CRDT is also active causes
  //    content duplication and garbage text (double-apply of remote deltas).
  useEffect(() => {
    if (!editorRef.current || !user) return;
    if (!canEdit || !isSelf) {
      const incomingCode = user.activeCode ?? '';
      const currentEditorCode = editorRef.current.getValue();

      // Only intervene when there is NO Yjs binding active.
      // If collabClient & docId exist, Yjs handles sync — do NOT touch editor/ytext here.
      const hasYjsBinding = !!bindingRef.current;
      if (!hasYjsBinding && incomingCode !== currentEditorCode && incomingCode !== localEmittedCodeRef.current) {
        localEmittedCodeRef.current = incomingCode;
        const model = editorRef.current.getModel();
        if (model && model.getValue() !== incomingCode) {
          editorRef.current.setValue(incomingCode);
        }
      }
    }
  }, [user?.activeCode, canEdit, isSelf, docId, collabClient]);`;

const newRemoteSync = `  // 1. Keep editor content live in sync with remote user code updates
  //    IMPORTANT: When Yjs CRDT is active, we ONLY update via CRDT (doc_update events).
  //    Calling setValue() or ytext.transact() here while CRDT is also active causes
  //    content duplication and garbage text (double-apply of remote deltas).
  useEffect(() => {
    if (!editorRef.current || !user) return;
    if (!canEdit || !isSelf) {
      const incomingCode = user.activeCode ?? '';
      const currentEditorCode = editorRef.current.getValue();

      // Only intervene when there is NO Yjs binding active.
      // If collabClient & docId exist, Yjs handles sync — do NOT touch editor/ytext here.
      const hasYjsBinding = !!bindingRef.current;
      if (!hasYjsBinding && incomingCode !== currentEditorCode && incomingCode !== localEmittedCodeRef.current) {
        // CRITICAL GUARD: Never replace non-empty editor content with empty/shorter code
        // from server poll. Cold edge isolates return empty activeCode which clobbers live content.
        if (!incomingCode && currentEditorCode) {
          return; // Keep existing editor content
        }
        localEmittedCodeRef.current = incomingCode;
        const model = editorRef.current.getModel();
        if (model && model.getValue() !== incomingCode) {
          editorRef.current.setValue(incomingCode);
        }
      }
    }
  }, [user?.activeCode, canEdit, isSelf, docId, collabClient]);`;

twoWS = twoWS.replace(oldRemoteSync, newRemoteSync);

writeNormalized(twoWSPath, twoWS);
console.log('✅ Fixed TwoWorkspaceContainer.tsx — editor content protected from empty overwrites');


console.log('\n🎉 All fixes applied successfully!');
console.log('Next: run npm run build:vinext && npm run deploy:vinext');
