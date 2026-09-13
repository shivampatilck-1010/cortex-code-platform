'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send reset request');
      }

      setSuccess(data.message || 'Check your email for a reset link.');
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
          <h1 className="text-2xl font-bold text-white tracking-tight">Reset Password</h1>
          <p className="text-sm text-gray-400">Enter your email to receive a reset link</p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-900/30 border border-red-900/50 text-red-400 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 rounded-lg bg-green-900/30 border border-green-900/50 text-green-400 text-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleForgot} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#1a1c26] border border-[#2d3142] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#ff9100] transition"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading || !!success}
            className="w-full py-2.5 bg-[#ff9100] hover:bg-[#e08000] text-black font-bold rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>
        
        <div className="text-center text-sm text-gray-400">
          Remembered your password? <button onClick={() => router.push('/login')} className="text-[#ff9100] hover:underline">Login</button>
        </div>
      </div>
    </div>
  );
}
