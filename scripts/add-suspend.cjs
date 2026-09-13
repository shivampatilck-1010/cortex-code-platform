const fs = require('fs');
let content = fs.readFileSync('src/app/classroom/page.tsx', 'utf8');

// 1. Add handleSuspendMember function
const suspendHandler = `
  const handleSuspendMember = async (member: any, action: 'suspend' | 'unsuspend') => {
    if (!selectedClassroom) return;
    try {
      const res = await fetch(\`/api/v1/classrooms/\${selectedClassroom.id}/members/\${member.userId}\`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        setMembers((prev) =>
          prev.map((m) => (m.userId === member.userId ? { ...m, status: data.status } : m))
        );
        showToast(\`\${member.userName} has been \${action === 'suspend' ? 'suspended' : 'unsuspended'}\`);
      } else {
        showToast(data.error || 'Failed to update student');
      }
    } catch (err) {
      showToast('Error communicating with server');
    }
  };
`;
// Insert right before handleRemoveMember
content = content.replace(/  \/\/ Handler: Remove Member/g, suspendHandler + '\n  // Handler: Remove Member');

// 2. Add Suspend button to UI
const memberUI = `
                                <div className="flex items-center space-x-2 mt-2">
                                  <button
                                    onClick={() => handleSuspendMember(member, member.status === 'suspended' ? 'unsuspend' : 'suspend')}
                                    className={\`px-2 py-1 rounded-lg text-xs font-medium transition \${member.status === 'suspended' ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' : 'bg-gray-800 text-gray-400 hover:text-amber-500'}\`}
                                    title={member.status === 'suspended' ? "Restore Access" : "Suspend student (Block for some days)"}
                                  >
                                    {member.status === 'suspended' ? 'Unsuspended' : 'Suspend'}
                                  </button>
                                  <button
                                    onClick={() => setMemberToRemove(member)}
                                    className="p-1.5 rounded-lg hover:bg-rose-950/40 text-gray-500 hover:text-rose-400 border border-transparent hover:border-rose-800/40 transition flex items-center space-x-1 text-xs"
                                    title="Remove student completely"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
`;

content = content.replace(/<button[^>]+onClick=\{\(\) => setMemberToRemove\(member\)\}[^>]+>[\s\S]*?<\/button>/g, memberUI);

// 3. Display suspended status next to Online status
content = content.replace(/<span className="text-xs text-gray-400">\{member\.isOnline \? 'Online now' : 'Offline'\}<\/span>/g, `<span className="text-xs text-gray-400">{member.isOnline ? 'Online now' : 'Offline'} {member.status === 'suspended' && <span className="text-amber-500 font-bold ml-2">(SUSPENDED)</span>}</span>`);

// 4. Update the Join modal UI and UX to fix "ui and ux is very bad" and "by using id and pass any student or users an acces the classroom"
const newJoinModal = `
      {isJoinClassModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f111a] border border-[#2a2e3d] rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-2">Join Classroom</h2>
            <p className="text-[#8a91a6] text-sm mb-6">Enter the Classroom Join Code provided by your instructor, or the Classroom ID and Password if required.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#8a91a6] mb-1">Classroom ID or Join Code</label>
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. CS101 or CLS_XXXX"
                  className="w-full bg-[#161925] border border-[#2a2e3d] rounded-xl px-4 py-3 text-sm text-white font-mono tracking-wider focus:outline-none focus:border-cyan-500/50"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#8a91a6] mb-1">Password (Optional if Join Code is unique)</label>
                <input
                  type="password"
                  placeholder="Leave empty if joining by code"
                  className="w-full bg-[#161925] border border-[#2a2e3d] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-8">
              <button
                onClick={() => setIsJoinClassModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-[#161925] border border-[#2a2e3d] text-gray-300 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleJoinClassroom}
                disabled={!joinCodeInput.trim()}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:from-cyan-400 hover:to-blue-400 transition disabled:opacity-50"
              >
                Join Class
              </button>
            </div>
          </div>
        </div>
      )}
`;

content = content.replace(/\{isJoinClassModalOpen && \([\s\S]*?className="px-6 py-2\.5 rounded-lg bg-cyan-500[\s\S]*?<\/button>\s*<\/div>\s*<\/div>\s*<\/div>\s*\)\}/, newJoinModal);


fs.writeFileSync('src/app/classroom/page.tsx', content);
