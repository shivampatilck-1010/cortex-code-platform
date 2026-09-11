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
  Sparkles,
  Crown
} from 'lucide-react';
import { CortexLogo } from '@/components/brand/CortexLogo';
import { ClassroomRoom, ClassroomParticipant, ClassroomRole, CollaborationRequest, FileDownloadRequest, FileDownloadDecision, CollaborationDecision, ChatMessage } from '@/lib/classroom/types';
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
  const [lastReadChatCount, setLastReadChatCount] = useState<number>(0);
  const [isAdminSettingsOpen, setIsAdminSettingsOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isUserListOpen, setIsUserListOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Pending incoming requests
  const [incomingCollabReq, setIncomingCollabReq] = useState<CollaborationRequest | null>(null);
  const handledCollabRequestIdsRef = useRef<Set<string>>(new Set());
  const dismissedPartnerCooldownRef = useRef<Map<string, number>>(new Map());
  const [incomingDownloadReq, setIncomingDownloadReq] = useState<FileDownloadRequest | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'syncing' | 'offline'>('syncing');
  const [collabClient, setCollabClient] = useState<CollaborationClient | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 4000);
  };

  const collabClientRef = useRef<CollaborationClient | null>(null);
  const codeSaveTimersRef = useRef<{ [key: string]: any }>({});
  const roomRef = useRef<ClassroomRoom | null>(null);

  // Session storage helpers to ensure browser tabs/windows don't clobber each other's identity
  const getTabSession = (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(`cortex_${key}_${roomId}`) || localStorage.getItem(`cortex_${key}_${roomId}`);
  };

  const setTabSession = (key: string, val: string) => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(`cortex_${key}_${roomId}`, val);
    try {
      localStorage.setItem(`cortex_${key}_${roomId}`, val);
    } catch {}
  };

  const removeTabSession = (key: string) => {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(`cortex_${key}_${roomId}`);
    try {
      localStorage.removeItem(`cortex_${key}_${roomId}`);
    } catch {}
  };

  // 1. Restore participant from sessionStorage/localStorage or prompt to join
  useEffect(() => {
    if (typeof window === 'undefined' || !roomId) return;

    const savedId = getTabSession('participant');
    const savedName = getTabSession('name');
    const savedRole = (getTabSession('role') as ClassroomRole) || 'user';

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
      // Merge chat messages so local/optimistic or peer-received messages are NEVER lost
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
      };

      roomRef.current = resolvedRoom;

      if (prev && !isRoomDifferent(prev, resolvedRoom)) {
        return prev;
      }
      return resolvedRoom;
    });

    // 1. Maintain Workspaces Slots without background clobbering:
    let resolvedSlotA: string | undefined = undefined;
    setSlotAUserId((prevA) => {
      if (myId && newRoom.participants && newRoom.participants[myId]) {
        resolvedSlotA = myId;
        return myId;
      }
      if (prevA && newRoom.participants && newRoom.participants[prevA]) {
        resolvedSlotA = prevA;
        return prevA;
      }
      resolvedSlotA = newRoom.activeWorkspaces?.slotAUserId || Object.keys(newRoom.participants || {})[0] || prevA;
      return resolvedSlotA;
    });

    setSlotBUserId((prevB) => {
      // If in active mutual collaboration, slot B must be the collaboration partner!
      const myCollabSession = Object.values(newRoom.collaborationSessions || {}).find(
        (s: any) => s.participantIds?.includes(myId)
      );
      if (myCollabSession && myCollabSession.participantIds) {
        const partnerId = myCollabSession.participantIds.find((pid: string) => pid !== myId);
        if (partnerId && newRoom.participants[partnerId]) return partnerId;
      }

      const activeA = resolvedSlotA || slotAUserId || myId;

      // If already set to a valid participant who is NOT slot A, keep it!
      if (prevB && prevB !== activeA && newRoom.participants && newRoom.participants[prevB]) {
        return prevB;
      }

      // If server activeWorkspaces has a slot B user who is NOT slot A, use it
      if (
        newRoom.activeWorkspaces?.slotBUserId &&
        newRoom.activeWorkspaces.slotBUserId !== activeA &&
        newRoom.participants[newRoom.activeWorkspaces.slotBUserId]
      ) {
        return newRoom.activeWorkspaces.slotBUserId;
      }

      // Otherwise auto-mount another participant into Slot B who is NOT Slot A
      if (newRoom.participants) {
        const otherUser = Object.values(newRoom.participants).find(
          (p) => p && p.id && p.id !== activeA && p.name !== 'Classroom Host'
        );
        if (otherUser) return otherUser.id;
      }

      // Never duplicate Slot A! If no other user exists, Slot B is empty.
      return undefined;
    });

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

      // Respect current user's privacy preference
      const myParticipant = newRoom.participants?.[myId];
      const allowsCollaboration = myParticipant?.privacy?.allowCollaboration !== false;

      const now = Date.now();
      const myCollabReq = allowsCollaboration
        ? Object.values(newRoom.collaborationRequests).find((r: any) => {
            if (!r || r.toId !== myId || r.status !== 'pending') return false;
            if (activePartnerIds.has(r.fromId)) return false;
            if (handledCollabRequestIdsRef.current.has(r.id)) return false;
            const cooldownUntil = dismissedPartnerCooldownRef.current.get(r.fromId) || 0;
            if (now < cooldownUntil) return false;
            return true;
          })
        : null;

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

      const latestChat = roomRef.current?.chatMessages || room?.chatMessages || [];
      if (latestChat.length > 0) {
        queryParams.set('clientChatMessages', JSON.stringify(latestChat.slice(-30)));
      }

      const currentState = roomRef.current?.state || (activeRole === 'admin' ? 'active' : undefined);
      if (currentState) {
        queryParams.set('clientRoomState', currentState);
      }
      if (roomRef.current?.admin?.enteredArena || activeRole === 'admin') {
        queryParams.set('clientAdminEntered', 'true');
      }

      const latestRequests = Object.values(roomRef.current?.collaborationRequests || room?.collaborationRequests || {});
      if (latestRequests.length > 0) {
        queryParams.set('clientCollabRequests', JSON.stringify(latestRequests.slice(-10)));
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
      // 1. Send WebSocket event for instant zero-latency edge propagation
      collabClientRef.current?.sendRaw({
        type: 'start_classroom',
        roomId,
        clientId: participantId,
        senderName: participantName,
        payload: { state: 'active' },
        timestamp: Date.now(),
      });

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
    setCollabClient(client);

    const unsubscribeEvents = client.onEvent((event) => {
      handleIncomingRealtimeEvent(event);
    });

    const unsubscribeStatus = client.onStatusChange((status) => {
      setConnectionStatus(status);
    });

    // Resilient background edge synchronization: pings every 1.2 seconds to reconcile isolates
    const syncTimer = setInterval(() => {
      fetchRoomState(participantId, participantName, participantRole);
    }, 1200);

    return () => {
      clearInterval(syncTimer);
      unsubscribeEvents();
      unsubscribeStatus();
      client.cleanup();
      collabClientRef.current = null;
      setCollabClient(null);
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
        if (event.payload?.broadcast && participantRole !== 'admin') {
          if (event.payload.slotAUserId) setSlotAUserId(event.payload.slotAUserId);
          if (event.payload.slotBUserId) setSlotBUserId(event.payload.slotBUserId);
        }
        break;

      case 'collaboration_request': {
        const req = event.payload;
        if (req?.toId === participantId && req?.id) {
          const now = Date.now();
          if (handledCollabRequestIdsRef.current.has(req.id)) break;
          const cooldownUntil = dismissedPartnerCooldownRef.current.get(req.fromId) || 0;
          if (now < cooldownUntil) break;
          const myParticipant = room?.participants?.[participantId];
          if (myParticipant?.privacy?.allowCollaboration === false) break;

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

      case 'chat_message': {
        const rawMsg = event.payload?.message || event.payload;
        if (!rawMsg || (!rawMsg.text && !rawMsg.id)) break;
        const msg: ChatMessage = {
          id: rawMsg.id || `chat_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          senderId: rawMsg.senderId || event.senderId || 'unknown',
          senderName: rawMsg.senderName || event.senderName || 'Classmate',
          role: rawMsg.role || 'user',
          text: (rawMsg.text || '').trim(),
          timestamp: rawMsg.timestamp || event.timestamp || Date.now(),
          isAnnouncement: Boolean(rawMsg.isAnnouncement),
        };
        setRoom((prev) => {
          if (!prev) return prev;
          const currentList = prev.chatMessages || [];
          if (currentList.some((m) => m.id === msg.id)) {
            return prev;
          }
          const updated = {
            ...prev,
            chatMessages: [...currentList, msg].sort((a, b) => a.timestamp - b.timestamp),
          };
          roomRef.current = updated;
          return updated;
        });
        break;
      }

      case 'admin_action':
        fetchRoomState(participantId);
        break;

      case 'classroom_started':
      case 'arena_started':
      case 'session_started':
        if (event.payload?.room) {
          applyRoomState(event.payload.room);
        } else {
          setRoom((prev) => prev ? { ...prev, state: 'active', admin: { ...prev.admin, enteredArena: true } } : prev);
          fetchRoomState(participantId);
        }
        showToast('🚀 Code Arena is now open! Entering arena...');
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
      // Debounce broadcast & HTTP persistence by 300ms to eliminate network congestion while CRDT handles real-time typing
      if (codeSaveTimersRef.current['slotA']) {
        clearTimeout(codeSaveTimersRef.current['slotA']);
      }
      codeSaveTimersRef.current['slotA'] = setTimeout(async () => {
        collabClientRef.current?.sendCodeUpdate(code, undefined, slotAUserId);
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
      // Debounce broadcast & HTTP persistence by 300ms to eliminate network congestion while CRDT handles real-time typing
      if (codeSaveTimersRef.current['slotB']) {
        clearTimeout(codeSaveTimersRef.current['slotB']);
      }
      codeSaveTimersRef.current['slotB'] = setTimeout(async () => {
        collabClientRef.current?.sendCodeUpdate(code, undefined, slotBUserId);
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

  const handleLanguageChangeA = async (lang: string) => {
    if (!slotAUserId) return;
    setRoom((prev) => {
      if (!prev || !prev.participants[slotAUserId]) return prev;
      return {
        ...prev,
        participants: {
          ...prev.participants,
          [slotAUserId]: {
            ...prev.participants[slotAUserId],
            currentLanguage: lang,
          },
        },
      };
    });

    const isAuthorized =
      slotAUserId === participantId ||
      Boolean(
        room &&
          Object.values(room.collaborationSessions || {}).some(
            (s: any) => s.participantIds?.includes(participantId) && s.participantIds?.includes(slotAUserId)
          )
      );

    if (isAuthorized) {
      collabClientRef.current?.sendCodeUpdate(undefined, lang, slotAUserId);
      try {
        await fetch(`/api/v1/classroom/${roomId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_code',
            participantId: slotAUserId,
            targetUserId: slotAUserId,
            language: lang,
          }),
        });
      } catch (e) {
        console.error('Failed to persist language change for slot A', e);
      }
    }
  };

  const handleLanguageChangeB = async (lang: string) => {
    if (!slotBUserId) return;
    setRoom((prev) => {
      if (!prev || !prev.participants[slotBUserId]) return prev;
      return {
        ...prev,
        participants: {
          ...prev.participants,
          [slotBUserId]: {
            ...prev.participants[slotBUserId],
            currentLanguage: lang,
          },
        },
      };
    });

    const isAuthorized =
      slotBUserId === participantId ||
      Boolean(
        room &&
          Object.values(room.collaborationSessions || {}).some(
            (s: any) => s.participantIds?.includes(participantId) && s.participantIds?.includes(slotBUserId)
          )
      );

    if (isAuthorized) {
      collabClientRef.current?.sendCodeUpdate(undefined, lang, slotBUserId);
      try {
        await fetch(`/api/v1/classroom/${roomId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_code',
            participantId: slotBUserId,
            targetUserId: slotBUserId,
            language: lang,
          }),
        });
      } catch (e) {
        console.error('Failed to persist language change for slot B', e);
      }
    }
  };

  const handleSelectSlotA = async (userId: string) => {
    setSlotAUserId(userId);
    if (participantRole === 'admin') {
      try {
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
      } catch {}
    }
  };

  const handleSelectSlotB = async (userId: string) => {
    setSlotBUserId(userId);
    if (participantRole === 'admin') {
      try {
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
      } catch {}
    }
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
    const targetReq = incomingCollabReq || (roomRef.current?.collaborationRequests?.[requestId] as any);
    const partnerId = targetReq?.fromId;

    // Immediately mark request as handled to permanently prevent recurring popups
    handledCollabRequestIdsRef.current.add(requestId);
    if (decision === 'declined' && partnerId) {
      dismissedPartnerCooldownRef.current.set(partnerId, Date.now() + 5 * 60 * 1000);
    }
    setIncomingCollabReq(null);

    // Optimistically update local room state immediately
    if (partnerId) {
      setRoom((prev) => {
        if (!prev) return prev;
        const updatedCollabRequests = { ...prev.collaborationRequests };
        Object.keys(updatedCollabRequests).forEach((id) => {
          const r = updatedCollabRequests[id];
          if (
            (r.fromId === partnerId && r.toId === participantId) ||
            (r.fromId === participantId && r.toId === partnerId) ||
            id === requestId
          ) {
            r.status = decision;
            handledCollabRequestIdsRef.current.add(id);
          }
        });
        return {
          ...prev,
          collaborationRequests: updatedCollabRequests,
        };
      });
    }

    if (decision === 'accepted' && partnerId) {
      setSlotAUserId(participantId);
      setSlotBUserId(partnerId);
      showToast(`🎉 Access approved! Real-time collaboration active.`);
    } else if (decision === 'declined') {
      showToast('Access request declined.');
    }

    // Broadcast realtime event over WebRTC, BroadcastChannel, and WebSocket
    collabClientRef.current?.sendRaw({
      type: 'collaboration_response',
      roomId,
      clientId: participantId,
      senderName: participantName,
      payload: {
        request: {
          id: requestId,
          fromId: partnerId,
          toId: participantId,
          status: decision,
        },
        activeWorkspaces: decision === 'accepted' ? {
          slotAUserId: participantId,
          slotBUserId: partnerId,
        } : undefined,
      },
      timestamp: Date.now(),
    });

    try {
      await fetch(`/api/v1/classroom/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'respond_collaboration',
          participantId,
          requestId,
          decision,
          fromId: partnerId,
        }),
      });
    } catch (e) {
      console.error('Failed to report respond_collaboration to backend', e);
    }
  };

  const handleDismissCollaboration = (requestId: string) => {
    const targetReq = incomingCollabReq || (roomRef.current?.collaborationRequests?.[requestId] as any);
    const partnerId = targetReq?.fromId;
    handledCollabRequestIdsRef.current.add(requestId);
    if (partnerId) {
      dismissedPartnerCooldownRef.current.set(partnerId, Date.now() + 5 * 60 * 1000);
    }
    setIncomingCollabReq(null);
    handleRespondCollaboration(requestId, 'declined');
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
    if (!text || !text.trim()) return;

    const newMsg: ChatMessage = {
      id: 'chat_' + Math.random().toString(36).substring(2, 9),
      senderId: participantId,
      senderName: participantName,
      role: participantRole,
      text: text.trim(),
      timestamp: Date.now(),
      isAnnouncement,
    };

    // 1. Instant optimistic local UI update (0ms feedback)
    setRoom((prev) => {
      if (!prev) return prev;
      const currentList = prev.chatMessages || [];
      if (currentList.some((m) => m.id === newMsg.id)) return prev;
      const updated = {
        ...prev,
        chatMessages: [...currentList, newMsg].sort((a, b) => a.timestamp - b.timestamp),
      };
      roomRef.current = updated;
      return updated;
    });

    // 2. Real-time broadcast over WebRTC DataChannels, BroadcastChannel & WebSockets
    collabClientRef.current?.sendRaw({
      type: 'chat_message',
      roomId,
      clientId: participantId,
      senderName: participantName,
      payload: newMsg,
      timestamp: Date.now(),
    });

    // 3. Persist to server with complete metadata
    try {
      await fetch(`/api/v1/classroom/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_chat',
          participantId,
          senderName: participantName,
          role: participantRole,
          id: newMsg.id,
          text: text.trim(),
          isAnnouncement,
        }),
      });
    } catch {}
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
    removeTabSession('participant');
    removeTabSession('name');
    removeTabSession('role');
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
            setTabSession('participant', data.participantId);
            setTabSession('name', data.participantName);
            setTabSession('role', data.role);
            router.push(`/classroom/${data.roomId}`);
            return data;
          }}
          onEnterRoom={(newRoomId) => {
            router.push(`/classroom/${newRoomId}`);
          }}
          onJoinRoom={async (rid, name, role) => {
            const targetId = rid.toUpperCase().trim() || roomId;
            const targetRole = role || 'user';
            const res = await fetch('/api/v1/classroom', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'join', roomId: targetId, name, role: targetRole }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'Failed to join classroom');

            setTabSession('participant', data.participantId);
            setTabSession('name', data.participantName);
            setTabSession('role', data.role);

            setParticipantId(data.participantId);
            setParticipantName(data.participantName);
            setParticipantRole(data.role);
            setIsJoinNeeded(false);

            if (data.role === 'admin') {
              setTimeout(() => {
                handleStartClassroom();
              }, 100);
            }

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

  // The authoritative waiting room state: students wait only when the room is NOT active and admin has not entered the arena
  const isWaitingForAdmin =
    participantRole !== 'admin' &&
    room !== null &&
    room.state !== 'active' &&
    !room.admin?.enteredArena;

  const totalChatMessages = room?.chatMessages?.length || 0;
  const unreadChatCount = !isChatOpen && totalChatMessages > lastReadChatCount
    ? totalChatMessages - lastReadChatCount
    : 0;

  useEffect(() => {
    if (isChatOpen && room?.chatMessages) {
      setLastReadChatCount(room.chatMessages.length);
    }
  }, [isChatOpen, room?.chatMessages?.length]);

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

          {/* Mobile User List Toggle */}
          <button
            onClick={() => setIsUserListOpen(!isUserListOpen)}
            className={`lg:hidden p-1.5 rounded transition ${
              isUserListOpen ? 'bg-[#ff9100]/20 text-[#ff9100]' : 'text-gray-400 hover:text-white hover:bg-[#1a1c22]'
            }`}
            title="Toggle Classroom Participants"
          >
            <Users className="w-4 h-4" />
          </button>

          {/* Chat Toggle */}
          <button
            onClick={() => {
              setIsChatOpen((prev) => {
                if (!prev) {
                  setLastReadChatCount(room?.chatMessages?.length || 0);
                }
                return !prev;
              });
            }}
            className={`p-1.5 rounded transition relative ${
              isChatOpen ? 'bg-[#ff9100]/20 text-[#ff9100]' : 'text-gray-400 hover:text-white hover:bg-[#1a1c22]'
            }`}
            title="Toggle Classroom Chat"
          >
            <MessageSquare className="w-4 h-4" />
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#ff9100] text-black font-bold text-[9px] flex items-center justify-center shadow-md animate-pulse">
                {unreadChatCount > 9 ? '9+' : unreadChatCount}
              </span>
            )}
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

      {/* 3. Main Body Container with Accessible Classroom Chat */}
      <div className="flex-1 flex overflow-hidden relative">
        {isWaitingForAdmin ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-[#0e1017] to-[#07080a] relative overflow-y-auto select-none">
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
                      setIsChatOpen(true);
                      setLastReadChatCount(room?.chatMessages?.length || 0);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#ff9100]/15 hover:bg-[#ff9100]/25 text-[#ff9100] border border-[#ff9100]/30 transition flex items-center space-x-1.5"
                    title="Open Classroom Chat & Announcements"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Chat & Announcements</span>
                    {unreadChatCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-[#ff9100] text-black font-bold text-[9px]">
                        {unreadChatCount}
                      </span>
                    )}
                  </button>
                  {(!room?.admin?.id || room.admin.name === 'Classroom Host' || !validParticipants.some(p => p.role === 'admin')) && (
                    <button
                      onClick={async () => {
                        try {
                          setParticipantRole('admin');
                          setTabSession('role', 'admin');
                          await fetch(`/api/v1/classroom/${roomId}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'start_classroom', participantId }),
                          });
                          await handleStartClassroom();
                          showToast('👑 Elevated to Teacher / Host!');
                        } catch (e) {
                          console.error('Failed to claim host role', e);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black shadow-md transition flex items-center space-x-1.5"
                      title="No host active. Claim host role to launch arena"
                    >
                      <Crown className="w-3.5 h-3.5 fill-current" />
                      <span>Claim Host Role</span>
                    </button>
                  )}
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
          /* Main Body Arena (Left: User List | Center: Two Workspaces) */
          <div className="flex-1 flex overflow-hidden relative">
            {/* Mobile Drawer Backdrop */}
            {isUserListOpen && (
              <div
                onClick={() => setIsUserListOpen(false)}
                className="lg:hidden fixed inset-0 z-20 bg-black/60 backdrop-blur-xs"
              />
            )}

            {/* Left Sidebar: All Classroom Users (Responsive Drawer on < lg) */}
            <div
              className={`fixed inset-y-12 left-0 z-30 lg:static lg:inset-auto w-64 sm:w-72 flex-shrink-0 h-[calc(100%-3rem)] lg:h-full transition-transform duration-200 ${
                isUserListOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
              }`}
            >
              <UserListPanel
                participants={room?.participants || {}}
                currentUserId={participantId}
                currentUserRole={participantRole}
                currentUserName={participantName}
                slotAUserId={slotAUserId}
                slotBUserId={slotBUserId}
                onSelectSlotA={(uid) => {
                  handleSelectSlotA(uid);
                  setIsUserListOpen(false);
                }}
                onSelectSlotB={(uid) => {
                  handleSelectSlotB(uid);
                  setIsUserListOpen(false);
                }}
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
                collabClient={collabClient}
                onCodeChangeA={handleCodeChangeA}
                onCodeChangeB={handleCodeChangeB}
                onLanguageChangeA={handleLanguageChangeA}
                onLanguageChangeB={handleLanguageChangeB}
                onEndCollaboration={handleEndCollaboration}
                onRequestViewAccess={(targetId) => {
                  handleRequestCollaboration(targetId);
                }}
                onDownloadFile={(ownerId, fileId) => {
                  handleRequestFileDownload(ownerId, fileId);
                }}
              />
            </div>
          </div>
        )}

        {/* Right Drawer: Classroom Chat & Announcements */}
        <ClassroomChatDrawer
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          messages={room?.chatMessages || []}
          currentUserId={participantId}
          currentUserName={participantName}
          currentUserRole={participantRole}
          onSendMessage={handleSendChat}
        />
      </div>

      {/* Incoming Collaboration Request Modal (Mutual Consent) */}
      <CollaborationPromptModal
        request={incomingCollabReq}
        onAccept={(id) => handleRespondCollaboration(id, 'accepted')}
        onDecline={(id) => handleRespondCollaboration(id, 'declined')}
        onDismiss={(id) => handleDismissCollaboration(id)}
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

      {/* Outgoing Request & Action Notification Toast (Relocated to bottom-right z-40) */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-40 max-w-sm w-full animate-in slide-in-from-bottom-2 fade-in duration-200 select-none pointer-events-auto">
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
