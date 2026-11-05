'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Users, 
  Sparkles, 
  Palette, 
  Activity, 
  BookOpen, 
  RefreshCw,
  UserCheck
} from 'lucide-react';
import { ProjectGalleryView } from './ProjectGalleryView';
import { TeamFormationStudioView } from './TeamFormationStudioView';
import { ProjectActivityTimeline } from './ProjectActivityTimeline';
import { GalleryProjectCardData } from './ProjectCard';
import { 
  ClassroomTeamSettings, 
  ProjectTeam, 
  ProjectTeamMember, 
  ProjectActivityRecord,
  ThemePresetId 
} from '@/lib/classroom/models';
import { THEME_PRESETS } from './theme-presets';

interface TeamsTabProps {
  classroomId: string;
  currentUserId: string;
  currentUserRole: string;
  currentUserName: string;
  currentUserEmail: string;
  getAuthHeaders: () => Record<string, string>;
  showToast: (msg: string) => void;
}

export function TeamsTab({
  classroomId,
  currentUserId,
  currentUserRole,
  currentUserName,
  currentUserEmail,
  getAuthHeaders,
  showToast,
}: TeamsTabProps) {
  const isTeacherOrAdmin = currentUserRole === 'teacher' || currentUserRole === 'admin';

  // Sub-navigation state
  const [subTab, setSubTab] = useState<'gallery' | 'studio' | 'activity'>('gallery');

  // Core Data States
  const [isLoading, setIsLoading] = useState(true);
  const [cards, setCards] = useState<GalleryProjectCardData[]>([]);
  const [settings, setSettings] = useState<ClassroomTeamSettings | null>(null);
  const [activity, setActivity] = useState<ProjectActivityRecord[]>([]);
  const [studioStats, setStudioStats] = useState({
    totalStudents: 0,
    assignedStudents: 0,
    unassignedStudents: 0,
    totalTeams: 0,
    avgTeamSize: 0,
  });
  const [studioTeams, setStudioTeams] = useState<(ProjectTeam & { members: ProjectTeamMember[] })[]>([]);
  const [unassignedStudents, setUnassignedStudents] = useState<{ userId: string; name: string; email: string; role: string }[]>([]);

  // Create Team Modal State (Shared)
  const [isCreateTeamModalOpen, setIsCreateTeamModalOpen] = useState(false);
  const [createTeamForm, setCreateTeamForm] = useState({
    name: '',
    project_title: '',
    description: '',
    max_size: 5,
    repo_url: '',
    theme_preset_id: 'cortex_signature' as ThemePresetId,
  });
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Fetch full data bundle
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Gallery Cards
      const galleryRes = await fetch(`/api/v1/classrooms/${classroomId}/teams/gallery`, {
        headers: getAuthHeaders(),
      });
      const galleryData = await galleryRes.json();
      if (galleryRes.ok && galleryData.cards) {
        setCards(galleryData.cards);
      }

      // 2. Fetch Activity
      const activityRes = await fetch(`/api/v1/classrooms/${classroomId}/teams/activity`, {
        headers: getAuthHeaders(),
      });
      const activityData = await activityRes.json();
      if (activityRes.ok && activityData.activity) {
        setActivity(activityData.activity);
      }

      // 3. If Teacher, fetch Studio payload; else fetch Settings
      if (isTeacherOrAdmin) {
        const studioRes = await fetch(`/api/v1/classrooms/${classroomId}/teams/studio`, {
          headers: getAuthHeaders(),
        });
        const studioData = await studioRes.json();
        if (studioRes.ok && studioData.stats) {
          setStudioStats({
            totalStudents: studioData.stats.totalStudents || 0,
            assignedStudents: studioData.stats.assignedStudents ?? studioData.stats.assignedCount ?? 0,
            unassignedStudents: studioData.stats.unassignedStudents ?? studioData.stats.unassignedCount ?? 0,
            totalTeams: studioData.stats.totalTeams || 0,
            avgTeamSize: studioData.stats.avgTeamSize ?? studioData.stats.averageTeamSize ?? 0,
          });
          setSettings(studioData.settings);
          setStudioTeams(studioData.teams || []);
          setUnassignedStudents(studioData.unassignedStudents || []);
        }
      } else {
        const settingsRes = await fetch(`/api/v1/classrooms/${classroomId}/teams/settings`, {
          headers: getAuthHeaders(),
        });
        const settingsData = await settingsRes.json();
        if (settingsRes.ok && settingsData.settings) {
          setSettings(settingsData.settings);
        }
      }
    } catch {
      showToast('Error loading project teams data');
    } finally {
      setIsLoading(false);
    }
  }, [classroomId, getAuthHeaders, isTeacherOrAdmin, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Find user's current team (if student)
  const myTeam = useMemo(() => {
    return cards.find((c) => c.members.some((m) => m.userId === currentUserId));
  }, [cards, currentUserId]);

  const myTeamRole = useMemo(() => {
    if (!myTeam) return null;
    return myTeam.members.find((m) => m.userId === currentUserId)?.teamRole || 'member';
  }, [myTeam, currentUserId]);

  // Join Team Handler
  const handleJoinTeam = async (teamId: string) => {
    try {
      const res = await fetch(`/api/v1/classrooms/${classroomId}/teams/${teamId}/members`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          user_ids: [currentUserId],
          role: 'member',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Successfully joined team');
        loadData();
      } else {
        showToast(data.error || 'Failed to join team');
      }
    } catch {
      showToast('Error joining team');
    }
  };

  // Leave Team Handler
  const handleLeaveTeam = async (teamId: string) => {
    try {
      const res = await fetch(`/api/v1/classrooms/${classroomId}/teams/${teamId}/members/${currentUserId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('You have left the team');
        loadData();
      } else {
        showToast(data.error || 'Failed to leave team');
      }
    } catch {
      showToast('Error leaving team');
    }
  };

  // Create Team Submit (Mode C or Quick Modal)
  const handleCreateTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTeamForm.name.trim() || !createTeamForm.project_title.trim()) {
      showToast('Team name and project title are required');
      return;
    }
    setIsSubmittingCreate(true);
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
        loadData();
      } else {
        showToast(data.error || 'Failed to create team');
      }
    } catch {
      showToast('Error creating team');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Student Assigned Team Banner */}
      {!isTeacherOrAdmin && myTeam && (
        <div className="relative rounded-xl border border-[#282A36] bg-[#111216] p-4 overflow-hidden shadow-lg">
          <div
            className={`absolute inset-0 bg-gradient-to-r ${
              THEME_PRESETS[(myTeam.theme_preset_id as ThemePresetId) || 'cortex_signature']?.headerGradient ||
              'from-[#FF9100]/20 to-transparent'
            } opacity-50 pointer-events-none`}
          />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-[#FF9100]/20 border border-[#FF9100]/40 flex items-center justify-center text-[#FF9100]">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#FF9100]">
                    Your Project Team
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-[#A0A0A0] font-mono">
                    {myTeamRole?.toUpperCase()}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white mt-0.5">
                  {myTeam.project_title} <span className="text-xs text-[#8A8F98] font-mono">({myTeam.name})</span>
                </h4>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs text-[#8A8F98] font-mono">
                {myTeam.members.length} / {myTeam.max_size} members
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Navigation Header */}
      <div className="flex items-center justify-between border-b border-[#282A36] pb-3">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setSubTab('gallery')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-2 ${
              subTab === 'gallery'
                ? 'bg-[#1C1E26] text-[#FF9100] border border-[#FF9100]/30 shadow-sm'
                : 'text-[#8A8F98] hover:text-white hover:bg-white/5'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Project Gallery</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 font-mono">
              {cards.length}
            </span>
          </button>

          {isTeacherOrAdmin && (
            <button
              type="button"
              onClick={() => setSubTab('studio')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-2 ${
                subTab === 'studio'
                  ? 'bg-[#1C1E26] text-[#FF9100] border border-[#FF9100]/30 shadow-sm'
                  : 'text-[#8A8F98] hover:text-white hover:bg-white/5'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Formation Studio</span>
              {studioStats.unassignedStudents > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-400 font-mono">
                  {studioStats.unassignedStudents} unassigned
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setSubTab('activity')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-2 ${
              subTab === 'activity'
                ? 'bg-[#1C1E26] text-[#FF9100] border border-[#FF9100]/30 shadow-sm'
                : 'text-[#8A8F98] hover:text-white hover:bg-white/5'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Activity Log</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 font-mono">
              {activity.length}
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={isLoading}
          className="p-2 rounded-lg text-[#8A8F98] hover:text-white hover:bg-white/5 transition disabled:opacity-50"
          title="Refresh Teams Data"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Sub-View Content */}
      {subTab === 'gallery' && (
        <ProjectGalleryView
          classroomId={classroomId}
          cards={cards}
          settings={settings}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          isLoading={isLoading}
          onRefresh={loadData}
          getAuthHeaders={getAuthHeaders}
          showToast={showToast}
          onOpenCreateTeamModal={() => setIsCreateTeamModalOpen(true)}
          onJoinTeam={handleJoinTeam}
          onLeaveTeam={handleLeaveTeam}
        />
      )}

      {subTab === 'studio' && isTeacherOrAdmin && (
        <TeamFormationStudioView
          classroomId={classroomId}
          stats={studioStats}
          settings={settings || {
            classroomId,
            formationMode: 'teacher_controlled',
            minTeamSize: 2,
            maxTeamSize: 6,
            joiningPolicy: 'direct',
            themePolicy: 'approval_required',
            allowMultipleTeams: false,
            membershipLocked: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }}
          teams={studioTeams}
          unassignedStudents={unassignedStudents}
          getAuthHeaders={getAuthHeaders}
          showToast={showToast}
          onRefresh={loadData}
        />
      )}

      {subTab === 'activity' && (
        <ProjectActivityTimeline
          activity={activity}
          isLoading={isLoading}
          onRefresh={loadData}
        />
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
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateTeamSubmit} className="p-6 space-y-4">
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
                  placeholder="e.g. Distributed Consensus Engine"
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
                  disabled={isSubmittingCreate}
                  className="px-5 py-2 rounded-lg bg-[#FF9100] text-black text-xs font-semibold hover:bg-[#FF9100]/90 transition disabled:opacity-50"
                >
                  {isSubmittingCreate ? 'Creating Team...' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
