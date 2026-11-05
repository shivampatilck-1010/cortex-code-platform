const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../');
const readmePath = path.join(rootDir, 'README.md');
const logoPath = path.join(rootDir, 'public/brand/cortex-logo-transparent.png');

const readmeMarkdown = fs.readFileSync(readmePath, 'utf8');
const logoBase64 = fs.readFileSync(logoPath).toString('base64');
const logoDataUri = `data:image/png;base64,${logoBase64}`;

// Replace logo path with embedded base64 data URI so it loads offline
const processedMarkdown = readmeMarkdown.replace(
  'src="public/brand/cortex-logo-transparent.png"',
  `src="${logoDataUri}"`
);

const htmlTemplate = `<!DOCTYPE html>
<html lang="en" data-color-mode="dark" data-dark-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cortex Universal Code Platform - README (GitHub Preview)</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.1/github-markdown-dark.min.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    body {
      background-color: #0d1117;
      color: #e6edf3;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
      margin: 0;
      padding: 0;
      line-height: 1.5;
    }

    /* GitHub Top Navigation Simulation */
    .github-topbar {
      background-color: #010409;
      border-bottom: 1px solid #30363d;
      padding: 14px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .repo-breadcrumbs {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      color: #8b949e;
    }
    .repo-breadcrumbs a {
      color: #4493f8;
      text-decoration: none;
      font-weight: 600;
    }
    .repo-breadcrumbs a:hover {
      text-decoration: underline;
    }
    .repo-badge {
      display: inline-block;
      padding: 2px 8px;
      font-size: 12px;
      font-weight: 600;
      line-height: 18px;
      border-radius: 2em;
      border: 1px solid #30363d;
      color: #8b949e;
      background-color: #161b22;
    }
    .topbar-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .btn-action {
      background-color: #21262d;
      border: 1px solid #30363d;
      color: #c9d1d9;
      padding: 5px 14px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s ease;
    }
    .btn-action:hover {
      background-color: #30363d;
      border-color: #8b949e;
    }
    .btn-primary {
      background-color: #238636;
      border-color: rgba(240, 246, 252, 0.1);
      color: #ffffff;
    }
    .btn-primary:hover {
      background-color: #2ea043;
    }

    /* File Header Card */
    .file-container {
      max-width: 1060px;
      margin: 28px auto 60px auto;
      padding: 0 16px;
    }
    .file-header {
      background-color: #161b22;
      border: 1px solid #30363d;
      border-bottom: none;
      border-top-left-radius: 6px;
      border-top-right-radius: 6px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 14px;
      color: #e6edf3;
      font-weight: 600;
    }
    .file-meta {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .file-icon {
      color: #8b949e;
    }

    /* Markdown Container */
    .markdown-body {
      background-color: #0d1117;
      border: 1px solid #30363d;
      border-bottom-left-radius: 6px;
      border-bottom-right-radius: 6px;
      padding: 40px 48px;
      box-sizing: border-box;
      color: #e6edf3;
    }
    .markdown-body table {
      display: table;
      width: 100%;
    }
    .markdown-body pre {
      background-color: #161b22 !important;
      border: 1px solid #30363d;
      border-radius: 6px;
    }
    .markdown-body blockquote {
      border-left: 4px solid #ff9100;
      color: #8b949e;
      background-color: rgba(255, 145, 0, 0.05);
      padding: 10px 16px;
      border-radius: 4px;
    }

    /* Mermaid Center Styling */
    .mermaid {
      background: #0d1117;
      padding: 20px;
      margin: 20px 0;
      border-radius: 8px;
      border: 1px solid #30363d;
      display: flex;
      justify-content: center;
    }

    @media print {
      .github-topbar, .file-header {
        display: none !important;
      }
      .file-container {
        margin: 0;
        max-width: 100%;
      }
      .markdown-body {
        border: none;
        padding: 0;
      }
    }
  </style>
</head>
<body>

  <!-- Simulated GitHub Navigation Bar -->
  <header class="github-topbar">
    <div class="repo-breadcrumbs">
      <svg height="18" viewBox="0 0 16 16" version="1.1" width="18" fill="currentColor">
        <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"></path>
      </svg>
      <a href="https://github.com/shivampatilck-1010">shivampatilck-1010</a>
      <span>/</span>
      <a href="https://github.com/shivampatilck-1010/cortex-code-platform">cortex-code-platform</a>
      <span class="repo-badge">Public</span>
    </div>
    <div class="topbar-actions">
      <button class="btn-action" onclick="window.print()">
        <svg height="14" viewBox="0 0 16 16" width="14" fill="currentColor"><path d="M4.5 0A2.5 2.5 0 0 0 2 2.5V5h12V2.5A2.5 2.5 0 0 0 11.5 0h-7ZM3.5 6A1.5 1.5 0 0 0 2 7.5v4A1.5 1.5 0 0 0 3.5 13H4v2.5A1.5 1.5 0 0 0 5.5 17h5a1.5 1.5 0 0 0 1.5-1.5V13h.5a1.5 1.5 0 0 0 1.5-1.5v-4A1.5 1.5 0 0 0 12.5 6h-9ZM5 12h6v3.5a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1-.5-.5V12Z"></path></svg>
        Print / PDF
      </button>
      <a class="btn-action btn-primary" href="https://github.com/shivampatilck-1010/cortex-code-platform" target="_blank" style="text-decoration:none;">
        View on GitHub &rarr;
      </a>
    </div>
  </header>

  <!-- Main Document Container -->
  <main class="file-container">
    <div class="file-header">
      <div class="file-meta">
        <svg class="file-icon" height="16" viewBox="0 0 16 16" width="16" fill="currentColor">
          <path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25ZM1.75 1.5a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25Z"></path><path d="M4.75 4a.75.75 0 0 0-.75.75v6.5c0 .414.336.75.75.75h6.5a.75.75 0 0 0 .75-.75v-6.5A.75.75 0 0 0 11.25 4Zm.75 1.5h5v5h-5Z"></path>
        </svg>
        <span>README.md</span>
        <span style="color: #8b949e; font-size: 12px; font-weight: normal;">&bull; 502 lines &bull; Commit 39692c5 &bull; Main Branch</span>
      </div>
      <div>
        <span style="font-size: 12px; color: #8b949e; font-family: monospace;">Markdown Rendered View</span>
      </div>
    </div>

    <!-- Rendered Markdown Body -->
    <article class="markdown-body" id="content">
      <!-- Markdown content rendered dynamically -->
    </article>
  </main>

  <script id="raw-markdown" type="text/markdown">${processedMarkdown.replace(/<\//g, '<\\/')}</script>

  <script>
    // Initialize Mermaid with GitHub dark theme
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        darkMode: true,
        background: '#0d1117',
        primaryColor: '#ff9100',
        primaryTextColor: '#ffffff',
        primaryBorderColor: '#ff9100',
        lineColor: '#58a6ff',
        secondaryColor: '#161b22',
        tertiaryColor: '#21262d'
      }
    });

    // Configure marked to handle code blocks and syntax highlighting
    marked.setOptions({
      highlight: function(code, lang) {
        if (lang === 'mermaid') {
          return '<div class="mermaid">' + code + '</div>';
        }
        if (hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
      },
      gfm: true,
      breaks: false
    });

    // Render markdown to HTML
    const rawMarkdown = document.getElementById('raw-markdown').textContent;
    const contentContainer = document.getElementById('content');
    contentContainer.innerHTML = marked.parse(rawMarkdown);

    // Fix up any mermaid code blocks rendered as <pre><code class="language-mermaid">
    document.querySelectorAll('pre code.language-mermaid').forEach(function(el) {
      const parent = el.parentElement;
      const mermaidDiv = document.createElement('div');
      mermaidDiv.className = 'mermaid';
      mermaidDiv.textContent = el.textContent;
      parent.replaceWith(mermaidDiv);
    });

    // Run Mermaid rendering
    setTimeout(function() {
      mermaid.run({
        querySelector: '.mermaid'
      });
    }, 100);
  </script>
</body>
</html>
`;

// Destination paths
const htmlOutputPath = path.join(rootDir, 'public/downloads/CORTEX_README_GITHUB_PREVIEW.html');
fs.writeFileSync(htmlOutputPath, htmlTemplate, 'utf8');

console.log('Successfully created CORTEX_README_GITHUB_PREVIEW.html at:', htmlOutputPath);
