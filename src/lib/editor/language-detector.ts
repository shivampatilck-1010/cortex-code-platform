/**
 * Centralized Language and File Type Detection Engine for Cortex IDE
 * Implements a 5-tier detection hierarchy:
 * 1. Explicit user override
 * 2. File extension matching (28+ extensions)
 * 3. Shebang inspection (e.g. #!/bin/bash, #!/usr/bin/env python3)
 * 4. Content heuristics (tags, SQL keywords, headers)
 * 5. Fallback to Plain Text or current active language
 */

export const EXTENSION_TO_LANGUAGE_MAP: Record<string, string> = {
  '.py': 'python',
  '.pyw': 'python',
  '.c': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.c++': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.java': 'java',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.mts': 'typescript',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.php': 'php',
  '.go': 'go',
  '.rs': 'rust',
  '.rb': 'ruby',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.swift': 'swift',
  '.cs': 'csharp',
  '.scala': 'scala',
  '.sc': 'scala',
  '.hs': 'haskell',
  '.exs': 'elixir',
  '.ex': 'elixir',
  '.fs': 'fsharp',
  '.fsx': 'fsharp',
  '.sql': 'sql',
  '.r': 'r',
  '.dart': 'dart',
  '.sh': 'bash',
  '.bash': 'bash',
  '.lua': 'lua',
  '.pl': 'perl',
  '.pm': 'perl',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.xml': 'xml',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.scss': 'css',
  '.svg': 'xml',
  '.toml': 'yaml',
  '.ini': 'yaml',
  '.txt': 'plaintext',
  '.log': 'plaintext',
};

export const MONACO_LANGUAGE_MAP: Record<string, string> = {
  python: 'python',
  py: 'python',
  c: 'c',
  cpp: 'cpp',
  java: 'java',
  javascript: 'javascript',
  js: 'javascript',
  typescript: 'typescript',
  ts: 'typescript',
  html: 'html',
  css: 'css',
  scss: 'scss',
  php: 'php',
  go: 'go',
  rust: 'rust',
  rs: 'rust',
  ruby: 'ruby',
  rb: 'ruby',
  kotlin: 'kotlin',
  kt: 'kotlin',
  swift: 'swift',
  csharp: 'csharp',
  cs: 'csharp',
  scala: 'scala',
  haskell: 'plaintext',
  hs: 'plaintext',
  elixir: 'plaintext',
  exs: 'plaintext',
  fsharp: 'fsharp',
  fs: 'fsharp',
  sql: 'sql',
  r: 'r',
  dart: 'dart',
  bash: 'shell',
  sh: 'shell',
  shell: 'shell',
  lua: 'lua',
  perl: 'perl',
  pl: 'perl',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml',
  svg: 'xml',
  markdown: 'markdown',
  md: 'markdown',
  toml: 'ini',
  ini: 'ini',
  plaintext: 'plaintext',
  txt: 'plaintext',
};

const SHEBANG_PATTERNS: Array<{ pattern: RegExp; lang: string }> = [
  { pattern: /^#!\s*\/.*python[0-9.]*/i, lang: 'python' },
  { pattern: /^#!\s*\/.*(?:bash|sh|zsh)/i, lang: 'bash' },
  { pattern: /^#!\s*\/.*perl/i, lang: 'perl' },
  { pattern: /^#!\s*\/.*lua/i, lang: 'lua' },
  { pattern: /^#!\s*\/.*(?:node|nodejs)/i, lang: 'javascript' },
  { pattern: /^#!\s*\/.*ruby/i, lang: 'ruby' },
  { pattern: /^#!\s*\/.*php/i, lang: 'php' },
  { pattern: /^#!\s*\/.*Rscript/i, lang: 'r' },
];

/**
 * Detect language from Shebang (Tier 3)
 */
export function detectLanguageFromShebang(content: string): string | null {
  if (!content || !content.trim()) return null;
  const firstLine = content.trim().split('\n')[0].trim();
  if (!firstLine.startsWith('#!')) return null;

  for (const { pattern, lang } of SHEBANG_PATTERNS) {
    if (pattern.test(firstLine)) {
      return lang;
    }
  }
  return null;
}

/**
 * Detect language from content heuristics (Tier 4)
 */
export function detectLanguageFromContentHeuristics(content: string): string | null {
  if (!content || !content.trim()) return null;
  const trimmed = content.trim();

  // 1. HTML / XML doctype or tags
  if (/^<!DOCTYPE\s+html/i.test(trimmed) || /<html[\s>]/i.test(trimmed)) {
    return 'html';
  }
  if (/^<\?xml/i.test(trimmed)) {
    return 'xml';
  }

  // 2. PHP open tag
  if (/^<\?php/i.test(trimmed)) {
    return 'php';
  }

  // 3. JSON check (starts with { or [ and valid syntax)
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // Not strictly JSON
    }
  }

  // 4. SQL statements
  if (/^(CREATE\s+TABLE|SELECT\s+.*FROM|INSERT\s+INTO|UPDATE\s+.*SET|DELETE\s+FROM|ALTER\s+TABLE|DROP\s+TABLE)/i.test(trimmed)) {
    return 'sql';
  }

  // 5. C/C++ includes
  if (/#include\s+<iostream>/i.test(trimmed) || /std::/i.test(trimmed)) {
    return 'cpp';
  }
  if (/#include\s+<stdio\.h>/i.test(trimmed)) {
    return 'c';
  }

  // 6. Shell commands
  if (/^(echo\s+|export\s+\w+=|if\s+\[|case\s+\$)/m.test(trimmed)) {
    return 'bash';
  }

  // 7. YAML
  if (/^---\s*$/m.test(trimmed)) {
    return 'yaml';
  }

  return null;
}

/**
 * Detect language from file content heuristics (Shebang + Content heuristics)
 */
export function detectLanguageFromContent(content: string): string | null {
  return detectLanguageFromShebang(content) || detectLanguageFromContentHeuristics(content);
}

/**
 * Detect language based on extension (Tier 2)
 */
export function detectLanguageFromFilename(filename: string): string | null {
  if (!filename) return null;
  const lower = filename.toLowerCase();
  
  // Find matching extension
  for (const [ext, lang] of Object.entries(EXTENSION_TO_LANGUAGE_MAP)) {
    if (lower.endsWith(ext)) {
      return lang;
    }
  }

  // Check dot-separated extension directly
  const dotIndex = lower.lastIndexOf('.');
  if (dotIndex !== -1) {
    const ext = lower.substring(dotIndex);
    if (EXTENSION_TO_LANGUAGE_MAP[ext]) {
      return EXTENSION_TO_LANGUAGE_MAP[ext];
    }
  }

  return null;
}

/**
 * Primary language detection function implementing the 5-tier priority:
 * Tier 1: Explicit user override
 * Tier 2: File extension matching (28+ extensions)
 * Tier 3: Shebang parsing (bash, python, perl, lua, node, ruby, php, r)
 * Tier 4: Content heuristics (HTML/XML, PHP, JSON parse check, SQL keywords, C/C++ includes, Shell commands, YAML)
 * Tier 5: Fallback to currentLanguage or 'python'
 */
export function detectLanguage(
  filename: string,
  content?: string,
  explicitOverride?: string,
  currentLanguage?: string
): string {
  // Tier 1: Explicit override
  if (explicitOverride && explicitOverride.trim()) {
    return explicitOverride.trim().toLowerCase();
  }

  // Tier 2: File extension match
  const fromExt = detectLanguageFromFilename(filename);
  if (fromExt) {
    return fromExt;
  }

  // Tier 3 & Tier 4: Shebang and content heuristics
  if (content) {
    const fromShebang = detectLanguageFromShebang(content);
    if (fromShebang) {
      return fromShebang;
    }

    const fromHeuristics = detectLanguageFromContentHeuristics(content);
    if (fromHeuristics) {
      return fromHeuristics;
    }
  }

  // Tier 5: Fallback
  return currentLanguage || 'python';
}

/**
 * Resolve Monaco editor language for a language ID or file extension
 */
export function getMonacoLanguage(langOrFilename: string): string {
  if (!langOrFilename) return 'plaintext';

  const lower = langOrFilename.toLowerCase().trim();
  
  // 1. Check if it's a known language ID or alias
  if (MONACO_LANGUAGE_MAP[lower]) {
    return MONACO_LANGUAGE_MAP[lower];
  }

  // 2. Explicit extension overrides take precedence for Monaco editor mapping
  // Handles both bare extensions ('.toml', '.ini', '.scss') and filenames ('config.toml')
  const dotIndex = lower.lastIndexOf('.');
  const ext = dotIndex !== -1 ? lower.substring(dotIndex) : (lower.startsWith('.') ? lower : '.' + lower);
  if (ext === '.scss') return 'scss';
  if (ext === '.toml' || ext === '.ini') return 'ini';
  if (ext === '.svg') return 'xml';
  if (ext === '.sh' || ext === '.bash') return 'shell';
  if (ext === '.yml' || ext === '.yaml') return 'yaml';
  if (ext === '.md' || ext === '.markdown') return 'markdown';

  // 3. Check if lower is an extension with or without dot
  if (lower.startsWith('.') && EXTENSION_TO_LANGUAGE_MAP[lower]) {
    const lang = EXTENSION_TO_LANGUAGE_MAP[lower];
    return MONACO_LANGUAGE_MAP[lang] || lang;
  }
  if (EXTENSION_TO_LANGUAGE_MAP['.' + lower]) {
    const lang = EXTENSION_TO_LANGUAGE_MAP['.' + lower];
    return MONACO_LANGUAGE_MAP[lang] || lang;
  }

  // 4. Check if it's a filename with specific extension
  if (dotIndex !== -1) {
    const detected = detectLanguageFromFilename(lower);
    if (detected && MONACO_LANGUAGE_MAP[detected]) {
      return MONACO_LANGUAGE_MAP[detected];
    }
  }

  return 'plaintext';
}
