'use client';

import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  X, 
  Palette, 
  ArrowUpDown,
  BookOpen,
  ExternalLink
} from 'lucide-react';
import { ProjectCard, GalleryProjectCardData } from './ProjectCard';
import { ThemeStudioModal } from './ThemeStudioModal';
import { ThemePresetId, ClassroomTeamSettings, TeamThemePolicy } from '@/lib/classroom/models';

interface ProjectGalleryViewProps {
  classroomId: string;
  cards: GalleryProjectCardData[];
  settings: ClassroomTeamSettings | null;
  currentUserId: string;
  currentUserRole: string;
  isLoading: boolean;
  onRefresh: () => void;
  getAuthHeaders: () => Record<string, string>;
  showToast: (msg: string) => void;
  onOpenCreateTeamModal: () => void;
  onJoinTeam: (teamId: string) => void;
  onLeaveTeam: (teamId: string) => void;
}

export function ProjectGalleryView({
  classroomId,
  cards,
  settings,
  currentUserId,
  currentUserRole,
  isLoading,
  onRefresh,
  getAuthHeaders,
  showToast,
  onOpenCreateTeamModal,
  onJoinTeam,
  onLeaveTeam,
}: ProjectGalleryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'updated' | 'name' | 'members'>('updated');

  // Selected card for Details Drawer
  const [selectedCardForDetails, setSelectedCardForDetails] = useState<GalleryProjectCardData | null>(null);

  // Theme Studio Modal State
  const [themeModalCard, setThemeModalCard] = useState<GalleryProjectCardData | null>(null);

  const isTeacherOrAdmin = currentUserRole === 'teacher' || currentUserRole === 'admin';
  const formationMode = settings?.formationMode || 'teacher_controlled';
  const themePolicy: TeamThemePolicy = settings?.themePolicy || 'approval_required';

  // Can current user create a team?
  // Teacher/Admin can always create. Students can create only in student_created mode.
  const canCreateTeam = isTeacherOrAdmin || formationMode === 'student_created';

  // Can current user join teams?
  // In teacher_created_student_selected or student_created, if user is not already in a team (or if multiple teams allowed).
  const userTeamIds = useMemo(() => {
    return cards
      .filter((c) => c.members.some((m) => m.userId === currentUserId))
      .map((c) => c.id);
  }, [cards, currentUserId]);

  const canJoinAny = useMemo(() => {
    if (isTeacherOrAdmin) return false;
    if (formationMode === 'teacher_controlled') return false; // Teacher assigns strictly
    if (!settings?.allowMultipleTeams && userTeamIds.length > 0) return false;
    return true;
  }, [isTeacherOrAdmin, formationMode, settings?.allowMultipleTeams, userTeamIds.length]);

  // Filter & Sort Cards
  const filteredCards = useMemo(() => {
    let result = [...cards];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.project_title.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          (c.description && c.description.toLowerCase().includes(q)) ||
          c.members.some((m) => m.userName && m.userName.toLowerCase().includes(q))
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter((c) => c.status.toLowerCase() === statusFilter.toLowerCase());
    }

    result.sort((a, b) => {
      if (sortBy === 'updated') {
        return b.updated_at - a.updated_at;
      }
      if (sortBy === 'name') {
        return a.project_title.localeCompare(b.project_title);
      }
      if (sortBy === 'members') {
        return b.member_count - a.member_count;
      }
      return 0;
    });

    return result;
  }, [cards, searchQuery, statusFilter, sortBy]);

  const statusOptions = [
    { id: 'all', label: 'All Projects' },
    { id: 'forming', label: 'Forming' },
    { id: 'active', label: 'Active' },
    { id: 'submitted', label: 'Submitted' },
    { id: 'completed', label: 'Completed' },
  ];

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="bg-[#111216] border border-[#282A36] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8F98]" />
          <input
            type="text"
            placeholder="Search projects by title, team name, or member..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#17181F] border border-[#282A36] rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-[#666] focus:outline-none focus:border-[#FF9100] transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#666] hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills & Sort Dropdown & Action */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Status Pills */}
          <div className="flex items-center bg-[#17181F] p-1 rounded-lg border border-[#282A36] gap-1">
            {statusOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setStatusFilter(opt.id)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                  statusFilter === opt.id
                    ? 'bg-[#FF9100] text-black font-semibold shadow-sm'
                    : 'text-[#8A8F98] hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <div className="relative flex items-center bg-[#17181F] border border-[#282A36] rounded-lg px-2.5 py-1.5 gap-2 text-xs text-[#8A8F98]">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-white text-xs focus:outline-none cursor-pointer"
            >
              <option value="updated" className="bg-[#17181F] text-white">Most Active</option>
              <option value="name" className="bg-[#17181F] text-white">Project Title (A-Z)</option>
              <option value="members" className="bg-[#17181F] text-white">Member Count</option>
            </select>
          </div>

          {/* Create Team Button */}
          {canCreateTeam && (
            <button
              type="button"
              onClick={onOpenCreateTeamModal}
              className="px-3.5 py-2 rounded-lg bg-[#FF9100] hover:bg-[#FF9100]/90 text-black text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Create Team</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid of Project Cards */}
      {isLoading ? (
        <div className="py-20 text-center text-[#8A8F98]">
          <div className="w-8 h-8 border-2 border-[#FF9100] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading Project Teams...</p>
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="bg-[#111216] border border-[#282A36] rounded-xl py-16 px-6 text-center">
          <BookOpen className="w-10 h-10 mx-auto text-[#444] mb-3" />
          <h4 className="text-base font-bold text-white">No Project Teams Found</h4>
          <p className="text-xs text-[#8A8F98] max-w-md mx-auto mt-1">
            {searchQuery || statusFilter !== 'all'
              ? 'No project teams match your active search or filter parameters. Try clearing your filters.'
              : 'There are currently no formed project teams in this classroom.'}
          </p>
          {canCreateTeam && !searchQuery && statusFilter === 'all' && (
            <button
              onClick={onOpenCreateTeamModal}
              className="mt-4 px-4 py-2 rounded-lg bg-[#FF9100] text-black text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Form First Team</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCards.map((card) => (
            <ProjectCard
              key={card.id}
              card={card}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              themePolicy={themePolicy}
              onOpenDetails={(c) => setSelectedCardForDetails(c)}
              onOpenThemeStudio={(c) => setThemeModalCard(c)}
              onJoinTeam={onJoinTeam}
              onLeaveTeam={onLeaveTeam}
              canJoin={canJoinAny}
            />
          ))}
        </div>
      )}

      {/* Team Details Modal / Drawer */}
      {selectedCardForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#121318] border border-[#282A36] rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#282A36] flex items-center justify-between bg-[#17181F]">
              <div>
                <span className="text-xs font-mono text-[#FF9100]">{selectedCardForDetails.name}</span>
                <h3 className="text-lg font-bold text-white mt-0.5">{selectedCardForDetails.project_title}</h3>
              </div>
              <button
                onClick={() => setSelectedCardForDetails(null)}
                className="p-1.5 rounded-lg text-[#8A8F98] hover:text-white hover:bg-[#282A36] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Description */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#8A8F98] mb-1.5">
                  Project Description
                </h4>
                <p className="text-xs text-[#CCCCCC] leading-relaxed bg-[#17181F] border border-[#282A36] p-3 rounded-lg">
                  {selectedCardForDetails.description || 'No description provided.'}
                </p>
              </div>

              {/* Theme & Repository info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-[#17181F] border border-[#282A36] p-3 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-[#8A8F98]">Visual Theme</div>
                    <div className="text-xs font-semibold text-white capitalize mt-0.5">
                      {selectedCardForDetails.theme_preset_id.replace(/_/g, ' ')}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const c = selectedCardForDetails;
                      setSelectedCardForDetails(null);
                      setThemeModalCard(c);
                    }}
                    className="p-1.5 rounded-lg text-[#FF9100] hover:bg-white/5 transition flex items-center gap-1 text-xs"
                  >
                    <Palette className="w-3.5 h-3.5" />
                    <span>Change</span>
                  </button>
                </div>

                <div className="bg-[#17181F] border border-[#282A36] p-3 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-[#8A8F98]">Repository</div>
                    <div className="text-xs font-mono text-[#A0A0A0] mt-0.5 truncate max-w-[160px]">
                      {selectedCardForDetails.repo_url || 'None linked'}
                    </div>
                  </div>
                  {selectedCardForDetails.repo_url && (
                    <a
                      href={selectedCardForDetails.repo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-white hover:text-[#FF9100] transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>

              {/* Members List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[#8A8F98]">
                    Team Members ({selectedCardForDetails.members.length} / {selectedCardForDetails.max_size})
                  </h4>
                  {selectedCardForDetails.is_locked && (
                    <span className="text-[11px] text-amber-400 font-mono">Roster Locked</span>
                  )}
                </div>

                <div className="space-y-2">
                  {selectedCardForDetails.members.map((member) => (
                    <div
                      key={member.id}
                      className="bg-[#17181F] border border-[#282A36] rounded-lg p-3 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-[#282A36] border border-white/10 flex items-center justify-center text-xs font-semibold text-white">
                          {(member.userName || member.userId).slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-white flex items-center gap-2">
                            <span>{member.userName || member.userId}</span>
                            {member.userId === currentUserId && (
                              <span className="text-[10px] text-[#FF9100]">(You)</span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#8A8F98] font-mono">
                            {member.userEmail || 'No email published'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase font-semibold ${
                            member.teamRole === 'leader'
                              ? 'bg-[#FF9100]/20 text-[#FF9100] border border-[#FF9100]/30'
                              : 'bg-[#282A36] text-[#A0A0A0]'
                          }`}
                        >
                          {member.teamRole}
                        </span>
                      </div>
                    </div>
                  ))}

                  {selectedCardForDetails.members.length === 0 && (
                    <p className="text-xs text-[#8A8F98] italic text-center py-4 bg-[#17181F] rounded-lg border border-[#282A36]">
                      No students currently assigned to this team
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#282A36] bg-[#17181F] flex items-center justify-end">
              <button
                onClick={() => setSelectedCardForDetails(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-[#A0A0A0] hover:text-white hover:bg-[#282A36] transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Theme Studio Modal */}
      {themeModalCard && (
        <ThemeStudioModal
          isOpen={Boolean(themeModalCard)}
          onClose={() => setThemeModalCard(null)}
          classroomId={classroomId}
          teamId={themeModalCard.id}
          teamName={themeModalCard.name}
          projectTitle={themeModalCard.project_title}
          currentPresetId={themeModalCard.theme_preset_id as ThemePresetId}
          onPresetApplied={() => {
            onRefresh();
            setThemeModalCard(null);
          }}
          getAuthHeaders={getAuthHeaders}
          showToast={showToast}
        />
      )}
    </div>
  );
}
