const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '..', 'src', 'components', 'layout', 'Navbar.tsx');
let code = fs.readFileSync(targetPath, 'utf8');

const isCRLF = code.includes('\r\n');
const nl = isCRLF ? '\r\n' : '\n';

// 1. Add Activity icon import
if (!code.includes('Activity,')) {
  code = code.replace("import { Play, Bug, Sparkles, Share2, Settings, Terminal as TerminalIcon } from 'lucide-react';",
    "import { Play, Bug, Sparkles, Share2, Settings, Terminal as TerminalIcon, Activity } from 'lucide-react';");
}

// 2. Add NavbarProps
const propsTarget = `interface NavbarProps {
  currentLanguage: LanguageConfig;
  onLanguageChange: (lang: LanguageConfig) => void;
  onRun: () => void;
  isRunning: boolean;
  onDebug: () => void;
  isDebugging: boolean;
  autoFixEnabled: boolean;
  onToggleAutoFix: () => void;
  onOpenSettings: () => void;
  onOpenShare: () => void;
  projectName?: string;
}`.replace(/\n/g, nl);

const propsReplacement = `interface NavbarProps {
  currentLanguage: LanguageConfig;
  onLanguageChange: (lang: LanguageConfig) => void;
  onRun: () => void;
  isRunning: boolean;
  onDebug: () => void;
  isDebugging: boolean;
  autoFixEnabled: boolean;
  onToggleAutoFix: () => void;
  onOpenSettings: () => void;
  onOpenShare: () => void;
  projectName?: string;
  onVisualize?: () => void;
  isVisualizing?: boolean;
  layoutMode?: 'code' | 'visualize' | 'split';
  onLayoutModeChange?: (mode: 'code' | 'visualize' | 'split') => void;
}`.replace(/\n/g, nl);

code = code.replace(propsTarget, propsReplacement);

// 3. Destructure props
const destructureTarget = `export const Navbar: React.FC<NavbarProps> = ({
  currentLanguage,
  onLanguageChange,
  onRun,
  isRunning,
  onDebug,
  isDebugging,
  autoFixEnabled,
  onToggleAutoFix,
  onOpenSettings,
  onOpenShare,
}) => {`.replace(/\n/g, nl);

const destructureReplacement = `export const Navbar: React.FC<NavbarProps> = ({
  currentLanguage,
  onLanguageChange,
  onRun,
  isRunning,
  onDebug,
  isDebugging,
  autoFixEnabled,
  onToggleAutoFix,
  onOpenSettings,
  onOpenShare,
  onVisualize,
  isVisualizing = false,
  layoutMode = 'code',
  onLayoutModeChange,
}) => {`.replace(/\n/g, nl);

code = code.replace(destructureTarget, destructureReplacement);

// 4. Add Visualize button and Layout switch
const buttonTarget = `        {/* Simplified Debug Button */}`.replace(/\n/g, nl);
const buttonReplacement = `        {/* Visualize Button */}
        {onVisualize && (
          <button
            onClick={onVisualize}
            disabled={isVisualizing}
            className={\`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-heading font-bold border transition \${
              isVisualizing
                ? 'bg-[#06B6D4]/20 text-[#06B6D4] border-[#06B6D4]/50'
                : 'bg-[#15161b] hover:bg-[#1c1e24] text-[#06B6D4] border-[#06B6D4]/40 hover:border-[#06B6D4]'
            }\`}
            title="Execute and Trace Code Live"
          >
            <Activity className={\`w-3.5 h-3.5 \${isVisualizing ? 'animate-spin' : ''}\`} />
            <span className="hidden sm:inline">{isVisualizing ? 'Tracing...' : 'Visualize'}</span>
          </button>
        )}

        {/* Layout Switcher: Code | Split View | Visualize */}
        {onLayoutModeChange && (
          <div className="hidden md:flex items-center bg-[#15161b] p-0.5 rounded-md border border-[#2b2d35] text-[11px] font-mono">
            <button
              onClick={() => onLayoutModeChange('code')}
              className={\`px-2 py-0.5 rounded transition \${
                layoutMode === 'code' ? 'bg-[#2b2d35] text-white font-semibold' : 'text-[#71717A] hover:text-[#E4E4E7]'
              }\`}
              title="Code Only View"
            >
              Code
            </button>
            <button
              onClick={() => onLayoutModeChange('split')}
              className={\`px-2 py-0.5 rounded transition \${
                layoutMode === 'split' ? 'bg-[#06B6D4]/20 text-[#06B6D4] font-semibold' : 'text-[#71717A] hover:text-[#E4E4E7]'
              }\`}
              title="Split View (Code + Visualization)"
            >
              Split View
            </button>
            <button
              onClick={() => onLayoutModeChange('visualize')}
              className={\`px-2 py-0.5 rounded transition \${
                layoutMode === 'visualize' ? 'bg-[#2b2d35] text-white font-semibold' : 'text-[#71717A] hover:text-[#E4E4E7]'
              }\`}
              title="Full Visualization Workspace"
            >
              Visualize
            </button>
          </div>
        )}

        {/* Simplified Debug Button */}`.replace(/\n/g, nl);

code = code.replace(buttonTarget, buttonReplacement);

fs.writeFileSync(targetPath, code, 'utf8');
console.log('Successfully patched Navbar.tsx');
