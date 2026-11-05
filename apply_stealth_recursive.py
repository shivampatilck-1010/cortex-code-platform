import os
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    
    # Backgrounds
    content = re.sub(r'bg-\[#0d0e12\]', 'bg-black', content)
    content = re.sub(r'bg-\[#0f111a\]', 'bg-[#0A0A0A]', content)
    content = re.sub(r'bg-\[#14151d\]', 'bg-[#0A0A0A]', content)
    content = re.sub(r'bg-\[#1e202c\]', 'bg-[#111111]', content)
    content = re.sub(r'bg-\[#252837\]', 'bg-[#1A1A1A]', content)
    content = re.sub(r'bg-\[#2a2e3d\]', 'bg-[#333333]', content)

    # Buttons
    stealth_btn = 'bg-[#111111] border border-[#333333] hover:border-cyan-500/50 hover:bg-cyan-950/30 text-cyan-400 hover:text-cyan-300 shadow-none'
    content = re.sub(r'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:opacity-90 transition shadow-lg shadow-cyan-500/20', stealth_btn, content)
    content = re.sub(r'bg-cyan-500 text-white hover:bg-cyan-600', stealth_btn, content)
    
    stealth_amber_btn = 'bg-[#111111] border border-[#333333] hover:border-amber-500/50 hover:bg-amber-950/30 text-amber-400 hover:text-amber-300 shadow-none'
    content = re.sub(r'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black shadow-md transition', stealth_amber_btn, content)
    content = re.sub(r'bg-gradient-to-r from-amber-500 to-orange-500 text-black font-heading font-bold text-xs shadow-lg hover:from-amber-400 hover:to-orange-400 transition animate-pulse', stealth_amber_btn + ' animate-pulse', content)

    stealth_red_btn = 'bg-[#111111] border border-[#333333] hover:border-rose-500/50 hover:bg-rose-950/30 text-rose-400 hover:text-rose-300 shadow-none'
    content = re.sub(r'bg-gradient-to-r from-rose-500 to-red-600 text-white hover:opacity-90 transition shadow-lg shadow-rose-500/20', stealth_red_btn, content)
    content = re.sub(r'bg-rose-500 text-white font-bold hover:bg-rose-600', stealth_red_btn + ' font-bold', content)
    
    stealth_green_btn = 'bg-[#111111] border border-[#333333] hover:border-emerald-500/50 hover:bg-emerald-950/30 text-emerald-400 hover:text-emerald-300 shadow-none'
    content = re.sub(r'bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:opacity-90 transition shadow-lg shadow-emerald-500/20', stealth_green_btn, content)
    content = re.sub(r'bg-emerald-500 text-white font-bold hover:bg-emerald-600', stealth_green_btn + ' font-bold', content)

    # Texts
    content = re.sub(r'text-gray-200', 'text-[#E5E5E5]', content)
    content = re.sub(r'text-gray-300', 'text-[#A3A3A3]', content)
    content = re.sub(r'text-gray-400', 'text-[#737373]', content)
    content = re.sub(r'border-gray-800', 'border-[#333333]', content)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Patched {filepath}")

for root, _, files in os.walk('src/app/classroom'):
    for f in files:
        if f.endswith('.tsx'):
            process_file(os.path.join(root, f))
            
for root, _, files in os.walk('src/components/classroom'):
    for f in files:
        if f.endswith('.tsx'):
            process_file(os.path.join(root, f))
            
print("Done.")
