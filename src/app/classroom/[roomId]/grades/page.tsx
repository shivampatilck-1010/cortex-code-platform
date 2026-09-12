'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { getClassroomAuthHeaders } from '@/lib/classroom/client-auth';

export default function GradebookPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();

  const [data, setData] = useState<{ assignments: any[]; rows: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGrades = async () => {
      try {
        const res = await fetch(`/api/v1/classrooms/${roomId}/grades`, { headers: getClassroomAuthHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch gradebook');
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchGrades();
  }, [roomId]);

  const handleExportCSV = () => {
    if (!data) return;
    const headers = ['Student Name', 'Email', ...data.assignments.map(a => a.title)];
    const csvRows: string[] = [];
    csvRows.push(headers.join(','));

    for (const row of data.rows) {
      const studentInfo = `"${row.student.name}","${row.student.email}"`;
      const scores = data.assignments.map(a => {
        const cell = row.scores[a.id];
        if (!cell || !cell.submitted) return 'Missing';
        return cell.finalScore !== undefined ? cell.finalScore : cell.score;
      });
      csvRows.push([studentInfo, ...scores].join(','));
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `gradebook_${roomId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="p-8 text-white">Loading gradebook...</div>;
  if (error || !data) return <div className="p-8 text-red-400">Error: {error}</div>;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-200 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button onClick={() => router.push(`/classroom`)} className="p-2 bg-[#13141a] rounded hover:bg-[#1f212a] transition">
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">Classroom Gradebook</h1>
              <p className="text-sm text-gray-400">Overview of student performance</p>
            </div>
          </div>
          
          <button 
            onClick={handleExportCSV}
            className="px-4 py-2 bg-[#1f212a] hover:bg-[#272a38] text-white text-sm font-medium rounded transition flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>

        <div className="bg-[#13141a] border border-[#272a38] rounded-xl overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#1a1c25] border-b border-[#272a38] text-gray-400 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-6 py-4 sticky left-0 bg-[#1a1c25] z-10 border-r border-[#272a38]">Student</th>
                {data.assignments.map(a => (
                  <th key={a.id} className="px-6 py-4">
                    <div className="font-bold text-gray-300">{a.title}</div>
                    <div className="text-gray-500 font-normal">Max: {a.maxMarks}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e202b]">
              {data.rows.map((row) => (
                <tr key={row.student.userId} className="hover:bg-[#181922] transition">
                  <td className="px-6 py-4 sticky left-0 bg-[#13141a] border-r border-[#272a38] z-10 font-medium text-white">
                    {row.student.name}
                  </td>
                  {data.assignments.map(a => {
                    const cell = row.scores[a.id];
                    if (!cell || !cell.submitted) {
                      return <td key={a.id} className="px-6 py-4 text-gray-600 text-xs italic">Missing</td>;
                    }
                    
                    return (
                      <td key={a.id} className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <span className={`font-mono font-bold ${cell.isGraded ? 'text-white' : 'text-emerald-400'}`}>
                            {cell.finalScore !== undefined ? cell.finalScore : cell.score}
                          </span>
                          {!cell.isGraded && (
                            <Clock className="w-3.5 h-3.5 text-amber-500"  />
                          )}
                          {cell.isGraded && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500"  />
                          )}
                          {cell.isLate && (
                            <span className="text-[9px] bg-red-500/20 text-red-400 px-1 py-0.5 rounded font-bold uppercase">LATE</span>
                          )}
                        </div>
                        {data.rows.length > 1 && cell.submissionId && (
                           <button
                             onClick={() => router.push(`/classroom/${roomId}/submissions/${cell.submissionId}`)}
                             className="text-[10px] text-[#ff9100] hover:underline mt-1 block"
                           >
                             Review
                           </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
