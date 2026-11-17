'use client';

import React, { useState, useMemo } from 'react';
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  X, 
  FileText, 
  Award, 
  CheckCircle, 
  Megaphone, 
  UserPlus, 
  Sparkles,
  ExternalLink,
  Filter
} from 'lucide-react';
import { Notification } from '@/lib/classroom/models';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onDeleteNotification: (id: string) => void;
  onClearAll: () => void;
  onSelectNotification?: (notification: Notification) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  notifications = [],
  onMarkAllRead,
  onMarkRead,
  onDeleteNotification,
  onClearAll,
  onSelectNotification,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const safeNotifications = useMemo(() => Array.isArray(notifications) ? notifications : [], [notifications]);

  const unreadCount = useMemo(() => {
    return safeNotifications.filter((n) => !n?.readAt).length;
  }, [safeNotifications]);

  const filteredNotifications = useMemo(() => {
    if (filter === 'unread') {
      return safeNotifications.filter((n) => !n?.readAt);
    }
    return safeNotifications;
  }, [safeNotifications, filter]);

  if (!isOpen) return null;

  const formatRelativeTime = (timestamp: number) => {
    if (!timestamp) return '';
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const getCategoryMeta = (type: Notification['type']) => {
    switch (type) {
      case 'assignment_new':
      case 'assignment_deadline':
        return {
          icon: FileText,
          color: 'text-amber-400',
          bg: 'bg-amber-500/10 border-amber-500/30',
          badge: 'Assignment',
        };
      case 'exam_published':
      case 'session_started':
        return {
          icon: Award,
          color: 'text-purple-400',
          bg: 'bg-purple-500/10 border-purple-500/30',
          badge: 'Exam',
        };
      case 'grade_released':
      case 'feedback_added':
        return {
          icon: CheckCircle,
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/10 border-emerald-500/30',
          badge: 'Grading',
        };
      case 'announcement':
        return {
          icon: Megaphone,
          color: 'text-sky-400',
          bg: 'bg-sky-500/10 border-sky-500/30',
          badge: 'Announce',
        };
      case 'enrollment':
      case 'system':
      default:
        return {
          icon: UserPlus,
          color: 'text-cyan-400',
          bg: 'bg-cyan-500/10 border-cyan-500/30',
          badge: 'Classroom',
        };
    }
  };

  return (
    <div className="absolute right-0 top-12 w-[380px] sm:w-[420px] max-w-[calc(100vw-2rem)] bg-[#0d0e13]/95 backdrop-blur-xl border border-[#242732] rounded-2xl shadow-2xl shadow-black/80 z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      {/* Top Accent Line */}
      <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-[#FF9100] to-transparent" />

      {/* Header */}
      <div className="p-4 border-b border-[#1f222c] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#FF9100]/10 border border-[#FF9100]/30 flex items-center justify-center text-[#FF9100]">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FF9100] text-black">
                  {unreadCount} New
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-400">Activity and course updates</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a1c24] transition text-xs flex items-center gap-1"
              title="Mark all as read"
            >
              <CheckCheck className="w-4 h-4 text-emerald-400" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a1c24] transition"
            title="Close notifications"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 py-2 bg-[#121319] border-b border-[#1f222c] flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 bg-[#0a0b0e] p-0.5 rounded-lg border border-[#20222a]">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
              filter === 'all'
                ? 'bg-[#1e2029] text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            All ({safeNotifications.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
              filter === 'unread'
                ? 'bg-[#1e2029] text-[#FF9100] shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {safeNotifications.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-[11px] text-gray-400 hover:text-rose-400 transition flex items-center gap-1"
            title="Clear all notifications"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear all</span>
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="max-h-[380px] overflow-y-auto divide-y divide-[#181a22]">
        {filteredNotifications.length === 0 ? (
          <div className="py-12 px-6 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#161820] border border-[#262834] flex items-center justify-center text-gray-500">
              <Sparkles className="w-6 h-6 text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-300">
                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              </p>
              <p className="text-xs text-gray-500 mt-1 max-w-xs">
                {filter === 'unread'
                  ? "You've caught up with all your course and platform updates."
                  : 'New announcements, assignments, and examination events will appear here.'}
              </p>
            </div>
          </div>
        ) : (
          filteredNotifications.map((notif) => {
            const isUnread = !notif.readAt;
            const category = getCategoryMeta(notif.type);
            const CategoryIcon = category.icon;

            return (
              <div
                key={notif.id}
                onClick={() => {
                  if (isUnread) onMarkRead(notif.id);
                  if (onSelectNotification) onSelectNotification(notif);
                }}
                className={`p-3.5 flex items-start gap-3 transition cursor-pointer group relative ${
                  isUnread
                    ? 'bg-[#14161f]/80 hover:bg-[#181b26]'
                    : 'bg-transparent hover:bg-[#13141a]'
                }`}
              >
                {/* Unread Accent Indicator */}
                {isUnread && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF9100] absolute top-4 left-1.5 shadow-sm shadow-[#FF9100]" />
                )}

                {/* Category Icon */}
                <div
                  className={`w-9 h-9 rounded-xl border shrink-0 flex items-center justify-center ${category.bg} ${category.color} transition transform group-hover:scale-105`}
                >
                  <CategoryIcon className="w-4 h-4" />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 pr-1">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${category.bg} ${category.color}`}
                    >
                      {category.badge}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {formatRelativeTime(notif.createdAt)}
                    </span>
                  </div>

                  <h4
                    className={`text-xs font-semibold leading-snug line-clamp-1 ${
                      isUnread ? 'text-white' : 'text-gray-300'
                    }`}
                  >
                    {notif.title}
                  </h4>

                  <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">
                    {notif.message}
                  </p>

                  {/* Context action tags */}
                  {notif.data && (notif.data.assignmentId || notif.data.examId) && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-[#FF9100] font-semibold">
                      <span>View details</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </div>
                  )}
                </div>

                {/* Individual Action Dismiss Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteNotification(notif.id);
                  }}
                  className="p-1 rounded text-gray-600 hover:text-rose-400 hover:bg-rose-950/30 opacity-0 group-hover:opacity-100 transition"
                  title="Dismiss notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-2.5 bg-[#0a0b0e] border-t border-[#1f222c] text-center">
        <span className="text-[10px] text-gray-500">
          Cortex Real-time Notification Engine • Synced
        </span>
      </div>
    </div>
  );
};
