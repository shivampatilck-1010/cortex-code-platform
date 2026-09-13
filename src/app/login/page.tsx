'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
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

      router.push('/classroom');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] text-gray-200 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#14151d] border border-[#272a39] rounded-2xl p-8 space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white tracking-tight">Login to Cortex</h1>
          <p className="text-sm text-gray-400">Enter your Email or Cortex ID</p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-900/30 border border-red-900/50 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Email or Cortex ID</label>
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full bg-[#1a1c26] border border-[#2d3142] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#ff9100] transition"
              placeholder="e.g. USER001 or name@domain.com"
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex justify-between">
              <span>Password</span>
              <button type="button" onClick={() => router.push('/forgot-password')} className="text-[#ff9100] hover:underline">Forgot?</button>
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#1a1c26] border border-[#2d3142] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#ff9100] transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#ff9100] hover:bg-[#e08000] text-black font-bold rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Login'}
          </button>
        </form>
        
        <div className="text-center text-sm text-gray-400">
          Don't have an account? <button onClick={() => router.push('/register')} className="text-[#ff9100] hover:underline">Register</button>
        </div>
      </div>
    </div>
  );
}
