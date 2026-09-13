const fs = require('fs');
let content = fs.readFileSync('src/app/classroom/page.tsx', 'utf8');

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
    setIsProfileModalOpen(true);
    setProfileLoaded(true);
  }, []);

  const handleSaveProfile = () => {
    if (!profileForm.name.trim()) {
       if (typeof showToast !== 'undefined') showToast('Name is required');
       return;
    }
    
    const existingId = localStorage.getItem('cortex_user_profile') ? JSON.parse(localStorage.getItem('cortex_user_profile')).id : \`usr_\${Date.now()}_\${Math.random().toString(36).substring(2,6)}\`;
    
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
  };
`;

content = content.replace('const [profileLoaded, setProfileLoaded] = useState(false);', 'const [profileLoaded, setProfileLoaded] = useState(false);' + profileEffect);
fs.writeFileSync('src/app/classroom/page.tsx', content);
