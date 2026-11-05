const fs = require('fs');
const file = 'src/app/classroom/[roomId]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'const handleCodeChangeA = (code: string) => {',
  'const timeoutARef = useRef<NodeJS.Timeout | null>(null);\n  const handleCodeChangeA = useCallback((code: string) => {\n    if (!slotAUserId) return;\n    if (timeoutARef.current) clearTimeout(timeoutARef.current);\n    timeoutARef.current = setTimeout(() => {'
);

content = content.replace(
  '        };\n      });\n\n  };\n\n  const handleCodeChangeB = (code: string) => {',
  '        };\n      });\n    }, 800);\n  }, [slotAUserId]);\n\n  const timeoutBRef = useRef<NodeJS.Timeout | null>(null);\n  const handleCodeChangeB = useCallback((code: string) => {\n    if (!slotBUserId) return;\n    if (timeoutBRef.current) clearTimeout(timeoutBRef.current);\n    timeoutBRef.current = setTimeout(() => {'
);

content = content.replace(
  '        };\n      });\n\n  };\n\n  const handleLanguageChangeA = async (lang: string) => {',
  '        };\n      });\n    }, 800);\n  }, [slotBUserId]);\n\n  const handleLanguageChangeA = async (lang: string) => {'
);

fs.writeFileSync(file, content, 'utf8');
