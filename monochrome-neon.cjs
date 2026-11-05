const fs = require('fs');
const path = require('path');

function replaceColors(content) {
  // Replace dark backgrounds with #000000 or #0A0A0A
  content = content.replace(/bg-\[#[0-9a-fA-F]{6}\]/g, (match) => {
    // If it's very dark, #000000, else #0A0A0A or #212121
    if (match.includes('bg-[#0d') || match.includes('bg-[#10') || match.includes('bg-[#13')) return 'bg-[#000000]';
    return 'bg-[#0A0A0A]';
  });

  // Replace text colors
  content = content.replace(/text-\[#[0-9a-fA-F]{6}\]/g, 'text-[#FFFFFF]');
  content = content.replace(/text-gray-[3456]00/g, 'text-[#E5E5E5]');
  content = content.replace(/text-cyan-[45]00/g, 'text-[#FFFFFF]');
  content = content.replace(/text-rose-[45]00/g, 'text-[#FFFFFF]');
  content = content.replace(/text-emerald-[45]00/g, 'text-[#FFFFFF]');
  content = content.replace(/text-amber-[45]00/g, 'text-[#FFFFFF]');
  content = content.replace(/text-gray-200/g, 'text-[#FFFFFF]');
  content = content.replace(/text-gray-100/g, 'text-[#FFFFFF]');
  
  // Replace border colors
  content = content.replace(/border-\[#[0-9a-fA-F]{6}\]/g, 'border-[#525252]');
  content = content.replace(/border-gray-[78]00/g, 'border-[#525252]');
  content = content.replace(/border-cyan-500\/[0-9]+/g, 'border-[#A3A3A3]');
  
  // Replace gradient/accents
  content = content.replace(/from-cyan-500 to-blue-500/g, 'bg-[#000000] border border-[#525252] hover:border-[#FFFFFF]');
  content = content.replace(/bg-gradient-to-r/g, '');
  content = content.replace(/shadow-lg shadow-cyan-500\/20/g, 'shadow-[0_0_15px_rgba(255,255,255,0.1)]');
  
  // Primary buttons to Silver Motion Ring
  // We'll manually fix buttons, but let's at least convert hover states
  content = content.replace(/hover:bg-\[#[0-9a-fA-F]{6}\]/g, 'hover:bg-[#212121]');
  content = content.replace(/hover:bg-cyan-600/g, 'hover:bg-[#212121]');

  return content;
}

function walkDir(dir) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const newContent = replaceColors(content);
      if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent, 'utf8');
        console.log('Updated', fullPath);
      }
    }
  });
}

walkDir('src/app/classroom');
walkDir('src/components/classroom');
