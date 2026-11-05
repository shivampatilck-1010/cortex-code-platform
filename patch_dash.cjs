const fs = require('fs');
const file = 'src/app/classroom/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldFn = `const handleLiveSessionClick = async () => {
    if (!selectedClassroom) return;
    if (liveSession) {
      router.push(\`/classroom/\${selectedClassroom.id}/live/\${liveSession.id}\`);
      return;
    }
    
    if (currentUserRole === 'teacher' || currentUserRole === 'admin') {
      try {
        const res = await fetch(\`/api/v1/classrooms/\${selectedClassroom.id}/session\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start', title: 'Live Coding' })
        });
        const data = await res.json();
        if (data.session) {
           router.push(\`/classroom/\${selectedClassroom.id}/live/\${data.session.id}\`);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };`;

const newFn = `const handleLiveSessionClick = async () => {
    if (!selectedClassroom) return;
    // The Live Session / Arena has been unified. Navigate directly to the Arena workspace.
    router.push(\`/classroom/\${selectedClassroom.id}\`);
  };`;

content = content.replace(oldFn, newFn);
fs.writeFileSync(file, content, 'utf8');
