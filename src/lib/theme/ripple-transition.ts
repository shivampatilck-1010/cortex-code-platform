/**
 * Universal Circular Expanding Ripple Theme Transition Engine
 *
 * Implements a high-performance circular clipping-mask animation originating from
 * the theme toggle button coordinates, growing to cover the entire viewport, and
 * transitioning the IDE theme seamlessly.
 */

export function triggerThemeRippleTransition(
  originX: number,
  originY: number,
  targetTheme: 'light' | 'dark',
  onThemeChange: () => void
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    onThemeChange();
    return;
  }

  // Remove any stale ripple overlays from rapid clicking
  const existingOverlays = document.querySelectorAll('[data-theme-ripple="true"]');
  existingOverlays.forEach((el) => {
    if (el.parentNode) el.parentNode.removeChild(el);
  });

  // Calculate the maximum distance from button coordinates to the furthest screen corner
  const maxRadius = Math.ceil(
    Math.hypot(
      Math.max(originX, window.innerWidth - originX),
      Math.max(originY, window.innerHeight - originY)
    )
  );

  const circleColor = targetTheme === 'light' ? '#ffffff' : '#0b0c0e';

  // Create full-page isolated overlay container
  const overlay = document.createElement('div');
  overlay.setAttribute('data-theme-ripple', 'true');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = circleColor;
  overlay.style.zIndex = '999999';
  overlay.style.pointerEvents = 'none';
  overlay.style.clipPath = `circle(0px at ${originX}px ${originY}px)`;
  overlay.style.willChange = 'clip-path, opacity';

  document.body.appendChild(overlay);

  let themeUpdated = false;
  const applyThemeUpdate = () => {
    if (!themeUpdated) {
      themeUpdated = true;
      onThemeChange();
    }
  };

  if (typeof overlay.animate === 'function') {
    // Hardware-accelerated Web Animations API
    const expandAnim = overlay.animate(
      [
        { clipPath: `circle(0px at ${originX}px ${originY}px)` },
        { clipPath: `circle(${maxRadius + 40}px at ${originX}px ${originY}px)` },
      ],
      {
        duration: 480,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'forwards',
      }
    );

    // Apply IDE theme update as the expanding circle covers the view
    const themeTimer = setTimeout(applyThemeUpdate, 320);

    expandAnim.onfinish = () => {
      clearTimeout(themeTimer);
      applyThemeUpdate();

      const fadeAnim = overlay.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: 250, fill: 'forwards' }
      );

      fadeAnim.onfinish = () => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      };
    };

    // Safety fallback cleanup
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, 900);
  } else {
    // Fallback for headless environments or older browsers
    overlay.style.transition = 'clip-path 500ms cubic-bezier(0.22, 1, 0.36, 1)';
    overlay.getBoundingClientRect();
    overlay.style.clipPath = `circle(${maxRadius + 40}px at ${originX}px ${originY}px)`;

    setTimeout(() => {
      applyThemeUpdate();
      overlay.style.transition = 'opacity 250ms ease-out';
      overlay.style.opacity = '0';
    }, 350);

    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, 700);
  }
}
