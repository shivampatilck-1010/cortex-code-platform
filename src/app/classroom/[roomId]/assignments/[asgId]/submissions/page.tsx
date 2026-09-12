'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Clock, CheckCircle2, MessageSquare } from 'lucide-react';
import { Submission } from '@/lib/classroom/models';
import { getClassroomAuthHeaders } from '@/lib/classroom/client-auth';

export default function StudentSubmissionsPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const asgId = params.asgId as string;
  const router = useRouter();

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        const res = await fetch(`/api/v1/classrooms/${roomId}/submissions?assignmentId=${asgId}`, { headers: getClassroomAuthHeaders() });
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
  }, [roomId, asgId]);

  if (loading) return <div className="p-8 text-white">Loading your history...</div>;
  if (error) return <div className="p-8 text-red-400">Error: {error}</div>;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-200 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center space-x-4 mb-8">
          <button onClick={() => router.push(`/classroom/${roomId}/assignments/${asgId}/solve`)} className="p-2 bg-[#13141a] rounded hover:bg-[#1f212a] transition">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Your Submissions</h1>
            <p className="text-sm text-gray-400">History and teacher feedback</p>
          </div>
        </div>

        {submissions.length === 0 ? (
          <div className="bg-[#13141a] border border-[#272a38] rounded-xl p-8 text-center text-gray-500">
            You haven't submitted anything yet.
          </div>
        ) : (
          <div className="space-y-4">
            {submissions.map((sub, index) => {
              const isGraded = sub.grade?.releasedAt;
              return (
                <div key={sub.id} className="bg-[#13141a] border border-[#272a38] rounded-xl overflow-hidden">
                  <div className="p-4 bg-[#1a1c25] border-b border-[#272a38] flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <span className="text-sm font-bold text-white">Attempt {submissions.length - index} (V{sub.version})</span>
                      <span className="text-xs text-gray-500">{new Date(sub.submittedAt).toLocaleString()}</span>
                      {sub.isLate && <span className="text-[10px] uppercase font-bold bg-red-500/20 text-red-400 px-2 py-0.5 rounded">LATE</span>}
                    </div>
                    <div className="flex items-center space-x-4">
                      {isGraded ? (
                        <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold bg-emerald-400/10 px-3 py-1 rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Final Grade: {sub.grade!.finalScore} / {sub.maxScore}</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold bg-amber-400/10 px-3 py-1 rounded-full">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Pending Review (Auto: {sub.score})</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {isGraded && sub.feedback && sub.feedback.content && (
                    <div className="p-4 bg-[#181922] border-b border-[#272a38]">
                      <h4 className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center space-x-2">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Teacher Feedback ({sub.feedback.authorName})</span>
                      </h4>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap">{sub.feedback.content}</p>
                    </div>
                  )}

                  <div className="p-4">
                    <details>
                      <summary className="text-xs text-[#ff9100] cursor-pointer hover:underline outline-none">
                        View Submitted Code
                      </summary>
                      <div className="mt-3 p-3 bg-[#0a0a0f] border border-[#272a38] rounded font-mono text-[11px] text-gray-400 whitespace-pre-wrap overflow-x-auto">
                        {sub.code}
                      </div>
                    </details>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
