import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useClassroom } from '@/context/ClassroomContext';
import {
  X,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
  Check,
  Shield,
  RefreshCw,
  AlertCircle,
  Sliders,
  Info,
} from 'lucide-react';

export const DeviceSettingsModal: React.FC = () => {
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    deviceState,
    setAudioDevice,
    setVideoDevice,
    setAudioOutputDevice,
    availableAudioInputs,
    availableVideoInputs,
    availableAudioOutputs,
    refreshDevices,
    localVideoStream,
    startCamera,
    stopCamera,
    startMicrophone,
    stopMicrophone,
    showToast,
  } = useClassroom();

  const [activeTab, setActiveTab] = useState<'audio' | 'video' | 'permissions'>('audio');
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isTestingSpeaker, setIsTestingSpeaker] = useState(false);

  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  // Bind local video stream to preview element
  useEffect(() => {
    if (activeTab === 'video' && previewVideoRef.current) {
      if (localVideoStream) {
        previewVideoRef.current.srcObject = localVideoStream;
        previewVideoRef.current.play().catch(() => {});
      } else {
        previewVideoRef.current.srcObject = null;
      }
    }
  }, [activeTab, localVideoStream]);

  // Handle ESC key to dismiss modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSettingsOpen) {
        setIsSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen, setIsSettingsOpen]);

  const handleManualScan = async () => {
    setIsScanning(true);
    await refreshDevices();
    setIsScanning(false);
    showToast('Hardware devices refreshed');
  };

  const playTestChime = useCallback(() => {
    try {
      const AudioCtxClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) {
        showToast('Web Audio API is not supported in this browser');
        return;
      }

      setIsTestingSpeaker(true);
      const ctx = new AudioCtxClass();

      // Ensure audio context is resumed (browsers require user gesture)
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      // Harmonic chime progression: 523.25 Hz (C5) -> 659.25 Hz (E5) -> 783.99 Hz (G5)
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.24);

      gainNode.gain.setValueAtTime(0.001, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.65);

      osc.onended = () => {
        ctx.close().catch(() => {});
        setIsTestingSpeaker(false);
      };

      showToast('Playing speaker test chime');
    } catch (err) {
      console.error('Failed to play speaker test chime:', err);
      setIsTestingSpeaker(false);
      showToast('Unable to play audio test chime');
    }
  }, [showToast]);

  if (!isSettingsOpen) return null;

  // Video track settings for live resolution display
  const activeVideoTrack = localVideoStream?.getVideoTracks()[0];
  const videoSettings = activeVideoTrack?.getSettings();
  const resolutionDisplay =
    videoSettings?.width && videoSettings?.height
      ? `${videoSettings.width}x${videoSettings.height} @ ${
          videoSettings.frameRate ? Math.round(videoSettings.frameRate) : 30
        }fps`
      : 'Active Feed';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="w-full max-w-xl rounded-xl border border-[#282A36] bg-[#111216] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="device-settings-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#282A36] bg-[#0B0C0E]">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-[#FF9100]/10 border border-[#FF9100]/20 text-[#FF9100]">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 id="device-settings-title" className="text-sm font-semibold text-white">
                Audio & Video Settings
              </h2>
              <p className="text-[11px] text-[#A1A1AA]">
                Configure connected devices, verify permissions, and test real-time media streams
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleManualScan}
              disabled={isScanning}
              className="flex items-center space-x-1 px-2.5 py-1 rounded border border-[#282A36] bg-[#15161C] hover:bg-[#1D1F27] text-[11px] text-[#A1A1AA] hover:text-white transition-colors disabled:opacity-50"
              title="Rescan connected hardware devices"
            >
              <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin text-[#06B6D4]' : ''}`} />
              <span>Rescan</span>
            </button>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="p-1 rounded text-[#71717A] hover:text-white hover:bg-[#15161C] transition-colors"
              aria-label="Close settings"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#282A36] bg-[#15161C] px-6">
          <button
            onClick={() => setActiveTab('audio')}
            className={`flex items-center space-x-2 py-3 border-b-2 text-xs font-medium mr-6 transition-colors ${
              activeTab === 'audio'
                ? 'border-[#FF9100] text-[#FF9100]'
                : 'border-transparent text-[#A1A1AA] hover:text-white'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Audio Devices</span>
          </button>
          <button
            onClick={() => setActiveTab('video')}
            className={`flex items-center space-x-2 py-3 border-b-2 text-xs font-medium mr-6 transition-colors ${
              activeTab === 'video'
                ? 'border-[#06B6D4] text-[#06B6D4]'
                : 'border-transparent text-[#A1A1AA] hover:text-white'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Video and Camera</span>
          </button>
          <button
            onClick={() => setActiveTab('permissions')}
            className={`flex items-center space-x-2 py-3 border-b-2 text-xs font-medium transition-colors ${
              activeTab === 'permissions'
                ? 'border-[#A855F7] text-[#A855F7]'
                : 'border-transparent text-[#A1A1AA] hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Permissions</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 space-y-5 text-xs text-[#F5F5F5]">
          {activeTab === 'audio' && (
            <div className="space-y-4">
              {/* Microphone Input Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="microphone-select" className="text-[11px] font-medium text-[#A1A1AA]">
                    Microphone Input Device
                  </label>
                  <span className="text-[10px] text-[#71717A]">
                    {availableAudioInputs.length} detected
                  </span>
                </div>
                <select
                  id="microphone-select"
                  value={deviceState.audioDeviceId}
                  onChange={(e) => setAudioDevice(e.target.value)}
                  className="w-full bg-[#15161C] border border-[#282A36] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF9100]"
                >
                  {availableAudioInputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Live Web Audio Input Meter & Test Controls */}
              <div className="p-3 rounded-lg border border-[#282A36] bg-[#0B0C0E]/70 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-[#A1A1AA] flex items-center space-x-1.5">
                    <Mic className="w-3 h-3 text-[#10B981]" />
                    <span>Real-time Audio Input Level</span>
                  </span>
                  <span className="font-mono text-[10px] text-[#A1A1AA]">
                    {deviceState.isMuted
                      ? 'Muted'
                      : deviceState.isMicrophoneLoading
                      ? 'Connecting...'
                      : `${deviceState.audioLevel}%`}
                  </span>
                </div>

                <div className="h-2 w-full bg-[#15161C] rounded-full overflow-hidden border border-[#282A36] p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-75 ${
                      deviceState.isMuted
                        ? 'w-0'
                        : deviceState.audioLevel > 65
                        ? 'bg-[#FF9100]'
                        : 'bg-[#10B981]'
                    }`}
                    style={{ width: `${deviceState.isMuted ? 0 : Math.min(100, deviceState.audioLevel)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-[#71717A]">
                    Powered by Web Audio API RMS analyzer
                  </span>
                  {deviceState.isMuted ? (
                    <button
                      onClick={() => startMicrophone()}
                      disabled={deviceState.isMicrophoneLoading}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981] hover:bg-[#10B981]/25 text-[11px] font-medium transition-colors"
                    >
                      <Mic className="w-3 h-3" />
                      <span>{deviceState.isMicrophoneLoading ? 'Opening...' : 'Unmute & Test'}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => stopMicrophone()}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/25 text-[11px] font-medium transition-colors"
                    >
                      <MicOff className="w-3 h-3" />
                      <span>Mute Microphone</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Audio Output Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="speaker-select" className="text-[11px] font-medium text-[#A1A1AA]">
                    Audio Output Device (Speakers / Headphones)
                  </label>
                  <span className="text-[10px] text-[#71717A]">
                    {availableAudioOutputs.length} detected
                  </span>
                </div>
                <div className="flex space-x-2">
                  <select
                    id="speaker-select"
                    value={deviceState.audioOutputDeviceId}
                    onChange={(e) => setAudioOutputDevice(e.target.value)}
                    className="flex-1 bg-[#15161C] border border-[#282A36] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF9100]"
                  >
                    {availableAudioOutputs.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={playTestChime}
                    disabled={isTestingSpeaker}
                    className="flex items-center space-x-1.5 px-3 py-2 bg-[#15161C] border border-[#282A36] hover:bg-[#1D1F27] rounded-lg text-xs text-white transition-colors disabled:opacity-50"
                    title="Play acoustic harmonic test tone through selected output"
                  >
                    <Volume2 className={`w-3.5 h-3.5 ${isTestingSpeaker ? 'text-[#FF9100] animate-pulse' : 'text-[#06B6D4]'}`} />
                    <span>{isTestingSpeaker ? 'Playing...' : 'Test Sound'}</span>
                  </button>
                </div>
              </div>

              {/* Audio Processing Toggles */}
              <div className="pt-2 border-t border-[#282A36] space-y-2.5">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-white block text-xs">Acoustic Echo Cancellation</span>
                    <span className="text-[#71717A] text-[10px]">
                      Prevents classroom speakers from looping back into microphone
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={echoCancellation}
                    onChange={(e) => setEchoCancellation(e.target.checked)}
                    className="accent-[#FF9100] w-4 h-4 cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-white block text-xs">Background Noise Suppression</span>
                    <span className="text-[#71717A] text-[10px]">
                      Filters continuous fan, keyboard typing, and room ambience
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={noiseSuppression}
                    onChange={(e) => setNoiseSuppression(e.target.checked)}
                    className="accent-[#FF9100] w-4 h-4 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          )}

          {activeTab === 'video' && (
            <div className="space-y-4">
              {/* Camera Device Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="camera-select" className="text-[11px] font-medium text-[#A1A1AA]">
                    Camera Hardware Device
                  </label>
                  <span className="text-[10px] text-[#71717A]">
                    {availableVideoInputs.length} detected
                  </span>
                </div>
                <select
                  id="camera-select"
                  value={deviceState.videoDeviceId}
                  onChange={(e) => setVideoDevice(e.target.value)}
                  className="w-full bg-[#15161C] border border-[#282A36] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#06B6D4]"
                >
                  {availableVideoInputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Real Video Preview Frame */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-medium text-[#A1A1AA]">
                    Live Camera Feed Monitor
                  </span>
                  {localVideoStream && (
                    <span className="text-[10px] font-mono text-[#10B981] flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                      <span>{resolutionDisplay}</span>
                    </span>
                  )}
                </div>

                <div className="w-full h-48 rounded-lg bg-[#0B0C0E] border border-[#282A36] flex flex-col items-center justify-center relative overflow-hidden group">
                  {localVideoStream ? (
                    <video
                      ref={previewVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-4 text-center">
                      <div className="w-12 h-12 rounded-full bg-[#15161C] border border-[#282A36] flex items-center justify-center mb-2.5">
                        <VideoOff className="w-6 h-6 text-[#71717A]" />
                      </div>
                      <span className="text-xs font-medium text-white">Camera Preview is Standby</span>
                      <p className="text-[11px] text-[#71717A] max-w-xs mt-1">
                        Camera hardware is currently inactive. Click below to start the local preview feed.
                      </p>
                      <button
                        onClick={() => startCamera()}
                        disabled={deviceState.isCameraLoading}
                        className="mt-3 flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#06B6D4] hover:bg-[#0891B2] text-black font-semibold text-xs transition-colors"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>{deviceState.isCameraLoading ? 'Starting...' : 'Start Camera Preview'}</span>
                      </button>
                    </div>
                  )}

                  {localVideoStream && (
                    <div className="absolute bottom-2 right-2 opacity-90 transition-opacity">
                      <button
                        onClick={() => stopCamera()}
                        className="flex items-center space-x-1 px-2.5 py-1 rounded bg-black/75 hover:bg-black border border-[#282A36] text-[11px] text-[#F87171] transition-colors"
                      >
                        <VideoOff className="w-3 h-3" />
                        <span>Stop Preview</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'permissions' && (
            <div className="space-y-3">
              <div className="rounded-lg bg-[#15161C] p-3.5 border border-[#282A36] flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-white flex items-center space-x-1.5">
                    <Mic className="w-3.5 h-3.5 text-[#FF9100]" />
                    <span>Microphone Permission</span>
                  </h4>
                  <p className="text-[11px] text-[#A1A1AA] mt-1">
                    Required for classroom voice interaction and audio level telemetry.
                  </p>
                  {deviceState.permissionStatus?.microphone === 'denied' && (
                    <div className="mt-2 text-[11px] text-[#F87171] flex items-center space-x-1">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      <span>Permission is blocked. Check your browser address bar permissions.</span>
                    </div>
                  )}
                </div>
                <span
                  className={`flex items-center text-[11px] font-medium px-2 py-0.5 rounded border ${
                    deviceState.permissionStatus?.microphone === 'granted'
                      ? 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/20'
                      : deviceState.permissionStatus?.microphone === 'denied'
                      ? 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/20'
                      : 'text-[#A1A1AA] bg-[#282A36]/40 border-[#282A36]'
                  }`}
                >
                  {deviceState.permissionStatus?.microphone === 'granted' ? (
                    <>
                      <Check className="w-3 h-3 mr-1" /> Allowed
                    </>
                  ) : deviceState.permissionStatus?.microphone === 'denied' ? (
                    <>
                      <AlertCircle className="w-3 h-3 mr-1" /> Denied
                    </>
                  ) : (
                    'Prompt / Default'
                  )}
                </span>
              </div>

              <div className="rounded-lg bg-[#15161C] p-3.5 border border-[#282A36] flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-white flex items-center space-x-1.5">
                    <Video className="w-3.5 h-3.5 text-[#06B6D4]" />
                    <span>Camera Permission</span>
                  </h4>
                  <p className="text-[11px] text-[#A1A1AA] mt-1">
                    Required for presenting live teacher video and student grid participation.
                  </p>
                  {deviceState.permissionStatus?.camera === 'denied' && (
                    <div className="mt-2 text-[11px] text-[#F87171] flex items-center space-x-1">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      <span>Permission is blocked. Check your browser address bar permissions.</span>
                    </div>
                  )}
                </div>
                <span
                  className={`flex items-center text-[11px] font-medium px-2 py-0.5 rounded border ${
                    deviceState.permissionStatus?.camera === 'granted'
                      ? 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/20'
                      : deviceState.permissionStatus?.camera === 'denied'
                      ? 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/20'
                      : 'text-[#A1A1AA] bg-[#282A36]/40 border-[#282A36]'
                  }`}
                >
                  {deviceState.permissionStatus?.camera === 'granted' ? (
                    <>
                      <Check className="w-3 h-3 mr-1" /> Allowed
                    </>
                  ) : deviceState.permissionStatus?.camera === 'denied' ? (
                    <>
                      <AlertCircle className="w-3 h-3 mr-1" /> Denied
                    </>
                  ) : (
                    'Prompt / Default'
                  )}
                </span>
              </div>

              <div className="rounded-lg bg-[#15161C] p-3.5 border border-[#282A36] flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-white flex items-center space-x-1.5">
                    <Shield className="w-3.5 h-3.5 text-[#A855F7]" />
                    <span>Screen Sharing Capability</span>
                  </h4>
                  <p className="text-[11px] text-[#A1A1AA] mt-1">
                    Supported via standard browser getDisplayMedia API with window and tab capture.
                  </p>
                </div>
                <span className="flex items-center text-[11px] text-[#10B981] font-medium bg-[#10B981]/10 px-2 py-0.5 rounded border border-[#10B981]/20">
                  <Check className="w-3 h-3 mr-1" /> Supported
                </span>
              </div>

              <div className="mt-4 p-3 rounded-lg border border-[#282A36] bg-[#0B0C0E]/50 flex items-start space-x-2">
                <Info className="w-4 h-4 text-[#06B6D4] flex-shrink-0 mt-0.5" />
                <div className="text-[11px] text-[#A1A1AA] leading-relaxed">
                  Hardware access permissions are managed directly by your browser security context. If a device fails to initialize, verify that permission has not been blocked in your address bar security icon.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#282A36] bg-[#0B0C0E] flex items-center justify-between">
          <div className="flex items-center space-x-1.5 text-[11px] text-[#71717A]">
            <span>Hardware state synced</span>
            <span>•</span>
            <span>{availableAudioInputs.length + availableVideoInputs.length} total media devices</span>
          </div>
          <button
            onClick={() => {
              setIsSettingsOpen(false);
              showToast('Hardware settings applied successfully');
            }}
            className="px-4 py-1.5 rounded-lg bg-[#FF9100] hover:bg-[#E08000] text-black font-semibold text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
