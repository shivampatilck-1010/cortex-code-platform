const fs = require('fs');
let code = fs.readFileSync('src/app/classroom/page.tsx', 'utf8');

const regexEffect = /useEffect\(\(\) => \{\s*const saved = localStorage\.getItem\('cortex_user_profile'\);[\s\S]*?\}, \[\]\);/;
const replaceEffect = `
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
`;
code = code.replace(regexEffect, replaceEffect);

const regexHandle = /const handleSaveProfile = \(e: React\.FormEvent\) => \{[\s\S]*?setCurrentUserRole\(newProfile\.role\);\s*setProfileLoaded\(true\);\s*\};/;
code = code.replace(regexHandle, '');

const regexModal = /\{\!profileLoaded && \([\s\S]*?\/\* Modal: Create Classroom \*\//;
code = code.replace(regexModal, '{/* Modal: Create Classroom */}');

fs.writeFileSync('src/app/classroom/page.tsx', code);
console.log('Fixed page.tsx auth checking');
