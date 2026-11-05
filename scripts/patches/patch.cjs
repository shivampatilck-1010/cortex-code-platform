const fs = require('fs');
const file = 'src/app/classroom/[roomId]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/userA=\{userA\}\s*userB=\{userB\}/g, "userA={userA}\n                  userB={userB}\n                  arenaWorkspaces={room?.arenaWorkspaces}");

content = content.replace(/const handleCodeChangeA = \(code: string\) => \{[\s\S]*?(?=const handleCodeChangeB =)/, "const handleCodeChangeA = (code: string) => {\n    if (collabClientRef.current) {\n      collabClientRef.current.sendEvent({ type: 'workspace_updated' as any, payload: { workspaceId: 'A', activeCode: code } });\n    }\n  };\n\n  ");

content = content.replace(/const handleCodeChangeB = \(code: string\) => \{[\s\S]*?(?=const handleLanguageChangeA =)/, "const handleCodeChangeB = (code: string) => {\n    if (collabClientRef.current) {\n      collabClientRef.current.sendEvent({ type: 'workspace_updated' as any, payload: { workspaceId: 'B', activeCode: code } });\n    }\n  };\n\n  ");

content = content.replace(/const handleLanguageChangeA = async \(lang: string\) => \{[\s\S]*?(?=const handleLanguageChangeB =)/, "const handleLanguageChangeA = async (lang: string) => {\n    if (collabClientRef.current) {\n      collabClientRef.current.sendEvent({ type: 'workspace_updated' as any, payload: { workspaceId: 'A', currentLanguage: lang } });\n    }\n  };\n\n  ");

content = content.replace(/const handleLanguageChangeB = async \(lang: string\) => \{[\s\S]*?(?=const handleEndCollaboration =)/, "const handleLanguageChangeB = async (lang: string) => {\n    if (collabClientRef.current) {\n      collabClientRef.current.sendEvent({ type: 'workspace_updated' as any, payload: { workspaceId: 'B', currentLanguage: lang } });\n    }\n  };\n\n  ");

fs.writeFileSync(file, content, 'utf8');
