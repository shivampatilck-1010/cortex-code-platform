const fs = require('fs');
let code = fs.readFileSync('scripts/test-auth.ts', 'utf8');

code = code.replace(/const assert = [\s\S]*?\n  \};\n/, `const assert = (condition: boolean, message: string, details?: any) => {
    if (condition) {
      console.log(\`[PASS] \${message}\`);
      passed++;
    } else {
      console.error(\`[FAIL] \${message}\`, details ? details : '');
      failed++;
    }
  };
`);

// Add details to catch blocks
code = code.replace(/\} catch \(e: any\) \{ console\.error\(e\.message\); assert\(false, '([^']+)'\); \}/g, 
  '} catch (e: any) { assert(false, \'$1\', e.message); }');

fs.writeFileSync('scripts/test-auth.ts', code);
