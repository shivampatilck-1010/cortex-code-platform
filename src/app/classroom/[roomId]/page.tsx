'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Copy, 
  Check, 
  Users, 
  MessageSquare, 
  Settings, 
  LogOut, 
  Scale, 
  AlertTriangle,
  Radio,
  SlidersHorizontal,
  X,
  Play,
  Clock,
  Sparkles
} from 'lucide-react';
import { CortexLogo } from '@/components/brand/CortexLogo';
import { ClassroomRoom, ClassroomParticipant, ClassroomRole, CollaborationRequest, FileDownloadRequest, FileDownloadDecision, CollaborationDecision } from '@/lib/classroom/types';
import { CollaborationClient } from '@/lib/classroom/collab-sync';
import { UserListPanel } from '@/components/classroom/UserListPanel';
import { TwoWorkspaceContainer } from '@/components/classroom/TwoWorkspaceContainer';
import { CollaborationPromptModal } from '@/components/classroom/CollaborationPromptModal';
import { FileDownloadModal } from '@/components/classroom/FileDownloadModal';
import { ClassroomAdminSettingsModal } from '@/components/classroom/ClassroomAdminSettingsModal';
import { UserPrivacyModal } from '@/components/classroom/UserPrivacyModal';
import { ClassroomChatDrawer } from '@/components/classroom/ClassroomChatDrawer';
import { ClassroomLobbyModal } from '@/components/classroom/ClassroomLobbyModal';

export default function ClassroomLivePage() {
  const params = useParams();
  const router = useRouter();
  const rawRoomId = (params?.roomId as string) || '';
  const roomId = rawRoomId.toUpperCase().trim();

  // Participant session state
  const [participantId, setParticipantId] = useState<string>('');
  const [participantName, setParticipantName] = useState<string>('');
  const [participantRole, setParticipantRole] = useState<ClassroomRole>('user');
  const [isJoinNeeded, setIsJoinNeeded] = useState(false);

  // Room state
  const [room, setRoom] = useState<ClassroomRoom | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Slot selections
  const [slotAUserId, setSlotAUserId] = useState<string | undefined>(undefined);
  const [slotBUserId, setSlotBUserId] = useState<string | undefined>(undefined);

  // Modals & Panels
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isAdminSettingsOpen, setIsAdminSettingsOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Pending incoming requests
  const [incomingCollabReq, setIncomingCollabReq] = useState<CollaborationRequest | null>(null);
  const [incomingDownloadReq, setIncomingDownloadReq] = useState<FileDownloadRequest | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'syncing' | 'offline'>('syncing');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 4000);
  };

  const collabClientRef = useRef<CollaborationClient | null>(null);
  const codeSaveTimersRef = useRef<{ [key: string]: any }>({});

  // 1. Restore participant from localStorage or prompt to join
  useEffect(() => {
    if (typeof window === 'undefined' || !roomId) return;

    const savedId = localStorage.getItem(`cortex_participant_${roomId}`);
    const savedName = localStorage.getItem(`cortex_name_${roomId}`);
    const savedRole = (localStorage.getItem(`cortex_role_${roomId}`) as ClassroomRole) || 'user';

    if (savedId && savedName) {
      setParticipantId(savedId);
      setParticipantName(savedName);
      setParticipantRole(savedRole);
      fetchRoomState(savedId, savedName, savedRole);
    } else {
      setIsJoinNeeded(true);
      setIsLoading(false);
      fetchRoomState();
    }
  }, [roomId]);

  const activeSessionPartnerIdsRef = useRef<Set<string>>(new Set());

  const isRoomDifferent = (prev: ClassroomRoom, next: ClassroomRoom): boolean => {
    if (prev.state !== next.state) return true;
    if (prev.admin?.enteredArena !== next.admin?.enteredArena) return true;
    if (prev.activeWorkspaces?.slotAUserId !== next.activeWorkspaces?.slotAUserId) return true;
    if (prev.activeWorkspaces?.slotBUserId !== next.activeWorkspaces?.slotBUserId) return true;
    if ((prev.chatMessages?.length || 0) !== (next.chatMessages?.length || 0)) return true;
    if (Object.keys(prev.collaborationRequests || {}).length !== Object.keys(next.collaborationRequests || {}).length) return true;
    if (Object.keys(prev.collaborationSessions || {}).length !== Object.keys(next.collaborationSessions || {}).length) return true;
    if (Object.keys(prev.downloadRequests || {}).length !== Object.keys(next.downloadRequests || {}).length) return true;

    const prevP = Object.values(prev.participants || {});
    const nextP = Object.values(next.participants || {});
    if (prevP.length !== nextP.length) return true;

    for (const np of nextP) {
      const pp = prev.participants[np.id];
      if (!pp) return true;
      if (pp.online !== np.online) return true;
      if (pp.status !== np.status) return true;
      if (pp.name !== np.name) return true;
      if (pp.currentLanguage !== np.currentLanguage) return true;
      if (pp.activeCode !== np.activeCode) return true;
      if (pp.isLocked !== np.isLocked) return true;
    }
    return false;
  };

  // Unified real-time state applier: updates slots, pending requests, and sessions instantly
  const applyRoomState = (newRoom: ClassroomRoom, activeId?: string) => {
    if (!newRoom) return;
    const myId = activeId || participantId;

    // Propagate participants gossip to collab client to keep all edge isolates perfectly synced
    if (collabClientRef.current && newRoom.participants) {
      collabClientRef.current.updateKnownParticipants(
        Object.values(newRoom.participants).filter((p) => p && p.id && p.name && p.name !== 'Classroom Host')
      );
    }

    // Only update state if room data actually changed to eliminate UI flickering and fluctuation
    setRoom((prev) => {
      if (prev && !isRoomDifferent(prev, newRoom)) {
        return prev;
      }
      return newRoom;
    });

    // 1. Synchronize Workspaces Slots
    if (newRoom.activeWorkspaces) {
      if (newRoom.activeWorkspaces.slotAUserId) {
        setSlotAUserId(newRoom.activeWorkspaces.slotAUserId);
      }
      if (newRoom.activeWorkspaces.slotBUserId) {
        setSlotBUserId(newRoom.activeWorkspaces.slotBUserId);
      }
    }

    // 2. Auto-mount second user to slot B only if slot B is completely vacant
    if (!slotBUserId && newRoom.participants && !newRoom.activeWorkspaces?.slotBUserId) {
      const otherUser = Object.values(newRoom.participants).find(
        (p) => p && p.id && p.id !== (newRoom.activeWorkspaces?.slotAUserId || slotAUserId) && p.id !== myId && p.name !== 'Classroom Host'
      );
      if (otherUser) {
        setSlotBUserId(otherUser.id);
      }
    }

    // 3. Track active collaboration sessions & trigger toast when collaboration is established
    if (myId && newRoom.collaborationSessions) {
      const activeSessions = Object.values(newRoom.collaborationSessions);
      const myActiveSessions = activeSessions.filter((s: any) => s.participantIds?.includes(myId));
      
      myActiveSessions.forEach((s: any) => {
        s.participantIds?.forEach((pid: string) => {
          if (pid !== myId && !activeSessionPartnerIdsRef.current.has(pid)) {
            activeSessionPartnerIdsRef.current.add(pid);
            const partnerName = newRoom.participants[pid]?.name || 'Collaborator';
            showToast(`🎉 Real-time collaboration active with ${partnerName}!`);
          }
        });
      });

      const currentActiveIds = new Set<string>();
      myActiveSessions.forEach((s: any) => s.participantIds?.forEach((pid: string) => {
        if (pid !== myId) currentActiveIds.add(pid);
      }));
      activeSessionPartnerIdsRef.current = currentActiveIds;
    }

    // 4. Synchronize pending incoming collaboration requests in real time:
    if (newRoom.collaborationRequests && myId) {
      const activePartnerIds = new Set<string>();
      Object.values(newRoom.collaborationSessions || {}).forEach((s: any) => {
        if (s.participantIds?.includes(myId)) {
          s.participantIds.forEach((pid: string) => {
            if (pid !== myId) activePartnerIds.add(pid);
          });
        }
      });

      const myCollabReq = Object.values(newRoom.collaborationRequests).find(
        (r: any) => r.toId === myId && r.status === 'pending' && !activePartnerIds.has(r.fromId)
      );
      setIncomingCollabReq(myCollabReq ? (myCollabReq as any) : null);
    } else {
      setIncomingCollabReq(null);
    }

    // 5. Synchronize pending incoming file download requests for this participant:
    if (newRoom.downloadRequests && myId) {
      const myDownloadReq = Object.values(newRoom.downloadRequests).find(
        (r: any) => r.ownerId === myId && r.status === 'pending'
      );
      setIncomingDownloadReq(myDownloadReq ? (myDownloadReq as any) : null);
    } else {
      setIncomingDownloadReq(null);
    }
  };

  // 2. Fetch Room State with gossip participants
  const fetchRoomState = async (pId?: string, pName?: string, pRole?: ClassroomRole) => {
    try {
      const activeId = pId || participantId;
      const activeName = pName || participantName;
      const activeRole = pRole || participantRole;

      const queryParams = new URLSearchParams();
      if (activeId) queryParams.set('requesterId', activeId);
      if (activeName) queryParams.set('requesterName', activeName);
      if (activeRole) queryParams.set('requesterRole', activeRole);

      const known = collabClientRef.current?.getKnownParticipants?.() || [];
      if (known.length > 0) {
        queryParams.set('clientParticipants', JSON.stringify(known));
      }

      const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';

      const res = await fetch(`/api/v1/classroom/${roomId}${queryStr}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load classroom state');
      }

      applyRoomState(data.room, activeId);
      setError(null);
    } catch (err: any) {
      if (!participantId && !pId) {
        setIsJoinNeeded(true);
      }
      setError(err?.message || 'Error loading classroom');
    } finally {
      setIsLoading(false);
    }
  };

  // Launch the Code Arena for everyone in real time
  const handleStartClassroom = async () => {
    try {
      const res = await fetch(`/api/v1/classroom/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start_classroom',
          participantId,
        }),
      });
      const data = await res.json();
      if (data.success && data.room) {
        applyRoomState(data.room);
        collabClientRef.current?.triggerImmediateSync();
        showToast('🚀 Code Arena launched for all waiting participants!');
      }
    } catch (err) {
      console.error('Failed to launch classroom arena', err);
    }
  };

  // Auto-launch Code Arena for everyone as soon as Admin enters
  useEffect(() => {
    if (participantRole === 'admin' && room && (room.state === 'created' || !room.admin?.enteredArena)) {
      handleStartClassroom();
    }
  }, [participantRole, room?.state, room?.admin?.enteredArena]);

  // 3. Connect Real-time event transport with resilient polling
  useEffect(() => {
    if (!roomId || !participantId || !participantName) return;

    const client = new CollaborationClient(roomId, participantId, participantName, participantRole);
    collabClientRef.current = client;

    const unsubscribeEvents = client.onEvent((event) => {
      handleIncomingRealtimeEvent(event);
    });

    const unsubscribeStatus = client.onStatusChange((status) => {
      setConnectionStatus(status);
    });

    return () => {
      unsubscribeEvents();
      unsubscribeStatus();
      client.cleanup();
    };
  }, [roomId, participantId, participantName, participantRole]);

  // 4. Handle incoming real-time events
  const handleIncomingRealtimeEvent = (event: any) => {
    switch (event.type) {
      case 'room_state':
        if (event.payload?.room) {
          applyRoomState(event.payload.room);
        }
        break;

      case 'join':
        fetchRoomState(participantId);
        break;

      case 'code_update': {
        const { participantId: updatedId, code, language } = event.payload || {};
        if (updatedId && updatedId !== participantId) {
          setRoom((prev) => {
            if (!prev || !prev.participants[updatedId]) return prev;
            return {
              ...prev,
              participants: {
                ...prev.participants,
                [updatedId]: {
                  ...prev.participants[updatedId],
                  ...(code !== undefined ? { activeCode: code } : {}),
                  ...(language !== undefined ? { currentLanguage: language } : {}),
                },
              },
            };
          });
        }
        break;
      }

      case 'user_updated': {
        const { participantId: updatedId, activeCode, currentLanguage, activeFileName, status } = event.payload || {};
        if (updatedId && updatedId !== participantId) {
          setRoom((prev) => {
            if (!prev || !prev.participants[updatedId]) return prev;
            return {
              ...prev,
              participants: {
                ...prev.participants,
                [updatedId]: {
                  ...prev.participants[updatedId],
                  ...(activeCode !== undefined ? { activeCode } : {}),
                  ...(currentLanguage !== undefined ? { currentLanguage } : {}),
                  ...(activeFileName !== undefined ? { activeFileName } : {}),
                  ...(status !== undefined ? { status } : {}),
                },
              },
            };
          });
        }
        break;
      }

      case 'presence':
        if (event.senderId !== participantId) {
          fetchRoomState(participantId);
        }
        break;

      case 'select_workspaces':
        if (event.payload) {
          setSlotAUserId(event.payload.slotAUserId);
          setSlotBUserId(event.payload.slotBUserId);
        }
        break;

      case 'collaboration_request': {
        const req = event.payload;
        if (req?.toId === participantId) {
          // Check if already in an active session with this user
          const isAlreadyPartner = room && Object.values(room.collaborationSessions || {}).some(
            (s: any) => s.participantIds?.includes(participantId) && s.participantIds?.includes(req.fromId)
          );
          if (!isAlreadyPartner) {
            setIncomingCollabReq(req);
          }
        }
        break;
      }

      case 'collaboration_response': {
        const { request, session, activeWorkspaces } = event.payload || {};
        if (activeWorkspaces) {
          setSlotAUserId(activeWorkspaces.slotAUserId);
          setSlotBUserId(activeWorkspaces.slotBUserId);
        } else if (session?.participantIds) {
          setSlotAUserId(session.participantIds[0]);
          setSlotBUserId(session.participantIds[1]);
        }
        if (request && (request.fromId === participantId || request.toId === participantId)) {
          // Dismiss any open incoming prompt from this partner immediately
          setIncomingCollabReq(null);
          if (request.status === 'accepted') {
            const partner = request.fromId === participantId ? request.toName : request.fromName;
            showToast(`🎉 Access approved! Real-time collaboration active with ${partner}.`);
          } else if (request.status === 'declined') {
            const partner = request.fromId === participantId ? request.toName : request.fromName;
            showToast(`Access request was declined by ${partner}.`);
          }
        }
        fetchRoomState(participantId);
        break;
      }

      case 'end_collaboration':
        fetchRoomState(participantId);
        showToast('Collaboration session ended.');
        break;

      case 'file_download_request':
        if (event.payload?.ownerId === participantId) {
          setIncomingDownloadReq(event.payload);
        }
        break;

      case 'file_download_response': {
        const { request, token, fileId } = event.payload || {};
        if (request?.requesterId === participantId) {
          if (request.status === 'allow_once' || request.status === 'allow_session') {
            showToast(`✅ Download approved by ${request.ownerName}!`);
            if (token && fileId) {
              window.open(`/api/v1/classroom/${roomId}/file-download?fileId=${fileId}&token=${token}&requesterId=${participantId}`);
            }
          } else if (request.status === 'denied') {
            showToast(`❌ Download request was denied by ${request.ownerName}.`);
          }
        }
        fetchRoomState(participantId);
        break;
      }

      case 'chat_message':
        setRoom((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            chatMessages: [...prev.chatMessages, event.payload],
          };
        });
        break;

      case 'admin_action':
        fetchRoomState(participantId);
        break;

      case 'classroom_started':
        setRoom((prev) => prev ? { ...prev, state: 'active', admin: { ...prev.admin, enteredArena: true } } : prev);
        fetchRoomState(participantId);
        showToast('🚀 Admin has entered the arena! Starting session for everyone...');
        break;

      case 'classroom_ended':
        setError('The Admin has ended this classroom session.');
        break;
    }
  };

  // Actions with low-latency typing & debounced persistence
  const handleCodeChangeA = (code: string) => {
    if (!slotAUserId) return;
    setRoom((prev) => {
      if (!prev || !prev.participants[slotAUserId]) return prev;
      return {
        ...prev,
        participants: {
          ...prev.participants,
          [slotAUserId]: {
            ...prev.participants[slotAUserId],
            activeCode: code,
          },
        },
      };
    });

    const isAuthorizedA = slotAUserId === participantId || (
      room && Object.values(room.collaborationSessions || {}).some(
        (s: any) => s.participantIds?.includes(participantId) && s.participantIds?.includes(slotAUserId)
      )
    );

    if (isAuthorizedA) {
      // 1. Ultra low-latency broadcast via WebSocket
      collabClientRef.current?.sendCodeUpdate(code, undefined, slotAUserId);

      // 2. Debounce HTTP persistence write by 300ms to eliminate network congestion
      if (codeSaveTimersRef.current['slotA']) {
        clearTimeout(codeSaveTimersRef.current['slotA']);
      }
      codeSaveTimersRef.current['slotA'] = setTimeout(async () => {
        try {
          await fetch(`/api/v1/classroom/${roomId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update_code',
              participantId: slotAUserId,
              targetUserId: slotAUserId,
              code,
            }),
          });
        } catch (e) {
          console.error('Code save error', e);
        }
      }, 300);
    }
  };

  const handleCodeChangeB = (code: string) => {
    if (!slotBUserId) return;
    setRoom((prev) => {
      if (!prev || !prev.participants[slotBUserId]) return prev;
      return {
        ...prev,
        participants: {
          ...prev.participants,
          [slotBUserId]: {
            ...prev.participants[slotBUserId],
            activeCode: code,
          },
        },
      };
    });

    const isAuthorizedB = slotBUserId === participantId || (
      room && Object.values(room.collaborationSessions || {}).some(
        (s: any) => s.participantIds?.includes(participantId) && s.participantIds?.includes(slotBUserId)
      )
    );

    if (isAuthorizedB) {
      // 1. Ultra low-latency broadcast via WebSocket
      collabClientRef.current?.sendCodeUpdate(code, undefined, slotBUserId);

      // 2. Debounce HTTP persistence write by 300ms to eliminate network congestion
      if (codeSaveTimersRef.current['slotB']) {
        clearTimeout(codeSaveTimersRef.current['slotB']);
      }
      codeSaveTimersRef.current['slotB'] = setTimeout(async () => {
        try {
          await fetch(`/api/v1/classroom/${roomId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update_code',
              participantId: slotBUserId,
              targetUserId: slotBUserId,
              code,
            }),
          });
        } catch (e) {
          console.error('Code save error', e);
        }
      }, 300);
    }
  };

  const handleSelectSlotA = async (userId: string) => {
    setSlotAUserId(userId);
    await fetch(`/api/v1/classroom/${roomId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'select_workspaces',
        participantId,
        slotAUserId: userId,
        slotBUserId,
      }),
    });
    collabClientRef.current?.triggerImmediateSync();
  };

  const handleSelectSlotB = async (userId: string) => {
    setSlotBUserId(userId);
    await fetch(`/api/v1/classroom/${roomId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'select_workspaces',
        participantId,
        slotAUserId,
        slotBUserId: userId,
      }),
    });
    collabClientRef.current?.triggerImmediateSync();
  };

  const handleRequestCollaboration = async (targetUserId: string) => {
    try {
      const res = await fetch(`/api/v1/classroom/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request_collaboration',
          participantId,
          targetUserId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to request access');
      }
      const targetUser = room?.participants[targetUserId];
      showToast(`Access request sent to ${targetUser?.name || 'participant'}! Waiting for response...`);
      collabClientRef.current?.triggerImmediateSync();
    } catch (err: any) {
      showToast(`⚠️ ${err?.message || 'Failed to send request'}`);
    }
  };

  const handleRespondCollaboration = async (requestId: string, decision: CollaborationDecision) => {
    const targetReq = incomingCollabReq;
    setIncomingCollabReq(null);
    try {
      const res = await fetch(`/api/v1/classroom/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'respond_collaboration',
          participantId,
          requestId,
          decision,
        }),
      });
      const data = await res.json();
      if (decision === 'accepted') {
        const partnerId = targetReq?.fromId;
        if (partnerId) {
          setSlotAUserId(participantId);
          setSlotBUserId(partnerId);
          showToast(`🎉 Access approved! Real-time collaboration active with ${targetReq.fromName || 'participant'}.`);
        }
      } else {
        showToast('Access request declined.');
      }

      // Instantly clear all requests from/to this user locally
      if (targetReq?.fromId) {
        setRoom((prev) => {
          if (!prev) return prev;
          const updatedCollabRequests = { ...prev.collaborationRequests };
          Object.keys(updatedCollabRequests).forEach((id) => {
            const r = updatedCollabRequests[id];
            if (
              (r.fromId === targetReq.fromId && r.toId === participantId) ||
              (r.fromId === participantId && r.toId === targetReq.fromId)
            ) {
              r.status = decision;
            }
          });
          return {
            ...prev,
            collaborationRequests: updatedCollabRequests,
          };
        });
      }

      collabClientRef.current?.triggerImmediateSync();
      fetchRoomState(participantId);
    } catch (e) {
      console.error(e);
    }
  };

  const handleEndCollaboration = async (sessionId: string) => {
    await fetch(`/api/v1/classroom/${roomId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'end_collaboration',
        participantId,
        sessionId,
      }),
    });
    collabClientRef.current?.triggerImmediateSync();
    fetchRoomState(participantId);
  };

  const handleRequestFileDownload = async (ownerId: string, fileId: string) => {
    try {
      const res = await fetch(`/api/v1/classroom/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request_download',
          participantId,
          ownerId,
          fileId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to request download');
      }
      const owner = room?.participants[ownerId];
      showToast(`Download permission requested from ${owner?.name || 'owner'}! Waiting for response...`);
      collabClientRef.current?.triggerImmediateSync();
    } catch (err: any) {
      showToast(`⚠️ ${err?.message || 'Failed to request download'}`);
    }
  };

  const handleRespondDownload = async (requestId: string, decision: FileDownloadDecision) => {
    setIncomingDownloadReq(null);
    await fetch(`/api/v1/classroom/${roomId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'respond_download',
        participantId,
        requestId,
        decision,
      }),
    });
    collabClientRef.current?.triggerImmediateSync();
  };

  const handleAdminAction = async (adminAction: any) => {
    await fetch(`/api/v1/classroom/${roomId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'admin_action',
        participantId,
        adminAction,
      }),
    });
    collabClientRef.current?.triggerImmediateSync();
  };

  const handleSendChat = async (text: string, isAnnouncement = false) => {
    await fetch(`/api/v1/classroom/${roomId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send_chat',
        participantId,
        text,
        isAnnouncement,
      }),
    });
    collabClientRef.current?.triggerImmediateSync();
  };

  const handleUpdatePrivacy = async (privacy: any) => {
    await fetch(`/api/v1/classroom/${roomId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_privacy',
        participantId,
        privacy,
      }),
    });
    fetchRoomState(participantId);
  };

  const handleLeaveClassroom = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`cortex_participant_${roomId}`);
      localStorage.removeItem(`cortex_name_${roomId}`);
      localStorage.removeItem(`cortex_role_${roomId}`);
    }
    router.push('/classroom');
  };

  if (isJoinNeeded) {
    return (
      <div className="h-screen w-screen bg-[#0b0c0e]">
        <ClassroomLobbyModal
          isOpen={true}
          defaultRoomId={roomId}
          onClose={() => {
            router.push('/classroom');
          }}
          onCreateRoom={async (adminName: string) => {
            const res = await fetch('/api/v1/classroom', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'create', name: adminName }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create classroom');
            if (typeof window !== 'undefined') {
              localStorage.setItem(`cortex_participant_${data.roomId}`, data.participantId);
              localStorage.setItem(`cortex_name_${data.roomId}`, data.participantName);
              localStorage.setItem(`cortex_role_${data.roomId}`, data.role);
            }
            router.push(`/classroom/${data.roomId}`);
            return data;
          }}
          onEnterRoom={(newRoomId) => {
            router.push(`/classroom/${newRoomId}`);
          }}
          onJoinRoom={async (rid, name) => {
            const targetId = rid.toUpperCase().trim() || roomId;
            const res = await fetch('/api/v1/classroom', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'join', roomId: targetId, name }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'Failed to join classroom');

            if (typeof window !== 'undefined') {
              localStorage.setItem(`cortex_participant_${data.roomId}`, data.participantId);
              localStorage.setItem(`cortex_name_${data.roomId}`, data.participantName);
              localStorage.setItem(`cortex_role_${data.roomId}`, data.role);
            }

            setParticipantId(data.participantId);
            setParticipantName(data.participantName);
            setParticipantRole(data.role);
            setIsJoinNeeded(false);
            if (targetId !== roomId) {
              router.push(`/classroom/${targetId}`);
            } else {
              fetchRoomState(data.participantId, data.participantName, data.role);
            }
          }}
        />
      </div>
    );
  }

  const userA = room && slotAUserId ? room.participants[slotAUserId] : null;
  const userB = room && slotBUserId ? room.participants[slotBUserId] : null;

  const validParticipants = room
    ? Object.values(room.participants).filter((p) => p && p.id && p.name && p.name !== 'Classroom Host')
    : [];
  const currentParticipant = room?.participants[participantId];
  const onlineParticipantsCount = validParticipants.filter((p) => p.online).length;
  const totalParticipantsCount = validParticipants.length;

  // Waiting room is strictly for when the room has not started, admin hasn't entered, and no active admin is in roster
  const hasActiveAdminInRoom = Boolean(
    room?.admin?.enteredArena ||
    room?.state === 'active' ||
    validParticipants.some((p) => p.role === 'admin' && (p.online || Date.now() - (p.lastActive || 0) < 1800000))
  );

  const isWaitingForAdmin =
    participantRole !== 'admin' &&
    room !== null &&
    room.state !== 'active' &&
    !hasActiveAdminInRoom;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0b0c0e] text-gray-200 font-sans select-none overflow-hidden">
      {/* 1. Global Header Bar */}
      <header className="h-12 bg-[#101116] border-b border-[#1f2026] px-3 sm:px-4 flex items-center justify-between z-30">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <Link href="/" className="flex items-center group transition" title="Return to IDE">
            <CortexLogo variant="header" size="sm" />
          </Link>

          {/* Breadcrumbs */}
          <div className="flex items-center space-x-1.5 text-xs font-heading">
            <span className="text-gray-600">/</span>
            <Link href="/" className="text-gray-400 hover:text-white transition">
              IDE
            </Link>
            <span className="text-gray-600">/</span>
            <Link href="/classroom" className="text-gray-400 hover:text-white transition">
              Classroom
            </Link>
            <span className="text-gray-600">/</span>
            
            {/* Room ID Badge & Copy Link */}
            <div className="flex items-center space-x-1.5">
              <span className="font-mono font-bold text-xs text-[#ff9100] tracking-wider">
                {roomId}
              </span>

              <button
                onClick={() => {
                  const url = `${window.location.origin}/classroom/${roomId}`;
                  navigator.clipboard.writeText(url);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 1500);
                }}
                className="px-1.5 py-0.5 rounded bg-[#1b1c24] hover:bg-[#252834] text-[10.5px] text-gray-300 transition flex items-center space-x-1"
                title="Copy student invitation link"
              >
                {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span className="hidden md:inline">{copiedLink ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

        </div>

        {/* Center / Right Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Admin Start Arena for Everyone Button */}
          {participantRole === 'admin' && room?.state === 'created' && (
            <button
              onClick={handleStartClassroom}
              className="flex items-center space-x-1.5 px-3 py-1 rounded bg-gradient-to-r from-amber-500 to-orange-500 text-black font-heading font-bold text-xs shadow-lg hover:from-amber-400 hover:to-orange-400 transition animate-pulse"
              title="Start the Code Arena for all waiting participants"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Arena for Everyone</span>
            </button>
          )}

          {/* Arena Active indicator for Admin */}
          {participantRole === 'admin' && room?.state === 'active' && (
            <span className="hidden md:flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-950/40 text-[11px] font-mono text-emerald-300 border border-emerald-800/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Arena Active</span>
            </span>
          )}

          {/* Quick link to Benchmark with current pair */}
          <Link
            href={`/compare?room=${roomId}&userA=${slotAUserId || ''}&userB=${slotBUserId || ''}`}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#181920] hover:bg-[#242634] text-xs font-semibold text-cyan-300 border border-cyan-800/40 transition"
            title="Benchmark this pair in compare view"
          >
            <Scale className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Benchmark</span>
          </Link>

          {/* Connection Status Badge */}
          <span className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-[#16171e] text-[11px] font-mono border border-[#262834]">
            <span className={`w-2 h-2 rounded-full ${
              connectionStatus === 'online' ? 'bg-emerald-400 animate-pulse' : connectionStatus === 'syncing' ? 'bg-amber-400 animate-ping' : 'bg-rose-400'
            }`} />
            <span className={connectionStatus === 'online' ? 'text-emerald-400' : connectionStatus === 'syncing' ? 'text-amber-400' : 'text-rose-400'}>
              {connectionStatus === 'online' ? 'Live' : connectionStatus === 'syncing' ? 'Syncing' : 'Offline'}
            </span>
          </span>

          {/* Online Counter Badge */}
          <span className="hidden sm:flex items-center space-x-1 px-2 py-0.5 rounded bg-[#16171e] text-[11px] font-mono text-gray-300 border border-[#262834]">
            <span>{onlineParticipantsCount} online</span>
          </span>

          {/* Chat Toggle */}
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`p-1.5 rounded transition relative ${
              isChatOpen ? 'bg-[#ff9100]/20 text-[#ff9100]' : 'text-gray-400 hover:text-white hover:bg-[#1a1c22]'
            }`}
            title="Toggle Classroom Chat"
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          {/* Admin Settings Modal Toggle */}
          {participantRole === 'admin' && (
            <button
              onClick={() => setIsAdminSettingsOpen(true)}
              className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-[#1a1c22] transition"
              title="Classroom Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          {/* Current User Profile Badge */}
          {participantName && (
            <div className="flex items-center space-x-1.5 px-2 py-1 rounded bg-[#161720] border border-[#272a38] text-xs shadow-inner">
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#ff9100] to-[#ffa733] text-black flex items-center justify-center font-bold text-[10px] shadow-sm">
                {participantName.charAt(0).toUpperCase()}
              </div>
              <span className="font-medium text-gray-200 text-xs max-w-[90px] truncate" title={participantName}>
                {participantName}
              </span>
              <span className={`text-[9.5px] px-1.5 py-0.5 rounded font-mono font-medium ${
                participantRole === 'admin' 
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                {participantRole === 'admin' ? 'Admin' : 'You'}
              </span>
            </div>
          )}

          {/* Leave Classroom */}
          <button
            onClick={handleLeaveClassroom}
            className="px-2.5 py-1 rounded text-xs font-medium text-rose-400 hover:text-rose-200 hover:bg-rose-950/40 border border-rose-900/40 transition flex items-center space-x-1"
            title="Leave Classroom"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </header>

      {/* 2. Error Notice if any */}
      {error && !isJoinNeeded && (
        <div className="bg-rose-950/60 border-b border-rose-800/60 p-2 text-center text-xs text-rose-300 font-medium flex items-center justify-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* 3. Main Body: Live Waiting Room for Students OR Full Collaborative Arena */}
      {isWaitingForAdmin ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-[#0e1017] to-[#07080a] relative overflow-hidden select-none">
          {/* Ambient background glow */}
          <div className="absolute top-1/3 w-96 h-96 bg-[#ff9100]/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative max-w-lg w-full bg-[#12141c]/90 border border-[#222533] backdrop-blur-xl rounded-2xl p-8 shadow-2xl space-y-6">
            {/* Animated Pulse Icon */}
            <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-[#ff9100]/20 animate-ping" />
              <div className="relative w-16 h-16 rounded-full bg-[#ff9100]/10 border border-[#ff9100]/40 flex items-center justify-center text-[#ff9100]">
                <Clock className="w-8 h-8" />
              </div>
            </div>

            {/* Title & Status */}
            <div className="space-y-2">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-semibold">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>Waiting for Admin to enter the arena...</span>
              </div>
              <h2 className="text-xl font-heading font-bold text-gray-100">
                Classroom Waiting Room
              </h2>
              <p className="text-xs text-gray-400 leading-relaxed max-w-md mx-auto">
                Welcome <strong className="text-gray-200">{participantName}</strong>! The Admin is preparing the classroom session. As soon as the Admin enters the Code Arena, your workspace will automatically launch in real-time.
              </p>
            </div>

            {/* Realtime No-Refresh Banner */}
            <div className="p-3 bg-[#181a24] border border-[#262938] rounded-xl flex items-center space-x-3 text-left">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Radio className="w-4 h-4 animate-pulse" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-emerald-300">Live edge synchronization active</div>
                <div className="text-[11px] text-gray-400">Do not refresh your browser — updates happen automatically.</div>
              </div>
            </div>

            {/* Waiting Lobby Participants */}
            <div className="space-y-2 text-left">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-400 px-1">
                <span>Connected Participants:</span>
                <span className="text-[11px] font-mono text-emerald-400 font-bold">{onlineParticipantsCount} ready</span>
              </div>
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2.5 bg-[#0c0d12] rounded-lg border border-[#1e202b]">
                {validParticipants.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-[#161822] border border-[#262838] text-xs"
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-medium text-gray-200">{p.name}</span>
                    {p.role === 'admin' && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded font-mono font-bold">Admin</span>
                    )}
                    {p.id === participantId && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded font-mono font-bold">You</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Action footer */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs border-t border-[#1e202b]">
              <span className="font-mono text-gray-500">Room: <strong className="text-[#ff9100] font-bold">{roomId}</strong></span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    fetchRoomState(participantId, participantName, participantRole);
                    collabClientRef.current?.triggerImmediateSync();
                    showToast('Checking arena status...');
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#20222f] hover:bg-[#2b2e40] text-gray-200 border border-[#34384e] transition flex items-center space-x-1.5"
                  title="Check if Admin has entered the arena"
                >
                  <Radio className="w-3 h-3 text-[#ff9100] animate-pulse" />
                  <span>Check Status</span>
                </button>
                <button
                  onClick={handleLeaveClassroom}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-400 hover:text-rose-200 hover:bg-rose-950/40 border border-rose-900/40 transition flex items-center space-x-1"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Leave Classroom</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* 3. Main Body Arena (Left: User List | Center: Two Workspaces | Right: Chat Drawer) */
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar: All Classroom Users */}
          <div className="w-64 sm:w-72 flex-shrink-0 h-full">
            <UserListPanel
              participants={room?.participants || {}}
              currentUserId={participantId}
              currentUserRole={participantRole}
              slotAUserId={slotAUserId}
              slotBUserId={slotBUserId}
              onSelectSlotA={handleSelectSlotA}
              onSelectSlotB={handleSelectSlotB}
              onRequestCollaboration={handleRequestCollaboration}
              onRequestFileDownload={handleRequestFileDownload}
              onAdminAction={handleAdminAction}
              onOpenPrivacyModal={() => setIsPrivacyOpen(true)}
            />
          </div>

          {/* Center: Strict Two-Workspace Model (Workspace A | Workspace B) */}
          <div className="flex-1 h-full min-w-0">
            <TwoWorkspaceContainer
              userA={userA}
              userB={userB}
              currentUserId={participantId}
              currentUserRole={participantRole}
              activeSession={
                room ? Object.values(room.collaborationSessions).find(s => s.participantIds.includes(participantId)) : null
              }
              onCodeChangeA={handleCodeChangeA}
              onCodeChangeB={handleCodeChangeB}
              onEndCollaboration={handleEndCollaboration}
              onRequestViewAccess={(targetId) => {
                handleRequestCollaboration(targetId);
              }}
              onDownloadFile={(ownerId, fileId) => {
                handleRequestFileDownload(ownerId, fileId);
              }}
            />
          </div>

          {/* Right Drawer: Classroom Chat & Announcements */}
          <ClassroomChatDrawer
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            messages={room?.chatMessages || []}
            currentUserId={participantId}
            currentUserRole={participantRole}
            onSendMessage={handleSendChat}
          />
        </div>
      )}

      {/* Incoming Collaboration Request Modal (Mutual Consent) */}
      <CollaborationPromptModal
        request={incomingCollabReq}
        onAccept={(id) => handleRespondCollaboration(id, 'accepted')}
        onDecline={(id) => handleRespondCollaboration(id, 'declined')}
      />

      {/* Incoming File Download Request Modal */}
      <FileDownloadModal
        request={incomingDownloadReq}
        onRespond={handleRespondDownload}
      />

      {/* Admin Settings Modal */}
      {room && (
        <ClassroomAdminSettingsModal
          isOpen={isAdminSettingsOpen}
          onClose={() => setIsAdminSettingsOpen(false)}
          settings={room.settings}
          onUpdateSettings={(newSettings) => handleAdminAction({ type: 'update_settings', settings: newSettings })}
          onBroadcastAnnouncement={(text) => handleSendChat(text, true)}
          onEndClassroom={() => handleAdminAction({ type: 'end_classroom' })}
        />
      )}

      {/* Personal Privacy Modal */}
      {currentParticipant && (
        <UserPrivacyModal
          isOpen={isPrivacyOpen}
          onClose={() => setIsPrivacyOpen(false)}
          privacy={currentParticipant.privacy || {
            workspaceVisibility: currentParticipant.role === 'admin' ? 'public' : 'private',
            allowCollaboration: true,
            requireDownloadPermission: currentParticipant.role !== 'admin',
          }}
          onUpdatePrivacy={handleUpdatePrivacy}
        />
      )}

      {/* Outgoing Request & Action Notification Toast */}
      {toastMessage && (
        <div className="fixed top-14 right-4 z-50 max-w-sm w-full animate-in slide-in-from-top-2 fade-in duration-200 select-none">
          <div className="bg-[#12141c]/95 backdrop-blur-md border border-cyan-500/50 rounded-xl p-3.5 shadow-2xl text-xs text-cyan-200 flex items-center justify-between">
            <span className="font-medium leading-tight">{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="text-gray-400 hover:text-white ml-2 p-0.5 rounded hover:bg-[#1e202c] transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
