const fs = require('fs');
let code = fs.readFileSync('src/app/classroom/page.tsx', 'utf8');

const regex = /<button[\s\S]*?onClick=\{\(\) => setIsProfileModalOpen\(true\)\}[\s\S]*?\{currentUserRole\} \(Edit\)\s*<\/button>/;
const replacement = `
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-gray-300">{currentUserName}</span>
                <span className={\`px-2 py-1 rounded text-[10px] uppercase tracking-wider font-bold \${currentUserRole === 'teacher' ? 'bg-amber-500/20 text-amber-500' : 'bg-cyan-500/20 text-cyan-500'}\`}>
                  {currentUserRole}
                </span>
                <button
                  onClick={async () => {
                    await fetch('/api/v1/auth/logout', { method: 'POST' });
                    window.location.href = '/login';
                  }}
                  className="px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
                >
                  Logout
                </button>
              </div>
`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/app/classroom/page.tsx', code);
console.log('Fixed profile/logout button');
