import re

with open('src/app/classroom/page.tsx', 'r') as f:
    content = f.read()

live_btn = """
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
"""

content = content.replace('{/* Notification Center Bell */}', live_btn)

with open('src/app/classroom/page.tsx', 'w') as f:
    f.write(content)
