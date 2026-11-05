const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/app/api/v1/classrooms/[id]/live/session/route.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Add import if not present
if (!content.includes('getAuthoritativeIceServers')) {
  content = content.replace(
    "import { ClassroomAuth } from '@/lib/classroom/auth';",
    "import { ClassroomAuth } from '@/lib/classroom/auth';\nimport { getAuthoritativeIceServers } from '@/lib/classroom/ice-servers';"
  );
}

// Add iceServers to response
const targetBlock = `      permissions,
      liveSessionToken,
      issuedAt: now,
      expiresAt: now + tokenLifetimeMs,
    });`;

const replacementBlock = `      permissions,
      liveSessionToken,
      iceServers: getAuthoritativeIceServers(user.id).iceServers,
      isTurnConfigured: getAuthoritativeIceServers(user.id).isTurnConfigured,
      iceMode: getAuthoritativeIceServers(user.id).mode,
      issuedAt: now,
      expiresAt: now + tokenLifetimeMs,
    });`;

if (content.includes(targetBlock)) {
  content = content.replace(targetBlock, replacementBlock);
} else {
  // Try CRLF
  const targetCRLF = targetBlock.replace(/\n/g, '\r\n');
  const replacementCRLF = replacementBlock.replace(/\n/g, '\r\n');
  content = content.replace(targetCRLF, replacementCRLF);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully added iceServers to session route');
