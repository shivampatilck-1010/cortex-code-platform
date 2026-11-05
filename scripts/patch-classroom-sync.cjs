const fs = require('fs');
const path = require('path');

// 1. Patch src/app/api/v1/classroom/[roomId]/route.ts
const routeFile = path.resolve(__dirname, '../src/app/api/v1/classroom/[roomId]/route.ts');
let routeContent = fs.readFileSync(routeFile, 'utf8');

if (!routeContent.includes("import { classroomDb } from '@/lib/classroom/db';")) {
  routeContent = routeContent.replace(
    "import { ClassroomAuth } from '@/lib/classroom/auth';",
    "import { ClassroomAuth } from '@/lib/classroom/auth';\nimport { classroomDb } from '@/lib/classroom/db';"
  );
}

const targetHydrationCode = `    // Edge & Multi-Isolate Hydration: Populate participants from durable D1 database
    try {
      const dbMembers = await classroomDb.listMembers(roomId);
      if (dbMembers && dbMembers.length > 0) {
        for (const m of dbMembers) {
          const isTeacher = m.role === 'teacher' || m.role === 'admin';
          if (!room.participants[m.userId]) {
            room.participants[m.userId] = {
              id: m.userId,
              name: m.userName,
              role: isTeacher ? 'admin' : 'user',
              joinedAt: m.joinedAt || Date.now(),
              lastActive: m.lastActiveAt || Date.now(),
              status: m.isOnline ? 'idle' : 'offline',
              online: Boolean(m.isOnline),
              currentLanguage: 'python',
              activeFileName: 'main.py',
              activeCode: '',
              files: [],
              canRun: true,
              isLocked: false,
              privacy: {
                workspaceVisibility: isTeacher ? 'public' : 'private',
                allowCollaboration: true,
                requireDownloadPermission: !isTeacher,
              },
            };
          }
          if (isTeacher && (!room.admin.id || room.admin.name === 'Classroom Host')) {
            room.admin.id = m.userId;
            room.admin.name = m.userName;
            room.admin.enteredArena = true;
            room.state = 'active';
          }
        }
      }
    } catch {}
`;

if (!routeContent.includes("Edge & Multi-Isolate Hydration")) {
  routeContent = routeContent.replace(
    "    // Edge Self-Healing: if participant is known by client but missing in this worker isolate, auto-register",
    `${targetHydrationCode}\n    // Edge Self-Healing: if participant is known by client but missing in this worker isolate, auto-register`
  );
}

fs.writeFileSync(routeFile, routeContent, 'utf8');
console.log('Successfully patched src/app/api/v1/classroom/[roomId]/route.ts');

// 2. Patch src/app/classroom/[roomId]/page.tsx
const pageFile = path.resolve(__dirname, '../src/app/classroom/[roomId]/page.tsx');
let pageContent = fs.readFileSync(pageFile, 'utf8');

const targetSlotBReplacement = `      // Otherwise auto-mount another participant into Slot B who is NOT Slot A
      if (newRoom.participants) {
        // Priority 1: For students, auto-mount Teacher/Admin into Slot B so students always see teacher workspace
        const isStudent = participantRole !== 'admin' && newRoom.participants[myId]?.role !== 'admin';
        if (isStudent) {
          const teacher = Object.values(newRoom.participants).find(
            (p) => p && p.id && p.id !== activeA && (p.role === 'admin' || p.id === newRoom.admin?.id)
          );
          if (teacher) return teacher.id;
        }

        const otherUser = Object.values(newRoom.participants).find(
          (p) => p && p.id && p.id !== activeA && p.name !== 'Classroom Host'
        );
        if (otherUser) return otherUser.id;
      }`;

if (!pageContent.includes("Priority 1: For students, auto-mount Teacher/Admin")) {
  pageContent = pageContent.replace(
    /\/\/ Otherwise auto-mount another participant into Slot B who is NOT Slot A[\s\S]*?if \(otherUser\) return otherUser\.id;\s*\}/,
    targetSlotBReplacement
  );
}

// Ensure polling interval doesn't stop during side-by-side browser window testing
pageContent = pageContent.replace(
  /const syncTimer = setInterval\(\(\) => \{[\s\S]*?\}, 10000\);/,
  `const syncTimer = setInterval(() => {\n      fetchRoomState(participantId, participantName, participantRole);\n    }, 4000);`
);

fs.writeFileSync(pageFile, pageContent, 'utf8');
console.log('Successfully patched src/app/classroom/[roomId]/page.tsx');

// 3. Patch src/components/classroom/UserListPanel.tsx
const userListFile = path.resolve(__dirname, '../src/components/classroom/UserListPanel.tsx');
let userListContent = fs.readFileSync(userListFile, 'utf8');

// Presence dot
userListContent = userListContent.replace(
  /user\.online\s*\?\s*user\.status === 'coding'/g,
  '(user.online || isSelf) ? user.status === \'coding\''
);

// Presence title
userListContent = userListContent.replace(
  /title=\{user\.online \? `Online \(\$\{user\.status\}\)` : 'Offline'\}/g,
  'title={(user.online || isSelf) ? `Online (${isSelf && (!user.status || user.status === "offline") ? "active" : (user.status || "active")})` : "Offline"}'
);

// Presence status text
userListContent = userListContent.replace(
  /\{user\.online \? user\.status : 'offline'\}/g,
  '{isSelf ? (user.status === "offline" ? "active" : (user.status || "active")) : (user.online ? user.status : "offline")}'
);

fs.writeFileSync(userListFile, userListContent, 'utf8');
console.log('Successfully patched src/components/classroom/UserListPanel.tsx');
