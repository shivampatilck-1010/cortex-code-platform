import { DiagnosticError } from './types';

export function parseDiagnostics(stderr: string, langId: string): DiagnosticError[] {
  const diagnostics: DiagnosticError[] = [];
  if (!stderr) return diagnostics;

  // Security guard: Cap parsing window to 64 KB and max 200 lines to prevent ReDoS on massive outputs
  const safeSnippet = stderr.length > 65536 ? stderr.slice(0, 65536) : stderr;
  const lines = safeSnippet.split('\n');
  const maxLines = Math.min(lines.length, 200);

  for (let i = 0; i < maxLines; i++) {
    const line = lines[i];
    // Skip excessively long lines (compiler/interpreter errors are short single lines)
    if (!line || line.length > 600) continue;

    // GCC / Clang format: filename:line:col: error: message
    // Use [^:\r\n]+ instead of .+? to prevent backtracking
    const gccMatch = line.match(/^([^:\r\n]+):(\d+):(?:(\d+):)?\s*(error|warning|fatal error):\s*(.+)/i);
    if (gccMatch) {
      diagnostics.push({
        line: parseInt(gccMatch[2], 10),
        column: gccMatch[3] ? parseInt(gccMatch[3], 10) : undefined,
        severity: gccMatch[4].toLowerCase().includes('error') ? 'error' : 'warning',
        message: gccMatch[5].trim(),
      });
      continue;
    }

    // Python Traceback format: File "...", line 12, in <module>
    const pyMatch = line.match(/File "([^"\r\n]+)", line (\d+)(?:, in (.+))?/);
    if (pyMatch) {
      const lineNum = parseInt(pyMatch[2], 10);
      let errMsg = line.trim();
      const lookaheadLimit = Math.min(lines.length, i + 10);
      for (let j = i + 1; j < lookaheadLimit; j++) {
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
    const javaMatch = line.match(/^([^:\r\n]+\.java):(\d+):\s*(error|warning):\s*(.+)/i);
    if (javaMatch) {
      diagnostics.push({
        line: parseInt(javaMatch[2], 10),
        severity: javaMatch[3].toLowerCase() === 'error' ? 'error' : 'warning',
        message: javaMatch[4].trim(),
      });
      continue;
    }

    // Rust format: --> main.rs:12:5
    const rustMatch = line.match(/--> ([^:\r\n]+):(\d+):(\d+)/);
    if (rustMatch) {
      diagnostics.push({
        line: parseInt(rustMatch[2], 10),
        column: parseInt(rustMatch[3], 10),
        severity: 'error',
        message: line.trim(),
      });
      continue;
    }

    // Node.js error: at main.js:15:9
    const nodeMatch = line.match(/at ([^:\r\n]+):(\d+):(\d+)/);
    if (nodeMatch) {
      diagnostics.push({
        line: parseInt(nodeMatch[2], 10),
        column: parseInt(nodeMatch[3], 10),
        severity: 'error',
        message: line.trim(),
      });
    }
  }

  return diagnostics;
}
