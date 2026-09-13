const fs = require('fs');
let content = fs.readFileSync('src/app/classroom/page.tsx', 'utf8');

// 1. Add Profile state and ProfileModal
const profileState = `
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', email: '', role: 'student' as 'teacher' | 'student' });
  const [profileLoaded, setProfileLoaded] = useState(false);
`;
content = content.replace(/  const \[currentUserRole, setCurrentUserRole\] = useState[^\n]+\n[^\n]+\n[^\n]+\n[^\n]+\n/g, (match) => {
  return match + profileState;
});

// 2. Add useEffect to load profile
const profileEffect = `
  useEffect(() => {
    const saved = localStorage.getItem('cortex_user_profile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.id && parsed.name && parsed.role) {
          setCurrentUserId(parsed.id);
          setCurrentUserName(parsed.name);
          setCurrentUserEmail(parsed.email || \`\${parsed.id}@cortex.edu\`);
          setCurrentUserRole(parsed.role);
          setProfileForm({ name: parsed.name, email: parsed.email, role: parsed.role });
          setProfileLoaded(true);
          return;
        }
      } catch (e) {}
    }
    // No valid profile found, open setup modal
    setIsProfileModalOpen(true);
    setProfileLoaded(true);
  }, []);

  const handleSaveProfile = () => {
    if (!profileForm.name.trim()) return showToast('Name is required');
    
    // Generate a permanent ID if this is a new profile
    const existingId = localStorage.getItem('cortex_user_profile') ? JSON.parse(localStorage.getItem('cortex_user_profile')!).id : \`usr_\${Date.now()}_\${Math.random().toString(36).substring(2,6)}\`;
    
    const newProfile = {
      id: existingId,
      name: profileForm.name,
      email: profileForm.email || \`\${existingId}@cortex.edu\`,
      role: profileForm.role
    };
    
    localStorage.setItem('cortex_user_profile', JSON.stringify(newProfile));
    setCurrentUserId(newProfile.id);
    setCurrentUserName(newProfile.name);
    setCurrentUserEmail(newProfile.email);
    setCurrentUserRole(newProfile.role);
    setIsProfileModalOpen(false);
    
    // Refresh classrooms with new identity
    if (typeof fetchClassrooms === 'function') {
      setTimeout(() => fetchClassrooms(), 100);
    }
  };
`;
content = content.replace(/  const handleSwitchPersona = \(role: 'teacher' \| 'student'\) => \{[\s\S]*?  \};\n/g, profileEffect);

// 3. Add Profile Modal UI right after <div className="min-h-screen
const profileModalUI = `
      {/* Profile Setup Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0f111a] border border-[#2a2e3d] rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-2">Welcome to Cortex</h2>
            <p className="text-[#8a91a6] text-sm mb-6">Please set up your profile before continuing.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#8a91a6] mb-1">Full Name</label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={e => setProfileForm({...profileForm, name: e.target.value})}
                  className="w-full bg-[#161925] border border-[#2a2e3d] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                  placeholder="e.g. Alex Chen"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#8a91a6] mb-1">Email (Optional)</label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={e => setProfileForm({...profileForm, email: e.target.value})}
                  className="w-full bg-[#161925] border border-[#2a2e3d] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                  placeholder="alex.chen@student.cortex.edu"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#8a91a6] mb-1">I am a...</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setProfileForm({...profileForm, role: 'student'})}
                    className={\`py-3 rounded-xl border text-sm font-medium transition \${profileForm.role === 'student' ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-500' : 'bg-[#161925] border-[#2a2e3d] text-[#8a91a6] hover:border-[#3a3f52]'}\`}
                  >
                    Student
                  </button>
                  <button
                    onClick={() => setProfileForm({...profileForm, role: 'teacher'})}
                    className={\`py-3 rounded-xl border text-sm font-medium transition \${profileForm.role === 'teacher' ? 'bg-amber-500/10 border-amber-500/50 text-amber-500' : 'bg-[#161925] border-[#2a2e3d] text-[#8a91a6] hover:border-[#3a3f52]'}\`}
                  >
                    Professor
                  </button>
                </div>
              </div>
            </div>
            
            <button
              onClick={handleSaveProfile}
              className="w-full mt-6 bg-white text-black py-3 rounded-xl font-medium hover:bg-gray-100 transition"
            >
              Continue to Dashboard
            </button>
          </div>
        </div>
      )}
`;
content = content.replace(/(<div className="min-h-screen[^>]+>)/, '$1' + profileModalUI);

// 4. Change the toggle button in Header to "Edit Profile"
const editProfileBtn = `
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className={\`px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition \${
                currentUserRole === 'teacher' ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' : 'bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500/20'
              }\`}
            >
              {currentUserRole} (Edit)
            </button>
`;
content = content.replace(/<button\s+onClick=\{\(\) => setCurrentUserRole\(currentUserRole === 'teacher' \? 'student' : 'teacher'\)\}[^>]+>\s*\{currentUserRole\} View\s*<\/button>/g, editProfileBtn);

fs.writeFileSync('src/app/classroom/page.tsx', content);
