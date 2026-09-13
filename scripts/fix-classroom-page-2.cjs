const fs = require('fs');
let code = fs.readFileSync('src/app/classroom/page.tsx', 'utf8');

const stateVars = `
  const [newResourceForm, setNewResourceForm] = React.useState({ name: '', type: 'link', url: '', description: '' });
  const handleCreateResource = async (e: any) => { e.preventDefault(); setIsCreateResourceModalOpen(false); };
`;

code = code.replace(/const \[isCreateResourceModalOpen, setIsCreateResourceModalOpen\] = useState\(false\);/, 
  'const [isCreateResourceModalOpen, setIsCreateResourceModalOpen] = useState(false);\n' + stateVars);

fs.writeFileSync('src/app/classroom/page.tsx', code);
console.log('Fixed handleCreateResource');
