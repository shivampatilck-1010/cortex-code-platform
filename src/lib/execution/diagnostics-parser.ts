import { DiagnosticError } from './types';

export function parseDiagnostics(stderr: string, langId: string): DiagnosticError[] {
  const diagnostics: DiagnosticError[] = [];
  if (!stderr) return diagnostics;

  const lines = stderr.split('\n');

  for (const line of lines) {
    // GCC / Clang format: filename:line:col: error: message
    const gccMatch = line.match(/(?:.+?):(\d+):(?:(\d+):)?\s*(error|warning|fatal error):\s*(.+)/i);
    if (gccMatch) {
      diagnostics.push({
        line: parseInt(gccMatch[1], 10),
        column: gccMatch[2] ? parseInt(gccMatch[2], 10) : undefined,
        severity: gccMatch[3].toLowerCase().includes('error') ? 'error' : 'warning',
        message: gccMatch[4].trim(),
      });
      continue;
    }

    // Python Traceback format: File "...", line 12, in <module>
    const pyMatch = line.match(/File ".*?", line (\d+)(?:, in (.*))?/);
    if (pyMatch) {
      const lineNum = parseInt(pyMatch[1], 10);
      // Look ahead for the actual exception message (e.g. NameError: ..., SyntaxError: ...)
      let errMsg = line.trim();
      for (let j = lines.indexOf(line) + 1; j < lines.length; j++) {
        const nextLine = lines[j].trim();
        if (nextLine && /^[A-Z]\w*(?:Error|Exception|Warning):/.test(nextLine)) {
          errMsg = nextLine;
          break;
        }
      }
      diagnostics.push({
        line: lineNum,
        severity: 'error',
        message: errMsg,
      });
      continue;
    }

    // Java format: Main.java:14: error: ';' expected
    const javaMatch = line.match(/(?:.+?\.java):(\d+):\s*(error|warning):\s*(.+)/i);
    if (javaMatch) {
      diagnostics.push({
        line: parseInt(javaMatch[1], 10),
        severity: javaMatch[2].toLowerCase() === 'error' ? 'error' : 'warning',
        message: javaMatch[3].trim(),
      });
      continue;
    }

    // Rust format: --> main.rs:12:5
    const rustMatch = line.match(/--> (?:.+?):(\d+):(\d+)/);
    if (rustMatch) {
      diagnostics.push({
        line: parseInt(rustMatch[1], 10),
        column: parseInt(rustMatch[2], 10),
        severity: 'error',
        message: line.trim(),
      });
      continue;
    }

    // Node.js error: at main.js:15:9
    const nodeMatch = line.match(/at (?:.+?):(\d+):(\d+)/);
    if (nodeMatch) {
      diagnostics.push({
        line: parseInt(nodeMatch[1], 10),
        column: parseInt(nodeMatch[2], 10),
        severity: 'error',
        message: line.trim(),
      });
    }
  }

  return diagnostics;
}
