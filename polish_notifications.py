import re

with open('src/app/classroom/page.tsx', 'r') as f:
    content = f.read()

content = content.replace('w-80 bg-[#1e202c] border border-[#2b2e40] rounded-xl shadow-2xl z-50 overflow-hidden',
                          'w-[340px] bg-[#1e202c]/95 backdrop-blur-xl border border-[#2b2e40] rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] z-50 overflow-hidden transform origin-top-right transition-all')

content = content.replace('p-4 border-b border-[#2b2e40]/50 ${!n.readAt ? \'bg-[#ff9100]/5\' : \'\'}',
                          'p-4 border-b border-[#2b2e40]/50 transition hover:bg-[#252837] ${!n.readAt ? \'bg-[#ff9100]/5\' : \'\'}')

with open('src/app/classroom/page.tsx', 'w') as f:
    f.write(content)
