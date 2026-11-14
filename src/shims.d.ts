// TypeScript 5.5+ changed Body.json() to return Promise<unknown>.
// Restore Promise<any> for compatibility with existing codebase.
interface Body {
  json(): Promise<any>;
}

// Global Window extensions for live classroom WebRTC & audio
interface Window {
  webkitAudioContext?: typeof AudioContext;
  __ENABLE_TEST_WS__?: boolean;
}
