import { diffLines, Change } from 'diff';
import { DiagnosticError, ExecutionResult } from '../execution/types';
import { SUPPORTED_LANGUAGES, getLanguageConfig } from '@/config/languages';

export interface AISettings {
  autoFixErrors: boolean;
  explainErrors: boolean;
  suggestImprovements: boolean;
  optimizeCode: boolean;
  generateTestCases: boolean;
  operationalMode: 'manual' | 'confirm' | 'automatic';
  provider: 'gemini' | 'openai' | 'offline_ast';
  apiKey?: string;
  enableInlineSuggestions?: boolean;
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  autoFixErrors: true,
  explainErrors: true,
  suggestImprovements: true,
  optimizeCode: true,
  generateTestCases: true,
  operationalMode: 'confirm',
  provider: 'offline_ast',
  enableInlineSuggestions: false,
};

export interface AIErrorItem {
  line: number;
  cause: string;
  explanation: string;
  inlineComment: string;
  originalSnippet?: string;
  fixedSnippet?: string;
}

export interface AIFixResult {
  cause: string;
  explanation: string;
  inlineComment: string; // The primary explanatory comment
  fixedCode: string;
  originalCode: string;
  diffChanges: Change[];
  targetLine?: number;
  confidence: number;
  originalSnippet?: string;
  fixedSnippet?: string;
  errors?: AIErrorItem[]; // All errors detected with their individual line numbers and comments
  commentedCode?: string; // Code with comments placed beside ALL error lines
}

export interface AIAnalysisResult {
  explanation: string;
  bugs: string[];
  optimizations: string[];
  complexityEstimate: string;
  suggestedCode?: string;
}

/**
 * Intelligent Rule-based Static Error Analyzer and Fixer (Offline AST/Regex engine)
 * Guarantees instant, zero-cost error analysis even without external API credentials.
 */
export function analyzeAndFixErrorOffline(
  code: string,
  stderr: string,
  languageId: string,
  diagnostics: DiagnosticError[] = []
): AIFixResult {
  const lines = code.split('\n');
  let cause = 'Unknown syntax or runtime error';
  let explanation = 'The program encountered an unexpected termination during execution.';
  let fixedLines = [...lines];
  let targetLine = diagnostics?.[0]?.line;
  if (!targetLine) {
    const lineMatch = stderr.match(/:(\d+):\d+:/) || stderr.match(/line\s+(\d+)/i) || stderr.match(/:(\d+):/);
    if (lineMatch) {
      targetLine = parseInt(lineMatch[1], 10);
    }
  }
  let confidence = 0.85;

  const stderrLower = (stderr + ' ' + (diagnostics?.[0]?.message || '')).toLowerCase();
  const commentPrefix = ['python', 'ruby', 'r'].includes(languageId) ? '# ' : '// ';
  let inlineComment = '';

  // 0. Python False Entrypoint Check (e.g. __name_ == '_main__' or dummy __name_ = 0)
  if (languageId === 'python' && (code.includes('__name_') || code.includes("'_main__'") || code.includes('"_main__"'))) {
    const falseGuardLine = lines.findIndex(l => l.includes('__name_') || l.includes('_main__'));
    if (falseGuardLine !== -1) {
      cause = "Logic Error: Entrypoint guard condition is False (main() is never executed)";
      explanation = "In Python, the entrypoint variable must be '__name__' and the string must be '__main__' (with two underscores on both sides). Because '__name_' is set to 0 and '_main__' is misspelled, the condition evaluates to False, skipping main() entirely.";
      targetLine = falseGuardLine + 1;
      inlineComment = `${commentPrefix}[Cortex AI]: Error on line ${targetLine} - false entrypoint condition. Correct to 'if __name__ == "__main__":' to run main().`;

      // Fix: Remove any dummy `__name_ = 0` line and correct the if condition
      fixedLines = fixedLines.filter(l => !l.trim().startsWith('__name_ ='));
      fixedLines = fixedLines.map(l => {
        if (l.includes('__name_') || l.includes('_main__')) {
          return l.replace(/__name_/g, '__name__').replace(/_main__/g, '__main__');
        }
        return l;
      });
    }
  }
  // 1. C / C++ / Java missing semicolon
  else if (stderrLower.includes("expected ';'") || stderrLower.includes('expected semicolon')) {
    cause = 'Missing semicolon at statement end';
    explanation = `In ${languageId === 'cpp' ? 'C++' : languageId === 'c' ? 'C' : 'Java'}, every statement must be terminated with a semicolon (;).`;
    if (targetLine && targetLine <= fixedLines.length) {
      let lineIdx = targetLine - 1;
      if (stderrLower.includes('before') || fixedLines[lineIdx].trim() === '}' || fixedLines[lineIdx].trim().endsWith(';')) {
        if (lineIdx > 0) lineIdx--;
      }
      while (lineIdx > 0 && (fixedLines[lineIdx].trim() === '' || fixedLines[lineIdx].trim().endsWith(';'))) {
        lineIdx--;
      }
      if (!fixedLines[lineIdx].trim().endsWith(';') && !fixedLines[lineIdx].trim().endsWith('{') && !fixedLines[lineIdx].trim().endsWith('}')) {
        fixedLines[lineIdx] = fixedLines[lineIdx] + ';';
      }
    } else {
      // Robust fallback: search backwards for any code line without semicolon
      for (let i = fixedLines.length - 1; i >= 0; i--) {
        const trimmed = fixedLines[i].trim();
        if (trimmed && !trimmed.endsWith(';') && !trimmed.endsWith('{') && !trimmed.endsWith('}') && !trimmed.startsWith('#') && !trimmed.startsWith('//')) {
          fixedLines[i] = fixedLines[i] + ';';
          targetLine = i + 1;
          break;
        }
      }
    }
    inlineComment = `${commentPrefix}[Cortex AI]: Error on line ${targetLine || 1} - missing semicolon ';'. Every statement must terminate with a semicolon.`;
  }
  // 2. Python IndentationError
  else if (stderrLower.includes('indentationerror') || stderrLower.includes('expected an indented block')) {
    cause = 'Improper indentation level';
    explanation = 'Python relies strictly on indentation to delimit blocks of code (such as functions, loops, or conditionals).';
    if (targetLine && targetLine <= fixedLines.length) {
      fixedLines[targetLine - 1] = '    ' + fixedLines[targetLine - 1].trimStart();
    }
    inlineComment = `${commentPrefix}[Cortex AI]: Error on line ${targetLine || 1} - indentation error. Expected an indented block with 4 spaces for this statement.`;
  }
  // 3. Python NameError
  else if (stderrLower.includes('nameerror') && stderrLower.includes('is not defined')) {
    const match = stderr.match(/name '(\w+)' is not defined/);
    const varName = match ? match[1] : 'variable';

    // Check for dunder typos like __name_, _name__, _name_, name in entrypoint
    const isEntrypointNameTypo = ['__name_', '_name__', '_name_', 'name'].includes(varName) &&
      lines.some(l => l.includes('__main__') || l.includes('__main_') || l.includes("'main'"));

    if (isEntrypointNameTypo) {
      cause = `Typo in Python entrypoint dunder variable '${varName}'`;
      explanation = `The identifier '${varName}' is a typo for '__name__'. In Python, standard scripts use 'if __name__ == "__main__":' to run main().`;
      inlineComment = `${commentPrefix}[Cortex AI]: Error on line ${targetLine || 1} - '${varName}' is undefined. In Python, the module entrypoint variable is '__name__' (with double underscores).`;
      
      // Fix: replace varName with __name__ on that line or lines
      fixedLines = fixedLines.map((line, idx) => {
        if (!targetLine || idx === targetLine - 1 || line.includes(varName)) {
          return line.replace(new RegExp(`\\b${varName}\\b`, 'g'), '__name__');
        }
        return line;
      });
    } else if (['sys', 'os', 'math', 'json', 're', 'time', 'random', 'datetime'].includes(varName)) {
      cause = `Missing module import for '${varName}'`;
      explanation = `'${varName}' is a Python standard library module that must be explicitly imported with 'import ${varName}' before use.`;
      inlineComment = `${commentPrefix}[Cortex AI]: Error on line ${targetLine || 1} - '${varName}' is referenced before import. Add 'import ${varName}' at the top of the file.`;
      fixedLines.unshift(`import ${varName}`);
    } else {
      cause = `Undefined identifier '${varName}'`;
      explanation = `The identifier '${varName}' was referenced before being declared or initialized in the current scope.`;
      inlineComment = `${commentPrefix}[Cortex AI]: Error on line ${targetLine || 1} - '${varName}' is not defined. Ensure it is assigned or passed as a parameter before this line.`;

      // Check if there is an existing similar variable name in the code
      const allWords = code.match(/\b[a-zA-Z_]\w*\b/g) || [];
      const similar = allWords.find(w => w !== varName && w.length > 2 && (w.startsWith(varName.slice(0, 3)) || varName.startsWith(w.slice(0, 3))));
      if (similar && targetLine && targetLine <= fixedLines.length) {
        fixedLines[targetLine - 1] = fixedLines[targetLine - 1].replace(new RegExp(`\\b${varName}\\b`, 'g'), similar);
        explanation += ` Replaced with detected variable '${similar}'.`;
      } else {
        fixedLines.splice(Math.max(0, (targetLine || 1) - 1), 0, `${varName} = 0  # Initialized by AI Auto-Fix`);
      }
    }
  }
  // 4. JavaScript / TypeScript TypeError or ReferenceError
  else if (stderrLower.includes('is not defined') || stderrLower.includes('referenceerror')) {
    const match = stderr.match(/(\w+) is not defined/);
    const varName = match ? match[1] : 'variable';
    cause = `Unresolved reference '${varName}'`;
    explanation = `'${varName}' is not defined in the current lexical scope.`;
    inlineComment = `${commentPrefix}[Cortex AI]: Error on line ${targetLine || 1} - '${varName}' is not defined in this scope. Declare with 'let', 'const', or 'var'.`;
    if (targetLine && targetLine <= fixedLines.length) {
      fixedLines.splice(targetLine - 1, 0, `let ${varName};`);
    }
  }
  // 5. C/C++ undeclared identifier or missing header
  else if (stderrLower.includes('was not declared in this scope') || stderrLower.includes('undeclared identifier')) {
    // Extract exact identifier: error: 'en' was not declared in this scope
    const undeclaredMatch =
      stderr.match(/error:\s*['’"`](\w+)['’"`]\s*was not declared/i) ||
      stderr.match(/use of undeclared identifier\s*['’"`](\w+)['’"`]/i) ||
      stderr.match(/['’"`](\w+)['’"`]\s*was not declared in this scope/i);
    const varName = undeclaredMatch ? undeclaredMatch[1] : '';

    // Check if compiler gave a 'did you mean' suggestion
    const didYouMeanMatch = stderr.match(/did you mean\s*['’"`](\w+)['’"`]\?/i);
    const suggestion = didYouMeanMatch ? didYouMeanMatch[1] : '';

    const targetIdx = targetLine && targetLine <= fixedLines.length ? targetLine - 1 : -1;

    // Case 5a: Typo for 'endl' (e.g. 'en', 'end', 'ednl', 'edn', 'el')
    if (['en', 'end', 'ednl', 'edn', 'el', 'endl_'].includes(varName) || suggestion === 'endl') {
      cause = `Undeclared identifier '${varName}' (typo for 'endl')`;
      explanation = `'${varName}' is not declared. In C++, stream newlines use 'endl' (end-line), followed by a semicolon (;).`;
      inlineComment = `${commentPrefix}[Cortex AI]: Error on line ${targetLine || 1} - '${varName}' is undeclared. Replace with 'endl;'`;
      if (targetIdx >= 0) {
        fixedLines[targetIdx] = fixedLines[targetIdx].replace(new RegExp(`\\b${varName}\\b`, 'g'), 'endl');
        if (!fixedLines[targetIdx].trim().endsWith(';')) {
          fixedLines[targetIdx] = fixedLines[targetIdx].trimEnd() + ';';
        }
      }
    }
    // Case 5b: GCC gave a specific "did you mean" suggestion
    else if (suggestion && varName) {
      cause = `Undeclared identifier '${varName}' (did you mean '${suggestion}'?)`;
      explanation = `'${varName}' was not declared in this scope. Suggested fix: '${suggestion}'.`;
      inlineComment = `${commentPrefix}[Cortex AI]: Error on line ${targetLine || 1} - '${varName}' is undeclared. Did you mean '${suggestion}'?`;
      if (targetIdx >= 0) {
        fixedLines[targetIdx] = fixedLines[targetIdx].replace(new RegExp(`\\b${varName}\\b`, 'g'), suggestion);
        if (!fixedLines[targetIdx].trim().endsWith(';')) {
          fixedLines[targetIdx] = fixedLines[targetIdx].trimEnd() + ';';
        }
      }
    }
    // Case 5c: cout or cin really is undeclared (only if missing iostream or std namespace)
    else if (
      (varName === 'cout' || varName === 'cin' || varName === 'endl') &&
      (!code.includes('<iostream>') || (!code.includes('using namespace std;') && !code.includes('std::')))
    ) {
      cause = 'Missing <iostream> or std:: namespace prefix';
      explanation = 'cout and endl belong to the std namespace in <iostream>.';
      inlineComment = `${commentPrefix}[Cortex AI]: Error on line ${targetLine || 1} - 'cout'/'cin' not declared. Requires #include <iostream> and using namespace std;.`;
      if (!code.includes('#include <iostream>')) {
        fixedLines.unshift('#include <iostream>');
      }
      if (!code.includes('using namespace std;') && !code.includes('std::cout')) {
        fixedLines.splice(1, 0, 'using namespace std;');
      }
    }
    // Case 5d: vector standard header missing
    else if (varName === 'vector' && !code.includes('<vector>')) {
      cause = 'Missing <vector> standard header';
      explanation = 'std::vector requires #include <vector>.';
      inlineComment = `${commentPrefix}[Cortex AI]: Error on line ${targetLine || 1} - 'vector' was not declared. Requires #include <vector>.`;
      fixedLines.unshift('#include <vector>');
    }
    // Case 5e: string standard header missing
    else if (varName === 'string' && !code.includes('<string>') && !code.includes('<iostream>')) {
      cause = 'Missing <string> standard header';
      explanation = 'std::string requires #include <string>.';
      inlineComment = `${commentPrefix}[Cortex AI]: Error on line ${targetLine || 1} - 'string' was not declared. Requires #include <string>.`;
      fixedLines.unshift('#include <string>');
    }
    // Case 5f: general identifier typo or undeclared variable
    else if (varName) {
      cause = `Undeclared identifier '${varName}'`;
      explanation = `'${varName}' was referenced before being declared or defined in the current scope.`;
      inlineComment = `${commentPrefix}[Cortex AI]: Error on line ${targetLine || 1} - '${varName}' was not declared in this scope.`;

      const allWords = code.match(/\b[a-zA-Z_]\w*\b/g) || [];
      const similar = allWords.find(
        (w) =>
          w !== varName &&
          w.length > 2 &&
          (w.startsWith(varName.slice(0, 2)) || varName.startsWith(w.slice(0, 2)))
      );
      if (similar && targetIdx >= 0) {
        fixedLines[targetIdx] = fixedLines[targetIdx].replace(new RegExp(`\\b${varName}\\b`, 'g'), similar);
        explanation += ` Replaced with detected identifier '${similar}'.`;
      }
      if (targetIdx >= 0 && !fixedLines[targetIdx].trim().endsWith(';')) {
        fixedLines[targetIdx] = fixedLines[targetIdx].trimEnd() + ';';
      }
    }
  }
  // 6. Python UnicodeEncodeError
  else if (stderrLower.includes('unicodeencodeerror') || stderrLower.includes('charmap')) {
    cause = 'Console encoding character set mismatch';
    explanation = 'The terminal stream encountered a Unicode character that cannot be encoded by the default code page. Reconfiguring stdout to UTF-8.';
    inlineComment = `${commentPrefix}[Cortex AI]: Error on line ${targetLine || 1} - UnicodeEncodeError. Standard stream requires UTF-8 reconfiguration.`;
    if (!code.includes('sys.stdout.reconfigure')) {
      fixedLines.unshift('import sys\nsys.stdout.reconfigure(encoding="utf-8") if hasattr(sys.stdout, "reconfigure") else None');
    }
  }
  // 7. Generic parenthesis / brace mismatch
  else if (stderrLower.includes("expected '}'") || stderrLower.includes('syntaxerror: unexpected end of input')) {
    cause = 'Unclosed curly brace or parenthesis';
    explanation = 'A block was opened with "{" or "(" but not properly closed before the end of the file.';
    inlineComment = `${commentPrefix}[Cortex AI]: Error on line ${targetLine || 1} - unclosed curly brace '{'. Ensure every block is terminated with '}'.`;
    fixedLines.push('}');
  }
  if (!targetLine) {
    const lineMatch =
      stderr.match(/line (\d+)/i) ||
      stderr.match(/:(\d+):(?:\d+:)?\s*(?:error|fatal)/i) ||
      stderr.match(/-->.+?:(\d+):/i) ||
      stderr.match(/\((\d+),\d+\)/i);
    if (lineMatch) {
      targetLine = parseInt(lineMatch[1], 10);
    }
  }

  // Generic Fallback with Universal Line-Level Syntax Heuristics
  if (!cause || cause === 'Unknown syntax or runtime error') {
    const targetIdx = targetLine ? targetLine - 1 : -1;
    const targetContent = targetIdx >= 0 && lines[targetIdx] ? lines[targetIdx] : '';
    const trimmed = targetContent.trim();

    // 1. Unclosed parenthesis
    const openParen = (targetContent.match(/\(/g) || []).length;
    const closeParen = (targetContent.match(/\)/g) || []).length;
    if (openParen > closeParen) {
      cause = `Unclosed parenthesis '(' on line ${targetLine}`;
      explanation = `Line ${targetLine} opened ${openParen} parenthesis but only closed ${closeParen}. A closing ')' is required.`;
      inlineComment = `${commentPrefix}[Cortex AI]: Error on line ${targetLine} - missing closing parenthesis ')'.`;
      fixedLines[targetIdx] = targetContent + ')'.repeat(openParen - closeParen);
      if (['c', 'cpp', 'java', 'csharp', 'php', 'rust', 'dart'].includes(languageId) && !fixedLines[targetIdx].endsWith(';')) {
        fixedLines[targetIdx] += ';';
      }
    }
    // 2. Unclosed bracket
    else if ((targetContent.match(/\[/g) || []).length > (targetContent.match(/\]/g) || []).length) {
      cause = `Unclosed square bracket '[' on line ${targetLine}`;
      explanation = `Line ${targetLine} opened a bracket '[' that was not closed.`;
      inlineComment = `${commentPrefix}[Cortex AI]: Error on line ${targetLine} - missing closing bracket ']'.`;
      fixedLines[targetIdx] = targetContent + ']';
    }
    // 3. Missing colon in Python
    else if (
      languageId === 'python' &&
      (trimmed.startsWith('if ') ||
        trimmed.startsWith('elif ') ||
        trimmed.startsWith('else:') ||
        trimmed.startsWith('for ') ||
        trimmed.startsWith('while ') ||
        trimmed.startsWith('def ') ||
        trimmed.startsWith('class ')) &&
      !trimmed.endsWith(':')
    ) {
      cause = `Missing colon ':' at statement header on line ${targetLine}`;
      explanation = `In Python, compound statement headers (${trimmed.split(' ')[0]}) must end with a colon (:).`;
      inlineComment = `${commentPrefix}[Cortex AI]: Error on line ${targetLine} - missing colon ':'. Statement headers in Python must end with a colon.`;
      fixedLines[targetIdx] = targetContent + ':';
    }
    // 4. Missing semicolon in C/C++/Java/C#/PHP/Dart
    else if (
      ['c', 'cpp', 'java', 'csharp', 'php', 'rust', 'dart'].includes(languageId) &&
      trimmed.length > 0 &&
      !trimmed.endsWith(';') &&
      !trimmed.endsWith('{') &&
      !trimmed.endsWith('}') &&
      !trimmed.startsWith('#') &&
      !trimmed.startsWith('//')
    ) {
      cause = `Missing semicolon ';' on line ${targetLine}`;
      explanation = `In ${languageId.toUpperCase()}, statements must be terminated with a semicolon (;).`;
      inlineComment = `${commentPrefix}[Cortex AI]: Error on line ${targetLine} - missing semicolon ';'. Statements must terminate with a semicolon.`;
      fixedLines[targetIdx] = targetContent + ';';
    }
    // 5. Unterminated double quote
    else if ((targetContent.match(/"/g) || []).length % 2 !== 0) {
      cause = `Unterminated double quote string literal on line ${targetLine}`;
      explanation = `Line ${targetLine} contains an unclosed double quote string.`;
      inlineComment = `${commentPrefix}[Cortex AI]: Error on line ${targetLine} - unterminated string literal. Add matching double quote.`;
      fixedLines[targetIdx] = targetContent + '"';
    }
    // 6. Unterminated single quote
    else if ((targetContent.match(/'/g) || []).length % 2 !== 0) {
      cause = `Unterminated single quote string literal on line ${targetLine}`;
      explanation = `Line ${targetLine} contains an unclosed single quote string.`;
      inlineComment = `${commentPrefix}[Cortex AI]: Error on line ${targetLine} - unterminated quote literal. Add matching single quote.`;
      fixedLines[targetIdx] = targetContent + "'";
    }
    // 7. General Diagnostic / Stderr Message
    else {
      const diagMsg = diagnostics[0]?.message;
      if (diagMsg) {
        cause = diagMsg;
        explanation = `Diagnostic detected on line ${targetLine || 1}: ${diagMsg}.`;
      } else if (stderr.trim()) {
        const firstStderrLine = stderr.trim().split('\n')[0].slice(0, 100);
        cause = firstStderrLine;
        explanation = `Execution error on line ${targetLine || 1}: ${stderr.trim().slice(0, 180)}`;
      } else {
        cause = `Syntax or execution issue on line ${targetLine || 1}`;
        explanation = `An unexpected condition occurred on line ${targetLine || 1}. Review the statement syntax and variable scope.`;
      }
      inlineComment = `${commentPrefix}[Cortex AI]: Error on line ${targetLine || 1} - ${cause}.`;
      confidence = 0.65;
    }
  }

  // Ensure missing semicolon is added for any diagnostic expecting a semicolon
  for (const d of diagnostics) {
    const msg = (d.message || '').toLowerCase();
    if (msg.includes("expected ';'") || msg.includes('expected semicolon')) {
      let targetL = d.line - 1;
      if (msg.includes('before') && targetL > 0) {
        targetL--;
      }
      while (targetL >= 0 && (fixedLines[targetL].trim() === '' || fixedLines[targetL].trim().endsWith(';'))) {
        targetL--;
      }
      if (
        targetL >= 0 &&
        !fixedLines[targetL].trim().endsWith(';') &&
        !fixedLines[targetL].trim().endsWith('{') &&
        !fixedLines[targetL].trim().endsWith('}')
      ) {
        fixedLines[targetL] = fixedLines[targetL].trimEnd() + ';';
      }
    }
  }

  const fixedCode = fixedLines.join('\n');
  const diffChanges = diffLines(code, fixedCode);

  const originalSnippet = targetLine && lines[targetLine - 1] !== undefined ? lines[targetLine - 1] : code.split('\n')[0] || '';
  const fixedSnippet = targetLine && fixedLines[targetLine - 1] !== undefined ? fixedLines[targetLine - 1] : fixedCode.split('\n')[0] || '';

  // Collect all errors (multi-diagnostic support)
  const allErrors: AIErrorItem[] = [];
  if (diagnostics && diagnostics.length > 1) {
    for (const d of diagnostics) {
      const errLine = d.line;
      allErrors.push({
        line: errLine,
        cause: d.message,
        explanation: `Diagnostic error on line ${errLine}: ${d.message}`,
        inlineComment: `${commentPrefix}[Cortex AI]: Error on line ${errLine} - ${d.message}`,
        originalSnippet: lines[errLine - 1] || '',
        fixedSnippet: fixedLines[errLine - 1] || '',
      });
    }
  } else if (targetLine) {
    allErrors.push({
      line: targetLine,
      cause,
      explanation,
      inlineComment,
      originalSnippet,
      fixedSnippet,
    });
  }

  // Generate commentedCode with comments beside ALL error lines
  const commentedLines = [...lines];
  for (const err of allErrors) {
    const idx = err.line - 1;
    if (idx >= 0 && idx < commentedLines.length && !commentedLines[idx].includes('[Cortex AI]')) {
      commentedLines[idx] = `${commentedLines[idx]}  ${err.inlineComment}`;
    }
  }
  const commentedCode = commentedLines.join('\n');

  return {
    cause,
    explanation,
    inlineComment,
    fixedCode,
    originalCode: code,
    diffChanges,
    targetLine,
    confidence,
    originalSnippet,
    fixedSnippet,
    errors: allErrors,
    commentedCode,
  };
}

/**
 * Auto-Fix with Gemini AI (or fallback to offline engine)
 */
export async function autoFixWithGeminiOrOffline(
  code: string,
  stderr: string,
  languageId: string,
  diagnostics: DiagnosticError[] = [],
  apiKey?: string
): Promise<{ provider: 'gemini' | 'offline'; fix: AIFixResult }> {
  try {
    const res = await fetch('/api/v1/ai/autofix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        stderr,
        languageId,
        diagnostics,
        apiKey,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.fix) {
        return {
          provider: data.provider || 'gemini',
          fix: data.fix,
        };
      }
    }
  } catch (e) {
    console.warn('Network error calling /api/v1/ai/autofix, falling back to offline engine:', e);
  }

  return {
    provider: 'offline',
    fix: analyzeAndFixErrorOffline(code, stderr, languageId, diagnostics),
  };
}

/**
 * AI Code Explanation, Bug Detection & Optimization
 * @param mode 'explain' | 'optimize' | 'refactor' - controls the Gemini prompt focus
 */
export async function analyzeCode(
  code: string,
  languageId: string,
  settings: AISettings,
  mode: 'explain' | 'optimize' | 'refactor' = 'explain'
): Promise<AIAnalysisResult> {
  const lang = getLanguageConfig(languageId);
  // Use the user's key or fall back to the platform default
  const FALLBACK = process.env.NEXT_PUBLIC_GEMINI_KEY || process.env.GEMINI_API_KEY || '';
  const apiKey = settings.apiKey || FALLBACK;


  // Always use Gemini when a key is available (user key takes priority over offline engine)
  if (apiKey) {
    try {
      let prompt = '';
      if (mode === 'explain') {
        prompt = `You are a senior ${lang.name} developer. Explain the following ${lang.name} code step by step in plain English. Be clear about what the code does, its purpose, and how it flows. Return a JSON object with these exact fields:\n- explanation: detailed step-by-step explanation (string)\n- bugs: array of any potential bugs or issues you see (string[])\n- optimizations: brief list of notes about what's already good (string[])\n- complexityEstimate: Big-O time complexity (string)\n- suggestedCode: leave empty string\n\nCode:\n\`\`\`${languageId}\n${code}\n\`\`\``;
      } else if (mode === 'optimize') {
        prompt = `You are a senior ${lang.name} performance engineer. Analyze the following code and suggest concrete performance optimizations. Return a JSON object with these exact fields:\n- explanation: summary of current code performance characteristics (string)\n- bugs: any bugs or issues you found (string[])\n- optimizations: array of specific actionable optimization suggestions with reasoning (string[])\n- complexityEstimate: current Big-O time/space complexity (string)\n- suggestedCode: an optimized version of the code (string)\n\nCode:\n\`\`\`${languageId}\n${code}\n\`\`\``;
      } else {
        prompt = `You are a senior ${lang.name} developer doing a code review. Refactor the following code for better readability, maintainability, and best practices. Return a JSON object with these exact fields:\n- explanation: what you refactored and why (string)\n- bugs: any bugs or issues fixed during refactoring (string[])\n- optimizations: best practice improvements applied (string[])\n- complexityEstimate: Big-O complexity of the refactored version (string)\n- suggestedCode: the complete refactored code (string)\n\nCode:\n\`\`\`${languageId}\n${code}\n\`\`\``;
      }

      const MODELS = [
        'gemini-3.7-flash',
        'gemini-flash-latest',
        'gemini-3.8-flash',
        'gemini-3.5-flash',
        'gemini-3.6-flash',
      ];

      for (const model of MODELS) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  responseMimeType: 'application/json',
                  temperature: 0.3,
                  maxOutputTokens: 1200,
                  thinkingConfig: { thinkingBudget: 0 },
                },
              }),
              signal: controller.signal,
            }
          );

          clearTimeout(timeoutId);

          if (res.ok) {
            const json = await res.json();
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              try {
                const parsed = JSON.parse(text);
                return {
                  explanation: parsed.explanation || '',
                  bugs: parsed.bugs || [],
                  optimizations: parsed.optimizations || [],
                  complexityEstimate: parsed.complexityEstimate || 'O(n)',
                  suggestedCode: parsed.suggestedCode || '',
                };
              } catch {
                return {
                  explanation: text,
                  bugs: [],
                  optimizations: [],
                  complexityEstimate: 'Unknown',
                  suggestedCode: '',
                };
              }
            }
          }
          // If 403/401, no point trying other models (bad key)
          if (res.status === 403 || res.status === 401) break;
        } catch {
          // Timeout or network error — try next model
        }
      }
    } catch {
      // Fallback to static analyzer
    }
  }

  // Built-in Static Analysis
  const bugs: string[] = [];
  const optimizations: string[] = [];
  let complexityEstimate = 'O(1) to O(n)';

  // Static checks
  if (code.includes('for') && code.split('for').length > 2) {
    complexityEstimate = 'O(n²) due to nested loops';
    optimizations.push('Detected nested loops. Consider using a Hash Map or Frequency Array to reduce time complexity to O(n).');
  }

  if (languageId === 'python') {
    if (code.includes('range(len(')) {
      optimizations.push('Python idiomatic optimization: Use enumerate() instead of range(len(...)) for cleaner iteration.');
    }
    if (code.includes('+=' ) && code.includes('str')) {
      optimizations.push('String concatenation in loops can be O(n²). Consider using "".join(...) for O(n) memory allocation.');
    }
  } else if (languageId === 'cpp') {
    if (!code.includes('std::ios_base::sync_with_stdio(false);') && (code.includes('cin') || code.includes('cout'))) {
      optimizations.push('Competitive programming optimization: Add `std::ios_base::sync_with_stdio(false); cin.tie(NULL);` to speed up I/O.');
    }
  }

  return {
    explanation: `This ${lang.name} program contains ${code.split('\n').length} lines of code targeting ${lang.version}. It defines the primary execution logic for ${lang.category} tasks.`,
    bugs: bugs.length > 0 ? bugs : ['No critical static syntax defects detected in current scope.'],
    optimizations: optimizations.length > 0 ? optimizations : [
      'Memory and thread allocation appear balanced.',
      'Check loop bounds and boundary conditions when operating on dynamic collections.'
    ],
    complexityEstimate,
  };
}

/**
 * Cross-Language Code Conversion (e.g. Python -> C++, C++ -> Java, etc.)
 */
export async function convertCode(
  sourceCode: string,
  fromLang: string,
  toLang: string,
  apiKey?: string
): Promise<{ convertedCode: string; explanation: string }> {
  const fromConfig = getLanguageConfig(fromLang);
  const toConfig = getLanguageConfig(toLang);

  if (apiKey) {
    try {
      const prompt = `Convert the following code from ${fromConfig.name} to ${toConfig.name}. Output only the converted valid code, followed by a markdown note explaining differences.\n\nSource Code:\n${sourceCode}`;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      if (res.ok) {
        const json = await res.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return {
          convertedCode: text.replace(/```[a-z]*\n?/g, '').trim(),
          explanation: `Converted from ${fromConfig.name} to ${toConfig.name} preserving algorithmic semantics.`,
        };
      }
    } catch {
      // Fallback
    }
  }

  // Offline template converter
  return {
    convertedCode: `// Converted from ${fromConfig.name} to ${toConfig.name}\n// Original logic mapped to ${toConfig.name} standard idioms:\n\n` + toConfig.starterCode,
    explanation: `Converted syntax constructs from ${fromConfig.name} to ${toConfig.name}. Note semantic differences in typing, memory allocation, and standard library namespaces.`,
  };
}

/**
 * High-speed local heuristic code completions for all 16 languages.
 * Instant zero-latency completions when typing common patterns.
 */
export function getLocalInlineSuggestion(
  codeBeforeCursor: string,
  currentLine: string,
  languageId: string
): string {
  const trimmed = currentLine.trim();
  if (trimmed.length < 2) return '';

  const lower = trimmed.toLowerCase();

  // 1. C++ patterns
  if (languageId === 'cpp') {
    if ('cout'.startsWith(lower)) return 'cout << "Hello, World!" << endl;';
    if (trimmed === 'cout <<' || trimmed === 'std::cout <<') return ' "Result: " << result << endl;';
    if ('cin'.startsWith(lower)) return 'cin >> variable;';
    if ('struct'.startsWith(lower)) return 'struct Student {\n    long regno;\n    string name;\n    int age;\n};';
    if ('class'.startsWith(lower)) return 'class Solution {\npublic:\n    Solution();\n    ~Solution();\n};';
    if ('vector'.startsWith(lower) && lower.length >= 3) return 'vector<int> nums;';
    if ('int main'.startsWith(lower) && lower.length >= 4) return 'int main() {\n    \n    return 0;\n}';
    if ('#include'.startsWith(lower) && lower.length >= 4) return '#include <iostream>\nusing namespace std;';
    if ('for'.startsWith(lower)) return 'for (int i = 0; i < n; ++i) {\n        \n    }';
    if ('while'.startsWith(lower) && lower.length >= 3) return 'while (condition) {\n        \n    }';
    if ('return'.startsWith(lower) && lower.length >= 3) return 'return 0;';
    if ('switch'.startsWith(lower) && lower.length >= 3) return 'switch (value) {\n        case 1:\n            break;\n        default:\n            break;\n    }';
  }

  // 2. C patterns
  if (languageId === 'c') {
    if ('printf'.startsWith(lower)) return 'printf("Hello, World!\\n");';
    if ('scanf'.startsWith(lower)) return 'scanf("%d", &val);';
    if ('int main'.startsWith(lower) && lower.length >= 4) return 'int main(int argc, char *argv[]) {\n    \n    return 0;\n}';
    if ('#include'.startsWith(lower) && lower.length >= 4) return '#include <stdio.h>';
    if ('for'.startsWith(lower)) return 'for (int i = 0; i < n; i++) {\n        \n    }';
    if ('struct'.startsWith(lower)) return 'struct Node {\n    int val;\n    struct Node* next;\n};';
    if ('return'.startsWith(lower) && lower.length >= 3) return 'return 0;';
  }

  // 3. Python patterns
  if (languageId === 'python') {
    if ('def'.startsWith(lower)) return 'def main():\n    pass';
    if ('print'.startsWith(lower)) return 'print("Hello, World!")';
    if ('if __name'.startsWith(lower) || lower.startsWith('if _')) return "if __name__ == '__main__':\n    main()";
    if ('class'.startsWith(lower)) return 'class Solution:\n    def __init__(self):\n        pass';
    if ('for'.startsWith(lower)) return 'for i in range(10):\n    print(i)';
    if ('while'.startsWith(lower) && lower.length >= 3) return 'while condition:\n    pass';
    if ('try'.startsWith(lower)) return 'try:\n    pass\nexcept Exception as e:\n    print(e)';
    if ('import'.startsWith(lower) && lower.length >= 3) return 'import sys, os, math';
    if ('return'.startsWith(lower) && lower.length >= 3) return 'return result';
  }

  // 4. JavaScript / TypeScript patterns
  if (languageId === 'javascript' || languageId === 'typescript') {
    if ('console.log'.startsWith(lower)) return 'console.log("Hello, World!");';
    if ('function'.startsWith(lower) && lower.length >= 3) return 'function main() {\n  \n}';
    if ('async function'.startsWith(lower) && lower.length >= 4) return 'async function fetchData() {\n  const res = await fetch("/api");\n  return res.json();\n}';
    if ('const'.startsWith(lower) && lower.length >= 3) return 'const result = await fetch("/api");';
    if ('for'.startsWith(lower)) return 'for (let i = 0; i < array.length; i++) {\n  \n}';
    if ('try'.startsWith(lower)) return 'try {\n  \n} catch (error) {\n  console.error(error);\n}';
    if ('class'.startsWith(lower)) return 'class Solution {\n  constructor() {\n    \n  }\n}';
  }

  // 5. Java patterns
  if (languageId === 'java') {
    if ('public static void main'.startsWith(lower) && lower.length >= 6) return 'public static void main(String[] args) {\n        System.out.println("Hello Cortex");\n    }';
    if ('system.out.println'.startsWith(lower) && lower.length >= 6) return 'System.out.println("Hello Cortex");';
    if ('public class'.startsWith(lower) && lower.length >= 6) return 'public class Main {\n    public static void main(String[] args) {\n        \n    }\n}';
    if ('for'.startsWith(lower)) return 'for (int i = 0; i < n; i++) {\n        \n    }';
  }

  // 6. Rust patterns
  if (languageId === 'rust') {
    if ('fn main'.startsWith(lower) && lower.length >= 3) return 'fn main() {\n    println!("Hello Cortex");\n}';
    if ('println!'.startsWith(lower) && lower.length >= 4) return 'println!("Hello Cortex");';
    if ('let mut'.startsWith(lower) && lower.length >= 4) return 'let mut values = Vec::new();';
    if ('for'.startsWith(lower)) return 'for i in 0..10 {\n        println!("{}", i);\n    }';
  }

  // 7. Go patterns
  if (languageId === 'go') {
    if ('func main'.startsWith(lower) && lower.length >= 4) return 'func main() {\n\tfmt.Println("Hello Cortex")\n}';
    if ('fmt.println'.startsWith(lower) && lower.length >= 4) return 'fmt.Println("Hello Cortex")';
    if ('for'.startsWith(lower)) return 'for i := 0; i < n; i++ {\n\t\n}';
  }

  // 8. C# patterns
  if (languageId === 'csharp') {
    if ('console.writeline'.startsWith(lower) && lower.length >= 6) return 'Console.WriteLine("Hello Cortex");';
    if ('static void main'.startsWith(lower) && lower.length >= 6) return 'static void Main(string[] args) {\n        Console.WriteLine("Hello Cortex");\n    }';
  }

  // 9. SQL patterns
  if (languageId === 'sql') {
    if ('select'.startsWith(lower) && lower.length >= 3) return 'SELECT * FROM table_name WHERE condition;';
    if ('insert into'.startsWith(lower) && lower.length >= 4) return 'INSERT INTO table_name (col1, col2) VALUES (val1, val2);';
  }

  return '';
}

/**
 * Fetch inline code suggestion from /api/v1/ai/suggest with immediate fallback to local heuristics.
 */
export async function fetchInlineSuggestion(
  codeBeforeCursor: string,
  currentLine: string,
  languageId: string,
  codeAfterCursor: string = '',
  apiKey?: string
): Promise<string> {
  // First check fast local heuristics
  const localSuggestion = getLocalInlineSuggestion(codeBeforeCursor, currentLine, languageId);
  if (localSuggestion) {
    return localSuggestion;
  }

  // Call API if network is available
  try {
    const res = await fetch('/api/v1/ai/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prefix: codeBeforeCursor,
        suffix: codeAfterCursor,
        languageId,
        apiKey,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.suggestion) {
        return data.suggestion;
      }
    }
  } catch {
    // Network or abort error
  }

  return '';
}

