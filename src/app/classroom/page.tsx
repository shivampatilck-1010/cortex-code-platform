'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  BookOpen, 
  MessageSquare, 
  CheckCircle, 
  AlertCircle, 
  Award, 
  BarChart3, 
  Code2, 
  Plus, 
  Copy, 
  Check, 
  Sparkles, 
  Shield, 
  Clock, 
  Send, 
  Play, 
  Terminal, 
  FileText, 
  ChevronRight, 
  RefreshCw, 
  ExternalLink, 
  Flame, 
  Lock, 
  UserCheck, 
  AlertTriangle,
  Radio,
  SlidersHorizontal,
  FolderOpen,
  Wifi,
  WifiOff,
  Bell,
  Trash2,
  Edit3,
  Pin,
  UserMinus,
  Settings as SettingsIcon,
  Share2,
  Search,
  Archive,
  Eye,
  EyeOff,
  X,
  BarChart2,
  CheckCircle2,
  Activity,
} from 'lucide-react';
import { CortexLogo } from '@/components/brand/CortexLogo';
import { ClassroomRealtimeClient, ConnectionState } from '@/lib/classroom/realtime-client';
import { ClassroomRealtimeEvent } from '@/lib/classroom/protocol';
import { 
  Classroom, 
  Assignment, 
  Submission, 
  Announcement, 
  ClassroomMessage, 
  ClassroomMember, 
  LiveClassSession, 
  ClassroomResource, 
  LeaderboardEntry,
  ClassroomAnalytics,
  Notification
} from '@/lib/classroom/models';

export default function ClassroomHubPage() {
  const router = useRouter();

  // Active Role & User Persona
  const [currentUserRole, setCurrentUserRole] = useState<'teacher' | 'student' | 'admin'>('teacher');
  const [currentUserId, setCurrentUserId] = useState<string>('usr_prof_elena');
  const [currentUserName, setCurrentUserName] = useState<string>('Prof. Elena Rostova');
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('elena.rostova@cortex.edu');

  // Classroom data
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeTab, setActiveTab] = useState<'stream' | 'people' | 'assignments' | 'arena' | 'grades' | 'resources' | 'leaderboard' | 'analytics' | 'settings'>('stream');
  const [isLoading, setIsLoading] = useState(true);

  // Sub-data for selected classroom
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [messages, setMessages] = useState<ClassroomMessage[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [members, setMembers] = useState<ClassroomMember[]>([]);
    const [liveSession, setLiveSession] = useState<LiveClassSession | null>(null);
  const [resources, setResources] = useState<ClassroomResource[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [analytics, setAnalytics] = useState<ClassroomAnalytics | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // WebSocket Connection State
  const [connectionState, setConnectionState] = useState<ConnectionState>('DISCONNECTED');
  const realtimeClientRef = useRef<ClassroomRealtimeClient | null>(null);

  // Modals & UI States
  const [isCreateClassModalOpen, setIsCreateClassModalOpen] = useState(false);
  const [isJoinClassModalOpen, setIsJoinClassModalOpen] = useState(false);
  const [isCreateAsgModalOpen, setIsCreateAsgModalOpen] = useState(false);
  const [isCreateResourceModalOpen, setIsCreateResourceModalOpen] = useState(false);
  const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [studentCodeInput, setStudentCodeInput] = useState<string>('');
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);
  const [lastSubmissionResult, setLastSubmissionResult] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Announcement Edit/Delete state
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [editAnnTitle, setEditAnnTitle] = useState('');
  const [editAnnContent, setEditAnnContent] = useState('');
  const [editAnnPinned, setEditAnnPinned] = useState(false);
  const [annToDelete, setAnnToDelete] = useState<Announcement | null>(null);

  // Member Management State
  const [memberToRemove, setMemberToRemove] = useState<ClassroomMember | null>(null);
  const [searchMemberQuery, setSearchMemberQuery] = useState('');

  // Classroom Archive Confirmation
  const [isConfirmArchiveOpen, setIsConfirmArchiveOpen] = useState(false);

  // Form Inputs
  const [newChatText, setNewChatText] = useState('');
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnContent, setNewAnnContent] = useState('');
  const [newAnnPinned, setNewAnnPinned] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [createClassForm, setCreateClassForm] = useState({
    name: '',
    subject: 'Computer Science',
    courseCode: 'CS-301',
    section: 'Sec 01',
    description: '',
  });

  // Settings tab form state
  const [settingsForm, setSettingsForm] = useState({
    name: '',
    courseCode: '',
    section: '',
    subject: '',
    academicYear: '2025-2026',
    description: '',
    joinEnabled: true,
    allowStudentPosting: true,
    allowStudentMessaging: true,
    presenceVisibility: true,
    memberVisibility: true,
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [createAsgForm, setCreateAsgForm] = useState({
    title: '',
    description: '',
    instructions: '',
    language: 'python',
    starterCode: '# Write code here\n',
    difficulty: 'Intermediate',
    maxMarks: 100,
    testInput1: '4\n2 7 11 15\n9',
    testOutput1: '0 1',
    testInput2: '5\n-1 -2 -3 -4 -5\n-8',
    testOutput2: '2 4',
  });

  // Grading states (for teacher)
  const [gradingSubmission, setGradingSubmission] = useState<Submission | null>(null);
  const [gradingScoreInput, setGradingScoreInput] = useState<number>(100);
  const [gradingFeedbackInput, setGradingFeedbackInput] = useState<string>('');
  const [isSavingGrade, setIsSavingGrade] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage((c) => (c === msg ? null : c)), 4000);
  };

  // Switch Role
  const handleSwitchPersona = (role: 'teacher' | 'student') => {
    setCurrentUserRole(role);
    if (role === 'teacher') {
      setCurrentUserId('usr_prof_elena');
      setCurrentUserName('Prof. Elena Rostova');
      setCurrentUserEmail('elena.rostova@cortex.edu');
    } else {
      setCurrentUserId('usr_alex_chen');
      setCurrentUserName('Alex Chen');
      setCurrentUserEmail('alex.chen@student.cortex.edu');
      if (activeTab === 'settings') {
        setActiveTab('stream');
      }
    }
  };

  // Auth Headers helper
  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'x-user-id': currentUserId,
    'x-user-role': currentUserRole,
    'x-user-name': currentUserName,
    'x-user-email': currentUserEmail,
  });

  // Fetch Classrooms List
  const fetchClassrooms = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/v1/classrooms', {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.classrooms) {
        setClassrooms(data.classrooms);
        if (data.classrooms.length > 0 && !selectedClassroom) {
          setSelectedClassroom(data.classrooms[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load classrooms', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Notifications
  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/v1/notifications', {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.notifications) {
        setNotifications(data.notifications);
      }
    } catch (err) {
      console.error('Failed to load notifications', err);
    }
  };

  // Mark all notifications as read
  const handleMarkAllNotificationsRead = async () => {
    try {
      await fetch('/api/v1/notifications', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: Date.now() })));
      showToast('All notifications marked as read');
    } catch {
      showToast('Failed to mark notifications');
    }
  };

  // Fetch Classroom Sub-Resources
  const fetchClassroomDetails = async (classroomId: string) => {
    try {
      const headers = getAuthHeaders();
      const [annRes, msgRes, asgRes, subRes, liveRes, resRes, leadRes, anaRes, memRes] = await Promise.all([
        fetch(`/api/v1/classrooms/${classroomId}/announcements`, { headers }),
        fetch(`/api/v1/classrooms/${classroomId}/messages`, { headers }),
        fetch(`/api/v1/classrooms/${classroomId}/assignments`, { headers }),
        fetch(`/api/v1/classrooms/${classroomId}/submissions`, { headers }),
                fetch(`/api/v1/classrooms/${classroomId}/session`, { headers }),
        fetch(`/api/v1/classrooms/${classroomId}/resources`, { headers }),
        fetch(`/api/v1/classrooms/${classroomId}/leaderboard`, { headers }),
        fetch(`/api/v1/classrooms/${classroomId}/analytics`, { headers }),
        fetch(`/api/v1/classrooms/${classroomId}/members`, { headers }),
      ]);

      const [annData, msgData, asgData, subData, liveData, resData, leadData, anaData, memData] = await Promise.all([
        annRes.json().catch(() => ({})),
        msgRes.json().catch(() => ({})),
        asgRes.json().catch(() => ({})),
        subRes.json().catch(() => ({})),
        
        liveRes.json().catch(() => ({})),
        resRes.json().catch(() => ({})),
        leadRes.json().catch(() => ({})),
        anaRes.json().catch(() => ({})),
        memRes.json().catch(() => ({})),
      ]);

      if (annData.announcements) setAnnouncements(annData.announcements);
      if (msgData.messages) setMessages(msgData.messages);
      if (memData.members) setMembers(memData.members);
      if (asgData.assignments) {
        setAssignments(asgData.assignments);
        if (!selectedAssignment && asgData.assignments.length > 0) {
          setSelectedAssignment(asgData.assignments[0]);
          setStudentCodeInput(asgData.assignments[0].starterCode || '');
        }
      }
      if (subData.submissions) setSubmissions(subData.submissions);
            if (liveData.session !== undefined) setLiveSession(liveData.session);
      if (resData.resources) setResources(resData.resources);
      if (leadData.leaderboard) setLeaderboard(leadData.leaderboard);
      if (anaData.analytics) setAnalytics(anaData.analytics);
    } catch (err) {
      console.error('Error fetching classroom sub-data', err);
    }
  };

  useEffect(() => {
    fetchClassrooms();
    fetchNotifications();
  }, [currentUserRole, currentUserId]);

  useEffect(() => {
    if (selectedClassroom) {
      fetchClassroomDetails(selectedClassroom.id);
      // Initialize settings form
      setSettingsForm({
        name: selectedClassroom.name || '',
        courseCode: selectedClassroom.courseCode || '',
        section: selectedClassroom.section || '',
        subject: selectedClassroom.subject || '',
        academicYear: selectedClassroom.academicYear || '2025-2026',
        description: selectedClassroom.description || '',
        joinEnabled: selectedClassroom.joinEnabled ?? true,
        allowStudentPosting: (selectedClassroom.settings as any)?.allowStudentPosting ?? true,
        allowStudentMessaging: (selectedClassroom.settings as any)?.allowStudentMessaging ?? true,
        presenceVisibility: (selectedClassroom.settings as any)?.presenceVisibility ?? true,
        memberVisibility: (selectedClassroom.settings as any)?.memberVisibility ?? true,
      });
    }
  }, [selectedClassroom?.id, currentUserRole, currentUserId]);

  // Authoritative WebSocket Realtime Client Listener
  useEffect(() => {
    if (!selectedClassroom) return;

    if (realtimeClientRef.current) {
      realtimeClientRef.current.disconnect();
      realtimeClientRef.current = null;
    }

    const client = new ClassroomRealtimeClient({
      classroomId: selectedClassroom.id,
      userId: currentUserId,
      userName: currentUserName,
      role: currentUserRole,
      onStateChange: (state) => {
        setConnectionState(state);
      },
      onEvent: (event: ClassroomRealtimeEvent) => {
        const payload = event.payload || {};

        switch (event.type) {
          
          case 'session.started': {
            if (payload.session) {
              setLiveSession(payload.session);
              setToastMessage(`Teacher started a live session!`);
            }
            break;
          }
          case 'session.ended': {
            setLiveSession(null);
            setToastMessage(`Live session ended.`);
            break;
          }
          case 'message.created': {
            if (payload.message) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === payload.message.id)) return prev;
                return [...prev, payload.message];
              });
            }
            break;
          }

          case 'announcement.created': {
            if (payload.announcement) {
              setAnnouncements((prev) => [
                payload.announcement,
                ...prev.filter((a) => a.id !== payload.announcement.id),
              ]);
              showToast(`New Announcement: ${payload.announcement.title}`);
            }
            break;
          }

          case 'announcement.updated': {
            if (payload.announcement) {
              setAnnouncements((prev) =>
                prev.map((a) => (a.id === payload.announcement.id ? payload.announcement : a))
              );
              showToast(`Announcement updated: ${payload.announcement.title}`);
            }
            break;
          }

          case 'announcement.deleted': {
            if (payload.announcementId) {
              setAnnouncements((prev) => prev.filter((a) => a.id !== payload.announcementId));
              showToast('Announcement deleted');
            }
            break;
          }

          case 'assignment.created':
          case 'assignment.updated': {
            if (payload.assignment) {
              setAssignments((prev) => [
                payload.assignment,
                ...prev.filter((a) => a.id !== payload.assignment.id),
              ]);
              if (payload.type === 'assignment.created') {
                showToast(`New Assignment: ${payload.assignment.title}`);
              } else {
                showToast(`Assignment Updated: ${payload.assignment.title}`);
              }
            }
            break;
          }

          case 'submission.completed': {
            if (payload.submission) {
              setSubmissions((prev) => {
                const sub = payload.submission;
                const idx = prev.findIndex((s) => s.id === sub.id);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = { ...next[idx], ...sub };
                  return next;
                }
                return [sub, ...prev];
              });
              showToast(`Student submission received from ${payload.submission.studentName}`);
            }
            break;
          }

          case 'grade.created':
          case 'grade.updated': {
            const { submissionId, finalScore } = payload;
            if (submissionId) {
              setSubmissions((prev) =>
                prev.map((s) =>
                  s.id === submissionId
                    ? {
                        ...s,
                        score: finalScore !== undefined ? finalScore : s.score,
                        grade: {
                          ...(s.grade || ({} as any)),
                          finalScore: finalScore !== undefined ? finalScore : s.score,
                        },
                      }
                    : s
                )
              );
              showToast(`Grade updated and released`);
            }
            break;
          }

          case 'student.joined': {
            const { userId, userName, role } = payload;
            if (userId) {
              setMembers((prev) => {
                if (prev.some((m) => m.userId === userId)) {
                  return prev.map((m) => (m.userId === userId ? { ...m, isOnline: true } : m));
                }
                return [
                  ...prev,
                  {
                    id: `mem_${selectedClassroom.id}_${userId}`,
                    classroomId: selectedClassroom.id,
                    userId,
                    userName: userName || 'Student',
                    userEmail: '',
                    role: role || 'student',
                    status: 'active',
                    isOnline: true,
                    joinedAt: Date.now(),
                    lastActiveAt: Date.now(),
                  },
                ];
              });
              showToast(`${userName || 'A new student'} joined the class`);
              fetchNotifications();
            }
            break;
          }

          case 'student.removed': {
            const { userId, userName } = payload;
            if (userId === currentUserId) {
              showToast('You were removed from this classroom by the instructor.');
              fetchClassrooms();
              setSelectedClassroom(null);
            } else {
              setMembers((prev) => prev.filter((m) => m.userId !== userId));
              showToast(`${userName || 'Student'} was removed from the classroom.`);
            }
            break;
          }

          case 'student.presence.updated': {
            const { userId, isOnline } = payload;
            if (userId) {
              setMembers((prev) =>
                prev.map((m) => (m.userId === userId ? { ...m, isOnline } : m))
              );
            }
            break;
          }

          case 'classroom.updated': {
            if (payload.classroom) {
              setClassrooms((prev) =>
                prev.map((c) => (c.id === payload.classroom.id ? payload.classroom : c))
              );
              if (selectedClassroom.id === payload.classroom.id) {
                setSelectedClassroom(payload.classroom);
              }
            }
            break;
          }

          case 'classroom.archived': {
            if (payload.classroomId === selectedClassroom.id) {
              setSelectedClassroom((prev) => prev ? { ...prev, status: 'archived', joinEnabled: false } : null);
              showToast('This classroom has been archived by the instructor.');
            }
            break;
          }

          case 'classroom.code_regenerated': {
            if (payload.classroomId === selectedClassroom.id && payload.joinCode) {
              setSelectedClassroom((prev) => prev ? { ...prev, joinCode: payload.joinCode } : null);
              showToast(`New Class Join Code: ${payload.joinCode}`);
            }
            break;
          }

          default:
            break;
        }
      },
    });

    realtimeClientRef.current = client;

    return () => {
      client.disconnect();
      realtimeClientRef.current = null;
    };
  }, [selectedClassroom?.id, currentUserId, currentUserRole]);

  // Handler: Post Announcement
  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassroom || !newAnnTitle || !newAnnContent) return;
    try {
      const res = await fetch(`/api/v1/classrooms/${selectedClassroom.id}/announcements`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title: newAnnTitle,
          content: newAnnContent,
          pinned: newAnnPinned,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewAnnTitle('');
        setNewAnnContent('');
        setNewAnnPinned(false);
        showToast('Announcement posted successfully');
      } else {
        showToast(data.error || 'Failed to post announcement');
      }
    } catch (err) {
      showToast('Failed to post announcement');
    }
  };

  // Handler: Edit Announcement
  const handleSaveEditAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassroom || !editingAnnouncement) return;
    try {
      const res = await fetch(`/api/v1/classrooms/${selectedClassroom.id}/announcements/${editingAnnouncement.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title: editAnnTitle,
          content: editAnnContent,
          pinned: editAnnPinned,
        }),
      });
      const data = await res.json();
      if (res.ok && data.announcement) {
        setAnnouncements((prev) => prev.map((a) => a.id === data.announcement.id ? data.announcement : a));
        setEditingAnnouncement(null);
        showToast('Announcement updated');
      } else {
        showToast(data.error || 'Failed to update announcement');
      }
    } catch {
      showToast('Error updating announcement');
    }
  };

  // Handler: Toggle Pin Announcement
  const handleTogglePin = async (ann: Announcement) => {
    if (!selectedClassroom) return;
    try {
      const res = await fetch(`/api/v1/classrooms/${selectedClassroom.id}/announcements/${ann.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ pinned: !ann.pinned }),
      });
      const data = await res.json();
      if (res.ok && data.announcement) {
        setAnnouncements((prev) => prev.map((a) => a.id === data.announcement.id ? data.announcement : a));
        showToast(data.announcement.pinned ? 'Announcement pinned to top' : 'Announcement unpinned');
      }
    } catch {
      showToast('Failed to toggle pin');
    }
  };

  // Handler: Delete Announcement
  const handleDeleteAnnouncement = async () => {
    if (!selectedClassroom || !annToDelete) return;
    try {
      const res = await fetch(`/api/v1/classrooms/${selectedClassroom.id}/announcements/${annToDelete.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setAnnouncements((prev) => prev.filter((a) => a.id !== annToDelete.id));
        setAnnToDelete(null);
        showToast('Announcement deleted');
      } else {
        showToast('Failed to delete announcement');
      }
    } catch {
      showToast('Error deleting announcement');
    }
  };

  // Handler: Post Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassroom || !newChatText.trim()) return;
    const text = newChatText.trim();
    setNewChatText('');

    if (realtimeClientRef.current && connectionState === 'CONNECTED') {
      realtimeClientRef.current.sendMessage(text);
      return;
    }

    try {
      await fetch(`/api/v1/classrooms/${selectedClassroom.id}/messages`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ content: text }),
      });
    } catch (err) {
      showToast('Failed to send message');
    }
  };

  // Handler: Create Classroom
  const handleCreateClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createClassForm.name) return;
    try {
      const res = await fetch('/api/v1/classrooms', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(createClassForm),
      });
      const data = await res.json();
      if (data.classroom) {
        setIsCreateClassModalOpen(false);
        showToast(`Created ${data.classroom.name}`);
        setCreateClassForm({ name: '', subject: 'Computer Science', courseCode: 'CS-301', section: 'Sec 01', description: '' });
        await fetchClassrooms();
        setSelectedClassroom(data.classroom);
      }
    } catch (err) {
      showToast('Failed to create classroom');
    }
  };

  // Handler: Join Classroom
  const handleJoinClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    try {
      const res = await fetch('/api/v1/classrooms/join', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ joinCode: joinCodeInput.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.classroom) {
        setIsJoinClassModalOpen(false);
        setJoinCodeInput('');
        showToast(`Enrolled in ${data.classroom.name}`);
        await fetchClassrooms();
        setSelectedClassroom(data.classroom);
      } else {
        showToast(data.error || 'Failed to join with code');
      }
    } catch (err) {
      showToast('Error joining classroom');
    }
  };

  // Handler: Regenerate Join Code
  const handleRegenerateCode = async () => {
    if (!selectedClassroom) return;
    try {
      const res = await fetch(`/api/v1/classrooms/${selectedClassroom.id}/code`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.joinCode) {
        setSelectedClassroom((prev) => prev ? { ...prev, joinCode: data.joinCode } : null);
        setClassrooms((prev) => prev.map((c) => c.id === selectedClassroom.id ? { ...c, joinCode: data.joinCode } : c));
        showToast(`Generated new join code: ${data.joinCode}`);
      } else {
        showToast(data.error || 'Failed to regenerate code');
      }
    } catch {
      showToast('Error regenerating join code');
    }
  };

  // Handler: Remove Member
  const handleRemoveMember = async () => {
    if (!selectedClassroom || !memberToRemove) return;
    try {
      const res = await fetch(`/api/v1/classrooms/${selectedClassroom.id}/members/${memberToRemove.userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.userId !== memberToRemove.userId));
        showToast(`Removed ${memberToRemove.userName} from classroom`);
        setMemberToRemove(null);
      } else {
        showToast(data.error || 'Failed to remove student');
      }
    } catch {
      showToast('Error removing student');
    }
  };

  // Handler: Save Classroom Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassroom) return;
    try {
      setIsSavingSettings(true);
      const res = await fetch(`/api/v1/classrooms/${selectedClassroom.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: settingsForm.name,
          courseCode: settingsForm.courseCode,
          section: settingsForm.section,
          subject: settingsForm.subject,
          academicYear: settingsForm.academicYear,
          description: settingsForm.description,
          joinEnabled: settingsForm.joinEnabled,
          settings: {
            allowStudentPosting: settingsForm.allowStudentPosting,
            allowStudentMessaging: settingsForm.allowStudentMessaging,
            presenceVisibility: settingsForm.presenceVisibility,
            memberVisibility: settingsForm.memberVisibility,
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.classroom) {
        setSelectedClassroom(data.classroom);
        setClassrooms((prev) => prev.map((c) => c.id === data.classroom.id ? data.classroom : c));
        showToast('Classroom settings updated and broadcasted');
      } else {
        showToast(data.error || 'Failed to save settings');
      }
    } catch {
      showToast('Error saving settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Handler: Archive Classroom
  const handleArchiveClassroom = async () => {
    if (!selectedClassroom) return;
    try {
      const res = await fetch(`/api/v1/classrooms/${selectedClassroom.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setIsConfirmArchiveOpen(false);
        setSelectedClassroom((prev) => prev ? { ...prev, status: 'archived', joinEnabled: false } : null);
        setClassrooms((prev) => prev.map((c) => c.id === selectedClassroom.id ? { ...c, status: 'archived', joinEnabled: false } : c));
        showToast('Classroom archived. Academic records preserved in read-only mode.');
      } else {
        showToast(data.error || 'Failed to archive classroom');
      }
    } catch {
      showToast('Error archiving classroom');
    }
  };

  // Handler: Create Assignment
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassroom || !createAsgForm.title) return;
    try {
      const res = await fetch(`/api/v1/classrooms/${selectedClassroom.id}/assignments`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title: createAsgForm.title,
          description: createAsgForm.description,
          instructions: createAsgForm.instructions,
          language: createAsgForm.language,
          starterCode: createAsgForm.starterCode,
          difficulty: createAsgForm.difficulty,
          maxMarks: createAsgForm.maxMarks,
          testCases: [
            {
              input: createAsgForm.testInput1,
              expectedOutput: createAsgForm.testOutput1,
              visibility: 'public',
              weight: 50,
            },
            {
              input: createAsgForm.testInput2,
              expectedOutput: createAsgForm.testOutput2,
              visibility: 'hidden',
              weight: 50,
            },
          ],
        }),
      });
      if (res.ok) {
        setIsCreateAsgModalOpen(false);
        showToast('Assignment published to class');
        fetchClassroomDetails(selectedClassroom.id);
      }
    } catch (err) {
      showToast('Failed to create assignment');
    }
  };

  // Handler: Submit Solution to AutoGrader
  const handleSubmitSolution = async () => {
    if (!selectedClassroom || !selectedAssignment) return;
    try {
      setIsSubmittingCode(true);
      const res = await fetch(`/api/v1/classrooms/${selectedClassroom.id}/assignments/${selectedAssignment.id}/submit`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          code: studentCodeInput,
          language: selectedAssignment.language,
        }),
      });
      const data = await res.json();
      if (res.ok && data.submission) {
        setLastSubmissionResult(data);
        showToast(`AutoGrader Completed: ${data.submission.score}/${data.submission.maxScore} pts`);
        fetchClassroomDetails(selectedClassroom.id);
      } else {
        showToast(data.error || 'Submission failed');
      }
    } catch (err) {
      showToast('Submission execution error');
    } finally {
      setIsSubmittingCode(false);
    }
  };

  // Copy helpers
  const handleCopyJoinCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    showToast(`Copied code: ${code}`);
  };

  const handleCopyInviteLink = () => {
    if (!selectedClassroom) return;
    const url = typeof window !== 'undefined' ? `${window.location.origin}/classroom?join=${selectedClassroom.joinCode}` : '';
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    showToast('Copied classroom invite link to clipboard');
  };

  // Sorted Announcements (Pinned first, then newest)
  const sortedAnnouncements = useMemo(() => {
    return [...announcements].sort((a, b) => {
      if (a.pinned === b.pinned) {
        return b.createdAt - a.createdAt;
      }
      return a.pinned ? -1 : 1;
    });
  }, [announcements]);

  // Filtered members list
  const filteredMembers = useMemo(() => {
    if (!searchMemberQuery.trim()) return members;
    const q = searchMemberQuery.toLowerCase();
    return members.filter(
      (m) => m.userName.toLowerCase().includes(q) || m.userEmail.toLowerCase().includes(q) || m.role.toLowerCase().includes(q)
    );
  }, [members, searchMemberQuery]);

  const unreadNotifCount = useMemo(() => {
    return notifications.filter((n) => !n.readAt).length;
  }, [notifications]);


  const handleLiveSessionClick = async () => {
    if (!selectedClassroom) return;
    if (liveSession) {
      router.push(`/classroom/${selectedClassroom.id}/live/${liveSession.id}`);
      return;
    }
    
    if (currentUserRole === 'teacher' || currentUserRole === 'admin') {
      try {
        const res = await fetch(`/api/v1/classrooms/${selectedClassroom.id}/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start', title: 'Live Coding' })
        });
        const data = await res.json();
        if (data.session) {
           router.push(`/classroom/${selectedClassroom.id}/live/${data.session.id}`);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const isArchived = selectedClassroom?.status === 'archived';

  return (
    <div className="min-h-screen w-screen bg-[#0d0e12] text-gray-200 flex flex-col font-sans select-none overflow-hidden">
      {/* Platform Header */}
      <header className="h-14 bg-[#13141a] border-b border-[#1f212a] px-6 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center space-x-4">
          <Link href="/" className="flex items-center group transition" title="Return to IDE">
            <CortexLogo variant="header" size="sm" />
          </Link>
          <span className="text-gray-600">/</span>
          <div className="flex items-center space-x-2">
            <span className="font-heading font-bold text-xs text-[#ff9100] tracking-wide uppercase">Cortex Classroom</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1f222e] text-gray-400 border border-[#2d3142]">
              Management Core
            </span>
          </div>

          {/* Real-Time WebSocket Connection Indicator */}
          <div className="flex items-center space-x-2 pl-2">
            {connectionState === 'CONNECTED' ? (
              <div
                id="classroom-connection-indicator"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 shadow-sm"
                title="Authoritative WebSocket connection active"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>● Realtime Connected</span>
              </div>
            ) : connectionState === 'CONNECTING' || connectionState === 'RECONNECTING' ? (
              <div
                id="classroom-connection-indicator"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-950/60 text-amber-400 border border-amber-800/40 shadow-sm"
                title="Attempting WebSocket reconnection with resync"
              >
                <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                <span>↻ Syncing...</span>
              </div>
            ) : (
              <div
                id="classroom-connection-indicator"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-900 text-zinc-400 border border-zinc-700/50 shadow-sm"
                title="Realtime socket disconnected"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                <span>○ Offline</span>
              </div>
            )}
          </div>
        </div>

        {/* Persona Switcher, Notifications & Global Actions */}
        <div className="flex items-center space-x-3">
                    
          {/* Live Session Button */}
          {selectedClassroom && (currentUserRole === 'teacher' || liveSession) && (
            <button
              onClick={handleLiveSessionClick}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition shadow-sm border ${
                liveSession
                  ? 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${liveSession ? 'animate-pulse' : ''}`} />
              <span>{liveSession ? 'Join Live Session' : 'Start Live Session'}</span>
            </button>
          )}

          {/* Notification Center Bell */}

          <div className="relative">
            <button 
              className="p-2 text-gray-400 hover:text-white relative rounded hover:bg-[#20232e] transition"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell className="w-4 h-4" />
              {unreadNotifCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              )}
            </button>
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-[340px] bg-[#1e202c]/95 backdrop-blur-xl border border-[#2b2e40] rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] z-50 overflow-hidden transform origin-top-right transition-all">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#2b2e40] bg-[#1a1c26]">
                  <h3 className="text-xs font-bold text-white">Notifications</h3>
                  <button className="text-[10px] text-[#ff9100] hover:underline" onClick={async () => {
                    await fetch('/api/v1/notifications', { method: 'PUT', body: JSON.stringify({ markAllRead: true }) });
                    fetchClassrooms(); // reload data
                  }}>
                    Mark all read
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-500">No notifications</div>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} className={`p-4 border-b border-[#2b2e40]/50 transition hover:bg-[#252837] ${!n.readAt ? 'bg-[#ff9100]/5' : ''}`}>
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-xs text-gray-200">{n.title}</span>
                          <span className="text-[10px] text-gray-500">{new Date(n.createdAt).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-[11px] text-gray-400">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setCurrentUserRole(currentUserRole === 'teacher' ? 'student' : 'teacher')}
            className={`px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition ${
              currentUserRole === 'teacher' ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' : 'bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500/20'
            }`}
          >
            {currentUserRole} View
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-64 bg-[#13141a] border-r border-[#1f212a] flex flex-col shrink-0">
          <div className="p-4 border-b border-[#1f212a]">
            <button
              onClick={() => setIsCreateClassModalOpen(true)}
              className="w-full py-2 bg-[#ff9100]/10 hover:bg-[#ff9100]/20 text-[#ff9100] text-xs font-bold rounded-lg border border-[#ff9100]/30 transition"
            >
              + Create Classroom
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {classrooms.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedClassroom(c)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition flex flex-col ${
                  selectedClassroom?.id === c.id
                    ? 'bg-[#1f212a] text-white font-semibold'
                    : 'text-gray-400 hover:bg-[#1a1c24] hover:text-gray-200'
                }`}
              >
                <span>{c.name}</span>
                <span className="text-[10px] text-gray-500">{c.subject}</span>
              </button>
            ))}
          </div>
        </aside>


        {/* Main Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0d0e12]">
          {selectedClassroom ? (
            <main className="flex-1 flex flex-col min-w-0">

              {/* Top Navigation Tabs */}
              <div className="h-12 bg-[#13141a] border-b border-[#20222d] px-6 flex space-x-6 overflow-x-auto shrink-0 scrollbar-hide">
                <button
                  onClick={() => setActiveTab('stream')}
                  className={`h-full border-b-2 font-medium transition flex items-center space-x-2 shrink-0 ${
                    activeTab === 'stream'
                      ? 'border-[#ff9100] text-white font-semibold'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Stream</span>
                </button>
                <button
                  onClick={() => setActiveTab('people')}
                  className={`h-full border-b-2 font-medium transition flex items-center space-x-2 shrink-0 ${
                    activeTab === 'people'
                      ? 'border-[#ff9100] text-white font-semibold'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>People</span>
                </button>
                <button
                  onClick={() => setActiveTab('assignments')}
                  className={`h-full border-b-2 font-medium transition flex items-center space-x-2 shrink-0 ${
                    activeTab === 'assignments'
                      ? 'border-[#ff9100] text-white font-semibold'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Assignments</span>
                </button>
                <button
                  onClick={() => setActiveTab('arena')}
                  className={`h-full border-b-2 font-medium transition flex items-center space-x-2 shrink-0 ${
                    activeTab === 'arena'
                      ? 'border-[#ff9100] text-white font-semibold'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5 text-rose-400" />
                  <span>Arena</span>
                </button>
                <button
                  onClick={() => setActiveTab('grades')}
                  className={`h-full border-b-2 font-medium transition flex items-center space-x-2 shrink-0 ${
                    activeTab === 'grades'
                      ? 'border-[#ff9100] text-white font-semibold'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>Grades & Feedback</span>
                </button>

              <button
                onClick={() => setActiveTab('resources')}
                className={`h-full border-b-2 font-medium transition flex items-center space-x-2 shrink-0 ${
                  activeTab === 'resources'
                    ? 'border-[#ff9100] text-white font-semibold'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Resources ({resources.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('leaderboard')}
                className={`h-full border-b-2 font-medium transition flex items-center space-x-2 shrink-0 ${
                  activeTab === 'leaderboard'
                    ? 'border-[#ff9100] text-white font-semibold'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                <span>Leaderboard</span>
              </button>


              {currentUserRole === 'teacher' && (
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`h-full border-b-2 font-medium transition flex items-center space-x-2 shrink-0 ${
                    activeTab === 'analytics'
                      ? 'border-[#ff9100] text-white font-semibold'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span>Teacher Analytics</span>
                </button>
              )}
              {currentUserRole === 'teacher' && (
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`h-full border-b-2 font-medium transition flex items-center space-x-2 shrink-0 ${
                    activeTab === 'settings'
                      ? 'border-[#ff9100] text-white font-semibold'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <SettingsIcon className="w-3.5 h-3.5" />
                  <span>Class Settings</span>
                </button>
              )}
            </div>

            {/* TAB 1: Stream & Announcements Feed */}
            {activeTab === 'stream' && (
              <div className="flex-1 flex overflow-hidden p-6 gap-6">
                {/* Left Column: Announcements Feed */}
                <div className="flex-1 flex flex-col space-y-4 overflow-y-auto">
                  {/* Create Announcement Box */}
                  {!isArchived && (currentUserRole === 'teacher' || (selectedClassroom.settings as any)?.allowStudentPosting) && (
                    <div className="bg-[#14151c] border border-[#212330] rounded-xl p-4 shadow-sm space-y-3">
                      <span className="text-xs font-semibold text-gray-300 flex items-center space-x-2">
                        <Sparkles className="w-3.5 h-3.5 text-[#ff9100]" />
                        <span>Post Class Announcement</span>
                      </span>
                      <form onSubmit={handlePostAnnouncement} className="space-y-3">
                        <input
                          type="text"
                          placeholder="Announcement Title..."
                          value={newAnnTitle}
                          onChange={(e) => setNewAnnTitle(e.target.value)}
                          className="w-full bg-[#1b1d26] border border-[#292c3d] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#ff9100]"
                        />
                        <textarea
                          rows={3}
                          placeholder="Share course updates, lecture notes, test case hints, or lab reminders..."
                          value={newAnnContent}
                          onChange={(e) => setNewAnnContent(e.target.value)}
                          className="w-full bg-[#1b1d26] border border-[#292c3d] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#ff9100] resize-none"
                        />
                        <div className="flex items-center justify-between">
                          {currentUserRole === 'teacher' ? (
                            <label className="flex items-center space-x-2 text-xs text-gray-400 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={newAnnPinned}
                                onChange={(e) => setNewAnnPinned(e.target.checked)}
                                className="rounded bg-[#1b1d26] border-[#292c3d] text-[#ff9100] focus:ring-0"
                              />
                              <span>Pin to top of stream</span>
                            </label>
                          ) : <div />}
                          <button
                            type="submit"
                            className="px-4 py-1.5 rounded-lg bg-[#ff9100] hover:bg-[#e08000] text-black font-semibold text-xs transition"
                          >
                            Post Update
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Announcements List */}
                  <div className="space-y-3">
                    {sortedAnnouncements.length === 0 ? (
                      <div className="text-center text-xs text-gray-500 py-12 bg-[#13141a] border border-[#20222d] rounded-xl p-8">
                        No announcements posted yet.
                      </div>
                    ) : (
                      sortedAnnouncements.map((ann) => (
                        <div
                          key={ann.id}
                          className={`p-4 rounded-xl border transition space-y-2 ${
                            ann.pinned
                              ? 'bg-[#181922] border-[#ff9100]/40 shadow-sm'
                              : 'bg-[#13141a] border-[#20222d]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              {ann.pinned && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#ff9100]/20 text-[#ff9100] border border-[#ff9100]/40 flex items-center space-x-1">
                                  <Pin className="w-3 h-3" />
                                  <span>PINNED</span>
                                </span>
                              )}
                              <h4 className="text-sm font-semibold text-white">{ann.title}</h4>
                            </div>

                            {/* Actions for Instructor */}
                            <div className="flex items-center space-x-2">
                              <span className="text-[11px] text-gray-500">
                                {new Date(ann.createdAt).toLocaleDateString()}
                              </span>
                              {currentUserRole === 'teacher' && !isArchived && (
                                <div className="flex items-center space-x-1 pl-2 border-l border-[#20222d]">
                                  <button
                                    onClick={() => handleTogglePin(ann)}
                                    className={`p-1 rounded hover:bg-[#20232e] text-xs transition ${ann.pinned ? 'text-[#ff9100]' : 'text-gray-500 hover:text-gray-300'}`}
                                    title={ann.pinned ? 'Unpin' : 'Pin to top'}
                                  >
                                    <Pin className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingAnnouncement(ann);
                                      setEditAnnTitle(ann.title);
                                      setEditAnnContent(ann.content);
                                      setEditAnnPinned(ann.pinned);
                                    }}
                                    className="p-1 rounded hover:bg-[#20232e] text-gray-400 hover:text-white transition"
                                    title="Edit announcement"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setAnnToDelete(ann)}
                                    className="p-1 rounded hover:bg-[#20232e] text-gray-400 hover:text-rose-400 transition"
                                    title="Delete announcement"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line">
                            {ann.content}
                          </p>
                          <div className="text-[10px] text-gray-500 pt-2 border-t border-[#1d1f29] flex items-center justify-between">
                            <span>Posted by {ann.authorName} ({ann.authorRole})</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right Column: Classroom Realtime Chat */}
                <div className="w-80 bg-[#13141a] border border-[#20222d] rounded-xl flex flex-col overflow-hidden">
                  <div className="p-3.5 border-b border-[#20222d] flex items-center justify-between bg-[#161720]">
                    <div className="flex items-center space-x-2">
                      <MessageSquare className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-semibold text-white">Live Classroom Chat</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#20232e] text-gray-400">
                      Real-time
                    </span>
                  </div>

                  {/* Messages Feed */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                    {messages.length === 0 ? (
                      <div className="text-center text-xs text-gray-500 py-12">
                        No messages yet. Start the discussion!
                      </div>
                    ) : (
                      messages.map((m) => {
                        const isMe = m.senderId === currentUserId;
                        return (
                          <div
                            key={m.id}
                            className={`flex flex-col space-y-1 ${isMe ? 'items-end' : 'items-start'}`}
                          >
                            <div className="flex items-center space-x-1.5 text-[10px] text-gray-500">
                              <span className="font-medium text-gray-400">{m.senderName}</span>
                              <span className="px-1 py-0.2 rounded text-[9px] bg-[#1d1f2a] text-gray-400">
                                {m.senderRole}
                              </span>
                            </div>
                            <div
                              className={`px-3 py-2 rounded-xl text-xs max-w-[85%] leading-relaxed ${
                                isMe
                                  ? 'bg-[#ff9100]/20 text-gray-100 border border-[#ff9100]/40'
                                  : 'bg-[#1b1d26] text-gray-200 border border-[#282a38]'
                              }`}
                            >
                              {m.content}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Chat Input */}
                  {!isArchived ? (
                    <form onSubmit={handleSendMessage} className="p-3 border-t border-[#20222d] bg-[#161720] flex space-x-2">
                      <input
                        type="text"
                        placeholder="Type a message to class..."
                        value={newChatText}
                        onChange={(e) => setNewChatText(e.target.value)}
                        className="flex-1 bg-[#1b1d26] border border-[#282b3a] rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs transition flex items-center justify-center"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  ) : (
                    <div className="p-3 border-t border-[#20222d] bg-[#161720] text-center text-xs text-gray-500">
                      Chat is disabled for archived classrooms
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: People & Roster Management */}
            {activeTab === 'people' && (
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                {/* Header with Search & Count */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">Course Members & Roster</h3>
                    <p className="text-xs text-gray-400">
                      Manage enrolled students, verify attendance presence, and maintain class permissions.
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search student or email..."
                        value={searchMemberQuery}
                        onChange={(e) => setSearchMemberQuery(e.target.value)}
                        className="bg-[#14151d] border border-[#232636] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#ff9100]"
                      />
                    </div>
                    <span className="px-3 py-1.5 rounded-xl bg-[#14151d] border border-[#232636] text-xs font-mono text-gray-300">
                      {members.length} Enrolled
                    </span>
                  </div>
                </div>

                {/* Instructors Section */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Instructors</h4>
                  <div className="bg-[#13141a] border border-[#20222d] rounded-xl overflow-hidden divide-y divide-[#1e202b]">
                    <div className="p-4 flex items-center justify-between hover:bg-[#181922] transition">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-full bg-[#ff9100]/20 border border-[#ff9100]/40 flex items-center justify-center font-bold text-[#ff9100] text-sm">
                          {selectedClassroom.teacherName.charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white flex items-center space-x-2">
                            <span>{selectedClassroom.teacherName}</span>
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              COURSE INSTRUCTOR
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">elena.rostova@cortex.edu</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-xs text-gray-400">Instructor Available</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Students Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Students ({filteredMembers.filter((m) => m.role !== 'teacher').length})
                    </h4>
                  </div>

                  <div className="bg-[#13141a] border border-[#20222d] rounded-xl overflow-hidden divide-y divide-[#1e202b]">
                    {filteredMembers.filter((m) => m.role !== 'teacher').length === 0 ? (
                      <div className="p-8 text-center text-xs text-gray-500">
                        No students enrolled yet or matching search filter. Share the join code with your students!
                      </div>
                    ) : (
                      filteredMembers
                        .filter((m) => m.role !== 'teacher')
                        .map((member) => (
                          <div
                            key={member.id}
                            className="p-3.5 flex items-center justify-between hover:bg-[#181922] transition"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full bg-[#1e212d] border border-[#2d3142] flex items-center justify-center font-bold text-cyan-400 text-xs">
                                {member.userName.charAt(0)}
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-white">{member.userName}</div>
                                <div className="text-[11px] text-gray-500">
                                  {member.userEmail || `${member.userId}@student.cortex.edu`}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center space-x-4">
                              {/* Presence Badge */}
                              <div className="flex items-center space-x-1.5">
                                <div className={`w-2 h-2 rounded-full ${member.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
                                <span className="text-xs text-gray-400">{member.isOnline ? 'Online now' : 'Offline'}</span>
                              </div>

                              <span className="text-[11px] text-gray-500 font-mono">
                                Joined {new Date(member.joinedAt).toLocaleDateString()}
                              </span>

                              {/* Remove Student Action for Instructor */}
                              {currentUserRole === 'teacher' && !isArchived && (
                                <button
                                  onClick={() => setMemberToRemove(member)}
                                  className="p-1.5 rounded-lg hover:bg-rose-950/40 text-gray-500 hover:text-rose-400 border border-transparent hover:border-rose-800/40 transition flex items-center space-x-1 text-xs"
                                  title="Remove student from classroom"
                                >
                                  <UserMinus className="w-3.5 h-3.5" />
                                  <span>Remove</span>
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Assignments & Lab */}
            {activeTab === 'assignments' && (
              <div className="flex-1 flex overflow-hidden p-6 gap-6">
                {/* Left: Assignment List */}
                <div className="w-80 bg-[#13141a] border border-[#20222d] rounded-xl flex flex-col overflow-hidden shrink-0 shadow-sm">
                  <div className="p-3.5 border-b border-[#20222d] flex items-center justify-between bg-[#161720]">
                    <span className="text-sm font-bold text-white tracking-tight">Problem Sets</span>
                    {currentUserRole === 'teacher' && !isArchived && (
                      <button
                        onClick={() => router.push(`/classroom/${selectedClassroom?.id}/assignments/builder/new`)}
                        className="px-2 py-1 rounded bg-[#ff9100] text-black font-semibold text-[11px] hover:bg-[#e08000] transition flex items-center space-x-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>New</span>
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                    {assignments.map((asg) => {
                      const isSel = selectedAssignment?.id === asg.id;
                      return (
                        <button
                          key={asg.id}
                          onClick={() => {
                            setSelectedAssignment(asg);
                            setStudentCodeInput(asg.starterCode || '');
                            setLastSubmissionResult(null);
                          }}
                          className={`w-full text-left p-3 rounded-lg border transition space-y-1.5 ${
                            isSel
                              ? 'bg-[#1c1e28] border-[#ff9100]/60'
                              : 'bg-[#15161f] border-[#222432] hover:border-[#323648]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#20232f] text-cyan-400">
                              {asg.language.toUpperCase()}
                            </span>
                            <span className="text-[10px] text-gray-400 font-bold bg-[#1e202b] px-2 py-0.5 rounded-full">
                              {asg.maxMarks} pts
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-gray-100 line-clamp-1">{asg.title}</h4>
                          <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1">
                            <span>Due in {Math.round((asg.dueAt - Date.now()) / 86400000)}d</span>
                            <span className="text-amber-400">{asg.difficulty}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Active Assignment Solver */}
                {selectedAssignment ? (
                  <div className="flex-1 flex flex-col bg-[#13141a] border border-[#20222d] rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-[#20222d] bg-[#161720] flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-xl font-extrabold text-white tracking-tight">{selectedAssignment.title}</h3>
                          <span className="text-xs px-3 py-1 rounded-full font-mono font-bold bg-[#ff9100]/10 border border-[#ff9100]/20 text-[#ff9100] shadow-sm">
                            Max Marks: {selectedAssignment.maxMarks}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">{selectedAssignment.instructions}</p>
                      </div>

                      <div className="flex space-x-2">
                        {currentUserRole === 'teacher' ? (
                          <>
                            <button
                              onClick={() => router.push(`/classroom/${selectedClassroom?.id}/submissions`)}
                              className="px-4 py-2 rounded-xl bg-[#1f212a] hover:bg-[#272a38] text-white font-semibold text-xs transition"
                            >
                              Submissions
                            </button>
                            <button
                              onClick={() => router.push(`/classroom/${selectedClassroom?.id}/assignments/builder/${selectedAssignment.id}`)}
                              className="px-4 py-2 rounded-xl bg-[#ff9100] hover:bg-[#e07f00] text-black font-bold text-xs transition"
                            >
                              Edit
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => router.push(`/classroom/${selectedClassroom?.id}/assignments/${selectedAssignment.id}/submissions`)}
                            className="px-4 py-2 rounded-xl bg-[#1f212a] hover:bg-[#272a38] text-white font-semibold text-xs transition"
                          >
                            My Submissions
                          </button>
                        )}
                        <button
                          onClick={() => router.push(`/classroom/${selectedClassroom?.id}/assignments/${selectedAssignment.id}/solve`)}
                          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition flex items-center space-x-2"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          <span>Solve in Cortex IDE</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 flex overflow-y-auto p-6 bg-[#0d0e12]">
                      <div className="max-w-3xl w-full mx-auto space-y-6">
                        <div>
                          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Problem Statement</h4>
                          <div className="prose prose-invert text-sm text-gray-300">
                            {selectedAssignment.description}
                          </div>
                        </div>
                        <div className="p-4 bg-[#1e2026] rounded-xl border border-[#2d313f]">
                          <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Instructions & Constraints</h4>
                          <div className="text-sm font-mono text-emerald-400 whitespace-pre-wrap">
                            {selectedAssignment.instructions}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-xs text-gray-500">
                    Select an assignment to inspect test suite.
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: Grades & Feedback */}
            {activeTab === 'grades' && (
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">Submissions & Gradebook</h3>
                    <p className="text-xs text-gray-400">
                      Review automated test scores, adjust marks, write detailed student feedback, and release grades.
                    </p>
                  </div>
                  <div className="flex space-x-3">
                    <button 
                      onClick={() => router.push(`/classroom/${selectedClassroom?.id}/submissions`)}
                      className="px-4 py-2 bg-[#1f212a] hover:bg-[#272a38] text-white text-xs font-semibold rounded transition"
                    >
                      View All Submissions
                    </button>
                    <button 
                      onClick={() => router.push(`/classroom/${selectedClassroom?.id}/grades`)}
                      className="px-4 py-2 bg-[#ff9100]/10 hover:bg-[#ff9100]/20 text-[#ff9100] text-xs font-bold rounded transition border border-[#ff9100]/30"
                    >
                      Open Gradebook Grid
                    </button>
                  </div>
                </div>

                <div className="bg-[#13141a] border border-[#20222d] rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#171821] border-b border-[#20222d] text-gray-400 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-3">Student</th>
                        <th className="px-4 py-3">Assignment</th>
                        <th className="px-4 py-3">Language</th>
                        <th className="px-4 py-3">Auto Score</th>
                        <th className="px-4 py-3">Final Grade</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e202b] text-gray-300">
                      {submissions.map((sub) => (
                        <tr key={sub.id} className="hover:bg-[#181922] transition">
                          <td className="px-4 py-3 font-semibold text-white">{sub.studentName}</td>
                          <td className="px-4 py-3 text-gray-300">{sub.assignmentTitle}</td>
                          <td className="px-4 py-3 font-mono text-cyan-400 text-[11px]">{sub.language}</td>
                          <td className="px-4 py-3 font-mono font-bold text-emerald-400">{sub.score} / {sub.maxScore}</td>
                          <td className="px-4 py-3 font-mono font-bold text-white">{sub.grade ? `${sub.grade.finalScore} / ${sub.maxScore}` : 'Pending'}</td>
                          <td className="px-4 py-3">
                            {currentUserRole === 'teacher' ? (
                              <button
                                onClick={() => router.push(`/classroom/${selectedClassroom?.id}/submissions/${sub.id}`)}
                                className="px-3 py-1 rounded bg-[#ff9100]/20 hover:bg-[#ff9100] text-[#ff9100] hover:text-black font-semibold text-xs transition"
                              >
                                Review & Grade
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400">Submitted</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 6: Resources */}
            {activeTab === 'resources' && (
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">Course Materials & Handouts</h3>
                    <p className="text-xs text-gray-400">
                      Syllabus, starter code repositories, lecture slide decks, and reference guides.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {resources.map((res) => (
                    <div
                      key={res.id}
                      className="p-4 rounded-xl bg-[#14151c] border border-[#212432] space-y-2 hover:border-[#33374d] transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#20232f] text-cyan-400">
                          {res.type}
                        </span>
                        <span className="text-[10px] text-gray-500">{res.unit}</span>
                      </div>
                      <h4 className="text-sm font-semibold text-white">{res.name}</h4>
                      <p className="text-xs text-gray-400">{res.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 7: Leaderboard */}
            {activeTab === 'leaderboard' && (
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                <div className="bg-[#13141a] border border-[#20222d] rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-[#20222d] bg-[#161720] flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Award className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-white">Algorithm Mastery Leaderboard</span>
                    </div>
                  </div>

                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#171821] border-b border-[#20222d] text-gray-400 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-3">Rank</th>
                        <th className="px-4 py-3">Student</th>
                        <th className="px-4 py-3">Total Points</th>
                        <th className="px-4 py-3">Accuracy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e202b] text-gray-300">
                      {leaderboard.map((entry) => (
                        <tr key={entry.studentId} className="hover:bg-[#181922] transition">
                          <td className="px-4 py-3 font-bold font-mono">#{entry.rank}</td>
                          <td className="px-4 py-3 font-semibold text-white">{entry.studentName}</td>
                          <td className="px-4 py-3 font-mono font-bold text-amber-400">{entry.points} pts</td>
                          <td className="px-4 py-3 font-mono text-emerald-400">{entry.accuracy}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            
            {/* TAB 9: Teacher Analytics */}
            {activeTab === 'analytics' && currentUserRole === 'teacher' && (
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                <div className="flex items-center justify-between border-b border-[#20222d] pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">Classroom Analytics Overview</h3>
                    <p className="text-xs text-gray-400 mt-1">High-level view of student engagement and performance</p>
                  </div>
                  <button className="px-3 py-1.5 bg-[#1d1f2a] hover:bg-[#282a38] text-gray-300 text-xs font-medium rounded-md border border-[#2d3142] transition shadow-sm">
                    Export CSV Report
                  </button>
                </div>

                {analytics ? (
                  <div className="space-y-6">
                    {/* Top Level KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="bg-[#13141a] border border-[#20222d] p-5 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-[#323648] transition">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition">
                          <Users className="w-12 h-12 text-[#ff9100]" />
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1 z-10">Active Students</span>
                        <div className="flex items-end space-x-2 z-10">
                          <span className="text-3xl font-extrabold text-white tracking-tighter">{analytics.totalStudents}</span>
                        </div>
                      </div>
                      
                      <div className="bg-[#13141a] border border-[#20222d] p-5 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-[#323648] transition">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition">
                          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1 z-10">Average Score</span>
                        <div className="flex items-end space-x-2 z-10">
                          <span className="text-3xl font-extrabold text-white tracking-tighter">{analytics.averageScore}%</span>
                          <span className="text-[10px] text-emerald-400 font-medium mb-1">+2.4%</span>
                        </div>
                      </div>

                      <div className="bg-[#13141a] border border-[#20222d] p-5 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-[#323648] transition">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition">
                          <Activity className="w-12 h-12 text-blue-500" />
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1 z-10">Completion Rate</span>
                        <div className="flex items-end space-x-2 z-10">
                          <span className="text-3xl font-extrabold text-white tracking-tighter">{analytics.completionRate}%</span>
                        </div>
                      </div>

                      <div className="bg-[#13141a] border border-[#20222d] p-5 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-[#323648] transition">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition">
                          <AlertTriangle className="w-12 h-12 text-amber-500" />
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1 z-10">Students At Risk</span>
                        <div className="flex items-end space-x-2 z-10">
                          <span className="text-3xl font-extrabold text-amber-400 tracking-tighter">{analytics.atRiskCount}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Submissions Trend */}
                      <div className="bg-[#13141a] border border-[#20222d] rounded-xl overflow-hidden flex flex-col shadow-sm">
                        <div className="p-4 border-b border-[#20222d] bg-[#161720]">
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Recent Submissions Trend</h4>
                        </div>
                        <div className="p-6 flex-1 flex flex-col items-center justify-center min-h-[250px]">
                          {/* Visualization stub */}
                          <div className="w-full flex items-end justify-between h-40 gap-2">
                            {[35, 45, 30, 60, 80, 50, 90, 75, 40, 65, 85, 100].map((val, i) => (
                              <div key={i} className="w-full bg-[#1e202b] rounded-t-sm relative group transition-all duration-300 hover:bg-[#2d3142]" style={{ height: '100%' }}>
                                <div 
                                  className="absolute bottom-0 w-full bg-[#ff9100] rounded-t-sm opacity-80 group-hover:opacity-100 transition-all duration-300"
                                  style={{ height: `${val}%` }}
                                ></div>
                              </div>
                            ))}
                          </div>
                          <div className="w-full flex justify-between text-[10px] text-gray-500 font-mono mt-3 uppercase tracking-widest">
                            <span>2W Ago</span>
                            <span>Today</span>
                          </div>
                        </div>
                      </div>

                      {/* Active Submissions List */}
                      <div className="bg-[#13141a] border border-[#20222d] rounded-xl overflow-hidden flex flex-col shadow-sm">
                        <div className="p-4 border-b border-[#20222d] bg-[#161720]">
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Top Performing Students</h4>
                        </div>
                        <div className="p-0 overflow-y-auto max-h-[300px]">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-[#171821] border-b border-[#20222d] text-gray-400 uppercase tracking-wider text-[10px] sticky top-0">
                              <tr>
                                <th className="px-5 py-3 font-semibold">Student Name</th>
                                <th className="px-5 py-3 font-semibold text-right">Avg Score</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1e202b] text-gray-300">
                              {leaderboard.slice(0, 5).map((l, i) => (
                                <tr key={l.studentId} className="hover:bg-[#181922] transition group">
                                  <td className="px-5 py-3 font-medium flex items-center space-x-3">
                                    <span className="w-5 h-5 rounded-full bg-[#1e202b] flex items-center justify-center text-[9px] font-bold text-gray-400 group-hover:text-[#ff9100] transition">
                                      {i + 1}
                                    </span>
                                    <span>{l.studentName}</span>
                                  </td>
                                  <td className="px-5 py-3 font-mono font-bold text-emerald-400 text-right">{l.accuracy}%</td>
                                </tr>
                              ))}
                              {leaderboard.length === 0 && (
                                <tr>
                                  <td colSpan={2} className="px-5 py-8 text-center text-gray-500 italic">No student performance data available yet.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                    <BarChart2 className="w-12 h-12 mb-4 opacity-20" />
                    <p>Analytics data is not yet available for this classroom.</p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 8: Settings (Teacher only) */}
            {activeTab === 'settings' && currentUserRole === 'teacher' && (
              <div className="flex-1 p-6 overflow-y-auto space-y-6 max-w-4xl">
                <div className="border-b border-[#20222d] pb-4">
                  <h3 className="text-base font-bold text-white">Classroom Settings & Governance</h3>
                  <p className="text-xs text-gray-400">
                    Configure classroom details, manage join codes, configure student interaction privileges, and manage lifecycle.
                  </p>
                </div>

                <form onSubmit={handleSaveSettings} className="space-y-6">
                  {/* General Configuration */}
                  <div className="bg-[#14151c] border border-[#212330] rounded-2xl p-5 space-y-4">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-[#ff9100]" />
                      <span>General Information</span>
                    </h4>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1">
                        <label className="text-gray-400 font-medium">Classroom Name:</label>
                        <input
                          type="text"
                          required
                          value={settingsForm.name}
                          onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                          className="w-full bg-[#1b1d26] border border-[#292c3d] rounded-lg px-3 py-2 text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-gray-400 font-medium">Course Code:</label>
                        <input
                          type="text"
                          required
                          value={settingsForm.courseCode}
                          onChange={(e) => setSettingsForm({ ...settingsForm, courseCode: e.target.value })}
                          className="w-full bg-[#1b1d26] border border-[#292c3d] rounded-lg px-3 py-2 text-white font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-gray-400 font-medium">Section:</label>
                        <input
                          type="text"
                          value={settingsForm.section}
                          onChange={(e) => setSettingsForm({ ...settingsForm, section: e.target.value })}
                          className="w-full bg-[#1b1d26] border border-[#292c3d] rounded-lg px-3 py-2 text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-gray-400 font-medium">Subject / Department:</label>
                        <input
                          type="text"
                          value={settingsForm.subject}
                          onChange={(e) => setSettingsForm({ ...settingsForm, subject: e.target.value })}
                          className="w-full bg-[#1b1d26] border border-[#292c3d] rounded-lg px-3 py-2 text-white"
                        />
                      </div>
                    </div>

                    <div className="space-y-1 text-xs">
                      <label className="text-gray-400 font-medium">Description:</label>
                      <textarea
                        rows={2}
                        value={settingsForm.description}
                        onChange={(e) => setSettingsForm({ ...settingsForm, description: e.target.value })}
                        className="w-full bg-[#1b1d26] border border-[#292c3d] rounded-lg px-3 py-2 text-white resize-none"
                      />
                    </div>
                  </div>

                  {/* Enrollment & Code Controls */}
                  <div className="bg-[#14151c] border border-[#212330] rounded-2xl p-5 space-y-4">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                      <Users className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Joining & Enrollment</span>
                    </h4>

                    <div className="flex items-center justify-between p-3.5 bg-[#1a1c26] rounded-xl text-xs">
                      <div>
                        <div className="font-semibold text-white">Active Join Code</div>
                        <div className="text-gray-400 text-[11px]">Students use this code to enroll in your class</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-base font-bold text-[#ff9100] px-3 py-1 bg-[#13141a] border border-[#252838] rounded-lg">
                          {selectedClassroom.joinCode}
                        </span>
                        <button
                          type="button"
                          onClick={handleRegenerateCode}
                          className="px-3 py-1.5 rounded-lg bg-[#20232e] hover:bg-[#2a2e3f] text-gray-200 text-xs transition flex items-center space-x-1"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Regenerate Code</span>
                        </button>
                      </div>
                    </div>

                    <label className="flex items-center justify-between p-3.5 bg-[#1a1c26] rounded-xl text-xs cursor-pointer">
                      <div>
                        <div className="font-semibold text-white">Enable Student Self-Joining</div>
                        <div className="text-gray-400 text-[11px]">When disabled, new students cannot join even with the code</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settingsForm.joinEnabled}
                        onChange={(e) => setSettingsForm({ ...settingsForm, joinEnabled: e.target.checked })}
                        className="w-4 h-4 rounded bg-[#13141a] border-[#292c3d] text-[#ff9100] focus:ring-0"
                      />
                    </label>
                  </div>

                  {/* Permissions & Communication Policy */}
                  <div className="bg-[#14151c] border border-[#212330] rounded-2xl p-5 space-y-4">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                      <Shield className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Communication & Privacy Controls</span>
                    </h4>

                    <div className="space-y-2 text-xs">
                      <label className="flex items-center justify-between p-3.5 bg-[#1a1c26] rounded-xl cursor-pointer">
                        <div>
                          <div className="font-semibold text-white">Allow Student Announcements / Posting</div>
                          <div className="text-gray-400 text-[11px]">Allow students to publish posts to the class stream</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={settingsForm.allowStudentPosting}
                          onChange={(e) => setSettingsForm({ ...settingsForm, allowStudentPosting: e.target.checked })}
                          className="w-4 h-4 rounded bg-[#13141a] border-[#292c3d] text-[#ff9100] focus:ring-0"
                        />
                      </label>

                      <label className="flex items-center justify-between p-3.5 bg-[#1a1c26] rounded-xl cursor-pointer">
                        <div>
                          <div className="font-semibold text-white">Allow Student-to-Student Direct Messaging</div>
                          <div className="text-gray-400 text-[11px]">Enforce DM privacy while preserving teacher oversight</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={settingsForm.allowStudentMessaging}
                          onChange={(e) => setSettingsForm({ ...settingsForm, allowStudentMessaging: e.target.checked })}
                          className="w-4 h-4 rounded bg-[#13141a] border-[#292c3d] text-[#ff9100] focus:ring-0"
                        />
                      </label>

                      <label className="flex items-center justify-between p-3.5 bg-[#1a1c26] rounded-xl cursor-pointer">
                        <div>
                          <div className="font-semibold text-white">Broadcast Real-time Presence Indicators</div>
                          <div className="text-gray-400 text-[11px]">Show green active dots next to online classmates</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={settingsForm.presenceVisibility}
                          onChange={(e) => setSettingsForm({ ...settingsForm, presenceVisibility: e.target.checked })}
                          className="w-4 h-4 rounded bg-[#13141a] border-[#292c3d] text-[#ff9100] focus:ring-0"
                        />
                      </label>

                      <label className="flex items-center justify-between p-3.5 bg-[#1a1c26] rounded-xl cursor-pointer">
                        <div>
                          <div className="font-semibold text-white">Show Full Student Roster to Class</div>
                          <div className="text-gray-400 text-[11px]">Students can browse other members in the People tab</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={settingsForm.memberVisibility}
                          onChange={(e) => setSettingsForm({ ...settingsForm, memberVisibility: e.target.checked })}
                          className="w-4 h-4 rounded bg-[#13141a] border-[#292c3d] text-[#ff9100] focus:ring-0"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button
                      type="submit"
                      disabled={isSavingSettings}
                      className="px-6 py-2.5 rounded-xl bg-[#ff9100] hover:bg-[#e08000] text-black font-bold text-xs shadow-lg transition"
                    >
                      {isSavingSettings ? 'Broadcasting Settings...' : 'Save & Broadcast Changes'}
                    </button>
                  </div>
                </form>

                {/* Danger Zone: Archive Classroom */}
                <div className="bg-rose-950/20 border border-rose-900/40 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider">Classroom Lifecycle & Archive</h4>
                      <p className="text-xs text-gray-400">
                        Archiving freezes all student postings, messaging, and joins while keeping historical submissions and grades safe.
                      </p>
                    </div>
                    {!isArchived ? (
                      <button
                        onClick={() => setIsConfirmArchiveOpen(true)}
                        className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-black font-bold text-xs border border-rose-500/40 transition flex items-center space-x-2"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>Archive Classroom</span>
                      </button>
                    ) : (
                      <span className="px-3 py-1.5 rounded-xl bg-gray-800 text-gray-400 text-xs font-semibold">
                        Already Archived
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </main>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center space-y-4">
            <Users className="w-12 h-12 text-[#ff9100]" />
            <h3 className="text-lg font-bold text-white">No Classroom Selected</h3>
            <p className="text-xs max-w-sm text-gray-500 leading-relaxed">
              Select an existing classroom on the left sidebar, or create/join a new one to access assignments, real-time chats, and automated test grading.
            </p>
          </div>
        )}
      </div>

        </div>
      {/* Modal: Create Classroom */}
      {isCreateClassModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14151d] border border-[#272a39] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#222533] pb-3">
              <h4 className="text-sm font-bold text-white">Create New Classroom</h4>
              <button onClick={() => setIsCreateClassModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleCreateClassroom} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-gray-400 font-medium">Classroom Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distributed Systems & Concurrency"
                  value={createClassForm.name}
                  onChange={(e) => setCreateClassForm({ ...createClassForm, name: e.target.value })}
                  className="w-full bg-[#1c1e28] border border-[#2b2e40] rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-gray-400 font-medium">Course Code:</label>
                  <input
                    type="text"
                    value={createClassForm.courseCode}
                    onChange={(e) => setCreateClassForm({ ...createClassForm, courseCode: e.target.value })}
                    className="w-full bg-[#1c1e28] border border-[#2b2e40] rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-gray-400 font-medium">Section:</label>
                  <input
                    type="text"
                    value={createClassForm.section}
                    onChange={(e) => setCreateClassForm({ ...createClassForm, section: e.target.value })}
                    className="w-full bg-[#1c1e28] border border-[#2b2e40] rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-gray-400 font-medium">Description:</label>
                <textarea
                  rows={2}
                  value={createClassForm.description}
                  onChange={(e) => setCreateClassForm({ ...createClassForm, description: e.target.value })}
                  placeholder="Overview of syllabus, prerequisites, and goals..."
                  className="w-full bg-[#1c1e28] border border-[#2b2e40] rounded-lg px-3 py-2 text-white resize-none"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateClassModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#1e202c] text-gray-300 hover:bg-[#252837]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#ff9100] text-black font-bold hover:bg-[#e08000]"
                >
                  Create Classroom
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Join Classroom with Code */}
      {isJoinClassModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14151d] border border-[#272a39] rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#222533] pb-3">
              <h4 className="text-sm font-bold text-white">Join Classroom with Code</h4>
              <button onClick={() => setIsJoinClassModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleJoinClassroom} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-gray-400 font-medium">Enter 6-8 digit Classroom Code:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CS201-LIVE"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  className="w-full bg-[#1c1e28] border border-[#2b2e40] rounded-lg px-3 py-2 text-white font-mono text-center tracking-widest uppercase text-sm"
                />
              </div>
              <p className="text-[11px] text-gray-500">
                Ask your instructor for the classroom join code or link.
              </p>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsJoinClassModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#1e202c] text-gray-300 hover:bg-[#252837]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-cyan-500 text-black font-bold hover:bg-cyan-400"
                >
                  Join Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Announcement */}
      {editingAnnouncement && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14151d] border border-[#272a39] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#222533] pb-3">
              <h4 className="text-sm font-bold text-white">Edit Announcement</h4>
              <button onClick={() => setEditingAnnouncement(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSaveEditAnnouncement} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-gray-400 font-medium">Title:</label>
                <input
                  type="text"
                  required
                  value={editAnnTitle}
                  onChange={(e) => setEditAnnTitle(e.target.value)}
                  className="w-full bg-[#1c1e28] border border-[#2b2e40] rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-400 font-medium">Content:</label>
                <textarea
                  rows={4}
                  required
                  value={editAnnContent}
                  onChange={(e) => setEditAnnContent(e.target.value)}
                  className="w-full bg-[#1c1e28] border border-[#2b2e40] rounded-lg px-3 py-2 text-white resize-none"
                />
              </div>
              <label className="flex items-center space-x-2 text-xs text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editAnnPinned}
                  onChange={(e) => setEditAnnPinned(e.target.checked)}
                  className="rounded bg-[#1b1d26] border-[#292c3d] text-[#ff9100] focus:ring-0"
                />
                <span>Pin to top of stream</span>
              </label>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingAnnouncement(null)}
                  className="px-4 py-2 rounded-lg bg-[#1e202c] text-gray-300 hover:bg-[#252837]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#ff9100] text-black font-bold hover:bg-[#e08000]"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Announcement */}
      {annToDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14151d] border border-[#272a39] rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h4 className="text-sm font-bold text-white">Delete Announcement?</h4>
            </div>
            <p className="text-xs text-gray-300">
              Are you sure you want to delete &ldquo;{annToDelete.title}&rdquo;? This will be removed from all student streams immediately.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setAnnToDelete(null)}
                className="px-4 py-2 rounded-lg bg-[#1e202c] text-gray-300 hover:bg-[#252837] text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAnnouncement}
                className="px-5 py-2 rounded-lg bg-rose-500 text-white font-bold hover:bg-rose-600 text-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Remove Student */}
      {memberToRemove && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14151d] border border-[#272a39] rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400">
              <UserMinus className="w-5 h-5 shrink-0" />
              <h4 className="text-sm font-bold text-white">Remove Student?</h4>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Are you sure you want to remove <strong className="text-white">{memberToRemove.userName}</strong> from {selectedClassroom?.name}? Their access will be revoked immediately.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setMemberToRemove(null)}
                className="px-4 py-2 rounded-lg bg-[#1e202c] text-gray-300 hover:bg-[#252837] text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveMember}
                className="px-5 py-2 rounded-lg bg-rose-500 text-white font-bold hover:bg-rose-600 text-xs"
              >
                Confirm Removal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Archive Classroom */}
      {isConfirmArchiveOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14151d] border border-[#272a39] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400">
              <Archive className="w-5 h-5 shrink-0" />
              <h4 className="text-sm font-bold text-white">Archive &ldquo;{selectedClassroom?.name}&rdquo;?</h4>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Archiving locks the classroom into permanent read-only mode. Students can view historical grades and assignments, but no new posts, messages, or enrollments will be accepted.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setIsConfirmArchiveOpen(false)}
                className="px-4 py-2 rounded-lg bg-[#1e202c] text-gray-300 hover:bg-[#252837] text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleArchiveClassroom}
                className="px-5 py-2 rounded-lg bg-rose-500 text-white font-bold hover:bg-rose-600 text-xs"
              >
                Confirm Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Publish Assignment */}
      {isCreateAsgModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14151d] border border-[#272a39] rounded-2xl p-6 max-w-xl w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#222533] pb-3">
              <h4 className="text-sm font-bold text-white">Publish New Assignment</h4>
              <button onClick={() => setIsCreateAsgModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleCreateAssignment} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-gray-400 font-medium">Assignment Title:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dynamic Programming: Coin Change Problem"
                  value={createAsgForm.title}
                  onChange={(e) => setCreateAsgForm({ ...createAsgForm, title: e.target.value })}
                  className="w-full bg-[#1c1e28] border border-[#2b2e40] rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-gray-400 font-medium">Language:</label>
                  <select
                    value={createAsgForm.language}
                    onChange={(e) => setCreateAsgForm({ ...createAsgForm, language: e.target.value })}
                    className="w-full bg-[#1c1e28] border border-[#2b2e40] rounded-lg px-3 py-2 text-white"
                  >
                    <option value="python">Python 3.12</option>
                    <option value="cpp">C++ 20</option>
                    <option value="typescript">TypeScript</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-gray-400 font-medium">Difficulty:</label>
                  <select
                    value={createAsgForm.difficulty}
                    onChange={(e) => setCreateAsgForm({ ...createAsgForm, difficulty: e.target.value })}
                    className="w-full bg-[#1c1e28] border border-[#2b2e40] rounded-lg px-3 py-2 text-white"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-gray-400 font-medium">Instructions & Constraints:</label>
                <textarea
                  rows={3}
                  value={createAsgForm.instructions}
                  onChange={(e) => setCreateAsgForm({ ...createAsgForm, instructions: e.target.value })}
                  placeholder="Explain requirements, time complexity O(N), etc..."
                  className="w-full bg-[#1c1e28] border border-[#2b2e40] rounded-lg px-3 py-2 text-white resize-none"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateAsgModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#1e202c] text-gray-300 hover:bg-[#252837]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#ff9100] text-black font-bold hover:bg-[#e08000]"
                >
                  Publish Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-[#1d1f2b] border border-[#ff9100]/50 text-white text-xs shadow-2xl flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Sparkles className="w-3.5 h-3.5 text-[#ff9100]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
