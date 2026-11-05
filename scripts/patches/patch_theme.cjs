const fs = require('fs');
const file = 'src/components/classroom/TwoWorkspaceContainer.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /theme="vs-dark"/g,
  'theme="cortex-dark"'
);

const onMountHook = '              onMount={(editor, monaco) => {\n' +
  '                monaco.editor.defineTheme(\'cortex-dark\', {\n' +
  '                  base: \'vs-dark\',\n' +
  '                  inherit: true,\n' +
  '                  rules: [\n' +
  '                    { token: \'comment\', foreground: \'6a9955\', fontStyle: \'italic\' },\n' +
  '                    { token: \'keyword\', foreground: \'ff9100\' },\n' +
  '                    { token: \'string\', foreground: \'ce9178\' },\n' +
  '                    { token: \'number\', foreground: \'b5cea8\' },\n' +
  '                    { token: \'type\', foreground: \'4ec9b0\' },\n' +
  '                  ],\n' +
  '                  colors: {\n' +
  '                    \'editor.background\': \'#0b0c0e\',\n' +
  '                    \'editor.foreground\': \'#e6edf3\',\n' +
  '                  },\n' +
  '                });\n' +
  '                editorRef.current = editor;\n' +
  '                onEditorReady?.(editor);\n' +
  '                setupYjsBinding(editor);\n' +
  '              }}';

content = content.replace(
  /onMount=\{\(editor\) => \{\s*editorRef\.current = editor;\s*onEditorReady\?\.\(editor\);\s*setupYjsBinding\(editor\);\s*\}\}/g,
  onMountHook
);

fs.writeFileSync(file, content, 'utf8');
