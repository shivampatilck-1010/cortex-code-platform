'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Save, Send, AlertTriangle } from 'lucide-react';
import { Submission } from '@/lib/classroom/models';
import { MonacoCodeEditor } from '@/components/editor/MonacoCodeEditor';
import { getClassroomAuthHeaders } from '@/lib/classroom/client-auth';

export default function SubmissionReviewPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const submissionId = params.submissionId as string;
  const router = useRouter();

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [finalScore, setFinalScore] = useState<number>(0);
  const [feedback, setFeedback] = useState('');
  const [privateNotes, setPrivateNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSubmission = async () => {
      try {
        const res = await fetch(`/api/v1/classrooms/${roomId}/submissions/${submissionId}`, { headers: getClassroomAuthHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch submission');
        const sub = data.submission;
        setSubmission(sub);
        setFinalScore(sub.grade?.finalScore ?? sub.score);
        setFeedback(sub.feedback?.content || '');
        setPrivateNotes(sub.feedback?.privateNotes || '');
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSubmission();
  }, [roomId, submissionId]);

  const saveGrade = async (isDraft: boolean) => {
    if (!submission) return;
    setSaving(true);
    try {
      const manualAdjustment = finalScore - submission.score;
      const res = await fetch(`/api/v1/classrooms/${roomId}/submissions/${submissionId}/grade`, {
        method: 'POST',
        headers: getClassroomAuthHeaders(),
        body: JSON.stringify({
          finalScore,
          manualAdjustment,
          feedbackText: feedback,
          privateNotes,
          isDraft
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save grade');
      
      setSubmission(prev => prev ? { 
        ...prev, 
        grade: data.grade, 
        feedback: data.feedback 
      } : null);

      if (!isDraft) {
        alert('Grade released to student.');
      } else {
        alert('Draft saved.');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-white">Loading submission...</div>;
  if (error || !submission) return <div className="p-8 text-red-400">Error: {error}</div>;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-200 flex flex-col">
      <header className="h-14 border-b border-[#272a38] bg-[#13141a] px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-4">
          <button onClick={() => router.push(`/classroom/${roomId}/submissions`)} className="p-1.5 hover:bg-[#1f212a] rounded">
            <ArrowLeft className="w-4 h-4 text-gray-400" />
          </button>
          <div>
            <h1 className="text-sm font-bold text-white">{submission.studentName}'s Submission</h1>
            <p className="text-xs text-gray-500">{submission.assignmentTitle} (V{submission.version})</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {submission.grade?.releasedAt ? (
            <span className="flex items-center space-x-1 text-emerald-400 text-xs font-medium mr-4">
              <CheckCircle2 className="w-4 h-4" />
              <span>Released</span>
            </span>
          ) : (
            <span className="text-amber-400 text-xs font-medium mr-4">Draft</span>
          )}
          <button 
            onClick={() => saveGrade(true)}
            disabled={saving}
            className="px-3 py-1.5 bg-[#1f212a] hover:bg-[#272a38] text-white text-xs font-medium rounded transition flex items-center space-x-2 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Draft</span>
          </button>
          <button 
            onClick={() => saveGrade(false)}
            disabled={saving}
            className="px-3 py-1.5 bg-[#ff9100] hover:bg-[#e08000] text-black text-xs font-bold rounded transition flex items-center space-x-2 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Release Grade</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left pane: Source code */}
        <div className="w-2/3 border-r border-[#272a38] flex flex-col bg-[#0e0e11]">
          <div className="h-10 border-b border-[#272a38] bg-[#13141a] flex items-center px-4 shrink-0">
            <span className="text-xs font-mono text-cyan-400">main.{submission.language}</span>
          </div>
          <div className="flex-1 relative">
            <MonacoCodeEditor
              files={[{
                id: 'main',
                name: `main.${submission.language}`,
                path: `/main.${submission.language}`,
                content: submission.code
              }]}
              activeFileId="main"
              onSelectFile={() => {}}
              onCloseFile={() => {}}
              onNewFile={() => {}}
              onContentChange={() => {}}
              language={submission.language}
              breakpoints={[]}
              onToggleBreakpoint={() => {}}
            />
          </div>
        </div>

        {/* Right pane: Grading & Feedback */}
        <div className="w-1/3 flex flex-col bg-[#13141a] overflow-y-auto">
          <div className="p-6 space-y-6">
            
            <div>
              <h2 className="text-sm font-bold text-white mb-3 flex items-center justify-between">
                <span>Final Score</span>
                <span className="text-xs text-gray-500">Max: {submission.maxScore}</span>
              </h2>
              <div className="flex items-center space-x-4 p-4 bg-[#0a0a0f] border border-[#272a38] rounded-lg">
                <div className="flex-1">
                  <div className="text-xs text-gray-400 mb-1">Auto-grader Score</div>
                  <div className="font-mono text-emerald-400 font-bold">{submission.score}</div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xl text-gray-600">→</span>
                  <input 
                    type="number"
                    min={0}
                    max={submission.maxScore}
                    value={finalScore}
                    onChange={(e) => setFinalScore(Number(e.target.value))}
                    className="w-20 bg-[#1f212a] border border-[#272a38] text-white text-center font-mono font-bold py-1.5 rounded focus:outline-none focus:border-[#ff9100]"
                  />
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-sm font-bold text-white mb-3">Student Feedback</h2>
              <textarea 
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Visible to the student..."
                className="w-full h-32 bg-[#0a0a0f] border border-[#272a38] rounded-lg p-3 text-sm text-gray-300 focus:outline-none focus:border-[#ff9100] resize-y"
              />
            </div>

            <div>
              <h2 className="text-sm font-bold text-white mb-3 flex items-center space-x-2">
                <span>Private Notes</span>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              </h2>
              <textarea 
                value={privateNotes}
                onChange={(e) => setPrivateNotes(e.target.value)}
                placeholder="Only visible to teachers..."
                className="w-full h-24 bg-[#0a0a0f] border border-amber-900/30 rounded-lg p-3 text-sm text-amber-200 focus:outline-none focus:border-amber-500 resize-y placeholder:text-amber-900/50"
              />
            </div>

            {submission.testResults && (
              <div>
                <h2 className="text-sm font-bold text-white mb-3">Test Case Results</h2>
                <div className="space-y-2">
                  {submission.testResults.map((tr, i) => (
                    <div key={tr.testCaseId} className="p-3 bg-[#0a0a0f] border border-[#272a38] rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-300">
                          Test Case {i + 1}
                          {tr.visibility === 'hidden' && <span className="ml-2 text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">HIDDEN</span>}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          tr.status === 'passed' ? 'bg-emerald-500/20 text-emerald-400' : 
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {tr.status}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-gray-500">{tr.score} / {tr.maxScore} pts</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}
