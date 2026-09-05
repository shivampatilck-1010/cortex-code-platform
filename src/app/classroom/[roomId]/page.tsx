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
  X
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
      fetchRoomState(savedId);
    } else {
      setIsJoinNeeded(true);
      setIsLoading(false);
    }
  }, [roomId]);

  // 2. Fetch Room State
  const fetchRoomState = async (pId?: string) => {
    try {
      const activeId = pId || participantId;
      const pidQuery = activeId ? `?requesterId=${activeId}` : '';
      const res = await fetch(`/api/v1/classroom/${roomId}${pidQuery}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load classroom state');
      }

      setRoom(data.room);
      setSlotAUserId(data.room.activeWorkspaces?.slotAUserId);
      setSlotBUserId(data.room.activeWorkspaces?.slotBUserId);

      // Synchronize pending incoming collaboration requests for this participant:
      if (data.room?.collaborationRequests && activeId) {
        const activePartnerIds = new Set<string>();
        Object.values(data.room.collaborationSessions || {}).forEach((s: any) => {
          if (s.participantIds?.includes(activeId)) {
            s.participantIds.forEach((pid: string) => {
              if (pid !== activeId) activePartnerIds.add(pid);
            });
          }
        });

        const myCollabReq = Object.values(data.room.collaborationRequests).find(
          (r: any) => r.toId === activeId && r.status === 'pending' && !activePartnerIds.has(r.fromId)
        );
        if (myCollabReq) {
          setIncomingCollabReq(myCollabReq as any);
        } else {
          setIncomingCollabReq(null);
        }
      }

      // Synchronize pending incoming file download requests for this participant:
      if (data.room?.downloadRequests && activeId) {
        const myDownloadReq = Object.values(data.room.downloadRequests).find(
          (r: any) => r.ownerId === activeId && r.status === 'pending'
        );
        if (myDownloadReq) {
          setIncomingDownloadReq(myDownloadReq as any);
        } else {
          setIncomingDownloadReq(null);
        }
      }

      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Error loading classroom');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Connect Real-time event transport with resilient polling
  useEffect(() => {
    if (!roomId || !participantId || !participantName) return;

    const client = new CollaborationClient(roomId, participantId, participantName);
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
  }, [roomId, participantId, participantName]);

  // 4. Handle incoming real-time events
  const handleIncomingRealtimeEvent = (event: any) => {
    switch (event.type) {
      case 'room_state':
        if (event.payload?.room) {
          setRoom(event.payload.room);
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

    if (slotAUserId === participantId) {
      // 1. Ultra low-latency broadcast via WebSocket
      collabClientRef.current?.sendCodeUpdate(code);

      // 2. Debounce HTTP persistence write by 400ms to eliminate network congestion
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
              participantId,
              code,
            }),
          });
        } catch (e) {
          console.error('Code save error', e);
        }
      }, 400);
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

    if (slotBUserId === participantId) {
      // 1. Ultra low-latency broadcast via WebSocket
      collabClientRef.current?.sendCodeUpdate(code);

      // 2. Debounce HTTP persistence write by 400ms to eliminate network congestion
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
              participantId,
              code,
            }),
          });
        } catch (e) {
          console.error('Code save error', e);
        }
      }, 400);
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
    }
    router.push('/classroom');
  };

  if (isJoinNeeded) {
    return (
      <div className="h-screen w-screen bg-[#0b0c0e]">
        <ClassroomLobbyModal
          isOpen={true}
          defaultRoomId={roomId}
          onCreateRoom={async () => {}}
          onJoinRoom={async (rid, name) => {
            const res = await fetch('/api/v1/classroom', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'join', roomId: rid, name }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error);

            localStorage.setItem(`cortex_participant_${data.roomId}`, data.participantId);
            localStorage.setItem(`cortex_name_${data.roomId}`, data.participantName);
            localStorage.setItem(`cortex_role_${data.roomId}`, data.role);

            setParticipantId(data.participantId);
            setParticipantName(data.participantName);
            setParticipantRole(data.role);
            setIsJoinNeeded(false);
            fetchRoomState(data.participantId);
          }}
        />
      </div>
    );
  }

  const userA = room && slotAUserId ? room.participants[slotAUserId] : null;
  const userB = room && slotBUserId ? room.participants[slotBUserId] : null;

  const currentParticipant = room?.participants[participantId];
  const onlineParticipantsCount = room ? Object.values(room.participants).filter(p => p.online).length : 0;
  const totalParticipantsCount = room ? Object.keys(room.participants).length : 0;

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
      {error && (
        <div className="bg-rose-950/60 border-b border-rose-800/60 p-2 text-center text-xs text-rose-300 font-medium flex items-center justify-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* 3. Main Body Arena (Left: User List | Center: Two Workspaces | Right: Chat Drawer) */}
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
          privacy={currentParticipant.privacy}
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
