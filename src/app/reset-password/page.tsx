'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token.');
    }
  }, [token]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword, confirmPassword }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setSuccess('Password reset successfully. Redirecting to login...');
      setTimeout(() => router.push('/login'), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full bg-[#14151d] border border-[#272a39] rounded-2xl p-8 space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white tracking-tight">Create New Password</h1>
          <p className="text-sm text-gray-400">Choose a new, secure password</p>
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

        <form onSubmit={handleReset} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">New Password</label>
            <input
              type="password"
              required
              disabled={!token}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-[#1a1c26] border border-[#2d3142] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#ff9100] transition"
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Confirm Password</label>
            <input
              type="password"
              required
              disabled={!token}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-[#1a1c26] border border-[#2d3142] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#ff9100] transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !!success || !token}
            className="w-full py-2.5 bg-[#ff9100] hover:bg-[#e08000] text-black font-bold rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Reset Password'}
          </button>
        </form>
      </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[#0b0c10] text-gray-200 flex flex-col items-center justify-center p-4">
      <Suspense fallback={<div className="text-white">Loading...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
