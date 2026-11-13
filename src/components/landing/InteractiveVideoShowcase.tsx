'use client';

/**
 * InteractiveVideoShowcase Component
 *
 * Minimalist single frame showcase:
 * Automatically plays the live demonstration video in a continuous smooth loop.
 * Pure video presentation with zero text overlays, headers, or telemetry labels.
 * Optimized with IntersectionObserver and hardware GPU layer compositing for buttery-smooth scrolling.
 */

import React, { useRef, useEffect } from 'react';

export const InteractiveVideoShowcase: React.FC<{ isDark?: boolean }> = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Automatic playback with viewport intersection pausing to ensure 60/120fps smooth scrolling
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const promise = video.play();
          if (promise !== undefined) {
            promise.catch(() => {});
          }
        } else {
          video.pause();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(video);

    // User interaction unlocker fallback
    const handleUnlock = () => {
      if (videoRef.current && videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      }
      window.removeEventListener('scroll', handleUnlock);
      window.removeEventListener('click', handleUnlock);
      window.removeEventListener('touchstart', handleUnlock);
    };

    window.addEventListener('scroll', handleUnlock, { once: true, passive: true });
    window.addEventListener('click', handleUnlock, { once: true, passive: true });
    window.addEventListener('touchstart', handleUnlock, { once: true, passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleUnlock);
      window.removeEventListener('click', handleUnlock);
      window.removeEventListener('touchstart', handleUnlock);
    };
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
    <div className="relative w-full">
      {/* Subtle ambient lighting behind the frame without heavy blur filters */}
      <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-b from-[#FF9100]/10 via-[#FF3D00]/5 to-transparent opacity-60 dark:opacity-30 blur-2xl -z-10" />

      {/* Single clean video frame with zero text */}
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl sm:rounded-3xl border border-zinc-200/90 dark:border-white/[0.12] bg-black shadow-2xl ring-1 ring-black/5 dark:ring-white/5 transition-all duration-300 transform-gpu">
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
  );
};
