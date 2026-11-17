'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CortexLogo } from '@/components/brand/CortexLogo';
import { CloudflareTurnstile, CloudflareTurnstileRef } from '@/components/auth/CloudflareTurnstile';

function MovingDotsBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none bg-black">
      <style dangerouslySetInnerHTML={{__html: `
        .moving-dots-bg {
          position: absolute;
          inset: -50%;
          width: 200%;
          height: 200%;
          background-image: radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px);
          background-size: 30px 30px;
          animation: panDots 4s linear infinite;
        }
        @keyframes panDots {
          0% { transform: translate(0, 0); }
          100% { transform: translate(-30px, -30px); }
        }
      `}} />
      <div className="moving-dots-bg"></div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const turnstileRef = useRef<CloudflareTurnstileRef>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          identifier, 
          password,
          cfTurnstileToken: turnstileToken || undefined,
        }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        // Reset turnstile on auth failure
        turnstileRef.current?.reset();
        setTurnstileToken('');
        throw new Error(data.error || 'Failed to login');
      }

      if (data.user) {
        try {
          localStorage.setItem('cortex_user', JSON.stringify(data.user));
          localStorage.setItem('cortex_user_profile', JSON.stringify(data.user));
          if (data.sessionId) {
            localStorage.setItem('cortex_session_id', data.sessionId);
          }
        } catch {}
      }

      const redirectParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('redirect') : null;
      const targetUrl = redirectParam && redirectParam.startsWith('/') ? redirectParam : '/classroom';
      router.push(targetUrl);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-y-auto text-gray-200 flex flex-col items-center justify-center p-4 relative bg-black">
      <MovingDotsBackground />
      
      <div className="max-w-md w-full bg-[#0A0A0A]/90 backdrop-blur-md border border-[#333333] rounded-2xl p-8 space-y-6 shadow-2xl relative z-10">
        <Link
          href="/"
          onClick={(e) => {
            e.preventDefault();
            window.location.href = '/';
          }}
          className="group flex items-center justify-center space-x-6 mb-8 focus:outline-none transition-transform hover:scale-[1.02] cursor-pointer"
          aria-label="Cortex Platform Home"
          title="Return to Cortex Platform Home"
        >
          <div className="transition-transform duration-200 group-hover:scale-105">
            <CortexLogo variant="icon" size="xl" />
          </div>
          <div className="flex flex-col items-center">
            <h1 className="text-4xl font-bold text-white tracking-tight transition-colors duration-200 group-hover:text-[#FF9100]">
              Cortex
            </h1>
            <p className="text-[13px] text-gray-400 font-medium mt-1">
              Secure Access Terminal
            </p>
          </div>
        </Link>

        {error && (
          <div className="p-3 rounded-lg bg-red-900/20 border border-red-900/50 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Google OAuth Login Button */}
        <div>
          <a
            href="/api/v1/auth/google/login"
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-[#14151c] hover:bg-[#1c1d27] border border-[#2b2e3c] hover:border-[#404456] rounded-xl text-sm font-semibold text-white transition-all shadow-md group cursor-pointer"
            title="Sign in with your Google account"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.02h3.87c2.26-2.09 3.675-5.17 3.675-9.12z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.02c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.26v3.12C3.31 21.43 7.37 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.27 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.61H1.26C.46 8.24 0 10.06 0 12s.46 3.76 1.26 5.39l4.01-3.12z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.31 2.57 1.26 6.61l4.01 3.12c.95-2.85 3.6-4.98 6.73-4.98z"
              />
            </svg>
            <span className="tracking-wide">Continue with Google</span>
          </a>
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center my-3">
          <div className="absolute border-b border-[#262832] w-full"></div>
          <span className="bg-[#0A0A0A] px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider relative z-10">
            or continue with credentials
          </span>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300">Email or User ID</label>
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full bg-[#161616] border border-[#333333] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF9100] transition-colors"
              placeholder="e.g. alex.student@student.cortex.edu"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300 flex justify-between">
              <span>Password</span>
              <button type="button" onClick={() => router.push('/forgot-password')} className="text-cyan-400 hover:text-cyan-300 text-xs transition-colors">Forgot password?</button>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#161616] border border-[#333333] rounded-lg pl-4 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF9100] transition-colors font-mono"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors flex items-center justify-center h-full px-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Cloudflare Turnstile Human Verification Box */}
          <CloudflareTurnstile
            ref={turnstileRef}
            onSuccess={(token) => setTurnstileToken(token)}
            onExpire={() => setTurnstileToken('')}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 py-2.5 bg-[#FF9100] hover:bg-[#FFA726] text-black font-bold rounded-xl transition-all duration-200 shadow-md shadow-[#FF9100]/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? 'Authenticating...' : 'Sign In to Cortex'}
          </button>
        </form>
        
        <div className="text-center text-sm text-gray-400 pt-1">
          Need an account? <button onClick={() => router.push('/register')} className="text-[#FF9100] hover:underline font-medium transition-colors">Register here</button>
        </div>

        <div className="relative flex items-center justify-center py-2">
          <div className="absolute border-b border-[#262832] w-full"></div>
          <span className="bg-[#0A0A0A] px-3 text-[10px] text-gray-500 font-semibold tracking-wider relative z-10">OR QUICK JOIN</span>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-300 block">Join a Classroom Directly</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Classroom Code (e.g. CSE276)"
              id="quickJoinCode"
              className="w-full bg-[#161616] border border-[#333333] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF9100] transition-colors uppercase font-mono"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value.toUpperCase().trim();
                  if (val) {
                    sessionStorage.setItem('pendingJoinCode', val);
                    router.push('/register');
                  }
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                const val = (document.getElementById('quickJoinCode') as HTMLInputElement).value.toUpperCase().trim();
                if (val) {
                  sessionStorage.setItem('pendingJoinCode', val);
                  router.push('/register');
                }
              }}
              className="px-5 py-2.5 bg-[#1c1d26] hover:bg-[#252834] text-white font-semibold rounded-lg border border-[#303342] transition-colors text-sm"
            >
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
