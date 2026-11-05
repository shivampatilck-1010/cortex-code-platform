'use client';

import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Sparkles, 
  Plus, 
  Settings, 
  Lock, 
  Unlock, 
  Check, 
  CheckCircle2, 
  X, 
  ChevronDown,
  ChevronUp,
  Search,
  UserMinus
} from 'lucide-react';
import { 
  ClassroomTeamSettings, 
  ProjectTeam, 
  ProjectTeamMember, 
  ThemePresetId,
  TeamFormationMode,
  TeamThemePolicy,
  TeamMemberRole 
} from '@/lib/classroom/models';
import { THEME_PRESETS } from './theme-presets';

interface StudioStudent {
  userId: string;
  name: string;
  email: string;
  role: string;
}

interface TeamWithMembers extends ProjectTeam {
  members: ProjectTeamMember[];
  max_size?: number;
}

interface TeamFormationStudioViewProps {
  classroomId: string;
  stats: {
    totalStudents: number;
    assignedStudents: number;
    unassignedStudents: number;
    totalTeams: number;
    avgTeamSize: number;
  };
  settings: ClassroomTeamSettings;
  teams: TeamWithMembers[];
  unassignedStudents: StudioStudent[];
  getAuthHeaders: () => Record<string, string>;
  showToast: (msg: string) => void;
  onRefresh: () => void;
}

export function TeamFormationStudioView({
  classroomId,
  stats,
  settings,
  teams,
  unassignedStudents,
  getAuthHeaders,
  showToast,
  onRefresh,
}: TeamFormationStudioViewProps) {
  // UI Tabs / Collapsibles
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAutoAssignModalOpen, setIsAutoAssignModalOpen] = useState(false);
  const [isCreateTeamModalOpen, setIsCreateTeamModalOpen] = useState(false);

  // Settings State Form
  const [settingsForm, setSettingsForm] = useState({
    formationMode: (settings.formationMode || 'teacher_controlled') as TeamFormationMode,
    minTeamSize: settings.minTeamSize || 2,
    maxTeamSize: settings.maxTeamSize || 6,
    joiningPolicy: settings.joiningPolicy || 'direct',
    themePolicy: (settings.themePolicy || 'all_members') as TeamThemePolicy,
    allowMultipleTeams: settings.allowMultipleTeams || false,
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Auto-Assign Preview & Publish State
  const [autoAssignType, setAutoAssignType] = useState<'teams_count' | 'team_size'>('teams_count');
  const [autoAssignValue, setAutoAssignValue] = useState<number>(4);
  const [isPreviewingAutoAssign, setIsPreviewingAutoAssign] = useState(false);
  const [autoAssignPreview, setAutoAssignPreview] = useState<{
    previewToken: string;
    distribution: {
      totalStudents: number;
      teamCount: number;
      teams: {
        teamIndex: number;
        name: string;
        studentCount: number;
        studentIds: string[];
        students: { id: string; name: string; email: string }[];
      }[];
    };
  } | null>(null);
  const [isPublishingAutoAssign, setIsPublishingAutoAssign] = useState(false);

  // Manual Assignment State
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [targetTeamId, setTargetTeamId] = useState<string>('');
  const [unassignedSearch, setUnassignedSearch] = useState('');
  const [isAssigningManual, setIsAssigningManual] = useState(false);

  // Create Team Form State
  const [createTeamForm, setCreateTeamForm] = useState({
    name: '',
    project_title: '',
    description: '',
    max_size: 5,
    repo_url: '',
    theme_preset_id: 'cortex_signature' as ThemePresetId,
  });
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);

  // Filter unassigned students
  const filteredUnassigned = useMemo(() => {
    if (!unassignedSearch.trim()) return unassignedStudents;
    const q = unassignedSearch.toLowerCase().trim();
    return unassignedStudents.filter(
      (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    );
  }, [unassignedStudents, unassignedSearch]);

  // Handle Save Settings
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const res = await fetch(`/api/v1/classrooms/${classroomId}/teams/settings`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          formation_mode: settingsForm.formationMode,
          min_team_size: settingsForm.minTeamSize,
          max_team_size: settingsForm.maxTeamSize,
          joining_policy: settingsForm.joiningPolicy,
          theme_policy: settingsForm.themePolicy,
          allow_multiple_teams: settingsForm.allowMultipleTeams,
        }),
      });
      const data = await res.json();
      if (res.ok && data.settings) {
        showToast('Formation settings updated successfully');
        setIsSettingsOpen(false);
        onRefresh();
      } else {
        showToast(data.error || 'Failed to update formation settings');
      }
    } catch {
      showToast('Error updating formation settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Handle Generate Auto-Assign Preview
  const handleGeneratePreview = async () => {
    setIsPreviewingAutoAssign(true);
    try {
      const res = await fetch(`/api/v1/classrooms/${classroomId}/teams/auto-assign/preview`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          target_type: autoAssignType,
          target_value: Number(autoAssignValue),
        }),
      });
      const data = await res.json();
      if (res.ok && data.previewToken) {
        setAutoAssignPreview(data);
      } else {
        showToast(data.error || 'Failed to generate auto-assignment preview');
      }
    } catch {
      showToast('Error generating auto-assignment preview');
    } finally {
      setIsPreviewingAutoAssign(false);
    }
  };

  // Handle Publish Auto-Assign
  const handlePublishAutoAssign = async () => {
    if (!autoAssignPreview) return;
    setIsPublishingAutoAssign(true);
    try {
      const res = await fetch(`/api/v1/classrooms/${classroomId}/teams/auto-assign/publish`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          previewToken: autoAssignPreview.previewToken,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Formed ${data.createdTeamsCount} teams and assigned ${data.assignedStudentsCount} students!`);
        setIsAutoAssignModalOpen(false);
        setAutoAssignPreview(null);
        onRefresh();
      } else {
        showToast(data.error || 'Failed to publish teams');
      }
    } catch {
      showToast('Error publishing auto-assigned teams');
    } finally {
      setIsPublishingAutoAssign(false);
    }
  };

  // Handle Manual Assign
  const handleManualAssign = async () => {
    if (selectedStudentIds.length === 0 || !targetTeamId) {
      showToast('Select at least one student and a destination team');
      return;
    }
    setIsAssigningManual(true);
    try {
      const res = await fetch(`/api/v1/classrooms/${classroomId}/teams/${targetTeamId}/members`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          user_ids: selectedStudentIds,
          role: 'member',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Assigned ${data.added_count} student(s) to team`);
        setSelectedStudentIds([]);
        onRefresh();
      } else {
        showToast(data.error || 'Failed to assign students');
      }
    } catch {
      showToast('Error assigning students');
    } finally {
      setIsAssigningManual(false);
    }
  };

  // Toggle student selection
  const toggleStudentSelection = (userId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(userId) ? prev.filter((item) => item !== userId) : [...prev, userId]
    );
  };

  // Select all visible unassigned
  const toggleSelectAll = () => {
    if (selectedStudentIds.length === filteredUnassigned.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredUnassigned.map((s) => s.userId));
    }
  };

  // Handle Role Change
  const handleUpdateMemberRole = async (teamId: string, userId: string, newRole: TeamMemberRole) => {
    try {
      const res = await fetch(`/api/v1/classrooms/${classroomId}/teams/${teamId}/members/${userId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Updated role to ${newRole}`);
        onRefresh();
      } else {
        showToast(data.error || 'Failed to update member role');
      }
    } catch {
      showToast('Error updating member role');
    }
  };

  // Handle Remove Member
  const handleRemoveMember = async (teamId: string, userId: string) => {
    try {
      const res = await fetch(`/api/v1/classrooms/${classroomId}/teams/${teamId}/members/${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Member removed from team');
        onRefresh();
      } else {
        showToast(data.error || 'Failed to remove member');
      }
    } catch {
      showToast('Error removing member');
    }
  };

  // Handle Lock / Unlock Team
  const handleToggleLock = async (team: ProjectTeam) => {
    try {
      const res = await fetch(`/api/v1/classrooms/${classroomId}/teams/${team.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ is_locked: !team.isLocked }),
      });
      const data = await res.json();
      if (res.ok && data.team) {
        showToast(`Team roster ${data.team.is_locked ? 'locked' : 'unlocked'}`);
        onRefresh();
      } else {
        showToast(data.error || 'Failed to update team lock status');
      }
    } catch {
      showToast('Error toggling team lock');
    }
  };

  // Handle Create Team
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTeamForm.name.trim() || !createTeamForm.project_title.trim()) {
      showToast('Team name and project title are required');
      return;
    }
    setIsCreatingTeam(true);
    try {
      const res = await fetch(`/api/v1/classrooms/${classroomId}/teams`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(createTeamForm),
      });
      const data = await res.json();
      if (res.ok && data.team) {
        showToast(`Team '${data.team.name}' created`);
        setIsCreateTeamModalOpen(false);
        setCreateTeamForm({
          name: '',
          project_title: '',
          description: '',
          max_size: 5,
          repo_url: '',
          theme_preset_id: 'cortex_signature',
        });
        onRefresh();
      } else {
        showToast(data.error || 'Failed to create team');
      }
    } catch {
      showToast('Error creating team');
    } finally {
      setIsCreatingTeam(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-[#111216] border border-[#282A36] rounded-xl p-4">
          <div className="text-xs text-[#8A8F98]">Enrolled Students</div>
          <div className="text-2xl font-bold text-white mt-1">{stats.totalStudents}</div>
          <div className="text-[11px] text-[#666] mt-0.5">Total class roster</div>
        </div>

        <div className="bg-[#111216] border border-[#282A36] rounded-xl p-4">
          <div className="text-xs text-[#8A8F98]">Formed Teams</div>
          <div className="text-2xl font-bold text-[#FF9100] mt-1">{stats.totalTeams}</div>
          <div className="text-[11px] text-[#666] mt-0.5">Active team workspaces</div>
        </div>

        <div className="bg-[#111216] border border-[#282A36] rounded-xl p-4">
          <div className="text-xs text-[#8A8F98]">Assigned Students</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{stats.assignedStudents}</div>
          <div className="text-[11px] text-[#666] mt-0.5">
            {stats.totalStudents > 0
              ? `${Math.round((stats.assignedStudents / stats.totalStudents) * 100)}% allocated`
              : '0% allocated'}
          </div>
        </div>

        <div className="bg-[#111216] border border-[#282A36] rounded-xl p-4">
          <div className="text-xs text-[#8A8F98]">Unassigned</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">{stats.unassignedStudents}</div>
          <div className="text-[11px] text-[#666] mt-0.5">Pending team placement</div>
        </div>

        <div className="bg-[#111216] border border-[#282A36] rounded-xl p-4">
          <div className="text-xs text-[#8A8F98]">Avg Team Size</div>
          <div className="text-2xl font-bold text-cyan-400 mt-1">{stats.avgTeamSize}</div>
          <div className="text-[11px] text-[#666] mt-0.5">Members per active team</div>
        </div>
      </div>

      {/* Action / Toolbar */}
      <div className="bg-[#111216] border border-[#282A36] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setIsAutoAssignModalOpen(true)}
            className="px-4 py-2 rounded-lg bg-[#FF9100] hover:bg-[#FF9100]/90 text-black text-xs font-semibold transition flex items-center space-x-2 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Auto-Assign Students</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreateTeamModalOpen(true)}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-semibold border border-white/10 transition flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Team</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className={`px-3 py-2 rounded-lg text-xs font-medium border transition flex items-center space-x-2 ${
            isSettingsOpen
              ? 'bg-[#1C1E26] text-[#FF9100] border-[#FF9100]/40'
              : 'bg-[#14151B] text-[#A0A0A0] border-[#282A36] hover:text-white'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Formation Settings</span>
          {isSettingsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Expandable Formation Settings Panel */}
      {isSettingsOpen && (
        <div className="bg-[#14151B] border border-[#282A36] rounded-xl p-5 space-y-5 animate-fade-in">
          <div className="border-b border-[#282A36] pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Classroom Formation Settings</h3>
              <p className="text-xs text-[#8A8F98]">
                Configure how teams are formed, joined, sized, and themed in this classroom
              </p>
            </div>
            <span className="text-xs font-mono text-[#FF9100]">
              Mode: {settingsForm.formationMode}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Formation Mode */}
            <div>
              <label className="block text-xs font-medium text-[#A0A0A0] mb-1.5">Formation Mode</label>
              <select
                value={settingsForm.formationMode}
                onChange={(e) => setSettingsForm({ ...settingsForm, formationMode: e.target.value as any })}
                className="w-full bg-[#111216] border border-[#282A36] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF9100]"
              >
                <option value="teacher_controlled">Teacher-Controlled (Default)</option>
                <option value="teacher_created_student_selected">Teacher-Created, Student-Selected</option>
                <option value="student_created">Student-Created & Open</option>
              </select>
              <p className="text-[11px] text-[#666] mt-1">
                {settingsForm.formationMode === 'teacher_controlled' && 'Only teachers can form teams and assign members.'}
                {settingsForm.formationMode === 'teacher_created_student_selected' && 'Teacher sets up team slots; students choose which to join.'}
                {settingsForm.formationMode === 'student_created' && 'Students can create their own teams and invite peers.'}
              </p>
            </div>

            {/* Min & Max Size */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#A0A0A0] mb-1.5">Min Team Size</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={settingsForm.minTeamSize}
                  onChange={(e) => setSettingsForm({ ...settingsForm, minTeamSize: parseInt(e.target.value) || 1 })}
                  className="w-full bg-[#111216] border border-[#282A36] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF9100]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A0A0A0] mb-1.5">Max Team Size</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={settingsForm.maxTeamSize}
                  onChange={(e) => setSettingsForm({ ...settingsForm, maxTeamSize: parseInt(e.target.value) || 6 })}
                  className="w-full bg-[#111216] border border-[#282A36] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF9100]"
                />
              </div>
            </div>

            {/* Theme Policy */}
            <div>
              <label className="block text-xs font-medium text-[#A0A0A0] mb-1.5">Theme Studio Policy</label>
              <select
                value={settingsForm.themePolicy}
                onChange={(e) => setSettingsForm({ ...settingsForm, themePolicy: e.target.value as any })}
                className="w-full bg-[#111216] border border-[#282A36] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF9100]"
              >
                <option value="approval_required">All Team Members Can Customize</option>
                <option value="team_leader">Team Leader Only</option>
                <option value="teacher_controlled">Teacher & Admin Only</option>
              </select>
              <p className="text-[11px] text-[#666] mt-1">Controls who can apply presets from the Theme Studio.</p>
            </div>

            {/* Multiple Teams */}
            <div className="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="allow_mult"
                checked={settingsForm.allowMultipleTeams}
                onChange={(e) => setSettingsForm({ ...settingsForm, allowMultipleTeams: e.target.checked })}
                className="rounded border-[#282A36] bg-[#111216] text-[#FF9100] focus:ring-0"
              />
              <label htmlFor="allow_mult" className="text-xs text-[#A0A0A0] cursor-pointer">
                Allow students to belong to multiple teams concurrently
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-[#282A36]">
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={isSavingSettings}
              className="px-5 py-2 rounded-lg bg-[#FF9100] hover:bg-[#FF9100]/90 text-black text-xs font-semibold transition disabled:opacity-50"
            >
              {isSavingSettings ? 'Saving Settings...' : 'Save Formation Settings'}
            </button>
          </div>
        </div>
      )}

      {/* Manual Assignment Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Unassigned Students (5 cols) */}
        <div className="lg:col-span-5 bg-[#111216] border border-[#282A36] rounded-xl p-4 flex flex-col h-[650px]">
          <div className="border-b border-[#282A36] pb-3 mb-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Unassigned Students</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-mono">
                  {unassignedStudents.length}
                </span>
              </h3>
              {filteredUnassigned.length > 0 && (
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-[11px] text-[#FF9100] hover:underline font-medium"
                >
                  {selectedStudentIds.length === filteredUnassigned.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#666]" />
              <input
                type="text"
                placeholder="Filter unassigned..."
                value={unassignedSearch}
                onChange={(e) => setUnassignedSearch(e.target.value)}
                className="w-full bg-[#17181F] border border-[#282A36] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#666] focus:outline-none focus:border-[#FF9100]"
              />
            </div>
          </div>

          {/* Student Roster List */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {filteredUnassigned.length === 0 ? (
              <div className="py-12 text-center text-[#666]">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400/40 mb-2" />
                <p className="text-xs">All enrolled students are assigned to teams</p>
              </div>
            ) : (
              filteredUnassigned.map((student) => {
                const isSelected = selectedStudentIds.includes(student.userId);
                return (
                  <div
                    key={student.userId}
                    onClick={() => toggleStudentSelection(student.userId)}
                    className={`p-2.5 rounded-lg border transition cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#1C1E26] border-[#FF9100]/60 ring-1 ring-[#FF9100]/20'
                        : 'bg-[#14151B] border-[#282A36] hover:border-[#3E4251]'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition ${
                          isSelected ? 'bg-[#FF9100] border-[#FF9100] text-black' : 'border-[#444]'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white">{student.name}</div>
                        <div className="text-[11px] text-[#8A8F98] font-mono">{student.email}</div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick-Assign Bar */}
          <div className="pt-3 border-t border-[#282A36] mt-3 space-y-2">
            <div className="text-xs text-[#8A8F98]">
              {selectedStudentIds.length} student(s) selected
            </div>
            <div className="flex items-center space-x-2">
              <select
                value={targetTeamId}
                onChange={(e) => setTargetTeamId(e.target.value)}
                className="flex-1 bg-[#17181F] border border-[#282A36] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF9100]"
              >
                <option value="">Select Target Team...</option>
                {teams
                  .filter((t) => !t.isLocked)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.members.length}/{t.max_size || settingsForm.maxTeamSize})
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={handleManualAssign}
                disabled={isAssigningManual || selectedStudentIds.length === 0 || !targetTeamId}
                className="px-3 py-1.5 rounded-lg bg-[#FF9100] hover:bg-[#FF9100]/90 text-black text-xs font-semibold transition disabled:opacity-50"
              >
                Assign
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Formed Teams Roster (7 cols) */}
        <div className="lg:col-span-7 bg-[#111216] border border-[#282A36] rounded-xl p-4 flex flex-col h-[650px]">
          <div className="border-b border-[#282A36] pb-3 mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Formed Teams & Rosters</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#282A36] text-[#A0A0A0] font-mono">
                  {teams.length}
                </span>
              </h3>
            </div>
          </div>

          {/* Teams list */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {teams.length === 0 ? (
              <div className="py-20 text-center text-[#666]">
                <Users className="w-10 h-10 mx-auto text-[#444] mb-3" />
                <p className="text-sm font-semibold text-[#8A8F98]">No teams created yet</p>
                <p className="text-xs text-[#666] mt-1">
                  Use &apos;Auto-Assign Students&apos; to automatically balance rosters or &apos;Create Team&apos; to set up custom slots
                </p>
              </div>
            ) : (
              teams.map((team) => {
                const maxSize = team.max_size || settingsForm.maxTeamSize;
                return (
                  <div
                    key={team.id}
                    className="bg-[#14151B] border border-[#282A36] rounded-lg p-3.5 space-y-3"
                  >
                    {/* Team Header */}
                    <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-white">{team.projectTitle}</span>
                          <span className="text-[11px] text-[#A0A0A0] font-mono">({team.name})</span>
                        </div>
                        <div className="text-[11px] text-[#666] mt-0.5">
                          Capacity: {team.members.length} / {maxSize} members
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleLock(team)}
                          title={team.isLocked ? 'Unlock team roster' : 'Lock team roster'}
                          className={`p-1.5 rounded text-xs transition ${
                            team.isLocked
                              ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                              : 'text-[#8A8F98] hover:text-white hover:bg-white/5'
                          }`}
                        >
                          {team.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Member List */}
                    <div className="space-y-1.5">
                      {team.members.map((member) => (
                        <div
                          key={member.id}
                          className="bg-[#17181F] border border-white/5 rounded px-2.5 py-1.5 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center space-x-2">
                            <div
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                member.teamRole === 'leader'
                                  ? 'bg-[#FF9100]/20 text-[#FF9100]'
                                  : 'bg-[#282A36] text-[#A0A0A0]'
                              }`}
                            >
                              {(member.userName || member.userId).slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <span className="text-white font-medium">{member.userName || member.userId}</span>
                              <span className="text-[10px] text-[#666] font-mono ml-2">
                                {member.userEmail || ''}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <select
                              value={member.teamRole}
                              onChange={(e) => handleUpdateMemberRole(team.id, member.userId, e.target.value as any)}
                              className="bg-[#111216] border border-[#282A36] rounded px-1.5 py-0.5 text-[10px] text-[#A0A0A0] focus:outline-none"
                            >
                              <option value="leader">Leader</option>
                              <option value="member">Member</option>
                            </select>

                            <button
                              type="button"
                              onClick={() => handleRemoveMember(team.id, member.userId)}
                              title="Remove from team"
                              className="text-[#666] hover:text-rose-400 p-0.5"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {team.members.length === 0 && (
                        <p className="text-[11px] text-[#666] italic py-2 text-center">
                          No members assigned to this team
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Auto-Assign Modal */}
      {isAutoAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#121318] border border-[#282A36] rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-[#282A36] flex items-center justify-between bg-[#17181F]">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-[#FF9100]/10 border border-[#FF9100]/30 flex items-center justify-center text-[#FF9100]">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Automated Team Balancing Studio</h3>
                  <p className="text-xs text-[#8A8F98]">
                    Partition students into balanced, equal-size project teams with verified distribution
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAutoAssignModalOpen(false);
                  setAutoAssignPreview(null);
                }}
                className="p-1.5 rounded-lg text-[#8A8F98] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#17181F] p-4 rounded-lg border border-[#282A36]">
                <div>
                  <label className="block text-xs font-medium text-[#A0A0A0] mb-1.5">Partitioning Target</label>
                  <select
                    value={autoAssignType}
                    onChange={(e) => {
                      setAutoAssignType(e.target.value as any);
                      setAutoAssignPreview(null);
                    }}
                    className="w-full bg-[#111216] border border-[#282A36] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF9100]"
                  >
                    <option value="teams_count">Specify Number of Teams</option>
                    <option value="team_size">Specify Target Team Size</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#A0A0A0] mb-1.5">
                    {autoAssignType === 'teams_count' ? 'Number of Teams' : 'Students per Team'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={autoAssignValue}
                    onChange={(e) => {
                      setAutoAssignValue(parseInt(e.target.value) || 1);
                      setAutoAssignPreview(null);
                    }}
                    className="w-full bg-[#111216] border border-[#282A36] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF9100]"
                  />
                </div>
              </div>

              {/* Generate Preview Action */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#8A8F98]">
                  Available candidates: {unassignedStudents.length} unassigned students
                </span>
                <button
                  type="button"
                  onClick={handleGeneratePreview}
                  disabled={isPreviewingAutoAssign || unassignedStudents.length === 0}
                  className="px-4 py-2 rounded-lg bg-[#FF9100] text-black text-xs font-semibold hover:bg-[#FF9100]/90 transition flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isPreviewingAutoAssign ? 'Calculating Distribution...' : 'Generate Distribution Preview'}</span>
                </button>
              </div>

              {/* Preview Distribution Breakdown */}
              {autoAssignPreview && (
                <div className="space-y-4 pt-4 border-t border-[#282A36]">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3.5 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-emerald-400">Balanced Distribution Verified</div>
                      <div className="text-[11px] text-[#A0A0A0] mt-0.5">
                        {autoAssignPreview.distribution.totalStudents} students distributed across {autoAssignPreview.distribution.teamCount} teams. Delta between any two teams is at most 1.
                      </div>
                    </div>
                    <span className="text-xs font-mono px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded font-semibold">
                      Delta &le; 1
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                    {autoAssignPreview.distribution.teams.map((t) => (
                      <div
                        key={t.teamIndex}
                        className="bg-[#17181F] border border-[#282A36] rounded-lg p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">{t.name}</span>
                          <span className="text-[11px] font-mono text-[#FF9100]">
                            {t.studentCount} students
                          </span>
                        </div>
                        <div className="text-[11px] text-[#8A8F98] line-clamp-2">
                          {t.students.map((s) => s.name).join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#282A36] bg-[#17181F] flex items-center justify-between">
              <div className="text-xs text-[#8A8F98]">
                Changes are committed only after you click &apos;Publish Teams&apos;
              </div>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAutoAssignModalOpen(false);
                    setAutoAssignPreview(null);
                  }}
                  className="px-4 py-2 rounded-lg text-xs text-[#A0A0A0] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePublishAutoAssign}
                  disabled={!autoAssignPreview || isPublishingAutoAssign}
                  className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-semibold transition disabled:opacity-50"
                >
                  {isPublishingAutoAssign ? 'Publishing Teams...' : 'Publish Teams'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Team Modal */}
      {isCreateTeamModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#121318] border border-[#282A36] rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-[#282A36] flex items-center justify-between bg-[#17181F]">
              <h3 className="text-base font-bold text-white">Create Project Team</h3>
              <button
                onClick={() => setIsCreateTeamModalOpen(false)}
                className="p-1.5 rounded-lg text-[#8A8F98] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#A0A0A0] mb-1">Team Identifier / Name</label>
                <input
                  type="text"
                  placeholder="e.g. Team Hyperion"
                  value={createTeamForm.name}
                  onChange={(e) => setCreateTeamForm({ ...createTeamForm, name: e.target.value })}
                  required
                  className="w-full bg-[#17181F] border border-[#282A36] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF9100]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A0A0A0] mb-1">Project Title</label>
                <input
                  type="text"
                  placeholder="e.g. Autonomous Multi-Agent Consensus Protocol"
                  value={createTeamForm.project_title}
                  onChange={(e) => setCreateTeamForm({ ...createTeamForm, project_title: e.target.value })}
                  required
                  className="w-full bg-[#17181F] border border-[#282A36] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF9100]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A0A0A0] mb-1">Project Description</label>
                <textarea
                  rows={3}
                  placeholder="Summary of research or engineering goals..."
                  value={createTeamForm.description}
                  onChange={(e) => setCreateTeamForm({ ...createTeamForm, description: e.target.value })}
                  className="w-full bg-[#17181F] border border-[#282A36] rounded-lg p-3 text-xs text-white focus:outline-none focus:border-[#FF9100]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#A0A0A0] mb-1">Max Capacity</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={createTeamForm.max_size}
                    onChange={(e) => setCreateTeamForm({ ...createTeamForm, max_size: parseInt(e.target.value) || 5 })}
                    className="w-full bg-[#17181F] border border-[#282A36] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF9100]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#A0A0A0] mb-1">Visual Theme</label>
                  <select
                    value={createTeamForm.theme_preset_id}
                    onChange={(e) => setCreateTeamForm({ ...createTeamForm, theme_preset_id: e.target.value as any })}
                    className="w-full bg-[#17181F] border border-[#282A36] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF9100]"
                  >
                    {Object.values(THEME_PRESETS).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A0A0A0] mb-1">Repository URL (Optional)</label>
                <input
                  type="url"
                  placeholder="https://github.com/org/repo"
                  value={createTeamForm.repo_url}
                  onChange={(e) => setCreateTeamForm({ ...createTeamForm, repo_url: e.target.value })}
                  className="w-full bg-[#17181F] border border-[#282A36] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF9100]"
                />
              </div>

              <div className="pt-3 border-t border-[#282A36] flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsCreateTeamModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs text-[#A0A0A0] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingTeam}
                  className="px-5 py-2 rounded-lg bg-[#FF9100] text-black text-xs font-semibold hover:bg-[#FF9100]/90 transition disabled:opacity-50"
                >
                  {isCreatingTeam ? 'Creating Team...' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
