'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CortexLogo } from '@/components/brand/CortexLogo';

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to login');
      }

      if (data.user) {
        try {
          localStorage.setItem('cortex_user', JSON.stringify(data.user));
          localStorage.setItem('cortex_user_profile', JSON.stringify(data.user));
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
        <div className="flex items-center justify-center space-x-6 mb-10">
          <CortexLogo variant="icon" size="xl" />
          <div className="flex flex-col items-center">
            <h1 className="text-5xl font-bold text-white tracking-tight">Cortex</h1>
            <p className="text-[15px] text-gray-400 font-medium mt-2">Secure Access Terminal</p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-900/20 border border-red-900/50 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300">Email or User ID</label>
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full bg-[#161616] border border-[#333333] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
              placeholder="Enter your email"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300 flex justify-between">
              <span>Password</span>
              <button type="button" onClick={() => router.push('/forgot-password')} className="text-cyan-400 hover:text-cyan-300 text-xs transition-colors">Forgot password?</button>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#161616] border border-[#333333] rounded-lg pl-4 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors font-mono"
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

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-2.5 bg-[#111111] border border-[#333333] hover:border-cyan-500/50 hover:bg-cyan-950/30 text-cyan-400 hover:text-cyan-300 font-medium rounded-lg transition-all duration-300 disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
        
        <div className="text-center text-sm text-gray-400 pt-2">
          Need an account? <button onClick={() => router.push('/register')} className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">Register here</button>
        </div>

        <div className="relative flex items-center justify-center py-4">
          <div className="absolute border-b border-[#333333] w-full"></div>
          <span className="bg-[#0A0A0A] px-4 text-xs text-gray-500 relative z-10">OR</span>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-300 block">Join a Classroom</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Classroom Code"
              id="quickJoinCode"
              className="w-full bg-[#161616] border border-[#333333] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
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
              className="px-5 py-2.5 bg-[#222] hover:bg-[#333] text-white font-medium rounded-lg border border-[#333] transition-colors text-sm"
            >
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
