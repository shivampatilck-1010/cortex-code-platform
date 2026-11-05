'use client';

import React, { useState } from 'react';
import { X, Check, Sparkles, Palette, Shield } from 'lucide-react';
import { ThemePresetId } from '@/lib/classroom/models';
import { THEME_PRESETS, ThemePresetDefinition } from './theme-presets';

interface ThemeStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  classroomId: string;
  teamId: string;
  teamName: string;
  projectTitle: string;
  currentPresetId: ThemePresetId;
  onPresetApplied: (presetId: ThemePresetId) => void;
  getAuthHeaders: () => Record<string, string>;
  showToast: (msg: string) => void;
}

export function ThemeStudioModal({
  isOpen,
  onClose,
  classroomId,
  teamId,
  teamName,
  projectTitle,
  currentPresetId,
  onPresetApplied,
  getAuthHeaders,
  showToast,
}: ThemeStudioModalProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<ThemePresetId>(currentPresetId || 'cortex_signature');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const activePreset: ThemePresetDefinition = THEME_PRESETS[selectedPresetId] || THEME_PRESETS.cortex_signature;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/v1/classrooms/${classroomId}/teams/${teamId}/theme`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ theme_preset_id: selectedPresetId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Theme preset '${activePreset.name}' applied successfully`);
        onPresetApplied(selectedPresetId);
        onClose();
      } else {
        showToast(data.error || 'Failed to update theme');
      }
    } catch {
      showToast('Error applying theme preset');
    } finally {
      setIsSaving(false);
    }
  };

  const presetList = Object.values(THEME_PRESETS);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#121318] border border-[#282A36] rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[#282A36] flex items-center justify-between bg-[#17181F]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-[#FF9100]/10 border border-[#FF9100]/30 flex items-center justify-center text-[#FF9100]">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
                Theme Studio
                <span className="text-xs px-2 py-0.5 rounded bg-[#282A36] text-[#A0A0A0] font-mono">
                  {teamName}
                </span>
              </h2>
              <p className="text-xs text-[#8A8F98]">
                Select a visual identity preset to customize your project card and workspace aura
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8A8F98] hover:text-white hover:bg-[#282A36] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Live Preview Card */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[#8A8F98] mb-3 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#FF9100]" />
              Live Preset Preview
            </div>
            <div
              className={`relative rounded-xl border p-5 overflow-hidden transition-all duration-300 ${activePreset.cardBg} ${activePreset.cardBorder}`}
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${activePreset.headerGradient} pointer-events-none opacity-80`}
              />
              <div className="relative z-10 space-y-3">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${activePreset.badgeBg} ${activePreset.badgeText}`}
                  >
                    {activePreset.name} Preset
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-[#8A8F98]">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activePreset.accentColor }} />
                    Active Theme
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white">{projectTitle || 'Autonomous Neural Agent'}</h3>
                  <p className="text-xs text-[#A0A0A0] font-mono mt-0.5">{teamName || 'Team Alpha'}</p>
                </div>

                <p className="text-xs text-[#8A8F98] line-clamp-2">
                  {activePreset.description}
                </p>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-[#8A8F98]">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-1.5">
                      <div className="w-6 h-6 rounded-full bg-[#282A36] border border-white/20 flex items-center justify-center text-[10px] text-white">
                        SC
                      </div>
                      <div className="w-6 h-6 rounded-full bg-[#282A36] border border-white/20 flex items-center justify-center text-[10px] text-white">
                        AC
                      </div>
                    </div>
                    <span>4 members</span>
                  </div>
                  <span className="font-mono text-[11px]" style={{ color: activePreset.accentColor }}>
                    Theme Preview
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Preset Selector Grid */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[#8A8F98] mb-3">
              Available Visual Presets ({presetList.length})
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {presetList.map((preset) => {
                const isSelected = selectedPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedPresetId(preset.id)}
                    className={`text-left p-3.5 rounded-lg border transition relative flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#FF9100] bg-[#1C1E26] shadow-lg ring-1 ring-[#FF9100]/30'
                        : 'border-[#282A36] bg-[#14151B] hover:border-[#3E4251] hover:bg-[#181921]'
                    }`}
                  >
                    <div>
                      {/* Swatch chips */}
                      <div className="flex items-center space-x-1.5 mb-2.5">
                        {preset.previewColors.map((col, idx) => (
                          <div
                            key={idx}
                            className="w-4 h-4 rounded-full border border-white/10"
                            style={{ backgroundColor: col }}
                          />
                        ))}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white">{preset.name}</span>
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-[#FF9100] text-black flex items-center justify-center">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      <p className="text-[11px] text-[#8A8F98] mt-1 line-clamp-2 leading-relaxed">
                        {preset.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-[#666]">
                        {preset.id}
                      </span>
                      {preset.id === currentPresetId && (
                        <span className="text-[10px] text-[#FF9100] font-medium">
                          Current
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#282A36] bg-[#17181F] flex items-center justify-between">
          <div className="text-xs text-[#8A8F98] flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-[#A0A0A0]" />
            Themes are rendered across project cards, dashboards, and shared workspaces
          </div>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg text-xs font-medium text-[#A0A0A0] hover:text-white hover:bg-[#282A36] transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 rounded-lg text-xs font-semibold bg-[#FF9100] hover:bg-[#FF9100]/90 text-black transition flex items-center space-x-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Apply Preset</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
