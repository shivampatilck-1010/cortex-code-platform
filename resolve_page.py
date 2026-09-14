import re

c = open('src/app/classroom/page.tsx', 'r', encoding='utf-8').read()

conflict = '''<<<<<<< HEAD
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-gray-300">{currentUserName}</span>
          <span className={px-2 py-1 rounded text-[10px] uppercase tracking-wider font-bold }>
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
=======
          <div className="px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
            Professor View
          </div>
>>>>>>> origin/main'''

resolution = '''        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-gray-300">{currentUserName}</span>
          <span className={px-2 py-1 rounded text-[10px] uppercase tracking-wider font-bold }>
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
          </button>'''

c = c.replace(conflict, resolution)
open('src/app/classroom/page.tsx', 'w', encoding='utf-8').write(c)
