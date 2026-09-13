const fs = require('fs');
let code = fs.readFileSync('src/app/classroom/page.tsx', 'utf8');
const lines = code.split('\n');

const correctCode = `              <div className="flex justify-end space-x-3 mt-8 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateResourceModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl font-bold text-sm text-gray-400 hover:text-white transition hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:opacity-90 transition shadow-lg shadow-cyan-500/20"
                >
                  Add Resource
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Header */}
      <header className="h-16 bg-[#13141a] border-b border-[#1f212a] flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff9100] to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <span className="text-lg font-black tracking-tight text-white">CORTEX</span>
          <span className="text-xs font-bold text-[#ff9100] bg-[#ff9100]/10 px-2 py-0.5 rounded ml-2 uppercase tracking-widest">Classroom</span>
        </div>

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
      </header>`;

lines.splice(1094, 22, correctCode);
fs.writeFileSync('src/app/classroom/page.tsx', lines.join('\n'));
console.log('Fixed classroom page syntax errors');
