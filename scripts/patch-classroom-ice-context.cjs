const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/components/live-class/context/ClassroomContext.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add iceServersRef
const targetRef = `  // WebRTC Peer Connection registry
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());`;

const newRef = `  // WebRTC ICE Configuration (STUN / TURN)
  const defaultIceServers: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];
  const iceServersRef = useRef<RTCIceServer[]>(defaultIceServers);

  // WebRTC Peer Connection registry
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());`;

if (content.includes(targetRef)) {
  content = content.replace(targetRef, newRef);
} else {
  content = content.replace(targetRef.replace(/\n/g, '\r\n'), newRef.replace(/\n/g, '\r\n'));
}

// 2. Use iceServersRef in getOrCreatePeerConnection
const oldGetPc = `      pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });`;

const newGetPc = `      pc = new RTCPeerConnection({
        iceServers: iceServersRef.current,
      });`;

if (content.includes(oldGetPc)) {
  content = content.replace(oldGetPc, newGetPc);
} else {
  content = content.replace(oldGetPc.replace(/\n/g, '\r\n'), newGetPc.replace(/\n/g, '\r\n'));
}

// 3. Update iceServers in session load
const oldSessionUpdate = `        setLiveSessionToken(data.liveSessionToken);
        setAuthStatus('authenticated');`;

const newSessionUpdate = `        setLiveSessionToken(data.liveSessionToken);
        if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
          iceServersRef.current = data.iceServers;
          console.log('[WebRTC] Loaded ICE servers: mode=' + (data.iceMode || 'stun-only') + ', turnConfigured=' + Boolean(data.isTurnConfigured));
        } else {
          console.log('[WebRTC] Development Mode: Running with STUN-only configuration (TURN relay not configured).');
        }
        setAuthStatus('authenticated');`;

if (content.includes(oldSessionUpdate)) {
  content = content.replace(oldSessionUpdate, newSessionUpdate);
} else {
  content = content.replace(oldSessionUpdate.replace(/\n/g, '\r\n'), newSessionUpdate.replace(/\n/g, '\r\n'));
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated ClassroomContext.tsx with dynamic ICE/TURN servers');
