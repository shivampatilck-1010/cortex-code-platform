'use client';

import React, { useEffect, useMemo, useRef, useState, CSSProperties } from 'react';
import Link from 'next/link';
import * as THREE from 'three';
import { Renderer, Program, Mesh as OglMesh, Color as OglColor, Triangle } from 'ogl';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(' ');
}

export class SafeVisualEffectBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.warn('[SafeVisualEffectBoundary] Visual effect caught and suppressed:', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}

/* ============================================================================
 * 8. INTERACTIVE CURSOR-GLOW CTA BUTTON (CSS Variables --x / --y + Right Arrow)
 * ========================================================================== */
export interface GlowCtaButtonProps {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'book-call' | 'dark';
  className?: string;
  glowColor?: string;
  showArrow?: boolean;
  showUnderline?: boolean;
  target?: string;
  rel?: string;
}

export function GlowCtaButton({
  href,
  onClick,
  children,
  variant = 'primary',
  className = '',
  glowColor = 'rgba(255, 145, 0, 0.42)',
  showArrow = true,
  showUnderline = true,
  target,
  rel,
}: GlowCtaButtonProps) {
  const ref = useRef<HTMLElement | null>(null);

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    el.style.setProperty('--x', `${x}px`);
    el.style.setProperty('--y', `${y}px`);
  };

  const isDarkBase = variant === 'primary' || variant === 'dark' || variant === 'book-call';

  const sharedClasses = cn(
    'group relative inline-flex items-center justify-center gap-2.5 overflow-hidden rounded-full px-6 py-3 text-xs font-semibold tracking-wide transition-all duration-300 select-none cursor-pointer animate-slide-blur-in',
    isDarkBase
      ? 'border border-[#FF9100]/50 bg-[#070708] text-white shadow-[0_0_20px_-3px_rgba(255,145,0,0.35)] hover:border-[#FF9100] hover:shadow-[0_0_35px_rgba(255,145,0,0.55)] hover:scale-[1.02]'
      : 'border border-zinc-300 bg-white/95 text-zinc-950 dark:border-white/15 dark:bg-[#070708] dark:text-zinc-100 hover:border-zinc-400 dark:hover:border-[#FF9100] hover:scale-[1.02]',
    className
  );

  const innerContent = (
    <>
      {/* Outer ambient cursor-following halo glow */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-[1px] rounded-full opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-75"
        style={{
          background: `radial-gradient(140px circle at var(--x, 50%) var(--y, 50%), rgba(255, 145, 0, 0.55), transparent 80%)`,
        }}
      />
      {/* Cursor-tracked radial glow driven by --x and --y */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(120px circle at var(--x, 50%) var(--y, 50%), ${glowColor}, transparent 75%)`,
        }}
      />
      {/* Subtle inner glass rim */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full border border-white/10 opacity-60"
      />
      {/* Foreground Content with Underline Expansion and Arrow Icon Shift */}
      <span className="relative z-10 flex items-center gap-2">
        <span className="relative inline-block font-mono font-bold tracking-wider">
          {children}
          {showUnderline && (
            <span
              aria-hidden="true"
              className="absolute -bottom-1 left-0 h-[1.5px] w-0 bg-gradient-to-r from-[#FF9100] via-amber-400 to-[#FF9100] transition-all duration-300 ease-out group-hover:w-full rounded-full"
            />
          )}
        </span>
        {showArrow && (
          <svg
            className="h-3.5 w-3.5 text-[#FF9100] transition-transform duration-300 ease-out group-hover:translate-x-1.5 group-hover:scale-110"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3.5 8H12.5M12.5 8L8.5 4M12.5 8L8.5 12"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </>
  );

  if (href) {
    const computedRel = rel ?? (target === '_blank' ? 'noopener noreferrer' : undefined);
    return (
      <Link
        href={href}
        target={target}
        rel={computedRel}
        ref={ref as React.RefObject<HTMLAnchorElement>}
        onPointerMove={handlePointerMove}
        className={sharedClasses}
      >
        {innerContent}
      </Link>
    );
  }

  return (
    <button
      type="button"
      ref={ref as React.RefObject<HTMLButtonElement>}
      onClick={onClick}
      onPointerMove={handlePointerMove}
      className={sharedClasses}
    >
      {innerContent}
    </button>
  );
}

export const InteractiveGlowButton = GlowCtaButton;

/* ============================================================================
 * 0. LIQUID ETHER (WebGL Navier-Stokes Fluid Simulation)
 * ========================================================================== */
export interface LiquidEtherProps {
  mouseForce?: number;
  cursorSize?: number;
  isViscous?: boolean;
  viscous?: number;
  iterationsViscous?: number;
  iterationsPoisson?: number;
  dt?: number;
  BFECC?: boolean;
  resolution?: number;
  isBounce?: boolean;
  colors?: string[];
  style?: React.CSSProperties;
  className?: string;
  autoDemo?: boolean;
  autoSpeed?: number;
  autoIntensity?: number;
  takeoverDuration?: number;
  autoResumeDelay?: number;
  autoRampDuration?: number;
}

export function LiquidEther({
  mouseForce = 22,
  cursorSize = 110,
  isViscous = false,
  viscous = 30,
  iterationsViscous = 32,
  iterationsPoisson = 32,
  dt = 0.014,
  BFECC = true,
  resolution = 0.5,
  isBounce = false,
  colors = ['#FF9100', '#FF3D00', '#6366F1'],
  style = {},
  className = '',
  autoDemo = true,
  autoSpeed = 0.5,
  autoIntensity = 2.2,
  takeoverDuration = 0.25,
  autoResumeDelay = 1000,
  autoRampDuration = 0.6,
}: LiquidEtherProps): React.ReactElement {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const rafRef = useRef<number | null>(null);
  const resizeRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    function makePaletteTexture(stops: string[]): THREE.DataTexture {
      const arr = Array.isArray(stops) && stops.length > 0 ? (stops.length === 1 ? [stops[0], stops[0]] : stops) : ['#ffffff', '#ffffff'];
      const w = arr.length;
      const data = new Uint8Array(w * 4);
      for (let i = 0; i < w; i++) {
        const c = new THREE.Color(arr[i]);
        data[i * 4 + 0] = Math.round(c.r * 255);
        data[i * 4 + 1] = Math.round(c.g * 255);
        data[i * 4 + 2] = Math.round(c.b * 255);
        data[i * 4 + 3] = 255;
      }
      const tex = new THREE.DataTexture(data, w, 1, THREE.RGBAFormat);
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearFilter;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.generateMipmaps = false;
      tex.needsUpdate = true;
      return tex;
    }

    const paletteTex = makePaletteTexture(colors);
    const bgVec4 = new THREE.Vector4(0, 0, 0, 0);

    class CommonClass {
      width = 0;
      height = 0;
      aspect = 1;
      pixelRatio = 1;
      time = 0;
      delta = 0;
      container: HTMLElement | null = null;
      renderer: THREE.WebGLRenderer | null = null;
      clock: THREE.Clock | null = null;

      init(container: HTMLElement) {
        this.container = container;
        this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        this.resize();
        try {
          this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, failIfMajorPerformanceCaveat: false });
          this.renderer.autoClear = false;
          this.renderer.setClearColor(new THREE.Color(0x000000), 0);
          this.renderer.setPixelRatio(this.pixelRatio);
          this.renderer.setSize(this.width, this.height);
          const el = this.renderer.domElement;
          el.style.width = '100%';
          el.style.height = '100%';
          el.style.display = 'block';
          this.clock = new THREE.Clock();
          this.clock.start();
        } catch (e) {
          console.warn('[LiquidEther] WebGLRenderer init failed, falling back:', e);
          this.renderer = null;
        }
      }

      resize() {
        if (!this.container) return;
        const rect = this.container.getBoundingClientRect();
        this.width = Math.max(1, Math.floor(rect.width));
        this.height = Math.max(1, Math.floor(rect.height));
        this.aspect = this.width / this.height;
        if (this.renderer) this.renderer.setSize(this.width, this.height, false);
      }

      update() {
        if (!this.clock) return;
        this.delta = this.clock.getDelta();
        this.time += this.delta;
      }
    }

    const Common = new CommonClass();

    class MouseClass {
      mouseMoved = false;
      coords = new THREE.Vector2();
      coords_old = new THREE.Vector2();
      diff = new THREE.Vector2();
      timer: number | null = null;
      container: HTMLElement | null = null;
      docTarget: Document | null = null;
      listenerTarget: Window | null = null;
      isHoverInside = false;
      hasUserControl = false;
      isAutoActive = false;
      autoIntensity = 2.0;
      takeoverActive = false;
      takeoverStartTime = 0;
      takeoverDuration = 0.25;
      takeoverFrom = new THREE.Vector2();
      takeoverTo = new THREE.Vector2();
      onInteract: (() => void) | null = null;

      private _onMouseMove = this.onDocumentMouseMove.bind(this);
      private _onTouchStart = this.onDocumentTouchStart.bind(this);
      private _onTouchMove = this.onDocumentTouchMove.bind(this);
      private _onTouchEnd = this.onTouchEnd.bind(this);
      private _onDocumentLeave = this.onDocumentLeave.bind(this);

      init(container: HTMLElement) {
        this.container = container;
        this.docTarget = container.ownerDocument || null;
        const defaultView = this.docTarget?.defaultView || (typeof window !== 'undefined' ? window : null);
        if (!defaultView) return;
        this.listenerTarget = defaultView;
        this.listenerTarget.addEventListener('mousemove', this._onMouseMove);
        this.listenerTarget.addEventListener('touchstart', this._onTouchStart, { passive: true });
        this.listenerTarget.addEventListener('touchmove', this._onTouchMove, { passive: true });
        this.listenerTarget.addEventListener('touchend', this._onTouchEnd);
        this.docTarget?.addEventListener('mouseleave', this._onDocumentLeave);
      }

      dispose() {
        if (this.listenerTarget) {
          this.listenerTarget.removeEventListener('mousemove', this._onMouseMove);
          this.listenerTarget.removeEventListener('touchstart', this._onTouchStart);
          this.listenerTarget.removeEventListener('touchmove', this._onTouchMove);
          this.listenerTarget.removeEventListener('touchend', this._onTouchEnd);
        }
        if (this.docTarget) this.docTarget.removeEventListener('mouseleave', this._onDocumentLeave);
      }

      private updateHoverState(clientX: number, clientY: number) {
        if (!this.container) return false;
        const rect = this.container.getBoundingClientRect();
        this.isHoverInside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
        return this.isHoverInside;
      }

      setCoords(x: number, y: number) {
        if (!this.container) return;
        if (this.timer) window.clearTimeout(this.timer);
        const rect = this.container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const nx = (x - rect.left) / rect.width;
        const ny = (y - rect.top) / rect.height;
        this.coords.set(nx * 2 - 1, -(ny * 2 - 1));
        this.mouseMoved = true;
        this.timer = window.setTimeout(() => { this.mouseMoved = false; }, 100);
      }

      setNormalized(nx: number, ny: number) {
        this.coords.set(nx, ny);
        this.mouseMoved = true;
      }

      onDocumentMouseMove(event: MouseEvent) {
        if (!this.updateHoverState(event.clientX, event.clientY)) return;
        if (this.onInteract) this.onInteract();
        if (this.isAutoActive && !this.hasUserControl && !this.takeoverActive) {
          if (!this.container) return;
          const rect = this.container.getBoundingClientRect();
          const nx = (event.clientX - rect.left) / rect.width;
          const ny = (event.clientY - rect.top) / rect.height;
          this.takeoverFrom.copy(this.coords);
          this.takeoverTo.set(nx * 2 - 1, -(ny * 2 - 1));
          this.takeoverStartTime = performance.now();
          this.takeoverActive = true;
          this.hasUserControl = true;
          this.isAutoActive = false;
          return;
        }
        this.setCoords(event.clientX, event.clientY);
        this.hasUserControl = true;
      }

      onDocumentTouchStart(event: TouchEvent) {
        if (event.touches.length !== 1) return;
        const t = event.touches[0];
        if (!this.updateHoverState(t.clientX, t.clientY)) return;
        if (this.onInteract) this.onInteract();
        this.setCoords(t.clientX, t.clientY);
        this.hasUserControl = true;
      }

      onDocumentTouchMove(event: TouchEvent) {
        if (event.touches.length !== 1) return;
        const t = event.touches[0];
        if (!this.updateHoverState(t.clientX, t.clientY)) return;
        if (this.onInteract) this.onInteract();
        this.setCoords(t.clientX, t.clientY);
      }

      onTouchEnd() { this.isHoverInside = false; }
      onDocumentLeave() { this.isHoverInside = false; }

      update() {
        if (this.takeoverActive) {
          const t = (performance.now() - this.takeoverStartTime) / (this.takeoverDuration * 1000);
          if (t >= 1) {
            this.takeoverActive = false;
            this.coords.copy(this.takeoverTo);
            this.coords_old.copy(this.coords);
            this.diff.set(0, 0);
          } else {
            const k = t * t * (3 - 2 * t);
            this.coords.copy(this.takeoverFrom).lerp(this.takeoverTo, k);
          }
        }
        this.diff.subVectors(this.coords, this.coords_old);
        this.coords_old.copy(this.coords);
        if (this.coords_old.x === 0 && this.coords_old.y === 0) this.diff.set(0, 0);
        if (this.isAutoActive && !this.takeoverActive) this.diff.multiplyScalar(this.autoIntensity);
      }
    }

    const Mouse = new MouseClass();

    class AutoDriver {
      mouse: MouseClass;
      manager: any;
      enabled: boolean;
      speed: number;
      resumeDelay: number;
      rampDurationMs: number;
      active = false;
      current = new THREE.Vector2(0, 0);
      target = new THREE.Vector2();
      lastTime = performance.now();
      activationTime = 0;
      margin = 0.2;
      private _tmpDir = new THREE.Vector2();

      constructor(mouse: MouseClass, manager: any, opts: any) {
        this.mouse = mouse;
        this.manager = manager;
        this.enabled = opts.enabled;
        this.speed = opts.speed;
        this.resumeDelay = opts.resumeDelay || 3000;
        this.rampDurationMs = (opts.rampDuration || 0) * 1000;
        this.pickNewTarget();
      }

      pickNewTarget() {
        this.target.set((Math.random() * 2 - 1) * (1 - this.margin), (Math.random() * 2 - 1) * (1 - this.margin));
      }

      forceStop() {
        this.active = false;
        this.mouse.isAutoActive = false;
      }

      update() {
        if (!this.enabled) return;
        const now = performance.now();
        if (now - this.manager.lastUserInteraction < this.resumeDelay || this.mouse.isHoverInside) {
          if (this.active) this.forceStop();
          return;
        }
        if (!this.active) {
          this.active = true;
          this.current.copy(this.mouse.coords);
          this.lastTime = now;
          this.activationTime = now;
        }
        this.mouse.isAutoActive = true;
        let dtSec = (now - this.lastTime) / 1000;
        this.lastTime = now;
        if (dtSec > 0.2) dtSec = 0.016;
        const dir = this._tmpDir.subVectors(this.target, this.current);
        const dist = dir.length();
        if (dist < 0.01) {
          this.pickNewTarget();
          return;
        }
        dir.normalize();
        let ramp = 1;
        if (this.rampDurationMs > 0) {
          const t = Math.min(1, (now - this.activationTime) / this.rampDurationMs);
          ramp = t * t * (3 - 2 * t);
        }
        this.current.addScaledVector(dir, Math.min(this.speed * dtSec * ramp, dist));
        this.mouse.setNormalized(this.current.x, this.current.y);
      }
    }

    const face_vert = `attribute vec3 position; uniform vec2 boundarySpace; varying vec2 uv; precision highp float; void main(){ vec3 pos = position; pos.xy *= (1.0 - boundarySpace * 2.0); uv = vec2(0.5)+(pos.xy)*0.5; gl_Position = vec4(pos, 1.0); }`;
    const line_vert = `attribute vec3 position; uniform vec2 px; precision highp float; varying vec2 uv; void main(){ vec3 pos = position; uv = 0.5 + pos.xy * 0.5; vec2 n = sign(pos.xy); pos.xy = (abs(pos.xy) - px) * n; gl_Position = vec4(pos, 1.0); }`;
    const mouse_vert = `precision highp float; attribute vec3 position; attribute vec2 uv; uniform vec2 center; uniform vec2 scale; uniform vec2 px; varying vec2 vUv; void main(){ vec2 pos = position.xy * scale * 2.0 * px + center; vUv = uv; gl_Position = vec4(pos, 0.0, 1.0); }`;
    const advection_frag = `precision highp float; uniform sampler2D velocity; uniform float dt; uniform bool isBFECC; uniform vec2 fboSize; varying vec2 uv; void main(){ vec2 ratio = max(fboSize.x, fboSize.y) / fboSize; if(!isBFECC){ vec2 vel = texture2D(velocity, uv).xy; gl_FragColor = vec4(texture2D(velocity, uv - vel * dt * ratio).xy, 0.0, 0.0); } else { vec2 vel_old = texture2D(velocity, uv).xy; vec2 spot_old = uv - vel_old * dt * ratio; vec2 vel_new1 = texture2D(velocity, spot_old).xy; vec2 spot_new3 = uv - (spot_old + vel_new1 * dt * ratio - uv) / 2.0; vec2 vel_2 = texture2D(velocity, spot_new3).xy; gl_FragColor = vec4(texture2D(velocity, spot_new3 - vel_2 * dt * ratio).xy, 0.0, 0.0); } }`;
    const color_frag = `precision highp float; uniform sampler2D velocity; uniform sampler2D palette; uniform vec4 bgColor; varying vec2 uv; void main(){ vec2 vel = texture2D(velocity, uv).xy; float lenv = clamp(length(vel), 0.0, 1.0); vec3 c = texture2D(palette, vec2(lenv, 0.5)).rgb; gl_FragColor = vec4(mix(bgColor.rgb, c, lenv), mix(bgColor.a, 1.0, lenv)); }`;
    const divergence_frag = `precision highp float; uniform sampler2D velocity; uniform float dt; uniform vec2 px; varying vec2 uv; void main(){ float x0 = texture2D(velocity, uv-vec2(px.x, 0.0)).x; float x1 = texture2D(velocity, uv+vec2(px.x, 0.0)).x; float y0 = texture2D(velocity, uv-vec2(0.0, px.y)).y; float y1 = texture2D(velocity, uv+vec2(0.0, px.y)).y; gl_FragColor = vec4(((x1 - x0 + y1 - y0) / 2.0) / dt); }`;
    const externalForce_frag = `precision highp float; uniform vec2 force; varying vec2 vUv; void main(){ vec2 circle = (vUv - 0.5) * 2.0; float d = 1.0 - min(length(circle), 1.0); gl_FragColor = vec4(force * d * d, 0.0, 1.0); }`;
    const poisson_frag = `precision highp float; uniform sampler2D pressure; uniform sampler2D divergence; uniform vec2 px; varying vec2 uv; void main(){ float p0 = texture2D(pressure, uv + vec2(px.x * 2.0, 0.0)).r; float p1 = texture2D(pressure, uv - vec2(px.x * 2.0, 0.0)).r; float p2 = texture2D(pressure, uv + vec2(0.0, px.y * 2.0)).r; float p3 = texture2D(pressure, uv - vec2(0.0, px.y * 2.0)).r; float div = texture2D(divergence, uv).r; gl_FragColor = vec4((p0 + p1 + p2 + p3) / 4.0 - div); }`;
    const pressure_frag = `precision highp float; uniform sampler2D pressure; uniform sampler2D velocity; uniform vec2 px; uniform float dt; varying vec2 uv; void main(){ float p0 = texture2D(pressure, uv + vec2(px.x * 2.0, 0.0)).r; float p1 = texture2D(pressure, uv - vec2(px.x * 2.0, 0.0)).r; float p2 = texture2D(pressure, uv + vec2(0.0, px.y * 2.0)).r; float p3 = texture2D(pressure, uv - vec2(0.0, px.y * 2.0)).r; vec2 v = texture2D(velocity, uv).xy - vec2(p0 - p1, p2 - p3) * 0.5 * dt; gl_FragColor = vec4(v, 0.0, 1.0); }`;
    const viscous_frag = `precision highp float; uniform sampler2D velocity; uniform sampler2D velocity_new; uniform float v; uniform vec2 px; uniform float dt; varying vec2 uv; void main(){ vec2 old = texture2D(velocity, uv).xy; vec2 n0 = texture2D(velocity_new, uv + vec2(px.x * 2.0, 0.0)).xy; vec2 n1 = texture2D(velocity_new, uv - vec2(px.x * 2.0, 0.0)).xy; vec2 n2 = texture2D(velocity_new, uv + vec2(0.0, px.y * 2.0)).xy; vec2 n3 = texture2D(velocity_new, uv - vec2(0.0, px.y * 2.0)).xy; gl_FragColor = vec4((4.0 * old + v * dt * (n0 + n1 + n2 + n3)) / (4.0 * (1.0 + v * dt)), 0.0, 0.0); }`;

    class FboPass {
      props: any;
      uniforms: any;
      scene = new THREE.Scene();
      camera = new THREE.Camera();
      constructor(props: any) {
        this.props = props || {};
        this.uniforms = this.props.material?.uniforms;
        if (this.uniforms) {
          this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.RawShaderMaterial(this.props.material)));
        }
      }
      render() {
        if (!Common.renderer) return;
        Common.renderer.setRenderTarget(this.props.output || null);
        Common.renderer.render(this.scene, this.camera);
        Common.renderer.setRenderTarget(null);
      }
    }

    class Simulation {
      options = {
        iterations_poisson: iterationsPoisson,
        iterations_viscous: iterationsViscous,
        mouse_force: mouseForce,
        resolution,
        cursor_size: cursorSize,
        viscous,
        isBounce,
        dt,
        isViscous,
        BFECC,
      };
      fbos: Record<string, THREE.WebGLRenderTarget> = {};
      fboSize = new THREE.Vector2();
      cellScale = new THREE.Vector2();
      boundarySpace = new THREE.Vector2();
      advection!: FboPass;
      externalForce!: FboPass;
      mouseMesh!: THREE.Mesh;
      viscousPass!: FboPass;
      divergencePass!: FboPass;
      poissonPass!: FboPass;
      pressurePass!: FboPass;

      constructor() {
        this.calcSize();
        const type = /(iPad|iPhone|iPod)/i.test(navigator.userAgent) ? THREE.HalfFloatType : THREE.FloatType;
        const opts = { type, depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping };
        ['vel_0', 'vel_1', 'vel_viscous0', 'vel_viscous1', 'div', 'pressure_0', 'pressure_1'].forEach((k) => {
          this.fbos[k] = new THREE.WebGLRenderTarget(this.fboSize.x, this.fboSize.y, opts);
        });

        this.advection = new FboPass({
          material: { vertexShader: face_vert, fragmentShader: advection_frag, uniforms: { boundarySpace: { value: this.cellScale }, px: { value: this.cellScale }, fboSize: { value: this.fboSize }, velocity: { value: this.fbos.vel_0.texture }, dt: { value: this.options.dt }, isBFECC: { value: true } } },
          output: this.fbos.vel_1,
        });

        this.externalForce = new FboPass({ output: this.fbos.vel_1 });
        this.mouseMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.RawShaderMaterial({
            vertexShader: mouse_vert,
            fragmentShader: externalForce_frag,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            uniforms: { px: { value: this.cellScale }, force: { value: new THREE.Vector2() }, center: { value: new THREE.Vector2() }, scale: { value: new THREE.Vector2(this.options.cursor_size, this.options.cursor_size) } },
          })
        );
        this.externalForce.scene.add(this.mouseMesh);

        this.viscousPass = new FboPass({
          material: { vertexShader: face_vert, fragmentShader: viscous_frag, uniforms: { boundarySpace: { value: this.boundarySpace }, velocity: { value: this.fbos.vel_1.texture }, velocity_new: { value: this.fbos.vel_viscous0.texture }, v: { value: this.options.viscous }, px: { value: this.cellScale }, dt: { value: this.options.dt } } },
          output0: this.fbos.vel_viscous0,
          output1: this.fbos.vel_viscous1,
        });

        this.divergencePass = new FboPass({
          material: { vertexShader: face_vert, fragmentShader: divergence_frag, uniforms: { boundarySpace: { value: this.boundarySpace }, velocity: { value: this.fbos.vel_viscous0.texture }, px: { value: this.cellScale }, dt: { value: this.options.dt } } },
          output: this.fbos.div,
        });

        this.poissonPass = new FboPass({
          material: { vertexShader: face_vert, fragmentShader: poisson_frag, uniforms: { boundarySpace: { value: this.boundarySpace }, pressure: { value: this.fbos.pressure_0.texture }, divergence: { value: this.fbos.div.texture }, px: { value: this.cellScale } } },
          output0: this.fbos.pressure_0,
          output1: this.fbos.pressure_1,
        });

        this.pressurePass = new FboPass({
          material: { vertexShader: face_vert, fragmentShader: pressure_frag, uniforms: { boundarySpace: { value: this.boundarySpace }, pressure: { value: this.fbos.pressure_0.texture }, velocity: { value: this.fbos.vel_viscous0.texture }, px: { value: this.cellScale }, dt: { value: this.options.dt } } },
          output: this.fbos.vel_0,
        });
      }

      calcSize() {
        const w = Math.max(1, Math.round(this.options.resolution * Common.width));
        const h = Math.max(1, Math.round(this.options.resolution * Common.height));
        this.cellScale.set(1 / w, 1 / h);
        this.fboSize.set(w, h);
      }

      resize() {
        this.calcSize();
        Object.values(this.fbos).forEach((fbo) => fbo.setSize(this.fboSize.x, this.fboSize.y));
      }

      update() {
        this.boundarySpace.copy(this.options.isBounce ? new THREE.Vector2(0, 0) : this.cellScale);
        this.advection.render();

        const mUniforms = (this.mouseMesh.material as THREE.RawShaderMaterial).uniforms;
        mUniforms.force.value.set((Mouse.diff.x / 2) * this.options.mouse_force, (Mouse.diff.y / 2) * this.options.mouse_force);
        mUniforms.center.value.set(Mouse.coords.x, Mouse.coords.y);
        mUniforms.scale.value.set(this.options.cursor_size, this.options.cursor_size);
        this.externalForce.render();

        let vel = this.fbos.vel_1;
        if (this.options.isViscous) {
          for (let i = 0; i < this.options.iterations_viscous; i++) {
            const fbo_in = i % 2 === 0 ? this.viscousPass.props.output0 : this.viscousPass.props.output1;
            const fbo_out = i % 2 === 0 ? this.viscousPass.props.output1 : this.viscousPass.props.output0;
            this.viscousPass.uniforms.velocity_new.value = fbo_in.texture;
            this.viscousPass.props.output = fbo_out;
            this.viscousPass.render();
          }
          vel = this.options.iterations_viscous % 2 === 0 ? this.viscousPass.props.output0 : this.viscousPass.props.output1;
        }

        this.divergencePass.uniforms.velocity.value = vel.texture;
        this.divergencePass.render();

        for (let i = 0; i < this.options.iterations_poisson; i++) {
          const p_in = i % 2 === 0 ? this.poissonPass.props.output0 : this.poissonPass.props.output1;
          const p_out = i % 2 === 0 ? this.poissonPass.props.output1 : this.poissonPass.props.output0;
          this.poissonPass.uniforms.pressure.value = p_in.texture;
          this.poissonPass.props.output = p_out;
          this.poissonPass.render();
        }
        const pressure = this.options.iterations_poisson % 2 === 0 ? this.poissonPass.props.output0 : this.poissonPass.props.output1;

        this.pressurePass.uniforms.velocity.value = vel.texture;
        this.pressurePass.uniforms.pressure.value = pressure.texture;
        this.pressurePass.render();
      }
    }

    const wrapper = mountRef.current;
    let manager = {
      lastUserInteraction: performance.now(),
      running: true,
    };
    let io: IntersectionObserver | null = null;
    let ro: ResizeObserver | null = null;

    try {
      Common.init(wrapper);
      if (!Common.renderer) {
        console.warn('[LiquidEther] WebGLRenderer not available, skipping.');
        return;
      }

      Mouse.init(wrapper);
      Mouse.autoIntensity = autoIntensity;
      Mouse.takeoverDuration = takeoverDuration;

      const sim = new Simulation();
      const outScene = new THREE.Scene();
      const outCam = new THREE.Camera();
      outScene.add(
        new THREE.Mesh(
          new THREE.PlaneGeometry(2, 2),
          new THREE.RawShaderMaterial({
            vertexShader: face_vert,
            fragmentShader: color_frag,
            transparent: true,
            depthWrite: false,
            uniforms: { velocity: { value: sim.fbos.vel_0.texture }, boundarySpace: { value: new THREE.Vector2() }, palette: { value: paletteTex }, bgColor: { value: bgVec4 } },
          })
        )
      );

      wrapper.insertBefore(Common.renderer.domElement, wrapper.firstChild);

      const autoDriver = new AutoDriver(Mouse, manager, {
        enabled: autoDemo,
        speed: autoSpeed,
        resumeDelay: autoResumeDelay,
        rampDuration: autoRampDuration,
      });
      Mouse.onInteract = () => {
        manager.lastUserInteraction = performance.now();
        autoDriver.forceStop();
      };

      let isVisible = true;
      const onContextLost = (e: Event) => {
        e.preventDefault();
        console.warn('[LiquidEther] WebGL context lost, halting animation.');
        manager.running = false;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      };

      if (Common.renderer?.domElement) {
        Common.renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);
      }

      io = new IntersectionObserver(([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible && !rafRef.current && manager.running) {
          loop();
        }
      }, { threshold: 0.05 });
      io.observe(wrapper);

      const loop = () => {
        if (!manager.running || !isVisible) {
          rafRef.current = null;
          return;
        }
        try {
          autoDriver.update();
          Mouse.update();
          Common.update();
          sim.update();
          if (Common.renderer) {
            Common.renderer.setRenderTarget(null);
            Common.renderer.render(outScene, outCam);
          }
          rafRef.current = requestAnimationFrame(loop);
        } catch (err) {
          console.warn('[LiquidEther] Render loop halted safely:', err);
          manager.running = false;
          rafRef.current = null;
        }
      };
      loop();

      ro = new ResizeObserver(() => {
        if (resizeRafRef.current) cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = requestAnimationFrame(() => {
          try {
            Common.resize();
            sim.resize();
          } catch (_) {}
        });
      });
      ro.observe(wrapper);
      resizeObserverRef.current = ro;
    } catch (setupErr) {
      console.warn('[LiquidEther] Init error suppressed:', setupErr);
      manager.running = false;
    }

    return () => {
      manager.running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (io) io.disconnect();
      if (ro) ro.disconnect();
      Mouse.dispose();
      if (Common.renderer) {
        const c = Common.renderer.domElement;
        if (c.parentNode) c.parentNode.removeChild(c);
        Common.renderer.dispose();
      }
    };
  }, [colors, autoDemo, autoSpeed, autoIntensity, takeoverDuration, autoResumeDelay, autoRampDuration]);

  return (
    <SafeVisualEffectBoundary
      fallback={
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-orange-500/5 to-indigo-500/5 pointer-events-none" />
      }
    >
      <div
        ref={mountRef}
        className={`relative h-full w-full overflow-hidden pointer-events-none touch-none ${className}`}
        style={style}
      />
    </SafeVisualEffectBoundary>
  );
}

/* ============================================================================
 * 1 & 2. TUBES INTERACTIVE 3D BACKGROUND (Used in Hero Quick-Launch Cards)
 * ========================================================================== */
const randomColors = (count: number) =>
  new Array(count).fill(0).map(() => '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'));

export interface TubesBackgroundProps {
  children?: React.ReactNode;
  className?: string;
  enableClickInteraction?: boolean;
}

export function TubesBackground({
  children,
  className,
  enableClickInteraction = true,
}: TubesBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tubesRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;
    let io: IntersectionObserver | null = null;

    if (typeof IntersectionObserver !== 'undefined') {
      const target = containerRef.current || canvasRef.current;
      if (target) {
        io = new IntersectionObserver(
          ([entry]) => {
            const isVisible = entry.isIntersecting;
            if (tubesRef.current) {
              if (!isVisible && typeof tubesRef.current.pause === 'function') {
                tubesRef.current.pause();
              } else if (isVisible && typeof tubesRef.current.play === 'function') {
                tubesRef.current.play();
              }
            }
          },
          { threshold: 0.05 }
        );
        io.observe(target);
      }
    }

    const initTubes = async () => {
      if (!canvasRef.current) return;
      try {
        canvasRef.current.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          console.warn('[TubesBackground] WebGL context lost.');
        }, false);

        // Verify WebGL is actually usable before attempting CDN module load
        const gl = canvasRef.current.getContext('webgl') || canvasRef.current.getContext('experimental-webgl');
        if (!gl) return;

        // @ts-expect-error -- Dynamic CDN import of untyped ES module; bundler cannot resolve external URL at build time.
        const module = await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/threejs-components@0.0.19/build/cursors/tubes1.min.js');
        const TubesCursor = module.default;
        if (!mounted || !canvasRef.current) return;

        const app = TubesCursor(canvasRef.current, {
          tubes: {
            colors: ['#FF9100', '#FF3D00', '#6958d5'],
            lights: {
              intensity: 180,
              colors: ['#FF9100', '#fe8a2e', '#ff008a', '#60aed5'],
            },
          },
        });
        tubesRef.current = app;
      } catch (err) {
        console.warn('TubesCursor CDN fallback active:', err);
      }
    };

    initTubes();
    return () => {
      mounted = false;
      if (io) io.disconnect();
    };
  }, []);

  const handleClick = () => {
    if (!enableClickInteraction || !tubesRef.current?.tubes) return;
    try {
      tubesRef.current.tubes.setColors(randomColors(3));
      tubesRef.current.tubes.setLightsColors(randomColors(4));
    } catch (_) {}
  };

  return (
    <SafeVisualEffectBoundary
      fallback={
        <div className={cn('relative h-full w-full overflow-hidden bg-zinc-950/60 rounded-xl', className)}>
          <div className="relative z-10 h-full w-full">{children}</div>
        </div>
      }
    >
      <div
        ref={containerRef}
        onClick={handleClick}
        className={cn('relative h-full w-full overflow-hidden', className)}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 block h-full w-full opacity-55 transition-opacity duration-300 group-hover:opacity-85"
          style={{ touchAction: 'none' }}
        />
        <div className="relative z-10 h-full w-full">{children}</div>
      </div>
    </SafeVisualEffectBoundary>
  );
}

/* ============================================================================
 * 3. INTERACTIVE WAVES BACKGROUND (Used in Small Rectangular Cut-Out Side Panels)
 * ========================================================================== */
class Grad {
  constructor(public x: number, public y: number, public z: number) {}
  dot2(x: number, y: number): number {
    return this.x * x + this.y * y;
  }
}

class Noise {
  grad3: Grad[];
  p: number[];
  perm: number[] = new Array(512);
  gradP: Grad[] = new Array(512);
  constructor(seed = 0) {
    this.grad3 = [
      new Grad(1, 1, 0), new Grad(-1, 1, 0), new Grad(1, -1, 0), new Grad(-1, -1, 0),
      new Grad(1, 0, 1), new Grad(-1, 0, 1), new Grad(1, 0, -1), new Grad(-1, 0, -1),
      new Grad(0, 1, 1), new Grad(0, -1, 1), new Grad(0, 1, -1), new Grad(0, -1, -1),
    ];
    this.p = [
      151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180
    ];
    this.seed(seed);
  }
  seed(seed: number) {
    if (seed > 0 && seed < 1) seed *= 65536;
    seed = Math.floor(seed);
    if (seed < 256) seed |= seed << 8;
    for (let i = 0; i < 256; i++) {
      const v = i & 1 ? this.p[i] ^ (seed & 255) : this.p[i] ^ ((seed >> 8) & 255);
      this.perm[i] = this.perm[i + 256] = v;
      this.gradP[i] = this.gradP[i + 256] = this.grad3[v % 12];
    }
  }
  fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
  lerp(a: number, b: number, t: number) { return (1 - t) * a + t * b; }
  perlin2(x: number, y: number): number {
    let X = Math.floor(x), Y = Math.floor(y);
    x -= X; y -= Y; X &= 255; Y &= 255;
    const n00 = this.gradP[X + this.perm[Y]].dot2(x, y);
    const n01 = this.gradP[X + this.perm[Y + 1]].dot2(x, y - 1);
    const n10 = this.gradP[X + 1 + this.perm[Y]].dot2(x - 1, y);
    const n11 = this.gradP[X + 1 + this.perm[Y + 1]].dot2(x - 1, y - 1);
    const u = this.fade(x);
    return this.lerp(this.lerp(n00, n10, u), this.lerp(n01, n11, u), this.fade(y));
  }
}

export interface WavesProps {
  lineColor?: string;
  backgroundColor?: string;
  waveSpeedX?: number;
  waveSpeedY?: number;
  waveAmpX?: number;
  waveAmpY?: number;
  xGap?: number;
  yGap?: number;
  friction?: number;
  tension?: number;
  maxCursorMove?: number;
  style?: CSSProperties;
  className?: string;
}

export const InteractiveWavesBackground: React.FC<WavesProps> = ({
  lineColor = 'rgba(255, 145, 0, 0.22)',
  backgroundColor = 'transparent',
  waveSpeedX = 0.015,
  waveSpeedY = 0.006,
  waveAmpX = 24,
  waveAmpY = 12,
  xGap = 12,
  yGap = 28,
  friction = 0.925,
  tension = 0.005,
  maxCursorMove = 70,
  style = {},
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const noiseRef = useRef(new Noise(Math.random()));
  const frameIdRef = useRef<number | null>(null);
  const configRef = useRef({ lineColor, waveSpeedX, waveSpeedY, waveAmpX, waveAmpY, friction, tension, maxCursorMove, xGap, yGap });

  useEffect(() => {
    configRef.current = { lineColor, waveSpeedX, waveSpeedY, waveAmpX, waveAmpY, friction, tension, maxCursorMove, xGap, yGap };
  }, [lineColor, waveSpeedX, waveSpeedY, waveAmpX, waveAmpY, friction, tension, maxCursorMove, xGap, yGap]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let bounds = { width: 0, height: 0, left: 0, top: 0 };
    let lines: any[][] = [];
    const mouse = { x: -10, y: 0, lx: 0, ly: 0, sx: 0, sy: 0, v: 0, vs: 0, a: 0, set: false };

    const setSize = () => {
      const rect = container.getBoundingClientRect();
      bounds = { width: rect.width, height: rect.height, left: rect.left, top: rect.top };
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    const setLines = () => {
      lines = [];
      const { width, height } = bounds;
      const oWidth = width + 140, oHeight = height + 30;
      const { xGap, yGap } = configRef.current;
      const totalLines = Math.ceil(oWidth / xGap);
      const totalPoints = Math.ceil(oHeight / yGap);
      const xStart = (width - xGap * totalLines) / 2;
      const yStart = (height - yGap * totalPoints) / 2;
      for (let i = 0; i <= totalLines; i++) {
        const pts: any[] = [];
        for (let j = 0; j <= totalPoints; j++) {
          pts.push({ x: xStart + xGap * i, y: yStart + yGap * j, wave: { x: 0, y: 0 }, cursor: { x: 0, y: 0, vx: 0, vy: 0 } });
        }
        lines.push(pts);
      }
    };

    let isVisible = true;
    const tick = (t: number) => {
      if (!isVisible) {
        frameIdRef.current = null;
        return;
      }
      try {
        mouse.sx += (mouse.x - mouse.sx) * 0.1;
        mouse.sy += (mouse.y - mouse.sy) * 0.1;
        const dx = mouse.x - mouse.lx, dy = mouse.y - mouse.ly;
        const d = Math.hypot(dx, dy);
        mouse.v = d;
        mouse.vs += (d - mouse.vs) * 0.1;
        mouse.vs = Math.min(100, mouse.vs);
        mouse.lx = mouse.x;
        mouse.ly = mouse.y;
        mouse.a = Math.atan2(dy, dx);

        const { waveSpeedX, waveSpeedY, waveAmpX, waveAmpY, friction, tension, maxCursorMove, lineColor } = configRef.current;
        lines.forEach((pts) => {
          pts.forEach((p) => {
            const move = noiseRef.current.perlin2((p.x + t * waveSpeedX) * 0.002, (p.y + t * waveSpeedY) * 0.0015) * 12;
            p.wave.x = Math.cos(move) * waveAmpX;
            p.wave.y = Math.sin(move) * waveAmpY;
            const pdx = p.x - mouse.sx, pdy = p.y - mouse.sy;
            const dist = Math.hypot(pdx, pdy);
            const l = Math.max(150, mouse.vs);
            if (dist < l) {
              const s = 1 - dist / l;
              const f = Math.cos(dist * 0.001) * s;
              p.cursor.vx += Math.cos(mouse.a) * f * l * mouse.vs * 0.00065;
              p.cursor.vy += Math.sin(mouse.a) * f * l * mouse.vs * 0.00065;
            }
            p.cursor.vx += (0 - p.cursor.x) * tension;
            p.cursor.vy += (0 - p.cursor.y) * tension;
            p.cursor.vx *= friction;
            p.cursor.vy *= friction;
            p.cursor.x = Math.min(maxCursorMove, Math.max(-maxCursorMove, p.cursor.x + p.cursor.vx * 2));
            p.cursor.y = Math.min(maxCursorMove, Math.max(-maxCursorMove, p.cursor.y + p.cursor.vy * 2));
          });
        });

        ctx.clearRect(0, 0, bounds.width, bounds.height);
        ctx.beginPath();
        ctx.strokeStyle = lineColor;
        lines.forEach((points) => {
          points.forEach((p, idx) => {
            const x = p.x + p.wave.x + p.cursor.x;
            const y = p.y + p.wave.y + p.cursor.y;
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
        });
        ctx.stroke();
        frameIdRef.current = requestAnimationFrame(tick);
      } catch (err) {
        console.warn('[GhostCursor] Canvas tick error suppressed:', err);
        frameIdRef.current = null;
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      if (!mouse.set) {
        mouse.sx = mouse.lx = mouse.x;
        mouse.sy = mouse.ly = mouse.y;
        mouse.set = true;
      }
    };

    const onResize = () => { setSize(); setLines(); };
    setSize();
    setLines();

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined' && container) {
      io = new IntersectionObserver(([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible && !frameIdRef.current) {
          frameIdRef.current = requestAnimationFrame(tick);
        }
      }, { threshold: 0.05 });
      io.observe(container);
    } else {
      frameIdRef.current = requestAnimationFrame(tick);
    }

    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouseMove);

    return () => {
      if (io) io.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} style={{ backgroundColor, ...style }} className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
};

/* ============================================================================
 * 4 & 5. GHOST CURSOR (Three.js Smoky Bloom Trail)
 * ========================================================================== */
export interface GhostCursorProps {
  className?: string;
  style?: React.CSSProperties;
  trailLength?: number;
  inertia?: number;
  grainIntensity?: number;
  bloomStrength?: number;
  bloomRadius?: number;
  bloomThreshold?: number;
  brightness?: number;
  color?: string;
  mixBlendMode?: React.CSSProperties['mixBlendMode'];
  edgeIntensity?: number;
  zIndex?: number;
}

export const GhostCursor: React.FC<GhostCursorProps> = ({
  className = '',
  style = {},
  trailLength = 28,
  inertia = 0.45,
  grainIntensity = 0.04,
  bloomStrength = 0.35,
  bloomRadius = 0.8,
  bloomThreshold = 0.02,
  brightness = 1.15,
  color = '#FF9100',
  mixBlendMode = 'screen',
  edgeIntensity = 0,
  zIndex = 10,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = containerRef.current;
    const parent = host?.parentElement;
    if (!host || !parent) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let animId: number | null = null;

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, depth: false, stencil: false });
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.style.pointerEvents = 'none';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.position = 'absolute';
      renderer.domElement.style.inset = '0';
      if (mixBlendMode) renderer.domElement.style.mixBlendMode = String(mixBlendMode);
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const geom = new THREE.PlaneGeometry(2, 2);
      const maxTrail = Math.max(1, Math.floor(trailLength));
      const trailBuf = Array.from({ length: maxTrail }, () => new THREE.Vector2(0.5, 0.5));
      const currentMouse = new THREE.Vector2(0.5, 0.5);
      const targetMouse = new THREE.Vector2(0.5, 0.5);

      const baseColor = new THREE.Color(color);
      const material = new THREE.ShaderMaterial({
        defines: { MAX_TRAIL_LENGTH: maxTrail },
        uniforms: {
          iTime: { value: 0 },
          iResolution: { value: new THREE.Vector3(1, 1, 1) },
          iMouse: { value: currentMouse },
          iPrevMouse: { value: trailBuf.map((v) => v.clone()) },
          iOpacity: { value: 1.0 },
          iScale: { value: 1.0 },
          iBaseColor: { value: new THREE.Vector3(baseColor.r, baseColor.g, baseColor.b) },
          iBrightness: { value: brightness },
          iEdgeIntensity: { value: edgeIntensity },
        },
        vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`,
        fragmentShader: `
          uniform float iTime; uniform vec3 iResolution; uniform vec2 iMouse;
          uniform vec2 iPrevMouse[MAX_TRAIL_LENGTH]; uniform float iOpacity;
          uniform float iScale; uniform vec3 iBaseColor; uniform float iBrightness;
          float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7))) * 43758.5453123); }
          float noise(vec2 p){
            vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
            return mix(mix(hash(i), hash(i + vec2(1.,0.)), f.x), mix(hash(i + vec2(0.,1.)), hash(i + vec2(1.,1.)), f.x), f.y);
          }
          float fbm(vec2 p){
            float v = 0.0, a = 0.5; mat2 m = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
            for(int i=0;i<4;i++){ v += a * noise(p); p = m * p * 2.0; a *= 0.5; }
            return v;
          }
          vec4 blob(vec2 p, vec2 mousePos, float intensity, float activity) {
            float smoke = fbm(p * iScale + iTime * 0.15);
            float radius = 0.38;
            float distFactor = 1.0 - smoothstep(0.0, radius * activity, length(p - mousePos));
            float alpha = pow(smoke, 2.2) * distFactor;
            return vec4(iBaseColor * alpha * intensity, alpha * intensity);
          }
          void main() {
            vec2 uv = (gl_FragCoord.xy / iResolution.xy * 2.0 - 1.0) * vec2(iResolution.x / iResolution.y, 1.0);
            vec2 mouse = (iMouse * 2.0 - 1.0) * vec2(iResolution.x / iResolution.y, 1.0);
            vec3 colorAcc = vec3(0.0); float alphaAcc = 0.0;
            for (int i = 0; i < MAX_TRAIL_LENGTH; i++) {
              vec2 pm = (iPrevMouse[i] * 2.0 - 1.0) * vec2(iResolution.x / iResolution.y, 1.0);
              float progress = float(i) / float(MAX_TRAIL_LENGTH);
              float intensity = pow(1.0 - progress, 1.5) * iBrightness;
              vec4 b = blob(uv, pm, intensity, 1.0 - progress * 0.4);
              colorAcc += b.rgb * b.a;
              alphaAcc += b.a;
            }
            gl_FragColor = vec4(colorAcc, min(1.0, alphaAcc * iOpacity));
          }
        `,
        transparent: true,
        depthWrite: false,
      });

      const mesh = new THREE.Mesh(geom, material);
      scene.add(mesh);

      const updateSize = () => {
        if (!renderer || !parent) return;
        const rect = parent.getBoundingClientRect();
        const w = Math.max(1, Math.floor(rect.width));
        const h = Math.max(1, Math.floor(rect.height));
        renderer.setSize(w, h, false);
        material.uniforms.iResolution.value.set(w, h, 1);
      };

      const handlePointerMove = (e: MouseEvent) => {
        const rect = parent.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const nx = (e.clientX - rect.left) / rect.width;
          const ny = 1.0 - (e.clientY - rect.top) / rect.height;
          targetMouse.set(nx, ny);
        }
      };

      updateSize();
      window.addEventListener('resize', updateSize);
      parent.addEventListener('mousemove', handlePointerMove);

      let startTime = performance.now();
      const animate = (now: number) => {
        try {
          animId = requestAnimationFrame(animate);
          const elapsed = (now - startTime) / 1000;

          // Smooth follow
          currentMouse.lerp(targetMouse, 1.0 - inertia);
          material.uniforms.iMouse.value.copy(currentMouse);

          // Update trail buffer
          for (let i = maxTrail - 1; i > 0; i--) {
            trailBuf[i].copy(trailBuf[i - 1]);
          }
          trailBuf[0].copy(currentMouse);

          for (let i = 0; i < maxTrail; i++) {
            material.uniforms.iPrevMouse.value[i].copy(trailBuf[i]);
          }

          material.uniforms.iTime.value = elapsed;
          renderer?.render(scene, camera);
        } catch (err) {
          console.warn('[GhostCursor] Render frame halted:', err);
          if (animId) cancelAnimationFrame(animId);
        }
      };
      animId = requestAnimationFrame(animate);

      return () => {
        if (animId) cancelAnimationFrame(animId);
        window.removeEventListener('resize', updateSize);
        parent.removeEventListener('mousemove', handlePointerMove);
        if (renderer) {
          if (renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
          }
          renderer.dispose();
        }
      };
    } catch (err) {
      console.warn('GhostCursor WebGL init fallback:', err);
    }
  }, [trailLength, inertia, brightness, color, mixBlendMode, edgeIntensity]);

  return (
    <SafeVisualEffectBoundary>
      <div
        ref={containerRef}
        style={{ zIndex, ...style }}
        className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      />
    </SafeVisualEffectBoundary>
  );
};

/* ============================================================================
 * 6. SQUARES (2D Canvas Scrolling Geometric Grid with Hover Cell Fill)
 * ========================================================================== */
export interface SquaresProps {
  direction?: 'diagonal' | 'up' | 'down' | 'left' | 'right';
  speed?: number;
  borderColor?: string;
  squareSize?: number;
  hoverFillColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const Squares: React.FC<SquaresProps> = ({
  direction = 'diagonal',
  speed = 0.5,
  borderColor = '#1F242D',
  squareSize = 40,
  hoverFillColor = '#2A1C0D',
  className = '',
  style = {},
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number | null = null;
    let isVisible = true;
    let offset = { x: 0, y: 0 };

    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    handleResize();
    const ro = new ResizeObserver(handleResize);
    ro.observe(container);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current = null;
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    const render = () => {
      if (!isVisible) {
        animId = null;
        return;
      }
      try {
        const safeSquareSize = Math.max(16, squareSize || 48);
        const rect = container.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
          animId = requestAnimationFrame(render);
          return;
        }
        ctx.clearRect(0, 0, rect.width, rect.height);

        // Move offset according to direction and speed
        const step = speed * 0.6;
        switch (direction) {
          case 'up':
            offset.y = (offset.y - step) % safeSquareSize;
            break;
          case 'down':
            offset.y = (offset.y + step) % safeSquareSize;
            break;
          case 'left':
            offset.x = (offset.x - step) % safeSquareSize;
            break;
          case 'right':
            offset.x = (offset.x + step) % safeSquareSize;
            break;
          case 'diagonal':
          default:
            offset.x = (offset.x + step) % safeSquareSize;
            offset.y = (offset.y + step) % safeSquareSize;
            break;
        }

        const startX = Math.floor(offset.x % safeSquareSize) - safeSquareSize;
        const startY = Math.floor(offset.y % safeSquareSize) - safeSquareSize;

        // Draw hovered cell fill if mouse is inside
        if (mouseRef.current) {
          const mouseX = mouseRef.current.x;
          const mouseY = mouseRef.current.y;
          const col = Math.floor((mouseX - offset.x) / safeSquareSize);
          const row = Math.floor((mouseY - offset.y) / safeSquareSize);
          const cellX = col * safeSquareSize + (offset.x % safeSquareSize);
          const cellY = row * safeSquareSize + (offset.y % safeSquareSize);

          ctx.fillStyle = hoverFillColor;
          ctx.fillRect(cellX, cellY, safeSquareSize, safeSquareSize);
        }

        // Draw grid lines
        ctx.beginPath();
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;

        for (let x = startX; x <= rect.width + safeSquareSize; x += safeSquareSize) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, rect.height);
        }
        for (let y = startY; y <= rect.height + safeSquareSize; y += safeSquareSize) {
          ctx.moveTo(0, y);
          ctx.lineTo(rect.width, y);
        }
        ctx.stroke();

        animId = requestAnimationFrame(render);
      } catch (err) {
        console.warn('[Squares] Render loop suppressed:', err);
        animId = null;
      }
    };

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible && !animId) {
          animId = requestAnimationFrame(render);
        }
      }, { threshold: 0.05 });
      io.observe(container);
    } else {
      animId = requestAnimationFrame(render);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (io) io.disconnect();
      ro.disconnect();
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [direction, speed, borderColor, squareSize, hoverFillColor]);

  return (
    <div
      ref={containerRef}
      style={style}
      className={cn('absolute inset-0 overflow-hidden pointer-events-auto', className)}
    >
      <canvas ref={canvasRef} className="block h-full w-full pointer-events-none" />
    </div>
  );
};

/* ============================================================================
 * 7. AURORA (OGL WebGL Simplex Noise Northern Lights Ramp)
 * ========================================================================== */
export interface AuroraProps {
  colorStops?: string[];
  amplitude?: number;
  blend?: number;
  speed?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const Aurora: React.FC<AuroraProps> = ({
  colorStops = ['#FF9100', '#FF3232', '#3A29FF'],
  amplitude = 1.0,
  blend = 0.5,
  speed = 0.5,
  className = '',
  style = {},
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: Renderer | null = null;
    let animId: number | null = null;

    try {
      renderer = new Renderer({
        alpha: true,
        premultipliedAlpha: false,
        antialias: true,
      });
      const gl = renderer.gl;
      gl.clearColor(0, 0, 0, 0);

      const canvas = gl.canvas;
      canvas.style.position = 'absolute';
      canvas.style.inset = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.pointerEvents = 'none';
      container.appendChild(canvas);

      const geometry = new Triangle(gl);

      const parseColor = (hex: string): [number, number, number] => {
        const c = new THREE.Color(hex);
        return [c.r, c.g, c.b];
      };

      const c1 = parseColor(colorStops[0] || '#FF9100');
      const c2 = parseColor(colorStops[1] || '#FF3232');
      const c3 = parseColor(colorStops[2] || '#3A29FF');

      const program = new Program(gl, {
        vertex: `
          attribute vec2 uv;
          attribute vec2 position;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position, 0.0, 1.0);
          }
        `,
        fragment: `
          precision highp float;
          uniform float uTime;
          uniform float uAmplitude;
          uniform float uBlend;
          uniform vec3 uColor1;
          uniform vec3 uColor2;
          uniform vec3 uColor3;
          uniform vec2 uResolution;
          varying vec2 vUv;

          // Simplex 2D noise
          vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
          float snoise(vec2 v){
            const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
            vec2 i  = floor(v + dot(v, C.yy) );
            vec2 x0 = v -   i + dot(i, C.xx);
            vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
            vec4 x12 = x0.xyxy + C.xxzz;
            x12.xy -= i1;
            i = mod(i, 289.0);
            vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
            vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
            m = m*m ;
            m = m*m ;
            vec3 x = 2.0 * fract(p * C.www) - 1.0;
            vec3 h = abs(x) - 0.5;
            vec3 ox = floor(x + 0.5);
            vec3 a0 = x - ox;
            m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
            vec3 g;
            g.x  = a0.x  * x0.x  + h.x  * x0.y;
            g.yz = a0.yz * x12.xz + h.yz * x12.yw;
            return 130.0 * dot(m, g);
          }

          void main() {
            vec2 uv = vUv;
            float t = uTime * 0.4;
            
            // Layered wavy ribbon noise
            float n1 = snoise(vec2(uv.x * 2.5 + t * 0.2, uv.y * 1.2 - t * 0.15)) * uAmplitude;
            float n2 = snoise(vec2(uv.x * 4.0 - t * 0.3, uv.y * 2.5 + t * 0.1)) * 0.5;
            float noiseVal = (n1 + n2) * 0.5 + 0.5;

            // Height falloff curtain
            float verticalFade = smoothstep(0.0, 0.8, uv.y) * smoothstep(1.0, 0.3, uv.y);
            float curtain = pow(noiseVal, 1.8) * verticalFade * 1.4;

            // 3-color ramp blending
            vec3 color = mix(uColor1, uColor2, smoothstep(0.1, 0.6, noiseVal));
            color = mix(color, uColor3, smoothstep(0.5, 0.95, noiseVal));

            gl_FragColor = vec4(color * curtain, curtain * uBlend);
          }
        `,
        uniforms: {
          uTime: { value: 0 },
          uAmplitude: { value: amplitude },
          uBlend: { value: blend },
          uColor1: { value: c1 },
          uColor2: { value: c2 },
          uColor3: { value: c3 },
          uResolution: { value: [container.clientWidth || 300, container.clientHeight || 300] },
        },
        transparent: true,
      });

      const mesh = new OglMesh(gl, { geometry, program });

      const handleResize = () => {
        if (!container || !renderer) return;
        const w = container.clientWidth || 300;
        const h = container.clientHeight || 300;
        renderer.setSize(w, h);
        program.uniforms.uResolution.value = [w, h];
      };

      handleResize();
      window.addEventListener('resize', handleResize);

      let startTime = performance.now();
      let isVisible = true;
      const loop = (now: number) => {
        if (!isVisible) {
          animId = null;
          return;
        }
        try {
          animId = requestAnimationFrame(loop);
          const elapsed = (now - startTime) / 1000;
          program.uniforms.uTime.value = elapsed * speed;
          renderer?.render({ scene: mesh });
        } catch (err) {
          console.warn('[Aurora] Render loop stopped:', err);
          if (animId) cancelAnimationFrame(animId);
          animId = null;
        }
      };

      let io: IntersectionObserver | null = null;
      if (typeof IntersectionObserver !== 'undefined' && container) {
        io = new IntersectionObserver(([entry]) => {
          isVisible = entry.isIntersecting;
          if (isVisible && !animId) {
            animId = requestAnimationFrame(loop);
          }
        }, { threshold: 0.05 });
        io.observe(container);
      } else {
        animId = requestAnimationFrame(loop);
      }

      return () => {
        if (animId) cancelAnimationFrame(animId);
        if (io) io.disconnect();
        window.removeEventListener('resize', handleResize);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      };
    } catch (err) {
      console.warn('Aurora WebGL init fallback:', err);
    }
  }, [colorStops, amplitude, blend, speed]);

  return (
    <SafeVisualEffectBoundary>
      <div
        ref={containerRef}
        style={style}
        className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      />
    </SafeVisualEffectBoundary>
  );
};
