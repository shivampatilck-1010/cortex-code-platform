const fs = require('fs');
let code = fs.readFileSync('src/lib/classroom/db/index.ts', 'utf8');

// Using regex to replace async method returns
code = code.replace(/async\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*:\s*([A-Za-z0-9_]+(?:\[\])?)\s*\{/g, (match, name, args, type) => {
  if (type !== 'any' && type !== 'void') {
    return `async ${name}(${args}): Promise<${type}> {`;
  }
  return match;
});

// Also replace types with union like `Type | null`
code = code.replace(/async\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*:\s*([A-Za-z0-9_]+\s*\|\s*null)\s*\{/g, (match, name, args, type) => {
  return `async ${name}(${args}): Promise<${type}> {`;
});

fs.writeFileSync('src/lib/classroom/db/index.ts', code);
console.log('Fixed return types in DB');
