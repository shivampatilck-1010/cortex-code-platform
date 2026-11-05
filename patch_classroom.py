import sys

with open('src/app/classroom/page.tsx', 'r') as f:
    content = f.read()

# 1. Deduplication Fix
dedup_target = '''  const filteredMembers = useMemo(() => {
    if (!selectedClassroom) return [];
    let members = selectedClassroom.members;
    if (searchMembers) {
      members = members.filter(m => m.userName.toLowerCase().includes(searchMembers.toLowerCase()) || m.userEmail?.toLowerCase().includes(searchMembers.toLowerCase()));
    }
    return members;
  }, [selectedClassroom, searchMembers]);'''

dedup_replacement = '''  const filteredMembers = useMemo(() => {
    if (!selectedClassroom) return [];
    
    const uniqueMap = new Map();
    selectedClassroom.members.forEach((m) => {
      const key = m.userEmail || m.userId;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, m);
      }
    });
    const uniqueMembers = Array.from(uniqueMap.values());
    
    if (searchMembers) {
      return uniqueMembers.filter(m => m.userName.toLowerCase().includes(searchMembers.toLowerCase()) || m.userEmail?.toLowerCase().includes(searchMembers.toLowerCase()));
    }
    return uniqueMembers;
  }, [selectedClassroom, searchMembers]);'''
content = content.replace(dedup_target, dedup_replacement)

# 2. State
state_target = "const [isConfirmArchiveOpen, setIsConfirmArchiveOpen] = useState(false);"
state_replacement = state_target + "\n  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);\n  const [isConfirmRestoreOpen, setIsConfirmRestoreOpen] = useState(false);"
content = content.replace(state_target, state_replacement)

# 3. Handlers
handler_target = '''  const handleArchiveClassroom = async () => {'''
handler_replacement = '''  const handleDeleteClassroom = async () => {
    if (!selectedClassroom) return;
    try {
      const res = await fetch(`/api/v1/classrooms/${selectedClassroom.id}?hard=true`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setIsConfirmDeleteOpen(false);
        setSelectedClassroom(null);
        setClassrooms((prev) => prev.filter((c) => c.id !== selectedClassroom.id));
        showToast('Classroom permanently deleted.');
      } else {
        showToast(data.error || 'Failed to delete classroom');
      }
    } catch {
      showToast('Error deleting classroom');
    }
  };

  const handleRestoreClassroom = async () => {
    if (!selectedClassroom) return;
    try {
      const res = await fetch(`/api/v1/classrooms/${selectedClassroom.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'restore' }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsConfirmRestoreOpen(false);
        setSelectedClassroom((prev) => prev ? { ...prev, status: 'active', joinEnabled: true } : null);
        setClassrooms((prev) => prev.map((c) => c.id === selectedClassroom.id ? { ...c, status: 'active', joinEnabled: true } : c));
        showToast('Classroom successfully restored.');
      } else {
        showToast(data.error || 'Failed to restore classroom');
      }
    } catch {
      showToast('Error restoring classroom');
    }
  };

  const handleArchiveClassroom = async () => {'''
content = content.replace(handler_target, handler_replacement)

# 4. Buttons
ui_target = '''                    ) : (
                      <span className="px-3 py-1.5 rounded-xl bg-gray-800 text-[#E5E5E5] text-xs font-semibold">
                        Already Archived
                      </span>
                    )}'''
ui_replacement = '''                    ) : (
                      <div className="flex items-center space-x-2">
                        <span className="px-3 py-1.5 rounded-xl bg-gray-800 text-[#E5E5E5] text-xs font-semibold">
                          Archived
                        </span>
                        <button
                          onClick={() => setIsConfirmRestoreOpen(true)}
                          className="px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold text-xs border border-emerald-500/20 transition flex items-center space-x-2"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Restore</span>
                        </button>
                        <button
                          onClick={() => setIsConfirmDeleteOpen(true)}
                          className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-xs border border-rose-500/20 transition flex items-center space-x-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}'''
content = content.replace(ui_target, ui_replacement)

# 5. Modals
modal_target = '''      {/* Modal: Publish Assignment */}'''
modal_replacement = '''      {/* Confirmation Modal: Restore Classroom */}
      {isConfirmRestoreOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14151d] border border-[#272a39] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-emerald-400">
              <RefreshCw className="w-5 h-5 shrink-0" />
              <h4 className="text-sm font-bold text-white">Restore &ldquo;{selectedClassroom?.name}&rdquo;?</h4>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Restoring the classroom will re-activate student postings, messaging, and enrollments.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setIsConfirmRestoreOpen(false)}
                className="px-4 py-2 rounded-lg bg-[#1e202c] text-gray-300 hover:bg-[#252837] text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleRestoreClassroom}
                className="px-5 py-2 rounded-lg bg-emerald-500 text-white font-bold hover:bg-emerald-600 text-xs"
              >
                Confirm Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Classroom */}
      {isConfirmDeleteOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14151d] border border-[#272a39] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400">
              <Trash2 className="w-5 h-5 shrink-0" />
              <h4 className="text-sm font-bold text-white">Permanently Delete &ldquo;{selectedClassroom?.name}&rdquo;?</h4>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              This action cannot be undone. All data associated with this classroom will be permanently destroyed.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setIsConfirmDeleteOpen(false)}
                className="px-4 py-2 rounded-lg bg-[#1e202c] text-gray-300 hover:bg-[#252837] text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteClassroom}
                className="px-5 py-2 rounded-lg bg-rose-500 text-white font-bold hover:bg-rose-600 text-xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Publish Assignment */}'''
content = content.replace(modal_target, modal_replacement)

with open('src/app/classroom/page.tsx', 'w') as f:
    f.write(content)

print("Classroom patched successfully.")
