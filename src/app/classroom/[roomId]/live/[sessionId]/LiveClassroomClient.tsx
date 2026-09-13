'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ClassroomRealtimeClient, ConnectionState } from '@/lib/classroom/realtime-client';
import { ClassroomRealtimeEvent } from '@/lib/classroom/protocol';
import { MonacoCodeEditor } from '@/components/editor/MonacoCodeEditor';
import { Play, Terminal, Users, Code, Video, ArrowLeft, StopCircle, RefreshCw, Lock, Unlock } from 'lucide-react';
import { ExecutionResult } from '@/lib/execution/types';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';

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
  const [teacherOutput, setTeacherOutput] = useState<ExecutionResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  // Presence state
  const [studentsOnline, setStudentsOnline] = useState<string[]>([]);

  // CRDT Yjs state
  const ydocRef = useRef<Y.Doc | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const editorRef = useRef<any>(null);
  const modelRef = useRef<any>(null);

  useEffect(() => {
    // Local auth fetch (Server-derived fallback handled via secure API, but UI needs it)
    const storedUser = localStorage.getItem('cortex_user');
    if (storedUser) {
      const u = JSON.parse(storedUser);
      setCurrentUserId(u.id);
      setCurrentUserName(u.name);
      setCurrentUserRole(u.role || 'student');
    }
  }, []);

  const isTeacher = currentUserRole === 'teacher' || currentUserRole === 'admin';

  useEffect(() => {
    if (!currentUserId) return;

    if (realtimeClientRef.current) {
      realtimeClientRef.current.disconnect();
    }

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const client = new ClassroomRealtimeClient({
      classroomId: roomId,
      userId: currentUserId,
      userName: currentUserName,
      role: currentUserRole,
      autoConnect: false,
      onStateChange: (state) => setConnectionState(state),
    });
    realtimeClientRef.current = client;

    // Observe local Yjs updates and send them to server
    ydoc.on('update', (update, origin) => {
      // Don't send updates that originated from the server
      if (origin !== client) {
        if (!isTeacher && isLocked) return; 

        // Convert Uint8Array to base64 for transmission
        let binary = '';
        const len = update.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(update[i]);
        }
        const b64 = btoa(binary);

        client.sendEvent('doc_update', { update: b64, documentId: 'main' });
      }
    });

    client.on('doc_update', (evt) => {
      if (evt.payload?.update) {
        const b64 = evt.payload.update;
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        Y.applyUpdate(ydoc, bytes, client);
      }
    });

    client.on('teacher.output.created', (evt) => {
      setTeacherOutput(evt.payload?.output);
    });

    client.on('session.ended', (evt) => {
      alert('Live session ended by teacher.');
      router.push(`/classroom/${roomId}`);
    });
    
    client.on('session.locked', () => setIsLocked(true));
    client.on('session.unlocked', () => setIsLocked(false));

    client.on('student.removed', (evt) => {
       if (evt.payload?.userId === currentUserId || evt.actorId === currentUserId) {
          alert('You have been removed from this live session.');
          router.push(`/classroom/${roomId}`);
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
    
    client.on('auth_ok', () => {
        // On connect/reconnect, sync Yjs state
        const vector = Y.encodeStateVector(ydoc);
        let binary = '';
        for (let i = 0; i < vector.byteLength; i++) {
          binary += String.fromCharCode(vector[i]);
        }
        client.sendEvent('doc_sync_step1', { vector: btoa(binary), documentId: 'main' });
    });

    client.on('doc_sync_step2', (evt) => {
        if (evt.payload?.update) {
            const b64 = evt.payload.update;
            const binary = atob(b64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            Y.applyUpdate(ydoc, bytes, client);
        }
    });

    client.connect();

    return () => {
      client.disconnect();
      if (bindingRef.current) bindingRef.current.destroy();
      ydoc.destroy();
    };
  }, [roomId, currentUserId, currentUserName, currentUserRole, isTeacher, isLocked, router]);

  const handleEditorMount = useCallback((editor: any, monaco: any) => {
    editorRef.current = editor;
    const model = editor.getModel();
    modelRef.current = model;
    
    if (ydocRef.current && model && !bindingRef.current) {
        const type = ydocRef.current.getText('monaco');
        // @ts-ignore
        bindingRef.current = new MonacoBinding(type, model, new Set([editor]), realtimeClientRef.current);
    }
  }, []);

  const executeTeacherCode = async () => {
    setIsExecuting(true);
    setTeacherOutput(null);
    try {
      const code = modelRef.current?.getValue() || '';
      const res = await fetch('/api/v1/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: [{ name: 'main.cpp', content: code }],
          language: 'cpp',
          version: '10.2.0',
          projectId: roomId
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

  const endSession = async () => {
    if (!isTeacher) return;
    try {
        await fetch(`/api/v1/classrooms/${roomId}/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'end' })
        });
        router.push(`/classroom/${roomId}`);
    } catch (e) {
        console.error("Failed to end session", e);
    }
  };

  const toggleLock = () => {
      if (!isTeacher) return;
      const newLocked = !isLocked;
      setIsLocked(newLocked);
      if (realtimeClientRef.current) {
          realtimeClientRef.current.sendEvent(newLocked ? 'session.locked' : 'session.unlocked', {});
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
            <span className={`w-2 h-2 rounded-full ${connectionState === 'CONNECTED' ? 'bg-emerald-500' : connectionState === 'CONNECTING' || connectionState === 'RECONNECTING' ? 'bg-amber-500' : 'bg-red-500'}`}></span>
            <span className="text-xs text-gray-500 uppercase font-semibold">{connectionState}</span>
          </div>
        </div>

        <div className="p-4 border-b border-[#1e1e24]">
          <div className="flex items-center gap-2 mb-2">
            <Video className="w-5 h-5 text-red-500" />
            <h2 className="text-white font-semibold">Live Session</h2>
          </div>
          <p className="text-xs text-gray-400 mb-4">You are in a live collaborative workspace.</p>

          {isTeacher && (
            <div className="flex flex-col gap-2">
                <button
                onClick={endSession}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded text-sm font-medium transition bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                >
                <StopCircle className="w-4 h-4" /> End Live Session
                </button>
                <button
                onClick={toggleLock}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded text-sm font-medium transition bg-[#1e1e24] text-gray-300 border border-[#2b2d35] hover:bg-[#2b2d35]"
                >
                {isLocked ? <><Lock className="w-4 h-4" /> Unlock Editing</> : <><Unlock className="w-4 h-4" /> Lock Editing</>}
                </button>
            </div>
          )}
          {!isTeacher && isLocked && (
              <div className="mt-2 text-amber-500 text-xs flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Editing is locked by teacher
              </div>
          )}
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" /> Participants ({studentsOnline.length + 1})
          </h3>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 text-sm text-[#ff9100]">
               <span className="w-2 h-2 rounded-full bg-[#ff9100]"></span>
               {isTeacher ? 'Teacher (You)' : currentUserName + ' (You)'}
            </li>
            {studentsOnline.map((student, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-gray-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                {student}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-14 border-b border-[#1e1e24] bg-[#0d0d12] flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
              <Code className="w-4 h-4 text-[#ff9100]" />
              main.cpp
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <button
                onClick={executeTeacherCode}
                disabled={isExecuting}
                className="flex items-center gap-2 px-4 py-1.5 bg-[#ff9100] text-black font-semibold rounded text-sm hover:bg-[#ffaa33] transition disabled:opacity-50"
              >
                {isExecuting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Run Code
              </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
           <div className="flex-1 relative">
                <MonacoCodeEditor 
                    files={[{ id: 'main', name: 'main.cpp', path: '/main.cpp', content: '' }]}
                    activeFileId="main"
                    onSelectFile={() => {}}
                    onCloseFile={() => {}}
                    onNewFile={() => {}}
                    onContentChange={() => {}}
                    language="cpp"
                    theme="vs-dark"
                    readOnly={!isTeacher && isLocked}
                    breakpoints={[]}
                    onToggleBreakpoint={() => {}}
                    onEditorMount={handleEditorMount}
                />
           </div>
           
           <div className="h-1/3 border-t border-[#1e1e24] bg-[#0a0a0f] flex flex-col shrink-0 min-h-0">
              <div className="flex items-center px-4 py-2 border-b border-[#1e1e24] bg-[#0d0d12]">
                <Terminal className="w-4 h-4 mr-2 text-gray-500" />
                <span className="text-xs font-semibold text-gray-400 uppercase">Live Output</span>
              </div>
              <div className="flex-1 overflow-auto p-4 font-mono text-sm">
                {teacherOutput ? (
                  teacherOutput.success ? (
                    <div className="text-emerald-400 whitespace-pre-wrap">{teacherOutput.output}</div>
                  ) : (
                    <div className="text-red-400 whitespace-pre-wrap">{teacherOutput.error}</div>
                  )
                ) : (
                  <div className="text-gray-600 italic">No output yet. Run the code to see results.</div>
                )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
