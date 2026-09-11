with open('src/app/classroom/page.tsx', 'r') as f:
    content = f.read()

start_session_fn = """
  const handleLiveSessionClick = async () => {
    if (!selectedClassroom) return;
    if (liveSession) {
      router.push(`/classroom/${selectedClassroom.id}/live/${liveSession.id}`);
      return;
    }
    
    if (currentUserRole === 'teacher' || currentUserRole === 'admin') {
      try {
        const res = await fetch(`/api/v1/classrooms/${selectedClassroom.id}/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start', title: 'Live Coding' })
        });
        const data = await res.json();
        if (data.session) {
           router.push(`/classroom/${selectedClassroom.id}/live/${data.session.id}`);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };
"""

# inject before return (
content = content.replace("  return (", start_session_fn + "\n  return (")

with open('src/app/classroom/page.tsx', 'w') as f:
    f.write(content)

