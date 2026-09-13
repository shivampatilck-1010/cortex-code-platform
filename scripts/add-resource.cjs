const fs = require('fs');
let content = fs.readFileSync('src/app/classroom/page.tsx', 'utf8');

// 1. Add state for resource form
const resourceFormState = `
  const [newResourceForm, setNewResourceForm] = useState({
    name: '',
    type: 'pdf' as 'pdf' | 'link' | 'code' | 'notes' | 'dataset',
    url: '',
    description: ''
  });
`;
content = content.replace(/  const \[joinCodeInput, setJoinCodeInput\] = useState\(''\);\n/g, `  const [joinCodeInput, setJoinCodeInput] = useState('');\n${resourceFormState}`);

// 2. Add handler for creating a resource
const resourceHandler = `
  const handleCreateResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassroom) return;
    
    try {
      const res = await fetch(\`/api/v1/classrooms/\${selectedClassroom.id}/resources\`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newResourceForm),
      });
      const data = await res.json();
      if (res.ok && data.resource) {
        setResources(prev => [data.resource, ...prev]);
        setIsCreateResourceModalOpen(false);
        setNewResourceForm({ name: '', type: 'pdf', url: '', description: '' });
        showToast('Resource added successfully');
      } else {
        showToast(data.error || 'Failed to add resource');
      }
    } catch (err) {
      showToast('Error communicating with server');
    }
  };
`;
content = content.replace(/  \/\/ Handler: Create Assignment\n/g, `${resourceHandler}\n  // Handler: Create Assignment\n`);

// 3. Add the button in the Resources tab
const resourceButton = `
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white">Course Materials & Handouts</h3>
                      <p className="text-xs text-gray-400">
                        Syllabus, starter code repositories, lecture slide decks, and reference guides.
                      </p>
                    </div>
                    {currentUserRole === 'teacher' && !isArchived && (
                      <button
                        onClick={() => setIsCreateResourceModalOpen(true)}
                        className="px-4 py-2 rounded-xl bg-[#ff9100] text-black font-bold text-xs hover:bg-[#e08000] transition flex items-center space-x-1"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Resource</span>
                      </button>
                    )}
                  </div>
`;
content = content.replace(/<div className="flex items-center justify-between">\s*<div>\s*<h3 className="text-base font-bold text-white">Course Materials & Handouts<\/h3>[\s\S]*?<\/div>\s*<\/div>/, resourceButton);

// 4. Add the modal UI at the end
const resourceModal = `
      {/* Create Resource Modal */}
      {isCreateResourceModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f111a] border border-[#2a2e3d] rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-2">Add Resource</h2>
            <p className="text-[#8a91a6] text-sm mb-6">Upload a link, PDF, or reference guide for students.</p>
            
            <form onSubmit={handleCreateResource} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#8a91a6] mb-1">Resource Name</label>
                <input
                  type="text"
                  required
                  value={newResourceForm.name}
                  onChange={e => setNewResourceForm({...newResourceForm, name: e.target.value})}
                  className="w-full bg-[#161925] border border-[#2a2e3d] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                  placeholder="e.g. Chapter 1 Slides"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#8a91a6] mb-1">Type</label>
                  <select
                    value={newResourceForm.type}
                    onChange={e => setNewResourceForm({...newResourceForm, type: e.target.value as any})}
                    className="w-full bg-[#161925] border border-[#2a2e3d] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                  >
                    <option value="pdf">PDF</option>
                    <option value="link">Link</option>
                    <option value="code">Code Repo</option>
                    <option value="notes">Notes</option>
                    <option value="dataset">Dataset</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#8a91a6] mb-1">URL / Link</label>
                  <input
                    type="url"
                    required
                    value={newResourceForm.url}
                    onChange={e => setNewResourceForm({...newResourceForm, url: e.target.value})}
                    className="w-full bg-[#161925] border border-[#2a2e3d] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#8a91a6] mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={newResourceForm.description}
                  onChange={e => setNewResourceForm({...newResourceForm, description: e.target.value})}
                  className="w-full bg-[#161925] border border-[#2a2e3d] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="flex justify-end space-x-3 mt-8 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateResourceModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-[#161925] border border-[#2a2e3d] text-gray-300 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:from-cyan-400 hover:to-blue-400 transition"
                >
                  Add Resource
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
`;
content = content.replace(/(<div className="min-h-screen[^>]+>)/, '$1\n' + resourceModal);

fs.writeFileSync('src/app/classroom/page.tsx', content);
