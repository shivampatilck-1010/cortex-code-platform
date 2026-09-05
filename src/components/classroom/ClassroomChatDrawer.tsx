'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare, 
  Send, 
  Megaphone, 
  X, 
  Crown, 
  User, 
  Sparkles,
  Smile,
  Bell
} from 'lucide-react';
import { ChatMessage, ClassroomRole } from '@/lib/classroom/types';

interface ClassroomChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  currentUserId: string;
  currentUserName?: string;
  currentUserRole: ClassroomRole;
  onSendMessage: (text: string, isAnnouncement?: boolean) => void;
}

const QUICK_EMOJIS = ['👍', '🔥', '🚀', '❤️', '👏', '💡', '❓', '🎉'];

export const ClassroomChatDrawer: React.FC<ClassroomChatDrawerProps> = ({
  isOpen,
  onClose,
  messages = [],
  currentUserId,
  currentUserName,
  currentUserRole,
  onSendMessage,
}) => {
  const [text, setText] = useState('');
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'announcements'>('all');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom whenever new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen, activeTab]);

  if (!isOpen) return null;

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text.trim(), isAnnouncement);
    setText('');
    setIsAnnouncement(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickEmoji = (emoji: string) => {
    onSendMessage(emoji, false);
  };

  const filteredMessages = activeTab === 'announcements'
    ? messages.filter((m) => m.isAnnouncement)
    : messages;

  const announcementCount = messages.filter((m) => m.isAnnouncement).length;

  return (
    <div className="w-80 sm:w-96 h-full bg-[#0e0f13] border-l border-[#1f2029] flex flex-col z-20 select-none shadow-2xl flex-shrink-0 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="h-12 px-3.5 bg-[#121318] border-b border-[#1f2029] flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#ff9100]/10 border border-[#ff9100]/30 flex items-center justify-center text-[#ff9100]">
            <MessageSquare className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-heading font-bold text-xs text-gray-100">Classroom Chat</span>
              <span className="px-1.5 py-0.2 rounded-full bg-[#1b1d25] text-[10px] font-mono text-gray-400 border border-[#272935]">
                {messages.length}
              </span>
            </div>
          </div>
        </div>

        <button 
          onClick={onClose} 
          className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-[#1a1c24] transition"
          title="Close Chat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs Filter */}
      <div className="flex border-b border-[#1b1d25] bg-[#111217] text-[11px] font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`flex-1 py-2 text-center transition flex items-center justify-center space-x-1 ${
            activeTab === 'all'
              ? 'text-[#ff9100] border-b-2 border-[#ff9100] bg-[#15161c] font-bold'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <span>All Messages</span>
          <span className="text-[10px] opacity-70">({messages.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('announcements')}
          className={`flex-1 py-2 text-center transition flex items-center justify-center space-x-1.5 ${
            activeTab === 'announcements'
              ? 'text-amber-400 border-b-2 border-amber-400 bg-[#15161c] font-bold'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Megaphone className="w-3 h-3 text-amber-400" />
          <span>Announcements</span>
          {announcementCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[9px] font-bold">
              {announcementCount}
            </span>
          )}
        </button>
      </div>

      {/* Messages Stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs custom-scrollbar">
        {filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-2 text-gray-500">
            <div className="w-10 h-10 rounded-full bg-[#181920] border border-[#262834] flex items-center justify-center text-gray-400">
              <MessageSquare className="w-5 h-5 opacity-40" />
            </div>
            <p className="text-xs font-medium text-gray-400">
              {activeTab === 'announcements' ? 'No announcements posted yet.' : 'No messages yet.'}
            </p>
            <p className="text-[11px] text-gray-600">
              {activeTab === 'announcements'
                ? 'Admin announcements will be pinned here.'
                : 'Say hello or ask questions to start collaborating!'}
            </p>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isSelf =
              msg.senderId === currentUserId ||
              (currentUserName && msg.senderName.trim().toLowerCase() === currentUserName.trim().toLowerCase());
            const isAdmin = msg.role === 'admin';
            const isSystem = msg.senderName.toLowerCase() === 'system' || msg.senderId === 'system';

            // Announcement Card
            if (msg.isAnnouncement) {
              return (
                <div
                  key={msg.id}
                  className="p-3 rounded-xl bg-gradient-to-r from-amber-950/40 to-amber-900/20 border border-amber-500/30 text-amber-200 space-y-1.5 shadow-sm"
                >
                  <div className="flex items-center justify-between text-[10px] text-amber-400/80">
                    <span className="font-heading font-bold flex items-center space-x-1.5 text-amber-300">
                      <Megaphone className="w-3 h-3 text-amber-400" />
                      <span>{msg.senderName}</span>
                      {isAdmin && <Crown className="w-3 h-3 text-amber-400" />}
                      <span className="px-1 py-0.2 rounded bg-amber-500/20 text-[9px] font-bold text-amber-300">
                        ANNOUNCEMENT
                      </span>
                    </span>
                    <span className="font-mono opacity-70">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="leading-relaxed whitespace-pre-wrap select-text text-amber-100 font-medium text-xs">
                    {msg.text}
                  </p>
                </div>
              );
            }

            // Normal Message
            return (
              <div
                key={msg.id}
                className={`flex space-x-2.5 ${isSelf ? 'justify-end' : 'justify-start'}`}
              >
                {!isSelf && (
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5 ${
                      isSystem
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : isAdmin
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
                        : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    }`}
                  >
                    {isAdmin ? <Crown className="w-3.5 h-3.5" /> : msg.senderName.slice(0, 2).toUpperCase()}
                  </div>
                )}

                <div className={`space-y-1 max-w-[85%] ${isSelf ? 'items-end' : 'items-start'}`}>
                  {/* Sender Header */}
                  <div className={`flex items-center space-x-1.5 text-[10px] ${isSelf ? 'justify-end text-gray-400' : 'text-gray-400'}`}>
                    <span className="font-heading font-semibold text-gray-300 flex items-center space-x-1">
                      <span>{msg.senderName}</span>
                      {isAdmin && <Crown className="w-2.5 h-2.5 text-amber-400" />}
                      {isSelf && (
                        <span className="px-1 rounded bg-[#ff9100]/20 text-[#ff9100] text-[9px] font-bold">
                          You
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-[9.5px] opacity-60">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`p-2.5 rounded-xl leading-relaxed whitespace-pre-wrap select-text text-xs ${
                      isSelf
                        ? 'bg-[#1e2330] border border-[#2f3547] text-gray-100 rounded-tr-none shadow-sm'
                        : 'bg-[#15171e] border border-[#21242e] text-gray-200 rounded-tl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Reaction Bar */}
      <div className="px-3 py-1.5 bg-[#121319] border-t border-[#1b1d25] flex items-center space-x-1 overflow-x-auto no-scrollbar">
        <span className="text-[10px] text-gray-500 mr-1 flex items-center">
          <Smile className="w-3 h-3 mr-0.5" />
        </span>
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => handleQuickEmoji(emoji)}
            className="px-1.5 py-0.5 rounded hover:bg-[#1f212a] text-xs transition transform hover:scale-110 active:scale-95"
            title={`Send ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <form onSubmit={handleSend} className="p-3 bg-[#111217] border-t border-[#1f2029] space-y-2">
        {currentUserRole === 'admin' && (
          <div className="flex items-center justify-between">
            <label className="flex items-center space-x-1.5 text-[10.5px] text-amber-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAnnouncement}
                onChange={(e) => setIsAnnouncement(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-[#ff9100]"
              />
              <Megaphone className="w-3 h-3 text-amber-400" />
              <span className="font-semibold">Broadcast as Announcement</span>
            </label>
            {isAnnouncement && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">
                PINNED
              </span>
            )}
          </div>
        )}

        <div className="flex items-end space-x-2">
          <div className="flex-1 bg-[#171821] border border-[#272a38] focus-within:border-[#ff9100] rounded-xl px-3 py-1.5 transition">
            <textarea
              ref={inputRef}
              rows={2}
              placeholder={isAnnouncement ? 'Type classroom announcement...' : 'Type a message (Enter to send)...'}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent text-xs text-gray-100 placeholder-gray-500 focus:outline-none resize-none leading-normal"
            />
          </div>

          <button
            type="submit"
            disabled={!text.trim()}
            className={`p-2.5 rounded-xl font-bold transition flex items-center justify-center flex-shrink-0 ${
              text.trim()
                ? isAnnouncement
                  ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-md'
                  : 'bg-[#ff9100] hover:bg-[#e08000] text-black shadow-md'
                : 'bg-[#1f212a] text-gray-600 cursor-not-allowed'
            }`}
            title="Send Message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between text-[10px] text-gray-500 px-0.5">
          <span>
            Chatting as <strong className="text-gray-300 font-medium">{currentUserName || 'You'}</strong>
            {currentUserRole === 'admin' ? ' (Admin)' : ' (Student)'}
          </span>
          <span className="hidden sm:inline text-gray-600">Shift+Enter for new line</span>
        </div>
      </form>
    </div>
  );
};
