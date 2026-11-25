'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { sanitizeRedirectPath } from '@/lib/env';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CortexLogo } from '@/components/brand/CortexLogo';
import { CloudflareTurnstile, CloudflareTurnstileRef } from '@/components/auth/CloudflareTurnstile';
import { Mail, Lock, Eye, EyeOff, GraduationCap, LogIn, ArrowRight, Loader2, Sparkles } from 'lucide-react';

function MovingDotsBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none bg-black">
      <style dangerouslySetInnerHTML={{__html: `
        .moving-dots-bg {
          position: absolute;
          inset: -50%;
          width: 200%;
          height: 200%;
          background-image: radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px);
          background-size: 28px 28px;
          animation: panDots 4s linear infinite;
        }
        @keyframes panDots {
          0% { transform: translate(0, 0); }
          100% { transform: translate(-28px, -28px); }
        }
      `}} />
      <div className="moving-dots-bg"></div>
      {/* Subtle ambient lighting */}
      <div className="absolute inset-0 bg-radial-gradient from-[#FF9100]/5 via-transparent to-transparent pointer-events-none" />
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'signin' | 'classroom'>('signin');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [classroomCode, setClassroomCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [redirectParam, setRedirectParam] = useState<string>('');
  const handleTurnstileSuccess = useCallback((token: string) => setTurnstileToken(token), []);
  const handleTurnstileExpire = useCallback(() => setTurnstileToken(''), []);
  const turnstileRef = useRef<CloudflareTurnstileRef>(null);

  // Check if a code or auth error was passed via query params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const rawRedirect = params.get('redirect');
      if (rawRedirect) {
        setRedirectParam(sanitizeRedirectPath(rawRedirect, ''));
      }
      const codeParam = params.get('code');
      if (codeParam) {
        setClassroomCode(codeParam.toUpperCase().trim());
        setActiveTab('classroom');
      }

      const errorParam = params.get('error');
      const messageParam = params.get('message');
      if (errorParam) {
        let displayMessage = messageParam;
        if (messageParam) {
          try {
            displayMessage = decodeURIComponent(messageParam);
          } catch {
            displayMessage = messageParam;
          }
        }

        const errorMap: Record<string, string> = {
          google_not_configured: 'Google OAuth is not configured on this instance.',
          google_auth_cancelled: 'Google authentication was cancelled or access denied.',
          google_missing_parameters: 'Missing authorization code or state parameter.',
          google_invalid_state: 'Invalid or expired OAuth state.',
          google_csrf_invalid: 'Invalid or expired OAuth state.',
          email_not_verified: 'Google account email is not verified.',
          account_suspended: 'This account has been suspended.',
          google_auth_failed: 'Authentication failed. Please try again.',
        };

        setError(displayMessage || errorMap[errorParam] || errorParam);
      }
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          identifier: identifier.trim(), 
          password,
          cfTurnstileToken: turnstileToken || undefined,
        }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        // Reset turnstile challenge on auth failure
        turnstileRef.current?.reset();
        setTurnstileToken('');
        throw new Error(data.error || 'Failed to sign in. Please verify your credentials.');
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

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('cortex-auth-changed'));
      }
      const rawRedirect = redirectParam || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('redirect') : null);
      const targetUrl = sanitizeRedirectPath(rawRedirect, '/classroom');
      router.push(targetUrl);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClassroomJoin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = classroomCode.toUpperCase().trim();
    if (!cleanCode) return;

    if (typeof window !== 'undefined') {
      sessionStorage.setItem('pendingJoinCode', cleanCode);
      const user = localStorage.getItem('cortex_user');
      if (user) {
        router.push(`/classroom?joinCode=${encodeURIComponent(cleanCode)}`);
      } else {
        router.push(`/register?code=${encodeURIComponent(cleanCode)}`);
      }
    }
  };

  return (
    <div className="min-h-screen overflow-y-auto text-gray-200 flex flex-col items-center justify-center p-4 sm:p-6 relative bg-[#06070a]">
      <MovingDotsBackground />

      <div className="max-w-[440px] w-full relative z-10 my-8">
        {/* Glow backdrop effect */}
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-b from-[#FF9100]/15 via-transparent to-transparent blur-xl pointer-events-none -z-10" />

        {/* Main Card */}
        <div className="bg-[#0b0c13]/90 backdrop-blur-xl border border-[#222534] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Logo & Platform Header */}
          <Link
            href="/"
            onClick={(e) => {
              e.preventDefault();
              window.location.href = '/';
            }}
            className="group flex flex-col items-center justify-center text-center focus:outline-none transition-transform hover:scale-[1.01] cursor-pointer"
            aria-label="Cortex Platform Home"
            title="Return to Cortex Platform Home"
          >
            <div className="mb-2 transition-transform duration-200 group-hover:scale-105">
              <CortexLogo variant="icon" size="xl" />
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>Cortex</span>
            </h1>
            <p className="text-xs text-gray-400 font-medium tracking-wide mt-1">
              Next-Gen Universal Learning & Code Workspace
            </p>
          </Link>

          {/* Mode Tabs: Account Sign In vs. Classroom Code */}
          <div className="grid grid-cols-2 p-1 bg-[#12141d] border border-[#1f2230] rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => { setActiveTab('signin'); setError(''); }}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${
                activeTab === 'signin'
                  ? 'bg-[#1e2230] text-white shadow-sm font-bold border border-[#2d3146]'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <LogIn className="w-3.5 h-3.5 text-[#FF9100]" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('classroom'); setError(''); }}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${
                activeTab === 'classroom'
                  ? 'bg-[#1e2230] text-white shadow-sm font-bold border border-[#2d3146]'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <GraduationCap className="w-4 h-4 text-cyan-400" />
              <span>Classroom Code</span>
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 mt-1" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {activeTab === 'signin' ? (
            <div className="space-y-5">
              {/* Google OAuth Login Button */}
              <div>
                <a
                  href={redirectParam ? `/api/v1/auth/google/login?redirect=${encodeURIComponent(redirectParam)}` : '/api/v1/auth/google/login'}
                  className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-[#13151f] hover:bg-[#1a1d2c] border border-[#262a3d] hover:border-[#3b415e] rounded-xl text-xs sm:text-sm font-semibold text-white transition-all shadow-md group cursor-pointer"
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
                  <span>Continue with Google</span>
                </a>
              </div>

              {/* Divider */}
              <div className="relative flex items-center justify-center">
                <div className="absolute border-b border-[#202332] w-full"></div>
                <span className="bg-[#0b0c13] px-3 text-[11px] font-medium text-gray-500 uppercase tracking-wider relative z-10">
                  or sign in with credentials
                </span>
              </div>

              {/* Credentials Form */}
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                    <span>Email or User ID</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full bg-[#12141e] border border-[#25283a] focus:border-[#FF9100] focus:ring-1 focus:ring-[#FF9100]/40 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none transition-all"
                    placeholder="e.g. alex.student@cortex.edu"
                    autoComplete="username"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-medium text-gray-300 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-gray-400" />
                      <span>Password</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => router.push(redirectParam ? `/forgot-password?redirect=${encodeURIComponent(redirectParam)}` : '/forgot-password')}
                      className="text-cyan-400 hover:text-cyan-300 text-[11px] font-medium transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#12141e] border border-[#25283a] focus:border-[#FF9100] focus:ring-1 focus:ring-[#FF9100]/40 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none transition-all font-mono"
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors p-1"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Cloudflare Turnstile Verification Box */}
                <CloudflareTurnstile
                  ref={turnstileRef}
                  onSuccess={handleTurnstileSuccess}
                  onExpire={handleTurnstileExpire}
                />

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-[#FF9100] to-[#FFA726] hover:from-[#FF9E1B] hover:to-[#FFB74D] text-black font-bold rounded-xl transition-all shadow-md shadow-[#FF9100]/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to Cortex</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Register Callout */}
              <div className="text-center text-xs text-gray-400 pt-1 border-t border-[#1c1f2c]">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => router.push(redirectParam ? `/register?redirect=${encodeURIComponent(redirectParam)}` : '/register')}
                  className="text-[#FF9100] hover:text-[#FFA726] hover:underline font-semibold transition-colors cursor-pointer"
                >
                  Register here
                </button>
              </div>
            </div>
          ) : (
            /* Classroom Code Join Mode */
            <div className="space-y-5">
              <div className="text-center space-y-1.5 py-1">
                <div className="w-10 h-10 rounded-xl bg-cyan-950/40 border border-cyan-800/40 text-cyan-400 flex items-center justify-center mx-auto mb-2">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <h2 className="text-base font-bold text-white">Join with Classroom Code</h2>
                <p className="text-xs text-gray-400 leading-relaxed max-w-xs mx-auto">
                  Enter your invite code provided by your instructor or institution to join the class session or exam.
                </p>
              </div>

              <form onSubmit={handleClassroomJoin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-300 block">Classroom / Exam Code</label>
                  <input
                    type="text"
                    required
                    value={classroomCode}
                    onChange={(e) => setClassroomCode(e.target.value.toUpperCase())}
                    placeholder="e.g. CSE-276"
                    className="w-full bg-[#12141e] border border-[#25283a] focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 rounded-xl px-4 py-3 text-base text-white tracking-widest text-center uppercase font-mono font-bold placeholder-gray-500 focus:outline-none transition-all"
                    maxLength={16}
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={!classroomCode.trim()}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black font-bold rounded-xl transition-all shadow-md shadow-cyan-500/25 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <span>Enter Classroom</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <div className="text-center text-xs text-gray-400 pt-2 border-t border-[#1c1f2c]">
                Need to access your instructor dashboard?{' '}
                <button
                  type="button"
                  onClick={() => setActiveTab('signin')}
                  className="text-cyan-400 hover:underline font-semibold transition-colors cursor-pointer"
                >
                  Sign in here
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
