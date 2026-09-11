import re

with open('src/app/classroom/page.tsx', 'r') as f:
    content = f.read()

# Make the left sidebar slightly wider, rounded, and improve typography
content = content.replace('w-72 bg-[#13141a] border border-[#20222d] rounded-xl flex flex-col overflow-hidden shrink-0', 
                          'w-80 bg-[#13141a] border border-[#20222d] rounded-xl flex flex-col overflow-hidden shrink-0 shadow-sm')

# Make the headers bolder and cleaner
content = content.replace('text-xs font-semibold text-white">Problem Sets', 'text-sm font-bold text-white tracking-tight">Problem Sets')

content = content.replace('text-[10px] text-gray-500 font-medium">\n                              {asg.maxMarks} pts', 
                          'text-[10px] text-gray-400 font-bold bg-[#1e202b] px-2 py-0.5 rounded-full">\n                              {asg.maxMarks} pts')

content = content.replace('h4 className="text-xs font-semibold text-white line-clamp-1">{asg.title}</h4>', 
                          'h4 className="text-sm font-bold text-gray-100 line-clamp-1">{asg.title}</h4>')

content = content.replace('text-base font-bold text-white">{selectedAssignment.title}</h3>', 
                          'text-xl font-extrabold text-white tracking-tight">{selectedAssignment.title}</h3>')

content = content.replace('className="text-xs px-2 py-0.5 rounded font-mono bg-[#20232f] text-[#ff9100]">\n                            Max Marks',
                          'className="text-xs px-3 py-1 rounded-full font-mono font-bold bg-[#ff9100]/10 border border-[#ff9100]/20 text-[#ff9100] shadow-sm">\n                            Max Marks')

with open('src/app/classroom/page.tsx', 'w') as f:
    f.write(content)
