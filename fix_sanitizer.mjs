import fs from 'fs';

const code = fs.readFileSync('src/lib/execution/path-sanitizer.ts', 'utf8');

const regex = /const baseName = path\.basename\(normalized\)\.toLowerCase\(\);\n[\s\S]*?return \{ valid: false, error: \`Access to "\$\{baseName\}" is prohibited\` \};\n  \}/;

const newCode = `const baseName = path.basename(normalized).toLowerCase();
  if (baseName.startsWith('.env') || baseName === '.git' || baseName === 'node_modules') {
    return { valid: false, error: \`Access to "\${baseName}" is prohibited\` };
  }
  for (const seg of segments) {
    const s = seg.toLowerCase();
    if (s === '.git' || s === 'node_modules') {
      return { valid: false, error: \`Access to directory "\${s}" is prohibited\` };
    }
  }`;

fs.writeFileSync('src/lib/execution/path-sanitizer.ts', code.replace(regex, newCode));
