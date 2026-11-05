import React, { useState } from 'react';
import { useClassroom, formatInitials } from '@/context/ClassroomContext';
import { ChatMessage } from '@/types/realtime';
import { X, Send, HelpCircle, MessageSquare } from 'lucide-react';

const initialChatMessages: ChatMessage[] = [
  {
    id: 'msg-1',
    senderId: 'usr_prof_shivam',
    senderName: 'Prof. Shivam Patil',
    senderRole: 'teacher',
    text: 'Welcome everyone to CS 201. Today we are diving into AVL tree rotations and balance factor preservation.',
    timestamp: Date.now() - 20 * 60 * 1000,
    isAnnouncement: true,
  },
  {
    id: 'msg-2',
    senderId: 'usr_student_alex',
    senderName: 'Alex Chen',
    senderRole: 'student',
    text: 'Is the height difference check strict (|h_L - h_R| <= 1) at every node or only at the root?',
    timestamp: Date.now() - 14 * 60 * 1000,
  },
  {
    id: 'msg-3',
    senderId: 'usr_prof_shivam',
    senderName: 'Prof. Shivam Patil',
    senderRole: 'teacher',
    text: 'Good question Alex. The AVL invariant must strictly hold at every internal node in the entire tree, which is why we recompute height on unwind.',
    timestamp: Date.now() - 12 * 60 * 1000,
  },
  {
    id: 'msg-4',
    senderId: 'usr_student_sophia',
    senderName: 'Sophia Patel',
    senderRole: 'student',
    text: 'Can we inspect the rotateRight() helper in Workspace B?',
    timestamp: Date.now() - 6 * 60 * 1000,
  },
];

export const ChatSidebar: React.FC = () => {
  const { isChatOpen, setIsChatOpen, userRole } = useClassroom();
  const [messages, setMessages] = useState<ChatMessage[]>(initialChatMessages);
  const [inputText, setInputText] = useState('');
  const [filter, setFilter] = useState<'all' | 'questions'>('all');
  const [isQuestionMode, setIsQuestionMode] = useState(false);

  if (!isChatOpen) return null;

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: userRole === 'teacher' ? 'usr_prof_shivam' : 'usr_student_alex',
      senderName: userRole === 'teacher' ? 'Prof. Shivam Patil' : 'Alex Chen',
      senderRole: userRole,
      text: isQuestionMode ? `[QUESTION] ${inputText}` : inputText,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText('');
    setIsQuestionMode(false);
  };

  const filteredMessages = messages.filter((m) => {
    if (filter === 'questions') {
      return m.text.includes('?') || m.text.startsWith('[QUESTION]');
    }
    return true;
  });

  return (
    <aside
      className="w-80 md:w-96 border-l border-[#282A36] bg-[#111216] flex flex-col h-full z-10 select-none shadow-xl"
      aria-label="Classroom Discussion"
    >
      {/* Sidebar Header */}
      <div className="h-12 border-b border-[#282A36] px-4 flex items-center justify-between bg-[#0B0C0E]">
        <div className="flex items-center space-x-2">
          <MessageSquare className="w-4 h-4 text-[#06B6D4]" />
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
            Discussion & Q/A
          </h3>
        </div>
        <button
          onClick={() => setIsChatOpen(false)}
          className="p-1 rounded text-[#71717A] hover:text-white hover:bg-[#15161C] transition-colors"
          aria-label="Close Chat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-[#282A36] bg-[#15161C] px-3 py-1.5 space-x-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
            filter === 'all'
              ? 'bg-[#1D1F27] text-white border border-[#282A36]'
              : 'text-[#A1A1AA] hover:text-white'
          }`}
        >
          All Messages ({messages.length})
        </button>
        <button
          onClick={() => setFilter('questions')}
          className={`flex items-center space-x-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
            filter === 'questions'
              ? 'bg-[#1D1F27] text-[#06B6D4] border border-[#06B6D4]/30'
              : 'text-[#A1A1AA] hover:text-white'
          }`}
        >
          <HelpCircle className="w-3 h-3 text-[#06B6D4]" />
          <span>Questions Only</span>
        </button>
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#71717A]">
            <HelpCircle className="w-8 h-8 text-[#282A36] mb-2" />
            <p className="text-xs font-medium text-[#A1A1AA]">No questions posted yet</p>
            <p className="text-[11px] mt-1">Questions marked by students or ending with a question mark appear here.</p>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isTeacher = msg.senderRole === 'teacher';
            const isQuestion = msg.text.startsWith('[QUESTION]') || msg.text.includes('?');

            return (
              <div
                key={msg.id}
                className={`rounded-lg p-3 border transition-colors ${
                  msg.isAnnouncement
                    ? 'bg-[#FF9100]/5 border-[#FF9100]/25'
                    : isQuestion
                    ? 'bg-[#06B6D4]/5 border-[#06B6D4]/25'
                    : 'bg-[#15161C] border-[#282A36]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-2">
                    <div
                      className={`w-6 h-6 rounded flex items-center justify-center font-bold text-[10px] ${
                        isTeacher
                          ? 'bg-[#FF9100] text-black'
                          : 'bg-[#282A36] text-[#F5F5F5]'
                      }`}
                    >
                      {formatInitials(msg.senderName)}
                    </div>
                    <span className="text-xs font-medium text-white">{msg.senderName}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded uppercase font-semibold tracking-wide ${
                        isTeacher
                          ? 'bg-[#FF9100]/20 text-[#FF9100] border border-[#FF9100]/30'
                          : 'bg-[#282A36] text-[#A1A1AA]'
                      }`}
                    >
                      {msg.senderRole}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#71717A] font-mono">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <p className="text-xs text-[#E4E4E7] leading-relaxed break-words pl-8">
                  {msg.text}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Message Input Footer */}
      <form onSubmit={handleSendMessage} className="p-3 border-t border-[#282A36] bg-[#0B0C0E] space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <button
            type="button"
            onClick={() => setIsQuestionMode(!isQuestionMode)}
            className={`flex items-center space-x-1 px-2 py-0.5 rounded transition-colors ${
              isQuestionMode
                ? 'bg-[#06B6D4]/20 text-[#06B6D4] font-medium border border-[#06B6D4]/40'
                : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            <HelpCircle className="w-3 h-3" />
            <span>Mark as Question</span>
          </button>
          <span className="text-[10px] text-[#71717A]">Press Enter to send</span>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isQuestionMode ? 'Ask a question to the instructor...' : 'Type message to classroom...'}
            className="flex-1 bg-[#15161C] border border-[#282A36] rounded-lg px-3 py-2 text-xs text-white placeholder-[#71717A] focus:outline-none focus:border-[#FF9100]"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2 rounded-lg bg-[#FF9100] text-black hover:bg-[#E08000] disabled:opacity-40 disabled:hover:bg-[#FF9100] transition-colors"
            title="Send"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </aside>
  );
};
