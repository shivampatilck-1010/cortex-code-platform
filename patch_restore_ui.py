import sys

with open('src/app/classroom/page.tsx', 'r') as f:
    content = f.read()

# 1. State
state_target = "const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);"
state_replacement = state_target + "\n  const [isConfirmRestoreOpen, setIsConfirmRestoreOpen] = useState(false);"
content = content.replace(state_target, state_replacement)

# 2. Handler
handler_target = '''  const handleDeleteClassroom = async () => {'''
handler_replacement = '''  const handleRestoreClassroom = async () => {
    if (!selectedClassroom) return;
    try {
      const res = await fetch(/api/v1/classrooms/, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'restore' }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsConfirmRestoreOpen(false);
        setSelectedClassroom((prev) => prev ? { ...prev, status: 'active', joinEnabled: true } : null);
        setClassrooms((prev) => prev.map((c) => c.id === selectedClassroom.id ? { ...c, status: 'active', joinEnabled: true } : c));
        showToast('Classroom successfully restored to active status.');
      } else {
        showToast(data.error || 'Failed to restore classroom');
      }
    } catch {
      showToast('Error restoring classroom');
    }
  };

  const handleDeleteClassroom = async () => {'''
content = content.replace(handler_target, handler_replacement)

# 3. UI Button
ui_target = '''                        <span className="px-3 py-1.5 rounded-xl bg-[#212121] text-[#E5E5E5] text-xs font-semibold">
                          Archived
                        </span>'''
ui_replacement = '''                        <span className="px-3 py-1.5 rounded-xl bg-[#212121] text-[#E5E5E5] text-xs font-semibold">
                          Archived
                        </span>
                        <button
                          onClick={() => setIsConfirmRestoreOpen(true)}
                          className="px-4 py-2 rounded-xl bg-[#212121] hover:bg-emerald-500/20 text-emerald-500 hover:text-emerald-400 font-bold text-xs border border-[#525252] transition flex items-center space-x-2"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Restore</span>
                        </button>'''
content = content.replace(ui_target, ui_replacement)

# 4. Modal
modal_target = '''      {/* Confirmation Modal: Delete Classroom */}'''
modal_replacement = '''      {/* Confirmation Modal: Restore Classroom */}
      {isConfirmRestoreOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="neon-glass rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center space-x-3 text-[#FFFFFF]">
              <RefreshCw className="w-5 h-5 shrink-0 text-emerald-500" />
              <h4 className="text-sm font-bold text-white">Restore &ldquo;{selectedClassroom?.name}&rdquo;?</h4>
            </div>
            <p className="text-xs text-[#E5E5E5] leading-relaxed">
              Restoring the classroom will re-activate student postings, messaging, and enrollments. The classroom will be fully active again.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setIsConfirmRestoreOpen(false)}
                className="px-4 py-2 rounded-lg bg-[#0A0A0A] text-[#E5E5E5] hover:bg-[#212121] text-xs border border-[#525252]"
              >
                Cancel
              </button>
              <button
                onClick={handleRestoreClassroom}
                className="px-5 py-2 rounded-lg bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-black font-bold text-xs border border-emerald-500/40 transition"
              >
                Confirm Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Classroom */}'''
content = content.replace(modal_target, modal_replacement)

with open('src/app/classroom/page.tsx', 'w') as f:
    f.write(content)

print("UI patched.")
