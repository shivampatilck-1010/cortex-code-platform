import re

file_path = "src/app/classroom/[roomId]/page.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

pattern = r"case 'end_collaboration':[\s\S]*?break;"
repl = """case 'collaboration_ended':
        case 'end_collaboration': {
          const sessionId = event.payload?.sessionId || '';
          setRoom(prev => {
            if (!prev) return prev;
            const newSessions = { ...prev.collaborationSessions };
            delete newSessions[sessionId];
            return { ...prev, collaborationSessions: newSessions };
          });
          setSlotBUserId(null);
          showToast('Collaboration session ended.');
          break;
        }"""

content = re.sub(pattern, repl, content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
