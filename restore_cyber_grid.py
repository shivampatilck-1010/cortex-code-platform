with open("src/app/classroom/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Root background from bg-black to bg-cyber-grid
content = content.replace(
    '<div className="h-screen w-screen bg-black text-[#E5E5E5] flex flex-col font-sans select-none overflow-hidden relative">\n      <MovingDotsBackground />',
    '<div className="h-screen w-screen bg-cyber-grid text-[#E5E5E5] flex flex-col font-sans select-none overflow-hidden relative">'
)

# 2. Fix Sidebar Buttons (Create and Join Classroom)
sidebar_buttons_old = """          <div className="w-64 border-r border-[#333333] flex flex-col bg-[#0A0A0A]">
            <div className="p-4 border-b border-[#333333]">
              <button
                onClick={() => setIsCreateClassModalOpen(true)}
                className="w-full py-2 bg-[#ff9100]/10 hover:bg-[#ff9100]/20 text-[#ff9100] text-xs font-bold rounded-lg border border-[#ff9100]/30 transition"
              >
                + Create Classroom
              </button>
            </div>"""

sidebar_buttons_new = """          <div className="w-64 border-r border-[#333333] flex flex-col bg-[#0A0A0A]">
            <div className="p-4 border-b border-[#333333] space-y-3">
              <button
                onClick={() => setIsCreateClassModalOpen(true)}
                className="silver-motion-ring h-10 w-full text-xs font-bold text-[#E5E5E5]"
              >
                <div className="silver-motion-inner">+ Create Classroom</div>
              </button>
              <button
                onClick={() => setIsJoinClassModalOpen(true)}
                className="silver-motion-ring h-10 w-full text-xs font-bold text-[#E5E5E5]"
              >
                <div className="silver-motion-inner">+ Join Classroom</div>
              </button>
            </div>"""
content = content.replace(sidebar_buttons_old, sidebar_buttons_new)

# 3. Fix Active Tab Color from #ff9100 to #E5E5E5
content = content.replace("border-[#ff9100] text-white font-semibold", "border-white text-white font-bold")
content = content.replace("border-transparent text-[#737373] hover:text-[#E5E5E5]", "border-transparent text-[#A3A3A3] hover:text-white")

# 4. Fix Send button from rounded-lg to rounded-full
content = content.replace(
    'className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs transition flex items-center justify-center"',
    'className="p-2 rounded-full bg-cyan-500 hover:bg-cyan-400 text-black transition flex items-center justify-center"'
)

# 5. Fix Post Update button to silver motion ring
post_update_old = """                      <button
                        type="submit"
                        disabled={!newAnnouncement.title || !newAnnouncement.content || isPostingAnnouncement}
                        className="px-5 py-2 rounded-lg text-xs font-bold bg-[#111111] border border-[#333333] hover:border-cyan-500/50 hover:bg-cyan-950/30 text-cyan-400 hover:text-cyan-300 shadow-none disabled:opacity-50"
                      >
                        {isPostingAnnouncement ? 'Posting...' : 'Post Update'}
                      </button>"""
                      
post_update_new = """                      <button
                        type="submit"
                        disabled={!newAnnouncement.title || !newAnnouncement.content || isPostingAnnouncement}
                        className="silver-motion-ring h-9 px-6 text-xs font-bold text-[#E5E5E5] disabled:opacity-50"
                      >
                        <div className="silver-motion-inner px-4">{isPostingAnnouncement ? 'Posting...' : 'Post Update'}</div>
                      </button>"""
content = content.replace(post_update_old, post_update_new)

# 6. Fix cards to monochrome-neon-box
content = content.replace('className="bg-[#0A0A0A] border border-[#333333] rounded-xl overflow-hidden flex flex-col"', 'className="monochrome-neon-box rounded-xl overflow-hidden flex flex-col"')
content = content.replace('className="bg-[#0A0A0A] border border-[#333333] rounded-xl p-6"', 'className="monochrome-neon-box rounded-xl p-6"')

with open("src/app/classroom/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
