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
  ChevronLeft, 
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
  Download,
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
  ArrowLeft,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { CortexLogo } from '@/components/brand/CortexLogo';
import { ClassroomRealtimeClient, ConnectionState } from '@/lib/classroom/realtime-client';
import { ClassroomRealtimeEvent } from '@/lib/classroom/protocol';
import { ResourceBranchingCard } from '@/components/classroom/ResourceBranchingCard';
import { TeamsTab } from '@/components/classroom/teams/TeamsTab';
import { ExaminationsTab } from '@/components/classroom/exams/ExaminationsTab';
import { 
  useClassroomFullscreen, 
  requestBrowserFullscreen, 
  exitBrowserFullscreen, 
  enableImmersiveLayout, 
  disableImmersiveLayout 
} from '@/lib/classroom/useClassroomFullscreen';
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

  // Classroom Immersive & Fullscreen Management
  const {
    isImmersive,
    isFullscreen,
    isExiting,
    needsRecovery,
    toggleFullscreen,
    requestFullscreen,
    exitFullscreen,
    retryFullscreen,
    dismissRecovery,
    handleExitToIDE: hookExitToIDE,
  } = useClassroomFullscreen({
    autoImmersive: true,
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollBy({
        left: direction === 'left' ? -220 : 220,
        behavior: 'smooth',
      });
    }
  };

  const handleExitToIDE = async () => {
    await hookExitToIDE();
    window.location.href = '/';
  };

  // Active Role & User Persona
  const [currentUserRole, setCurrentUserRole] = useState<'teacher' | 'student' | 'admin'>('teacher');
  const [currentUserId, setCurrentUserId] = useState<string>('usr_prof_elena');
  const [currentUserName, setCurrentUserName] = useState<string>('Prof. Elena Rostova');
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('elena.rostova@cortex.edu');

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', email: '', role: 'student' as 'teacher' | 'student' });
  const [profileLoaded, setProfileLoaded] = useState(false);

  
  useEffect(() => {
    fetch('/api/v1/auth/me')
      .then(res => {
        if (!res.ok) throw new Error('Unauthenticated');
        return res.json();
      })
      .then(data => {
        setCurrentUserId(data.user.id);
        setCurrentUserName(data.user.name);
        setCurrentUserEmail(data.user.email);
        setCurrentUserRole(data.user.role);
        setProfileLoaded(true);
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);


  const handleSaveProfile = () => {
    if (!profileForm.name.trim()) {
       if (typeof showToast !== 'undefined') showToast('Name is required');
       return;
    }
    
    const existingId = localStorage.getItem('cortex_user_profile') ? JSON.parse(localStorage.getItem('cortex_user_profile') || '{}').id : `usr_${Date.now()}_${Math.random().toString(36).substring(2,6)}`;
    
    const newProfile = {
      id: existingId,
      name: profileForm.name,
      email: profileForm.email || `${existingId}@cortex.edu`,
      role: profileForm.role
    };
    
    localStorage.setItem('cortex_user_profile', JSON.stringify(newProfile));
    setCurrentUserId(newProfile.id);
    setCurrentUserName(newProfile.name);
    setCurrentUserEmail(newProfile.email);
    setCurrentUserRole(newProfile.role);
    setIsProfileModalOpen(false);
  };


  // Classroom data
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeTab, setActiveTab] = useState<'stream' | 'people' | 'assignments' | 'examinations' | 'teams' | 'grades' | 'resources' | 'leaderboard' | 'analytics' | 'settings'>('stream');
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

  const [newResourceForm, setNewResourceForm] = React.useState({ name: '', type: 'link', url: '', description: '' });
  const handleCreateResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassroom) return;
    try {
      const res = await fetch(`/api/v1/classrooms/${selectedClassroom.id}/resources`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...newResourceForm,
          unit: 'General'
        }),
      });
      const data = await res.json();
      if (res.ok && data.resource) {
        setIsCreateResourceModalOpen(false);
        setNewResourceForm({ name: '', type: 'link', url: '', description: '' });
        showToast('Resource added successfully');
        setResources(prev => [data.resource, ...prev]);
      } else {
        showToast(data.error || 'Failed to add resource');
      }
    } catch {
      showToast('Error adding resource');
    }
  };

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

  // Assignment Filtering State (LeetCode-style Problem Catalog)
  const [asgSearchQuery, setAsgSearchQuery] = useState('');
  const [asgDifficultyFilter, setAsgDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [asgStatusFilter, setAsgStatusFilter] = useState<'all' | 'solved' | 'unsolved'>('all');

  // Classroom Archive Confirmation
  const [isConfirmArchiveOpen, setIsConfirmArchiveOpen] = useState(false);

  // Form Inputs
  const [newChatText, setNewChatText] = useState('');
  const [annCommentInputs, setAnnCommentInputs] = useState<Record<string, string>>({});
  const [activeChatUserId, setActiveChatUserId] = useState<string | null>(null);
  const activeChatUserIdRef = useRef<string | null>(null);
  const chatMessagesContainerRef = useRef<HTMLDivElement | null>(null);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [isChatPinned, setIsChatPinned] = useState(false);
  useEffect(() => {
    activeChatUserIdRef.current = activeChatUserId;
  }, [activeChatUserId]);

  // Auto-scroll chat to bottom strictly within its own scroll container
  useEffect(() => {
    if (chatMessagesContainerRef.current) {
      chatMessagesContainerRef.current.scrollTop = chatMessagesContainerRef.current.scrollHeight;
    }
  }, [messages, activeChatUserId, isChatExpanded]);
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnContent, setNewAnnContent] = useState('');
  const [newAnnPinned, setNewAnnPinned] = useState(false);
  const [joincodeInput, setJoinCodeInput] = useState('');
  const [createClassForm, setCreateClassForm] = useState({
    name: '',
    subject: 'Computer Science',
    coursecode: 'CS-301',
    section: 'Sec 01',
    description: '',
  });

  // Settings tab form state
  const [settingsForm, setSettingsForm] = useState({
    name: '',
    coursecode: '',
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
    startercode: '# Write code here\n',
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
          setStudentCodeInput(asgData.assignments[0].startercode || '');
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
    const pendingCode = sessionStorage.getItem('pendingJoinCode');
    if (pendingCode) {
      sessionStorage.removeItem('pendingJoinCode');
      setIsJoinClassModalOpen(true);
      setJoinCodeInput(pendingCode);
    }
  }, []);

  useEffect(() => {
    if (selectedClassroom) {
      fetchClassroomDetails(selectedClassroom.id);
      // Initialize settings form
      setSettingsForm({
        name: selectedClassroom.name || '',
        coursecode: selectedClassroom.coursecode || '',
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
              const msg = payload.message;
              setMessages((prev) => {
                if (prev.some((m) => m.id === msg.id)) return prev;
                return [...prev, msg];
              });
              
              // Show notification for incoming messages if not in active view
              if (msg.senderId !== currentUserId) {
                if (currentUserRole === 'teacher' && (msg.recipientType === 'teacher' || msg.recipientType === 'direct')) {
                  if (activeChatUserIdRef.current !== msg.senderId) {
                    setToastMessage(`New message from ${msg.senderName || 'Student'}`);
                  }
                } else if (currentUserRole !== 'teacher' && msg.recipientType === 'direct') {
                  setToastMessage(`New message from ${msg.senderName || 'Instructor'}`);
                }
              }
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

          case 'classroom.deleted': {
            if (payload.classroomId) {
              setClassrooms((prev) => prev.filter(c => c.id !== payload.classroomId));
              if (payload.classroomId === selectedClassroom.id) {
                setSelectedClassroom(null);
                showToast('This classroom has been permanently deleted by the instructor.');
              }
            }
            break;
          }

          case 'classroom.code_regenerated': {
            if (payload.classroomId === selectedClassroom.id && payload.joincode) {
              setSelectedClassroom((prev) => prev ? { ...prev, joincode: payload.joincode } : null);
              showToast(`New Class Join Code: ${payload.joincode}`);
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

  // Handler: Delete Resource
  const handleDeleteResource = async (resourceId: string) => {
    if (!selectedClassroom) return;
    try {
      const res = await fetch(`/api/v1/classrooms/${selectedClassroom.id}/resources/${resourceId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setResources((prev) => prev.filter((r) => r.id !== resourceId));
        showToast('Resource deleted');
      } else {
        showToast('Failed to delete resource');
      }
    } catch {
      showToast('Error deleting resource');
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

    let targetRecipientType: 'class' | 'teacher' | 'direct' | 'announcement' = currentUserRole === 'teacher' ? 'class' : 'teacher';
    let targetRecipientId: string | undefined = undefined;

    if (currentUserRole === 'teacher' && activeChatUserId && activeChatUserId !== 'class') {
      targetRecipientType = 'direct';
      targetRecipientId = activeChatUserId;
    }

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Optimistically add message to local state so sender sees it immediately
    const optimisticMsg = {
      id: msgId,
      classroomId: selectedClassroom.id,
      senderId: currentUserId,
      senderName: currentUserName,
      senderRole: currentUserRole,
      recipientType: targetRecipientType,
      recipientId: targetRecipientId,
      content: text,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setMessages((prev) => [...prev, optimisticMsg as ClassroomMessage]);

    // Send via WebSocket for real-time delivery to the OTHER person
    if (realtimeClientRef.current && connectionState === 'CONNECTED') {
      realtimeClientRef.current.sendMessage(text, targetRecipientType, targetRecipientId);
    }

    // Persist to database via API (no broadcast needed — DO handles real-time)
    try {
      await fetch(`/api/v1/classrooms/${selectedClassroom.id}/messages`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ content: text, recipientType: targetRecipientType, recipientId: targetRecipientId }),
      });
    } catch (err) {
      showToast('Failed to send message');
    }
  };

  const handlePostAnnComment = async (e: React.FormEvent, annId: string) => {
    e.preventDefault();
    if (!selectedClassroom || !annCommentInputs[annId]?.trim()) return;
    const text = annCommentInputs[annId].trim();
    
    setAnnCommentInputs((prev) => ({ ...prev, [annId]: '' }));

    try {
      await fetch(`/api/v1/classrooms/${selectedClassroom.id}/messages`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ content: text, recipientType: 'announcement', recipientId: annId }),
      });
    } catch (err) {
      showToast('Failed to post comment');
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
        setCreateClassForm({ name: '', subject: 'Computer Science', coursecode: 'CS-301', section: 'Sec 01', description: '' });
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
    if (!joincodeInput.trim()) return;
    try {
      const res = await fetch('/api/v1/classrooms/join', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ joinCode: joincodeInput.trim() }),
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
        setSelectedClassroom((prev) => prev ? { ...prev, joincode: data.joinCode } : null);
        setClassrooms((prev) => prev.map((c) => c.id === selectedClassroom.id ? { ...c, joincode: data.joinCode } : c));
        showToast(`Generated new join code: ${data.joinCode}`);
      } else {
        showToast(data.error || 'Failed to regenerate code');
      }
    } catch {
      showToast('Error regenerating join code');
    }
  };


  const handleSuspendMember = async (member: any, action: 'suspend' | 'unsuspend') => {
    if (!selectedClassroom) return;
    try {
      const res = await fetch(`/api/v1/classrooms/${selectedClassroom.id}/members/${member.userId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        setMembers((prev) =>
          prev.map((m) => (m.userId === member.userId ? { ...m, status: data.status } : m))
        );
        showToast(`${member.userName} has been ${action === 'suspend' ? 'suspended' : 'unsuspended'}`);
      } else {
        showToast(data.error || 'Failed to update student');
      }
    } catch (err) {
      showToast('Error communicating with server');
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
          coursecode: settingsForm.coursecode,
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

  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  // Handler: Delete Classroom (Permanent)
  const handleDeleteClassroom = async () => {
    if (!selectedClassroom) return;
    try {
      const res = await fetch(`/api/v1/classrooms/${selectedClassroom.id}?permanent=true`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setIsConfirmDeleteOpen(false);
        setClassrooms((prev) => prev.filter((c) => c.id !== selectedClassroom.id));
        setSelectedClassroom(null);
        showToast('Classroom permanently deleted.');
      } else {
        showToast(data.error || 'Failed to delete classroom');
      }
    } catch {
      showToast('Error deleting classroom');
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
          startercode: createAsgForm.startercode,
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
    const url = typeof window !== 'undefined' ? `${window.location.origin}/classroom?join=${selectedClassroom.joincode}` : '';
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
    let list = members;
    if (searchMemberQuery.trim()) {
      const q = searchMemberQuery.toLowerCase();
      list = list.filter(
        (m) => m.userName.toLowerCase().includes(q) || m.userEmail.toLowerCase().includes(q) || m.role.toLowerCase().includes(q)
      );
    }
    
    // Deduplicate by email (or userId as fallback) to ensure the same student doesn't appear multiple times
    const unique = new Map<string, typeof list[0]>();
    for (const m of list) {
      const key = m.userEmail || m.userId;
      if (!unique.has(key)) {
        unique.set(key, m);
      } else {
        // If the existing entry is offline and this one is online, prefer the online one
        if (!unique.get(key)?.isOnline && m.isOnline) {
          unique.set(key, m);
        }
      }
    }
    return Array.from(unique.values());
  }, [members, searchMemberQuery]);

  const unreadNotifCount = useMemo(() => {
    return notifications.filter((n) => !n.readAt).length;
  }, [notifications]);

  // Solved Count for Student Progress
  const solvedCount = useMemo(() => {
    return assignments.filter((asg) => {
      const mySub = submissions.find((s) => s.assignmentId === asg.id && s.studentId === currentUserId);
      return mySub && (mySub.score >= 70 || mySub.status === 'completed');
    }).length;
  }, [assignments, submissions, currentUserId]);

  // Filtered Assignments for LeetCode-style Problem Catalog
  const filteredAssignments = useMemo(() => {
    return assignments.filter((asg) => {
      if (asgSearchQuery.trim()) {
        const q = asgSearchQuery.toLowerCase();
        const matchTitle = asg.title.toLowerCase().includes(q);
        const matchLang = asg.language.toLowerCase().includes(q);
        const matchDesc = (asg.description || '').toLowerCase().includes(q);
        if (!matchTitle && !matchLang && !matchDesc) return false;
      }
      if (asgDifficultyFilter !== 'all') {
        if (asg.difficulty?.toLowerCase() !== asgDifficultyFilter) return false;
      }
      if (asgStatusFilter !== 'all') {
        const mySub = submissions.find((s) => s.assignmentId === asg.id && s.studentId === currentUserId);
        const isSolved = mySub && (mySub.score >= 70 || mySub.status === 'completed');
        if (asgStatusFilter === 'solved' && !isSolved) return false;
        if (asgStatusFilter === 'unsolved' && isSolved) return false;
      }
      return true;
    });
  }, [assignments, asgSearchQuery, asgDifficultyFilter, asgStatusFilter, submissions, currentUserId]);


  const handleLiveSessionClick = async () => {
    if (!selectedClassroom) return;
    try {
      await requestBrowserFullscreen();
    } catch {}
    router.push(`/classroom/${selectedClassroom.id}`);
  };

  const isArchived = selectedClassroom?.status === 'archived';

  return (
    <div className={`h-screen w-screen bg-[#000000] bg-monochrome-dotted text-[#FFFFFF] flex flex-col font-sans select-none overflow-hidden relative ${isImmersive ? 'cortex-classroom-immersive-container' : ''}`}>
      <div className="absolute inset-0 bg-[#000000]/60 pointer-events-none z-0"></div>
      <div className="relative z-10 flex flex-col h-full w-full min-h-0 min-w-0 overflow-hidden">

      {/* Create Resource Modal */}
      {isCreateResourceModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="neon-glass rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-2">Add Resource</h2>
            <p className="text-[#FFFFFF] text-sm mb-6">Upload a link, PDF, or reference guide for students.</p>
            
            <form onSubmit={handleCreateResource} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#FFFFFF] mb-1">Resource Name</label>
                <input
                  type="text"
                  required
                  value={newResourceForm.name}
                  onChange={e => setNewResourceForm({...newResourceForm, name: e.target.value})}
                  className="w-full bg-[#0A0A0A] border border-[#525252] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#A3A3A3]"
                  placeholder="e.g. Chapter 1 Slides"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#FFFFFF] mb-1">Type</label>
                  <select
                    value={newResourceForm.type}
                    onChange={e => setNewResourceForm({...newResourceForm, type: e.target.value as any})}
                    className="w-full bg-[#0A0A0A] border border-[#525252] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#A3A3A3]"
                  >
                    <option value="pdf">PDF</option>
                    <option value="link">Link</option>
                    <option value="code">Code Repo</option>
                    <option value="notes">Notes</option>
                    <option value="dataset">Dataset</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#FFFFFF] mb-1">URL / Link</label>
                  <input
                    type="url"
                    required
                    value={newResourceForm.url}
                    onChange={e => setNewResourceForm({...newResourceForm, url: e.target.value})}
                    className="w-full bg-[#0A0A0A] border border-[#525252] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#A3A3A3]"
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#FFFFFF] mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={newResourceForm.description}
                  onChange={e => setNewResourceForm({...newResourceForm, description: e.target.value})}
                  className="w-full bg-[#0A0A0A] border border-[#525252] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#A3A3A3]"
                />
              </div>

              <div className="flex justify-end space-x-3 mt-8 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateResourceModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl font-bold text-sm text-[#E5E5E5] hover:text-white transition hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl font-bold text-sm  bg-[#000000] border border-[#525252] hover:border-[#FFFFFF] text-white hover:opacity-90 transition shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                >
                  Add Resource
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Immersive Classroom Header */}
      <header className="h-12 sm:h-14 bg-[#0b0c0e] border-b border-[#1f2024] flex items-center justify-between px-3 sm:px-5 shrink-0 relative z-20">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
          {/* Exit Classroom / Return to IDE */}
          <button
            data-testid="exit-to-ide-btn"
            onClick={handleExitToIDE}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-300 hover:text-white bg-[#15161c] hover:bg-[#1f2128] border border-[#262832] transition group shrink-0"
            title="Return to Cortex IDE (Exit Classroom)"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#ff9100] transition" />
            <span className="hidden sm:inline">Exit to IDE</span>
          </button>

          <div className="h-4 w-px bg-[#262832] hidden sm:block shrink-0" />

          {/* Logo & Classroom Badge */}
          <div className="flex items-center space-x-2 truncate">
            <Link href="/" onClick={handleExitToIDE} className="flex items-center group transition shrink-0" title="Cortex — Code Beyond Limits">
              <CortexLogo variant="header" size="sm" />
            </Link>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#FF9100]/15 text-[#FF9100] border border-[#FF9100]/30 shrink-0">
              Classroom
            </span>
            {selectedClassroom && (
              <span className="text-xs font-semibold text-white truncate max-w-[140px] sm:max-w-[220px] md:max-w-xs hidden sm:inline" title={selectedClassroom.name}>
                / {selectedClassroom.name}
              </span>
            )}
          </div>
        </div>

        {/* Right: Fullscreen Toggle, User Role, Notifications, Profile */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Sidebar Toggle (Collapse / Expand Classroom List) */}
          <button
            data-testid="classroom-sidebar-toggle"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className={`p-1.5 rounded-lg text-xs font-semibold border transition ${
              !isSidebarOpen
                ? 'bg-[#FF9100]/15 text-[#FF9100] border-[#FF9100]/40'
                : 'bg-[#15161c] hover:bg-[#1f2128] text-gray-300 hover:text-white border-[#262832]'
            }`}
            title={isSidebarOpen ? 'Collapse Classroom Sidebar' : 'Expand Classroom Sidebar'}
            aria-label={isSidebarOpen ? 'Collapse Classroom Sidebar' : 'Expand Classroom Sidebar'}
          >
            {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </button>

          {/* Prominent Return to Fullscreen Button (Shown only when not in native fullscreen) */}
          {(!isFullscreen || needsRecovery) && (
            <button
              data-testid="return-to-fullscreen-btn"
              onClick={retryFullscreen}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#FF9100] hover:bg-[#FF9100]/90 text-black shadow-md transition"
              title="Return to Fullscreen"
              aria-label="Return to Fullscreen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Return to Fullscreen</span>
            </button>
          )}

          {/* User Persona & Role */}
          <div className="flex items-center space-x-1.5 pl-1.5 border-l border-[#262832]">
            <span className="text-xs font-semibold text-[#E5E5E5] hidden md:inline truncate max-w-[120px]">{currentUserName}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold ${
              currentUserRole === 'teacher' || currentUserRole === 'admin'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
            }`}>
              {currentUserRole}
            </span>
          </div>

          {/* Notifications */}
          <button
            onClick={() => setShowNotifications((p) => !p)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a1c22] transition relative"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {notifications.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#FF9100]" />
            )}
          </button>

          {/* Logout */}
          <button
            onClick={async () => {
              await fetch('/api/v1/auth/logout', { method: 'POST' });
              window.location.href = '/login';
            }}
            className="px-2.5 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border border-rose-500/30"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Fullscreen Recovery Notification Banner */}
      {needsRecovery && !isExiting && (
        <div
          data-testid="fullscreen-recovery-banner"
          className="bg-[#15161c] border-b border-[#FF9100]/40 px-3 sm:px-5 py-2 flex items-center justify-between z-30 shrink-0 text-xs shadow-md"
        >
          <div className="flex items-center space-x-2 text-gray-300">
            <span className="w-2 h-2 rounded-full bg-[#FF9100] animate-ping shrink-0" />
            <span className="text-gray-200">
              Classroom is optimized for Fullscreen mode. Your window is currently in standard view.
            </span>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button
              data-testid="banner-return-fullscreen-btn"
              onClick={retryFullscreen}
              className="px-3 py-1 rounded bg-[#FF9100] hover:bg-[#FF9100]/90 text-black font-bold text-xs transition flex items-center space-x-1 shadow-sm"
              title="Return to Fullscreen"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Return to Fullscreen</span>
            </button>
            <button
              data-testid="dismiss-recovery-btn"
              onClick={dismissRecovery}
              className="text-gray-400 hover:text-white px-2 py-1 text-xs transition"
              title="Dismiss notice"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden min-h-0 min-w-0">
        {/* Left Sidebar */}
        {isSidebarOpen && (
        <aside className="w-64 bg-cyber-grid border-r border-[#525252] flex flex-col shrink-0 relative overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-b from-[#161616]/40 via-[#161616]/70 to-[#161616] pointer-events-none z-0"></div>
          <div className="relative z-10 p-4 border-b border-[#525252] flex flex-col gap-2">
            {(currentUserRole === 'teacher' || currentUserRole === 'admin') && (
              <button
                onClick={() => setIsCreateClassModalOpen(true)}
                className="w-full silver-motion-ring rounded-lg text-[#FFFFFF] text-xs font-bold transition"
              >
                <div className="silver-motion-inner py-2 w-full">
                  + Create Classroom
                </div>
              </button>
            )}
            <button
              onClick={() => setIsJoinClassModalOpen(true)}
              className="w-full silver-motion-ring rounded-lg text-[#E5E5E5] hover:text-[#FFFFFF] text-xs font-bold transition"
            >
              <div className="silver-motion-inner py-2 w-full">
                + Join Classroom
              </div>
            </button>
          </div>
          <div className="relative z-10 flex-1 overflow-y-auto p-2 space-y-1">
            {classrooms.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedClassroom(c)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition flex flex-col ${
                  selectedClassroom?.id === c.id
                    ? 'bg-[#000000] border border-[#525252] shadow-[0_0_15px_rgba(255,255,255,0.05)] text-white font-semibold'
                    : 'text-[#E5E5E5] hover:bg-[#212121] hover:text-[#FFFFFF]'
                }`}
              >
                <span>{c.name}</span>
                <span className="text-[10px] text-[#E5E5E5]">{c.subject}</span>
              </button>
            ))}
          </div>
        </aside>
        )}


        {/* Main Area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-transparent relative">
          {selectedClassroom ? (
            <main className="flex-1 flex flex-col min-w-0 min-h-0">

              {/* Top Navigation Tabs - Responsive Scroll Strip with Zero Page Overflow */}
              <div className="h-11 sm:h-12 bg-[#0A0A0A]/90 backdrop-blur-md border-b border-[#262832] px-2 sm:px-4 flex items-center justify-between shrink-0 relative z-10 w-full max-w-full overflow-hidden">
                {/* Scroll Left Button (desktop/touch affordance) */}
                <button
                  type="button"
                  onClick={() => scrollTabs('left')}
                  className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-[#1a1c22] transition shrink-0 hidden sm:flex items-center justify-center mr-1"
                  title="Scroll tabs left"
                  aria-label="Scroll tabs left"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Scrollable Tab Track */}
                <div
                  ref={tabsContainerRef}
                  role="tablist"
                  aria-label="Classroom sections"
                  className="flex items-center gap-1.5 overflow-x-auto scrollbar-none scrollbar-hide scroll-smooth min-w-0 flex-1 py-1"
                >
                  <button
                    role="tab"
                    aria-selected={activeTab === 'stream'}
                    onClick={(e) => {
                      setActiveTab('stream');
                      e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    }}
                    className={`h-8 px-3 rounded-lg text-xs font-heading font-semibold transition flex items-center space-x-1.5 shrink-0 ${
                      activeTab === 'stream'
                        ? 'bg-[#FF9100]/20 text-[#FF9100] border border-[#FF9100]/40 font-bold shadow-sm'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-[#16171c] border border-transparent'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Stream</span>
                  </button>

                  <button
                    role="tab"
                    aria-selected={activeTab === 'people'}
                    onClick={(e) => {
                      setActiveTab('people');
                      e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    }}
                    className={`h-8 px-3 rounded-lg text-xs font-heading font-semibold transition flex items-center space-x-1.5 shrink-0 ${
                      activeTab === 'people'
                        ? 'bg-[#FF9100]/20 text-[#FF9100] border border-[#FF9100]/40 font-bold shadow-sm'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-[#16171c] border border-transparent'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>People</span>
                  </button>

                  <button
                    role="tab"
                    aria-selected={activeTab === 'assignments'}
                    onClick={(e) => {
                      setActiveTab('assignments');
                      e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    }}
                    className={`h-8 px-3 rounded-lg text-xs font-heading font-semibold transition flex items-center space-x-1.5 shrink-0 ${
                      activeTab === 'assignments'
                        ? 'bg-[#FF9100]/20 text-[#FF9100] border border-[#FF9100]/40 font-bold shadow-sm'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-[#16171c] border border-transparent'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Assignments</span>
                  </button>

                  <button
                    role="tab"
                    aria-selected={activeTab === 'examinations'}
                    onClick={(e) => {
                      setActiveTab('examinations');
                      e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    }}
                    className={`h-8 px-3 rounded-lg text-xs font-heading font-semibold transition flex items-center space-x-1.5 shrink-0 ${
                      activeTab === 'examinations'
                        ? 'bg-[#FF9100]/20 text-[#FF9100] border border-[#FF9100]/40 font-bold shadow-sm'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-[#16171c] border border-transparent'
                    }`}
                  >
                    <Award className="w-3.5 h-3.5 text-[#FF9100]" />
                    <span>Examinations</span>
                  </button>

                  <button
                    role="tab"
                    aria-selected={activeTab === 'teams'}
                    onClick={(e) => {
                      setActiveTab('teams');
                      e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    }}
                    className={`h-8 px-3 rounded-lg text-xs font-heading font-semibold transition flex items-center space-x-1.5 shrink-0 ${
                      activeTab === 'teams'
                        ? 'bg-[#FF9100]/20 text-[#FF9100] border border-[#FF9100]/40 font-bold shadow-sm'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-[#16171c] border border-transparent'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 text-[#FF9100]" />
                    <span>Project Teams</span>
                  </button>


                  <button
                    role="tab"
                    aria-selected={activeTab === 'grades'}
                    onClick={(e) => {
                      setActiveTab('grades');
                      e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    }}
                    className={`h-8 px-3 rounded-lg text-xs font-heading font-semibold transition flex items-center space-x-1.5 shrink-0 ${
                      activeTab === 'grades'
                        ? 'bg-[#FF9100]/20 text-[#FF9100] border border-[#FF9100]/40 font-bold shadow-sm'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-[#16171c] border border-transparent'
                    }`}
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>Grades & Feedback</span>
                  </button>

                  <button
                    role="tab"
                    aria-selected={activeTab === 'resources'}
                    onClick={(e) => {
                      setActiveTab('resources');
                      e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    }}
                    className={`h-8 px-3 rounded-lg text-xs font-heading font-semibold transition flex items-center space-x-1.5 shrink-0 ${
                      activeTab === 'resources'
                        ? 'bg-[#FF9100]/20 text-[#FF9100] border border-[#FF9100]/40 font-bold shadow-sm'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-[#16171c] border border-transparent'
                    }`}
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Resources ({resources.length})</span>
                  </button>

                  <button
                    role="tab"
                    aria-selected={activeTab === 'leaderboard'}
                    onClick={(e) => {
                      setActiveTab('leaderboard');
                      e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    }}
                    className={`h-8 px-3 rounded-lg text-xs font-heading font-semibold transition flex items-center space-x-1.5 shrink-0 ${
                      activeTab === 'leaderboard'
                        ? 'bg-[#FF9100]/20 text-[#FF9100] border border-[#FF9100]/40 font-bold shadow-sm'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-[#16171c] border border-transparent'
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>Leaderboard</span>
                  </button>

                  {currentUserRole === 'teacher' && (
                    <button
                      role="tab"
                      aria-selected={activeTab === 'analytics'}
                      onClick={(e) => {
                        setActiveTab('analytics');
                        e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                      }}
                      className={`h-8 px-3 rounded-lg text-xs font-heading font-semibold transition flex items-center space-x-1.5 shrink-0 ${
                        activeTab === 'analytics'
                          ? 'bg-[#FF9100]/20 text-[#FF9100] border border-[#FF9100]/40 font-bold shadow-sm'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-[#16171c] border border-transparent'
                      }`}
                    >
                      <BarChart2 className="w-3.5 h-3.5" />
                      <span>Teacher Analytics</span>
                    </button>
                  )}

                  {currentUserRole === 'teacher' && (
                    <button
                      role="tab"
                      aria-selected={activeTab === 'settings'}
                      onClick={(e) => {
                        setActiveTab('settings');
                        e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                      }}
                      className={`h-8 px-3 rounded-lg text-xs font-heading font-semibold transition flex items-center space-x-1.5 shrink-0 ${
                        activeTab === 'settings'
                          ? 'bg-[#FF9100]/20 text-[#FF9100] border border-[#FF9100]/40 font-bold shadow-sm'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-[#16171c] border border-transparent'
                      }`}
                    >
                      <SettingsIcon className="w-3.5 h-3.5" />
                      <span>Class Settings</span>
                    </button>
                  )}
                </div>

                {/* Scroll Right Button (desktop/touch affordance) */}
                <button
                  type="button"
                  onClick={() => scrollTabs('right')}
                  className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-[#1a1c22] transition shrink-0 hidden sm:flex items-center justify-center ml-1"
                  title="Scroll tabs right"
                  aria-label="Scroll tabs right"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Direct Live Class Launch Button */}
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await requestBrowserFullscreen();
                    } catch {}
                    router.push(`/classroom/${selectedClassroom?.id}/live/session_main`);
                  }}
                  className="h-7.5 px-3 rounded-lg text-xs font-heading font-bold bg-[#FF9100]/20 text-[#FF9100] border border-[#FF9100]/40 hover:bg-[#FF9100] hover:text-black transition flex items-center space-x-1.5 shrink-0 ml-2 shadow-sm"
                  title="Launch Live Class (Interactive Whiteboard, Slides & Media)"
                >
                  <Radio className="w-3.5 h-3.5 animate-pulse text-[#FF9100]" />
                  <span className="hidden sm:inline">Live Class</span>
                </button>
              </div>

            {/* TAB 1: Stream & Announcements Feed */}
            {activeTab === 'stream' && (
              <div className="flex-1 flex overflow-hidden relative">
                {/* Left Column: Announcements Feed */}
                <div className="flex-1 min-w-0 flex flex-col space-y-4 overflow-y-auto p-4 sm:p-6">
                  {/* Create Announcement Box */}
                  {!isArchived && currentUserRole === 'teacher' && (
                    <div className="bg-[#0A0A0A] border border-[#525252] rounded-xl p-4 shadow-sm space-y-3 min-w-0">
                      <span className="text-xs font-semibold text-[#E5E5E5] flex items-center space-x-2">
                        <Sparkles className="w-3.5 h-3.5 text-[#FFFFFF]" />
                        <span>Post Class Announcement</span>
                      </span>
                      <form onSubmit={handlePostAnnouncement} className="space-y-3">
                        <input
                          type="text"
                          placeholder="Announcement Title..."
                          value={newAnnTitle}
                          onChange={(e) => setNewAnnTitle(e.target.value)}
                          className="w-full min-w-0 bg-[#0A0A0A] border border-[#525252] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#525252]"
                        />
                        <textarea
                          rows={3}
                          placeholder="Share course updates, lecture notes, test case hints, or lab reminders..."
                          value={newAnnContent}
                          onChange={(e) => setNewAnnContent(e.target.value)}
                          className="w-full min-w-0 bg-[#0A0A0A] border border-[#525252] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#525252] resize-none"
                        />
                        <div className="flex items-center justify-between">
                          {currentUserRole === 'teacher' ? (
                            <label className="flex items-center space-x-2 text-xs text-[#E5E5E5] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={newAnnPinned}
                                onChange={(e) => setNewAnnPinned(e.target.checked)}
                                className="rounded bg-[#0A0A0A] border-[#525252] text-[#FFFFFF] focus:ring-0"
                              />
                              <span>Pin to top of stream</span>
                            </label>
                          ) : <div />}
                          <button
                            type="submit"
                            className="px-4 py-1.5 rounded-lg bg-[#0A0A0A] hover:bg-[#212121] text-[#FFFFFF] font-semibold text-xs transition"
                          >
                            Post Update
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Announcements List */}
                  <div className="space-y-3 min-w-0">
                    {sortedAnnouncements.length === 0 ? (
                      <div className="text-center text-xs text-[#E5E5E5] py-12 bg-[#000000] border border-[#525252] rounded-xl p-8">
                        No announcements posted yet.
                      </div>
                    ) : (
                      sortedAnnouncements.map((ann) => (
                        <div
                          key={ann.id}
                          className={`p-4 rounded-xl border transition space-y-2 min-w-0 ${
                            ann.pinned
                              ? 'bg-[#0A0A0A] border-[#525252]/40 shadow-sm'
                              : 'bg-[#000000] border-[#525252]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2 min-w-0">
                              {ann.pinned && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0A0A0A]/20 text-[#FFFFFF] border border-[#525252]/40 flex items-center space-x-1 shrink-0">
                                  <Pin className="w-3 h-3" />
                                  <span>PINNED</span>
                                </span>
                              )}
                              <h4 className="text-sm font-semibold text-white truncate">{ann.title}</h4>
                            </div>

                            {/* Actions for Instructor */}
                            <div className="flex items-center space-x-2 shrink-0">
                              <span className="text-[11px] text-[#E5E5E5]">
                                {new Date(ann.createdAt).toLocaleDateString()}
                              </span>
                              {currentUserRole === 'teacher' && !isArchived && (
                                <div className="flex items-center space-x-1 pl-2 border-l border-[#525252]">
                                  <button
                                    onClick={() => handleTogglePin(ann)}
                                    className={`p-1 rounded hover:bg-[#212121] text-xs transition ${ann.pinned ? 'text-[#FFFFFF]' : 'text-[#E5E5E5] hover:text-[#E5E5E5]'}`}
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
                                    className="p-1 rounded hover:bg-[#212121] text-[#E5E5E5] hover:text-white transition"
                                    title="Edit announcement"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setAnnToDelete(ann)}
                                    className="p-1 rounded hover:bg-[#212121] text-[#E5E5E5] hover:text-[#FFFFFF] transition"
                                    title="Delete announcement"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          <p className="text-xs text-[#E5E5E5] leading-relaxed whitespace-pre-line break-words">
                            {ann.content}
                          </p>
                          <div className="text-[10px] text-[#E5E5E5] pt-2 border-t border-[#525252] flex items-center justify-between">
                            <span>Posted by {ann.authorName} ({ann.authorRole})</span>
                          </div>

                          {/* Comments Section */}
                          <div className="pt-3 space-y-2 mt-2 border-t border-[#525252]/50 min-w-0">
                            {messages
                              .filter((m) => m.recipientType === 'announcement' && m.recipientId === ann.id)
                              .map((c) => (
                                <div key={c.id} className="flex flex-col bg-[#0A0A0A] p-2 rounded-lg border border-[#525252]/50 min-w-0">
                                  <span className="text-[10px] font-bold text-white mb-0.5">{c.senderName}</span>
                                  <span className="text-xs text-[#E5E5E5] break-words">{c.content}</span>
                                </div>
                              ))}
                            
                            {/* Comment Input */}
                            {!isArchived && (
                              <form onSubmit={(e) => handlePostAnnComment(e, ann.id)} className="flex items-center space-x-2 pt-1 min-w-0">
                                <input
                                  type="text"
                                  placeholder="Add class comment..."
                                  value={annCommentInputs[ann.id] || ''}
                                  onChange={(e) => setAnnCommentInputs((prev) => ({ ...prev, [ann.id]: e.target.value }))}
                                  className="flex-1 min-w-0 bg-[#000000] border border-[#525252] rounded-lg px-3 py-1.5 text-[11px] text-white focus:outline-none focus:border-[#525252]"
                                />
                                <button
                                  type="submit"
                                  disabled={!annCommentInputs[ann.id]?.trim()}
                                  className="p-1.5 rounded-lg bg-[#212121] text-[#E5E5E5] hover:text-white hover:bg-[#525252] disabled:opacity-50 transition shrink-0"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                </button>
                              </form>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right Column: Classroom Realtime Chat with Moving Silver Border & Slide Drawer */}
                {(() => {
                  const unreadChatCount = currentUserRole === 'teacher' 
                    ? members.filter(m => {
                        if (m.role === 'teacher') return false;
                        const studentMsgs = messages.filter(msg => (msg.senderId === m.userId && (msg.recipientType === 'teacher' || msg.recipientType === 'direct')));
                        const latestMsg = studentMsgs[studentMsgs.length - 1];
                        return Boolean(latestMsg && latestMsg.senderId === m.userId);
                      }).length
                    : messages.filter(m => m.recipientType === 'direct' && m.recipientId === currentUserId).length;

                  if (!isChatExpanded) {
                    return (
                      <div 
                        className="w-[74px] h-full flex flex-col shrink-0 border-l border-neutral-800 bg-[#030303] cursor-pointer hover:border-neutral-500 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] select-none group relative z-10 p-1"
                        onClick={() => { setIsChatExpanded(true); setIsChatPinned(true); }}
                        title="Click to open Cortex Chat System"
                      >
                        <div className="cyber-silver-motion-ring cyber-shape-vertical-ring w-full h-full">
                          <div className="cyber-silver-motion-inner cyber-shape-vertical-inner bg-gaming-grid flex flex-col items-center justify-between py-6 relative h-full">
                            {/* Top Cyber Status Tag */}
                            <div className="pt-2 flex flex-col items-center opacity-70 group-hover:opacity-100 transition-opacity">
                              <div className="w-4 h-1 rounded-full bg-white/60 shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
                              <span className="font-mono text-[7px] text-neutral-400 tracking-widest mt-1">SYS // CX</span>
                            </div>

                            {/* Center: Prominent Draco Racing Typography Lockup (74px width, 40% clean brightness) */}
                            <div className="flex-1 flex items-center justify-center my-auto py-2 group-hover:scale-105 transition-transform select-none">
                              <div className="draco-lockup-container" style={{ transform: 'rotate(-90deg)', width: '330px' }}>
                                {/* Parallel Fiery Red-Orange Sub-Tag */}
                                <div className="racing-sub-tag text-[9.5px]">
                                  CHAT SYSTEM
                                </div>
                                
                                {/* Bold Speed-Italic Metallic Chrome Main Title */}
                                <div className="racing-main-title text-[32px]">
                                  CORTEX
                                </div>
                              </div>
                            </div>

                            {/* Bottom Cyber Click Indicator */}
                            <div className="pb-2 flex flex-col items-center opacity-60 group-hover:opacity-100 transition-opacity">
                              <ChevronLeft className="w-3.5 h-3.5 text-white animate-pulse" />
                              <span className="font-mono text-[7.5px] text-neutral-400 uppercase tracking-widest mt-0.5">CLICK</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <>
                      {/* Responsive Backdrop on small/tablet/laptop viewports (< xl) */}
                      <div 
                        className="xl:hidden absolute inset-0 bg-black/60 backdrop-blur-xs z-20 transition-opacity"
                        onClick={() => { setIsChatExpanded(false); setIsChatPinned(false); }}
                      />

                      <div 
                        className="absolute right-0 top-0 bottom-0 h-full z-30 w-full sm:w-[390px] xl:w-96 xl:relative xl:z-20 xl:shrink-0 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] flex border-l border-neutral-800 bg-[#09090b] shadow-2xl p-2 max-w-full min-w-0"
                      >
                        <div className="silver-moving-border w-full h-full shadow-2xl flex flex-col min-w-0">
                          <div className="silver-inner-content flex flex-col overflow-hidden h-full min-w-0">
                          
                          {/* Chat Header */}
                          <div className="p-3 border-b border-neutral-800 flex items-center justify-between bg-[#0E0E0E] shrink-0 z-10">
                            {currentUserRole === 'teacher' && activeChatUserId !== null ? (
                              <div className="flex items-center space-x-2 min-w-0">
                                <button 
                                  onClick={() => setActiveChatUserId(null)} 
                                  className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-300 hover:text-white transition-all active:scale-90 shrink-0"
                                >
                                  <ArrowLeft className="w-4 h-4" />
                                </button>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-semibold text-white truncate max-w-[140px]">
                                    {activeChatUserId === 'class' ? 'Class Announcements' : `${members.find(m => m.userId === activeChatUserId)?.userName || 'Student'}`}
                                  </span>
                                  <span className="text-[9px] text-cyan-400 flex items-center space-x-1 truncate">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0"></span>
                                    <span className="truncate">{activeChatUserId === 'class' ? 'Broadcast' : 'Direct Message'}</span>
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-[#141416] border border-neutral-700/80 flex items-center justify-center shrink-0 p-1 shadow-inner">
                                  <CortexLogo variant="icon" size="sm" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center space-x-2 min-w-0">
                                    <h3 className="text-sm font-semibold text-white tracking-tight truncate">
                                      Cortex Chat System
                                    </h3>
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] shrink-0" />
                                  </div>
                                  <span className="text-[11px] text-neutral-400 truncate">
                                    {currentUserRole === 'teacher' ? 'Prioritized Student Messages' : 'Live Realtime Classroom'}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Header Action Buttons (Collapse) */}
                            <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/60 text-cyan-400 border border-cyan-500/30 font-medium whitespace-nowrap">
                                Real-time
                              </span>
                              <button
                                onClick={() => { setIsChatExpanded(false); setIsChatPinned(false); }}
                                title="Slide close chat"
                                className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition active:scale-90 border border-neutral-800 shrink-0"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {currentUserRole === 'teacher' && activeChatUserId === null ? (
                            // Chats List View with Smooth Slide Animation
                            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1 animate-chat-slide-right custom-scrollbar">
                              <div
                                onClick={() => setActiveChatUserId('class')}
                                className="flex items-center space-x-3 p-2.5 rounded-xl hover:bg-neutral-900 cursor-pointer transition border border-transparent hover:border-neutral-800 group"
                              >
                                <div className="w-9 h-9 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 group-hover:scale-105 transition-transform">
                                  <MessageSquare className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-baseline">
                                    <span className="text-xs font-semibold text-white">Class Broadcast</span>
                                    <span className="text-[9px] text-neutral-500">Live</span>
                                  </div>
                                  <div className="text-[10px] text-neutral-400 truncate">Broadcast message to all students</div>
                                </div>
                              </div>

                              <div className="pt-2 pb-1 px-2 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider flex justify-between items-center">
                                <span>Students</span>
                                <span className="text-[9px] text-cyan-400 font-normal">Sorted by latest</span>
                              </div>

                              {filteredMembers
                                .filter((m) => m.role !== 'teacher')
                                .map((student) => {
                                  const studentMsgs = messages.filter(m => 
                                    (m.senderId === student.userId && (m.recipientType === 'teacher' || m.recipientType === 'direct')) ||
                                    (m.senderId === currentUserId && m.recipientId === student.userId)
                                  );
                                  const latestMsg = studentMsgs[studentMsgs.length - 1];
                                  const latestTs = latestMsg?.createdAt || 0;
                                  // Unread = latest message is FROM the student (not from teacher)
                                  const hasUnread = latestMsg && latestMsg.senderId === student.userId;
                                  return { student, studentMsgs, latestMsg, latestTs, hasUnread };
                                })
                                .sort((a, b) => b.latestTs - a.latestTs)
                                .map(({ student, latestMsg, hasUnread }) => (
                                  <div
                                    key={student.userId}
                                    onClick={() => setActiveChatUserId(student.userId)}
                                    className="flex items-center space-x-3 p-2.5 rounded-xl hover:bg-neutral-900 cursor-pointer transition border border-transparent hover:border-neutral-800 group"
                                  >
                                    <div className="relative shrink-0">
                                      <div className="w-9 h-9 rounded-full bg-[#0A0A0A] border border-neutral-700 flex items-center justify-center font-bold text-white text-xs group-hover:scale-105 transition-transform">
                                        {student.userName.charAt(0) || '?'}
                                      </div>
                                      {hasUnread && (
                                        <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-cyan-400 rounded-full border-2 border-[#0A0A0A] shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex justify-between items-baseline">
                                        <span className={`text-xs truncate ${hasUnread ? 'font-bold text-white' : 'font-semibold text-neutral-200'}`}>{student.userName || 'Student'}</span>
                                        {latestMsg && (
                                          <span className={`text-[9px] ${hasUnread ? 'text-cyan-400 font-semibold' : 'text-neutral-500'} shrink-0 ml-1`}>
                                            {new Date(latestMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        )}
                                      </div>
                                      <div className={`text-[11px] truncate ${hasUnread ? 'text-cyan-300 font-medium' : 'text-neutral-400'}`}>
                                        {latestMsg ? latestMsg.content : 'No messages yet'}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          ) : (
                            // Messages Feed View with Slide and Pop-in Animations
                            <div 
                              ref={chatMessagesContainerRef} 
                              className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5 animate-chat-slide-left custom-scrollbar"
                            >
                              {(() => {
                                const effectiveChatId = activeChatUserId || 'class';
                                const displayedMessages = messages.filter(m => {
                                  if (m.recipientType === 'announcement') return false;
                                  if (currentUserRole === 'teacher' && effectiveChatId !== 'class') {
                                    return (m.senderId === effectiveChatId && (m.recipientType === 'teacher' || m.recipientType === 'direct')) ||
                                           (m.senderId === currentUserId && m.recipientId === effectiveChatId);
                                  }
                                  // Class broadcast feed OR student unified feed
                                  if (m.recipientType === 'class') return true;
                                  // Student sees their own outgoing messages to teacher
                                  if (m.recipientType === 'teacher' && m.senderId === currentUserId) return true;
                                  // Student sees DMs addressed to them (from teacher)
                                  if (m.recipientType === 'direct' && m.recipientId === currentUserId) return true;
                                  // Student sees their own sent DMs (shown as outgoing)
                                  if (m.recipientType === 'direct' && m.senderId === currentUserId) return true;
                                  return false;
                                });

                                if (displayedMessages.length === 0) {
                                  return (
                                    <div className="text-center text-xs text-neutral-400 py-16 flex flex-col items-center justify-center space-y-2">
                                      <div className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500">
                                        <MessageSquare className="w-5 h-5" />
                                      </div>
                                      <span>No messages yet. Start the discussion!</span>
                                    </div>
                                  );
                                }

                                return displayedMessages.map((m) => {
                                  const isMe = m.senderId === currentUserId;
                                  return (
                                    <div
                                      key={m.id}
                                      className={`flex flex-col space-y-1 ${isMe ? 'items-end' : 'items-start'} animate-chat-pop-in max-w-full`}
                                    >
                                      <div className="flex items-center space-x-1.5 text-[10px] text-neutral-400 max-w-full">
                                        <span className="font-medium text-neutral-300 truncate max-w-[140px]">{m.senderName || (m.senderRole === 'student' ? 'Student' : 'Instructor')}</span>
                                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-neutral-900 text-neutral-400 border border-neutral-800 shrink-0">
                                          {m.senderRole}
                                        </span>
                                      </div>
                                      <div
                                        className={`px-3.5 py-2 text-xs max-w-[85%] leading-relaxed shadow-sm break-words ${
                                          isMe
                                            ? 'bg-[#005c4b]/85 text-white rounded-2xl rounded-tr-xs border border-[#00a884]/40'
                                            : 'bg-[#202c33] text-white rounded-2xl rounded-tl-xs border border-neutral-700/60'
                                        }`}
                                      >
                                        <div className="break-words">{m.content}</div>
                                        <div className="text-[9px] text-right mt-1 opacity-75 flex items-center justify-end space-x-1 shrink-0">
                                          <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                          {isMe && <span className="text-cyan-300 font-bold ml-1 text-[10px]">✓✓</span>}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          )}

                          {/* Chat Input Bar */}
                          {!(currentUserRole === 'teacher' && activeChatUserId === null) && (
                            !isArchived ? (
                              <form onSubmit={handleSendMessage} className="p-2.5 border-t border-neutral-800 bg-[#0E0E0E] flex space-x-2 items-center shrink-0 min-w-0">
                                <input
                                  type="text"
                                  placeholder={
                                    currentUserRole === 'teacher' 
                                      ? (activeChatUserId === 'class' ? "Type a message to class..." : "Message student...") 
                                      : "Message teachers..."
                                  }
                                  value={newChatText}
                                  onChange={(e) => setNewChatText(e.target.value)}
                                  onFocus={() => setIsChatPinned(true)}
                                  className="flex-1 min-w-0 bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-400 transition-colors shadow-inner"
                                />
                                <button
                                  type="submit"
                                  className="w-8 h-8 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-black font-semibold flex items-center justify-center transition-all shadow-md shrink-0"
                                >
                                  <Send className="w-3.5 h-3.5 ml-0.5" />
                                </button>
                              </form>
                            ) : (
                              <div className="p-3 border-t border-[#525252] bg-[#0A0A0A] text-center text-xs text-[#E5E5E5] shrink-0">
                                Chat is disabled for archived classrooms
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

            {/* TAB 2: People & Roster Management */}
            {activeTab === 'people' && (
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                {/* Header with Search & Count */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">Course Members & Roster</h3>
                    <p className="text-xs text-[#E5E5E5]">
                      Manage enrolled students, verify attendance presence, and maintain class permissions.
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-[#E5E5E5] absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search student or email..."
                        value={searchMemberQuery}
                        onChange={(e) => setSearchMemberQuery(e.target.value)}
                        className="bg-[#0A0A0A] border border-[#525252] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#525252]"
                      />
                    </div>
                    <span className="px-3 py-1.5 rounded-xl bg-[#0A0A0A] border border-[#525252] text-xs font-mono text-[#E5E5E5]">
                      {new Set(members.map(m => m.userEmail || m.userId)).size} Enrolled
                    </span>
                  </div>
                </div>

                {/* Instructors Section */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-[#E5E5E5] uppercase tracking-wider">Instructors</h4>
                  <div className="bg-[#000000] border border-[#525252] rounded-xl overflow-hidden divide-y divide-[#1e202b]">
                    <div className="p-4 flex items-center justify-between hover:bg-[#212121] transition">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-full bg-[#0A0A0A]/20 border border-[#525252]/40 flex items-center justify-center font-bold text-[#FFFFFF] text-sm">
                          {selectedClassroom.teacherName.charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white flex items-center space-x-2">
                            <span>{selectedClassroom.teacherName}</span>
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              COURSE INSTRUCTOR
                            </span>
                          </div>
                          <div className="text-xs text-[#E5E5E5]">elena.rostova@cortex.edu</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-xs text-[#E5E5E5]">Instructor Available</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Students Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-[#E5E5E5] uppercase tracking-wider">
                      Students ({filteredMembers.filter((m) => m.role !== 'teacher').length})
                    </h4>
                  </div>

                  <div className="bg-[#000000] border border-[#525252] rounded-xl overflow-hidden divide-y divide-[#1e202b]">
                    {filteredMembers.filter((m) => m.role !== 'teacher').length === 0 ? (
                      <div className="p-8 text-center text-xs text-[#E5E5E5]">
                        No students enrolled yet or matching search filter. Share the join code with your students!
                      </div>
                    ) : (
                      filteredMembers
                        .filter((m) => m.role !== 'teacher')
                        .map((member) => (
                          <div
                            key={member.id}
                            className="p-3.5 flex items-center justify-between hover:bg-[#212121] transition"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full bg-[#0A0A0A] border border-[#525252] flex items-center justify-center font-bold text-[#FFFFFF] text-xs">
                                {member.userName.charAt(0)}
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-white">{member.userName}</div>
                                <div className="text-[11px] text-[#E5E5E5]">
                                  {member.userEmail || `${member.userId}@student.cortex.edu`}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center space-x-4">
                              {/* Presence Badge */}
                              <div className="flex items-center space-x-1.5">
                                <div className={`w-2 h-2 rounded-full ${member.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
                                <span className="text-xs text-[#E5E5E5]">{member.isOnline ? 'Online now' : 'Offline'} {member.status === 'suspended' && <span className="text-[#FFFFFF] font-bold ml-2">(SUSPENDED)</span>}</span>
                              </div>

                              <span className="text-[11px] text-[#E5E5E5] font-mono">
                                Joined {new Date(member.joinedAt).toLocaleDateString()}
                              </span>

                              {/* Actions for Instructor */}
                              {currentUserRole === 'teacher' && !isArchived && (
                                <div className="flex items-center space-x-2 mt-2">
                                  <button
                                    onClick={() => {
                                      setActiveChatUserId(member.userId);
                                      setActiveTab('stream');
                                    }}
                                    className="px-2 py-1 rounded-lg text-xs font-medium bg-[#212121] text-[#E5E5E5] hover:text-[#FFFFFF] transition"
                                    title="Direct Message"
                                  >
                                    Message
                                  </button>
                                  <button
                                    onClick={() => handleSuspendMember(member, member.status === 'suspended' ? 'unsuspend' : 'suspend')}
                                    className={`px-2 py-1 rounded-lg text-xs font-medium transition ${member.status === 'suspended' ? 'bg-amber-500/10 text-[#FFFFFF] hover:bg-amber-500/20' : 'bg-gray-800 text-[#E5E5E5] hover:text-[#FFFFFF]'}`}
                                    title={member.status === 'suspended' ? "Restore Access" : "Suspend student (Block for some days)"}
                                  >
                                    {member.status === 'suspended' ? 'Unsuspended' : 'Suspend'}
                                  </button>
                                  <button
                                    onClick={() => setMemberToRemove(member)}
                                    className="p-1.5 rounded-lg hover:bg-rose-950/40 text-[#E5E5E5] hover:text-[#FFFFFF] border border-transparent hover:border-rose-800/40 transition flex items-center space-x-1 text-xs"
                                    title="Remove student completely"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>

                              )}
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Assignments & Lab (LeetCode-style Clean Problemset Catalog) */}
            {activeTab === 'assignments' && (
              <div className="flex-1 flex flex-col overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
                {/* Header & Controls Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#262626] pb-5">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-xl font-extrabold text-white tracking-tight flex items-center space-x-2">
                        <Code2 className="w-5 h-5 text-emerald-400" />
                        <span>Problem Sets & Challenges</span>
                      </h3>
                      <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-[#171717] border border-[#262626] text-zinc-300">
                        {assignments.length} {assignments.length === 1 ? 'Problem' : 'Problems'}
                      </span>
                      {currentUserRole === 'student' && assignments.length > 0 && (
                        <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Solved: {solvedCount} / {assignments.length}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400">
                      Explore coding challenges, test your solutions against unit benchmarks, and submit for instant autograding.
                    </p>
                  </div>

                  <div className="flex items-center space-x-3">
                    {currentUserRole === 'teacher' && !isArchived && (
                      <button
                        onClick={() => router.push(`/classroom/${selectedClassroom?.id}/assignments/builder/new`)}
                        className="cyber-btn-ring cyber-btn-silver text-xs font-bold transition active:scale-95 cursor-pointer"
                      >
                        <div className="cyber-btn-inner px-3.5 py-1.5 flex items-center space-x-1.5 font-mono">
                          <Plus className="w-3.5 h-3.5 text-white" />
                          <span className="tracking-wide">New Problem</span>
                        </div>
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0A0A0A]/90 backdrop-blur border border-[#262626] p-3 rounded-xl">
                  {/* Search Input */}
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search questions by title, language, or keyword..."
                      value={asgSearchQuery}
                      onChange={(e) => setAsgSearchQuery(e.target.value)}
                      className="w-full bg-[#121212] border border-[#262626] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
                    />
                    {asgSearchQuery && (
                      <button 
                        onClick={() => setAsgSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Difficulty & Status Filters */}
                  <div className="flex items-center space-x-1.5 overflow-x-auto text-xs">
                    {(['all', 'easy', 'medium', 'hard'] as const).map((diff) => (
                      <button
                        key={diff}
                        onClick={() => setAsgDifficultyFilter(diff)}
                        className={`px-3 py-1 rounded-lg font-medium capitalize text-[11px] transition ${
                          asgDifficultyFilter === diff
                            ? 'bg-zinc-800 text-white font-semibold border border-zinc-700'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                        }`}
                      >
                        {diff}
                      </button>
                    ))}
                    {currentUserRole === 'student' && (
                      <div className="border-l border-zinc-800 pl-2 ml-1 flex space-x-1">
                        {(['all', 'solved', 'unsolved'] as const).map((st) => (
                          <button
                            key={st}
                            onClick={() => setAsgStatusFilter(st)}
                            className={`px-2.5 py-1 rounded-lg font-medium capitalize text-[11px] transition ${
                              asgStatusFilter === st
                                ? 'bg-zinc-800 text-white font-semibold border border-zinc-700'
                                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Problem Table / List (LeetCode Style with Seamless Swap) */}
                <div className="bg-[#0A0A0A]/90 backdrop-blur border border-[#262626] rounded-xl overflow-hidden shadow-sm">
                  {/* Table Column Headers */}
                  <div className="flex items-center justify-between px-5 py-3 border-b border-[#262626] text-[11px] font-bold text-zinc-400 uppercase tracking-wider bg-[#0f0f11]">
                    <div className="flex items-center space-x-4">
                      <span className="w-6 text-center">Status</span>
                      <span>Question & Description</span>
                    </div>
                    <div className="flex items-center space-x-6 sm:space-x-8">
                      <span>Difficulty</span>
                      <span className="w-64 text-right pr-2 hidden sm:block">Language / Action</span>
                    </div>
                  </div>

                  {/* Empty State */}
                  {filteredAssignments.length === 0 ? (
                    <div className="py-16 text-center space-y-3">
                      <Code2 className="w-10 h-10 text-zinc-600 mx-auto" />
                      <p className="text-sm font-semibold text-zinc-300">No questions found</p>
                      <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                        {assignments.length === 0
                          ? 'No assignments have been published in this classroom yet.'
                          : 'No questions match your current search and difficulty filters.'}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#1e1e1e]">
                      {filteredAssignments.map((asg, idx) => {
                        const mySub = submissions.find(
                          (s) => s.assignmentId === asg.id && s.studentId === currentUserId
                        );
                        const isSolved = mySub ? (mySub.score >= 70 || mySub.status === 'completed') : false;
                        const isAttempted = !!mySub;

                        const diffLower = asg.difficulty?.toLowerCase();
                        const diffBadgeClass =
                          diffLower === 'easy'
                            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
                            : diffLower === 'hard'
                            ? 'text-rose-400 bg-rose-500/10 border-rose-500/25'
                            : 'text-amber-400 bg-amber-500/10 border-amber-500/25';

                        const daysLeft = Math.round((asg.dueAt - Date.now()) / 86400000);

                        return (
                          <div
                            key={asg.id}
                            onClick={() => router.push(`/classroom/${selectedClassroom?.id}/assignments/${asg.id}/solve`)}
                            className="group flex items-center justify-between px-5 py-3.5 border-b border-[#1e1e1e] last:border-b-0 hover:bg-[#121316] transition-colors duration-150 cursor-pointer hover:border-l-4 hover:border-l-emerald-500"
                          >
                            {/* Left: Status + Title & Description */}
                            <div className="flex items-center space-x-4 min-w-0 pr-4 flex-1">
                              {/* Status Icon */}
                              <div className="w-6 flex items-center justify-center shrink-0">
                                {isSolved ? (
                                  <span title="Solved">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 fill-emerald-500/20" />
                                  </span>
                                ) : isAttempted ? (
                                  <span title={`Attempted (${mySub?.score} pts)`}>
                                    <Clock className="w-4 h-4 text-amber-400" />
                                  </span>
                                ) : (
                                  <div className="w-2.5 h-2.5 rounded-full border border-zinc-600 group-hover:border-zinc-400 transition" />
                                )}
                              </div>

                              {/* Title & Description preview */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center space-x-2">
                                  <span className="text-zinc-500 font-mono text-xs font-semibold">
                                    {idx + 1}.
                                  </span>
                                  <h4 className="text-sm font-bold text-white group-hover:text-emerald-400 transition truncate">
                                    {asg.title}
                                  </h4>
                                </div>
                                <p className="text-[11px] text-zinc-400 truncate mt-0.5 max-w-xl">
                                  {asg.description || asg.instructions}
                                </p>
                              </div>
                            </div>

                            {/* Right: Difficulty + Swap Container */}
                            <div className="flex items-center space-x-6 shrink-0">
                              {/* Difficulty */}
                              <span
                                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border capitalize ${diffBadgeClass}`}
                              >
                                {asg.difficulty || 'Medium'}
                              </span>

                              {/* Swap Container: Metadata when idle -> Buttons when hovering */}
                              <div className="relative w-64 h-8 flex items-center justify-end">
                                {/* Default State: Language, Points, Due Date */}
                                <div className="flex items-center space-x-3 transition-opacity duration-200 group-hover:opacity-0 group-hover:pointer-events-none">
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">
                                    {asg.language.toUpperCase()}
                                  </span>
                                  <span className="text-xs font-mono font-bold text-zinc-300">
                                    {asg.maxMarks} pts
                                  </span>
                                  <span className="text-[10px] text-zinc-500 whitespace-nowrap">
                                    {daysLeft >= 0 ? `Due in ${daysLeft}d` : 'Past due'}
                                  </span>
                                </div>

                                {/* Hover State: Action Buttons (Cortex Cyber Chamfer Style) */}
                                <div className="absolute inset-y-0 right-0 flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-x-2 group-hover:translate-x-0 pointer-events-none group-hover:pointer-events-auto">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      router.push(`/classroom/${selectedClassroom?.id}/assignments/${asg.id}/solve`);
                                    }}
                                    className="cyber-btn-ring cyber-btn-emerald cursor-pointer shrink-0 active:scale-95"
                                    title="Solve Challenge in Cortex IDE"
                                  >
                                    <div className="cyber-btn-inner px-3 py-1 text-xs font-mono font-bold flex items-center space-x-1">
                                      <Play className="w-3 h-3 fill-current" />
                                      <span className="tracking-wider">SOLVE</span>
                                    </div>
                                  </button>

                                  {currentUserRole === 'teacher' && (
                                    <>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          router.push(`/classroom/${selectedClassroom?.id}/submissions`);
                                        }}
                                        className="cyber-btn-ring cyber-btn-silver cursor-pointer shrink-0"
                                        title="Review Submissions"
                                      >
                                        <div className="cyber-btn-inner px-2.5 py-1 text-xs font-mono font-medium">
                                          Submissions
                                        </div>
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          router.push(`/classroom/${selectedClassroom?.id}/assignments/builder/${asg.id}`);
                                        }}
                                        className="cyber-btn-ring cyber-btn-silver cursor-pointer shrink-0"
                                        title="Edit Assignment"
                                      >
                                        <div className="cyber-btn-inner px-2 py-1 text-xs font-mono">
                                          <Edit3 className="w-3 h-3 text-zinc-300" />
                                        </div>
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: Online Examinations */}
            {activeTab === 'examinations' && selectedClassroom && (
              <ExaminationsTab
                classroomId={selectedClassroom.id}
                isTeacher={currentUserRole === 'teacher'}
                currentUser={{
                  id: currentUserId,
                  name: currentUserName,
                  email: currentUserEmail,
                }}
              />
            )}

            {/* TAB: Project Teams & Formation Studio */}
            {activeTab === 'teams' && selectedClassroom && (
              <div className="flex-1 flex flex-col overflow-y-auto p-4 sm:p-6 lg:p-8">
                <TeamsTab
                  classroomId={selectedClassroom.id}
                  currentUserId={currentUserId}
                  currentUserRole={currentUserRole}
                  currentUserName={currentUserName}
                  currentUserEmail={currentUserEmail}
                  getAuthHeaders={getAuthHeaders}
                  showToast={showToast}
                />
              </div>
            )}


            {/* TAB 5: Grades & Feedback */}
            {activeTab === 'grades' && (
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">Submissions & Gradebook</h3>
                    <p className="text-xs text-[#E5E5E5]">
                      Review automated test scores, adjust marks, write detailed student feedback, and release grades.
                    </p>
                  </div>
                  <div className="flex space-x-3">
                    <button 
                      onClick={() => router.push(`/classroom/${selectedClassroom?.id}/submissions`)}
                      className="px-4 py-2 bg-[#0A0A0A] hover:bg-[#212121] text-white text-xs font-semibold rounded transition"
                    >
                      View All Submissions
                    </button>
                    <button 
                      onClick={() => router.push(`/classroom/${selectedClassroom?.id}/grades`)}
                      className="px-4 py-2 bg-[#0A0A0A]/10 hover:bg-[#212121]/20 text-[#FFFFFF] text-xs font-bold rounded transition border border-[#525252]/30"
                    >
                      Open Gradebook Grid
                    </button>
                  </div>
                </div>

                <div className="bg-[#000000] border border-[#525252] rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0A0A0A] border-b border-[#525252] text-[#E5E5E5] uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-3">Student</th>
                        <th className="px-4 py-3">Assignment</th>
                        <th className="px-4 py-3">Language</th>
                        <th className="px-4 py-3">Auto Score</th>
                        <th className="px-4 py-3">Final Grade</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e202b] text-[#E5E5E5]">
                      {submissions.map((sub) => (
                        <tr key={sub.id} className="hover:bg-[#212121] transition">
                          <td className="px-4 py-3 font-semibold text-white">{sub.studentName}</td>
                          <td className="px-4 py-3 text-[#E5E5E5]">{sub.assignmentTitle}</td>
                          <td className="px-4 py-3 font-mono text-[#FFFFFF] text-[11px]">{sub.language}</td>
                          <td className="px-4 py-3 font-mono font-bold text-[#FFFFFF]">{sub.score} / {sub.maxScore}</td>
                          <td className="px-4 py-3 font-mono font-bold text-white">{sub.grade ? `${sub.grade.finalScore} / ${sub.maxScore}` : 'Pending'}</td>
                          <td className="px-4 py-3">
                            {currentUserRole === 'teacher' ? (
                              <button
                                onClick={() => router.push(`/classroom/${selectedClassroom?.id}/submissions/${sub.id}`)}
                                className="px-3 py-1 rounded bg-[#0A0A0A]/20 hover:bg-[#212121] text-[#FFFFFF] hover:text-[#FFFFFF] font-semibold text-xs transition"
                              >
                                Review & Grade
                              </button>
                            ) : (
                              <span className="text-xs text-[#E5E5E5]">Submitted</span>
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
                      <p className="text-xs text-[#E5E5E5]">
                        Syllabus, starter code repositories, lecture slide decks, and reference guides.
                      </p>
                    </div>
                    {currentUserRole === 'teacher' && !isArchived && (
                      <button
                        onClick={() => setIsCreateResourceModalOpen(true)}
                        className="px-4 py-2 rounded-xl bg-[#0A0A0A] text-[#FFFFFF] font-bold text-xs hover:bg-[#212121] transition flex items-center space-x-1"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Resource</span>
                      </button>
                    )}
                  </div>


                <div className="flex flex-col space-y-4 max-w-2xl pb-24">
                  {resources.length === 0 ? (
                    <div className="p-8 text-center bg-[#0A0A0A] border border-[#525252] rounded-xl text-zinc-400 text-xs font-mono">
                      No course resources uploaded yet.
                    </div>
                  ) : (
                    resources.map((res) => (
                      <ResourceBranchingCard
                        key={res.id}
                        resource={res}
                        role={currentUserRole || 'viewer'}
                        onDelete={handleDeleteResource}
                      />
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 7: Leaderboard */}
            {activeTab === 'leaderboard' && (
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                <div className="bg-[#000000] border border-[#525252] rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-[#525252] bg-[#0A0A0A] flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Award className="w-4 h-4 text-[#FFFFFF]" />
                      <span className="text-xs font-bold text-white">Algorithm Mastery Leaderboard</span>
                    </div>
                  </div>

                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0A0A0A] border-b border-[#525252] text-[#E5E5E5] uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-3">Rank</th>
                        <th className="px-4 py-3">Student</th>
                        <th className="px-4 py-3">Total Points</th>
                        <th className="px-4 py-3">Accuracy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e202b] text-[#E5E5E5]">
                      {leaderboard.map((entry) => (
                        <tr key={entry.studentId} className="hover:bg-[#212121] transition">
                          <td className="px-4 py-3 font-bold font-mono">#{entry.rank}</td>
                          <td className="px-4 py-3 font-semibold text-white">{entry.studentName}</td>
                          <td className="px-4 py-3 font-mono font-bold text-[#FFFFFF]">{entry.points} pts</td>
                          <td className="px-4 py-3 font-mono text-[#FFFFFF]">{entry.accuracy}%</td>
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
                <div className="flex items-center justify-between border-b border-[#525252] pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">Classroom Analytics Overview</h3>
                    <p className="text-xs text-[#E5E5E5] mt-1">High-level view of student engagement and performance</p>
                  </div>
                  <button className="px-3 py-1.5 bg-[#0A0A0A] hover:bg-[#212121] text-[#E5E5E5] text-xs font-medium rounded-md border border-[#525252] transition shadow-sm">
                    Export CSV Report
                  </button>
                </div>

                {analytics ? (
                  <div className="space-y-6">
                    {/* Top Level KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="bg-[#000000] border border-[#525252] p-5 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-[#525252] transition">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition">
                          <Users className="w-12 h-12 text-[#FFFFFF]" />
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#E5E5E5] mb-1 z-10">Active Students</span>
                        <div className="flex items-end space-x-2 z-10">
                          <span className="text-3xl font-extrabold text-white tracking-tighter">{analytics.totalStudents}</span>
                        </div>
                      </div>
                      
                      <div className="bg-[#000000] border border-[#525252] p-5 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-[#525252] transition">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition">
                          <CheckCircle2 className="w-12 h-12 text-[#FFFFFF]" />
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#E5E5E5] mb-1 z-10">Average Score</span>
                        <div className="flex items-end space-x-2 z-10">
                          <span className="text-3xl font-extrabold text-white tracking-tighter">{analytics.averageScore}%</span>
                        </div>
                      </div>

                      <div className="bg-[#000000] border border-[#525252] p-5 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-[#525252] transition">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition">
                          <Activity className="w-12 h-12 text-blue-500" />
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#E5E5E5] mb-1 z-10">Completion Rate</span>
                        <div className="flex items-end space-x-2 z-10">
                          <span className="text-3xl font-extrabold text-white tracking-tighter">{analytics.completionRate}%</span>
                        </div>
                      </div>

                      <div className="bg-[#000000] border border-[#525252] p-5 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-[#525252] transition">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition">
                          <AlertTriangle className="w-12 h-12 text-[#FFFFFF]" />
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#E5E5E5] mb-1 z-10">Students At Risk</span>
                        <div className="flex items-end space-x-2 z-10">
                          <span className="text-3xl font-extrabold text-[#FFFFFF] tracking-tighter">{analytics.atRiskCount}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Submissions Trend */}
                      <div className="bg-[#000000] border border-[#525252] rounded-xl overflow-hidden flex flex-col shadow-sm">
                        <div className="p-4 border-b border-[#525252] bg-[#0A0A0A]">
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Recent Submissions Trend</h4>
                        </div>
                        <div className="p-6 flex-1 flex flex-col items-center justify-center min-h-[250px]">
                          {/* Visualization stub */}
                          <div className="w-full flex items-end justify-between h-40 gap-2">
                            {(analytics.recentTrend || []).map((val, i) => (
                              <div key={i} className="w-full bg-[#0A0A0A] rounded-t-sm relative group transition-all duration-300 hover:bg-[#212121]" style={{ height: '100%' }}>
                                <div 
                                  className="absolute bottom-0 w-full bg-[#0A0A0A] rounded-t-sm opacity-80 group-hover:opacity-100 transition-all duration-300"
                                  style={{ height: `${val}%` }}
                                ></div>
                              </div>
                            ))}
                          </div>
                          <div className="w-full flex justify-between text-[10px] text-[#E5E5E5] font-mono mt-3 uppercase tracking-widest">
                            <span>2W Ago</span>
                            <span>Today</span>
                          </div>
                        </div>
                      </div>

                      {/* Active Submissions List */}
                      <div className="bg-[#000000] border border-[#525252] rounded-xl overflow-hidden flex flex-col shadow-sm">
                        <div className="p-4 border-b border-[#525252] bg-[#0A0A0A]">
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Top Performing Students</h4>
                        </div>
                        <div className="p-0 overflow-y-auto max-h-[300px]">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-[#0A0A0A] border-b border-[#525252] text-[#E5E5E5] uppercase tracking-wider text-[10px] sticky top-0">
                              <tr>
                                <th className="px-5 py-3 font-semibold">Student Name</th>
                                <th className="px-5 py-3 font-semibold text-right">Avg Score</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1e202b] text-[#E5E5E5]">
                              {leaderboard.slice(0, 5).map((l, i) => (
                                <tr key={l.studentId} className="hover:bg-[#212121] transition group">
                                  <td className="px-5 py-3 font-medium flex items-center space-x-3">
                                    <span className="w-5 h-5 rounded-full bg-[#0A0A0A] flex items-center justify-center text-[9px] font-bold text-[#E5E5E5] group-hover:text-[#FFFFFF] transition">
                                      {i + 1}
                                    </span>
                                    <span>{l.studentName}</span>
                                  </td>
                                  <td className="px-5 py-3 font-mono font-bold text-[#FFFFFF] text-right">{l.accuracy}%</td>
                                </tr>
                              ))}
                              {leaderboard.length === 0 && (
                                <tr>
                                  <td colSpan={2} className="px-5 py-8 text-center text-[#E5E5E5] italic">No student performance data available yet.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-[#E5E5E5]">
                    <BarChart2 className="w-12 h-12 mb-4 opacity-20" />
                    <p>Analytics data is not yet available for this classroom.</p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 8: Settings (Teacher only) */}
            {activeTab === 'settings' && currentUserRole === 'teacher' && (
              <div className="flex-1 p-6 overflow-y-auto space-y-6 max-w-4xl">
                <div className="border-b border-[#525252] pb-4">
                  <h3 className="text-base font-bold text-white">Classroom Settings & Governance</h3>
                  <p className="text-xs text-[#E5E5E5]">
                    Configure classroom details, manage join codes, configure student interaction privileges, and manage lifecycle.
                  </p>
                </div>

                <form onSubmit={handleSaveSettings} className="space-y-6">
                  {/* General Configuration */}
                  <div className="neon-glass rounded-2xl p-5 space-y-4">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-[#FFFFFF]" />
                      <span>General Information</span>
                    </h4>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1">
                        <label className="text-[#E5E5E5] font-medium">Classroom Name:</label>
                        <input
                          type="text"
                          required
                          value={settingsForm.name}
                          onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                          className="w-full bg-[#0A0A0A] border border-[#525252] rounded-lg px-3 py-2 text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[#E5E5E5] font-medium">Course Code:</label>
                        <input
                          type="text"
                          required
                          value={settingsForm.coursecode}
                          onChange={(e) => setSettingsForm({ ...settingsForm, coursecode: e.target.value })}
                          className="w-full bg-[#0A0A0A] border border-[#525252] rounded-lg px-3 py-2 text-white font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[#E5E5E5] font-medium">Section:</label>
                        <input
                          type="text"
                          value={settingsForm.section}
                          onChange={(e) => setSettingsForm({ ...settingsForm, section: e.target.value })}
                          className="w-full bg-[#0A0A0A] border border-[#525252] rounded-lg px-3 py-2 text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[#E5E5E5] font-medium">Subject / Department:</label>
                        <input
                          type="text"
                          value={settingsForm.subject}
                          onChange={(e) => setSettingsForm({ ...settingsForm, subject: e.target.value })}
                          className="w-full bg-[#0A0A0A] border border-[#525252] rounded-lg px-3 py-2 text-white"
                        />
                      </div>
                    </div>

                    <div className="space-y-1 text-xs">
                      <label className="text-[#E5E5E5] font-medium">Description:</label>
                      <textarea
                        rows={2}
                        value={settingsForm.description}
                        onChange={(e) => setSettingsForm({ ...settingsForm, description: e.target.value })}
                        className="w-full bg-[#0A0A0A] border border-[#525252] rounded-lg px-3 py-2 text-white resize-none"
                      />
                    </div>
                  </div>

                  {/* Enrollment & Code Controls */}
                  <div className="neon-glass rounded-2xl p-5 space-y-4">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                      <Users className="w-3.5 h-3.5 text-[#FFFFFF]" />
                      <span>Joining & Enrollment</span>
                    </h4>

                    <div className="flex items-center justify-between p-3.5 bg-[#0A0A0A] rounded-xl text-xs">
                      <div>
                        <div className="font-semibold text-white">Active Join Code</div>
                        <div className="text-[#E5E5E5] text-[11px]">Students use this code to enroll in your class</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-base font-bold text-[#FFFFFF] px-3 py-1 bg-[#000000] border border-[#525252] rounded-lg">
                          {selectedClassroom.joincode}
                        </span>
                        <button
                          type="button"
                          onClick={handleRegenerateCode}
                          className="px-3 py-1.5 rounded-lg bg-[#0A0A0A] hover:bg-[#212121] text-[#FFFFFF] text-xs transition flex items-center space-x-1"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Regenerate Code</span>
                        </button>
                      </div>
                    </div>

                    <label className="flex items-center justify-between p-3.5 bg-[#0A0A0A] rounded-xl text-xs cursor-pointer">
                      <div>
                        <div className="font-semibold text-white">Enable Student Self-Joining</div>
                        <div className="text-[#E5E5E5] text-[11px]">When disabled, new students cannot join even with the code</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settingsForm.joinEnabled}
                        onChange={(e) => setSettingsForm({ ...settingsForm, joinEnabled: e.target.checked })}
                        className="w-4 h-4 rounded bg-[#000000] border-[#525252] text-[#FFFFFF] focus:ring-0"
                      />
                    </label>
                  </div>

                  {/* Permissions & Communication Policy */}
                  <div className="neon-glass rounded-2xl p-5 space-y-4">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                      <Shield className="w-3.5 h-3.5 text-[#FFFFFF]" />
                      <span>Communication & Privacy Controls</span>
                    </h4>

                    <div className="space-y-2 text-xs">
                      <label className="flex items-center justify-between p-3.5 bg-[#0A0A0A] rounded-xl cursor-pointer">
                        <div>
                          <div className="font-semibold text-white">Allow Student Announcements / Posting</div>
                          <div className="text-[#E5E5E5] text-[11px]">Allow students to publish posts to the class stream</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={settingsForm.allowStudentPosting}
                          onChange={(e) => setSettingsForm({ ...settingsForm, allowStudentPosting: e.target.checked })}
                          className="w-4 h-4 rounded bg-[#000000] border-[#525252] text-[#FFFFFF] focus:ring-0"
                        />
                      </label>

                      <label className="flex items-center justify-between p-3.5 bg-[#0A0A0A] rounded-xl cursor-pointer">
                        <div>
                          <div className="font-semibold text-white">Allow Student-to-Student Direct Messaging</div>
                          <div className="text-[#E5E5E5] text-[11px]">Enforce DM privacy while preserving teacher oversight</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={settingsForm.allowStudentMessaging}
                          onChange={(e) => setSettingsForm({ ...settingsForm, allowStudentMessaging: e.target.checked })}
                          className="w-4 h-4 rounded bg-[#000000] border-[#525252] text-[#FFFFFF] focus:ring-0"
                        />
                      </label>

                      <label className="flex items-center justify-between p-3.5 bg-[#0A0A0A] rounded-xl cursor-pointer">
                        <div>
                          <div className="font-semibold text-white">Broadcast Real-time Presence Indicators</div>
                          <div className="text-[#E5E5E5] text-[11px]">Show green active dots next to online classmates</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={settingsForm.presenceVisibility}
                          onChange={(e) => setSettingsForm({ ...settingsForm, presenceVisibility: e.target.checked })}
                          className="w-4 h-4 rounded bg-[#000000] border-[#525252] text-[#FFFFFF] focus:ring-0"
                        />
                      </label>

                      <label className="flex items-center justify-between p-3.5 bg-[#0A0A0A] rounded-xl cursor-pointer">
                        <div>
                          <div className="font-semibold text-white">Show Full Student Roster to Class</div>
                          <div className="text-[#E5E5E5] text-[11px]">Students can browse other members in the People tab</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={settingsForm.memberVisibility}
                          onChange={(e) => setSettingsForm({ ...settingsForm, memberVisibility: e.target.checked })}
                          className="w-4 h-4 rounded bg-[#000000] border-[#525252] text-[#FFFFFF] focus:ring-0"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button
                      type="submit"
                      disabled={isSavingSettings}
                      className="px-6 py-2.5 rounded-xl bg-[#0A0A0A] hover:bg-[#212121] text-[#FFFFFF] font-bold text-xs shadow-lg transition"
                    >
                      {isSavingSettings ? 'Broadcasting Settings...' : 'Save & Broadcast Changes'}
                    </button>
                  </div>
                </form>

                {/* Danger Zone: Archive Classroom */}
                <div className="neon-glass rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-[#FFFFFF] uppercase tracking-wider">Classroom Lifecycle & Archive</h4>
                      <p className="text-xs text-[#E5E5E5]">
                        Archiving freezes all student postings, messaging, and joins while keeping historical submissions and grades safe.
                      </p>
                    </div>
                    {!isArchived ? (
                      <button
                        onClick={() => setIsConfirmArchiveOpen(true)}
                        className="silver-motion-ring rounded-xl text-rose-400 hover:text-white font-bold text-xs transition"
                      >
                        <div className="silver-motion-inner px-4 py-2 space-x-2 flex items-center">
                          <Archive className="w-3.5 h-3.5" />
                          <span>Archive Classroom</span>
                        </div>
                      </button>
                    ) : (
                      <div className="flex items-center space-x-3">
                        <span className="px-3 py-1.5 rounded-xl bg-gray-800 text-[#E5E5E5] text-xs font-semibold">
                          Already Archived
                        </span>
                        {currentUserRole === 'teacher' && (
                          <button
                            onClick={() => setIsConfirmDeleteOpen(true)}
                            className="silver-motion-ring rounded-xl text-rose-400 hover:text-white font-bold text-xs transition"
                          >
                            <div className="silver-motion-inner px-4 py-2 space-x-2 flex items-center bg-rose-900/50">
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete Classroom</span>
                            </div>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </main>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[#E5E5E5] p-8 text-center space-y-4">
            <Users className="w-12 h-12 text-[#FFFFFF]" />
            <h3 className="text-lg font-bold text-white">No Classroom Selected</h3>
            <p className="text-xs max-w-sm text-[#E5E5E5] leading-relaxed">
              Select an existing classroom on the left sidebar, or create/join a new one to access assignments, real-time chats, and automated test grading.
            </p>
          </div>
        )}
      </div>

        </div>
      {/* Modal: Create Classroom */}
      {isCreateClassModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="neon-glass rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#525252] pb-3">
              <h4 className="text-sm font-bold text-white">Create New Classroom</h4>
              <button onClick={() => setIsCreateClassModalOpen(false)} className="text-[#E5E5E5] hover:text-white">✕</button>
            </div>
            <form onSubmit={handleCreateClassroom} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[#E5E5E5] font-medium">Classroom Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distributed Systems & Concurrency"
                  value={createClassForm.name}
                  onChange={(e) => setCreateClassForm({ ...createClassForm, name: e.target.value })}
                  className="w-full bg-[#0A0A0A] border border-[#525252] rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[#E5E5E5] font-medium">Course Code:</label>
                  <input
                    type="text"
                    value={createClassForm.coursecode}
                    onChange={(e) => setCreateClassForm({ ...createClassForm, coursecode: e.target.value })}
                    className="w-full bg-[#0A0A0A] border border-[#525252] rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[#E5E5E5] font-medium">Section:</label>
                  <input
                    type="text"
                    value={createClassForm.section}
                    onChange={(e) => setCreateClassForm({ ...createClassForm, section: e.target.value })}
                    className="w-full bg-[#0A0A0A] border border-[#525252] rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[#E5E5E5] font-medium">Description:</label>
                <textarea
                  rows={2}
                  value={createClassForm.description}
                  onChange={(e) => setCreateClassForm({ ...createClassForm, description: e.target.value })}
                  placeholder="Overview of syllabus, prerequisites, and goals..."
                  className="w-full bg-[#0A0A0A] border border-[#525252] rounded-lg px-3 py-2 text-white resize-none"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateClassModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#0A0A0A] text-[#E5E5E5] hover:bg-[#212121]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="silver-motion-ring rounded-lg text-white font-bold transition"
                >
                  <div className="silver-motion-inner px-5 py-2">
                    Create Classroom
                  </div>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Join Classroom with Code */}
      {isJoinClassModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="neon-glass rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#525252] pb-3">
              <h4 className="text-sm font-bold text-white">Join Classroom with Code</h4>
              <button onClick={() => setIsJoinClassModalOpen(false)} className="text-[#E5E5E5] hover:text-white">✕</button>
            </div>
            <form onSubmit={handleJoinClassroom} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[#E5E5E5] font-medium">Enter 6-8 digit Classroom Code:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CS201-LIVE"
                  value={joincodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  className="w-full bg-[#0A0A0A] border border-[#525252] rounded-lg px-3 py-2 text-white font-mono text-center tracking-widest uppercase text-sm"
                />
              </div>
              <p className="text-[11px] text-[#E5E5E5]">
                Ask your instructor for the classroom join code or link.
              </p>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsJoinClassModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#0A0A0A] text-[#E5E5E5] hover:bg-[#212121]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="silver-motion-ring rounded-lg text-cyan-300 hover:text-white font-bold transition"
                >
                  <div className="silver-motion-inner px-5 py-2">
                    Join Class
                  </div>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Announcement */}
      {editingAnnouncement && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="neon-glass rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#525252] pb-3">
              <h4 className="text-sm font-bold text-white">Edit Announcement</h4>
              <button onClick={() => setEditingAnnouncement(null)} className="text-[#E5E5E5] hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSaveEditAnnouncement} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[#E5E5E5] font-medium">Title:</label>
                <input
                  type="text"
                  required
                  value={editAnnTitle}
                  onChange={(e) => setEditAnnTitle(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#525252] rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[#E5E5E5] font-medium">Content:</label>
                <textarea
                  rows={4}
                  required
                  value={editAnnContent}
                  onChange={(e) => setEditAnnContent(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#525252] rounded-lg px-3 py-2 text-white resize-none"
                />
              </div>
              <label className="flex items-center space-x-2 text-xs text-[#E5E5E5] cursor-pointer">
                <input
                  type="checkbox"
                  checked={editAnnPinned}
                  onChange={(e) => setEditAnnPinned(e.target.checked)}
                  className="rounded bg-[#0A0A0A] border-[#525252] text-[#FFFFFF] focus:ring-0"
                />
                <span>Pin to top of stream</span>
              </label>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingAnnouncement(null)}
                  className="px-4 py-2 rounded-lg bg-[#0A0A0A] text-[#E5E5E5] hover:bg-[#212121]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#0A0A0A] text-[#FFFFFF] font-bold hover:bg-[#212121]"
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
          <div className="neon-glass rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center space-x-3 text-[#FFFFFF]">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h4 className="text-sm font-bold text-white">Delete Announcement?</h4>
            </div>
            <p className="text-xs text-[#E5E5E5]">
              Are you sure you want to delete &ldquo;{annToDelete.title}&rdquo;? This will be removed from all student streams immediately.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setAnnToDelete(null)}
                className="px-4 py-2 rounded-lg bg-[#0A0A0A] text-[#E5E5E5] hover:bg-[#212121] text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAnnouncement}
                className="danger-motion-ring rounded-lg text-rose-400 hover:text-rose-200 font-bold text-xs"
              >
                <div className="silver-motion-inner px-5 py-2">
                  Delete
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Remove Student */}
      {memberToRemove && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="neon-glass rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center space-x-3 text-[#FFFFFF]">
              <UserMinus className="w-5 h-5 shrink-0" />
              <h4 className="text-sm font-bold text-white">Remove Student?</h4>
            </div>
            <p className="text-xs text-[#E5E5E5] leading-relaxed">
              Are you sure you want to remove <strong className="text-white">{memberToRemove.userName}</strong> from {selectedClassroom?.name}? Their access will be revoked immediately.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setMemberToRemove(null)}
                className="px-4 py-2 rounded-lg bg-[#0A0A0A] text-[#E5E5E5] hover:bg-[#212121] text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveMember}
                className="danger-motion-ring rounded-lg text-rose-400 hover:text-rose-200 font-bold text-xs"
              >
                <div className="silver-motion-inner px-5 py-2">
                  Confirm Removal
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Archive Classroom */}
      {isConfirmArchiveOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="neon-glass rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center space-x-3 text-[#FFFFFF]">
              <Archive className="w-5 h-5 shrink-0" />
              <h4 className="text-sm font-bold text-white">Archive &ldquo;{selectedClassroom?.name}&rdquo;?</h4>
            </div>
            <p className="text-xs text-[#E5E5E5] leading-relaxed">
              Archiving locks the classroom into permanent read-only mode. Students can view historical grades and assignments, but no new posts, messages, or enrollments will be accepted.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setIsConfirmArchiveOpen(false)}
                className="px-4 py-2 rounded-lg bg-[#0A0A0A] text-[#E5E5E5] hover:bg-[#212121] text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleArchiveClassroom}
                className="danger-motion-ring rounded-lg text-rose-400 hover:text-rose-200 font-bold text-xs"
              >
                <div className="silver-motion-inner px-5 py-2">
                  Confirm Archive
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Classroom */}
      {isConfirmDeleteOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="neon-glass rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center space-x-3 text-rose-500">
              <Trash2 className="w-5 h-5 shrink-0" />
              <h4 className="text-sm font-bold">Permanently Delete &ldquo;{selectedClassroom?.name}&rdquo;?</h4>
            </div>
            <p className="text-xs text-[#E5E5E5] leading-relaxed">
              This action is <span className="font-bold text-rose-400">irreversible</span>. It will permanently delete this classroom, all its assignments, student submissions, grades, and resources. You cannot undo this.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setIsConfirmDeleteOpen(false)}
                className="px-4 py-2 rounded-lg bg-[#0A0A0A] text-[#E5E5E5] hover:bg-[#212121] text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteClassroom}
                className="danger-motion-ring rounded-lg text-rose-500 hover:text-white font-bold text-xs"
              >
                <div className="silver-motion-inner px-5 py-2 bg-rose-900/50">
                  Delete Permanently
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Publish Assignment */}
      {isCreateAsgModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="neon-glass rounded-2xl p-6 max-w-xl w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#525252] pb-3">
              <h4 className="text-sm font-bold text-white">Publish New Assignment</h4>
              <button onClick={() => setIsCreateAsgModalOpen(false)} className="text-[#E5E5E5] hover:text-white">✕</button>
            </div>
            <form onSubmit={handleCreateAssignment} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[#E5E5E5] font-medium">Assignment Title:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dynamic Programming: Coin Change Problem"
                  value={createAsgForm.title}
                  onChange={(e) => setCreateAsgForm({ ...createAsgForm, title: e.target.value })}
                  className="w-full bg-[#0A0A0A] border border-[#525252] rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[#E5E5E5] font-medium">Language:</label>
                  <select
                    value={createAsgForm.language}
                    onChange={(e) => setCreateAsgForm({ ...createAsgForm, language: e.target.value })}
                    className="w-full bg-[#0A0A0A] border border-[#525252] rounded-lg px-3 py-2 text-white"
                  >
                    <option value="python">Python 3.12</option>
                    <option value="cpp">C++ 20</option>
                    <option value="typescript">TypeScript</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[#E5E5E5] font-medium">Difficulty:</label>
                  <select
                    value={createAsgForm.difficulty}
                    onChange={(e) => setCreateAsgForm({ ...createAsgForm, difficulty: e.target.value })}
                    className="w-full bg-[#0A0A0A] border border-[#525252] rounded-lg px-3 py-2 text-white"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[#E5E5E5] font-medium">Instructions & Constraints:</label>
                <textarea
                  rows={3}
                  value={createAsgForm.instructions}
                  onChange={(e) => setCreateAsgForm({ ...createAsgForm, instructions: e.target.value })}
                  placeholder="Explain requirements, time complexity O(N), etc..."
                  className="w-full bg-[#0A0A0A] border border-[#525252] rounded-lg px-3 py-2 text-white resize-none"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateAsgModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#0A0A0A] text-[#E5E5E5] hover:bg-[#212121]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#0A0A0A] text-[#FFFFFF] font-bold hover:bg-[#212121]"
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
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-[#0A0A0A] border border-[#525252]/50 text-white text-xs shadow-2xl flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Sparkles className="w-3.5 h-3.5 text-[#FFFFFF]" />
          <span>{toastMessage}</span>
        </div>
      )}
      </div>
    </div>
  );
}

