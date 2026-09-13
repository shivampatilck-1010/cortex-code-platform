'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cortexId, setCortexId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, cortexId, password, confirmPassword, role, inviteCode }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to register');
      }

      router.push('/classroom');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] text-gray-200 flex flex-col items-center justify-center p-4 py-10">
      <div className="max-w-md w-full bg-[#14151d] border border-[#272a39] rounded-2xl p-8 space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white tracking-tight">Create Cortex Account</h1>
          <p className="text-sm text-gray-400">Join the coding platform</p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-900/30 border border-red-900/50 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          
          <div className="flex bg-[#1a1c26] p-1 rounded-lg border border-[#2d3142]">
            <button
              type="button"
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${role === 'student' ? 'bg-[#ff9100] text-black' : 'text-gray-400 hover:text-white'}`}
              onClick={() => setRole('student')}
            >
              Student
            </button>
            <button
              type="button"
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${role === 'teacher' ? 'bg-[#ff9100] text-black' : 'text-gray-400 hover:text-white'}`}
              onClick={() => setRole('teacher')}
            >
              Professor
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#1a1c26] border border-[#2d3142] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#ff9100] transition"
            />
          </div>

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

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Cortex ID (Username)</label>
            <input
              type="text"
              required
              value={cortexId}
              onChange={(e) => setCortexId(e.target.value)}
              className="w-full bg-[#1a1c26] border border-[#2d3142] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#ff9100] transition"
              placeholder="Unique identifier (e.g. JOHN001)"
            />
            <p className="text-[10px] text-gray-500">3-20 characters, alphanumeric and underscores only. Cannot be changed later.</p>
          </div>

          {role === 'teacher' && (
             <div className="space-y-1">
               <label className="text-xs font-semibold text-[#ff9100] uppercase tracking-wider">Professor Invite Code</label>
               <input
                 type="text"
                 required
                 value={inviteCode}
                 onChange={(e) => setInviteCode(e.target.value)}
                 className="w-full bg-[#1a1c26] border border-[#ff9100]/50 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#ff9100] transition"
                 placeholder="Required for teacher accounts"
               />
             </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#1a1c26] border border-[#2d3142] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#ff9100] transition"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Confirm</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#1a1c26] border border-[#2d3142] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#ff9100] transition"
              />
            </div>
          </div>
          <p className="text-[10px] text-gray-500">Password must be at least 10 characters long.</p>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#ff9100] hover:bg-[#e08000] text-black font-bold rounded-lg transition disabled:opacity-50 mt-4"
          >
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>
        
        <div className="text-center text-sm text-gray-400">
          Already have an account? <button onClick={() => router.push('/login')} className="text-[#ff9100] hover:underline">Login</button>
        </div>
      </div>
    </div>
  );
}
