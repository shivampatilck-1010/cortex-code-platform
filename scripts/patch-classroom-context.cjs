const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../src/components/live-class/context/ClassroomContext.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update ClassroomProvider signature
content = content.replace(
  'export const ClassroomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {',
  `export const ClassroomProvider: React.FC<ClassroomProviderProps> = ({
  children,
  classroomId,
  sessionId,
  initialRole,
}) => {`
);

// 2. Add auth state and remoteStreams state right after default state declarations
const targetAnchor = `  const [participants, setParticipants] = useState<Participant[]>(initialParticipants);
  const currentUserId = userRole === 'teacher' ? 'usr_prof_shivam' : 'usr_student_alex';`;

const replacementAnchor = `  const [authStatus, setAuthStatus] = useState<LiveClassAuthStatus>(() => (classroomId ? 'loading' : 'authenticated'));
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

  // WebRTC Peer Connection registry
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  // WebRTC helper: get or create RTCPeerConnection for a remote peer
  const getOrCreatePeerConnection = useCallback((peerId: string) => {
    let pc = peerConnectionsRef.current.get(peerId);
    if (!pc || pc.signalingState === 'closed') {
      pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
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

    fetch(\`/api/v1/classrooms/\${classroomId}/live/session\`)
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
          setAuthErrorMessage(\`Failed to authenticate live session (\${res.status}).\`);
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
        setAuthStatus('authenticated');

        // Fetch classroom details for participant roster
        fetch(\`/api/v1/classrooms/\${classroomId}\`)
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
  }, [classroomId]);`;

content = content.replace(targetAnchor, replacementAnchor);

// 3. Update client.onMessage to handle JOIN_ACCEPTED, PARTICIPANT_JOINED, PARTICIPANT_LEFT, and WebRTC
const oldMsgAnchor = `      if (envelope.type === 'CLASSROOM_EVENT') {`;
const newMsgAnchor = `      if (envelope.type === 'JOIN_ACCEPTED') {
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
      } else if (envelope.type === 'CLASSROOM_EVENT') {`;

content = content.replace(oldMsgAnchor, newMsgAnchor);

// 4. In CLASSROOM_EVENT, add WebRTC handlers
const webRtcAnchor = `        if (eventName === 'NETWORK_TEST_PING') {
          showToast(\`Network test ping received from \${envelope.senderId || 'peer'}\`);
        }`;

const newWebRtcAnchor = `        if (eventName === 'NETWORK_TEST_PING') {
          showToast(\`Network test ping received from \${envelope.senderId || 'peer'}\`);
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
        }`;

content = content.replace(webRtcAnchor, newWebRtcAnchor);

// 5. Update joinClassroom call to include joinToken
const joinTarget = `      client.joinClassroom(session.id, {
        requestedRole: userRole,
        participantName: userRole === 'teacher' ? session.teacher.name : 'Alex Chen',
      });`;

const joinReplacement = `      client.joinClassroom(session.id, {
        requestedRole: userRole,
        participantName: currentUserName,
        joinToken: liveSessionToken || undefined,
      });`;

content = content.replace(joinTarget, joinReplacement);

// 6. Update context value object to include new fields
const valueTarget = `        sendNetworkTestEvent,
      }}`;

const valueReplacement = `        sendNetworkTestEvent,
        authStatus,
        authErrorMessage,
        liveSessionToken,
        remoteStreams,
        isAuthoritativeTeacher,
        currentUserName,
        currentUserEmail,
      }}`;

content = content.replace(valueTarget, valueReplacement);

fs.writeFileSync(filePath, content);
console.log('ClassroomContext.tsx successfully patched with Stage 3-6 requirements.');
