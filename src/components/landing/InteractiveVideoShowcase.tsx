'use client';

/**
 * InteractiveVideoShowcase Component
 *
 * Minimalist single frame showcase:
 * Automatically plays the live demonstration video in a continuous smooth loop.
 * Pure video presentation with zero text overlays, headers, or telemetry labels.
 */

import React, { useRef, useEffect } from 'react';

export const InteractiveVideoShowcase: React.FC<{ isDark?: boolean }> = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Automatic uninterrupted playback & smooth infinite loop enforcement
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    const playVideo = () => {
      const promise = video.play();
      if (promise !== undefined) {
        promise.catch(() => {
          // Retry on user scroll or touch/click
          const unlock = () => {
            if (videoRef.current) {
              videoRef.current.play().catch(() => {});
            }
            window.removeEventListener('scroll', unlock);
            window.removeEventListener('click', unlock);
            window.removeEventListener('touchstart', unlock);
          };
          window.addEventListener('scroll', unlock, { once: true, passive: true });
          window.addEventListener('click', unlock, { once: true, passive: true });
          window.addEventListener('touchstart', unlock, { once: true, passive: true });
        });
      }
    };

    playVideo();
  }, []);

  const handleEnded = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  };

  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  };

  return (
    <section className="relative w-full overflow-hidden py-12 sm:py-16">
      {/* Subtle ambient lighting behind the frame */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-gradient-to-b from-[#FF9100]/10 via-[#FF3D00]/5 to-transparent blur-3xl opacity-60 dark:opacity-30" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Single clean video frame with zero text */}
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl sm:rounded-3xl border border-zinc-200/90 dark:border-white/[0.12] bg-black shadow-2xl ring-1 ring-black/5 dark:ring-white/5 transition-all duration-300">
          <video
            ref={videoRef}
            src="/videos/finalcortex.mp4"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            onEnded={handleEnded}
            onClick={handleTogglePlay}
            className="h-full w-full object-cover cursor-pointer select-none"
          />
        </div>
      </div>
    </section>
  );
};
