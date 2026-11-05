const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '..', 'src', 'components', 'live-class', 'modules', 'codestudio', 'CodeStudioModule.tsx');
let code = fs.readFileSync(targetPath, 'utf8');

const isCRLF = code.includes('\r\n');
const nl = isCRLF ? '\r\n' : '\n';

const target = "} from './codeExecutionEngine';";
const replacement = "} from './codeExecutionEngine';" + nl +
  "import { CodeVisualizationWorkspace } from '@/components/visualization/CodeVisualizationWorkspace';" + nl +
  "import { TraceSession } from '@/lib/visualization/types';";

code = code.replace(target, replacement);

fs.writeFileSync(targetPath, code, 'utf8');
console.log('Successfully added visualization imports to CodeStudioModule.tsx');
