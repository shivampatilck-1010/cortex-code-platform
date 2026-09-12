'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ClassroomRealtimeClient, ConnectionState } from '@/lib/classroom/realtime-client';
import { ClassroomRealtimeEvent } from '@/lib/classroom/protocol';
import { MonacoCodeEditor } from '@/components/editor/MonacoCodeEditor';
import { TerminalPanel } from '@/components/panels/TerminalPanel';
import { OutputPanel } from '@/components/panels/OutputPanel';
import { Play, Terminal, Users, Code, MessageSquare, Video, ArrowLeft, StopCircle, RefreshCw } from 'lucide-react';
import { ExecutionResult } from '@/lib/execution/types';
import { getClassroomAuthHeaders } from '@/lib/classroom/client-auth';

export default function LiveClassroomClient({ roomId, sessionId }: { roomId: string, sessionId: string }) {
  const router = useRouter();
  
  // Realtime state
  const [connectionState, setConnectionState] = useState<ConnectionState>('CONNECTING');
  const realtimeClientRef = useRef<ClassroomRealtimeClient | null>(null);
  
  // User auth state
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [currentUserRole, setCurrentUserRole] = useState<string>('student');

  // Teacher broadcasting state
  const [teacherCode, setTeacherCode] = useState<string>('// Teacher is starting the session...\n');
  const [teacherOutput, setTeacherOutput] = useState<ExecutionResult | null>(null);
  
  // Student local state
  const [studentCode, setStudentCode] = useState<string>('// Your private workspace\n');
  const [isFollowingTeacher, setIsFollowingTeacher] = useState<boolean>(true);
  const [studentOutput, setStudentOutput] = useState<ExecutionResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [sessionLanguage, setSessionLanguage] = useState('cpp');

  // Presence state
  const [studentsOnline, setStudentsOnline] = useState<string[]>([]);
  const [sharedStudentCodes, setSharedStudentCodes] = useState<{ [key: string]: { code: string, name: string } }>({});
  const [viewingStudentId, setViewingStudentId] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState<boolean>(false);

  
  // Throttle refs for teacher code broadcasting
  const codeBroadcastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastBroadcastedCodeRef = useRef<string>('');
  const followingTeacherRef = useRef(isFollowingTeacher);

  useEffect(() => {
    followingTeacherRef.current = isFollowingTeacher;
  }, [isFollowingTeacher]);

  useEffect(() => {
    // Quick and dirty local auth fetch
    const storedUser = localStorage.getItem('cortex_user');
    if (storedUser) {
      const u = JSON.parse(storedUser);
      setCurrentUserId(u.id);
      setCurrentUserName(u.name);
      setCurrentUserRole(u.role || 'student');
    }
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    fetch(`/api/v1/classrooms/${roomId}/session`, { headers: getClassroomAuthHeaders() })
      .then(async (res) => {
        if (!res.ok) throw new Error('Unable to load live session');
        return res.json();
      })
      .then((data) => {
        if (data.session?.language) setSessionLanguage(data.session.language);
      })
      .catch((error) => console.error('Unable to load live session metadata', error));
  }, [roomId, currentUserId]);

  const isTeacher = currentUserRole === 'teacher' || currentUserRole === 'admin';
  const sourceExtension = sessionLanguage === 'python'
    ? 'py'
    : sessionLanguage === 'javascript'
      ? 'js'
      : sessionLanguage === 'typescript'
        ? 'ts'
        : sessionLanguage === 'java'
          ? 'java'
          : sessionLanguage === 'rust'
            ? 'rs'
            : sessionLanguage === 'go'
              ? 'go'
              : 'cpp';



  useEffect(() => {
    if (!currentUserId) return;

    if (realtimeClientRef.current) {
      realtimeClientRef.current.disconnect();
    }

    const client = new ClassroomRealtimeClient({
      classroomId: roomId,
      userId: currentUserId,
      userName: currentUserName,
      role: currentUserRole,
      autoConnect: false,
      onStateChange: (state) => setConnectionState(state),
    });
    realtimeClientRef.current = client;
    client.connect();

    client.on('teacher.code.changed', (evt) => {
      if (!isTeacher && followingTeacherRef.current) {
        setTeacherCode(evt.payload?.code || '');
      }
    });

    client.on('teacher.output.created', (evt) => {
      if (!isTeacher && followingTeacherRef.current) {
        setTeacherOutput(evt.payload?.output);
      }
    });

    client.on('session.ended', (evt) => {
      alert('Live session ended by teacher.');
      router.push(`/classroom/${roomId}`);
    });

    
    client.on('student.code.shared', (evt) => {
      if (isTeacher) {
        setSharedStudentCodes(prev => ({
          ...prev,
          [evt.actorId]: { code: evt.payload.code, name: evt.actorName }
        }));
      }
    });

    
    client.on('classroom.snapshot', (evt) => {
        if (evt.payload?.code !== undefined) {
             setTeacherCode(evt.payload.code);
             lastBroadcastedCodeRef.current = evt.payload.code;
        }
        if (evt.payload?.output !== undefined) {
             setTeacherOutput(evt.payload.output);
        }
    });

    client.on('student.presence.updated', (evt) => {
        setStudentsOnline(prev => {
            const arr = [...prev];
            if (evt.payload.status === 'online') {
                if (!arr.includes(evt.actorName)) arr.push(evt.actorName);
            } else {
                return arr.filter(n => n !== evt.actorName);
            }
            return arr;
        });
    });

    return () => {
      client.disconnect();
    };
  }, [roomId, currentUserId, currentUserName, currentUserRole, isTeacher, router]);

  

  const handleTeacherCodeChange = useCallback((code: string) => {
    setTeacherCode(code);
    if (!isTeacher) return;

    if (codeBroadcastTimeoutRef.current) {
      clearTimeout(codeBroadcastTimeoutRef.current);
    }
    
    codeBroadcastTimeoutRef.current = setTimeout(() => {
      if (lastBroadcastedCodeRef.current !== code && realtimeClientRef.current) {
        lastBroadcastedCodeRef.current = code;
        realtimeClientRef.current.sendEvent('teacher.code.changed', { code });
      }
    }, 500); // 500ms debounce
  }, [isTeacher]);

  const executeTeacherCode = async () => {
    if (!isTeacher) return;
    setIsExecuting(true);
    setTeacherOutput(null);
    try {
      const res = await fetch('/api/v1/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: [{ name: `main.${sourceExtension}`, content: teacherCode }],
          language: sessionLanguage,
        })
      });
      const data = await res.json();
      setTeacherOutput(data);
      if (realtimeClientRef.current) {
        realtimeClientRef.current.sendEvent('teacher.output.created', { output: data });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsExecuting(false);
    }
  };

  const executeStudentCode = async () => {
    if (isTeacher || isFollowingTeacher) return;
    setIsExecuting(true);
    setStudentOutput(null);
    try {
      const res = await fetch('/api/v1/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: [{ name: `main.${sourceExtension}`, content: studentCode }],
          language: sessionLanguage,
        }),
      });
      setStudentOutput(await res.json());
    } catch (error) {
      console.error('Unable to run student code', error);
    } finally {
      setIsExecuting(false);
    }
  };

  
  const toggleShareCode = () => {
    if (isTeacher) return;
    if (isSharing) {
        setIsSharing(false);
        if (realtimeClientRef.current) realtimeClientRef.current.sendEvent('student.code_share.revoked', {});
    } else {
        setIsSharing(true);
        if (realtimeClientRef.current) realtimeClientRef.current.sendEvent('student.code.shared', { code: studentCode });
    }
  };

  const endSession = async () => {
    if (!isTeacher) return;
    try {
        await fetch(`/api/v1/classrooms/${roomId}/session`, {
            method: 'POST',
            headers: getClassroomAuthHeaders(),
            body: JSON.stringify({ action: 'end' })
        });
        router.push(`/classroom/${roomId}`);
    } catch (e) {
        console.error("Failed to end session", e);
    }
  };

  return (
    <div className="flex h-screen bg-[#0a0a0f] text-gray-300 font-sans">
      {/* Sidebar */}
      <div className="w-64 border-r border-[#1e1e24] bg-[#0d0d12] flex flex-col shrink-0">
        <div className="p-4 border-b border-[#1e1e24] flex items-center justify-between">
          <button onClick={() => router.push(`/classroom/${roomId}`)} className="text-gray-400 hover:text-white transition flex items-center gap-2 text-sm font-medium">
             <ArrowLeft className="w-4 h-4" /> Exit
          </button>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${connectionState === 'CONNECTED' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            <span className="text-xs text-gray-500 uppercase font-semibold">{connectionState}</span>
          </div>
        </div>

        <div className="p-4 border-b border-[#1e1e24]">
          <div className="flex items-center gap-2 mb-2">
            <Video className="w-5 h-5 text-red-500" />
            <h2 className="text-white font-semibold">Live Session</h2>
          </div>
          <p className="text-xs text-gray-400 mb-4">You are in a live programming demonstration.</p>
          
          {isTeacher && (
             <button onClick={endSession} className="w-full bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 px-3 py-2 rounded font-medium text-sm transition flex items-center justify-center gap-2">
                <StopCircle className="w-4 h-4" /> End Session
             </button>
          )}


          {isTeacher && Object.keys(sharedStudentCodes).length > 0 && (
             <div className="mt-4 border-t border-[#1e1e24] pt-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Shared Code</h3>
                <div className="space-y-2">
                   <button 
                       onClick={() => setViewingStudentId(null)}
                       className={`w-full text-left px-3 py-1.5 rounded text-sm transition ${viewingStudentId === null ? 'bg-[#ff9100]/20 text-[#ff9100]' : 'text-gray-400 hover:bg-[#2a2a35]'}`}
                   >
                     My Editor
                   </button>
                   {Object.entries(sharedStudentCodes).map(([id, data]) => (
                     <button 
                        key={id}
                        onClick={() => setViewingStudentId(id)}
                        className={`w-full text-left px-3 py-1.5 rounded text-sm transition flex items-center justify-between ${viewingStudentId === id ? 'bg-blue-500/20 text-blue-500' : 'text-gray-400 hover:bg-[#2a2a35]'}`}
                     >
                       <span>{data.name}</span>
                       <Code className="w-3.5 h-3.5" />
                     </button>
                   ))}
                </div>
             </div>
          )}

          {!isTeacher && (
            <div className="space-y-2 mt-4">
               <button 
                 onClick={() => setIsFollowingTeacher(true)} 
                 className={`w-full text-left px-3 py-2 rounded text-sm transition border ${isFollowingTeacher ? 'bg-[#ff9100]/10 border-[#ff9100]/30 text-[#ff9100]' : 'bg-[#1e1e24] border-transparent text-gray-400 hover:text-white hover:bg-[#2a2a35]'}`}>
                  Follow Teacher
               </button>

               <button 
                 onClick={toggleShareCode} 
                 className={`w-full text-left px-3 py-2 rounded text-sm transition border ${isSharing ? 'bg-green-500/10 border-green-500/30 text-green-500' : 'bg-[#1e1e24] border-transparent text-gray-400 hover:text-white hover:bg-[#2a2a35]'}`}>
                  {isSharing ? 'Stop Sharing Code' : 'Share Code with Teacher'}
               </button>
               <button 
                 onClick={() => setIsFollowingTeacher(false)} 
                 className={`w-full text-left px-3 py-2 rounded text-sm transition border ${!isFollowingTeacher ? 'bg-[#ff9100]/10 border-[#ff9100]/30 text-[#ff9100]' : 'bg-[#1e1e24] border-transparent text-gray-400 hover:text-white hover:bg-[#2a2a35]'}`}>
                  My Private Workspace
               </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
           <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Users className="w-4 h-4"/> Participants</h3>
           <div className="space-y-2">
             <div className="flex items-center gap-2 text-sm text-gray-300">
                <span className="w-2 h-2 rounded-full bg-green-500"></span> Teacher (Live)
             </div>
             {studentsOnline.map((student, i) => (
               <div key={i} className="flex items-center gap-2 text-sm text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-gray-500"></span> {student}
               </div>
             ))}
           </div>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header */}
        <div className="h-14 border-b border-[#1e1e24] bg-[#0a0a0f] flex items-center justify-between px-4">
            <div className="flex items-center gap-3">
                <div className="bg-emerald-500/10 text-emerald-300 px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                    Live session
                </div>
                <h1 className="text-sm font-semibold text-white">
                    {isTeacher ? 'Broadcasting to Classroom' : (isFollowingTeacher ? "Teacher's Demonstration" : "Private Workspace")}
                </h1>
            </div>
            <div className="flex items-center gap-2">
                {isTeacher && (
                    <button 
                        onClick={executeTeacherCode}
                        disabled={isExecuting}
                        className="bg-[#ff9100] text-black hover:bg-[#ffaa33] transition px-4 py-1.5 rounded font-bold text-sm flex items-center gap-2 disabled:opacity-50"
                    >
                        {isExecuting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        Run Code
                    </button>
                )}
                {!isTeacher && !isFollowingTeacher && (
                     <button
                        onClick={executeStudentCode}
                        disabled={isExecuting}
                        className="bg-[#ff9100] text-black hover:bg-[#ffaa33] transition px-4 py-1.5 rounded font-bold text-sm flex items-center gap-2"
                    >
                        {isExecuting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Run Mine
                    </button>
                )}
            </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex min-h-0 bg-[#0a0a0f]">
            <div className="flex-1 relative">
                {isTeacher ? (
                    viewingStudentId ? (
                        <MonacoCodeEditor 
                            files={[{ id: 'main', name: 'main.cpp', path: '/main.cpp', content: sharedStudentCodes[viewingStudentId]?.code || '' }]}
                            activeFileId="main"
                            onSelectFile={() => {}}
                            onCloseFile={() => {}}
                            onNewFile={() => {}}
                            onContentChange={() => {}}
                            language="cpp"
                            theme="vs-dark"
                            readOnly={true}
                            breakpoints={[]}
                            onToggleBreakpoint={() => {}}
                        />
                    ) : (
                        <MonacoCodeEditor 
                        files={[{ id: 'main', name: 'main.cpp', path: '/main.cpp', content: teacherCode }]}
                        activeFileId="main"
                        onSelectFile={() => {}}
                        onCloseFile={() => {}}
                        onNewFile={() => {}}
                        onContentChange={handleTeacherCodeChange}
                        language="cpp"
                        theme="vs-dark"
                        readOnly={false}
                        breakpoints={[]}
                        onToggleBreakpoint={() => {}}
                    />
                    )
                ) : isFollowingTeacher ? (
                    <MonacoCodeEditor 
                        files={[{ id: 'main', name: 'main.cpp', path: '/main.cpp', content: teacherCode }]}
                        activeFileId="main"
                        onSelectFile={() => {}}
                        onCloseFile={() => {}}
                        onNewFile={() => {}}
                        onContentChange={() => {}}
                        language="cpp"
                        theme="vs-dark"
                        readOnly={true}
                        breakpoints={[]}
                        onToggleBreakpoint={() => {}}
                    />
                ) : (
                     <MonacoCodeEditor 
                        files={[{ id: 'main', name: 'main.cpp', path: '/main.cpp', content: studentCode }]}
                        activeFileId="main"
                        onSelectFile={() => {}}
                        onCloseFile={() => {}}
                        onNewFile={() => {}}
                        onContentChange={setStudentCode}
                        language="cpp"
                        theme="vs-dark"
                        readOnly={false}
                        breakpoints={[]}
                        onToggleBreakpoint={() => {}}
                    />
                )}
            </div>
        </div>

        {/* Output Panel */}
        <div className="h-64 border-t border-[#1e1e24] bg-[#0d0d12] flex flex-col">
            <div className="h-10 border-b border-[#1e1e24] flex items-center px-4 gap-4 bg-[#0a0a0f]">
                <button className="text-white border-b-2 border-[#ff9100] px-1 py-2 text-sm font-medium flex items-center gap-2">
                    <Terminal className="w-4 h-4"/> Output
                </button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto font-mono text-sm">
                {(isTeacher || isFollowingTeacher) && teacherOutput ? (
                    <OutputPanel result={teacherOutput} isRunning={isExecuting} />
                ) : (!isTeacher && !isFollowingTeacher && studentOutput) ? (
                    <OutputPanel result={studentOutput} isRunning={false} />
                ) : (
                    <div className="text-gray-500 italic flex items-center gap-2">
                        <Terminal className="w-4 h-4" /> 
                        {isTeacher ? "Run code to see output..." : (isFollowingTeacher ? "Waiting for teacher to run code..." : "Run your code to see output...")}
                    </div>
                )}
            </div>
        </div>

      </div>
    </div>
  );
}
