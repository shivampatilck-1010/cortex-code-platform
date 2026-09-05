'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Megaphone, X, Crown } from 'lucide-react';
import { ChatMessage, ClassroomRole } from '@/lib/classroom/types';

interface ClassroomChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  currentUserId: string;
  currentUserRole: ClassroomRole;
  onSendMessage: (text: string, isAnnouncement?: boolean) => void;
}

export const ClassroomChatDrawer: React.FC<ClassroomChatDrawerProps> = ({
  isOpen,
  onClose,
  messages,
  currentUserId,
  currentUserRole,
  onSendMessage,
}) => {
  const [text, setText] = useState('');
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text.trim(), isAnnouncement);
    setText('');
    setIsAnnouncement(false);
  };

  return (
    <div className="w-80 h-full bg-[#111216] border-l border-[#1f2026] flex flex-col z-20 select-none">
      {/* Header */}
      <div className="h-10 px-3 bg-[#14151a] border-b border-[#1f2026] flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2 text-gray-200">
          <MessageSquare className="w-4 h-4 text-[#ff9100]" />
          <span className="font-heading font-bold">Classroom Chat</span>
        </div>
        <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-white">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages Stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
        {messages.length === 0 ? (
          <div className="text-center py-10 text-gray-500 italic">
            No messages yet. Send a message or announcement!
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.senderId === currentUserId;
            const isAdmin = msg.role === 'admin';

            return (
              <div
                key={msg.id}
                className={`p-2.5 rounded-lg space-y-1 ${
                  msg.isAnnouncement
                    ? 'bg-amber-950/30 border border-amber-800/40 text-amber-200'
                    : isSelf
                    ? 'bg-[#1e202a] border border-[#2b2e3c] text-gray-200 ml-4'
                    : 'bg-[#15161c] border border-[#20222a] text-gray-300 mr-4'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] text-gray-400">
                  <span className="font-heading font-semibold flex items-center space-x-1 text-gray-300">
                    <span>{msg.senderName}</span>
                    {isAdmin && (
                      <Crown className="w-2.5 h-2.5 text-amber-400" />
                    )}
                  </span>
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="leading-relaxed whitespace-pre-wrap select-text">{msg.text}</p>
              </div>
            );
          })
        )}
      </div>

      {/* Input Box */}
      <form onSubmit={handleSend} className="p-2.5 bg-[#14151a] border-t border-[#1f2026] space-y-1.5">
        {currentUserRole === 'admin' && (
          <label className="flex items-center space-x-1.5 text-[10.5px] text-amber-300 cursor-pointer">
            <input
              type="checkbox"
              checked={isAnnouncement}
              onChange={(e) => setIsAnnouncement(e.target.checked)}
              className="w-3 h-3 accent-[#ff9100]"
            />
            <Megaphone className="w-3 h-3" />
            <span>Send as Announcement</span>
          </label>
        )}
        <div className="flex items-center space-x-1.5">
          <input
            type="text"
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 bg-[#181920] border border-[#2b2d38] rounded-md px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-[#ff9100]"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="p-1.5 rounded-md bg-[#ff9100] hover:bg-[#e08000] text-black font-bold disabled:opacity-50 transition"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
};
