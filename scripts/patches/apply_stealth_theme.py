import re

with open('src/app/classroom/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Inject MovingDotsBackground
moving_dots = """function MovingDotsBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none bg-black z-0">
      <style dangerouslySetInnerHTML={{__html: `
        .moving-dots-bg {
          position: absolute;
          inset: -50%;
          width: 200%;
          height: 200%;
          background-image: radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px);
          background-size: 30px 30px;
          animation: panDots 4s linear infinite;
        }
        @keyframes panDots {
          0% { transform: translate(0, 0); }
          100% { transform: translate(-30px, -30px); }
        }
      `}} />
      <div className="moving-dots-bg"></div>
    </div>
  );
}

export default function ClassroomHubPage"""

content = content.replace("export default function ClassroomHubPage", moving_dots)

# 2. Inject into root div
root_div_target = '<div className="h-screen w-screen bg-[#0d0e12] text-gray-200 flex flex-col font-sans select-none overflow-hidden">'
root_div_replacement = '''<div className="h-screen w-screen bg-black text-[#E5E5E5] flex flex-col font-sans select-none overflow-hidden relative">
      <MovingDotsBackground />
      <div className="relative z-10 flex flex-col h-full w-full">'''

if root_div_target in content:
    content = content.replace(root_div_target, root_div_replacement)
    
    # We need to close the extra div at the end.
    # The file ends with:
    #       )}
    #     </div>
    #   );
    # }
    
    content = content.replace('      )}\n    </div>\n  );\n}', '      )}\n      </div>\n    </div>\n  );\n}')
    content = content.replace('      )}\r\n    </div>\r\n  );\r\n}', '      )}\r\n      </div>\r\n    </div>\r\n  );\r\n}')
    
# 3. Replace background colors with stealth dark colors
content = re.sub(r'bg-\[#0d0e12\]', 'bg-black', content)
content = re.sub(r'bg-\[#0f111a\]', 'bg-[#0A0A0A]', content)
content = re.sub(r'bg-\[#14151d\]', 'bg-[#0A0A0A]', content)
content = re.sub(r'bg-\[#1e202c\]', 'bg-[#111111]', content)
content = re.sub(r'bg-\[#252837\]', 'bg-[#1A1A1A]', content)
content = re.sub(r'bg-\[#2a2e3d\]', 'bg-[#333333]', content)

# 4. Replace flashing buttons with stealth buttons
# Cyan/Blue gradients
stealth_btn = 'bg-[#111111] border border-[#333333] hover:border-cyan-500/50 hover:bg-cyan-950/30 text-cyan-400 hover:text-cyan-300 shadow-none'
content = re.sub(r'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:opacity-90 transition shadow-lg shadow-cyan-500/20', stealth_btn, content)
content = re.sub(r'bg-cyan-500 text-white hover:bg-cyan-600', stealth_btn, content)

# Rose gradients
stealth_red_btn = 'bg-[#111111] border border-[#333333] hover:border-rose-500/50 hover:bg-rose-950/30 text-rose-400 hover:text-rose-300 shadow-none'
content = re.sub(r'bg-gradient-to-r from-rose-500 to-red-600 text-white hover:opacity-90 transition shadow-lg shadow-rose-500/20', stealth_red_btn, content)

# Emerald gradients
stealth_green_btn = 'bg-[#111111] border border-[#333333] hover:border-emerald-500/50 hover:bg-emerald-950/30 text-emerald-400 hover:text-emerald-300 shadow-none'
content = re.sub(r'bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:opacity-90 transition shadow-lg shadow-emerald-500/20', stealth_green_btn, content)
content = re.sub(r'bg-emerald-500 text-white font-bold hover:bg-emerald-600', stealth_green_btn + ' font-bold', content)
content = re.sub(r'bg-rose-500 text-white font-bold hover:bg-rose-600', stealth_red_btn + ' font-bold', content)

# 5. Fix text colors
content = re.sub(r'text-gray-200', 'text-[#E5E5E5]', content)
content = re.sub(r'text-gray-300', 'text-[#A3A3A3]', content)
content = re.sub(r'text-gray-400', 'text-[#737373]', content)
content = re.sub(r'border-gray-800', 'border-[#333333]', content)

with open('src/app/classroom/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Applied stealth theme successfully.")
