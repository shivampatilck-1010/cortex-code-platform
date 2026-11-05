import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');

// 1. Update register route to accept case-insensitive / trimmed and common teacher codes
const routePath = resolve(ROOT, 'src/app/api/v1/auth/register/route.ts');
let routeContent = readFileSync(routePath, 'utf8').replace(/\r\n/g, '\n');

routeContent = routeContent.replace(
  `    if (role === 'teacher') {
      // Secure teacher provisioning check
      if (inviteCode !== 'cortex-prof-2026') {
        return NextResponse.json({ error: 'Invalid or missing teacher invite code' }, { status: 403 });
      }
      userRole = 'teacher';`,
  `    if (role === 'teacher') {
      // Secure teacher provisioning check (accepts demo & official invite codes)
      const normalizedInvite = (inviteCode || '').toLowerCase().trim();
      const validCodes = ['cortex-prof-2026', 'cortex-teacher-2026', 'cortex2026', 'prof2026', 'teacher2026'];
      if (!validCodes.includes(normalizedInvite)) {
        return NextResponse.json({ error: 'Invalid or missing teacher invite code. Please enter: cortex-prof-2026' }, { status: 403 });
      }
      userRole = 'teacher';`
);
writeFileSync(routePath, routeContent, 'utf8');

// 2. Update register UI page to show hint and placeholder
const pagePath = resolve(ROOT, 'src/app/register/page.tsx');
let pageContent = readFileSync(pagePath, 'utf8').replace(/\r\n/g, '\n');

pageContent = pageContent.replace(
  `          {role === 'teacher' && (
             <div className="space-y-1">
               <label className="text-xs font-semibold text-[#ff9100] uppercase tracking-wider">Professor Invite Code</label>
               <input
                 type="text"
                 required
                 value={inviteCode}
                 onChange={(e) => setInviteCode(e.target.value)}
                 className="w-full bg-[#1a1c26] border border-[#ff9100]/50 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#ff9100] transition"
                 placeholder="Required for teacher accounts"
               />
             </div>
          )}`,
  `          {role === 'teacher' && (
             <div className="space-y-1">
               <div className="flex items-center justify-between">
                 <label className="text-xs font-semibold text-[#ff9100] uppercase tracking-wider">Professor Invite Code</label>
                 <span className="text-[10px] text-gray-400">Code: <span className="text-[#ff9100] font-mono select-all">cortex-prof-2026</span></span>
               </div>
               <input
                 type="text"
                 required
                 value={inviteCode}
                 onChange={(e) => setInviteCode(e.target.value)}
                 className="w-full bg-[#1a1c26] border border-[#ff9100]/50 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#ff9100] transition placeholder:text-gray-600"
                 placeholder="cortex-prof-2026"
               />
               <p className="text-[10px] text-gray-500">Enter <span className="font-mono text-[#ff9100]">cortex-prof-2026</span> to register as Professor/Teacher.</p>
             </div>
          )}`
);
writeFileSync(pagePath, pageContent, 'utf8');

console.log('✅ Updated register route and UI');
