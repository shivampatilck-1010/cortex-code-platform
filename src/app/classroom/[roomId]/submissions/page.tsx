'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Search, Filter, CheckCircle2, Clock, XCircle, Award } from 'lucide-react';
import { Submission } from '@/lib/classroom/models';
import { getClassroomAuthHeaders } from '@/lib/classroom/client-auth';

export default function SubmissionsDashboard() {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        const res = await fetch(`/api/v1/classrooms/${roomId}/submissions`, { headers: getClassroomAuthHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch submissions');
        setSubmissions(data.submissions || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSubmissions();
  }, [roomId]);

  const filteredSubmissions = submissions.filter(sub => {
    const matchesSearch = sub.studentName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          sub.assignmentTitle.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
                          (statusFilter === 'pending' && (!sub.grade || !sub.grade.releasedAt)) ||
                          (statusFilter === 'graded' && sub.grade?.releasedAt);
    return matchesSearch && matchesStatus;
  });

  if (loading) return <div className="p-8 text-white">Loading submissions...</div>;
  if (error) return <div className="p-8 text-red-400">Error: {error}</div>;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-200 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button onClick={() => router.push(`/classroom`)} className="p-2 bg-[#13141a] rounded hover:bg-[#1f212a] transition">
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">Submissions Dashboard</h1>
              <p className="text-sm text-gray-400">Review and grade all student submissions for this classroom</p>
            </div>
          </div>
        </div>

        <div className="bg-[#13141a] p-4 rounded-xl border border-[#272a38] flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
            <input 
              type="text" 
              placeholder="Search by student or assignment..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-[#0a0a0f] border border-[#272a38] rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#ff9100]"
            />
          </div>
          <select 
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-[#0a0a0f] border border-[#272a38] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#ff9100]"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Needs Review</option>
            <option value="graded">Graded</option>
          </select>
        </div>

        <div className="bg-[#13141a] border border-[#272a38] rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#1a1c25] border-b border-[#272a38] text-gray-400 uppercase tracking-wider text-xs">
              <tr>
                <th className="px-6 py-4">Student</th>
                <th className="px-6 py-4">Assignment</th>
                <th className="px-6 py-4">Submitted</th>
                <th className="px-6 py-4">Attempt</th>
                <th className="px-6 py-4">Auto Score</th>
                <th className="px-6 py-4">Final Grade</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e202b]">
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">No submissions found.</td>
                </tr>
              ) : (
                filteredSubmissions.map((sub) => {
                  const isGraded = sub.grade?.releasedAt;
                  return (
                    <tr key={sub.id} className="hover:bg-[#181922] transition">
                      <td className="px-6 py-4 font-medium text-white">{sub.studentName}</td>
                      <td className="px-6 py-4 text-gray-300">{sub.assignmentTitle}</td>
                      <td className="px-6 py-4 text-gray-400 text-xs">
                        {new Date(sub.submittedAt).toLocaleString()}
                        {sub.isLate && <span className="ml-2 text-red-400 bg-red-400/10 px-2 py-0.5 rounded text-[10px] uppercase font-bold">Late</span>}
                      </td>
                      <td className="px-6 py-4 text-gray-400">V{sub.version}</td>
                      <td className="px-6 py-4 font-mono text-emerald-400 font-bold">{sub.score}</td>
                      <td className="px-6 py-4 font-mono font-bold text-white">
                        {sub.grade ? sub.grade.finalScore : '-'}
                      </td>
                      <td className="px-6 py-4">
                        {isGraded ? (
                          <span className="flex items-center space-x-1 text-emerald-400 text-xs font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Graded</span>
                          </span>
                        ) : (
                          <span className="flex items-center space-x-1 text-amber-400 text-xs font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Needs Review</span>
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => router.push(`/classroom/${roomId}/submissions/${sub.id}`)}
                          className="px-3 py-1.5 rounded-lg bg-[#ff9100]/10 hover:bg-[#ff9100] text-[#ff9100] hover:text-black font-semibold text-xs transition"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
